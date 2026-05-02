import * as cheerio from "cheerio";
import { safeGet } from "../../utils/httpClient";
import { normalizeText } from "../../utils/normalizeText";
import { TaxLookupResult } from "../../types/taxLookup.types";

const BASE_URL = "https://thuvienphapluat.vn";

async function findDetailUrl(taxCode: string): Promise<string | null> {
  const searchUrls = [
    `${BASE_URL}/ma-so-thue/tim-ma-so-thue.aspx?keyword=${encodeURIComponent(taxCode)}`,
    `${BASE_URL}/ma-so-thue?keyword=${encodeURIComponent(taxCode)}`,
    `https://www.google.com/search?q=${encodeURIComponent(
      `site:thuvienphapluat.vn/ma-so-thue ${taxCode}`
    )}`,
  ];

  for (const searchUrl of searchUrls) {
    const html = await safeGet(searchUrl);
    if (!html) continue;

    const $ = cheerio.load(html);

    let foundHref: string | null = null;
    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (
        href.includes("/ma-so-thue/") &&
        href.includes(taxCode) &&
        href.endsWith(".html")
      ) {
        foundHref = href.startsWith("http") ? href : `${BASE_URL}${href}`;
        return false;
      }
      return;
    });

    if (foundHref) return foundHref;
  }

  return null;
}

function extractFromDetail($: cheerio.CheerioAPI, taxCode: string) {
  const result = {
    companyName: null as string | null,
    taxAddress: null as string | null,
    address: null as string | null,
  };

  const h1 = normalizeText($("h1").first().text());
  if (h1) result.companyName = h1;

  const mainContainer =
    $(".the-content").first().length > 0
      ? $(".the-content").first()
      : $("main").first().length > 0
        ? $("main").first()
        : $("body");

  // Extract Địa chỉ trụ sở (priority: sau sáp nhập > regular)
  let merged: string | null = null;
  let primary: string | null = null;

  mainContainer.find("p, div, td, li").each((_, el) => {
    const text = normalizeText($(el).text());
    const lower = text.toLowerCase();

    if (lower.startsWith("địa chỉ trụ sở (sau sáp nhập)") && !merged) {
      const value = text
        .replace(/^[^:]*:\s*/i, "")
        .trim();
      if (value && value.toLowerCase() !== text.toLowerCase()) merged = value;
    } else if (
      (lower.startsWith("địa chỉ trụ sở:") ||
        lower === "địa chỉ trụ sở" ||
        lower.startsWith("địa chỉ trụ sở ")) &&
      !primary &&
      !lower.includes("(sau sáp nhập)")
    ) {
      const value = text.replace(/^[^:]*:\s*/i, "").trim();
      if (value && value.toLowerCase() !== text.toLowerCase()) primary = value;
    }
  });

  result.taxAddress = merged || primary;

  // Try to find invoice section "Thông tin xuất Hóa đơn"
  let invoiceSectionFound = false;
  let invoiceAddress: string | null = null;

  mainContainer.find("*").each((_, el) => {
    const text = normalizeText($(el).text());
    const lower = text.toLowerCase();
    if (
      !invoiceSectionFound &&
      (lower === "thông tin xuất hóa đơn" ||
        lower.startsWith("thông tin xuất hóa đơn"))
    ) {
      invoiceSectionFound = true;
      // Search next siblings for address
      let node = $(el);
      for (let i = 0; i < 30; i++) {
        node = node.next();
        if (!node.length) break;
        const t = normalizeText(node.text());
        const tl = t.toLowerCase();
        if (tl.startsWith("địa chỉ:") || tl === "địa chỉ") {
          const val = t.replace(/^[^:]*:\s*/i, "").trim();
          if (val && val.toLowerCase() !== t.toLowerCase()) {
            invoiceAddress = val;
          }
          break;
        }
      }
    }
  });

  // Alternative: look for table rows under invoice
  if (!invoiceAddress) {
    const allText = mainContainer.text();
    const lowered = allText.toLowerCase();
    const idx = lowered.indexOf("thông tin xuất hóa đơn");
    if (idx >= 0) {
      const after = allText.substring(idx, idx + 2000);
      const m = after.match(/Địa chỉ\s*:?\s*([^\n\r]+?)(?=\s{2,}|Mã số thuế|Tên|$)/i);
      if (m && m[1]) {
        const candidate = normalizeText(m[1]);
        if (candidate && candidate.length > 3) {
          invoiceAddress = candidate;
        }
      }
    }
  }

  result.address = invoiceAddress;

  if (result.taxAddress && result.address && result.address === result.taxAddress) {
    // Address explicitly equals taxAddress — keep only if invoice section actually had it.
    // The instructions say: do not copy taxAddress into address. If invoice address is empty, return null.
    // Since we extracted from invoice section, allow it.
  }

  return result;
}

export async function lookupFromThuVienPhapLuat(
  taxCode: string
): Promise<TaxLookupResult | null> {
  try {
    const detailUrl = await findDetailUrl(taxCode);
    if (!detailUrl) return null;

    const html = await safeGet(detailUrl);
    if (!html) return null;

    const $ = cheerio.load(html);

    const bodyText = normalizeText($("body").text());
    if (!bodyText.includes(taxCode)) return null;

    const data = extractFromDetail($, taxCode);

    if (!data.companyName) return null;

    return {
      success: true,
      taxCode,
      companyName: data.companyName,
      taxAddress: data.taxAddress,
      address: data.address,
      source: "thuvienphapluat.vn",
    };
  } catch {
    return null;
  }
}
