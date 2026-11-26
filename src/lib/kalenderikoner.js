import { KALENDERIKONER_ARV } from "./kalendrar.js";
import { gruppikonKomponent } from "./gruppikoner.js";
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

if (Object.keys(KALENDERIKON_KOMPONENT).length !== KALENDERIKONER_ARV.length || KALENDERIKONER_ARV.some((i) => !(i in KALENDERIKON_KOMPONENT))) {
  throw new Error("kalenderikoner.js: KALENDERIKON_KOMPONENT täcker inte exakt KALENDERIKONER_ARV (kalendrar.js). Ett äldre id utan komponent är ett id ingen kan rita.");
}

/**
 * De äldre id:na till katalognamnet väljaren markerar för dem (0.265.0). En kalender med `hus` visar huset valt i `OpsIkonValjare`, och ritas som förut tills någon väljer en ny.
 * ⛔ `kalender` RITAS SOM `CalendarDays` men markerar `calendar` i väljaren: katalogen har inte den med prickar, och närmast är rätt svar på frågan "vilken är vald".
 */
export const ARV_KALENDERIKON = /** @type {const} */ ({ kalender: "calendar", grupp: "users", portfolj: "briefcase", hus: "house", stjarna: "star", hjarta: "heart", blixt: "zap", bok: "book-open" });

/**
 * Katalognamnet en kalenders ikon motsvarar i väljaren: ett äldre id ger sitt namn ur `ARV_KALENDERIKON`, ett katalognamn sig självt.
 * @param {string | undefined} id
 */
export function kalenderikonINamn(id) {
  if (!id) return "";
  return Object.hasOwn(ARV_KALENDERIKON, id) ? ARV_KALENDERIKON[/** @type {keyof typeof ARV_KALENDERIKON} */ (id)] : id;
}

/** Ikonens namn i en väljare, för skärmläsare. */
export const KALENDERIKON_NAMN = /** @type {const} */ ({ kalender: "Kalender", grupp: "Grupp", portfolj: "Portfölj", hus: "Hus", stjarna: "Stjärna", hjarta: "Hjärta", blixt: "Blixt", bok: "Bok" });

/**
 * Komponenten som ritar en kalenders ikon, med `KalenderIkon` som reserv (granskningen av PR 464). En ikon som klarar reglerna men som den här versionen av ramverket inte känner (en nyare
 * version har lagt till den i `KALENDERIKONER`) behålls i datan (`lasMinKalender`, `byggMinKalender`) och ritas med reserven, så att en äldre klient varken kraschar på den eller skriver över den.
 * @param {string | undefined} id
 */
export function kalenderIkonKomponent(id) {
  if (id && Object.hasOwn(KALENDERIKON_KOMPONENT, id)) return KALENDERIKON_KOMPONENT[/** @type {keyof typeof KALENDERIKON_KOMPONENT} */ (id)];
  // ⛔ ETT NAMN UR IKONKATALOGEN (0.265.0): samma ikon som gruppens väljare ritar. Ett namn katalogen inte känner ritas med reserven.
  return (id ? gruppikonKomponent(id) : null) ?? KalenderIkon;
}
