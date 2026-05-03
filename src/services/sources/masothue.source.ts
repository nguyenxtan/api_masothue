import * as cheerio from "cheerio";
import { fetchHtml, debugLog, FetchResult } from "../../utils/httpClient";
import { normalizeText } from "../../utils/normalizeText";
import { TaxLookupResult } from "../../types/taxLookup.types";

const BASE_URL = "https://masothue.com";

const KNOWN_DETAIL_URLS: Record<string, string> = {
  "0100104595-017":
    "https://masothue.com/0100104595-017-cong-ty-van-tai-bien-container-vimc-chi-nhanh-tong-cong-ty-hang-hai-viet-nam-ctcp",
};

function isDetailHtml(html: string): boolean {
  return /class\s*=\s*["']table-taxinfo["']/i.test(html);
}

function pageHasExactTaxCode($: cheerio.CheerioAPI, taxCode: string): boolean {
  const fromItemprop = normalizeText(
    $('.table-taxinfo td[itemprop="taxID"]').first().text() ||
      $('td[itemprop="taxID"]').first().text() ||
      $('span[itemprop="taxID"]').first().text()
  );
  if (fromItemprop && fromItemprop.includes(taxCode)) return true;

  const bodyText = normalizeText($("body").text());
  return bodyText.includes(taxCode);
}

function htmlMatchesTaxCode(html: string, taxCode: string): boolean {
  if (!html) return false;
  if (!html.includes(taxCode)) return false;
  if (isDetailHtml(html)) return true;
  const $ = cheerio.load(html);
  const title = normalizeText($("title").first().text());
  if (title.includes(taxCode)) return true;
  const meta = normalizeText(
    $('meta[name="description"]').attr("content") || ""
  );
  if (meta.includes(taxCode)) return true;
  return false;
}

function logFetchAttempt(
  label: string,
  url: string,
  res: FetchResult | null,
  taxCode: string
) {
  debugLog(`masothue: ${label}`, {
    url,
    status: res?.status ?? null,
    finalUrl: res?.finalUrl ?? null,
    containsTaxCode: res ? res.html.includes(taxCode) : false,
  });
}

async function findDetailHtml(taxCode: string): Promise<FetchResult | null> {
  // 1. Try direct short URL: https://masothue.com/{taxCode}
  const directUrl = `${BASE_URL}/${taxCode}`;
  const directRes = await fetchHtml(directUrl);
  logFetchAttempt("direct short URL", directUrl, directRes, taxCode);
  if (directRes && htmlMatchesTaxCode(directRes.html, taxCode)) {
    return directRes;
  }

  // 2. Try search endpoint (often 302s straight to the detail page).
  const searchUrl = `${BASE_URL}/Search/?q=${encodeURIComponent(taxCode)}&type=auto&token=&force-search=1`;
  const searchRes = await fetchHtml(searchUrl);
  logFetchAttempt("search URL", searchUrl, searchRes, taxCode);

  if (searchRes) {
    if (htmlMatchesTaxCode(searchRes.html, taxCode)) {
      return searchRes;
    }

    const $ = cheerio.load(searchRes.html);
    let detailHref: string | null = null;
    const exact = $(`a[href*="/${taxCode}-"]`).first().attr("href");
    if (exact) {
      detailHref = exact.startsWith("http") ? exact : `${BASE_URL}${exact}`;
    } else {
      $("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (href.includes(taxCode) && /\/\d{10}(-\d{3})?-/.test(href)) {
          detailHref = href.startsWith("http") ? href : `${BASE_URL}${href}`;
          return false;
        }
        return;
      });
    }

    if (detailHref) {
      const detailRes = await fetchHtml(detailHref);
      logFetchAttempt("search-list detail link", detailHref, detailRes, taxCode);
      if (detailRes && htmlMatchesTaxCode(detailRes.html, taxCode)) {
        return detailRes;
      }
    } else {
      debugLog("masothue: no detail link found in search results");
    }
  }

  // 3. Emergency known URL fallback.
  const known = KNOWN_DETAIL_URLS[taxCode];
  if (known) {
    const knownRes = await fetchHtml(known);
    logFetchAttempt("known fallback URL", known, knownRes, taxCode);
    if (knownRes && htmlMatchesTaxCode(knownRes.html, taxCode)) {
      return knownRes;
    }
  }

  return null;
}

function extractFromMainBlock($: cheerio.CheerioAPI) {
  const result = {
    companyName: null as string | null,
    taxCode: null as string | null,
    taxAddress: null as string | null,
    address: null as string | null,
  };

  const mainTable = $("table.table-taxinfo").first();

  if (mainTable.length) {
    const nameCell = normalizeText(
      mainTable.find('th[itemprop="name"]').first().text() ||
        mainTable.find("thead th").first().text()
    );
    if (nameCell) result.companyName = nameCell;

    const taxIdCell = normalizeText(
      mainTable.find('td[itemprop="taxID"]').first().text()
    );
    if (taxIdCell) result.taxCode = taxIdCell;

    mainTable.find("tbody > tr").each((_, el) => {
      const tds = $(el).find("> td");
      if (tds.length < 2) return;

      const labelRaw = normalizeText($(tds[0]).text()).toLowerCase();
      const valueText = normalizeText($(tds[1]).text());
      if (!labelRaw || !valueText) return;

      if (labelRaw.includes("địa chỉ thuế")) {
        if (!result.taxAddress) result.taxAddress = valueText;
      } else if (labelRaw === "địa chỉ" || /^địa chỉ\s*$/.test(labelRaw)) {
        if (!result.address) result.address = valueText;
      }
    });
  }

  if (!result.companyName) {
    const h1 = normalizeText($("h1").first().text());
    if (h1) result.companyName = h1;
  }

  return result;
}

function extractFromMeta(
  $: cheerio.CheerioAPI,
  taxCode: string
): {
  companyName: string | null;
  address: string | null;
  title: string;
  metaDesc: string;
} {
  const fallback = {
    companyName: null as string | null,
    address: null as string | null,
    title: "",
    metaDesc: "",
  };

  const titleRaw = normalizeText($("title").first().text());
  fallback.title = titleRaw;
  if (titleRaw) {
    let title = titleRaw.replace(/\s*-\s*MaSoThue\s*$/i, "");
    const prefix = `${taxCode} - `;
    if (title.startsWith(prefix)) {
      const rest = title.substring(prefix.length).trim();
      if (rest) fallback.companyName = rest;
    }
  }

  const metaDesc = normalizeText(
    $('meta[name="description"]').attr("content") || ""
  );
  fallback.metaDesc = metaDesc;
  if (metaDesc) {
    const markerLabeled = `mã số thuế ${taxCode} - `;
    const lower = metaDesc.toLowerCase();
    let idx = lower.indexOf(markerLabeled.toLowerCase());
    let consumed = markerLabeled.length;

    if (idx < 0) {
      const markerBare = `${taxCode} - `;
      idx = metaDesc.indexOf(markerBare);
      consumed = markerBare.length;
    }

    if (idx >= 0) {
      const after = metaDesc.substring(idx + consumed).trim();
      if (after) fallback.address = after;
    }
  }

  return fallback;
}

export async function lookupFromMasothue(
  taxCode: string
): Promise<TaxLookupResult | null> {
  try {
    const detail = await findDetailHtml(taxCode);
    if (!detail || !detail.html) {
      debugLog("masothue: no detail HTML for", taxCode);
      return null;
    }

    const $ = cheerio.load(detail.html);

    const data = extractFromMainBlock($);
    const meta = extractFromMeta($, taxCode);

    debugLog("masothue: meta", {
      title: meta.title,
      metaDesc: meta.metaDesc,
      fallbackCompanyName: meta.companyName,
      fallbackAddress: meta.address,
    });

    const hasTaxCodeInMeta =
      meta.title.includes(taxCode) || meta.metaDesc.includes(taxCode);

    if (!pageHasExactTaxCode($, taxCode) && !hasTaxCodeInMeta) {
      debugLog("masothue: page does not contain exact taxCode", taxCode);
      return null;
    }

    if (!data.companyName && meta.companyName) {
      debugLog("masothue: fallback companyName from <title>");
      data.companyName = meta.companyName;
    }
    if (!data.address && meta.address) {
      debugLog("masothue: fallback address from meta description");
      data.address = meta.address;
    }

    debugLog("masothue: parsed", {
      taxCode,
      finalUrl: detail.finalUrl,
      companyName: data.companyName,
      taxAddress: data.taxAddress,
      address: data.address,
    });

    if (!data.companyName && !data.taxAddress && !data.address) {
      return null;
    }

    return {
      success: true,
      taxCode,
      companyName: data.companyName,
      taxAddress: data.taxAddress,
      address: data.address,
      source: "masothue.com",
    };
  } catch (err) {
    debugLog("masothue: error", err);
    return null;
  }
}
