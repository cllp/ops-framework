import { cx } from "../lib/cx.js";

/**
 * Vyskalet. Varje sida i en ops-app ligger i en av dessa.
 *
 * ⛔ Botten-paddingen räknar in `--safe-bottom`. Utan den hamnar den sista
 * raden i en lista under hemknappsstapeln på en telefon, och det syns bara på
 * riktig hårdvara. Att sidan ser rätt ut i en desktop-webbläsare bevisar
 * ingenting om detta.
 *
 * ⛔ Bredden är en av tre, inte fri. "Lite bredare på den här sidan" upprepat
 * tio gånger är exakt hur en produkt slutar kännas som en produkt.
 */

const BREDDER = {
  narrow: "max-w-2xl",
  normal: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

/**
 * @param {object} props
 * @param {"narrow"|"normal"|"wide"|"full"} [props.width]
 * @param {import("react").ReactNode} props.children
 */
export function OpsView({ width = "normal", children }) {
  const breddKlass = BREDDER[width];
  if (!breddKlass) {
    throw new Error(`OpsView: okänd width "${width}". Giltiga: ${Object.keys(BREDDER).join(", ")}.`);
  }
  return (
    <div
      className={cx(
        "mx-auto w-full px-4 pt-6",
        // Minst 16 px sidomarginal vid varje bredd, och säker yta i botten.
        "pb-[calc(--spacing(6)+var(--safe-bottom))]",
        breddKlass,
      )}
    >
      {children}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {import("react").ReactNode} [props.actions] Knappar till höger om rubriken.
 */
export function OpsViewHeader({ title, description, actions }) {
  return (
    // `flex-wrap` är inte kosmetik: utan den trycks knapparna ut ur skärmen på
    // telefon och blir onåbara. Raden bryter i stället för att svämma över.
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="m-0 text-xl font-bold leading-tight tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-base text-ink-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
