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

import { Archive, ArchiveRestore, ArrowDownUp, Bell, CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronRight, Crown, ExternalLink, FileText, Heart, Inbox, LogOut, Maximize2, Menu, Minimize2, Monitor, Moon, MoreHorizontal, Paperclip, Pencil, Plus, SlidersHorizontal, Smile, Star, Sun, User, X, Zap } from "lucide-react";

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
export function MenuIcon({ size = 24 }) {
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
export function SortIcon({ size = 20 }) {
  return <ArrowDownUp size={size} aria-hidden="true" />;
}


/**
 * Chevron åt höger. Raden som öppnar en undervy i en panel.
 *
 * ⛔ SAMMA FAMILJ SOM `ChevronNedIkon`, alltså lucide och inte en handskriven
 * svg. Två chevroner i samma panel, en nedåt på en flik och en höger på en rad,
 * får inte se ut som två olika familjer.
 *
 * @param {{ size?: number }} props
 */
export function ChevronHogerIkon({ size = 16 }) {
  return <ChevronRight size={size} aria-hidden="true" />;
}

/** Tillbaka till föregående vy i en panel. @param {{ size?: number }} props */
export function ChevronVansterIkon({ size = 16 }) {
  return <ChevronLeft size={size} aria-hidden="true" />;
}

/**
 * Raden lämnar appen. #157: "extern-länk-ikon på rader som lämnar appen."
 * Mätt i SessionStudios `AppHeader.jsx`: samma `ExternalLink`, på Support-raden.
 * @param {{ size?: number }} props
 */
export function ExternLankIkon({ size = 16 }) {
  return <ExternalLink size={size} aria-hidden="true" />;
}

/** Utloggningsraden i användarmenyn (#157). @param {{ size?: number }} props */
export function LoggaUtIkon({ size = 16 }) {
  return <LogOut size={size} aria-hidden="true" />;
}

/**
 * Sex standardikoner för en profilbild UTAN Storage (#164, korrigering C).
 * Se `PROFILIKONER` i `src/lib/grupp.js` för id:na och skälet.
 * @param {{ size?: number }} props
 */
export function PersonIkon({ size = 20 }) {
  return <User size={size} aria-hidden="true" />;
}
/** @param {{ size?: number }} props */
export function StjarnaIkon({ size = 20 }) {
  return <Star size={size} aria-hidden="true" />;
}
/** @param {{ size?: number }} props */
export function HjartaIkon({ size = 20 }) {
  return <Heart size={size} aria-hidden="true" />;
}
/** @param {{ size?: number }} props */
export function BlixtIkon({ size = 20 }) {
  return <Zap size={size} aria-hidden="true" />;
}
/** @param {{ size?: number }} props */
export function LeendeIkon({ size = 20 }) {
  return <Smile size={size} aria-hidden="true" />;
}
/** @param {{ size?: number }} props */
export function KronaIkon({ size = 20 }) {
  return <Crown size={size} aria-hidden="true" />;
}

/**
 * Tre punkter, en meny med sällanåtgärder. #158: "Rensa flyttar till
 * trepunktsmenyn." Mätt i SessionStudios `ActivityFeedPanel.jsx`.
 * @param {{ size?: number }} props
 */
export function MerIkon({ size = 18 }) {
  return <MoreHorizontal size={size} aria-hidden="true" />;
}

/**
 * Ändra-raden i en kataloginställning (#164). Mätt i SessionStudios mönster
 * för redigeringsknappar: en penna, ikon plus ord, aldrig ikonen ensam.
 * @param {{ size?: number }} props
 */
export function AndraIkon({ size = 16 }) {
  return <Pencil size={size} aria-hidden="true" />;
}

/**
 * Arkivera-raden i en kataloginställning (#164).
 * @param {{ size?: number }} props
 */
export function ArkiveraIkon({ size = 16 }) {
  return <Archive size={size} aria-hidden="true" />;
}

/**
 * Ta fram-raden: motsatsen till Arkivera, samma rad men en arkiverad kategori
 * (#164). En egen ikon i stället för att återanvända `ArkiveraIkon` med
 * flit: en pil som pekar tillbaka ut är en annan handling än en som lägger
 * undan, och samma bild på båda hade gjort knappen tvetydig.
 * @param {{ size?: number }} props
 */
export function TaFramIkon({ size = 16 }) {
  return <ArchiveRestore size={size} aria-hidden="true" />;
}

/**
 * Notiser-raden i hamburgarmenyn (#164). Sektion 1: Notiser och Aktivitet.
 * @param {{ size?: number }} props
 */
export function NotisIkon({ size = 16 }) {
  return <Bell size={size} aria-hidden="true" />;
}

/**
 * Aktivitet-raden i hamburgarmenyn (#164). Skild från `KlockIkon` i
 * `OpsActivity.jsx` (den ensamma undantagsritningen check-handritade-ikoner
 * dokumenterar): den här är en riktig lucide-ikon i den delade uppsättningen,
 * eftersom menyraden inte är samma yta som panelens egen knapp.
 * @param {{ size?: number }} props
 */
export function AktivitetIkon({ size = 16 }) {
  return <Zap size={size} aria-hidden="true" />;
}

/**
 * "Ny händelse" i plusset (#168). Mätt ur SessionStudios create-meny
 * (`apps/web/src/components/AppHeader.jsx`, "Ny session"-raden): 18 px
 * (`w-4.5 h-4.5`), samma ikon Lucide-familjen redan kallar `CalendarPlus`.
 * @param {{ size?: number }} props
 */
export function HandelsePlusIkon({ size = 18 }) {
  return <CalendarPlus size={size} aria-hidden="true" />;
}

/**
 * "Nytt ärende" i plusset (#168). Ramverket har ingen egen "inkorg"-ikon
 * sedan förut; `Inbox` är samma familj som övriga rader här.
 * @param {{ size?: number }} props
 */
export function ArendePlusIkon({ size = 18 }) {
  return <Inbox size={size} aria-hidden="true" />;
}
