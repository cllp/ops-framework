import { useId, useRef, useState } from "react";
import { KALENDERPRICK } from "../lib/kalenderfarg.js";
import { cx } from "../lib/cx.js";
import { KalenderIkon } from "./icons.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { ValRad } from "./ValRad.jsx";

/**
 * "Kopiera till…" i händelsepanelen (0.134.0, cllp/lifehub.app#402), för ALLA händelser: en egen, en gruppens och en extern från Apple eller Google.
 *
 * ══ ⛔ EN KOPIA ÄR INGEN LÄNK, OCH RAMVERKET ÖPPNAR INGET FORMULÄR ═══════════════════════════════════════════════════
 *
 * CP 2026-10-21: "Man väljer målkalender, och Ny händelse öppnas ifylld. Det är en kopia och ingen länk: originalet ändras där det bor." Panelen ritar
 * bara VÄLJAREN (kalendrarna personen får skapa i, som appen skickar) och anropar `onKopiera({ handelse, malKalenderId })`. Vad som händer sedan,
 * formuläret som öppnas ifyllt eller ett direkt skapande, är appens: ramverket känner inte händelsens data.
 *
 * ⛔ EN DUBBLETT FRÅGAR FÖRST. Kopian minns sitt ursprung (appen skickar `kopierad: [{ kalenderId, namn }]`), "så att samma händelse inte kopieras
 * två gånger av misstag". Raden "Redan kopierad till X" står alltid i panelen när det finns en kopia. Väljs en kalender som redan har en kopia visas en
 * varning med kalenderns namn, och kopian görs först när personen bekräftar. En KOPIA TILL EN ANNAN kalender frågar inte: den som kopierar en
 * flygresa till både Familj och Jobb gör inget misstag.
 *
 * ⛔ ETT FEL FRÅN APPEN SKRIVS UT OCH LÄMNAR RUTAN ÖPPEN, och knapparna är spärrade medan anropet pågår, som i `HandelseFlytta`.
 *
 * @param {object} props
 * @param {ReadonlyArray<{ id: string, namn: string, farg?: 1|2|3|4|5|6 }>} props.mal Kalendrarna personen får skapa i. Tom: ingen knapp (en knapp utan val är död).
 * @param {ReadonlyArray<{ kalenderId: string, namn: string }>} props.kopierad Var händelsen redan är kopierad. Tom: ingen rad.
 * @param {(arg: { handelse: import("./OpsHandelsePanel.jsx").HandelseVy, malKalenderId: string }) => void | Promise<void>} props.onKopiera
 * @param {import("./OpsHandelsePanel.jsx").HandelseVy} props.handelse
 * @param {Record<string, string>} props.ord Etiketterna, ur `ORD_OPSHANDELSEPANEL`.
 */
export function HandelseKopiera({ mal, kopierad, onKopiera, handelse, ord }) {
  const [oppen, setOppen] = useState(false);
  const [varnar, setVarnar] = useState(/** @type {{ id: string, namn: string } | null} */ (null));
  const [upptagen, setUpptagen] = useState(false);
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  const felId = useId();
  // ⛔ EN REF OCH INTE BARA `upptagen`: två tryck i samma tick ser samma state, och då skapas kopian två gånger.
  const pagar = useRef(false);

  const stang = () => {
    setOppen(false);
    setVarnar(null);
    setFel(null);
  };

  /** @param {{ id: string, namn: string }} m */
  async function utfor(m) {
    if (pagar.current) return;
    pagar.current = true;
    setFel(null);
    setUpptagen(true);
    try {
      await onKopiera({ handelse, malKalenderId: m.id });
      stang();
    } catch (e) {
      setFel(e instanceof Error && e.message ? e.message : String(e));
    } finally {
      pagar.current = false;
      setUpptagen(false);
    }
  }

  if (mal.length === 0 && kopierad.length === 0) return null;
  const redan = (/** @type {string} */ id) => kopierad.some((k) => k.kalenderId === id);

  return (
    <div data-handelsekopiera="" className="mt-3 flex flex-col items-start gap-1.5">
      {mal.length > 0 ? (
        <OpsButton size="sm" variant="secondary" onClick={() => setOppen(true)}>
          <KalenderIkon size={16} />
          {ord.kopieraEtikett}
        </OpsButton>
      ) : null}
      {kopierad.length > 0 ? (
        <p data-handelsekopierad="" className="m-0 text-etikett text-ink-muted wrap-anywhere">
          {ord.kopieradEtikett.replace("{kalendrar}", kopierad.map((k) => k.namn).join(", "))}
        </p>
      ) : null}
      <OpsModal
        open={oppen}
        onOpenChange={(o) => {
          // Mitt i ett anrop stänger varken Escape eller utsidan rutan: svaret ska synas.
          if (!o && !upptagen) stang();
        }}
        title={varnar ? ord.kopieraVarningTitel : ord.kopieraRubrik}
        closeLabel={ord.stangEtikett}
        size="sm"
        footer={
          varnar ? (
            <>
              <OpsButton variant="ghost" disabled={upptagen} onClick={() => { setVarnar(null); setFel(null); }}>
                {ord.avbrytEtikett}
              </OpsButton>
              <OpsButton variant="primary" busy={upptagen} onClick={() => utfor(varnar)}>
                {ord.kopieraIgenKnapp}
              </OpsButton>
            </>
          ) : null
        }
      >
        {varnar ? (
          <p data-kopiera-varning="" role="alert" className="m-0 text-etikett leading-relaxed text-ink-secondary wrap-anywhere">
            {ord.kopieraVarningText.replace("{titel}", handelse.titel).replace("{kalender}", varnar.namn)}
          </p>
        ) : (
          <div data-kopiera-lista="" className="flex flex-col gap-0.5">
            {mal.map((m) => (
              <ValRad
                key={m.id}
                chosen={false}
                stor
                ikon={<span className={cx("size-2 rounded-full", KALENDERPRICK[/** @type {number} */ (m.farg)] || "bg-accent")} />}
                under={redan(m.id) ? ord.kopieraRedanOrd : undefined}
                onClick={() => (redan(m.id) ? setVarnar(m) : utfor(m))}
              >
                {m.namn}
              </ValRad>
            ))}
          </div>
        )}
        {fel ? (
          <p id={felId} role="alert" data-kopiera-fel="" className="m-0 mt-3 text-etikett text-danger wrap-anywhere">
            {ord.kopieraFelEtikett}: {fel}
          </p>
        ) : null}
      </OpsModal>
    </div>
  );
}
