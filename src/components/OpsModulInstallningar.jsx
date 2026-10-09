import { text } from "../lib/sprak.js";
import { Delrubrik, delrubrik, useInstallningspanel } from "./OpsInstallningar.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { useId } from "react";

/**
 * Listan över gruppens appar, med en väg in i varje apps egna inställningar (0.88.0, omgjord 0.89.0).
 *
 * ══ ⛔ EN PLATS PER MODUL ════════════════════════════════════════════════
 *
 * CP 2026-10-09: pinnen, ikonen, synligheten, kopplingarna och de egna fälten
 * ritas i modulens ram, kugghjulet, inte i gruppvyn och inte i den här listan.
 * Två brytare för samma fält glider isär. Listan säger vilka appar som är
 * installerade och öppnar läget när appen ger en adress.
 *
 * ⛔ `onSpara` OCH `onSparaHuvudmeny` KASTAR. De skrev fälten här i 0.88.0.
 * Att ta emot dem och inte rita dem hade sett ut som att sparningen fanns kvar.
 *
 * ⛔ `agare` KRÄVS SOM true ELLER false, samma kontrakt som 0.88.0. Listan
 * redigerar inget, så värdet ändrar inte vad som ritas. Kravet står kvar så
 * att ett anrop som glömt det fortfarande säger ifrån.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSMODULINSTALLNINGAR = {
  hamtar: { sv: "Hämtar appens inställningar.", en: "Loading the app settings." },
  inga: { sv: "Gruppen har inga appar installerade.", en: "The group has no apps installed." },
  oppna: { sv: "Inställningar", en: "Settings" },
  iAppen: { sv: "Inställningarna öppnas i appen.", en: "The settings open in the app." },
  lista: { sv: "Installerade appar", en: "Installed apps" },
};

/**
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/modul.js").Modul>} props.moduler Appens registrerade moduler.
 * @param {{ moduler: ReadonlyArray<string>, huvudmeny?: ReadonlyArray<string> | null } | null} props.grupp Den aktiva gruppen, eller null medan den läses.
 * @param {boolean} props.agare Sant bara när den inloggade är gruppens ägare. Listan redigerar inget. Kravet står kvar från 0.88.0.
 * @param {(modul: import("../lib/modul.js").Modul) => string} [props.hrefFor] Adressen till appens inställningsläge. Utan den står det att inställningarna öppnas i appen.
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {boolean} [props.laddar]
 * @param {string | null} [props.fel]
 * @param {unknown} [props.sparade] 0.88.0. Kastas: värdena ritas i modulramen.
 * @param {unknown} [props.onSparaHuvudmeny] 0.88.0. Kastas.
 * @param {unknown} [props.onSpara] 0.88.0. Kastas.
 */
export function OpsModulInstallningar({ moduler, grupp, agare, hrefFor, onNavigate, laddar = false, fel = null, sparade, onSparaHuvudmeny, onSpara }) {
  if (typeof agare !== "boolean") {
    throw new Error("OpsModulInstallningar: agare krävs och ska vara true eller false. Utan propen ser en ägare ut som någon som bara får läsa.");
  }
  if (sparade !== undefined || onSparaHuvudmeny !== undefined || onSpara !== undefined) {
    throw new Error("OpsModulInstallningar: pinnen, ikonen, synligheten, kopplingarna och de egna fälten ritas inte här (0.89.0). De ligger i modulens inställningar. Skicka hrefFor så raden öppnar det läget. onSpara, onSparaHuvudmeny och sparade tas inte emot.");
  }
  if (hrefFor !== undefined && typeof hrefFor !== "function") {
    throw new Error("OpsModulInstallningar: hrefFor måste vara en funktion som ger appens adress, eller utelämnas. Utan adress står det att inställningarna öppnas i appen.");
  }
  if (!Array.isArray(moduler)) {
    throw new Error("OpsModulInstallningar: moduler krävs, appens registrerade moduler. Utan listan finns inget att ställa in.");
  }
  const sprak = useOpsSprak();
  const t = (/** @type {keyof typeof ORD_OPSMODULINSTALLNINGAR} */ nyckel) => text(ORD_OPSMODULINSTALLNINGAR[nyckel], sprak);
  const installerade = (grupp?.moduler ?? [])
    .map((id) => moduler.find((m) => m.id === id))
    .filter((m) => Boolean(m));

  return (
    <div data-modulinstallningar="" className="flex flex-col gap-4">
      {fel ? <p role="alert">{fel}</p> : null}
      {laddar ? <p role="status">{t("hamtar")}</p> : null}
      {!grupp ? null : installerade.length === 0 ? (
        <p data-modulinstallningar-tom="">{t("inga")}</p>
      ) : (
        <ul aria-label={t("lista")} className="m-0 flex list-none flex-col gap-4 p-0">
          {installerade.map((modul) => (
            <li key={/** @type {import("../lib/modul.js").Modul} */ (modul).id}>
              <ModulRad
                modul={/** @type {import("../lib/modul.js").Modul} */ (modul)}
                sprak={sprak}
                ord={t}
                href={hrefFor ? hrefFor(/** @type {import("../lib/modul.js").Modul} */ (modul)) : ""}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {import("../lib/modul.js").Modul} props.modul
 * @param {string} props.sprak
 * @param {(nyckel: keyof typeof ORD_OPSMODULINSTALLNINGAR) => string} props.ord
 * @param {string} props.href
 * @param {(href: string, event: any) => void} [props.onNavigate]
 */
function ModulRad({ modul, sprak, ord, href, onNavigate }) {
  const panel = useInstallningspanel();
  const rubrikId = useId();
  const namn = text(modul.namn, sprak);
  const rubriken = delrubrik(namn, rubrikId, panel);
  const mal = typeof href === "string" ? href : "";
  return (
    <section data-modulinstallning={modul.id} aria-labelledby={rubriken.etikettId} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {modul.hubb ? (
          <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-5">
            {/** @type {import("react").ReactNode} */ (modul.hubb.ikon)}
          </span>
        ) : null}
        <Delrubrik niva={rubriken.niva} id={rubriken.etikettId === rubrikId ? rubrikId : undefined}>{namn}</Delrubrik>
      </div>
      {mal ? (
        <a
          href={mal}
          data-modul-installningar={modul.id}
          onClick={(e) => onNavigate?.(mal, e)}
          className="inline-flex min-h-11 items-center self-start rounded-base text-etikett font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {ord("oppna")}
        </a>
      ) : (
        <p data-modul-installningar-saknas={modul.id} className="m-0 text-etikett text-ink-muted">{ord("iAppen")}</p>
      )}
    </section>
  );
}
