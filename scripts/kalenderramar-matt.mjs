#!/usr/bin/env node
/**
 * Mätning: dagens ramar, högst två inuti varandra, mätt i en riktig webbläsare (0.151.0, CP 2026-10-28).
 *
 * ══ VARFÖR ══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Till 0.150.0 ritade dagrutan EN ram. Nu ritas två när två kalendrar har Ram eller Båda samma dag, den andra inuti den första. Vilka ramar som ritas, i vilken ordning och i vilken
 * ton provas i jsdom (`kalenderramar-vy.test.jsx`), men jsdom kör ingen CSS: att båda ramarna SYNS som två linjer, ligger inuti varandra, inte täcker dagens siffra, prickarna eller
 * brickorna, och att en ram ser ut exakt som förut går bara att mäta här. En ruta är 41 px bred vid 320 px, och det är där två ramar på 2 px var skulle kunna äta upp siffran.
 *
 * ══ VAD DEN MÄTER, i 320, 390, 768 och 1280 px, i lägena "tva" (tre kalendrar med ram) och "en" (en) ═══════════════════════════
 *
 *   1. Ingen horisontell rullning.
 *   2. Rätt antal ramar per dag: 0, 1 eller (högst) 2, också när tre kalendrar har ram samma dag.
 *   3. Ramarna ligger i rutan och är absoluta (de ändrar ingen storlek), den inre ligger INUTI den yttre med minst en pixel luft, lika på alla fyra sidor.
 *   4. Den yttre ramen har en kant på 2 px. Den inre har 1 px under 640 px och 2 från 640 px (mätt: 2 px med 1 px luft gick över siffran vid 320 px), och de två färgerna skiljer sig (två kalendrar, två toner).
 *   5. Siffran, prickarna, pillren och hörnbrickorna täcks inte av en ram: rutan fotograferas med ramarna synliga och dolda, och inga pixlar innanför deras rutor skiljer sig (ett mått på det
 *      som SYNS, inte på var rutornas kanter ligger: en teckenruta är högre än siffrans bläck, och ett mått på den hade larmat för något ingen ser). Ramarna måste dessutom märkas: raden av
 *      rutan utanför innehållet ska skilja sig, annars har jämförelsen inget att jämföra.
 *   6. ⛔ EN RAM ÄR EXAKT SOM FÖRUT: den yttre ramens läge i rutan är det 0.150.0 hade (0 px från kantlådan under 640 px, 3 px från 640 px), också på en dag med en enda ram.
 *
 * ⛔ GOLV: minst 4 vyportar och 150 mätningar, och minst en dag med två ramar i varje läge. ⛔ FAIL-CLOSED när webbläsaren saknas.
 * ⛔ RÖTT UTAN ÄNDRINGEN: `--bevisa` mäter läget "gammal", alltså EN ram per dag så som 0.150.0 ritade, och kräver rött (två ramar saknas).
 *
 * Kör:  npm run build && node scripts/kalenderramar-matt.mjs
 *       node scripts/kalenderramar-matt.mjs --bevisa
 *       node scripts/kalenderramar-matt.mjs --dist <dist/index.js> --lage en   mäter en ANNAN byggd version, bara läget med en ram per dag: samma mått mot 0.150.0:s bygge ger
 *       beviset för "en ram är exakt som förut" (rutornas ram ligger på samma pixel, med och utan ändringen).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { byggYta } from "./lib/byggYta.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bevisa = process.argv.includes("--bevisa");
const argv = process.argv.slice(2);
const varde = (/** @type {string} */ flagga) => (argv.includes(flagga) ? argv[argv.indexOf(flagga) + 1] : undefined);
const annanDist = varde("--dist") ? path.resolve(/** @type {string} */ (varde("--dist"))) : undefined;
const valtLage = varde("--lage");
const VYPORTAR = [320, 390, 768, 1280];
const SM = 640;
const TOL = 0.6;

/** Antal ramar per dag och läge. Dag 15 har ingen post: ingen ram. */
const FORVANTAT = {
  tva: { "2026-10-12": 2, "2026-10-13": 2, "2026-10-14": 1, "2026-10-15": 0, "2026-10-16": 1, "2026-10-17": 2 },
  en: { "2026-10-12": 1, "2026-10-13": 1, "2026-10-14": 0, "2026-10-15": 0, "2026-10-16": 1, "2026-10-17": 1 },
};

if (!fs.existsSync(annanDist ?? path.join(rot, "dist", "index.js"))) {
  console.error("kalenderramar-matt: dist/index.js saknas. Kör `npm run build` först.");
  process.exit(1);
}

const { sida, stada } = await byggYta({ rot, yta: "scripts/lib/kalenderramar-yta.jsx", namn: "kalenderramar", dist: annanDist });
const LAGEN = /** @type {string[]} */ (bevisa ? ["gammal"] : valtLage ? [valtLage] : ["tva", "en"]);
const { browser } = await startaWebblasare();

/** @type {string[]} */ const brott = [];
let matningar = 0;
/** @param {boolean} ok @param {string} skal */
const krav = (ok, skal) => {
  matningar += 1;
  if (!ok) brott.push(skal);
};

/**
 * Fotograferar en ruta med ramarna synliga och dolda och räknar pixlar som skiljer sig, i rutans ring (ramarnas yta) och innanför rutorna för siffran, märkena och brickorna.
 * Siffran och märkena räknas bara där det finns bläck (ramens rundade hörn går över en tom hörnyta i siffrans ruta, och det är ingen täckning), och en rund bricka bara innanför sin inskrivna cirkel
 * (kantens antialiasing blandar med det som ligger under, också utan ramar).
 * @param {import("playwright").Page} page @param {any} d
 */
async function pixelskillnad(page, d) {
  const marg = 8;
  const klipp = { x: Math.max(0, Math.floor(d.cell.left - marg)), y: Math.max(0, Math.floor(d.cell.top - marg)), width: Math.ceil(d.cell.w + 2 * marg), height: Math.ceil(d.cell.h + 2 * marg) };
  const satt = (/** @type {string} */ v) =>
    page.evaluate(([dag, vis]) => document.querySelectorAll(`[data-cal-day="${dag}"] [data-dagram], [data-cal-day="${dag}"] [data-dagram-inre]`).forEach((e) => /** @type {HTMLElement} */ (e).style.setProperty("visibility", vis)), [d.dag, v]);
  const med = (await page.screenshot({ clip: klipp })).toString("base64");
  await satt("hidden");
  const utan = (await page.screenshot({ clip: klipp })).toString("base64");
  await satt("visible");
  const regioner = {
    ring: { left: d.cell.left, top: d.cell.top, right: d.cell.right, bottom: d.cell.bottom, hel: true },
    nummer: d.nummer,
    innehall: d.innehall,
    brickor: d.brickor,
  };
  return await page.evaluate(
    async ([a, b, k, reg]) => {
      /** @param {string} b64 */
      const lasBild = async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const x = /** @type {CanvasRenderingContext2D} */ (c.getContext("2d"));
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, c.width, c.height);
      };
      const A = await lasBild(a);
      const B = await lasBild(b);
      /**
       * Räknar pixlar som skiljer. `ink`: bara pixlar som är bläck utan ramarna (skiljer sig från regionens vanligaste färg), så att en tom hörnyta i en ruta som ramens rundade hörn
       * går över inte räknas som att siffran täcks. `cirkel`: bara den inskrivna cirkeln minus två pixlar (en rund bricka), så att antialiasingen i kanten, som blandar med det som ligger under,
       * inte räknas som täckning.
       * @param {any} r @param {{ krymp?: number, ink?: boolean, cirkel?: boolean }} v
       */
      const rakna = (r, { krymp = 0, ink = false, cirkel = false }) => {
        const x0 = Math.max(0, Math.ceil(r.left - k.x) + krymp), x1 = Math.min(A.width, Math.floor(r.right - k.x) - krymp);
        const y0 = Math.max(0, Math.ceil(r.top - k.y) + krymp), y1 = Math.min(A.height, Math.floor(r.bottom - k.y) - krymp);
        const cx = (r.left + r.right) / 2 - k.x, cy = (r.top + r.bottom) / 2 - k.y, rad = Math.min(r.right - r.left, r.bottom - r.top) / 2 - 2;
        /** @type {Map<number, number>} */
        const farger = new Map();
        const pixlar = [];
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            if (cirkel && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > rad) continue;
            const i = (y * A.width + x) * 4;
            pixlar.push(i);
            if (ink) {
              const nyckel = ((B.data[i] >> 3) << 10) | ((B.data[i + 1] >> 3) << 5) | (B.data[i + 2] >> 3);
              farger.set(nyckel, (farger.get(nyckel) ?? 0) + 1);
            }
          }
        let bg = -1, mest = 0;
        for (const [nyckel, n] of farger) if (n > mest) { bg = nyckel; mest = n; }
        let n = 0;
        for (const i of pixlar) {
          if (ink) {
            const nyckel = ((B.data[i] >> 3) << 10) | ((B.data[i + 1] >> 3) << 5) | (B.data[i + 2] >> 3);
            if (nyckel === bg) continue;
          }
          if (Math.abs(A.data[i] - B.data[i]) > 8 || Math.abs(A.data[i + 1] - B.data[i + 1]) > 8 || Math.abs(A.data[i + 2] - B.data[i + 2]) > 8) n += 1;
        }
        return n;
      };
      return {
        ring: rakna(reg.ring, {}),
        nummer: rakna(reg.nummer, { ink: true }),
        innehall: reg.innehall.map((/** @type {any} */ r) => rakna(r, { ink: true })),
        brickor: reg.brickor.map((/** @type {any} */ r) => rakna(r, { cirkel: true })),
      };
    },
    /** @type {[string, string, typeof klipp, typeof regioner]} */ ([med, utan, klipp, regioner]),
  );
}

/**
 * @param {number} bredd @param {string} lage
 */
async function mat(bredd, lage) {
  const context = await browser.newContext({ viewport: { width: bredd, height: 900 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    const fel = /** @type {string[]} */ ([]);
    page.on("pageerror", (e) => fel.push(e.message));
    await page.setContent(sida.replace('<div id="root"></div>', `<div id="root"></div><script>window.__prov = ${JSON.stringify({ lage })};</script>`));
    await page.waitForFunction("window.__redo === true", null, { timeout: 5000 }).catch(() => {});
    if (fel.length) throw new Error(`provsidan kastade: ${fel[0]}`);
    await page.waitForSelector('[data-cal-day="2026-10-12"]');
    const matt = await page.evaluate((dagar) => {
      const rekt = (/** @type {Element} */ e) => {
        const b = e.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, w: b.width, h: b.height };
      };
      const syns = (/** @type {Element} */ e) => {
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      };
      const ram = (/** @type {Element} */ e) => {
        const cs = getComputedStyle(e);
        return { ...rekt(e), kant: parseFloat(cs.borderTopWidth), farg: cs.borderTopColor, position: cs.position, z: parseInt(cs.zIndex, 10) || 0 };
      };
      return {
        scrollBredd: document.documentElement.scrollWidth,
        fonster: window.innerWidth,
        dagar: dagar.map((/** @type {string} */ dag) => {
          const c = /** @type {HTMLElement | null} */ (document.querySelector(`[data-cal-day="${dag}"]`));
          if (!c) return { dag, saknas: true };
          const nr = /** @type {Element} */ (c.querySelector("[data-dagnummer]"));
          return {
            dag,
            cell: rekt(c),
            nummer: rekt(nr),
            yttre: c.querySelector("[data-dagram]") ? ram(/** @type {Element} */ (c.querySelector("[data-dagram]"))) : null,
            inre: c.querySelector("[data-dagram-inre]") ? ram(/** @type {Element} */ (c.querySelector("[data-dagram-inre]"))) : null,
            antalRamar: c.querySelectorAll("[data-dagram], [data-dagram-inre]").length,
            innehall: [...c.querySelectorAll("[data-prick], [data-kalender-piller] > span, [data-markor-streck]")].filter(syns).map(rekt),
            // z-index sitter på hornbrickornas behållare (`data-hornmarken`, z-3), inte på varje bricka: första förälder inom rutan med ett z-index.
            brickor: [...c.querySelectorAll("[data-hornmarke]")].filter(syns).map((b) => {
              let z = 0;
              for (let x = /** @type {Element | null} */ (b); x && x !== c; x = x.parentElement) {
                const v = parseInt(getComputedStyle(x).zIndex, 10);
                if (!Number.isNaN(v)) { z = v; break; }
              }
              return { ...rekt(b), z };
            }),
          };
        }),
      };
    }, Object.keys(FORVANTAT.tva));
    // ⛔ Pixelmåttet: varje ruta med ramar fotograferas med ramarna synliga och dolda.
    for (const d of /** @type {any[]} */ (matt.dagar)) {
      if (d.saknas || d.antalRamar === 0) continue;
      d.pixlar = await pixelskillnad(page, d);
    }
    return matt;
  } finally {
    await context.close();
  }
}

const rader = /** @type {string[]} */ ([]);
let tvaRamsDagar = 0;
let pixelDagar = 0;
for (const bredd of VYPORTAR) {
  for (const lage of LAGEN) {
    const m = await mat(bredd, lage);
    const namn = `${bredd} px, läge ${lage}`;
    const forvantat = FORVANTAT[/** @type {"tva" | "en"} */ (lage === "gammal" ? "tva" : lage)];
    krav(m.scrollBredd <= m.fonster + 0.5, `${namn}: sidan rullar i sidled (${m.scrollBredd} px mot ${m.fonster} px)`);
    const telefon = bredd < SM;
    for (const d of m.dagar) {
      const dn = `${namn}, ${d.dag}`;
      if ("saknas" in d && d.saknas) {
        krav(false, `${dn}: rutan finns inte`);
        continue;
      }
      const dag = /** @type {any} */ (d);
      krav(dag.antalRamar === forvantat[/** @type {keyof typeof forvantat} */ (dag.dag)], `${dn}: ${dag.antalRamar} ramar, väntade ${forvantat[/** @type {keyof typeof forvantat} */ (dag.dag)]}`);
      const { yttre, inre, cell } = dag;
      const innersta = inre ?? yttre;
      if (yttre) {
        krav(yttre.position === "absolute", `${dn}: den yttre ramen är inte absolut och kan ändra rutans storlek`);
        krav(yttre.kant >= 2 - 0.01, `${dn}: den yttre ramens kant är ${yttre.kant} px, väntade 2`);
        // ⛔ EXAKT SOM FÖRUT (0.150.0): kantlådan under 640 px (0 px in), 2 px innanför padding-lådan från 640 (kanten är 1 px, så 3 px från kantlådan).
        const vantadIn = telefon ? 0 : 3;
        for (const [sida, v] of /** @type {const} */ ([["left", yttre.left - cell.left], ["top", yttre.top - cell.top], ["right", cell.right - yttre.right], ["bottom", cell.bottom - yttre.bottom]])) {
          krav(Math.abs(v - vantadIn) <= TOL, `${dn}: den yttre ramens ${sida} ligger ${v.toFixed(2)} px från rutans kant, väntade ${vantadIn} (som 0.150.0)`);
        }
      }
      if (yttre && inre) {
        tvaRamsDagar += 1;
        krav(inre.position === "absolute", `${dn}: den inre ramen är inte absolut`);
        // Under 640 px är den inre ramens linje 1 px (en ruta är 41 px bred vid 320 och tre pixlar till åt siffran behövs), från 640 px 2 px som den yttre.
        const vantadInreKant = telefon ? 1 : 2;
        krav(inre.kant >= vantadInreKant - 0.01, `${dn}: den inre ramens kant är ${inre.kant} px, väntade minst ${vantadInreKant}`);
        krav(inre.farg !== yttre.farg, `${dn}: de två ramarna har samma färg (${inre.farg}), så de syns som en`);
        const luft = [["left", inre.left - yttre.left], ["top", inre.top - yttre.top], ["right", yttre.right - inre.right], ["bottom", yttre.bottom - inre.bottom]];
        for (const [sida, v] of /** @type {[string, number][]} */ (luft)) {
          // Den inre ligger inuti den yttre med den yttres kant (2 px) och minst en pixel luft.
          krav(v >= yttre.kant + 1 - TOL, `${dn}: den inre ramens ${sida} ligger bara ${v.toFixed(2)} px innanför den yttre, väntade minst ${yttre.kant + 1}`);
        }
        const [l, t, r, b] = luft.map(([, v]) => v);
        krav(Math.max(l, t, r, b) - Math.min(l, t, r, b) <= TOL, `${dn}: ramarna ligger olika långt isär på olika sidor (${luft.map(([, v]) => v.toFixed(2)).join(", ")})`);
      }
      if (innersta) {
        // Layoutlådorna (inte teckenrutor) innanför den innersta ramens kant: siffrans ruta och innehållet börjar där paddingen slutar.
        const k = innersta.kant;
        const inne = { left: innersta.left + k, right: innersta.right - k, top: innersta.top + k, bottom: innersta.bottom - k };
        const n = dag.nummer;
        const ut = [["vänster", inne.left - n.left], ["höger", n.right - inne.right], ["överkant", inne.top - n.top], ["underkant", n.bottom - inne.bottom]].filter(([, v]) => /** @type {number} */ (v) > TOL);
        krav(ut.length === 0, `${dn}: siffrans ruta går in under ramen åt ${ut.map(([sida, v]) => `${sida} (${/** @type {number} */ (v).toFixed(2)} px)`).join(", ")}`);
        for (const [i, e] of /** @type {any[]} */ (dag.innehall).entries()) {
          krav(e.left >= inne.left - TOL && e.right <= inne.right + TOL && e.top >= inne.top - TOL, `${dn}: märke ${i} (${e.left.toFixed(1)}-${e.right.toFixed(1)}) går in under ramen (innanför ${inne.left.toFixed(1)}-${inne.right.toFixed(1)})`);
        }
        for (const [i, br] of /** @type {any[]} */ (dag.brickor).entries()) {
          // Under 640 px sticker brickan ut över rutans hörn (z-3) och ska ligga ovanpå ramarna; från 640 px står den i siffrans rad, innanför ramen.
          if (telefon) krav(br.z > innersta.z && br.z > (yttre?.z ?? 0), `${dn}: brickan ${i} ligger inte ovanpå ramarna (z ${br.z} mot ${innersta.z})`);
          else krav(br.left >= inne.left - TOL && br.right <= inne.right + TOL && br.top >= inne.top - TOL, `${dn}: brickan ${i} går in under ramen (innanför ${inne.left.toFixed(1)}-${inne.right.toFixed(1)})`);
        }
        // ⛔ DET SOM SYNS: fotograferat med och utan ramar. Ringen ska skilja sig (ramarna syns), allt innehåll ska vara identiskt (ingen ram täcker något).
        const px = dag.pixlar;
        krav(Boolean(px), `${dn}: ingen pixeljämförelse gjordes`);
        if (px) {
          pixelDagar += 1;
          krav(px.ring >= (inre ? 40 : 20), `${dn}: bara ${px.ring} pixlar skiljer med och utan ramar, så ramarna syns inte (väntade minst ${inre ? 40 : 20})`);
          krav(px.nummer === 0, `${dn}: ${px.nummer} pixlar i siffrans ruta skiljer med och utan ramar, så en ram täcker siffran`);
          for (const [i, v] of /** @type {number[][]} */ ([px.innehall, px.brickor]).entries()) for (const [j, n2] of v.entries()) krav(n2 === 0, `${dn}: ${n2} pixlar i ${i === 0 ? "märke" : "bricka"} ${j} skiljer med och utan ramar, så en ram täcker det`);
        }
      }
    }
    rader.push(`${namn}: ${m.dagar.map((d) => `${String(/** @type {any} */ (d).dag).slice(8)}:${/** @type {any} */ (d).antalRamar}`).join(" ")}`);
  }
}
await browser.close();
stada();

console.log(rader.join("\n"));
const lagen = LAGEN.length;
krav(VYPORTAR.length >= 4 && rader.length === VYPORTAR.length * lagen, `golvet: ${rader.length} av ${VYPORTAR.length * lagen} mätningar av lägen och vyportar gjordes helt`);
if (!bevisa) krav(pixelDagar >= VYPORTAR.length * 4 * lagen, `golvet: bara ${pixelDagar} rutor jämfördes pixel för pixel, minst ${VYPORTAR.length * 4 * lagen} krävs.`);
if (!bevisa && LAGEN.includes("tva")) krav(tvaRamsDagar >= VYPORTAR.length * 3, `golvet: bara ${tvaRamsDagar} dagar med två ramar mättes, minst ${VYPORTAR.length * 3} krävs. Ett prov som inte ser två ramar är grönt av en tom anledning.`);
if (matningar < 75 * lagen && !bevisa) brott.push(`golvet: ${matningar} mätningar, minst ${75 * lagen} krävs.`);

if (bevisa) {
  if (brott.length === 0) {
    console.error("kalenderramar-matt --bevisa: provet blev GRÖNT för EN ram per dag (så som 0.150.0 ritade). Då mäter det inte att två ramar ritas.");
    process.exit(1);
  }
  console.log(`kalenderramar-matt --bevisa: rött som väntat för en ram per dag (${brott.length} brott, t.ex. ${brott[0]}).`);
  process.exit(0);
}
if (brott.length) {
  console.error(`kalenderramar-matt: ${brott.length} brott:\n  ${brott.join("\n  ")}`);
  process.exit(1);
}
console.log(`kalenderramar-matt: ${matningar} mätningar i ${VYPORTAR.join(", ")} px, ${tvaRamsDagar} dagar med två ramar, inga brott.`);
