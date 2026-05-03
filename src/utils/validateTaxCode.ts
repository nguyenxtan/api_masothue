export function validateTaxCode(taxCode: string): boolean {
  if (typeof taxCode !== "string") return false;
  return /^\d{10}(-\d{3})?$/.test(taxCode.trim());
}
