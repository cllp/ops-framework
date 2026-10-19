import { useEffect, useId, useRef, useState } from "react";
import { FORVAL_HANDELSEDAGAR, HANDELSEDAGAR } from "../lib/delning.js";
import { definierade, forvalda } from "../lib/ord.js";
import { DelaLankFalt, useDelaLankFalt } from "./DelaLankFalt.jsx";
import { LankIkon } from "./icons.jsx";
import { LankRad } from "./LankRad.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsModal } from "./OpsModal.jsx";

/**
 * "Delade länkar" i händelsepanelen: varje aktiv länk till händelsen med sin fulla adress, och Dela för att skapa en ny (0.125.0, cllp/lifehub.app#377).
 *
 * ══ ⛔ LISTAN STÅR I PANELEN, INTE BARA I RUTAN (CP 2026-10-19) ═══════════════════════════════════════════════════════
 *
 * CP: "Alla url:er måste framgå på händelsen så man kan klippa ur den och skicka den enkelt." Varje aktiv länk är en rad (`LankRad`) med adressen som text, rättigheten,
 * om den har kod, när den går ut, Kopiera och Återkalla. Utan länkar står en rad som säger det (arbetsreglernas punkt 5): en tom yta ser ut som en lista som inte hunnit
 * laddas. Rutan Dela öppnas av knappen i rubriken och skapar en länk; den nya raden syns i listan direkt, utan att appen hunnit läsa om den.
 *
 * ══ ⛔ PANELEN RITAR, APPEN OCH SERVERN AVGÖR ═════════════════════════════════════════════════════════════════════════
 *
 * Komponenten vet inte vem som får dela eller stänga: den ritas bara när appen ger `onDela`, och servern (`createDelningService`) prövar medlemskapet och
 * appens regel (`farDelaHandelse`) på nytt vid varje anrop. `onDela` får värdena från rutan och svarar med den nya länken, `{ id, url, giltigTill, harKod }`, där `url` är
 * appens basadress plus `sokvag` ur svaret (`delningsUrl`): domänen är instansens och ramverket känner den inte. Ett fel visas i rutan, rutan står kvar och fälten är orörda. Är adressen upptagen
 * (felets `kod` är `adress-upptagen`) står ett annat förslag i fältet och rutan säger det; felets `del` (`gruppdel` eller `sista`) säger vilket fält.
 *
 * @param {object} props
 * @param {{ titel: string, grupp?: string }} props.handelse Titeln och gruppens namn, för förslaget till adressen.
 * @param {ReadonlyArray<import("./LankRad.jsx").Lank>} props.delningar Aktiva länkar till händelsen, ur appens `lista` (med `url`).
 * @param {(val: { dagar: number | null, kod: string | null, gruppdel: string, handelsedel: string }) => Promise<import("./LankRad.jsx").Lank>} props.onDela
 * @param {(arg: { id: string }) => Promise<void>} props.onAterkalla
 * @param {string} [props.gruppdel] Gruppdelen gruppen redan använt (tjänstens `gruppdelar().senaste`), föreslagen i rutan före ett namn ur gruppens namn. En gruppdel tillhör en grupp för alltid, så den gruppen redan har är den som går att använda.
 * @param {string} [props.sprak]
 * @param {Partial<Record<string, string>>} [props.ord] Egna texter (se `ORD_HANDELSEDELNING`, `ORD_DELALANK` och `ORD_LANKRAD`).
 */
export function HandelseDelning({ handelse, delningar, onDela, onAterkalla, gruppdel, sprak = "sv", ord }) {
  if (typeof onDela !== "function") throw new Error("HandelseDelning: onDela krävs, en funktion som skapar länken och svarar med den.");
  if (typeof onAterkalla !== "function") throw new Error("HandelseDelning: onAterkalla krävs. En länk man kan skapa men inte stänga är en länk som lever för alltid.");
  if (!Array.isArray(delningar)) {
    throw new Error("HandelseDelning: delningar måste vara en lista med de aktiva länkarna, tom när det inte finns några. Utan den går det inte att skilja 'inga länkar' från 'inte läst'.");
  }
  for (const l of delningar) {
    if (!l || typeof l.id !== "string" || typeof l.url !== "string" || l.url === "") {
      throw new Error("HandelseDelning: varje länk har { id, url } där url är hela adressen (delningsUrl). En länk utan adress går inte att skicka vidare.");
    }
  }
  const t = { ...forvalda(ORD_HANDELSEDELNING, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const rubrikId = useId();
  const [oppen, setOppen] = useState(false);
  const [skapade, setSkapade] = useState(/** @type {Array<import("./LankRad.jsx").Lank>} */ ([]));
  const [stangda, setStangda] = useState(/** @type {string[]} */ ([]));
  const [skapad, setSkapad] = useState(/** @type {import("./LankRad.jsx").Lank | null} */ (null));
  const [upptagen, setUpptagen] = useState(false);
  const [fel, setFel] = useState("");
  const falt = useDelaLankFalt({ slag: "handelse", grupp: handelse.grupp, titel: handelse.titel, gruppdelForslag: gruppdel, dagval: HANDELSEDAGAR, forvalDagar: FORVAL_HANDELSEDAGAR, sprak });
  // ⛔ EN REF OCH INTE BARA `upptagen`: två tryck i samma tick ser samma state, och då skapas två länkar.
  const pagar = useRef(false);
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  // Länkarna i listan: de nyss skapade först, sedan appens, utan dem som stängts här och utan dubbletter när appen hunnit läsa om.
  const idn = new Set(delningar.map((l) => l.id));
  const rader = [...skapade.filter((l) => !idn.has(l.id)), ...delningar].filter((l) => !stangda.includes(l.id));

  function stang() {
    setOppen(false);
    setSkapad(null);
    setFel("");
    falt.setMeddelande("");
  }

  async function skapa() {
    if (pagar.current) return;
    const p = falt.pro();
    if (!p.ok) {
      setFel(p.fel);
      return;
    }
    pagar.current = true;
    setFel("");
    falt.setMeddelande("");
    setUpptagen(true);
    try {
      const lank = await onDela({ dagar: p.varde.dagar, kod: p.varde.kod, gruppdel: p.varde.gruppdel, handelsedel: p.varde.sista });
      if (!lank || typeof lank.id !== "string" || typeof lank.url !== "string" || lank.url === "") {
        throw new Error(t.utanAdress);
      }
      if (!levande.current) return;
      setSkapade((s) => [lank, ...s]);
      setSkapad(lank);
    } catch (e) {
      if (!levande.current) return;
      if (e && typeof e === "object" && /** @type {{ kod?: unknown }} */ (e).kod === "adress-upptagen") {
        // `del` säger vilken del som var upptagen: gruppdelen (en annan grupps) eller sista delen. Utan `del` är det sista delen, som förut.
        if (/** @type {{ del?: unknown }} */ (e).del === "gruppdel") falt.gruppdelUpptagen();
        else falt.upptagen();
      } else setFel(e instanceof Error && e.message ? e.message : String(e));
    } finally {
      pagar.current = false;
      if (levande.current) setUpptagen(false);
    }
  }

  /** @param {import("./LankRad.jsx").Lank} lank */
  async function aterkalla(lank) {
    await onAterkalla({ id: lank.id });
    if (levande.current) setStangda((s) => [...s, lank.id]);
  }

  return (
    <section data-handelsedelning="" aria-labelledby={rubrikId} className="mt-4 flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={rubrikId} className="m-0 text-sektion uppercase text-ink-muted">{t.rubrik}</h2>
        <OpsButton size="sm" variant="secondary" onClick={() => setOppen(true)}>
          <LankIkon size={16} />
          {t.dela}
        </OpsButton>
      </div>
      {rader.length === 0 ? (
        <p data-handelsedelning-tom="" className="m-0 text-etikett text-ink-muted">{t.ingaLankar}</p>
      ) : (
        <ul data-handelsedelning-lista="" className="m-0 flex list-none flex-col gap-2 p-0">
          {rader.map((l) => (
            <LankRad key={l.id} lank={l} sprak={sprak} ord={ord} nyligen={skapade.some((s) => s.id === l.id)} onAterkalla={aterkalla} />
          ))}
        </ul>
      )}

      <OpsModal
        open={oppen}
        onOpenChange={(o) => {
          // Mitt i ett anrop stänger varken Escape eller utsidan rutan: svaret ska synas.
          if (!o && !upptagen) stang();
        }}
        title={t.delaRubrik}
        description={skapad ? undefined : t.delaIngress}
        closeLabel={t.stang}
        size="md"
        footer={
          skapad ? (
            <OpsButton variant="primary" onClick={stang}>{t.klar}</OpsButton>
          ) : (
            <>
              <OpsButton variant="ghost" disabled={upptagen} onClick={stang}>{t.avbryt}</OpsButton>
              <OpsButton variant="primary" busy={upptagen} onClick={skapa}>{t.skapa}</OpsButton>
            </>
          )
        }
      >
        {skapad ? (
          <div data-handelsedelning-skapad="" className="flex flex-col gap-3">
            <p className="m-0 text-brod text-ink-secondary">{t.skapadText}</p>
            <ul className="m-0 flex list-none flex-col p-0">
              <LankRad lank={skapad} sprak={sprak} ord={ord} />
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <DelaLankFalt falt={falt} sprak={sprak} disabled={upptagen} />
            {fel ? <p role="alert" data-handelsedelning-fel="" className="m-0 text-etikett text-danger wrap-anywhere">{fel}</p> : null}
          </div>
        )}
      </OpsModal>
    </section>
  );
}

/**
 * Orden i sektionen och rutan. Orden för fälten är `ORD_DELALANK`, orden på raden `ORD_LANKRAD`.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_HANDELSEDELNING = {
  rubrik: { sv: "Delade länkar", en: "Shared links" },
  dela: { sv: "Dela", en: "Share" },
  ingaLankar: { sv: "Inga länkar. Den här händelsen är inte delad.", en: "No links. This event is not shared." },
  delaRubrik: { sv: "Dela händelsen", en: "Share the event" },
  delaIngress: {
    sv: "Den som har länken ser titel, datum och tid, plats, beskrivning och filer, utan att logga in. Inget annat: inte gruppen, medlemmarna, svaren eller kommentarerna.",
    en: "Whoever has the link sees the title, date and time, location, description and files, without signing in. Nothing else: not the group, the members, the replies or the comments.",
  },
  skapa: { sv: "Skapa länk", en: "Create link" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
  stang: { sv: "Stäng", en: "Close" },
  klar: { sv: "Klar", en: "Done" },
  skapadText: { sv: "Länken är skapad. Den står också i listan på händelsen, så att du hittar den igen.", en: "The link is created. It is also listed on the event, so you can find it again." },
  utanAdress: { sv: "Länken skapades men svaret saknade adressen. Återkalla den i listan och skapa en ny.", en: "The link was created but the reply had no address. Revoke it in the list and create a new one." },
};
