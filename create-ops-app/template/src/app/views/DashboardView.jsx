import {
  OpsButton,
  OpsCard,
  OpsIdentity,
  OpsList,
  OpsListRow,
  OpsPill,
  OpsStat,
  OpsTable,
  OpsTag,
  OpsView,
  OpsViewHeader,
  formatCurrency,
  formatDate,
} from "@staiger/ops-framework";

/**
 * Startvy. Byt ut innehållet mot appens egna data.
 *
 * Den är med i mallen för att visa formen: vyskal, rubrik med åtgärder till
 * höger, och innehåll i kort. Layouten kommer ur Tailwind (grid, gap), bitarna
 * ur ramverket. Det är arbetsdelningen: Tailwind för layout, primitiver för
 * komponenter.
 *
 * ⛔ Den här vyn handrullade tidigare sin egen nyckeltalsruta av rå markup. Att
 * ramverkets EGET exempel behövde uppfinna något var beviset på att `OpsStat`
 * saknades. Ser du dig själv skriva markup som borde vara en primitiv: det är
 * inte en genväg, det är en lucka i ramverket som ska lagas där.
 */

const ARENDEN = [
  { id: "a_1", titel: "Kvartalsrapport Q3", agare: "Ekonomi", seed: "grp_ekonomi", status: "neutral", statusText: "Pågår" },
  { id: "a_2", titel: "Avtal Nordisk Logistik", agare: "Juridik", seed: "grp_juridik", status: "warning", statusText: "Väntar svar" },
  { id: "a_3", titel: "Årsredovisning", agare: "Ekonomi", seed: "grp_ekonomi", status: "success", statusText: "Klar" },
];

const KOSTNADER = [
  { id: "k1", leverantor: "Fortnox", kategori: "IT", belopp: 4788, senast: "2026-09-01" },
  { id: "k2", leverantor: "Telia", kategori: "Telefoni", belopp: 5388, senast: "2026-08-28" },
  { id: "k3", leverantor: "Länsförsäkringar", kategori: "Försäkring", belopp: 12400, senast: "2026-08-15" },
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
        <OpsStat label="Öppna ärenden" value="12" hint="3 fler än förra veckan" />
        <OpsStat label="Väntar på svar" value="3" tone="warning" hint="Äldsta sedan 12 dagar" />
        <OpsStat label="Klara denna vecka" value="7" tone="success" />
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

      <h2 className="mb-3 mt-8 text-md font-bold text-ink">Löpande kostnader</h2>
      <OpsCard>
        <OpsTable
          caption="Löpande kostnader per leverantör"
          hideCaption
          columns={[
            { key: "leverantor", label: "Leverantör" },
            { key: "kategori", label: "Kategori", tight: true },
            { key: "belopp", label: "Per år", numeric: true },
            { key: "senast", label: "Senast", numeric: true, tight: true },
          ]}
          rows={KOSTNADER.map((k) => ({
            id: k.id,
            leverantor: k.leverantor,
            kategori: <OpsTag label={k.kategori} />,
            belopp: formatCurrency(k.belopp),
            senast: formatDate(k.senast),
          }))}
        />
      </OpsCard>
    </OpsView>
  );
}
