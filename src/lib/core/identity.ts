/** User team identity (NBA franchise name). Cosmetic only: never used by any engine or RNG. */
export interface TeamIdentity { city: string; name: string }
export const DEFAULT_NBA_IDENTITY: TeamIdentity = { city: "Legends", name: "Lab" };
export const IDENTITY_MAX = 24;

/** Control chars, zero-width/bidi marks and markup-like symbols that could break the UI. */
const FORBIDDEN = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e<>{}\\[\\]\\\\/`|^~$*=#@%\"]", "g");

/** Normalises user text: NFC, strips control/markup characters, collapses spaces, trims, max length. */
export function cleanIdentityPart(raw: string, max = IDENTITY_MAX): string {
  return (raw ?? "").normalize("NFC").replace(FORBIDDEN, "").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

const ALLOWED = /^[\p{L}\p{M}\p{N} .'’&-]+$/u;
export function validateIdentityPart(raw: string, label: string): string | null {
  const v = cleanIdentityPart(raw);
  if (!v) return `${label}: no puede estar vacío.`;
  if (raw.trim().length > IDENTITY_MAX) return `${label}: máximo ${IDENTITY_MAX} caracteres.`;
  if (new RegExp(FORBIDDEN.source).test(raw) || !ALLOWED.test(v)) return `${label}: usa solo letras, números, espacios y . ' - &`;
  return null;
}

export function sanitizeIdentity(id: Partial<TeamIdentity> | null | undefined, fallback = DEFAULT_NBA_IDENTITY): TeamIdentity {
  const city = cleanIdentityPart(id?.city ?? ""), name = cleanIdentityPart(id?.name ?? "");
  return { city: city && ALLOWED.test(city) ? city : fallback.city, name: name && ALLOWED.test(name) ? name : fallback.name };
}

export const fullTeamName = (id: TeamIdentity | null | undefined) => { const s = sanitizeIdentity(id); return `${s.city} ${s.name}`; };
