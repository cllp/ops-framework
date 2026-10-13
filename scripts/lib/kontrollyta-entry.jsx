import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

/**
 * Mätytan för `check-kontrollyta.mjs` (0.95.1): rullande listor på ramverkets tre ytor och en väljare i Identitys bredd.
 *
 * ⛔ YTORNA ÄR DE LISTEN FAKTISKT STÅR PÅ. Idags ruta är `bg-surface`, panelens rader `bg-raised` och sidan själv `bg-canvas`.
 * Felet i 0.95.0 syntes mest i Idags ruta i mörkt läge, så den finns med som den är och inte som en generisk låda.
 */

const { OpsField, OpsSelect } = Ops;

const RADER = Array.from({ length: 24 }, (_, i) => `Post ${i + 1}: Riksbyggen höjde avgiften`);

/** @param {{ yta: string, namn: string }} p */
function Lista({ yta, namn }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="m-0 text-xs text-ink-secondary">{namn}</p>
      <div data-rullyta={namn} className={`${yta} h-56 overflow-auto rounded-base border border-line p-2`}>
        {RADER.map((r) => (
          <p key={r} className="m-0 py-1 text-sm text-ink">
            {r}
          </p>
        ))}
      </div>
    </div>
  );
}

function Yta() {
  const [lev, setLev] = useState(undefined);
  return (
    <div data-yta="" className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <Lista yta="bg-canvas" namn="canvas" />
        <Lista yta="bg-surface" namn="surface" />
        <Lista yta="bg-raised" namn="raised" />
      </div>
      {/* ⛔ 640 PX, IDENTITYS FÄLT. Listan var cirka 150 px där, bara så bred som "Annan / custom". */}
      <div data-valjare="" className="w-full max-w-[640px] rounded-base bg-surface p-4">
        <OpsField label="Leverantör" required>
          <OpsSelect
            value={lev}
            onChange={setLev}
            placeholder="Välj leverantör…"
            options={["OpenAI", "Anthropic", "Google AI", "Cursor", "xAI", "Annan / custom"].map((n) => ({ value: n, label: n }))}
          />
        </OpsField>
      </div>
    </div>
  );
}

createRoot(/** @type {HTMLElement} */ (document.getElementById("root"))).render(<Yta />);
