import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { OpsButton } from "./OpsButton.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { avkodaTextfil, filadressFel } from "../lib/bibliotek.js";
import { HTML_SANDBOX, HTML_UTSKRIFTSMEDDELANDE, byggSrcdoc } from "../lib/htmldokument.js";
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
 */
export function OpsHtmlDokument({ html, namn, skapadAv }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_HTMLDOKUMENT} */ k) => ordet(ORD_HTMLDOKUMENT, k, sprak);
  const ram = useRef(/** @type {HTMLIFrameElement | null} */ (null));
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
        className="block h-[70vh] min-h-72 w-full rounded-lg border border-line bg-surface"
      />
      <div className="flex flex-wrap items-center gap-3">
        <OpsButton variant="secondary" size="sm" data-html-dokument-pdf="" onClick={skrivUt}>
          {o("pdf")}
        </OpsButton>
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
 */
export function OpsHtmlDokumentHamtat({ hamta, sokvag, namn, skapadAv }) {
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
  return <OpsHtmlDokument html={lage.html} namn={namn} skapadAv={skapadAv} />;
}

/**
 * Dokumentet i HELA fönstret (0.159.0, CP 2026-10-30: "de skulle gå att öppna direkt i ett fönster. Inte ladda ner så.").
 *
 * ══ ⛔ SAMMA RUTA, ANNAN PLATS ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Vyn är den avspärrade rutan (`HtmlRuta`, `sandbox="allow-scripts allow-modals"`, `srcdoc` ur texten som hämtats med inloggningen) och ingenting annat: ingen `blob:`-adress, ingen `data:`-adress, ingen adress till filen och
 * ingen `allow-same-origin`. En blob- eller data-adress som öppnas i ett eget fönster ritas på appens ursprung, och dokumentets kod körs då med appens inloggning. Resonemanget står i `lib/htmldokument.js`; det enda som är nytt
 * här är att rutan fyller fönstret. Vyn sätter sig själv i hela fönstrets höjd (`h-dvh`): den hör hemma på en sida utan skal, och appen ritar den så.
 *
 * ⛔ DEN SMALA RADEN ÖVERST BÄR SAMMA MÄRKNING SOM RUTAN I DETALJEN: filens namn, vem som laddade upp den, och en mening om att innehållet kommer från filen och inte från appen. I ett helt fönster finns ingenting annat som visar var
 * appen slutar och dokumentet börjar, och ett ritat inloggningsformulär som ser ut som appens eget är precis det märkningen finns för. Knapparna (Spara som PDF och Stäng) ligger i raden och aldrig i dokumentet.
 *
 * ⛔ TOMHET OCH FEL SKRIVS UT, MED STÄNG KVAR. Hämtar den, misslyckas den eller är filen tom står det i fönstret, och raden med Stäng finns ändå: en vy utan väg ut är en återvändsgränd.
 *
 * @param {object} props
 * @param {(sokvag: string) => Promise<Blob>} props.hamta Filens byte med inloggningen (`hamtaFil`).
 * @param {string} props.sokvag
 * @param {string} props.namn Filens namn.
 * @param {unknown} [props.skapadAv] Den som laddade upp filen (postens `skapadAv`).
 * @param {() => void} [props.onStang] Stäng eller tillbaka. Utan den ritas ingen knapp (vyn som en sida bland andra).
 * @param {string} [props.stangEtikett] Knappens ord. Förval "Stäng".
 */
export function OpsHtmlVy({ hamta, sokvag, namn, skapadAv, onStang, stangEtikett }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_HTMLDOKUMENT} */ k) => ordet(ORD_HTMLDOKUMENT, k, sprak);
  const ram = useRef(/** @type {HTMLIFrameElement | null} */ (null));
  const lage = useHamtatHtml(hamta, sokvag);
  const html = lage.lage === "klar" ? lage.html : "";
  const srcDoc = useMemo(() => byggSrcdoc(html), [html]);
  const vem = skapadAv ? skaparensNamn(skapadAv, sprak) : "";
  const etikett = o("vyEtikett").replace("{namn}", namn);
  const visas = lage.lage === "klar" && html.trim() !== "";
  // ⛔ SIDRAMENS RESERVERADE RULLNINGSLIST GÄLLER INTE EN VY SOM FYLLER FÖNSTRET (mätt i `check-skalyta` avsnitt 60). Tokens ger `html` `scrollbar-gutter: stable`, så att innehåll inte hoppar i sidled när en sida får en rullningslist.
  // Vyn har ingen: den är exakt fönstrets höjd, och dokumentet rullar i sin egen ruta. Utan raden stod en tom remsa (10 till 15 px i en webbläsare med vanliga rullningslister) längs högerkanten, och rutan var smalare än fönstret.
  // Värdet sätts när vyn visas och återställs när den lämnas, så att nästa sida får sidramens regel som förut.
  useEffect(() => {
    const rot = document.documentElement;
    const fore = rot.style.scrollbarGutter;
    rot.style.scrollbarGutter = "auto";
    return () => {
      rot.style.scrollbarGutter = fore;
    };
  }, []);
  function skrivUt() {
    // ⛔ "*" ÄR DET ENDA MÅLET SOM GÅR (se `OpsHtmlDokument`): rutan har ett anonymt ursprung, och meddelandet bär bara typen.
    ram.current?.contentWindow?.postMessage({ typ: HTML_UTSKRIFTSMEDDELANDE }, "*");
  }
  return (
    <section data-html-vy="" aria-label={etikett} className="flex h-dvh min-h-0 w-full min-w-0 flex-col bg-surface text-ink">
      <header data-html-vy-rad="" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-raised px-4 py-2">
        <div className="flex min-w-0 flex-1 basis-48 flex-col">
          <h1 data-html-vy-namn="" className="m-0 truncate text-etikett font-medium text-ink">{namn}</h1>
          {vem ? <p data-html-vy-av="" className="m-0 truncate text-meta text-ink-secondary">{o("uppladdatAv").replace("{vem}", vem)}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <OpsButton variant="secondary" size="sm" disabled={!visas} onClick={skrivUt}>
            {o("pdf")}
          </OpsButton>
          {onStang ? (
            <OpsButton variant="ghost" size="sm" onClick={onStang}>
              {stangEtikett || o("stang")}
            </OpsButton>
          ) : null}
        </div>
        <p data-html-vy-skydd="" className="m-0 basis-full text-meta text-ink-muted">{o("skydd")}</p>
      </header>
      {lage.lage === "hamtar" ? (
        <p role="status" data-html-vy-lage="hamtar" className="m-0 px-4 py-4 text-etikett text-ink-muted">{o("hamtar")}</p>
      ) : lage.lage === "fel" ? (
        <p role="alert" data-html-vy-lage="fel" className="m-0 px-4 py-4 text-etikett text-danger">{`${o("fel")} ${lage.fel}`}</p>
      ) : !visas ? (
        <p role="status" data-html-vy-lage="tom" className="m-0 px-4 py-4 text-etikett text-ink-muted">{o("tom")}</p>
      ) : (
        <HtmlRuta ref={ram} mark="data-html-vy-ruta" title={etikett} srcDoc={srcDoc} className="block min-h-0 w-full flex-1 border-0 bg-surface" />
      )}
    </section>
  );
}

/**
 * DEN ENDA RUTAN. Varje HTML-dokument som ritas i ramverket, i detaljen, i versionsraden och i helfönstervyn, går genom den här `iframe`, och `sandbox` sätts bara här.
 *
 * ⛔ EN ADRESS FINNS INTE: rutan har `srcdoc` och aldrig `src`. `allow-same-origin` finns inte. Ett prov (`htmldokument-helfonster.test.jsx`) läser bort källan och räknar att `<iframe` står på exakt ett ställe i `src`,
 * och att rutan som ritas har exakt `HTML_SANDBOX`, så att en andra väg in inte kan läggas till utan att provet blir rött.
 */
const HtmlRuta = forwardRef(
  /** @param {{ mark: string, title: string, srcDoc: string, className: string }} props @param {import("react").ForwardedRef<HTMLIFrameElement>} ref */
  ({ mark, title, srcDoc, className }, ref) => (
    <iframe
      ref={ref}
      {...{ [mark]: "" }}
      title={title}
      sandbox={HTML_SANDBOX}
      srcDoc={srcDoc}
      referrerPolicy="no-referrer"
      className={className}
      style={{ colorScheme: "light" }}
    />
  ),
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
function useHamtatHtml(hamta, sokvag) {
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
  pdfHjalp: { sv: "Öppnar webbläsarens utskrift. Välj Spara som PDF där.", en: "Opens the browser's print dialog. Choose Save as PDF there." },
  hamtar: { sv: "Hämtar dokumentet.", en: "Fetching the document." },
  fel: { sv: "Dokumentet gick inte att visa.", en: "The document could not be shown." },
  tom: { sv: "Dokumentet är tomt.", en: "The document is empty." },
};

/** @param {Blob} blob @returns {Promise<ArrayBuffer>} */
function blobBytes(blob) {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((los, fel) => {
    const l = new FileReader();
    l.onload = () => los(/** @type {ArrayBuffer} */ (l.result));
    l.onerror = () => fel(l.error ?? new Error("Filen gick inte att läsa."));
    l.readAsArrayBuffer(blob);
  });
}
