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

/** @param {unknown} v @returns {string} */
const str = (v) => (typeof v === "string" ? v.trim() : "");

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
    const text = typeof d.text === "string" ? d.text.trim() : "";
    if (!text) return "Anteckningen saknar text.";
    if (text.length > MAX_BIBLIOTEKTEXT) return `Texten är ${text.length} tecken. Taket är ${MAX_BIBLIOTEKTEXT}.`;
    return null;
  }

  if ("text" in d && d.text != null && str(d.text) !== "") return "En länk har en adress, och ingen brödtext.";
  const url = str(d.url);
  if (!url) return "Länken saknar adress.";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "Adressen går inte att läsa.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Adressen ska börja med http eller https.";
  }
  if (parsed.href.length > MAX_BIBLIOTEKURL) return `Adressen är ${parsed.href.length} tecken. Taket är ${MAX_BIBLIOTEKURL}.`;
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

  if (typeof d.skapad !== "number" || !Number.isFinite(d.skapad)) return "skapad ska vara ett tal, millisekunder.";
  if (typeof d.andrad !== "number" || !Number.isFinite(d.andrad)) return "andrad ska vara ett tal, millisekunder.";
  if (d.andrad < d.skapad) return "andrad ligger före skapad.";
  return null;
}

/**
 * Bygger raden som skrivs. Kastar med samma text som `postFel`.
 *
 * @param {Record<string, unknown>} d
 * @returns {Bibliotekspost}
 */
export function byggPost(d) {
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
  else post.url = new URL(str(d.url)).href;
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
