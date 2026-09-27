/**
 * Gruppläget: vilken grupp jag tittar i, vilka som frågas, och vad navet visar.
 *
 * ══ ⛔ VARFÖR BESLUTEN LIGGER HÄR OCH INTE I KOMPONENTERNA (#139) ══════
 *
 * Fas 2.5 i epiken #92. Gruppväljaren, gruppfiltret och sammanslagningen är
 * tre ytor som ställer SAMMA fråga: vilka grupper gäller just nu. Ligger svaret
 * i tre komponenter finns tre svar, och den dag ett läge tillkommer flyttar
 * bara två av dem med (arbetsreglernas punkt 2).
 *
 * ⛔ OCH DET ÄR DAGENS LÄRDOM I PRAKTIKEN. Radix-komponenter går inte att driva
 * med `fireEvent` i jsdom, så ett beslut som bor i en popover är ett beslut
 * inget prov kan mäta. `andringen()` i #138 flyttades hit av det skälet, och
 * samma flytt görs här innan provet ens skrivs.
 *
 * ══ ⛔ SAMMANSLAGNING ÄR INTE DELNING ══════════════════════════════════
 *
 * En rad tillhör exakt en grupp, och det gäller fortfarande i läget "alla".
 * Ramverket frågar varje grupp för sig, en fråga per grupp, och lägger ihop
 * svaren. Ingen rad ändras och ingen regel ändras. Skillnaden mot
 * SessionStudios `invitedGroupIds` står i #136 och i `check-gruppnyckel`.
 *
 * ⛔ EN FRÅGA PER GRUPP, INGEN OPTIMERING. Det står utskrivet i #139: med en
 * handfull grupper märks det inte, och med femtio är det en annan produkt.
 */

import { applyQuery } from "../data/contract.js";
import { text } from "./sprak.js";

/**
 * Läget "alla mina grupper".
 *
 * ⛔ EN STRÄNG OCH INTE `null`. `null` betyder också "inget valt ännu" och
 * "kunde inte läsas", alltså tre tillstånd i ett värde. Ett utskrivet läge går
 * att jämföra, spara och skriva i ett felmeddelande.
 *
 * ⛔ OCH DEN KAN INTE KROCKA MED ETT GRUPP-ID. `ID_FORM` släpper igenom "alla"
 * som gruppnyckel, så en grupp med det id:t hade gjort läget tvetydigt.
 * `minaGrupper` kastar på just det, se noten där.
 */
export const ALLA_GRUPPER = "alla";

/**
 * Nyckeln under vilken den aktiva gruppen sparas, per person.
 *
 * ⛔ PER UID OCH INTE PER WEBBLÄSARE. Två personer på samma dator ska inte ärva
 * varandras val, och det är en rad kod nu och en gåta sedan.
 *
 * ⛔ VARFÖR INTE I `users`-raden (#138): det valet är en egenskap hos ENHETEN,
 * inte hos personen. Språk och tema följer med till telefonen, medan "jag
 * tittar just nu i den här gruppen" inte gör det. Sparas det i profilen byter
 * telefonen grupp för att datorn gjorde det.
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
 * Läser det sparade läget. `null` när ingenting är sparat.
 *
 * ⛔ INGEN `try/catch` HÄR. `localStorage` kastar i privat läge, och en tyst
 * nedsläppsväg är arbetsreglernas punkt 5: appen hade sett ut att ha glömt
 * valet i stället för att säga att den inte fick läsa. Appen äger den
 * hanteringen, eftersom bara den vet om den har en banderoll att visa i.
 *
 * @param {string} uid
 * @param {Lagring} lagring
 * @returns {string | null}
 */
export function lasAktivGrupp(uid, lagring) {
  return lagring.getItem(grupplagetsNyckel(uid));
}

/**
 * Sparar läget.
 *
 * @param {string} uid
 * @param {string} lage `ALLA_GRUPPER` eller ett grupp-id.
 * @param {Lagring} lagring
 */
export function sparaAktivGrupp(uid, lage, lagring) {
  const l = typeof lage === "string" ? lage.trim() : "";
  if (!l) throw new Error("sparaAktivGrupp: lage krävs. Spara ALLA_GRUPPER när ingen enskild grupp är vald: tomhet är inte ett svar.");
  lagring.setItem(grupplagetsNyckel(uid), l);
}

/**
 * Mina grupper: de jag har ett AKTIVT medlemskap i, och som inte är arkiverade.
 *
 * ⛔ MEDLEMSKAPEN STYR, INTE GRUPPLISTAN. En grupp jag kan läsa men inte är
 * medlem i ska inte stå i väljaren: den hade gett en tom vy och en fråga som
 * reglerna avvisar, alltså "Missing or insufficient permissions" i knäet på
 * någon som bara bytte flik.
 *
 * @param {ReadonlyArray<import("./grupp.js").Medlemskap>} medlemskap Mina.
 * @param {ReadonlyArray<import("./grupp.js").Grupp>} grupper
 * @param {string} [sprak] Språket namnen sorteras i.
 * @returns {import("./grupp.js").Grupp[]}
 */
export function minaGrupper(medlemskap, grupper, sprak) {
  const aktiva = new Set((medlemskap ?? []).filter((m) => m.status === "aktiv").map((m) => m.groupId));
  const mina = (grupper ?? []).filter((g) => aktiva.has(g.id) && !g.arkiverad);

  /*
   * ⛔ EN GRUPP SOM HETER "alla" GÖR LÄGET TVETYDIGT, och det märks först när
   * någon byter till den och ser allas rader. Formen tillåter id:t, alltså
   * måste läget avvisa det, och det ska ske där listan byggs och inte där den
   * ritas.
   */
  const krock = mina.find((g) => g.id === ALLA_GRUPPER);
  if (krock) {
    throw new Error(
      `minaGrupper: gruppen "${ALLA_GRUPPER}" krockar med värdet som betyder alla mina grupper. Byt id på gruppen: annars går det inte att se skillnad på att titta i den och att titta i allihop.`,
    );
  }

  return [...mina].sort((a, b) => text(a.namn, sprak).localeCompare(text(b.namn, sprak), "sv"));
}

/**
 * Vilket läge som faktiskt gäller, givet det sparade och mina grupper i dag.
 *
 * ⛔ ETT SPARAT LÄGE ÄR ETT TIPS OCH INTE ETT FAKTUM (arbetsreglernas punkt 3).
 * Medlemskapet kan ha avslutats, gruppen kan ha arkiverats, och den sparade
 * strängen vet ingenting om det. Faller den tillbaka till "alla" ser personen
 * sina egna grupper i stället för en tom vy utan förklaring.
 *
 * @param {string | null | undefined} sparat
 * @param {ReadonlyArray<import("./grupp.js").Grupp>} mina Ur `minaGrupper`.
 * @returns {string} `ALLA_GRUPPER` eller ett grupp-id ur `mina`.
 */
export function valtLage(sparat, mina) {
  const s = typeof sparat === "string" ? sparat.trim() : "";
  if (!s || s === ALLA_GRUPPER) return ALLA_GRUPPER;
  return (mina ?? []).some((g) => g.id === s) ? s : ALLA_GRUPPER;
}

/**
 * Grupperna som ska frågas, i ordning, efter att filtret kryssat bort sina.
 *
 * ⛔ FILTRET GÄLLER BARA I LÄGET "alla". I en vald grupp är filtret inte en
 * inskränkning utan ett sätt att få en tom vy utan att förstå varför, och den
 * som redan valt en grupp har sagt vad hen vill se.
 *
 * @param {object} arg
 * @param {string} arg.lage
 * @param {ReadonlyArray<import("./grupp.js").Grupp>} arg.mina
 * @param {ReadonlyArray<string>} [arg.bortkryssade] Grupp-id filtret tagit bort.
 * @returns {import("./grupp.js").Grupp[]}
 */
export function grupperAttFraga({ lage, mina, bortkryssade = [] }) {
  const alla = mina ?? [];
  if (lage !== ALLA_GRUPPER) {
    const vald = alla.find((g) => g.id === lage);
    /*
     * ⛔ TOM LISTA OCH INGET KAST. Läget kan hinna peka på en grupp vars
     * medlemskap just avslutats, och `valtLage` rättar det vid nästa
     * omritning. Ett kast däremellan hade gett vit sida av ett tillstånd som
     * varar en rendering.
     */
    return vald ? [vald] : [];
  }
  const bort = new Set(bortkryssade ?? []);
  return alla.filter((g) => !bort.has(g.id));
}

/**
 * @typedef {object} Navlage
 * @property {import("./nav.js").NavPost[]} nav Det som ska ritas.
 * @property {string[]} saknade Modul-id gruppen pekar på som inte är installerade.
 */

/**
 * Navet för läget: ramverkets ytor, plus den valda gruppens moduler.
 *
 * ⛔ I LÄGET "alla" VISAS BARA RAMVERKETS YTOR. En modulsida tillhör en grupp,
 * och en flik som leder till "vilken grupp menade du" är en flik som inte går
 * att trycka på. Det står i ärendet, och det är samma regel som att skapa
 * kräver en vald grupp.
 *
 * ⛔ ORDNINGEN ÄR GRUPPENS, INTE MANIFESTLISTANS. `moduler` på gruppen är
 * skriven av en ägare och är därmed ett beslut. Sorterar ramverket om den är
 * beslutet borta.
 *
 * ⛔ `saknade` SKRIVS UT OCH SLÄNGS INTE (arbetsreglernas punkt 5). En grupp
 * som pekar på en modul appen inte installerat är en halv utrullning, och den
 * ser ut precis som en grupp med färre flikar. Ett kast vore fel svar: då
 * ligger hela appen nere för den gruppen, utan väg tillbaka till en grupp som
 * fungerar. Precis som `KatalogLarm` i appen ska det synas, inte stoppa.
 *
 * @param {object} arg
 * @param {string} arg.lage
 * @param {ReadonlyArray<import("./nav.js").NavPost>} arg.ramnav Ytorna ramverket äger.
 * @param {ReadonlyArray<import("./modul.js").Modul>} arg.moduler Installerade.
 * @param {ReadonlyArray<import("./grupp.js").Grupp>} arg.mina
 * @returns {Navlage}
 */
export function navForLage({ lage, ramnav, moduler, mina }) {
  const bas = [...(ramnav ?? [])];

  /*
   * ⛔ INGEN EGEN GREN FÖR `ALLA_GRUPPER`, OCH DET ÄR ETT MUTATIONSFYND. Här
   * stod först ett tidigt `return` för läget alla. Svepet tog bort det och
   * ingenting blev rött: uppslaget nedan kan bara träffa en grupp som HETER
   * "alla", och `minaGrupper` kastar på just den. Grenen var alltså ett andra
   * uttryck för en regel som redan har ett hem, och en kontroll inget prov kan
   * skilja från sin frånvaro ska bort och inte få ett eget prov.
   */
  const grupp = (mina ?? []).find((g) => g.id === lage);
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

/**
 * Gruppen en ny rad ska hamna i, eller `null` när ingen är vald.
 *
 * ⛔ `null` ÄR SVARET OCH INTE ETT FEL. Att stå i läget "alla" är normalt, och
 * frågan "får jag skapa här" ställs varje gång en knapp ritas. Ett kast hade
 * gjort den frågan till ett undantagsflöde.
 *
 * @param {string} lage
 * @returns {string | null}
 */
export function gruppenAttSkapaI(lage) {
  return !lage || lage === ALLA_GRUPPER ? null : lage;
}

/**
 * Slår ihop svaren från flera grupper och märker varje rad med sin grupp.
 *
 * ⛔ ORDNINGEN FÅR INTE BERO PÅ VILKET SVAR SOM KOM FÖRST. Utan en sortering
 * ligger raderna i den ordning nätverket råkade svara, och listan hoppar mellan
 * två omritningar av samma data. Sorteringen är `applyQuery`, alltså samma
 * jämförelse som en enskild fråga använder, och inte en andra sorteringsregel
 * (arbetsreglernas punkt 2).
 *
 * @template {{ id: string }} T
 * @param {ReadonlyArray<{ grupp: import("./grupp.js").Grupp, rader: ReadonlyArray<T> }>} svar
 * @param {{ sortBy?: string, direction?: "asc" | "desc", limit?: number }} [ordning]
 * @returns {(T & { gruppmarke: { id: string, namn: import("./sprak.js").Namn } })[]}
 */
export function slaIhopSvar(svar, ordning) {
  /** @type {any[]} */
  const alla = [];
  for (const { grupp, rader } of svar ?? []) {
    for (const rad of rader ?? []) {
      /*
       * ⛔ ETT LAGRAT `gruppmarke` VORE EN VYFÄLT SOM SMITIT IN I DATAN, och
       * att skriva över det tyst hade gjort felet osynligt precis tills någon
       * undrar varför märket säger fel grupp.
       */
      if (Object.prototype.hasOwnProperty.call(rad, "gruppmarke")) {
        throw new Error(
          `slaIhopSvar: raden "${/** @type {any} */ (rad).id}" i gruppen "${grupp.id}" bär redan gruppmarke. Märket sätts av sammanslagningen och lagras aldrig: en sparad kopia kan peka på en annan grupp än raden gör.`,
        );
      }
      alla.push({ ...rad, gruppmarke: { id: grupp.id, namn: grupp.namn } });
    }
  }
  return applyQuery(alla, ordning);
}
