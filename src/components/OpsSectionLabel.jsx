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
 * ⛔ 0.94.0: vikten är rollens 600 och inte SS 700 (lifehub.app#165 beslut 3a, se nedan).
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 */
export function OpsSectionLabel({ children }) {
  // ⛔ 0.32.1 la `font-bold` här (CP 2026-09-30: "Typsnitten på profil är också fel."), eftersom SS profilvy skriver 700. 0.94.0
  // tog bort den (lifehub.app#165, CP 2026-10-10 beslut 3a: tre vikter, 700 bara räknemärken): rollen `sektion` bär 600, som
  // de andra sektionsraderna i ramverket (`OpsGruppFormular`, `OpsGruppSida`, `OpsModulRam`). En primitiv som lägger en
  // vikt ovanpå sin roll fälls av `check-typografi`.
  return <p className="m-0 text-sektion uppercase text-accent">{children}</p>;
}
