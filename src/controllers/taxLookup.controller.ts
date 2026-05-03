import { Request, Response } from "express";
import { validateTaxCode } from "../utils/validateTaxCode";
import { lookupTaxCode } from "../services/taxLookup.service";

export async function taxLookupHandler(req: Request, res: Response) {
  const raw = req.body?.taxCode;
  const taxCode = typeof raw === "string" ? raw.trim() : "";

  if (!taxCode || !validateTaxCode(taxCode)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_TAX_CODE",
      message: "taxCode must be 10 digits or 10 digits followed by -XXX",
    });
  }

  try {
    const result = await lookupTaxCode(taxCode);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({
      success: true,
      taxCode,
      companyName: null,
      taxAddress: null,
      address: null,
      source: null,
    });
  }
}
