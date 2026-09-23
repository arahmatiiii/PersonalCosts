// Renders public/icons/*.png from an inline SVG using the preinstalled Chromium (Playwright).
// Usage: node scripts/make-icons.mjs   (needs `npx playwright` / playwright-core available)
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/icons");
const svg = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${pad ? 0 : 22}" fill="#0f766e"/>
  <g transform="translate(50 50) scale(${pad ? 0.62 : 0.8}) translate(-50 -50)">
    <rect x="14" y="26" width="72" height="50" rx="9" fill="#ffffff"/>
    <rect x="14" y="36" width="72" height="9" fill="#134e4a"/>
    <rect x="22" y="56" width="26" height="6" rx="3" fill="#99f6e4"/>
    <circle cx="72" cy="61" r="7" fill="#f59e0b"/>
  </g>
</svg>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
for (const [name, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-512-maskable.png", 512, true],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, maskable)}</body></html>`);
  await page.screenshot({ path: path.join(out, name), omitBackground: true });
}
await browser.close();
