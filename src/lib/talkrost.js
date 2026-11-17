/**
 * TALK pratar tillbaka (cllp/lifehub.app#870, skiva 4): agentens svar läses upp, och mikrofonen lyssnar igen tills personen är klar.
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN FINNS ═════════════════════════════════════════════════════════════════════════════════════
 *
 * Robs första möte med LifeHub (lifehub.app#870, punkt 12): "TALK pratar tillbaka: agenten tar vid direkt tills man är klar och vill gå
 * vidare." CP sade kör 2026-11-17. Före den här filen tog TALK emot röst och lämnade texten till agenten, och agenten svarade med text i
 * chatten. Den som pratade fick alltså titta på skärmen för att höra svaret. Visionens fråga är om något gör att man tittar mindre på
 * skärmen, och ett svar som hörs i stället för att läsas gör det.
 *
 * ══ ⛔ APPEN AVGÖR OM DET ÄR ETT SAMTAL, RAMVERKET LÄSER UPP ════════════════════════════════════════════════════════
 *
 * Ramverket vet inte vad en agent är, var dess svar skrivs eller vilket samtal det hör till. Appens mottagare (`onAgent`, `samtalet.onText`)
 * får därför lösa till en `Talkrost`: ett sätt att vänta på svaret och ett sätt att säga nästa sak i samma samtal. Löser den till något annat
 * är allt som före: fältet stängs, och svaret står i chatten. Det finns inget val i inställningarna (ett val till är skärmtid): läget slås
 * på av att personen pratade in och valde agenten, och av att appen gav ett svar att läsa.
 *
 * ══ ⛔ UPPLÄSNINGEN ÄR ETT INJICERAT BEROENDE ═══════════════════════════════════════════════════════════════════════
 *
 * `webblasarensUpplasning` är webbläsarens `speechSynthesis`. Proven ger en egen (`Upplasning`), aldrig ett grep efter namnet (regel 4).
 * Mätt 2026-11-17 i Chromium (Playwright, utan ljudkort): `speechSynthesis` finns, `getVoices()` är tom och `speak` ger
 * `error: synthesis-failed`. Att objektet finns säger alltså inte att något hörs. Därför väntar uppläsningen på `start` med ett tak
 * (`ROST_LAS_START_MS`): en webbvy som har objektet men aldrig säger något (hypotes för Android WebView) blir ett lugnt besked, inte tystnad.
 */

import { rapporteraFel } from "./felrapport.js";

/**
 * ⛔ TAKET PÅ VARV. Ett varv är: agenten svarar, svaret läses upp, mikrofonen lyssnar, det sagda går till agenten. Efter så många varv i
 * rad lyssnar mikrofonen inte igen av sig själv: fältet säger det, och ett tryck på mikrofonen fortsätter. En loop utan tak kan stå och
 * prata med sig själv i en ficka.
 */
export const ROST_MAX_VARV = 8;

/** Så länge det får vara tyst efter att något sagts innan det sagda går till agenten. Igenkänningen är `continuous` och slutar aldrig själv. */
export const ROST_TYSTNAD_MS = 1800;

/** ⛔ TAKET PÅ TYSTNAD. Hörs ingenting alls så länge i ett varv slutar samtalet, och fältet säger varför. */
export const ROST_INGET_TAL_MS = 10_000;

/**
 * Så länge fältet väntar på agentens svar. Svaret kommer ändå i chatten, så ett svar som dröjer gör ingen skada: fältet säger att det kommer
 * där och slutar vänta. ⛔ Utan tak hade fältet kunnat stå med "Väntar på svaret…" för alltid.
 */
export const ROST_SVAR_MAX_MS = 90_000;

/** Så länge uppläsningen får ta på sig att börja (`start`). Ingen start inom tiden är ett fel, inte en tyst väntan. */
export const ROST_LAS_START_MS = 4000;

/**
 * Längsta uppläsningen, räknat ur svarets längd: 20 s plus 120 ms per tecken, ungefär dubbla normal taltakt. Chrome slutar ibland mitt i en
 * lång uppläsning utan att säga `end`, och då lyssnar mikrofonen igen när taket gått.
 * @param {string} text
 */
export function rostLasMaxMs(text) {
  return 20_000 + 120 * String(text ?? "").length;
}

/**
 * Det man säger för att avsluta, på svenska och engelska. Hela yttrandet ska bestå av dem: "tack, och boka tandläkaren" är ingen avslutning.
 * ⛔ "nej" ensamt står inte här: det är ofta ett svar på agentens fråga.
 */
const KLARFRASER = [
  "klar",
  "jag är klar",
  "nu är jag klar",
  "tack",
  "tack så mycket",
  "tusen tack",
  "nej tack",
  "det var allt",
  "det var bara det",
  "det räcker",
  "det är bra så",
  "hej då",
  "done",
  "i'm done",
  "i am done",
  "thanks",
  "thank you",
  "no thanks",
  "no thank you",
  "that's all",
  "that is all",
  "that's it",
  "that's everything",
  "bye",
  "goodbye",
].sort((a, b) => b.length - a.length);

/**
 * Säger personen att hen är klar? Små bokstäver, utan skiljetecken. Yttrandet ska bestå av en eller flera fraser ur `KLARFRASER`, eventuellt
 * inledda med "ok" eller "okej" ("okej tack, det var allt").
 * @param {string} text
 * @returns {boolean}
 */
export function arKlarfras(text) {
  let rest = String(text ?? "")
    .toLocaleLowerCase("sv")
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!rest) return false;
  rest = rest.replace(/^(ok|okej|okay|bra|perfekt|great|good)\s+/u, "");
  let traffar = 0;
  while (rest) {
    const fras = KLARFRASER.find((f) => rest === f || rest.startsWith(`${f} `));
    if (!fras) return false;
    traffar += 1;
    rest = rest.slice(fras.length).trim();
  }
  return traffar > 0;
}

/**
 * Det appens mottagare kan lösa till för att samtalet ska fortsätta med röst.
 * @typedef {object} Talkrost
 * @property {() => Promise<string>} svar Agentens svar på det personen nyss sade, som text. ⛔ Anropas bara när svaret ska läsas upp, så att
 *   en app som alltid ger det inte prenumererar i onödan. Avvisas löftet, eller löser det till en tom text, säger fältet att svaret står i chatten.
 * @property {(text: string) => Promise<Talkrost | void> | Talkrost | void} vidare Nästa sak personen säger, i SAMMA samtal. Löser den till en
 *   ny `Talkrost` fortsätter samtalet, annars stängs fältet som efter Agent.
 */

/**
 * Läser appens svar: en `Talkrost`, eller `null` när svaret inte är det (ingenting, som förut).
 *
 * ⛔ ETT FELFORMAT SVAR RAPPORTERAS OCH GER `null`, KASTAR INTE. Det sagda har redan nått agenten, och ett fel i fältet hade sett ut som att
 * det inte gjorde det. Fältet stängs då som förut, och svaret står i chatten.
 * @param {unknown} varde
 * @returns {Talkrost | null}
 */
export function talkrostUr(varde) {
  if (!varde || typeof varde !== "object") return null;
  const v = /** @type {Record<string, unknown>} */ (varde);
  if (!("svar" in v) && !("vidare" in v)) return null;
  if (typeof v.svar !== "function" || typeof v.vidare !== "function") {
    rapporteraFel(new Error(`TALK: ett svar med röst ska vara { svar, vidare } med två funktioner, fick svar: ${typeof v.svar}, vidare: ${typeof v.vidare}.`), { yta: "OpsTalk", steg: "talkrost" });
    return null;
  }
  return { svar: /** @type {Talkrost["svar"]} */ (v.svar), vidare: /** @type {Talkrost["vidare"]} */ (v.vidare) };
}

/**
 * Uppläsningen TALK använder. `webblasarensUpplasning` är förvalet, och ett prov eller en app ger en egen.
 * @typedef {object} Upplasning
 * @property {(text: string, val: { sprak: string }) => Promise<void>} las Läser upp texten. Löser när uppläsningen är slut (eller avbruten
 *   med `stoppa`), avvisar när den inte gick att göra. `sprak` är "sv-SE" eller "en-US" (`upplasningensSprak`).
 * @property {() => void} stoppa Avbryter en pågående uppläsning direkt. Ofarlig när ingen pågår.
 * @property {() => void} [forbered] Anropas synkront i personens tryck (Agent, Klar i en öppen tråd), före svaret. ⛔ HYPOTES, INTE MÄTT PÅ EN
 *   IPHONE: WebKit på iOS spelar bara upp tal som en gest har låst upp, och svaret kommer först sekunder efter trycket.
 */

/**
 * Språkkoden uppläsningen vill ha, ur appens språk. Samma som igenkänningens: svenska som förval, engelska för "en".
 * @param {string} sprak
 */
export function upplasningensSprak(sprak) {
  return String(sprak || "").toLowerCase().startsWith("en") ? "en-US" : "sv-SE";
}

/**
 * Webbläsarens uppläsning, eller `null` när `speechSynthesis` eller `SpeechSynthesisUtterance` saknas.
 *
 * ⛔ ATT DEN FINNS ÄR INTE ATT DEN HÖRS (mätt i Chromium 2026-11-17, se filhuvudet). `las` avvisar därför när `start` inte kommer inom
 * `ROST_LAS_START_MS`, och när webbläsaren säger `error` (utom `interrupted` och `canceled`, som är vår egen `stoppa`).
 *
 * @param {{ fonster?: any }} [miljo] Bara för prov. Förval `globalThis`.
 * @returns {Upplasning | null}
 */
export function webblasarensUpplasning({ fonster = globalThis } = {}) {
  const synt = fonster?.speechSynthesis;
  const Yttrande = fonster?.SpeechSynthesisUtterance;
  if (!synt || typeof synt.speak !== "function" || typeof Yttrande !== "function") return null;
  let forberedd = false;
  /** @param {string} lang */
  const rosten = (lang) => {
    try {
      const alla = typeof synt.getVoices === "function" ? synt.getVoices() : [];
      const pa = (/** @type {any} */ r) => String(r?.lang ?? "").replace("_", "-").toLowerCase();
      return alla.find((/** @type {any} */ r) => pa(r) === lang.toLowerCase()) ?? alla.find((/** @type {any} */ r) => pa(r).startsWith(lang.slice(0, 2).toLowerCase())) ?? null;
    } catch {
      return null;
    }
  };
  const stoppa = () => {
    try {
      synt.cancel();
    } catch (fel) {
      rapporteraFel(fel, { yta: "OpsTalk", steg: "upplasning-stoppa" });
    }
  };
  return {
    forbered() {
      if (forberedd) return;
      forberedd = true;
      try {
        const u = new Yttrande("");
        u.volume = 0;
        synt.speak(u);
      } catch (fel) {
        rapporteraFel(fel, { yta: "OpsTalk", steg: "upplasning-forbered" });
      }
    },
    stoppa,
    las(text, { sprak }) {
      return new Promise((losa, avvisa) => {
        /** @type {ReturnType<typeof setTimeout> | undefined} */
        let startTak;
        /** @type {ReturnType<typeof setTimeout> | undefined} */
        let slutTak;
        let klar = false;
        /** @param {Error | null} fel */
        const slut = (fel) => {
          if (klar) return;
          klar = true;
          clearTimeout(startTak);
          clearTimeout(slutTak);
          if (fel) avvisa(fel);
          else losa();
        };
        try {
          if (synt.speaking || synt.pending) synt.cancel();
          const u = new Yttrande(text);
          u.lang = sprak;
          const r = rosten(sprak);
          if (r) u.voice = r;
          u.onstart = () => clearTimeout(startTak);
          u.onend = () => slut(null);
          u.onerror = (/** @type {any} */ e) => {
            const kod = String(e?.error ?? "okand");
            slut(kod === "interrupted" || kod === "canceled" ? null : new Error(`Uppläsningen föll: ${kod}`));
          };
          startTak = setTimeout(() => {
            stoppa();
            slut(new Error("Uppläsningen startade inte."));
          }, ROST_LAS_START_MS);
          slutTak = setTimeout(() => {
            stoppa();
            slut(null);
          }, rostLasMaxMs(text));
          synt.speak(u);
        } catch (fel) {
          slut(fel instanceof Error ? fel : new Error(String(fel)));
        }
      });
    },
  };
}
