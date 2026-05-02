import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

const TIMEOUT_MS = parseInt(process.env.HTTP_TIMEOUT_MS || "10000", 10);

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
  },
  validateStatus: (status) => status >= 200 && status < 400,
});

export async function safeGet(
  url: string,
  config?: AxiosRequestConfig
): Promise<string | null> {
  try {
    const res = await httpClient.get<string>(url, config);
    if (typeof res.data === "string") return res.data;
    return String(res.data);
  } catch (err) {
    return null;
  }
}
