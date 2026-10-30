import { useEffect, useMemo, useRef, useState } from "react";
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
      <iframe
        ref={ram}
        data-html-dokument-ruta=""
        title={o("etikett").replace("{namn}", namn)}
        sandbox={HTML_SANDBOX}
        srcDoc={srcDoc}
        referrerPolicy="no-referrer"
        className="block h-[70vh] min-h-72 w-full rounded-lg border border-line bg-surface"
        style={{ colorScheme: "light" }}
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

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_HTMLDOKUMENT = {
  etikett: { sv: "HTML-dokument: {namn}", en: "HTML document: {namn}" },
  markningMed: {
    sv: "HTML-dokument: {namn}. Uppladdat av {vem}. Innehållet kommer från filen och körs i den här rutan, avskilt från appen. Skriv aldrig in ditt lösenord här.",
    en: "HTML document: {namn}. Uploaded by {vem}. The content comes from the file and runs in this box, separate from the app. Never enter your password here.",
  },
  markningUtan: {
    sv: "HTML-dokument: {namn}. Innehållet kommer från filen och körs i den här rutan, avskilt från appen. Skriv aldrig in ditt lösenord här.",
    en: "HTML document: {namn}. The content comes from the file and runs in this box, separate from the app. Never enter your password here.",
  },
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
