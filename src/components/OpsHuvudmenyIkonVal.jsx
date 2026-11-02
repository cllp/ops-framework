import { useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ordet } from "../lib/ord.js";
import { cx } from "../lib/cx.js";
import { radBehallare, radKlass } from "../lib/radKlass.js";
import { KryssIkon } from "./icons.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { LANGTRYCK_KLASS, useLangtryck } from "./useLangtryck.js";

/**
 * Långtryck på en appikon i toppraden öppnar ett litet val: "Ta bort från huvudmenyn" (0.177.0).
 *
 * ══ ⛔ HÄNDELSEN: CP 2026-11-02 20:58 ═══════════════════════════════════════════════════════════════════════════════════════════
 * Toppraden klippte den sjunde appikonen. CP: "för många ikoner i topraden, de måste kunna flyttas", och sedan: "Vi kanske skall ha ett max antal ikoner så att användaren
 * får prioritera själv?" Ett tak (`HUVUDMENY_MAX`) utan en kort väg att göra plats är ett nej som skickar användaren på jakt: Appar, appens inställningar, rätt reglage. Platsen
 * där man ser att raden är full är toppraden, så det är där man tar bort en.
 *
 * ⛔ INGEN NY VÄG. Valet anropar `onTaBort`, och skalet ger den `apparArk.onSparaHuvudmeny` med `sattHuvudmeny(huvudmeny, id, false)`: samma funktion och samma callback som
 * reglaget "Visa i huvudmenyn" i appens inställningar (`OpsModulRam`). Ett fält, en skrivväg. Skalet ritar inte omslaget alls när callbacken eller behörigheten saknas, och då är
 * ikonen exakt som förut (en länk utan genväg), se `OpsAppShell`.
 *
 * ⛔ ETT FEL SYNS. Kastar eller avslås callbacken står felet i rutan och rutan stannar öppen. En ruta som stängdes som om det gått bra hade lämnat ikonen kvar utan förklaring.
 *
 * Gesten är `useLangtryck` (en logik för allt som kan hållas in, se dess filhuvud): fingret håller in, högerklick med musen och Shift+F10 öppnar samma ruta. Ett långsamt musklick
 * är ingen genväg (`utanMus`), annars hade ett tveksamt klick på en ikon öppnat rutan i stället för appen. Omslaget är `display: contents` och blir därför ingen egen ruta i klungan.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSHUVUDMENYIKONVAL = {
  taBort: { sv: "Ta bort från huvudmenyn", en: "Remove from main menu" },
  atgarder: { sv: "Åtgärder för {namn}", en: "Actions for {namn}" },
};

/**
 * @param {object} props
 * @param {string} props.namn Appens namn. Står överst i rutan så det syns vilken ikon valet gäller.
 * @param {() => void | Promise<void>} props.onTaBort Tar appen ur huvudmenyn. Kastar eller avslås den visas felet i rutan.
 * @param {import("react").ReactNode} props.children Ikonen.
 */
export function OpsHuvudmenyIkonVal({ namn, onTaBort, children }) {
  const sprak = useOpsSprak();
  const [oppen, setOppen] = useState(false);
  const [fel, setFel] = useState("");
  const [upptagen, setUpptagen] = useState(false);
  const omslag = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const { handelser, iSlappet, stoppaSlappet } = useLangtryck({
    onLangtryck: () => {
      setFel("");
      setOppen(true);
    },
    hogerklick: true,
    utanMus: true,
  });
  // Omslaget har ingen ruta (`contents`), så rutan förankras i ikonen inuti.
  const ankare = useRef(
    /** @type {any} */ ({
      getBoundingClientRect: () => {
        const mal = omslag.current?.firstElementChild ?? omslag.current;
        return mal ? mal.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() { return this; } };
      },
    }),
  );
  const etikett = ordet(ORD_OPSHUVUDMENYIKONVAL, "atgarder", sprak).replace("{namn}", namn);

  const valj = () => {
    if (iSlappet() || upptagen) return;
    setFel("");
    setUpptagen(true);
    // Anropet sker i trycket, inte i nästa tick: ett kast och ett löfte hanteras lika.
    /** @type {void | Promise<void>} */
    let svar;
    try {
      svar = onTaBort();
    } catch (e) {
      svar = Promise.reject(e);
    }
    Promise.resolve(svar)
      .then(
        () => setOppen(false),
        (e) => setFel(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setUpptagen(false));
  };

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <span ref={omslag} data-huvudmeny-ikon="" className={cx("contents", LANGTRYCK_KLASS)} {...handelser}>
        {children}
      </span>
      <Popover.Anchor virtualRef={ankare} />
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          aria-label={etikett}
          data-huvudmeny-ikon-val=""
          className={cx("z-(--z-dropdown) w-56 max-w-[calc(100vw-1rem)]", radBehallare())}
          onOpenAutoFocus={(e) => {
            const forsta = /** @type {HTMLElement | null} */ (e.currentTarget instanceof HTMLElement ? e.currentTarget.querySelector("[role='menuitem']") : null);
            if (forsta) {
              e.preventDefault();
              forsta.focus();
            }
          }}
          onClickCapture={stoppaSlappet}
          // Ett långtryck sätter `open` utan fokus i rutan. Utan det här läser Radix fokus på body som fokus utanför och stänger rutan i samma varv (samma avvärjning som `OpsAtgardsblad`).
          onFocusOutside={(e) => e.preventDefault()}
        >
          <p data-ops-atgard-namn="" className="m-0 truncate px-3 pt-2 pb-1 text-meta font-medium text-ink-muted">{namn}</p>
          <div role="menu" aria-label={namn} className="flex flex-col p-1">
            <button type="button" role="menuitem" tabIndex={-1} disabled={upptagen} aria-busy={upptagen || undefined} className={radKlass({ stor: true })} onClick={valj}>
              <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-4">
                {/* ⛔ EN SNURRA MEDAN DET SPARAS (check-vantar): borttagningen är ett anrop, och en knapp som inte visar att den väntar trycks igen. */}
                {upptagen ? <OpsSpinner size="sm" decorative /> : <KryssIkon size={16} />}
              </span>
              <span className="min-w-0 flex-1 truncate">{ordet(ORD_OPSHUVUDMENYIKONVAL, "taBort", sprak)}</span>
            </button>
          </div>
          {fel ? (
            <p role="alert" data-huvudmeny-ikon-fel="" className="m-0 px-3 pb-2 text-etikett text-danger">
              {fel}
            </p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
