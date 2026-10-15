import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AVBRYT_FRAGA_SEKUNDER, LANGTRYCK_MS, MAX_SEKUNDER, SPARAT_MS, TALK_SKICKAR_TEXT, TALK_INGET_LJUD, TALK_TEXTFEL, ORD_TALK, igenkanningensSprak, kanBeOmMikrofon, kanSpelaInIgen, kontrolleraSkickarText, talkFeltext, talkKvitto, talkNasta, talkOrd, talkTextPa, talkUnderlag, webblasarensIgenkanning, webblasarensInspelare } from "../lib/talk.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { formateraTid } from "../lib/ljudspelare.js";
import { rapporteraFel } from "../lib/felrapport.js";
import { AgentIkon, ArendePlusIkon, BockIkon, HandelsePlusIkon, KryssIkon, KugghjulIkon, MeddelandeIkon, MikrofonIkon, StoppIkon } from "./icons.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";

/**
 * TALK i komponenterna: kroken som binder ihop flödet, inspelaren och plusknappen, och fältet som ligger över appen
 * (0.57.0, cllp/lifehub.app#2). Flödet och skälen står i `src/lib/talk.js`.
 */

/**
 * @typedef {object} TalkVal
 * @property {(blob: Blob, meta: { mimeType: string, sekunder: number, rapportera: (andel: number) => void, text?: string }) => Promise<void | import("../lib/talk.js").Talkkvitto> | void | import("../lib/talk.js").Talkkvitto} onTalk Appens mottagare.
 *   `text` (0.96.0) är det webbläsarens taligenkänning hörde, och finns bara när den är hel. Saknas den gäller ljudet.
 *   (0.97.0, lifehub.app#219) Löser den till `{ kvitto, angra? }` visar fältet kvittot, med Ångra när `angra` finns och Stäng,
 *   och döljs inte av sig självt. Ångra anropar `angra()`: lyckas den står "Ångrat" och fältet döljs, faller den står felet kvar.
 *   Allt annat (ingenting, ett id) är Sparat som förut. Ett kvitto utan text, eller en `angra` som inte är en funktion, rapporteras
 *   som fel och fältet säger Sparat, eftersom det appen gjorde redan är gjort.
 *   ⛔ Kastar den eller avvisar löftet visas felet i fältet, med Försök igen. Ett ljud som tyst försvann hade sett ut som ett skickat.
 *   `rapportera` tar 0 till 1, samma kvot som `bytesTransferred / totalBytes` i `uploadBytesResumable`. Utan anrop visas en snurra.
 *   ⛔ LÖFTET MÅSTE AVGÖRAS INOM RIMLIG TID, löst eller avvisat. Läget skickar har ingen väg ut: fältet visar statusraden
 *   (`skickarText`) utan Avbryt eller Stäng tills löftet svarar, och ett löfte som aldrig svarar lämnar fältet stående. Ramverket
 *   lägger ingen egen tidsgräns, eftersom bara appen vet hur länge dess arbete får ta (en uppladdning, en agent). Väntar appen på
 *   något som kan hänga, sätter den sin egen gräns och avvisar med ett fel som säger vad som hände; då får personen Försök igen.
 * @property {() => void} [onInstallningar] Kugghjulet i fältet. Utan den ritas inget kugghjul.
 * @property {import("react").ReactNode} [marke] Märket längst till vänster i fältet, vanligen hubbens.
 * @property {import("../lib/talk.js").Inspelare} [inspelare] Bara för prov. Förval: webbläsarens `MediaRecorder`.
 * @property {import("../lib/talk.js").Igenkanning | boolean} [igenkanning] (0.96.0) Text medan man pratar. ⛔ AV SOM FÖRVAL
 *   (granskningen av PR 358, MÅSTE 3): webbläsaren skickar då talet till Googles eller Apples taltjänst, och det är appens val.
 *   `true` slår på webbläsarens taligenkänning när den finns. Utan den lämnas bara ljudet, som före 0.96.0.
 * @property {string} [skickarText] (0.97.0) Statusraden medan det inspelade lämnas till appen. Förval `TALK_SKICKAR_TEXT`
 *   ("Sparar…"). lifehub.app skickar "Agenten arbetar…". En tom sträng eller något annat än en sträng kastar.
 * @property {(text: string) => void | Promise<void>} [onAgent] (0.105.0) Agent-knappen. Med den lämnar Klar inte det sagda till `onTalk`:
 *   fältet visar texten och valen Meddelande, Händelse, Ärende och Agent (läget `hort`), och Agent lämnar texten hit. Fältet stängs
 *   när löftet löser sig, eftersom appen tar över (lifehub.app öppnar chatten med agenten). Avvisas löftet står felet i fältet med
 *   Försök igen och texten kvar. ⛔ BARA MED TEXT: hördes inget (igenkänningen av eller föll) går ljudet till `onTalk` som förut,
 *   eftersom det inte finns något att välja med.
 * @property {number} [maxSekunder] Tak i sekunder. Förval `MAX_SEKUNDER` (120), så TALK inte ändras. Bibliotekets idé använder 600.
 * @property {ReadonlyArray<{ id: string, etikett: string }>} [mal] Appens egna mål i fältet. ⛔ (0.99.0) Mikrofonen erbjuder bara dessa. Modulernas
 *   mål (`inspelning.mal`) nås bara genom modulens egen rad (Ny-menyn: Röstinspelning), som öppnar fältet låst till målet utan val.
 */

/**
 * ⛔ EN MIKROFON ÅT GÅNGEN, FÖR HELA SIDAN. Varje `useTalk` har sin egen inspelare, och sedan 0.72.0 finns två på samma sida:
 * TALK-knappen i huvudet (0.71.0) och ljudvågen i chattens skrivfält. Utan en gemensam spärr spelade båda in samtidigt, och samma
 * ord gick både till appens TALK och in i chattens fält. Den som försöker starta en andra får ett fel som säger vad som pågår, och
 * den första spelar in vidare. Inget ljud kastas av spärren.
 * @type {object | null}
 */
let mikrofonenUpptagenAv = null;

/** Felet när en annan del av sidan redan spelar in. */
export const TALK_UPPTAGEN = ORD_TALK.felUpptagen.sv;

/**
 * @param {TalkVal & { onKlick: () => void }} val `onKlick` är det ett vanligt tryck gör, Skapa.
 */
export function useTalk({ onTalk, onKlick, onAgent, inspelare, igenkanning, skickarText, maxSekunder = MAX_SEKUNDER }) {
  if (onAgent !== undefined && typeof onAgent !== "function") {
    throw new Error(`useTalk: onAgent ska vara en funktion, fick ${onAgent === null ? "null" : typeof onAgent}. Agent-knappen lämnar det sagda dit, och utan en funktion hade trycket inte gjort något.`);
  }
  const onAgentRef = useRef(onAgent);
  onAgentRef.current = onAgent;
  /** Vart det sagda senast lämnades, så att Försök igen går till samma mottagare. @type {{ current: "talk" | "agent" }} */
  const senastMal = useRef(/** @type {"talk" | "agent"} */ ("talk"));
  if (!Number.isInteger(maxSekunder) || maxSekunder < 1) {
    throw new Error(`useTalk: maxSekunder ska vara ett positivt heltal, fick ${String(maxSekunder)}. Ett tyst tak hade antingen klippt direkt eller spelat in utan slut.`);
  }
  kontrolleraSkickarText(skickarText, "useTalk");
  const [tillstand, setTillstand] = useState(/** @type {{ lage: import("../lib/talk.js").Talklage, fel?: string }} */ ({ lage: "vila" }));
  const lageRef = useRef(tillstand);
  lageRef.current = tillstand;
  const inspRef = useRef(inspelare || null);
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const tak = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const svalj = useRef(false);
  /**
   * ⛔ VILKET FÖRSÖK ETT SVAR HÖR TILL (#281). Varje start får ett nummer, och Avbryt, Skicka, ett fel och avmonteringen räknar
   * upp det. Ett svar från `starta()` med ett gammalt nummer gör inget mer: förut jämfördes bara läget, så ett avbrutet försök
   * vars mikrofon öppnades efteråt spelade in i bakgrunden, och efter avmonteringen skickades ljudet till appen efter 120 s.
   */
  const forsok = useRef(0);
  /**
   * ⛔ OMGÅNGENS NUMMER OCH HUR FÖRRA IGENKÄNNINGEN SLUTADE (0.107.0, lifehub.app#253), för diagnosen när en inspelning blev tom.
   * `omgang` räknar starter som fick mikrofonspärren i den här kroken. Inget om personen, ingen text.
   */
  const omgang = useRef(0);
  const forraIgenkanning = useRef(/** @type {import("../lib/talk.js").Igenkanningsslut | null} */ (null));
  const monterad = useRef(true);
  const [sekunder, setSekunder] = useState(0);
  const [framsteg, setFramsteg] = useState(/** @type {number | null} */ (null));
  const [kanIgen, setKanIgen] = useState(false);
  const startTid = useRef(0);
  /** När mikrofonen faktiskt blev öppen, 0 medan den inte är det. Taket och sekundräknaren räknas härifrån. */
  const mikStart = useRef(0);
  /** Ljudet som redan stoppats, så Försök igen inte spelar in på nytt. */
  const senast = useRef(/** @type {{ blob: Blob, mimeType: string, sekunder: number, text?: string } | null} */ (null));
  const insp = () => {
    if (!inspRef.current) inspRef.current = webblasarensInspelare();
    return inspRef.current;
  };
  const sprak = useOpsSprak();
  const sprakRef = useRef(sprak);
  sprakRef.current = sprak;
  /** Igenkänningen, skapad första gången den behövs. `null` när webbläsaren saknar den eller appen stängt av den. */
  const igkRef = useRef(/** @type {import("../lib/talk.js").Igenkanning | null | undefined} */ (igenkanning === true ? undefined : igenkanning && typeof igenkanning === "object" ? igenkanning : null));
  const igk = () => {
    if (igkRef.current === undefined) igkRef.current = webblasarensIgenkanning();
    return igkRef.current;
  };
  /** Det som hörts hittills i det pågående försöket, för fältet. */
  const [text, setText] = useState("");
  /** (0.99.0) Igenkänningen föll eller gick inte att starta: fältet säger det i stället för att ligga tyst med sin platstext. */
  const [textFel, setTextFel] = useState("");
  /**
   * ⛔ KVITTOT (0.97.0, lifehub.app#219). Finns bara i läget sparat, och nollas av varje händelse som lämnar det: Stäng, en ny
   * inspelning, ett långtryck. `angraForsok` räknas upp samtidigt, så att en Ångra som svarar efter att kvittot försvunnit
   * inte sätter något. Refen speglar staten, så att ett andra tryck i samma ögonblick ser att Ångra redan pågår.
   * @typedef {{ text: string, angra: (() => Promise<void>) | null, status: "visas" | "angrar" | "angrat", fel?: string }} Kvittolage
   */
  const [kvitto, setKvittoState] = useState(/** @type {Kvittolage | null} */ (null));
  const kvittoRef = useRef(/** @type {Kvittolage | null} */ (null));
  const angraForsok = useRef(0);
  const setKvitto = (/** @type {Kvittolage | null} */ k) => {
    kvittoRef.current = k;
    setKvittoState(k);
  };
  const kastaText = () => {
    try {
      igk()?.kasta();
    } catch (fel) {
      rapporteraFel(fel, { yta: "OpsTalk", steg: "kasta-text" });
    }
  };
  const rensa = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const frigor = () => {
    if (mikrofonenUpptagenAv === inspRef) mikrofonenUpptagenAv = null;
  };
  const rensaTak = () => {
    if (tak.current) clearTimeout(tak.current);
    tak.current = null;
  };
  /**
   * ⛔ TAKET LÄSES UR EN REF OCH RÄKNAS FRÅN ATT MIKROFONEN ÄR ÖPPEN (0.93.0). Förut sattes tiden en gång, med det `maxSekunder`
   * som gällde i den `skicka` som råkade starta inspelningen. Väljer personen ett annat mål medan det spelar in, eller väljs
   * målet i samma ögonblick som `direkt()` körs (Ny post, Röstinspelning), visade fältet 10:00 medan inspelningen klipptes vid 2:00.
   * Därför läser både starten och ändringen av taket samma ref.
   *
   * ⛔ KLOCKAN ÄR `mikStart`, INTE TRYCKET. Första versionen räknade från trycket (`startTid`), och mikrofonprompten
   * (`getUserMedia`) kan ta lång tid: en prompt på 30 s gav 90 s ljud i stället för 120, och en på 130 s gav 0,001 s. Taket är
   * en gräns för hur mycket LJUD målet tar emot, så den räknas från att inspelningen faktiskt rullar. Är taket redan passerat när
   * det byts till ett kortare, avslutas inspelningen direkt: målet tar inte emot längre ljud än sitt tak.
   */
  const maxRef = useRef(maxSekunder);
  maxRef.current = maxSekunder;
  const skickaRef = useRef(/** @type {(h: import("../lib/talk.js").Talkhandelse) => void} */ (() => {}));
  const planeraTak = () => {
    if (tak.current) clearTimeout(tak.current);
    const kvar = maxRef.current * 1000 - (Date.now() - mikStart.current);
    tak.current = setTimeout(() => skickaRef.current({ typ: "tak" }), Math.max(0, kvar));
  };

  const skicka = useCallback(
    /** @param {import("../lib/talk.js").Talkhandelse} h */
    (h) => {
      const nasta = talkNasta(lageRef.current, h);
      lageRef.current = nasta;
      setTillstand({ lage: nasta.lage, ...(nasta.fel ? { fel: nasta.fel } : {}) });
      if (nasta.lage !== "sparat" && kvittoRef.current) {
        angraForsok.current += 1;
        setKvitto(null);
      }
      if (nasta.gor === "klick") onKlick();
      if (nasta.gor === "kasta") {
        forsok.current += 1;
        rensaTak();
        senast.current = null;
        setKanIgen(false);
        setFramsteg(null);
        setText("");
        setTextFel("");
        kastaText();
        try {
          insp().kasta();
        } catch (fel) {
          rapporteraFel(fel, { yta: "OpsTalk", steg: "kasta" });
        }
        frigor();
      }
      if (nasta.gor === "starta") {
        startTid.current = Date.now();
        mikStart.current = 0;
        setSekunder(0);
        // ⛔ EN NY OMGÅNG BÖRJAR TOM (0.99.0). Förut stod förra omgångens text kvar tills mikrofonen öppnats, och efter ett kvitto
        // (Svara) hade den gamla texten legat kvar under den nya frågan i den tid mikrofonprompten tog.
        setText("");
        setTextFel("");
        if (mikrofonenUpptagenAv && mikrofonenUpptagenAv !== inspRef) {
          skicka({ typ: "fel", text: TALK_UPPTAGEN });
          return;
        }
        mikrofonenUpptagenAv = inspRef;
        forsok.current += 1;
        const mitt = forsok.current;
        omgang.current += 1;
        forraIgenkanning.current = null;
        rensaTak();
        /*
         * ⛔ FÖRRA OMGÅNGENS IGENKÄNNING ÄR AVSLUTAD INNAN MIKROFONEN ÖPPNAS (0.107.0, lifehub.app#253). `slapp` gör `abort()` och väntar
         * på `end`, med ett tak (`IGENKANNING_SLAPP_MS`), så att en igenkännare som inte säger `end` inte hänger fältet. Den nya
         * igenkännaren startas först när mikrofonen är öppen, nedan, och då är den förra alltså också borta. Hypotesen och skälet står
         * vid `slapp` i lib/talk.js.
         */
        /*
         * ⛔ INGEN VÄNTAN NÄR INGET ÄR KVAR: då öppnas mikrofonen i samma tryck som förut, synkront i händelsen. Bara när förra
         * igenkännaren inte sagt `end` lämnar `slapp` ett löfte. Ett fel i `slapp` stoppar aldrig inspelningen.
         */
        /** @type {import("../lib/talk.js").Igenkanningsslut | null | Promise<import("../lib/talk.js").Igenkanningsslut | null>} */
        let forraSlut = null;
        try {
          const g = igk();
          forraSlut = g && typeof g.slapp === "function" ? g.slapp() : null;
        } catch (fel) {
          rapporteraFel(fel, { yta: "OpsTalk", steg: "slapp-text" });
        }
        /** @param {import("../lib/talk.js").Igenkanningsslut | null} slut */
        const oppna = (slut) => {
          // Ett avbrutet försök öppnar ingen mikrofon. Spärren släpptes av den väg som avbröt det.
          if (mitt !== forsok.current || !monterad.current) return Promise.resolve(false);
          forraIgenkanning.current = slut;
          return insp()
            .starta()
            .then(() => true);
        };
        (forraSlut && typeof (/** @type {any} */ (forraSlut).then) === "function"
          ? /** @type {Promise<import("../lib/talk.js").Igenkanningsslut | null>} */ (forraSlut)
              .catch((fel) => {
                rapporteraFel(fel, { yta: "OpsTalk", steg: "slapp-text" });
                return null;
              })
              .then(oppna)
          : oppna(/** @type {import("../lib/talk.js").Igenkanningsslut | null} */ (forraSlut))
        )
          .then((startad) => {
            if (startad === false) return;
            if (mitt === forsok.current && monterad.current) {
              mikStart.current = Date.now();
              setSekunder(0);
              planeraTak();
              // ⛔ TEXTEN BÖRJAR NÄR MIKROFONEN ÄR ÖPPEN, inte vid trycket. Ett fel här stoppar aldrig inspelningen.
              setText("");
              try {
                igk()?.starta({
                  sprak: igenkanningensSprak(sprakRef.current),
                  onText: (t) => {
                    if (mitt === forsok.current && monterad.current) setText(t);
                  },
                  // ⛔ Ett fel härifrån får aldrig vara tyst (regel 5): fältet säger att texten uteblir, och ljudet spelas in ändå.
                  onFel: () => {
                    if (mitt === forsok.current && monterad.current) setTextFel(TALK_TEXTFEL);
                  },
                });
              } catch (fel) {
                rapporteraFel(fel, { yta: "OpsTalk", steg: "starta-text" });
              }
              return;
            }
            // ⛔ Ett avbrutet eller avmonterat försök vars mikrofon öppnades efteråt. Står ett nyare försök och spelar in rör vi
            // inte inspelaren: webbläsarens inspelare stänger själv en ström som öppnats för ett avbrutet försök. Annars
            // stängs den här, så att den inte spelar in i bakgrunden.
            const l = lageRef.current.lage;
            if (!monterad.current || (l !== "haller" && l !== "lyssnar")) {
              try {
                insp().kasta();
              } catch (fel) {
                rapporteraFel(fel, { yta: "OpsTalk", steg: "kasta" });
              }
            }
          })
          .catch((fel) => {
            // Ett gammalt försök har redan släppt spärren och visat sitt. Ett nytt försök kan äga den nu.
            // ⛔ Spärren släpps av felet självt: "fel" under håll eller lyssnar ger "kasta", och den grenen släpper den.
            if (mitt !== forsok.current || !monterad.current) return;
            skicka({ typ: "fel", text: talkFeltext(fel) });
          });
      }
      /**
       * @param {{ blob: Blob, mimeType: string, sekunder: number, text?: string }} post
       */
      const lamna = (post) => {
        senastMal.current = "talk";
        setFramsteg(null);
        const rapportera = (/** @type {number} */ andel) => {
          if (!monterad.current) return;
          const n = Number(andel);
          if (!Number.isFinite(n)) return;
          setFramsteg(Math.min(1, Math.max(0, n)));
        };
        return Promise.resolve()
          .then(() => onTalk(post.blob, { mimeType: post.mimeType, sekunder: post.sekunder, rapportera, ...(post.text ? { text: post.text } : {}) }))
          .then((svar) => {
            if (!monterad.current) return;
            senast.current = null;
            setKanIgen(false);
            /** @type {{ text: string, angra: (() => Promise<void>) | null } | null} */
            let k = null;
            try {
              k = talkKvitto(svar);
            } catch (fel) {
              // ⛔ INTE FÖRSÖK IGEN. Appen har redan gjort det den skulle, och ett nytt försök hade gjort det två gånger.
              // Felet är appens och går till felrapporten. Personen får det som är sant: att det sparades.
              rapporteraFel(fel, { yta: "OpsTalk", steg: "kvitto" });
            }
            if (k) {
              angraForsok.current += 1;
              setKvitto({ ...k, status: "visas" });
            }
            skicka({ typ: "klar" });
          })
          .catch((fel) => {
            if (!monterad.current) return;
            rapporteraFel(fel, { yta: "OpsTalk", steg: "skicka" });
            skicka({ typ: "fel", text: fel instanceof Error && fel.message ? fel.message : ORD_TALK.felSpara.sv });
          });
      };
      /**
       * Agent (0.105.0): det sagda till appens `onAgent`. ⛔ FÄLTET STÄNGS NÄR APPEN SVARAT, för appen tar över (chatten öppnas). Ett
       * fel tar fältet tillbaka till valen med texten och felet (`agentFel`), så att personen kan välja Meddelande eller Ärende i
       * stället, och ett nytt tryck på Agent går hit igen, aldrig till `onTalk`.
       * @param {{ blob: Blob, mimeType: string, sekunder: number, text?: string }} post
       */
      const lamnaTillAgent = (post) => {
        senastMal.current = "agent";
        const mottagare = onAgentRef.current;
        return Promise.resolve()
          .then(() => {
            if (typeof mottagare !== "function") throw new Error(ORD_TALK.felAgent.sv);
            return mottagare(post.text ?? "");
          })
          .then(() => {
            if (!monterad.current) return;
            senast.current = null;
            setKanIgen(false);
            skicka({ typ: "lamnat" });
          })
          .catch((fel) => {
            if (!monterad.current) return;
            rapporteraFel(fel, { yta: "OpsTalk", steg: "agent" });
            skicka({ typ: "agentFel", text: fel instanceof Error && fel.message ? fel.message : ORD_TALK.felAgent.sv });
          });
      };
      if (nasta.gor === "agent") {
        const post = senast.current;
        if (!post?.text) {
          skicka({ typ: "fel", text: ORD_TALK.felIngetKvar.sv });
          return;
        }
        lamnaTillAgent(post);
        return;
      }
      if (nasta.gor === "skicka" || nasta.gor === "igen") {
        forsok.current += 1;
        const mitt = forsok.current;
        rensaTak();
        setFramsteg(null);
        if (nasta.gor === "igen") {
          const post = senast.current;
          if (!post) {
            skicka({ typ: "fel", text: ORD_TALK.felIngetKvar.sv });
            return;
          }
          if (senastMal.current === "agent") lamnaTillAgent(post);
          else lamna(post);
          return;
        }
        // ⛔ TEXTEN OCH LJUDET STOPPAS SAMTIDIGT. Texten följer med bara om igenkänningen var hel hela vägen.
        const texten = Promise.resolve()
          .then(() => igk()?.stoppa() ?? "")
          .catch((fel) => {
            rapporteraFel(fel, { yta: "OpsTalk", steg: "stoppa-text" });
            return "";
          });
        Promise.all([insp().stoppa().finally(frigor), texten])
          .then(([ljud, hord]) => {
            if (mitt !== forsok.current || !monterad.current) return;
            /*
             * ⛔ TOM TEXT OCH TOMT LJUD SKICKAS ALDRIG (lifehub.app#253). Förut gick 0 byte och ingen text till appen ändå, appen
             * skickade dem till sin server, och fältet visade serverns "Inget ljud kom fram. Försök igen." Försök igen lämnade sedan
             * samma 0 byte en gång till. Nu stannar det här: inget anrop, fältet säger vad som hände (`TALK_INGET_LJUD`), och Spela in
             * igen startar en ny omgång. Det som sågs om strömmen går
             * till felrapporten, eftersom orsaken på iOS är en hypotes som bara en riktig telefon kan avgöra (regel 3).
             */
            if (!hord && !(ljud.blob && ljud.blob.size > 0)) {
              rapporteraFel(new Error("TALK: inspelningen gav inget ljud och ingen text, och inget skickades."), {
                yta: "OpsTalk",
                steg: "tomt-ljud",
                sekunder: ljud.sekunder,
                igenkanning: igk() !== null,
                // ⛔ (0.107.0) Omgången och hur förra igenkänningen slutade. `null` för förra igenkänningen betyder att ingen fanns.
                omgang: omgang.current,
                forraIgenkanningHann: forraIgenkanning.current ? forraIgenkanning.current.hann : null,
                forraIgenkanningMs: forraIgenkanning.current ? forraIgenkanning.current.ms : null,
                ...(ljud.diagnos ?? {}),
              });
              senast.current = null;
              setKanIgen(false);
              setText("");
              skicka({ typ: "fel", text: TALK_INGET_LJUD });
              return undefined;
            }
            const post = { blob: ljud.blob, mimeType: ljud.mimeType, sekunder: ljud.sekunder, ...(hord ? { text: hord } : {}) };
            setText(hord);
            senast.current = post;
            setKanIgen(true);
            // ⛔ MED AGENT VÄLJER PERSONEN (0.105.0): det sagda står i fältet med valen, och inget lämnas förrän hen tryckt.
            if (hord && typeof onAgentRef.current === "function") {
              senastMal.current = "agent";
              skicka({ typ: "hort" });
              return undefined;
            }
            return lamna(post);
          })
          .catch((fel) => {
            if (mitt !== forsok.current || !monterad.current) return;
            rapporteraFel(fel, { yta: "OpsTalk", steg: "stoppa" });
            skicka({ typ: "fel", text: fel instanceof Error && fel.message ? fel.message : ORD_TALK.felAvsluta.sv });
          });
      }
    },
    [onKlick, onTalk, maxSekunder],
  );

  const spelarIn = tillstand.lage === "haller" || tillstand.lage === "lyssnar";
  useEffect(() => {
    if (!spelarIn) return undefined;
    const id = setInterval(() => {
      // Sekunderna är inspelad tid: noll medan mikrofonprompten väntar.
      setSekunder(mikStart.current ? Math.max(0, Math.floor((Date.now() - mikStart.current) / 1000)) : 0);
    }, 250);
    return () => clearInterval(id);
  }, [spelarIn]);

  skickaRef.current = skicka;
  // Ett nytt tak medan en inspelning har ett tak satt: räkna om från starten (se `planeraTak`).
  useEffect(() => {
    if (tak.current) planeraTak();
    // `planeraTak` läser bara refar, så den behöver inte stå här. Ändringen av taket är det som ska köra den.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSekunder]);
  // ⛔ ETT KVITTO DÖLJS INTE AV SIG SJÄLVT (0.97.0). Det är där personen ser vad som gjordes, och Ångra får inte försvinna
  // medan hen läser. Bara Sparat utan kvitto, och Ångrat, står en kort stund.
  const kvittoStatus = kvitto ? kvitto.status : null;
  useEffect(() => {
    if (tillstand.lage !== "sparat") return undefined;
    if (kvittoStatus && kvittoStatus !== "angrat") return undefined;
    const id = setTimeout(() => skickaRef.current({ typ: "dolj" }), SPARAT_MS);
    return () => clearTimeout(id);
  }, [tillstand.lage, kvittoStatus]);

  /**
   * Ångra på kvittot. ⛔ ETT TRYCK I TAGET: ett andra tryck medan den pågår gör ingenting, annars hade appen ombetts ta bort
   * samma sak två gånger. Faller den står felet kvar och Ångra går att trycka igen.
   */
  const angra = () => {
    const k = kvittoRef.current;
    if (!k || !k.angra || k.status !== "visas" || lageRef.current.lage !== "sparat") return;
    angraForsok.current += 1;
    const mitt = angraForsok.current;
    const gor = k.angra;
    setKvitto({ text: k.text, angra: gor, status: "angrar" });
    Promise.resolve()
      .then(() => gor())
      .then(() => {
        if (mitt !== angraForsok.current || !monterad.current) return;
        setKvitto({ text: k.text, angra: gor, status: "angrat" });
          })
      .catch((fel) => {
        // ⛔ RAPPORTERAS ALLTID, ÄVEN NÄR KVITTOT ÄR BORTA (regel 5). Stängdes fältet, kom en ny inspelning eller avmonterades
        // kroken medan Ångra pågick, ser ingen felet i fältet. Då är rapporten det enda spåret av att något appen gjort inte
        // gick att ta tillbaka. Det som spärras är bara tillståndet: felet får inte ritas över ett annat kvitto.
        const inaktuellt = mitt !== angraForsok.current || !monterad.current;
        rapporteraFel(fel, { yta: "OpsTalk", steg: "angra", ...(inaktuellt ? { kvittotBorta: true } : {}) });
        if (inaktuellt) return;
        setKvitto({ text: k.text, angra: gor, status: "visas", fel: fel instanceof Error && fel.message ? fel.message : ORD_TALK.felAngra.sv });
      });
  };

  useEffect(() => {
    monterad.current = true;
    return () => {
      monterad.current = false;
      forsok.current += 1;
      rensa();
      rensaTak();
      if (lageRef.current.lage === "haller" || lageRef.current.lage === "lyssnar") {
        inspRef.current?.kasta();
      }
      // ⛔ (0.107.0) Igenkännaren stängs i varje läge, inte bara medan det spelas in: en som ännu inte sagt `end` efter Klar hade
      // annars levt kvar efter att fältet försvunnit. `kasta` är ofarlig på en som redan slutat.
      try {
        igkRef.current?.kasta();
      } catch (fel) {
        rapporteraFel(fel, { yta: "OpsTalk", steg: "kasta-text" });
      }
      frigor();
    };
  }, []);

  /**
   * Plusknappens händelser. ⛔ KLICKET STYRS HÄR OCH INTE AV `onClick`: ett långtryck följs av ett klick i varje
   * webbläsare, och det klicket får inte öppna Skapa ovanpå fältet.
   */
  const knapp = {
    onPointerDown: (/** @type {import("react").PointerEvent} */ e) => {
      if (e.button !== undefined && e.button !== 0) return;
      svalj.current = true;
      skicka({ typ: "ner" });
      rensa();
      timer.current = setTimeout(() => skicka({ typ: "langtryck" }), LANGTRYCK_MS);
    },
    onPointerUp: () => {
      rensa();
      skicka({ typ: "upp" });
    },
    onPointerCancel: () => {
      rensa();
      if (lageRef.current.lage === "trycker") skicka({ typ: "avbryt" });
      else skicka({ typ: "upp" });
    },
    onContextMenu: (/** @type {import("react").MouseEvent} */ e) => e.preventDefault(),
    onClick: (/** @type {import("react").MouseEvent} */ e) => {
      // Ett klick utan pekare före (tangentbordet) är ett vanligt klick.
      if (svalj.current) {
        svalj.current = false;
        e.preventDefault();
        return;
      }
      onKlick();
    },
  };

  // ⛔ Stabil: fältets animation startar om när `niva` byts.
  const niva = useCallback(() => {
    try {
      return inspRef.current ? inspRef.current.niva() : 0;
    } catch {
      return 0;
    }
  }, []);

  return {
    lage: tillstand.lage,
    fel: tillstand.fel,
    knapp,
    direkt: () => skicka({ typ: "direkt" }),
    skickaIn: () => skicka({ typ: "skicka" }),
    avbryt: () => skicka({ typ: "avbryt" }),
    igen: () => skicka({ typ: "igen" }),
    niva,
    sekunder,
    tak: maxSekunder,
    framsteg,
    kanIgen,
    text,
    /** (0.99.0) Texten uteblir: igenkänningen föll eller gick inte att starta. Tom när allt är som det ska. */
    textFel,
    /** (0.97.0) Om texten kan komma alls: igenkänningen är påslagen och finns i webbläsaren. Fältet ritar då textytan. */
    medText: igk() !== null,
    skickarText: skickarText ?? TALK_SKICKAR_TEXT,
    /** (0.97.0) Kvittot i läget sparat, eller `null`. */
    kvitto: kvitto ? { text: kvitto.text, kanAngra: Boolean(kvitto.angra), angrar: kvitto.status === "angrar", angrat: kvitto.status === "angrat", ...(kvitto.fel ? { fel: kvitto.fel } : {}) } : null,
    angra,
    /** (0.105.0) Agent i läget hört: lämnar det sagda till `onAgent`. */
    agent: () => skicka({ typ: "agent" }),
    /** (0.105.0) Om appen gav `onAgent`. Fältet ritar då Agent bland valen. */
    medAgent: typeof onAgent === "function",
  };
}

/** Hur många prickar fältet ritar. */
export const TALK_PRICKAR = 10;

/**
 * TALK:s nivåprickar. Samma tio prickar i fältet och i bibliotekets inspelning, så de två inte kan glida isär.
 *
 * @param {{ niva: () => number, lyssnar: boolean, skickar?: boolean }} props
 */
export function TalkPrickar({ niva, lyssnar, skickar = false }) {
  const [nivaer, setNivaer] = useState(() => Array.from({ length: TALK_PRICKAR }, () => 0));

  useEffect(() => {
    if (!lyssnar || typeof requestAnimationFrame !== "function") return undefined;
    let id = 0;
    let senast = 0;
    const steg = (/** @type {number} */ t) => {
      if (t - senast > 80) {
        senast = t;
        const n = niva();
        setNivaer((f) => [...f.slice(1), n]);
      }
      id = requestAnimationFrame(steg);
    };
    id = requestAnimationFrame(steg);
    return () => cancelAnimationFrame(id);
  }, [lyssnar, niva]);

  return (
    <span aria-hidden="true" data-talk-prickar="" className="flex min-w-0 w-full flex-1 items-center justify-between gap-1 overflow-hidden px-1">
      {nivaer.map((n, i) => (
        <span
          key={i}
          className="block w-1.5 shrink-0 rounded-full bg-accent transition-[height,opacity] duration-75"
          style={{ height: `${6 + Math.round(14 * n)}px`, opacity: skickar ? 0.35 : 0.35 + 0.65 * n }}
        />
      ))}
    </span>
  );
}

/*
 * ══ ⛔ FÄLTETS FORM (0.97.0, lifehub.app#219) ═════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-13, i Chrome på iPhone: "knapparna är asfula", "jättekonstigt", och "Kanske texten ska vara lite större som visar
 * vad man pratar in?". Före 0.97.0 stod målvalet som två fullbreddsknappar i guld och sand ovanför Klar, så att det valda
 * målet såg ut precis som Klar, och texten man pratade in var 12 px (`text-meta`), mindre än knapparna under den.
 *
 * Hierarkin nu, uppifrån:
 *   1. En lugn rad med prickarna och tiden, dämpad (`text-ink-muted`). Den säger att det spelar in, mer behövs inte.
 *   2. Texten man pratar in, i brödtextens storlek (`text-brod`, 16 px). Den är fältets huvudsak. Ytan har en fast minsta
 *      höjd på tre rader så att fältet inte hoppar när orden kommer, och den rullar inuti när texten blir lång.
 *   3. Målvalet, när det finns FLER ÄN ETT mål (0.99.0; ett ensamt mål är inget val): en segmenterad rad med lika breda delar och en
 *      liten etikett, aldrig staplade knappar.
 *   4. En knapprad: X (rund, sekundär) till vänster och den primära knappen som fyller resten. Samma höjd, samma rundning.
 *
 * ⛔ SEKUNDÄR ÄR `bg-hover`, INTE `bg-sunken`. I ljust läge är `sunken` (#FBF9F4) nästan samma färg som fältets `raised`
 * (#fefcf6), och krysset syntes då bara som en ikon som flöt i luften.
 */

/** Primär knapp i fältets knapprad: fyller resten av raden. */
const PRIMAR = "inline-flex min-h-12 min-w-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 text-etikett font-medium text-accent-contrast hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60 aria-disabled:cursor-default aria-disabled:opacity-60";
/** Sekundär knapp med ord, samma höjd och rundning som den primära. */
const SEKUNDAR_ORD = "inline-flex min-h-12 min-w-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-hover px-5 text-etikett font-medium text-ink hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60 aria-disabled:cursor-default aria-disabled:opacity-60";
/** Det runda krysset till vänster i knappraden. */
const SEKUNDAR = "inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-hover text-ink hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
/** Kugghjulet i den övre raden: lika lugnt som tiden bredvid. */
const KUGG = "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
/** Statusregionen per läge. Tom är den visuellt dold men finns kvar, så att skärmläsaren hör när den får text. */
const STATUSKLASS = {
  tom: "sr-only",
  skickar: "m-0 flex min-h-12 items-center gap-2 text-etikett text-ink-secondary",
  sparat: "m-0 flex min-h-12 items-center gap-2 text-etikett font-medium text-ink",
  kvitto: "m-0 flex items-start gap-3 text-brod text-ink [overflow-wrap:anywhere]",
};
/** Textytan: brödtext, tre rader minst, rullar inuti. */
const TEXTYTA = "m-0 min-h-18 max-h-36 overflow-y-auto text-brod [overflow-wrap:anywhere]";
/**
 * ⛔ VALEN EFTER TALET (0.105.0). CP 2026-10-14, med en skärmbild av TALK-panelen: "talk gör att man pratar in så att man ser texten
 * direkt i realtid. Sen så finns de tre knapparna där direkt. Meddelande, ärende, kalender. Och sen så adderar vi en agentknapp." Fyra
 * knappar med ord, i ett rutnät med två kolumner: på en telefon (390 px) ryms inte fyra ord i en rad i 44 px knappar, och ikoner utan
 * ord var det 0.103.0 hade och som CP inte hittade.
 */
const VAL = "inline-flex min-h-12 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-hover px-3 text-etikett font-medium text-ink hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-default aria-disabled:opacity-60";

/** Valen i den ordning de står (0.105.0). Agent sist: den som tar samtalet vidare till chatten. */
const VALEN = /** @type {const} */ ([
  { nyckel: "meddelande", ord: "valMeddelande" },
  { nyckel: "handelse", ord: "valHandelse" },
  { nyckel: "arende", ord: "valArende" },
  { nyckel: "agent", ord: "valAgent" },
]);

/*
 * Namnet Klar läses upp med i TALK (0.103.0) är `ORD_TALK.klarNamn` (0.104.0). ⛔ INTE ETT FÖRVAL I PARAMETERLISTAN: `check-sprak`
 * räknar svenska förval i parametrarna. Sedan 0.104.0 följer namnet språket, liksom ordet på knappen: ett uppläst namn som inte
 * innehåller det synliga ordet går inte att säga åt en röststyrning, och det gäller på båda språken.
 */

const INSPELNING_PROPS = ["lage", "fel", "niva", "sekunder", "tak", "framsteg", "kanIgen", "text", "textFel", "medText", "skickarText", "kvitto", "onAngra", "onKlar", "onAvbryt", "onIgen", "onStart", "onTillatMikrofon", "onInstallningar", "marke", "mal", "valt", "onValj", "vidare", "onAgent", "klarEtikett"];

/**
 * Mottagarna av det sagda (0.103.0, 0.105.0). Var och en får underlaget när personen trycker på sitt val. En nyckel som saknas ritar
 * inget val: en knapp utan mottagare hade inte gjort något.
 * @typedef {{ meddelande?: (u: import("../lib/talk.js").Talkunderlag) => void, handelse?: (u: import("../lib/talk.js").Talkunderlag) => void, arende?: (u: import("../lib/talk.js").Talkunderlag) => void }} TalkVidare
 */

/**
 * @typedef {object} TalkKvittoVy Kvittot som fältet ritar (0.97.0). Kommer ur `useTalk().kvitto`.
 * @property {string} text
 * @property {boolean} kanAngra
 * @property {boolean} angrar Ångra pågår: knappen snurrar, bär `aria-disabled` och behåller fokus, och ett tryck gör ingenting.
 * @property {boolean} angrat Ångra lyckades: fältet säger Ångrat och döljs.
 * @property {string} [fel] Ångra föll. Står kvar med `role="alert"`.
 */

/**
 * Den enda inspelaren. TALK-fältet och Biblioteket bäddar in den, och plusset använder samma.
 *
 * ⛔ KLAR ÄR DEN PRIMÄRA KNAPPEN (CP 2026-10-09). Fältet hade en mikrofon som skickade och ett rött kryss som
 * kastade, och krysset var det enda som såg ut som en avslutning. Medan det spelas in är Klar (stopp-ruta och
 * ordet) det man trycker. Avbryt är ett sekundärt kryss, utan röd fyllning. En lång inspelning frågar innan den kastas.
 *
 * ⛔ SPARNINGEN SÄGS. Utan ord såg ett stopp ut som att inget hände. `framsteg` är 0 till 1 när appen rapporterar
 * den, annars en snurra. Sparat står kvar en kort stund. Ett fel får Försök igen när ljudet finns kvar.
 *
 * ⛔ MÅLEN ÄR EN LISTA, INTE ETT NAMN PÅ EN MODUL. `mal` är `{ id, etikett }`. Vem som äger ett mål vet anroparen.
 * Biblioteket syns här bara om någon skickat in etiketten.
 *
 * ⛔ KVITTOT (0.97.0). Med `kvitto` säger fältet vad appen gjorde, med Ångra och Stäng, tills personen stänger det. Formen står i
 * filhuvudet ovanför `PRIMAR`. Stäng är den primära knappen och får fokus.
 *
 * ⛔ VALEN EFTER TALET (0.105.0). I läget `hort` står det sagda kvar i textytan, och under det valen Meddelande, Händelse, Ärende och
 * Agent med ord. Ett val ritas bara när dess mottagare finns. Fokus går till det första valet, så att tangentbordet inte hamnar i
 * sidans topp när Klar försvinner. Inget val lämnar något av sig självt: det är personens tryck som gör det.
 *
 * @param {object} props
 * @param {import("../lib/talk.js").Talklage} props.lage
 * @param {string} [props.fel]
 * @param {() => number} props.niva
 * @param {number} props.sekunder
 * @param {number} props.tak
 * @param {number | null} props.framsteg
 * @param {boolean} props.kanIgen
 * @param {string} [props.text] (0.96.0) Det som hörts. Visas medan man pratar, medan det sparas och i läget `hort`.
 * @param {boolean} [props.medText] (0.97.0) Text kan komma (`useTalk().medText`). Då ritas textytan med sin fasta höjd, och
 *   platstexten `TALK_PLATSTEXT` står i den tills något hörts. Utan den ritas ytan bara när det finns text.
 * @param {string} [props.textFel] (0.99.0) Texten uteblir (`useTalk().textFel`). Fältet säger det i stället för att stå med sin platstext.
 * @param {string} [props.skickarText] (0.97.0) Statusraden medan det sparas. Förval `TALK_SKICKAR_TEXT`.
 * @param {TalkKvittoVy | null} [props.kvitto] (0.97.0) Kvittot i läget sparat.
 * @param {() => void} [props.onAngra] (0.97.0) Ångra på kvittot.
 * @param {() => void} props.onKlar
 * @param {() => void} props.onAvbryt
 * @param {() => void} props.onIgen
 * @param {() => void} [props.onStart] Ritad när läget är vila. Biblioteket startar så. Plusset startar utifrån.
 * @param {() => void} [props.onTillatMikrofon] (0.92.0) När mikrofonen nekats: knappen "Tillåt mikrofon" ber igen med en gest. Utan den används `onStart` om den finns.
 * @param {() => void} [props.onInstallningar]
 * @param {import("react").ReactNode} [props.marke]
 * @param {ReadonlyArray<{ id: string, etikett: string }>} [props.mal] (0.99.0)
 *   ⛔ Ett val ritas bara när det finns FLER ÄN ETT mål. Ett ensamt
 *   mål är inget val, och en rad som inte går att ändra är bara brus (CP 2026-10-13: "bara text för att få en bra användarupplevelse").
 * @param {string | null} [props.valt]
 * @param {(id: string) => void} [props.onValj]
 * @param {TalkVidare} [props.vidare] (0.103.0, 0.105.0) Mottagarna av valen Meddelande, Händelse och Ärende i läget `hort`. Ett tryck lämnar
 *   underlaget (`talkUnderlag`) till mottagaren och stänger fältet. Kastar mottagaren står felet i fältet och det sagda finns kvar.
 * @param {() => void} [props.onAgent] (0.105.0) Agent i läget `hort` (`useTalk().agent`). Utan den ritas ingen Agent.
 * @param {string} [props.klarEtikett] (0.103.0) Namnet Klar läses upp med. Förval `ORD_TALK.klarNamn` på språket som gäller (0.104.0). Chattens skrivfält
 *   skickar det sagda som ett meddelande, och där hade "spara inspelningen" sagt något annat än det som händer. Ordet på skärmen är
 *   Klar i båda. En tom sträng eller något annat än en sträng kastar.
 */
export function OpsInspelning(props) {
  const okanda = Object.keys(props).filter((k) => !INSPELNING_PROPS.includes(k));
  if (okanda.length > 0) {
    throw new Error(`OpsInspelning: okända props ${okanda.join(", ")}. Tillåtna: ${INSPELNING_PROPS.join(", ")}.`);
  }
  const { lage, fel, niva, sekunder, tak, framsteg, kanIgen, text = "", textFel = "", medText = false, skickarText = TALK_SKICKAR_TEXT, kvitto = null, onAngra, onKlar, onAvbryt, onIgen, onStart, onTillatMikrofon, onInstallningar, marke, mal = [], valt = null, onValj, vidare, onAgent, klarEtikett: klarEtikettProp } = props;
  if (vidare !== undefined) {
    const nycklar = ["meddelande", "handelse", "arende"];
    const felaktiga = vidare && typeof vidare === "object" ? Object.entries(vidare).filter(([k, v]) => !nycklar.includes(k) || typeof v !== "function").map(([k]) => k) : [typeof vidare];
    if (felaktiga.length > 0) {
      throw new Error(`OpsInspelning: vidare ska vara { meddelande?, handelse?, arende? } med funktioner, fel i: ${felaktiga.join(", ")}. Ett val vars mottagare inte går att anropa hade inte gjort något.`);
    }
  }
  if (onAgent !== undefined && typeof onAgent !== "function") {
    throw new Error(`OpsInspelning: onAgent ska vara en funktion, fick ${onAgent === null ? "null" : typeof onAgent}. Agent utan mottagare hade inte gjort något.`);
  }
  if (klarEtikettProp !== undefined && (typeof klarEtikettProp !== "string" || !klarEtikettProp.trim())) {
    throw new Error(`OpsInspelning: klarEtikett ska vara en sträng som inte är tom, fick ${typeof klarEtikettProp === "string" ? JSON.stringify(klarEtikettProp) : typeof klarEtikettProp}. En knapp utan namn går inte att hitta för den som lyssnar.`);
  }
  const [fragar, setFragar] = useState(false);
  /** Felet när en mottagare kastade (0.103.0). Det sagda står kvar, så att det går att trycka igen eller stänga. */
  const [vidareFel, setVidareFel] = useState("");
  const fortsatt = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const stang = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const forstaVal = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const sprak = useOpsSprak();
  /** Ytans egna ord på språket som gäller (0.104.0, `ORD_TALK`). @param {keyof typeof ORD_TALK} k */
  const o = (k) => talkOrd(k, sprak);
  const klarEtikett = klarEtikettProp ?? o("klarNamn");
  const malEtikett = useId();
  const valFraga = useId();
  const lyssnar = lage === "haller" || lage === "lyssnar";
  const hort = lage === "hort";
  /** Kvittot står med sina knappar: Ångra och Stäng. */
  const kvittoKnappar = lage === "sparat" && Boolean(kvitto) && !kvitto?.angrat;

  useEffect(() => {
    if (!lyssnar) setFragar(false);
  }, [lyssnar]);

  useEffect(() => {
    if (fragar) fortsatt.current?.focus();
  }, [fragar]);

  /**
   * ⛔ FOKUS TILL STÄNG NÄR KVITTOT KOMMER, INTE TILL ÅNGRA. Klar, som var fokuserad, försvinner när läget byts, och utan ett nytt mål
   * hamnar tangentbordet i sidans topp. Ångra hade varit fel mål: ett Enter av vana hade tagit bort det appen nyss gjort. Bara på
   * övergången, så att en Ångra som faller inte flyttar fokus från knappen personen just tryckte på.
   */
  useEffect(() => {
    if (kvittoKnappar) stang.current?.focus();
  }, [kvittoKnappar]);

  /** (0.105.0) Fokus till första valet när det sagda står, och ett gammalt fel från en mottagare hör till förra omgången. */
  useEffect(() => {
    setVidareFel("");
    if (hort) forstaVal.current?.focus();
  }, [hort]);

  const underlag = hort ? talkUnderlag(text) : null;
  /** Felet vid valen: ett val vars mottagare kastade, annars en Agent som inte nådde fram. */
  const valFel = hort ? vidareFel || fel || "" : "";
  /** Valen som ritas: bara de med en mottagare, och bara när något hördes. */
  const val = underlag ? VALEN.filter((x) => (x.nyckel === "agent" ? typeof onAgent === "function" : typeof vidare?.[x.nyckel] === "function")) : [];
  /**
   * Ett tryck på Meddelande, Händelse eller Ärende. ⛔ MOTTAGAREN FÖRST, STÄNGNINGEN SEDAN: kastar mottagaren (ett formulär som inte
   * finns, ett fel i appen) står felet i fältet och det sagda finns kvar. Stängt först hade det sagda försvunnit med felet. Ett löfte som
   * avvisas rapporteras, eftersom fältet då redan är stängt.
   * @param {"meddelande" | "handelse" | "arende"} nyckel
   */
  const lamnaVidare = (nyckel) => {
    const mottagare = vidare?.[nyckel];
    if (!underlag || typeof mottagare !== "function") return;
    try {
      const svar = /** @type {unknown} */ (mottagare(underlag));
      if (svar && typeof (/** @type {any} */ (svar).then) === "function") {
        /** @type {Promise<unknown>} */ (svar).catch((fel) => rapporteraFel(fel, { yta: "OpsTalk", steg: `vidare-${nyckel}` }));
      }
    } catch (fel) {
      rapporteraFel(fel, { yta: "OpsTalk", steg: `vidare-${nyckel}` });
      setVidareFel(fel instanceof Error && fel.message ? fel.message : ORD_TALK.felVidare.sv);
      return;
    }
    onAvbryt();
  };

  const avbryt = () => {
    if (lyssnar && sekunder >= AVBRYT_FRAGA_SEKUNDER && !fragar) {
      setFragar(true);
      return;
    }
    setFragar(false);
    onAvbryt();
  };

  if (lage === "vila" || lage === "trycker") {
    if (typeof onStart !== "function") return null;
    return (
      <div data-ops-inspelning="" data-lage={lage} className="flex w-full min-w-0">
        <button type="button" aria-label={o("spelaIn")} data-inspelning="start" onClick={onStart} className={PRIMAR}>
          <MikrofonIkon size={18} />
          {o("spelaIn")}
        </button>
      </div>
    );
  }

  if (fragar && lyssnar) {
    return (
      <div data-ops-inspelning="" data-inspelning="fraga" className="flex w-full min-w-0 flex-col gap-4">
        <p className="m-0 text-brod text-ink">{o("kastaFraga")}</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setFragar(false); onAvbryt(); }} className={`${SEKUNDAR_ORD} text-danger`}>{o("kasta")}</button>
          <button ref={fortsatt} type="button" onClick={() => setFragar(false)} className={PRIMAR}>{o("fortsatt")}</button>
        </div>
      </div>
    );
  }

  const procent = framsteg == null ? null : Math.round(framsteg * 100);
  /** Statusraden medan det sparas. TALK:s eget "Sparar…" på språket som gäller, appens text som den är. */
  const skickarVisas = talkTextPa(skickarText, sprak);
  /** Vad statusregionen säger. `null`: tom och dold. */
  const statusLage = lage === "skickar" ? "skickar" : lage === "sparat" ? (kvitto ? "kvitto" : "sparat") : null;
  const valtId = valt ?? (mal[0] ? mal[0].id : null);
  const visaTextyta = (lyssnar && (medText || Boolean(text))) || ((lage === "skickar" || hort) && Boolean(text));
  /**
   * Ett val finns bara när det finns något att välja mellan. ⛔ (0.105.0, granskningen av PR 387) Och inte när valen kommer efter talet
   * (`onAgent` med texten på): då bestämmer personen vart det sagda ska efteråt, och "Skickas till" medan man pratar hade frågat om
   * ett mål som inte används. Hördes inget går ljudet till `onTalk` med appens första mål, som förut när valet inte rörts.
   */
  const visaMal = lyssnar && mal.length > 1 && !(onAgent && medText);
  const kanTillatMikrofon = !kanIgen && kanBeOmMikrofon(fel) && typeof (onTillatMikrofon || onStart) === "function";
  /** (lifehub.app#253) Det som fanns att skicka var tomt: en ny inspelning, inte Försök igen, som hade skickat samma tomma ljud. */
  const kanNyInspelning = !kanIgen && !kanTillatMikrofon && kanSpelaInIgen(fel) && typeof (onTillatMikrofon || onStart) === "function";

  return (
    <div data-ops-inspelning="" data-inspelning={lage} className="flex w-full min-w-0 flex-col gap-3">
      {/* ⛔ RADEN STÅR KVAR MEDAN DET SKICKAS, med stilla och dämpade prickar. Utan den flyttade texten upp en rad i samma
          ögonblick som man tryckte Klar, och det såg ut som att något annat än texten hade hänt. */}
      {lyssnar || lage === "skickar" ? (
        <div className="flex min-h-11 min-w-0 items-center gap-2">
          {marke ? <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center">{marke}</span> : null}
          <TalkPrickar niva={niva} lyssnar={lyssnar} skickar={!lyssnar} />
          <span data-inspelning-tid="" className="shrink-0 text-meta text-ink-muted tabular-nums">{formateraTid(sekunder)} / {formateraTid(tak)}</span>
          {onInstallningar && lyssnar ? (
            <button type="button" aria-label={o("installningar")} onClick={onInstallningar} className={`${KUGG} -my-1 -mr-1`}>
              <KugghjulIkon size={18} />
            </button>
          ) : null}
          {/* Kugghjulets plats står kvar medan det skickas, så att tiden inte flyttar sig. */}
          {onInstallningar && !lyssnar ? <span aria-hidden="true" className="-my-1 -mr-1 size-11 shrink-0" /> : null}
        </div>
      ) : null}
      {visaTextyta ? (
        text ? (
          <p data-talk-text="" aria-live="polite" className={`${TEXTYTA} text-ink`}>
            {text}
          </p>
        ) : textFel ? null : (
          <p data-talk-platstext="" className={`${TEXTYTA} text-ink-muted`}>
            {o("platstext")}
          </p>
        )
      ) : null}
      {/* ⛔ TEXTEN UTEBLIR OCH FÄLTET SÄGER DET (0.99.0, regel 5). Förut svaldes ett fall i igenkänningen, och platstexten stod
          kvar som ett löfte som aldrig infriades. `role="alert"` eftersom raden föds med sin text, och en region som föds med
          innehåll läses inte alltid upp. */}
      {lyssnar && textFel ? <p role="alert" data-talk-textfel="" className="m-0 text-etikett text-ink-secondary">{talkTextPa(textFel, sprak)}</p> : null}
      {/* ⛔ STATUSREGIONEN STÅR KVAR OCH BYTER TEXT (0.97.0). Förut skapades en ny `role="status"` i samma ögonblick som den
          fick sin text, och skärmläsare läser ofta inte upp en region som föds med innehåll: kvittot, "Ångrat" och
          "Agenten arbetar…" kunde passera tyst. Nu finns den från första läget i fältet, dold och tom medan man pratar, i samma
          plats i trädet, så att det är SAMMA element som får texten. (0.105.0: samtalsytan som var dess förälder i 0.103.0 är borta,
          och regionen står direkt i fältet i varje läge.) */}
      <p role="status" aria-live="polite" data-talk-status={statusLage || undefined} data-talk-kvitto={statusLage === "kvitto" ? "" : undefined} className={STATUSKLASS[statusLage || "tom"]}>
        {statusLage === "skickar" ? (
          <>
            {procent == null ? <OpsSpinner size="sm" decorative /> : null}
            {procent == null ? skickarVisas : `${skickarVisas} ${procent} %`}
          </>
        ) : null}
        {statusLage === "sparat" ? (
          <>
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent"><BockIkon size={14} /></span>
            {o("sparat")}
          </>
        ) : null}
        {statusLage === "kvitto" && kvitto ? (
          <>
            <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent"><BockIkon size={14} /></span>
            <span className="min-w-0">{kvitto.angrat ? o("angrat") : kvitto.text}</span>
          </>
        ) : null}
      </p>
      {lage === "skickar" && procent != null ? (
        // `-mt-1`: raden och stapeln hörde ihop med 8 px emellan, och fältets mellanrum är 12.
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={procent} aria-label={skickarVisas} className="-mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent" style={{ width: `${procent}%` }} />
        </div>
      ) : null}
      {/* ⛔ EN FELRAD SOM FINNS FRÅN BÖRJAN OCH BYTER TEXT (granskningen av PR 387), samma skäl som statusregionen: en region som föds
          med sin text läses inte alltid upp. Den bär både ett val vars mottagare kastade och en Agent som inte nådde fram (`fel`, och då
          är Agent Försök igen). Den står i `skickar` och `hort`, alltså redan medan Agent arbetar, så att det är SAMMA element som får
          felet. Medan man pratar finns den inte: där har igenkänningen sin egen felrad (`textFel`). Tom och dold tills något gick fel.
          ⛔ BARA MED `onAgent`, alltså där valen finns: `hort` nås bara med den. Chattens mikrofon (`OpsRostinmatning`) ritar samma
          `OpsInspelning` utan val, och där var en tom felrad i `skickar` den första `alert` man hittade, före chattens egen. */}
      {(hort || lage === "skickar") && typeof onAgent === "function" ? (
        <p role="alert" data-talk-valfel={valFel ? "" : undefined} className={valFel ? "m-0 text-etikett text-danger" : "sr-only"}>
          {valFel ? talkTextPa(valFel, sprak) : null}
        </p>
      ) : null}
      {hort ? (
        <div role="group" aria-labelledby={valFraga} data-talk-val="" className="flex min-w-0 flex-col gap-2">
          <p id={valFraga} className="m-0 text-meta text-ink-muted">{o("valFragan")}</p>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            {val.map((x, i) => {
              const Ikon = x.nyckel === "meddelande" ? MeddelandeIkon : x.nyckel === "handelse" ? HandelsePlusIkon : x.nyckel === "arende" ? ArendePlusIkon : AgentIkon;
              return (
                <button
                  key={x.nyckel}
                  ref={i === 0 ? forstaVal : undefined}
                  type="button"
                  data-talk-valt={x.nyckel}
                  onClick={() => (x.nyckel === "agent" ? onAgent?.() : lamnaVidare(x.nyckel))}
                  className={VAL}
                >
                  <Ikon size={18} />
                  <span className="min-w-0 truncate">{o(x.ord)}</span>
                </button>
              );
            })}
          </div>
          <button type="button" data-talk-stang="" onClick={onAvbryt} className={SEKUNDAR_ORD}>{o("stang")}</button>
        </div>
      ) : null}
      {lage === "sparat" && kvitto ? (
        <>
          {kvitto.fel ? <p role="alert" data-talk-fel="" className="m-0 text-etikett text-danger">{talkTextPa(kvitto.fel, sprak)}</p> : null}
          {!kvitto.angrat ? (
            <div className="flex items-center gap-3">
              {kvitto.kanAngra ? (
                // ⛔ aria-disabled OCH INTE disabled medan Ångra pågår. En knapp som blir `disabled` tappar fokus, och tangentbordet
                // hamnar i sidans topp mitt i en åtgärd. Klicket spärras här, och kroken spärrar ett andra försök en gång till.
                <button
                  type="button"
                  data-talk-angra=""
                  aria-disabled={kvitto.angrar || undefined}
                  aria-busy={kvitto.angrar || undefined}
                  onClick={() => {
                    if (kvitto.angrar) return;
                    onAngra?.();
                  }}
                  className={SEKUNDAR_ORD}
                >
                  {kvitto.angrar ? <OpsSpinner size="sm" decorative /> : null}
                  {kvitto.angrar ? o("angrar") : o("angra")}
                </button>
              ) : null}
              <button ref={stang} type="button" data-talk-stang="" onClick={onAvbryt} className={PRIMAR}>{o("stang")}</button>
            </div>
          ) : null}
        </>
      ) : null}
      {lage === "fel" ? (
        <div className="flex min-w-0 flex-col gap-3">
          <p role="alert" data-talk-fel="" className="m-0 text-etikett text-danger">{fel ? talkTextPa(fel, sprak) : o("felOkant")}</p>
          <div className="flex items-center gap-3">
            {kanIgen || kanTillatMikrofon || kanNyInspelning ? (
              <button type="button" aria-label={o("avbryt")} data-talk-avbryt="" onClick={onAvbryt} className={SEKUNDAR}>
                <KryssIkon size={18} />
              </button>
            ) : null}
            {kanIgen ? (
              <button type="button" onClick={onIgen} className={PRIMAR}>{o("forsokIgen")}</button>
            ) : null}
            {kanTillatMikrofon ? (
              <button type="button" data-talk-mikrofon="" onClick={onTillatMikrofon || onStart} className={PRIMAR}>
                <MikrofonIkon size={18} />
                {o("tillatMikrofon")}
              </button>
            ) : null}
            {kanNyInspelning ? (
              <button type="button" data-talk-spela-in-igen="" onClick={onTillatMikrofon || onStart} className={PRIMAR}>
                <MikrofonIkon size={18} />
                {o("spelaInIgen")}
              </button>
            ) : null}
            {!kanIgen && !kanTillatMikrofon && !kanNyInspelning ? (
              <button type="button" onClick={onAvbryt} className={PRIMAR}>{o("stang")}</button>
            ) : null}
          </div>
        </div>
      ) : null}
      {visaMal ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <span id={malEtikett} className="text-meta text-ink-muted">{o("skickasTill")}</span>
          {/* ⛔ SPÅRET ÄR NEDSÄNKT OCH DET VALDA LYFT, i båda lägena. `bg-raised` som valt blev MÖRKARE än spåret i mörkt läge
              (#262d26 mot #323a32), alltså omvänt. `sunken` med en hårlinje och `hover` som valt går åt rätt håll i båda. */}
          <div role="radiogroup" aria-labelledby={malEtikett} className="flex min-w-0 gap-1 rounded-full bg-sunken p-1 ring-1 ring-line ring-inset">
            {mal.map((m) => {
              const vald = m.id === valtId;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={vald}
                  data-inspelning-mal={m.id}
                  onClick={() => onValj?.(m.id)}
                  className={`inline-flex min-h-11 min-w-0 flex-1 basis-0 cursor-pointer items-center justify-center rounded-full px-2 text-center text-etikett leading-tight [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${vald ? "bg-hover font-medium text-ink" : "text-ink-muted hover:text-ink"}`}
                >
                  {m.etikett}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {lyssnar ? (
        <div className="flex items-center gap-3">
          <button type="button" aria-label={o("avbryt")} data-talk-avbryt="" onClick={avbryt} className={SEKUNDAR}>
            <KryssIkon size={18} />
          </button>
          <button type="button" aria-label={klarEtikett} data-talk-skicka="" onClick={onKlar} className={PRIMAR}>
            <StoppIkon size={14} />
            {o("klar")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Fältet som ligger över appen medan man pratar.
 *
 * ⛔ KLAR STANNAR SYNLIG. Den nedfällda pillen gömde den enda knappen som sparar, och då var krysset kvar som
 * avslutning. Fältet fälls inte längre ned.
 *
 * @param {{
 *   lage: import("../lib/talk.js").Talklage,
 *   fel?: string,
 *   niva: () => number,
 *   sekunder?: number,
 *   tak?: number,
 *   framsteg?: number | null,
 *   kanIgen?: boolean,
 *   text?: string,
 *   textFel?: string,
 *   medText?: boolean,
 *   skickarText?: string,
 *   kvitto?: TalkKvittoVy | null,
 *   onAngra?: () => void,
 *   onSkicka: () => void,
 *   onAvbryt: () => void,
 *   onIgen?: () => void,
 *   onTillatMikrofon?: () => void,
 *   onInstallningar?: () => void,
 *   marke?: import("react").ReactNode,
 *   mal?: ReadonlyArray<{ id: string, etikett: string }>,
 *   valt?: string | null,
 *   onValj?: (id: string) => void,
 *   vidare?: TalkVidare,
 *   onAgent?: () => void,
 * }} props `medText`, `skickarText`, `kvitto` och `onAngra` (0.97.0) kommer ur `useTalk` med samma namn (`onAngra` är `angra`).
 *   `vidare` och `onAgent` (0.105.0: `useTalk().agent`) går som de är till `OpsInspelning`.
 */
export function OpsTalk({ lage, fel, niva, sekunder = 0, tak = MAX_SEKUNDER, framsteg = null, kanIgen = false, text = "", textFel = "", medText = false, skickarText = TALK_SKICKAR_TEXT, kvitto = null, onAngra, onSkicka, onAvbryt, onIgen = () => {}, onTillatMikrofon, onInstallningar, marke, mal = [], valt = null, onValj, vidare, onAgent }) {
  if (lage === "vila" || lage === "trycker") return null;
  return (
    <div
      role="dialog"
      aria-label="TALK"
      data-ops-talk=""
      data-lage={lage}
      // ⛔ SAMMA KANT SOM ARKEN, PLUS LUFT (granskningen av PR 366, BÖR 3). Här stod `env(...)+5.5rem`, en gissning av bottenradens
      // höjd som varken följde tokenen eller räknade med skalets spelrad, så fältet låg delvis över dem.
      className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom)+var(--spelrad-h,0px)+0.75rem)] z-(--z-dropdown) mx-auto max-w-md md:bottom-[calc(1.5rem+var(--spelrad-h,0px))]"
    >
      <div className="rounded-3xl border border-line-strong bg-raised p-4 shadow-lg">
        <OpsInspelning
          lage={lage}
          fel={fel}
          niva={niva}
          sekunder={sekunder}
          tak={tak}
          framsteg={framsteg}
          kanIgen={kanIgen}
          text={text}
          textFel={textFel}
          medText={medText}
          skickarText={skickarText}
          kvitto={kvitto}
          onAngra={onAngra}
          onKlar={onSkicka}
          onAvbryt={onAvbryt}
          onIgen={onIgen}
          onTillatMikrofon={onTillatMikrofon}
          onInstallningar={onInstallningar}
          marke={marke}
          mal={mal}
          valt={valt}
          onValj={onValj}
          vidare={vidare}
          onAgent={onAgent}
        />
      </div>
    </div>
  );
}
