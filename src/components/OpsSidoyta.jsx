import { cx } from "../lib/cx.js";

/**
 * Sidans innehållsbredd. Hubbar, Profil, Inställningar och andra kontosidor
 * använder samma yta, så sidan inte hoppar när man byter vy (lifehub.app#150).
 *
 * ⛔ BREDEN ÄR EN TOKEN, INTE EN PROP. `--ops-innehall-max` (och Tailwind
 * `max-w-innehall`) är samma tal som `OpsView` `width="normal"`. En sida som
 * sätter egen `max-width` återinför hoppet #150 beskrev. Vill man ha en annan
 * bredd är det `OpsView` med `narrow` / `wide` / `full`, inte en lokal override.
 *
 * ⛔ KLASSEN `.ops-sidoyta` FINNS OCKSÅ I tokens.css. Identity och andra ytor
 * som ännu ritar shell i vanlig HTML sätter den på behållaren. React-vägen är
 * den här komponenten, så markup och token aldrig glider isär.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 */
export function OpsSidoyta({ children }) {
  return <div data-ops-sidoyta="" className={cx("ops-sidoyta")}>{children}</div>;
}
