import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

const TIMEOUT_MS = parseInt(process.env.HTTP_TIMEOUT_MS || "10000", 10);
const DEBUG = process.env.DEBUG_LOOKUP === "true";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://masothue.com/",
  "sec-ch-ua":
    '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

const WGET_HEADERS: Record<string, string> = {
  "User-Agent": "Wget/1.21.4",
  Accept: "*/*",
  "Accept-Encoding": "identity",
  Connection: "close",
};

export const httpClient: AxiosInstance = axios.create({
  timeout: TIMEOUT_MS,
  maxRedirects: 5,
  responseType: "text",
  decompress: true,
  validateStatus: () => true,
  headers: BROWSER_HEADERS,
});

export interface FetchResult {
  html: string;
  finalUrl: string;
  status: number;
}

function getFinalUrl(res: AxiosResponse, url: string): string {
  return (
    (res.request?.res?.responseUrl as string | undefined) ||
    (res.request?.responseURL as string | undefined) ||
    url
  );
}

function logFetch(
  url: string,
  status: number,
  finalUrl: string,
  html: string,
  via: string
) {
  if (!DEBUG) return;
  const head = status >= 400 ? html.replace(/\s+/g, " ").slice(0, 200) : "";
  // eslint-disable-next-line no-console
  console.log(
    `[lookup] GET ${url} via=${via} status=${status} final=${finalUrl} bytes=${html.length}` +
      (head ? ` body[0..200]=${JSON.stringify(head)}` : "")
  );
}

async function tryAxios(
  url: string,
  headers: Record<string, string>,
  config?: AxiosRequestConfig
): Promise<FetchResult | null> {
  try {
    const res = await httpClient.get<string>(url, {
      ...config,
      headers: { ...headers, ...(config?.headers || {}) },
    });
    const finalUrl = getFinalUrl(res, url);
    const html = typeof res.data === "string" ? res.data : String(res.data ?? "");
    return { html, finalUrl, status: res.status };
  } catch (err: any) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(
        `[lookup] GET ${url} via=axios threw code=${err?.code || ""} msg=${err?.message || ""}`
      );
    }
    return null;
  }
}

async function tryNodeFetch(
  url: string,
  headers: Record<string, string>
): Promise<FetchResult | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        redirect: "follow",
        signal: ac.signal,
      });
      const html = await res.text();
      return {
        html,
        finalUrl: res.url || url,
        status: res.status,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(
        `[lookup] GET ${url} via=node-fetch threw code=${err?.code || ""} msg=${err?.message || ""}`
      );
    }
    return null;
  }
}

export async function fetchHtml(
  url: string,
  config?: AxiosRequestConfig
): Promise<FetchResult | null> {
  // 1. axios + browser headers
  let res = await tryAxios(url, BROWSER_HEADERS, config);
  if (res) {
    logFetch(url, res.status, res.finalUrl, res.html, "axios-browser");
    if (res.status < 400) return res;
  }

  // 2. axios + wget-like headers
  const wgetRes = await tryAxios(url, WGET_HEADERS, config);
  if (wgetRes) {
    logFetch(url, wgetRes.status, wgetRes.finalUrl, wgetRes.html, "axios-wget");
    if (wgetRes.status < 400) return wgetRes;
    if (!res) res = wgetRes;
  }

  // 3. node fetch + browser headers
  const fetchRes = await tryNodeFetch(url, BROWSER_HEADERS);
  if (fetchRes) {
    logFetch(
      url,
      fetchRes.status,
      fetchRes.finalUrl,
      fetchRes.html,
      "node-fetch-browser"
    );
    if (fetchRes.status < 400) return fetchRes;
    if (!res) res = fetchRes;
  }

  // Return last non-null response (even if 4xx) so callers can inspect it.
  return res;
}

export async function safeGet(
  url: string,
  config?: AxiosRequestConfig
): Promise<string | null> {
  const r = await fetchHtml(url, config);
  return r && r.status < 400 ? r.html : null;
}

export function debugLog(...args: unknown[]) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log("[lookup]", ...args);
  }
}
