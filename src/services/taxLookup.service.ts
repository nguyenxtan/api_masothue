import { TaxLookupResult } from "../types/taxLookup.types";
import { lookupFromMasothue } from "./sources/masothue.source";
import { lookupFromThuVienPhapLuat } from "./sources/thuvienphapluat.source";

export async function lookupTaxCode(taxCode: string): Promise<TaxLookupResult> {
  try {
    const fromMasothue = await lookupFromMasothue(taxCode);
    if (fromMasothue) return fromMasothue;
  } catch {
    // ignore and continue
  }

  try {
    const fromTVPL = await lookupFromThuVienPhapLuat(taxCode);
    if (fromTVPL) return fromTVPL;
  } catch {
    // ignore and continue
  }

  return {
    success: true,
    taxCode,
    companyName: null,
    taxAddress: null,
    address: null,
    source: null,
  };
}

export { lookupFromMasothue, lookupFromThuVienPhapLuat };
