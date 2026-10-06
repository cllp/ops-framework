#!/usr/bin/env node
/**
 * Skriver gruppikonernas katalog: namnen och Lucides sökord för dem (#265).
 *
 * ══ ⛔ VARFÖR ETT URVAL OCH INTE HELA LUCIDE ═════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-06 (#265): "Music" ska ge not, hörlurar, högtalare, gitarr och skiva, inte bara ikonen som heter
 * music. Sökorden finns i Lucide (`tags.json` i `lucide-static`, samma version som `lucide-react`), men hela
 * uppsättningen är 1 539 ikoner och `tags.json` ensam 190 kB. Ramverkets `dist/index.js` buntar in de
 * lucide-ikoner det importerar (`scripts/build.mjs` har inte `lucide-react` som extern), så varje ikon i
 * väljaren är en ikon i varje apps bunt. Ett urval på ett par hundra ikoner som en GRUPP kan vara (musik,
 * arbete, idrott, familj, natur, mat, resor, pengar, teknik) ger sökningen det den behöver utan att paketet
 * bär hela biblioteket. Tillväxten mäts och står i CHANGELOG 0.65.0.
 *
 * ⛔ ETT IKONSET. Alla ikoner kommer ur `lucide-react`, samma version som resten av ramverket, och ritas med
 * samma streckvikt (1,5) som `icons.jsx`. `lucide-static` är bara källan till sökorden och är en devDependency:
 * den hamnar aldrig i paketet.
 *
 * ⛔ IKONEN SPARAS SOM NAMN. Katalogen är en lista namn med sökord, och ordningen här betyder ingenting för en
 * sparad grupp. Att lägga till eller ta bort en rad i URVAL ändrar aldrig vilken ikon en befintlig grupp har.
 * Att TA BORT en rad gör däremot en sparad grupp till en okänd ikon (märket faller tillbaka på initialer,
 * `gruppmarkeProps`), alltså tas rader bara bort med en migrering.
 *
 * ⛔ SVG-DATAN (0.70.0, lifehub.identity#27) ÄR EN TREDJE GENERERAD FIL, OCH DEN RENDERAS UR KOMPONENTERNA. En app utan
 * React (LifeHubs Identity) behöver rita samma ikon som gruppväljaren. Hade datan skrivits för hand, eller hämtats ur
 * `lucide-static/icons`, hade det varit två original som kan glida isär. I stället ritas varje `lucide-react`-komponent med
 * `react-dom/server` här, och det som står i `gruppikonsvg.generated.js` är exakt det komponenten ritar. Provet
 * `gruppmarke.test.jsx` jämför dessutom `gruppikonSvg(namn)` med komponentens markup för varje ikon, och `--kontrollera`
 * blir röd när datan ligger efter generatorn.
 *
 * Kör:  node scripts/generate-gruppikoner.mjs                skriver om de tre filerna
 *       node scripts/generate-gruppikoner.mjs --kontrollera   rött om filerna inte redan matchar
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

/**
 * Urvalet, grupperat bara för läsbarhetens skull.
 *
 * ⛔ INGA NÄSTAN-DUBBLETTER (granskningen av PR 266). music-2/3/4, disc-3, flower-2, fish-symbol, users-round, user-round,
 * building, tree-deciduous, mic-vocal, audio-waveform, headset, mountain-snow, brush och diamond ströks: varianter av ett
 * motiv som redan finns gör väljaren längre och paketet tyngre utan att någon sökning får ett nytt svar.
 *
 * ⛔ `sun` SAKNAS MED FLIT: namnet är också en handskriven veckodag i `check-datumnamn`s ögon, och `sun-medium` är samma
 * motiv. Vakten har rätt i sak (ett handskrivet "sun" i källan går inte att skilja från en veckodag). ⛔ Namnen är Lucides egna (kebab-case), det är dem som sparas.
 */
export const URVAL = {
  musik: "music guitar piano mic headphones speaker radio disc drum audio-lines volume-2 album list-music",
  manniskor: "users user contact handshake heart-handshake baby person-standing smile party-popper",
  platser: "briefcase building-2 factory store warehouse landmark hotel house castle church school tent",
  kunskap: "book book-open library graduation-cap pencil pen-tool notebook-pen backpack lightbulb brain microscope flask-conical atom calculator ruler",
  natur: "trees tree-pine leaf flower sprout mountain moon cloud snowflake waves droplet flame",
  idrott: "dumbbell bike trophy medal volleyball footprints sailboat fish target goal",
  mat: "utensils chef-hat coffee cup-soda wine beer pizza cake apple carrot cookie sandwich",
  resor: "plane car bus train-front ship map map-pin compass globe earth luggage caravan",
  halsa: "stethoscope hospital pill activity heart-pulse cross syringe",
  pengar: "wallet banknote coins piggy-bank receipt credit-card chart-line chart-pie trending-up scale",
  teknik: "laptop monitor smartphone code terminal cpu server database wifi cloud-cog gamepad-2 joystick bot rocket",
  skapande: "camera film clapperboard palette paintbrush scissors shirt image video theater drama tv",
  djur: "dog cat bird rabbit paw-print bug",
  symboler:
    "star heart zap crown shield flag bell calendar clock gift sparkles anchor key lock wrench hammer hard-hat truck tractor package shopping-cart shopping-bag newspaper megaphone mail message-circle phone inbox folder file-text clipboard-list archive layers tag hash infinity sun-medium award gem puzzle dice-5 crosshair",
};

/** @param {string} namn */
export function pascal(namn) {
  return namn
    .split("-")
    .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
    .join("");
}

function bygg() {
  const taggar = JSON.parse(fs.readFileSync(require.resolve("lucide-static/tags.json"), "utf8"));
  const statiskVersion = JSON.parse(fs.readFileSync(require.resolve("lucide-static/package.json"), "utf8")).version;
  const reactVersion = JSON.parse(fs.readFileSync(path.join(rot, "node_modules", "lucide-react", "package.json"), "utf8")).version;
  if (statiskVersion !== reactVersion) {
    throw new Error(
      `generate-gruppikoner: lucide-static ${statiskVersion} och lucide-react ${reactVersion} är olika versioner. Sökorden måste komma ur samma version som ikonerna, annars kan ett sökord peka på en ikon som ritas annorlunda eller inte finns.`,
    );
  }
  const lucide = require("lucide-react");
  const namn = [...new Set(Object.values(URVAL).join(" ").split(/\s+/).filter(Boolean))].sort();
  const fel = [];
  for (const n of namn) {
    if (!Array.isArray(taggar[n])) fel.push(`${n}: finns inte i tags.json`);
    if (!lucide[pascal(n)]) fel.push(`${n}: lucide-react saknar exporten ${pascal(n)}`);
  }
  if (fel.length > 0) throw new Error(`generate-gruppikoner: ${fel.length} fel i URVAL:\n  ${fel.join("\n  ")}`);

  const huvud = (fil) =>
    `// ⛔ GENERERAD AV scripts/generate-gruppikoner.mjs UR lucide-static ${statiskVersion}/tags.json. Ändra inte för hand: ändra URVAL där och kör om.\n// ${fil}\n`;

  const data =
    `${huvud("Gruppikonernas namn och Lucides sökord (#265). Ren data utan React, så att byggGrupp på nodsidan kan pröva ett namn.")}\n` +
    `/** Lucide-versionen sökorden lästes ur. */\nexport const GRUPPIKON_LUCIDEVERSION = ${JSON.stringify(statiskVersion)};\n\n` +
    `/** @type {ReadonlyArray<{ namn: string, taggar: ReadonlyArray<string> }>} */\nexport const GRUPPIKONKATALOG = Object.freeze([\n` +
    namn.map((n) => `  Object.freeze({ namn: ${JSON.stringify(n)}, taggar: Object.freeze(${JSON.stringify(taggar[n])}) }),`).join("\n") +
    `\n]);\n`;

  const jsx =
    `${huvud("Namnet till Lucide-komponenten. Bara gruppikonerna.js läser den här filen.")}\n` +
    `import { ${namn.map(pascal).join(", ")} } from "lucide-react";\n\n` +
    `/** @type {Readonly<Record<string, import("react").ComponentType<{ size?: number, strokeWidth?: number, "aria-hidden"?: "true" }>>>} */\n` +
    `export const GRUPPIKON_LUCIDE = Object.freeze({\n` +
    namn.map((n) => `  ${JSON.stringify(n)}: ${pascal(n)},`).join("\n") +
    `\n});\n`;

  /*
   * ⛔ BARA BARNEN SPARAS, INTE DET YTTRE <svg>. Storlek och streckvikt sätts av den som ritar (`gruppikonSvg`), precis som
   * komponentens props. Barnen är det enda som skiljer en ikon från en annan.
   */
  const { renderToStaticMarkup } = require("react-dom/server");
  const { createElement } = require("react");
  /** @type {Record<string, string>} */
  const svg = {};
  for (const n of namn) {
    const markup = renderToStaticMarkup(createElement(lucide[pascal(n)]));
    const m = /^<svg[^>]*>([\s\S]*)<\/svg>$/.exec(markup);
    if (!m || !m[1]) throw new Error(`generate-gruppikoner: ${n} ritades inte som ett <svg> med innehåll: ${markup.slice(0, 80)}`);
    svg[n] = m[1];
  }
  const svgfil =
    `${huvud("Ikonernas SVG-innehåll, ritat ur lucide-react med react-dom/server (0.70.0, lifehub.identity#27). Ren data utan React.")}\n` +
    `/** @type {Readonly<Record<string, string>>} */\nexport const GRUPPIKON_SVG = Object.freeze({\n` +
    namn.map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(svg[n])},`).join("\n") +
    `\n});\n`;

  return {
    [path.join(rot, "src", "lib", "gruppikonkatalog.generated.js")]: data,
    [path.join(rot, "src", "lib", "gruppikonsvg.generated.js")]: svgfil,
    [path.join(rot, "src", "components", "gruppikonkatalog.generated.jsx")]: jsx,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filer = bygg();
  const kontrollera = process.argv.includes("--kontrollera");
  let rott = 0;
  for (const [fil, innehall] of Object.entries(filer)) {
    const nu = fs.existsSync(fil) ? fs.readFileSync(fil, "utf8") : null;
    if (kontrollera) {
      if (nu !== innehall) {
        console.error(`✗ ${path.relative(rot, fil)} matchar inte generatorn. Kör: node scripts/generate-gruppikoner.mjs`);
        rott = 1;
      } else console.log(`✓ ${path.relative(rot, fil)} i takt med generatorn`);
    } else {
      fs.writeFileSync(fil, innehall);
      console.log(`skrev ${path.relative(rot, fil)}`);
    }
  }
  const antal = (filer[path.join(rot, "src", "lib", "gruppikonkatalog.generated.js")].match(/namn: /g) ?? []).length;
  console.log(`${antal} ikoner i katalogen`);
  process.exit(rott);
}
