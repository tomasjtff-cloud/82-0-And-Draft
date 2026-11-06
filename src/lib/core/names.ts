/**
 * Short sports display names ("Frenkie de Jong" → "de Jong", "Ángel Di María" → "Di María").
 * Explicit overrides win; otherwise the last surname is extended backwards with nobiliary
 * particles (de, van, der, Di, Le, ter, Mac…) and generational suffixes (Jr., II…) keep their surname.
 * The full name is always shown in the detailed card.
 */
export const SHORT_NAME_OVERRIDES: Record<string, string> = {
  "Vinícius Júnior": "Vinícius Jr.",
  "Pedro Neto": "Pedro Neto",
  "Cristiano Ronaldo": "Ronaldo",
};

const PARTICLES = new Set(["de", "da", "di", "do", "dos", "das", "del", "della", "der", "den", "van", "von", "ter", "ten", "le", "la", "du", "mac", "el", "al", "st", "st.", "y"]);
const SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "júnior", "junior", "filho", "neto"]);

export function shortName(full: string): string {
  const name = (full ?? "").trim().replace(/\s+/g, " ");
  if (!name) return "";
  if (SHORT_NAME_OVERRIDES[name]) return SHORT_NAME_OVERRIDES[name];
  const t = name.split(" ");
  if (t.length === 1) return name;
  let start = t.length - 1;
  if (SUFFIXES.has(t[start].toLowerCase()) && start > 0) start--;
  while (start > 1 && PARTICLES.has(t[start - 1].toLowerCase())) start--;
  // "Donny van de Beek": two particles are consumed by the loop; a first-token particle ("De Bruyne" alone) is kept as-is
  return t.slice(start).join(" ");
}
