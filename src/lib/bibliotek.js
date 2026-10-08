/**
 * Gruppens bibliotek: en anteckning eller en länk.
 *
 * ══ ⛔ VARFÖR DET HÄR INTE ÄR SESSIONSTUDIOS ARTEFAKT (analys 0004, #192) ═
 *
 * SessionStudio samlar åtta typer i en samling och avgör vem som ser dem i
 * klienten, eftersom läsregeln är `allow read: if isAuth()` (ADR-020). Den
 * regeln föddes när en medlemsmedveten läsning inte gick att bevisa mot
 * Firestore. Ramverket har redan medlemskapet som ett uppslag, och en
 * bibliotekspost är gruppens: den som är medlem läser den, och ingen annan.
 *
 * De två typerna här är SessionStudios `note` och `link`, de två allmänna
 * typerna som inte behöver en fil. Låt, spellista, inspelning och rider är
 * musikappens modell och hör inte hemma i varje ops-app. Fil och bild väntar
 * tills lagringen är en sökväg appen namnger, av samma skäl som bilagorna i
 * chatten inte får följa med i listläsningen.
 *
 * ⛔ KATALOGEN ÄR INTE BIBLIOTEKET. Katalogen är gruppens konfiguration
 * (kategori, färg, fas) och skrivs av admin. En anteckning är ett dokument en
 * medlem lägger in. Samma samling för båda hade gett två betydelser åt ett
 * dokument.
 */

import { ID_FORM } from "./katalog.js";
import { SKAPARFALT, byggSkapare } from "./skapare.js";

/** De två typerna i skiva 1. Fler typer är ett eget beslut, se analys 0004. */
export const BIBLIOTEKTYPER = /** @type {const} */ (["anteckning", "lank"]);

/** Tak. Samma tal skrivs in i regelfragmentet, ur de här konstanterna. */
export const MAX_BIBLIOTEKRUBRIK = 200;
export const MAX_BIBLIOTEKTEXT = 8000;
export const MAX_BIBLIOTEKURL = 2000;

/**
 * Fälten en rad får bära. `id` är dokumentets nyckel och står inte här: en
 * kopia av nyckeln inne i dokumentet är en andra sanning.
 *
 * `text` hör till en anteckning och `url` till en länk. Regeln kräver att den
 * andra saknas, så en anteckning inte kan bära en adress vid sidan av texten.
 */
export const BIBLIOTEKFALT = /** @type {const} */ (["groupId", "typ", "rubrik", "text", "url", "skapadAv", "skapad", "andrad"]);

/**
 * En länks adress: http eller https, och sedan bara synliga ASCII-tecken.
 *
 * ⛔ EN SANNING FÖR ADRESSEN (regel 2, granskningen av #304). Regeln får samma
 * uttryck som `matches()` genom `regelRegex` i `regler.js`, och `postFel` prövar
 * mot det här. Förut prövade regeln `https?://.+` och klienten `new URL()`. Då
 * släppte regeln igenom `http://exa mple`, klienten avvisade raden, och hela
 * gruppens bibliotek blev ett läsfel som ingen kunde radera bort.
 *
 * `[!-~]` är tecknen från `!` till `~`: inget mellanslag, ingen tabb, ingen
 * radbrytning. Ett å i en adress skrivs med procentkod, och `normaliseraAdress`
 * gör det åt den som skriver.
 */
export const ADRESSFORM = /^https?:\/\/[!-~]+$/;

/**
 * Roller som får ändra någon annans post. Samma två som `opsArAdmin` i
 * `regelfragment()`, ägare eller admin.
 */
const FORVALTARROLLER = /** @type {const} */ (["agare", "admin"]);

/**
 * @typedef {object} Bibliotekspost
 * @property {string} groupId
 * @property {"anteckning"|"lank"} typ
 * @property {string} rubrik
 * @property {string} [text] Bara på en anteckning.
 * @property {string} [url] Bara på en länk.
 * @property {import("./skapare.js").Skapare} skapadAv
 * @property {number} skapad Millisekunder.
 * @property {number} andrad Millisekunder.
 */

/**
 * En sträng trimmad som Firestores `trim()` gör det, eller `""` för allt som
 * inte är en sträng.
 *
 * ⛔ TOMHET RÄKNAS SOM I REGELN (regel 2, granskningen av #304). Regeln prövar
 * `d.rubrik.trim().size() > 0`, och Firestores `trim()` tar bara bort tecknen
 * U+0000 till U+0020 i ändarna. JavaScripts `trim()` tar bort alla Unicode-
 * blanktecken (U+00A0, U+3000, U+2028, U+FEFF och fler) men inte U+001F. Med
 * JavaScripts trim släppte regeln in en rubrik av bara U+00A0, och modellen
 * sade "Rubriken saknas." om samma rad. Raden hamnade i `trasiga`, och i skiva 1
 * fick ingen radera, så den stod där för alltid. #311 låter författaren eller
 * admin ta bort en sådan rad. Trimmet står kvar: de två funktionerna räknar
 * fortfarande olika. Mätt mot emulatorn räknades 46
 * tecken olika: 27 kontrolltecken som regeln trimmar och JavaScript inte, och
 * 19 Unicode-blanktecken som JavaScript trimmar och regeln inte. Varje trim i modellen går därför
 * genom den här funktionen, också den som vyn använder.
 *
 * @param {unknown} v
 * @returns {string}
 */
export function trimSomRegeln(v) {
  if (typeof v !== "string") return "";
  let start = 0;
  let slut = v.length;
  while (start < slut && v.charCodeAt(start) <= 0x20) start += 1;
  while (slut > start && v.charCodeAt(slut - 1) <= 0x20) slut -= 1;
  return v.slice(start, slut);
}

const str = trimSomRegeln;

/**
 * Adressen som den sparas: trimmad, och med procentkod och gemener i schema och värdnamn när
 * den går att läsa som http eller https. Annars oförändrad, så att `ADRESSFORM`
 * får säga nej med sitt eget skäl.
 *
 * @param {unknown} v
 * @returns {string}
 */
export function normaliseraAdress(v) {
  const url = str(v);
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    // Går inte att läsa. ADRESSFORM avgör.
  }
  return url;
}

/**
 * Får den här personen ändra eller radera posten? Samma villkor som regelns
 * `update` och, sedan #311, som regelns `delete`: författaren, eller ägare
 * eller admin i gruppen.
 *
 * `jag` är den inloggades aktiva medlemskap i postens grupp, eller `null` när
 * det saknas. Utan medlemskap blir svaret nej, och vyn visar posten i läsläge.
 *
 * @param {{ groupId?: string, skapadAv?: { uid?: string | null } } | null | undefined} post
 * @param {{ uid?: string | null, roll?: string, groupId?: string } | null | undefined} jag
 * @returns {boolean}
 */
export function farAndra(post, jag) {
  if (!post || !jag || typeof jag.uid !== "string" || !jag.uid) return false;
  if (jag.groupId !== undefined && jag.groupId !== post.groupId) return false;
  if (post.skapadAv?.uid === jag.uid) return true;
  return /** @type {readonly string[]} */ (FORVALTARROLLER).includes(String(jag.roll ?? ""));
}

/**
 * Det formuläret kan ha fel på, utan grupp och utan författare.
 *
 * Vyn anropar den här. Källan anropar `postFel`, som lägger till resten.
 *
 * @param {Record<string, unknown>} d
 * @returns {string | null}
 */
export function inmatningsfel(d) {
  const typ = str(d.typ);
  if (!(/** @type {readonly string[]} */ (BIBLIOTEKTYPER).includes(typ))) {
    return `Biblioteket känner typen "${typ || "(tom)"}". Giltiga: ${BIBLIOTEKTYPER.join(", ")}.`;
  }
  const rubrik = str(d.rubrik);
  if (!rubrik) return "Rubriken saknas.";
  if (rubrik.length > MAX_BIBLIOTEKRUBRIK) return `Rubriken är ${rubrik.length} tecken. Taket är ${MAX_BIBLIOTEKRUBRIK}.`;

  if (typ === "anteckning") {
    if ("url" in d && d.url != null && str(d.url) !== "") return "En anteckning har text, och ingen adress.";
    const text = str(d.text);
    if (!text) return "Anteckningen saknar text.";
    if (text.length > MAX_BIBLIOTEKTEXT) return `Texten är ${text.length} tecken. Taket är ${MAX_BIBLIOTEKTEXT}.`;
    return null;
  }

  if ("text" in d && d.text != null && str(d.text) !== "") return "En länk har en adress, och ingen brödtext.";
  const url = str(d.url);
  if (!url) return "Länken saknar adress.";
  if (!/^https?:/.test(url)) return "Adressen ska börja med http eller https.";
  if (!ADRESSFORM.test(url)) return "Adressen går inte att läsa. Den ska börja med http:// eller https:// och sakna mellanslag.";
  if (url.length > MAX_BIBLIOTEKURL) return `Adressen är ${url.length} tecken. Taket är ${MAX_BIBLIOTEKURL}.`;
  return null;
}

/**
 * Hela dokumentet, eller skälet till att det inte får skrivas.
 *
 * @param {Record<string, unknown>} d
 * @returns {string | null}
 */
export function postFel(d) {
  if (!d || typeof d !== "object") return "Posten saknas.";
  const okanda = Object.keys(d).filter((k) => k !== "id" && !(/** @type {readonly string[]} */ (BIBLIOTEKFALT).includes(k)));
  if (okanda.length > 0) return `Fälten ${okanda.join(", ")} hör inte till en bibliotekspost.`;

  const yta = inmatningsfel(d);
  if (yta) return yta;

  const groupId = str(d.groupId);
  if (!ID_FORM.test(groupId)) return `Gruppen "${groupId}" är inte ett grupp-id.`;

  const skapadAv = byggSkapare(/** @type {any} */ (d.skapadAv && typeof d.skapadAv === "object" ? d.skapadAv : {}));
  if (!skapadAv.uid) return "Posten saknar vem som skrev den.";
  if (skapadAv.typ !== "manniska") return "En bibliotekspost skrivs av en medlem, och typen på skaparen är manniska.";
  const skaparnycklar = d.skapadAv && typeof d.skapadAv === "object" ? Object.keys(/** @type {object} */ (d.skapadAv)) : [];
  const extraSkapare = skaparnycklar.filter((k) => !(/** @type {readonly string[]} */ (SKAPARFALT).includes(k)));
  if (extraSkapare.length > 0) return `Skaparen har fälten ${extraSkapare.join(", ")}, och de hör inte dit.`;

  if (!Number.isInteger(d.skapad)) return "skapad ska vara ett heltal, millisekunder.";
  if (!Number.isInteger(d.andrad)) return "andrad ska vara ett heltal, millisekunder.";
  if (/** @type {number} */ (d.andrad) < /** @type {number} */ (d.skapad)) return "andrad ligger före skapad.";
  return null;
}

/**
 * Bygger raden som skrivs. Kastar med samma text som `postFel`.
 *
 * @param {Record<string, unknown>} d
 * @returns {Bibliotekspost}
 */
export function byggPost(d) {
  if (d && typeof d === "object" && str(d.typ) === "lank" && "url" in d) d = { ...d, url: normaliseraAdress(d.url) };
  const fel = postFel(d);
  if (fel) throw new Error(fel);
  const typ = /** @type {Bibliotekspost["typ"]} */ (str(d.typ));
  const skapadAv = byggSkapare(/** @type {any} */ (d.skapadAv));
  /** @type {Bibliotekspost} */
  const post = {
    groupId: str(d.groupId),
    typ,
    rubrik: str(d.rubrik),
    skapadAv,
    skapad: /** @type {number} */ (d.skapad),
    andrad: /** @type {number} */ (d.andrad),
  };
  if (typ === "anteckning") post.text = str(d.text);
  else post.url = str(d.url);
  return post;
}

/**
 * Listan efter flik och sök. Sökningen läser det som redan hämtats: en andra
 * samling för sökord hade varit en kopia av rubriken.
 *
 * @template {Bibliotekspost & { id?: string }} T
 * @param {readonly T[]} poster
 * @param {{ flik?: string, sok?: string }} [val]
 * @returns {T[]}
 */
export function filtreraBibliotek(poster, val = {}) {
  const flik = val.flik ?? "alla";
  if (flik !== "alla" && !(/** @type {readonly string[]} */ (BIBLIOTEKTYPER).includes(flik))) {
    throw new Error(`filtreraBibliotek: okänd flik "${flik}". Giltiga: alla, ${BIBLIOTEKTYPER.join(", ")}.`);
  }
  const sok = str(val.sok).toLowerCase();
  return [...poster]
    .filter((p) => (flik === "alla" ? true : p.typ === flik))
    .filter((p) => {
      if (!sok) return true;
      const hay = `${p.rubrik}\n${p.text ?? ""}\n${p.url ?? ""}`.toLowerCase();
      return hay.includes(sok);
    })
    .sort((a, b) => b.andrad - a.andrad || a.rubrik.localeCompare(b.rubrik, "sv"));
}
