/**
 * Nation → continent (by football confederation geography) and main football/common languages.
 * Used ONLY by the extended chemistry of Historical Roulette. Multilingual nations list several
 * languages (a player counts towards each). Groups of mutually intelligible languages are merged
 * (serbocroata, escandinavo, checo-eslovaco). Factual mapping, no player data involved.
 */
export type Continent = "Europa" | "Sudamérica" | "Norteamérica" | "África" | "Asia";

const C: Record<Continent, string> = {
  Europa: "ALB ARM AUT BEL BIH BLR BUL CRO CZE DEN ENG ESP FIN FRA GEO GER GRE HUN IRL ISL ITA KOS MNE NED NIR NOR POL POR ROU RUS SCO SMR SRB SUI SVK SVN SWE TUR UKR WAL YUG",
  Sudamérica: "ARG BOL BRA CHI COL ECU PAR PER URU VEN",
  Norteamérica: "BER CAN CRC HON JAM MEX PAN TRI USA",
  África: "ALG BFA CIV CMR COD EGY GAB GHA GUI KEN LBR MAR MLI MOZ NGA RSA SEN TOG TUN ZAM ZIM",
  Asia: "AUS IRN JPN KOR KSA",
};
export const CONTINENT_OF: Record<string, Continent> = Object.fromEntries(
  (Object.entries(C) as [Continent, string][]).flatMap(([k, v]) => v.split(" ").map((n) => [n, k])),
);

const L: Record<string, string> = {
  español: "ARG BOL CHI COL CRC ECU ESP HON MEX PAN PAR PER URU VEN",
  portugués: "BRA POR MOZ",
  francés: "FRA BEL SUI CAN CIV SEN GUI MLI BFA GAB TOG CMR ALG MAR TUN COD",
  inglés: "ENG SCO WAL NIR IRL USA CAN NGA GHA LBR TRI JAM KEN RSA ZIM ZAM BER CMR AUS",
  alemán: "GER AUT SUI",
  italiano: "ITA SMR SUI",
  neerlandés: "NED BEL",
  árabe: "ALG MAR EGY TUN KSA",
  serbocroata: "SRB CRO BIH MNE YUG",
  escandinavo: "DEN NOR SWE",
  "checo-eslovaco": "CZE SVK",
  ruso: "RUS BLR",
  albanés: "ALB KOS",
  armenio: "ARM", búlgaro: "BUL", finés: "FIN", georgiano: "GEO", griego: "GRE", húngaro: "HUN", islandés: "ISL",
  japonés: "JPN", coreano: "KOR", polaco: "POL", rumano: "ROU", esloveno: "SVN", turco: "TUR", ucraniano: "UKR", persa: "IRN",
};
export const LANGUAGES_OF: Record<string, string[]> = {};
for (const [lang, ns] of Object.entries(L)) for (const n of ns.split(" ")) (LANGUAGES_OF[n] ??= []).push(lang);
