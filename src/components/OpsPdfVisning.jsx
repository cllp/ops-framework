import { useCallback, useEffect, useRef, useState } from "react";
import { DokumentKnapp, Dokumentrad } from "./Dokumentrad.jsx";
import { OpsGastFelrad } from "./OpsGastFelrad.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { useHtmlZoom } from "./htmlZoom.jsx";
import { IKON_FOR } from "./ikonlexikon.js";
import { ExternLankIkon } from "./icons.jsx";
import { filadressFel } from "../lib/bibliotek.js";
import { cx } from "../lib/cx.js";
import { ordet } from "../lib/ord.js";
import { PDFJS_SAKNAS, laddaPdfjs, oppnaPdf, pdfFelsort } from "../lib/pdfjs.js";
import { SIDNUMMER_MS, bytSida, klickSteg, skarmSkala, svepSteg, tangentIPresentation } from "../lib/pdfpresentation.js";
import { sparaSomFil } from "../lib/sparaFil.js";
import { OpsVantar } from "./OpsVantar.jsx";

/**
 * En PDF i appens egen vy, med Presentera i helskärm sida för sida (0.193.0, cllp/ops-framework#530).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-06, med en skärmbild av en PDF öppnad direkt från lagringen i Edge: "Det är inte så bra att det står firebase storage mm när man presenterar. Går det att köra PDF i ett eget fönster som döljer den
 * länkraden ungefär som html-filen och sedan att man kan visa pdf:en i presentationsläge, helskärm, så att inte LIFE-HUB syns heller?" CP:s svar på frågorna i ärendet: sida för sida, och gäster får presentera.
 *
 * ══ ⛔ SÅ HÄR FUNGERAR VYN ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. FILEN HÄMTAS SOM BYTE (`hamta(sokvag)`, appens `hamtaFil` med inloggningen) och ritas av pdf.js på en canvas per sida. Lagringens adress finns aldrig i vyn: inte i en länk, inte i en `src`, inte i adressfältet.
 * 2. EN RAD (0.196.0, `Dokumentrad`, samma som HTML-rutan): zoomen (`useHtmlZoom`, med Anpassa till bredd som förval), sidan som "1/3" när det finns fler än en, och ikonknapparna Helskärm, Ladda ned, och Öppna i eget fönster eller Stäng.
 *    Ingen egen bakgrund, ingen ram och inget filnamn i detaljen (posten har sin rubrik). I helfönstret står namnet som rubrik. Förut (0.193.0) stod filnamnet i en egen ruta, Presentera som stor knapp och Ladda ned på en egen rad:
 *    CP 2026-11-06, "Det här ser jättekonstigt ut, kolla hur ful titeln ligger skarv.pdf. Det här håller inte. Presentera är ett konstigt ord i sammanhanget."
 *    Ladda ned följer spärren (`laddaNed: false`, gästens bibliotek när gruppen stängt av nedladdning) och sparar byten vyn redan har (`sparaSomFil`, aldrig lagringens adress).
 * 3. SIDORNA RITAS NÄR DE SYNS (`IntersectionObserver`): en PDF på hundra sidor ritar inte hundra canvas när den öppnas. Utan observatören ritas alla.
 * 4. HELSKÄRM (hette Presentera till 0.196.0): Fullscreen API på vyns eget element, en sida i taget, anpassad till skärmen, utan rad och utan appens skal. Pilar, mellanslag, PageUp, PageDown, klick och svep byter sida (`lib/pdfvisning.js`),
 *    Esc avslutar, och sidnumret syns en kort stund vid varje sidbyte (`SIDNUMMER_MS`). Där elementet inte kan gå till helskärm (Safari på iPhone har inget Fullscreen API för element) fyller presentationen
 *    fönstret i stället. ⛔ Det kan inte lovas att Safaris egen rad är borta där. Som hemskärmsapp är fönstret hela skärmen.
 * 5. ⛔ FEL SYNS, MED FÖRSÖK IGEN (regel 5, samma rad som gästflikarna i #675, `OpsGastFelrad`): en fil som inte går att hämta, en import av pdf.js som faller, en PDF med lösenord och en fil som inte är en PDF.
 *
 * @param {object} props
 * @param {(sokvag: string) => Promise<Blob>} props.hamta Filens byte.
 * @param {string} props.sokvag
 * @param {string} props.namn Filens namn.
 * @param {string} [props.fonster] Adressen till vyn i ett eget fönster (`pdfVyAdress`). Med den står Öppna i eget fönster i raden.
 * @param {boolean} [props.laddaNed] `false`: ingen Ladda ned (gästens spärr). Förval `true`.
 * @param {boolean} [props.helfonster] Vyn fyller fönstret (`OpsPdfVy`): rutan tar resten av höjden i stället för 70 procent av den.
 * @param {() => void} [props.onStang] Stäng, i helfönstret.
 * @param {string} [props.stangEtikett] Stängknappens ord. Förval "Stäng".
 */
export function OpsPdfVisning({ hamta, sokvag, namn, fonster, laddaNed = true, helfonster = false, onStang, stangEtikett }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_PDFVISNING} */ k) => ordet(ORD_PDFVISNING, k, sprak);
  const hamtaRef = useRef(hamta);
  hamtaRef.current = hamta;
  const filRef = useRef(/** @type {Blob | null} */ (null));
  const [forsok, setForsok] = useState(0);
  const [lage, setLage] = useState(/** @type {{ lage: "hamtar" } | { lage: "klar", dokument: any, antal: number, sida1: { bredd: number, hojd: number } } | { lage: "fel", sort: "import" | "saknas" | "hamta" | "losenord" | "trasig" | "annat", text: string }} */ ({ lage: "hamtar" }));

  // ── Hämtningen: pdf.js och byten samtidigt, och felet efter vad som föll ────────────────────────────────────────────
  useEffect(() => {
    let kvar = true;
    /** @type {(() => void) | null} */
    let stang = null;
    setLage({ lage: "hamtar" });
    filRef.current = null;
    (async () => {
      const [pdfjs, fil] = await Promise.allSettled([laddaPdfjs(), Promise.resolve().then(() => hamtaRef.current(sokvag))]);
      if (!kvar) return;
      if (pdfjs.status === "rejected") return setLage({ lage: "fel", sort: pdfjs.reason?.code === PDFJS_SAKNAS ? "saknas" : "import", text: "" });
      if (fil.status === "rejected") return setLage({ lage: "fel", sort: "hamta", text: filadressFel(fil.reason) });
      filRef.current = fil.value;
      try {
        const oppnad = await oppnaPdf(fil.value);
        if (!kvar) return oppnad.stang();
        stang = oppnad.stang;
        const forsta = await oppnad.dokument.getPage(1);
        const vp = forsta.getViewport({ scale: CSS_PER_PUNKT });
        if (!kvar) return;
        setLage({ lage: "klar", dokument: oppnad.dokument, antal: oppnad.dokument.numPages, sida1: { bredd: vp.width, hojd: vp.height } });
      } catch (e) {
        if (kvar) setLage({ lage: "fel", sort: pdfFelsort(e), text: "" });
      }
    })();
    return () => {
      kvar = false;
      stang?.();
    };
  }, [sokvag, forsok]);

  const klar = lage.lage === "klar" ? lage : null;
  const antal = klar?.antal ?? 0;
  const [sida, setSida] = useState(1);
  useEffect(() => setSida(1), [klar?.dokument]);

  // ── Zoomen: samma tillstånd och knappar som HTML-rutan. Måttet är sidans bredd vid 100 procent mot rutans bredd ──────
  const zoom = useHtmlZoom();
  const rulla = useRef(/** @type {HTMLDivElement | null} */ (null));
  const ta = zoom.ta;
  const sidbredd = klar?.sida1.bredd ?? 0;
  // Luften runt sidorna finns bara i helfönstret. I detaljen står sidan kant i kant med raden ovanför, som HTML-rutan.
  const kant = helfonster ? KANT : 0;
  useEffect(() => {
    const el = rulla.current;
    if (!el || !sidbredd) return undefined;
    const matt = () => {
      const synlig = el.clientWidth - 2 * kant;
      if (synlig > 0) ta({ typ: "matt", innehall: sidbredd, synlig });
    };
    matt();
    if (typeof ResizeObserver !== "function") return undefined;
    const ro = new ResizeObserver(matt);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sidbredd, ta, kant]);

  // ── Presentationen ──────────────────────────────────────────────────────────────────────────────────────────────────
  const yta = useRef(/** @type {HTMLElement | null} */ (null));
  const [presenterar, setPresenterar] = useState(/** @type {false | "helskarm" | "fonster"} */ (false));
  const [visaNummer, setVisaNummer] = useState(false);
  const nummerKlocka = useRef(/** @type {ReturnType<typeof setTimeout> | undefined} */ (undefined));
  const visaSidnummer = useCallback(() => {
    setVisaNummer(true);
    clearTimeout(nummerKlocka.current);
    nummerKlocka.current = setTimeout(() => setVisaNummer(false), SIDNUMMER_MS);
  }, []);
  useEffect(() => () => clearTimeout(nummerKlocka.current), []);

  const stegTill = useCallback(
    (/** @type {number | "forsta" | "sista"} */ steg) => {
      setSida((nu) => (steg === "forsta" ? 1 : steg === "sista" ? Math.max(1, antal) : bytSida(nu, antal, steg)));
      visaSidnummer();
    },
    [antal, visaSidnummer],
  );

  const avsluta = useCallback(() => {
    setPresenterar(false);
    if (typeof document !== "undefined" && document.fullscreenElement && document.fullscreenElement === yta.current) document.exitFullscreen?.()?.catch(() => {});
  }, []);

  function presentera() {
    const el = yta.current;
    // ⛔ WEBBLÄSARENS EGET SVAR, som `OpsFullscreenToggle`: finns metoden och säger dokumentet ja går vi till helskärm. Annars, och om webbläsaren avslår, fyller presentationen fönstret.
    const kan = Boolean(el) && typeof document !== "undefined" && Boolean(document.fullscreenEnabled) && typeof el?.requestFullscreen === "function";
    setPresenterar(kan ? "helskarm" : "fonster");
    visaSidnummer();
    if (kan && el) {
      // Anropet sker i trycket, inte efter: webbläsaren släpper bara in helskärm i en användargest.
      const tillFonster = () => setPresenterar((nu) => (nu ? "fonster" : nu));
      try {
        el.requestFullscreen()?.catch(tillFonster);
      } catch {
        tillFonster();
      }
    }
  }

  // Lämnas helskärmen utan oss (Esc i webbläsaren, F11, en annan flik) är presentationen slut. Webbläsaren äger det läget, som i `OpsFullscreenToggle`.
  useEffect(() => {
    if (presenterar !== "helskarm") return undefined;
    const vid = () => {
      if (document.fullscreenElement !== yta.current) setPresenterar(false);
    };
    document.addEventListener("fullscreenchange", vid);
    return () => document.removeEventListener("fullscreenchange", vid);
  }, [presenterar]);

  useEffect(() => {
    if (!presenterar) return undefined;
    /** @param {KeyboardEvent} e */
    const tangent = (e) => {
      // Mellanslag och Enter på en knapp (Avsluta i hörnet) trycker knappen, och byter inte sida samtidigt.
      if ((e.key === " " || e.key === "Enter") && e.target instanceof Element && e.target.closest("button")) return;
      const g = tangentIPresentation(e);
      if (g === null) return;
      e.preventDefault();
      if (g === "avsluta") avsluta();
      else stegTill(g);
    };
    document.addEventListener("keydown", tangent);
    // Fönsterläget: sidan bakom rullar inte medan presentationen ligger över den.
    const rot = document.documentElement;
    const fore = rot.style.overflow;
    if (presenterar === "fonster") rot.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tangent);
      rot.style.overflow = fore;
    };
  }, [presenterar, avsluta, stegTill]);

  const [skarm, setSkarm] = useState({ bredd: 0, hojd: 0 });
  useEffect(() => {
    if (!presenterar) return undefined;
    // Ytans eget mått, och om igen när den ändras: övergången till helskärm sker efter trycket, och ett mått taget i trycket är fönstrets och inte skärmens.
    const matt = () => setSkarm({ bredd: yta.current?.clientWidth || window.innerWidth, hojd: yta.current?.clientHeight || window.innerHeight });
    matt();
    window.addEventListener("resize", matt);
    document.addEventListener("fullscreenchange", matt);
    const ro = typeof ResizeObserver === "function" && yta.current ? new ResizeObserver(matt) : null;
    if (ro && yta.current) ro.observe(yta.current);
    return () => {
      window.removeEventListener("resize", matt);
      document.removeEventListener("fullscreenchange", matt);
      ro?.disconnect();
    };
  }, [presenterar]);

  const svep = useRef(/** @type {{ x: number, y: number } | null} */ (null));
  const svepte = useRef(false);

  function sparaFilen() {
    void sparaSomFil({ hamta: async () => filRef.current ?? hamtaRef.current(sokvag), sokvag, namn });
  }

  const etikett = o(presenterar ? "presentationEtikett" : helfonster ? "vyEtikett" : "etikett").replace("{namn}", namn);
  const sidtext = antal > 0 ? o("sida").replace("{nr}", String(sida)).replace("{antal}", String(antal)) : "";

  // ⛔ PRESENTATIONEN ÄR MÖRK I BÅDA TEMANA: en sida visas mot mörkt, som i ett bildspel, oavsett om appen är ljus. Ytan är den mörka publika ytan (`publik-mork`), den token som redan betyder
  // "mörkt oavsett tema", och inte en egen färg (tokenkontraktet, `check:closed-api`).
  if (presenterar && klar) {
    return (
      <section
        ref={yta}
        aria-label={etikett}
        aria-roledescription={o("presentation")}
        data-pdf-presentation={presenterar}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-publik-mork text-publik-mork-text select-none"
        onClick={(e) => {
          if (svepte.current) {
            svepte.current = false;
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          stegTill(klickSteg(e.clientX - r.left, r.width));
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          svep.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const fran = svep.current;
          const t = e.changedTouches[0];
          svep.current = null;
          if (!fran || !t) return;
          const steg = svepSteg(t.clientX - fran.x, t.clientY - fran.y);
          if (steg !== 0) {
            svepte.current = true;
            stegTill(steg);
          }
        }}
      >
        <Sida key={`p${sida}`} dokument={klar.dokument} nr={sida} yta={skarm} mark="data-pdf-presentationssida" etikett={o("sidaEtikett").replace("{nr}", String(sida))} />
        <p
          role="status"
          aria-live="polite"
          data-pdf-sidnummer={visaNummer ? "" : undefined}
          className={cx("pointer-events-none absolute bottom-6 left-1/2 m-0 -translate-x-1/2 rounded-full bg-scrim px-4 py-1.5 text-etikett text-publik-mork-text tabular-nums transition-opacity", visaNummer ? "opacity-100" : "opacity-0")}
        >
          {`${sida} / ${antal}`}
        </p>
        {/* ⛔ EN VÄG UT UTAN TANGENTBORD: på en telefon finns ingen Esc. Knappen är svag tills den får fokus eller pekaren. */}
        <button
          type="button"
          aria-label={o("avsluta")}
          data-pdf-avsluta=""
          onClick={(e) => {
            e.stopPropagation();
            avsluta();
          }}
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-scrim text-publik-mork-text opacity-40 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-publik-mork-text"
        >
          <IKON_FOR.stang size={20} aria-hidden="true" />
        </button>
      </section>
    );
  }

  // ⛔ EN RAD, INGEN EGEN YTA (0.196.0, `Dokumentrad`): zoomen, sidan och ikonknapparna på en rad utan bakgrund och utan ram. I detaljen står inget filnamn: posten har redan sin rubrik.
  // I helfönstret står namnet som rubrik bredvid raden (under den i en telefon), i appens vanliga rubrikstil.
  const rad = (
    <Dokumentrad mark="data-pdf-rad" etikett={o("verktyg")} zoom={klar ? zoom : null} sprak={sprak} sida={antal > 0 ? { nr: sida, antal, etikett: sidtext } : null}>
      <DokumentKnapp mark="data-pdf-helskarm" ikon={IKON_FOR.helskarm} etikett={o("helskarm")} disabled={!klar} onClick={() => presentera()} />
      {laddaNed ? <DokumentKnapp mark="data-pdf-ladda-ned" ikon={IKON_FOR.laddaNed} etikett={o("laddaNed")} onClick={() => sparaFilen()} /> : null}
      {fonster ? <DokumentKnapp mark="data-pdf-fonster" ikon={ExternLankIkon} etikett={o("fonster")} href={fonster} /> : null}
      {onStang ? <DokumentKnapp mark="data-pdf-stang" ikon={IKON_FOR.stang} etikett={stangEtikett || o("stang")} onClick={onStang} /> : null}
    </Dokumentrad>
  );

  return (
    <section ref={yta} data-pdf-vy={helfonster ? "helfonster" : ""} aria-label={etikett} className={cx("flex min-w-0 flex-col text-ink", helfonster ? "h-dvh min-h-0 w-full bg-canvas" : "gap-2")}>
      {/* Helfönstret står på appens bakgrund (`bg-canvas`), samma som detaljen, så att den vita sidan syns mot den. Raden och rubriken har ingen egen yta. */}
      {helfonster ? (
        <header data-pdf-huvud="" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <h1 data-pdf-namn="" className="m-0 min-w-0 flex-1 basis-48 truncate text-rubrik text-ink">{namn}</h1>
          {rad}
        </header>
      ) : (
        rad
      )}
      {lage.lage === "hamtar" ? (
        <div data-pdf-lage="hamtar" className={cx("m-0 text-etikett text-ink-muted", helfonster && "px-4 py-4")}><OpsVantar text={o("hamtar")} /></div>
      ) : lage.lage === "fel" ? (
        <div data-pdf-lage="fel" className={cx(helfonster && "px-4 py-4")}>
          <OpsGastFelrad data="pdf-fel" text={felText(lage, o)} forsokIgen={o("forsokIgen")} onForsokIgen={() => setForsok((n) => n + 1)} />
        </div>
      ) : antal === 0 ? (
        <p role="status" data-pdf-lage="tom" className={cx("m-0 text-etikett text-ink-muted", helfonster && "px-4 py-4")}>{o("tom")}</p>
      ) : (
        // ⛔ INGEN RAM OCH INGEN EGEN BAKGRUND RUNT SIDORNA (0.196.0, CP: "sidan i en egen ram med rundade hörn inne i rutan"). Sidan står på samma yta som raden, som HTML-rutans dokument.
        <div
          ref={rulla}
          data-pdf-sidor=""
          className={cx("min-w-0 overflow-auto", helfonster ? "min-h-0 flex-1" : "h-[70vh] min-h-72")}
          style={{ padding: kant }}
        >
          <div className="mx-auto flex w-max min-w-full flex-col items-center gap-3">
            {Array.from({ length: antal }, (_, i) => (
              <SynligSida key={i + 1} dokument={/** @type {any} */ (klar).dokument} nr={i + 1} skala={zoom.skala} sida1={/** @type {any} */ (klar).sida1} rot={rulla} onSyns={setSida} etikett={o("sidaEtikett").replace("{nr}", String(i + 1))} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** pdf.js mäter i punkter (1/72 tum), webben i CSS-pixlar (1/96 tum). 100 procent i zoomen är sidan i sin tryckta storlek på skärmen. */
const CSS_PER_PUNKT = 96 / 72;
/** Luften runt sidorna i rutan, i CSS-pixlar. */
const KANT = 12;

/**
 * @param {{ sort: "import" | "saknas" | "hamta" | "losenord" | "trasig" | "annat", text: string }} fel
 * @param {(k: keyof typeof ORD_PDFVISNING) => string} o
 */
function felText(fel, o) {
  if (fel.sort === "import") return o("felImport");
  if (fel.sort === "saknas") return o("felSaknas");
  if (fel.sort === "hamta") return `${o("felHamta")} ${fel.text}`.trim();
  if (fel.sort === "losenord") return o("felLosenord");
  if (fel.sort === "trasig") return o("felTrasig");
  return o("felAnnat");
}

/**
 * En sida i den rullande vyn: en platshållare i sidans storlek tills den syns, sedan canvas. Utan `IntersectionObserver` ritas den direkt.
 * @param {{ dokument: any, nr: number, skala: number, sida1: { bredd: number, hojd: number }, rot: { current: HTMLElement | null }, onSyns: (nr: number) => void, etikett: string }} props
 */
function SynligSida({ dokument, nr, skala, sida1, rot, onSyns, etikett }) {
  const ram = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [synlig, setSynlig] = useState(() => typeof IntersectionObserver !== "function");
  const onSynsRef = useRef(onSyns);
  onSynsRef.current = onSyns;
  useEffect(() => {
    const el = ram.current;
    if (!el || typeof IntersectionObserver !== "function") return undefined;
    // ⛔ TVÅ OBSERVATÖRER, INTE EN. Den första ritar sidan när den är nära (en skärmhöjd före). Den andra säger vilken sida som står mitt i rutan, för Sida x av y.
    // Med en observatör och marginalen räknades sidorna under som synliga också: andelen räknas mot den utökade ytan, och raden sade "Sida 3 av 3" när sidan 1 syntes (mätt i en telefon på 390 px).
    const nara = new IntersectionObserver((poster) => {
      if (poster.some((p) => p.isIntersecting)) setSynlig(true);
    }, { root: rot.current, rootMargin: "100% 0px" });
    const mitt = new IntersectionObserver((poster) => {
      if (poster.some((p) => p.isIntersecting)) onSynsRef.current(nr);
    }, { root: rot.current, rootMargin: "-50% 0px -50% 0px" });
    nara.observe(el);
    mitt.observe(el);
    return () => {
      nara.disconnect();
      mitt.disconnect();
    };
  }, [nr, rot]);
  return (
    <div ref={ram} data-pdf-sidram={nr} style={synlig ? undefined : { width: sida1.bredd * skala, height: sida1.hojd * skala, background: "white" }}>
      {synlig ? <Sida dokument={dokument} nr={nr} skala={skala} mark="data-pdf-sida-canvas" etikett={etikett} /> : null}
    </div>
  );
}

/**
 * En sida på en canvas, i skärmens upplösning. Antingen med en skala (rutan) eller anpassad till en yta (presentationen).
 * Ritningen avbryts när sidan, skalan eller ytan ändras, så att två ritningar aldrig skriver på samma canvas.
 *
 * @param {{ dokument: any, nr: number, skala?: number, yta?: { bredd: number, hojd: number }, mark: string, etikett: string }} props
 */
function Sida({ dokument, nr, skala, yta, mark, etikett }) {
  const canvas = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const [fel, setFel] = useState(false);
  const ytaB = yta?.bredd ?? 0;
  const ytaH = yta?.hojd ?? 0;
  useEffect(() => {
    let kvar = true;
    /** @type {{ cancel: () => void } | null} */
    let uppgift = null;
    setFel(false);
    (async () => {
      try {
        const sidan = await dokument.getPage(nr);
        if (!kvar || !canvas.current) return;
        const bas = sidan.getViewport({ scale: CSS_PER_PUNKT });
        const s = yta ? skarmSkala({ bredd: bas.width, hojd: bas.height }, { bredd: ytaB, hojd: ytaH }) : (skala ?? 1);
        const vp = sidan.getViewport({ scale: CSS_PER_PUNKT * s });
        const dpr = typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
        const c = canvas.current;
        c.width = Math.max(1, Math.floor(vp.width * dpr));
        c.height = Math.max(1, Math.floor(vp.height * dpr));
        c.style.width = `${Math.floor(vp.width)}px`;
        c.style.height = `${Math.floor(vp.height)}px`;
        uppgift = sidan.render({ canvas: c, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
        await /** @type {any} */ (uppgift).promise;
      } catch (e) {
        // Ett avbrott är vår egen ändring (ny skala, ny sida), inget fel. Allt annat syns på sidan.
        if (kvar && !(e && typeof e === "object" && /** @type {any} */ (e).name === "RenderingCancelledException")) setFel(true);
      }
    })();
    return () => {
      kvar = false;
      uppgift?.cancel();
    };
    // `yta` läses som två tal, så att ett nytt objekt med samma mått inte ritar om.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dokument, nr, skala, ytaB, ytaH]);
  const sprak = useOpsSprak();
  if (fel) return <p role="alert" data-pdf-sidfel={nr} className="m-0 bg-surface p-4 text-etikett text-danger">{ordet(ORD_PDFVISNING, "felSida", sprak).replace("{nr}", String(nr))}</p>;
  return <canvas ref={canvas} {...{ [mark]: nr }} role="img" aria-label={etikett} className="block bg-papper" />;
}

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_PDFVISNING = {
  etikett: { sv: "PDF: {namn}", en: "PDF: {namn}" },
  vyEtikett: { sv: "PDF i helt fönster: {namn}", en: "PDF, full window: {namn}" },
  presentationEtikett: { sv: "Helskärm: {namn}", en: "Full screen: {namn}" },
  presentation: { sv: "helskärm", en: "full screen" },
  verktyg: { sv: "Dokumentet", en: "Document" },
  sida: { sv: "Sida {nr} av {antal}", en: "Page {nr} of {antal}" },
  sidaEtikett: { sv: "Sida {nr}", en: "Page {nr}" },
  // ⛔ HELSKÄRM, INTE PRESENTERA (0.196.0). CP 2026-11-06: "Presentera är ett konstigt ord i sammanhanget." Knappen gör sidan stor, det är det den heter.
  helskarm: { sv: "Helskärm", en: "Full screen" },
  laddaNed: { sv: "Ladda ned", en: "Download" },
  fonster: { sv: "Öppna i eget fönster", en: "Open in a new window" },
  stang: { sv: "Stäng", en: "Close" },
  avsluta: { sv: "Stäng helskärm", en: "Close full screen" },
  hamtar: { sv: "Hämtar dokumentet.", en: "Fetching the document." },
  tom: { sv: "PDF:en har inga sidor.", en: "The PDF has no pages." },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
  felSaknas: { sv: "Visningen för PDF är inte installerad i den här appen.", en: "The PDF viewer is not installed in this app." },
  felImport: { sv: "Visningen för PDF gick inte att hämta. Kontrollera nätet och försök igen.", en: "The PDF viewer could not be loaded. Check the network and try again." },
  felHamta: { sv: "Dokumentet gick inte att hämta.", en: "The document could not be fetched." },
  felLosenord: { sv: "PDF:en är skyddad med lösenord och kan inte visas här.", en: "The PDF is password protected and cannot be shown here." },
  felTrasig: { sv: "Filen är ingen läsbar PDF.", en: "The file is not a readable PDF." },
  felAnnat: { sv: "PDF:en gick inte att visa.", en: "The PDF could not be shown." },
  felSida: { sv: "Sida {nr} gick inte att rita.", en: "Page {nr} could not be drawn." },
};
