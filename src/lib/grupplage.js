/**
 * Gruppläget: vilken grupp som är aktiv, och vad navet visar för den.
 *
 * ══ ⛔ DET FINNS ALLTID EXAKT EN AKTIV GRUPP (0.35.0, #190) ═════════════
 *
 * CP 2026-09-30: "Ja, frågan om alla grupper: Ta bort det." Läget "Alla mina
 * grupper" kostade i varje ny funktion: varje skapa-flöde behövde en
 * gruppväljare först, varje yta behövde lösa två lägen, och regeln för
 * läsning blev "aktiv grupp, utom när alla är valda". Mätt före beslutet:
 * cirka 365 rader i ramverket, använda i 11 filer i ramverket och 2 i appen.
 *
 * ⛔ OCH INGEN LÄSNING ÖVER FLERA GRUPPER ERSÄTTER LÄGET. Det motiverades med
 * en samlad vy av bolaget och det privata, och CP rättade premissen samma dag:
 * "Det är ingen privat grupp. Jag har en grupp som heter bolaget, men jag
 * måste ha privatekonomi där för att få en total översikt. Det är bara en
 * grupp. Ekonomimodulen bor där." Privat, Företag och Samlat är flikar över
 * data i EN grupp. Ingen konsument läser över flera grupper, mätt i
 * bolag-ops, så `grupperAttFraga`, `slaIhopSvar` och `listaPerGrupp` togs bort
 * med läget i stället för att bli en väg förbi regeln som ingen använder.
 *
 * ⛔ ETT SPARAT "alla" FRÅN EN TIDIGARE VERSION ÄR INTE ETT FEL. Det står i
 * `localStorage` hos varje användare som valde läget före 0.35.0, och det
 * blir den första av personens grupper (`aktivGrupp`). Ett kast hade låst ute
 * den som bara uppgraderade, och ett tomt läge hade gett en app utan data och
 * utan förklaring.
 *
 * ══ ⛔ VARFÖR BESLUTEN LIGGER HÄR OCH INTE I KOMPONENTERNA (#139) ══════
 *
 * Radix-komponenter går inte att driva med `fireEvent` i jsdom, så ett beslut
 * som bor i en popover är ett beslut inget prov kan mäta.
 */

import { text } from "./sprak.js";

/**
 * Nyckeln under vilken den aktiva gruppen sparas, per person.
 *
 * ⛔ PER UID OCH INTE PER WEBBLÄSARE. Två personer på samma dator ska inte ärva
 * varandras val, och det är en rad kod nu och en gåta sedan.
 *
 * ⛔ VARFÖR INTE I `users`-raden (#138): det valet är en egenskap hos ENHETEN,
 * inte hos personen. Språk och tema följer med till telefonen, medan "jag
 * tittar just nu i den här gruppen" inte gör det.
 *
 * @param {string} uid
 * @returns {string}
 */
export function grupplagetsNyckel(uid) {
  const u = typeof uid === "string" ? uid.trim() : "";
  if (!u) throw new Error("grupplagetsNyckel: uid krävs. Utan det delar alla på samma nyckel, och då är valet inte per person.");
  return `ops:aktivgrupp:${u}`;
}

/**
 * @typedef {object} Lagring
 * @property {(nyckel: string) => string | null} getItem
 * @property {(nyckel: string, varde: string) => void} setItem
 */

/**
 * Läser det sparade valet. `null` när ingenting är sparat.
 *
 * ⛔ DET SOM KOMMER TILLBAKA ÄR ETT TIPS, INTE DEN AKTIVA GRUPPEN. Det kan vara
 * en grupp vars medlemskap avslutats, eller strängen "alla" från en version
 * före 0.35.0. Skicka det genom `aktivGrupp` innan det används.
 *
 * ⛔ INGEN `try/catch` HÄR. `localStorage` kastar i privat läge, och en tyst
 * nedsläppsväg är arbetsreglernas punkt 5. Appen äger den hanteringen.
 *
 * @param {string} uid
 * @param {Lagring} lagring
 * @returns {string | null}
 */
export function lasAktivGrupp(uid, lagring) {
  return lagring.getItem(grupplagetsNyckel(uid));
}

/**
 * Sparar den aktiva gruppen.
 *
 * @param {string} uid
 * @param {string} groupId Ett grupp-id. Aldrig tomt.
 * @param {Lagring} lagring
 */
export function sparaAktivGrupp(uid, groupId, lagring) {
  const g = typeof groupId === "string" ? groupId.trim() : "";
  if (!g) {
    throw new Error("sparaAktivGrupp: groupId krävs. Det finns alltid exakt en aktiv grupp, och ett tomt värde vore en aktiv grupp som inte finns.");
  }
  lagring.setItem(grupplagetsNyckel(uid), g);
}

/**
 * Mina grupper: de jag har ett AKTIVT medlemskap i, och som inte är arkiverade.
 *
 * ⛔ MEDLEMSKAPEN STYR, INTE GRUPPLISTAN. En grupp jag kan läsa men inte är
 * medlem i ska inte stå i väljaren: den hade gett en tom vy och en fråga som
 * reglerna avvisar.
 *
 * ⛔ SORTERAD PÅ NAMNET, OCH ORDNINGEN BÄR ETT BESLUT. `aktivGrupp` väljer den
 * FÖRSTA när inget giltigt val finns, alltså är ordningen här svaret på vilken
 * grupp en ny användare, eller en som kommer från läget "alla", landar i.
 *
 * @param {ReadonlyArray<import("./grupp.js").Medlemskap>} medlemskap Mina.
 * @param {ReadonlyArray<import("./grupp.js").Grupp>} grupper
 * @param {string} [sprak] Språket namnen sorteras i.
 * @returns {import("./grupp.js").Grupp[]}
 */
export function minaGrupper(medlemskap, grupper, sprak) {
  const aktiva = new Set((medlemskap ?? []).filter((m) => m.status === "aktiv").map((m) => m.groupId));
  const mina = (grupper ?? []).filter((g) => aktiva.has(g.id) && !g.arkiverad);
  return [...mina].sort((a, b) => text(a.namn, sprak).localeCompare(text(b.namn, sprak), "sv"));
}

/**
 * Den aktiva gruppen, givet det sparade valet och mina grupper i dag.
 *
 * ⛔ ETT SPARAT VAL ÄR ETT TIPS OCH INTE ETT FAKTUM (arbetsreglernas punkt 3).
 * Medlemskapet kan ha avslutats, gruppen kan ha arkiverats, och strängen kan
 * vara "alla" från en version före 0.35.0. I alla tre fallen blir svaret den
 * FÖRSTA av mina grupper, aldrig ett fel och aldrig ett tomt läge.
 *
 * ⛔ `null` BETYDER EN SAK: PERSONEN HAR INGA GRUPPER. Det är det enda
 * tillståndet utan aktiv grupp, och det är ett svar och inte ett förval
 * (punkt 5). Appen visar då sin tomma vy (`OpsUtanMedlemskap`), inte en lista
 * med någon annans rader.
 *
 * @param {string | null | undefined} sparat Ur `lasAktivGrupp`.
 * @param {ReadonlyArray<import("./grupp.js").Grupp>} mina Ur `minaGrupper`.
 * @returns {string | null} Ett grupp-id ur `mina`, eller `null` när `mina` är tom.
 */
export function aktivGrupp(sparat, mina) {
  const lista = mina ?? [];
  const s = typeof sparat === "string" ? sparat.trim() : "";
  if (s && lista.some((g) => g.id === s)) return s;
  return lista.length > 0 ? lista[0].id : null;
}

/**
 * @typedef {object} Navlage
 * @property {import("./nav.js").NavPost[]} nav Det som ska ritas.
 * @property {string[]} saknade Modul-id gruppen pekar på som inte är installerade.
 */

/**
 * Navet för den aktiva gruppen: ramverkets ytor, plus gruppens moduler.
 *
 * ⛔ ORDNINGEN ÄR GRUPPENS, INTE MANIFESTLISTANS. `moduler` på gruppen är
 * skriven av en ägare och är därmed ett beslut.
 *
 * ⛔ `saknade` SKRIVS UT OCH SLÄNGS INTE (arbetsreglernas punkt 5). En grupp
 * som pekar på en modul appen inte installerat är en halv utrullning, och den
 * ser ut precis som en grupp med färre flikar.
 *
 * ⛔ UTAN AKTIV GRUPP (`null`, personen har inga grupper) VISAS BARA RAMVERKETS
 * YTOR. Det är inte längre ett läge utan det enda tillståndet utan grupp.
 *
 * @param {object} arg
 * @param {string | null} arg.groupId Den aktiva gruppen, ur `aktivGrupp`.
 * @param {ReadonlyArray<import("./nav.js").NavPost>} arg.ramnav Ytorna ramverket äger.
 * @param {ReadonlyArray<import("./modul.js").Modul>} arg.moduler Installerade.
 * @param {ReadonlyArray<import("./grupp.js").Grupp>} arg.mina
 * @returns {Navlage}
 */
export function navForGrupp({ groupId, ramnav, moduler, mina }) {
  const bas = [...(ramnav ?? [])];
  const grupp = (mina ?? []).find((g) => g.id === groupId);
  if (!grupp) return { nav: bas, saknade: [] };

  const installerade = new Map((moduler ?? []).map((m) => [m.id, m]));
  /** @type {import("./nav.js").NavPost[]} */
  const nav = bas;
  /** @type {string[]} */
  const saknade = [];
  for (const modulId of grupp.moduler) {
    const modul = installerade.get(modulId);
    if (!modul) {
      saknade.push(modulId);
      continue;
    }
    nav.push(...modul.nav);
  }
  return { nav, saknade };
}
