/**
 * En kalenderposts färg som klasser: prick, vänsterkant och ton (0.37.0, utbruten ur `OpsCalendar`).
 *
 * ⛔ EN FIL FÖR FÄRGEN, SÅ ATT RUTAN, BANDEN, FILTRET OCH KORTEN LÄSER SAMMA SVAR. Före 0.37.0 låg tabellerna i
 * `OpsCalendar.jsx`; när dagsrutan blev en egen fil hade två kopior annars glidit isär.
 */
import { ARV_TON_KULOR, fargTillKulor, kulorStil } from "./gruppfarg.js";
import { identityTone } from "./identity.js";
import { slagKant, slagPrick } from "./slag.js";

/**
 * ══ ⛔ KALENDERNS FÄRG ÄR EN KULÖR (0.238.0, cllp/lifehub.app#882) ═══════════════════════════════════════════════════
 *
 * CP 2026-11-18: "Kan vi ha en colorpicker som vi använder överallt" och "Överallt där vi har color pocket". En kalender
 * väljer sedan 0.238.0 sin färg som grupperna gör, en kulör (`kulor:<grader>`, `lib/gruppfarg.js`), och ritas med märkets
 * ljushet och mättnad (`.ops-kulor-*` i tokens.css). Före 0.238.0 hade den en av identitetspalettens sex toner.
 *
 * ⛔ DE SEX TONERNA LÄSES VIDARE, INGET SKRIVS OM I DATABASEN. En kalender med `farg: 3` ritas med tonens kulör
 * (`ARV_TON_KULOR`, samma migrering på läsvägen som grupperna fick i 0.65.0), och sparas den utan att färgen ändras står `3`
 * kvar. Ett nytt val sparas som `kulor:<grader>`.
 *
 * ⛔ EN VÄG FÖR ALLA YTOR: pricken, kanten, tonen och ringen är klasserna nedan plus `kulorStil` (kulören som
 * `--grupp-kulor`). Klasserna står utskrivna, och ingen färg skrivs i `style`: variabeln är grader, inte en färg.
 */

/**
 * Kulören en kalenders sparade färg uttrycker, eller `null` när fältet inte är en känd form (då ritas accenten, som förut).
 * Tar emot både en äldre ton som tal (`3`, kalendrarnas lagring) och som text (`"3"`), och `kulor:<grader>`.
 * @param {unknown} farg
 * @returns {number | null}
 */
export function kalenderfargKulor(farg) {
  if (typeof farg === "number") return Number.isInteger(farg) ? fargTillKulor(String(farg)) : null;
  return typeof farg === "string" ? fargTillKulor(farg) : null;
}

/**
 * Kulören en kalender ritas med: den sparade, annars den som tonen ur `id` hade haft (samma reserv som `lagerFarg` gav).
 * @param {{ id?: string, farg?: unknown } | null | undefined} kalender
 * @returns {number}
 */
export function kalenderKulor(kalender) {
  return kalenderfargKulor(kalender?.farg) ?? ARV_TON_KULOR[identityTone(kalender?.id ?? "")];
}

/** Klasserna för en kalenders kulör. Kulören sätts med `kulorStil`. */
export const KULORKLASS = Object.freeze({ prick: "ops-kulor-prick", kant: "ops-kulor-kant", ton: "ops-kulor-ton", ring: "ops-kulor-ring", dagton: "ops-kulor-dagton" });

/** @type {Record<number, string>} */
const SLAGTON = { 1: "bg-slag-1/20", 2: "bg-slag-2/20", 3: "bg-slag-3/20" };

/** @type {Record<number, string>} */
const SLAGRING = { 1: "border-slag-1", 2: "border-slag-2", 3: "border-slag-3" };

/**
 * En posts färg som klasser: prick, vänsterkant och ton. Slaget om posten har ett, annars kalendern, annars accenten.
 *
 * `ring` (0.127.0) är SAMMA färg som en hel kant, för en preliminär post: en ihålig prick och ett streckat piller har ingen fyllning att bära färgen med,
 * så färgen sitter i kanten. Den väljs ur samma ordning som `prick`, så en preliminär post aldrig har en annan färg än en vanlig av samma slag.
 *
 * ⛔ SAMMA ORDNING PÅ ALLA YTOR, så att pricken, pillret, bandet och kortets kant aldrig säger olika saker om samma post.
 * ⛔ KLASSER OCH ALDRIG EN INLINE-FÄRG (`check-closed-api` punkt 3): en färg i `style` går förbi tokenkontraktet och
 * mörkt läge.
 *
 * `stil` (0.238.0) är kalenderns kulör som `--grupp-kulor`, och ska sättas på elementet med klassen eller på ett element
 * ovanför det. För slaget och accenten är den `undefined`.
 *
 * @param {import("./calendar.js").CalendarEntry} e
 * @returns {{ prick: string, kant: string, ton: string, ring: string, stil: import("react").CSSProperties | undefined }}
 */
export function postklasser(e) {
  const slagPrickKlass = slagPrick(e.slag, e.slagLabel, "OpsCalendar");
  if (slagPrickKlass) return { prick: slagPrickKlass, kant: /** @type {string} */ (slagKant(e.slag, e.slagLabel, "OpsCalendar")), ton: SLAGTON[/** @type {number} */ (e.slag)], ring: SLAGRING[/** @type {number} */ (e.slag)], stil: undefined };
  const kulor = e.kalender ? kalenderfargKulor(e.kalender.farg) : null;
  if (e.kalender && kulor !== null) {
    // ⛔ Kanten kräver ett ord, som `kantKlass` alltid har krävt: kalenderns namn.
    if (!e.kalender.namn) throw new Error("OpsCalendar: kalenderns färg kräver kalenderns namn. En färgad kant utan ord betyder ingenting för den som inte ser färgen.");
    return { prick: KULORKLASS.prick, kant: KULORKLASS.kant, ton: KULORKLASS.ton, ring: KULORKLASS.ring, stil: kulorStil(kulor) };
  }
  return { prick: "bg-accent", kant: "border-l-accent", ton: "bg-accent/20", ring: "border-accent", stil: undefined };
}

/**
 * Pricken i rutnätet och i snabbtitten: fylld i postens färg, och för en preliminär post IHÅLIG (0.127.0): bara en ring i samma färg. Mätt i en riktig
 * webbläsare (`check-skalyta`), eftersom en ring på 6 px är för liten för att avgöra i jsdom.
 *
 * ⛔ I EN VALD RUTA är fyllningen rutans textfärg (`bg-ink`, ytan är inverterad) och ringen likaså: postens egen färg syns inte mot den mörka ytan.
 *
 * @param {import("./calendar.js").CalendarEntry} e
 * @param {boolean} [vald] Pricken ligger i en vald ruta.
 * @returns {string}
 */
export function prickklass(e, vald = false) {
  if (e.preliminar === true) return vald ? "border border-ink bg-transparent" : `border bg-transparent ${postklasser(e).ring}`;
  return vald ? "bg-ink" : postklasser(e).prick;
}

/**
 * Prickens kulör (0.238.0): `postklasser(e).stil` utom i en vald ruta, där pricken är rutans textfärg och ingen kulör behövs.
 * @param {import("./calendar.js").CalendarEntry} e
 * @param {boolean} [vald]
 * @returns {import("react").CSSProperties | undefined}
 */
export function prickstil(e, vald = false) {
  return vald ? undefined : postklasser(e).stil;
}

/**
 * En kalenders prick ur dess sparade färg (0.238.0), för listor och väljare som visar kalendern bredvid sitt namn: kulörens prick, och accenten
 * när färgen saknas eller inte är en känd form (som `KALENDERPRICK[farg] || "bg-accent"` gjorde före 0.238.0).
 * @param {unknown} farg
 * @returns {{ klass: string, stil: import("react").CSSProperties | undefined, kulor: number | null }}
 */
export function fargprick(farg) {
  const kulor = kalenderfargKulor(farg);
  return kulor === null ? { klass: "bg-accent", stil: undefined, kulor } : { klass: KULORKLASS.prick, stil: kulorStil(kulor), kulor };
}
