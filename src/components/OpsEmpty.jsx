import { OpsVantar } from "./OpsVantar.jsx";

/**
 * Tomt tillstånd, och laddning.
 *
 * ⛔ De två hör ihop och måste hållas isär. "Inga träffar" och "hämtar" ser
 * likadana ut för ögat, alltså en yta utan innehåll, men betyder motsatta
 * saker. En lista som visar "Inga kostnader" medan den laddar får användaren
 * att dra en slutsats om sin data som inte stämmer, och den slutsatsen är
 * omöjlig att ta tillbaka.
 *
 * Därför en enda komponent med ett `busy`-läge, i stället för två komponenter
 * som varje app får komma ihåg att växla mellan.
 *
 * ⛔ Texten säger vad som saknas OCH vad man gör åt det. "Inget hittades" utan
 * nästa steg är en återvändsgränd.
 */

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {import("react").ReactNode} [props.action]
 * @param {import("react").ReactNode} [props.icon] En ikon ovanför titeln, i en cirkel. Utan den ritas ingen.
 * @param {boolean} [props.busy] Hämtning pågår. Titeln annonseras som pågående i stället för som tomhet.
 * @param {string} [props.busyLabel]
 */
export function OpsEmpty({ title, description, action, icon = null, busy = false, busyLabel = "Hämtar" }) {
  const yta = "flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-sunken px-6 py-10 text-center";
  if (busy) {
    // ⛔ Väntan är `OpsVantar` (0.229.0, CP 2026-11-14: "progressbars som rör sig överallt där vi behöver vänta"). Förut stod här en
    // snurra över en stillastående rad. Ytan behåller sin form, så att den inte går att förväxla med en lista, men `role="status"` och
    // `aria-busy` bärs nu av `OpsVantar` och inte av ytan: två statusytor för samma väntan hade lästs upp två gånger.
    return (
      <div data-ops-empty="hamtar" className={yta}>
        <div className="w-full max-w-60">
          <OpsVantar text={busyLabel} />
        </div>
      </div>
    );
  }
  return (
    <div
      // `status` + `polite`: skärmläsaren nämner det när den är klar med annat,
      // i stället för att avbryta. Tomhet är information, inte ett larm.
      role="status"
      aria-live="polite"
      className={yta}
    >
      {icon ? (
        <span aria-hidden="true" className="mb-1 flex size-16 items-center justify-center rounded-full bg-accent/10 text-accent [&_svg]:size-7">
          {icon}
        </span>
      ) : null}
      <p className="m-0 text-etikett font-medium text-ink">{title}</p>
      {description ? <p className="m-0 max-w-prose text-meta text-ink-secondary">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
