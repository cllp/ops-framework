import { useRef } from "react";
import { cx } from "../lib/cx.js";
import { FULL_HEIGHT_CLASSES, useFullHeight } from "../lib/fullHeight.js";

/**
 * En yta som rullar i sig själv, hela vägen ner till skärmens underkant.
 *
 * ══ ⛔ VAD DEN LÖSER ═══════════════════════════════════════════════════
 *
 * CP 2026-09-22, med bild: "Filterraden är fast i kalendervyn men den scrollar i
 * listvyn. Låt listvyn fungera precis som kalendervyn."
 *
 * Kalendern rullar i sin egen behållare, så verktygsraden ovanför står still.
 * Listan rullade sidan, så raden försvann uppåt. Skillnaden var inte ett beslut
 * utan en tillfällighet: kalendern hade fått en egen rullyta av ett annat skäl.
 *
 * ⛔ DEN GÖR INGENTING ANNAT ÄN ATT RULLA. Ingen ram, ingen rundning, ingen
 * bakgrund. En yta som når skärmens underkant och har en ram läses som en ruta
 * som blivit avhuggen, och innehållet ska se ut som sidan och inte som en låda.
 *
 * ⛔ ÖVERSKOTTET I BOTTEN ÄR AVSIKTLIGT. `pb-6` gör att sista raden går att
 * rulla fram ovanför bottenradens kant i stället för att ligga tätt mot den.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 */
export function OpsScrollArea({ children }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  const stil = useFullHeight(ref);

  return (
    <div ref={ref} style={stil} className={cx("relative", FULL_HEIGHT_CLASSES, "pb-6")}>
      {children}
    </div>
  );
}
