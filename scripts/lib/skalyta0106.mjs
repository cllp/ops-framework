/**
 * Avsnitt 47 i check-skalyta: chattepiken 0.106.0 (#386), en del per skiva, vid 390 och 1280 px.
 *
 * ⛔ EN EGEN FIL OCH INTE ETT BLOCK TILL I check-skalyta.mjs. Skriptet är över 6800 rader, och skivorna läggs till en i taget.
 * Funktionerna får vaktens egna verktyg (`oppna`, `krav`, `matt`) som argument, så att mätningen räknas, skrivs ut och blir röd
 * på samma sätt som resten av vakten. Kör ensamt: `node scripts/check-skalyta.mjs --bara-0106`.
 *
 * ⛔ GOLV: varje del kräver att det den mäter fanns (rader, knappar, meddelanden), annars är den röd.
 */

import path from "node:path";

/** @typedef {{ oppna: (scen: string, vp: { width: number, height: number }, tema?: string, skala?: number, aktiv?: string | null, manga?: number) => Promise<{ page: import("playwright").Page, context: import("playwright").BrowserContext }>, krav: (ok: boolean, text: string) => void, matt: string[], bildmapp: string | null }} Verktyg */

export const BREDDER = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];

/** @param {import("playwright").Page} page */
const over = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/**
 * Kör en del i en egen sida, och gör ett avbrott till ett brott i stället för ett kast.
 * @param {Verktyg} v @param {string} namn @param {string} scen @param {{ width: number, height: number }} vp @param {string | null} aktiv
 * @param {(page: import("playwright").Page) => Promise<void>} fn
 */
async function del(v, namn, scen, vp, aktiv, fn) {
  /** @type {import("playwright").BrowserContext | null} */
  let context = null;
  try {
    const o = await v.oppna(scen, vp, "light", 1, aktiv);
    context = o.context;
    await fn(o.page);
    const o2 = await over(o.page);
    v.krav(o2 <= 0, `${namn}: sidan rullar ${o2} px i sidled.`);
  } catch (e) {
    v.krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context?.close();
}

/** @param {Verktyg} v @param {import("playwright").Page} page @param {string} fil */
async function bild(v, page, fil) {
  if (v.bildmapp) await page.screenshot({ path: path.join(v.bildmapp, fil) });
}

/**
 * (1) MEDDELANDEN ÄR KÄRNA (skiva 1). Gruppen är sparad UTAN Meddelanden. Hubben ritar ändå kortet, och listan över appar att
 * installera har inte Meddelanden. På telefonen visar Appar-arket Meddelanden. Golv: hubben har minst tre kort och listan att
 * installera minst en rad (Kontakter).
 * @param {Verktyg} v
 */
export async function karnan(v) {
  for (const vp of BREDDER) {
    const namn = `47 (1) kärnan ${vp.width} px`;
    await del(v, namn, "karna", vp, null, async (page) => {
      await page.locator("[data-grupphubb]").waitFor({ timeout: 4000 });
      const m = await page.evaluate(() => ({
        kort: [...document.querySelectorAll("[data-grupphubb] a[href]")].map((a) => a.getAttribute("href")).filter((h) => h && h !== "/installera" && /^\/[a-z]+$/.test(h)),
        valbara: [...document.querySelectorAll("[data-hubb-valbar]")].map((el) => el.getAttribute("data-hubb-valbar")),
      }));
      v.matt.push(`${namn}: kort ${JSON.stringify(m.kort)}, att installera ${JSON.stringify(m.valbara)}`);
      v.krav(m.kort.length >= 3, `${namn}: ${m.kort.length} kort i hubben, väntat minst 3. Golv.`);
      v.krav(m.kort.includes("/meddelanden"), `${namn}: hubben ritar inte Meddelanden fast den är kärna (${JSON.stringify(m.kort)}).`);
      v.krav(m.valbara.length >= 1 && !m.valbara.includes("meddelanden"), `${namn}: listan att installera är ${JSON.stringify(m.valbara)}, väntat Kontakter och inte Meddelanden.`);
      await bild(v, page, `karna-hubb-${vp.width}.png`);
      if (vp.width < 768) {
        await page.locator("[data-ops-bottenrad]").getByRole("button", { name: "Appar" }).click();
        await page.waitForSelector("[data-appar-ark]");
        const ark = await page.evaluate(() => [...document.querySelectorAll("[data-appar-ark] [data-ark-id]")].map((el) => el.getAttribute("data-ark-id")));
        v.matt.push(`${namn}: arket ${JSON.stringify(ark)}`);
        v.krav(ark.length >= 3 && ark.includes("meddelanden"), `${namn}: arket är ${JSON.stringify(ark)}, väntat minst tre appar med Meddelanden.`);
        await bild(v, page, `karna-ark-${vp.width}.png`);
      }
    });
  }
}

/**
 * Alla delar i ordning. Varje skiva lägger till sin rad här.
 * @param {Verktyg} v
 */
export async function chattepiken0106(v) {
  await karnan(v);
}
