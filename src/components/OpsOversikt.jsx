import { useKallor } from "../data/useKallor.jsx";
import { OpsView, OpsViewHeader } from "./OpsView.jsx";
import { OpsCard } from "./OpsCard.jsx";
import { OpsPanelHeader } from "./OpsPanel.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { text } from "../lib/sprak.js";

/**
 * Översikt: gruppens startsida, ett kort per widget.
 *
 * ══ ⛔ RAMVERKET ÄGER RUTNÄTET, MODULEN ÄGER INNEHÅLLET (#142) ═════════
 *
 * Kortet, ordningen och tomläget är ramverkets. Vad som står i kortet ritar
 * modulen själv. Skulle ramverket tolka innehållet måste det veta vad varje
 * modul betyder, och det är precis det modulkontraktet finns för att slippa.
 *
 * ⛔ ÖVERSIKTEN ÄR ALLTID EN GRUPPS. Ingen sammanslagning över grupper i
 * första versionen, till skillnad mot Händelser: ett kort som blandar två
 * verksamheters siffror är ett kort ingen kan handla på.
 *
 * ⛔ EN TOM ÖVERSIKT SÄGER VARFÖR OCH VART. En grupp utan påslagna moduler ska
 * inte visa ett tomt rutnät, den ska säga att inga moduler är påslagna och
 * peka på inställningarna. Ett tomt rutnät läser man som "det är trasigt".
 */

/**
 * Widgetarna i den ordning gruppen valt.
 *
 * ⛔ EN REN FUNKTION, eftersom ordningen är det enda beslutet i vyn och ett
 * beslut i en komponent är ett beslut inget prov når. Okända id i ordningen
 * ignoreras, och widgetar som saknas i den hamnar sist i källans ordning: en
 * ny modul ska dyka upp, inte försvinna för att ingen hunnit lägga till den.
 *
 * @template {{ id: string, modulId?: string }} T
 * @param {ReadonlyArray<T>} widgets
 * @param {ReadonlyArray<string>} [ordning] Nycklar `modulId:id`.
 * @returns {T[]}
 */
export function iOrdning(widgets, ordning) {
  const nyckel = (/** @type {any} */ w) => `${w.modulId}:${w.id}`;
  const valda = ordning ?? [];
  const plats = new Map(valda.map((n, i) => [n, i]));
  return [...(widgets ?? [])].sort((a, b) => {
    const pa = plats.has(nyckel(a)) ? /** @type {number} */ (plats.get(nyckel(a))) : Number.MAX_SAFE_INTEGER;
    const pb = plats.has(nyckel(b)) ? /** @type {number} */ (plats.get(nyckel(b))) : Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../lib/kallor.js").skapaKallregister> | null} props.register
 * @param {{ groupId: string }} props.fraga
 * @param {ReadonlyArray<string>} [props.ordning] Gruppens ordning, nycklar `modulId:id`.
 * @param {string} [props.rubrik]
 * @param {string} [props.tomText]
 * @param {import("react").ReactNode} [props.tomAtgard] Vägen till inställningarna.
 * @param {string} [props.sprak]
 */
export function OpsOversikt({ register, fraga, ordning, rubrik = "Översikt", tomText = "Inga moduler är påslagna för den här gruppen.", tomAtgard, sprak }) {
  const { rader, laddar, fel } = useKallor(register, "widgets", fraga);

  return (
    <OpsView>
      <OpsViewHeader title={rubrik} />
      {fel ? <OpsBanner tone="danger" title="Översikten kunde inte byggas">{fel.message}</OpsBanner> : null}
      {!fel && laddar ? <OpsSpinner label="Hämtar översikten" /> : null}
      {!fel && !laddar && rader.length === 0 ? <OpsEmpty title={tomText} action={tomAtgard} /> : null}
      {!fel && !laddar && rader.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {iOrdning(/** @type {any} */ (rader), ordning).map((/** @type {any} */ w) => {
            const Vy = /** @type {any} */ (w).vy;
            return (
              /*
               * ⛔ RUBRIKEN RITAS AV RAMVERKET, INTE AV MODULEN. Ett kort där
               * varje modul satte sin egen rubrik hade gett sex olika
               * rubrikstilar på samma sida, och då slutar rutnätet se ut som
               * en översikt.
               */
              <OpsCard key={`${w.modulId}:${w.id}`}>
                <OpsPanelHeader title={text(/** @type {any} */ (w).titel, sprak)} />
                <Vy {...w} />
              </OpsCard>
            );
          })}
        </div>
      ) : null}
    </OpsView>
  );
}
