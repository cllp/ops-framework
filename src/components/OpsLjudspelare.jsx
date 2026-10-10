import { useEffect, useRef, useState } from "react";
import { peaksGiltiga } from "../lib/bibliotek.js";
import {
  HOPP_SEKUNDER,
  STOLPAR,
  andel,
  baraEnSpelar,
  formateraTid,
  hastighetText,
  hoppa,
  langdArKand,
  lasLangdMedSok,
  lasStolpar,
  metaForAdress,
  nastaHastighet,
  plattaStolpar,
  registreraSpelare,
  registreraStyrning,
  tidUrAndel,
} from "../lib/ljudspelare.js";
import { cx } from "../lib/cx.js";
import { HoppaBakatIkon, HoppaFramatIkon, PausaIkon, SpelaIkon } from "./icons.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";

/**
 * En ljudspelare för allt ljud: Bibliotekets inspelningar, chattens bilagor och en fil appen redan har en adress till.
 *
 * ⛔ FÖREBILDEN ÄR SESSIONSTUDIOS SPELARE, MÄTT I KÄLLAN (read-only, cllp/sessions-platform):
 * `InlineAudioPlayer.jsx` och bibliotekets listrad. Listan är kompakt: rubrik,
 * datum och längd, spela, våg och menyn. Hopp, hastighet och nedladdning hör
 * hemma i detaljen. Vågen med riktiga toppar är med för att CP bad om den.
 *
 * ⛔ SPOLNINGEN ÄR ETT NATIVT `input type=range` OVANPÅ VÅGEN. Ett eget
 * `role="slider"` som räknar pekaren själv är det som går sönder på en telefon.
 *
 * ⛔ EN I TAGET. Varje rad har sitt eget `<audio>` så längden kan läsas utan
 * att man trycker. När en startar pausas de andra.
 *
 * ⛔ LÄNGD. `duration` från metadata. På iOS och för webm/mp4 från MediaRecorder
 * är den ofta Infinity: då söker spelaren till ett stort värde och läser igen,
 * och avkodning med AudioContext är reserven som också ger topparna.
 * `durationMs` och `peaks` på posten ritas direkt, utan att filen spelas.
 *
 * @param {object} props
 * @param {string} [props.src]
 * @param {string} [props.sokvag]
 * @param {(sokvag: string) => Promise<string>} [props.hamtaAdress]
 * @param {string} [props.namn]
 * @param {boolean} [props.visaNamn] Rita namnet ovanför i det fulla läget. I kompakt läge är namnet alltid radens rubrik.
 * @param {boolean} [props.kompakt] Listans rad: spela, rubrik, meta, våg. Inte hopp, hastighet eller nedladdning.
 * @param {string} [props.meta] Datum och längd under rubriken, i kompakt läge.
 * @param {number} [props.durationMs] Sparad längd. Visas innan elementet hunnit läsa filen.
 * @param {number[]} [props.peaks] Sparade toppar, `LJUD_STOLPAR` tal mellan 0 och 1.
 * @param {() => void} [props.onOppna] Rubriken i kompakt läge öppnar detaljen.
 * @param {(meta: { durationMs?: number, peaks?: number[] }) => void} [props.onMeta] När längd eller toppar räknats fram.
 * @param {string} [props.styrId] Kopplar ⋯-menyn till den här spelaren.
 */
export function OpsLjudspelare(props) {
  const tillatna = ["src", "sokvag", "hamtaAdress", "namn", "visaNamn", "kompakt", "meta", "durationMs", "peaks", "onOppna", "onMeta", "styrId"];
  const okanda = Object.keys(props).filter((k) => !tillatna.includes(k));
  if (okanda.length > 0) {
    throw new Error(`OpsLjudspelare: okända props ${okanda.join(", ")}. Tillåtna: ${tillatna.join(", ")}.`);
  }
  const { src = "", sokvag = "", hamtaAdress, namn = "", visaNamn = true, kompakt = false, meta = "", durationMs, peaks, onOppna, onMeta, styrId = "" } = props;
  if (hamtaAdress !== undefined && typeof hamtaAdress !== "function") {
    throw new Error("OpsLjudspelare: hamtaAdress ska vara en funktion (sokvag) => adress. Det är lagringens adress, alltså getDownloadURL.");
  }
  if (namn !== undefined && typeof namn !== "string") {
    throw new Error("OpsLjudspelare: namn ska vara en sträng.");
  }
  if (meta !== undefined && typeof meta !== "string") {
    throw new Error("OpsLjudspelare: meta ska vara en sträng.");
  }
  if (onOppna !== undefined && typeof onOppna !== "function") {
    throw new Error("OpsLjudspelare: onOppna ska vara en funktion.");
  }
  if (onMeta !== undefined && typeof onMeta !== "function") {
    throw new Error("OpsLjudspelare: onMeta ska vara en funktion.");
  }
  if (styrId !== undefined && typeof styrId !== "string") {
    throw new Error("OpsLjudspelare: styrId ska vara en sträng.");
  }
  if (durationMs !== undefined && durationMs !== null && typeof durationMs !== "number") {
    throw new Error("OpsLjudspelare: durationMs ska vara ett tal, millisekunder.");
  }
  if (peaks !== undefined && peaks !== null && !Array.isArray(peaks)) {
    throw new Error("OpsLjudspelare: peaks ska vara en lista av tal.");
  }

  const [adress, setAdress] = useState(typeof src === "string" ? src : "");
  const [hamtar, setHamtar] = useState(false);
  const [adressFel, setAdressFel] = useState("");
  const hamtaRef = useRef(hamtaAdress);
  hamtaRef.current = hamtaAdress;

  useEffect(() => {
    const fardig = typeof src === "string" ? src.trim() : "";
    if (fardig) {
      setAdress(fardig);
      setHamtar(false);
      setAdressFel("");
      return undefined;
    }
    const vag = typeof sokvag === "string" ? sokvag.trim() : "";
    const hamta = hamtaRef.current;
    if (!vag || typeof hamta !== "function") {
      setAdress("");
      setHamtar(false);
      setAdressFel("Filen har ingen adress.");
      return undefined;
    }
    let kvar = true;
    setHamtar(true);
    setAdress("");
    setAdressFel("");
    let svar;
    try {
      svar = hamta(vag);
    } catch (e) {
      setAdress("");
      setAdressFel(e instanceof Error && e.message ? e.message : "Adressen gick inte att hämta.");
      setHamtar(false);
      return () => {
        kvar = false;
      };
    }
    Promise.resolve(svar)
      .then((url) => {
        if (!kvar) return;
        const text = typeof url === "string" ? url.trim() : "";
        if (!text) {
          setAdressFel("Filen har ingen adress.");
          setHamtar(false);
          return;
        }
        setAdress(text);
        setHamtar(false);
      })
      .catch((e) => {
        if (!kvar) return;
        setAdress("");
        setAdressFel(e instanceof Error && e.message ? e.message : "Adressen gick inte att hämta.");
        setHamtar(false);
      });
    return () => {
      kvar = false;
    };
  }, [src, sokvag]);

  const sparadMs = Number.isInteger(durationMs) && /** @type {number} */ (durationMs) > 0 ? /** @type {number} */ (durationMs) : 0;
  const sparadeToppar = peaksGiltiga(peaks) ? /** @type {number[]} */ (peaks) : null;

  if (hamtar) {
    return (
      <div data-ljudspelare="hamtar" className="flex min-h-11 w-full min-w-0 items-center gap-2 text-meta text-ink-secondary">
        <OpsSpinner size="sm" decorative />
        <p role="status" className="m-0">Hämtar ljudet.</p>
      </div>
    );
  }
  if (!adress) {
    return (
      <p role="alert" data-ljudspelare="saknas" className="m-0 text-meta text-danger">
        {adressFel || "Filen har ingen adress."}
      </p>
    );
  }
  return (
    <Spelare
      adress={adress}
      namn={typeof namn === "string" ? namn : ""}
      visaNamn={visaNamn !== false}
      kompakt={kompakt === true}
      meta={typeof meta === "string" ? meta : ""}
      durationMs={sparadMs}
      peaks={sparadeToppar}
      onOppna={typeof onOppna === "function" ? onOppna : null}
      onMeta={typeof onMeta === "function" ? onMeta : null}
      styrId={typeof styrId === "string" ? styrId : ""}
    />
  );
}

/**
 * @param {HTMLMediaElement | null} el
 */
function mediaFel(el) {
  const kod = el && el.error ? el.error.code : 0;
  if (kod === 2) return "Nätverket avbröt ljudet.";
  if (kod === 3) return "Ljudet gick inte att avkoda.";
  if (kod === 4) return "Ljudformatet stöds inte.";
  return "Ljudet gick inte att spela.";
}

/**
 * @param {unknown} e
 */
function startFel(e) {
  const namn = e && typeof e === "object" && "name" in e ? String(/** @type {any} */ (e).name) : "";
  if (namn === "AbortError") return "";
  if (namn === "NotAllowedError") return "Webbläsaren tillät inte uppspelningen. Tryck på Spela igen.";
  return "Ljudet gick inte att spela.";
}

/**
 * @param {{ adress: string, namn: string, visaNamn: boolean, kompakt: boolean, meta: string, durationMs: number, peaks: number[] | null, onOppna: (() => void) | null, onMeta: ((meta: { durationMs?: number, peaks?: number[] }) => void) | null, styrId: string }} props
 */
function Spelare({ adress, namn, visaNamn, kompakt, meta, durationMs, peaks, onOppna, onMeta, styrId }) {
  const ljud = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const begart = useRef(false);
  const drar = useRef(false);
  const sokerLangd = useRef(false);
  const soktLangd = useRef(false);
  const handtag = useRef(/** @type {{ pausa: () => void }} */ ({ pausa: () => {} }));
  const [spelar, setSpelar] = useState(false);
  const [laddar, setLaddar] = useState(false);
  const [tid, setTid] = useState(0);
  const [langd, setLangd] = useState(durationMs > 0 ? durationMs / 1000 : 0);
  const [hastighet, setHastighet] = useState(1);
  const [fel, setFel] = useState("");
  const [stolpar, setStolpar] = useState(() => peaks ?? lasStolpar(adress) ?? plattaStolpar());
  const [vag, setVag] = useState(peaks || lasStolpar(adress) ? "toppar" : "vantar");
  const onMetaRef = useRef(onMeta);
  onMetaRef.current = onMeta;
  const durationRef = useRef(durationMs);
  const peaksRef = useRef(peaks);
  durationRef.current = durationMs;
  peaksRef.current = peaks;
  const skickat = useRef({ durationMs: durationMs > 0 ? durationMs : 0, peaks: Boolean(peaks) });
  const apiRef = useRef({
    hoppa: (/** @type {number} */ _d) => {},
    bytHastighet: () => {},
    laddaNed: () => {},
  });

  const rapportera = (/** @type {number} */ sek, /** @type {number[] | null} */ toppar) => {
    /** @type {{ durationMs?: number, peaks?: number[] }} */
    const ut = {};
    const ms = langdArKand(sek) ? Math.round(sek * 1000) : 0;
    if (ms && ms !== skickat.current.durationMs) {
      skickat.current.durationMs = ms;
      ut.durationMs = ms;
    }
    if (toppar && peaksGiltiga(toppar) && !skickat.current.peaks) {
      skickat.current.peaks = true;
      ut.peaks = toppar;
    }
    if (ut.durationMs || ut.peaks) onMetaRef.current?.(ut);
  };

  useEffect(() => {
    handtag.current.pausa = () => {
      try {
        ljud.current?.pause();
      } catch {
        /* avmontering och en annan rads start ska inte bli ett fel om elementet inte kan pausas */
      }
    };
    return registreraSpelare(handtag.current);
  }, []);

  useEffect(() => {
    if (!styrId) return undefined;
    return registreraStyrning(styrId, {
      hoppa: (delta) => apiRef.current.hoppa(delta),
      bytHastighet: () => apiRef.current.bytHastighet(),
      laddaNed: () => apiRef.current.laddaNed(),
    });
  }, [styrId]);

  useEffect(() => {
    const el = ljud.current;
    if (!el) return undefined;
    begart.current = false;
    soktLangd.current = false;
    sokerLangd.current = false;
    const startMs = durationRef.current;
    skickat.current = { durationMs: startMs > 0 ? startMs : 0, peaks: Boolean(peaksRef.current) };
    setTid(0);
    setLangd(startMs > 0 ? startMs / 1000 : 0);
    setSpelar(false);
    setLaddar(false);
    setFel("");
    el.playbackRate = hastighet;
    if (langdArKand(el.duration)) setLangd(el.duration);

    let avbruten = false;
    const vidTid = () => {
      if (drar.current || sokerLangd.current) return;
      setTid(el.currentTime || 0);
    };
    const lasOm = () => {
      if (soktLangd.current || avbruten) return;
      if (langdArKand(el.duration)) {
        setLangd(el.duration);
        rapportera(el.duration, null);
        return;
      }
      soktLangd.current = true;
      sokerLangd.current = true;
      lasLangdMedSok(el).then((sek) => {
        sokerLangd.current = false;
        if (avbruten) return;
        if (!begart.current) {
          try {
            el.currentTime = 0;
          } catch {
            /* tiden går inte att nollställa förrän elementet är redo, och då står 0 kvar */
          }
          setTid(0);
        }
        if (langdArKand(sek)) {
          setLangd(sek);
          rapportera(sek, null);
        }
      });
    };
    const vidSpel = () => {
      setSpelar(true);
      setLaddar(false);
      setFel("");
    };
    const vidPaus = () => {
      setSpelar(false);
      setLaddar(false);
    };
    const vidSlut = () => {
      setSpelar(false);
      setLaddar(false);
      setTid(0);
      try {
        el.currentTime = 0;
      } catch {
        /* en del webbläsare nekar tiden när elementet redan städat */
      }
    };
    const vidVantar = () => {
      if (begart.current) setLaddar(true);
    };
    const vidFel = () => {
      setLaddar(false);
      setSpelar(false);
      if (begart.current) setFel(mediaFel(el));
    };
    el.addEventListener("timeupdate", vidTid);
    el.addEventListener("durationchange", lasOm);
    el.addEventListener("loadedmetadata", lasOm);
    el.addEventListener("play", vidSpel);
    el.addEventListener("playing", vidSpel);
    el.addEventListener("pause", vidPaus);
    el.addEventListener("ended", vidSlut);
    el.addEventListener("waiting", vidVantar);
    el.addEventListener("error", vidFel);
    if (el.readyState >= 1) lasOm();
    return () => {
      avbruten = true;
      try {
        el.pause();
      } catch {
        /* samma som handtagets paus: städningen ska nå fram till att lyssnarna tas bort */
      }
      el.removeEventListener("timeupdate", vidTid);
      el.removeEventListener("durationchange", lasOm);
      el.removeEventListener("loadedmetadata", lasOm);
      el.removeEventListener("play", vidSpel);
      el.removeEventListener("playing", vidSpel);
      el.removeEventListener("pause", vidPaus);
      el.removeEventListener("ended", vidSlut);
      el.removeEventListener("waiting", vidVantar);
      el.removeEventListener("error", vidFel);
    };
  }, [adress]);

  useEffect(() => {
    if (durationMs > 0) setLangd((nu) => (nu > 0 ? nu : durationMs / 1000));
  }, [durationMs]);

  useEffect(() => {
    if (peaks && peaksGiltiga(peaks)) {
      setStolpar(peaks);
      setVag("toppar");
      return undefined;
    }
    const cachad = lasStolpar(adress);
    if (cachad && peaksGiltiga(cachad)) {
      setStolpar(cachad);
      setVag("toppar");
      rapportera(0, cachad);
      return undefined;
    }
    setStolpar(plattaStolpar());
    setVag("vantar");
    const ac = new AbortController();
    metaForAdress(adress, ac.signal).then(
      (svar) => {
        if (ac.signal.aborted || !svar) return;
        setStolpar(svar.peaks);
        setVag("toppar");
        if (svar.durationMs > 0) setLangd(svar.durationMs / 1000);
        rapportera(svar.durationMs / 1000, svar.peaks);
      },
      () => {
        /* avbruten läsning, eller en våg som inte gick att räkna: den platta står kvar */
      },
    );
    return () => ac.abort();
  }, [adress, peaks]);

  useEffect(() => {
    if (!spelar) return undefined;
    let slappt = false;
    /** @type {{ release: () => Promise<void> } | null} */
    let las = null;
    const be = async () => {
      try {
        if (slappt || !("wakeLock" in navigator)) return;
        las = await navigator.wakeLock.request("screen");
      } catch {
        /* skärmlåset är en hjälp, inte ett krav för att ljudet ska höras */
      }
    };
    be();
    const vidSyn = () => {
      if (document.visibilityState === "visible") be();
    };
    document.addEventListener("visibilitychange", vidSyn);
    return () => {
      slappt = true;
      document.removeEventListener("visibilitychange", vidSyn);
      las?.release().catch(() => {});
    };
  }, [spelar]);

  const etikett = namn.trim();
  const spelNamn = laddar ? "Hämtar ljudet" : spelar ? "Pausa" : "Spela";
  const knappNamn = etikett ? `${spelNamn} ${etikett}` : spelNamn;
  const kvot = andel(tid, langd);
  const visade = stolpar.length > 0 ? stolpar : plattaStolpar(STOLPAR);
  const procent = Math.round(kvot * 100);

  const spelaEllerPausa = () => {
    const el = ljud.current;
    if (!el) return;
    if (spelar) {
      el.pause();
      return;
    }
    baraEnSpelar(handtag.current);
    begart.current = true;
    setFel("");
    setLaddar(true);
    el.playbackRate = hastighet;
    const svar = el.play();
    if (svar && typeof svar.then === "function") {
      svar.catch((e) => {
        const text = startFel(e);
        setLaddar(false);
        setSpelar(false);
        if (text) setFel(text);
      });
    }
  };

  const sok = (/** @type {number} */ kvotVarde) => {
    const el = ljud.current;
    if (!el || !langd) return;
    const t = tidUrAndel(kvotVarde, langd);
    try {
      el.currentTime = t;
    } catch {
      setFel("Ljudet gick inte att spola i.");
      return;
    }
    setTid(t);
  };

  const hoppaOm = (/** @type {number} */ delta) => {
    if (!langd) return;
    sok(andel(hoppa(tid, langd, delta), langd));
  };

  const bytHastighet = () => {
    const nasta = nastaHastighet(hastighet);
    setHastighet(nasta);
    if (ljud.current) ljud.current.playbackRate = nasta;
  };

  const laddaNed = () => {
    const a = document.createElement("a");
    a.href = adress;
    a.download = etikett || "ljud";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  apiRef.current.hoppa = hoppaOm;
  apiRef.current.bytHastighet = bytHastighet;
  apiRef.current.laddaNed = laddaNed;

  const spolNamn = etikett ? `Spola i ${etikett}` : "Spola i ljudet";
  const nedNamn = etikett ? `Ladda ned ${etikett}` : "Ladda ned ljudet";
  const biKlass =
    "inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-md px-2 text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";

  const vagNod = (
    <div className="relative min-h-11 min-w-0 flex-1 rounded-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
      <div
        aria-hidden="true"
        data-ljud-skena=""
        data-ljud-vag={vag}
        className="pointer-events-none absolute inset-0 flex items-center gap-px px-0.5"
      >
        {visade.map((hojd, i) => {
          const spelad = langd > 0 && (i + 0.5) / visade.length <= kvot;
          const h = Math.max(8, Math.round((hojd || 0) * 100));
          return (
            <span
              key={i}
              data-ljud-stolpe={spelad ? "spelad" : "kvar"}
              data-ljud-hojd={h}
              className={cx("min-w-0 flex-1 rounded-sm", spelad ? "bg-accent" : "bg-line")}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      <div
        aria-hidden="true"
        data-ljud-framsteg=""
        className="pointer-events-none absolute inset-y-1 left-0 bg-accent/25"
        style={{ width: `${procent}%` }}
      />
      <input
        type="range"
        min={0}
        max={1000}
        step={langd > 0 ? Math.max(1, Math.round((5 / langd) * 1000)) : 1}
        value={langd > 0 ? Math.round(kvot * 1000) : 0}
        disabled={!langd}
        aria-label={spolNamn}
        aria-valuetext={langd > 0 ? `${formateraTid(tid)} av ${formateraTid(langd)}` : "Längden är inte känd"}
        onPointerDown={() => {
          drar.current = true;
        }}
        onPointerUp={() => {
          drar.current = false;
        }}
        onPointerCancel={() => {
          drar.current = false;
        }}
        onChange={(e) => sok(Number(e.target.value) / 1000)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );

  const spelKnapp = (
    <button
      type="button"
      aria-label={knappNamn}
      aria-busy={laddar || undefined}
      disabled={laddar}
      onClick={spelaEllerPausa}
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-contrast hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
    >
      {laddar ? <OpsSpinner size="sm" decorative /> : spelar ? <PausaIkon size={18} /> : <SpelaIkon size={18} />}
    </button>
  );

  return (
    <div data-ljudspelare={kompakt ? "kompakt" : "full"} className="flex w-full min-w-0 flex-col gap-1.5">
      {/*
       * ⛔ playsInline: iOS Safari startar annars i fullskärm eller nekar play.
       * preload=metadata räcker för längd; hela filen hämtas vid play.
       */}
      <audio ref={ljud} src={adress} preload="metadata" playsInline className="sr-only" />
      {kompakt ? (
        <>
          <div className="flex min-w-0 items-center gap-3">
            {spelKnapp}
            {onOppna ? (
              <button
                type="button"
                onClick={onOppna}
                aria-label={etikett || "Öppna"}
                className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center bg-transparent text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <span className="block truncate text-brod font-medium text-ink">{etikett}</span>
                {meta ? <span data-ljud-langd="" className="block truncate text-meta text-ink-muted">{meta}</span> : null}
              </button>
            ) : (
              <span className="min-w-0 flex-1">
                {etikett ? <span className="block truncate text-brod font-medium text-ink">{etikett}</span> : null}
                {meta ? <span data-ljud-langd="" className="block truncate text-meta text-ink-muted">{meta}</span> : null}
              </span>
            )}
          </div>
          {vagNod}
        </>
      ) : (
        <>
          {visaNamn && etikett ? <p className="m-0 truncate text-meta font-medium text-ink">{etikett}</p> : null}
          <div className="flex min-w-0 items-center gap-2">
            {spelKnapp}
            {vagNod}
            <span data-ljud-tid="" className="shrink-0 text-meta text-ink-secondary tabular-nums">
              {formateraTid(tid)}
              {langd > 0 ? (
                <span className="text-ink-muted"> / {formateraTid(langd)}</span>
              ) : (
                <span className="text-ink-muted"> / längd okänd</span>
              )}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            <button type="button" aria-label="10 sekunder bakåt" disabled={!langd} onClick={() => hoppaOm(-HOPP_SEKUNDER)} className={biKlass}>
              <HoppaBakatIkon size={16} />
              <span aria-hidden="true" className="text-liten font-medium text-ink-secondary">-10</span>
            </button>
            <button type="button" aria-label="10 sekunder framåt" disabled={!langd} onClick={() => hoppaOm(HOPP_SEKUNDER)} className={biKlass}>
              <HoppaFramatIkon size={16} />
              <span aria-hidden="true" className="text-liten font-medium text-ink-secondary">+10</span>
            </button>
            <button
              type="button"
              aria-label={`Uppspelningshastighet ${hastighetText(hastighet)}`}
              onClick={bytHastighet}
              className={cx(biKlass, "px-2 text-meta font-medium")}
            >
              {hastighetText(hastighet)}
            </button>
            <a
              href={adress}
              download={etikett || "ljud"}
              aria-label={nedNamn}
              className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-meta text-ink-secondary underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Ladda ned
            </a>
          </div>
        </>
      )}
      {fel ? (
        <p role="alert" className="m-0 text-meta text-danger">
          {fel}
        </p>
      ) : null}
    </div>
  );
}
