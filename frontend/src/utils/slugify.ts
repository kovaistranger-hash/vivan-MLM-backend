/** Match backend `slugifyName`: lowercase, hyphens, strip specials, collapse repeats. */
export function slugifyName(name: string): string {
  let s = name.trim().toLowerCase();
  s = s.replace(/[\s_]+/g, '-');
  s = s.replace(/[^a-z0-9-]+/g, '');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}
