/**
 * Approximate league-wide context by season start year (pace = possessions per
 * 48 min, ortg = points per 100 possessions, fg = league FG%).
 * Rounded values interpolated from public league-average tables; used ONLY for
 * era normalization of ratings, never shown as official stats.
 */
const ANCHORS: [number, number, number, number][] = [
  // year, pace, ortg, fg
  [1960, 126, 93, .41],
  [1965, 115, 96, .43],
  [1970, 114, 98, .46],
  [1975, 106, 98, .46],
  [1980, 103, 105, .48],
  [1985, 102, 108, .49],
  [1990, 97, 108, .47],
  [1995, 92, 107, .46],
  [2000, 91, 104, .44],
  [2005, 91, 106, .45],
  [2010, 92, 107, .46],
  [2015, 95, 106, .45],
  [2018, 100, 110, .46],
  [2020, 100, 111, .47],
  [2023, 99.5, 115, .48],
  [2026, 99, 115, .48],
];

export interface LeagueContext { pace: number; ortg: number; fg: number }

export function leagueContext(startYear: number): LeagueContext {
  if (startYear <= ANCHORS[0][0]) return { pace: ANCHORS[0][1], ortg: ANCHORS[0][2], fg: ANCHORS[0][3] };
  for (let i = 1; i < ANCHORS.length; i++) {
    const [y1, p1, o1, f1] = ANCHORS[i];
    const [y0, p0, o0, f0] = ANCHORS[i - 1];
    if (startYear <= y1) {
      const t = (startYear - y0) / (y1 - y0);
      return { pace: p0 + (p1 - p0) * t, ortg: o0 + (o1 - o0) * t, fg: f0 + (f1 - f0) * t };
    }
  }
  const last = ANCHORS[ANCHORS.length - 1];
  return { pace: last[1], ortg: last[2], fg: last[3] };
}

/** Modern reference environment that every era is translated into. */
export const MODERN = { pace: 99, ortg: 114, fg: 0.475 };
