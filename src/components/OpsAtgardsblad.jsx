import { useId, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { MoreVertical } from "lucide-react";
import { cx } from "../lib/cx.js";
import { ordet } from "../lib/ord.js";
import { radBehallare, radKlass } from "../lib/radKlass.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { useLangtryck } from "./useLangtryck.js";

/**
 * Långtryck, högerklick och en ⋮-knapp öppnar samma åtgärder för en post.
 *
 * ⛔ HÄNDELSEN: CP om Bibliotekets lista. SessionStudios `ResourceCard` har ett
 * överflödesmeny (Öppna, Redigera, Radera) och ett långtryck. På skrivbordet
 * finns inget långtryck att lita på, och en skärmläsare når det inte: därför
 * ⋮ och högerklick, samma poster. Ett långtryck som också var ett klick hade
 * både öppnat menyn och posten. Klicket sväljs när hålltiden nåtts.
 *
 * Hålltiden är `LANGTRYCK_MS` i `apparark.js`, samma som app-arket, genom `useLangtryck` (0.103.0). En egen
 * millisekund här hade glidit isär.
 *
 * Komponenten känner ingen fil: den får poster och anropar dem.
 *
 * ⛔ EN RUTA VID RADEN, INTE ETT ARK NERIFRÅN (0.102.0). CP 2026-10-14, med en skärmbild av arket i mörkt läge med tio rader:
 * "Kanske popup med en kortare meny för artefakten?" Under 768 px var menyn ett ark över halva skärmen, med postens namn och
 * Stäng överst. Nu är den samma lilla ruta på alla bredder, förankrad i raden som hölls in eller i ⋮, med postens namn som en
 * rad överst så att det syns vilken post menyn gäller. Utanför rutan och Escape stänger, som förut.
 */

export const ORD_OPSATGARDSBLAD = {
  atgarder: { sv: "Åtgärder för {namn}", en: "Actions for {namn}" },
};

/**
 * @typedef {object} Atgard
 * @property {string} id
 * @property {string} etikett
 * @property {() => void} onValj
 * @property {boolean} [fara]
 * @property {import("react").ReactNode} [ikon]
 * @property {boolean} [avstangd] (0.133.0) Raden är avstängd: den syns, går att nå med tangentbordet och läses upp som avstängd (`aria-disabled`), men gör ingenting vid ett tryck och stänger inte menyn. Kräver `forklaring`.
 * @property {string} [forklaring] (0.133.0) Varför raden är avstängd, en kort mening som står under etiketten och som skärmläsaren läser med raden (`aria-describedby`). Krävs när `avstangd` är sant och är ett fel utan det.
 */

/**
 * @param {object} props
 * @param {string} props.namn Postens namn. Knappen och menyn annonserar det.
 * @param {readonly Atgard[]} props.poster
 * @param {import("react").ReactNode} [props.children] Raden som tar långtryck och högerklick. Utan barn ritas bara knappen.
 * @param {boolean} [props.baraKnapp] Bara ⋮, utan radomslag. För ett öppet dokument.
 * @param {boolean} [props.kort] (0.102.0) Raden är ett kort: ⋮ uppe till höger i stället för mitt på raden, och tätare kant.
 * @param {(stang: () => void) => import("react").ReactNode} [props.overst] (0.106.0, #386) Något som står överst i rutan, under namnet
 *   och före posterna: chattens reaktioner, som på telefonen bor i samma meny som meddelandets åtgärder. Får en funktion som stänger.
 */
export function OpsAtgardsblad({ namn, poster, children = null, baraKnapp = false, kort = false, overst }) {
  const sprak = useOpsSprak();
  const [oppen, setOppen] = useState(false);
  /*
   * ⛔ FINGRET SOM ÖPPNADE MENYN VÄLJER INGET NÄR DET LYFTS (0.100.1, lifehub.app#226). På en smal skärm var menyn då ett ark nerifrån.
   * Hölls en rad i nedre halvan av skärmen låg arket under fingret när det lyftes, och klicket som följer släppet träffade raden
   * där, oftast Öppna. Mätt i Chromium med pekskärm i iPhone-storlek: rad ett och två gav menyn, rad tre och fyra öppnade posten.
   * Spärren gäller bara klicket från samma tryck, och den är ett tidsfönster (`iSlappet`), se `useLangtryck`.
   * Spärren står kvar med rutan (0.102.0): den förankras vid raden som hölls in, och kan ligga under fingret på samma sätt.
   * ⛔ 0.103.0: LOGIKEN BOR I `useLangtryck`, som skalets ikoner också använder. Den stod här, och en andra kopia i bottenraden
   * hade glidit isär från den.
   */
  const { handelser, iSlappet, stoppaSlappet } = useLangtryck({
    onLangtryck: () => setOppen(true),
    hogerklick: true,
    // ⛔ MUSEN HAR HÖGERKLICK OCH ⋮ (0.151.0, granskningen av PR 458, fynd 5): ett långsamt musklick på en rad öppnade menyn i stället för raden. Fingret och pennan håller in som förut.
    utanMus: true,
    hoppaOver: (mal) => mal instanceof Element && Boolean(mal.closest("[data-ops-atgard-knapp]")),
  });
  const menyRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const forklaringsId = useId();

  if (typeof namn !== "string" || namn === "") {
    throw new Error("OpsAtgardsblad: namn krävs. Knappen och menyn annonserar vilken post det gäller, och utan namn är ⋮ en ikon utan ord.");
  }
  // Utan poster och utan något överst finns ingen meny. Med bara det översta (en meddelandes reaktioner) finns den.
  if (!Array.isArray(poster) || (poster.length === 0 && !overst)) {
    return baraKnapp ? null : children;
  }
  for (const p of poster) {
    if (!p || typeof p.etikett !== "string" || p.etikett === "" || typeof p.onValj !== "function") {
      throw new Error("OpsAtgardsblad: varje post behöver etikett och onValj. En tom rad i menyn går att fokusera och gör ingenting.");
    }
    // ⛔ EN AVSTÄNGD RAD SÄGER VARFÖR (0.133.0, CP 2026-10-20: "tre typer med tre olika menyer" ska bli en). Två undantag i menyn ska synas och inte saknas, och en
    // grå rad utan förklaring är precis den rad som får någon att tro att menyn är trasig. Omvänt är en förklaring på en rad som går att välja en förklaring
    // som aldrig syns som avstängning: båda är fel i anropet och kastas.
    if (p.avstangd === true && (typeof p.forklaring !== "string" || p.forklaring.trim() === "")) {
      throw new Error(`OpsAtgardsblad: raden "${p.etikett}" är avstängd utan forklaring. En avstängd rad säger varför, annars ser menyn trasig ut.`);
    }
    if (p.avstangd !== true && p.forklaring !== undefined) {
      throw new Error(`OpsAtgardsblad: raden "${p.etikett}" har en forklaring men är inte avstängd. Forklaringen hör till avstangd: true.`);
    }
  }

  const etikett = ordet(ORD_OPSATGARDSBLAD, "atgarder", sprak).replace("{namn}", namn);

  /**
   * @param {any} e
   */
  function tangenter(e) {
    const rot = /** @type {HTMLElement | null} */ (e.currentTarget);
    if (!rot) return;
    /*
     * ⛔ PILARNA NÅR OCKSÅ DET SOM STÅR ÖVERST (granskningen av PR 390). Chattens sex reaktioner ligger ovanför posterna, och pilarna
     * gick bara mellan posterna: en tangentbordsanvändare som öppnade Mer-menyn kunde inte nå en reaktion annat än med Tab, som i en
     * `role="menu"` inte är vägen. Alla knappar i menyn, i den ordning de ritas, är en enda lista. Vänster och höger går i listan
     * när fokus står bland det översta, där raden går i sidled.
     */
    const rader = [...rot.querySelectorAll("[data-ops-atgard-overst] button:not(:disabled), [role='menuitem']")];
    if (rader.length === 0) return;
    const index = rader.indexOf(/** @type {Element} */ (document.activeElement));
    const nu = index < 0 ? 0 : index;
    const iOverst = document.activeElement instanceof Element && Boolean(document.activeElement.closest("[data-ops-atgard-overst]"));
    if (e.key === "ArrowDown" || (iOverst && e.key === "ArrowRight")) {
      e.preventDefault();
      /** @type {HTMLElement} */ (rader[(nu + 1) % rader.length]).focus();
    } else if (e.key === "ArrowUp" || (iOverst && e.key === "ArrowLeft")) {
      e.preventDefault();
      /** @type {HTMLElement} */ (rader[(nu - 1 + rader.length) % rader.length]).focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      /** @type {HTMLElement} */ (rader[0]).focus();
    } else if (e.key === "End") {
      e.preventDefault();
      /** @type {HTMLElement} */ (rader[rader.length - 1]).focus();
    }
  }

  const rader = (
    <div ref={menyRef} role="menu" aria-label={namn} className="flex flex-col p-1">
      {poster.map((p) =>
        p.avstangd === true ? (
          // ⛔ `aria-disabled` OCH INTE `disabled` (0.133.0): en avstängd knapp går inte att fokusera, och då hade piltangenterna hoppat över raden och förklaringen
          // aldrig lästs av en tangentbordsanvändare. Raden nås, läses som avstängd tillsammans med sin förklaring, och ett tryck gör ingenting och lämnar menyn öppen.
          <button
            key={p.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled="true"
            aria-labelledby={`${forklaringsId}-${p.id}-etikett`}
            aria-describedby={`${forklaringsId}-${p.id}`}
            data-ops-atgard-avstangd=""
            className={cx(radKlass({ stor: true, klickbar: false }), "cursor-not-allowed")}
            onClick={(e) => e.preventDefault()}
          >
            {p.ikon ? <span aria-hidden="true" className="flex shrink-0 items-center text-ink-muted [&_svg]:size-4">{p.ikon}</span> : null}
            <span className="flex min-w-0 flex-1 flex-col">
              <span id={`${forklaringsId}-${p.id}-etikett`} className="truncate text-ink-muted">{p.etikett}</span>
              <span id={`${forklaringsId}-${p.id}`} data-ops-atgard-forklaring="" className="text-meta text-ink-muted">{p.forklaring}</span>
            </span>
          </button>
        ) : (
          <button
            key={p.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={radKlass({ stor: true })}
            onClick={() => {
              if (iSlappet()) return;
              setOppen(false);
              p.onValj();
            }}
          >
            {p.ikon ? <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-4">{p.ikon}</span> : null}
            <span className={cx("min-w-0 flex-1 truncate", p.fara && "text-danger")}>{p.etikett}</span>
          </button>
        ),
      )}
    </div>
  );

  const fokusForsta = (/** @type {any} */ e) => {
    const rot = /** @type {HTMLElement} */ (e.currentTarget);
    const forsta = rot.querySelector("[role='menuitem']");
    if (forsta instanceof HTMLElement) {
      e.preventDefault();
      forsta.focus();
    }
  };

  const knappKlass = "inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const knappInnehall = <MoreVertical size={20} aria-hidden="true" />;
  const knapp = (
    <Popover.Trigger
      type="button"
      data-ops-atgard-knapp=""
      aria-label={etikett}
      className={knappKlass}
    >
      {knappInnehall}
    </Popover.Trigger>
  );

  const rad = baraKnapp ? (
    <span className="inline-flex">{knapp}</span>
  ) : (
    <div
      data-ops-atgard=""
      className={kort ? "flex w-full items-start gap-1 py-4 pr-1 pl-4" : "flex w-full items-center gap-1 px-4 py-3"}
      {...handelser}
    >
      <div className={cx("flex min-w-0 flex-1 gap-3", kort ? "items-start" : "items-center")}>{children}</div>
      {knapp}
    </div>
  );

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      {baraKnapp ? rad : <Popover.Anchor asChild>{rad}</Popover.Anchor>}
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          aria-label={etikett}
          // ⛔ BREDARE MED NÅGOT ÖVERST (0.106.0, #386 skiva 6). Chattens sex reaktioner om 44 px fick 34 px i en ruta på 224 px (mätt i
          // check-skalyta, chatt (3) vid 390 px). 288 px rymmer sex knappar om 44 px med mellanrum.
          className={cx("z-(--z-dropdown) max-w-[calc(100vw-1rem)]", overst ? "w-72" : "w-56", radBehallare())}
          onOpenAutoFocus={fokusForsta}
          onKeyDown={tangenter}
          onClickCapture={stoppaSlappet}
          /*
           * Långtryck sätter `open` utan ett klick på ⋮. Fokus ligger då kvar
           * på body, och DismissableLayer läser det som fokus utanför och
           * stänger menyn i samma varv. Samma avvärjning som `OpsPanel`.
           * Ett klick utanför stänger fortfarande.
           */
          onFocusOutside={(e) => e.preventDefault()}
          /*
           * ⛔ EN POST SOM FLYTTAR FOKUS FÅR BEHÅLLA DET (0.106.0, #386 skiva 6). Svara med citat i chattens Mer-meny lägger fokus i
           * skrivfältet, och Radix lämnade sedan tillbaka det till ⋮ när rutan stängdes: det man skrev hamnade på knappen (mätt i
           * check-skalyta, chatt (5) vid 390 px). Står fokus utanför rutan och inte på sidan är det postens val, och det står kvar.
           */
          onCloseAutoFocus={(e) => {
            const aktiv = typeof document === "undefined" ? null : document.activeElement;
            if (aktiv && aktiv !== document.body && !menyRef.current?.contains(aktiv) && !aktiv.closest("[data-ops-atgard-overst]")) e.preventDefault();
          }}
        >
          <p data-ops-atgard-namn="" className="m-0 truncate px-3 pt-2 pb-1 text-meta font-medium text-ink-muted">{namn}</p>
          {overst ? <div data-ops-atgard-overst="">{overst(() => setOppen(false))}</div> : null}
          {poster.length > 0 ? rader : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
