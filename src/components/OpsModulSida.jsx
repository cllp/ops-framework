import { useLayoutEffect, useRef } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import { cx } from "../lib/cx.js";
import { modulLage } from "../lib/hubb.js";
import { text } from "../lib/sprak.js";
import { OpsView } from "./OpsView.jsx";

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
 * ⛔ RADEN RULLAR I SIDLED NÄR DEN INTE FÅR PLATS, som `OpsTabs`. Ekonomi har tretton delar, och tretton namn trängs annars ihop
 * till oläsliga stumpar på telefon. Sidan själv flödar aldrig i sidled (`check-skalyta`).
 *
 * ⛔ DEN ÖPPNA DELEN RULLAS IN I RADEN. Står man på Jämförelse, den fjortonde delen, låg fliken annars utanför skärmen på
 * en telefon, och raden sade inte var man var. Raden rullas och inte sidan (`scrollLeft`, aldrig `scrollIntoView`, som
 * hade kunnat flytta hela dokumentet i höjdled).
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
 * @param {import("react").ReactNode} props.children Den öppna delens vy.
 */
export function OpsModulSida({ modul, activeHref, hubHref, onNavigate, sprak: sprakProp, navEtikett, hubEtikett = "Appar", children }) {
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
    const ul = rad.current;
    const a = /** @type {HTMLElement | null | undefined} */ (ul?.querySelector('[aria-current="page"]'));
    if (!ul || !a) return;
    const ra = a.getBoundingClientRect();
    const ru = ul.getBoundingClientRect();
    const vanster = ra.left - ru.left + ul.scrollLeft;
    if (vanster < ul.scrollLeft || vanster + ra.width > ul.scrollLeft + ul.clientWidth) {
      ul.scrollLeft = Math.max(0, vanster - (ul.clientWidth - ra.width) / 2);
    }
  }, [aktiv]);
  return (
    <OpsView tillbaka={{ hubHref, hubEtikett, etikett: namn, onNavigate, rubrik: true, tillbakaEtikett: sprak === "en" ? "Back" : "Tillbaka", tillbakaTillEtikett: sprak === "en" ? "Back to" : "Tillbaka till" }}>
      <nav aria-label={navEtikett ?? (sprak === "en" ? `${namn}: parts` : `${namn}: delar`)} data-modulnav={modul.id}>
        <ul ref={rad} className="m-0 flex list-none gap-1 overflow-x-auto border-b border-line p-0">
          {modul.hubb.delar.map((d) => {
            const oppen = d.id === aktiv;
            return (
              <li key={d.id} className="shrink-0">
                <a
                  href={d.rutt}
                  onClick={(e) => onNavigate?.(d.rutt, e)}
                  aria-current={oppen ? "page" : undefined}
                  data-del={d.id}
                  className={cx(
                    "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 px-4 py-2 text-etikett font-semibold",
                    "transition-colors duration-(--duration-fast) ease-standard",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    oppen ? "border-accent text-ink" : "border-transparent text-ink-secondary hover:bg-accent-faint hover:text-ink",
                  )}
                >
                  <span aria-hidden="true" className="flex shrink-0 items-center [&_svg]:size-4">
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
    </OpsView>
  );
}
