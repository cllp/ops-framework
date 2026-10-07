/**
 * Mejlkö: formen, språket, spärrade domäner och regelfragmentet (ops-framework#101,
 * lifehub.app#103 lane 18 steg A).
 *
 * ══ ⛔ VARFÖR DET HÄR ÄR EN EGEN SANNING, OCH INTE SESSIONS FILER ═════════
 *
 * SessionStudio skickar mejl ur `functions/mail/sendEmailNotification.js`,
 * `functions/mailLogger.js` och `functions/mailLang.js`. De filerna är CommonJS,
 * de känner `mail/{mailId}`, och de läser `MAIL_USER` i en modul som också
 * känner avsändaren. Ramverket får inte ta med sig det: en app som heter
 * annorlunda, och en kö som appen själv döper, ska kunna använda samma beslut
 * utan att ärva SessionStudios samling, copy eller adresser.
 *
 * Det som återanvänds är besluten, inte filerna:
 *
 *   - Domänerna `test.se`, `example.com`, `test.com` och `example.se` skickas
 *     inte. De är reserverade för prov, och ett provmejl som lämnar huset ser
 *     ut som ett riktigt utskick.
 *   - Språket är `sv` eller `en`, i samma ordning som `resolveMailLang`:
 *     händelsen, sedan gruppen, sedan avsändaren, sedan `sv`.
 *   - Kvittot säger vad servern tog emot och vad den avvisade, med serverns
 *     egen rad och Message-ID. "Skickad" betyder att minst en mottagare
 *     accepterades och ingen avvisades. Allt annat är `fel`, och felet skrivs
 *     på samma dokument. En tyst nedsläppsväg är värre än ett fel (regel 5).
 *
 * ⛔ RAMVERKET KÄNNER INGEN ADRESS, INGEN SERVER OCH INGET SAMLINGSNAMN.
 * Appen skickar in dem. En förvald `smtp.gmail.com` eller `hello@...` hade
 * gjort nästa apps utskick till den här appens avsändare.
 */

/** Samma form som `kontrolleraNamn` i `regler.js`: ett namn, inte en sökväg. */
const SAMLINGSFORM = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * Serverns svarsrad kan bli lång. Samma tak som SessionStudios
 * `MAX_SMTP_RESPONSE_CHARS`: ett dokument ska inte växa fritt av ett kö-id.
 */
export const MAX_MEJLSVAR = 200;

/** Ett skäl på dokumentet har samma sorts tak, av samma skäl. */
const MAX_MEJLORSAK = 500;

/**
 * Fälten ett köat dokument får bära. `groupId` är valfritt och den enda
 * gruppnyckeln (`check-gruppnyckel`). Kvittots fält ligger på samma dokument,
 * så det inte finns en andra samling att hålla i synk med kön.
 */
export const MEJLFALT = ["till", "amne", "text", "html", "sprak", "kategori", "groupId", "status", "accepterade", "avvisade", "svar", "messageId", "tid", "orsak"];

/** `koad` väntar på utskick. `skickad` och `fel` är kvitton och skickas inte igen. */
export const MEJLSTATUS = ["koad", "skickad", "fel"];

/**
 * Samma lista som SessionStudios `BLOCKED_EMAIL_DOMAINS`. Jämförelsen är
 * gemener och träffar bara domänen efter `@`, inte en underdomän.
 */
export const SPARRADE_MEJLDOMÄNER = ["test.se", "example.com", "test.com", "example.se"];

/**
 * @param {unknown} namn
 * @param {string} fabrik
 * @returns {string}
 */
export function mejlsamlingsnamn(namn, fabrik) {
  if (typeof namn !== "string" || !SAMLINGSFORM.test(namn)) {
    throw new Error(
      `${fabrik}: "${namn}" är inte ett samlingsnamn. Ett snedstreck gör det till en sökväg, och sökvägen är appens beslut. Ramverket känner aldrig samlingsnamnet.`,
    );
  }
  return namn;
}

/**
 * Regelfragmentet för kön. Klienten läser inte och skriver inte.
 *
 * ⛔ LÄSNINGEN ÄR STÄNGD AV SAMMA SKÄL SOM VITLISTAN. Dokumentet bär en
 * mottagaradress. En klient som fick läsa samlingen såg andras adresser, och
 * en klient som fick skriva den kunde köa mejl utan att gå genom servern.
 * Admin SDK går förbi regeln, och det är den enda vägen in och ut.
 *
 * ⛔ INGET FÖRVALT NAMN. Appen skickar in samlingen, samma regel som för
 * katalogen. Ett förval hade gett varje app en samling den inte bett om.
 *
 * @param {string} namn
 * @returns {string}
 */
export function mejlregelfragment(namn) {
  const samling = mejlsamlingsnamn(namn, "mejlregelfragment");
  return `    // Mejlkö. GENERERAD av mejlregelfragment(), ändra inte för hand.
    //
    // ⛔ KLIENTEN LÄSER INTE OCH SKRIVER INTE. Kön bär mottagaradresser, och
    // kvittot skrivs av servern när utskicket gått (eller inte gått). Admin SDK
    // går förbi regeln, och det är den enda vägen.
    match /${samling}/{id} {
      allow read, write: if false;
    }
`;
}

/**
 * @param {unknown} v
 * @returns {"sv" | "en" | null}
 */
export function normaliseraMejlsprak(v) {
  if (v === "sv" || v === "en") return v;
  return null;
}

/**
 * Samma ordning som SessionStudios `resolveMailLang`: händelse, grupp,
 * avsändare, sedan `sv`.
 *
 * @param {{ handelse?: unknown, grupp?: unknown, avsandare?: unknown }} [val]
 * @returns {"sv" | "en"}
 */
export function losMejlsprak(val) {
  const handelse = normaliseraMejlsprak(val?.handelse);
  if (handelse) return handelse;
  const grupp = normaliseraMejlsprak(val?.grupp);
  if (grupp) return grupp;
  const avsandare = normaliseraMejlsprak(val?.avsandare);
  if (avsandare) return avsandare;
  // Sista steget i resolveMailLang. normaliseraMejlsprak fångar redan "en",
  // och raden står kvar så ordningen är densamma om den funktionen ändras.
  return val?.avsandare === "en" ? "en" : "sv";
}

/**
 * Samma ordning som SessionStudios `resolveInviteLang`: inbjudan, händelse,
 * grupp, sedan `sv`.
 *
 * @param {{ inbjudan?: unknown, handelse?: unknown, grupp?: unknown }} [val]
 * @returns {"sv" | "en"}
 */
export function losInbjudningssprak(val) {
  const inbjudan = normaliseraMejlsprak(val?.inbjudan);
  if (inbjudan) return inbjudan;
  const handelse = normaliseraMejlsprak(val?.handelse);
  if (handelse) return handelse;
  const grupp = normaliseraMejlsprak(val?.grupp);
  if (grupp) return grupp;
  return "sv";
}

/**
 * Domänen efter `@`, i gemener.
 *
 * ⛔ VINKELPARENTESERNA ÄR INTE EN NY REGEL, DE STÄNGER ETT HÅL I DEN GAMLA.
 * SessionStudio tar sista delen efter `@`. `Namn <a@example.com>` hade då
 * gett domänen `example.com>`, som inte finns i listan, och ett provmejl hade
 * gått iväg. Adressen inuti parentesen är den som jämförs. Utan parentes är
 * jämförelsen densamma som förut: trim, sista delen, gemener.
 *
 * @param {unknown} till
 * @returns {{ sparrad: false } | { sparrad: true, doman: string }}
 */
export function sparradMejldoman(till) {
  if (typeof till !== "string" || !till.trim()) return { sparrad: false };
  const adress = adressUr(till);
  const del = adress.split("@");
  const doman = del.length > 1 ? del.pop()?.toLowerCase() ?? "" : "";
  if (!doman) return { sparrad: false };
  if (SPARRADE_MEJLDOMÄNER.includes(doman)) return { sparrad: true, doman };
  return { sparrad: false };
}

/**
 * @param {string} till
 * @returns {string}
 */
function adressUr(till) {
  const trimmas = till.trim();
  const inom = trimmas.match(/<([^<>]+)>/);
  return (inom ? inom[1] : trimmas).trim();
}

/**
 * @param {unknown} v
 * @returns {string[]}
 */
function adresser(v) {
  if (!Array.isArray(v)) return [];
  /** @type {string[]} */
  const ut = [];
  for (const post of v) {
    if (typeof post === "string" && post.trim()) ut.push(post.trim());
    else if (post && typeof post === "object" && "address" in post && typeof post.address === "string" && post.address.trim()) {
      ut.push(post.address.trim());
    }
  }
  return ut;
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function trunkeraSvar(v) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > MAX_MEJLSVAR ? t.slice(0, MAX_MEJLSVAR) : t;
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function kortOrsak(v) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > MAX_MEJLORSAK ? t.slice(0, MAX_MEJLORSAK) : t;
}

/**
 * Kvittot, med varje fält utskrivet. `null` betyder att servern inte gav
 * något, en tom lista betyder att ingen mottagare hamnade där. Utelämnade
 * fält hade gjort de två omöjliga att skilja (regel 5).
 *
 * @param {{ status: "skickad" | "fel", accepterade?: string[], avvisade?: string[], svar?: string | null, messageId?: string | null, tid: string, orsak?: string | null }} del
 */
export function mejlKvitto(del) {
  return {
    status: del.status,
    accepterade: del.accepterade ?? [],
    avvisade: del.avvisade ?? [],
    svar: del.svar ?? null,
    messageId: del.messageId ?? null,
    tid: del.tid,
    orsak: del.orsak ?? null,
  };
}

/**
 * Nodemailers svar, eller ett kast som bär samma fält, blir ett kvitto.
 *
 * ⛔ `skickad` KRÄVER ATT NÅGON ACCEPTERADES OCH INGEN AVVISADES. SessionStudio
 * skrev `sent` så fort `sendMail` återvände, och en rad med noll accepterade
 * såg då ut som ett mejl som gått fram. En avvisad mottagare är `fel`, också
 * när någon annan på samma rad accepterades: kvittot behåller båda listorna.
 *
 * @param {unknown} info
 * @param {string} tid
 * @param {string | null} [tvingadOrsak] Satt när anropet kastade. Då är status `fel` även om listorna ser tomma ut.
 */
export function kvittoAvTransport(info, tid, tvingadOrsak) {
  const src = info && typeof info === "object" ? /** @type {Record<string, unknown>} */ (info) : {};
  const accepterade = adresser(src.accepted);
  const avvisade = adresser(src.rejected);
  const svar = trunkeraSvar(src.response);
  const messageId = typeof src.messageId === "string" && src.messageId.trim() ? src.messageId.trim() : null;
  const avvisad = avvisade.length > 0;
  const ingen = accepterade.length === 0;
  const fel = Boolean(kortOrsak(tvingadOrsak)) || avvisad || ingen;
  /** @type {string | null} */
  let orsak = null;
  if (fel) {
    const tvingad = kortOrsak(tvingadOrsak);
    if (tvingad) orsak = tvingad;
    else if (avvisad) orsak = kortOrsak(`Avvisad mottagare: ${avvisade.join(", ")}`);
    else orsak = "Servern accepterade ingen mottagare.";
  }
  return mejlKvitto({
    status: fel ? "fel" : "skickad",
    accepterade,
    avvisade,
    svar,
    messageId,
    tid,
    orsak,
  });
}

/**
 * @param {unknown} inmatning
 * @returns {{ ok: true, mejl: Record<string, unknown> } | { ok: false, orsak: string }}
 */
export function granskaMejl(inmatning) {
  const rad = inmatning && typeof inmatning === "object" ? /** @type {Record<string, unknown>} */ (inmatning) : {};
  /** @type {string[]} */
  const fel = [];

  const till = typeof rad.till === "string" ? rad.till.trim() : "";
  const adress = till ? adressUr(till) : "";
  if (!till || !adress.includes("@") || /[,\s]/.test(adress)) {
    fel.push("till krävs och är en e-postadress, inte en lista.");
  }

  const amne = typeof rad.amne === "string" ? rad.amne.trim() : "";
  if (!amne) fel.push("amne krävs.");

  if (typeof rad.text !== "string" || typeof rad.html !== "string") {
    fel.push("text och html krävs, och de är strängar. En tom sträng är ett tomt brev, ett saknat fält är ett brev som inte byggdes.");
  } else if (!rad.text.trim() && !rad.html.trim()) {
    fel.push("text eller html måste ha ett innehåll. Ett tomt brev som står som köat ser ut som ett utskick.");
  }

  const sprak = normaliseraMejlsprak(rad.sprak);
  if (!sprak) fel.push("sprak måste vara sv eller en.");

  const kategori = typeof rad.kategori === "string" ? rad.kategori.trim() : "";
  if (!kategori) fel.push("kategori krävs. Appen döper den, ramverket har ingen lista.");

  /** @type {string | undefined} */
  let groupId;
  if ("groupId" in rad && rad.groupId != null) {
    if (typeof rad.groupId !== "string" || !rad.groupId.trim()) fel.push("groupId är valfritt, och när det finns är det en icke-tom sträng.");
    else groupId = rad.groupId.trim();
  }

  if (fel.length > 0) return { ok: false, orsak: fel.join(" ") };

  /** @type {Record<string, unknown>} */
  const mejl = {
    till,
    amne,
    text: rad.text,
    html: rad.html,
    sprak,
    kategori,
    status: "koad",
    accepterade: [],
    avvisade: [],
    svar: null,
    messageId: null,
    tid: null,
    orsak: null,
  };
  if (groupId) mejl.groupId = groupId;
  return { ok: true, mejl };
}

/**
 * Ett köat dokument. Kastas när fälten inte håller, så den som köar ser felet
 * innan raden skrivs. En rad som redan ligger i kön granskas av utskickaren
 * utan att kastas: den får ett kvitto i stället (se `createMailService`).
 *
 * @param {unknown} inmatning
 */
export function byggMejl(inmatning) {
  const svar = granskaMejl(inmatning);
  if (!svar.ok) throw new Error(`byggMejl: ${svar.orsak}`);
  return svar.mejl;
}
