#!/usr/bin/env node
/**
 * Montaget för det publika skalet (0.94.0, arbetsreglernas punkt 12): ramverkets skal bredvid sin förebild, tagen i en
 * riktig webbläsare mot byggda sidor och aldrig i jsdom.
 *
 * Tre montage, i 1440 och 390 px:
 *   1. SessionStudios startsida (förebilden, byggd ur dess egen källa) mot ramverkets skal med `examples/brand/sessionstudio.css`
 *      och SessionStudios egen text och egna bilder.
 *   2. SessionStudios "Så fungerar det" mot ramverkets innehållssida (hjälte och avsnitt).
 *   3. Ramverkets skal med SessionStudios brandfil mot samma skal med Life Hubs (`examples/brand/lifehub.css`).
 *
 * ⛔ FÖREBILDEN ÄR SESSIONSTUDIOS KÄLLA BYGGD LOKALT. Nätet nådde inte sessionstudio.se när montaget gjordes, så SS sidor
 * (`HomePage.jsx`, `HowItWorksPage.jsx`) paketeras med esbuild och Tailwind 4 ur `--ss` (SessionStudios `apps/web`). SS bygger
 * själv med Tailwind 3 och Plus Jakarta Sans som webbfont; här används Tailwind 4 och systemets sans, på båda sidor, så att
 * skillnaden mellan förebild och skal är skalets och inte typsnittets. Det står i jämförelsen.
 *
 * ⛔ BILDERNA ÄR INNEHÅLL OCH CHECKAS ALDRIG IN. De läses ur SessionStudios `public/` och loggan ur `--lifehub-logga`, och
 * skrivs bara till `--ut`.
 *
 * Kör:  npm run build && node scripts/montage-publik.mjs --ss <sessions-platform/apps/web> --lifehub-logga-pa-mork <png> --lifehub-logga-pa-ljus <png> --ut <katalog>
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { startaWebblasare } from "./lib/matVyport.mjs";
import { innehall, FIGUR_SVG } from "./lib/publik-innehall.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
/** @param {string} f */
const arg = (f) => {
  const i = argv.indexOf(f);
  if (i < 0 || !argv[i + 1]) {
    console.error(`montage-publik: ${f} krävs. Se filhuvudet.`);
    process.exit(1);
  }
  return path.resolve(argv[i + 1]);
};
const ssRot = arg("--ss");
const lhLoggaPaMork = arg("--lifehub-logga-pa-mork");
const lhLoggaPaLjus = arg("--lifehub-logga-pa-ljus");
const ut = arg("--ut");
const dist = path.join(rot, "dist", "index.js");
for (const f of [ssRot, lhLoggaPaMork, lhLoggaPaLjus, dist, path.join(ssRot, "src", "landingPages", "HomePage.jsx")]) {
  if (!fs.existsSync(f)) {
    console.error(`montage-publik: ${f} finns inte.`);
    process.exit(1);
  }
}
fs.mkdirSync(ut, { recursive: true });
const arbete = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-montage-"));
process.on("exit", () => fs.rmSync(arbete, { recursive: true, force: true }));
const slash = (/** @type {string} */ p) => p.replace(/\\/g, "/");

// ── SessionStudios sidor, byggda ur dess källa ───────────────────────────────────────────────────────────────────
const landing = path.join(ssRot, "src", "landingPages");
const ssEntry = path.join(arbete, "ss-entry.jsx");
fs.writeFileSync(
  ssEntry,
  `import { createRoot } from "react-dom/client";
import HomePage from "${slash(landing)}/HomePage.jsx";
import HowItWorksPage from "${slash(landing)}/HowItWorksPage.jsx";
const Sida = window.__ss === "hiw" ? HowItWorksPage : HomePage;
createRoot(document.getElementById("root")).render(<Sida />);
window.__redo = true;
`,
);
const stub = {
  name: "stub",
  setup(b) {
    b.onResolve({ filter: /utils\/preferredLanguage(\.js)?$/ }, () => ({ path: "stub-lang", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: 'export const detectPreferredLanguage = () => "sv"; export const persistPreferredLanguage = () => {};', loader: "js" }));
  },
};
const ssJs = await build({
  entryPoints: [ssEntry],
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  target: ["es2022"],
  loader: { ".js": "jsx", ".css": "empty" },
  nodePaths: [path.join(rot, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false", "import.meta.env.PROD": "true", "import.meta.env": "{}" },
  plugins: [stub],
  logLevel: "error",
});
const ssSkript = ssJs.outputFiles[0].text;
const ssCss = (
  await postcss([tailwind()]).process(
    `@import "tailwindcss" source(none);\n@source "${slash(landing)}";\n@source "${slash(ssEntry)}";\n@import "${slash(landing)}/landingPalette.css";\nbody{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}\nh1,h2,h3{letter-spacing:-0.01em}\n`,
    { from: path.join(arbete, "ss.css") },
  )
).css;

// ── Ramverkets sidor ─────────────────────────────────────────────────────────────────────────────────────────────
const fwEntry = path.join(arbete, "fw-entry.jsx");
fs.writeFileSync(fwEntry, fs.readFileSync(path.join(rot, "scripts", "lib", "publik-prov.jsx"), "utf8").replace("OPS_DIST", slash(dist)));
const fwJs = await build({ entryPoints: [fwEntry], bundle: true, write: false, format: "iife", jsx: "automatic", platform: "browser", target: ["es2022"], define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error" });
const fwSkript = fwJs.outputFiles[0].text;
const distSkannad = path.join(arbete, "dist-skannad.js");
fs.writeFileSync(distSkannad, fs.readFileSync(dist, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " "));
/** @param {string} brand */
async function fwCss(brand) {
  return (
    await postcss([tailwind()]).process(
      `@import "tailwindcss" source(none);\n@import "${slash(path.join(rot, "tokens", "tokens.css"))}";\n@import "${slash(brand)}";\n@source "${slash(distSkannad)}";\n@source "${slash(fwEntry)}";\n`,
      { from: path.join(arbete, "fw.css") },
    )
  ).css;
}
const cssSS = await fwCss(path.join(rot, "examples", "brand", "sessionstudio.css"));
const cssLH = await fwCss(path.join(rot, "examples", "brand", "lifehub.css"));

// ── SessionStudios innehåll → ramverkets props ───────────────────────────────────────────────────────────────────
// SS importerar utan filändelse (`../utils/responsiveImage`), vilket Node inte läser: paketera innehållet till en egen modul först.
const innehallEntry = path.join(arbete, "ss-innehall-entry.js");
fs.writeFileSync(
  innehallEntry,
  `export { HOMEPAGE_CONTENT } from "${slash(landing)}/content/homepage.js";\nexport { HOW_IT_WORKS_CONTENT } from "${slash(landing)}/content/howItWorks.js";\nexport { LANDING_NAV_CONTENT, LANDING_NAV_LINKS, LANDING_MOBILE_NAV_LINKS, LANDING_FOOTER_LINK_GROUPS } from "${slash(landing)}/content/landingNav.js";\n`,
);
const innehallUt = path.join(arbete, "ss-innehall.mjs");
await build({ entryPoints: [innehallEntry], bundle: true, outfile: innehallUt, format: "esm", platform: "node", logLevel: "error" });
const { HOMEPAGE_CONTENT, HOW_IT_WORKS_CONTENT, LANDING_NAV_CONTENT, LANDING_NAV_LINKS, LANDING_MOBILE_NAV_LINKS, LANDING_FOOTER_LINK_GROUPS } = await import(pathToFileURL(innehallUt).href);
const hem = HOMEPAGE_CONTENT.sv;
const nav = LANDING_NAV_CONTENT.sv;
/** @param {any} b */
const bildUr = (b) => (b ? { src: b.src, srcSet: b.srcSet, sizes: b.sizes, alt: b.alt, width: b.width, height: b.height } : undefined);
const SIDA_LOGGA = "/SessionStudio_logo_dark_noborder.png";

/** @param {any} b */
const blockAv = (b, i, ton = "ljus") => ({
  ton: ton === "variera" ? ["ljus", "accent", "mork", "ljus"][i % 4] : ton,
  bildSida: i % 2 === 0 ? "hoger" : "vanster",
  eyebrow: b.label,
  title: b.title,
  text: [b.body],
  handling: { href: b.ctaHref, label: b.cta },
  bild: bildUr(b.image),
});
const ssInnehall = {
  ...innehall(),
  logga: { src: SIDA_LOGGA, alt: "SessionStudio" },
  texter: { huvudnavigering: "Huvudnavigering", oppnaMeny: nav.menuOpen, stangMeny: nav.menuClose, mobilmeny: "Mobilmeny" },
  lankar: LANDING_NAV_LINKS.map((l) => ({ href: l.href, label: nav[l.key] })),
  mobilLankar: LANDING_MOBILE_NAV_LINKS.map((l) => ({ href: l.href, label: nav[l.key] })),
  sprak: { aktiv: "sv", val: [{ kod: "sv", label: "SV" }, { kod: "en", label: "EN" }], etikett: "Language" },
  loggaIn: { href: "/app", label: nav.login },
  kom: { href: "/app", label: nav.getStarted },
  hjalte: { eyebrow: hem.hero.eyebrow, title: hem.hero.title, ingress: hem.hero.subtitle, malgrupp: hem.hero.audience, bild: bildUr(hem.hero.image), primar: { href: hem.hero.primaryHref, label: hem.hero.primaryCta }, sekundar: { href: hem.hero.secondaryHref, label: hem.hero.secondaryCta } },
  block: hem.features.map((b, i) => blockAv(b, i)),
  uppmaning: { title: hem.cta.title, text: hem.cta.body, primar: { href: hem.cta.primaryHref, label: hem.cta.primary }, sekundar: { href: hem.cta.secondaryHref, label: hem.cta.secondary } },
  fot: {
    tagline: nav.footerTagline,
    malgrupp: nav.footerAudience,
    navEtikett: "Sidfot",
    copyright: nav.footerCopyright,
    grupper: LANDING_FOOTER_LINK_GROUPS.map((g) => ({ rubrik: g.titleSv, lankar: g.links.map((l) => ({ href: l.href, label: nav[l.key] })) })),
  },
  kort: (() => {
    const h = HOW_IT_WORKS_CONTENT.sv;
    const s = h.sections[0];
    const t = h.sections[1];
    return { eyebrow: h.hero.eyebrow, title: h.hero.title, ingress: h.hero.subtitle, avsnitt: { eyebrow: s.kicker, title: s.title, ingress: s.body.replace(/\*\*/g, ""), text: undefined }, avsnitt2: { eyebrow: t.kicker, title: t.title, ingress: t.body?.replace(/\*\*/g, ""), text: undefined } };
  })(),
};
/** Samma innehåll med tonerna varierade (ljus, accent, mörk, ljus): SessionStudios startsida använder bara den ljusa tonen, men `TONE_STYLES` har alla tre. */
const ssVariation = { ...ssInnehall, block: hem.features.map((b, i) => blockAv(b, i, "variera")) };
/** @param {string} f */
const dataUrl = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
const lhInnehall = {
  ...ssInnehall,
  logga: { paMork: dataUrl(lhLoggaPaMork), paLjus: dataUrl(lhLoggaPaLjus), alt: "Life Hub" },
  texter: { huvudnavigering: "Huvudnavigering", oppnaMeny: "Öppna meny", stangMeny: "Stäng meny", mobilmeny: "Mobilmeny" },
  lankar: [{ href: "/hubbar", label: "Hubbar" }, { href: "/moduler", label: "Moduler" }, { href: "/ai", label: "AI" }],
  mobilLankar: [{ href: "/hubbar", label: "Hubbar" }, { href: "/moduler", label: "Moduler" }, { href: "/ai", label: "AI" }, { href: "/om-oss", label: "Om oss" }],
  loggaIn: { href: "/", label: "Logga in" },
  kom: { href: "/", label: "Kom igång" },
  hjalte: { eyebrow: "One life / one hub", title: "Ett liv. En plats att styra det från.", ingress: "Ekonomi, försäkringar, hem och minnen på ett ställe, med AI som hjälper dig hålla ordning.", malgrupp: "För dig som vill ha överblick utan att bli kontorist.", bild: ssInnehall.hjalte.bild, primar: { href: "/", label: "Kom igång" }, sekundar: { href: "/moduler", label: "Se modulerna" } },
  block: [
    { ton: "ljus", bildSida: "hoger", eyebrow: "Överblick", title: "Allt du äger och ansvarar för, i samma vy", text: ["Inkomster, kostnader och försäkringar ligger bredvid varandra, med datum som du inte glömmer."], handling: { href: "/moduler", label: "Se modulerna" }, bild: ssInnehall.block[0].bild },
    { ton: "accent", bildSida: "vanster", eyebrow: "Hubbar", title: "En hubb per del av livet", text: ["Hemmet, bolaget och familjen får var sin hubb. Du byter med ett tryck."], handling: { href: "/hubbar", label: "Så funkar hubbar" }, figur: FIGUR_SVG },
    { ton: "mork", bildSida: "hoger", eyebrow: "AI", title: "En hjälpare som läser det du redan har", text: ["Fråga i vanlig text. Svaren bygger på dina egna uppgifter och visar varifrån de kommer."], handling: { href: "/ai", label: "Läs mer" }, figur: FIGUR_SVG },
  ],
  uppmaning: { title: "Redo att samla ihop det?", text: "Det första steget är gratis.", primar: { href: "/", label: "Kom igång" }, sekundar: { href: "/om-oss", label: "Läs mer" } },
  fot: { tagline: "One life / one hub", malgrupp: "Powered by AI", navEtikett: "Sidfot", copyright: "Life Hub", grupper: [{ rubrik: "Produkt", lankar: [{ href: "/moduler", label: "Moduler" }] }, { rubrik: "Bolaget", lankar: [{ href: "/om-oss", label: "Om oss" }] }] },
  kort: { eyebrow: "Om Life Hub", title: "Hur det fungerar", ingress: "Life Hub samlar det som annars ligger utspritt.", avsnitt: { eyebrow: "Innan du börjar", title: "Konto och inloggning", ingress: "Du loggar in en gång och når alla dina hubbar. Inloggningen delas med appen.", text: undefined }, avsnitt2: { eyebrow: "Dina hubbar", title: "En hubb per del av livet", ingress: "Hemmet, bolaget och familjen får var sin hubb.", text: undefined } },
};

// ── Rita och fota ────────────────────────────────────────────────────────────────────────────────────────────────
const MIME = /** @type {Record<string, string>} */ ({ ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" });
const { browser } = await startaWebblasare();
/**
 * @param {{ namn: string, html: string, bredd: number, klipp?: number }} v
 */
async function fota(v) {
  const context = await browser.newContext({ viewport: { width: v.bredd, height: 900 }, locale: "sv-SE" });
  try {
    const page = await context.newPage();
    const fel = /** @type {string[]} */ ([]);
    page.on("pageerror", (e) => fel.push(e.message));
    await page.route("http://montage.local/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: v.html });
      const fil = path.join(ssRot, "public", decodeURIComponent(url.pathname));
      if (fs.existsSync(fil) && fs.statSync(fil).isFile()) return route.fulfill({ contentType: MIME[path.extname(fil)] ?? "application/octet-stream", body: fs.readFileSync(fil) });
      return route.fulfill({ status: 404, body: "" });
    });
    await page.goto("http://montage.local/", { waitUntil: "networkidle" });
    await page.waitForFunction("window.__redo === true", null, { timeout: 8000 });
    if (fel.length) throw new Error(`${v.namn} kastade: ${fel[0]}`);
    // Bilder med loading="lazy" laddas först när de är nära: rulla igenom sidan så att allt är på plats i bilden.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      await Promise.race([Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))), new Promise((r) => setTimeout(r, 4000))]);
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    const fil = path.join(ut, `${v.namn}.png`);
    await page.screenshot({ path: fil, fullPage: true, clip: v.klipp ? { x: 0, y: 0, width: v.bredd, height: v.klipp } : undefined });
    return fil;
  } finally {
    await context.close();
  }
}
/** @param {string} css @param {string} skript @param {string} init */
const html = (css, skript, init) => `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${init}</script><script>${skript.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`;
const ssHtml = (/** @type {"home" | "hiw"} */ s) => html(ssCss, ssSkript, `window.__ss = ${JSON.stringify(s)};`);
const fwHtml = (/** @type {string} */ css, /** @type {any} */ inn, /** @type {"start" | "kort"} */ sida) => html(css, fwSkript, `window.__prov = ${JSON.stringify({ sida, innehall: inn }).replace(/</g, "\\u003c")};`);

const filer = /** @type {Record<string, string>} */ ({});
for (const bredd of [1440, 390]) {
  filer[`ss-start-${bredd}`] = await fota({ namn: `ss-start-${bredd}`, html: ssHtml("home"), bredd });
  filer[`fw-ss-start-${bredd}`] = await fota({ namn: `fw-ss-start-${bredd}`, html: fwHtml(cssSS, ssInnehall, "start"), bredd });
  filer[`fw-ss-variation-${bredd}`] = await fota({ namn: `fw-ss-variation-${bredd}`, html: fwHtml(cssSS, ssVariation, "start"), bredd });
  filer[`ss-hiw-${bredd}`] = await fota({ namn: `ss-hiw-${bredd}`, html: ssHtml("hiw"), bredd, klipp: bredd === 1440 ? 1500 : 1900 });
  filer[`fw-ss-kort-${bredd}`] = await fota({ namn: `fw-ss-kort-${bredd}`, html: fwHtml(cssSS, ssInnehall, "kort"), bredd, klipp: bredd === 1440 ? 1500 : 1900 });
  filer[`fw-lh-start-${bredd}`] = await fota({ namn: `fw-lh-start-${bredd}`, html: fwHtml(cssLH, lhInnehall, "start"), bredd });
  filer[`fw-lh-ljus-huvud-${bredd}`] = await fota({ namn: `fw-lh-ljus-huvud-${bredd}`, html: fwHtml(cssLH, { ...lhInnehall, huvudTon: "ljus" }, "kort"), bredd, klipp: bredd === 1440 ? 420 : 520 });
  filer[`fw-lh-mork-huvud-${bredd}`] = await fota({ namn: `fw-lh-mork-huvud-${bredd}`, html: fwHtml(cssLH, lhInnehall, "kort"), bredd, klipp: bredd === 1440 ? 420 : 520 });
  filer[`fw-lh-kort-${bredd}`] = await fota({ namn: `fw-lh-kort-${bredd}`, html: fwHtml(cssLH, lhInnehall, "kort"), bredd, klipp: bredd === 1440 ? 900 : 1100 });
}
await browser.close();
fs.writeFileSync(path.join(ut, "filer.json"), JSON.stringify(filer, null, 2));
console.log(`montage-publik: ${Object.keys(filer).length} bilder i ${ut}`);
