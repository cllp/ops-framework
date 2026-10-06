import { createElement } from "react";
import { GRUPPIKONER, GRUPPINITIALER_FORM } from "./grupp.js";
import { GRUPPIKONKATALOG } from "./gruppikonkatalog.generated.js";
import { gruppKulor } from "./gruppfarg.js";
import { GRUPPIKON_LUCIDE } from "../components/gruppikonkatalog.generated.jsx";

/**
 * Från ett sparat ikonnamn till komponenten som ritar det, och från en grupprad till det `OpsIdentity` behöver för att
 * rita märket (0.32.0, #180; ikonkatalog och kulör 0.65.0, #265).
 *
 * ⛔ EN KARTA FÖR ALLA. `OpsGruppanel`, `OpsGruppSida` och `OpsGruppFormular` ritar SAMMA märke ur SAMMA karta i
 * stället för att var och en gissa vad ett namn betyder.
 *
 * ⛔ IKONEN SPARAS SOM NAMN, ALDRIG SOM INDEX (#265). Ett index byter betydelse den dag katalogen växer, och då byter
 * varje befintlig grupp ikon utan att någon rört den. Namnen är Lucides egna (`music`, `building-2`).
 *
 * ⛔ DE TIO ÄLDRE ID:NA LÄSES VIDARE (`GRUPPIKONER`, 0.32.0: `grupp`, `hus` ...). De pekar på samma Lucide-ikon som de
 * alltid ritats med (`icons.jsx`: `GruppIkon` är `Users`, `HusIkon` är `Home`, alias för `House`), så en befintlig
 * grupp ser likadan ut. Formuläret skriver aldrig ett äldre id: väljs ikonen igen sparas Lucide-namnet.
 */
export const ARV_GRUPPIKON = /** @type {const} */ ({
  grupp: "users",
  portfolj: "briefcase",
  byggnad: "building-2",
  hus: "house",
  bok: "book-open",
  jordglob: "globe",
  stjarna: "star",
  hjarta: "heart",
  blixt: "zap",
  krona: "crown",
});

if (Object.keys(ARV_GRUPPIKON).length !== GRUPPIKONER.length || GRUPPIKONER.some((i) => !(i in ARV_GRUPPIKON))) {
  throw new Error("gruppikoner.js: ARV_GRUPPIKON täcker inte exakt GRUPPIKONER (grupp.js). Ett äldre id utan mål är en grupp som tappar sin ikon.");
}
for (const namn of Object.values(ARV_GRUPPIKON)) {
  if (!(namn in GRUPPIKON_LUCIDE)) throw new Error(`gruppikoner.js: ARV_GRUPPIKON pekar på "${namn}", som inte finns i katalogen.`);
}
if (Object.keys(GRUPPIKON_LUCIDE).length !== GRUPPIKONKATALOG.length) {
  throw new Error("gruppikoner.js: katalogens data och komponenter har olika antal ikoner. Kör node scripts/generate-gruppikoner.mjs.");
}

/** @type {Map<string, import("react").ComponentType<{ size?: number }>>} */
const OMSLAG = new Map();

/**
 * Komponenten för ett ikonnamn (ett Lucide-namn ur katalogen eller ett äldre id), med ramverkets streckvikt 1,5 och
 * `aria-hidden`, som `icons.jsx`. `null` när namnet inte är känt.
 * @param {string | undefined | null} namn
 * @returns {import("react").ComponentType<{ size?: number }> | null}
 */
export function gruppikonKomponent(namn) {
  const n = typeof namn === "string" ? (ARV_GRUPPIKON[/** @type {keyof typeof ARV_GRUPPIKON} */ (namn)] ?? namn) : "";
  const Lucide = Object.hasOwn(GRUPPIKON_LUCIDE, n) ? GRUPPIKON_LUCIDE[n] : null;
  if (!Lucide) return null;
  let omslag = OMSLAG.get(n);
  if (!omslag) {
    /** @param {{ size?: number }} p */
    omslag = ({ size = 20 }) => createElement(Lucide, { size, strokeWidth: 1.5, "aria-hidden": "true" });
    omslag.displayName = `Gruppikon(${n})`;
    OMSLAG.set(n, omslag);
  }
  return omslag;
}

/** Lucide-namnet ett sparat ikonvärde ritas som, eller tom sträng. Ett äldre id ger sitt Lucide-namn. @param {string} ikon */
export function gruppikonNamn(ikon) {
  const n = ARV_GRUPPIKON[/** @type {keyof typeof ARV_GRUPPIKON} */ (ikon)] ?? ikon;
  return Object.hasOwn(GRUPPIKON_LUCIDE, n) ? n : "";
}

/**
 * Det `OpsIdentity` behöver för en grupps märke: kulören (alltid, se `gruppKulor`), och en ikon eller initialer om gruppen
 * valt något av dem.
 *
 * ⛔ ETT FÄLT SOM INTE KÄNNS IGEN RITAS SOM OM DET INTE FANNS, det kastar inte. Läsvägen får inte ta ned en vy för att
 * en rad skrevs av en nyare version: märket faller tillbaka på initialer och på kulören ur `id`, och `byggGrupp` är den
 * som avvisar ett okänt värde när något SKRIVS.
 *
 * @param {{ id?: string, farg?: string, ikon?: string } | null | undefined} grupp
 * @param {string} [seed] Kulörens frö när gruppen saknar `id` (formulärets nya grupp).
 * @returns {{ kulor: number, icon?: import("react").ComponentType<{ size?: number }>, initialer?: string }}
 */
export function gruppmarkeProps(grupp, seed) {
  /** @type {{ kulor: number, icon?: import("react").ComponentType<{ size?: number }>, initialer?: string }} */
  const ut = { kulor: gruppKulor(grupp, seed) };
  const ikon = grupp?.ikon ?? "";
  const Ikon = gruppikonKomponent(ikon);
  if (Ikon) ut.icon = Ikon;
  else {
    const m = GRUPPINITIALER_FORM.exec(ikon);
    if (m) ut.initialer = m[1].toUpperCase();
  }
  return ut;
}
