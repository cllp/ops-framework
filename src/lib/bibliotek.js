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
 * Anteckning och länk är SessionStudios `note` och `link`. Låt, spellista och
 * rider är musikappens modell och hör inte hemma i varje ops-app. Filen är en
 * typ, "fil", och vyn styrs av MIME (CP 2026-10-08): bild, ljud eller dokument.
 * Sökvägen namnger appen. Ramverket lagrar den, det hittar inte på den.
 *
 * ⛔ KATALOGEN ÄR INTE BIBLIOTEKET. Katalogen är gruppens konfiguration
 * (kategori, färg, fas) och skrivs av admin. En anteckning är ett dokument en
 * medlem lägger in. Samma samling för båda hade gett två betydelser åt ett
 * dokument.
 */

import { ID_FORM } from "./katalog.js";
import { SKAPARFALT, byggSkapare } from "./skapare.js";

/** Anteckning, länk och fil. En fil är en post, och MIME avgör hur den visas. */
export const BIBLIOTEKTYPER = /** @type {const} */ (["anteckning", "lank", "fil"]);

/**
 * Flikar i vyn. `ljud` är härlett ur fil+MIME (0.92.0, lifehub.app#163), inte en
 * egen typ i dokumentet. Filer-fliken är då bild och dokument, utan ljud.
 */
export const BIBLIOTEKFLIKAR = /** @type {const} */ (["alla", "anteckning", "lank", "ljud", "fil"]);

/** Tak. Samma tal skrivs in i regelfragmentet, ur de här konstanterna. */
export const MAX_BIBLIOTEKRUBRIK = 200;
export const MAX_BIBLIOTEKTEXT = 8000;
export const MAX_BIBLIOTEKURL = 2000;
/** Upp till 25 MB, inklusive gränsen. Samma tal i storage-regeln. */
export const MAX_BIBLIOTEKFIL = 25 * 1024 * 1024;
/** Inspelning av en idé, i sekunder. TALK behåller sitt eget tak på 120. */
export const IDE_MAX_SEKUNDER = 10 * 60;
/** Utskrift på en ljudpost. Samma tal i regeln. */
export const MAX_BIBLIOTEKUTSKRIFT = 20000;
export const MAX_BIBLIOTEKFILNAMN = 200;
export const MAX_BIBLIOTEKSOKVAG = 1024;

/**
 * Format en fil får ha. Bild, ljud och dokument. En sort per fält hade varit
 * en andra typ, och CP valde en typ.
 */
export const FILMIME = /** @type {const} */ ([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "application/pdf",
  "text/plain",
]);

/** Fälten i `fil`. Samma lista i regelns `hasOnly`. */
export const FILFALT = /** @type {const} */ (["sokvag", "namn", "mime", "byte"]);

/**
 * `matches()`-uttrycket för MIME, härlett ur `FILMIME`. Regeln och storage-regeln
 * skriver in det här, så listan inte kan glida isär.
 * @returns {string}
 */
export function filMimeMonster() {
  return `^(${FILMIME.join("|")})$`;
}

/**
 * Rubriken på en ny idé: ordet Idé, datum och tid. Personen kan döpa om den.
 *
 * @param {Date} [nu]
 * @returns {string}
 */
export function ideRubrik(nu = new Date()) {
  const d = nu instanceof Date && !Number.isNaN(nu.getTime()) ? nu : new Date();
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `Idé ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Fälten en rad får bära. `id` är dokumentets nyckel och står inte här: en
 * kopia av nyckeln inne i dokumentet är en andra sanning.
 *
 * `text` hör till en anteckning och `url` till en länk. Regeln kräver att den
 * andra saknas, så en anteckning inte kan bära en adress vid sidan av texten.
 */
export const BIBLIOTEKFALT = /** @type {const} */ (["groupId", "typ", "rubrik", "text", "url", "fil", "utskrift", "skapadAv", "skapad", "andrad"]);

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
 * @property {"anteckning"|"lank"|"fil"} typ
 * @property {string} rubrik
 * @property {string} [text] Bara på en anteckning.
 * @property {string} [url] Bara på en länk.
 * @property {{ sokvag: string, namn: string, mime: string, byte: number }} [fil] Bara på en fil.
 * @property {string} [utskrift] Bara på ett ljud. Saknas fältet har ingen bett om en utskrift. Tom sträng är en utskrift utan ord.
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
 * MIME utan parametrar, i gemener. iPhone och Chromium säger `audio/mp4` eller
 * `audio/webm;codecs=opus`. Regeln känner den första formen.
 *
 * @param {unknown} v
 * @returns {string}
 */
export function normaliseraMime(v) {
  const raw = str(v).toLowerCase();
  const semikolon = raw.indexOf(";");
  return semikolon === -1 ? raw : raw.slice(0, semikolon);
}

/**
 * Hur vyn visar filen. Härlett ur MIME, lagras inte.
 *
 * @param {unknown} mime
 * @returns {"bild" | "ljud" | "dokument"}
 */
export function filSort(mime) {
  const m = normaliseraMime(mime);
  if (m.startsWith("image/")) return "bild";
  if (m.startsWith("audio/")) return "ljud";
  return "dokument";
}

/**
 * Är posten ett ljud? Härlett ur typ och MIME, lagras inte.
 *
 * @param {{ typ?: unknown, fil?: { mime?: unknown } } | null | undefined} post
 * @returns {boolean}
 */
export function arLjudpost(post) {
  return post?.typ === "fil" && filSort(post.fil?.mime) === "ljud";
}

/**
 * Det filväljaren kan ha fel på, innan sökvägen finns.
 *
 * @param {{ namn?: unknown, mime?: unknown, byte?: unknown }} fil
 * @returns {string | null}
 */
export function filInmatningsfel(fil) {
  const namn = str(fil?.namn);
  if (!namn) return "Filen saknar namn.";
  if (namn.length > MAX_BIBLIOTEKFILNAMN) return `Filnamnet är ${namn.length} tecken. Taket är ${MAX_BIBLIOTEKFILNAMN}.`;
  if (namn.includes("/") || namn.includes("\\") || namn === "." || namn === "..") return "Filnamnet innehåller ett snedstreck.";
  const mime = normaliseraMime(fil?.mime);
  if (!(/** @type {readonly string[]} */ (FILMIME).includes(mime))) {
    return `Formatet "${mime || "(tom)"}" går inte att lägga in. Giltiga: ${FILMIME.join(", ")}.`;
  }
  const byte = fil?.byte;
  if (!Number.isInteger(byte) || /** @type {number} */ (byte) < 1) return "Filen är tom.";
  if (/** @type {number} */ (byte) > MAX_BIBLIOTEKFIL) return `Filen är ${byte} byte. Taket är ${MAX_BIBLIOTEKFIL}.`;
  return null;
}

/**
 * Hela filobjektet, inklusive sökvägen appen gav.
 *
 * @param {unknown} fil
 * @returns {string | null}
 */
export function filFel(fil) {
  if (!fil || typeof fil !== "object") return "Filen saknas.";
  const okanda = Object.keys(/** @type {object} */ (fil)).filter((k) => !(/** @type {readonly string[]} */ (FILFALT).includes(k)));
  if (okanda.length > 0) return `Filen har fälten ${okanda.join(", ")}, och de hör inte dit.`;
  const yta = filInmatningsfel(/** @type {any} */ (fil));
  if (yta) return yta;
  const sokvag = str(/** @type {any} */ (fil).sokvag);
  if (!sokvag) return "Sökvägen saknas.";
  if (sokvag.length > MAX_BIBLIOTEKSOKVAG) return `Sökvägen är ${sokvag.length} tecken. Taket är ${MAX_BIBLIOTEKSOKVAG}.`;
  if (sokvag.startsWith("/") || sokvag.includes("\\") || sokvag.split("/").includes("..")) return "Sökvägen går inte att läsa.";
  return null;
}

/**
 * Utskriften på ett ljud, eller skälet till att den inte får sparas.
 *
 * @param {unknown} text
 * @param {{ mime?: unknown } | null | undefined} fil
 * @returns {string | null}
 */
export function utskriftFel(text, fil) {
  if (typeof text !== "string") return "Utskriften ska vara text.";
  if (text.length > MAX_BIBLIOTEKUTSKRIFT) return `Utskriften är ${text.length} tecken. Taket är ${MAX_BIBLIOTEKUTSKRIFT}.`;
  if (filSort(fil?.mime) !== "ljud") return "Bara ett ljud har en utskrift.";
  return null;
}

/**
 * Får den här personen ändra eller radera posten? Samma villkor som regelns
 * `update` och, sedan #311, som regelns `delete`: författaren, eller ägare
 * eller admin i gruppen. Båda kräver ett aktivt medlemskap (`opsArMedlem`).
 *
 * `jag` är den inloggades medlemskap i postens grupp, eller `null` när det
 * saknas. Utan medlemskap blir svaret nej, och vyn visar posten i läsläge.
 * Saknas `status` räknas medlemskapet som aktivt: anroparen skickar redan bara
 * aktiva rader, och de proven som byggdes före statusfältet här står kvar.
 * En status som inte är `aktiv`, till exempel en avslutad admin, är ett nej,
 * samma som regeln.
 *
 * @param {{ groupId?: string, skapadAv?: { uid?: string | null } } | null | undefined} post
 * @param {{ uid?: string | null, roll?: string, groupId?: string, status?: string } | null | undefined} jag
 * @returns {boolean}
 */
export function farAndra(post, jag) {
  if (!post || !jag || typeof jag.uid !== "string" || !jag.uid) return false;
  if (jag.status !== undefined && jag.status !== "aktiv") return false;
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
    if ("fil" in d && d.fil != null) return "En anteckning har text, och ingen fil.";
    if ("utskrift" in d && d.utskrift != null) return "En anteckning har text, och ingen utskrift.";
    const text = str(d.text);
    if (!text) return "Anteckningen saknar text.";
    if (text.length > MAX_BIBLIOTEKTEXT) return `Texten är ${text.length} tecken. Taket är ${MAX_BIBLIOTEKTEXT}.`;
    return null;
  }

  if (typ === "fil") {
    if ("text" in d && d.text != null && str(d.text) !== "") return "En fil har en fil, och ingen brödtext.";
    if ("url" in d && d.url != null && str(d.url) !== "") return "En fil har en fil, och ingen adress.";
    const filfel = filFel(d.fil);
    if (filfel) return filfel;
    if (!("utskrift" in d) || d.utskrift == null) return null;
    return utskriftFel(d.utskrift, /** @type {any} */ (d.fil));
  }

  if ("text" in d && d.text != null && str(d.text) !== "") return "En länk har en adress, och ingen brödtext.";
  if ("fil" in d && d.fil != null) return "En länk har en adress, och ingen fil.";
  if ("utskrift" in d && d.utskrift != null) return "En länk har en adress, och ingen utskrift.";
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
  if (d && typeof d === "object" && str(d.typ) === "fil" && d.fil && typeof d.fil === "object") {
    d = { ...d, fil: { .../** @type {object} */ (d.fil), mime: normaliseraMime(/** @type {any} */ (d.fil).mime) } };
  }
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
  else if (typ === "lank") post.url = str(d.url);
  else {
    const fil = /** @type {{ sokvag: unknown, namn: unknown, mime: unknown, byte: unknown }} */ (d.fil);
    post.fil = { sokvag: str(fil.sokvag), namn: str(fil.namn), mime: normaliseraMime(fil.mime), byte: /** @type {number} */ (fil.byte) };
    if ("utskrift" in d && d.utskrift != null) post.utskrift = /** @type {string} */ (d.utskrift);
  }
  return post;
}

/**
 * Listan efter flik och sök. Sökningen läser det som redan hämtats: en andra
 * samling för sökord hade varit en kopia av rubriken.
 *
 * ⛔ LJUD ÄR INTE EN TYP (0.92.0). Fliken `ljud` filtrerar `typ === "fil"` med
 * ljud-MIME. Fliken `fil` tar resten av filerna (bild och dokument), så samma
 * post inte syns under båda.
 *
 * @template {Bibliotekspost & { id?: string }} T
 * @param {readonly T[]} poster
 * @param {{ flik?: string, sok?: string }} [val]
 * @returns {T[]}
 */
export function filtreraBibliotek(poster, val = {}) {
  const flik = val.flik ?? "alla";
  if (!(/** @type {readonly string[]} */ (BIBLIOTEKFLIKAR).includes(flik))) {
    throw new Error(`filtreraBibliotek: okänd flik "${flik}". Giltiga: ${BIBLIOTEKFLIKAR.join(", ")}.`);
  }
  const sok = str(val.sok).toLowerCase();
  return [...poster]
    .filter((p) => {
      if (flik === "alla") return true;
      if (flik === "ljud") return arLjudpost(p);
      if (flik === "fil") return p.typ === "fil" && !arLjudpost(p);
      return p.typ === flik;
    })
    .filter((p) => {
      if (!sok) return true;
      const hay = `${p.rubrik}\n${p.text ?? ""}\n${p.url ?? ""}\n${p.fil?.namn ?? ""}`.toLowerCase();
      return hay.includes(sok);
    })
    .sort((a, b) => b.andrad - a.andrad || a.rubrik.localeCompare(b.rubrik, "sv"));
}
