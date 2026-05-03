import axios from "axios";
import { debugLog } from "../../utils/httpClient";

export interface BraveSearchResult {
  url: string;
  title?: string;
  description?: string;
}

export async function braveSearch(
  query: string,
  apiKey: string,
  timeoutMs: number
): Promise<BraveSearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
  try {
    const res = await axios.get(url, {
      timeout: timeoutMs,
      headers: {
        "X-Subscription-Token": apiKey,
        Accept: "application/json",
        "Accept-Encoding": "gzip",
      },
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      debugLog("brave-search: non-200", { status: res.status, query });
      return [];
    }
    const results: BraveSearchResult[] =
      (res.data?.web?.results || []).map((r: any) => ({
        url: r?.url,
        title: r?.title,
        description: r?.description,
      })) || [];
    return results.filter((r) => typeof r.url === "string" && r.url.length > 0);
  } catch (err: any) {
    debugLog("brave-search: error", { query, message: err?.message });
    return [];
  }
}
