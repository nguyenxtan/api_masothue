import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

const TIMEOUT_MS = parseInt(process.env.HTTP_TIMEOUT_MS || "10000", 10);
const DEBUG = process.env.DEBUG_LOOKUP === "true";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const httpClient: AxiosInstance = axios.create({
  timeout: TIMEOUT_MS,
  maxRedirects: 5,
  responseType: "text",
  headers: {
    "User-Agent": USER_AGENT,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
  },
  validateStatus: (status) => status >= 200 && status < 400,
});

export interface FetchResult {
  html: string;
  finalUrl: string;
  status: number;
}

export async function fetchHtml(
  url: string,
  config?: AxiosRequestConfig
): Promise<FetchResult | null> {
  try {
    const res = await httpClient.get<string>(url, config);
    const finalUrl =
      (res.request?.res?.responseUrl as string | undefined) ||
      (res.request?.responseURL as string | undefined) ||
      url;
    const html = typeof res.data === "string" ? res.data : String(res.data);
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(
        `[lookup] GET ${url} -> status=${res.status} final=${finalUrl} bytes=${html.length}`
      );
    }
    return { html, finalUrl, status: res.status };
  } catch (err: any) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(
        `[lookup] GET ${url} -> error ${err?.code || ""} ${err?.message || ""}`
      );
    }
    return null;
  }
}

export async function safeGet(
  url: string,
  config?: AxiosRequestConfig
): Promise<string | null> {
  const r = await fetchHtml(url, config);
  return r ? r.html : null;
}

export function debugLog(...args: unknown[]) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log("[lookup]", ...args);
  }
}
