import { useCallback, useEffect, useRef, useState } from "react";
import { AVBRYT_FRAGA_SEKUNDER, LANGTRYCK_MS, MAX_SEKUNDER, SPARAT_MS, talkFeltext, talkNasta, webblasarensInspelare } from "../lib/talk.js";
import { formateraTid } from "../lib/ljudspelare.js";
import { rapporteraFel } from "../lib/felrapport.js";
import { KryssIkon, KugghjulIkon, MikrofonIkon, StoppIkon } from "./icons.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";

/**
 * TALK i komponenterna: kroken som binder ihop flödet, inspelaren och plusknappen, och fältet som ligger över appen
 * (0.57.0, cllp/lifehub.app#2). Flödet och skälen står i `src/lib/talk.js`.
 */

/**
 * @typedef {object} TalkVal
 * @property {(blob: Blob, meta: { mimeType: string, sekunder: number, rapportera: (andel: number) => void }) => Promise<void> | void} onTalk Appens mottagare.
 *   ⛔ Kastar den eller avvisar löftet visas felet i fältet, med Försök igen. Ett ljud som tyst försvann hade sett ut som ett skickat.
 *   `rapportera` tar 0 till 1, samma kvot som `bytesTransferred / totalBytes` i `uploadBytesResumable`. Utan anrop visas en snurra.
 * @property {() => void} [onInstallningar] Kugghjulet i fältet. Utan den ritas inget kugghjul.
 * @property {import("react").ReactNode} [marke] Märket längst till vänster i fältet, vanligen hubbens.
 * @property {import("../lib/talk.js").Inspelare} [inspelare] Bara för prov. Förval: webbläsarens `MediaRecorder`.
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
export function useTalk({ onTalk, onKlick, inspelare, maxSekunder = MAX_SEKUNDER }) {
  if (!Number.isInteger(maxSekunder) || maxSekunder < 1) {
    throw new Error(`useTalk: maxSekunder ska vara ett positivt heltal, fick ${String(maxSekunder)}. Ett tyst tak hade antingen klippt direkt eller spelat in utan slut.`);
  }
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
  /** Ljudet som redan stoppats, så Försök igen inte spelar in på nytt. */
  const senast = useRef(/** @type {{ blob: Blob, mimeType: string, sekunder: number } | null} */ (null));
  const insp = () => {
    if (!inspRef.current) inspRef.current = webblasarensInspelare();
    return inspRef.current;
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

  const skicka = useCallback(
    /** @param {import("../lib/talk.js").Talkhandelse} h */
    (h) => {
      const nasta = talkNasta(lageRef.current, h);
      lageRef.current = nasta;
      setTillstand({ lage: nasta.lage, ...(nasta.fel ? { fel: nasta.fel } : {}) });
      if (nasta.gor === "klick") onKlick();
      if (nasta.gor === "kasta") {
        forsok.current += 1;
        rensaTak();
        senast.current = null;
        setKanIgen(false);
        setFramsteg(null);
        try {
          insp().kasta();
        } catch (fel) {
          rapporteraFel(fel, { yta: "OpsTalk", steg: "kasta" });
        }
        frigor();
      }
      if (nasta.gor === "starta") {
        startTid.current = Date.now();
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
              tak.current = setTimeout(() => skicka({ typ: "tak" }), maxSekunder * 1000);
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
       * @param {{ blob: Blob, mimeType: string, sekunder: number }} post
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
          .then(() => onTalk(post.blob, { mimeType: post.mimeType, sekunder: post.sekunder, rapportera }))
          .then(() => {
            if (!monterad.current) return;
            senast.current = null;
            setKanIgen(false);
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
        insp()
          .stoppa()
          .finally(frigor)
          .then((post) => {
            if (mitt !== forsok.current || !monterad.current) return;
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
      setSekunder(Math.max(0, Math.floor((Date.now() - startTid.current) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [spelarIn]);

  const skickaRef = useRef(skicka);
  skickaRef.current = skicka;
  useEffect(() => {
    if (tillstand.lage !== "sparat") return undefined;
    const id = setTimeout(() => skickaRef.current({ typ: "dolj" }), SPARAT_MS);
    return () => clearTimeout(id);
  }, [tillstand.lage]);

  useEffect(() => {
    monterad.current = true;
    return () => {
      monterad.current = false;
      forsok.current += 1;
      rensa();
      rensaTak();
      if (lageRef.current.lage === "haller" || lageRef.current.lage === "lyssnar") inspRef.current?.kasta();
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

const PRIMAR = "inline-flex min-h-11 min-w-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-4 text-meta font-medium text-accent-contrast hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50";
const VAL = "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-sunken px-4 text-meta font-medium text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const SEKUNDAR = "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-sunken text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const TEXTKNAPP = "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-full px-4 text-meta font-medium text-danger hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const KUGG = "inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-sunken text-ink hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const INSPELNING_PROPS = ["lage", "fel", "niva", "sekunder", "tak", "framsteg", "kanIgen", "onKlar", "onAvbryt", "onIgen", "onStart", "onInstallningar", "marke", "mal", "valt", "onValj"];

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
 * @param {object} props
 * @param {import("../lib/talk.js").Talklage} props.lage
 * @param {string} [props.fel]
 * @param {() => number} props.niva
 * @param {number} props.sekunder
 * @param {number} props.tak
 * @param {number | null} props.framsteg
 * @param {boolean} props.kanIgen
 * @param {() => void} props.onKlar
 * @param {() => void} props.onAvbryt
 * @param {() => void} props.onIgen
 * @param {() => void} [props.onStart] Ritad när läget är vila. Biblioteket startar så. Plusset startar utifrån.
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
  const { lage, fel, niva, sekunder, tak, framsteg, kanIgen, onKlar, onAvbryt, onIgen, onStart, onInstallningar, marke, mal = [], valt = null, onValj } = props;
  const [fragar, setFragar] = useState(false);
  const fortsatt = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const lyssnar = lage === "haller" || lage === "lyssnar";

  useEffect(() => {
    if (!lyssnar) setFragar(false);
  }, [lyssnar]);

  useEffect(() => {
    if (fragar) fortsatt.current?.focus();
  }, [fragar]);

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
      <div data-ops-inspelning="" data-inspelning="fraga" className="flex w-full min-w-0 flex-col gap-2">
        <p className="m-0 text-meta text-ink">Kasta den här inspelningen?</p>
        <div className="flex items-center gap-2">
          <button ref={fortsatt} type="button" onClick={() => setFragar(false)} className={PRIMAR}>Fortsätt</button>
          <button type="button" onClick={() => { setFragar(false); onAvbryt(); }} className={TEXTKNAPP}>Kasta</button>
        </div>
      </div>
    );
  }

  const procent = framsteg == null ? null : Math.round(framsteg * 100);

  const valtId = valt ?? (mal[0] ? mal[0].id : null);

  return (
    <div data-ops-inspelning="" data-inspelning={lage} className="flex w-full min-w-0 flex-col gap-2">
      {lyssnar ? (
        <div className="flex min-w-0 items-center gap-2">
          {marke ? <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center">{marke}</span> : null}
          <TalkPrickar niva={niva} lyssnar />
          <span data-inspelning-tid="" className="shrink-0 text-meta font-medium text-ink tabular-nums">{formateraTid(sekunder)} / {formateraTid(tak)}</span>
          {onInstallningar ? (
            <button type="button" aria-label="Inställningar för TALK" onClick={onInstallningar} className={KUGG}>
              <KugghjulIkon />
            </button>
          ) : null}
        </div>
      ) : null}
      {lage === "skickar" ? (
        <div className="flex min-w-0 flex-col gap-2">
          <p role="status" className="m-0 flex items-center gap-2 text-meta font-medium text-ink">
            {procent == null ? <OpsSpinner size="sm" decorative /> : null}
            {procent == null ? "Sparar…" : `Sparar… ${procent} %`}
          </p>
          {procent != null ? (
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={procent} aria-label="Sparar" className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full bg-accent" style={{ width: `${procent}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}
      {lage === "sparat" ? <p role="status" className="m-0 text-meta font-medium text-ink">Sparat</p> : null}
      {lage === "fel" ? (
        <div className="flex min-w-0 flex-col gap-2">
          <p role="alert" data-talk-fel="" className="m-0 text-meta text-danger">{fel || "Något gick fel."}</p>
          <div className="flex items-center gap-2">
            {kanIgen ? (
              <button type="button" onClick={onIgen} className={PRIMAR}>Försök igen</button>
            ) : (
              <button type="button" onClick={onAvbryt} className={PRIMAR}>Stäng</button>
            )}
            {kanIgen ? (
              <button type="button" aria-label="Avbryt" data-talk-avbryt="" onClick={onAvbryt} className={SEKUNDAR}>
                <KryssIkon size={18} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {lyssnar && mal.length > 0 ? (
        <div role="radiogroup" aria-label="Vart inspelningen sparas" className="flex flex-col gap-2">
          {mal.map((m) => {
            const vald = m.id === valtId;
            return (
              <button key={m.id} type="button" role="radio" aria-checked={vald} data-inspelning-mal={m.id} onClick={() => onValj?.(m.id)} className={vald ? "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-4 text-meta font-medium text-accent-contrast hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" : VAL}>
                {m.etikett}
              </button>
            );
          })}
        </div>
      ) : null}
      {lyssnar ? (
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Klar, spara inspelningen" data-talk-skicka="" onClick={onKlar} className={PRIMAR}>
            <StoppIkon size={16} />
            Klar
          </button>
          <button type="button" aria-label="Avbryt" data-talk-avbryt="" onClick={avbryt} className={SEKUNDAR}>
            <KryssIkon size={18} />
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
 *   onSkicka: () => void,
 *   onAvbryt: () => void,
 *   onIgen?: () => void,
 *   onInstallningar?: () => void,
 *   marke?: import("react").ReactNode,
 *   mal?: ReadonlyArray<{ id: string, etikett: string }>,
 *   valt?: string | null,
 *   onValj?: (id: string) => void,
 * }} props
 */
export function OpsTalk({ lage, fel, niva, sekunder = 0, tak = MAX_SEKUNDER, framsteg = null, kanIgen = false, onSkicka, onAvbryt, onIgen = () => {}, onInstallningar, marke, mal = [], valt = null, onValj }) {
  if (lage === "vila" || lage === "trycker") return null;
  return (
    <div
      role="dialog"
      aria-label="TALK"
      data-ops-talk=""
      data-lage={lage}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-(--z-dropdown) mx-auto max-w-md md:bottom-6"
    >
      <div className="rounded-2xl border border-line-strong bg-raised p-3 shadow-lg">
        <OpsInspelning
          lage={lage}
          fel={fel}
          niva={niva}
          sekunder={sekunder}
          tak={tak}
          framsteg={framsteg}
          kanIgen={kanIgen}
          onKlar={onSkicka}
          onAvbryt={onAvbryt}
          onIgen={onIgen}
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
