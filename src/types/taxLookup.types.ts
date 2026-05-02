export type TaxLookupSource = "masothue.com" | "thuvienphapluat.vn";

export interface TaxLookupResult {
  success: boolean;
  taxCode: string;
  companyName: string | null;
  taxAddress: string | null;
  address: string | null;
  source: TaxLookupSource | null;
}

export interface TaxLookupErrorResponse {
  success: false;
  error: string;
  message: string;
}
