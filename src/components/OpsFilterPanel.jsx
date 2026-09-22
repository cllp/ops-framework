import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { BockIkon, KryssIkon, ReglageIkon, SorteringIkon } from "./icons.jsx";
import { Raknare } from "./raknare.jsx";

/**
 * Filter i flera dimensioner, bakom EN knapp, plus sortering.
 *
 * ── ⛔ VARFÖR EN TILL OCH INTE `OpsFilterChip` ─────────────────────────
 *
 * `OpsFilterChip` filtrerar på EN sak. Ska en lista filtreras på slag, status
 * och tid finns två vägar: tre piller bredvid varandra, eller en knapp som
 * öppnar allt. Tre piller är mätbart fel här: verktygsraden på Idag har redan
 * ett segment i mitten, och vid 390 px finns inte plats för tre piller till
 * utan att raden bryts. En bruten verktygsrad flyttar dessutom listan nedåt på
 * varje besök, för kontroller man rör en gång i veckan.
 *
 * ⛔ DEN ERSÄTTER INTE `OpsFilterChip`. En lista med en enda filterdimension
 * ska fortsätta använda pillret: en panel för ett val är ett klick extra utan
 * att något blir tydligare.
 *
 * ── ⛔ KNAPPEN BYTER FORM MED VALET, OCH DET ÄR HELA POÄNGEN ───────────
 *
 * CP 2026-09-21, med två bilder ur SessionStudio: "Ingen text när inget filter
 * är valt, endast när det är valt."
 *
 *   inget valt  -> rund ikonknapp, ingen text
 *   ett valt    -> piller med ikon plus DEN VALDA ETIKETTEN
 *   flera valda -> samma piller plus en räknare i hörnet
 *
 * Skälet är att ett filter som ser likadant ut oavsett val låter en läsa en
 * beskuren lista i tron att den är komplett. Ordet i knappen är svaret på
 * "vad har jag filtrerat bort", och det ska synas utan att man öppnar något.
 *
 * ⛔ ORDET SITTER I KNAPPEN OCH INTE PÅ EN EGEN RAD UNDER. Idag hade en sådan
 * rad, och den flyttade hela listan nedåt så fort man filtrerade. Knappen bär
 * sitt eget tillstånd, precis som pillret gör.
 *
 * ── ⛔ SORTERING RÄKNAS ALDRIG SOM ETT FILTER ──────────────────────────
 *
 * Räknaren och ordet i knappen visar bara FILTER. En sorterad lista är
 * fortfarande komplett, och att låta en sortering tända filterknappen hade
 * sagt "något är dolt" när ingenting är dolt. Sorteringen ligger ändå i samma
 * panel, eftersom det är samma fråga ställd av samma person vid samma tillfälle.
 *
 * ══ ⛔ TVÅ UTFÖRANDEN, OCH SKÄLET ÄR HÖJDEN ════════════════════════════
 *
 * CP 2026-09-22, med bild: "Detta filtret är absurt stort. Vi måste hitta ett
 * bättre sätt att filtrera poster. En ikon för varje Lägen, Tid, Roller och
 * sortering, vänsterställda så de får plats i mobil, och belys ikonen om det är
 * ett aktivt filter."
 *
 * Med fyra dimensioner plus sortering blev den samlade panelen en lista på
 * tjugo rader som täckte halva skärmen. Den formen är rätt när dimensionerna är
 * två eller tre och fel när de är fem: man rullar i en meny för att hitta en
 * rad man redan vet namnet på.
 *
 *   `layout="samlad"`  EN knapp, alla grupper i en panel. Standard, och rätt så
 *                      länge panelen ryms utan att rullas.
 *   `layout="ikoner"`  EN IKON PER GRUPP, bredvid varandra, var och en med sin
 *                      egen lilla meny. Ikonen lyser när just den gruppen är
 *                      satt, så raden visar hela filtertillståndet utan att
 *                      något öppnas.
 *
 * ⛔ SAMMA KOMPONENT OCH INTE TVÅ. Raderna, bockarna, "Alla"-valet och regeln om
 * att sortering aldrig tänder ett filter är identiska i båda utförandena. Som
 * två komponenter hade de glidit isär första gången någon rättade en av dem, och
 * `OpsFilterPanel` används redan på två sidor.
 *
 * ⛔ I IKONLÄGET BÄR VARJE GRUPP SIN EGEN IKON, och appen skickar den. Ramverket
 * äger formen, appen äger bilden: vilken ikon som betyder "roll" beror på vad
 * rollerna ÄR hos just den appen. Saknas en faller gruppen tillbaka på
 * reglageikonen, vilket är precis vad CP bad om för Typ.
 */

/**
 * @typedef {object} Filtergrupp
 * @property {string} id Nyckeln i `value`.
 * @property {string} label Rubriken i panelen, t.ex. "Status".
 * @property {string} [allaLabel] Texten för "inget valt" i gruppen. Standard "Alla".
 * @property {import("react").ReactNode} [icon] Gruppens egen ikon i `layout="ikoner"`.
 *   ⛔ Saknas den faller gruppen tillbaka på reglageikonen.
 * @property {{ value: string, label: string, icon?: import("react").ReactNode }[]} options
 */

/**
 * @param {object} props
 * @param {Filtergrupp[]} props.grupper ⛔ Minst en. En panel utan grupper är en knapp som inte gör något.
 * @param {Record<string, string | null>} props.value Vad som är valt per grupp, `null` = alla.
 * @param {(value: Record<string, string | null>) => void} props.onChange Hela kartan, inte en delmängd.
 * @param {string} props.ariaLabel Vad knappen öppnar, t.ex. "Filter och sortering".
 * @param {{ label: string, value: string, options: { value: string, label: string }[], onChange: (v: string) => void, icon?: import("react").ReactNode, standard?: string }} [props.sortering]
 *   ⛔ `standard` säger vilket val som är "orörd". Utan den räknas det första
 *   alternativet som standard, vilket är sant i båda apparna idag men är en
 *   gissning så snart någon listar sitt förval någon annanstans än först.
 * @param {"samlad"|"ikoner"} [props.layout] Standard `"samlad"`, alltså en knapp för allt.
 * @param {string} [props.rensaLabel]
 * @param {string} [props.flerLabel] Ordet efter antalet när mer än ett filter är satt, t.ex. "filter".
 */
export function OpsFilterPanel({
  grupper,
  value,
  onChange,
  ariaLabel,
  sortering,
  rensaLabel = "Rensa",
  flerLabel = "filter",
  layout = "samlad",
}) {
  const [oppen, setOppen] = useState(false);
  const [oppenGrupp, setOppenGrupp] = useState(/** @type {string | null} */ (null));

  if (layout !== "samlad" && layout !== "ikoner") {
    throw new Error(`OpsFilterPanel: okänd layout "${layout}". Giltiga: samlad, ikoner.`);
  }

  if (!Array.isArray(grupper) || grupper.length === 0) {
    throw new Error("OpsFilterPanel: grupper krävs. En panel utan grupper är en knapp som inte gör något.");
  }
  if (!ariaLabel) {
    throw new Error("OpsFilterPanel: ariaLabel krävs. En knapp med bara en ikon har inget namn för den som inte ser den.");
  }

  /** @type {Record<string, string | null>} */
  const val = value || {};

  /** @type {{ grupp: Filtergrupp, vald: { value: string, label: string } }[]} */
  const aktiva = [];
  for (const g of grupper) {
    const vald = g.options.find((o) => o.value === val[g.id]);
    if (vald) aktiva.push({ grupp: g, vald });
  }

  /*
   * ⛔ ETIKETTEN KOMMER UR DET VALDA ALTERNATIVET, inte ur gruppens rubrik.
   * "Väntar" säger vad som visas; "Status" säger bara vilken sorts filter som
   * är satt, alltså precis det man redan ser av att knappen är tänd.
   */
  const text = aktiva.length > 0 ? aktiva[0].vald.label : "";

  /** @param {string} id @param {string | null} nytt */
  const vlj = (id, nytt) => onChange({ ...val, [id]: nytt });

  const rensa = () => {
    // ⛔ Alla grupper nollställs, även de som inte var satta. Ett `onChange`
    // med en delmängd hade lämnat appens karta halvfylld, och nästa läsning
    // hade sett en nyckel som saknas som "aldrig konfigurerad".
    /** @type {Record<string, string | null>} */
    const tomt = {};
    for (const g of grupper) tomt[g.id] = null;
    onChange(tomt);
  };

  /**
   * En grupps rader: "Alla" överst och sedan alternativen.
   *
   * ⛔ EN FUNKTION OCH INTE TVÅ KOPIOR. Raderna är identiska i båda
   * utförandena, och två kopior hade glidit isär första gången någon rättade
   * den ena.
   *
   * @param {Filtergrupp} g
   */
  const gruppensRader = (g) => (
    <>
      <Rad vald={!val[g.id]} onClick={() => vlj(g.id, null)} text={g.allaLabel || "Alla"} />
      {g.options.map((o) => (
        <Rad key={o.value} vald={val[g.id] === o.value} onClick={() => vlj(g.id, o.value)} text={o.label} ikon={o.icon} />
      ))}
    </>
  );

  /** Sorteringens rader, likaså delade. */
  const sorteringensRader = () =>
    sortering ? (
      <>
        {sortering.options.map((o) => (
          <Rad key={o.value} vald={sortering.value === o.value} onClick={() => sortering.onChange(o.value)} text={o.label} />
        ))}
      </>
    ) : null;

  if (layout === "ikoner") {
    /*
     * ⛔ SORTERINGEN ÄR "RÖRD" NÄR DEN INTE STÅR PÅ SITT FÖRVAL, och det är inte
     * samma sak som att den är ett filter. Ikonen lyser för att säga "du har
     * ändrat den här", inte "något är dolt". Räknaren och ordet i den samlade
     * knappen visar fortfarande bara filter.
     */
    /*
     * ⛔ `standard` KRÄVS OCH GISSAS INTE LÄNGRE, och skälet är ett fel som
     * ingen app kunde upptäcka i sina egna prov.
     *
     * Reserven var "det FÖRSTA alternativet". Den är rätt precis så länge
     * förvalet råkar ligga först i listan, och den dagen någon sorterar om
     * `options` blir ikonen tänd från start utan att någon rört den, eller
     * släckt fast den är ändrad. Ingenting går sönder, sidan ser bara ut att
     * ljuga om sitt eget tillstånd.
     *
     * bolag-ops hade exakt den fällan uppskriven i sin kod: förvalet råkade
     * ligga först, så en planterad defekt som tog bort `standard` förblev grön.
     * Ett hål som bara går att bevaka med en kommentar hör hemma i ramverket
     * som ett kast.
     *
     * ⛔ KRAVET GÄLLER BARA IKONLÄGET, med flit. I den samlade panelen tänds
     * ingenting, alltså läses `standard` aldrig, och att kräva in data som
     * ingen använder är att lära den som läser felet att kravet är godtyckligt.
     */
    if (sortering && sortering.standard === undefined) {
      throw new Error(
        "OpsFilterPanel: sortering.standard krävs. Utan den gissas förvalet till första alternativet, och ikonen ljuger om sitt tillstånd så fort listan sorteras om.",
      );
    }
    const sorteringStandard = sortering ? sortering.standard : undefined;
    // ⛔ Bunden till en const: TypeScript smalnar inte av `sortering` genom ett
    // `Boolean(...) &&`, så uttrycket måste ställa frågan på den bundna.
    const sorteringRord = sortering ? sortering.value !== sorteringStandard : false;

    return (
      /*
       * ⛔ VÄNSTERSTÄLLD RAD SOM FÅR BRYTAS. CP: "Låt dessa ikoner vara
       * vänsterställda så att de får plats i mobil." Fem ikoner à 44 px plus
       * mellanrum är omkring 240 px, alltså ryms de på en rad även vid 390.
       * `flex-wrap` finns ändå kvar som golv: går appen från fem dimensioner
       * till åtta ska raden bryta i stället för att rinna ut ur skärmen.
       */
      <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1">
        {grupper.map((g) => {
          const vald = g.options.find((o) => o.value === val[g.id]);
          return (
            <Popover.Root
              key={g.id}
              open={oppenGrupp === g.id}
              onOpenChange={(nasta) => setOppenGrupp(nasta ? g.id : null)}
            >
              <Popover.Trigger
                aria-label={vald ? `${g.label}: ${vald.label}` : g.label}
                aria-pressed={Boolean(vald)}
                className={cx(
                  "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl",
                  "transition-colors duration-(--duration-fast) ease-standard",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  // ⛔ TÄND IKON = SATT FILTER, och det är hela skälet till att
                  // raden finns: filtertillståndet ska synas utan att något
                  // öppnas. Samma två lägen som den samlade knappen har, fast
                  // per dimension.
                  vald
                    ? "border border-line bg-surface text-ink"
                    : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
                )}
              >
                {g.icon || <ReglageIkon size={20} />}
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  align="start"
                  sideOffset={6}
                  className="z-(--z-dropdown) max-h-[70vh] w-56 overflow-y-auto rounded-md border border-line bg-raised p-2 shadow-md"
                >
                  <p className="m-0 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{g.label}</p>
                  <div className="flex flex-col">{gruppensRader(g)}</div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          );
        })}

        {sortering ? (
          <Popover.Root
            open={oppenGrupp === "__sortering"}
            onOpenChange={(nasta) => setOppenGrupp(nasta ? "__sortering" : null)}
          >
            <Popover.Trigger
              aria-label={`${sortering.label}: ${sortering.options.find((o) => o.value === sortering.value)?.label ?? ""}`}
              aria-pressed={sorteringRord}
              className={cx(
                "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl",
                "transition-colors duration-(--duration-fast) ease-standard",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                sorteringRord
                  ? "border border-line bg-surface text-ink"
                  : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
              )}
            >
              {sortering.icon || <SorteringIkon size={20} />}
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                sideOffset={6}
                className="z-(--z-dropdown) max-h-[70vh] w-56 overflow-y-auto rounded-md border border-line bg-raised p-2 shadow-md"
              >
                <p className="m-0 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {sortering.label}
                </p>
                <div className="flex flex-col">{sorteringensRader()}</div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : null}

        {/* ⛔ Rensa syns bara när det finns något att rensa, precis som i den
            samlade panelen.

            ⛔ ETT KRYSS OCH INTE ORDET, och den förra raden här sa motsatsen:
            att "rensa" saknar en bild som betyder det utan att först förklaras.
            Det stämmer om krysset står ensamt. Det gör det aldrig: knappen finns
            bara när minst en ikon till vänster om den LYSER, och ett kryss sist i
            en rad tända ikoner läses som "släck dem". Ordet finns dessutom kvar
            som knappens namn, så den som lyssnar hör "Rensa" och inte "kryss".

            ⛔ KRYSSET SPARAR INGEN BREDD, OCH DET SKA STÅ HÄR. CP frågade
            2026-09-22: "Går det att ersätta rensa med ett kryss eller nåt annat
            grepp som gör att allt får plats i en liten skärm?" Svaret ser ut att
            vara ja och är nej. Mätt på den här komponenten i Chromium: raden är
            286 px med ordet och 284 px med krysset. Två pixlar.

            Skälet är att en ikonknapp som respekterar sin träffyta är `min-w-11`,
            alltså 44 px, och ordet "Rensa" med `px-3` är 46. Bilden är smalare än
            ordet, knappen är det inte. ⛔ EN IKON I STÄLLET FÖR ETT ORD SPARAR
            ALLTSÅ INGEN PLATS så länge träffytan är kvar, och den som räknar med
            det räknar fel. Det som gjorde att raden rymdes var att en HEL kontroll
            flyttade till en annan rad.

            Krysset är kvar för att det är det CP bad om och för att raden blir
            tystare utan ett ord i accentfärg. Men det är ett utseendeval, inte en
            passformsfix, och den skillnaden är hela skälet till att det står
            utskrivet: nästa gång någon behöver nitton pixlar ska den inte leta
            efter dem här. */}
        {aktiva.length > 0 ? (
          <button
            type="button"
            onClick={rensa}
            aria-label={rensaLabel}
            className={cx(
              "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-accent",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent hover:bg-accent-faint",
            )}
          >
            <KryssIkon size={18} />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        aria-label={aktiva.length > 0 ? `${ariaLabel}: ${text}` : ariaLabel}
        aria-pressed={aktiva.length > 0}
        className={cx(
          "relative inline-flex cursor-pointer items-center justify-center gap-2 transition-colors duration-(--duration-fast) ease-standard",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          // ⛔ SAMMA HÖJD I BÅDA LÄGENA (min-h-11, alltså 44 px träffyta). Byter
          // knappen höjd när man filtrerar hoppar raden under, och det är
          // exakt det felet som mättes bort ur bubblan i #242.
          "min-h-11",
          aktiva.length > 0
            ? "rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink"
            : "min-w-11 rounded-xl text-ink-secondary hover:bg-accent-faint hover:text-ink",
        )}
      >
        <ReglageIkon size={20} />
        {aktiva.length > 0 ? <span className="max-w-40 truncate">{text}</span> : null}
        {/* ⛔ Räknaren visas BARA när ordet inte räcker, alltså från två filter
            och uppåt. Vid ett filter står hela sanningen redan i knappen, och en
            etta i ett hörn hade varit dekor. */}
        {aktiva.length > 1 ? <Raknare antal={aktiva.length} text={flerLabel} /> : null}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-(--z-dropdown) max-h-[70vh] w-72 overflow-y-auto rounded-md border border-line bg-raised p-2 shadow-md"
        >
          <div className="flex flex-col gap-3">
            {grupper.map((g) => (
              <div key={g.id} className="flex flex-col">
                <p className="m-0 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{g.label}</p>
                {gruppensRader(g)}
              </div>
            ))}

            {sortering ? (
              <div className="flex flex-col border-t border-line pt-2">
                <p className="m-0 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {sortering.label}
                </p>
                {sorteringensRader()}
              </div>
            ) : null}

            {/* ⛔ Rensa syns bara när det finns något att rensa. En alltid
                synlig knapp som inte gör något lär en att den inte gör något. */}
            {aktiva.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  rensa();
                  setOppen(false);
                }}
                className={cx(
                  "min-h-11 cursor-pointer rounded-sm border-t border-line px-3 text-left text-sm font-semibold text-accent",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent hover:bg-accent-faint",
                )}
              >
                {rensaLabel}
              </button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * En rad i panelen.
 *
 * ⛔ EGEN KOMPONENT OCH INTE TRE KOPIOR. Grupperna, sorteringen och
 * "alla"-raden ritas likadant, och tre kopior av samma fjorton klasser hade
 * glidit isär första gången någon ändrade höjden på en av dem.
 *
 * @param {{ vald: boolean, onClick: () => void, text: string, ikon?: import("react").ReactNode }} props
 */
function Rad({ vald, onClick, text, ikon }) {
  return (
    <button
      type="button"
      aria-pressed={vald}
      onClick={onClick}
      className={cx(
        "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-left text-base",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        vald ? "bg-accent-subtle font-semibold text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
      )}
    >
      {ikon ? <span className="shrink-0 text-ink-secondary">{ikon}</span> : null}
      <span className="flex-1">{text}</span>
      {vald ? (
        <span aria-hidden="true" className="shrink-0 text-accent">
          <BockIkon />
        </span>
      ) : null}
    </button>
  );
}
