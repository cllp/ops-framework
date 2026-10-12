import { useId } from "react";
import { cx } from "../lib/cx.js";
import { PUBLIK_KNAPP, PUBLIK_TONER } from "../lib/publikKlass.js";

/**
 * Innehållsblock och uppmaning för publika sidor (0.94.0, CP 2026-10-12), efter SessionStudios `LandingFeatureBlock` och
 * `LandingCtaBlock`.
 *
 * ══ ⛔ VARIATIONEN KOMMER AV TONERNA, INTE AV FLER KOMPONENTER ══════════════════════════════════════════════════════
 *
 * CP: "Kolla färgerna i sessionstudio. Känns mer intressant och varierande." Förklaringen är inte fler sorters block.
 * Det är ETT block som växlar mellan tre toner (`ljus`, `accent`, `mork`), med bilden på växlande sida, och en hjälte med
 * ett foto under en mörk toning. Varje tonfärg är en brandvariabel (`--color-publik-*`), så SessionStudio blir en instans
 * genom `examples/brand/sessionstudio.css`.
 *
 * ⛔ BILDEN ÄR INNEHÅLL, INTE RAMVERK. Ramverket levererar inga bilder: `bild` är en `{ src, alt }` som sidan skickar in,
 * och `figur` är en plats för en SVG eller ett diagram i stället för ett foto (Life Hub har figurer, inga foton).
 */

/**
 * @typedef {{ src: string, alt: string, srcSet?: string, sizes?: string, width?: number, height?: number }} PubliktBild
 */

/**
 * Bilden i ett block: ett foto med tonad kant, eller en figur på en lätt panel.
 * @param {{ bild?: PubliktBild, figur?: import("react").ReactNode, ton: keyof typeof PUBLIK_TONER }} props
 */
function Bildyta({ bild, figur, ton }) {
  const t = PUBLIK_TONER[ton];
  return (
    <div
      data-publik-bild=""
      className={cx("relative m-4 min-h-70 flex-1 overflow-hidden rounded-3xl sm:m-6 sm:min-h-90 lg:m-8 lg:min-h-105", !bild && t.panel)}
    >
      {bild ? (
        <>
          <img
            src={bild.src}
            srcSet={bild.srcSet}
            sizes={bild.sizes}
            alt={bild.alt}
            width={bild.width}
            height={bild.height}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <div className={cx("absolute inset-0", t.toning)} aria-hidden="true" />
        </>
      ) : (
        <div className={cx("absolute inset-0 flex items-center justify-center p-6", t.rubrik)}>{figur}</div>
      )}
    </div>
  );
}

/**
 * Ett innehållsblock: överrad, serifrubrik, kort text, en handling och en bild bredvid.
 *
 * @param {object} props
 * @param {"ljus"|"accent"|"mork"} [props.ton] Bandets ton: `ljus` (förval), `accent` (hela bandet i accentfärgen) eller `mork`.
 * @param {import("react").ReactNode} props.title Blockets rubrik, en `<h2>`.
 * @param {import("react").ReactNode} [props.eyebrow] Överraden.
 * @param {import("react").ReactNode} [props.children] Texten, ett eller två stycken. Ritas i läsbredd (65ch) och i tonens brödfärg.
 * @param {{ href: string, label: string }} [props.handling] EN handling, en kantad knapp i tonens färg.
 * @param {PubliktBild} [props.bild] Fotot. Skickas in av sidan; ramverket levererar inga bilder.
 * @param {import("react").ReactNode} [props.figur] En figur (SVG, diagram) i stället för ett foto. Används när `bild` saknas.
 * @param {"hoger"|"vanster"} [props.bildSida] Vilken sida bilden ligger på från `lg`. Förval `hoger`; SessionStudio växlar per block.
 */
export function OpsPublikBlock({ ton = "ljus", title, eyebrow, children, handling, bild, figur, bildSida = "hoger" }) {
  const rubrikId = useId();
  const t = PUBLIK_TONER[ton];
  if (!t) throw new Error(`OpsPublikBlock: okänd ton "${ton}". Giltiga: ${Object.keys(PUBLIK_TONER).join(", ")}.`);
  if (bildSida !== "hoger" && bildSida !== "vanster") throw new Error(`OpsPublikBlock: okänd bildSida "${bildSida}". Giltiga: hoger, vanster.`);
  const harBild = Boolean(bild) || figur !== undefined;
  const text = (
    <div className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      {eyebrow ? <p className={cx("m-0 mb-3 text-publik-eyebrow uppercase", t.overrad)}>{eyebrow}</p> : null}
      <h2 id={rubrikId} className={cx("m-0 font-display-publik text-publik-block", t.rubrik)}>
        {title}
      </h2>
      {children ? <div className={cx("mt-4 flex max-w-las flex-col gap-3 text-publik-brod", t.brod)}>{children}</div> : null}
      {handling ? (
        <a href={handling.href} className={cx(PUBLIK_KNAPP.bas, PUBLIK_KNAPP.kant, "mt-8 w-fit", t.kantknapp)}>
          {handling.label}
        </a>
      ) : null}
    </div>
  );
  const bildyta = harBild ? <Bildyta bild={bild} figur={figur} ton={ton} /> : null;
  return (
    <section data-ops-publik="block" data-ton={ton} aria-labelledby={rubrikId} className={t.band}>
      <div className={cx("mx-auto flex max-w-7xl flex-col lg:items-stretch", bildSida === "vanster" ? "lg:flex-row-reverse" : "lg:flex-row")}>
        {text}
        {bildyta}
      </div>
    </section>
  );
}

/**
 * Uppmaningen: ett band i accentfärgen med rubrik, text och två knappar, centrerat. SessionStudios `LandingCtaBlock`.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.title
 * @param {import("react").ReactNode} [props.children] Texten under rubriken.
 * @param {{ href: string, label: string }} props.primar Den fyllda knappen.
 * @param {{ href: string, label: string }} [props.sekundar] Den kantade knappen.
 */
export function OpsPublikUppmaning({ title, children, primar, sekundar }) {
  const rubrikId = useId();
  return (
    <section data-ops-publik="uppmaning" aria-labelledby={rubrikId} className="bg-publik-accentband px-4 py-16 text-publik-mork-text sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
        <h2 id={rubrikId} className="m-0 max-w-3xl font-display-publik text-publik-block text-publik-mork-text">
          {title}
        </h2>
        {children ? <p className="m-0 mt-4 max-w-las text-publik-ingress text-publik-mork-text">{children}</p> : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a href={primar.href} className={cx(PUBLIK_KNAPP.bas, "bg-publik-mork-text px-8 py-3 text-publik-mork hover:bg-publik-mork-text/90")}>
            {primar.label}
          </a>
          {sekundar ? (
            <a href={sekundar.href} className={cx(PUBLIK_KNAPP.bas, PUBLIK_KNAPP.kantPaBild)}>
              {sekundar.label}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
