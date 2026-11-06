import { NextResponse } from "next/server";
import { providerStatus } from "@/lib/api/providers";
import { NBA_PLAYER_SEASONS } from "@/lib/data/nba/players";
import { FB_PLAYER_SEASONS } from "@/lib/data/football/players";

/** Reports which providers are configured (booleans only — never keys) and dataset coverage. */
export async function GET() {
  return NextResponse.json({
    providers: providerStatus(),
    datasets: {
      nba: { playerSeasons: NBA_PLAYER_SEASONS.length, players: new Set(NBA_PLAYER_SEASONS.map((p) => p.playerId)).size, verification: "manual-curation" },
      football: { playerSeasons: FB_PLAYER_SEASONS.length, players: new Set(FB_PLAYER_SEASONS.map((p) => p.playerId)).size, verification: "manual-curation", attributes: "estimated" },
    },
  });
}
