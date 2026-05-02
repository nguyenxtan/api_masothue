export function validateTaxCode(taxCode: string): boolean {
  if (typeof taxCode !== "string") return false;
  const trimmed = taxCode.trim();
  return /^\d{10}(-\d{3})?$/.test(trimmed);
}
