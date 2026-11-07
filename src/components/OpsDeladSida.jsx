import { useState } from "react";
import { cx } from "../lib/cx.js";
import { lasSparatSprak, sparaSprak, valdSprak } from "../lib/deladdatum.js";
import { forvalda } from "../lib/ord.js";
import { PUBLIK_TONER } from "../lib/publikKlass.js";
import { SPRAK } from "../lib/sprak.js";
import { ORD_OPSDELADHANDELSE } from "./OpsDeladHandelse.jsx";
import { OpsSprakProvider } from "./OpsSprak.jsx";
import { PublikHuvud } from "./PublikHuvud.jsx";

/**
 * Sidan runt en delad post (fil, anteckning, länk eller lista) på `/g/<grupp>/lib/<del>`: samma huvud och samma språk som en delad händelse och som gästens sida (0.201.0, cllp/ops-framework#544).
 *
 * ══ ⛔ VARFÖR SIDAN FINNS (CP 2026-11-07: "Se till att allt är enhetligt med gästinbjudan så att det är samma upplevelse för användaren") ══
 *
 * Före 0.201.0 ritade appen själv skalet runt `OpsDelad`: en stor logga, "Delat via" och ingen språkväljare, och filens sida var bara på svenska. Händelsens sida hade ett eget huvud
 * med SV och EN, och gästens sida ett tredje. Nu ritar ramverket sidan, med `PublikHuvud`, och innehållet (`OpsDelad`) läser språket ur sammanhanget.
 *
 * ══ ⛔ SPRÅKET I SAMMA ORDNING SOM GÄSTENS ═════════════════════════════════════════════════════════════════════════════
 *
 * Besökarens eget val (sparat i webbläsaren) går först. Sedan länkens språk (`lankSprak`, brevets språk när länken kom i ett brev), och sist webbläsarens. Ger appen `sprak` är det appens.
 *
 * @param {object} props
 * @param {import("react").ReactNode | ((sprak: "sv" | "en") => import("react").ReactNode)} props.children Innehållet, oftast `OpsDelad`. En funktion får sidans språk.
 * @param {import("react").ReactNode} [props.huvud] Appens märke, till vänster i huvudet.
 * @param {string} [props.sprak] Språket om appen styr det.
 * @param {(sprak: string) => void} [props.onSprak] Anropas när besökaren väljer språk.
 * @param {string | null} [props.lankSprak] Länkens språk (`sv` eller `en`), när länken bär ett. Ett okänt värde hoppas över.
 */
export function OpsDeladSida({ children, huvud, sprak, onSprak, lankSprak }) {
  if (onSprak !== undefined && typeof onSprak !== "function") throw new Error("OpsDeladSida: onSprak ska vara en funktion.");
  if (sprak !== undefined && !(/** @type {readonly string[]} */ (SPRAK).includes(sprak))) {
    throw new Error(`OpsDeladSida: språket ${JSON.stringify(sprak)} finns inte (giltiga: ${SPRAK.join(", ")}).`);
  }
  const lank = typeof lankSprak === "string" && /** @type {readonly string[]} */ (SPRAK).includes(lankSprak) ? lankSprak : undefined;
  const [valt, setValt] = useState(() =>
    valdSprak({ sparat: lasSparatSprak(), webblasare: lank ?? (typeof navigator === "undefined" ? undefined : navigator.language) }),
  );
  const aktivt = /** @type {"sv" | "en"} */ (sprak ?? valt);
  const t = forvalda(ORD_OPSDELADHANDELSE, aktivt);

  /** @param {string} s */
  function valj(s) {
    if (sprak === undefined) setValt(/** @type {"sv" | "en"} */ (s));
    sparaSprak(s);
    if (onSprak) onSprak(s);
  }

  return (
    <div lang={aktivt} data-deladsida="" data-sprak={aktivt} className={cx("flex min-h-dvh w-full flex-col", PUBLIK_TONER.ljus.band, PUBLIK_TONER.ljus.rubrik)}>
      <PublikHuvud namn="delad" aktivt={aktivt} etikett={t.sprakEtikett} onVal={valj} huvud={huvud} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-16 sm:pt-12">
        <OpsSprakProvider sprak={aktivt}>{typeof children === "function" ? children(aktivt) : children}</OpsSprakProvider>
      </main>
    </div>
  );
}
