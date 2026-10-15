/**
 * TALK: att prata in något i stället för att skriva det (0.57.0, cllp/lifehub.app#2).
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN FINNS ═════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-02: "Långpress på + [...] spelar in tills man släpper." CP 2026-10-04: medan man håller inne står det bara
 * en sak, TALK, och ett fält kommer fram så att man kan prata vidare utan att hålla inne. Besluten står i
 * cllp/lifehub.app#2.
 *
 * CP 2026-10-09, med en skärmbild av fältet (prickar, mikrofon, rött kryss): efter stopp syntes ingen sparning, och
 * det röda krysset var den enda tydliga knappen. Klar sparar. Avbryt kastar. Sparar och Sparat sägs.
 *
 * ══ ⛔ RAMVERKET SPELAR IN, APPEN BESTÄMMER VAD DET BLIR ═══════════════════════════════════════════════════════════════
 *
 * Ramverket äger hållet, fältet och inspelningen, så att varje hubb beter sig likadant. Ljudet lämnas till appen i
 * `onTalk(blob, { mimeType, sekunder, rapportera })`. `rapportera` tar 0 till 1 medan appen sparar.
 * Vad ljudet blir (text, ett ärende, ett förslag i Inkorgen) vet bara appen,
 * och ramverket ska inte veta det.
 *
 * ⛔ (0.97.0, lifehub.app#219) Appen får svara med ett kvitto: `onTalk` löser till `{ kvitto, angra? }`. Fältet visar då
 * kvittot med Ångra och Stäng och döljs inte av sig självt, eftersom det är där personen ser vad agenten gjorde. Se `talkKvitto`.
 *
 * ══ ⛔ TILLSTÅNDEN ÄR EN REN FUNKTION ═════════════════════════════════════════════════════════════════════════════════
 *
 * Ett tryck som ska bli ett klick, ett långtryck som blir en inspelning och ett släpp som INTE avslutar den är tre
 * saker som är lätta att blanda ihop i en komponent med timers. Här är de en övergångstabell som går att prova utan
 * webbläsare och utan mikrofon.
 */

import { rapporteraFel } from "./felrapport.js";
import { ordet } from "./ord.js";

/** Hur länge ett tryck måste ligga kvar för att vara ett långtryck. Samma tal som kalenderns snabbtitt och SessionStudio. */
export const LANGTRYCK_MS = 450;

/** Den enda text knappen visar medan fingret ligger kvar (CP 2026-10-04: "Den skall bara heta en sak"). */
export const TALK_ORD = "TALK";

/**
 * Mikrofonknappens namn per läge och språk (#276, granskningen av PR 383, BÖR 2). Namnet är det skärmläsaren läser och det tooltipen
 * visar, så den som inte ser att knappen är tänd hör det i stället. ⛔ EN TABELL FÖR BÅDA SPRÅKEN: förut fanns namnen bara på svenska,
 * och på engelska blev mittknappen "TALK, prata in. Hold to create", halvt svenskt, eftersom andra halvan kom ur bottenradens ordbok.
 * @type {import("./ord.js").Ordbok}
 */
export const ORD_TALKKNAPP = {
  prataIn: { sv: "TALK, prata in", en: "TALK, speak" },
  lyssnar: { sv: "TALK, lyssnar", en: "TALK, listening" },
  sparar: { sv: "TALK, sparar", en: "TALK, saving" },
  sparat: { sv: "TALK, sparat", en: "TALK, saved" },
  hort: { sv: "TALK, välj vad som ska hända", en: "TALK, choose what happens" },
};

/**
 * ⛔ TALK:S EGNA ORD PÅ BÅDA SPRÅKEN (0.104.0). Inspelningsytan (`OpsInspelning`) hade sina knappar, statusrader och fel bara på
 * svenska: i en app som ritas på engelska stod "Klar", "Avbryt" och "Försök igen" kvar. Upptäckt när `OpsTextarea` fick tal och
 * fältets egna ord var engelska medan ytans inte var det. Ytan läser nu orden här, på språket ur `useOpsSprak`.
 *
 * ⛔ DEN SVENSKA TEXTEN STÅR BARA HÄR. Konstanterna nedan (`TALK_SKICKAR_TEXT`, `TALK_PLATSTEXT`, `TALK_INGET_LJUD`, `TALK_TEXTFEL`,
 * `MIKROFON_SPARRAD_AV_SIDAN`) är ordens svenska form, så att en mening inte kan stå på två ställen och glida isär (regel 2).
 *
 * ⛔ FELEN BÄR SIN SVENSKA TEXT I TILLSTÅNDET OCH ÖVERSÄTTS NÄR DE RITAS (`talkTextPa`). `kanSpelaInIgen` och `kanBeOmMikrofon` känner
 * igen felet på dess text, och den texten får inte bero på språket. Ett fel från appen (det `onTalk` kastar) ritas som det är.
 * @type {import("./ord.js").Ordbok}
 */
export const ORD_TALK = {
  klar: { sv: "Klar", en: "Done" },
  klarNamn: { sv: "Klar, spara inspelningen", en: "Done, save the recording" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
  stang: { sv: "Stäng", en: "Close" },
  spelaIn: { sv: "Spela in", en: "Record" },
  spelaInIgen: { sv: "Spela in igen", en: "Record again" },
  tillatMikrofon: { sv: "Tillåt mikrofon", en: "Allow microphone" },
  kastaFraga: { sv: "Kasta den här inspelningen?", en: "Discard this recording?" },
  kasta: { sv: "Kasta", en: "Discard" },
  fortsatt: { sv: "Fortsätt", en: "Continue" },
  installningar: { sv: "Inställningar för TALK", en: "TALK settings" },
  valFragan: { sv: "Vad ska hända med det du sa?", en: "What should happen with what you said?" },
  valMeddelande: { sv: "Meddelande", en: "Message" },
  valHandelse: { sv: "Händelse", en: "Event" },
  valArende: { sv: "Ärende", en: "Case" },
  valAgent: { sv: "Agent", en: "Agent" },
  forslagen: { sv: "Förslag från agenten", en: "Suggestions from the agent" },
  forslagPagar: { sv: "Utför…", en: "Working…" },
  forslagKlart: { sv: "Klart", en: "Done" },
  forslagNekat: { sv: "Gjordes inte", en: "Not done" },
  sparat: { sv: "Sparat", en: "Saved" },
  angrat: { sv: "Ångrat", en: "Undone" },
  angra: { sv: "Ångra", en: "Undo" },
  angrar: { sv: "Ångrar…", en: "Undoing…" },
  skickasTill: { sv: "Skickas till", en: "Send to" },
  skickar: { sv: "Sparar…", en: "Saving…" },
  platstext: { sv: "Prata, så syns texten här", en: "Speak, and the text appears here" },
  felOkant: { sv: "Något gick fel.", en: "Something went wrong." },
  felSpara: { sv: "Det inspelade kunde inte sparas.", en: "The recording could not be saved." },
  felIngetKvar: { sv: "Inget ljud finns kvar att spara.", en: "No audio is left to save." },
  felAvsluta: { sv: "Inspelningen gick inte att avsluta.", en: "The recording could not be stopped." },
  felStarta: { sv: "Inspelningen gick inte att starta.", en: "The recording could not be started." },
  felAngra: { sv: "Det gick inte att ångra.", en: "It could not be undone." },
  felVidare: { sv: "Det du sa gick inte att lämna vidare.", en: "What you said could not be passed on." },
  felAgent: { sv: "Det du sa nådde inte agenten.", en: "What you said did not reach the agent." },
  felForslag: { sv: "Förslaget gick inte att utföra.", en: "The suggestion could not be carried out." },
  felUpptagen: { sv: "En annan inspelning pågår redan. Avsluta den först.", en: "Another recording is already in progress. Finish it first." },
  felEjTillaten: { sv: "Mikrofonen är inte tillåten. Ge sidan tillgång till mikrofonen i webbläsarens inställningar.", en: "The microphone is not allowed. Give the page access to the microphone in the browser settings." },
  felIngenMikrofon: { sv: "Ingen mikrofon hittades.", en: "No microphone was found." },
  felInspelningSaknas: { sv: "Den här webbläsaren kan inte spela in ljud.", en: "This browser cannot record audio." },
  felIngenPagar: { sv: "Ingen inspelning pågår.", en: "No recording is in progress." },
  felAvbrotsForeMikrofon: { sv: "Inspelningen avbröts innan mikrofonen öppnades.", en: "The recording was stopped before the microphone opened." },
  felSparradAvSidan: { sv: "Mikrofonen är spärrad av sidan som visar appen. Öppna appen i ett eget fönster för att spela in.", en: "The microphone is blocked by the page showing the app. Open the app in its own window to record." },
  ingetLjud: { sv: "Mikrofonen gav inget ljud, och inget hördes som text. Ingenting skickades. Tryck på Spela in igen och prata en gång till.", en: "The microphone gave no audio, and nothing was heard as text. Nothing was sent. Press Record again and speak once more." },
  textFel: { sv: "Texten kan inte visas just nu. Det du säger spelas in ändå och sparas som ljud.", en: "The text can't be shown right now. What you say is still recorded and saved as audio." },
};

/** Ett ord ur `ORD_TALK` på ett språk. @param {keyof typeof ORD_TALK} nyckel @param {string} sprak */
export function talkOrd(nyckel, sprak) {
  return ordet(ORD_TALK, nyckel, sprak);
}

/**
 * De ord i `ORD_TALK` som kan stå i tillståndet: felen (`fel*`, `ingetLjud`, `textFel`) och statusraden `skickar` ("Sparar…").
 *
 * ⛔ BARA DE (granskningen av PR 384, KAN 5). Förut slogs varje ord upp, så ett fel från appen som råkade heta som en knapp ("Stäng",
 * "Klar") ritades på engelska fast det var appens text. Knapparnas ord ritas direkt med `talkOrd` och behöver aldrig slås upp.
 */
const TALK_TILLSTANDSORD = Object.entries(ORD_TALK).filter(([k]) => k.startsWith("fel") || k === "ingetLjud" || k === "textFel" || k === "skickar").map(([, t]) => t);

/**
 * En text från TALK på ett språk: är den ett av TALK:s fel eller statusrader i sin svenska form (`TALK_TILLSTANDSORD`) ges den på
 * `sprak`, annars ritas den som den är, eftersom den då är appens.
 * @param {string} text
 * @param {string} sprak
 * @returns {string}
 */
export function talkTextPa(text, sprak) {
  if (!text) return text;
  for (const t of TALK_TILLSTANDSORD) if (t.sv === text) return /** @type {any} */ (t)[sprak] || t.sv;
  return text;
}

/**
 * Namnet på vägen in i TALK utan att hålla (#276): raden i Skapa och huvudets mikrofonknapp på dator. EN sträng, så
 * att raden och knappen inte kan börja heta olika saker. Svenska; på andra språk `talkKnappNamn("vila", sprak)`.
 */
export const TALK_PRATA_IN = ORD_TALKKNAPP.prataIn.sv;

/**
 * Huvudets mikrofonknapp och bottenradens mikrofon säger vilket läge inspelningen är i (#276), på språket som gäller.
 * @param {Talklage} lage
 * @param {string} [sprak] "sv" eller "en". Ett språk utan text ger svenska, som `ordet`.
 * @returns {string}
 */
export function talkKnappNamn(lage, sprak = "sv") {
  const nyckel = lage === "haller" || lage === "lyssnar" ? "lyssnar" : lage === "skickar" ? "sparar" : lage === "sparat" ? "sparat" : lage === "hort" ? "hort" : "prataIn";
  return ordet(ORD_TALKKNAPP, nyckel, sprak);
}

/**
 * Under den här längden kastar Avbryt direkt. Från och med den frågar fältet, för ett långt ljud som
 * försvinner på ett misstagtryck går inte att få tillbaka.
 */
export const AVBRYT_FRAGA_SEKUNDER = 3;

/** Hur länge "Sparat" står kvar innan fältet stängs. Samma tid för "Ångrat" (0.97.0). */
export const SPARAT_MS = 1400;

/**
 * Statusraden medan det inspelade lämnas till appen, när appen inte säger något annat (`talk.skickarText`, 0.97.0).
 * lifehub.app skickar "Agenten arbetar…", eftersom det är agenten och inte en uppladdning som tar tiden (lifehub.app#219).
 */
export const TALK_SKICKAR_TEXT = ORD_TALK.skickar.sv;

/**
 * Kastar när `skickarText` är satt men inte en sträng med innehåll. EN kontroll för kroken och skalet: skalet prövar den vid
 * uppstart, eftersom kroken bara får texten när appens mål är valt, och ett fel som syns först när någon pratat är för sent.
 * @param {unknown} varde
 * @param {string} vem Namnet i felet, till exempel "useTalk".
 */
export function kontrolleraSkickarText(varde, vem) {
  if (varde === undefined) return;
  if (typeof varde !== "string" || !varde.trim()) {
    throw new Error(`${vem}: skickarText ska vara en sträng som inte är tom, fick ${typeof varde === "string" ? JSON.stringify(varde) : typeof varde}. En tom statusrad hade sett ut som att ingenting pågick.`);
  }
}

/**
 * Platstexten i textytan medan man pratar och inget hörts ännu (0.97.0). ⛔ BARA NÄR TEXT FAKTISKT KAN KOMMA: utan
 * igenkänning (av som förval, Firefox) hade raden lovat något som aldrig händer.
 */
export const TALK_PLATSTEXT = ORD_TALK.platstext.sv;

/**
 * Kvittot appen kan lösa `onTalk` till (0.97.0, lifehub.app#219): vad som gjordes, och hur det tas bort igen.
 * @typedef {object} Talkkvitto
 * @property {string} kvitto Det som gjordes, i ord. Till exempel "Inlagt: Rep, torsdag 22 okt 19:00".
 * @property {() => Promise<void>} [angra] Tar bort det som gjordes. Utan den ritas ingen Ångra.
 */

/**
 * Läser appens svar från `onTalk`. `null` när svaret inte är ett kvitto: då gäller Sparat som före 0.97.0.
 *
 * ⛔ ETT SVAR UTAN `kvitto` ÄR INGET KVITTO, och det är inget fel. En moduls `spara` och äldre appar lämnar annat
 * (ingenting, ett id), och det ska fortsätta betyda Sparat.
 *
 * ⛔ ETT FELFORMAT KVITTO KASTAR. `{ kvitto: "" }` eller en `angra` som inte är en funktion är ett fel i appen, och en
 * tom rad eller en Ångra som inte gör något hade sett ut som att allt gick bra (arbetsreglernas punkt 5).
 *
 * @param {unknown} svar
 * @returns {{ text: string, angra: (() => Promise<void>) | null } | null}
 */
export function talkKvitto(svar) {
  if (!svar || typeof svar !== "object" || !("kvitto" in svar)) return null;
  const { kvitto, angra } = /** @type {{ kvitto: unknown, angra?: unknown }} */ (svar);
  if (typeof kvitto !== "string" || !kvitto.trim()) {
    throw new Error(`TALK: onTalk löste till ett kvitto utan text (${JSON.stringify(kvitto) ?? String(kvitto)}). Kvittot ska säga vad som gjordes.`);
  }
  if (angra !== undefined && typeof angra !== "function") {
    throw new Error(`TALK: kvittots angra ska vara en funktion, fick ${typeof angra}. Utan den ritas ingen Ångra.`);
  }
  return { text: kvitto.trim(), angra: typeof angra === "function" ? /** @type {() => Promise<void>} */ (angra) : null };
}

/*
 * ══ ⛔ DET SAGDA SOM UNDERLAG (0.103.0, ändrat 0.105.0) ══════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-14, med en skärmbild av TALK-panelen: "talk gör att man pratar in så att man ser texten direkt i realtid. Sen så finns
 * de tre knapparna där direkt. Meddelande, ärende, kalender. Och sen så adderar vi en agentknapp." Och efter förslaget om var
 * dialogen ska stå: "Kör chatten". Dialogen med agenten står i chatten, inte i fältet. Fältet håller därför ingen historik längre,
 * och underlaget en mottagare får är det personen sade i den här omgången.
 *
 * ⛔ 0.103.0 HADE HISTORIKEN OCH `samtal` OCH `rader` I UNDERLAGET. De fanns för att fältet bar en dialog med flera omgångar
 * (Svara). Den dialogen är flyttad till chatten (Agent), så en historik i fältet hade varit en andra kopia av samtalet som står där.
 */

/**
 * Det en mottagare får när personen trycker på Meddelande, Händelse eller Ärende.
 * @typedef {object} Talkunderlag
 * @property {string} text Det personen sade.
 */

/**
 * Underlaget ur det som hördes, eller `null` när inget hördes.
 *
 * ⛔ `null` NÄR INGEN TEXT FINNS, OCH DÅ RITAS INGA VAL. En knapp som lovar det sagda och lämnar ingenting är samma tysta nedsläpp
 * som regel 5 förbjuder, bara med ett formulär framför.
 *
 * @param {string} text
 * @returns {Talkunderlag | null}
 */
export function talkUnderlag(text) {
  const t = typeof text === "string" ? text.trim() : "";
  return t ? { text: t } : null;
}

/**
 * Längsta rubrik skalet fyller i ur samtalet (0.103.0). ⛔ Formuläret är appens och ramverket vet inte dess tak, så talet är valt
 * under det appar faktiskt har: bolag-ops tar 120 tecken både för en händelses rubrik (`MAX_RUBRIK`) och ett ärendes (`MAX_TITLE`),
 * mätt 2026-10-14. 80 ryms i båda och läses på en rad i telefonens lista.
 */
export const TALK_RUBRIK_MAX = 80;

/**
 * Rubrik och beskrivning ur det personen sade, för ett formulär som öppnas ifyllt (0.103.0).
 *
 * Regeln:
 *   1. Rubriken är FÖRSTA MENINGEN: fram till en punkt, ett utrop eller ett frågetecken som följs av en stor bokstav eller av
 *      textens slut, eller fram till första radbrytningen. "kl. 19" delar alltså inte. En avslutande punkt tas bort (en rubrik
 *      har ingen), och första bokstaven blir stor: taligenkänningen skriver ofta allt med gemener.
 *   2. Beskrivningen är RESTEN, efter första meningen. Tom när allt som sades var en mening.
 *   3. ⛔ ÄR FÖRSTA MENINGEN LÄNGRE ÄN TAKET kapas rubriken vid sista mellanslaget före taket och får "…", och då är
 *      beskrivningen HELA TEXTEN. Annars hade slutet av första meningen försvunnit mellan rubriken och beskrivningen.
 *      Chromes taligenkänning sätter sällan punkt på svenska, så det här är det vanliga fallet och inte ett undantag.
 *
 * @param {string} text Underlagets `text`.
 * @param {number} [tak] Förval `TALK_RUBRIK_MAX`.
 * @returns {{ rubrik: string, beskrivning: string }}
 */
export function talkForifyllt(text, tak = TALK_RUBRIK_MAX) {
  if (!Number.isInteger(tak) || tak < 2) throw new Error(`talkForifyllt: taket ska vara ett heltal från 2, fick ${String(tak)}.`);
  const ren = String(text ?? "").trim();
  const slut = ren.search(/[.!?](?=\s+\p{Lu}|\s*$)|\n/u);
  const forsta = (slut === -1 ? ren : ren.slice(0, ren[slut] === "\n" ? slut : slut + 1)).trim();
  const rest = slut === -1 ? "" : ren.slice(slut + 1).trim();
  const utanPunkt = forsta.replace(/\.$/, "");
  const stor = utanPunkt ? utanPunkt.charAt(0).toLocaleUpperCase("sv") + utanPunkt.slice(1) : "";
  if (stor.length <= tak) return { rubrik: stor, beskrivning: rest };
  const kap = stor.slice(0, tak - 1);
  const mellan = kap.lastIndexOf(" ");
  return { rubrik: `${(mellan > tak / 2 ? kap.slice(0, mellan) : kap).trimEnd()}…`, beskrivning: ren };
}

/** Längsta inspelningen. Ett fält som glömts öppet ska inte spela in i en timme. */
export const MAX_SEKUNDER = 120;

/**
 * @typedef {"vila" | "trycker" | "haller" | "lyssnar" | "skickar" | "hort" | "sparat" | "fel"} Talklage
 * - `vila`: inget pågår.
 * - `trycker`: fingret är nere men långtrycket har inte inträffat. Ett släpp här är ett vanligt klick.
 * - `haller`: långtrycket har inträffat och inspelningen pågår medan fingret ligger kvar. Knappen visar TALK.
 * - `lyssnar`: fingret är släppt och inspelningen fortsätter i fältet.
 * - `skickar`: inspelningen är stoppad och ljudet lämnas till appen. Fältet säger Sparar.
 * - `hort` (0.105.0): inspelningen är stoppad, det sagda står i fältet, och personen väljer vad som ska hända: Meddelande, Händelse,
 *   Ärende eller Agent. Bara när appen ger `onAgent` och något hördes. Inget har lämnats till appen ännu.
 * - `sparat`: appen tog emot ljudet. Fältet säger Sparat en kort stund, sedan vila. Med ett kvitto (0.97.0) står kvittot kvar
 *   med Ångra och Stäng tills personen stänger det, och efter en lyckad Ångra står "Ångrat" en kort stund.
 * - `fel`: mikrofonen gick inte att öppna, eller appen svarade med ett fel. Fältet säger varför.
 */

/**
 * @typedef {{ typ: "ner" } | { typ: "direkt" } | { typ: "langtryck" } | { typ: "upp" } | { typ: "skicka" } | { typ: "igen" } | { typ: "avbryt" } | { typ: "klar" } | { typ: "dolj" } | { typ: "fel", text: string } | { typ: "tak" } | { typ: "hort" } | { typ: "agent" } | { typ: "agentFel", text: string } | { typ: "lamnat" }} Talkhandelse
 */

/**
 * Nästa läge, och vad komponenten ska göra (`gor`). En händelse som inte passar läget ändrar ingenting.
 *
 * ⛔ "UPP" EFTER ETT LÅNGTRYCK AVSLUTAR INTE. Det är hela poängen med fältet: man släpper och pratar vidare. Klar
 * sparar och Avbryt kastar. Ett tryck på Klar under sparningen gör ingenting.
 *
 * ⛔ "UPP" FÖRE LÅNGTRYCKET ÄR ETT KLICK, och klicket är Skapa som förut. Ett tryck som råkade bli 300 ms ska aldrig
 * starta en inspelning.
 *
 * ⛔ LÄGET HÖRT (0.105.0) LÄMNAR INGENTING SJÄLVT. Bara ett val gör något: Agent (`agent`) lämnar det sagda till appens `onAgent`, och
 * Meddelande, Händelse och Ärende lämnar det till sin mottagare och stänger (`lamnat`). Stäng kastar.
 *
 * ⛔ FALLER AGENT GÅR FÄLTET TILLBAKA TILL HÖRT, med felet (`agentFel`, granskningen av PR 387). Förut blev det läget `fel` med Försök
 * igen, och då stod varken det sagda eller valen kvar: den som inte nådde agenten kunde inte välja Meddelande eller Ärende i stället.
 * Ett nytt tryck på Agent är Försök igen.
 *
 * @param {{ lage: Talklage, fel?: string }} nu
 * @param {Talkhandelse} h
 * @returns {{ lage: Talklage, fel?: string, gor: null | "klick" | "starta" | "skicka" | "igen" | "kasta" | "agent" }}
 */
export function talkNasta(nu, h) {
  /** @param {Talklage} lage @param {null | "klick" | "starta" | "skicka" | "igen" | "kasta" | "agent"} [gor] @param {string} [fel] */
  const bli = (lage, gor = null, fel = undefined) => ({ lage, gor, ...(fel ? { fel } : {}) });
  switch (nu.lage) {
    case "vila":
      if (h.typ === "ner") return bli("trycker");
      // ⛔ RADEN "TALK, prata in" I SKAPA: ingen hand att hålla, så den går rakt till fältet.
      if (h.typ === "direkt") return bli("lyssnar", "starta");
      return bli("vila");
    case "trycker":
      if (h.typ === "langtryck") return bli("haller", "starta");
      if (h.typ === "upp") return bli("vila", "klick");
      if (h.typ === "avbryt") return bli("vila");
      return bli("trycker");
    case "haller":
      if (h.typ === "upp") return bli("lyssnar");
      if (h.typ === "skicka" || h.typ === "tak") return bli("skickar", "skicka");
      if (h.typ === "avbryt") return bli("vila", "kasta");
      if (h.typ === "fel") return bli("fel", "kasta", h.text);
      return bli("haller");
    case "lyssnar":
      if (h.typ === "skicka" || h.typ === "tak") return bli("skickar", "skicka");
      if (h.typ === "avbryt") return bli("vila", "kasta");
      if (h.typ === "fel") return bli("fel", "kasta", h.text);
      return bli("lyssnar");
    case "skickar":
      // ⛔ Ett andra tryck på Klar medan sparningen pågår gör ingenting. Ljudet är redan stoppat och lämnat.
      if (h.typ === "klar") return bli("sparat");
      if (h.typ === "hort") return bli("hort");
      // Agenten tog emot det sagda och appen tog över (chatten öppnades): fältet har inget mer att visa.
      if (h.typ === "lamnat") return bli("vila", "kasta");
      if (h.typ === "agentFel") return bli("hort", null, h.text);
      if (h.typ === "fel") return bli("fel", null, h.text);
      return bli("skickar");
    case "hort":
      if (h.typ === "agent") return bli("skickar", "agent");
      if (h.typ === "lamnat" || h.typ === "avbryt") return bli("vila", "kasta");
      if (h.typ === "direkt") return bli("lyssnar", "starta");
      if (h.typ === "ner") return bli("trycker");
      if (h.typ === "fel") return bli("fel", null, h.text);
      return bli("hort", null, nu.fel);
    case "sparat":
      if (h.typ === "dolj" || h.typ === "avbryt") return bli("vila");
      // Bekräftelsen låser inte nästa inspelning. Ett nytt tryck på mikrofonen får börja direkt.
      if (h.typ === "direkt") return bli("lyssnar", "starta");
      if (h.typ === "ner") return bli("trycker");
      return bli("sparat");
    case "fel":
      if (h.typ === "avbryt" || h.typ === "klar") return bli("vila");
      if (h.typ === "igen") return bli("skickar", "igen");
      if (h.typ === "ner") return bli("trycker");
      if (h.typ === "direkt") return bli("lyssnar", "starta");
      return bli("fel", null, nu.fel);
    default:
      return bli("vila");
  }
}

/**
 * Formaten i den ordning de prövas.
 *
 * ⛔ SAFARI FÖRST (lifehub.app#163). iOS och Safari spelar bara in `audio/mp4`
 * (AAC). Chromium och Firefox kan båda, och tar webm om mp4 saknas. Att pröva
 * webm först gav Safari ett tomt svar när den felaktigt nekade hela listan, och
 * inspelningen startade utan mimeType som sedan föll på webm-reserven i stoppa.
 */
export const LJUDFORMAT = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

/**
 * Det första format webbläsaren kan spela in, eller `""` när den inte säger något (då väljer webbläsaren själv).
 * @param {(typ: string) => boolean} [kan] `MediaRecorder.isTypeSupported`.
 * @returns {string}
 */
export function valjFormat(kan) {
  if (typeof kan !== "function") return "";
  return LJUDFORMAT.find((f) => kan(f)) || "";
}

/**
 * Om felet är att mikrofonen inte är tillåten, och personen kan pröva igen med
 * ett tryck (getUserMedia kräver en gest). Sidans Permissions-Policy är nej:
 * då hjälper inte knappen, och den ska inte ritas.
 *
 * @param {string | undefined} feltext
 * @returns {boolean}
 */
export function kanBeOmMikrofon(feltext) {
  if (typeof feltext !== "string" || !feltext) return false;
  if (feltext === MIKROFON_SPARRAD_AV_SIDAN) return false;
  return feltext.includes("Mikrofonen är inte tillåten");
}

/**
 * ⛔ INGET LJUD OCH INGEN TEXT (lifehub.app#253). CP 2026-10-14 på iPhone: "Ljudinspelning. Efter att jag fått en fråga så kan man
 * inte spela in mer ljud." Andra omgången i samma samtal gav 0 byte ljud och ingen text, och `useTalk` lämnade ändå det tomma till
 * appen. Appen skickade det vidare, servern svarade "Inget ljud kom fram. Försök igen.", och Försök igen skickade samma 0 byte en
 * gång till, för alltid. Nu skickas ingenting, fältet säger det här, och Spela in igen startar en ny omgång med ny ström och ny
 * igenkänning. Meningen säger vad som hände och vad man gör, och den är sann: ingenting lämnade telefonen.
 */
export const TALK_INGET_LJUD = ORD_TALK.ingetLjud.sv;

/**
 * Om fältet ska erbjuda en ny inspelning i stället för Försök igen: när det som fanns att skicka var tomt (`TALK_INGET_LJUD`).
 * Försök igen hade skickat samma tomma ljud igen.
 * @param {string | undefined} feltext
 * @returns {boolean}
 */
export function kanSpelaInIgen(feltext) {
  return feltext === TALK_INGET_LJUD;
}

/**
 * Om alla ljudspår i en ström är tysta enligt webbläsaren: `muted` eller redan avslutade. En ström utan spår, eller ett spår som inte
 * säger något om sig (proven), räknas inte som tyst.
 * @param {unknown} strom
 * @returns {boolean}
 */
export function tystStrom(strom) {
  const s = /** @type {any} */ (strom);
  const spar = typeof s?.getAudioTracks === "function" ? s.getAudioTracks() : typeof s?.getTracks === "function" ? s.getTracks() : [];
  return Array.isArray(spar) && spar.length > 0 && spar.every((t) => t?.muted === true || t?.readyState === "ended");
}

/**
 * Det inspelaren såg om strömmen, för felrapporten när ljudet blev tomt (lifehub.app#253). ⛔ SKÄLET ÄR REGEL 3: orsaken på iOS är en
 * hypotes, och de här fälten är det som kan avgöra den ur en riktig telefon.
 * @typedef {object} Inspelningsdiagnos
 * @property {boolean} tystVidStart Strömmen som spelades in var tyst när inspelningen började (efter en eventuell omhämtning).
 * @property {boolean} omhamtad Den första strömmen var tyst och en ny hämtades.
 * @property {boolean} tystVidStopp Strömmen var tyst när inspelningen stoppades.
 * @property {number} bitar Antalet bitar med data som webbläsaren lämnade.
 * @property {Sparlage[]} sparVidStart (0.107.0) Varje ljudspår när inspelningen började.
 * @property {Sparlage[]} sparVidStopp (0.107.0) Varje ljudspår när inspelningen stoppades, före `stop()` på spåren.
 * @property {string} ljudkontextVidStart (0.107.0) `AudioContext.state` när nivåmätaren kopplats in, eller "ingen".
 * @property {string} ljudkontextVidStopp (0.107.0) `AudioContext.state` vid stoppet, före `close()`, eller "ingen".
 * @property {{ hann: boolean, ms: number } | null} forraLjudkontext (0.107.0) Om förra omgångens `AudioContext.close()` hann
 *   lösas innan den här omgångens `getUserMedia`, och hur länge det tog. `null` när ingen förra fanns.
 * @property {boolean} stannadeSjalv (0.107.0) Inspelaren hade redan stannat när Klar trycktes (spåret tog slut), så inget
 *   `stop`-event kunde komma.
 * @property {boolean} stoppetHann (0.107.0) `stop`-eventet kom inom `STOPP_VANTA_MS`. `false` betyder att inspelaren gav upp på det.
 */

/**
 * Ett ljudspårs läge som webbläsaren beskriver det, för diagnosen (0.107.0). ⛔ INGET OM PERSONEN: inga etiketter, inga id:n,
 * ingen enhetsbeteckning. Bara de tre fält som säger om spåret kunde ge ljud.
 * @typedef {{ readyState: string, muted: boolean, enabled: boolean }} Sparlage
 */

/**
 * Spårens läge i en ström (0.107.0). En ström utan spår ger en tom lista, och en som saknas likaså.
 * @param {unknown} strom
 * @returns {Sparlage[]}
 */
export function sparLage(strom) {
  const s = /** @type {any} */ (strom);
  const spar = typeof s?.getAudioTracks === "function" ? s.getAudioTracks() : typeof s?.getTracks === "function" ? s.getTracks() : [];
  if (!Array.isArray(spar)) return [];
  return spar.map((t) => ({ readyState: String(t?.readyState ?? "okant"), muted: t?.muted === true, enabled: t?.enabled !== false }));
}

/**
 * Så länge en ny omgång väntar på att förra omgångens `AudioContext` stängts innan mikrofonen öppnas (0.107.0). Ett tak, så att en
 * `close()` som aldrig löser sig inte låser fältet.
 */
export const LJUDKONTEXT_VANTA_MS = 1000;

/**
 * Så länge `stoppa` väntar på inspelarens `stop`-event (0.107.0). ⛔ SKÄLET: en inspelare vars spår tagit slut har redan stannat av
 * sig själv, och `stop()` på en inspelare som inte spelar in gör ingenting, alltså kommer inget event. Förut väntade `stoppa` då för
 * evigt: fältet stod på Sparar, mikrofonspärren (`mikrofonenUpptagenAv` i OpsTalk) släpptes aldrig, och ingen annan del av sidan
 * kunde spela in.
 */
export const STOPP_VANTA_MS = 2000;

/**
 * En inspelare: det komponenten behöver av webbläsaren, och inget mer.
 * @typedef {object} Inspelare
 * @property {() => Promise<void>} starta Öppnar mikrofonen och börjar spela in. Kastar med webbläsarens fel.
 * @property {() => Promise<{ blob: Blob, mimeType: string, sekunder: number, diagnos?: Inspelningsdiagnos }>} stoppa Slutar och lämnar ljudet.
 *   ⛔ Ljudet kan vara 0 byte (en tyst ström ger inga bitar). Inspelaren kastar inte för det: `useTalk` avgör om något finns att skicka,
 *   eftersom bara den vet om texten kom fram.
 * @property {() => void} kasta Slutar och kastar ljudet. Mikrofonen släpps.
 * @property {() => number} niva Ljudnivån just nu, 0 till 1, för prickarna.
 */

/**
 * Inspelaren mot webbläsarens `MediaRecorder`. Används när appen inte skickar in en egen (proven gör det).
 *
 * ⛔ MIKROFONEN SLÄPPS ALLTID, också när inspelningen kastas. En flik som håller mikrofonen öppen visar en röd prick i
 * statusraden, och den som ser den efter att ha tryckt på krysset slutar lita på knappen.
 *
 * ⛔ ALLT FÖRRA OMGÅNGEN ÖPPNADE ÄR SLÄPPT INNAN NÄSTA ÖPPNAS (0.107.0, lifehub.app#253). Spåren stoppas när omgången slutar, och
 * en ny omgång väntar på förra omgångens `AudioContext.close()` (högst `LJUDKONTEXT_VANTA_MS`) innan den öppnar mikrofonen. ⛔ HYPOTES,
 * INTE MÄTT PÅ EN IPHONE: att en ljudkontext som ännu inte stängts håller kvar telefonens ljudpass. Vad som hände står i `diagnos`.
 *
 * @param {{ mediaDevices?: MediaDevices, MediaRecorder?: typeof MediaRecorder, AudioContext?: typeof AudioContext, nu?: () => number, setTimeout?: (f: () => void, ms: number) => unknown }} [miljo]
 * @returns {Inspelare}
 */
export function webblasarensInspelare(miljo = {}) {
  const md = miljo.mediaDevices || (typeof navigator !== "undefined" ? navigator.mediaDevices : undefined);
  const MR = miljo.MediaRecorder || (typeof MediaRecorder !== "undefined" ? MediaRecorder : undefined);
  const AC = miljo.AudioContext || (typeof AudioContext !== "undefined" ? AudioContext : undefined);
  const nu = miljo.nu || (() => Date.now());
  const vanta = miljo.setTimeout || ((/** @type {() => void} */ f, /** @type {number} */ ms) => setTimeout(f, ms));
  /** @type {MediaStream | null} */
  let strom = null;
  /** @type {MediaRecorder | null} */
  let rec = null;
  /** @type {Blob[]} */
  let bitar = [];
  let start = 0;
  /** Det format `starta` valde. `stoppa` faller tillbaka på det om bitarna saknar typ. */
  let valtFormat = "";
  /** @type {AnalyserNode | null} */
  let analys = null;
  /** @type {AudioContext | null} */
  let ctx = null;
  /**
   * ⛔ VARJE START ÄGER SIN STRÖM TILLS DEN ÄR INKOPPLAD (#281). En ny start räknar upp numret, och en ström som öppnas för
   * ett äldre försök stängs direkt, i stället för att skriva över den som gäller eller stå kvar med webbläsarens
   * inspelningsprick. Ett försök som bara avbrutits, utan en ny start, stänger `useTalk` när svaret kommer.
   */
  let forsok = 0;
  /** Det `starta` såg om strömmen, för `diagnos`. */
  let tystVidStart = false;
  let omhamtad = false;
  /** Om den pågående inspelarens stop-event redan kommit (KAN 1, varv 2). */
  let stoppSett = false;
  /** @type {Sparlage[]} */
  let sparVidStart = [];
  let ljudkontextVidStart = "ingen";
  /** @type {{ hann: boolean, ms: number } | null} */
  let forraLjudkontext = null;
  /** Förra omgångens `close()`, tills den löst sig. @type {Promise<void> | null} */
  let stangs = null;
  /**
   * Väntar på förra omgångens `close()`, högst `LJUDKONTEXT_VANTA_MS`. `null` när ingen fanns.
   * @returns {Promise<{ hann: boolean, ms: number } | null>}
   */
  const vantaPaLjudkontext = () => {
    const p = stangs;
    if (!p) return Promise.resolve(null);
    const t0 = nu();
    return new Promise((klar) => {
      let gjort = false;
      /** @param {boolean} hann */
      const sluta = (hann) => {
        if (gjort) return;
        gjort = true;
        // ⛔ Också när taket gått ut (granskningen av PR 392, KAN 4). Annars väntade varje följande omgång 1 s på samma `close()` så
        // länge ingen ny ljudkontext skapades (konstruktorn kastar). En gång räcker: den fick sin chans.
        if (stangs === p) stangs = null;
        klar({ hann, ms: Math.max(0, nu() - t0) });
      };
      p.then(() => sluta(true), () => sluta(true));
      vanta(() => sluta(false), LJUDKONTEXT_VANTA_MS);
    });
  };
  /**
   * Strömmen för försöket `mitt`, eller ett fel när ett nyare försök startat under tiden (då stängs den direkt, se `forsok`).
   * @param {number} mitt
   */
  const hamta = async (mitt) => {
    const s = await /** @type {MediaDevices} */ (md).getUserMedia({ audio: true });
    if (mitt !== forsok) {
      s.getTracks().forEach((t) => t.stop());
      throw new Error(ORD_TALK.felAvbrotsForeMikrofon.sv);
    }
    return s;
  };
  const slapp = () => {
    strom?.getTracks().forEach((t) => t.stop());
    strom = null;
    if (ctx) {
      const c = ctx;
      try {
        const p = Promise.resolve(c.close()).catch(() => {});
        stangs = p;
        p.then(() => {
          if (stangs === p) stangs = null;
        });
      } catch {
        // En ljudkontext som redan är stängd kastar. Den håller ingenting.
      }
    }
    ctx = null;
    analys = null;
  };
  return {
    async starta() {
      if (!md || !MR) throw new Error(ORD_TALK.felInspelningSaknas.sv);
      forsok += 1;
      const mitt = forsok;
      // ⛔ FÖRRA OMGÅNGENS LJUDKONTEXT FÖRST (0.107.0). Se filhuvudet ovanför. Ingen väntan när ingen fanns.
      forraLjudkontext = stangs ? await vantaPaLjudkontext() : null;
      if (mitt !== forsok) throw new Error(ORD_TALK.felAvbrotsForeMikrofon.sv);
      let ny = await hamta(mitt);
      omhamtad = false;
      /*
       * ⛔ EN TYST STRÖM HÄMTAS OM, EN GÅNG (lifehub.app#253). ⛔ HYPOTES, INTE MÄTT PÅ EN IPHONE: WebKit på iOS kan lämna en ström
       * vars spår alla är `muted` när taligenkänningen (`SpeechRecognition`) nyss haft mikrofonen, eftersom den tar ljudet genom
       * en egen väg och telefonen har ett ljudpass åt gången. En inspelning på en sådan ström ger 0 byte, och det var vad andra
       * omgången efter agentens fråga gav (servern svarade "Inget ljud kom fram"). Skälet att pröva en ny ström är att det är
       * billigt och inte kan göra en fungerande inspelning sämre: en ström som inte är tyst rörs inte. EN gång och inte i en
       * slinga: är också den nya tyst spelas den in ändå, och blir ljudet tomt säger fältet det (`TALK_INGET_LJUD`).
       * Vad som faktiskt hände står i `diagnos`, som `useTalk` rapporterar när ljudet blev tomt.
       */
      if (tystStrom(ny)) {
        ny.getTracks().forEach((t) => t.stop());
        omhamtad = true;
        ny = await hamta(mitt);
      }
      tystVidStart = tystStrom(ny);
      sparVidStart = sparLage(ny);
      strom = ny;
      /*
       * ⛔ FALLER STARTEN EFTER ATT MIKROFONEN ÖPPNATS SLÄPPS DEN HÄR (0.107.0). Förut stod strömmen kvar när `new MediaRecorder` eller
       * `start()` kastade, och bara en `kasta()` utifrån stängde den. En anropare som inte hann göra det (ett nyare försök ägde
       * fältet) lämnade mikrofonen öppen med webbläsarens inspelningsprick.
       */
      try {
        valtFormat = valjFormat(MR.isTypeSupported?.bind(MR));
        rec = new MR(strom, valtFormat ? { mimeType: valtFormat } : undefined);
        bitar = [];
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) bitar.push(e.data);
        };
        /*
         * ⛔ OM STOPP-EVENTET REDAN KOMMIT (granskningen av PR 392 varv 2, KAN 1). Enligt specifikationen blir `state` "inactive" först,
         * och sista `dataavailable` och `stop` kommer i en köad uppgift. Bara när `stop` faktiskt setts har webbläsaren lämnat allt,
         * och bara då får `stoppa` svara direkt. `stoppa` byter hanteraren mot sin egen.
         */
        stoppSett = false;
        rec.onstop = () => {
          stoppSett = true;
        };
        rec.start(250);
      } catch (fel) {
        rec = null;
        bitar = [];
        valtFormat = "";
        slapp();
        throw fel;
      }
      start = nu();
      ljudkontextVidStart = "ingen";
      if (AC) {
        try {
          ctx = new AC();
          const kalla = ctx.createMediaStreamSource(strom);
          analys = ctx.createAnalyser();
          analys.fftSize = 256;
          kalla.connect(analys);
        } catch {
          // ⛔ Nivån är bara prickarnas rörelse. Utan den spelas det ändå in, och prickarna står stilla.
          analys = null;
        }
        ljudkontextVidStart = String(ctx?.state ?? "ingen");
      }
    },
    stoppa() {
      return new Promise((klar, fel) => {
        if (!rec) {
          fel(new Error(ORD_TALK.felIngenPagar.sv));
          return;
        }
        const r = rec;
        // ⛔ Läget före stoppet: när spåren stoppas i `slapp` säger de bara "ended".
        const tystVidStopp = tystStrom(strom);
        const sparVidStopp = sparLage(strom);
        const ljudkontextVidStopp = String(ctx?.state ?? "ingen");
        // ⛔ Stannad betyder att stop-eventet redan kommit (KAN 1, varv 2), inte bara att `state` är "inactive".
        const stannadeSjalv = r.state === "inactive" && stoppSett;
        let gjort = false;
        /** @param {boolean} stoppetHann */
        const avsluta = (stoppetHann) => {
          if (gjort) return;
          gjort = true;
          r.onstop = null;
          /*
           * ⛔ OCKSÅ `ondataavailable` (granskningen av PR 392, MÅSTE 1). Gick taket ut stod den kvar och skrev till `bitar`, som nästa
           * `starta` byter till en ny lista. En bit som kom efter taket hamnade då FÖRST i nästa omgångs ljud: mätt 8 byte i stället
           * för 2, med det personen sade förra gången i början. Vid ett vanligt stopp har webbläsaren redan lämnat sista biten.
           */
          r.ondataavailable = null;
          // ⛔ Reserv är mp4: Safari sparar utan mimeType på bitarna. webm som
          // reserv hade gett en fil Chromium inte kunde spela när den egentligen
          // var AAC i en mp4-container.
          const mimeType = r.mimeType || (bitar[0] && bitar[0].type) || valtFormat || "audio/mp4";
          const blob = new Blob(bitar, { type: mimeType });
          const sekunder = Math.round((nu() - start) / 100) / 10;
          /** @type {Inspelningsdiagnos} */
          const diagnos = { tystVidStart, omhamtad, tystVidStopp, bitar: bitar.length, sparVidStart, sparVidStopp, ljudkontextVidStart, ljudkontextVidStopp, forraLjudkontext, stannadeSjalv, stoppetHann };
          if (rec === r) {
            rec = null;
            valtFormat = "";
            slapp();
          }
          klar({ blob, mimeType, sekunder, diagnos });
        };
        // ⛔ EN INSPELARE SOM REDAN STANNAT GER INGET STOPP-EVENT (0.107.0). Se `STOPP_VANTA_MS`.
        if (stannadeSjalv) {
          avsluta(true);
          return;
        }
        r.onstop = () => avsluta(true);
        vanta(() => avsluta(false), STOPP_VANTA_MS);
        // ⛔ En inspelare som är "inactive" men vars stop-event ligger i kö får inget nytt `stop()`: eventet kommer ändå, under taket.
        if (r.state === "inactive") return;
        try {
          r.stop();
        } catch {
          avsluta(false);
        }
      });
    },
    kasta() {
      // ⛔ (0.107.0) Ett försök vars mikrofon ännu inte öppnats stängs när den öppnas (`hamta`), i stället för att börja spela in.
      forsok += 1;
      // ⛔ Samma skäl som i `stoppa`: en bit som kommer efter kastet får inte hamna i nästa omgång (PR 392, MÅSTE 1).
      if (rec) rec.ondataavailable = null;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        try {
          rec.stop();
        } catch {
          // Redan stoppad. Spåren stoppas nedan ändå.
        }
      }
      rec = null;
      bitar = [];
      valtFormat = "";
      slapp();
    },
    niva() {
      if (!analys) return 0;
      const data = new Uint8Array(analys.frequencyBinCount);
      analys.getByteTimeDomainData(data);
      let max = 0;
      for (const v of data) max = Math.max(max, Math.abs(v - 128));
      return Math.min(1, max / 64);
    },
  };
}

/**
 * Om sidan själv får använda mikrofonen, enligt dess Permissions-Policy. `true` eller `false` när webbläsaren kan svara, `null`
 * när den inte kan (Firefox och Safari har ingen av frågorna, och då vet vi inget). ⛔ Chromium har bara den äldre
 * `document.featurePolicy` påslagen; `document.permissionsPolicy` är standardnamnet men står bakom en flagga, därför båda.
 *
 * ⛔ SPÄRRAD AV SIDAN ÄR INTE SAMMA SAK SOM NEKAD AV PERSONEN (lifehub.app#103, lane 13). my.life-hub.app får visas i en ram
 * (`frame-ancestors` tillåter Identity och life-hub.app). En ram utan `allow="microphone"`, eller en `Permissions-Policy:
 * microphone=()`, ger samma `NotAllowedError` som när personen sagt nej, men webbläsarens inställningar kan inte häva den.
 * Att då be personen ändra inställningarna är en instruktion som inte går att följa.
 *
 * @param {unknown} [doc] Förval `globalThis.document`.
 * @returns {boolean | null}
 */
export function mikrofonenTillatenAvSidan(doc = globalThis.document) {
  const d = /** @type {any} */ (doc);
  const policy = d?.permissionsPolicy ?? d?.featurePolicy;
  if (!policy || typeof policy.allowsFeature !== "function") return null;
  try {
    return Boolean(policy.allowsFeature("microphone"));
  } catch {
    return null;
  }
}

/** När sidans Permissions-Policy spärrar mikrofonen. Exporteras för appar som vill visa samma ord. */
export const MIKROFON_SPARRAD_AV_SIDAN = ORD_TALK.felSparradAvSidan.sv;

/**
 * Felet som en människa läser, ur webbläsarens fel. ⛔ ORDET OCH INTE NAMNET: "NotAllowedError" säger ingenting i en
 * telefon, "Mikrofonen är inte tillåten" säger vad man ska göra.
 *
 * ⛔ SIDANS POLICY PRÖVAS FÖRE TEXTEN OM INSTÄLLNINGARNA. Se `mikrofonenTillatenAvSidan`. Svarar webbläsaren inte står texten om
 * inställningarna kvar, eftersom den då är den enda som kan stämma.
 *
 * @param {unknown} fel
 * @param {{ sidanTillater?: boolean | null }} [val] Förval: `mikrofonenTillatenAvSidan()`.
 * @returns {string}
 */
export function talkFeltext(fel, val = {}) {
  const namn = fel && typeof fel === "object" && "name" in fel ? String(/** @type {any} */ (fel).name) : "";
  if (namn === "NotAllowedError" || namn === "SecurityError") {
    const sidanTillater = "sidanTillater" in val ? val.sidanTillater : mikrofonenTillatenAvSidan();
    if (sidanTillater === false) return MIKROFON_SPARRAD_AV_SIDAN;
    return ORD_TALK.felEjTillaten.sv;
  }
  if (namn === "NotFoundError") return ORD_TALK.felIngenMikrofon.sv;
  const text = fel instanceof Error ? fel.message : String(fel || "");
  return text || ORD_TALK.felStarta.sv;
}

/*
 * ══ ⛔ TEXT MEDAN MAN PRATAR (0.96.0, cllp/lifehub.app#209) ═════════════════════════════════════════════════════════
 *
 * CP 2026-10-13: "Min upplevelse är att det nu tar lång tid för transkribering och det är ingen smidig AI upplevelse." Och
 * om förslagen: "vi kör på 3 direkt", alltså text som syns medan man pratar.
 *
 * Webbläsarens taligenkänning (`SpeechRecognition`, i Safari och Chrome `webkitSpeechRecognition`) ger orden medan de sägs.
 * Fältet visar dem, och när texten är hel följer den med till appen (`onTalk(blob, { text })`). Appen kan då skicka texten i
 * stället för ljudet, och text tolkas på en bråkdel av tiden.
 *
 * ⛔ LJUDET SPELAS IN SOM FÖRUT, ALLTID. Igenkänningen är ett tillägg, aldrig en ersättning. Saknar webbläsaren den (Firefox),
 * nekas den, eller faller den mitt i, blir texten tom och appen får ljudet som i dag. En halv text följer aldrig med som om den
 * vore hel (arbetsreglernas punkt 5): ett fel under igenkänningen gör hela texten ogiltig.
 *
 * ⛔ VART LJUDET GÅR. Chrome skickar ljudet till Googles taltjänst och Safari till Apples. Det är en annan väg än appens egen
 * modell, och därför kan appen stänga av den (`useTalk({ igenkanning: false })`).
 */

/**
 * @typedef {object} Igenkanning
 * @property {(val: { sprak: string, onText: (text: string) => void, onFel?: (kod: string) => void }) => void} starta Börjar lyssna. `onText` får hela texten hittills.
 *   `onFel` (0.99.0) får en kod när igenkänningen inte går att starta eller faller med ett riktigt fel, så att fältet kan säga det.
 * @property {() => Promise<string>} stoppa Slutar och ger den slutliga texten, eller tom sträng när den inte går att lita på.
 * @property {() => void} kasta Slutar utan att vänta.
 * @property {() => Igenkanningsslut | null | Promise<Igenkanningsslut | null>} [slapp] (0.107.0) Avslutar förra omgångens igenkännare
 *   helt: `abort()` om den inte redan sagt `end`, och väntar på `end`, högst `IGENKANNING_SLAPP_MS`. ⛔ ETT LÖFTE BARA NÄR DET FINNS
 *   NÅGOT ATT VÄNTA PÅ: annars svaret direkt (`null` när ingen igenkännare funnits), så att mikrofonen öppnas i samma tryck som förut.
 *   `useTalk` väntar på den innan nästa omgång öppnar mikrofonen. En app som ger en egen igenkänning utan `slapp` får ingen väntan.
 */

/**
 * Hur förra omgångens igenkännare slutade (0.107.0), för diagnosen.
 * @typedef {object} Igenkanningsslut
 * @property {boolean} hann `end` kom: före anropet, eller inom `IGENKANNING_SLAPP_MS`.
 * @property {number} ms Från att `stop()` eller `abort()` begärdes till `end`, eller till att taket gick ut. 0 när den slutade av
 *   sig själv utan att något begärts.
 */

/** Så länge `stoppa` väntar på att webbläsaren lämnar sitt sista resultat. */
export const IGENKANNING_VANTA_MS = 1500;

/**
 * Så länge en ny omgång väntar på att förra omgångens igenkännare säger `end` efter `abort()` (0.107.0, lifehub.app#253). Ett tak, så
 * att ett `end` som aldrig kommer inte låser fältet: då startar omgången ändå, och diagnosen säger `hann: false`.
 */
export const IGENKANNING_SLAPP_MS = 1000;

/**
 * Fel som bara betyder tystnad. Igenkänningen fortsätter, och texten är fortfarande hel.
 *
 * ⛔ "aborted" STÅR INTE HÄR (granskningen av PR 358, MÅSTE 2). Ett samtal på iOS eller ett annat ljudpass avbryter mitt i
 * en mening, och texten är då avhuggen. Vår egen avbrytning (`kasta`) syns aldrig här: dess hanterare är bortkopplade.
 */
const TYSTA_FEL = ["no-speech"];

/**
 * ⛔ SÄGER ATT TEXTEN UTEBLIR (0.99.0). CP 2026-10-13 22:15, iPhone/Safari: "Det är som att andra gången jag försöker spela in så
 * funkar det inte." En igenkänning som inte gick att starta andra gången sväljdes: texten blev tom, platstexten "Prata, så syns
 * texten här" stod kvar för evigt, och inspelningen pågick utan att något visade att orden inte hördes. Nu står detta i fältet.
 * Ljudet spelas in och sparas ändå, så meningen är sann.
 */
export const TALK_TEXTFEL = ORD_TALK.textFel.sv;

/** Så många SNABBA omstarter i rad innan igenkänningen räknas som trasig (#253). En snabb omstart är en igenkännare som levt kortare än {@link OMSTART_SNABB_MS}: en som tar slut direkt efter start loopar annars. */
const MAX_SNABBA_OMSTARTER = 3;
/** En omstart räknas som snabb när igenkännaren levde kortare än så (#253). */
export const OMSTART_SNABB_MS = 1000;
/** Pausen innan igenkänningen startas om (#253), så att WebKit hinner släppa mikrofonen mellan omgångarna. */
export const OMSTART_PAUS_MS = 300;

/**
 * Språkkoden igenkänningen vill ha, ur appens språk ("sv" ger "sv-SE").
 * @param {string} sprak
 */
export function igenkanningensSprak(sprak) {
  const s = String(sprak || "").toLowerCase();
  if (s.startsWith("en")) return "en-US";
  return "sv-SE";
}

/**
 * Är webbläsaren WebKit (Safari på macOS, och ALLA webbläsare på iOS, som alla kör WebKit)? (#253)
 *
 * ⛔ WEBKIT KÖR INTE TALIGENKÄNNINGEN SAMTIDIGT SOM INSPELNINGEN. CP:s iPad föll med "aborted" i andra omgången
 * (produktionens felkanal, Safari 26.6.1): hypotesen är att WebKit bara ger mikrofonen till en sak i taget, så
 * `SpeechRecognition` och `MediaRecorder` slåss om den. På WebKit körs därför bara inspelningen, och texten tolkas på
 * servern som förut. Chrome, som klarar båda, behåller den levande texten.
 *
 * ⛔ FORM, INTE VERSION: "AppleWebKit" utan "Chrome", "Chromium" eller "Edg". Chrome på iOS (CriOS) och Edge (EdgiOS) är också
 * WebKit under skalet och fångas av att de saknar dem; Chrome på andra plattformar har dem. `jsdom` bär också "AppleWebKit" men
 * är ingen riktig webbläsare, så proven kör igenkänningen som förut (det är bara den riktiga Safari som ska stängas av).
 *
 * @param {string} [ua] User agent-strängen, förvalt `navigator.userAgent`. Tom sträng är inte WebKit.
 */
export function arWebKit(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  const s = String(ua || "");
  if (!/AppleWebKit/.test(s)) return false;
  return !/\b(Chrome|Chromium|Edg|jsdom|HeadlessChrome)\b/.test(s);
}

/**
 * Webbläsarens taligenkänning, eller `null` när den saknas.
 *
 * ⛔ STARTAR OM SIG SJÄLV. Chrome avslutar en igenkänning efter en stunds tystnad även med `continuous`, och utan omstart hade
 * texten slutat växa mitt i en mening. Den text som redan är slutlig sparas mellan omstarterna.
 *
 * ⛔ VARJE FÖRSÖK HAR SITT NUMMER (granskningen av PR 358, MÅSTE 1). En avbruten igenkännare kan leverera `onend` eller
 * `onresult` efter att nästa försök startat, och utan numret skrev den in i det nya försökets text eller startade en andra
 * igenkännare som aldrig stoppades. Varje hanterare gör ingenting när försöket den hör till inte längre är det pågående.
 *
 * ⛔ HELLRE INGEN TEXT ÄN EN HALV (MÅSTE 2). Ger webbläsaren aldrig sitt sista besked inom väntetiden, faller igenkänningen
 * med ett riktigt fel, eller avbryts den utifrån (`aborted`), blir texten tom, och appen får ljudet som förut.
 *
 * ⛔ ÄNDRAT 0.103.0: PRELIMINÄR TEXT VID ETT STOPP SOM PERSONEN BAD OM ÄR TEXTEN. MÅSTE 2 räknade förut också den här texten som
 * halv, och då kastades den. CP 2026-10-14 såg "Skriver ut det inspelade…" under chattens skrivfält fast appen slagit på
 * igenkänningen. ⛔ HYPOTES, INTE MÄTT PÅ EN IPHONE: Safari på iOS markerar ofta inget resultat som slutligt i `continuous`-läge, så
 * allt som hördes stod som preliminärt när `onend` kom efter `stop()`, och hela texten blev tom varje gång. Webbläsaren har då
 * sagt sitt sista ord (`onend` kom inom väntetiden, inget fel), och det preliminära är dess bästa bud på det som sades fram till
 * stoppet: samma bud som redan räknas som hel text när Chrome tar en paus mitt i (`onend` medan den lyssnar, nedan). Det som
 * fortfarande gör texten ogiltig är det som verkligen hugger av den: ett fel, ett avbrott och en väntetid som tar slut.
 *
 * @param {{ SpeechRecognition?: any, setTimeout?: typeof setTimeout, nu?: () => number, userAgent?: string }} [miljo]
 * @returns {Igenkanning | null}
 */
export function webblasarensIgenkanning(miljo = {}) {
  const g = /** @type {any} */ (typeof globalThis !== "undefined" ? globalThis : {});
  const SR = miljo.SpeechRecognition || g.SpeechRecognition || g.webkitSpeechRecognition;
  if (typeof SR !== "function") return null;
  // ⛔ WEBKIT: ingen taligenkänning, bara inspelning och serverns utskrift (#253). En inskjuten SR (proven) går förbi.
  if (!miljo.SpeechRecognition && arWebKit(miljo.userAgent)) return null;
  const vanta = miljo.setTimeout || setTimeout;
  const nu = miljo.nu || Date.now;
  /** @type {any} */
  let r = null;
  let forsok = 0;
  let aktiv = false;
  let trasig = false;
  let slutlig = "";
  let pagaende = "";
  // ⛔ #253: när det pågående försöket startade, och hur många snabba omstarter i rad som skett.
  let forsokStart = 0;
  let snabbaOmstarter = 0;
  /** @type {(() => void) | null} */
  let narSlut = null;
  /**
   * ⛔ DEN SENAST SKAPADE IGENKÄNNAREN OCH OM DEN SAGT `end` (0.107.0, lifehub.app#253). `slapp` väntar på den innan nästa omgång.
   * `begard` är när `stop()` eller `abort()` begärdes, `slutVid` när `end` kom.
   * @type {{ rec: any, slut: Promise<void>, sett: boolean, begard: number, slutVid: number, markera: () => void } | null}
   */
  let senaste = null;
  /** Noterar att ett slut begärts av den senaste igenkännaren, en gång. @param {any} rec */
  const begar = (rec) => {
    if (senaste && senaste.rec === rec && !senaste.begard) senaste.begard = nu();
  };
  const hel = () => `${slutlig} ${pagaende}`.replace(/\s+/g, " ").trim();
  /** @param {unknown} fel */
  const felkod = (fel) => (fel instanceof Error && fel.name ? fel.name : "okant-fel");
  /**
   * ⛔ ETT FEL SOM INGEN SER ÄR ETT TYST NEDSLÄPP (regel 5). Koden går till fältet (`onFel`) och till felrapporten. En
   * hanterare som i sin tur kastar får inte ta ned igenkänningen, och inte heller sluta rapporteras.
   * @param {((kod: string) => void) | undefined} onFel @param {string} kod
   */
  const meld = (onFel, kod) => {
    rapporteraFel(new Error(`Taligenkänningen föll: ${kod}`), { yta: "talk", steg: "igenkanning", kod });
    try {
      onFel?.(kod);
    } catch (fel) {
      rapporteraFel(fel, { yta: "talk", steg: "igenkanning-onFel" });
    }
  };
  /** Stänger en igenkännare vi är klara med. `abort` är idempotent i webbläsarna, och ett fel här ska inte stoppa något. */
  const stang = (/** @type {any} */ gammal) => {
    begar(gammal);
    try {
      gammal?.abort();
    } catch {
      // Redan stängd.
    }
  };

  /** @param {number} mitt @param {string} sprak @param {(text: string) => void} onText @param {((kod: string) => void) | undefined} onFel */
  const ny = (mitt, sprak, onText, onFel) => {
    const rec = new SR();
    rec.lang = sprak;
    rec.continuous = true;
    rec.interimResults = true;
    /** @type {() => void} */
    let lossa = () => {};
    const post = { rec, slut: new Promise((l) => { lossa = () => l(undefined); }), sett: false, begard: 0, slutVid: 0, markera: () => {} };
    post.markera = () => {
      if (post.sett) return;
      post.sett = true;
      post.slutVid = nu();
      lossa();
    };
    senaste = post;
    const galler = () => mitt === forsok && rec === r;
    rec.onresult = (/** @type {any} */ e) => {
      if (!galler()) return;
      let nyaSlutliga = "";
      let delvis = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const res = e.results[i];
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) nyaSlutliga += `${t} `;
        else delvis += t;
      }
      if (nyaSlutliga) slutlig = `${slutlig} ${nyaSlutliga}`.trim();
      pagaende = delvis;
      onText(hel());
    };
    rec.onerror = (/** @type {any} */ e) => {
      if (galler() && !TYSTA_FEL.includes(e?.error)) {
        trasig = true;
        meld(onFel, String(e?.error || "okant-fel"));
      }
    };
    rec.onend = () => {
      // ⛔ Slutet noteras före försöksnumret: också en igenkännare som inte längre gäller har släppt mikrofonen när den säger `end`.
      post.markera();
      if (!galler()) return;
      if (aktiv && !trasig) {
        // Mitt i: webbläsaren tog en paus. Det pågående hör till texten, och lyssnandet fortsätter.
        if (pagaende) {
          slutlig = `${slutlig} ${pagaende}`.trim();
          pagaende = "";
        }
        // ⛔ #253: en omstart är snabb när igenkännaren levde kortare än OMSTART_SNABB_MS. Tre snabba i rad är en loop, och
        // då blir det ett fel i fältet med koden "omstartsslinga" i stället för en tyst död. En omgång som levde länge nollar
        // räknaren, så en lång inspelning med en paus då och då aldrig slår i taket.
        const levde = nu() - forsokStart;
        snabbaOmstarter = levde < OMSTART_SNABB_MS ? snabbaOmstarter + 1 : 0;
        if (snabbaOmstarter > MAX_SNABBA_OMSTARTER) {
          trasig = true;
          meld(onFel, "omstartsslinga");
        } else {
          // ⛔ #253: en kort paus innan omstarten, så att WebKit hinner släppa mikrofonen mellan omgångarna. Pausen körs på
          // den inskjutbara `vanta`, så proven styr den. Hinner läget ändras under pausen (stopp, kast, fel) startas inget.
          vanta(() => {
            if (mitt !== forsok || !aktiv || trasig) return;
            try {
              forsokStart = nu();
              r = ny(mitt, sprak, onText, onFel);
              r.start();
            } catch (fel) {
              // En igenkännare som aldrig startade säger aldrig `end`, och håller ingenting.
              senaste?.markera();
              trasig = true;
              meld(onFel, felkod(fel));
              narSlut?.();
              narSlut = null;
            }
          }, OMSTART_PAUS_MS);
          return;
        }
      }
      // ⛔ Vid stopp: det preliminära hör till texten (0.103.0, se filhuvudet ovanför `webblasarensIgenkanning`). Förut gjorde ett
      // ord som aldrig blev slutligt hela texten ogiltig, och på iOS blev det inget ord som var slutligt.
      if (pagaende) {
        slutlig = `${slutlig} ${pagaende}`.trim();
        pagaende = "";
      }
      narSlut?.();
      narSlut = null;
    };
    return rec;
  };

  return {
    /** @param {{ sprak: string, onText: (text: string) => void, onFel?: (kod: string) => void }} val */
    starta({ sprak, onText, onFel }) {
      forsok += 1;
      // ⛔ DEN FÖRRA OMGÅNGENS IGENKÄNNARE STÄNGS INNAN EN NY STARTAS (0.99.0). Safari, och iOS i synnerhet, tillåter bara EN
      // aktiv igenkänning, och `start()` på en andra kastar InvalidStateError. En igenkännare som `stoppa()` gett upp på (väntetiden
      // gick ut utan att webbläsaren sade `end`) levde kvar, och nästa omgång föll tyst: texten blev tom och inget förklarade varför.
      // Numret räknades redan upp, så den gamlas hanterare gör ingenting när den till slut säger sitt.
      stang(r);
      r = null;
      aktiv = true;
      trasig = false;
      slutlig = "";
      pagaende = "";
      snabbaOmstarter = 0;
      narSlut = null;
      try {
        r = ny(forsok, sprak, onText, onFel);
        r.start();
        forsokStart = nu();
      } catch (fel) {
        senaste?.markera();
        trasig = true;
        aktiv = false;
        meld(onFel, felkod(fel));
      }
    },
    stoppa() {
      if (!r || !aktiv) return Promise.resolve("");
      aktiv = false;
      const mitt = forsok;
      return new Promise((klar) => {
        let gjort = false;
        /** @param {boolean} iTid */
        const sluta = (iTid) => {
          if (gjort) return;
          gjort = true;
          // ⛔ TIDEN TOG SLUT: webbläsaren gav aldrig sitt sista besked, och texten kan sakna slutet. Igenkännaren stängs då här,
          // annars lever den kvar och blockerar nästa omgång (se `starta`).
          if (!iTid && mitt === forsok) stang(r);
          klar(!iTid || trasig || mitt !== forsok ? "" : hel());
        };
        narSlut = () => sluta(true);
        vanta(() => sluta(false), IGENKANNING_VANTA_MS);
        begar(r);
        try {
          r.stop();
        } catch {
          trasig = true;
          sluta(true);
        }
      });
    },
    kasta() {
      forsok += 1;
      aktiv = false;
      narSlut = null;
      const gammal = r;
      r = null;
      begar(gammal);
      try {
        gammal?.abort();
      } catch {
        // Redan stängd.
      }
    },
    /*
     * ⛔ FÖRRA OMGÅNGEN ÄR HELT AVSLUTAD INNAN NÄSTA BÖRJAR (0.107.0, lifehub.app#253). CP 2026-10-15 på iPhone: "Det är som att
     * mikrofonen låser sig." Efter agentens svar gav nästa omgång varken ljud eller text. `kasta` och ett `stoppa` vars väntetid gått
     * ut anropar `abort()` men väntar inte på `end`, och nästa omgång öppnade mikrofonen direkt. ⛔ HYPOTES, INTE MÄTT PÅ EN IPHONE:
     * att WebKit på iOS håller telefonens ljudpass tills igenkännaren sagt `end`. Den här väntan tar bort den möjligheten, och
     * `hann` och `ms` i diagnosen säger om den behövdes.
     */
    slapp() {
      const p = senaste;
      if (!p) return null;
      if (p.sett) return { hann: true, ms: p.begard ? Math.max(0, p.slutVid - p.begard) : 0 };
      forsok += 1;
      aktiv = false;
      narSlut = null;
      if (r === p.rec) r = null;
      stang(p.rec);
      return new Promise((klar) => {
        let gjort = false;
        /** @param {boolean} hann */
        const sluta = (hann) => {
          if (gjort) return;
          gjort = true;
          klar({ hann, ms: Math.max(0, (hann ? p.slutVid : nu()) - p.begard) });
        };
        p.slut.then(() => sluta(true));
        vanta(() => sluta(false), IGENKANNING_SLAPP_MS);
      });
    },
  };
}
