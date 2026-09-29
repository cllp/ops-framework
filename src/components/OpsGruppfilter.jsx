import { cx } from "../lib/cx.js";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { BockIkon } from "./icons.jsx";
import { text } from "../lib/sprak.js";

/**
 * Gruppfiltret: kryssa bort en grupp ur en ihopslagen vy.
 *
 * ══ ⛔ VARFÖR ETT FILTER OCH INTE BARA VÄLJAREN (#139) ═════════════════
 *
 * Väljaren har tre lägen för tre grupper: alla, eller en i taget. Filtret har
 * åtta. Frågan "allt utom bolaget" går inte att ställa med en väljare, och det
 * är precis den frågan man ställer när man samlat flera verksamheter i en app.
 *
 * ⛔ FILTRET GÄLLER BARA I LÄGET "alla", och det avgörs i `grupperAttFraga`,
 * inte här. Se noten där: ett filter i en vald grupp är ett sätt att få en tom
 * vy utan att förstå varför.
 *
 * ⛔ ATT KRYSSA BORT ALLA ÄR TILLÅTET, och vyn blir då tom med sin egen
 * tomhetstext. Ett filter som hindrar det sista bortkrysset gör en kontroll som
 * ibland svarar och ibland inte, och den sortens tystnad är svårare att förstå
 * än en tom lista man själv orsakat. Räknaren säger hur många som är kvar.
 *
 * ⛔ UTAN RADIX, av samma skäl som väljaren: ett filter vars beslut ligger i en
 * popover är ett beslut jsdom inte kan trycka på.
 */

/**
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/grupp.js").Grupp>} props.grupper Mina, ur `minaGrupper`.
 * @param {ReadonlyArray<string>} props.bortkryssade Grupp-id som INTE ska frågas.
 * @param {(bortkryssade: string[]) => void} props.onAndra
 * @param {Record<string, number>} [props.antal] Rader per grupp, ur `raderPerGrupp`.
 * @param {string} [props.sprak]
 * @param {string} [props.ariaLabel]
 */
export function OpsGruppfilter({ grupper, bortkryssade, onAndra, antal, sprak, ariaLabel = "Grupper i vyn" }) {
  if (typeof onAndra !== "function") {
    throw new Error("OpsGruppfilter: onAndra krävs. Ett filter som inte kan ändras är en rad kryssrutor som ser ut att fungera.");
  }
  const mina = grupper ?? [];
  const bort = new Set(bortkryssade ?? []);

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
      {mina.map((g) => {
        const namn = text(g.namn, sprak);
        const med = !bort.has(g.id);
        const n = antal?.[g.id];
        return (
          <button
            key={g.id}
            type="button"
            aria-pressed={med}
            onClick={() => onAndra(med ? [...bort, g.id] : [...bort].filter((x) => x !== g.id))}
            className={cx(
              "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-etikett",
              "transition-colors duration-(--duration-fast) ease-standard",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              /*
               * ⛔ BOCKEN OCH INTE BARA FÄRGEN BÄR "med i vyn". Ett filter där
               * valet syns som en nyans är oläsbart för var tjugonde man, och
               * en filtrerad lista som ser ofiltrerad ut läses som komplett.
               */
              med ? "border-accent bg-sunken font-semibold text-ink" : "border-line text-ink-secondary hover:text-ink",
            )}
          >
            {med ? <BockIkon /> : <span className="size-4 shrink-0" aria-hidden="true" />}
            <OpsIdentity name={namn} seed={g.id} size="sm" />
            <span className="truncate">{namn}</span>
            {/* ⛔ Siffran skrivs ut även när den är noll: en grupp utan rader
                och en grupp som inte räknats ser annars likadana ut. */}
            {typeof n === "number" ? <span className="text-meta text-ink-secondary">{n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
