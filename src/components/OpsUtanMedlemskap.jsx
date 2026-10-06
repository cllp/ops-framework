import { useState } from "react";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
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
 * ══ ⛔ #161, OCH `onSkapaGrupp`: SAMMA SIDA, TVÅ SKÄL ATT VARA HÄR ════════
 *
 * CP 2026-09-28 (#160): den som är VITLISTAD får skapa sin första grupp
 * själv, från ett namn. Den som inte är det ska bli ombedd om en inbjudan,
 * precis som förut. Ramverket vet inte här vilketdera som gäller för den
 * inloggade: appen VET (den kontrollerar vitlistan server-sidan innan den
 * ens visar knappen, se `createGroupService` i `ops-framework/node`)
 * och signalerar det genom att skicka in `onSkapaGrupp` eller inte.
 *
 * ⛔ UTAN `onSkapaGrupp` ÄR SIDAN OFÖRÄNDRAD. Formen ritas bara när appen
 * faktiskt kan göra något med den, av samma mönster som `props.lagring` på
 * `OpsProfil`: en knapp som anropar ingenting är en knapp som ser ut att
 * fungera och inte gör det.
 *
 * ⛔ FORMEN HAR ETT FÄLT: NAMNET. `skapaGrupp` (node-sidan) tar bara emot ett
 * namn, aldrig moduler eller andra grupper att kopiera inställningar ifrån,
 * eftersom den FÖRSTA gruppen inte har något att ärva.
 *
 * @param {object} props
 * @param {string} [props.rubrik]
 * @param {string} [props.text]
 * @param {string} [props.kontakt] Vem man ber om en inbjudan. Utelämnad: ingen rad.
 * @param {() => void} [props.onLoggaUt]
 * @param {string} [props.loggaUtEtikett]
 * @param {string} [props.inloggadSom] E-posten man är inloggad med.
 * @param {string} [props.inloggadSomEtikett]
 * @param {(b: { namn: string }) => void | Promise<void>} [props.onSkapaGrupp] Bara för den vitlistade (#161). Utelämnad: ingen form.
 * @param {string} [props.skapaRubrik]
 * @param {string} [props.skapaText]
 * @param {string} [props.namnEtikett]
 * @param {string} [props.skapaEtikett]
 * @param {string} [props.eller] Ordet mellan "skapa"-formen och "be om en inbjudan"-texten, bara när båda syns.
 * @param {string} [props.namnForval] (0.51.0) Namnet fältet börjar med, och som går att skriva över innan man skapar.
 *   CP 2026-10-04: "Default-namnet är Mitt projekt ... namnet går att byta direkt." Utelämnat: tomt fält, som förut.
 */
export function OpsUtanMedlemskap({
  rubrik = "Du är inte med i någon grupp",
  text = "Ditt konto är inloggat, men det hör ännu inte till någon grupp. Be om en inbjudan, så syns allt här nästa gång du loggar in.",
  kontakt,
  onLoggaUt,
  loggaUtEtikett = "Logga ut",
  inloggadSom,
  inloggadSomEtikett = "Inloggad som",
  onSkapaGrupp,
  skapaRubrik = "Skapa din första grupp",
  skapaText = "Ditt konto får skapa en grupp. Ge den ett namn, så är du igång.",
  namnEtikett = "Gruppens namn",
  skapaEtikett = "Skapa grupp",
  eller = "Eller",
  namnForval = "",
}) {
  /*
   * ⛔ FÖRVALET ÄR ETT VÄRDE I FÄLTET OCH INTE EN PLATSHÅLLARE (0.51.0). En platshållare ser ut som ett namn men skickas
   * aldrig, så knappen hade varit avstängd under ett fält som verkar ifyllt. Här går det att trycka direkt, eller byta först.
   */
  const [namn, setNamn] = useState(namnForval);
  const [skapar, setSkapar] = useState(false);

  const skapa = async () => {
    if (!namn.trim() || !onSkapaGrupp || skapar) return;
    setSkapar(true);
    try {
      await onSkapaGrupp({ namn: namn.trim() });
    } finally {
      setSkapar(false);
    }
  };

  return (
    <OpsView>
      <OpsViewHeader title={rubrik} />

      {/*
       * ⛔ SKAPA-FORMEN LIGGER FÖRST NÄR DEN FINNS. Den vitlistade ska inte
       * behöva läsa förbi en "be om en inbjudan"-text som inte gäller hen
       * innan hen hittar det enda hen faktiskt kan göra här.
       */}
      {onSkapaGrupp ? (
        <div className="flex max-w-sm flex-col gap-3">
          <div>
            <p className="m-0 font-semibold text-ink">{skapaRubrik}</p>
            <p className="m-0 text-etikett text-ink-secondary">{skapaText}</p>
          </div>
          <OpsField label={namnEtikett}>
            <OpsInput value={namn} onChange={setNamn} placeholder="Mitt bolag" />
          </OpsField>
          <div>
            <OpsButton variant="primary" onClick={skapa} disabled={!namn.trim() || skapar}>
              {skapaEtikett}
            </OpsButton>
          </div>
        </div>
      ) : null}

      {onSkapaGrupp ? <p className="m-0 text-etikett font-semibold uppercase tracking-wide text-ink-muted">{eller}</p> : null}

      <p className="max-w-prose text-ink-secondary">{text}</p>

      {/* ⛔ Vem man är inloggad som står här, eftersom fel konto är det
          vanligaste skälet att hamna på den här sidan. */}
      {inloggadSom ? (
        <p className="text-etikett text-ink-muted">
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
