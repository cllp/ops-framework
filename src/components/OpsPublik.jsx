import { useId } from "react";
import { cx } from "../lib/cx.js";
import { PUBLIK_KLASS } from "../lib/publikKlass.js";

/**
 * Byggstenarna för en PUBLIK sida: hjälten, avsnittet och löptexten (0.94.0, CP 2026-10-12).
 *
 * ══ ⛔ EN IDÉ PER BLOCK ═══════════════════════════════════════════════════
 *
 * CP om life-hub.app:s publika sidor: "allt i fetstil, långa rader och för mycket per yta". SessionStudios landningssidor
 * (`LandingHero`, `LandingFeatureBlock`) bär en överrad, en rubrik, en ingress och högst en handling per block, med
 * luft emellan. Komponenterna här har samma form och TILLÅTER inte mer: rubriken är EN sträng, ingressen EN, och
 * handlingarna (`children`) är knappar och länkar, inte ett nytt avsnitt. Behöver sidan sägas mer är det ett nytt block.
 *
 * Typografin kommer ur `lib/publikKlass.js` och därmed ur rollerna `text-publik-*` (`typografi.publik` i profilen):
 * rubrikerna i `--font-display-publik` (serif, vikt 500), brödtexten i `--font-sans` och aldrig fetare än 400. Ingen
 * komponent skriver en storlek.
 *
 * Båda blocken är ramverkets bredd (`max-w-7xl`, 16/24/32 px sidomarginal) och lägger sin egen lodräta luft; sidan
 * skriver inget `padding` runt dem. De tar ingen `className`: en publik sida som vill se ut på ett annat sätt ändrar
 * instansens brandfil (`docs/brand.md`), inte blocken.
 */

/**
 * Hjälten: sidans enda `<h1>`, med överrad, ingress och handlingar.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.title Sidans rubrik. Det enda som är obligatoriskt: en sida utan rubrik har ingen hjälte.
 * @param {import("react").ReactNode} [props.eyebrow] Överraden: ett eller två ord som placerar sidan ("Om oss").
 * @param {import("react").ReactNode} [props.ingress] Ett stycke som säger vad sidan är, i läsbredd. Inte tre.
 * @param {import("react").ReactNode} [props.children] Handlingarna, knappar eller länkar. Högst en primär.
 * @param {boolean} [props.centrerad] Centrerad hjälte (en innehållssida) i stället för vänsterställd (en startsida).
 */
export function OpsPublikHjalte({ title, eyebrow, ingress, children, centrerad = false }) {
  const rubrikId = useId();
  return (
    <header data-ops-publik="hjalte" aria-labelledby={rubrikId} className="px-4 pt-12 pb-10 sm:px-6 sm:pt-16 lg:px-8 lg:pt-24 lg:pb-16">
      <div className={cx("mx-auto flex max-w-7xl flex-col gap-5", centrerad && "items-center text-center")}>
        {eyebrow ? <p className={PUBLIK_KLASS.eyebrow}>{eyebrow}</p> : null}
        <h1 id={rubrikId} className={PUBLIK_KLASS.hjalte}>
          {title}
        </h1>
        {ingress ? <p className={PUBLIK_KLASS.ingress}>{ingress}</p> : null}
        {children ? <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div> : null}
      </div>
    </header>
  );
}

/**
 * Ett avsnitt: en `<section>` med överrad, `<h2>`, ingress och innehåll.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.title Avsnittets rubrik.
 * @param {import("react").ReactNode} [props.eyebrow] Överraden.
 * @param {import("react").ReactNode} [props.ingress] Ett stycke under rubriken, i läsbredd.
 * @param {import("react").ReactNode} [props.children] Avsnittets innehåll: `OpsPublikText`, ett kort, en lista. Ritas under rubriken.
 * @param {boolean} [props.centrerad]
 */
export function OpsPublikAvsnitt({ title, eyebrow, ingress, children, centrerad = false }) {
  const rubrikId = useId();
  return (
    <section data-ops-publik="avsnitt" aria-labelledby={rubrikId} className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
      <div className={cx("mx-auto flex max-w-7xl flex-col gap-4", centrerad && "items-center text-center")}>
        {eyebrow ? <p className={PUBLIK_KLASS.eyebrow}>{eyebrow}</p> : null}
        <h2 id={rubrikId} className={PUBLIK_KLASS.avsnitt}>
          {title}
        </h2>
        {ingress ? <p className={PUBLIK_KLASS.ingress}>{ingress}</p> : null}
        {children ? <div className={cx("mt-4 flex flex-col gap-4", centrerad && "items-center")}>{children}</div> : null}
      </div>
    </section>
  );
}

/**
 * Löptext i läsbredd (65ch): ett stycke. Flera stycken är flera anrop.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 */
export function OpsPublikText({ children }) {
  return (
    <p data-ops-publik="text" className={PUBLIK_KLASS.brod}>
      {children}
    </p>
  );
}
