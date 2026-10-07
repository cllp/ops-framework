import { createElement } from "react";
import { GRUPPINITIALER_FORM } from "./markeformer.js";
import { gruppikonNamn } from "./gruppikonarv.js";
import { personmarke } from "./personmarke.js";
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
 *
 * ⛔ KARTORNA BOR I `gruppikonarv.js` SEDAN 0.70.0 (lifehub.identity#27), utan React, så att en app utan React ritar och
 * prövar samma märke. De återexporteras härifrån, och namnen i den publika ytan är oförändrade.
 */
export { ARV_GRUPPIKON, ARV_PROFILIKON, gruppikonNamn } from "./gruppikonarv.js";

if (Object.keys(GRUPPIKON_LUCIDE).length !== GRUPPIKONKATALOG.length) {
  throw new Error("gruppikoner.js: katalogens data och komponenter har olika antal ikoner. Kör node scripts/generate-gruppikoner.mjs.");
}

/** @type {Map<string, import("react").ComponentType<{ size?: number }>>} */
const OMSLAG = new Map();

/**
 * Komponenten för ett ikonnamn (ett Lucide-namn ur katalogen, eller ett äldre grupp- eller profil-id), med ramverkets streckvikt 1,5 och
 * `aria-hidden`, som `icons.jsx`. `null` när namnet inte är känt.
 * @param {string | undefined | null} namn
 * @returns {import("react").ComponentType<{ size?: number }> | null}
 */
export function gruppikonKomponent(namn) {
  const n = gruppikonNamn(namn);
  const Lucide = n && Object.hasOwn(GRUPPIKON_LUCIDE, n) ? GRUPPIKON_LUCIDE[n] : null;
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

/**
 * Det `OpsIdentity` behöver för en PERSONS märke (0.70.0, lifehub.identity#27): samma märke som gruppens, ikonen i
 * kulören på en tonad platta, eller initialerna. Bilden väger fortfarande tyngst: `OpsIdentity` ritar `imageUrl` först.
 *
 * @param {{ id?: string, namn?: string, epost?: string, ikon?: string, farg?: string } | null | undefined} person
 * @returns {{ kulor: number, icon?: import("react").ComponentType<{ size?: number }> }}
 */
export function personmarkeProps(person) {
  const m = personmarke(person);
  /** @type {{ kulor: number, icon?: import("react").ComponentType<{ size?: number }> }} */
  const ut = { kulor: m.kulor };
  const Ikon = gruppikonKomponent(m.ikon);
  if (Ikon) ut.icon = Ikon;
  return ut;
}
