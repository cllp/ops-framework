import { cx } from "../lib/cx.js";

/**
 * Räknaren som sitter PÅ något i toppraden: en flik eller en ikonknapp.
 *
 * ── ⛔ EN IMPLEMENTATION, TVÅ ANVÄNDNINGAR, OCH INTE TRE ─────────────────
 *
 * Den här låg tidigare som `FlikBadge` inuti `OpsAppShell`. När ikonlänken
 * behövde samma sak fanns två vägar: kopiera femton rader, eller flytta dem hit.
 * En kopia hade blivit två räknare som nästan ser likadana ut, i samma rad, och
 * "nästan" är det som gör att en yta slutar kännas som en produkt.
 *
 * ⛔ KLASSERNA ÄR AVLÄSTA UR SESSIONSTUDIO, inte utformade här:
 *
 *   absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 text-[8px]
 *   font-bold rounded-full flex items-center justify-center
 *   bg-[--color-notification-badge] text-white
 *
 * ⛔ Bottenradens räknare är MED FLIT en annan form och delas inte med den här.
 * Där är den en inline-pill efter ett ord i en meny; här ligger den ovanpå ett
 * hörn. Att göra dem lika vore att välja symmetri framför förlagan.
 *
 * ⛔ SIFFRAN KAPAS VID 9+. En tvåsiffrig räknare spränger cirkeln, och exakt
 * antal är inte det en räknare svarar på. Den svarar på "finns det något".
 *
 * ⛔ Både siffra och skärmläsartext. En prick utan namn säger ingenting till den
 * som inte ser den, och en siffra utan substantiv säger inte nio av vad.
 *
 * @param {{ antal: number, text: string }} props
 */
export function Raknare({ antal, text }) {
  return (
    <span
      className={cx(
        "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5",
        "bg-badge text-[8px] font-bold text-badge-contrast",
      )}
    >
      <span aria-hidden="true">{antal > 9 ? "9+" : antal}</span>
      <span className="sr-only">
        {antal} {text}
      </span>
    </span>
  );
}
