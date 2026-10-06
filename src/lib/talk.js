/**
 * TALK: att prata in något i stället för att skriva det (0.57.0, cllp/lifehub.app#2).
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN FINNS ═════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-02: "Långpress på + [...] spelar in tills man släpper." CP 2026-10-04: medan man håller inne står det bara
 * en sak, TALK, och ett fält kommer fram så att man kan prata vidare utan att hålla inne. Mikrofonen skickar, krysset
 * avbryter, och bara texten sparas (appens sak). Besluten står i cllp/lifehub.app#2.
 *
 * ══ ⛔ RAMVERKET SPELAR IN, APPEN BESTÄMMER VAD DET BLIR ═══════════════════════════════════════════════════════════════
 *
 * Ramverket äger hållet, fältet och inspelningen, så att varje hubb beter sig likadant. Ljudet lämnas till appen i
 * `onTalk(blob, { mimeType, sekunder })`. Vad ljudet blir (text, ett ärende, ett förslag i Inkorgen) vet bara appen,
 * och ramverket ska inte veta det.
 *
 * ══ ⛔ TILLSTÅNDEN ÄR EN REN FUNKTION ═════════════════════════════════════════════════════════════════════════════════
 *
 * Ett tryck som ska bli ett klick, ett långtryck som blir en inspelning och ett släpp som INTE avslutar den är tre
 * saker som är lätta att blanda ihop i en komponent med timers. Här är de en övergångstabell som går att prova utan
 * webbläsare och utan mikrofon.
 */

/** Hur länge ett tryck måste ligga kvar för att vara ett långtryck. Samma tal som kalenderns snabbtitt och SessionStudio. */
export const LANGTRYCK_MS = 450;

/** Den enda text knappen visar medan fingret ligger kvar (CP 2026-10-04: "Den skall bara heta en sak"). */
export const TALK_ORD = "TALK";

/**
 * Namnet på vägen in i TALK utan att hålla (#276): raden i Skapa och huvudets mikrofonknapp på dator. EN sträng, så
 * att raden och knappen inte kan börja heta olika saker.
 */
export const TALK_PRATA_IN = "TALK, prata in";

/**
 * Huvudets mikrofonknapp säger vilket läge inspelningen är i (#276). Namnet är det skärmläsaren läser och det tooltipen
 * visar, så den som inte ser att knappen är tänd hör det i stället.
 * @param {Talklage} lage
 * @returns {string}
 */
export function talkKnappNamn(lage) {
  if (lage === "haller" || lage === "lyssnar") return `${TALK_ORD}, lyssnar`;
  if (lage === "skickar") return `${TALK_ORD}, skickar`;
  return TALK_PRATA_IN;
}

/** Längsta inspelningen. Ett fält som glömts öppet ska inte spela in i en timme. */
export const MAX_SEKUNDER = 120;

/**
 * @typedef {"vila" | "trycker" | "haller" | "lyssnar" | "skickar" | "fel"} Talklage
 * - `vila`: inget pågår.
 * - `trycker`: fingret är nere men långtrycket har inte inträffat. Ett släpp här är ett vanligt klick.
 * - `haller`: långtrycket har inträffat och inspelningen pågår medan fingret ligger kvar. Knappen visar TALK.
 * - `lyssnar`: fingret är släppt och inspelningen fortsätter i fältet.
 * - `skickar`: mikrofonen är tryckt, ljudet lämnas till appen.
 * - `fel`: mikrofonen gick inte att öppna, eller appen svarade med ett fel. Fältet säger varför.
 */

/**
 * @typedef {{ typ: "ner" } | { typ: "direkt" } | { typ: "langtryck" } | { typ: "upp" } | { typ: "skicka" } | { typ: "avbryt" } | { typ: "klar" } | { typ: "fel", text: string } | { typ: "tak" }} Talkhandelse
 */

/**
 * Nästa läge, och vad komponenten ska göra (`gor`). En händelse som inte passar läget ändrar ingenting.
 *
 * ⛔ "UPP" EFTER ETT LÅNGTRYCK AVSLUTAR INTE. Det är hela poängen med fältet: man släpper och pratar vidare. Bara
 * mikrofonen skickar och bara krysset avbryter.
 *
 * ⛔ "UPP" FÖRE LÅNGTRYCKET ÄR ETT KLICK, och klicket är Skapa som förut. Ett tryck som råkade bli 300 ms ska aldrig
 * starta en inspelning.
 *
 * @param {{ lage: Talklage, fel?: string }} nu
 * @param {Talkhandelse} h
 * @returns {{ lage: Talklage, fel?: string, gor: null | "klick" | "starta" | "skicka" | "kasta" }}
 */
export function talkNasta(nu, h) {
  /** @param {Talklage} lage @param {null | "klick" | "starta" | "skicka" | "kasta"} [gor] @param {string} [fel] */
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
      if (h.typ === "klar") return bli("vila");
      if (h.typ === "fel") return bli("fel", null, h.text);
      return bli("skickar");
    case "fel":
      if (h.typ === "avbryt" || h.typ === "klar") return bli("vila");
      if (h.typ === "ner") return bli("trycker");
      if (h.typ === "direkt") return bli("lyssnar", "starta");
      return bli("fel", null, nu.fel);
    default:
      return bli("vila");
  }
}

/** Formaten i den ordning de prövas. iOS spelar bara in `audio/mp4`, Chromium och Firefox `audio/webm`. */
export const LJUDFORMAT = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

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
 * En inspelare: det komponenten behöver av webbläsaren, och inget mer.
 * @typedef {object} Inspelare
 * @property {() => Promise<void>} starta Öppnar mikrofonen och börjar spela in. Kastar med webbläsarens fel.
 * @property {() => Promise<{ blob: Blob, mimeType: string, sekunder: number }>} stoppa Slutar och lämnar ljudet.
 * @property {() => void} kasta Slutar och kastar ljudet. Mikrofonen släpps.
 * @property {() => number} niva Ljudnivån just nu, 0 till 1, för prickarna.
 */

/**
 * Inspelaren mot webbläsarens `MediaRecorder`. Används när appen inte skickar in en egen (proven gör det).
 *
 * ⛔ MIKROFONEN SLÄPPS ALLTID, också när inspelningen kastas. En flik som håller mikrofonen öppen visar en röd prick i
 * statusraden, och den som ser den efter att ha tryckt på krysset slutar lita på knappen.
 *
 * @param {{ mediaDevices?: MediaDevices, MediaRecorder?: typeof MediaRecorder, AudioContext?: typeof AudioContext, nu?: () => number }} [miljo]
 * @returns {Inspelare}
 */
export function webblasarensInspelare(miljo = {}) {
  const md = miljo.mediaDevices || (typeof navigator !== "undefined" ? navigator.mediaDevices : undefined);
  const MR = miljo.MediaRecorder || (typeof MediaRecorder !== "undefined" ? MediaRecorder : undefined);
  const AC = miljo.AudioContext || (typeof AudioContext !== "undefined" ? AudioContext : undefined);
  const nu = miljo.nu || (() => Date.now());
  /** @type {MediaStream | null} */
  let strom = null;
  /** @type {MediaRecorder | null} */
  let rec = null;
  /** @type {Blob[]} */
  let bitar = [];
  let start = 0;
  /** @type {AnalyserNode | null} */
  let analys = null;
  /** @type {AudioContext | null} */
  let ctx = null;
  const slapp = () => {
    strom?.getTracks().forEach((t) => t.stop());
    strom = null;
    ctx?.close().catch(() => {});
    ctx = null;
    analys = null;
  };
  return {
    async starta() {
      if (!md || !MR) throw new Error("Den här webbläsaren kan inte spela in ljud.");
      strom = await md.getUserMedia({ audio: true });
      const format = valjFormat(MR.isTypeSupported?.bind(MR));
      rec = new MR(strom, format ? { mimeType: format } : undefined);
      bitar = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) bitar.push(e.data);
      };
      rec.start(250);
      start = nu();
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
      }
    },
    stoppa() {
      return new Promise((klar, fel) => {
        if (!rec) {
          fel(new Error("Ingen inspelning pågår."));
          return;
        }
        const r = rec;
        r.onstop = () => {
          const mimeType = r.mimeType || (bitar[0] && bitar[0].type) || "audio/webm";
          const blob = new Blob(bitar, { type: mimeType });
          const sekunder = Math.round((nu() - start) / 100) / 10;
          rec = null;
          slapp();
          klar({ blob, mimeType, sekunder });
        };
        r.stop();
      });
    },
    kasta() {
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
      rec = null;
      bitar = [];
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
 * Felet som en människa läser, ur webbläsarens fel. ⛔ ORDET OCH INTE NAMNET: "NotAllowedError" säger ingenting i en
 * telefon, "Mikrofonen är inte tillåten" säger vad man ska göra.
 * @param {unknown} fel
 * @returns {string}
 */
export function talkFeltext(fel) {
  const namn = fel && typeof fel === "object" && "name" in fel ? String(/** @type {any} */ (fel).name) : "";
  if (namn === "NotAllowedError" || namn === "SecurityError") return "Mikrofonen är inte tillåten. Ge sidan tillgång till mikrofonen i webbläsarens inställningar.";
  if (namn === "NotFoundError") return "Ingen mikrofon hittades.";
  const text = fel instanceof Error ? fel.message : String(fel || "");
  return text || "Inspelningen gick inte att starta.";
}
