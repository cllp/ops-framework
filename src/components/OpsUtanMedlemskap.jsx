import { OpsButton } from "./OpsButton.jsx";
import { OpsView, OpsViewHeader } from "./OpsView.jsx";

/**
 * Sidan för den som är inloggad men inte med i någon grupp.
 *
 * ══ ⛔ ALDRIG EN TOM APP (#137) ═══════════════════════════════════════
 *
 * Lärdomen är bolag-ops egen: en tom vy läses som trasig. Den som loggar in
 * och möter en app utan innehåll drar slutsatsen att något gått sönder, inte
 * att hen saknar behörighet, och hör därför av sig om fel sak.
 *
 * ⛔ SIDAN SÄGER OCKSÅ VEM MAN FRÅGAR. Ett besked utan en väg vidare är bara
 * ett nej. Appen skickar in kontakten, eftersom ramverket inte kan veta vem
 * som förvaltar just den här plattformen.
 *
 * ⛔ OCH DEN HAR EN UTLOGGNING. Den som loggat in med fel konto, vilket är det
 * vanligaste skälet att hamna här, ska kunna byta utan att leta.
 *
 * @param {object} props
 * @param {string} [props.rubrik]
 * @param {string} [props.text]
 * @param {string} [props.kontakt] Vem man ber om en inbjudan. Utelämnad: ingen rad.
 * @param {() => void} [props.onLoggaUt]
 * @param {string} [props.loggaUtEtikett]
 * @param {string} [props.inloggadSom] E-posten man är inloggad med.
 * @param {string} [props.inloggadSomEtikett]
 */
export function OpsUtanMedlemskap({
  rubrik = "Du är inte med i någon grupp",
  text = "Ditt konto är inloggat, men det hör ännu inte till någon grupp. Be om en inbjudan, så syns allt här nästa gång du loggar in.",
  kontakt,
  onLoggaUt,
  loggaUtEtikett = "Logga ut",
  inloggadSom,
  inloggadSomEtikett = "Inloggad som",
}) {
  return (
    <OpsView>
      <OpsViewHeader title={rubrik} />
      <p className="max-w-prose text-ink-secondary">{text}</p>

      {/* ⛔ Vem man är inloggad som står här, eftersom fel konto är det
          vanligaste skälet att hamna på den här sidan. */}
      {inloggadSom ? (
        <p className="text-sm text-ink-muted">
          {inloggadSomEtikett}: <span className="text-ink">{inloggadSom}</span>
        </p>
      ) : null}

      {kontakt ? <p className="text-ink">{kontakt}</p> : null}

      {onLoggaUt ? (
        <div>
          <OpsButton variant="secondary" onClick={onLoggaUt}>
            {loggaUtEtikett}
          </OpsButton>
        </div>
      ) : null}
    </OpsView>
  );
}
