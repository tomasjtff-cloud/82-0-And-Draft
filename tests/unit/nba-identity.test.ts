import { describe, expect, it } from "vitest";
import { cleanIdentityPart, fullTeamName, sanitizeIdentity, validateIdentityPart, DEFAULT_NBA_IDENTITY } from "@/lib/core/identity";
import { CARD_BY_ID, createDraft, isComplete, lineupCards, pick, placeablePositions } from "@/features/nba-draft/engine";
import { simulateSeason } from "@/features/nba-simulation/engine";
import { buildSnapshot } from "@/features/nba-draft/snapshot";

describe("NBA team identity", () => {
  it("validates and sanitises names", () => {
    expect(validateIdentityPart("Mexico City", "Ciudad")).toBeNull();
    expect(validateIdentityPart("   ", "Ciudad")).toMatch(/vacío/);
    expect(validateIdentityPart("x".repeat(40), "Nombre")).toMatch(/máximo/);
    expect(validateIdentityPart("<b>", "Ciudad")).toMatch(/solo letras/);
    expect(cleanIdentityPart("<b>São​  Paulo</b>")).toBe("bSão Paulob");
    expect(fullTeamName({ city: "Mexico City", name: "Legends" })).toBe("Mexico City Legends");
    expect(sanitizeIdentity({ city: "", name: "" })).toEqual(DEFAULT_NBA_IDENTITY);
    expect(sanitizeIdentity(undefined)).toEqual(DEFAULT_NBA_IDENTITY);
  });
  it("the name never changes the simulation (same seed → same season)", () => {
    let d = createDraft("ident", "NORMAL");
    while (!isComplete(d)) { const c = d.options.map((id) => CARD_BY_ID[id]).find((x) => placeablePositions(d, x).length)!; const r = pick(d, c.id, placeablePositions(d, c)[0]); if (!r.ok) throw new Error(r.error); d = r.state; }
    const a = { ...d, identity: { city: "Mexico City", name: "Legends" } }, b = { ...d, identity: { city: "Buenos Aires", name: "Titans" } };
    expect(simulateSeason(lineupCards(a), "NORMAL", "same").result).toEqual(simulateSeason(lineupCards(b), "NORMAL", "same").result);
    const snap = buildSnapshot(lineupCards(a), "NORMAL", "same", a.seed, { identity: a.identity });
    expect(fullTeamName(snap.identity)).toBe("Mexico City Legends");
    expect(JSON.parse(JSON.stringify(snap)).identity).toEqual(a.identity);
  });
});
