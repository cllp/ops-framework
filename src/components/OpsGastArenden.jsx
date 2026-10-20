import { definierade, forvalda } from "../lib/ord.js";
import { OpsDisclosure } from "./OpsDisclosure.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsMarkdown } from "./OpsMarkdown.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { OpsTag } from "./OpsTag.jsx";

/**
 * Orden i gästens ärendelista, på svenska och engelska (0.132.0, cllp/lifehub.app#389, skiva 2).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTARENDEN = {
  rubrik: { sv: "Ärenden", en: "Cases" },
  tom: { sv: "Inga ärenden.", en: "No cases." },
  laddar: { sv: "Hämtar ärendena", en: "Loading the cases" },
  fel: { sv: "Ärendena kunde inte hämtas just nu.", en: "The cases could not be loaded right now." },
  skrivskyddad: { sv: "Du kan läsa ärendena men inte ändra dem.", en: "You can read the cases but not change them." },
  avkortad: { sv: "Visar de {n} första ärendena. Det finns fler.", en: "Showing the first {n} cases. There are more." },
  beskrivning: { sv: "Visa beskrivningen", en: "Show the description" },
  forfaller: { sv: "Förfaller {datum}", en: "Due {datum}" },
  tilldelad: { sv: "Tilldelad {namn}", en: "Assigned to {namn}" },
  state_ny: { sv: "Ny", en: "New" },
  state_hanterad: { sv: "Hanterad", en: "Handled" },
  state_avskriven: { sv: "Avskriven", en: "Dismissed" },
};

/** Tonen på tillståndsmärket: det som är klart är grönt, det som väntar neutralt. Ett tillstånd vyn inte känner visas med sitt eget ord och neutralt. */
const TONER = /** @type {Record<string, "neutral" | "success" | "warning" | "danger" | "info">} */ ({ ny: "info", hanterad: "success", avskriven: "neutral" });

/**
 * Gruppens ärenden för en gäst: bara läsning (0.132.0, cllp/lifehub.app#389, skiva 2).
 *
 * ══ ⛔ BYGGD AV PRIMITIVER, FÖR AT ÄRENDEN INTE HAR EN RAMVERKSVY ═════════════════════════════════════════════════════════
 *
 * Appens ärendelista (`ArendenFlik`) kräver medlemmens funktioner (bevakning, "Boka tid", "Från Inkorgen") och visar ärendets GitHub-adress, alltså repots namn. Det här är en lista (`OpsList`)
 * med rubrik, tillstånd, etiketter, förfallodag, tilldelade och beskrivningen bakom `OpsDisclosure`. Vilka fält ett ärende har är APPENS (`grupp.arenden.falt` i tjänsten); vyn ritar dem som finns och
 * gissar inga andra: `rubrik`, `state`, `stateReason`, `etiketter` (namn), `forfallodag`, `tilldelade` (namn), `brodtext` (markdown, ingen HTML) och `andrad`.
 *
 * ⛔ TOMT OCH KAPAT ÄR SVAR: en lista utan ärenden säger det, och en lista som kapats (`avkortad`) säger hur många som visas.
 *
 * @param {object} props
 * @param {ReadonlyArray<Record<string, any> & { id: string }>} props.poster Tjänstens `arenden().poster`.
 * @param {boolean} [props.avkortad]
 * @param {boolean} [props.laddar]
 * @param {string | null} [props.fel]
 * @param {string} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_OPSGASTARENDEN, string>>} [props.ord]
 */
export function OpsGastArenden({ poster, avkortad = false, laddar = false, fel = null, sprak = "sv", ord }) {
  if (!Array.isArray(poster)) {
    throw new Error("OpsGastArenden: poster måste vara en lista, tom när det inte finns några. Utan den går det inte att skilja 'inga ärenden' från 'inte hämtade'.");
  }
  for (const p of poster) if (!p || typeof p.id !== "string") throw new Error("OpsGastArenden: varje ärende har ett id (tjänstens arenden()).");
  const t = { ...forvalda(ORD_OPSGASTARENDEN, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  /** @param {unknown} v @returns {string[]} */
  const namn = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : typeof x?.namn === "string" ? x.namn : "")).filter(Boolean) : []);
  return (
    <section aria-label={t.rubrik} data-gast-arenden="" className="flex min-w-0 flex-col gap-3">
      {fel ? (
        <p role="alert" data-gast-arenden-fel="" className="m-0 text-etikett text-danger">{t.fel}</p>
      ) : laddar ? (
        <OpsEmpty busy title={t.laddar} busyLabel={t.laddar} />
      ) : poster.length === 0 ? (
        <OpsEmpty title={t.tom} />
      ) : (
        <OpsList ariaLabel={t.rubrik}>
          {poster.map((p) => {
            const state = typeof p.state === "string" ? p.state : "";
            const etiketter = namn(p.etiketter);
            const tilldelade = namn(p.tilldelade);
            return (
              <OpsListRow key={p.id}>
                <div data-gast-arende={p.id} className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <span data-gast-arende-rubrik="" className="min-w-0 flex-1 text-brod font-medium text-ink wrap-anywhere">{typeof p.rubrik === "string" && p.rubrik ? p.rubrik : p.id}</span>
                    {state ? (
                      <OpsPill tone={TONER[state] ?? "neutral"}>{t[`state_${state}`] ?? state}</OpsPill>
                    ) : null}
                  </div>
                  {typeof p.stateReason === "string" && p.stateReason ? <span data-gast-arende-skal="" className="text-meta text-ink-muted wrap-anywhere">{p.stateReason}</span> : null}
                  {etiketter.length > 0 || tilldelade.length > 0 || typeof p.forfallodag === "string" ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-meta text-ink-secondary">
                      {etiketter.map((e) => <OpsTag key={e} label={e} />)}
                      {tilldelade.length > 0 ? <span data-gast-arende-tilldelade="">{t.tilldelad.replace("{namn}", tilldelade.join(", "))}</span> : null}
                      {typeof p.forfallodag === "string" && p.forfallodag ? <span data-gast-arende-forfaller="">{t.forfaller.replace("{datum}", p.forfallodag)}</span> : null}
                    </div>
                  ) : null}
                  {typeof p.brodtext === "string" && p.brodtext.trim() ? (
                    <OpsDisclosure summary={t.beskrivning}>
                      <div data-gast-arende-text="" className="pt-2">
                        <OpsMarkdown text={p.brodtext} dokument />
                      </div>
                    </OpsDisclosure>
                  ) : null}
                </div>
              </OpsListRow>
            );
          })}
        </OpsList>
      )}
      {avkortad ? <p role="status" data-gast-arenden-avkortad="" className="m-0 text-meta text-ink-muted">{t.avkortad.replace("{n}", String(poster.length))}</p> : null}
      <p data-gast-arenden-skrivskyddad="" className="m-0 text-meta text-ink-muted">{t.skrivskyddad}</p>
    </section>
  );
}
