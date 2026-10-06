import { GRUPPIKONER, KATALOGNAMN, PROFILIKONER } from "./markeformer.js";

/**
 * Från ett sparat ikonvärde till ett namn i katalogen, utan React (0.70.0, lifehub.identity#27).
 *
 * ⛔ VARFÖR EN EGEN FIL. Kartorna stod i `gruppikoner.js`, som importerar React och lucide-react. En app utan React
 * (LifeHubs Identity) behövde dem för att rita och pröva samma märke, och fick då välja mellan att dra in React eller
 * skriva en kopia (regel 2). Här står de rent, och `gruppikoner.js` återexporterar dem.
 *
 * ⛔ IKONEN SPARAS SOM NAMN, ALDRIG SOM INDEX (#265). De äldre id:na nedan läses vidare och ritas med samma Lucide-ikon
 * som de alltid ritats med. Ingenting i databasen skrivs om.
 */

/** Gruppens tio äldre id (0.32.0, `GRUPPIKONER`) till Lucide-namnet de ritats med (`icons.jsx`). */
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

/**
 * Profilens sex äldre id (#164, `PROFILIKONER`) till Lucide-namnet de ritats med: `PersonIkon` är `User`, `LeendeIkon` är
 * `Smile` och så vidare (`icons.jsx`). ⛔ Provet `gruppmarke.test.jsx` ritar båda och kräver samma markup, så en karta som
 * pekar på fel ikon blir röd i stället för att byta ikon på varje person som valt den.
 */
export const ARV_PROFILIKON = /** @type {const} */ ({
  person: "user",
  stjarna: "star",
  hjarta: "heart",
  blixt: "zap",
  leende: "smile",
  krona: "crown",
});

for (const [arv, lista] of /** @type {const} */ ([
  [ARV_GRUPPIKON, GRUPPIKONER],
  [ARV_PROFILIKON, PROFILIKONER],
])) {
  if (Object.keys(arv).length !== lista.length || lista.some((i) => !(i in arv))) {
    throw new Error(`gruppikonarv.js: en arvskarta täcker inte exakt ${lista.join(", ")}. Ett äldre id utan mål är ett märke som tappar sin ikon.`);
  }
  for (const namn of Object.values(arv)) {
    if (!KATALOGNAMN.has(namn)) throw new Error(`gruppikonarv.js: arvskartan pekar på "${namn}", som inte finns i katalogen.`);
  }
}

/**
 * Katalognamnet ett sparat ikonvärde ritas som, eller tom sträng. Ett äldre grupp- eller profil-id ger sitt Lucide-namn.
 * @param {string | undefined | null} ikon
 * @returns {string}
 */
export function gruppikonNamn(ikon) {
  if (typeof ikon !== "string") return "";
  const n = Object.hasOwn(ARV_GRUPPIKON, ikon)
    ? ARV_GRUPPIKON[/** @type {keyof typeof ARV_GRUPPIKON} */ (ikon)]
    : Object.hasOwn(ARV_PROFILIKON, ikon)
      ? ARV_PROFILIKON[/** @type {keyof typeof ARV_PROFILIKON} */ (ikon)]
      : ikon;
  return KATALOGNAMN.has(n) ? n : "";
}
