import { OpsCard, OpsIdentity, OpsList, OpsListRow, OpsPill, OpsView, OpsViewHeader, OpsButton } from "@staiger/ops-framework";

/**
 * Startvy. Byt ut innehållet mot appens egna data.
 *
 * Den är med i mallen för att visa formen: vyskal, rubrik med åtgärder till
 * höger, och innehåll i kort. Layouten kommer ur Tailwind (grid, gap), bitarna
 * ur ramverket. Det är arbetsdelningen: Tailwind för layout, primitiver för
 * komponenter.
 */
const ARENDEN = [
  { id: "a_1", titel: "Kvartalsrapport Q3", agare: "Ekonomi", seed: "grp_ekonomi", status: "neutral", statusText: "Pågår" },
  { id: "a_2", titel: "Avtal Nordisk Logistik", ägare: "Juridik", seed: "grp_juridik", status: "warning", statusText: "Väntar svar" },
  { id: "a_3", titel: "Årsredovisning", agare: "Ekonomi", seed: "grp_ekonomi", status: "success", statusText: "Klar" },
];

export function DashboardView() {
  return (
    <OpsView>
      <OpsViewHeader
        title="Översikt"
        description="Byt ut den här vyn mot appens egna data."
        actions={<OpsButton variant="primary">Nytt ärende</OpsButton>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { etikett: "Öppna ärenden", varde: "12" },
          { etikett: "Väntar på svar", varde: "3" },
          { etikett: "Klara denna vecka", varde: "7" },
        ].map((n) => (
          <OpsCard key={n.etikett}>
            <p className="m-0 text-sm font-semibold text-ink-secondary">{n.etikett}</p>
            <p className="m-0 mt-1 text-xl font-bold text-ink">{n.varde}</p>
          </OpsCard>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-md font-bold text-ink">Senaste ärenden</h2>
      <OpsCard flush>
        <OpsList ariaLabel="Senaste ärenden">
          {ARENDEN.map((a) => (
            <OpsListRow key={a.id} interactive href={`/arende/${a.id}`} ariaLabel={`${a.titel}, ${a.statusText}`}>
              <OpsIdentity name={a.agare} seed={a.seed} size="sm" />
              <span className="min-w-0 flex-1 truncate text-base text-ink">{a.titel}</span>
              <OpsPill tone={a.status}>{a.statusText}</OpsPill>
            </OpsListRow>
          ))}
        </OpsList>
      </OpsCard>
    </OpsView>
  );
}
