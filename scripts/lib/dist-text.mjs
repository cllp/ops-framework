/**
 * Texten i ramverkets byggda paket, för vakter och montage som SKANNAR den (Tailwinds källscanning, `sentry`, en planterad ändring).
 *
 * ⛔ Före 0.155.0 var `dist` en enda fil, `dist/index.js`, och femton skript läste den med `fs.readFileSync(dist, "utf8")` och samma två
 * `replace`. Sedan 0.155.0 är det EN FIL PER KÄLLMODUL (`scripts/build.mjs`, cllp/ops-framework#465), och klassnamnen ligger i `dist/components/*.js`.
 * Ett skript som läser bara `dist/index.js` ser då en lista över namn och inget annat: Tailwind hittar inga klasser och vakten blir röd, eller
 * värre, grön av att ingenting fanns att hitta (arbetsreglernas punkt 4, "tomt underlag"). Läsningen har därför ETT hem (regel 2).
 *
 * Samma funktion läser en äldre byggd version (`--dist <annan>/dist/index.js`, till exempel 0.154.0:s enda fil): mappen bredvid är då bara den filen.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Alla `.js`-filer under mappen som `distIndex` ligger i (utom `types/`), sorterade så att ordningen är densamma varje gång.
 * @param {string} distIndex sökvägen till `dist/index.js`
 * @returns {string[]}
 */
export function distFiler(distIndex) {
  const mapp = path.dirname(distIndex);
  /** @type {string[]} */
  const ut = [];
  /** @param {string} d */
  const gaIgenom = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (d === mapp && e.name === "types") continue;
        gaIgenom(full);
      } else if (e.name.endsWith(".js")) ut.push(full);
    }
  };
  gaIgenom(mapp);
  // ⛔ GOLV: `dist/index.js` är alltid med. Pekar skriptet på en fil som inte ligger i sin mapp har det skannat något annat än det trodde.
  if (!ut.includes(path.resolve(distIndex)) && !ut.includes(distIndex)) throw new Error(`dist-text: ${distIndex} hittades inte bland filerna i ${mapp}.`);
  return ut;
}

/** Hela paketets kod som en text. */
export function distText(distIndex) {
  return distFiler(distIndex)
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
}

/** Samma text utan block- och radkommentarer, så att ett klassnamn som bara nämns i en kommentar inte räknas (Tailwinds scanning gör det annars). */
export function distUtanKommentarer(distIndex) {
  return distFiler(distIndex)
    .map((f) => fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " "))
    .join("\n");
}
