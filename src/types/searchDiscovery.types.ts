export interface AttemptRecord {
  strategy: string;
  url?: string;
  status?: number | null;
  matchedTaxCode?: boolean;
  query?: string;
  candidateUrls?: string[];
  selectedUrl?: string | null;
  error?: string;
}
