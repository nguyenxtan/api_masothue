import { TaxLookupResult } from "../types/taxLookup.types";
import { AttemptRecord } from "../types/searchDiscovery.types";
import {
  lookupFromMasothue,
  parseMasothueHtml,
} from "./sources/masothue.source";
import {
  lookupFromThuVienPhapLuat,
  parseThuVienPhapLuatHtml,
} from "./sources/thuvienphapluat.source";
import { discoverViaExternalSearch } from "./searchDiscovery/searchDiscovery.service";
import { fetchHtml } from "../utils/httpClient";

const MASOTHUE_HOSTS = new Set(["masothue.com", "www.masothue.com"]);
const TVPL_HOSTS = new Set(["thuvienphapluat.vn", "www.thuvienphapluat.vn"]);

export interface LookupOptions {
  detailUrl?: string;
  attempts?: AttemptRecord[];
}

function nullResult(taxCode: string): TaxLookupResult {
  return {
    success: true,
    taxCode,
    companyName: null,
    taxAddress: null,
    address: null,
    source: null,
  };
}

async function lookupByDetailUrl(
  taxCode: string,
  detailUrl: string,
  attempts: AttemptRecord[] | undefined
): Promise<TaxLookupResult | null> {
  let parsed: URL;
  try {
    parsed = new URL(detailUrl);
  } catch {
    attempts?.push({
      strategy: "detail-url",
      url: detailUrl,
      error: "invalid url",
    });
    return null;
  }

  const isMasothue = MASOTHUE_HOSTS.has(parsed.hostname);
  const isTvpl = TVPL_HOSTS.has(parsed.hostname);
  if (!isMasothue && !isTvpl) {
    attempts?.push({
      strategy: "detail-url",
      url: detailUrl,
      error: "host not allowed",
    });
    return null;
  }

  const fetched = await fetchHtml(detailUrl);
  attempts?.push({
    strategy: "detail-url",
    url: detailUrl,
    status: fetched?.status ?? null,
    matchedTaxCode: fetched ? fetched.html.includes(taxCode) : false,
  });

  if (!fetched || fetched.status >= 400) return null;
  if (!fetched.html.includes(taxCode)) return null;

  if (isMasothue) {
    return parseMasothueHtml(fetched.html, taxCode);
  }
  return parseThuVienPhapLuatHtml(fetched.html, taxCode);
}

export async function lookupTaxCode(
  taxCode: string,
  options: LookupOptions = {}
): Promise<TaxLookupResult> {
  const { detailUrl, attempts } = options;

  if (detailUrl) {
    const fromUrl = await lookupByDetailUrl(taxCode, detailUrl, attempts);
    if (fromUrl) return fromUrl;
  }

  try {
    const fromMasothue = await lookupFromMasothue(taxCode, attempts);
    if (fromMasothue) return fromMasothue;
  } catch {
    attempts?.push({ strategy: "masothue", error: "exception" });
  }

  try {
    const fromTVPL = await lookupFromThuVienPhapLuat(taxCode, attempts);
    if (fromTVPL) return fromTVPL;
  } catch {
    attempts?.push({ strategy: "thuvienphapluat", error: "exception" });
  }

  const fromExternal = await discoverViaExternalSearch(taxCode, attempts);
  if (fromExternal) return fromExternal;

  return nullResult(taxCode);
}

export { lookupFromMasothue, lookupFromThuVienPhapLuat };
