import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { OpsButton } from "./OpsButton.jsx";

/**
 * Knappraden längst ned i panelen för en rad (0.145.0, cllp/ops-framework#446): källans knappar och Dela, på samma ställe på varje rad.
 *
 * ══ ⛔ ALLTID PÅ SAMMA STÄLLE (CP 2026-10-25: "en knapprad som alltid står på samma ställe") ═══════════════════════════
 *
 * Raden är panelens sista element och ligger fast i botten av ytan som rullar (`sticky bottom-0`, med panelen `min-h-full` så att den hamnar längst ned
 * också när innehållet är kort). En påminnelse med en rad text och en faktura med sju fakta har alltså sina knappar på exakt samma ställe, och en lång
 * beskrivning knuffar dem inte ur bild. Dela står SIST i raden, alltid: de andra knapparna är källans, Dela är ramverkets, och den som lärt sig var
 * Dela sitter ska inte behöva leta efter den när källan byts.
 *
 * ⛔ DELA FINNS PÅ ALLA RADER (arbetsreglernas punkt 5, tomhet är ett svar). Går raden att dela är det en knapp. Går den inte det står skälet i klartext ovanför
 * knapparna, med vad man gör i stället, och ingen död knapp ritas: en spärrad knapp på en telefon går inte att trycka på för att få veta varför, så skälet
 * ligger framme som text. Skälet är appens (`skal`), eftersom bara appen vet varför en faktura inte delas.
 *
 * ══ ⛔ EN ÅTGÄRD SOM GER ETT LÖFTE VÄNTAR, STÄNGER NÄR DEN LYCKAS OCH SÄGER VAD SOM GICK FEL (0.147.0, cllp/ops-framework#451) ══════════════════════
 *
 * lifehub.app kopplade Klar till panelen för en påminnelse och fann att knappraden saknade två saker. En `onClick` som avslogs gav en knapp som blev tryckbar igen
 * och inget mer: `OpsButton` släpper avslagningen vidare (den vet inte vad felet betyder för just den ytan), och raden hade ingen plats för ett fel. Appens eget
 * fel hamnade i en banderoll i vyn, bakom panelens dialog, där ingen såg det.
 *
 * Knappraden är den ytan, så den vet vad ett fel betyder här: åtgärden gick inte, och personen är kvar i panelen med knappen att försöka igen.
 *  - Ger `onClick` ett löfte väntar knappen synligt (`OpsButton`, 0.129.0), med åtgärdens egna verb (`pagarEtikett`, "Bockar av…") när källan skickat det.
 *  - Lyckas löftet stänger panelen (`onKlar`). Panelen finns till för att göra något åt raden, och är det gjort är den i vägen. En åtgärd som INTE ger ett löfte
 *    gör något direkt (öppnar, kopierar) och stänger ingenting: källan avgör själv, som förut.
 *  - Avslås löftet står texten i en `role="alert"` ovanför knapparna, på samma ställe som skälet till att Dela saknas, och panelen står kvar. Avslaget är då
 *    tillvaratagit och går inte vidare som ett okänt fel. Saknar avslaget en text står `ord.atgardFelEtikett` ("Det gick inte.").
 *  - Dela är samma knapp med samma fel och samma väntläge, men stänger inte: att dela en rad är inte att vara klar med den.
 *  - Ett nytt tryck tar bort det gamla felet medan åtgärden väntar, så att en gammal röd rad aldrig står kvar bredvid en ny väntan.
 *
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/radkallor.js").Atgard>} props.atgarder
 * @param {import("../lib/radkallor.js").Delning} props.dela Svaret på om raden går att dela, redan avgjort (`losKnapprad`, och ramverkets förvalda skäl när källan inte svarat).
 * @param {{ etikett: string, delaEtikett: string, delaSkalForord: string, delaIstalletForord: string, atgardFelEtikett: string }} props.ord
 * @param {() => void} [props.onKlar] Anropas när en åtgärds löfte lyckats. Panelen skickar sin Tillbaka.
 */
export function Knapprad({ atgarder, dela, ord, onKlar }) {
  const kanDela = dela.skal === undefined;
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  // Panelen kan vara stängd av appen (raden avbockad) innan löftet är klart: då finns inget att skriva felet i, och inget att stänga.
  const monterad = useRef(true);
  useEffect(() => {
    monterad.current = true;
    return () => {
      monterad.current = false;
    };
  }, []);
  /**
   * @param {{ onClick?: (event: any) => void | Promise<unknown> }} a
   * @param {boolean} stang Stänger panelen när löftet lyckas. Dela gör inte det: att dela en rad är inte att vara klar med den.
   * @returns {((event: any) => void | Promise<unknown>) | undefined}
   */
  const klick = (a, stang) => {
    const nar = a.onClick;
    if (!nar) return undefined;
    return (event) => {
      setFel(null);
      const svar = nar(event);
      if (!svar || typeof (/** @type {any} */ (svar).then) !== "function") return svar;
      return Promise.resolve(svar).then(
        () => {
          if (stang && monterad.current) onKlar?.();
        },
        (/** @type {unknown} */ e) => {
          // Panelen är redan stängd (appen tog bort raden medan löftet väntade): det finns ingen ruta att skriva felet i. Då släpps avslaget vidare som förut,
          // till den som hör efter (`unhandledrejection`), i stället för att sväljas: ett fel som ingen ser är värre än ett som syns.
          if (!monterad.current) throw e;
          const text = e instanceof Error ? e.message : typeof e === "string" ? e : "";
          setFel(text.trim() || ord.atgardFelEtikett);
        },
      );
    };
  };
  return (
    <div
      data-knapprad=""
      className={cx(
        "sticky bottom-0 z-(--z-sticky) mt-auto flex flex-col gap-2 border-t border-line bg-canvas pt-3 pb-[max(0.75rem,var(--safe-bottom,0px))]",
        // Panelens kolumn har `px-4`: raden går ut till kanterna så att linjen och bakgrunden täcker hela bredden, och innehållet står kvar i kolumnen.
        "-mx-4 px-4",
      )}
    >
      {fel === null ? null : (
        <p role="alert" data-knapprad-fel="" className="m-0 text-etikett text-danger wrap-anywhere">
          {fel}
        </p>
      )}
      {kanDela ? null : (
        <p data-knapprad-skal="" className="m-0 text-meta text-ink-secondary wrap-anywhere">
          <span className="font-medium text-ink">{ord.delaSkalForord}</span> {dela.skal}
          {dela.istallet ? (
            <>
              {" "}
              <span className="font-medium text-ink">{ord.delaIstalletForord}</span> {dela.istallet}
            </>
          ) : null}
        </p>
      )}
      <div role="group" aria-label={ord.etikett} data-knapprad-knappar="" className="flex flex-wrap items-center gap-2">
        {atgarder.map((a) => (
          <OpsButton key={a.id} variant="secondary" size="sm" href={a.href} newTab={a.nyFlik === true} busyLabel={a.pagarEtikett} onClick={klick(a, true)}>
            {a.ikon ? (
              <span aria-hidden="true" className="flex shrink-0 items-center">
                {a.ikon}
              </span>
            ) : null}
            {a.etikett}
          </OpsButton>
        ))}
        {kanDela ? (
          <OpsButton variant="secondary" size="sm" href={dela.href} newTab={dela.nyFlik === true} onClick={klick(dela, false)}>
            {ord.delaEtikett}
          </OpsButton>
        ) : null}
      </div>
    </div>
  );
}
