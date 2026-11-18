/**
 * Mätning och skärmbilder av TALK som pratar tillbaka (cllp/lifehub.app#870 skiva 4, CP 2026-11-18: vågikonen och högtalarknappen) mot en
 * byggd dist, i en riktig webbläsare vid 390 och 1280 px. jsdom kör ingen CSS, så det som handlar om hur ytorna SER UT mäts här: vågikonen
 * står i TALK-fältets översta rad medan man pratar, med namn och minst 44 px träffyta, högtalarknappen står i samtalet med `aria-pressed`,
 * och vågikonen står bredvid skrivfältet i agentens chatt.
 *
 * Bilderna är ramverket ensamt: beslutet citerar ingen SessionStudio-skärmbild, så det finns ingen förebild att ställa bredvid (regel 12).
 *
 * Kör: npm run build && node scripts/talk-rost-montage.mjs [--bilder <mapp>]
 * Förval för bilderna: docs/jamforelser/talk-rost-870.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { byggYta } from "./lib/byggYta.mjs";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i = process.argv.indexOf("--bilder");
const ut = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(rot, "docs", "jamforelser", "talk-rost-870");
fs.mkdirSync(ut, { recursive: true });

/** @type {string[]} */
const fel = [];
let matt = 0;
const krav = (/** @type {boolean} */ ok, /** @type {string} */ text) => {
  matt += 1;
  if (!ok) fel.push(text);
};

/** Körs i sidan: knappens namn, storlek och om ett tryck i mitten träffar den. @param {Element} k */
function knappen(k) {
  const r = k.getBoundingClientRect();
  const mitt = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return { namn: k.getAttribute("aria-label"), tryckt: k.getAttribute("aria-pressed"), b: r.width, h: r.height, synlig: r.width > 0 && r.height > 0, tr: mitt === k || k.contains(mitt) };
}

const { sida, stada } = await byggYta({ rot, yta: path.join("scripts", "lib", "talk-rost-yta.jsx"), namn: "talk-rost" });
try {
  const { browser, varifran } = await startaWebblasare();
  console.log(`webbläsare: ${varifran}`);
  for (const bredd of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width: bredd, height: bredd < 768 ? 844 : 820 }, deviceScaleFactor: 2, colorScheme: "light", hasTouch: bredd < 768 });
    const page = await context.newPage();
    page.on("pageerror", (e) => fel.push(`${bredd}: sidfel: ${e.message}`));
    await page.setContent(sida, { waitUntil: "load" });
    await page.locator("[data-skrivfalt]").waitFor();
    const bild = async (/** @type {string} */ namn) => {
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      const fil = path.join(ut, `ramverk-${namn}-${bredd}.png`);
      await page.screenshot({ path: fil });
      console.log(fil);
    };

    // 1. Agentens chatt: vågikonen bredvid skrivfältet.
    const chattVag = page.locator("[data-rost-samtal]");
    krav((await chattVag.count()) === 1, `${bredd}: vågikonen i agentens chatt saknas`);
    const cv = await chattVag.evaluate(knappen);
    krav(cv.namn === "Samtal med agenten", `${bredd}: chattens vågikon heter ${cv.namn}`);
    krav(cv.b >= 44 && cv.h >= 44 && cv.tr, `${bredd}: chattens vågikon är ${cv.b}x${cv.h}, träff ${cv.tr}`);
    await bild("chatt-vagikon");

    // 2. TALK-fältet medan man pratar: vågikonen i översta raden.
    const mik = page.locator(bredd < 768 ? "[data-talk-knapp]" : "[data-talk-huvud]").first();
    await mik.click();
    await page.waitForTimeout(500);
    const vag = page.locator("[data-ops-talk] [data-talk-samtal]");
    krav((await vag.count()) === 1, `${bredd}: vågikonen i TALK-fältet saknas medan man pratar`);
    const v = await vag.evaluate(knappen);
    krav(v.namn === "Samtal med agenten", `${bredd}: TALK-fältets vågikon heter ${v.namn}`);
    krav(v.b >= 44 && v.h >= 44 && v.tr, `${bredd}: TALK-fältets vågikon är ${v.b}x${v.h}, träff ${v.tr}`);
    await bild("talk-vagikon");

    // 3. Ett tryck: samtalet, läser upp, med högtalarknappen.
    await vag.click();
    await page.locator("[data-talk-rost='laser']").waitFor({ timeout: 5000 });
    const h = await page.locator("[data-ops-talk] [data-talk-hogtalare]").evaluate(knappen);
    krav(h.namn === "Läs upp svaren" && h.tryckt === "true", `${bredd}: högtalarknappen heter ${h.namn}, aria-pressed ${h.tryckt}`);
    krav(h.b >= 44 && h.h >= 44 && h.tr, `${bredd}: högtalarknappen är ${h.b}x${h.h}, träff ${h.tr}`);
    krav((await page.locator("[data-talk-val]").count()) === 0, `${bredd}: menyn ritades fast vågikonen trycktes`);
    await bild("samtal-laser");

    // 4. Högtalaren av: svaret visas och mikrofonen lyssnar igen.
    await page.locator("[data-ops-talk] [data-talk-hogtalare]").click();
    await page.locator("[data-talk-rost='lyssnar']").waitFor({ timeout: 5000 });
    const av = await page.locator("[data-ops-talk] [data-talk-hogtalare]").evaluate(knappen);
    krav(av.tryckt === "false", `${bredd}: högtalarknappen står på efter tryck`);
    krav((await page.locator("[data-talk-rost-svar]").count()) === 1, `${bredd}: svaret visas inte med högtalaren av`);
    await bild("samtal-hogtalare-av");
    await context.close();
  }
  await browser.close();
} finally {
  stada();
}

console.log(`${matt} mätningar, ${fel.length} fel.`);
if (matt < 20) fel.push(`för få mätningar (${matt}), golvet är 20`);
if (fel.length) {
  for (const f of fel) console.error(`FEL: ${f}`);
  process.exit(1);
}
