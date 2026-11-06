import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { OpsButton } from "./OpsButton.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { avkodaTextfil, filadressFel } from "../lib/bibliotek.js";
import { blobBytes } from "../lib/blobbytes.js";
import { HTML_SANDBOX, HTML_UTSKRIFTSMEDDELANDE, externLankAdress } from "../lib/htmldokument.js";
import { HTML_ZOOMMEDDELANDE, byggSrcdoc, tolkaRutmeddelande } from "../lib/htmlruta.js";
import { cx } from "../lib/cx.js";
import { ExternLankIkon } from "./icons.jsx";
import { HtmlZoomRad, useHtmlZoom } from "./htmlZoom.jsx";
import { ordet } from "../lib/ord.js";
import { skaparensNamn } from "../lib/skapare.js";

/**
 * Ett HTML-dokument ritat i en avspärrad ruta (0.156.0, cllp/ops-framework#472).
 *
 * ══ ⛔ VARFÖR RUTAN ÄR SÅ HÄR ═════════════════════════════════════════════════════════════════════════════════════════
 *
 * En HTML-fil kan köra kod, och CP har sagt ja till att den får göra det (interaktiva diagram och rapporter). Ritad i appens eget ursprung kunde koden läsa inloggningen hos den som öppnar filen och handla i hens namn.
 * Därför är rutan en `iframe` med `sandbox="allow-scripts allow-modals"` och inget annat (`HTML_SANDBOX`): utan `allow-same-origin` får den ett eget, anonymt ursprung och når varken appens inloggning, lagring eller fönster.
 * Innehållet ges som `srcdoc` ur texten som redan hämtats, aldrig som en adress. Hela resonemanget står i `lib/htmldokument.js`.
 *
 * ⛔ RUTAN ÄR MÄRKT med filens namn och vem som laddade upp den, och med en rad som säger att innehållet kommer från filen och inte från appen. Det är skyddet mot ett ritat inloggningsformulär som ser ut som appens eget.
 *
 * ⛔ SPARA SOM PDF ÄR WEBBLÄSARENS UTSKRIFT. Knappen skickar ett meddelande till rutan, vars skript (först i `srcdoc`) anropar `window.print()` bara för ett meddelande från fönstret som ritar rutan. PDF väljs i utskriftsrutan.
 * Hypotes, inte mätt på en iPhone: iOS Safari kan skriva ut hela sidan i stället för rutan.
 *
 * @param {object} props
 * @param {string} props.html Dokumentets text.
 * @param {string} props.namn Filens namn.
 * @param {unknown} [props.skapadAv] Den som laddade upp filen (postens `skapadAv`).
 * @param {string} [props.fonster] (0.192.0, #529) Adressen till helfönstervyn (`htmlVyAdress`). Med den står Öppna i eget fönster i verktygsraden, som en riktig länk i en ny flik.
 *
 * ⛔ ZOOMEN (0.192.0, cllp/ops-framework#529, CP 2026-11-06: "Zoomen måste finnas med i förhandstitt."): − , procenten och + i verktygsraden, Anpassa till bredd som förval, och Ctrl- eller Cmd+hjul när dokumentet
 * har fokus. Se `useHtmlZoom` och `lib/htmldokument.js`.
 */
export function OpsHtmlDokument({ html, namn, skapadAv, fonster }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_HTMLDOKUMENT} */ k) => ordet(ORD_HTMLDOKUMENT, k, sprak);
  const ram = useRef(/** @type {HTMLIFrameElement | null} */ (null));
  const zoom = useHtmlZoom();
  const srcDoc = useMemo(() => byggSrcdoc(html), [html]);
  const vem = skapadAv ? skaparensNamn(skapadAv, sprak) : "";
  const markning = (vem ? o("markningMed") : o("markningUtan")).replace("{namn}", namn).replace("{vem}", vem);
  function skrivUt() {
    // ⛔ "*" ÄR DET ENDA MÅLET SOM GÅR: rutan har ett anonymt ursprung. Meddelandet bär bara typen, inget hemligt.
    ram.current?.contentWindow?.postMessage({ typ: HTML_UTSKRIFTSMEDDELANDE }, "*");
  }
  return (
    <section data-html-dokument="" aria-label={o("etikett").replace("{namn}", namn)} className="flex min-w-0 flex-col gap-2">
      <p data-html-dokument-markning="" className="m-0 text-meta text-ink-secondary">
        {markning}
      </p>
      <HtmlRuta
        ref={ram}
        mark="data-html-dokument-ruta"
        title={o("etikett").replace("{namn}", namn)}
        srcDoc={srcDoc}
        zoom={zoom}
        className="block h-[70vh] min-h-72 w-full rounded-lg border border-line bg-surface"
      />
      <div data-html-dokument-verktyg="" className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <HtmlZoomRad zoom={zoom} sprak={sprak} />
        <OpsButton variant="secondary" size="sm" data-html-dokument-pdf="" onClick={skrivUt}>
          {o("pdf")}
        </OpsButton>
        {fonster ? (
          <span data-html-dokument-fonster="">
            <OpsButton variant="ghost" size="sm" href={fonster} newTab>
              {o("fonster")}
              <ExternLankIkon size={14} />
            </OpsButton>
          </span>
        ) : null}
        <span className="text-meta text-ink-muted">{o("pdfHjalp")}</span>
      </div>
    </section>
  );
}

/**
 * Hämtar ett HTML-dokuments byte (`hamta`, med inloggningen) och ritar det i rutan. Tomhet och fel skrivs ut.
 *
 * ⛔ FUNKTIONEN I EN REF, SÖKVÄGEN SOM BEROENDE, som textförhandsvisningen: en ny `hamta` vid varje rendering hade hämtat om dokumentet och blinkat.
 *
 * @param {object} props
 * @param {(sokvag: string) => Promise<Blob>} props.hamta
 * @param {string} props.sokvag
 * @param {string} props.namn
 * @param {unknown} [props.skapadAv]
 * @param {string} [props.fonster] Se `OpsHtmlDokument`.
 */
export function OpsHtmlDokumentHamtat({ hamta, sokvag, namn, skapadAv, fonster }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_HTMLDOKUMENT} */ k) => ordet(ORD_HTMLDOKUMENT, k, sprak);
  const lage = useHamtatHtml(hamta, sokvag);
  if (lage.lage === "hamtar") return <p role="status" data-html-dokument-lage="hamtar" className="m-0 text-etikett text-ink-muted">{o("hamtar")}</p>;
  if (lage.lage === "fel") {
    return (
      <p role="alert" data-html-dokument-lage="fel" className="m-0 text-etikett text-danger">
        {`${o("fel")} ${lage.fel}`}
      </p>
    );
  }
  if (lage.html.trim() === "") return <p role="status" data-html-dokument-lage="tom" className="m-0 text-etikett text-ink-muted">{o("tom")}</p>;
  return <OpsHtmlDokument html={lage.html} namn={namn} skapadAv={skapadAv} fonster={fonster} />;
}

/**
 * DEN ENDA RUTAN. Varje HTML-dokument som ritas i ramverket, i detaljen, i versionsraden och i helfönstervyn, går genom den här `iframe`, och `sandbox` sätts bara här.
 *
 * ⛔ EN ADRESS FINNS INTE: rutan har `srcdoc` och aldrig `src`. `allow-same-origin` finns inte. Ett prov (`htmldokument-helfonster.test.jsx`) läser bort källan och räknar att `<iframe` står på exakt ett ställe i `src`,
 * och att rutan som ritas har exakt `HTML_SANDBOX`, så att en andra väg in inte kan läggas till utan att provet blir rött.
 */
export const HtmlRuta = forwardRef(
  /** @param {{ mark: string, title: string, srcDoc: string, className: string, zoom?: import("./htmlZoom.jsx").HtmlZoom }} props @param {import("react").ForwardedRef<HTMLIFrameElement>} ref */
  ({ mark, title, srcDoc, className, zoom }, ref) => {
    const egen = useRef(/** @type {HTMLIFrameElement | null} */ (null));
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    // ⛔ EXTERNA LÄNKAR I DOKUMENTET (0.165.0): rutan får inte öppna fönster (`allow-popups` saknas), så dess länkskript (`HTML_LANKSKRIPT`) skickar adressen hit. Bara ett meddelande från JUST den här rutans
    // fönster räknas, och adressen prövas här (`externLankAdress`: http, https, mailto, tel). Fliken öppnas med `noopener`, så sidan når aldrig appens fönster.
    useEffect(() => {
      /** @param {MessageEvent} e */
      const ta = (e) => {
        if (!egen.current || e.source !== egen.current.contentWindow) return;
        const adress = externLankAdress(e.data);
        if (adress) {
          window.open(adress, "_blank", "noopener,noreferrer");
          return;
        }
        // ⛔ ZOOMENS MEDDELANDEN (0.192.0, #529): samma avsändarprov, och innehållet prövas (`tolkaRutmeddelande`). Ett dokument som själv skickar dem kan bara ändra sin egen zoom inom gränserna och ramen runt sin egen ruta.
        const m = tolkaRutmeddelande(e.data);
        if (m) zoomRef.current?.ta(m);
      };
      window.addEventListener("message", ta);
      return () => window.removeEventListener("message", ta);
    }, []);
    // Skalan till rutan när den ändras, och efter varje mått (ett omladdat dokument börjar på zoom 1). "*" av samma skäl som utskriften: rutan har ett anonymt ursprung, och meddelandet bär bara ett tal.
    const skala = zoom?.skala;
    const mattNr = zoom?.mattNr;
    useEffect(() => {
      if (skala === undefined) return;
      egen.current?.contentWindow?.postMessage({ typ: HTML_ZOOMMEDDELANDE, skala }, "*");
    }, [skala, mattNr]);
    return (
      <iframe
        ref={(el) => {
          egen.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        {...{ [mark]: "" }}
        title={title}
        sandbox={HTML_SANDBOX}
        srcDoc={srcDoc}
        referrerPolicy="no-referrer"
        data-html-fokus={zoom?.fokus ? "" : undefined}
        // ⛔ RAMEN SÄGER VAD HJULET ZOOMAR (CP: "Bara i dokumentet om dokumentet är i fokus."): med fokus zoomar Ctrl- eller Cmd+hjul dokumentet, utan fokus hela appen som förut.
        className={cx(className, zoom?.fokus && "outline-2 outline-offset-2 outline-accent")}
        style={{ colorScheme: "light" }}
      />
    );
  },
);
HtmlRuta.displayName = "HtmlRuta";

/**
 * Hämtar ett HTML-dokuments byte och avkodar dem. Delad av detaljens `OpsHtmlDokumentHamtat` och helfönstervyn `OpsHtmlVy`.
 *
 * ⛔ FUNKTIONEN I EN REF, SÖKVÄGEN SOM BEROENDE, som textförhandsvisningen: en ny `hamta` vid varje rendering hade hämtat om dokumentet och blinkat.
 *
 * @param {(sokvag: string) => Promise<Blob>} hamta
 * @param {string} sokvag
 * @returns {{ lage: "hamtar" } | { lage: "klar", html: string } | { lage: "fel", fel: string }}
 */
export function useHamtatHtml(hamta, sokvag) {
  const [lage, setLage] = useState(/** @type {{ lage: "hamtar" } | { lage: "klar", html: string } | { lage: "fel", fel: string }} */ ({ lage: "hamtar" }));
  const hamtaRef = useRef(hamta);
  hamtaRef.current = hamta;
  useEffect(() => {
    let kvar = true;
    setLage({ lage: "hamtar" });
    Promise.resolve()
      .then(() => hamtaRef.current(sokvag))
      .then(async (blob) => {
        const bytes = new Uint8Array(await blobBytes(blob));
        if (kvar) setLage({ lage: "klar", html: avkodaTextfil(bytes) });
      })
      .catch((e) => {
        if (kvar) setLage({ lage: "fel", fel: filadressFel(e) });
      });
    return () => {
      kvar = false;
    };
  }, [sokvag]);
  return lage;
}

/** Meningen som säger var dokumentet kommer ifrån. En sanning: märkningen i detaljen och raden i helfönstervyn bygger på samma ord. */
const SKYDD = {
  sv: "Innehållet kommer från filen och körs i den här rutan, avskilt från appen. Skriv aldrig in ditt lösenord här.",
  en: "The content comes from the file and runs in this box, separate from the app. Never enter your password here.",
};

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_HTMLDOKUMENT = {
  etikett: { sv: "HTML-dokument: {namn}", en: "HTML document: {namn}" },
  vyEtikett: { sv: "HTML-dokument i helt fönster: {namn}", en: "HTML document, full window: {namn}" },
  markningMed: {
    sv: `HTML-dokument: {namn}. Uppladdat av {vem}. ${SKYDD.sv}`,
    en: `HTML document: {namn}. Uploaded by {vem}. ${SKYDD.en}`,
  },
  markningUtan: {
    sv: `HTML-dokument: {namn}. ${SKYDD.sv}`,
    en: `HTML document: {namn}. ${SKYDD.en}`,
  },
  skydd: SKYDD,
  uppladdatAv: { sv: "Uppladdat av {vem}", en: "Uploaded by {vem}" },
  stang: { sv: "Stäng", en: "Close" },
  pdf: { sv: "Spara som PDF", en: "Save as PDF" },
  fonster: { sv: "Öppna i eget fönster", en: "Open in a new window" },
  pdfHjalp: { sv: "Öppnar webbläsarens utskrift. Välj Spara som PDF där.", en: "Opens the browser's print dialog. Choose Save as PDF there." },
  hamtar: { sv: "Hämtar dokumentet.", en: "Fetching the document." },
  fel: { sv: "Dokumentet gick inte att visa.", en: "The document could not be shown." },
  tom: { sv: "Dokumentet är tomt.", en: "The document is empty." },
};
