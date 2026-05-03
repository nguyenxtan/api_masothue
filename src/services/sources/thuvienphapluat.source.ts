import * as cheerio from "cheerio";
import { fetchHtml, debugLog, FetchResult } from "../../utils/httpClient";
import { normalizeText } from "../../utils/normalizeText";
import { TaxLookupResult } from "../../types/taxLookup.types";
import { AttemptRecord } from "../../types/searchDiscovery.types";

const BASE_URL = "https://thuvienphapluat.vn";

function looksLikeDetail(html: string, taxCode: string): boolean {
  return (
    html.includes(`mst-${taxCode}.html`) ||
    /Địa chỉ trụ sở/i.test(html) ||
    new RegExp(`Mã số thuế[^<]*${taxCode}`, "i").test(html)
  );
}

function recordAttempt(
  attempts: AttemptRecord[] | undefined,
  strategy: string,
  url: string,
  res: FetchResult | null,
  taxCode: string
) {
  attempts?.push({
    strategy,
    url,
    status: res?.status ?? null,
    matchedTaxCode: res ? res.html.includes(taxCode) : false,
  });
}

async function findDetailHtml(
  taxCode: string,
  attempts?: AttemptRecord[]
): Promise<FetchResult | null> {
  const searchEndpoints = [
    `${BASE_URL}/ma-so-thue/tim-ma-so-thue.aspx?keyword=${encodeURIComponent(taxCode)}`,
    `${BASE_URL}/ma-so-thue?keyword=${encodeURIComponent(taxCode)}`,
    `${BASE_URL}/ma-so-thue/${encodeURIComponent(taxCode)}`,
  ];

  for (const url of searchEndpoints) {
    const res = await fetchHtml(url);
    recordAttempt(attempts, "tvpl-search", url, res, taxCode);
    if (!res) continue;

    if (
      res.finalUrl &&
      res.finalUrl.includes(`mst-${taxCode}.html`) &&
      looksLikeDetail(res.html, taxCode)
    ) {
      debugLog("tvpl: search redirected to detail", res.finalUrl);
      return res;
    }

    const $ = cheerio.load(res.html);
    let foundHref: string | null = null;
    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes(`mst-${taxCode}.html`)) {
        foundHref = href.startsWith("http") ? href : `${BASE_URL}${href}`;
        return false;
      }
      return;
    });

    if (foundHref) {
      debugLog("tvpl: detail link discovered", foundHref);
      const detail = await fetchHtml(foundHref);
      recordAttempt(attempts, "tvpl-detail", foundHref, detail, taxCode);
      if (detail) return detail;
    }
  }

  return null;
}

function extractInvoiceAddress($: cheerio.CheerioAPI): string | null {
  const allText = normalizeText($("body").text());
  const lower = allText.toLowerCase();
  const idx = lower.indexOf("thông tin xuất hóa đơn");
  if (idx < 0) return null;

  const after = allText.substring(idx, idx + 1500);
  const m = after.match(
    /Địa chỉ\s*:\s*(.+?)(?=\s+(?:Mã số thuế|Tên đơn vị|Tên người nộp thuế|Điện thoại|Email|Tài khoản|Hotline|$))/i
  );
  if (m && m[1]) {
    const candidate = normalizeText(m[1]);
    if (candidate.length > 3) return candidate;
  }
  return null;
}

function extractFromDetail($: cheerio.CheerioAPI) {
  const result = {
    companyName: null as string | null,
    taxAddress: null as string | null,
    address: null as string | null,
  };

  const h1 = normalizeText($("h1").first().text());
  if (h1) result.companyName = h1;

  const bodyText = normalizeText($("body").text());

  const merged = bodyText.match(
    /Địa chỉ trụ sở \(sau sáp nhập\)\s*:?\s*(.+?)(?=\s+(?:Mã số thuế|Người đại diện|Điện thoại|Ngày hoạt động|Tình trạng|Loại hình|Ngành nghề|Địa chỉ|$))/i
  );
  const primary = bodyText.match(
    /Địa chỉ trụ sở(?!\s*\()\s*:?\s*(.+?)(?=\s+(?:Mã số thuế|Người đại diện|Điện thoại|Ngày hoạt động|Tình trạng|Loại hình|Ngành nghề|Địa chỉ|$))/i
  );

  if (merged && merged[1]) {
    result.taxAddress = normalizeText(merged[1]);
  } else if (primary && primary[1]) {
    result.taxAddress = normalizeText(primary[1]);
  }

  result.address = extractInvoiceAddress($);

  return result;
}

export function parseThuVienPhapLuatHtml(
  html: string,
  taxCode: string
): TaxLookupResult | null {
  if (!html) return null;
  try {
    if (!looksLikeDetail(html, taxCode)) {
      debugLog("tvpl: detail does not look like a tax-detail page");
      return null;
    }

    const $ = cheerio.load(html);
    if (!normalizeText($("body").text()).includes(taxCode)) {
      debugLog("tvpl: body does not contain taxCode", taxCode);
      return null;
    }

    const data = extractFromDetail($);

    debugLog("tvpl: parsed", {
      taxCode,
      companyName: data.companyName,
      taxAddress: data.taxAddress,
      address: data.address,
    });

    if (!data.companyName && !data.taxAddress && !data.address) return null;

    return {
      success: true,
      taxCode,
      companyName: data.companyName,
      taxAddress: data.taxAddress,
      address: data.address,
      source: "thuvienphapluat.vn",
    };
  } catch (err) {
    debugLog("tvpl: parse error", err);
    return null;
  }
}

export async function lookupFromThuVienPhapLuat(
  taxCode: string,
  attempts?: AttemptRecord[]
): Promise<TaxLookupResult | null> {
  const detail = await findDetailHtml(taxCode, attempts);
  if (!detail || !detail.html) {
    debugLog("tvpl: no detail HTML for", taxCode);
    return null;
  }
  return parseThuVienPhapLuatHtml(detail.html, taxCode);
}
