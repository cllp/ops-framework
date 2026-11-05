/**
 * Ikonlexikonet: vilken Lucide-ikon som betyder vad. En betydelse, en ikon, och en ikon, en betydelse.
 *
 * ── ⛔ HÄNDELSEN ────────────────────────────────────────────────────────────
 *
 * Claudes designgenomgång 2026-11-04 (lifehub.app i 390 och 1280 px) och Groks granskning (cllp/lifehub.app#633)
 * fann samma sak från två håll: samma ikon betydde olika saker. Skjutreglaget (`SlidersHorizontal`) var filter i Idag
 * och Inkorgen, Inställningar i Menyn och platsväljaren i Biblioteket. Kugghjulet (`Settings`) var OCKSÅ Inställningar,
 * i Meddelanden, Biblioteket och Ekonomi. `Inbox` var både Inkorgen och Ärenden. CP: "Gör en sprint ... så att det blir
 * snyggt och användarvänligt och rent." (sprinten cllp/lifehub.app#634).
 *
 * En ikon är ett ord utan text. Betyder samma bild två saker måste användaren läsa etiketten för att veta vilken, och
 * då gör bilden ingenting. Betyder två bilder samma sak lär sig användaren två ord för en sak.
 *
 * ── ⛔ VARFÖR EN KARTA PÅ ETT STÄLLE ────────────────────────────────────────
 *
 * Felet uppstod för att varje yta valde sin ikon själv, med en direkt import ur `lucide-react` mitt i komponenten.
 * Ingen av dem var fel i sin fil; felet syntes först när två filer stod bredvid varandra på samma skärm (regel 2: en
 * sanning per faktum). Kartan är det enda stället där en betydelse får en bild. `icons.jsx` hämtar sina omslag härifrån,
 * och appen importerar samma karta ur paketets index, så att ramverk och app ritar samma ord med samma bild.
 *
 * `scripts/check-ikonlexikon.mjs` blir röd om två betydelser delar ikon, och om en fil i `src/components` eller
 * `src/lib` importerar en ikon ur kartan direkt ur `lucide-react` i stället för genom kartan.
 *
 * ── ⛔ VAD SOM INTE HÖR HIT ─────────────────────────────────────────────────
 *
 * Gruppikonkatalogen (`gruppikonkatalog.generated.*`) är bilder användaren VÄLJER åt sin grupp. De bär ingen betydelse
 * i ramverkets mening, och en grupp får gärna ha en inkorg som märke. Profilikonerna (`PROFILIKONER`) likaså.
 *
 * ── Betydelserna ────────────────────────────────────────────────────────────
 *
 * - `installningar`: kugghjulet, överallt där något ställs in. Aldrig skjutreglaget.
 * - `filter`: skjutreglaget, och BARA filter. En väljare, en inställning eller en sortering får inte låna det.
 * - `sortering`: i vilken ordning raderna ligger (se `SortIcon` i `icons.jsx` för varför den är ramverkets).
 * - `sok`: förstoringsglaset.
 * - `inkorg`: Inkorgen, det som kommit in och väntar på att hanteras.
 * - `arende`: ett ärende, något att göra. ⛔ `ListChecks` och inte `Inbox`: ett ärende är en uppgift, inte en låda. Inte
 *   `SquareCheckBig` heller, för en kryssruta läses som "klar" eller "vald", och bocken (`Check`) betyder redan vald.
 * - `nyttArende`: skapa ett ärende. `ListPlus`, skild från `arende`: pluset säger att något nytt läggs till, listan med bockar är ärendet som redan finns.
 * - `nyHandelse`: skapa en händelse. `CalendarPlus`, samma bild som plusmenyns Ny händelse. Skild från kalenderns egna ikoner, som inte är betydelser här.
 * - `meddelande`, `notiser`, `agent`: samma bilder som SessionStudio (se respektive omslag i `icons.jsx`).
 * - `hjalp`: frågetecknet i en ring. Ramverket ritar det inte själv i dag, men appen gör det, och då ska det stå här.
 * - `gruppval`: byt vilken grupp eller vilket bibliotek vyn visar. `ChevronsUpDown`, "välj en annan", och skild från
 *   filter: en väljare byter vad man tittar på, ett filter smalnar av det man redan tittar på.
 * - `mer`: tre punkter, en meny med sällanåtgärder.
 * - `temaLjust`, `temaMorkt`, `temaSystem`: de tre lägena i `OpsThemeToggle`. ⛔ `Monitor` betyder "följ systemet",
 *   inte "tema". Knappen i topplisten visar NUVARANDE läge och läses därför som "dator" när läget är systemets; det är en
 *   fråga om var växlaren sitter (CP:s beslut om toppen), inte om vilken bild ett läge har.
 * - `klistraIn`: urklipp med en pil, att ta in det som ligger i urklipp. Inte gemet: ett gem är en bilaga som redan finns.
 * - `slappBild`: en bild med ett plus, att släppa eller lägga in en bild eller fil. Inte `Image` ensam: pluset säger att
 *   något läggs till.
 * - (0.185.0) Ny händelse i snabbmenyn är `nyHandelse` ovan. En egen nyckel `handelse` med samma `CalendarPlus` hade varit två
 *   namn på en betydelse, och vakten hade inte sett det eftersom bilden är densamma.
 * - `projekt`: ett projekt (`FolderKanban`).
 * - `bokning`: en bokning (`CalendarCheck`).
 * - `bibliotek`: Biblioteket (`Library`).
 * - `ekonomi`: Ekonomi (`Wallet`).
 * - `laddaUpp`: ladda upp en fil (`Upload`).
 * - `appar`: fliken Appar och en app utan egen bild (`LayoutGrid`). Nyckeln är appar, inte hubb: hubb är instansen, appar är listan.
 * - `stang`: stäng (`X`).
 * - `skapa`: skapa, plusknappen (`Plus`).
 * - `omrostning`: en omröstning (`Vote`).
 * - `grupp`: Ny grupp (`Users`), samma bild som plusets rad och `GruppIkon`.
 * - (0.187.0, cllp/lifehub.app#653) `nal`: nålen (`Pin`), överst för alla på platsen. Samma betydelse som "Fäst" ett meddelande i ett samtal, så `FastIkon` hämtar den härifrån. Inte stjärnan.
 * - (0.187.0) `stjarna`: stjärnan (`Star`), personens egen markering som bara hen ser. Skild från `nal`: en stjärna är mitt, en nål är allas. `StjarnaIkon` (en bild i profil- och kalenderikonernas urval) hämtar den härifrån.
 */

import { ArrowDownUp, Bell, Bot, CalendarCheck, CalendarPlus, ChevronsUpDown, CircleHelp, ClipboardPaste, FolderKanban, GitBranch, ImagePlus, Inbox, LayoutGrid, Library, ListChecks, ListPlus, MessageSquare, Monitor, Moon, MoreHorizontal, Pin, Plus, Search, Settings, SlidersHorizontal, Star, Sun, Upload, Users, Vote, Wallet, X } from "lucide-react";

/**
 * Betydelse till ikon. Fryst: en app som vill ha en annan bild för en betydelse ska ändra den här, inte skriva över den.
 *
 * @type {Readonly<{
 *   installningar: import("lucide-react").LucideIcon,
 *   filter: import("lucide-react").LucideIcon,
 *   sortering: import("lucide-react").LucideIcon,
 *   sok: import("lucide-react").LucideIcon,
 *   inkorg: import("lucide-react").LucideIcon,
 *   arende: import("lucide-react").LucideIcon,
 *   nyttArende: import("lucide-react").LucideIcon,
 *   nyHandelse: import("lucide-react").LucideIcon,
 *   meddelande: import("lucide-react").LucideIcon,
 *   notiser: import("lucide-react").LucideIcon,
 *   agent: import("lucide-react").LucideIcon,
 *   hjalp: import("lucide-react").LucideIcon,
 *   gruppval: import("lucide-react").LucideIcon,
 *   mer: import("lucide-react").LucideIcon,
 *   temaLjust: import("lucide-react").LucideIcon,
 *   temaMorkt: import("lucide-react").LucideIcon,
 *   temaSystem: import("lucide-react").LucideIcon,
 *   klistraIn: import("lucide-react").LucideIcon,
 *   slappBild: import("lucide-react").LucideIcon,
 *   projekt: import("lucide-react").LucideIcon,
 *   bokning: import("lucide-react").LucideIcon,
 *   bibliotek: import("lucide-react").LucideIcon,
 *   ekonomi: import("lucide-react").LucideIcon,
 *   laddaUpp: import("lucide-react").LucideIcon,
 *   appar: import("lucide-react").LucideIcon,
 *   stang: import("lucide-react").LucideIcon,
 *   skapa: import("lucide-react").LucideIcon,
 *   omrostning: import("lucide-react").LucideIcon,
 *   grupp: import("lucide-react").LucideIcon,
 *   repoDokument: import("lucide-react").LucideIcon,
 *   nal: import("lucide-react").LucideIcon,
 *   stjarna: import("lucide-react").LucideIcon,
 * }>}
 */
export const IKON_FOR = Object.freeze({
  installningar: Settings,
  filter: SlidersHorizontal,
  sortering: ArrowDownUp,
  sok: Search,
  inkorg: Inbox,
  arende: ListChecks,
  nyttArende: ListPlus,
  nyHandelse: CalendarPlus,
  meddelande: MessageSquare,
  notiser: Bell,
  agent: Bot,
  hjalp: CircleHelp,
  gruppval: ChevronsUpDown,
  mer: MoreHorizontal,
  temaLjust: Sun,
  temaMorkt: Moon,
  temaSystem: Monitor,
  klistraIn: ClipboardPaste,
  slappBild: ImagePlus,
  projekt: FolderKanban,
  bokning: CalendarCheck,
  bibliotek: Library,
  ekonomi: Wallet,
  laddaUpp: Upload,
  appar: LayoutGrid,
  stang: X,
  skapa: Plus,
  omrostning: Vote,
  grupp: Users,
  repoDokument: GitBranch,
  nal: Pin,
  stjarna: Star,
});
