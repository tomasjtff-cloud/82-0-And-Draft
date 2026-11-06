/** Rasterises the master vector mark (public/brand/legends-lab-mark.svg) into the icon sizes used by Safari/iOS/PWA. */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const svg = fs.readFileSync(path.join(__dirname, "../public/brand/legends-lab-mark.svg"), "utf8");
const targets = [
  ["src/app/apple-icon.png", 180, 0],          // Apple Touch Icon (Next.js app convention)
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-512.png", 512, 0],
  ["public/icons/maskable-512.png", 512, 0.12], // safe zone padding for maskable icons
  ["public/icons/favicon-32.png", 32, 0],
];
(async () => {
  const b = await chromium.launch();
  for (const [out, size, pad] of targets) {
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const inner = Math.round(size * (1 - 2 * pad));
    await p.setContent(`<html><body style="margin:0;background:${pad ? "#06070a" : "transparent"};display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</body></html>`);
    await p.screenshot({ path: path.join(__dirname, "..", out), omitBackground: !pad, clip: { x: 0, y: 0, width: size, height: size } });
    await p.close();
    console.log("wrote", out, size);
  }
  await b.close();
})();
