import { useEffect, useRef, useState } from "react";
import { epostFel } from "../lib/mejl.js";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";

/**
 * "Skicka till mejl" i dialogen Dela länk (0.128.0, cllp/lifehub.app#356). Fältet, knappen och svaret.
 *
 * ══ ⛔ VAD CP BESLÖT (2026-10-20) ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * "En delad länk ska kunna skickas med mejl från dialogen Dela länk, via den befintliga mejlvägen. En notis i appen kommer först tillsammans med
 * 'Delat med mig'." Ramverket skickar ingenting: det frågar efter en adress, prövar den med de hjälpare som finns (`epostFel`: form och spärrade domäner) och anropar appens `onMejlaLank`.
 * Appen skriver mejlet i sin kö (`mejlregelfragment`/`createMejlkon`), med sina egna texter och sitt avsändarnamn.
 *
 * ⛔ UTAN `onMejlaLank` RITAS INGENTING. Ett fält som inte leder någonstans är en knapp som lovar något den inte håller, så komponenten ritas inte alls av den som äger dialogen
 * (`OpsBibliotek`, `HandelseDelning`) när propen saknas.
 *
 * ⛔ ETT SVAR SYNS I BÅDA LÄGENA (regel 5). Lyckat: "Skickat till x." och fältet töms, så att nästa mottagare kan skrivas. Misslyckat: orsaken står kvar i dialogen, adressen står kvar i fältet, och länken
 * är orörd. En adress med fel form eller en spärrad domän avvisas INNAN appen anropas, med skälet. Två tryck i samma tick skickar ett mejl (en ref, inte bara state).
 *
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_MEJLALANK = {
  etikett: { sv: "Skicka till mejl", en: "Send by email" },
  hjalp: { sv: "Mottagaren får länken i ett mejl.", en: "The recipient gets the link in an email." },
  skicka: { sv: "Skicka", en: "Send" },
  skickat: { sv: "Skickat till {till}.", en: "Sent to {till}." },
  misslyckades: { sv: "Mejlet gick inte att skicka", en: "The email could not be sent" },
  ejSkickat: { sv: "Mejlet skickades inte.", en: "The email was not sent." },
};

/**
 * @param {object} props
 * @param {{ id: string, url: string }} props.lank Länken som skickas: dess id och hela adress.
 * @param {(inmatning: { id: string, url: string, till: string }) => Promise<void | boolean> | void | boolean} props.onMejlaLank
 * @param {readonly string[]} [props.extraSparrade] Appens egna spärrade domäner, utöver `SPARRADA_MEJLDOMANER`.
 * @param {string} [props.sprak]
 * @param {Partial<Record<string, string>>} [props.ord] Egna texter (se `ORD_MEJLALANK`).
 */
export function MejlaLank({ lank, onMejlaLank, extraSparrade, sprak = "sv", ord }) {
  if (typeof onMejlaLank !== "function") throw new Error("MejlaLank: onMejlaLank krävs, en funktion som skickar mejlet. Utan den ritas komponenten inte alls.");
  if (!lank || typeof lank.id !== "string" || typeof lank.url !== "string" || lank.url === "") {
    throw new Error("MejlaLank: lank är { id, url }, där url är hela adressen. Ett mejl utan adress har inget att skicka.");
  }
  const t = { ...forvalda(ORD_MEJLALANK, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const [till, setTill] = useState("");
  const [pagar, setPagar] = useState(false);
  const [fel, setFel] = useState("");
  const [skickat, setSkickat] = useState("");
  // ⛔ EN REF OCH INTE BARA `pagar`: två tryck i samma tick ser samma state, och då skickas två mejl.
  const upptagen = useRef(false);
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  async function skicka() {
    if (upptagen.current) return;
    const mal = till.trim();
    const f = epostFel(mal, extraSparrade);
    setSkickat("");
    if (f) {
      setFel(f);
      return;
    }
    upptagen.current = true;
    setFel("");
    setPagar(true);
    try {
      const svar = await onMejlaLank({ id: lank.id, url: lank.url, till: mal });
      if (svar === false) throw new Error(t.ejSkickat);
      if (!levande.current) return;
      setSkickat(t.skickat.replaceAll("{till}", mal));
      setTill("");
    } catch (e) {
      if (!levande.current) return;
      const skal = e instanceof Error && e.message ? e.message : String(e);
      setFel(skal === t.ejSkickat ? skal : `${t.misslyckades}: ${skal}`);
    } finally {
      upptagen.current = false;
      if (levande.current) setPagar(false);
    }
  }

  return (
    <form
      data-mejla-lank=""
      noValidate
      className="flex min-w-0 flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void skicka();
      }}
    >
      <OpsField label={t.etikett} hint={t.hjalp} error={fel || undefined}>
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <OpsInput value={till} onChange={setTill} type="email" autoComplete="off" disabled={pagar} tal={false} />
          </div>
          <OpsButton variant="secondary" busy={pagar} onClick={() => void skicka()}>{t.skicka}</OpsButton>
        </div>
      </OpsField>
      {skickat ? <p role="status" data-mejla-lank-skickat="" className="m-0 text-etikett text-ink-secondary wrap-anywhere">{skickat}</p> : null}
    </form>
  );
}
