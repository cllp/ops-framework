import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHelskarm } from "./useHelskarm.js";
import { DokumentKnapp, Dokumentrad } from "./Dokumentrad.jsx";
import { OpsGastFelrad } from "./OpsGastFelrad.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { PDF_TOUCH_ACTION, usePdfZoom } from "./pdfZoom.js";
import { IKON_FOR } from "./ikonlexikon.js";
import { ExternLankIkon } from "./icons.jsx";
import { filadressFel } from "../lib/bibliotek.js";
import { anpassadSkala } from "../lib/htmlruta.js";
import { cx } from "../lib/cx.js";
import { ORD_HELSKARM } from "../lib/helskarmord.js";
import { ordet } from "../lib/ord.js";
import { PDFJS_SAKNAS, laddaPdfjs, oppnaPdf, pdfFelsort } from "../lib/pdfjs.js";
import { SIDNUMMER_MS, bytSida, klickSteg, skarmSkala, svepSteg, tangentIPresentation } from "../lib/pdfpresentation.js";
import { ritmatt, skapaCanvasbudget, skapaRitko, svepTillats } from "../lib/pdfzoom.js";
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
 * 6. ⛔ ZOOMEN (0.235.0, CP 2026-11-16: "Det går inte att zooma i pdf:er i biblioteket. Det vore bra om det funkade."): nyp med två fingrar (1x till 4x av hel bredd), dubbeltryck växlar mellan hel bredd och 2x,
 *    inzoomad drar ett finger sidan åt alla håll, och i datorn −, + och Anpassa till bredd i raden samt Ctrl- eller Cmd+hjul. Samma zoom finns i helskärmen, där svepet byter sida bara vid hel sida.
 *    Sidorna ritas om i den nya skalan när zoomen stått still, och ingen canvas blir större än taket för pixlar. Reglerna i `lib/pdfzoom.js`, gesterna i `usePdfZoom`.
 *    ⛔ Bara sidor i vyn eller nära den har en canvas, och ritningarna köas, en i taget (`skapaRitko`). En sida som lämnar området släpper sin canvas (granskningen av 0.235.0). Alla canvasar i vyn
 *    delar en minnesbudget (`skapaCanvasbudget`), också medan en sida ritas om, och kön har en tidsgräns (den andra granskningen av 0.235.0).
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

  // ── Zoomen (0.235.0): faktorn räknas från hel bredd (`bas`, sidan anpassad till rutans bredd, som förvalet var förut). Gesterna och knapparna i `usePdfZoom` ─────────────────────────
  const zoom = usePdfZoom({ sidval: "[data-pdf-sidram]" });
  // En kö och en minnesbudget för hela vyn: den rullande vyn och helskärmen ritar aldrig samtidigt, och delar på samma minne (`skapaRitko`, `skapaCanvasbudget`).
  const rit = useMemo(() => ({ ko: skapaRitko(), budget: skapaCanvasbudget() }), []);
  const rulla = zoom.el;
  const sidbredd = klar?.sida1.bredd ?? 0;
  // Luften runt sidorna finns bara i helfönstret. I detaljen står sidan kant i kant med raden ovanför, som HTML-rutan.
  const kant = helfonster ? KANT : 0;
  const [bas, setBas] = useState(1);
  useEffect(() => {
    const el = rulla;
    if (!el || !sidbredd) return undefined;
    const matt = () => {
      const synlig = el.clientWidth - 2 * kant;
      if (synlig > 0) setBas(anpassadSkala({ innehall: sidbredd, synlig }));
    };
    matt();
    if (typeof ResizeObserver !== "function") return undefined;
    const ro = new ResizeObserver(matt);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rulla, sidbredd, kant]);

  // ── Presentationen ──────────────────────────────────────────────────────────────────────────────────────────────────
  const yta = useRef(/** @type {HTMLElement | null} */ (null));
  // ⛔ Helskärmen och dess reserv bor i `useHelskarm` (0.234.0), samma som kartans (regel 2).
  const { lage: presenterar, oppna: oppnaHelskarm, avsluta } = useHelskarm(yta);
  const [visaNummer, setVisaNummer] = useState(false);
  const nummerKlocka = useRef(/** @type {ReturnType<typeof setTimeout> | undefined} */ (undefined));
  const visaSidnummer = useCallback(() => {
    setVisaNummer(true);
    clearTimeout(nummerKlocka.current);
    nummerKlocka.current = setTimeout(() => setVisaNummer(false), SIDNUMMER_MS);
  }, []);
  useEffect(() => () => clearTimeout(nummerKlocka.current), []);

  // Helskärmens egen zoom, från sidan anpassad till skärmen. Ett ensamt tryck med fingret byter sida (som klicket), men först när ett andra tryck inte kom: två tryck är ett dubbeltryck och zoomar.
  const tryckRef = useRef(/** @type {(p: { x: number, y: number }) => void} */ (() => {}));
  const presZoom = usePdfZoom({ onTryck: (p) => tryckRef.current(p), sidval: "[data-pdf-presentationssida]" });
  const nollstallPres = presZoom.nollstall;
  const stegTill = useCallback(
    (/** @type {number | "forsta" | "sista"} */ steg) => {
      setSida((nu) => (steg === "forsta" ? 1 : steg === "sista" ? Math.max(1, antal) : bytSida(nu, antal, steg)));
      // En ny sida börjar anpassad till skärmen.
      nollstallPres();
      visaSidnummer();
    },
    [antal, visaSidnummer, nollstallPres],
  );
  // ⛔ INZOOMAD BYTER ETT TRYCK ELLER KLICK INTE SIDA: fingret är på sidan för att läsa eller dra den. Ett dubbeltryck går tillbaka till hel sida.
  tryckRef.current = (p) => {
    if (!svepTillats(presZoom.faktor)) return;
    stegTill(klickSteg(p.x, presZoom.el?.clientWidth ?? 0));
  };

  // ⛔ NÄR HELSKÄRMEN STÄNGS BÖRJAR DEN RULLANDE VYN PÅ HEL BREDD (granskningen av 0.235.0, nit 5): vyn monteras om, och en zoom från före helskärmen hade stått kvar utan sin rullning.
  const nollstallVy = zoom.nollstall;
  const varPresentation = useRef(presenterar);
  useEffect(() => {
    if (varPresentation.current && !presenterar) nollstallVy();
    varPresentation.current = presenterar;
  }, [presenterar, nollstallVy]);

  // ⛔ WEBBLÄSARENS EGET SVAR, som `OpsFullscreenToggle`, i `useHelskarm`: helskärm där den finns, annars fyller presentationen fönstret.
  function presentera() {
    nollstallPres();
    oppnaHelskarm();
    visaSidnummer();
  }

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
    // Fönsterläget: att sidan bakom inte rullar sköter `useHelskarm`.
    return () => {
      document.removeEventListener("keydown", tangent);
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
          // Ett tryck med fingret byter sida i `usePdfZoom` (efter att ett dubbeltryck uteslutits). Webbläsarens klick efter trycket räknas inte en gång till.
          if (Date.now() - presZoom.beroring.current < BERORING_KLICK_MS) return;
          if (!svepTillats(presZoom.faktor)) return;
          const r = e.currentTarget.getBoundingClientRect();
          stegTill(klickSteg(e.clientX - r.left, r.width));
        }}
        onTouchStart={(e) => {
          // Bara ett finger kan svepa. Kommer ett andra är det en nypning, och svepet glöms.
          const t = e.touches.length === 1 ? e.touches[0] : null;
          svep.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const fran = svep.current;
          const t = e.changedTouches[0];
          svep.current = null;
          if (!fran || !t || e.touches.length > 0) return;
          // ⛔ SVEPET BYTER SIDA BARA VID HEL SIDA (0.235.0). Inzoomad drar fingret sidan, och ett drag får inte byta sida under fingret.
          if (!svepTillats(presZoom.faktor)) return;
          const steg = svepSteg(t.clientX - fran.x, t.clientY - fran.y);
          if (steg !== 0) {
            svepte.current = true;
            stegTill(steg);
          }
        }}
      >
        <div ref={presZoom.ruta} data-pdf-presentationsyta="" data-pdf-zoom={presZoom.faktor} className="absolute inset-0 overflow-auto" style={{ touchAction: PDF_TOUCH_ACTION }}>
          <div className="flex min-h-full w-max min-w-full items-center justify-center">
            <Sida key={`p${sida}`} dokument={klar.dokument} nr={sida} yta={skarm} faktor={presZoom.faktor} ritad={presZoom.ritad} rit={rit} fokus={presZoom.fokus} mark="data-pdf-presentationssida" etikett={o("sidaEtikett").replace("{nr}", String(sida))} />
          </div>
        </div>
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
    <Dokumentrad mark="data-pdf-rad" etikett={o("verktyg")} zoom={klar ? zoom.rad : null} sprak={sprak} sida={antal > 0 ? { nr: sida, antal, etikett: sidtext } : null}>
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
        // ⛔ `touch-action: pan-x pan-y` (0.235.0): ett finger rullar i båda led (inzoomad drar det sidan), och nypningen och dubbeltrycket går till zoomen och inte till webbläsarens zoom av hela appen.
        <div
          ref={zoom.ruta}
          data-pdf-sidor=""
          data-pdf-zoom={zoom.faktor}
          className={cx("min-w-0 overflow-auto", helfonster ? "min-h-0 flex-1" : "h-[70vh] min-h-72")}
          style={{ padding: kant, touchAction: PDF_TOUCH_ACTION }}
        >
          <div className="mx-auto flex w-max min-w-full flex-col items-center gap-3">
            {Array.from({ length: antal }, (_, i) => (
              <SynligSida key={`${dokumentNyckel(/** @type {any} */ (klar).dokument)}-${i + 1}`} dokument={/** @type {any} */ (klar).dokument} nr={i + 1} skala={bas} faktor={zoom.faktor} ritad={zoom.ritad} rit={rit} fokus={zoom.fokus} sida1={/** @type {any} */ (klar).sida1} rot={rulla} onSyns={setSida} etikett={o("sidaEtikett").replace("{nr}", String(i + 1))} />
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
/** Ett klick så här snart efter en beröring är webbläsarens eget, efter ett tryck med fingret, och byter inte sida en gång till. Se `usePdfZoom`. */
const BERORING_KLICK_MS = 800;

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
 * En sida i den rullande vyn: sidan medan den är i vyn eller nära den, annars en platshållare i sidans storlek. Utan `IntersectionObserver` ritas den direkt.
 *
 * ⛔ EN SIDA SOM LÄMNAR OMRÅDET SLÄPPER SIN CANVAS (granskningen av 0.235.0). Förut stod en sida kvar ritad när den en gång syntes, och efter en zoom ritades varje sådan sida om i den nya skalan: vid 4x upp
 * till 64 MB per sida. Nu avmonteras sidan när observatören säger att den lämnat området (`Sida` släpper canvasen), och platshållaren tar sidans egen storlek, som sidan rapporterade (`onGrund`).
 *
 * ⛔ OMRÅDET FÖLJER ZOOMEN (den andra granskningen av 0.235.0): tre skärmhöjder före och efter vid hel bredd, en vid 2x och mer. Vid hel bredd är en sida liten och ett snabbt svep passerar många, och med
 * en skärmhöjd syntes vita sidor medan de ritades. Inzoomad är en sida stor, och fler sidor nära vyn hade bara delat på samma budget (`skapaCanvasbudget`), som gäller oavsett hur många de är.
 *
 * @param {{ dokument: any, nr: number, skala: number, faktor: number, ritad: number, rit: Rit, fokus: { current: Element | null }, sida1: { bredd: number, hojd: number }, rot: HTMLElement | null, onSyns: (nr: number) => void, etikett: string }} props
 */
function SynligSida({ dokument, nr, skala, faktor, ritad, rit, fokus, sida1, rot, onSyns, etikett }) {
  const ram = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [synlig, setSynlig] = useState(() => typeof IntersectionObserver !== "function");
  // Sidans egen storlek vid skala 1, när den är känd. Till dess sidan 1:s. (Byts dokumentet får sidan en ny nyckel, `dokumentNyckel`, och börjar om här.)
  const [grund, setGrund] = useState(sida1);
  const onSynsRef = useRef(onSyns);
  onSynsRef.current = onSyns;
  const marginal = faktor >= 2 ? "100% 0px" : "300% 0px";
  useEffect(() => {
    const el = ram.current;
    if (!el || typeof IntersectionObserver !== "function") return undefined;
    // ⛔ TVÅ OBSERVATÖRER, INTE EN. Den första ritar sidan när den är nära och släpper den när den inte längre är det. Den andra säger vilken sida som står mitt i rutan, för Sida x av y.
    // Med en observatör och marginalen räknades sidorna under som synliga också: andelen räknas mot den utökade ytan, och raden sade "Sida 3 av 3" när sidan 1 syntes (mätt i en telefon på 390 px).
    const nara = new IntersectionObserver((poster) => {
      const sista = poster[poster.length - 1];
      if (sista) setSynlig(sista.isIntersecting);
    }, { root: rot, rootMargin: marginal });
    const mitt = new IntersectionObserver((poster) => {
      if (poster.some((p) => p.isIntersecting)) onSynsRef.current(nr);
    }, { root: rot, rootMargin: "-50% 0px -50% 0px" });
    nara.observe(el);
    mitt.observe(el);
    return () => {
      nara.disconnect();
      mitt.disconnect();
    };
  }, [nr, rot, marginal]);
  // Platshållaren följer zoomen, så att rullningen och sidorna under har rätt läge innan sidan ritats.
  const reserv = { bredd: grund.bredd * skala * faktor, hojd: grund.hojd * skala * faktor };
  return (
    <div ref={ram} data-pdf-sidram={nr} style={synlig ? undefined : { width: Math.floor(reserv.bredd), height: Math.floor(reserv.hojd), background: "white" }}>
      {synlig ? <Sida dokument={dokument} nr={nr} skala={skala} faktor={faktor} ritad={ritad} rit={rit} fokus={fokus} reserv={reserv} onGrund={setGrund} mark="data-pdf-sida-canvas" etikett={etikett} /> : null}
    </div>
  );
}

/**
 * Vyns kö och minnesbudget, delade av den rullande vyn och helskärmen. Se `skapaRitko` och `skapaCanvasbudget` i `lib/pdfzoom.js`.
 * @typedef {{ ko: ReturnType<typeof skapaRitko>, budget: ReturnType<typeof skapaCanvasbudget> }} Rit
 */

/**
 * En sida, i skärmens upplösning. Antingen med en skala (rutan, där skalan är hel bredd) eller anpassad till en yta (helskärmen). `faktor` är zoomen ovanpå den.
 *
 * ⛔ RAMEN FÖLJER ZOOMEN, BILDEN FÖLJER `ritad` (0.235.0). Ramen får sin storlek av `faktor` i varje ritning, och canvasen fyller ramen: under en nypning sträcks den ritade bilden med CSS, utan ny ritning.
 * Först när zoomen stått still (`ritad`, se `usePdfZoom`) ritas sidan om i den nya skalan.
 *
 * ⛔ TVÅ RITNINGAR SKRIVER ALDRIG PÅ SAMMA CANVAS, OCH PÅGÅR ALDRIG SAMTIDIGT. Varje ritning får en egen canvas, som ersätter den förra i ramen först när den är klar (ingen vit blinkning medan nästa ritas).
 * Ritningen läggs i vyns kö (`rit.ko`), som kör en i taget. En ny skala stryker en ritning som väntar och avbryter en som pågår (`cancel`), och kön går vidare först när den avbrutna har lagt sig, eller efter
 * kön tidsgräns. Sidan under fingret eller pekaren efter en zoom (`fokus`, ur `usePdfZoom`) ritas först.
 *
 * ⛔ MINNET (`rit.budget`, den andra granskningen av 0.235.0): en canvas blir aldrig större än budgeten delad med sidorna nära vyn plus en, och aldrig större än det som är kvar av budgeten. Räcker det
 * inte släpper sidan sin gamla canvas innan den nya skapas, och då syns platshållaren medan sidan ritas. Summan av vyns levande canvasar går aldrig över budgeten, inte heller under en omritning.
 *
 * ⛔ FEL SYNS (regel 5): ett fel var som helst i ritningen, också i måtten före den (`getViewport`, `ritmatt`), och en ritning som slår i kön tidsgräns, ger sidans felrad.
 *
 * @param {{ dokument: any, nr: number, skala?: number, yta?: { bredd: number, hojd: number }, faktor?: number, ritad?: number, rit: Rit, fokus?: { current: Element | null }, reserv?: { bredd: number, hojd: number }, onGrund?: (g: { bredd: number, hojd: number }) => void, mark: string, etikett: string }} props
 */
function Sida({ dokument, nr, skala, yta, faktor = 1, ritad = 1, rit, fokus, reserv, onGrund, mark, etikett }) {
  const ram = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [grund, setGrund] = useState(/** @type {{ sidan: any, bredd: number, hojd: number } | null} */ (null));
  const [fel, setFel] = useState(false);
  const onGrundRef = useRef(onGrund);
  onGrundRef.current = onGrund;
  const fokusRef = useRef(fokus);
  fokusRef.current = fokus;

  // Sidan räknas som nära vyn medan den är monterad: taket per canvas delas mellan sidorna (`skapaCanvasbudget`).
  useEffect(() => rit.budget.registrera(), [rit]);

  useEffect(() => {
    let kvar = true;
    setFel(false);
    setGrund(null);
    Promise.resolve()
      .then(() => dokument.getPage(nr))
      .then((sidan) => {
        if (!kvar) return;
        const vp = sidan.getViewport({ scale: CSS_PER_PUNKT });
        setGrund({ sidan, bredd: vp.width, hojd: vp.height });
        onGrundRef.current?.({ bredd: vp.width, hojd: vp.height });
      })
      .catch(() => {
        if (kvar) setFel(true);
      });
    return () => {
      kvar = false;
    };
  }, [dokument, nr]);

  const ytaB = yta?.bredd ?? 0;
  const ytaH = yta?.hojd ?? 0;
  const s0 = grund ? (yta ? skarmSkala({ bredd: grund.bredd, hojd: grund.hojd }, { bredd: ytaB, hojd: ytaH }) : (skala ?? 1)) : 0;
  const ritskala = s0 * ritad;

  useEffect(() => {
    const box = ram.current;
    if (!grund || !box || !(ritskala > 0)) return undefined;
    let kvar = true;
    /** @type {{ cancel: () => void, promise: Promise<unknown> } | null} */
    let uppgift = null;
    const { budget } = rit;
    const avbrott = (/** @type {unknown} */ e) => !!e && typeof e === "object" && /** @type {any} */ (e).name === "RenderingCancelledException";
    const f = fokusRef.current?.current ?? null;
    const forst = !!f && (f === box || f.contains(box));
    const stryk = rit.ko.lagg(
      async () => {
        if (!kvar) return;
        /** @type {HTMLCanvasElement | null} */
        let c = null;
        try {
          const vp = grund.sidan.getViewport({ scale: CSS_PER_PUNKT * ritskala });
          const dpr = typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
          let m = ritmatt(vp.width, vp.height, dpr, budget.tak());
          if (m.bredd * m.hojd > budget.ledigt()) {
            // Budgeten räcker inte medan den gamla canvasen finns kvar: den släpps först, och platshållaren syns medan sidan ritas.
            box.querySelectorAll("canvas").forEach((g) => budget.slapp(g));
            m = ritmatt(vp.width, vp.height, dpr, Math.min(budget.tak(), budget.ledigt()));
          }
          c = document.createElement("canvas");
          c.width = m.bredd;
          c.height = m.hojd;
          budget.lagg(c);
          c.setAttribute("aria-hidden", "true");
          c.setAttribute("data-pdf-canvas", String(nr));
          c.className = "block size-full";
          uppgift = grund.sidan.render({ canvas: c, viewport: vp, transform: m.k !== 1 ? [m.k, 0, 0, m.k, 0, 0] : undefined });
          await /** @type {any} */ (uppgift).promise;
        } catch (e) {
          if (c) budget.slapp(c);
          // Ett avbrott är vår egen ändring (ny skala, ny sida, sidan lämnade vyn), inget fel. Allt annat syns på sidan.
          if (kvar && !avbrott(e)) setFel(true);
          return;
        }
        if (!kvar) return budget.slapp(c);
        box.querySelectorAll("canvas").forEach((g) => budget.slapp(g));
        box.replaceChildren(c);
      },
      {
        forst,
        // Kön gick vidare utan den här ritningen (`skapaRitko`): den avbryts, och sidan säger att den inte gick att rita.
        onTidsgrans: () => {
          /** @type {any} */ (uppgift)?.cancel();
          if (kvar) setFel(true);
        },
      },
    );
    return () => {
      kvar = false;
      stryk();
      /** @type {any} */ (uppgift)?.cancel();
    };
  }, [grund, ritskala, nr, rit]);

  // Canvasen släpps när sidan lämnas, också när den lämnar vyn.
  useEffect(() => {
    const box = ram.current;
    const { budget } = rit;
    return () => box?.querySelectorAll("canvas").forEach((g) => budget.slapp(g));
  }, [rit]);

  const sprak = useOpsSprak();
  if (fel) return <p role="alert" data-pdf-sidfel={nr} className="m-0 bg-surface p-4 text-etikett text-danger">{ordet(ORD_PDFVISNING, "felSida", sprak).replace("{nr}", String(nr))}</p>;
  const storlek = grund ? { bredd: grund.bredd * s0 * faktor, hojd: grund.hojd * s0 * faktor } : reserv;
  return (
    <div
      ref={ram}
      {...{ [mark]: nr }}
      role="img"
      aria-label={etikett}
      className="block shrink-0 bg-papper"
      style={storlek ? { width: Math.floor(storlek.bredd), height: Math.floor(storlek.hojd) } : undefined}
    />
  );
}

/** Ett nummer per dokument, i nycklarna för sidorna: en annan PDF i samma vy ger nya sidor, med egna platshållare. @type {WeakMap<object, number>} */
const DOKUMENT_NR = new WeakMap();
let nastaDokumentNr = 0;
/** @param {object} dokument */
function dokumentNyckel(dokument) {
  let nr = DOKUMENT_NR.get(dokument);
  if (nr === undefined) {
    nastaDokumentNr += 1;
    nr = nastaDokumentNr;
    DOKUMENT_NR.set(dokument, nr);
  }
  return nr;
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
  // ⛔ HELSKÄRM, INTE PRESENTERA (0.196.0). Orden bor i `ORD_HELSKARM` sedan 0.234.0, samma som kartans (regel 2).
  helskarm: ORD_HELSKARM.helskarm,
  laddaNed: { sv: "Ladda ned", en: "Download" },
  fonster: { sv: "Öppna i eget fönster", en: "Open in a new window" },
  stang: { sv: "Stäng", en: "Close" },
  avsluta: ORD_HELSKARM.avsluta,
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
