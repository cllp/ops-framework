/**
 * Gäster: det som vyn, reglerna och servern delar om en person som bjudits in utan konto (0.131.0, cllp/lifehub.app#389, skiva 1).
 *
 * ══ ⛔ EN GÄST ÄR EN INBJUDAN, INTE ETT KONTO OCH INTE ETT MEDLEMSKAP (CP 2026-10-20) ═══════════════════════════════════════
 *
 * CP 2026-10-20: "Kör på alla 3, men sätt max 5 gäster." Beslutet var väg B i designförslaget (lifehub.app#389): appen får en egen gästväg vid sidan
 * av Identity. En gäst har ingen Auth-användare, ingen katalogpost, ingen Firebase-token och ingen rad i `memberships`. Det sista är det viktiga:
 * mätt i lifehub.app 7ffc669 provas ett aktivt medlemskap på 55 ställen i appens regler och 25 i ramverkets fragment, och 32 + 15 `status`-prov
 * på `aktiv` finns i functions och src. Hade en gäst varit en aktiv rad med `typ: "gast"` hade varje sådant prov släppt in hen, och varje
 * missat ställe hade varit ett hål (beslut 7 i epiken, skydd per funktion, hade blivit fail-open). Se `docs/beslut/0011`.
 *
 * Gästen når därför bara servern (`POST /api/gast`) och aldrig Firestore. Filen här är det rena: konstanter, former, texter och
 * `gastId`. Nyckeln, sessionen, platserna och tjänsten ligger i `src/node/gast.js` (`node:crypto` ska aldrig bundlas till en webbläsare).
 *
 * ══ ⛔ GÄSTENS IDENTITET ÄR HÄRLEDD, INTE LAGRAD (regel 2) ══════════════════════════════════════════════════════════════
 *
 * `gastId` är `g_` plus de 40 första tecknen av SHA-256 av den normaliserade adressen. En person med flera inbjudningar är en gäst. Rösten (appens
 * dokument) bär `gastId` som id i samma samling som medlemmarnas, och prefixet `g_` kan inte krocka med ett Firebase-uid (28 tecken, aldrig ett
 * understreck på andra plats). Att härleda det kräver en hash som fungerar i webbläsaren också (medlemmens vy ska kunna koppla en röst till en
 * inbjudan), så SHA-256 är skriven här i ren JS och provad mot `node:crypto` i `gast.test.js`. Hashen skyddar ingen hemlighet: adressen ser
 * medlemmarna ändå.
 */

import { epostFel } from "./mejl.js";

/** Så många gäster en grupp får gratis (CP 2026-10-20: "max 5 gäster"). Ett tal på ETT ställe: platsdokumenten, texten "X av 5" och taket härleds ur det. */
export const GAST_PLATSER_GRATIS = 5;

/** Vad en inbjudan gäller. Skiva 1 har bara `sak` (en omröstning). Skiva 2 lägger till `grupp` här och ingen annanstans. */
export const GASTSLAG = /** @type {const} */ (["sak"]);

/** Vad en gäst får göra med en sak. Skiva 1: rösta. Skyddet gäller per funktion, inte per post (epikens beslut 7). */
export const GASTFUNKTIONER = /** @type {const} */ (["rosta"]);

/** Hur länge länken i ett brev går att lösa in, i dagar räknat från senaste utskicket. Gäller bara länken, inte åtkomsten: en gäst som redan loggat in har en session. */
export const GASTLANKDAGAR = 30;

/** Hur länge en session lever efter sitt senaste anrop, i dagar. */
export const GASTSESSIONSDAGAR = 90;

/** Högsta antalet felaktiga försök att lösa in en inbjudan per fönster. Därefter svarar den `for-manga` även på rätt adress (som delningens `FELKOD_MAX`). */
export const GASTFEL_MAX = 5;

/** Fönstret för `GASTFEL_MAX`, i millisekunder. */
export const GASTFEL_FONSTER_MS = 15 * 60 * 1000;

/** Högsta antalet misslyckade försök att lösa in en inbjudan per IP och fönster, över alla inbjudningar. */
export const GASTIP_MAX = 30;

/** Fönstret för `GASTIP_MAX`, i millisekunder. */
export const GASTIP_FONSTER_MS = 15 * 60 * 1000;

/** Högsta antalet "skicka ny länk" per IP och fönster. */
export const GASTNYLANKIP_MAX = 10;

/** Fönstret för `GASTNYLANKIP_MAX`, i millisekunder. */
export const GASTNYLANKIP_FONSTER_MS = 60 * 60 * 1000;

/** Högsta antalet brev med nya länkar till samma adress och dygn (CP-förslaget i #389: tre). */
export const GASTNYLANK_BREV_PER_DYGN = 3;

/** Högsta antalet länkar (en per aktiv inbjudan) som ett enda brev med nya länkar bär. */
export const GASTNYLANK_MAX_LANKAR = 5;

/** Längsta namn en gäst eller den som bjuder får ge, i tecken. */
export const MAX_GASTNAMN = 80;

/** En nyckel (och en sessionsnyckel) är 32 slumpbyte i base64url utan utfyllnad: 43 tecken. Bara hashen lagras. */
export const GASTNYCKELFORM = /^[A-Za-z0-9_-]{43}$/;

/** Dokument-id:t för en inbjudan: SHA-256 i hex. */
export const GASTINBJUDNINGSIDFORM = /^[0-9a-f]{64}$/;

/** Gästens identitet: `g_` och 40 hextecken. */
export const GASTIDFORM = /^g_[0-9a-f]{40}$/;

/** Sökvägen gästsidan ritas på. Appen lägger sidan där före sin inloggningsgrind. */
export const GASTSOKVAG = "/gast";

/**
 * Fälten i en inbjudningspost. `id` är hashen av (grupp, adress, omfång) och är dokumentets id, inte ett fält.
 * `nyckelHash` är SHA-256 av nyckeln i brevet: nyckeln själv lagras aldrig.
 */
export const GASTFALT = /** @type {const} */ ([
  "groupId",
  "epost",
  "namn",
  "omfang",
  "skapadAv",
  "skapad",
  "skickad",
  "antalSkickade",
  "lankGiltigTill",
  "nyckelHash",
  "forstInloggad",
  "aterkallad",
  "felAntal",
  "felFonster",
]);

/**
 * Fälten på en gäst i medlemmens lista (`lista`). Inte `nyckelHash` och inte felräknarna: en lista som bär dem är ett svar som kan läcka mer än den visar.
 * `id` är med (för Skicka igen och Dra tillbaka), liksom `status`, som härleds (`gastStatus`) och inte lagras.
 */
export const GASTLISTFALT = /** @type {const} */ ([
  "id",
  "gastId",
  "epost",
  "namn",
  "omfang",
  "skapadAv",
  "skapad",
  "skickad",
  "antalSkickade",
  "forstInloggad",
  "aterkallad",
  "status",
]);

/**
 * Fälten i det svar en gäst får, och inget annat lämnar servern (`hamta`): inte gruppen, medlemmarna, andra gäster, adresser, chatten eller något av
 * appens fält som appen inte uttryckligen listat i `sak.falt`. En öppen lista, som `HANDELSESVARSFALT`: allt som skickas ut är något som kan läcka.
 */
export const GASTSVARSFALT = /** @type {const} */ (["ok", "namn", "funktion", "sak"]);

/**
 * Orsakerna till att en gäst inte släpps in, och inget annat.
 *
 * ⛔ `nej` ÄR ETT SVAR FÖR ALLT SOM SKULLE LÅTA EN OBEHÖRIG SKILJA FALL ÅT: okänt id, fel nyckel, fel adress, en sessionsnyckel som inte finns. Svaret är byte
 * för byte detsamma, annars går det att pröva sig fram till vilka inbjudningar som finns. `aterkallad` och `utgangen` ges först när nyckeln OCH adressen
 * stämde (eller sessionen fanns): då är det gästen själv, eller någon som har allt gästen har. `for-manga` är den enda orsaken som inte hör till inbjudan:
 * för många felaktiga försök. `saknas` är sakens egen: händelsen finns inte längre.
 */
export const GASTORSAKER = /** @type {const} */ (["nej", "aterkallad", "utgangen", "for-manga", "saknas"]);

/** @type {Record<"nej" | "aterkallad" | "utgangen" | "for-manga" | "saknas", string>} */
export const GASTFEL = {
  nej: "Länken eller adressen stämde inte",
  aterkallad: "Inbjudan är återkallad",
  utgangen: "Länken har gått ut",
  "for-manga": "För många försök. Vänta en stund och försök igen",
  saknas: "Det du bjöds in till finns inte längre",
};

/**
 * Felkoderna som tjänsten lägger på sina fel (`fel.kod`), för appens callable att översätta. Meddelandet är för loggen, koden är för klienten.
 * `platser-slut` är den som rutan svarar på med "Gruppen har 5 gäster".
 */
export const GASTFELKODER = /** @type {const} */ ([
  "ogiltig-epost",
  "ogiltigt-namn",
  "finns-inte",
  "ej-behorig",
  "platser-slut",
  "aterkallad",
  "brev-misslyckades",
]);

/**
 * Svaret när någon ber om en ny länk, hur det än gick. ⛔ ALLTID DETTA, byte för byte: ett annat svar för en adress som har en inbjudan hade låtit vem som
 * helst fråga vilka adresser som är gäster (samma tanke som Identitys `ATERSTALL_SVAR`).
 */
export const GASTNYLANK_SVAR = "Om adressen har en inbjudan har vi skickat en länk.";

/** @type {readonly string[]} */
const STATUSAR = ["aterkallad", "utgangen", "har-rostat", "inloggad", "vantar"];

/** Gästens lägen i listan, i den ordning de prövas. `har-rostat` är appens kunskap (`harRostat`), de andra ligger i raden. */
export const GASTSTATUSAR = /** @type {readonly ("aterkallad" | "utgangen" | "har-rostat" | "inloggad" | "vantar")[]} */ (STATUSAR);

// ── Adressen och identiteten ──────────────────────────────────────────────────────────────────────────────────────────

/** Längsta adress som godtas, i tecken (RFC 5321: 254). */
export const MAX_GASTEPOST = 254;

/**
 * Adressen som den jämförs och lagras: trimmad, NFC och gemener. `null` om den inte går att skicka till (`epostFel`: tom, fel form eller en spärrad domän),
 * är längre än `MAX_GASTEPOST` eller innehåller tecken som inte hör hemma i en adress (blanksteg, styrtecken). Samma funktion på servern och i vyn:
 * "samma adress" betyder samma sak överallt (regel 2).
 *
 * @param {unknown} epost
 * @param {readonly string[]} [extraSparrade] Appens egna spärrade domäner (`epostFel`).
 * @returns {string | null}
 */
export function normaliseraGastepost(epost, extraSparrade = []) {
  if (typeof epost !== "string") return null;
  const a = epost.normalize("NFC").trim().toLowerCase();
  if (a.length === 0 || a.length > MAX_GASTEPOST) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(a)) return null;
  return epostFel(a, extraSparrade) === null ? a : null;
}

/** SHA-256:s rundkonstanter: de 32 första bitarna av bråkdelarna av kubikrötterna ur de 64 första primtalen. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** @param {number} x @param {number} n */
const ror = (x, n) => (x >>> n) | (x << (32 - n));

/**
 * SHA-256 i hex av en text (UTF-8). Ren JS och synkron, så att samma funktion kan köras i webbläsaren och på servern.
 *
 * ⛔ EN HEMGJORD SHA-256 ÄR BARA OKEJ HÄR FÖR ATT HASHEN INTE SKYDDAR NÅGOT. `gastId` är ett namn på en adress som medlemmarna ändå ser. Alla nycklar, sessioner
 * och inbjudnings-id i `src/node/gast.js` hashas med `node:crypto`. `gast.test.js` kräver att den här ger exakt samma svar som `node:crypto` för 300 texter
 * (tom, ASCII, åäö, emoji, och längder runt blockgränserna 55, 56, 63 och 64 byte där utfyllnaden går fel först).
 *
 * @param {string} text
 * @returns {string}
 */
export function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  const l = bytes.length;
  const total = ((l + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[l] = 0x80;
  const vy = new DataView(buf.buffer);
  vy.setUint32(total - 8, Math.floor(l / 0x20000000));
  vy.setUint32(total - 4, (l << 3) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = vy.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = ror(w[t - 15], 7) ^ ror(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = ror(w[t - 2], 17) ^ ror(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}

/**
 * Gästens identitet ur adressen: `g_` och de 40 första tecknen av SHA-256 av den normaliserade adressen (`normaliseraGastepost`). Samma adress ger samma
 * gäst, oavsett hur många inbjudningar eller grupper adressen finns i. Kastar för något som inte är en adress, så att en felskriven rad aldrig blir en gäst.
 *
 * @param {string} epost
 * @returns {string}
 */
export function gastId(epost) {
  const a = normaliseraGastepost(epost);
  if (a === null) throw new Error("gastId: en gäst har en e-postadress. Det som skickades in är ingen adress som går att skicka till.");
  return `g_${sha256Hex(a).slice(0, 40)}`;
}

// ── Omfånget, platserna och länken ────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Gastomfang
 * @property {"sak"} slag
 * @property {"rosta"} funktion
 * @property {string} handelseId Händelsen som omröstningen hör till.
 */

/**
 * Omfånget som text: `sak:rosta:<handelseId>`. Det ingår i inbjudans id, så att samma adress till samma sak är en och samma rad. Kastar för ett omfång som
 * skiva 1 inte känner.
 *
 * @param {unknown} omfang
 * @returns {string}
 */
export function gastomfangsnyckel(omfang) {
  const o = /** @type {Record<string, unknown> | null} */ (omfang);
  if (!o || typeof o !== "object") throw new Error("gastomfangsnyckel: ett omfång krävs, { slag: 'sak', funktion: 'rosta', handelseId }.");
  if (!(/** @type {readonly unknown[]} */ (GASTSLAG).includes(o.slag))) throw new Error(`gastomfangsnyckel: slaget ${JSON.stringify(o.slag)} finns inte. Giltiga: ${GASTSLAG.join(", ")}.`);
  if (!(/** @type {readonly unknown[]} */ (GASTFUNKTIONER).includes(o.funktion))) {
    throw new Error(`gastomfangsnyckel: funktionen ${JSON.stringify(o.funktion)} finns inte. Giltiga: ${GASTFUNKTIONER.join(", ")}.`);
  }
  if (typeof o.handelseId !== "string" || o.handelseId.trim() === "") throw new Error("gastomfangsnyckel: handelseId krävs för en sak.");
  return `${o.slag}:${o.funktion}:${o.handelseId}`;
}

/** Platsnumren: 1 till `GAST_PLATSER_GRATIS`. Härledda ur taket, aldrig en egen lista. */
export const GASTPLATSNUMMER = Object.freeze(Array.from({ length: GAST_PLATSER_GRATIS }, (_, i) => i + 1));

/**
 * Dokument-id:t för en plats: `<grupp>|<nummer>`. Fem fasta dokument per grupp, och att ta en plats är att skapa ett av dem (`createNew`): taket är då en
 * egenskap hos nycklarna och inte en räkning som två samtidiga inbjudningar kan korsa. Avgränsaren är medlemskapets (ett grupp-id kan inte innehålla den).
 *
 * @param {string} groupId
 * @param {number} nummer
 * @returns {string}
 */
export function gastplatsId(groupId, nummer) {
  if (typeof groupId !== "string" || groupId === "" || groupId.includes("|") || groupId.includes("/")) {
    throw new Error("gastplatsId: groupId krävs, utan | och /.");
  }
  if (!GASTPLATSNUMMER.includes(nummer)) throw new Error(`gastplatsId: platsen ${String(nummer)} finns inte. Giltiga: 1 till ${GAST_PLATSER_GRATIS}.`);
  return `${groupId}|${nummer}`;
}

/**
 * Länken i brevet: appens basadress, `/gast` och ett FRAGMENT med id och nyckel (`#i=<id>&k=<nyckel>`).
 *
 * ⛔ NYCKELN LIGGER I FRAGMENTET, INTE I SÖKVÄGEN. Ett fragment skickas aldrig till en server av webbläsaren: det hamnar inte i Hostings begärandelogg, inte i
 * `Referer` och inte i ett mejlprograms förhandshämtning, som bara hämtar sidan och aldrig kör dess skript. Delningens `/g/<adress>` ligger i sökvägen och loggas;
 * det är rätt för en publik adress och fel för en nyckel. Sidan postar nyckeln själv, först när gästen skrivit sin adress.
 *
 * @param {string} bas Instansens adress med protokoll och utan sökväg, till exempel `https://my.life-hub.app`.
 * @param {{ id: string, nyckel: string }} lank
 * @returns {string}
 */
export function gastLank(bas, lank) {
  if (typeof bas !== "string" || !/^https?:\/\/[^\s/]+$/.test(bas.replace(/\/+$/, ""))) {
    throw new Error("gastLank: basadressen är instansens adress med protokoll och utan sökväg, till exempel https://my.life-hub.app.");
  }
  if (!lank || !GASTINBJUDNINGSIDFORM.test(lank.id) || !GASTNYCKELFORM.test(lank.nyckel)) {
    throw new Error("gastLank: { id, nyckel } krävs, id som 64 hextecken och nyckeln som 43 tecken ur A-Z, a-z, 0-9, - och _.");
  }
  return `${bas.replace(/\/+$/, "")}${GASTSOKVAG}#i=${lank.id}&k=${lank.nyckel}`;
}

/**
 * Id och nyckel ur adressens fragment (`location.hash`), eller `null` om det inte är en gästlänk. Tolerant för ett inledande `#`, strikt för formen:
 * en halv länk (bara id) ger `null`, så att sidan frågar efter adressen i stället för att försöka lösa in något som aldrig kan stämma.
 *
 * @param {unknown} fragment
 * @returns {{ id: string, nyckel: string } | null}
 */
export function tolkaGastLank(fragment) {
  if (typeof fragment !== "string") return null;
  const delar = fragment.replace(/^#/, "").split("&");
  /** @type {Record<string, string>} */
  const v = {};
  for (const d of delar) {
    const i = d.indexOf("=");
    if (i > 0) v[d.slice(0, i)] = d.slice(i + 1);
  }
  if (!v.i || !v.k || !GASTINBJUDNINGSIDFORM.test(v.i) || !GASTNYCKELFORM.test(v.k)) return null;
  return { id: v.i, nyckel: v.k };
}

/**
 * Gästens läge i listan, härlett ur raden och inte lagrat (regel 2: ett fält som kunde säga emot raderna vore en andra sanning).
 * Prövas i den här ordningen: `aterkallad`, `utgangen` (länken har gått ut och ingen har loggat in), `har-rostat` (appens `harRostat`), `inloggad`, `vantar`.
 *
 * @param {{ aterkallad?: number | null, forstInloggad?: number | null, lankGiltigTill?: number | null }} rad
 * @param {{ nu: number, harRostat?: boolean }} val
 * @returns {"aterkallad" | "utgangen" | "har-rostat" | "inloggad" | "vantar"}
 */
export function gastStatus(rad, val) {
  if (typeof rad?.aterkallad === "number") return "aterkallad";
  const inloggad = typeof rad?.forstInloggad === "number";
  if (!inloggad && typeof rad?.lankGiltigTill === "number" && rad.lankGiltigTill <= val.nu) return "utgangen";
  if (val.harRostat === true) return "har-rostat";
  return inloggad ? "inloggad" : "vantar";
}
