export function slugifyVietnamese(input: string): string {
  if (!input) return "";

  let s = String(input).toLowerCase();

  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/đ/g, "d").replace(/Đ/g, "d");

  s = s.replace(/[‘’‚‛“”„‟'"`]/g, "");

  s = s.replace(/&/g, " and ");

  s = s.replace(/[^a-z0-9]+/g, "-");
  s = s.replace(/-+/g, "-");
  s = s.replace(/^-+|-+$/g, "");

  return s;
}
