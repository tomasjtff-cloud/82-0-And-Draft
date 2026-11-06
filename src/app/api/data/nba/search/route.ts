import { NextResponse } from "next/server";
import { ProviderError, providerFetch } from "@/lib/api/providers";

/** Server proxy to BALLDONTLIE player search (requires BALLDONTLIE_API_KEY). */
/** Simple per-instance rate limit to protect the provider quota (best effort on serverless). */
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 10;
}

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (limited(ip)) return NextResponse.json({ error: "Demasiadas solicitudes. Espera un minuto." }, { status: 429 });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ error: "Parámetro q requerido (≥2 caracteres)." }, { status: 400 });
  try {
    const data = await providerFetch<{ data: unknown[] }>("balldontlie", "/players", { search: q, per_page: "25" });
    return NextResponse.json({ source: "balldontlie", results: data.data });
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
