/**
 * End-to-end smoke test (Playwright, headless Chromium).
 * Usage: npm run build && (npm start &) && npm run e2e
 * BASE_URL defaults to http://localhost:3000
 */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? "screenshots";
const only = process.argv[2]; // "nba" | "football" | undefined
fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(() => localStorage.setItem("ll:settings:v1", JSON.stringify({ reducedMotion: true, fastAnimations: true })));
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
const assert = (c, msg) => { if (!c) throw new Error("ASSERT: " + msg); console.log("  ✓", msg); };

async function nbaFlow() {
  console.log("NBA flow");
  await page.goto(BASE + "/");
  await page.getByTestId("enter-nba").click();
  await page.getByTestId("difficulty-HARD").click();
  await page.getByTestId("start-nba-draft").click();
  await page.getByTestId("spin-btn").click();
  const team0 = await page.getByTestId("reel-team").getAttribute("data-final");
  const era0 = await page.getByTestId("reel-era").getAttribute("data-final");
  if (await page.getByTestId("respin-team").isEnabled()) {
    await page.getByTestId("respin-team").click();
    const team1 = await page.getByTestId("reel-team").getAttribute("data-final");
    const era1 = await page.getByTestId("reel-era").getAttribute("data-final");
    assert(team1 !== team0 && era1 === era0, "re-spin team changes only the team");
    assert(await page.getByTestId("respin-team").isDisabled(), "team re-spin disabled after use");
  }
  for (let round = 0; round < 5; round++) {
    if (await page.getByTestId("spin-btn").isVisible()) await page.getByTestId("spin-btn").click();
    const rows = page.locator('[data-testid="player-row"][data-placeable="true"]');
    const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-card-id")));
    const names = await rows.evaluateAll((els) => els.map((e) => e.querySelector("span span")?.textContent));
    assert(new Set(names).size === names.length, `round ${round + 1}: no repeated players in the list`);
    await rows.first().click();
    await page.getByTestId("pick-preview").waitFor();
    await page.locator('[data-testid="player-sheet"] button[data-testid^="pick-"]').first().click();
    void ids;
  }
  await page.getByTestId("view-quintet").click();
  assert((await page.getByTestId("quintet-row").count()) === 5, "VER MI QUINTETO shows 5 positions during the draft");
  await page.getByTestId("sheet-close").click();
  await page.screenshot({ path: `${SHOTS}/nba-draft-complete.png` });
  await page.getByTestId("simulate-season").click();
  await page.getByTestId("postseason-badge").waitFor();
  const rec = (await page.getByTestId("final-record").innerText()).replace(/\s/g, "");
  const [w, l] = rec.split("-").map(Number);
  assert(w + l === 82, `record ${w}-${l} sums to 82`);
  await page.getByTestId("nba-tab-calendar").click();
  assert((await page.getByTestId("game-cell").count()) === 82, "82 games listed");
  await page.getByTestId("game-cell").first().click();
  assert(await page.getByTestId("box-score").isVisible(), "game detail with box score");
  await page.getByTestId("nba-tab-standings").click();
  assert(await page.getByTestId("standing-user").isVisible(), "standings include the user");
  await page.getByTestId("nba-tab-playoffs").click();
  const outcome = await page.getByTestId("playoff-outcome").getAttribute("data-outcome");
  assert(!!outcome, `playoff outcome shown (${outcome})`);
  await page.getByTestId("nba-tab-stats").click();
  assert((await page.locator('[data-testid="stats-table"] tbody tr').count()) === 6, "player stats table: 5 starters + bench");
  await page.getByTestId("view-quintet").click();
  assert((await page.getByTestId("quintet-row").count()) === 5, "VER MI QUINTETO after the season");
  await page.getByTestId("sheet-close").click();
  await page.getByTestId("replay-season").click();
  await page.getByTestId("postseason-badge").waitFor();
  const rec2 = (await page.getByTestId("final-record").innerText()).replace(/\s/g, "");
  assert(rec2 === rec, "same seed reproduces same record");
  await page.getByTestId("nba-tab-mc").click();
  await page.getByTestId("mc-500").click();
  await page.getByText("P(anillo)").waitFor({ timeout: 60000 });
  assert(true, "monte carlo ran (incl. ring probability)");
  await page.screenshot({ path: `${SHOTS}/nba-results.png`, fullPage: true });
  await page.goto(BASE + "/history");
  await page.getByTestId("history-quintet").first().click();
  assert((await page.getByTestId("quintet-row").count()) === 5, "quintet available from history");
  await page.goto(BASE + "/nba");
  await page.getByTestId("open-last").click();
  await page.getByTestId("postseason-badge").waitFor();
  assert(true, "last season survives a reload");
  await page.getByTestId("new-draft").click();
  await page.getByTestId("start-nba-draft").waitFor();
  assert(true, "can start another draft");
}

async function footballFlow() {
  console.log("Football flow");
  await page.goto(BASE + "/football");
  await page.getByTestId("fb-difficulty").getByTestId("difficulty-NORMAL").click();
  await page.getByTestId("fb-club-select").selectOption({ index: 1 });
  await page.getByTestId("fb-formation-4-2-3-1").click();
  await page.getByTestId("fb-mode-roulette").click();
  await page.getByTestId("fb-start").click();
  let picks = 0;
  while (picks < 11) {
    const btn = page.locator('[data-testid^="fb-pick-"]').first();
    await btn.waitFor({ timeout: 10000 });
    if (picks === 2 && await page.getByTestId("fb-respin-club").isEnabled()) await page.getByTestId("fb-respin-club").click();
    if (picks === 4 && await page.getByTestId("fb-respin-era").isEnabled()) await page.getByTestId("fb-respin-era").click();
    await page.locator('[data-testid^="fb-pick-"]').first().click();
    picks++;
  }
  await page.getByTestId("fb-chemistry").waitFor();
  await page.screenshot({ path: `${SHOTS}/football-squad.png`, fullPage: true });
  await page.getByTestId("fb-mc-100").click();
  await page.locator('[data-testid="fb-mc-results"][data-status="done"]').waitFor({ timeout: 120000 });
  assert((await page.getByTestId("fb-mc-progress").innerText()).includes("100 / 100"), "football Monte Carlo ran 100 full seasons in the worker");
  await page.getByTestId("fb-quick-sim").click();
  await page.getByTestId("fb-trophies").waitFor({ timeout: 60000 });
  for (const t of ["pl", "ucl", "fa", "efl"]) await page.getByTestId(`fb-trophy-${t}`).waitFor();
  assert(true, "four trophy cards");
  await page.getByTestId("fb-tab-pl").click();
  const rows = await page.getByTestId("pl-row").count();
  assert(rows === 20, "Premier League table has 20 rows");
  await page.getByTestId("fb-tab-ucl").click();
  await page.getByTestId("ucl-table").waitFor();
  assert((await page.getByTestId("ucl-row").count()) === 36, "UCL league phase has 36 rows");
  await page.getByTestId("fb-tab-fa").click();
  await page.getByTestId("cup-bracket").waitFor();
  await page.getByTestId("fb-tab-efl").click();
  await page.getByTestId("cup-bracket").waitFor();
  await page.screenshot({ path: `${SHOTS}/football-season.png`, fullPage: true });
  // FUT mode + live season
  await page.getByTestId("fb-new").click();
  await page.getByTestId("fb-mode-fut").click();
  await page.getByTestId("fb-start").click();
  for (let i = 0; i < 20 && !(await page.getByTestId("fb-live-sim").isVisible()); i++) {
    const btn = page.locator('[data-testid^="fb-pick-"]').first();
    await btn.waitFor({ timeout: 10000 });
    await btn.click();
  }
  await page.getByTestId("fb-live-sim").click();
  await page.getByTestId("fb-next-day").click();
  await page.getByTestId("fb-next-day").click();
  await page.getByTestId("fb-sim-rest").click();
  await page.getByTestId("fb-trophies").waitFor({ timeout: 60000 });
  assert(true, "FUT draft + live season completes");
}

try {
  if (!only || only === "nba") await nbaFlow();
  if (!only || only === "football") await footballFlow();
  for (const w of [390]) {
    const m = await browser.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 1 });
    const p = await m.newPage();
    await p.goto(BASE + "/");
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    assert(sw <= w + 1, `no horizontal scroll at ${w}px (scrollWidth ${sw})`);
    await p.screenshot({ path: `${SHOTS}/mobile-home.png` });
    await m.close();
  }
  assert(errors.length === 0, `no console errors (${errors.join(" | ")})`);
  console.log("E2E OK");
} catch (e) {
  console.error(e);
  console.error("Console errors:", errors);
  await page.screenshot({ path: `${SHOTS}/failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
