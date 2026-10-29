import { KALENDERIKONER } from "./kalendrar.js";
import { BlixtIkon, BokIkon, GruppIkon, HjartaIkon, HusIkon, KalenderIkon, PortfoljIkon, StjarnaIkon } from "../components/icons.jsx";

/**
 * Kartan från en kalenders ikon-id (`KALENDERIKONER`) till komponenten som ritar den (0.37.0, #179 F2). Samma upplägg
 * som `gruppikoner.js`: hanteringen, "Skapa i" och formuläret ritar samma märke ur samma karta.
 */
export const KALENDERIKON_KOMPONENT = /** @type {const} */ ({
  kalender: KalenderIkon,
  grupp: GruppIkon,
  portfolj: PortfoljIkon,
  hus: HusIkon,
  stjarna: StjarnaIkon,
  hjarta: HjartaIkon,
  blixt: BlixtIkon,
  bok: BokIkon,
});

if (Object.keys(KALENDERIKON_KOMPONENT).length !== KALENDERIKONER.length || KALENDERIKONER.some((i) => !(i in KALENDERIKON_KOMPONENT))) {
  throw new Error("kalenderikoner.js: KALENDERIKON_KOMPONENT täcker inte exakt KALENDERIKONER (kalendrar.js). En ikon utan komponent är ett id ingen kan rita.");
}

/** Ikonens namn i en väljare, för skärmläsare. */
export const KALENDERIKON_NAMN = /** @type {const} */ ({ kalender: "Kalender", grupp: "Grupp", portfolj: "Portfölj", hus: "Hus", stjarna: "Stjärna", hjarta: "Hjärta", blixt: "Blixt", bok: "Bok" });

/**
 * Komponenten som ritar en kalenders ikon, med `KalenderIkon` som reserv (granskningen av PR 464). En ikon som klarar reglerna men som den här versionen av ramverket inte känner (en nyare
 * version har lagt till den i `KALENDERIKONER`) behålls i datan (`lasMinKalender`, `byggMinKalender`) och ritas med reserven, så att en äldre klient varken kraschar på den eller skriver över den.
 * @param {string | undefined} id
 */
export function kalenderIkonKomponent(id) {
  return (id && Object.hasOwn(KALENDERIKON_KOMPONENT, id) ? KALENDERIKON_KOMPONENT[/** @type {keyof typeof KALENDERIKON_KOMPONENT} */ (id)] : null) ?? KalenderIkon;
}
