import { OpsCalendar } from "./OpsCalendar.jsx";

/**
 * Gästkalenderns Månad och Vecka: ramverkets egen kalender (`OpsCalendar`) med gästens poster, och ingenting annat (0.257.0, cllp/lifehub.app#890).
 *
 * ══ ⛔ EN EGEN FIL SOM HÄMTAS FÖRST NÄR MÅNAD ELLER VECKA VÄLJS ═══════════════════════════════════════════════════════
 *
 * `OpsCalendar` är ramverkets största vy, och gästsidan öppnar på Översikt eller Chatt. Importerad direkt i `OpsGastGrupp` hade den legat i gästsidans bit för varje gäst, också för den som
 * aldrig öppnar kalendern eller bara läser listan (förvald på telefon). `OpsGastKalender` läser in den här filen med en dynamisk import bakom `Suspense`, och `check:delbarhet` mäter att
 * kalendern inte ligger i biten som `OpsGastGrupp` drar in.
 *
 * ══ ⛔ LÄSA, INTE ÄNDRA ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Inget `onSkapa` (ingen plusknapp och ingen skapa-ruta), inga `kalendrar` (ingen kalenderlista och ingen Hantera kalendrar), ingen `tillganglighet`, inga `typer` (gästens filter står
 * ovanför och gäller alla tre lägena) och ingen årsvy. En gäst läser, svarar och röstar (beslutet 18 nov, punkt 7), och svaret ges i händelsens panel som ett tryck på en post öppnar.
 *
 * @param {object} props
 * @param {import("../lib/calendar.js").CalendarEntry[]} props.poster
 * @param {"manad" | "vecka"} props.lage
 * @param {(id: string) => void} props.onOppna
 * @param {string} props.ariaLabel
 * @param {string} props.sprak
 * @param {Date} [props.idag] Bara för prov.
 */
export function OpsGastKalenderRutnat({ poster, lage, onOppna, ariaLabel, sprak, idag }) {
  return (
    <OpsCalendar
      // Ett nytt läge är en ny kalender: rullningen, urvalet och veckan börjar om, i stället för att en månads urval följer med in i en vecka.
      key={lage}
      entries={poster}
      lage={lage}
      ariaLabel={ariaLabel}
      onOppnaHandelse={onOppna}
      locale={sprak === "en" ? "en-GB" : "sv-SE"}
      arsvy={false}
      {...(idag ? { today: idag } : {})}
    />
  );
}
