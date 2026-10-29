import { createContext, useCallback, useContext, useMemo, useState } from "react";
import * as Toast from "@radix-ui/react-toast";
import { cx } from "../lib/cx.js";
import { ordet } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ANGRA_MS } from "./OpsSvepRad.jsx";
import { KryssIkon } from "./icons.jsx";

/**
 * Kortlivad återkoppling: "Sparat", "Kunde inte spara".
 *
 * ⛔ En toast får ALDRIG bära information som bara finns där. Den försvinner av
 * sig själv, den kan missas av den som tittade bort, och den är borta för den
 * som kommer tillbaka till fliken. Allt som måste gå att läsa igen hör hemma i
 * en `OpsBanner` eller i vyn.
 *
 * ⛔ Den får heller aldrig vara enda platsen ett fel visas. Ett fel som hör till
 * ett fält hör till fältet. En toast som säger "något gick fel" och försvinner
 * lämnar användaren utan väg vidare.
 *
 * Använd den alltså för att BEKRÄFTA något användaren precis gjorde, inget mer.
 *
 * ══ ⛔ EN ÅTGÄRD PÅ TOASTEN: ÅNGRA (0.153.0, cllp/ops-framework#460 punkt 1) ═══════════════════════════════════════════════════
 *
 * `atgard: { etikett, onKlick }` ritar en knapp i toasten, normalt "Ångra". Händelsen: lifehub.app byggde en egen yta för "Händelsen är borttagen" med Ångra
 * (`AngraBesked.jsx`, `OpsBanner` plus `OpsButton`), eftersom `OpsToast` bekräftade men inte kunde erbjuda något, och `OpsSvepRad` väntar innan åtgärden sker och tar
 * inte tillbaka något som redan skett. En andra yta för samma sak är regel 2 på fel sida.
 *
 *   - TIDSFÖNSTRET ÄR `ANGRA_MS` (åtta sekunder, ur `OpsSvepRad`), inte toastens sex. En toast med en knapp ska ge tid att läsa, förstå och trycka, och det är samma fönster som
 *     svepradens Ångra: två Ångra i samma app med olika tid vore två sanningar. Radix pausar nedräkningen medan pekaren är över toasten eller fokus är i den.
 *   - KNAPPEN ÄR EN `OpsButton`, 44 PX HÖG PÅ TELEFON och upptagen medan åtgärden väntar. Toasten står kvar tills åtgärden är klar och stängs sedan, lyckad eller inte.
 *   - ⛔ ETT FEL I ÅTGÄRDEN BLIR EN NY TOAST, ALDRIG TYST. `onKlick` får vara asynkron; kastar den eller avvisas löftet visas felets text i en `danger`-toast. En Ångra som inte gick
 *     igenom och som ser ut att ha gjort det är värre än ingen Ångra (arbetsreglernas punkt 5).
 *   - Toasten med åtgärd är fortfarande en BEKRÄFTELSE: den bär ingen information som bara finns där, och åtgärden får inte vara den enda vägen till det den gör.
 */

/**
 * @typedef {{ etikett: string, onKlick: () => void | Promise<unknown> }} Toastatgard
 * @typedef {{ id: number, title: string, description?: string, tone: "success"|"danger"|"info", atgard?: Toastatgard }} Toastpost
 */

/** @type {import("react").Context<{ show: (t: Omit<Toastpost, "id">) => void } | null>} */
const ToastContext = createContext(/** @type {{ show: (t: Omit<Toastpost, "id">) => void } | null} */ (null));

export const ORD_OPSTOAST = {
  atgardFel: { sv: "Det gick inte", en: "That did not work" },
};

// ⛔ bolag-ops#535 (CP 2026-10-02, inkorgsbild): bekräftelserutan "tog in massa
// bakgrund, text". `bg-success-bg` är 10–14 % opacitet (tokenkontraktet, tint
// för piller/banderoller INUTI en yta). En toast ligger ÖVER sidan i en portal,
// så den genomskinliga tinten läste in sidans text rakt genom rutan. Samma klass
// av fel som sticky-cellerna i OpsTable: flytande yta kräver opak bakgrund.
// `bg-elevated` är ytstegen för det som ligger över kortet (popover, meny).
// Tonen bärs av kant + rubrikfärg, inte av genomskinlig fyllnad.
const TONER = {
  success: "border-success/40 bg-elevated text-success",
  danger: "border-danger/40 bg-elevated text-danger",
  info: "border-info/40 bg-elevated text-info",
};

/**
 * Läggs en gång, högst upp i appen.
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 * @param {string} [props.closeLabel]
 */
export function OpsToastProvider({ children, closeLabel = "Stäng" }) {
  const sprak = useOpsSprak();
  const [entries, setPoster] = useState(/** @type {Toastpost[]} */ ([]));

  const show = useCallback((/** @type {Omit<Toastpost, "id">} */ entry) => {
    if (entry.atgard !== undefined && (typeof entry.atgard?.etikett !== "string" || !entry.atgard.etikett.trim() || typeof entry.atgard.onKlick !== "function")) {
      throw new Error("OpsToast: atgard kräver { etikett, onKlick }. En knapp utan ord eller utan funktion är en knapp som inte gör något.");
    }
    setPoster((tidigare) => [...tidigare, { ...entry, id: Date.now() + Math.random() }]);
  }, []);

  const stang = useCallback((/** @type {number} */ id) => setPoster((tidigare) => tidigare.filter((t) => t.id !== id)), []);

  /**
   * Åtgärden körs, och toasten står kvar medan den väntar (knappen är upptagen, `OpsButton` sköter det när `onClick` ger ett löfte). Ett fel (kast eller avvisat löfte) blir en egen toast med felets text.
   * Toasten stängs när åtgärden är klar, lyckad eller inte.
   */
  const kor = useCallback(
    async (/** @type {Toastatgard} */ atgard, /** @type {number} */ id) => {
      try {
        await atgard.onKlick();
      } catch (e) {
        show({ title: ordet(ORD_OPSTOAST, "atgardFel", sprak), description: e instanceof Error ? e.message : String(e), tone: "danger" });
      }
      stang(id);
    },
    [show, stang, sprak],
  );

  const contextValue = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={contextValue}>
      {/* `duration` är 6 sekunder, inte 3. Tre räcker inte för att läsa en
          mening på ett språk man inte läser snabbt, och Radix pausar ändå
          nedräkningen när pekaren är över eller fokus är i. */}
      <Toast.Provider duration={6000} swipeDirection="right">
        {children}
        {entries.map((p) => (
          <Toast.Root
            key={p.id}
            // ⛔ En toast med åtgärd lever lika länge som svepradens Ångra (`ANGRA_MS`), se filhuvudet.
            duration={p.atgard ? ANGRA_MS : undefined}
            data-toast-atgard={p.atgard ? "" : undefined}
            onOpenChange={(open) => {
              if (!open) setPoster((tidigare) => tidigare.filter((t) => t.id !== p.id));
            }}
            className={cx("flex items-start gap-3 rounded-md border p-3 shadow-md", TONER[p.tone] ?? TONER.info)}
          >
            <div className="min-w-0 flex-1">
              <Toast.Title className="m-0 text-etikett">{p.title}</Toast.Title>
              {p.description ? (
                <Toast.Description className="m-0 mt-1 text-meta text-ink-secondary">{p.description}</Toast.Description>
              ) : null}
              {p.atgard ? (
                <div className="mt-2">
                  {/* ⛔ EN `OpsButton`, så att knappen är upptagen medan åtgärden väntar (`check-vantar`) och är 44 px hög under md. Toasten stängs när åtgärden är klar, se `kor`. */}
                  <OpsButton variant="secondary" size="sm" onClick={() => kor(/** @type {Toastatgard} */ (p.atgard), p.id)}>
                    {p.atgard.etikett}
                  </OpsButton>
                </div>
              ) : null}
            </div>
            <Toast.Close
              aria-label={closeLabel}
              /* 44 px på telefon, 32 på skrivbord. Samma golv som banderollens
                 stängknapp, av samma skäl. */
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-8 md:min-w-8"
            >
              <KryssIkon />
            </Toast.Close>
          </Toast.Root>
        ))}
        {/* Botteninset räknar in säker yta OCH bottenradens höjd under md, annars
            hamnar toasten bakom/under bottennavigeringen på en telefon. På
            desktop finns ingen bottenrad, så då räcker den säkra ytan. */}
        <Toast.Viewport className="fixed bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom)+var(--spelrad-h,0px))] right-0 z-(--z-toast) flex w-full max-w-sm flex-col gap-2 p-4 md:bottom-[calc(var(--safe-bottom)+var(--spelrad-h,0px))]" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

/**
 * @returns {{ show: (t: { title: string, description?: string, tone?: "success"|"danger"|"info", atgard?: Toastatgard }) => void }}
 */
export function useOpsToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useOpsToast: ingen OpsToastProvider hittades. Lägg den högst upp i appen. Att tyst returnera en tom funktion hade gjort att bekräftelser försvann utan att någon märkte det.",
    );
  }
  return { show: (t) => ctx.show({ tone: "success", ...t }) };
}
