import { useLayoutEffect, useRef } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import { modulLage } from "../lib/hubb.js";
import { FLIKIKON, FLIKOMSLAG, FLIKRAD, flikKlass, rullaInAktiv } from "../lib/modulram.js";
import { text } from "../lib/sprak.js";
import { OpsModulRam } from "./OpsModulRam.jsx";

/**
 * En moduls insida: tillbaka till hubben, modulens namn, modulens EGEN navigation, och delen som är öppen (0.37.0, #184).
 *
 * ══ ⛔ DELARNA ÄR MODULENS NAVIGATION, INTE HUBBENS ═══════════════════════
 *
 * CP 2026-09-30, med en bild av hubbens meny (Översikt, Ekonomi, Liv, Schema, Cutover, Bolaget, Kontakter, Länkar, Jämförelse):
 * "Ekonomi är EN modul. Inte massa moduler med komponenter." Hubben visar ett kort, Ekonomi, och allt det andra är delar som nås
 * INIFRÅN modulen. Den här komponenten är det inifrån: en rad länkar under modulens namn, en per del, i manifestets ordning.
 *
 * ⛔ LÄNKAR OCH INTE FLIKAR. Varje del är en egen sida med en egen adress, så bakåtknappen, ett bokmärke och en länk i Inkorgen
 * fungerar (samma skäl som `OpsTabs` filhuvud: sidnavigering är länkar). Raden ser ut som ramverkets flikrad (`OpsTabs`), med
 * accentlinjen under den öppna delen, så att "du är här" läses på samma sätt som överallt annars.
 *
 * ⛔ RADEN RULLAR I SIDLED NÄR DEN INTE FÅR PLATS, som `OpsTabs`. Ekonomi har fjorton delar, och de trängs annars ihop
 * eller bryts till många rader på telefon. Sidan själv flödar aldrig i sidled (`check-skalyta`): raden är omslagen
 * (`FLIKOMSLAG`) så att den blir smalare än sitt innehåll och rullar själv.
 *
 * ⛔ DEN ÖPPNA DELEN RULLAS IN I RADEN. Står man på Jämförelse, den fjortonde delen, låg fliken annars utanför skärmen på
 * en telefon, och raden sade inte var man var. Raden rullas och inte sidan (`rullaInAktiv`).
 *
 * ⛔ VILKEN DEL SOM ÄR ÖPPEN AVGÖRS AV `modulLage`, inte av komponenten. Modulens egen adress är startsidan, och en undersida
 * till en del markerar delen. Samma funktion som appen kan pröva sina adresser mot.
 *
 * ⛔ RAMVERKET RITAR RAMEN OCH APPEN DELEN. `children` är delens vy, och den väljs av appens router: ramverket vet inte vad
 * en del innehåller, bara vad den heter och var den bor (manifestets `hubb`).
 *
 * @param {object} props
 * @param {import("../lib/modul.js").Modul} props.modul En registrerad modul med `hubb`.
 * @param {string} props.activeHref Adressen som visas nu.
 * @param {string} props.hubHref Hubbens adress: tillbaka-länkens mål.
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {"sv"|"en"} [props.sprak]
 * @param {string} [props.navEtikett] Skärmläsarnamnet på delarnas rad. Förval "{Modul}: delar".
 * @param {string} [props.hubEtikett] Förval "Appar" (0.50.0; tidigare "Hub").
 * @param {import("./OpsModulRam.jsx").ModulRam | null} [props.ram] (0.89.0) Inställningsläget. Utelämnad: ramen som förut, utan kugghjul.
 * @param {import("react").ReactNode} props.children Den öppna delens vy.
 */
export function OpsModulSida({ modul, activeHref, hubHref, onNavigate, sprak: sprakProp, navEtikett, hubEtikett = "Appar", ram = null, children }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  if (!modul || !modul.hubb) {
    throw new Error(
      `OpsModulSida: modulen ${modul?.id ? `"${modul.id}" ` : ""}har inget kort i hubben (hubb saknas eller är null). Insidan är kortets, och en modul utan kort har ingen.`,
    );
  }
  const namn = text(modul.namn, sprak);
  const lage = modulLage([modul], activeHref);
  const aktiv = lage?.del?.id ?? null;
  const rad = useRef(/** @type {HTMLUListElement | null} */ (null));
  useLayoutEffect(() => {
    rullaInAktiv(rad.current);
  }, [aktiv]);
  return (
    <OpsModulRam modul={modul} activeHref={activeHref} hubHref={hubHref} hubEtikett={hubEtikett} onNavigate={onNavigate} sprak={sprak} ram={ram}>
      {/* ⛔ RADENS KLASSER BOR I `modulram.js` (0.83.0), så att Bibliotekets flikrad (`OpsTabs` med `medOrd`) ser ut som den här. */}
      <nav aria-label={navEtikett ?? (sprak === "en" ? `${namn}: parts` : `${namn}: delar`)} data-modulnav={modul.id} className={FLIKOMSLAG}>
        <ul ref={rad} className={FLIKRAD}>
          {modul.hubb.delar.map((d) => {
            const oppen = d.id === aktiv;
            return (
              <li key={d.id} className="shrink-0">
                <a href={d.rutt} onClick={(e) => onNavigate?.(d.rutt, e)} aria-current={oppen ? "page" : undefined} data-del={d.id} className={flikKlass({ oppen })}>
                  <span aria-hidden="true" className={FLIKIKON}>
                    {/** @type {import("react").ReactNode} */ (d.ikon)}
                  </span>
                  <span>{text(d.namn, sprak)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <div data-moduldel={aktiv ?? ""}>{children}</div>
    </OpsModulRam>
  );
}
