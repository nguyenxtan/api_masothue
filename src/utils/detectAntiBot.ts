export function detectAntiBot(html: string, status?: number): boolean {
  if (!html) return false;

  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  if (titleMatch && /just a moment/i.test(titleMatch[1])) return true;

  if (html.includes("Check bot")) return true;

  if (status === 403) {
    const markers = [
      "Check bot - masothue.com",
      "turnstileToken",
      "Just a moment",
      "cf-browser-verification",
      "cf-chl",
      "Cloudflare",
    ];
    for (const m of markers) {
      if (html.includes(m)) return true;
    }
  }

  return false;
}
