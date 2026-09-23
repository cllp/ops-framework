import { createContext, useCallback, useContext, useMemo, useState } from "react";
import * as Toast from "@radix-ui/react-toast";
import { cx } from "../lib/cx.js";
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
 */

/** @typedef {{ id: number, title: string, description?: string, tone: "success"|"danger"|"info" }} Toastpost */

/** @type {import("react").Context<{ visa: (t: Omit<Toastpost, "id">) => void } | null>} */
const ToastContext = createContext(/** @type {{ visa: (t: Omit<Toastpost, "id">) => void } | null} */ (null));

const TONER = {
  success: "border-success/30 bg-success-bg text-success",
  danger: "border-danger/30 bg-danger-bg text-danger",
  info: "border-info/30 bg-info-bg text-info",
};

/**
 * Läggs en gång, högst upp i appen.
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 * @param {string} [props.closeLabel]
 */
export function OpsToastProvider({ children, closeLabel = "Stäng" }) {
  const [entries, setPoster] = useState(/** @type {Toastpost[]} */ ([]));

  const visa = useCallback((/** @type {Omit<Toastpost, "id">} */ entry) => {
    setPoster((tidigare) => [...tidigare, { ...entry, id: Date.now() + Math.random() }]);
  }, []);

  const varde = useMemo(() => ({ visa }), [visa]);

  return (
    <ToastContext.Provider value={varde}>
      {/* `duration` är 6 sekunder, inte 3. Tre räcker inte för att läsa en
          mening på ett språk man inte läser snabbt, och Radix pausar ändå
          nedräkningen när pekaren är över eller fokus är i. */}
      <Toast.Provider duration={6000} swipeDirection="right">
        {children}
        {entries.map((p) => (
          <Toast.Root
            key={p.id}
            onOpenChange={(open) => {
              if (!open) setPoster((tidigare) => tidigare.filter((t) => t.id !== p.id));
            }}
            className={cx("flex items-start gap-3 rounded-md border p-3 shadow-md", TONER[p.tone] ?? TONER.info)}
          >
            <div className="min-w-0 flex-1">
              <Toast.Title className="m-0 text-base font-semibold">{p.title}</Toast.Title>
              {p.description ? (
                <Toast.Description className="m-0 mt-1 text-base text-ink-secondary">{p.description}</Toast.Description>
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
        <Toast.Viewport className="fixed bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom))] right-0 z-(--z-toast) flex w-full max-w-sm flex-col gap-2 p-4 md:bottom-(--safe-bottom)" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

/**
 * @returns {{ visa: (t: { title: string, description?: string, tone?: "success"|"danger"|"info" }) => void }}
 */
export function useOpsToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useOpsToast: ingen OpsToastProvider hittades. Lägg den högst upp i appen. Att tyst returnera en tom funktion hade gjort att bekräftelser försvann utan att någon märkte det.",
    );
  }
  return { visa: (t) => ctx.visa({ tone: "success", ...t }) };
}
