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
 * Kör:  node scripts/generate-gruppikoner.mjs                skriver om de två filerna
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
 * ⛔ `sun` SAKNAS MED FLIT: namnet är också en handskriven veckodag i `check-datumnamn`s ögon, och `sun-medium` är samma
 * motiv. Vakten har rätt i sak (ett handskrivet "sun" i källan går inte att skilja från en veckodag). ⛔ Namnen är Lucides egna (kebab-case), det är dem som sparas.
 */
export const URVAL = {
  musik: "music music-2 music-3 music-4 guitar piano mic mic-vocal headphones headset speaker radio disc disc-3 drum audio-lines audio-waveform volume-2 album list-music",
  manniskor: "users users-round user user-round contact handshake heart-handshake baby person-standing smile party-popper",
  platser: "briefcase building building-2 factory store warehouse landmark hotel house castle church school tent",
  kunskap: "book book-open library graduation-cap pencil pen-tool notebook-pen backpack lightbulb brain microscope flask-conical atom calculator ruler",
  natur: "trees tree-pine tree-deciduous leaf flower flower-2 sprout mountain mountain-snow moon cloud snowflake waves droplet flame",
  idrott: "dumbbell bike trophy medal volleyball footprints sailboat fish target goal",
  mat: "utensils chef-hat coffee cup-soda wine beer pizza cake apple carrot cookie sandwich",
  resor: "plane car bus train-front ship map map-pin compass globe earth luggage caravan",
  halsa: "stethoscope hospital pill activity heart-pulse cross syringe",
  pengar: "wallet banknote coins piggy-bank receipt credit-card chart-line chart-pie trending-up scale",
  teknik: "laptop monitor smartphone code terminal cpu server database wifi cloud-cog gamepad-2 joystick bot rocket",
  skapande: "camera film clapperboard palette brush paintbrush scissors shirt image video theater drama tv",
  djur: "dog cat bird rabbit paw-print bug fish-symbol",
  symboler:
    "star heart zap crown shield flag bell calendar clock gift sparkles anchor key lock wrench hammer hard-hat truck tractor package shopping-cart shopping-bag newspaper megaphone mail message-circle phone inbox folder file-text clipboard-list archive layers tag hash infinity sun-medium award gem diamond puzzle dice-5 crosshair",
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

  return {
    [path.join(rot, "src", "lib", "gruppikonkatalog.generated.js")]: data,
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
