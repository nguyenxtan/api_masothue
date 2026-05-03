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
import { buildMasothueDetailUrl } from "./sources/masothueUrl.service";
import { fetchHtml } from "../utils/httpClient";
import {
  lookupContext,
  LookupContext,
} from "../utils/lookupContext";
import { getCooldownRemainingSeconds } from "../utils/sourceCooldown";

const MASOTHUE_HOSTS = new Set(["masothue.com", "www.masothue.com"]);
const TVPL_HOSTS = new Set(["thuvienphapluat.vn", "www.thuvienphapluat.vn"]);

export interface LookupOptions {
  detailUrl?: string;
  companyName?: string;
  attempts?: AttemptRecord[];
}

export interface BlockedFields {
  blocked: true;
  reason: "SOURCE_BLOCKED_BY_ANTIBOT";
  retryAfterSeconds: number;
}

export type TaxLookupResponse = TaxLookupResult | (TaxLookupResult & BlockedFields);

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

async function lookupByGeneratedUrl(
  taxCode: string,
  companyName: string,
  attempts: AttemptRecord[] | undefined
): Promise<TaxLookupResult | null> {
  const generatedUrl = buildMasothueDetailUrl(taxCode, companyName);
  const fetched = await fetchHtml(generatedUrl);
  attempts?.push({
    strategy: "generated-masothue-url",
    url: generatedUrl,
    status: fetched?.status ?? null,
    matchedTaxCode: fetched ? fetched.html.includes(taxCode) : false,
  });
  if (!fetched || fetched.status >= 400) return null;
  if (!fetched.html.includes(taxCode)) return null;
  return parseMasothueHtml(fetched.html, taxCode);
}

async function runLookup(
  taxCode: string,
  options: LookupOptions
): Promise<TaxLookupResult> {
  const { detailUrl, companyName, attempts } = options;

  if (detailUrl) {
    const fromUrl = await lookupByDetailUrl(taxCode, detailUrl, attempts);
    if (fromUrl) return fromUrl;
  }

  if (companyName && companyName.trim().length > 0) {
    const fromGenerated = await lookupByGeneratedUrl(
      taxCode,
      companyName.trim(),
      attempts
    );
    if (fromGenerated) return fromGenerated;
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

function maxCooldownRemaining(hosts: Iterable<string>): number {
  let max = 0;
  for (const h of hosts) {
    const r = getCooldownRemainingSeconds(h);
    if (r > max) max = r;
  }
  return max;
}

export async function lookupTaxCode(
  taxCode: string,
  options: LookupOptions = {}
): Promise<TaxLookupResponse> {
  const ctx: LookupContext = { blockedHosts: new Set<string>() };

  const result = await lookupContext.run(ctx, () => runLookup(taxCode, options));

  const found =
    result.companyName !== null ||
    result.taxAddress !== null ||
    result.address !== null;

  if (!found && ctx.blockedHosts.size > 0) {
    const retry =
      maxCooldownRemaining(ctx.blockedHosts) ||
      parseInt(process.env.SOURCE_BLOCK_COOLDOWN_SECONDS || "1800", 10);
    return {
      ...result,
      blocked: true,
      reason: "SOURCE_BLOCKED_BY_ANTIBOT",
      retryAfterSeconds: retry,
    };
  }

  return result;
}

export { lookupFromMasothue, lookupFromThuVienPhapLuat };
