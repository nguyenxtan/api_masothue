import { Request, Response } from "express";
import { validateTaxCode } from "../utils/validateTaxCode";
import { lookupTaxCode } from "../services/taxLookup.service";
import { AttemptRecord } from "../types/searchDiscovery.types";

const ALLOWED_DETAIL_HOSTS = new Set([
  "masothue.com",
  "www.masothue.com",
  "thuvienphapluat.vn",
  "www.thuvienphapluat.vn",
]);

export async function taxLookupHandler(req: Request, res: Response) {
  const body = req.body || {};
  const rawTaxCode = body.taxCode;
  const taxCode = typeof rawTaxCode === "string" ? rawTaxCode.trim() : "";

  if (!taxCode || !validateTaxCode(taxCode)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_TAX_CODE",
      message: "taxCode must be 10 digits or 10 digits followed by -XXX",
    });
  }

  let detailUrl: string | undefined;
  if (typeof body.detailUrl === "string" && body.detailUrl.trim().length > 0) {
    const candidate = body.detailUrl.trim();
    try {
      const parsed = new URL(candidate);
      if (!ALLOWED_DETAIL_HOSTS.has(parsed.hostname)) {
        return res.status(400).json({
          success: false,
          error: "INVALID_DETAIL_URL",
          message:
            "detailUrl host must be masothue.com or thuvienphapluat.vn",
        });
      }
      detailUrl = candidate;
    } catch {
      return res.status(400).json({
        success: false,
        error: "INVALID_DETAIL_URL",
        message: "detailUrl is not a valid URL",
      });
    }
  }

  const includeDebug = body.includeDebug === true;
  const attempts: AttemptRecord[] = [];

  const companyName =
    typeof body.companyName === "string" && body.companyName.trim().length > 0
      ? body.companyName.trim()
      : undefined;

  try {
    const result = await lookupTaxCode(taxCode, {
      detailUrl,
      companyName,
      attempts: includeDebug ? attempts : undefined,
    });
    const response: Record<string, unknown> = { ...result };
    if (includeDebug) response.debug = { attempts };
    return res.status(200).json(response);
  } catch {
    const response: Record<string, unknown> = {
      success: true,
      taxCode,
      companyName: null,
      taxAddress: null,
      address: null,
      source: null,
    };
    if (includeDebug) response.debug = { attempts };
    return res.status(200).json(response);
  }
}
