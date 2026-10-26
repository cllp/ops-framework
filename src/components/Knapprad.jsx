import { cx } from "../lib/cx.js";
import { OpsButton } from "./OpsButton.jsx";

/**
 * Knappraden längst ned i panelen för en rad (0.145.0, cllp/ops-framework#446): källans knappar och Dela, på samma ställe på varje rad.
 *
 * ══ ⛔ ALLTID PÅ SAMMA STÄLLE (CP 2026-10-25: "en knapprad som alltid står på samma ställe") ═══════════════════════════
 *
 * Raden är panelens sista element och ligger fast i botten av ytan som rullar (`sticky bottom-0`, med panelen `min-h-full` så att den hamnar längst ned
 * också när innehållet är kort). En påminnelse med en rad text och en faktura med sju fakta har alltså sina knappar på exakt samma ställe, och en lång
 * beskrivning knuffar dem inte ur bild. Dela står SIST i raden, alltid: de andra knapparna är källans, Dela är ramverkets, och den som lärt sig var
 * Dela sitter ska inte behöva leta efter den när källan byts.
 *
 * ⛔ DELA FINNS PÅ ALLA RADER (arbetsreglernas punkt 5, tomhet är ett svar). Går raden att dela är det en knapp. Går den inte det står skälet i klartext ovanför
 * knapparna, med vad man gör i stället, och ingen död knapp ritas: en spärrad knapp på en telefon går inte att trycka på för att få veta varför, så skälet
 * ligger framme som text. Skälet är appens (`skal`), eftersom bara appen vet varför en faktura inte delas.
 *
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/radkallor.js").Atgard>} props.atgarder
 * @param {import("../lib/radkallor.js").Delning} props.dela Svaret på om raden går att dela, redan avgjort (`losKnapprad`, och ramverkets förvalda skäl när källan inte svarat).
 * @param {{ etikett: string, delaEtikett: string, delaSkalForord: string, delaIstalletForord: string }} props.ord
 */
export function Knapprad({ atgarder, dela, ord }) {
  const kanDela = dela.skal === undefined;
  return (
    <div
      data-knapprad=""
      className={cx(
        "sticky bottom-0 z-(--z-sticky) mt-auto flex flex-col gap-2 border-t border-line bg-canvas pt-3 pb-[max(0.75rem,var(--safe-bottom,0px))]",
        // Panelens kolumn har `px-4`: raden går ut till kanterna så att linjen och bakgrunden täcker hela bredden, och innehållet står kvar i kolumnen.
        "-mx-4 px-4",
      )}
    >
      {kanDela ? null : (
        <p data-knapprad-skal="" className="m-0 text-meta text-ink-secondary wrap-anywhere">
          <span className="font-medium text-ink">{ord.delaSkalForord}</span> {dela.skal}
          {dela.istallet ? (
            <>
              {" "}
              <span className="font-medium text-ink">{ord.delaIstalletForord}</span> {dela.istallet}
            </>
          ) : null}
        </p>
      )}
      <div role="group" aria-label={ord.etikett} data-knapprad-knappar="" className="flex flex-wrap items-center gap-2">
        {atgarder.map((a) => (
          <OpsButton key={a.id} variant="secondary" size="sm" href={a.href} newTab={a.nyFlik === true} onClick={a.onClick}>
            {a.ikon ? (
              <span aria-hidden="true" className="flex shrink-0 items-center">
                {a.ikon}
              </span>
            ) : null}
            {a.etikett}
          </OpsButton>
        ))}
        {kanDela ? (
          <OpsButton variant="secondary" size="sm" href={dela.href} newTab={dela.nyFlik === true} onClick={dela.onClick}>
            {ord.delaEtikett}
          </OpsButton>
        ) : null}
      </div>
    </div>
  );
}
