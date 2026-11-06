import { describe, expect, it } from "vitest";
import { ALL_CARDS } from "@/features/nba-draft/engine";
import { FB_CARDS } from "@/features/football-draft/engine";
import { VERIFICATION_SUMMARY, nbaVerification, fbVerification } from "@/lib/data/verification";

describe("external verification layer", () => {
  it("no contradicted row can be drafted", () => {
    expect(ALL_CARDS.every((c) => c.check.membership !== "contradicted")).toBe(true);
    expect(FB_CARDS.every((c) => c.check!.membership !== "contradicted")).toBe(true);
  });
  it("most memberships are confirmed by real sources", () => {
    const nbaOk = ALL_CARDS.filter((c) => c.check.membership === "verified" || c.check.membership === "probable").length / ALL_CARDS.length;
    const fbOk = FB_CARDS.filter((c) => c.check!.membership === "verified" || c.check!.membership === "probable").length / FB_CARDS.length;
    expect(nbaOk).toBeGreaterThan(0.85);
    expect(fbOk).toBeGreaterThan(0.95);
    expect(VERIFICATION_SUMMARY.nba538.verified).toBeGreaterThan(500);
  });
  it("known memberships are verified with real metrics", () => {
    const mj = nbaVerification("michael-jordan-chi-1995");
    expect(mj.membership).toBe("verified");
    expect(mj.raptor!.mp).toBeGreaterThan(2500);
    const henry = fbVerification("thierry-henry-ars-2003");
    expect(henry.membership).toBe("verified");
    expect(henry.spell!.qid).toMatch(/^Q\d+$/);
  });
  it("different versions of the same footballer have different attributes", () => {
    const cr = FB_CARDS.filter((c) => c.playerId === "cristiano-ronaldo");
    const mun = cr.find((c) => c.clubId === "MUN" && c.startYear === 2007)!;
    const juv = cr.find((c) => c.clubId === "JUV" && c.startYear === 2018)!;
    expect(mun.attrs).not.toEqual(juv.attrs);
    expect(mun.positions).not.toEqual(juv.positions);
  });
});
