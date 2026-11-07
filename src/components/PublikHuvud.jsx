import { cx } from "../lib/cx.js";
import { OpsSprakProvider } from "./OpsSprak.jsx";
import { OpsThemeToggle } from "./OpsThemeToggle.jsx";
import { PublikSprakval } from "./PublikSprakval.jsx";

/**
 * Huvudet på en publik sida: gästens sida (`OpsGastSida`), en delad händelse (`OpsDeladHandelse`) och en delad post (`OpsDeladSida`). Appens märke till vänster, språket och
 * ljust eller mörkt till höger (0.201.0, cllp/ops-framework#544).
 *
 * ══ ⛔ ETT HUVUD, TRE SIDOR (CP 2026-11-07: "Se till att allt är enhetligt med gästinbjudan så att det är samma upplevelse för användaren") ══
 *
 * Före 0.201.0 hade gästens sida huvudet med språk och tema, händelsens sida ett eget huvud utan tema, och filens sida inget huvud alls (appens stora logga och "Delat via").
 * Nu är det samma komponent, så att de inte kan glida isär (regel 2). Temaväxlaren är appens egen (`OpsThemeToggle`), som i gästens huvud sedan 0.195.0.
 *
 * ⛔ `data-<namn>-huvud` OCH `data-<namn>-huvud-val` STÅR KVAR PER SIDA (`namn`: `gast`, `dh` eller `delad`), eftersom appar och prov läser dem.
 *
 * @param {object} props
 * @param {"gast" | "dh" | "delad"} props.namn Vilken sida, för datamärkena.
 * @param {string} props.aktivt Sidans språk, `sv` eller `en`.
 * @param {string} props.etikett Språkväljarens namn för skärmläsaren ("Språk", "Language").
 * @param {(sprak: string) => void} props.onVal Besökaren valde språk.
 * @param {import("react").ReactNode} [props.huvud] Appens märke.
 * @param {string} [props.spalt] Bredden, samma som sidans spalt. Förval `max-w-3xl`.
 */
export function PublikHuvud({ namn, aktivt, etikett, onVal, huvud, spalt = "max-w-3xl" }) {
  return (
    <header className="sticky top-0 z-10 border-b border-publik-ljus-text/10 bg-publik-ljus">
      <div className={cx("mx-auto flex h-12 w-full items-center justify-between gap-3 px-4", spalt)}>
        <div {...{ [`data-${namn}-huvud`]: "" }} className="flex min-w-0 items-center gap-2">
          {huvud}
        </div>
        <div {...{ [`data-${namn}-huvud-val`]: "" }} className="flex shrink-0 items-center gap-1">
          <PublikSprakval aktivt={aktivt} etikett={etikett} onVal={onVal} />
          {/* Ordet ("Utseende", "Appearance") läses ur språkets sammanhang: huvudet ligger utanför sidans egen `OpsSprakProvider`. */}
          <OpsSprakProvider sprak={aktivt}>
            <OpsThemeToggle />
          </OpsSprakProvider>
        </div>
      </div>
    </header>
  );
}
