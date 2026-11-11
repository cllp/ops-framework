import { useState } from "react";

import { cx } from "../lib/cx.js";
import { OpsSpinner } from "./OpsSpinner.jsx";

/**
 * (0.215.0, cllp/lifehub.app#760 skiva 3) Växlaren överst på gästsidan: enhetens inbjudningar, samlade under sina grupper, och Mina inbjudningar sist.
 *
 * ══ ⛔ BARA DET SERVERN JUST SVARAT ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Raderna byggs av `OpsGastSida` ur svaren på `hamta` i den här sidvisningen (`vaxlarrad`), en per sparad session som svarade. Ett namn sparas aldrig på enheten, så en återkallad inbjudan står inte kvar med
 * ett gammalt namn, och en delad dator visar efter Logga ut ingenting av den förra gästen.
 *
 * ⛔ ETT TRYCK ÖPPNAR DEN INBJUDANS EGEN SESSION. Växlaren lånar aldrig en session till en annan inbjudan: en vidarebefordrad länk ger fortfarande bara det den länken ger, och en inbjudan man inte har en
 * session för på enheten står inte här.
 *
 * ⛔ RUBRIKEN ÄR GRUPPENS NAMN för en gäst i hela gruppen (`gruppnamn` i svaret). Ett projekt står med sitt eget namn under Projekt: en projektgäst ser aldrig gruppens namn, svaret bär det inte, och växlaren
 * läser det inte heller för ett projekt. En omröstning eller en händelse samlas under Händelser och omröstningar: den gästen ser inget om gruppen.
 *
 * ⛔ EN ENDA INBJUDAN GER BARA LÄNKEN Mina inbjudningar, liten: ingen lista att välja i, men vägen till de andra (en adress kan ha fler än enheten känner).
 *
 * @typedef {{ id: string, grupp: string | null, namn: string, projekt?: true }} Vaxlarrad
 */

/**
 * Raden för ett svar från `hamta`, eller `null` när svaret inte går att visa.
 * @param {string} id
 * @param {Record<string, any>} r
 * @returns {Vaxlarrad | null}
 */
export function vaxlarrad(id, r) {
  if (!r || r.ok !== true) return null;
  if (r.funktion === "grupp") {
    // Ett projekt: sitt eget namn, aldrig gruppens (också om ett svar skulle bära det).
    if (r.grupp?.projekt) return { id, grupp: null, namn: typeof r.grupp?.namn === "string" ? r.grupp.namn.trim() : "", projekt: true };
    const grupp = typeof r.gruppnamn === "string" && r.gruppnamn.trim() ? r.gruppnamn.trim() : typeof r.grupp?.namn === "string" ? r.grupp.namn.trim() : "";
    return { id, grupp: grupp || null, namn: "" };
  }
  const titel = typeof r.delta?.handelse?.titel === "string" ? r.delta.handelse.titel.trim() : "";
  return { id, grupp: null, namn: titel };
}

/**
 * @param {object} props
 * @param {Vaxlarrad[] | null} props.rader `null` medan servern frågas.
 * @param {string | null} props.visas Inbjudan som visas.
 * @param {Record<string, string>} props.t Gästsidans ord (`ORD_OPSGASTSIDA`).
 * @param {(id: string) => void | Promise<void>} props.onVaxla
 * @param {() => void} props.onMina
 * @param {boolean} [props.fel] Ett byte som inte gick.
 */
export function GastVaxlare({ rader, visas, t, onVaxla, onMina, fel = false }) {
  // Inbjudan som håller på att öppnas: raden är upptagen (snurra, `aria-busy`) och de andra väntar, så att två tryck inte öppnar två sessioner om vartannat.
  const [byter, setByter] = useState(/** @type {string | null} */ (null));
  const vaxla = async (/** @type {string} */ id) => {
    setByter(id);
    try {
      await onVaxla(id);
    } finally {
      setByter(null);
    }
  };
  const minaKnapp = (/** @type {boolean} */ liten) => (
    <button
      type="button"
      data-gast-mina-knapp={liten ? "liten" : "rad"}
      onClick={onMina}
      className={cx(
        "inline-flex min-h-11 cursor-pointer items-center text-left text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        liten ? "text-meta" : "text-etikett font-medium",
      )}
    >
      {t.minaInbjudningar}
    </button>
  );
  const felrad = fel ? (
    <p role="alert" data-gast-vaxlare-fel="" className="m-0 text-etikett text-danger">
      {t.vaxlareFel}
    </p>
  ) : null;
  if (!rader || rader.length < 2) {
    return (
      <div data-gast-vaxlare="enkel" className="flex flex-col items-start gap-1">
        {felrad}
        {minaKnapp(true)}
      </div>
    );
  }
  // Nyckeln för Projekt kan inte vara ett gruppnamn (ett namn är aldrig tomt efter `trim` och börjar aldrig med ett styrtecken).
  const PROJEKT = "\u0001projekt";
  /** @type {Map<string, Vaxlarrad[]>} */
  const grupper = new Map();
  for (const r of rader) {
    const k = r.projekt ? PROJEKT : (r.grupp ?? "");
    grupper.set(k, [...(grupper.get(k) ?? []), r]);
  }
  // Grupperna i bokstavsordning, sedan Projekt, Händelser och omröstningar sist.
  const vikt = (/** @type {string} */ k) => (k === "" ? 2 : k === PROJEKT ? 1 : 0);
  const ordning = [...grupper.keys()].sort((a, b) => vikt(a) - vikt(b) || a.localeCompare(b, "sv"));
  return (
    <nav aria-label={t.vaxlareEtikett} data-gast-vaxlare="lista" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-3">
      <h2 className="m-0 text-sektion uppercase text-ink-secondary">{t.vaxlareEtikett}</h2>
      {felrad}
      {ordning.map((g) => (
        <div key={g || "-"} data-gast-vaxlare-grupp={g === PROJEKT ? "projekt" : g || "handelser"} className="flex flex-col gap-1">
          <h3 className="m-0 text-etikett font-semibold text-ink">{g === PROJEKT ? t.vaxlareProjekt : g || t.vaxlareHandelser}</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {/** @type {Vaxlarrad[]} */ (grupper.get(g)).map((r) => {
              const namn = r.namn || (r.grupp ? t.vaxlareHelaGruppen : t.vaxlareOmrostning);
              const aktiv = r.id === visas;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    data-gast-vaxlare-rad={r.id}
                    aria-current={aktiv ? "true" : undefined}
                    aria-busy={byter === r.id || undefined}
                    disabled={aktiv || byter !== null}
                    onClick={() => void vaxla(r.id)}
                    className={cx(
                      "inline-flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-card px-2 text-left text-etikett focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      aktiv ? "cursor-default bg-hover font-medium text-ink" : "text-accent hover:bg-hover",
                    )}
                  >
                    <span className="min-w-0 truncate">{namn}</span>
                    {byter === r.id ? <OpsSpinner size="sm" decorative /> : null}
                    {aktiv ? <span className="shrink-0 text-meta text-ink-muted">{t.vaxlareVisas}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="border-t border-line pt-1">{minaKnapp(false)}</div>
    </nav>
  );
}
