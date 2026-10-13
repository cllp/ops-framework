import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AVBRYT_FRAGA_SEKUNDER, LANGTRYCK_MS, MAX_SEKUNDER, SPARAT_MS, TALK_PLATSTEXT, TALK_SKICKAR_TEXT, igenkanningensSprak, kanBeOmMikrofon, kontrolleraSkickarText, talkFeltext, talkKvitto, talkNasta, webblasarensIgenkanning, webblasarensInspelare } from "../lib/talk.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { formateraTid } from "../lib/ljudspelare.js";
import { rapporteraFel } from "../lib/felrapport.js";
import { BockIkon, KryssIkon, KugghjulIkon, MikrofonIkon, StoppIkon } from "./icons.jsx";
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
 * @property {number} [maxSekunder] Tak i sekunder. Förval `MAX_SEKUNDER` (120), så TALK inte ändras. Bibliotekets idé använder 600.
 * @property {ReadonlyArray<{ id: string, etikett: string }>} [mal] Appens egna mål i fältet. Modulernas mål läggs till av skalet.
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
export const TALK_UPPTAGEN = "En annan inspelning pågår redan. Avsluta den först.";

/**
 * @param {TalkVal & { onKlick: () => void }} val `onKlick` är det ett vanligt tryck gör, Skapa.
 */
export function useTalk({ onTalk, onKlick, inspelare, igenkanning, skickarText, maxSekunder = MAX_SEKUNDER }) {
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
  const monterad = useRef(true);
  const [sekunder, setSekunder] = useState(0);
  const [framsteg, setFramsteg] = useState(/** @type {number | null} */ (null));
  const [kanIgen, setKanIgen] = useState(false);
  const startTid = useRef(0);
  /** När mikrofonen faktiskt blev öppen, 0 medan den inte är det. Taket och sekundräknaren räknas härifrån. */
  const mikStart = useRef(0);
  /** Ljudet som redan stoppats, så Försök igen inte spelar in på nytt. */
  const senast = useRef(/** @type {{ blob: Blob, mimeType: string, sekunder: number } | null} */ (null));
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
        if (mikrofonenUpptagenAv && mikrofonenUpptagenAv !== inspRef) {
          skicka({ typ: "fel", text: TALK_UPPTAGEN });
          return;
        }
        mikrofonenUpptagenAv = inspRef;
        forsok.current += 1;
        const mitt = forsok.current;
        rensaTak();
        insp()
          .starta()
          .then(() => {
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
            skicka({ typ: "fel", text: fel instanceof Error && fel.message ? fel.message : "Det inspelade kunde inte sparas." });
          });
      };
      if (nasta.gor === "skicka" || nasta.gor === "igen") {
        forsok.current += 1;
        const mitt = forsok.current;
        rensaTak();
        setFramsteg(null);
        if (nasta.gor === "igen") {
          const post = senast.current;
          if (!post) {
            skicka({ typ: "fel", text: "Inget ljud finns kvar att spara." });
            return;
          }
          lamna(post);
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
            const post = { ...ljud, ...(hord ? { text: hord } : {}) };
            setText(hord);
            senast.current = post;
            setKanIgen(true);
            return lamna(post);
          })
          .catch((fel) => {
            if (mitt !== forsok.current || !monterad.current) return;
            rapporteraFel(fel, { yta: "OpsTalk", steg: "stoppa" });
            skicka({ typ: "fel", text: fel instanceof Error && fel.message ? fel.message : "Inspelningen gick inte att avsluta." });
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
        setKvitto({ text: k.text, angra: gor, status: "visas", fel: fel instanceof Error && fel.message ? fel.message : "Det gick inte att ångra." });
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
        igkRef.current?.kasta();
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
    /** (0.97.0) Om texten kan komma alls: igenkänningen är påslagen och finns i webbläsaren. Fältet ritar då textytan. */
    medText: igk() !== null,
    skickarText: skickarText ?? TALK_SKICKAR_TEXT,
    /** (0.97.0) Kvittot i läget sparat, eller `null`. */
    kvitto: kvitto ? { text: kvitto.text, kanAngra: Boolean(kvitto.angra), angrar: kvitto.status === "angrar", angrat: kvitto.status === "angrat", ...(kvitto.fel ? { fel: kvitto.fel } : {}) } : null,
    angra,
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
 *   3. Målvalet, när appen gett flera mål: en segmenterad rad med lika breda delar och en liten etikett, aldrig staplade knappar.
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

const INSPELNING_PROPS = ["lage", "fel", "niva", "sekunder", "tak", "framsteg", "kanIgen", "text", "medText", "skickarText", "kvitto", "onAngra", "onKlar", "onAvbryt", "onIgen", "onStart", "onTillatMikrofon", "onInstallningar", "marke", "mal", "valt", "onValj"];

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
 * ⛔ KVITTOT (0.97.0). Med `kvitto` säger fältet vad appen gjorde, med Ångra (sekundär) och Stäng (primär), tills
 * personen stänger det. Formen står i filhuvudet ovanför `PRIMAR`.
 *
 * @param {object} props
 * @param {import("../lib/talk.js").Talklage} props.lage
 * @param {string} [props.fel]
 * @param {() => number} props.niva
 * @param {number} props.sekunder
 * @param {number} props.tak
 * @param {number | null} props.framsteg
 * @param {boolean} props.kanIgen
 * @param {string} [props.text] (0.96.0) Det som hörts. Visas medan man pratar och medan det sparas.
 * @param {boolean} [props.medText] (0.97.0) Text kan komma (`useTalk().medText`). Då ritas textytan med sin fasta höjd, och
 *   platstexten `TALK_PLATSTEXT` står i den tills något hörts. Utan den ritas ytan bara när det finns text.
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
 * @param {ReadonlyArray<{ id: string, etikett: string }>} [props.mal]
 * @param {string | null} [props.valt]
 * @param {(id: string) => void} [props.onValj]
 */
export function OpsInspelning(props) {
  const okanda = Object.keys(props).filter((k) => !INSPELNING_PROPS.includes(k));
  if (okanda.length > 0) {
    throw new Error(`OpsInspelning: okända props ${okanda.join(", ")}. Tillåtna: ${INSPELNING_PROPS.join(", ")}.`);
  }
  const { lage, fel, niva, sekunder, tak, framsteg, kanIgen, text = "", medText = false, skickarText = TALK_SKICKAR_TEXT, kvitto = null, onAngra, onKlar, onAvbryt, onIgen, onStart, onTillatMikrofon, onInstallningar, marke, mal = [], valt = null, onValj } = props;
  const [fragar, setFragar] = useState(false);
  const fortsatt = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const stang = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const malEtikett = useId();
  const lyssnar = lage === "haller" || lage === "lyssnar";
  /** Kvittot står med sina knappar: Ångra och Stäng. */
  const kvittoKnappar = lage === "sparat" && Boolean(kvitto) && !kvitto?.angrat;

  useEffect(() => {
    if (!lyssnar) setFragar(false);
  }, [lyssnar]);

  useEffect(() => {
    if (fragar) fortsatt.current?.focus();
  }, [fragar]);

  /**
   * ⛔ FOKUS TILL STÄNG NÄR KVITTOT KOMMER, INTE TILL ÅNGRA. Klar, som var fokuserad, försvinner när läget byts, och utan ett
   * nytt mål hamnar tangentbordet i sidans topp. Ångra hade varit fel mål: ett Enter av vana hade tagit bort det appen nyss gjort.
   * Bara på övergången, så att en Ångra som faller inte flyttar fokus från knappen personen just tryckte på.
   */
  useEffect(() => {
    if (kvittoKnappar) stang.current?.focus();
  }, [kvittoKnappar]);

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
        <button type="button" aria-label="Spela in" data-inspelning="start" onClick={onStart} className={PRIMAR}>
          <MikrofonIkon size={18} />
          Spela in
        </button>
      </div>
    );
  }

  if (fragar && lyssnar) {
    return (
      <div data-ops-inspelning="" data-inspelning="fraga" className="flex w-full min-w-0 flex-col gap-4">
        <p className="m-0 text-brod text-ink">Kasta den här inspelningen?</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setFragar(false); onAvbryt(); }} className={`${SEKUNDAR_ORD} text-danger`}>Kasta</button>
          <button ref={fortsatt} type="button" onClick={() => setFragar(false)} className={PRIMAR}>Fortsätt</button>
        </div>
      </div>
    );
  }

  const procent = framsteg == null ? null : Math.round(framsteg * 100);
  /** Vad statusregionen säger. `null`: tom och dold. */
  const statusLage = lage === "skickar" ? "skickar" : lage === "sparat" ? (kvitto ? "kvitto" : "sparat") : null;
  const valtId = valt ?? (mal[0] ? mal[0].id : null);
  const visaTextyta = (lyssnar && (medText || Boolean(text))) || (lage === "skickar" && Boolean(text));
  const kanTillatMikrofon = !kanIgen && kanBeOmMikrofon(fel) && typeof (onTillatMikrofon || onStart) === "function";

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
            <button type="button" aria-label="Inställningar för TALK" onClick={onInstallningar} className={`${KUGG} -my-1 -mr-1`}>
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
        ) : (
          <p data-talk-platstext="" className={`${TEXTYTA} text-ink-muted`}>
            {TALK_PLATSTEXT}
          </p>
        )
      ) : null}
      {/* ⛔ STATUSREGIONEN STÅR KVAR OCH BYTER TEXT (0.97.0). Förut skapades en ny `role="status"` i samma ögonblick som den
          fick sin text, och skärmläsare läser ofta inte upp en region som föds med innehåll: kvittot, "Ångrat" och
          "Agenten arbetar…" kunde passera tyst. Nu finns den från första läget i fältet, dold och tom medan man pratar, i samma
          plats i trädet, så att det är SAMMA element som får texten. */}
      <p role="status" aria-live="polite" data-talk-status={statusLage || undefined} data-talk-kvitto={statusLage === "kvitto" ? "" : undefined} className={STATUSKLASS[statusLage || "tom"]}>
        {statusLage === "skickar" ? (
          <>
            {procent == null ? <OpsSpinner size="sm" decorative /> : null}
            {procent == null ? skickarText : `${skickarText} ${procent} %`}
          </>
        ) : null}
        {statusLage === "sparat" ? (
          <>
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent"><BockIkon size={14} /></span>
            Sparat
          </>
        ) : null}
        {statusLage === "kvitto" && kvitto ? (
          <>
            <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent"><BockIkon size={14} /></span>
            <span className="min-w-0">{kvitto.angrat ? "Ångrat" : kvitto.text}</span>
          </>
        ) : null}
      </p>
      {lage === "skickar" && procent != null ? (
        // `-mt-1`: raden och stapeln hörde ihop med 8 px emellan, och fältets mellanrum är 12.
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={procent} aria-label={skickarText} className="-mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent" style={{ width: `${procent}%` }} />
        </div>
      ) : null}
      {lage === "sparat" && kvitto ? (
        <>
          {kvitto.fel ? <p role="alert" data-talk-fel="" className="m-0 text-etikett text-danger">{kvitto.fel}</p> : null}
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
                  {kvitto.angrar ? "Ångrar…" : "Ångra"}
                </button>
              ) : null}
              <button ref={stang} type="button" data-talk-stang="" onClick={onAvbryt} className={PRIMAR}>Stäng</button>
            </div>
          ) : null}
        </>
      ) : null}
      {lage === "fel" ? (
        <div className="flex min-w-0 flex-col gap-3">
          <p role="alert" data-talk-fel="" className="m-0 text-etikett text-danger">{fel || "Något gick fel."}</p>
          <div className="flex items-center gap-3">
            {kanIgen || kanTillatMikrofon ? (
              <button type="button" aria-label="Avbryt" data-talk-avbryt="" onClick={onAvbryt} className={SEKUNDAR}>
                <KryssIkon size={18} />
              </button>
            ) : null}
            {kanIgen ? (
              <button type="button" onClick={onIgen} className={PRIMAR}>Försök igen</button>
            ) : null}
            {kanTillatMikrofon ? (
              <button type="button" data-talk-mikrofon="" onClick={onTillatMikrofon || onStart} className={PRIMAR}>
                <MikrofonIkon size={18} />
                Tillåt mikrofon
              </button>
            ) : null}
            {!kanIgen && !kanTillatMikrofon ? (
              <button type="button" onClick={onAvbryt} className={PRIMAR}>Stäng</button>
            ) : null}
          </div>
        </div>
      ) : null}
      {lyssnar && mal.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <span id={malEtikett} className="text-meta text-ink-muted">Skickas till</span>
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
          <button type="button" aria-label="Avbryt" data-talk-avbryt="" onClick={avbryt} className={SEKUNDAR}>
            <KryssIkon size={18} />
          </button>
          <button type="button" aria-label="Klar, spara inspelningen" data-talk-skicka="" onClick={onKlar} className={PRIMAR}>
            <StoppIkon size={14} />
            Klar
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
 * }} props `medText`, `skickarText`, `kvitto` och `onAngra` (0.97.0) kommer ur `useTalk` med samma namn (`onAngra` är `angra`).
 */
export function OpsTalk({ lage, fel, niva, sekunder = 0, tak = MAX_SEKUNDER, framsteg = null, kanIgen = false, text = "", medText = false, skickarText = TALK_SKICKAR_TEXT, kvitto = null, onAngra, onSkicka, onAvbryt, onIgen = () => {}, onTillatMikrofon, onInstallningar, marke, mal = [], valt = null, onValj }) {
  if (lage === "vila" || lage === "trycker") return null;
  return (
    <div
      role="dialog"
      aria-label="TALK"
      data-ops-talk=""
      data-lage={lage}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-(--z-dropdown) mx-auto max-w-md md:bottom-6"
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
        />
      </div>
    </div>
  );
}
