#!/usr/bin/env node
/**
 * Vakt: ramverkets komponenter RITAR samma storlek och vikt som SessionStudio, mätt i en riktig webbläsare (0.136.0).
 *
 * ══ ⛔ VARFÖR (CP 2026-10-21) ═══════════════════════════════════════════════════════════════════════════
 *
 * "Det känns som att någon skrivit över vilka typsnitt vi skall använda i appen. Ser inte ut som SessionStudio. Känns tjockt och
 * stort och inte snyggt och enkelt." Typsnittet var rätt, och rollernas storlekar var SessionStudios. Skillnaden satt i vilken roll
 * en komponent valde: kryssrutans etikett var 16 px (SS 14), flikarna 16/600 (SS 12/500), listradens titel 16/600 (SS 14/500),
 * hjälptexten under en rad 14 (SS 11), bannerns och tomma lägets text 16 (SS 12). Mätt mot SS egen CSS i Chromium. Varje
 * enhetsprov var grönt hela tiden: jsdom kör ingen CSS, och ingen sökning i källan ser vilken roll som ritas.
 *
 * ══ ⛔ VAD DEN GÖR ═════════════════════════════════════════════════════════════════════════════════
 *
 * Bygger `scripts/lib/typografi-yta.jsx` mot `dist`, ritar den i Chromium på 1280 och 390 px och läser den BERÄKNADE storleken och
 * vikten för varje rad i `typografi.element.lista` (tokens/sessionstudio-profil.json). Fälls: storleken eller vikten är inte
 * den SessionStudio ritar. Även `body`: ordavstånd (0.06em) och kantutjämning som SS.
 *
 * ⛔ GOLV: minst 12 element mäts och inget får saknas. Ett element som inte hittas är ett brott, aldrig ett överhoppat mått
 * (arbetsreglernas punkt 4, tomt underlag).
 *
 * ⛔ `--bevisa` kör vakten på nytt med ett inplanterat brott per påstående och kräver rött av rätt anledning. Provet är en del
 * av vakten, så en vakt som slutat bita syns i samma körning (kör i CI bredvid `check:brand`).
 *
 * Kör: npm run build && node scripts/check-typografimatning.mjs [--bevisa] [--injicera="css"]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const injicera = argv.find((a) => a.startsWith("--injicera="))?.slice(11) ?? "";
const bevisa = argv.includes("--bevisa");
const dist = path.join(rot, "dist", "index.js");
const GOLV = 12;
const BREDDER = [1280, 390];

const profil = JSON.parse(fs.readFileSync(path.join(rot, "tokens", "sessionstudio-profil.json"), "utf8")).typografi;
/** @type {{ namn: string, text?: string, input?: string, storlek: number, vikt: number, versaler?: boolean, bara_dator?: boolean, ss: string }[]} */
const ELEMENT = profil?.element?.lista ?? [];
const ORDAVSTAND_EM = Number.parseFloat(profil?.word_spacing_normal?.varde ?? "");
if (ELEMENT.length < GOLV || !Number.isFinite(ORDAVSTAND_EM)) {
  console.error(`check-typografimatning: typografi.element.lista har ${ELEMENT.length} element (väntat minst ${GOLV}) eller word_spacing_normal saknas. Tokens/sessionstudio-profil.json är trasig, och en tom lista är grön av att inte mäta.`);
  process.exit(1);
}
if (!fs.existsSync(dist)) {
  console.error(`check-typografimatning: ${dist} saknas. Kör npm run build först. Ett överhoppat mått räknas aldrig som grönt.`);
  process.exit(1);
}

const { byggYta } = await import("./lib/byggYta.mjs");
const { sida, stada } = await byggYta({ rot, yta: "scripts/lib/typografi-yta.jsx", namn: "typografimatning" });
const { browser } = await startaWebblasare();

/**
 * @param {string} css Extra CSS som läggs in före mätningen (bara för `--bevisa`).
 * @returns {Promise<{ brott: string[], matt: number }>}
 */
async function mat(css) {
  /** @type {string[]} */
  const brott = [];
  let matt = 0;
  for (const bredd of BREDDER) {
    const kontext = await browser.newContext({ viewport: { width: bredd, height: 1000 } });
    const page = await kontext.newPage();
    await page.setContent(css ? sida.replace("</head>", `<style>${css}</style></head>`) : sida, { waitUntil: "load" });
    await page.waitForSelector("h1");
    const svar = await page.evaluate((lista) => {
      /** @type {Record<string, { storlek: number, vikt: number, versaler: boolean } | null>} */
      const ut = {};
      for (const e of lista) {
        /** @type {Element | null} */
        let hit = null;
        if (e.input) hit = [...document.querySelectorAll("input:not([type=checkbox])")].find((i) => /** @type {HTMLInputElement} */ (i).value === e.input) ?? null;
        else {
          hit =
            [...document.querySelectorAll("body *")].find((n) => {
              const egen = [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join("").replace(/\s+/g, " ").trim();
              return egen === e.text && n.getBoundingClientRect().width > 0;
            }) ?? null;
        }
        if (!hit) {
          ut[e.namn] = null;
          continue;
        }
        const cs = getComputedStyle(hit);
        ut[e.namn] = { storlek: Number.parseFloat(cs.fontSize), vikt: Number(cs.fontWeight), versaler: cs.textTransform === "uppercase" };
      }
      const b = getComputedStyle(document.body);
      ut.__body = { storlek: 0, vikt: 0, versaler: false, ordavstand: Number.parseFloat(b.wordSpacing), px: Number.parseFloat(b.fontSize), smoothing: b.getPropertyValue("-webkit-font-smoothing") };
      return ut;
    }, ELEMENT);
    for (const e of ELEMENT) {
      if (e.bara_dator && bredd < 1024) continue;
      const m = svar[e.namn];
      if (!m) {
        brott.push(`${bredd} px: "${e.namn}" (texten "${e.text ?? e.input}") hittades inte på ytan. Ett element som inte mäts är ett brott.`);
        continue;
      }
      matt += 1;
      if (m.storlek !== e.storlek || m.vikt !== e.vikt || (e.versaler === true && !m.versaler)) {
        brott.push(`${bredd} px: ${e.namn} ritas ${m.storlek} px/${m.vikt}${m.versaler ? " versaler" : ""}, SessionStudio ritar ${e.storlek} px/${e.vikt}${e.versaler ? " versaler" : ""} (${e.ss}). Rätta rollen i komponenten, aldrig siffran här.`);
      }
    }
    const b = /** @type {any} */ (svar.__body);
    const vantat = Math.round(ORDAVSTAND_EM * b.px * 100) / 100;
    if (Math.abs(b.ordavstand - vantat) > 0.01) brott.push(`${bredd} px: body har ordavstånd ${b.ordavstand} px, SessionStudio ${vantat} px (${ORDAVSTAND_EM}em, SS #2501: Plus Jakarta Sans smala mellanslag).`);
    if (b.smoothing !== "antialiased") brott.push(`${bredd} px: body har kantutjämning "${b.smoothing}", SessionStudio "antialiased".`);
    await kontext.close();
  }
  return { brott, matt };
}

try {
  if (bevisa) {
    /** @type {{ namn: string, css: string, vantat: string }[]} */
    const PROV = [
      { namn: "kryssrutans etikett blir 16 px", css: "label .text-etikett, label { font-size: 16px !important; }", vantat: "kryssruta, etikett" },
      { namn: "en flik blir 600", css: "[role=tab] { font-weight: 600 !important; }", vantat: "flik" },
      { namn: "bannerns titel blir 16 px", css: "[data-ops-banner] p:first-child, [role=status] p:first-child { font-size: 16px !important; }", vantat: "banner, titel" },
      { namn: "body tappar ordavståndet", css: "body { word-spacing: 0 !important; }", vantat: "ordavstånd" },
      { namn: "body tappar kantutjämningen", css: "body { -webkit-font-smoothing: auto !important; }", vantat: "kantutjämning" },
    ];
    const gron = await mat("");
    if (gron.brott.length > 0 || gron.matt < GOLV) {
      console.error(`check-typografimatning --bevisa: utgångsläget är inte grönt (${gron.matt} mätta, ${gron.brott.length} brott):\n  ${gron.brott.join("\n  ")}`);
      process.exitCode = 1;
    } else {
      console.log(`  grön som väntat  utan inplanterat brott (${gron.matt} mätningar)`);
      for (const p of PROV) {
        const r = await mat(p.css);
        if (r.brott.some((b) => b.includes(p.vantat))) console.log(`  röd som väntat   ${p.namn}`);
        else {
          console.error(`  FEL  ${p.namn}: vakten blev ${r.brott.length === 0 ? "GRÖN trots brottet" : `röd av fel anledning (${r.brott[0]})`}`);
          process.exitCode = 1;
        }
      }
    }
  } else {
    const { brott, matt } = await mat(injicera);
    if (matt < GOLV) {
      console.error(`check-typografimatning: bara ${matt} mätningar, väntat minst ${GOLV}. En vakt som är grön av att inte ha mätt skyddar ingenting.`);
      process.exitCode = 1;
    } else if (brott.length > 0) {
      console.error(`check-typografimatning: ${brott.length} avvikelse(r) mot SessionStudio:\n  ${brott.join("\n  ")}`);
      process.exitCode = 1;
    } else {
      console.log(`check-typografimatning: ${matt} mätningar på ${BREDDER.join(" och ")} px, alla som SessionStudio, body med ordavstånd och kantutjämning.`);
    }
  }
} finally {
  await browser.close();
  stada();
}
