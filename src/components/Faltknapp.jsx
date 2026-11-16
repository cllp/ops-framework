import { cx } from "../lib/cx.js";

/**
 * Den runda knappen i ett fält, för bifoga (0.132.0). ⛔ TRÄFFYTAN ÄR KNAPPEN, 44 PX; cirkeln inuti är det man ser. En knapp och en stil för de runda knapparna i ett fält.
 *
 * ⛔ DISKRET I FORMULÄRENS FÄLT (0.106.0, #386 skiva 8). I `falt`, `rad-falt` och `plats` är cirkeln utan kant och skugga och ikonen
 * dämpad, tills pekaren eller fokus är på den. `rad` har sin cirkel.
 * (0.230.0) Flyttad hit ur `OpsRostinmatning.jsx`, som togs bort när TALK blev den enda röstknappen. Används av gemknappen (`OpsFilePicker`)
 * och av fältets mikrofon (`useTalkfalt`), som ger `onPointerDown` och `onMouseDown` så att trycket inte flyttar fokus.
 *
 * ⛔ `storlek="stor"` (0.233.0). CP efter att ha provat 0.232.0 i telefonen: "Kör med mikrofonen och kör alla fält", och han ville ha en
 * större ikon. Mikrofonen har en cirkel på 40 px (`size-10`) i stället för 36; träffytan är 44 px i båda storlekarna, så fältets reserverade
 * plats räcker oförändrad. Gemknappen behåller sin storlek: den är inte det man trycker på först.
 *
 * @param {{ ikon: import("react").ReactNode, etikett: string, onClick: (e: import("react").MouseEvent<HTMLButtonElement>) => void, onPointerDown?: (e: import("react").PointerEvent) => void, onMouseDown?: (e: import("react").MouseEvent) => void, placering?: "rad" | "falt" | "rad-falt" | "plats", storlek?: "normal" | "stor", disabled?: boolean, data?: Record<string, string> }} props `falt`: i textfältets
 *   nedre hörn. `rad-falt`: vid slutet av ett fält på en rad, mitt i höjden. `plats`: knappen står där dess förälder lagt den (fältets bifogaplats), utan egen placering.
 */
export function Faltknapp({ ikon, etikett, onClick, onPointerDown, onMouseDown, placering = "rad", storlek = "normal", disabled = false, data = {} }) {
  const iFalt = placering !== "rad";
  return (
    <button
      type="button"
      {...data}
      aria-label={etikett}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onMouseDown={onMouseDown}
      disabled={disabled}
      className={cx(
        "group/knapp inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55",
        placering === "falt" && "absolute end-3 bottom-0.5",
        placering === "rad-falt" && "absolute end-0.5 top-1/2 -translate-y-1/2",
      )}
    >
      <span
        className={cx(
          "inline-flex items-center justify-center rounded-full transition-colors duration-(--duration-fast) ease-standard group-focus-visible/knapp:outline-2 group-focus-visible/knapp:outline-offset-1 group-focus-visible/knapp:outline-accent",
          storlek === "stor" ? "size-10" : "size-9",
          iFalt ? "text-ink-muted group-hover/knapp:bg-hover group-hover/knapp:text-ink" : "border border-line bg-surface text-ink shadow-sm group-hover/knapp:bg-hover",
        )}
      >
        {ikon}
      </span>
    </button>
  );
}
