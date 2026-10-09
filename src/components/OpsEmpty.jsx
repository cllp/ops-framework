import { OpsSpinner } from "./OpsSpinner.jsx";

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
  return (
    <div
      // `status` + `polite`: skärmläsaren nämner det när den är klar med annat,
      // i stället för att avbryta. Tomhet är information, inte ett larm.
      role="status"
      aria-live="polite"
      aria-busy={busy || undefined}
      className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-sunken px-6 py-10 text-center"
    >
      {/* ⛔ Snurran är `decorative`. Ytan bär redan `role="status"` och
          `aria-busy`, så en annonserande snurra hade läst upp samma väntan två
          gånger. Den finns för ögat: utan den är "Hämtar" en stillastående rad
          som inte går att skilja från ett tomt tillstånd förrän man läst den,
          och det är precis den förväxlingen den här komponenten finns för. */}
      {busy ? <OpsSpinner size="lg" tone="accent" decorative /> : null}
      {!busy && icon ? (
        <span aria-hidden="true" className="mb-1 flex size-16 items-center justify-center rounded-full bg-accent/10 text-accent [&_svg]:size-7">
          {icon}
        </span>
      ) : null}
      <p className="m-0 text-brod font-semibold text-ink">{busy ? busyLabel : title}</p>
      {!busy && description ? <p className="m-0 max-w-prose text-brod text-ink-secondary">{description}</p> : null}
      {!busy && action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
