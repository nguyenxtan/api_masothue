import * as cheerio from "cheerio";
import { fetchHtml, debugLog, FetchResult } from "../../utils/httpClient";
import { normalizeText } from "../../utils/normalizeText";
import { TaxLookupResult } from "../../types/taxLookup.types";

const BASE_URL = "https://masothue.com";

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

async function findDetailHtml(taxCode: string): Promise<FetchResult | null> {
  const searchUrl = `${BASE_URL}/Search/?q=${encodeURIComponent(taxCode)}&type=auto&token=&force-search=1`;
  const searchRes = await fetchHtml(searchUrl);
  if (!searchRes) return null;

  // Case 1: search redirected directly to detail page.
  if (isDetailHtml(searchRes.html)) {
    debugLog("masothue: search redirected to detail page", searchRes.finalUrl);
    return searchRes;
  }

  // Case 2: search page returned a list — find a detail link with this taxCode.
  const $ = cheerio.load(searchRes.html);

  let detailHref: string | null = null;
  const exactSelector = `a[href*="/${taxCode}-"]`;
  const direct = $(exactSelector).first().attr("href");
  if (direct) {
    detailHref = direct.startsWith("http") ? direct : `${BASE_URL}${direct}`;
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

  if (!detailHref) {
    debugLog("masothue: no detail link found in search results");
    return null;
  }

  debugLog("masothue: detail link discovered", detailHref);
  return await fetchHtml(detailHref);
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

    if (!pageHasExactTaxCode($, taxCode)) {
      debugLog("masothue: page does not contain exact taxCode", taxCode);
      return null;
    }

    const data = extractFromMainBlock($);

    debugLog("masothue: parsed", {
      taxCode,
      finalUrl: detail.finalUrl,
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
      source: "masothue.com",
    };
  } catch (err) {
    debugLog("masothue: error", err);
    return null;
  }
}
