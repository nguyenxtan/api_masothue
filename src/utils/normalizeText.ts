export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  let text = String(input);

  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");

  text = text.replace(/[​-‍﻿­]/g, "");
  text = text.replace(/\s+/g, " ");

  return text.trim();
}
