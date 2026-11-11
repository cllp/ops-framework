import { cx } from "../lib/cx.js";
import { ordet } from "../lib/ord.js";
import { provatOmAppenRad } from "./OmAppenRad.jsx";

/**
 * Orden för märket på en publik sida (0.204.0). Länkens namn bodde förut i `ORD_OPSGASTSIDA` (`omAppenEtikett`, 0.195.0) och fanns inte på de delade sidorna. Gästens sida läser det härifrån, så att
 * de tre sidorna säger samma sak (regel 2), och kan fortfarande skriva över det med sin egen `ord`.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_PUBLIKMARKE = {
  omAppenEtikett: { sv: "Om {namn}, öppnas i en ny flik", en: "About {namn}, opens in a new tab" },
};

/**
 * Appens ordmärke i huvudet på en publik sida: gästens sida (`OpsGastSida`), en delad händelse (`OpsDeladHandelse`) och en delad post (`OpsDeladSida`).
 *
 * ══ ⛔ ETT MÄRKE, TRE SIDOR (0.204.0, CP 2026-11-08: "Alla delningar. Kolla loggans storlek och kolla så att det ser samma ut med alla delningar och gästvy. VI måste ha enhetlighet.") ══
 *
 * Före 0.204.0 ritade bara gästens sida märket (`GastMarke` i `OpsGastSida`). De delade sidorna tog appens `huvud`, och appen skickade där sina fyrkantiga loggor med luft runt i en ruta på 32 px,
 * så att märket blev pyttelitet i en delning och stort på gästens sida, i samma huvud (`PublikHuvud`). Nu är märket en komponent, och sidorna tar samma prop `marke`.
 *
 * 0.190.0 ritade märket 40 px högt och 0.192.0 24 px högt, för att huvudet är orientering och sidans rubrik är rubriken. 0.215.1 ritar det 32 px högt. CP 2026-11-11 om en delad lista
 * på telefonen: "Är den fortfarande inte lagad?" och "Logotypen är liten...". Märket var rätt bild men cirka 100 x 24 px (appens bild, 1079 x 260; provets bild i exakt 4:1 mäts till 96 x 24), mindre än appens eget märke i toppraden (en ruta på 40 px).
 * 32 px ryms i huvudet (48 px, `h-12`) med 8 px luft över och under, och appens bild blir cirka 133 x 32 px (provets 128 x 32). Högst `--logo-bredd` (180 px) brett.
 *
 * ⛔ BILDEN ÄR ETT BRETT, TÄTT BESKURET ORDMÄRKE, INTE FYRKANTIG KONST MED LUFT (granskningen av PR 524). Den första formen tog appens fyrkantiga bilder, ritade dem 64 px
 * höga och beskar uppe och nere som inloggningen. Märket blev ändå cirka 50 x 22 px i appens montage, eftersom en fyrkant med luft runt inte kan bli bredare än sin höjd i
 * en ruta som är 40 px hög. CP:s klagomål var just att loggan var "typ obefintligt liten". Nu fyller bilden rutans höjd, bredden följer bildens form (appens bild blir
 * cirka 133 x 32 px), och ingenting beskärs: `object-contain` och `object-left` håller hela märket synligt och mot vänsterkanten. En bild per tema, som i inloggningen.
 *
 * ⛔ MED `lank` ÄR MÄRKET EN LÄNK TILL APPENS EGEN SIDA, I EN NY FLIK (0.195.0), så att besökarens session eller delning ligger kvar där den var. Länkens namn säger vart den går och att den
 * öppnar en ny flik (`etikett`); bildens alternativtext hade bara sagt appens namn.
 *
 * ⛔ DATAMÄRKENA ÄR PER SIDA (`sida`: `data-gast-marke`, `data-dh-marke`, `data-delad-marke`, och `-lank` på länken), som `PublikHuvud`, eftersom appar och prov läser dem. `data-publik-marke`
 * står på alla tre, så att en mätning kan jämföra dem utan att känna sidan.
 *
 * @param {{ marke: { ljus: string, mork: string, namn: string }, lank?: { href: string, etikett: string } | null, sida: "gast" | "dh" | "delad", komponent: string }} props
 *   `komponent` är sidans namn i felet, så att ett trasigt `marke` pekar på den prop som var fel.
 */
export function PublikMarke({ marke, lank = null, sida, komponent }) {
  if (!marke || typeof marke.ljus !== "string" || typeof marke.mork !== "string" || typeof marke.namn !== "string" || !marke.namn.trim()) {
    throw new Error(`${komponent}: marke är { ljus, mork, namn }: en bild per tema och appens namn som alternativtext.`);
  }
  const bilder = [["ljus", marke.ljus, "mix-blend-multiply"], ["mork", marke.mork, ""]].map(([tema, src, extra]) => (
    <img key={tema} src={src} alt={tema === "ljus" && !lank ? marke.namn : ""} aria-hidden={tema === "ljus" && !lank ? undefined : true} className={cx(tema === "ljus" ? "ops-ordmarke-ljus" : "ops-ordmarke-mork", "h-full w-auto max-w-full object-contain object-left", extra)} />
  ));
  if (lank) {
    return (
      <a
        href={lank.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={lank.etikett}
        {...{ "data-publik-marke": "", [`data-${sida}-marke`]: "", [`data-${sida}-marke-lank`]: "" }}
        className={PUBLIK_MARKE_KLASS.lank}
      >
        {bilder}
      </a>
    );
  }
  return (
    <span {...{ "data-publik-marke": "", [`data-${sida}-marke`]: "" }} className={PUBLIK_MARKE_KLASS.bild}>
      {bilder}
    </span>
  );
}

/**
 * Länken för märket på en delad sida, ur samma `omAppen` som sista raden (`OmAppenRad`) och prövad på samma sätt: bara en https-adress, annars kastar den. `null` utan `omAppen`.
 * @param {unknown} omAppen
 * @param {string} sprak
 * @returns {{ href: string, etikett: string } | null}
 */
export function publikMarkeLank(omAppen, sprak) {
  const appen = provatOmAppenRad(omAppen);
  return appen ? { href: appen.href, etikett: ordet(ORD_PUBLIKMARKE, "omAppenEtikett", sprak).replace("{namn}", appen.namn) } : null;
}

/**
 * Märkets ruta, en gång. 32 px hög (`h-8`, 0.215.1) och högst `--logo-bredd` bred; länken har fokusringen.
 */
export const PUBLIK_MARKE_KLASS = Object.freeze({
  bild: "flex h-8 max-w-(--logo-bredd) shrink-0 items-center",
  lank: "flex h-8 max-w-(--logo-bredd) shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
});
