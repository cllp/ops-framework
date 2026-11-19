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
import { agentutkast } from "./samtal.js";

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

/** Kortare än så läses inte ensamt: "Ja." eller "t.ex." följer med nästa mening, så att rösten inte hackar. */
export const MENING_MINST = 12;

/**
 * Hela meningar i en text som växer, från `fran` (0.244.0, lifehub.app#896). TALK läser första meningen medan agenten skriver resten.
 *
 * En mening är klar när den slutar på `.`, `!`, `?` eller `…` FÖLJT AV ett mellanslag, eller på en radbrytning. Punkten sist i ett utkast
 * räknas inte: "3." kan bli "3.5" i nästa leverans. Resten, efter sista hela meningen, läses när svaret är färdigt.
 *
 * @param {string} text Hela texten så här långt.
 * @param {number} [fran] Var förra läsningen slutade, i tecken.
 * @returns {{ meningar: string[], till: number }} Meningarna att läsa, i ordning, och var nästa läsning börjar.
 */
export function helaMeningar(text, fran = 0) {
  const rest = String(text ?? "").slice(fran);
  const grans = /[.!?…]+["'”»)]*\s+|\n+/g;
  /** @type {string[]} */
  const meningar = [];
  let start = 0;
  /** @type {RegExpExecArray | null} */
  let m;
  while ((m = grans.exec(rest))) {
    const slut = m.index + m[0].length;
    const bit = rest.slice(start, slut).trim();
    if (bit.length >= MENING_MINST) {
      meningar.push(bit);
      start = slut;
    }
  }
  return { meningar, till: fran + start };
}

/**
 * En kö som läser texter en i taget, i den ordning de kom (0.244.0, lifehub.app#896). TALK lägger varje hel mening i kön medan agenten
 * skriver, och resten när svaret är färdigt.
 *
 * ⛔ ETT FEL STOPPAR KÖN OCH SPARAS TILL `slut`. Det rapporteras alltså en gång, där svaret redan hanteras, och resten läses inte: en röst som
 * hoppar över en mening mitt i ett svar är sämre än en som slutar och säger att svaret står i fältet.
 * ⛔ `aktuell` PRÖVAS FÖRE VARJE TEXT. Har personen tryckt Stopp eller börjat prata läses ingenting mer, också det som redan står i kön.
 * @param {(text: string) => Promise<void> | void} las
 * @param {() => boolean} aktuell
 * @returns {{ lagg: (text: string) => void, antal: () => number, slut: () => Promise<void> }}
 */
export function lasIOrdning(las, aktuell) {
  /** @type {Promise<void>} */
  let kedja = Promise.resolve();
  /** @type {unknown} */
  let fel = null;
  let felFinns = false;
  let antal = 0;
  return {
    lagg(text) {
      const t = String(text ?? "").trim();
      if (!t) return;
      antal += 1;
      kedja = kedja
        .then(() => {
          if (felFinns || !aktuell()) return undefined;
          return las(t);
        })
        .catch((e) => {
          if (!felFinns) {
            felFinns = true;
            fel = e;
          }
        });
    },
    antal: () => antal,
    slut: () =>
      kedja.then(() => {
        if (felFinns) throw fel;
      }),
  };
}

/**
 * Det appens mottagare kan lösa till för att samtalet ska fortsätta med röst.
 * @typedef {object} Talkrost
 * @property {(opt?: { signal?: AbortSignal, onUtkast?: (text: string) => void }) => Promise<string>} svar Agentens svar på det personen nyss sade, som text. ⛔ Anropas bara när svaret ska läsas upp, så att
 *   en app som alltid ger det inte prenumererar i onödan. Avvisas löftet, eller löser det till en tom text, säger fältet att svaret står i chatten.
 *   `signal` avbryts när fältet slutat vänta (taket på 90 s, Klar, en ny fråga): den som prenumererar ska då stänga, annars lever lyssnaren kvar.
 *   `onUtkast` (0.244.0, lifehub.app#896) får det agenten hittills skrivit, hela texten varje gång, medan svaret växer. Fältet läser då första
 *   meningen innan svaret är färdigt. Frivillig: en app som inte kan följa ett utkast anropar den aldrig, och fältet läser som förut.
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

/**
 * ══ ⛔ HÖGTALARKNAPPEN: PERSONENS VAL, SPARAT SOM TEMAT (CP 2026-11-18) ══════════════════════════════════════════════════════════════
 *
 * "Valet sparas per person, som temat." Temat sparas i `localStorage` under en nyckel för hela ramverket (`theme.js`, `ops-theme`), och
 * spelarens hastighet likaså (`ljudspelare.js`, `HASTIGHET_NYCKEL`: "hastigheten är personens, inte modulens"). Uppläsningen följer samma
 * väg: en nyckel, läst och skriven bara här, oavsett vilken TALK (skalets, chattens) som visar knappen.
 *
 * ⛔ EN BEKVÄMLIGHET, ALDRIG DATA. Försvinner den (privat fönster, rensad webbplatsdata) gäller förvalet: uppläsning på.
 */
export const UPPLASNING_NYCKEL = "ops.talk.upplasning";

/** Läser personens val. `true` utom när hen slagit av uppläsningen. */
export function lasUpplasningPa() {
  try {
    return globalThis.localStorage?.getItem(UPPLASNING_NYCKEL) !== "av";
  } catch {
    // Blockerad lagring: förvalet, som temat.
    return true;
  }
}

/** Sparar personens val. @param {boolean} pa */
export function sparaUpplasningPa(pa) {
  try {
    globalThis.localStorage?.setItem(UPPLASNING_NYCKEL, pa ? "pa" : "av");
  } catch {
    // Valet gäller för den här sidvisningen även om det inte kan sparas, som temat.
  }
}

/**
 * ══ ⛔ ETT SAMTAL MED AGENTEN I SAMTALSKÄLLAN (CP 2026-11-18, vågikonen i agentchatten) ═══════════════════════════════════════════
 *
 * Chatten vet att ett samtal är ett agentsamtal (`samtal.slag === "agent"`) och har samtalskällan (`createSamtalskalla`) med `skicka` och
 * `prenumerera`. Ett röstsamtal där behöver bara två saker: skicka det sagda, och vänta på nästa meddelande från någon annan än personen.
 * De två bor här, så att chatten och en app (TALK:s `onAgent`) kan bygga samma `Talkrost` ur samma källa (regel 2).
 */

/**
 * Väntar på svaret efter ett skickat meddelande: texten i första meddelandet efter `efter` som någon annan än `uid` skrev. I ett agentsamtal
 * är det agenten. Avvisar när källan inte kan prenumerera (då finns inget att vänta med) eller när prenumerationen faller.
 * ⛔ `signal` STÄNGER PRENUMERATIONEN. Utan den levde lyssnaren kvar när fältet slutat vänta (taket på 90 s): kom svaret aldrig, stängdes den aldrig.
 *
 * ⛔ `onUtkast` FÖLJER AGENTENS STATUS (0.244.0, lifehub.app#896). Kan källan prenumerera på statusen (`prenumereraStatus`, när appen gav
 * `status`) får `onUtkast` utkastet varje gång det växer, och lyssnaren stängs med samma `sluta` som meddelandets. Ett fel i den lyssnaren
 * rapporteras men stoppar inte väntan: svaret kommer ändå som meddelande, och utkastet var bara ett sätt att börja tidigare.
 * @param {{ kalla: { prenumerera: (sid: string, l: { onData: (rader: any[]) => void, onError: (fel: Error) => void }) => (() => void) | null, prenumereraStatus?: (sid: string, l: { onData: (dok: any) => void, onError: (fel: Error) => void }) => (() => void) | null }, sid: string, uid: string, efter: { id: string }, signal?: AbortSignal, onUtkast?: (text: string) => void }} p
 * @returns {Promise<string>}
 */
export function samtalssvar({ kalla, sid, uid, efter, signal, onUtkast }) {
  return new Promise((losa, avvisa) => {
    if (signal?.aborted) {
      avvisa(new Error("Väntan på svaret avbröts."));
      return;
    }
    /** @type {(() => void) | null} */
    let stang = null;
    /** @type {(() => void) | null} */
    let stangUtkast = null;
    let klar = false;
    /** @param {() => void} gor */
    const sluta = (gor) => {
      if (klar) return;
      klar = true;
      try {
        stang?.();
      } catch (fel) {
        rapporteraFel(fel, { yta: "OpsTalk", steg: "samtalssvar-stang" });
      }
      try {
        stangUtkast?.();
      } catch (fel) {
        rapporteraFel(fel, { yta: "OpsTalk", steg: "samtalssvar-stang-utkast" });
      }
      gor();
    };
    if (typeof onUtkast === "function" && typeof kalla.prenumereraStatus === "function") {
      let senast = "";
      try {
        stangUtkast = kalla.prenumereraStatus(sid, {
          onData: (dok) => {
            if (klar) return;
            const u = agentutkast(dok);
            if (!u || u === senast) return;
            senast = u;
            try {
              onUtkast(u);
            } catch (fel) {
              rapporteraFel(fel, { yta: "OpsTalk", steg: "samtalssvar-utkast" });
            }
          },
          onError: (fel) => rapporteraFel(fel, { yta: "OpsTalk", steg: "samtalssvar-utkast" }),
        });
      } catch (fel) {
        rapporteraFel(fel, { yta: "OpsTalk", steg: "samtalssvar-utkast" });
      }
    }
    stang = kalla.prenumerera(sid, {
      onData: (rader) => {
        const i = rader.findIndex((m) => m?.id === efter.id);
        if (i === -1) return;
        const svar = rader.slice(i + 1).find((m) => m && m.av !== uid && typeof m.text === "string" && m.text.trim());
        if (svar) sluta(() => losa(svar.text));
      },
      onError: (fel) => sluta(() => avvisa(fel)),
    });
    if (klar) {
      // Svaret fanns redan i första leveransen, före `stang` sattes.
      try {
        stang?.();
      } catch (fel) {
        rapporteraFel(fel, { yta: "OpsTalk", steg: "samtalssvar-stang" });
      }
      return;
    }
    if (!stang) {
      sluta(() => avvisa(new Error("Samtalet går inte att följa här, så svaret kan inte väntas in.")));
      return;
    }
    signal?.addEventListener("abort", () => sluta(() => avvisa(new Error("Väntan på svaret avbröts."))), { once: true });
  });
}

/**
 * `vidare` för ett samtal i samtalskällan: skickar det sagda som personens meddelande och ger en `Talkrost` som väntar på svaret.
 * `skicka` är förvalt `kalla.skicka(sid, { text, av: uid })`. Chatten ger sin egen, som också säger till inkorgen och visar att agenten vaknat.
 * @param {{ kalla: any, sid: string, uid: string, skicka?: (text: string) => Promise<{ id: string }> }} p
 * @returns {(text: string) => Promise<Talkrost>}
 */
export function vidareISamtal({ kalla, sid, uid, skicka }) {
  if (!kalla || typeof kalla.prenumerera !== "function") throw new Error("vidareISamtal: samtalskällan ska kunna prenumerera, annars går svaret inte att vänta in.");
  if (typeof sid !== "string" || !sid || typeof uid !== "string" || !uid) throw new Error("vidareISamtal: sid och uid krävs.");
  const sand = skicka ?? ((/** @type {string} */ text) => kalla.skicka(sid, { text, av: uid }));
  /** @param {string} text @returns {Promise<Talkrost>} */
  const vidare = async (text) => {
    const ny = await sand(text);
    if (!ny || typeof ny.id !== "string") throw new Error("vidareISamtal: det skickade meddelandet saknar id, så svaret kan inte kännas igen.");
    return { svar: (opt) => samtalssvar({ kalla, sid, uid, efter: ny, signal: opt?.signal, onUtkast: opt?.onUtkast }), vidare };
  };
  return vidare;
}
