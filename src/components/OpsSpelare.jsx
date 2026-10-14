import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, X } from "lucide-react";
import { avkodaToppar, kodaToppar, toppListaGiltig } from "../lib/bibliotek.js";
import {
  HOPP_SEKUNDER,
  STOLPAR,
  baraEnSpelar,
  formateraTid,
  hastighetText,
  hoppa,
  langdArKand,
  lasStolpar,
  metaForAdress,
  nastaHastighet,
  plattaStolpar,
  registreraSpelare,
} from "../lib/ljudspelare.js";
import { cx } from "../lib/cx.js";
import { radBehallare } from "../lib/radKlass.js";
import { HoppaBakatIkon, HoppaFramatIkon, PausaIkon, SpelaIkon } from "./icons.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";

/**
 * En spelare för hela skalet: en spelrad längst ned som står kvar när man byter sida, och ett ark med vågen, spolning, hopp och
 * hastighet (0.102.0).
 *
 * ⛔ FÖREBILDEN ÄR SESSIONSTUDIOS SPELARE (`AudioPlayerContext`, `WebMiniPlayer` och `WebFullscreenAudioPlayer` på webben,
 * `MiniPlayer` och `FullscreenAudioPlayer` i appen). CP 2026-10-14, med tre skärmbilder från SessionStudio: "Kolla SessionStudio och
 * spelaren. Men gärna med waveform också." Före var varje rad en egen spelare med eget `<audio>`, och ljudet tystnade när man lämnade
 * sidan. Nu äger skalet ett enda `<audio>`, och en post ger bara sitt spår.
 *
 * ⛔ GÖRS BÄTTRE ÄN FÖREBILDEN (kanonens regel 13):
 * - Vågen är spolningen. SessionStudio har en slät linje, och CP bad om vågen. Vågen är postens sparade toppar (`peaks`), och
 *   saknas de räknas de ur filen och lämnas till appen (`onMeta`) så att nästa visning har dem utan att läsa filen.
 * - Låsskärmen och hörlurarna styr spelaren genom Media Session. SessionStudio har det inte på webben.
 * - Hastigheten står i arket, där ljudet redan spelar. I listans meny styrde den förr en spelare som inte hade startats.
 *
 * ⛔ EN I TAGET, OCKSÅ MED DE GAMLA SPELARNA. Skalets spelare anmäler sig i samma spärr som `OpsLjudspelare`
 * (`registreraSpelare`, `baraEnSpelar`), så en bilaga i chatten som startas pausar spelraden och tvärtom.
 *
 * ⛔ UTANFÖR SKALET FINNS INGEN SPELRAD. `useSpelare()` ger då `null`, och den som vill spela ritar `OpsLjudspelare` själv. En knapp
 * som tyst inte spelade hade varit en tyst nedsläppsväg.
 */

/**
 * @typedef {object} Spar
 * @property {string} id Postens id. Samma id är samma spår.
 * @property {string} namn
 * @property {string} src
 * @property {string} [undertitel] Raden under namnet i spelraden. Förval "Tryck för att spola".
 * @property {number} [durationMs] Sparad längd.
 * @property {string} [peaks] Sparad våg, som `kodaToppar` ger den.
 * @property {(meta: { durationMs?: number, peaks?: string }) => void} [onMeta] Anropas när längd eller våg räknats fram ur filen.
 */

/**
 * @typedef {object} Spelarlage
 * @property {Spar | null} spar
 * @property {boolean} spelar
 * @property {boolean} laddar
 * @property {number} tid Sekunder.
 * @property {number} langd Sekunder, 0 när den inte är känd.
 * @property {number} hastighet
 * @property {number[] | null} toppar
 * @property {string} fel
 * @property {(spar: Spar) => void} spela
 * @property {(spar: Spar) => void} vaxla Spela ett annat spår, eller pausa och fortsätta samma.
 * @property {() => void} pausa
 * @property {(sekunder: number) => void} sok
 * @property {(delta: number) => void} hoppaOm
 * @property {() => void} bytHastighet
 * @property {() => void} stang
 * @property {() => void} oppnaArk
 */

export const ORD_OPSSPELARE = {
  spelar: { sv: "Spelar", en: "Playing" },
  spola: { sv: "Tryck för att spola", en: "Tap to scrub" },
};

const SpelarKontext = createContext(/** @type {Spelarlage | null} */ (null));

/**
 * Skalets spelare, eller `null` utanför `OpsSpelareProvider`.
 * @returns {Spelarlage | null}
 */
export function useSpelare() {
  return useContext(SpelarKontext);
}

/**
 * @param {string} [peaks]
 * @param {string} [src]
 * @returns {number[] | null}
 */
function topparFor(peaks, src) {
  const sparade = avkodaToppar(peaks);
  if (sparade) return sparade;
  return src ? lasStolpar(src) : null;
}

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export function OpsSpelareProvider({ children }) {
  const ljud = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const [spar, setSpar] = useState(/** @type {Spar | null} */ (null));
  const [spelar, setSpelar] = useState(false);
  const [laddar, setLaddar] = useState(false);
  const [tid, setTid] = useState(0);
  const [langd, setLangd] = useState(0);
  const [hastighet, setHastighet] = useState(1);
  const [toppar, setToppar] = useState(/** @type {number[] | null} */ (null));
  const [fel, setFel] = useState("");
  const [arkOppet, setArkOppet] = useState(false);
  const sparRef = useRef(spar);
  sparRef.current = spar;
  const handtag = useRef({ pausa: () => ljud.current?.pause() });

  useEffect(() => registreraSpelare(handtag.current), []);

  useEffect(() => {
    const el = ljud.current;
    if (!el) return undefined;
    const pa = () => setSpelar(true);
    const av = () => setSpelar(false);
    const slut = () => {
      setSpelar(false);
      setTid(0);
    };
    const tidNu = () => setTid(el.currentTime || 0);
    const langdNu = () => {
      if (langdArKand(el.duration)) setLangd(el.duration);
    };
    const felNu = () => {
      setLaddar(false);
      setSpelar(false);
      setFel("Ljudet kunde inte spelas.");
    };
    el.addEventListener("play", pa);
    el.addEventListener("pause", av);
    el.addEventListener("ended", slut);
    el.addEventListener("timeupdate", tidNu);
    el.addEventListener("durationchange", langdNu);
    el.addEventListener("loadedmetadata", langdNu);
    el.addEventListener("error", felNu);
    return () => {
      el.removeEventListener("play", pa);
      el.removeEventListener("pause", av);
      el.removeEventListener("ended", slut);
      el.removeEventListener("timeupdate", tidNu);
      el.removeEventListener("durationchange", langdNu);
      el.removeEventListener("loadedmetadata", langdNu);
      el.removeEventListener("error", felNu);
    };
  }, []);

  // Längd och våg ur filen när posten saknar dem, en gång per spår. Ett misslyckande (CORS, ett format avkodaren inte kan) är inte
  // ett uppspelningsfel: ljudet spelar ändå, och vågen står platt.
  useEffect(() => {
    if (!spar) return undefined;
    const kontroll = new AbortController();
    const harVag = Boolean(avkodaToppar(spar.peaks));
    const harLangd = Number.isInteger(spar.durationMs) && /** @type {number} */ (spar.durationMs) > 0;
    if (harVag && harLangd) return undefined;
    metaForAdress(spar.src, kontroll.signal)
      .then((meta) => {
        if (!meta || kontroll.signal.aborted || sparRef.current?.src !== spar.src) return;
        if (!harVag && toppListaGiltig(meta.peaks)) setToppar(meta.peaks);
        if (!harLangd && meta.durationMs > 0) setLangd((nu) => (nu > 0 ? nu : meta.durationMs / 1000));
        if (typeof spar.onMeta === "function") {
          /** @type {{ durationMs?: number, peaks?: string }} */
          const ut = {};
          if (!harLangd && meta.durationMs > 0) ut.durationMs = meta.durationMs;
          if (!harVag && toppListaGiltig(meta.peaks)) ut.peaks = kodaToppar(meta.peaks);
          if (ut.durationMs || ut.peaks) spar.onMeta(ut);
        }
      })
      .catch(() => {});
    return () => kontroll.abort();
  }, [spar?.src]); // eslint-disable-line react-hooks/exhaustive-deps

  const spela = useCallback((/** @type {Spar} */ ny) => {
    const el = ljud.current;
    if (!el || !ny || typeof ny.src !== "string" || ny.src === "") {
      setFel("Ljudet har ingen adress.");
      return;
    }
    setFel("");
    if (sparRef.current?.src !== ny.src) {
      setSpar(ny);
      setTid(0);
      setLangd(Number.isInteger(ny.durationMs) && /** @type {number} */ (ny.durationMs) > 0 ? /** @type {number} */ (ny.durationMs) / 1000 : 0);
      setToppar(topparFor(ny.peaks, ny.src));
      el.src = ny.src;
      el.defaultPlaybackRate = hastighet;
      el.playbackRate = hastighet;
    } else if (sparRef.current !== ny) {
      setSpar(ny);
    }
    baraEnSpelar(handtag.current);
    setLaddar(true);
    Promise.resolve()
      .then(() => el.play())
      .then(
        () => setLaddar(false),
        (e) => {
          setLaddar(false);
          setFel(e instanceof Error && e.name === "NotAllowedError" ? "Webbläsaren stoppade uppspelningen. Tryck på spela igen." : "Ljudet kunde inte spelas.");
        },
      );
  }, [hastighet]);

  const pausa = useCallback(() => ljud.current?.pause(), []);

  const vaxla = useCallback((/** @type {Spar} */ ny) => {
    const el = ljud.current;
    if (el && sparRef.current?.src === ny.src && !el.paused) {
      el.pause();
      return;
    }
    spela(ny);
  }, [spela]);

  const sok = useCallback((/** @type {number} */ sekunder) => {
    const el = ljud.current;
    if (!el || !Number.isFinite(sekunder)) return;
    el.currentTime = Math.max(0, sekunder);
    setTid(el.currentTime);
  }, []);

  const hoppaOm = useCallback((/** @type {number} */ delta) => {
    const el = ljud.current;
    if (!el) return;
    sok(hoppa(el.currentTime || 0, langd, delta));
  }, [langd, sok]);

  const bytHastighet = useCallback(() => {
    const ny = nastaHastighet(hastighet);
    setHastighet(ny);
    if (ljud.current) {
      ljud.current.defaultPlaybackRate = ny;
      ljud.current.playbackRate = ny;
    }
  }, [hastighet]);

  const stang = useCallback(() => {
    const el = ljud.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setArkOppet(false);
    setSpar(null);
    setSpelar(false);
    setTid(0);
    setLangd(0);
    setToppar(null);
    setFel("");
  }, []);

  // ⛔ LÅSSKÄRMEN OCH HÖRLURARNA (Media Session). Saknas stödet händer ingenting, och spelaren fungerar som vanligt.
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms) return undefined;
    if (!spar) {
      ms.metadata = null;
      return undefined;
    }
    if (typeof MediaMetadata === "function") ms.metadata = new MediaMetadata({ title: spar.namn });
    /** @type {Array<[MediaSessionAction, MediaSessionActionHandler]>} */
    const handlingar = [
      ["play", () => spela(spar)],
      ["pause", () => pausa()],
      ["seekbackward", () => hoppaOm(-HOPP_SEKUNDER)],
      ["seekforward", () => hoppaOm(HOPP_SEKUNDER)],
      ["seekto", (d) => sok(Number(d?.seekTime ?? 0))],
      ["stop", () => stang()],
    ];
    for (const [namn, gor] of handlingar) {
      try {
        ms.setActionHandler(namn, gor);
      } catch {
        /* en handling webbläsaren inte känner. De andra gäller ändå. */
      }
    }
    return () => {
      for (const [namn] of handlingar) {
        try {
          ms.setActionHandler(namn, null);
        } catch {
          /* samma som ovan */
        }
      }
    };
  }, [spar, spela, pausa, hoppaOm, sok, stang]);

  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (ms) ms.playbackState = spar ? (spelar ? "playing" : "paused") : "none";
  }, [spar, spelar]);

  const lage = useMemo(
    () => /** @type {Spelarlage} */ ({ spar, spelar, laddar, tid, langd, hastighet, toppar, fel, spela, vaxla, pausa, sok, hoppaOm, bytHastighet, stang, oppnaArk: () => setArkOppet(true) }),
    [spar, spelar, laddar, tid, langd, hastighet, toppar, fel, spela, vaxla, pausa, sok, hoppaOm, bytHastighet, stang],
  );

  return (
    <SpelarKontext.Provider value={lage}>
      {children}
      {/* ⛔ playsInline: iOS Safari startar annars i fullskärm. preload=metadata räcker för längden. */}
      <audio ref={ljud} preload="metadata" playsInline className="sr-only" />
      {spar ? (
        <>
          {/* Luft under sidan, så att sista raden inte hamnar under spelraden. */}
          <div aria-hidden="true" className="h-20 md:h-0" />
          <Spelrad lage={lage} />
        </>
      ) : null}
      <Spelarark lage={lage} oppen={arkOppet && Boolean(spar)} onOppen={setArkOppet} />
    </SpelarKontext.Provider>
  );
}

/**
 * Spelraden längst ned (SessionStudios `WebMiniPlayer`): en tunn linje med var i ljudet man är, namnet, spela eller pausa, och
 * stäng. Ett tryck på namnet öppnar arket. Under 768 px ligger den ovanpå bottenraden, och från 768 px uppe i ett hörn.
 *
 * @param {{ lage: Spelarlage }} props
 */
function Spelrad({ lage }) {
  const { spar, spelar, laddar, tid, langd, fel } = lage;
  if (!spar) return null;
  const pos = langd > 0 ? Math.min(1, tid / langd) : 0;
  return (
    <div
      role="region"
      aria-label={`Spelar ${spar.namn}`}
      data-ops-spelrad=""
      className={cx(
        "fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom))] z-(--z-chrome) border-t border-line bg-raised",
        "md:inset-x-auto md:right-4 md:bottom-4 md:w-96 md:rounded-md md:border md:shadow-lg",
      )}
    >
      <div aria-hidden="true" className="h-0.5 bg-line">
        <div className="h-full bg-accent" style={{ width: `${pos * 100}%` }} />
      </div>
      <div className="flex items-center gap-2 py-2 pr-2 pl-4">
        <button
          type="button"
          onClick={lage.oppnaArk}
          aria-label={`Öppna spelaren för ${spar.namn}`}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center bg-transparent text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <span className="block truncate text-etikett font-medium text-ink">{spar.namn}</span>
          <span className={cx("block truncate text-meta", fel ? "text-danger" : "text-ink-muted")}>{fel || spar.undertitel || ORD_OPSSPELARE.spola.sv}</span>
        </button>
        <SpelaKnapp spelar={spelar} laddar={laddar} namn={spar.namn} storlek="mellan" onClick={() => lage.vaxla(spar)} />
        <button
          type="button"
          onClick={lage.stang}
          aria-label="Stäng spelaren"
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Arket (SessionStudios `WebFullscreenAudioPlayer`): fäll ihop, "Spelar" och stäng överst, namnet, vågen som spolning med tiderna,
 * och -10, spela och +10. Hastighet och Ladda ned under, för ljudet spelar redan här.
 *
 * @param {{ lage: Spelarlage, oppen: boolean, onOppen: (v: boolean) => void }} props
 */
function Spelarark({ lage, oppen, onOppen }) {
  const { spar } = lage;
  return (
    <Dialog.Root open={oppen} onOpenChange={onOppen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          data-ops-spelarark=""
          className={cx(
            "fixed inset-x-0 bottom-0 z-(--z-modal) flex flex-col gap-6 px-5 pt-4 pb-[calc(2rem+var(--safe-bottom))]",
            "md:inset-x-auto md:top-1/2 md:left-1/2 md:bottom-auto md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:pb-8",
            radBehallare({ ark: true }),
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <Dialog.Close aria-label="Fäll ihop spelaren" className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <ChevronDown size={24} aria-hidden="true" />
            </Dialog.Close>
            <span className="text-etikett font-medium text-ink-secondary">{ORD_OPSSPELARE.spelar.sv}</span>
            <button
              type="button"
              onClick={lage.stang}
              aria-label="Stäng spelaren"
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <Dialog.Title className="m-0 text-center text-titel font-medium text-ink wrap-anywhere">{spar?.namn ?? ""}</Dialog.Title>
          {spar ? <OpsSpelarKontroller spar={spar} stor /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * @param {{ spelar: boolean, laddar: boolean, namn: string, storlek: "liten" | "mellan" | "stor", onClick: () => void, disabled?: boolean }} props
 */
function SpelaKnapp({ spelar, laddar, namn, storlek, onClick, disabled = false }) {
  const ikon = storlek === "stor" ? 30 : storlek === "mellan" ? 18 : 16;
  return (
    <button
      type="button"
      aria-label={`${spelar ? "Pausa" : "Spela"} ${namn}`}
      aria-busy={laddar || undefined}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60",
        storlek === "stor" ? "size-20 bg-accent text-accent-contrast hover:bg-accent-hover" : storlek === "mellan" ? "size-11 bg-accent text-accent-contrast hover:bg-accent-hover" : "size-11 border border-line bg-raised text-ink hover:bg-hover",
      )}
    >
      {laddar ? <OpsSpinner size="sm" decorative /> : spelar ? <PausaIkon size={ikon} /> : <SpelaIkon size={ikon} />}
    </button>
  );
}

/**
 * Spelknappen på en post i en lista: spela, och pausa när just den posten spelar. Utanför skalet ritas den inte, och anroparen ritar
 * `OpsLjudspelare` i stället (`useSpelare()` är då `null`).
 *
 * @param {{ spar: Spar }} props
 */
export function OpsSpelaKnapp({ spar }) {
  const lage = useSpelare();
  if (!lage) return null;
  const aktiv = lage.spar?.src === spar.src;
  return <SpelaKnapp spelar={aktiv && lage.spelar} laddar={aktiv && lage.laddar} namn={spar.namn} storlek="liten" onClick={() => lage.vaxla(spar)} />;
}

/**
 * Vågen och kontrollerna för ett spår: i arket, och i en posts detalj. Spelar spåret inte nu ritas postens egen våg och ett tryck
 * på spela startar det i skalets spelare.
 *
 * ⛔ SPOLNINGEN ÄR ETT NATIVT `input type=range` OVANPÅ VÅGEN, som i `OpsLjudspelare`: tangentbord och skärmläsare fungerar, och
 * pekaren går inte sönder på en telefon. Vågen bakom är bara bild.
 *
 * @param {{ spar: Spar, stor?: boolean }} props
 */
export function OpsSpelarKontroller({ spar, stor = false }) {
  const lage = useSpelare();
  const aktiv = Boolean(lage && lage.spar?.src === spar.src);
  const egnaToppar = useMemo(() => topparFor(spar.peaks, spar.src), [spar.peaks, spar.src]);
  if (!lage) return null;
  const toppar = (aktiv ? lage.toppar : null) ?? egnaToppar ?? plattaStolpar(STOLPAR);
  const sparadLangd = Number.isInteger(spar.durationMs) && /** @type {number} */ (spar.durationMs) > 0 ? /** @type {number} */ (spar.durationMs) / 1000 : 0;
  const langd = aktiv && lage.langd > 0 ? lage.langd : sparadLangd;
  const tid = aktiv ? lage.tid : 0;
  const pos = langd > 0 ? Math.min(1, tid / langd) : 0;
  const startad = aktiv && (lage.spelar || lage.tid > 0);
  return (
    <div data-ops-spelarkontroller={aktiv ? "aktiv" : "vilar"} className="flex w-full min-w-0 flex-col gap-3">
      <div className={cx("relative w-full", stor ? "h-16" : "h-12")}>
        <div aria-hidden="true" className="flex h-full w-full items-center gap-[2px]">
          {toppar.map((v, i) => (
            <span
              key={i}
              className={cx("min-w-0 flex-1 rounded-full", (i + 0.5) / toppar.length <= pos ? "bg-accent" : "bg-ink-muted/40")}
              style={{ height: `${Math.max(8, Math.round(v * 100))}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(pos * 1000)}
          disabled={!langd}
          aria-label={`Spola i ${spar.namn}`}
          aria-valuetext={`${formateraTid(tid)} av ${langd > 0 ? formateraTid(langd) : "okänd längd"}`}
          onChange={(e) => {
            const kvot = Number(e.target.value) / 1000;
            if (!aktiv) {
              lage.spela(spar);
              return;
            }
            lage.sok(kvot * langd);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </div>
      <div className="flex items-center justify-between text-meta text-ink-secondary tabular-nums">
        <span data-ljud-tid="">{formateraTid(tid)}</span>
        <span>{langd > 0 ? formateraTid(langd) : "längd okänd"}</span>
      </div>
      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          aria-label="10 sekunder bakåt"
          disabled={!startad}
          onClick={() => lage.hoppaOm(-HOPP_SEKUNDER)}
          className="inline-flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HoppaBakatIkon size={stor ? 26 : 20} />
          <span aria-hidden="true" className="text-hjalp text-ink-secondary">-10</span>
        </button>
        <SpelaKnapp spelar={aktiv && lage.spelar} laddar={aktiv && lage.laddar} namn={spar.namn} storlek={stor ? "stor" : "mellan"} onClick={() => lage.vaxla(spar)} />
        <button
          type="button"
          aria-label="10 sekunder framåt"
          disabled={!startad}
          onClick={() => lage.hoppaOm(HOPP_SEKUNDER)}
          className="inline-flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HoppaFramatIkon size={stor ? 26 : 20} />
          <span aria-hidden="true" className="text-hjalp text-ink-secondary">+10</span>
        </button>
      </div>
      <div className="flex items-center justify-center gap-4">
        {startad ? (
          <button
            type="button"
            onClick={lage.bytHastighet}
            aria-label={`Uppspelningshastighet ${hastighetText(lage.hastighet)}`}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-md px-3 text-meta font-medium text-ink-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {hastighetText(lage.hastighet)}
          </button>
        ) : null}
        <a
          href={spar.src}
          download={spar.namn || "ljud"}
          aria-label={`Ladda ned ${spar.namn}`}
          className="inline-flex min-h-11 items-center rounded-md px-3 text-meta text-ink-secondary underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          Ladda ned
        </a>
      </div>
      {aktiv && lage.fel ? <p role="alert" className="m-0 text-center text-meta text-danger">{lage.fel}</p> : null}
    </div>
  );
}
