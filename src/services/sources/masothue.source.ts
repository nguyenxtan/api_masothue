import * as cheerio from "cheerio";
import { safeGet } from "../../utils/httpClient";
import { normalizeText } from "../../utils/normalizeText";
import { TaxLookupResult } from "../../types/taxLookup.types";

const BASE_URL = "https://masothue.com";

async function findDetailUrl(taxCode: string): Promise<string | null> {
  const searchUrl = `${BASE_URL}/Search/?q=${encodeURIComponent(taxCode)}&type=auto&token=&force-search=1`;
  const html = await safeGet(searchUrl);
  if (!html) return null;

  const $ = cheerio.load(html);

  const directLink = $(`a[href*="/${taxCode}-"]`).first().attr("href");
  if (directLink) {
    return directLink.startsWith("http") ? directLink : `${BASE_URL}${directLink}`;
  }

  let foundHref: string | null = null;
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.includes(taxCode)) {
      foundHref = href.startsWith("http") ? href : `${BASE_URL}${href}`;
      return false;
    }
    return;
  });

  return foundHref;
}

function extractFromMainBlock($: cheerio.CheerioAPI) {
  const result = {
    companyName: null as string | null,
    taxAddress: null as string | null,
    address: null as string | null,
  };

  const mainTable = $("table.table-taxinfo").first();

  const nameFromTable = mainTable.length
    ? normalizeText(
        mainTable.find('th[itemprop="name"]').first().text() ||
          mainTable.find("thead h1").first().text() ||
          mainTable.find("h1").first().text()
      )
    : "";

  if (nameFromTable) {
    result.companyName = nameFromTable;
  } else {
    const h1 = normalizeText($("h1").first().text());
    if (h1) result.companyName = h1;
  }

  if (!mainTable.length) return result;

  mainTable.find("tbody tr").each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 2) return;

    const labelRaw = normalizeText($(tds[0]).text()).toLowerCase();
    const valueText = normalizeText($(tds[1]).text());
    if (!labelRaw || !valueText) return;

    if (labelRaw.includes("địa chỉ thuế")) {
      result.taxAddress = valueText;
      return;
    }

    if (labelRaw === "địa chỉ") {
      result.address = valueText;
    }
  });

  return result;
}

export async function lookupFromMasothue(
  taxCode: string
): Promise<TaxLookupResult | null> {
  try {
    const detailUrl = await findDetailUrl(taxCode);
    if (!detailUrl) return null;

    const html = await safeGet(detailUrl);
    if (!html) return null;

    const $ = cheerio.load(html);

    const pageTaxCode = normalizeText(
      $('span[itemprop="taxID"]').first().text() ||
        $('.table-taxinfo td[itemprop="taxID"]').first().text()
    );
    if (pageTaxCode && !pageTaxCode.includes(taxCode)) {
      return null;
    }

    const data = extractFromMainBlock($);
    if (!data.companyName) return null;

    return {
      success: true,
      taxCode,
      companyName: data.companyName,
      taxAddress: data.taxAddress,
      address: data.address,
      source: "masothue.com",
    };
  } catch {
    return null;
  }
}
