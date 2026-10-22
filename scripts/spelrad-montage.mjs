/**
 * Skärmbild av spelraden mot mikrofonknappen (cllp/lifehub.app#417) mot en byggd dist, 390 px i mörkt läge, med spelaren öppen och
 * bottenmenyn synlig. Ramverket ensamt: ärendet citerar ingen SessionStudio-skärmbild, så det finns ingen förebild att ställa
 * bredvid (regel 12). Före och efter är samma sida mot två byggen.
 *
 * Kör:  npm run build && node scripts/spelrad-montage.mjs --namn efter
 *       node scripts/spelrad-montage.mjs --namn fore --dist <origin/main>/dist/index.js     före-bilden mot en annan byggd version
 * Bilden hamnar i docs/jamforelser/spelrad-417/ramverk-spelrad-<namn>-390.png. Webbläsaren är den startaWebblasare hittar.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { byggYta } from "./lib/byggYta.mjs";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const varde = (/** @type {string} */ flagga) => {
  const i = argv.indexOf(flagga);
  return i >= 0 ? argv[i + 1] : undefined;
};
const namn = varde("--namn") ?? "efter";
const distArg = varde("--dist");
const ut = path.join(rot, "docs", "jamforelser", "spelrad-417");
fs.mkdirSync(ut, { recursive: true });

const { sida, stada } = await byggYta({ rot, yta: path.join("scripts", "lib", "spelrad-yta.jsx"), namn: "spelrad", dist: distArg ? path.resolve(distArg) : undefined });
try {
  const { browser, varifran } = await startaWebblasare();
  console.log(`webbläsare: ${varifran}`);
  for (const colorScheme of /** @type {const} */ (["dark", "light"])) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    /** @type {string[]} */
    const fel = [];
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida, { waitUntil: "load" });
    await page.locator("[data-talk-knapp]").waitFor();
    await page.getByRole("button", { name: "Spela Idé om bolaget" }).click();
    await page.locator("[data-ops-spelrad]").waitFor();
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const r = (/** @type {string} */ v) => document.querySelector(v)?.getBoundingClientRect();
      const mik = r("[data-talk-knapp]");
      const rad = r("[data-ops-spelrad]");
      return { mikTop: mik?.top, radBottom: rad?.bottom };
    });
    if (fel.length) throw new Error(`${namn}: ${fel.join("\n")}`);
    const luft = (m.mikTop ?? 0) - (m.radBottom ?? 0);
    console.log(`${colorScheme}: mikrofonknappens överkant ${m.mikTop?.toFixed(1)}, spelradens underkant ${m.radBottom?.toFixed(1)}, luft ${luft.toFixed(1)} px (${luft >= 0 ? "täcker inte" : "TÄCKER knappen"})`);
    await page.mouse.move(0, 0);
    const fil = path.join(ut, `ramverk-spelrad-${namn}${colorScheme === "light" ? "-ljus" : ""}-390.png`);
    await page.screenshot({ path: fil });
    console.log(fil);
    await context.close();
  }
  await browser.close();
} finally {
  stada();
}
