/**
 * Vad vi vet om EN sak, fält för fält.
 *
 * ── ⛔ VARFÖR DEN FINNS, MÄTT OCH INTE ANAT ───────────────────────────────
 *
 * Fyra vyer i bolag-ops ritade var sin `<dl>` med etikett och värde, i tre olika
 * utseenden: en boxad lista med avdelare, ett tvåkolumnsrutnät och ett tätt
 * sifferpar. Samma semantik, tre former, noll gemensam kod. Den femte kopian var
 * på väg in när den här komponenten skrevs.
 *
 * ⛔ Det är inte ett skönhetsproblem. Etiketten bär vilket fält ett värde tillhör,
 * och tre olika etikettbredder betyder att samma panel ser olika ut beroende på
 * vilken sida man öppnade. Läsaren lär sig då inget mönster, utan läser om varje
 * gång.
 *
 * ── ⛔ ETT UTSEENDE, INTE EN VARIANTFLAGGA ───────────────────────────────
 *
 * Komponenten har medvetet INGEN `layout`-prop, fastän två av de fyra kopiorna
 * ser annorlunda ut. En variantflagga hade bevarat skillnaderna i ett nytt
 * omslag och kallat det enhetligt, och då hade vi haft fyra utseenden till
 * evigheten plus en komponent att underhålla.
 *
 * ── ⛔ EN TABELL ÄR NÅGOT ANNAT ──────────────────────────────────────────
 *
 * `OpsTable` jämför FLERA saker på samma fält, därför kräver den rubriker och en
 * caption. Den här beskriver EN sak, och en tabell med två kolumner där den
 * vänstra är fältnamn är fel semantik: en skärmläsare läser då rubriker som inte
 * finns och tappar kopplingen mellan fält och värde.
 *
 * ── ⛔ TOMMA FÄLT RITAS INTE ─────────────────────────────────────────────
 *
 * En rad utan värde tas bort, och är alla tomma returnerar komponenten `null`.
 * Skälet är samma som för `OpsFact`: en tom `dd`, ett bindestreck eller ett
 * "[okänt]" ser ut som ett mätt värde när man skummar, och att veta noll och att
 * inte veta är motsatser. Vill appen SÄGA att något är okänt gör den det med
 * `OpsFact kind="okant"`, uttryckligen.
 *
 * ⛔ Noll är däremot ett värde och passerar: `0` filtreras aldrig bort.
 */

/**
 * @typedef {object} Attribut
 * @property {string} label
 * @property {import("react").ReactNode} value
 */

/**
 * @param {object} props
 * @param {Attribut[]} props.rows
 * @param {string} [props.ariaLabel] Vad listan beskriver, när sammanhanget inte redan säger det.
 */
export function OpsAttributes({ rows, ariaLabel }) {
  const synliga = (rows || []).filter((r) => r && r.label && r.value !== null && r.value !== undefined && r.value !== "");

  if (synliga.length === 0) return null;

  // ⛔ Kastar i stället för att rendera. Två rader med samma etikett påstår att
  // samma fält har två värden, och läsaren har ingen chans att avgöra vilket som
  // gäller. Det är dessutom nästan alltid ett riktigt fel i anropet (samma fält
  // hämtat ur två källor) och inte en avsiktlig upprepning.
  const sedda = new Set();
  for (const r of synliga) {
    if (sedda.has(r.label)) {
      throw new Error(
        `OpsAttributes: etiketten "${r.label}" finns två gånger. Samma fält kan inte ha två värden, och läsaren kan inte avgöra vilket som gäller.`,
      );
    }
    sedda.add(r.label);
  }

  return (
    <dl aria-label={ariaLabel} className="m-0 divide-y divide-divider rounded-md bg-sunken px-3 py-1">
      {synliga.map((r) => (
        // ⛔ `flex-wrap` och inte ett rutnät: ett långt värde ska gå ner under
        // sin etikett i stället för att pressa etiketten till tre tecken. Med
        // ett rutnät blev "Försäkringsgivare" till "Försäk..." så fort värdet
        // var en firmanamnsrad med organisationsnummer.
        <div key={r.label} className="flex flex-wrap gap-x-3 py-1">
          <dt className="min-w-32 text-sm text-ink-secondary">{r.label}</dt>
          <dd className="m-0 text-sm text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
