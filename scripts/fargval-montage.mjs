/**
 * Skärmbilder och mätning av färgväljaren överallt (cllp/lifehub.app#882, 0.238.0) mot en byggd dist, i en riktig webbläsare vid 390 och
 * 1280 px, i ljust och mörkt läge: gruppen, profilen, en av mina kalendrar och en kategori, FÖRE (en annan dist, `--fore <dist/index.js>`)
 * och EFTER (grenens dist). jsdom kör ingen CSS, så det som handlar om hur ytan SER UT mäts här: fältet och rutan finns på alla fyra
 * ställena, rutan ryms i fönstret, förhandsvisningen ritar kulören med olika färg i ljust och mörkt läge, och fältets ruta har kulörens färg.
 *
 * Ärendet citerar ingen SessionStudio-skärmbild, så det finns ingen förebild att ställa bredvid (regel 12). Förebilden här är Hubbens
 * färger (`OpsFargval`, 0.219.0): samma fält och samma ruta.
 *
 * Kör: npm run build && node scripts/fargval-montage.mjs [--fore <annan dist/index.js>] [--bilder <mapp>]
 * Förval för bilderna: docs/jamforelser/fargval-882.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { byggYta } from "./lib/byggYta.mjs";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (/** @type {string} */ n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? path.resolve(process.argv[i + 1]) : null;
};
const ut = arg("--bilder") ?? path.join(rot, "docs", "jamforelser", "fargval-882");
const fore = arg("--fore");
fs.mkdirSync(ut, { recursive: true });

/** @type {string[]} */
const fel = [];
let matt = 0;
const krav = (/** @type {boolean} */ ok, /** @type {string} */ text) => {
  matt += 1;
  if (!ok) fel.push(text);
};

const SCENER = ["grupp", "profil", "kalender", "kategori"];

/** Öppnar scenens formulär så att färgen syns. @param {import("playwright").Page} page @param {string} scen */
async function tillFargen(page, scen) {
  if (scen === "grupp") await page.getByRole("button", { name: /Färg och ikon/ }).click();
  if (scen === "kalender") await page.getByRole("button", { name: "Redigera Träning" }).click();
  if (scen === "kategori") await page.getByRole("button", { name: "Ändra" }).first().click();
  await page.waitForTimeout(200);
}

const versioner = [{ namn: "efter", dist: undefined }, ...(fore ? [{ namn: "fore", dist: fore }] : [])];
const { browser, varifran } = await startaWebblasare();
console.log(`webbläsare: ${varifran}`);
try {
  for (const v of versioner) {
    const { sida, stada } = await byggYta({ rot, yta: path.join("scripts", "lib", "fargval-yta.jsx"), namn: `fargval-${v.namn}`, dist: v.dist });
    try {
      for (const lage of /** @type {const} */ (["light", "dark"])) {
        for (const bredd of [390, 1280]) {
          for (const scen of SCENER) {
            const context = await browser.newContext({ viewport: { width: bredd, height: bredd < 768 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: lage, hasTouch: bredd < 768 });
            const page = await context.newPage();
            page.on("pageerror", (e) => fel.push(`${v.namn} ${scen} ${bredd} ${lage}: sidfel: ${e.message}`));
            await page.addInitScript((s) => {
              /** @type {any} */ (window).__fargvalScen = s;
            }, scen);
            await page.setContent(sida, { waitUntil: "load" });
            await page.waitForTimeout(300);
            await tillFargen(page, scen);
            const namn = `${v.namn}-${scen}-${bredd}-${lage === "light" ? "ljust" : "morkt"}`;
            if (v.namn === "efter") {
              const falt = page.getByRole("button", { name: "Färg", exact: true });
              krav((await falt.count()) === 1, `${namn}: fältet Färg saknas`);
              const ruta = await falt.locator("[data-fargval-ruta]").evaluate((e) => getComputedStyle(e).backgroundColor);
              krav(ruta !== "rgba(0, 0, 0, 0)" && ruta !== "", `${namn}: fältets ruta har ingen färg (${ruta})`);
              const h = await falt.evaluate((e) => e.getBoundingClientRect().height);
              krav(h >= 44, `${namn}: fältet är ${h} px högt`);
              await falt.click();
              const panel = page.locator("[data-fargval-panel]");
              await panel.waitFor({ timeout: 3000 });
              const r = await panel.evaluate((e) => {
                const b = e.getBoundingClientRect();
                return { v: b.left, h: b.right, u: b.bottom, bredd: window.innerWidth, hojd: window.innerHeight };
              });
              krav(r.v >= 0 && r.h <= r.bredd, `${namn}: rutan går utanför fönstret i sidled (${Math.round(r.v)} till ${Math.round(r.h)} av ${r.bredd})`);
              if (scen !== "kategori") {
                const [ljust, morkt] = await page.locator("[data-fargval-forhand-lage]").evaluateAll((es) => es.map((e) => getComputedStyle(e).backgroundColor));
                krav(Boolean(ljust) && Boolean(morkt) && ljust !== morkt, `${namn}: förhandsvisningen ritar samma färg i ljust och mörkt (${ljust}, ${morkt})`);
                krav((await page.locator("[data-kulorvaljare] [data-kulor]").count()) >= 12, `${namn}: färre än tolv förslag`);
                krav((await page.getByRole("slider", { name: "Kulör" }).count()) === 1, `${namn}: kulörreglaget saknas`);
                krav((await page.getByRole("slider", { name: "Ljushet" }).count()) === 0, `${namn}: ljushetsreglaget står i kulörläget`);
              } else {
                krav((await page.locator("[data-fargval-plats]").count()) === 3, `${namn}: kategorin har inte tre platser`);
                krav((await page.getByRole("slider").count()) === 0, `${namn}: ett reglage står i palettläget`);
              }
            }
            await page.mouse.move(0, 0);
            await page.waitForTimeout(250);
            const fil = path.join(ut, `${namn}.png`);
            await page.screenshot({ path: fil, fullPage: v.namn === "fore" || bredd >= 768 });
            console.log(fil);
            await context.close();
          }
        }
      }
    } finally {
      stada();
    }
  }
} finally {
  await browser.close();
}

console.log(`${matt} mätningar, ${fel.length} fel.`);
if (matt < 60) fel.push(`för få mätningar (${matt}), golvet är 60`);
if (fel.length) {
  for (const f of fel) console.error(`FEL: ${f}`);
  process.exit(1);
}
