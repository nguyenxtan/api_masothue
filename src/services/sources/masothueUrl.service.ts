import { slugifyVietnamese } from "../../utils/slugifyVietnamese";

export function buildMasothueDetailUrl(
  taxCode: string,
  companyName: string
): string {
  return `https://masothue.com/${taxCode}-${slugifyVietnamese(companyName)}`;
}
