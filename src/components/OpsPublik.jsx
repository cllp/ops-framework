import { useId } from "react";
import { cx } from "../lib/cx.js";
import { PUBLIK_KLASS, PUBLIK_KNAPP, PUBLIK_TONER } from "../lib/publikKlass.js";

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
 * @typedef {{ src: string, alt: string, srcSet?: string, sizes?: string, width?: number, height?: number }} PubliktBild
 */

/**
 * Hjälten: sidans enda `<h1>`, med överrad, ingress, målgrupp och handlingar.
 *
 * Utan `bild` är den en ljus hjälte på sidans band (en innehållssida). MED `bild` är den SessionStudios startsidehjälte:
 * fotot i full bredd under en mörk toning (`--color-publik-toning`), texten längst ned till vänster i det mörka bandets
 * färger, överraden i accent, rubriken i serif och två knappar, en accentknapp och en kantad.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.title Sidans rubrik. Det enda som är obligatoriskt: en sida utan rubrik har ingen hjälte.
 * @param {import("react").ReactNode} [props.eyebrow] Överraden: ett eller två ord som placerar sidan ("Om oss").
 * @param {import("react").ReactNode} [props.ingress] Ett stycke som säger vad sidan är, i läsbredd. Inte tre.
 * @param {import("react").ReactNode} [props.malgrupp] En rad om vem sidan är till för, under ingressen.
 * @param {PubliktBild} [props.bild] Fotot. Skickas in av sidan; ramverket levererar inga bilder. Alt-texten är obligatorisk.
 * @param {{ href: string, label: string }} [props.primar] Accentknappen.
 * @param {{ href: string, label: string }} [props.sekundar] Den kantade knappen.
 * @param {import("react").ReactNode} [props.children] Egna handlingar, ritade efter `primar` och `sekundar`.
 * @param {boolean} [props.centrerad] Centrerad hjälte utan bild (en innehållssida) i stället för vänsterställd.
 */
export function OpsPublikHjalte({ title, eyebrow, ingress, malgrupp, bild, primar, sekundar, children, centrerad = false }) {
  const rubrikId = useId();
  const harHandlingar = Boolean(primar || sekundar || children);
  const knappar = (
    <>
      {primar ? (
        <a href={primar.href} className={cx(PUBLIK_KNAPP.bas, PUBLIK_KNAPP.primar)}>
          {primar.label}
        </a>
      ) : null}
      {sekundar ? (
        <a href={sekundar.href} className={cx(PUBLIK_KNAPP.bas, bild ? PUBLIK_KNAPP.kantPaBild : cx(PUBLIK_KNAPP.kant, PUBLIK_TONER.ljus.kantknapp))}>
          {sekundar.label}
        </a>
      ) : null}
      {children}
    </>
  );

  if (bild) {
    if (!bild.alt) throw new Error("OpsPublikHjalte: bild kräver alt. Är bilden ren dekor, skicka ingen bild.");
    return (
      <header data-ops-publik="hjalte" data-med-bild="" aria-labelledby={rubrikId} className="relative isolate min-h-[min(85vh,760px)] w-full overflow-hidden bg-publik-mork text-publik-mork-text">
        <img
          src={bild.src}
          srcSet={bild.srcSet}
          sizes={bild.sizes}
          alt={bild.alt}
          width={bild.width}
          height={bild.height}
          className="absolute inset-0 size-full object-cover"
          decoding="async"
        />
        <div className="ops-publik-hjaltetoning absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[min(85vh,760px)] max-w-7xl flex-col justify-end gap-5 px-4 pt-28 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          {eyebrow ? <p className="m-0 text-publik-eyebrow uppercase text-publik-mork-markering">{eyebrow}</p> : null}
          <h1 id={rubrikId} className="m-0 max-w-4xl font-display-publik text-publik-rubrik text-publik-mork-text">
            {title}
          </h1>
          {ingress ? <p className="m-0 max-w-2xl text-publik-ingress text-publik-mork-text/88">{ingress}</p> : null}
          {malgrupp ? <p className="m-0 -mt-2 max-w-2xl text-etikett text-publik-mork-text/70">{malgrupp}</p> : null}
          {harHandlingar ? <div className="mt-3 flex flex-wrap items-center gap-4">{knappar}</div> : null}
        </div>
      </header>
    );
  }

  // Innehållssidans hjälte (SS `HowItWorksPage.jsx:358`): `pt-20 sm:pt-28 lg:pt-32 pb-12`, en kolumn i `max-w-3xl`, rubriken 36 px
  // (48 från `sm`) och ingressen `mt-5`. Fotohjältens 56 px finns inte här.
  return (
    <header data-ops-publik="hjalte" aria-labelledby={rubrikId} className="px-4 pt-20 pb-12 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
      <div className={cx("mx-auto max-w-3xl", centrerad && "text-center")}>
        {eyebrow ? <p className={cx(PUBLIK_KLASS.eyebrow, "mb-3")}>{eyebrow}</p> : null}
        <h1 id={rubrikId} className={PUBLIK_KLASS.sida}>
          {title}
        </h1>
        {ingress ? <p className={cx(PUBLIK_KLASS.brod, "mt-5")}>{ingress}</p> : null}
        {malgrupp ? <p className="m-0 mt-3 text-etikett text-publik-ljus-dampad">{malgrupp}</p> : null}
        {harHandlingar ? <div className={cx("mt-8 flex flex-wrap items-center gap-4", centrerad && "justify-center")}>{knappar}</div> : null}
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
 * @param {import("react").ReactNode} [props.ingress] Ett stycke under rubriken, `max-w-3xl`.
 * @param {import("react").ReactNode} [props.children] Avsnittets innehåll: `OpsPublikText`, ett kort, en lista. Ritas under rubriken.
 * @param {boolean} [props.centrerad]
 */
export function OpsPublikAvsnitt({ title, eyebrow, ingress, children, centrerad = false }) {
  const rubrikId = useId();
  // SS `HowItWorksPage.jsx:69` (`SectionShell`): en behållare i `max-w-[1080px]` med 16/24/32 px sidomarginal, överraden `mb-3`,
  // ingressen `mt-5 max-w-3xl`. Luften mellan avsnitten ägs av ramverkets CSS (`.ops-ramverk`-lagret i tokens.css), inte av anroparen.
  return (
    <section data-ops-publik="avsnitt" aria-labelledby={rubrikId} className="px-4 sm:px-6 lg:px-8">
      <div className={cx("mx-auto max-w-270", centrerad && "text-center")}>
        {eyebrow ? <p className={cx(PUBLIK_KLASS.eyebrow, "mb-3")}>{eyebrow}</p> : null}
        <h2 id={rubrikId} className={PUBLIK_KLASS.avsnitt}>
          {title}
        </h2>
        {ingress ? <p className={cx(PUBLIK_KLASS.brod, "mt-5 max-w-3xl", centrerad && "mx-auto")}>{ingress}</p> : null}
        {children ? <div className={cx("mt-6 flex flex-col gap-4", centrerad && "items-center")}>{children}</div> : null}
      </div>
    </section>
  );
}

/**
 * Löptext i `max-w-3xl` (SS HowItWorksPage): ett stycke. Flera stycken är flera anrop.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 */
export function OpsPublikText({ children }) {
  return (
    <p data-ops-publik="text" className={cx(PUBLIK_KLASS.brod, "max-w-3xl")}>
      {children}
    </p>
  );
}
