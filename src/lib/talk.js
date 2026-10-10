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
  if (lage === "skickar") return `${TALK_ORD}, sparar`;
  if (lage === "sparat") return `${TALK_ORD}, sparat`;
  return TALK_PRATA_IN;
}

/**
 * Under den här längden kastar Avbryt direkt. Från och med den frågar fältet, för ett långt ljud som
 * försvinner på ett misstagtryck går inte att få tillbaka.
 */
export const AVBRYT_FRAGA_SEKUNDER = 3;

/** Hur länge "Sparat" står kvar innan fältet stängs. */
export const SPARAT_MS = 1400;

/** Längsta inspelningen. Ett fält som glömts öppet ska inte spela in i en timme. */
export const MAX_SEKUNDER = 120;

/**
 * @typedef {"vila" | "trycker" | "haller" | "lyssnar" | "skickar" | "sparat" | "fel"} Talklage
 * - `vila`: inget pågår.
 * - `trycker`: fingret är nere men långtrycket har inte inträffat. Ett släpp här är ett vanligt klick.
 * - `haller`: långtrycket har inträffat och inspelningen pågår medan fingret ligger kvar. Knappen visar TALK.
 * - `lyssnar`: fingret är släppt och inspelningen fortsätter i fältet.
 * - `skickar`: inspelningen är stoppad och ljudet lämnas till appen. Fältet säger Sparar.
 * - `sparat`: appen tog emot ljudet. Fältet säger Sparat en kort stund, sedan vila.
 * - `fel`: mikrofonen gick inte att öppna, eller appen svarade med ett fel. Fältet säger varför.
 */

/**
 * @typedef {{ typ: "ner" } | { typ: "direkt" } | { typ: "langtryck" } | { typ: "upp" } | { typ: "skicka" } | { typ: "igen" } | { typ: "avbryt" } | { typ: "klar" } | { typ: "dolj" } | { typ: "fel", text: string } | { typ: "tak" }} Talkhandelse
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
 * @param {{ lage: Talklage, fel?: string }} nu
 * @param {Talkhandelse} h
 * @returns {{ lage: Talklage, fel?: string, gor: null | "klick" | "starta" | "skicka" | "igen" | "kasta" }}
 */
export function talkNasta(nu, h) {
  /** @param {Talklage} lage @param {null | "klick" | "starta" | "skicka" | "igen" | "kasta"} [gor] @param {string} [fel] */
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
      if (h.typ === "fel") return bli("fel", null, h.text);
      return bli("skickar");
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
      forsok += 1;
      const mitt = forsok;
      const ny = await md.getUserMedia({ audio: true });
      if (mitt !== forsok) {
        ny.getTracks().forEach((t) => t.stop());
        throw new Error("Inspelningen avbröts innan mikrofonen öppnades.");
      }
      strom = ny;
      valtFormat = valjFormat(MR.isTypeSupported?.bind(MR));
      rec = new MR(strom, valtFormat ? { mimeType: valtFormat } : undefined);
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
          // ⛔ Reserv är mp4: Safari sparar utan mimeType på bitarna. webm som
          // reserv hade gett en fil Chromium inte kunde spela när den egentligen
          // var AAC i en mp4-container.
          const mimeType = r.mimeType || (bitar[0] && bitar[0].type) || valtFormat || "audio/mp4";
          const blob = new Blob(bitar, { type: mimeType });
          const sekunder = Math.round((nu() - start) / 100) / 10;
          rec = null;
          valtFormat = "";
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
export const MIKROFON_SPARRAD_AV_SIDAN = "Mikrofonen är spärrad av sidan som visar appen. Öppna appen i ett eget fönster för att spela in.";

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
    return "Mikrofonen är inte tillåten. Ge sidan tillgång till mikrofonen i webbläsarens inställningar.";
  }
  if (namn === "NotFoundError") return "Ingen mikrofon hittades.";
  const text = fel instanceof Error ? fel.message : String(fel || "");
  return text || "Inspelningen gick inte att starta.";
}
