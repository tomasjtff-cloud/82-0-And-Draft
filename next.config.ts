import type { NextConfig } from "next";

/**
 * GITHUB_PAGES=true → static export served from https://tomasjtff-cloud.github.io/82-0-And-Draft/
 * (the games run fully in the browser; the optional /api routes are removed by the Pages workflow).
 * Otherwise a normal Next.js server build (Vercel/Netlify/local).
 */
const pages = process.env.GITHUB_PAGES === "true";
const base = "/82-0-And-Draft";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(pages ? { output: "export", basePath: base, assetPrefix: `${base}/`, trailingSlash: true, images: { unoptimized: true } } : {}),
};
export default nextConfig;
