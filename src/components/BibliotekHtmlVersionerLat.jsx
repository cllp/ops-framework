import { Component, Suspense, lazy } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";

/**
 * Versionsraden för ett HTML-dokument, inläst när den behövs (0.159.0).
 *
 * ══ ⛔ VARFÖR RADEN LIGGER BAKOM EN DYNAMISK IMPORT ═══════════════════════════════════════════════════════════════════
 *
 * `BibliotekHtmlVersioner` (cirka 420 rader) låg i 0.158.0 statiskt i `OpsBibliotek`, och lade till cirka 4,2 kB gzip i en apps JavaScript FÖRE första vyn (mätt, se CHANGELOG 0.159.0).
 * Raden ritas bara i detaljen för ett `text/html`-dokument, och den är hopfälld: de flesta som öppnar Biblioteket ser den aldrig. Koden hämtas därför först när en sådan detalj ritas.
 *
 * Paketet skriver EN FIL PER KÄLLMODUL och lämnar importerna mellan dem som importer (`scripts/build.mjs`), också den dynamiska: `import("./BibliotekHtmlVersioner.jsx")` blir
 * `import("./BibliotekHtmlVersioner.js")` i `dist`, och appens bundler gör modulen till en egen bit. Ingen ny export och ingen ny inställning i appen.
 *
 * ⛔ Medan modulen hämtas ritas en tom ruta med SAMMA ram och samma radhöjd som den hopfällda raden (samma klasser, och samma text-höjd: en hård blank i stället för orden), så att
 * innehållet under inte hoppar när raden kommer. Rutan är dold för skärmläsare och har ingen text: det är bråkdelen av en sekund, och en mening som blinkar förbi är värre än tystnad.
 * `check:skalyta` (avsnitt 59 (g)) mäter att rutan och raden är lika höga.
 *
 * ⛔ FELET SYNS (arbetsreglernas punkt 5). Går modulen inte att hämta (nätet föll, eller en ny version har lagts ut och den gamla biten finns inte längre) ritas en mening i stället för
 * raden, och inte ett kast som tar med sig hela Biblioteket. Ett nytt försök kräver att sidan laddas om, eftersom `lazy` minns ett misslyckande.
 */
const Versioner = lazy(() => import("./BibliotekHtmlVersioner.jsx").then((m) => ({ default: m.BibliotekHtmlVersioner })));

/**
 * @param {import("react").ComponentProps<typeof Versioner>} props Samma props som `BibliotekHtmlVersioner`.
 */
export function BibliotekHtmlVersionerLat(props) {
  const sprak = useOpsSprak();
  return (
    <Granser fel={<p role="alert" data-html-versioner-lasfel="" className="m-0 text-etikett text-danger wrap-anywhere">{ordet(ORD_HTMLVERSIONER_LAT, "lasfel", sprak)}</p>}>
      <Suspense fallback={<VersionsradVantar />}>
        <Versioner {...props} />
      </Suspense>
    </Granser>
  );
}

/** Den hopfällda radens ram och höjd, utan text. Klasserna är desamma som `OpsDisclosure` och raden ger sin summary. */
function VersionsradVantar() {
  return (
    <div data-html-versioner-vantar="" aria-hidden="true" className="min-w-0">
      <div className="rounded-lg border border-line bg-raised">
        <div className="flex min-h-11 items-center gap-3 p-4">
          <div className="min-w-0 flex-1 text-etikett">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
              <span className="font-medium">&nbsp;</span>
              <span className="text-meta">&nbsp;</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** En gräns som visar `fel` i stället för raden när modulen inte gick att hämta. */
class Granser extends Component {
  /** @param {{ children: import("react").ReactNode, fel: import("react").ReactNode }} props */
  constructor(props) {
    super(props);
    this.state = { fallit: false };
  }

  static getDerivedStateFromError() {
    return { fallit: true };
  }

  render() {
    return this.state.fallit ? this.props.fel : this.props.children;
  }
}

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_HTMLVERSIONER_LAT = {
  lasfel: { sv: "Versionsraden gick inte att läsa in. Ladda om sidan.", en: "The versions row could not be loaded. Reload the page." },
};
