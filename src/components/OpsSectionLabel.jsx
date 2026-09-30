/**
 * Sektionsrubrik: liten versal, spärrad, i accentfärg.
 *
 * ══ ⛔ VARFÖR EN EGEN PRIMITIV OCH INTE ÄNNU EN `<p className="...">` ═════
 *
 * #157, CP:s tillägg 2026-09-28 om SessionStudios primitiver: "sektionsrubriker
 * som liten versal text med spärrning i accentfärg ('PROFILBILD',
 * 'PERSONUPPGIFTER')". Mätt i SessionStudios `ProfileView.jsx`:
 * `text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider`.
 *
 * Ramverket hade redan MOTSVARANDE rader på fyra ställen (`OpsGruppvaljare`,
 * `OpsMedlemmar`, `OpsProfil`, `OpsFilterPanel`), och alla fyra skrev sin egen
 * variant: någon `text-sm`, någon `tracking-wide`, någon `text-ink-secondary`
 * i stället för accentfärg. Fyra handskrivna kopior av samma idé är precis
 * den sortens glidning arbetsreglernas "en sanning per faktum" varnar för:
 * fyra rubriker som SER olika ut utan att någon bestämt att de ska göra det.
 *
 * ⛔ MÅTTEN ÄR AVLÄSTA, INTE UPPSKATTADE. `text-xs` (12 px), `font-bold` (700)
 * och `tracking-wider` (0.05em) är Tailwinds egna steg för just de siffror
 * SessionStudios CSS skriver ut, inte en känsla av "ungefär så här litet".
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 */
export function OpsSectionLabel({ children }) {
  // ⛔ 0.32.1: `font-bold`. Filhuvudet har alltid sagt 700 (SS `font-bold`), men rollen `sektion` bär 600, som de andra
  // sektionsraderna i ramverket (`OpsGruppFormular`, `OpsGruppSida`) mäter mot SS `font-semibold`. Den här primitiven är
  // profilens rubrik och bär därför profilens vikt. CP 2026-09-30: "Typsnitten på profil är också fel."
  return <p className="m-0 text-sektion font-bold uppercase text-accent">{children}</p>;
}
