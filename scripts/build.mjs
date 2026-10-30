#!/usr/bin/env node
/**
 * Bygger ramverkets publika paket: EN FIL PER KÄLLMODUL (0.156.0, cllp/ops-framework#465).
 *
 * ⛔ Varför ett byggsteg alls, när källkoden redan är ESM?
 *
 * Vite transformerar inte JSX inuti `node_modules`. Ett ramverk som skickar
 * rå `.jsx` tvingar därför varje konsument att lägga in en `optimizeDeps`-
 * inställning de inte förstår, och den dagen någon glömmer den blir felet ett
 * kryptiskt syntaxfel långt från orsaken. Vi bygger en gång här i stället.
 *
 * ⛔ Varför en fil per modul, och inte en enda bundle (som före 0.156.0)?
 *
 * En bundler delar kod på modulgränser. Före 0.156.0 var `dist/index.js` EN modul
 * på 2,4 MB, så allt en app importerade ur ramverket hamnade i appens startfil, också
 * det som bara en lat sida använder (Meddelanden, Biblioteket). Appen kunde inte dela
 * den, och startfilen växte med varje ramverksrelease (lifehub.app, granskningen av
 * PR 487: +2 008 byte gzip från 0.153.0 ensamt).
 *
 * Nu skriver bygget `dist/<samma sökväg som src>.js` för varje modul som `src/index.js`
 * når, och `dist/index.js` är bara listan över namn. `package.json` säger
 * `sideEffects: ["*.css"]`, så bundlern släpper en modul som ingen i startfilen använder,
 * och en lat sida får sin del i sin egen bit. `import { X } from "ops-framework"` är
 * oförändrat. `check:delbarhet` mäter detta med Vite mot ett installerat paket.
 *
 * ⛔ Varje modul är en egen ingång, och importerna mellan dem är EXTERNA (omskrivna
 * `.jsx` till `.js`). Det är avsiktligt och inte `splitting: true`: med splitting lägger
 * esbuild kod som delas av flera ingångar i anonyma `chunk-<hash>.js`, och slår ihop alla
 * moduler som nås av samma uppsättning ingångar. Då är det esbuild och inte appens bundler som
 * bestämmer gränserna, och de gränserna går inte att läsa (mätt 2026-10-29: 286 ingångar gav
 * 286 hashade bitar till). Här är gränsen alltid en källfil.
 *
 * ⛔ React, react-dom och Radix är externa. Buntas React in får appen två
 * kopior av React, och då kastar varje hook "invalid hook call" utan att något
 * pekar mot orsaken.
 *
 * ⛔ `lucide-react` är externt av samma skäl, och för att README (avsnittet "Ikoner") alltid har sagt
 * att det är en peer dependency som appen och ramverket delar. Före 0.156.0 buntades det ändå in, så
 * appen bar två kopior av ikonkoden: sin egen och ramverkets. Med en fil per modul hade varje fil
 * dessutom fått en egen kopia av de ikoner den använder.
 *
 * Klassnamnssträngarna överlever bygget oförändrade, vilket är det Tailwinds
 * källscanning behöver. Därför pekar konsumentens `@source` på `dist`, som nu är en mapp.
 */

import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

/** Det konsumenten installerar själv. Buntas det in får appen två kopior (och React kastar "invalid hook call"). */
const EXTERNA = ["react", "react-dom", "react/jsx-runtime", "@radix-ui/*", "react-day-picker", "react-day-picker/*", "date-fns", "date-fns/*", "@date-fns/*", "lucide-react"];

const gemensamt = {
  bundle: true,
  format: "esm",
  jsx: "automatic",
  target: ["es2022"],
  platform: "browser",
  // Minifiering är AV med flit. Bundlen läses av människor när något ser fel
  // ut, och en minifierad primitiv är omöjlig att felsöka i en konsumentapp.
  minify: false,
  external: EXTERNA,
};

// 1. Vilka källmoduler når huvudingången? Samma graf som bundlern skulle följa, så att inget dött lastas med och inget levande saknas.
const graf = await build({ ...gemensamt, entryPoints: ["src/index.js"], write: false, metafile: true, outdir: "dist", logLevel: "silent" });
const moduler = Object.keys(graf.metafile.inputs)
  .filter((f) => f.startsWith("src/"))
  .sort();
const kod = moduler.filter((f) => /\.(jsx?|mjs)$/.test(f));
if (kod.length !== moduler.length) {
  throw new Error(`build: ${moduler.length - kod.length} moduler i grafen är inte JavaScript (${moduler.filter((f) => !kod.includes(f)).join(", ")}). Paketet skriver en fil per JavaScript-modul och vet inte vad det ska göra med dem.`);
}
// ⛔ GOLV: en graf som blev tom eller liten är ett bygge som tappat sin ingång, inte ett litet ramverk.
if (kod.length < 100) throw new Error(`build: bara ${kod.length} moduler nåddes från src/index.js. Ingången är trasig, eller importerna.`);

/**
 * Importer mellan moduler i paketet lämnas som importer (externa), med slutet `.js`. `b.resolve` kör pluginen igen,
 * därför markeringen i `pluginData`: utan den hänger bygget.
 * @type {import("esbuild").Plugin}
 */
const behallModuler = {
  name: "behall-moduler",
  setup(b) {
    b.onResolve({ filter: /^\.{1,2}(\/|$)/ }, async (args) => {
      if (args.kind === "entry-point" || args.pluginData?.behall) return null;
      const r = await b.resolve(args.path, { resolveDir: args.resolveDir, kind: args.kind, importer: args.importer, pluginData: { behall: true } });
      if (r.errors.length) return r;
      let rel = path.relative(path.dirname(args.importer), r.path).replace(/\\/g, "/").replace(/\.(jsx|mjs|js)$/, ".js");
      if (!rel.startsWith(".")) rel = `./${rel}`;
      return { path: rel, external: true };
    });
  },
};

// 2. Tomma dist först: en modul som tagits bort ur källan ska inte ligga kvar som en fil ingen import pekar på.
fs.rmSync("dist", { recursive: true, force: true });
await build({ ...gemensamt, entryPoints: kod, outdir: "dist", outbase: "src", sourcemap: true, plugins: [behallModuler], logLevel: "warning" });
console.log(`build: ${kod.length} moduler skrivna till dist/ (en fil per källmodul, dist/index.js är listan över namn).`);
