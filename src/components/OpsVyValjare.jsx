import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { ordet } from "../lib/ord.js";
import { ChevronNedIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { radBehallare, radKlass } from "../lib/radKlass.js";

/**
 * Vyns namn i mitten av headern, med chevron och meny (lifehub.app#150).
 *
 * ⛔ SAMMA GEST SOM KALENDERN. Etiketten är var man är ("Hubbar", "Profil"),
 * chevronen öppnar bytet. Identity tar bort kugghjulet och lägger menyn här:
 * Hubbar, Profil, Anslutningar, Betalningar och konto, AI-nycklar, Logga ut.
 *
 * ⛔ APPEN ÄGER POSTERNA OCH NAVIGERINGEN. Ramverket vet inte vilka vyer som
 * finns. Varje post är `{ id, etikett, href?, onClick?, destructive? }`. En post
 * med `href` är en länk; en med `onClick` (t.ex. Logga ut) är en knapp. Båda
 * stänger menyn innan appen tar över.
 *
 * @typedef {object} VyPost
 * @property {string} id
 * @property {string} etikett
 * @property {string} [href]
 * @property {() => void} [onClick]
 * @property {boolean} [destructive] Logga ut och liknande: accentfärgad rad.
 */

export const ORD_OPSVYVALJARE = {
  meny: { sv: "Vy", en: "View" },
  bytVy: { sv: "byt vy", en: "switch view" },
};

/**
 * @param {object} props
 * @param {string} props.rubrik Vyns namn som syns i knappen (t.ex. "Hubbar").
 * @param {string} props.vald Id för den aktuella posten; den raden får `aria-current`.
 * @param {ReadonlyArray<VyPost>} props.poster
 * @param {(href: string, e: import("react").MouseEvent) => void} [props.onNavigate]
 *   Anropas för poster med `href` efter att menyn stängts. Utan den följer
 *   webbläsaren länken som vanligt.
 * @param {string} [props.menyEtikett] `aria-label` på menyn. Utelämnad tar ordboken ("Vy").
 */
export function OpsVyValjare({ rubrik, vald, poster, onNavigate, menyEtikett }) {
  const sprak = useOpsSprak();
  const t = (/** @type {keyof typeof ORD_OPSVYVALJARE} */ nyckel) => ordet(ORD_OPSVYVALJARE, nyckel, sprak);
  if (typeof rubrik !== "string" || rubrik.trim() === "") {
    throw new Error('OpsVyValjare: rubrik krävs (t.ex. "Hubbar").');
  }
  if (!Array.isArray(poster) || poster.length === 0) {
    throw new Error("OpsVyValjare: poster krävs, minst en rad.");
  }
  for (const p of poster) {
    if (!p || typeof p.id !== "string" || p.id === "" || typeof p.etikett !== "string" || p.etikett === "") {
      throw new Error("OpsVyValjare: varje post behöver id och etikett.");
    }
    if (!p.href && typeof p.onClick !== "function") {
      throw new Error(`OpsVyValjare: posten "${p.id}" saknar href och onClick.`);
    }
  }

  const [oppen, setOppen] = useState(false);
  const menyNamn = typeof menyEtikett === "string" && menyEtikett.trim() !== "" ? menyEtikett : t("meny");

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        type="button"
        data-ops-vyvaljare=""
        aria-label={`${rubrik}, ${t("bytVy")}`}
        className={cx(
          "inline-flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-base px-2",
          "text-etikett font-medium text-ink",
          "hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          oppen && "bg-raised",
        )}
      >
        <span className="truncate">{rubrik}</span>
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex shrink-0 text-ink-muted transition-transform duration-(--duration-fast) ease-standard",
            oppen && "rotate-180",
          )}
        >
          <ChevronNedIkon size={16} />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={6}
          aria-label={menyNamn}
          role="menu"
          className={cx("z-(--z-dropdown) min-w-52 max-w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto p-1", radBehallare())}
        >
          <div className="flex flex-col gap-0.5">
            {poster.map((p) => {
              const aktuell = p.id === vald;
              const klass = radKlass({
                active: aktuell && !p.destructive,
                accentFarg: !!p.destructive,
              });
              if (p.href) {
                return (
                  <a
                    key={p.id}
                    href={p.href}
                    role="menuitem"
                    aria-current={aktuell ? "page" : undefined}
                    data-vy={p.id}
                    className={klass}
                    onClick={(e) => {
                      setOppen(false);
                      if (onNavigate) {
                        e.preventDefault();
                        onNavigate(p.href, e);
                      }
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{p.etikett}</span>
                  </a>
                );
              }
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitem"
                  data-vy={p.id}
                  className={klass}
                  onClick={() => {
                    setOppen(false);
                    p.onClick?.();
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{p.etikett}</span>
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
