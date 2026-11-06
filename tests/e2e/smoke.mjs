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
  await page.getByTestId("team-city").fill("<b>");
  assert(await page.getByTestId("identity-error").isVisible() && await page.getByTestId("start-nba-draft").isDisabled(), "invalid team city is rejected with a message");
  await page.getByTestId("team-city").fill("Mexico City");
  await page.getByTestId("team-name-input").fill("Legends");
  await page.getByTestId("start-nba-draft").click();
  assert((await page.getByTestId("draft-team-name").textContent()).includes("Mexico City Legends"), "team identity shown during the draft");
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
  assert((await page.getByTestId("team-name").textContent()).includes("Mexico City Legends"), "team identity shown in results");
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

/** One football draft action: GIRAR, captain slot, or open a candidate card and ELEGIR it. */
async function fbStep() {
  if (await page.getByTestId("fb-spin-btn").isVisible()) { await page.getByTestId("fb-spin-btn").click(); return; }
  const slotBtn = page.locator('[data-testid^="fb-pick-slot-"]').first();
  if (await slotBtn.isVisible()) { await slotBtn.click(); return; }
  await page.getByTestId("fb-candidate-open").first().waitFor({ timeout: 10000 });
  await page.getByTestId("fb-candidate-open").first().click();
  await page.getByTestId("fb-player-sheet").waitFor();
  await page.locator('[data-testid="fb-player-sheet"] button[data-testid^="fb-pick-"]').first().click();
  await page.getByTestId("fb-player-sheet").waitFor({ state: "detached" }).catch(() => {});
}

async function footballFlow() {
  console.log("Football flow");
  await page.goto(BASE + "/football");
  await page.getByTestId("fb-difficulty").getByTestId("difficulty-NORMAL").click();
  await page.getByTestId("fb-club-select").selectOption({ index: 1 });
  await page.getByTestId("fb-formation-4-2-3-1").click();
  await page.getByTestId("fb-mode-roulette").click();
  await page.getByTestId("fb-start").click();
  let checkedPreview = false, respun = false;
  for (let i = 0; i < 40 && !(await page.getByTestId("fb-chemistry").isVisible()); i++) {
    if (!respun && i > 4 && await page.getByTestId("fb-respin-club").isVisible() && await page.getByTestId("fb-respin-club").isEnabled()) {
      await page.getByTestId("fb-respin-club").click(); respun = true; continue;
    }
    if (!checkedPreview && await page.getByTestId("fb-candidate-open").count() > 1 && await page.getByTestId("view-xi").isEnabled()) {
      await page.getByTestId("fb-compare-toggle").first().click();
      await page.getByTestId("fb-candidate-open").nth(1).click();
      await page.getByTestId("fb-chem-preview").waitFor();
      assert(await page.getByTestId("fb-compare").isVisible(), "candidate sheet shows chemistry preview and comparison");
      const expected = Number(await page.getByTestId("fb-chem-after").innerText());
      await page.locator('[data-testid="fb-player-sheet"] button[data-testid^="fb-pick-"]').first().click();
      await page.getByTestId("fb-player-sheet").waitFor({ state: "detached" }).catch(() => {});
      const now = Number((await page.getByTestId("fb-chem-mode").innerText()).match(/(\d+)\/33/)[1]);
      assert(now === expected, `previewed chemistry ${expected} equals real chemistry ${now}`);
      await page.getByTestId("view-xi").click();
      await page.getByTestId("xi-modal").waitFor();
      assert((await page.getByTestId("xi-row").count()) >= 2, "VER MI XI available during the draft");
      await page.getByTestId("sheet-close").click();
      checkedPreview = true; continue;
    }
    await fbStep();
  }
  await page.getByTestId("fb-chemistry").waitFor();
  assert(checkedPreview, "chemistry preview checked during the draft");
  await page.getByTestId("fb-chem-mode").click();
  console.log(`  · chemistry mode: ${await page.getByTestId("chem-link").count()} links drawn`);
  await page.getByTestId("view-xi").click();
  assert((await page.getByTestId("xi-row").count()) === 11, "VER MI XI shows 11 players with complete XI");
  await page.getByTestId("sheet-close").click();
  await page.screenshot({ path: `${SHOTS}/football-squad.png`, fullPage: true });
  await page.getByTestId("fb-mc-100").click();
  await page.locator('[data-testid="fb-mc-results"][data-status="done"]').waitFor({ timeout: 120000 });
  assert((await page.getByTestId("fb-mc-progress").innerText()).includes("100 / 100"), "football Monte Carlo ran 100 full seasons in the worker");
  await page.getByTestId("fb-quick-sim").click();
  await page.getByTestId("fb-trophies").waitFor({ timeout: 60000 });
  for (const t of ["pl", "ucl", "fa", "efl"]) await page.getByTestId(`fb-trophy-${t}`).waitFor();
  assert(true, "four trophy cards");
  await page.getByTestId("fb-tab-summary").click();
  assert((await page.getByTestId("fb-mvp").innerText()).trim().length > 1, "season summary shows an MVP");
  await page.getByTestId("fb-tab-xi").click();
  await page.getByTestId("fb-xi-tab").waitFor();
  await page.getByTestId("fb-tab-players").click();
  await page.getByTestId("fb-stats-table").waitFor();
  assert((await page.locator('[data-testid="fb-stats-table"] tbody tr').count()) >= 11, "player stats table lists the XI");
  await page.getByTestId("fb-sort-assists").click();
  await page.getByTestId("fb-scope-UCL").click();
  await page.getByTestId("fb-scope-ALL").click();
  await page.getByTestId("fb-tab-mine").click();
  await page.getByTestId("fb-match-row").first().click();
  await page.getByTestId("fb-match-sheet").waitFor();
  assert(await page.getByTestId("fb-match-goals").isVisible(), "match detail with scorers");
  await page.getByTestId("sheet-close").click();
  await page.getByTestId("fb-tab-pl").click();
  assert((await page.getByTestId("pl-row").count()) === 20, "Premier League table has 20 rows");
  await page.getByTestId("fb-tab-ucl").click();
  await page.getByTestId("ucl-table").waitFor();
  assert((await page.getByTestId("ucl-row").count()) === 36, "UCL league phase has 36 rows");
  await page.getByTestId("fb-tab-fa").click();
  await page.getByTestId("cup-bracket").waitFor();
  await page.getByTestId("fb-tab-efl").click();
  await page.getByTestId("cup-bracket").waitFor();
  await page.getByTestId("fb-tab-mc").click();
  await page.getByTestId("fb-mc-100").click();
  await page.getByTestId("fb-mc-compare").waitFor({ timeout: 120000 });
  assert(true, "Monte Carlo compares the played season with the distribution");
  await page.getByTestId("view-xi").click();
  assert((await page.getByTestId("xi-row").count()) === 11, "VER MI XI after the season");
  await page.getByTestId("sheet-close").click();
  const finalPos = await page.getByTestId("fb-tab-summary").click().then(() => page.getByTestId("fb-final-pos").innerText());
  await page.screenshot({ path: `${SHOTS}/football-season.png`, fullPage: true });
  // history: XI + reopen the exact season
  await page.goto(BASE + "/history");
  await page.getByTestId("history-xi").first().click();
  assert((await page.getByTestId("xi-row").count()) === 11, "history keeps the 11 players");
  await page.getByTestId("sheet-close").click();
  await page.getByTestId("history-reopen").first().click();
  await page.getByTestId("fb-trophies").waitFor({ timeout: 60000 });
  await page.getByTestId("fb-tab-summary").click();
  assert((await page.getByTestId("fb-final-pos").innerText()) === finalPos, "reopened season from history is identical");
  // FUT mode + live season
  await page.getByTestId("fb-new").click();
  await page.getByTestId("fb-mode-fut").click();
  await page.getByTestId("fb-start").click();
  for (let i = 0; i < 30 && !(await page.getByTestId("fb-live-sim").isVisible()); i++) await fbStep();
  await page.getByTestId("fb-live-sim").click();
  await page.getByTestId("fb-next-day").click();
  await page.getByTestId("fb-next-day").click();
  await page.getByTestId("fb-sim-rest").click();
  await page.getByTestId("fb-trophies").waitFor({ timeout: 60000 });
  assert(true, "FUT draft + live season completes");
}

async function mobileFootball() {
  const m = await browser.newContext({ ...createRequire(import.meta.url)("playwright").devices["iPhone 13"] });
  await m.addInitScript(() => localStorage.setItem("ll:settings:v1", JSON.stringify({ reducedMotion: true, fastAnimations: true })));
  const p = await m.newPage();
  await p.goto(BASE + "/football");
  await p.getByTestId("fb-start").click();
  if (await p.getByTestId("fb-spin-btn").isVisible()) await p.getByTestId("fb-spin-btn").click();
  await p.getByTestId("fb-drawer").waitFor();
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  assert(sw <= 391, `football draft: no horizontal scroll on iPhone (scrollWidth ${sw})`);
  const box = await p.getByTestId("fb-candidate-open").first().boundingBox();
  assert(box && box.y + box.height <= 844, "first candidate visible above the fold on iPhone");
  await p.getByTestId("fb-candidate-open").first().click();
  const pick = p.locator('[data-testid="fb-player-sheet"] button[data-testid^="fb-pick-"]').first();
  await pick.waitFor();
  await pick.scrollIntoViewIfNeeded();
  assert(await pick.isVisible(), "ELEGIR reachable inside the sheet on iPhone");
  await p.screenshot({ path: `${SHOTS}/mobile-football-sheet.png` });
  await m.close();
}

try {
  if (!only || only === "nba") await nbaFlow();
  if (!only || only === "football") { await footballFlow(); await mobileFootball(); }
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
