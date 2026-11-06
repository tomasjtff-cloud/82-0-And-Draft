import type { MetadataRoute } from "next";

const base = process.env.GITHUB_PAGES === "true" ? "/82-0-And-Draft" : "";
export const dynamic = "force-static";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Legends Lab", short_name: "Legends Lab", lang: "es", dir: "ltr",
    description: "NBA 82-0 y Draft de fútbol: drafts históricos y temporadas simuladas.",
    start_url: `${base}/`, scope: `${base}/`, display: "standalone", orientation: "portrait", background_color: "#06070a", theme_color: "#06070a",
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
