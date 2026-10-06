import { createContext, useContext, useEffect, useId, useRef } from "react";
import { cx } from "../lib/cx.js";
import { definierade, forvalda } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ChevronHogerIkon, KugghjulIkon } from "./icons.jsx";
import { TillbakaKnapp } from "./TillbakaKnapp.jsx";

/**
 * Inställningarna: en lista med sektioner, och varje sektion i en egen panel med tillbaka-pil (0.69.0, #274).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-06 20:12, med en skärmbild av Inställningar i LifeHub på surfplatta: "hela inställnings-panelen är superrörig.
 * Vi måste bygga ett intuitivt, enkelt och rent inställningspanel. Sektioner kanske skall stå ensamma, med att man navigerar
 * till en specifik panel med tillbaka-pil mm. Texterna känns ihoptryckta." Sidan var ett enda långt flöde där kategorier,
 * prioriteter, slag och modultyper låg staplade som kort, med små rubriker och täta rader.
 *
 * ══ ⛔ RAMVERKET GER SKALET, APPEN GER SEKTIONERNA ══════════════════════════════════════════════════════════════════
 *
 * Varje sektion är `{ id, ikon, rubrik, beskrivning, antal, innehall }`. Ramverket vet inte vad en sektion innehåller och känner
 * inga samlingsnamn: innehållet är appens egna komponenter (ofta `OpsKatalogInstallning` och `OpsModulTyper`), och de skriver
 * genom appens datakällor som förut.
 *
 * ⛔ DEN VALDA SEKTIONEN ÄR APPENS, OCH DEN LIGGER I ADRESSEN. `vald` och `onValj` kommer utifrån, som `valt` i `OpsMeddelanden`.
 * Ramverket känner ingen router: appen läser sektionen ur adressen (`/installningar/medlemmar` eller `?sektion=medlemmar`) och
 * skriver den dit i `onValj`. Då fungerar webbläsarens tillbaka, en länk till en sektion går att dela, och en omladdning står
 * kvar där man var. Ett eget `useState` här hade gjort varje av de tre omöjliga.
 *
 * ⛔ ETT OKÄNT `vald` ÄR INGEN TOM PANEL. En gammal länk till en sektion som inte längre finns (eller som den här rollen inte får
 * se) ritar listan, som om inget var valt. En tom panel med en rubrik som inte finns hade sett ut som ett fel i appen.
 *
 * ══ ⛔ LAYOUTEN: EN KOLUMN UNDER `lg`, TVÅ FRÅN `lg` ════════════════════════════════════════════════════════════════
 *
 * Ärendet: "På dator står listan till vänster och den valda sektionen till höger. På telefon och surfplatta i stående läge
 * ersätter panelen listan." En iPad i stående läge är 820 px, så gränsen är `lg` (1024) och inte `md` som i Meddelanden: två
 * kolumner i 820 px ger en panel på drygt 500 px, och en katalog med färg, ikon och knappar per rad trängs där igen, vilket är
 * exakt vad CP klagade på. Bytet sker i CSS och inte i JavaScript, så att det inte blinkar vid första ritningen och så att
 * `check-skalyta` mäter samma sak som telefonen ser.
 *
 * ⛔ TILLBAKA-PILEN FINNS BARA DÄR LISTAN ÄR DOLD. Från `lg` står listan bredvid, och en pil som "går tillbaka" till något som
 * redan syns är en knapp som inte gör något synligt.
 *
 * ══ ⛔ LUFT: RADER PÅ MINST 56 PX, RUBRIK OCH HJÄLPTEXT PÅ VAR SIN RAD ════════════════════════════════════════════════
 *
 * Raden är `min-h-14` (56 px): ikonen i en ruta på 36 px, rubriken i brödtextens storlek (16 px) och halvfet, beskrivningen på
 * egen rad i 12 px dämpat, antalet till höger i tabellsiffror och en chevron sist som säger att raden leder vidare. Panelens
 * rubrik är 18 px och dess beskrivning 14 px på egen rad. Mätt i `check-skalyta` avsnitt 43.
 *
 * ══ ⛔ TANGENTBORD OCH SKÄRMLÄSARE ═══════════════════════════════════════════════════════════════════════════════════
 *
 * Listan är en `<ul>` med en knapp per rad, och den valda bär `aria-current`. När en panel öppnas flyttas fokus till dess
 * rubrik (`tabIndex=-1`), så att skärmläsaren läser var man hamnat och nästa Tab går in i panelen. När man går tillbaka, med
 * pilen eller med webbläsarens tillbaka, flyttas fokus till raden man kom ifrån. Utan det hamnar fokus på `body` när panelen
 * avmonteras, och en tangentbordsanvändare får börja om från sidans topp. ⛔ Vid första ritningen flyttas inget fokus: en sida
 * som öppnas på en sektion ur adressen ska inte stjäla fokus från webbläsarens adressfält.
 *
 * ══ ⛔ EN RUBRIK, INTE TVÅ ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Panelen ger sitt innehåll en kontext (`useInstallningspanel`). `OpsKatalogInstallning` och `OpsModulTyper` läser den: deras
 * egen rubrik blir nivå 3 under panelens nivå 2, och är den samma som panelens ritas den inte alls. Annars hade panelen
 * "Prioriteter" börjat med rubriken PRIORITETER en gång till, som första rad i innehållet.
 */

/**
 * @typedef {object} Installningssektion
 * @property {string} id Sektionens nyckel. Står i adressen, så den ska vara stabil och läsbar (`medlemmar`, inte ett slumpat id).
 * @property {import("react").ReactNode} [ikon] Ritad ikon, 20 px. Utelämnad: kugghjulet.
 * @property {string} rubrik
 * @property {string} [beskrivning] En rad om vad sektionen gäller, på användarens språk.
 * @property {number | string | null} [antal] Antalet där det passar (medlemmar, kalendrar). ⛔ 0 ritas som 0: tomt är ett svar.
 *   `undefined` och `null` ritar inget tal, för sektioner där ett antal inte säger något.
 * @property {import("react").ReactNode} innehall Panelens innehåll. Monteras bara när sektionen är vald.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSINSTALLNINGAR = {
  rubrik: { sv: "Inställningar", en: "Settings" },
  tillbakaEtikett: { sv: "Tillbaka", en: "Back" },
  valjText: { sv: "Välj vad du vill se eller ändra.", en: "Choose what you want to view or change." },
};

const Panelkontext = createContext(/** @type {{ rubrik: string, rubrikId: string } | null} */ (null));

/**
 * Panelen en komponent står i, om den står i en: `{ rubrik, rubrikId }` eller `null`. `OpsKatalogInstallning` och `OpsModulTyper`
 * läser den för att inte rita samma rubrik två gånger.
 */
export function useInstallningspanel() {
  return useContext(Panelkontext);
}

/**
 * Rubriken för en del av en panel: nivå 2 utanför en panel (som förut), nivå 3 inuti, och ingen synlig rubrik alls när den är
 * samma som panelens. ⛔ Rubriken används också som sektionens namn (`aria-labelledby`), så när den inte ritas pekar
 * namnet på panelens rubrik i stället.
 *
 * @param {string} rubrik
 * @param {string} egetId
 * @param {{ rubrik: string, rubrikId: string } | null} panel
 * @returns {{ niva: 2 | 3 | null, etikettId: string }}
 */
export function delrubrik(rubrik, egetId, panel) {
  if (!panel) return { niva: 2, etikettId: egetId };
  if (rubrik.trim().toLocaleLowerCase("sv") === panel.rubrik.trim().toLocaleLowerCase("sv")) return { niva: null, etikettId: panel.rubrikId };
  return { niva: 3, etikettId: egetId };
}

/**
 * Delens rubrik, på den nivå `delrubrik` gav. `null`: ingen synlig rubrik (panelens rubrik säger redan samma sak).
 *
 * @param {{ niva: 2 | 3 | null, id: string, children: import("react").ReactNode }} props
 */
export function Delrubrik({ niva, id, children }) {
  if (niva === null) return null;
  const Tagg = niva === 3 ? "h3" : "h2";
  return (
    <Tagg id={id} className="m-0 text-sektion uppercase text-accent">
      {children}
    </Tagg>
  );
}

/**
 * @param {object} props
 * @param {ReadonlyArray<Installningssektion>} props.sektioner
 * @param {string | null | undefined} props.vald Den valda sektionens `id`, ur adressen. `null` eller ett okänt id: listan.
 * @param {(id: string | null) => void} props.onValj Skriver valet till adressen. `null` är tillbaka till listan.
 * @param {string} [props.rubrik] Sidans rubrik (nivå 1) över listan. Förval "Inställningar".
 * @param {string} [props.beskrivning] En rad under sidans rubrik, till exempel vilken grupp inställningarna gäller.
 * @param {string} [props.tillbakaEtikett] Förval "Tillbaka".
 * @param {string} [props.valjText] Texten i högerkolumnen på dator när inget är valt.
 * @param {"sv" | "en"} [props.sprak]
 */
export function OpsInstallningar(props) {
  const kontext = useOpsSprak();
  const sprak = props.sprak ?? kontext;
  return <OpsInstallningarRitad {...forvalda(ORD_OPSINSTALLNINGAR, sprak)} {...definierade(props)} />;
}

/** @param {any} p */
function OpsInstallningarRitad({
  sektioner,
  vald,
  onValj,
  rubrik = ORD_OPSINSTALLNINGAR.rubrik.sv,
  beskrivning,
  tillbakaEtikett = ORD_OPSINSTALLNINGAR.tillbakaEtikett.sv,
  valjText = ORD_OPSINSTALLNINGAR.valjText.sv,
}) {
  if (!Array.isArray(sektioner)) throw new Error("OpsInstallningar: sektioner krävs, en lista med { id, rubrik, innehall }.");
  if (typeof onValj !== "function") {
    throw new Error("OpsInstallningar: onValj krävs. Den valda sektionen ligger i adressen, och det är appen som skriver dit den.");
  }
  const sedda = new Set();
  for (const s of sektioner) {
    if (!s || typeof s.id !== "string" || s.id === "" || typeof s.rubrik !== "string" || s.rubrik === "") {
      throw new Error("OpsInstallningar: varje sektion behöver ett id och en rubrik.");
    }
    if (sedda.has(s.id)) throw new Error(`OpsInstallningar: två sektioner har id "${s.id}". Id:t står i adressen och måste vara unikt.`);
    sedda.add(s.id);
  }

  /** @type {Installningssektion | null} */
  const aktiv = (vald && sektioner.find((/** @type {Installningssektion} */ s) => s.id === vald)) || null;
  const aktivId = aktiv ? aktiv.id : null;
  const sidrubrikId = useId();
  const panelrubrikId = useId();
  const panelrubrik = useRef(/** @type {HTMLHeadingElement | null} */ (null));
  const rader = useRef(/** @type {Map<string, HTMLButtonElement>} */ (new Map()));
  const forra = useRef(aktivId);

  // ⛔ FOKUS FÖLJER BYTET, INTE FÖRSTA RITNINGEN (se filhuvudet). `forra` börjar på det första värdet, så monteringen är inget byte.
  useEffect(() => {
    const fran = forra.current;
    forra.current = aktivId;
    if (fran === aktivId) return;
    if (aktivId) panelrubrik.current?.focus();
    else if (fran) rader.current.get(fran)?.focus();
  }, [aktivId]);

  return (
    <div data-ops-installningar="" className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* ── Listan ─────────────────────────────────────────────────────────────────────────────────────── */}
      <div data-installningslista="" className={cx("min-w-0 flex-col gap-4", aktiv ? "hidden lg:flex" : "flex")}>
        <header className="flex flex-col gap-1.5 px-1">
          <h1 id={sidrubrikId} className="m-0 font-display text-sida font-bold leading-tight tracking-tight text-ink">
            {rubrik}
          </h1>
          {beskrivning ? <p className="m-0 text-etikett text-ink-muted">{beskrivning}</p> : null}
        </header>
        <nav aria-labelledby={sidrubrikId} className="rounded-xl bg-surface p-2">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {sektioner.map((/** @type {Installningssektion} */ s) => {
              const ar = s.id === aktivId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    data-sektion={s.id}
                    aria-current={ar ? "true" : undefined}
                    ref={(el) => {
                      if (el) rader.current.set(s.id, el);
                      else rader.current.delete(s.id);
                    }}
                    onClick={() => onValj(s.id)}
                    className={cx(
                      "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-card px-3 py-3 text-left transition-colors duration-(--duration-fast) ease-standard",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                      ar ? "bg-hover" : "hover:bg-hover",
                    )}
                  >
                    <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-base bg-accent-faint text-accent">
                      {s.ikon ?? <KugghjulIkon size={20} />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span data-radrubrik="" className="text-brod font-semibold text-ink">
                        {s.rubrik}
                      </span>
                      {s.beskrivning ? (
                        <span data-radbeskrivning="" className="text-meta text-ink-muted">
                          {s.beskrivning}
                        </span>
                      ) : null}
                    </span>
                    {s.antal !== undefined && s.antal !== null ? (
                      <span data-antal="" className="shrink-0 text-etikett tabular-nums text-ink-muted">
                        {s.antal}
                      </span>
                    ) : null}
                    <span aria-hidden="true" className="inline-flex shrink-0 text-ink-muted">
                      <ChevronHogerIkon size={18} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* ── Panelen, eller på dator raden om att välja ───────────────────────────────────────────────── */}
      {aktiv ? (
        <section
          data-installningspanel={aktiv.id}
          aria-labelledby={panelrubrikId}
          className="flex min-w-0 flex-col gap-5 rounded-xl bg-surface p-4 sm:p-6"
        >
          <div className="-mt-1 lg:hidden">
            <TillbakaKnapp onClick={() => onValj(null)} etikett={tillbakaEtikett} />
          </div>
          <header className="flex flex-col gap-1.5">
            <h2
              id={panelrubrikId}
              ref={panelrubrik}
              tabIndex={-1}
              className="m-0 font-display text-titel font-bold leading-tight tracking-tight text-ink outline-none"
            >
              {aktiv.rubrik}
            </h2>
            {aktiv.beskrivning ? <p className="m-0 text-etikett text-ink-muted">{aktiv.beskrivning}</p> : null}
          </header>
          <Panelkontext.Provider value={{ rubrik: aktiv.rubrik, rubrikId: panelrubrikId }}>
            <div className="flex min-w-0 flex-col gap-6">{aktiv.innehall}</div>
          </Panelkontext.Provider>
        </section>
      ) : (
        <div data-installningar-valj="" className="hidden min-h-40 flex-col items-center justify-center rounded-xl bg-surface px-6 py-10 text-center lg:flex">
          <span aria-hidden="true" className="text-ink-muted opacity-50">
            <KugghjulIkon size={40} />
          </span>
          <p className="m-0 mt-3 text-etikett text-ink-muted">{valjText}</p>
        </div>
      )}
    </div>
  );
}
