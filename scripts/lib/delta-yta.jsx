import { createRoot } from "react-dom/client";
import * as Ops from "OPS_DIST";

/**
 * Ytan för skärmbilden av gästens sida för en händelse (0.146.0, cllp/ops-framework#445, skiva 1): `OpsGastSida` med en delta-inbjudan, som lifehub.app skulle rita den. Allt är syntetiskt:
 * en session sparad på enheten, en händelse och ett `onSvara` med minne som svarar som tjänsten gör. Vilket läge som ritas kommer från `window.__delta` (`{ sprak, mitt }`).
 */

const SESSION = "S".repeat(43);
const ID = "a".repeat(64);

const HANDELSE = { titel: "Årsmöte med fika", plats: "Hembygdsgården, Visby", datum: "2026-12-02", slutDatum: null, tid: "18:00", slutTid: "20:00", heldag: false };

function Yta() {
  const w = /** @type {any} */ (window);
  const lage = w.__delta ?? {};
  let mitt = lage.mitt ?? null;
  const lagring = (() => {
    const d = { "ops-gast:senaste": ID, [`ops-gast:${ID}`]: SESSION };
    return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; } };
  })();
  w.__deltaanrop = [];
  return (
    <Ops.OpsGastSida
      lank={null}
      lagring={lagring}
      intervallMs={0}
      sprak={lage.sprak ?? "sv"}
      huvud={<span className="text-publik-ingress font-semibold text-publik-ljus-text">LifeHub</span>}
      onLos={async () => ({ ok: false, orsak: "nej" })}
      onHamta={async () => ({ ok: true, namn: "Anna", funktion: "delta", delta: { handelse: HANDELSE, mitt } })}
      onNyLank={async () => ({ ok: true })}
      onNamn={async () => {}}
      onRaderaMig={async () => ({ ok: true })}
      onSvara={async ({ val }) => {
        w.__deltaanrop.push(val);
        mitt = val;
        return { ok: true, mitt: val };
      }}
    />
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
window.__redo = true;
