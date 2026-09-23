/**
 * Ikonerna primitiverna själva behöver, hämtade ur Lucide.
 *
 * ── ⛔ DEN HÄR FILEN INNEHÖLL TIDIGARE HANDRITADE SVG:er ───────────────────
 *
 * Motiveringen var att "ett ramverk som drar in ett helt ikonbibliotek för tre
 * pilar tvingar på alla konsumenter en dependency de inte bad om". **Premissen
 * var fel.** `lucide-react` är träd-skakbart: importerar man tolv ikoner
 * levereras tolv ikoner, inte biblioteket. Kostnaden är ett beroende, inte vikt,
 * och den skillnaden bär hela argumentet.
 *
 * Med premissen borta faller slutsatsen. Handritade SVG:er i Lucides form är en
 * halvmesyr: formspråket utan uppsättningen. Ramverket hade en egen chevron som
 * Lucide redan har, och varje app som ville ha en ikon utöver de fyra fick
 * installera Lucide ändå. Då finns två källor för samma streck, vilket är precis
 * den drift ramverket existerar för att stoppa. Det rapporterades som "finns
 * inga ikoner?".
 *
 * Nu är `lucide-react` en **peer dependency**, som React. Appen installerar den
 * en gång, och både ramverket och appen ritar ur samma uppsättning och samma
 * version.
 *
 * ⛔ Omslaget är kvar med flit, med svenska namn. Det gör att primitiverna
 * importerar från EN plats, så ett byte av ikonuppsättning blir en ändring i den
 * här filen i stället för i tjugo komponenter. Omslaget sätter också
 * `aria-hidden` en gång för alla: ikonen är dekor, betydelsen sitter i texten
 * bredvid eller i komponentens `aria-label`.
 */

import { ArrowDownUp, Check, ChevronDown, FileText, Maximize2, Menu, Minimize2, Monitor, Moon, Paperclip, Plus, SlidersHorizontal, Sun, X } from "lucide-react";

/** @param {{ size?: number }} props */
export function GemIkon({ size = 16 }) {
  return <Paperclip size={size} aria-hidden="true" />;
}

/**
 * En bilaga som inte är en bild.
 *
 * ⛔ `FileText` och inte ett formatspecifikt märke. Ramverket vet inte om filen
 * är en PDF, ett kalkylark eller ett kontoutdrag, och en ikon som påstår
 * "kalkylark" om en PDF är en gissning användaren tror på.
 *
 * @param {{ size?: number }} props
 */
export function FilIkon({ size = 20 }) {
  return <FileText size={size} aria-hidden="true" />;
}

/** @param {{ size?: number }} props */
export function ChevronNedIkon({ size = 16 }) {
  return <ChevronDown size={size} aria-hidden="true" />;
}

/** @param {{ size?: number }} props */
export function KryssIkon({ size = 16 }) {
  return <X size={size} aria-hidden="true" />;
}

/** @param {{ size?: number }} props */
export function MenyIkon({ size = 24 }) {
  return <Menu size={size} aria-hidden="true" />;
}

/**
 * ⛔ Standardikonen för huvudåtgärden i bottenraden. Appen får skicka en egen,
 * men får ALDRIG behöva det: en app utan ikonval ska ändå få en knapp som ser ut
 * som en knapp, inte en tom cirkel.
 *
 * @param {{ size?: number }} props
 */
export function PlusIkon({ size = 24 }) {
  return <Plus size={size} aria-hidden="true" />;
}

/** @param {{ size?: number }} props */
export function BockIkon({ size = 16 }) {
  return <Check size={size} aria-hidden="true" />;
}

/** @param {{ size?: number }} props */
export function SolIkon({ size = 18 }) {
  return <Sun size={size} aria-hidden="true" />;
}

/** @param {{ size?: number }} props */
export function ManeIkon({ size = 18 }) {
  return <Moon size={size} aria-hidden="true" />;
}

/** Följ systemet: en skärm, alltså "vad enheten säger". @param {{ size?: number }} props */
export function SkarmIkon({ size = 18 }) {
  return <Monitor size={size} aria-hidden="true" />;
}

/**
 * ⛔ Samma två ikoner som SessionStudio använder för helskärm, avläst ur dess
 * `AppHeader`. Paritet betyder att samma sak ser likadan ut, och en egen
 * expandera-pil hade varit ett tredje formspråk för en knapp som redan har ett.
 */
export function HelskarmIkon({ size = 20 }) {
  return <Maximize2 size={size} aria-hidden="true" />;
}

export function HelskarmAvIkon({ size = 20 }) {
  return <Minimize2 size={size} aria-hidden="true" />;
}

/** @param {{ size?: number }} props */
export function ReglageIkon({ size = 20 }) {
  return <SlidersHorizontal size={size} aria-hidden="true" />;
}


/**
 * Sorteringens bild.
 *
 * ⛔ DEN FINNS FÖR ATT SORTERINGEN ÄR RAMVERKETS EGEN SAK. Grupperna i
 * `OpsFilterPanel` är appens: vilken bild som betyder "roll" beror på vad
 * rollerna ÄR, och det vet bara appen. Sorteringen är tvärtom samma sak i varje
 * app som finns, nämligen i vilken ordning raderna ligger, så att låta varje app
 * välja bild åt den är att be dem svara på en fråga som redan är besvarad.
 *
 * ⛔ SKÄLET ÄR OCKSÅ ETT FEL SOM FANNS. Föll `sorting.icon` bort ritades
 * reglageikonen, alltså SAMMA bild som en grupp utan egen ikon får. Två olika
 * kontroller med samma bild bredvid varandra är inte en skönhetsfläck, det är
 * två knappar man inte kan skilja på. Båda vyerna i bolag-ops skickade in
 * `ArrowDownUp` för att komma runt det, alltså samma rad kod två gånger för att
 * täcka över samma hål.
 *
 * @param {{ size?: number }} props
 */
export function SorteringIkon({ size = 20 }) {
  return <ArrowDownUp size={size} aria-hidden="true" />;
}
