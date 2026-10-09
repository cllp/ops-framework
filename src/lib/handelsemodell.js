/**
 * Händelsemodellen: kontraktet för en händelse i en kalender, och svaren Kommer / Kommer inte (0.37.0, #179 F3).
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN FINNS ═════════════════════════════════════════════
 *
 * CP 2026-09-30, i #179: "Skapa händelse, man skall kunna välja att skapa en händelse i olika kalendrar ju, om man vill
 * skapa egna kalendrar, men om det är i gruppens kalender så skall vi kunna välja att händelsen skall kräva medlemmars
 * bekräftelse confirm/decline (optional) samt om det skall gå ut mail. Om det går bekräftelse skall det hamna i allas
 * inkorg."
 *
 * ══ ⛔ APPENS HÄNDELSER ÄR APPENS DATA. RAMVERKET ÄGER BARA KONTRAKTET ═════════
 *
 * CLAUDE.md "Vad som inte är regler här": ramverket vet aldrig vad appens händelser är. Det här är de FÄLT ramverket
 * läser på en händelse för att kunna rita den i rätt kalender och fråga efter svar, med samma namn som appen redan
 * använder (bolag-ops `web/src/data/handelser.js`: `datum`, `tid`, `slutTid`, `heldag`, `groupId`). Tre är nya:
 *
 *   - `kalenderId`: vilken av gruppens kalendrar händelsen hör till. ⛔ SAKNAS DEN GÄLLER GRUPPENS FÖRVALDA KALENDER, så
 *     befintliga rader stämmer utan bakfyllnad. En bakfyllnad hade skrivit samma uppgift (den förvalda) på varje gammal
 *     rad, och den dag någon byter förvald hade de raderna pekat på fel kalender utan att någon ändrat dem.
 *   - `slutDatum`: sista dagen för en händelse över flera dagar, inklusive. Utelämnad för en endagshändelse, aldrig lika
 *     med `datum` (en form, inte två, arbetsreglernas punkt 5).
 *   - `kravSvar`: gruppens medlemmar ombeds svara Kommer eller Kommer inte. Utelämnad eller `false`: ingen fråga.
 *
 * ⛔ UPPREPNING INGÅR INTE. CP har inte beslutat om veckovis upprepning som i SS eller ingen alls (#179 avsnitt 6).
 *
 * ══ ⛔ SVARET: EN RAD PER PERSON OCH HÄNDELSE, OCH NYCKELN ÄR PERSONEN ════════
 *
 * `<händelser>/{händelse}/<svar>/{uid}`. En undersamling till händelsen med personens uid som dokumentets nyckel, samma
 * form som samtalens läst-status (`<samtal>/{id}/<last>/{uid}`). Unikheten kommer ur sökvägen: det finns exakt en plats
 * för Annas svar på mötet, och ett andra svar är en uppdatering av den. Ingen fråga "har hon redan svarat?" före
 * skrivningen (punkt 2), och inget `handelseId` eller `uid` som fält på raden: båda står redan i sökvägen, och en kopia
 * hade kunnat säga något annat än nyckeln.
 *
 * ⛔ UNDERSAMLING OCH INTE EN EGEN SAMLING, av samma skäl som meddelandena i ett samtal: regeln behöver händelsens
 * grupp för att avgöra vem som läser, och som undersamling slår den upp händelsen en gång i stället för att raden bär en
 * kopia av `groupId`.
 *
 * ══ ⛔ RADEN I INKORGEN RÄKNAS FRAM, DEN SKRIVS INTE ══════════════════════════
 *
 * Varje medlem ska se en rad med Kommer / Kommer inte för varje händelse som kräver svar och som hen inte svarat på.
 * Den raden härleds ur händelserna och svaren (`svarsrader`), på samma sätt som `samtalsnotiser` härleder notiser ur
 * samtalen. En skriven inkorgspost per medlem hade krävt en server (en klient får inte skriva i någon annans namn), en
 * fan-out till varje medlem vid varje händelse, och den hade varit en andra sanning om samma obesvarade fråga: raden
 * hade stått kvar efter svaret tills någon mindes att ta bort den. Härledd försvinner den i samma stund som svaret skrivs.
 */

import { DATUMFORM, forvaldKalender, giltigtDatum } from "./kalendrar.js";
import { byggSkapare } from "./skapare.js";

/** Fälten ramverket läser på en av appens händelser. Appens egna fält (`rubrik`, `typ`, ...) står inte här. */
export const HANDELSEKONTRAKT = /** @type {const} */ (["groupId", "kalenderId", "datum", "slutDatum", "tid", "slutTid", "heldag", "kravSvar"]);

/** Svaren. Två och inte tre: "kanske" är inget svar på "kommer du?", och en tredje knapp gör sammanställningen oläslig. */
export const SVARSVAL = /** @type {const} */ (["kommer", "kommerInte"]);

/** Fälten på en svarsrad. Bara svaret: händelsen och personen står i sökvägen. */
export const SVARSFALT = /** @type {const} */ (["svar"]);

/** Klockslaget `HH:MM`. Samma form som appens `TIDFORM`. */
export const KLOCKFORM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * @typedef {object} Handelsetid
 * @property {string} datum `YYYY-MM-DD`.
 * @property {string} [slutDatum] Sista dagen, inklusive. Bara när den är efter `datum`.
 * @property {string} [tid] `HH:MM`.
 * @property {string} [slutTid] `HH:MM`, bara med `tid`.
 * @property {boolean} [heldag]
 */

/**
 * Det som är fel i en händelses tid och kalender, som meningar att visa. Tom lista: inget fel.
 *
 * ⛔ MENINGAR OCH INTE ETT KAST, som appens `saknas`: formuläret skriver ut varje rad, så den som trycker på Spara får
 * veta vilket fält som stoppade. Samma kontroller gör regeln (`opsHandelsefaltGiltiga`), så en rad som går igenom här
 * går igenom där.
 *
 * ⛔ `slutTid` SAMMA DAG MÅSTE VARA EFTER `tid`, men över flera dagar får den vara tidigare (från 22:00 till 02:00 dagen
 * efter). Det är skälet till att kontrollen bor här och inte i en ren strängjämförelse.
 *
 * @param {Record<string, unknown>} h
 * @param {{ gruppkalendrar?: ReadonlyArray<{ id: string, arkiverad?: boolean }> }} [config] Med listan prövas `kalenderId`.
 * @returns {string[]}
 */
export function handelsefel(h, config = {}) {
  const r = h && typeof h === "object" ? h : {};
  /** @type {string[]} */
  const fel = [];
  const datum = typeof r.datum === "string" ? r.datum : "";
  if (!datum) fel.push("Välj ett datum");
  else if (!giltigtDatum(datum)) fel.push("Datumet finns inte");
  if (r.slutDatum !== undefined) {
    if (typeof r.slutDatum !== "string" || !giltigtDatum(r.slutDatum)) fel.push("Slutdatumet finns inte");
    else if (datum && r.slutDatum <= datum) fel.push("Slutdatumet måste vara efter startdatumet. En endagshändelse har inget slutdatum");
  }
  if (r.heldag !== undefined && typeof r.heldag !== "boolean") fel.push("Heldag är sant eller falskt");
  if (r.heldag === true) {
    if (r.tid !== undefined || r.slutTid !== undefined) fel.push("En heldagshändelse har varken från eller till");
  } else {
    if (r.tid !== undefined && !(typeof r.tid === "string" && KLOCKFORM.test(r.tid))) fel.push("Från ska vara ett klockslag, HH:MM");
    if (r.slutTid !== undefined) {
      if (!(typeof r.slutTid === "string" && KLOCKFORM.test(r.slutTid))) fel.push("Till ska vara ett klockslag, HH:MM");
      else if (r.tid === undefined) fel.push("Välj Från innan Till");
      else if (r.slutDatum === undefined && typeof r.tid === "string" && r.slutTid <= r.tid) fel.push("Till måste vara senare än Från");
    }
  }
  if (r.kravSvar !== undefined && typeof r.kravSvar !== "boolean") fel.push("Kräv svar är sant eller falskt");
  if (r.kalenderId !== undefined) {
    if (typeof r.kalenderId !== "string" || !r.kalenderId) fel.push("Kalendern saknar id");
    else if (config.gruppkalendrar) {
      const k = config.gruppkalendrar.find((x) => x.id === r.kalenderId);
      if (!k) fel.push("Kalendern finns inte bland gruppens kalendrar");
      else if (k.arkiverad) fel.push("Kalendern är arkiverad och tar inte emot nya händelser");
    }
  }
  return fel;
}

/**
 * Kalendern en händelse hör till: `kalenderId`, annars gruppens förvalda, annars `null` (gruppen har inga kalendrar).
 *
 * ⛔ HÄRLEDD OCH INTE BAKFYLLD, se filhuvudet.
 *
 * @param {{ kalenderId?: string }} h
 * @param {ReadonlyArray<{ id: string, forvald: boolean, arkiverad: boolean, ordning: number, namn: any }>} gruppkalendrar
 * @returns {string | null}
 */
export function handelsensKalenderId(h, gruppkalendrar) {
  if (h && typeof h.kalenderId === "string" && h.kalenderId) return h.kalenderId;
  const f = forvaldKalender(gruppkalendrar);
  return f ? f.id : null;
}

/**
 * En händelses datum, slutdatum och heldag som fälten på en rad i `OpsCalendar` (`date`, `endDate`, `allDay`).
 *
 * ⛔ EN MAPPNING, INTE EN I VARJE APP, av samma skäl som `postTillRad`: samma händelse ritas i kalendern och i appens
 * lista, och två mappningar hade börjat säga olika saker om sista dagen.
 *
 * @param {Handelsetid} h
 * @returns {{ date: string, endDate?: string, allDay?: true }}
 */
export function handelsensDagar(h) {
  const date = h.datum;
  return {
    date,
    ...(typeof h.slutDatum === "string" && h.slutDatum > date ? { endDate: h.slutDatum } : {}),
    ...(h.heldag === true ? { allDay: /** @type {const} */ (true) } : {}),
  };
}

/**
 * Bygger en svarsrad, eller kastar.
 * @param {unknown} svar @returns {{ svar: "kommer" | "kommerInte" }}
 */
export function byggSvar(svar) {
  if (!(/** @type {readonly unknown[]} */ (SVARSVAL)).includes(svar)) {
    throw new Error(`byggSvar: svaret "${String(svar)}" finns inte. Giltiga: ${SVARSVAL.join(", ")}.`);
  }
  return { svar: /** @type {"kommer" | "kommerInte"} */ (svar) };
}

/**
 * @typedef {object} Sammanstallning
 * @property {number} kommer
 * @property {number} kommerInte
 * @property {number} ejSvarat Medlemmar som inte svarat.
 * @property {string} text "3 kommer, 1 kommer inte, 2 har inte svarat". Alltid alla tre delarna, också när de är 0.
 */

/**
 * Hur det står: hur många som kommer, inte kommer och inte har svarat.
 *
 * ⛔ TOMT SKRIVS UT (punkt 5). "0 kommer, 0 kommer inte, 6 har inte svarat" och inte en tom rad eller bara "6 har inte
 * svarat": en sammanställning som utelämnar en del gör "ingen kommer" omöjligt att skilja från "inte räknat".
 *
 * ⛔ BARA MEDLEMMARNAS SVAR RÄKNAS. Ett svar från någon som lämnat gruppen står kvar i databasen (det raderas aldrig),
 * men den personen är inte längre en av dem som tillfrågas, och hade hen räknats hade summan blivit större än gruppen.
 *
 * @param {ReadonlyArray<{ id: string, svar: string }>} svar Raderna ur svarssamlingen, `id` är personens uid.
 * @param {ReadonlyArray<string>} medlemmar Uid:n på gruppens aktiva medlemmar av typen person.
 * @returns {Sammanstallning}
 */
export function sammanstallSvar(svar, medlemmar) {
  const per = new Map((svar ?? []).map((s) => [s.id, s.svar]));
  let kommer = 0;
  let kommerInte = 0;
  for (const uid of medlemmar ?? []) {
    const s = per.get(uid);
    if (s === "kommer") kommer += 1;
    else if (s === "kommerInte") kommerInte += 1;
  }
  const ejSvarat = (medlemmar ?? []).length - kommer - kommerInte;
  return { kommer, kommerInte, ejSvarat, text: `${kommer} kommer, ${kommerInte} kommer inte, ${ejSvarat} har inte svarat` };
}

/**
 * Om en händelse har passerat: sista dagen (`slutDatum` eller `datum`) är före idag.
 * @param {Handelsetid} h @param {string} idag `YYYY-MM-DD` @returns {boolean}
 */
export function harPasserat(h, idag) {
  return (typeof h.slutDatum === "string" && h.slutDatum > h.datum ? h.slutDatum : h.datum) < idag;
}

/**
 * Inkorgens rader: en per händelse som kräver svar, som personen inte svarat på och som inte passerat.
 *
 * ⛔ HÄRLEDDA, SE FILHUVUDET. Raden försvinner när svaret finns, och när dagen gått.
 *
 * ⛔ EN HÄNDELSE SOM PASSERAT FRÅGAR INTE LÄNGRE. "Kommer du på mötet i förrgår?" är ingen fråga, och en inkorg som
 * fylls av gamla frågor lär att raderna inte behöver läsas.
 *
 * @template {Handelsetid & { id: string, kravSvar?: boolean }} H
 * @param {{ handelser: ReadonlyArray<H>, mina: ReadonlyMap<string, string> | Record<string, string>, idag: string }} arg
 *   `mina`: personens egna svar per händelse-id (ur `createSvarskalla().mina`).
 * @returns {H[]} Händelserna, sorterade på datum och tid.
 */
export function svarsrader({ handelser, mina, idag }) {
  if (!DATUMFORM.test(idag)) throw new Error(`svarsrader: idag "${idag}" ska vara YYYY-MM-DD.`);
  const har = mina instanceof Map ? (/** @type {string} */ id) => mina.has(id) : (/** @type {string} */ id) => Object.prototype.hasOwnProperty.call(mina ?? {}, id);
  return (handelser ?? [])
    .filter((h) => h && h.kravSvar === true && !har(h.id) && !harPasserat(h, idag))
    .slice()
    .sort((a, b) => a.datum.localeCompare(b.datum) || String(a.tid ?? "").localeCompare(String(b.tid ?? "")));
}

/*
 * ══ ⛔ KOMMENTARER PÅ EN HÄNDELSE (0.48.0, #232, beslut 0002) ══════════════════════════════════════════════════════
 *
 * CP 2026-10-02, på frågorna i #232: "Ja och ja." Den som skrev en kommentar får ta bort den, och en ny kommentar syns i Inkorgen.
 *
 * ⛔ SÖKVÄGEN ÄR `<händelser>/{händelse}/<kommentarer>/{kommentar}`, och samlingsnamnen är appens (se `handelseregelfragment`).
 * Fälten är en exakt lista (`KOMMENTARFALT`): texten, när och vem. Ingen `groupId`: gruppen står på händelsen ovanför, och en
 * kopia här hade varit en andra sanning om samma sak (regel 2). Inga `synk`-fält: en händelse har ingen GitHub-spegel.
 *
 * ⛔ INKORGEN HÄRLEDS, SOM SVARSRADERNA. En kommentar skriver ingen rad till någon annan. Varje person har ett läsmärke per
 * händelse (`<händelser>/{händelse}/<läsmärken>/{uid}`, fältet `lastTill`), och `kommentarsrader` räknar fram en rad per händelse
 * där någon ANNAN skrivit efter märket. Raden försvinner i samma stund som märket flyttas, alltså när händelsen öppnas. En
 * skriven notis hade krävt en server som skriver åt mottagaren (en klient får inte skriva i någon annans namn), och den hade
 * stått kvar efter att kommentaren lästs tills någon mindes att ta bort den.
 */

/** Fälten på en kommentar, exakt. Samma lista står i regeln. */
export const KOMMENTARFALT = /** @type {const} */ (["text", "skapad", "skapadAv"]);

/**
 * Tak för en kommentars längd, i tecken. Samma tal som inkorgens kommentarer i bolag-ops (`MAX_KOMMENTAR`), så att en mening som
 * går att skriva på ett ställe går att skriva på det andra. Regeln prövar samma tal.
 */
export const MAX_HANDELSEKOMMENTAR = 5000;

/*
 * ══ ⛔ EN BILAGA PÅ EN KOMMENTAR (0.73.0, cllp/bolag-ops#570) ═════════════════════════════════════════════════════════════
 *
 * CP 2026-10-06, inkorgspost `D7P0tLlRj3EKcoptFcF1`: "Kommentarer behöver ha bilder elelr filer också."
 *
 * ⛔ SAMMA FORM SOM INKORGENS OCH HÄNDELSENS `bilaga`, INTE EN ANDRA MODELL: `{ dataUrl, namn, typ, tecken, bredd?, hojd? }`, den
 * form `readAttachment` ger. Bilagan ligger i kommentarens eget dokument. Då läser exakt de som läser kommentaren bilagan (gruppens
 * aktiva medlemmar, regeln ovanför), och en kommentar och dess bilaga skrivs i EN skrivning som lyckas eller inte. En fil i en
 * fillagring hade krävt en andra regeluppsättning för samma läsbehörighet, och en föräldralös fil när den andra skrivningen föll.
 *
 * ⛔ TYPERNA ÄR EN LISTA OCH INTE `image/*`. SVG är en bild som bär skript, och en okänd typ går inte att visa eller lita på.
 * Bilder krymps till `image/jpeg` av `readAttachment`, så en PNG eller en HEIC som webbläsaren kan läsa landar som JPEG. Listan och
 * taket står både här och i den genererade regeln (`handelseregelfragment`), ur samma konstanter.
 */
/**
 * MIME-typerna en kommentarsbilaga får ha. Utan regextecken, eftersom regeln bygger sitt mönster ur typen.
 *
 * ⛔ LJUD (0.90.3). Samma fråga som Bibliotekets filer: ett ljud ska gå att spela, inte bara laddas ned.
 * Codec-varianterna är de `MediaRecorder` faktiskt rapporterar (`audio/webm;codecs=opus`). Data-URL:ens prefix
 * måste vara exakt typen, så en bas-typ ensam hade nekat rösten från samma inspelare ramverket redan använder.
 */
export const KOMMENTARBILAGA_TYPER = /** @type {const} */ ([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/wav",
]);

/**
 * Tak för bilagans data-URL i tecken. Ett Firestore-dokument tar 1 MiB, och 700 000 tecken plus en text på 5 000 ryms med marginal.
 * Samma tal som inkorgens `MAX_ATTACHMENT_CHARS` i lifehub.app.
 */
export const MAX_KOMMENTARBILAGA = 700000;

/** Tak för filnamnet. Ett namn längre än så är inte ett namn någon läser, och regeln behöver ett tal. */
export const MAX_BILAGENAMN = 200;

/** Bilagans fält, exakt. De fyra första krävs, bredd och höjd bara för en bild som gick att läsa. */
export const KOMMENTARBILAGAFALT = /** @type {const} */ (["dataUrl", "namn", "typ", "tecken", "bredd", "hojd"]);
const KOMMENTARBILAGA_KRAV = KOMMENTARBILAGAFALT.slice(0, 4);

/**
 * Bilagans egna fält ur ett läst dokument.
 *
 * ⛔ RADENS `id` HÖR TILL DOKUMENTET, INTE TILL BILAGAN. Adaptern lägger alltid på `id` när den läser
 * (minne och Firestore gör samma sak). `kommentarbilagaFel` nekar okända fält, så en vy som skickar
 * hela raden ritar en giltig fil som trasig. Regeln ser inte `id`: det är sökvägen, inte ett fält.
 *
 * @param {unknown} post
 * @returns {import("./file.js").Bilaga | null}
 */
export function bilagaUrDokument(post) {
  if (!post || typeof post !== "object" || Array.isArray(post)) return null;
  const b = /** @type {Record<string, unknown>} */ (post);
  /** @type {Record<string, unknown>} */
  const ut = {};
  for (const k of KOMMENTARBILAGAFALT) if (k in b && b[k] !== undefined) ut[k] = b[k];
  return /** @type {import("./file.js").Bilaga} */ (ut);
}

/**
 * Varför en bilaga inte får följa med en kommentar, eller `null` när den får. Samma prövning som regeln, med ett besked som
 * säger vad man ska göra i stället för "Missing or insufficient permissions".
 *
 * @param {unknown} bilaga
 * @returns {string | null}
 */
export function kommentarbilagaFel(bilaga) {
  if (!bilaga || typeof bilaga !== "object" || Array.isArray(bilaga)) return "bilagan är inte en bilaga.";
  const b = /** @type {Record<string, unknown>} */ (bilaga);
  const okanda = Object.keys(b).filter((k) => !(/** @type {readonly string[]} */ (KOMMENTARBILAGAFALT)).includes(k));
  if (okanda.length) return `bilagan bär fälten ${okanda.join(", ")}, som inte hör till en bilaga.`;
  const saknas = KOMMENTARBILAGA_KRAV.filter((k) => !(k in b));
  if (saknas.length) return `bilagan saknar ${saknas.join(", ")}.`;
  if (typeof b.typ !== "string" || !(/** @type {readonly string[]} */ (KOMMENTARBILAGA_TYPER)).includes(b.typ)) {
    return `filtypen ${b.typ ? `"${b.typ}"` : "saknas och"} går inte att bifoga. Tillåtna: bilder (JPEG, PNG, WebP, GIF), ljud (WebM, MP4, MPEG, Ogg, WAV), PDF, text och CSV.`;
  }
  if (typeof b.dataUrl !== "string" || !b.dataUrl.startsWith(`data:${b.typ};base64,`)) return "bilagans innehåll stämmer inte med dess typ.";
  if (b.dataUrl.length > MAX_KOMMENTARBILAGA) return `filen är för stor (${b.dataUrl.length} tecken, taket är ${MAX_KOMMENTARBILAGA}).`;
  if (b.tecken !== b.dataUrl.length) return "bilagans storlek stämmer inte med dess innehåll.";
  if (typeof b.namn !== "string" || !b.namn || b.namn.length > MAX_BILAGENAMN) return `bilagans namn ska vara 1 till ${MAX_BILAGENAMN} tecken.`;
  for (const k of ["bredd", "hojd"]) if (k in b && typeof b[k] !== "number") return `bilagans ${k} är inget tal.`;
  return null;
}

/** Fälten på ett läsmärke, exakt: när personen senast läste trådens kommentarer, ISO-tid. */
export const LASMARKESFALT = /** @type {const} */ (["lastTill"]);

const ISOFORM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * Bygger en kommentar, eller kastar.
 *
 * ⛔ TOM TEXT OCH TEXT ÖVER TAKET KASTAR HÄR, INTE FÖRST I REGELN. Regeln nekar samma sak, men ett nekande från databasen är
 * "Missing or insufficient permissions", som inte säger vad som var fel. Här står det.
 *
 * ⛔ UTAN `uid` PÅ SKAPAREN KASTAR DEN. Regeln kräver `skapadAv.uid == request.auth.uid`, och en kommentar utan uid hade nekats
 * utan att säga varför.
 *
 * ⛔ MED EN BILAGA FÅR TEXTEN VARA TOM (0.73.0, #570): en skärmbild är ett fullgott inlägg i en tråd. Utan bilaga kastar en tom text
 * som förut. Fältet `text` står alltid med, också tomt, så att regelns fältlista är densamma med och utan bilaga.
 *
 * @param {unknown} text
 * @param {{ skapare: { uid?: string | null, namn?: string, typ?: string, kalla?: string }, nu?: () => string, bilaga?: import("./file.js").Bilaga | null }} arg
 * @returns {{ text: string, skapad: string, skapadAv: import("./skapare.js").Skapare, bilaga?: import("./file.js").Bilaga }}
 */
export function byggKommentar(text, { skapare, nu = () => new Date().toISOString(), bilaga = null } = /** @type {any} */ ({})) {
  const t = typeof text === "string" ? text.trim() : "";
  if (!t && !bilaga) throw new Error("byggKommentar: kommentaren är tom.");
  if (t.length > MAX_HANDELSEKOMMENTAR) throw new Error(`byggKommentar: kommentaren är ${t.length} tecken, taket är ${MAX_HANDELSEKOMMENTAR}.`);
  const bilagefel = bilaga ? kommentarbilagaFel(bilaga) : null;
  if (bilagefel) throw new Error(`byggKommentar: ${bilagefel}`);
  const av = byggSkapare(skapare ?? {});
  if (!av.uid) throw new Error("byggKommentar: skapare.uid krävs. Regeln släpper bara in en kommentar i den inloggades namn.");
  const skapad = nu();
  if (!ISOFORM.test(skapad)) throw new Error(`byggKommentar: skapad "${skapad}" är ingen ISO-tid.`);
  return { text: t, skapad, skapadAv: av, ...(bilaga ? { bilaga: { ...bilaga } } : {}) };
}

/**
 * Inkorgens rader för kommentarer: en per händelse där någon annan skrivit efter mitt läsmärke, nyast först.
 *
 * ⛔ HÄRLEDDA, SE OVAN. ⛔ MINA EGNA KOMMENTARER RÄKNAS INTE: att få en rad om något man själv just skrivit är brus.
 *
 * ⛔ UTAN LÄSMÄRKE ÄR ALLA ANDRAS KOMMENTARER OLÄSTA. "Aldrig öppnad" är inte detsamma som "läst". Vilka händelser som läses
 * avgör appen (samma fönster som svarsraderna), så gamla trådar fyller inte inkorgen.
 *
 * @template {{ id: string }} H
 * @param {{
 *   handelser: ReadonlyArray<H>,
 *   kommentarer: ReadonlyMap<string, ReadonlyArray<{ id: string, text: string, skapad: string, skapadAv?: { uid?: string | null, namn?: string } }>>,
 *   lastTill: ReadonlyMap<string, string>,
 *   uid: string,
 * }} arg
 * @returns {Array<{ handelse: H, olasta: number, senaste: { id: string, text: string, skapad: string, namn: string, uid: string | null } }>}
 */
export function kommentarsrader({ handelser, kommentarer, lastTill, uid }) {
  if (typeof uid !== "string" || !uid) throw new Error("kommentarsrader: uid krävs. Raderna är en persons, inte gruppens.");
  if (!(kommentarer instanceof Map) || !(lastTill instanceof Map)) throw new Error("kommentarsrader: kommentarer och lastTill är kartor per händelse-id.");
  /** @type {Array<{ handelse: H, olasta: number, senaste: { id: string, text: string, skapad: string, namn: string, uid: string | null } }>} */
  const ut = [];
  for (const h of handelser ?? []) {
    const mark = lastTill.get(h.id) ?? "";
    /** @type {ReadonlyArray<{ id: string, text: string, skapad: string, skapadAv?: { uid?: string | null, namn?: string } }>} */
    const trad = kommentarer.get(h.id) ?? [];
    const nya = trad.filter((k) => (k.skapadAv?.uid ?? null) !== uid && k.skapad > mark);
    if (nya.length === 0) continue;
    const s = nya.reduce((a, b) => (b.skapad > a.skapad ? b : a));
    ut.push({ handelse: h, olasta: nya.length, senaste: { id: s.id, text: s.text, skapad: s.skapad, namn: s.skapadAv?.namn ?? "", uid: s.skapadAv?.uid ?? null } });
  }
  return ut.sort((a, b) => b.senaste.skapad.localeCompare(a.senaste.skapad));
}
