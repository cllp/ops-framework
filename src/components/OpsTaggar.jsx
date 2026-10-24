import { useId, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Tag, X } from "lucide-react";
import { MAX_TAGGAR, MAX_TAGGLANGD, normaliseraTagg, normaliseraTaggar, taggarFel, taggfarg } from "../lib/bibliotek.js";
import { cx } from "../lib/cx.js";
import { radBehallare, radKlass } from "../lib/radKlass.js";

/**
 * Taggfärgerna som verktygsklasser. Skrivna ut ord för ord: Tailwind läser källan och bygger bara de klasser som står i den.
 * `taggfarg` ger 1 till 8.
 */
const TAGGBAKGRUND = ["bg-tagg-1", "bg-tagg-2", "bg-tagg-3", "bg-tagg-4", "bg-tagg-5", "bg-tagg-6", "bg-tagg-7", "bg-tagg-8"];

/** @param {string} tagg */
export const taggKlass = (tagg) => TAGGBAKGRUND[taggfarg(tagg) - 1];

/**
 * Pilarna i en meny (#372): upp och ned flyttar fokus mellan raderna, Home och End till första och sista, och det slår runt.
 * Tab och Enter fungerar som förut. En egen liten hanterare i stället för Radix DropdownMenu, så att Popover, bocken och
 * "Rensa alla" står kvar som de är.
 *
 * @param {import("react").KeyboardEvent<HTMLElement>} e
 */
export function menyPilar(e) {
  const rader = /** @type {HTMLElement[]} */ ([...e.currentTarget.querySelectorAll('[role^="menuitem"]')]);
  if (rader.length === 0) return;
  const nu = rader.indexOf(/** @type {HTMLElement} */ (document.activeElement));
  let till = -1;
  if (e.key === "ArrowDown") till = nu < 0 ? 0 : (nu + 1) % rader.length;
  else if (e.key === "ArrowUp") till = nu < 0 ? rader.length - 1 : (nu - 1 + rader.length) % rader.length;
  else if (e.key === "Home") till = 0;
  else if (e.key === "End") till = rader.length - 1;
  if (till < 0) return;
  e.preventDefault();
  rader[till].focus();
}

/**
 * Ett taggpiller med deterministisk palettfärg (`taggfarg`: samma ord får alltid samma färg i Biblioteket, Inkorgen och Ärenden).
 *
 * - Med `onFilter`: texten är en knapp (`aria-pressed={vald}`, `aria-label="Visa bara <tagg>"`).
 * - Utan `onFilter`: texten är en `<span>` (läsläge eller formulär).
 * - Med `onTaBort`: en separat ×-knapp bredvid texten (`aria-label="Ta bort taggen <tagg>"`), aldrig en knapp inuti en knapp.
 *
 * @param {{ tagg: string, onFilter?: (tagg: string) => void, vald?: boolean, onTaBort?: (tagg: string) => void | Promise<unknown> }} props
 */
export function OpsTaggPiller({ tagg, onFilter, vald = false, onTaBort }) {
  const harTaBort = typeof onTaBort === "function";
  return (
    <span data-bibliotek-tagg={tagg} className={cx("pointer-events-auto inline-flex h-7 max-w-full items-center rounded-full text-meta font-medium text-tagg-text", taggKlass(tagg))}>
      {typeof onFilter === "function" ? (
        <button
          type="button"
          onClick={() => onFilter(tagg)}
          aria-pressed={Boolean(vald)}
          aria-label={`Visa bara ${tagg}`}
          className={cx("h-full min-w-0 cursor-pointer truncate rounded-full bg-transparent pl-2.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent", harTaBort ? "pr-0.5" : "pr-2.5")}
        >
          {tagg}
        </button>
      ) : (
        <span className={cx("min-w-0 truncate pl-2.5", harTaBort ? "pr-0.5" : "pr-2.5")}>{tagg}</span>
      )}
      {harTaBort ? (
        /* vantar-ej: taggen försvinner direkt (setVisas) och kommer tillbaka med ett fel om sparandet faller, se spara() */
        <button
          type="button"
          aria-label={`Ta bort taggen ${tagg}`}
          onClick={() => onTaBort(tagg)}
          className="mr-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X size={12} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

/**
 * Postens taggar som färgade piller, med ett kryss som tar bort och "Lägg till tagg" som öppnar ett fält på raden
 * (SessionStudios `TagChipRowEditable`). Ett tryck på en tagg filtrerar listan på den, och ett tryck till tar bort filtret.
 *
 * ⛔ ETT FEL SYNS OCH TAGGARNA GÅR TILLBAKA. Taggen visas direkt när den läggs till eller tas bort, och faller sparandet visas
 * felet under raden och listan står som den var. En tagg som ser sparad ut och inte är det hade varit en tyst nedsläppsväg.
 *
 * ⛔ SAMMA RÄTT SOM BYT NAMN: `kanAndra` är `farAndra`, författaren och admin. Andra ser taggarna och kan filtrera på dem.
 *
 * @param {{ taggar?: readonly string[], kanAndra?: boolean, forslag?: readonly string[], valda?: readonly string[], onFilter?: (tagg: string) => void, onAndra?: (nastaTaggar: string[]) => void | boolean | Promise<void | boolean> }} props
 */
export function OpsTaggRad({ taggar, kanAndra = false, forslag = [], valda = [], onFilter, onAndra }) {
  const sparade = Array.isArray(taggar) ? taggar : [];
  const [visas, setVisas] = useState(/** @type {string[] | null} */ (null));
  const [skriver, setSkriver] = useState(false);
  const [utkast, setUtkast] = useState("");
  // ⛔ ESCAPE AVBRYTER, ÄVEN OM FÄLTET SEDAN TAPPAR FOKUS. Fältet tas bort i samma rendering som Escape, och en webbläsare som
  // skickar blur då hade sett det gamla utkastet i `onBlur` och sparat taggen man just avbröt.
  const avbruten = useRef(false);
  const [fel, setFel] = useState("");
  const lista = visas ?? sparade;

  /** @param {string[]} ny */
  const spara = (ny) => {
    const problem = taggarFel(ny);
    if (problem) {
      setFel(problem);
      return;
    }
    if (typeof onAndra !== "function") {
      setFel("Sparandet är inte kopplat. Taggarna ändrades inte.");
      return;
    }
    setFel("");
    setVisas(ny);
    Promise.resolve()
      .then(() => onAndra(ny))
      .then(
        (svar) => {
          if (svar === false) throw new Error("Taggarna kunde inte sparas.");
          setVisas(null);
        },
        (e) => {
          throw e;
        },
      )
      .catch((e) => {
        setVisas(null);
        setFel(e instanceof Error && e.message ? e.message : String(e));
      });
  };
  /** @param {string} ord */
  const laggTill = (ord) => {
    const nya = normaliseraTaggar(ord.split(","));
    if (nya.length === 0) return;
    const ny = normaliseraTaggar([...lista, ...nya]);
    setUtkast("");
    if (ny.length === lista.length) return;
    spara(ny);
  };
  const forslagen = forslag.filter((t) => !lista.includes(t) && t.includes(normaliseraTagg(utkast))).slice(0, 8);
  // ⛔ TAGGFÖRSLAGEN MED TANGENTBORDET (#372): pil upp och ned flyttar markeringen i förslagen, Enter väljer den. Fokus stannar i
  // fältet (aria-activedescendant), så Tab gör inte blur för att nå ett förslag.
  const [aktivt, setAktivt] = useState(-1);
  const listId = useId();
  const markerat = aktivt >= 0 && aktivt < forslagen.length ? aktivt : -1;
  if (!kanAndra && lista.length === 0) return null;
  return (
    <div data-bibliotek-taggar="" className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {lista.map((t) => (
          <OpsTaggPiller
            key={t}
            tagg={t}
            vald={valda.includes(t)}
            onFilter={onFilter}
            onTaBort={kanAndra ? () => spara(lista.filter((x) => x !== t)) : undefined}
          />
        ))}
        {kanAndra && lista.length < MAX_TAGGAR ? (
          skriver ? (
            <span className="pointer-events-auto relative inline-flex">
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus -- fältet öppnas av ett tryck på "Lägg till tagg", och fokus ska följa med
                autoFocus
                value={utkast}
                maxLength={MAX_TAGGLANGD}
                aria-label="Ny tagg"
                placeholder="tagg"
                aria-autocomplete="list"
                aria-controls={forslagen.length > 0 ? listId : undefined}
                aria-activedescendant={markerat >= 0 ? `${listId}-${markerat}` : undefined}
                onChange={(e) => {
                  const v = e.target.value;
                  setAktivt(-1);
                  if (v.endsWith(",")) laggTill(v);
                  else setUtkast(v);
                }}
                onKeyDown={(e) => {
                  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && forslagen.length > 0) {
                    e.preventDefault();
                    const steg = e.key === "ArrowDown" ? 1 : -1;
                    setAktivt((markerat + steg + forslagen.length + (markerat < 0 && steg < 0 ? 1 : 0)) % forslagen.length);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    setAktivt(-1);
                    laggTill(markerat >= 0 ? forslagen[markerat] : utkast);
                  } else if (e.key === "Escape") {
                    avbruten.current = true;
                    setUtkast("");
                    setSkriver(false);
                  } else if (e.key === "Backspace" && utkast === "" && lista.length > 0) {
                    spara(lista.slice(0, -1));
                  }
                }}
                onBlur={() => {
                  if (!avbruten.current && normaliseraTagg(utkast)) laggTill(utkast);
                  avbruten.current = false;
                  setSkriver(false);
                }}
                className="h-8 w-36 rounded-full border border-line bg-transparent px-3 text-meta text-ink outline-none focus:border-accent"
              />
              {forslagen.length > 0 ? (
                <span id={listId} role="listbox" aria-label="Förslag" className={cx("absolute top-9 left-0 z-(--z-dropdown) flex min-w-32 flex-col p-1", radBehallare())}>
                  {forslagen.map((t, i) => (
                    /* vantar-ej: taggen läggs till direkt (setVisas) och tas tillbaka med ett fel om sparandet faller, se spara() */
                    <button
                      key={t}
                      id={`${listId}-${i}`}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={i === markerat}
                      data-markerat={i === markerat ? "" : undefined}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => laggTill(t)}
                      className={radKlass({ active: i === markerat })}
                    >
                      <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", taggKlass(t))} />
                      <span className="min-w-0 flex-1 truncate">{t}</span>
                    </button>
                  ))}
                </span>
              ) : null}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFel("");
                avbruten.current = false;
                setSkriver(true);
              }}
              className="pointer-events-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-ink-muted/50 bg-transparent px-3 text-meta font-medium text-ink-secondary hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              <Tag size={14} aria-hidden="true" />
              {lista.length === 0 ? "Lägg till tagg" : "Tagg"}
            </button>
          )
        ) : null}
      </div>
      {fel ? <p role="alert" className="pointer-events-auto m-0 text-meta text-danger">{fel}</p> : null}
    </div>
  );
}

/**
 * "Taggar" bredvid sökfältet: alla taggar i platsen med färg och antal, flerval, och "Rensa alla" (SessionStudios
 * `TagFilterDropdown`). Valda taggar är "OCH", som i `filtreraBibliotek`.
 *
 * Med valfri `extra` (t.ex. GitHub-labels i Ärenden) ritas en andra sektion under taggarna i samma popover med egen rubrik,
 * egen `role="menu"` och konturpiller (`border border-line bg-surface text-ink-secondary`), medan trigger-knappen och "Rensa alla"
 * räknar respektive nollar båda.
 *
 * ⛔ TOMT ÄR ETT SVAR (regel 5): utan taggar säger panelen det. SessionStudio skrev "Alla taggar" två gånger där.
 *
 * @param {{ taggar: ReadonlyArray<{ tagg: string, antal: number }>, valda: readonly string[], onValda: (valda: string[]) => void, extra?: { rubrik: string, ikon?: import("react").ReactNode, lista: ReadonlyArray<{ namn: string, antal: number }>, valda: readonly string[], onValda: (valda: string[]) => void } }} props
 */
export function OpsTaggFilter({ taggar, valda, onValda, extra }) {
  const [oppen, setOppen] = useState(false);
  const extraLista = extra && Array.isArray(extra.lista) ? extra.lista : [];
  const extraValda = extra && Array.isArray(extra.valda) ? extra.valda : [];
  const antalValda = valda.length + extraValda.length;
  const aktiv = antalValda > 0;
  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        data-bibliotek-taggfilter=""
        aria-label={aktiv ? `Taggar, ${antalValda} valda` : "Taggar"}
        className={cx(
          "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-4 text-etikett font-medium",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          aktiv ? "border-transparent bg-accent text-accent-contrast" : "border-line bg-raised text-ink hover:bg-hover",
        )}
      >
        <span>{aktiv ? `Taggar (${antalValda})` : "Taggar"}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} collisionPadding={8} className={cx("z-(--z-dropdown) w-64 max-w-[calc(100vw-1rem)] p-2", radBehallare())}>
          <div className="flex items-center justify-between gap-2 border-b border-line px-1 pb-2">
            <span className="text-meta font-medium text-ink-secondary">Alla taggar</span>
            {aktiv ? (
              <button
                type="button"
                onClick={() => {
                  onValda([]);
                  if (extra && typeof extra.onValda === "function") extra.onValda([]);
                }}
                className="cursor-pointer rounded-sm bg-transparent text-meta font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent"
              >
                Rensa alla
              </button>
            ) : null}
          </div>
          {taggar.length === 0 ? (
            <p className="m-0 px-1 pt-2 text-meta text-ink-muted">Inga taggar ännu. Lägg till en på en post.</p>
          ) : (
            <div role="menu" aria-label="Taggar" onKeyDown={menyPilar} className="flex max-h-64 flex-col overflow-y-auto pt-1">
              {taggar.map(({ tagg, antal: n }) => {
                const pa = valda.includes(tagg);
                return (
                  <button
                    key={tagg}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={pa}
                    onClick={() => onValda(pa ? valda.filter((t) => t !== tagg) : [...valda, tagg])}
                    className={cx(radKlass(), pa && "bg-accent-subtle")}
                  >
                    <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", taggKlass(tagg))} />
                    <span className="min-w-0 flex-1 truncate">{tagg}</span>
                    <span className="shrink-0 text-hjalp text-ink-muted tabular-nums">{n}</span>
                  </button>
                );
              })}
            </div>
          )}
          {extraLista.length > 0 && extra ? (
            <div className="mt-2 border-t border-line pt-2">
              <div className="px-1 pb-1">
                <span className="text-meta font-medium text-ink-secondary">{extra.rubrik}</span>
              </div>
              <div role="menu" aria-label={extra.rubrik} onKeyDown={menyPilar} className="flex max-h-64 flex-col overflow-y-auto pt-1">
                {extraLista.map(({ namn, antal: n }) => {
                  const pa = extraValda.includes(namn);
                  return (
                    <button
                      key={namn}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={pa}
                      onClick={() => extra.onValda(pa ? extraValda.filter((x) => x !== namn) : [...extraValda, namn])}
                      className={cx(radKlass(), pa && "bg-accent-subtle")}
                    >
                      <span className="inline-flex min-w-0 flex-1 items-center gap-1 truncate rounded-full border border-line bg-surface px-2 py-0.5 text-meta font-medium text-ink-secondary">
                        {extra.ikon ? <span className="inline-flex shrink-0" aria-hidden="true">{extra.ikon}</span> : null}
                        <span className="truncate">{namn}</span>
                      </span>
                      <span className="shrink-0 text-hjalp text-ink-muted tabular-nums">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
