import { useEffect, useMemo, useRef } from "react";
import { OpsButton } from "./OpsButton.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { HtmlRuta, ORD_HTMLDOKUMENT, useHamtatHtml } from "./OpsHtmlDokument.jsx";
import { HTML_UTSKRIFTSMEDDELANDE, byggSrcdoc } from "../lib/htmldokument.js";
import { ordet } from "../lib/ord.js";
import { skaparensNamn } from "../lib/skapare.js";

// ⛔ EN EGEN MODUL (0.159.0), INTE EN DEL AV `OpsHtmlDokument.jsx`: bara en sida som ritar ett dokument i hela fönstret behöver den, och den ska inte ligga i den delen av en apps paket som laddas före första vyn.
// Rutan (`HtmlRuta`), hämtningen (`useHamtatHtml`) och orden (`ORD_HTMLDOKUMENT`) är DESAMMA som detaljens och delas därifrån: sandlådan sätts på ett ställe.

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
