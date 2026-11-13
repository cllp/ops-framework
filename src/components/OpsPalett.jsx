import { arHexfarg, palettStil } from "../lib/palett.js";

/**
 * En hubbs färger synligt i ett formulär: rutan bredvid ett färgfält och förhandsvisningen av en palett (0.218.0, cllp/lifehub.app#786).
 *
 * ⛔ VARFÖR HÄR OCH INTE I APPEN: båda behöver en färg som bara finns vid körning, alltså `style`, och appens ESLint fäller varje
 * `style` och varje hexsträng (de går förbi tokenkontraktet). Det är rätt regel för en app. En färg som en hubbadmin valt är just
 * det undantag som behöver ett hem, och hemmet är ramverket, där tokensystemet bor (`src/lib/palett.js`).
 *
 * ⛔ FÖRHANDSVISNINGEN ÄR RAMVERKETS EGNA KLASSER (`bg-canvas`, `bg-raised`, `text-ink`, `bg-accent`) i en ruta som bär palettens
 * token (`palettStil`), alltså samma härledning som hela appen får efter en sparning, och inte en bild av den.
 */

/**
 * Rutan bredvid ett färgfält. En färg som inte är `#rrggbb` ritas som en tom ruta med kant, aldrig i en gissad färg.
 * @param {{ farg: string | null | undefined }} props
 */
export function OpsFargruta({ farg }) {
  const ok = arHexfarg(farg);
  return (
    <span
      aria-hidden="true"
      data-fargruta={ok ? farg : ""}
      className="inline-block size-8 shrink-0 rounded-base border border-line"
      style={ok ? { backgroundColor: /** @type {string} */ (farg) } : undefined}
    />
  );
}

/**
 * Förhandsvisningen av en palett i ett tema: sidans bakgrund, ett kort med rubrik och detalj, en linje och en knapp i accenten.
 * Texterna är appens. Rutan är dekoration för skärmläsaren (`aria-hidden`): det som avgör är granskningens meningar, som står i text.
 * @param {{ palett: import("../lib/palett.js").Palett, lage: import("../lib/palett.js").Palettlage, rubrik: string, detalj: string, knapp: string }} props
 */
export function OpsPalettForhandsvisning({ palett, lage, rubrik, detalj, knapp }) {
  return (
    <div aria-hidden="true" data-forhandsvisning={lage} style={/** @type {import("react").CSSProperties} */ (palettStil(palett, lage))} className="rounded-card border border-line bg-canvas p-4">
      <div className="flex flex-col gap-3 rounded-card bg-raised p-4 shadow-sm">
        <p className="m-0 text-etikett font-medium text-ink">{rubrik}</p>
        <p className="m-0 text-meta text-ink-secondary">{detalj}</p>
        <div className="h-px bg-line" />
        <div>
          <span className="inline-flex min-h-9 items-center rounded-base bg-accent px-4 text-etikett font-medium text-accent-contrast">{knapp}</span>
        </div>
      </div>
    </div>
  );
}
