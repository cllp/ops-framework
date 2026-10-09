/**
 * Kalenderlager: vilka lager som syns, och vilken färg ett lager har (0.90.7).
 *
 * ══ ⛔ VAD ETT LAGER ÄR HÄR, MÄTT MOT SESSIONSTUDIO ═══════════════════════════
 *
 * I SessionStudio är ett kalenderlager ett personligt mönster (återkommande, datumintervall eller enstaka dagar) i
 * `users/{uid}/calendarLayers`, med egen färg, ikon och `enabled`. Andras delade lager är av tills personen slår på dem
 * på enheten (`peerCalLayers`, saknad nyckel är av). Prenumererade ICS-kalendrar är en annan sak: de syns tills personen
 * döljer dem (`subscribedCalendars`, saknad nyckel är på). Helgdagar finns inte som lager där.
 *
 * Ramverket kopierar inte mönstersamlingen. Appen har redan kalendrarna (gruppen, mina, externa). Ett lager här är en rad
 * appen skickar in, och det som sparas är vilka av dem personen har dolt. Samma betydelse som de prenumererade
 * kalendrarnas karta: saknad post betyder att lagret syns.
 *
 * ══ ⛔ FÄRGEN ÄR IDENTITETSPALETTENS SEX TONER, ALDRIG GRUPPENS TON ══════════
 *
 * `KALENDERFARGER` i `lib/kalendrar.js`: en kalender syns med namn och en av sex fasta toner. Gruppens kulör
 * (`--grupp-kulor`, `lib/gruppfarg.js`) hör till märket. Ett lager som ärvde den skulle byta färg när personen byter
 * grupp, och gruppens ton skulle se ut att höra till kalendern. Saknas en giltig ton räknas den ur lagrets id
 * (`identityTone`), aldrig ur namnet och aldrig ur gruppen.
 */

import { lasDoldaAppar } from "./calendar.js";
import { identityTone } from "./identity.js";

/** @typedef {{ id: string, namn?: string, farg?: number, sektion?: string, undertext?: string }} Kalenderlager */

/**
 * Nyckeln personens dolda lager sparas under. `minne` är appens val, vanligen personens id: ramverket känner inte
 * användaren och ska inte göra det. Samma person i två grupper delar valet, eftersom lagret är personens kalender.
 * @param {string} minne
 * @returns {string}
 */
export function lagerNyckel(minne) {
  return `ops-kalender-lager:${minne}`;
}

/**
 * Läser sparade dolda lager. En trasig eller saknad post ger tom lista, alltså allt synligt.
 *
 * ⛔ TOM LISTA OCH INTE ETT FEL VID TRASIG POST, samma skäl som `lasDoldaAppar`: värdet ligger i personens egen
 * webbläsare, och det värsta en trasig post kan göra är att visa allt. Att kasta hade gjort kalendern oanvändbar.
 *
 * @param {string | null | undefined} rad
 * @returns {string[]}
 */
export function lasDoldaLager(rad) {
  return lasDoldaAppar(rad);
}

/**
 * Nästa lista dolda id efter ett tryck på ett lager. Finns id:t tas det bort, annars läggs det till.
 * @param {readonly string[]} dolda
 * @param {string} id
 * @returns {string[]}
 */
export function vaxlaDoltLager(dolda, id) {
  return dolda.includes(id) ? dolda.filter((x) => x !== id) : [...dolda, id];
}

/**
 * Lagren som syns, i listans ordning. Ett id utan rad i listan påverkar ingenting: det ligger kvar i minnet så att
 * lagret förblir dolt om det kommer tillbaka.
 * @param {readonly Kalenderlager[] | null | undefined} lista
 * @param {readonly string[]} dolda
 * @returns {Kalenderlager[]}
 */
export function synligaLager(lista, dolda) {
  const dold = new Set(dolda);
  return (lista || []).filter((l) => l && typeof l.id === "string" && l.id.length > 0 && !dold.has(l.id));
}

/**
 * Lagrets ton, 1 till 6. En giltig `farg` vinner. Annat (saknad, 0, 7, en kulörsträng) räknas ur id.
 * @param {Kalenderlager | null | undefined} lager
 * @returns {1|2|3|4|5|6}
 */
export function lagerFarg(lager) {
  const f = lager && lager.farg;
  if (f === 1 || f === 2 || f === 3 || f === 4 || f === 5 || f === 6) return f;
  return identityTone(lager && lager.id ? lager.id : "");
}

/**
 * Lagren grupperade på `sektion`, i den ordning sektionerna dyker upp. En rad utan sektion hamnar i gruppen med tomt
 * namn. Rader utan id hoppas över.
 * @param {readonly Kalenderlager[] | null | undefined} lista
 * @returns {{ namn: string, lager: Kalenderlager[] }[]}
 */
export function lagerSektioner(lista) {
  /** @type {string[]} */
  const ordning = [];
  /** @type {Map<string, Kalenderlager[]>} */
  const map = new Map();
  for (const l of lista || []) {
    if (!l || typeof l.id !== "string" || l.id.length === 0) continue;
    const namn = typeof l.sektion === "string" ? l.sektion.trim() : "";
    if (!map.has(namn)) {
      map.set(namn, []);
      ordning.push(namn);
    }
    map.get(namn)?.push(l);
  }
  return ordning.map((namn) => ({ namn, lager: map.get(namn) || [] }));
}

/**
 * @typedef {object} LagerPlockare
 * @property {Kalenderlager[]} lista
 * @property {string} [minne]
 * @property {(ids: string[]) => void} [onSynliga]
 * @property {() => void} [onHantera]
 * @property {string} [tomText]
 */

/**
 * Sant när `lager` är plockaren (en lista) och inte brytaren `{ pa, onByt }` från 0.61.0.
 * @param {unknown} lager
 * @returns {lager is LagerPlockare}
 */
export function arLagerplockare(lager) {
  return !!lager && typeof lager === "object" && Array.isArray(/** @type {{ lista?: unknown }} */ (lager).lista);
}
