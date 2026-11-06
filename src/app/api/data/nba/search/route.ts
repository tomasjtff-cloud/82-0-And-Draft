import { NextResponse } from "next/server";
import { ProviderError, providerFetch } from "@/lib/api/providers";

/** Server proxy to BALLDONTLIE player search (requires BALLDONTLIE_API_KEY). */
export async function GET(req: Request) {
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
