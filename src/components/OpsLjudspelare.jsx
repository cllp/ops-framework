import { useEffect, useRef, useState } from "react";
import {
  HOPP_SEKUNDER,
  STOLPAR,
  andel,
  baraEnSpelar,
  formateraTid,
  hastighetText,
  hoppa,
  lasStolpar,
  nastaHastighet,
  plattaStolpar,
  registreraSpelare,
  stolparForAdress,
  tidUrAndel,
} from "../lib/ljudspelare.js";
import { cx } from "../lib/cx.js";
import { HoppaBakatIkon, HoppaFramatIkon, PausaIkon, SpelaIkon } from "./icons.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";

/**
 * En ljudspelare för allt ljud: Bibliotekets inspelningar, chattens bilagor och en fil appen redan har en adress till.
 *
 * ⛔ FÖREBILDEN ÄR SESSIONSTUDIOS SPELARE, MÄTT I KÄLLAN (read-only, cllp/sessions-platform):
 * `InlineAudioPlayer.jsx`, `WebFullscreenAudioPlayer.jsx`, `WebMiniPlayer.jsx` och
 * `packages/shared/audioPlayerHelpers.js`. Det som tas som det är: en spelare i taget,
 * spela och pausa, spolning, förfluten tid och total tid, hopp tio sekunder, en väntan
 * medan ljudet startar, och ett fel som sägs. Vågen och hastigheten fanns inte där
 * (de stod som framtida i `memory/archive/MOBILE_APP_STRATEGY.md`). De är med för att
 * CP bad om dem, inte för att förebilden hade dem.
 *
 * ⛔ SPOLNINGEN ÄR ETT NATIVT `input type=range` OVANPÅ VÅGEN. SessionStudios
 * fullskärmsspelare ritade ett eget `role="slider"` och räknade pekaren själv.
 * `OpsSlider` bär redan skälet: den räkningen är det som går sönder på en telefon.
 * Vågen är det man ser. Reglaget är det man drar, med piltangenter och uppläsning.
 *
 * ⛔ EN I TAGET ÄR EN SPÄRR, INTE EN GLOBAL LIST. Varje rad har sitt eget
 * `<audio>` så längden och vågen kan läsas innan man trycker. När en startar
 * pausas de andra (`baraEnSpelar`). En enda delad `<audio>` hade gjort att
 * grannraden visade 0:00 tills man råkade starta just den.
 *
 * ⛔ LAGRING. `src` är en färdig adress (http, https eller en data-URL). En fil i
 * Storage skickas som `sokvag` plus `hamtaAdress`, och den funktionen är appens
 * `adress` på `createFirebaseStorageSource`, alltså `getDownloadURL`. Ramverket
 * importerar inte Firebase. `src` vinner när båda finns: Biblioteket cachar
 * adressen själv och ska inte hämta den en gång till här.
 *
 * @param {object} props
 * @param {string} [props.src] Färdig adress. Vinner över `sokvag`.
 * @param {string} [props.sokvag] Sökväg i Storage, när adressen inte är känd än.
 * @param {(sokvag: string) => Promise<string>} [props.hamtaAdress] Ger adressen för `sokvag`. Samma kontrakt som lagringens `adress`.
 * @param {string} [props.namn] Det ljudet heter, för knapparna och för raden ovanför när `visaNamn` är sann.
 * @param {boolean} [props.visaNamn] Rita namnet. Falskt där raden redan säger det, som i Bibliotekets lista.
 */
export function OpsLjudspelare(props) {
  const tillatna = ["src", "sokvag", "hamtaAdress", "namn", "visaNamn"];
  const okanda = Object.keys(props).filter((k) => !tillatna.includes(k));
  if (okanda.length > 0) {
    throw new Error(`OpsLjudspelare: okända props ${okanda.join(", ")}. Tillåtna: ${tillatna.join(", ")}.`);
  }
  const { src = "", sokvag = "", hamtaAdress, namn = "", visaNamn = true } = props;
  if (hamtaAdress !== undefined && typeof hamtaAdress !== "function") {
    throw new Error("OpsLjudspelare: hamtaAdress ska vara en funktion (sokvag) => adress. Det är lagringens adress, alltså getDownloadURL.");
  }
  if (namn !== undefined && typeof namn !== "string") {
    throw new Error("OpsLjudspelare: namn ska vara en sträng.");
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

  if (hamtar) {
    return (
      <p role="status" data-ljudspelare="hamtar" className="m-0 text-meta text-ink-secondary">
        Hämtar ljudet.
      </p>
    );
  }
  if (!adress) {
    return (
      <p role="alert" data-ljudspelare="saknas" className="m-0 text-meta text-danger">
        {adressFel || "Filen har ingen adress."}
      </p>
    );
  }
  return <Spelare adress={adress} namn={typeof namn === "string" ? namn : ""} visaNamn={visaNamn !== false} />;
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
  if (namn === "NotAllowedError") return "Webbläsaren tillät inte uppspelningen.";
  return "Ljudet gick inte att spela.";
}

/**
 * @param {{ adress: string, namn: string, visaNamn: boolean }} props
 */
function Spelare({ adress, namn, visaNamn }) {
  const ljud = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const begart = useRef(false);
  const drar = useRef(false);
  const handtag = useRef(/** @type {{ pausa: () => void }} */ ({ pausa: () => {} }));
  const [spelar, setSpelar] = useState(false);
  const [laddar, setLaddar] = useState(false);
  const [tid, setTid] = useState(0);
  const [langd, setLangd] = useState(0);
  const [hastighet, setHastighet] = useState(1);
  const [fel, setFel] = useState("");
  const [stolpar, setStolpar] = useState(() => lasStolpar(adress) ?? plattaStolpar());

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
    const el = ljud.current;
    if (!el) return undefined;
    begart.current = false;
    setTid(0);
    setLangd(0);
    setSpelar(false);
    setLaddar(false);
    setFel("");
    el.playbackRate = hastighet;
    if (Number.isFinite(el.duration)) setLangd(el.duration);

    // Hastigheten läses när adressen byts. Knappen sätter den sedan själv, så den inte startar om ljudet.
    const vidTid = () => {
      if (!drar.current) setTid(el.currentTime || 0);
    };
    const vidLangd = () => {
      const d = el.duration;
      setLangd(Number.isFinite(d) ? d : 0);
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
    el.addEventListener("durationchange", vidLangd);
    el.addEventListener("loadedmetadata", vidLangd);
    el.addEventListener("play", vidSpel);
    el.addEventListener("playing", vidSpel);
    el.addEventListener("pause", vidPaus);
    el.addEventListener("ended", vidSlut);
    el.addEventListener("waiting", vidVantar);
    el.addEventListener("error", vidFel);
    return () => {
      try {
        el.pause();
      } catch {
        /* samma som handtagets paus: städningen ska nå fram till att lyssnarna tas bort */
      }
      el.removeEventListener("timeupdate", vidTid);
      el.removeEventListener("durationchange", vidLangd);
      el.removeEventListener("loadedmetadata", vidLangd);
      el.removeEventListener("play", vidSpel);
      el.removeEventListener("playing", vidSpel);
      el.removeEventListener("pause", vidPaus);
      el.removeEventListener("ended", vidSlut);
      el.removeEventListener("waiting", vidVantar);
      el.removeEventListener("error", vidFel);
    };
  }, [adress]);

  useEffect(() => {
    const cachad = lasStolpar(adress);
    if (cachad) {
      setStolpar(cachad);
      return undefined;
    }
    setStolpar(plattaStolpar());
    const ac = new AbortController();
    stolparForAdress(adress, ac.signal).then(
      (svar) => {
        if (!ac.signal.aborted && svar && svar.length > 0) setStolpar(svar);
      },
      () => {
        /* avbruten läsning, eller en våg som inte gick att räkna: den platta står kvar */
      },
    );
    return () => ac.abort();
  }, [adress]);

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

  const spolNamn = etikett ? `Spola i ${etikett}` : "Spola i ljudet";
  const nedNamn = etikett ? `Ladda ned ${etikett}` : "Ladda ned ljudet";

  return (
    <div data-ljudspelare="" className="flex w-full min-w-0 flex-col gap-1">
      <audio ref={ljud} src={adress} preload="metadata" className="sr-only" />
      {visaNamn && etikett ? <p className="m-0 truncate text-meta font-medium text-ink">{etikett}</p> : null}
      <div className="flex min-w-0 items-center gap-2">
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
        <div className="relative h-11 min-w-0 flex-1 rounded-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-1.5 flex h-8 items-end gap-px">
            {visade.map((hojd, i) => {
              const spelad = (i + 0.5) / visade.length <= kvot;
              return (
                <span
                  key={i}
                  data-ljud-stolpe={spelad ? "spelad" : "kvar"}
                  className={cx("min-h-0.5 min-w-0 flex-1 rounded-sm", spelad ? "bg-accent" : "bg-line")}
                  style={{ height: `${Math.max(12, Math.round((hojd || 0) * 100))}%` }}
                />
              );
            })}
          </div>
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
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          aria-label="10 sekunder bakåt"
          disabled={!langd}
          onClick={() => hoppaOm(-HOPP_SEKUNDER)}
          className="inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-md px-1 text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HoppaBakatIkon size={16} />
          <span aria-hidden="true" className="text-liten font-medium text-ink-secondary">-10</span>
        </button>
        <span className="shrink-0 px-1 text-meta text-ink-secondary tabular-nums">{formateraTid(tid)} / {formateraTid(langd)}</span>
        <button
          type="button"
          aria-label="10 sekunder framåt"
          disabled={!langd}
          onClick={() => hoppaOm(HOPP_SEKUNDER)}
          className="inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-md px-1 text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HoppaFramatIkon size={16} />
          <span aria-hidden="true" className="text-liten font-medium text-ink-secondary">+10</span>
        </button>
        <button
          type="button"
          aria-label={`Uppspelningshastighet ${hastighetText(hastighet)}`}
          onClick={bytHastighet}
          className="inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-md px-2 text-meta font-medium text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {hastighetText(hastighet)}
        </button>
        <a
          href={adress}
          download={etikett || "ljud"}
          aria-label={nedNamn}
          className="inline-flex h-11 shrink-0 items-center rounded-md px-2 text-meta text-ink-secondary underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Ladda ned
        </a>
      </div>
      {fel ? (
        <p role="alert" className="m-0 text-meta text-danger">
          {fel}
        </p>
      ) : null}
    </div>
  );
}
