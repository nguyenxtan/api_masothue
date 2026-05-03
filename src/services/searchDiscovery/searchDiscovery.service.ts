import { fetchHtml, debugLog } from "../../utils/httpClient";
import { parseMasothueHtml } from "../sources/masothue.source";
import { TaxLookupResult } from "../../types/taxLookup.types";
import { AttemptRecord } from "../../types/searchDiscovery.types";
import { braveSearch } from "./braveSearch.provider";

const ALLOWED_HOSTS = new Set(["masothue.com", "www.masothue.com"]);

function selectMasothueDetailUrl(urls: string[], taxCode: string): string | null {
  for (const u of urls) {
    try {
      const url = new URL(u);
      if (!ALLOWED_HOSTS.has(url.hostname)) continue;
      if (url.pathname.startsWith("/Search/")) continue;
      if (!url.pathname.startsWith(`/${taxCode}-`)) continue;
      return `${url.protocol}//${url.hostname}${url.pathname}`;
    } catch {
      continue;
    }
  }
  return null;
}

export async function discoverViaExternalSearch(
  taxCode: string,
  attempts: AttemptRecord[] | undefined
): Promise<TaxLookupResult | null> {
  if (process.env.EXTERNAL_SEARCH_ENABLED !== "true") {
    return null;
  }
  const provider = (process.env.EXTERNAL_SEARCH_PROVIDER || "brave").toLowerCase();
  if (provider !== "brave") {
    debugLog("external-search: unsupported provider", provider);
    return null;
  }
  const apiKey = process.env.BRAVE_SEARCH_API_KEY || "";
  if (!apiKey) {
    attempts?.push({
      strategy: "brave-search",
      error: "missing BRAVE_SEARCH_API_KEY",
    });
    return null;
  }
  const timeout = parseInt(
    process.env.EXTERNAL_SEARCH_TIMEOUT_MS || "10000",
    10
  );

  const queries = [
    `site:masothue.com ${taxCode}`,
    `"${taxCode}" "masothue"`,
  ];

  for (const query of queries) {
    const results = await braveSearch(query, apiKey, timeout);
    const urls = results.map((r) => r.url);
    const selected = selectMasothueDetailUrl(urls, taxCode);

    attempts?.push({
      strategy: "brave-search",
      query,
      candidateUrls: urls,
      selectedUrl: selected,
    });

    debugLog("brave-search", { query, candidates: urls.length, selected });

    if (!selected) continue;

    const fetched = await fetchHtml(selected);
    attempts?.push({
      strategy: "brave-search-fetch",
      url: selected,
      status: fetched?.status ?? null,
      matchedTaxCode: fetched ? fetched.html.includes(taxCode) : false,
    });

    if (!fetched || fetched.status >= 400) continue;
    if (!fetched.html.includes(taxCode)) continue;

    const result = parseMasothueHtml(fetched.html, taxCode);
    if (result) return result;
  }

  return null;
}
