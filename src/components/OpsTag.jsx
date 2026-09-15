import { cx } from "../lib/cx.js";
import { identityTone } from "../lib/identity.js";
import { KryssIkon } from "./icons.jsx";

/**
 * Etikett för en kategori, alltså det bolag-ops kallar tag.
 *
 * ⛔ Den här komponenten finns för ett mätt problem. bolag-ops har i dag
 * TJUGOFEM handskrivna klasser: `.tag-pill--mat`, `--bil`, `--ica`,
 * `--systembolaget`, `--streaming` och så vidare. En klass per datavärde
 * betyder att varje ny kategori kräver en kodändring, att ingen kan säga vilka
 * som finns utan att läsa CSS:en, och att de tjugofem färgerna valdes en och en
 * utan att någon såg dem tillsammans.
 *
 * Här härleds tonen i stället ur etiketten, deterministiskt. Ny kategori kräver
 * ingen kod alls, och paletten är sex toner som är valda ihop.
 *
 * ⛔ Och nej, det motsäger inte regeln i `OpsIdentity` om att aldrig härleda
 * färg ur ett namn. Skillnaden är vad namnet ÄR. En persons namn är en
 * egenskap som kan rättas, och då byter personen färg. En kategorietikett är
 * själva nyckeln: byter den namn är det en annan kategori.
 */

const TONKLASSER = {
  1: "bg-identity-1/12 text-identity-1",
  2: "bg-identity-2/12 text-identity-2",
  3: "bg-identity-3/12 text-identity-3",
  4: "bg-identity-4/12 text-identity-4",
  5: "bg-identity-5/12 text-identity-5",
  6: "bg-identity-6/12 text-identity-6",
};

/**
 * @param {object} props
 * @param {string} props.label
 * @param {() => void} [props.onRemove]
 * @param {string} [props.removeLabel] Skärmläsarnamn på bort-knappen. Ska säga VILKEN etikett.
 */
export function OpsTag({ label, onRemove, removeLabel }) {
  if (!label) throw new Error("OpsTag: label krävs. Den är både texten och nyckeln som bestämmer tonen.");

  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full py-1 text-xs font-semibold leading-tight", TONKLASSER[identityTone(label)], onRemove ? "pl-3 pr-1" : "px-3")}>
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          // ⛔ Utan etikettnamnet läser skärmläsaren upp "ta bort" tio gånger i
          // rad utan att säga vad som tas bort.
          aria-label={removeLabel ?? `Ta bort ${label}`}
          className="inline-flex size-5 items-center justify-center rounded-full hover:bg-ink/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <KryssIkon size={12} />
        </button>
      ) : null}
    </span>
  );
}
