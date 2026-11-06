import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "../lib/format.js";
import { MAX_MEDDELANDE } from "../lib/samtal.js";
import { ordet } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsTextarea } from "./OpsField.jsx";

/**
 * Orden i tråden på en post (0.191.0, cllp/lifehub.app#663), på svenska och engelska.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_BIBLIOTEKKOMMENTARER = {
  rubrik: { sv: "Kommentarer", en: "Comments" },
  inga: { sv: "Inga kommentarer än.", en: "No comments yet." },
  laddar: { sv: "Hämtar kommentarerna", en: "Loading the comments" },
  fel: { sv: "Kommentarerna kunde inte hämtas.", en: "The comments could not be loaded." },
  falt: { sv: "Skriv en kommentar", en: "Write a comment" },
  kommentera: { sv: "Kommentera", en: "Comment" },
  skickar: { sv: "Skickar…", en: "Sending…" },
  skrivFel: { sv: "Kommentaren kunde inte skickas.", en: "The comment could not be sent." },
  du: { sv: "Du", en: "You" },
  gast: { sv: "Gäst", en: "Guest" },
};

/** Plats i meddelandet för postens länk på rotens andra rad. En länk är adressen till biblioteket, platsen och postens id, långt under det här. */
const LANKUTRYMME = 400;

/**
 * Tråden på en bibliotekspost: kommentarerna och fältet att skriva i (0.191.0, cllp/lifehub.app#663).
 *
 * ══ ⛔ DEN RITAR CHATTENS TRÅD, OCH VET INTE OM DET ÄR EN MEDLEM ELLER EN GÄST SOM LÄSER ══════════════════════════════════════
 *
 * Källan (`Postkommentarer`) är medlemmens samtalskälla (`createPostkommentarer`) eller gästens serveranrop (`OpsGastGrupp`). Vyn läser `las`, följer `prenumerera` när den finns och
 * skickar med `kommentera`. Den första kommentaren blir ett meddelande i gruppens chatt med posten som kort, och resten svar i dess tråd: det som skrivs här syns där, och tvärtom.
 *
 * ⛔ LÄTT, MED FLIT: inga reaktioner, inga bilagor och inga omnämnanden. Den som vill mer svarar i chatten, där tråden är densamma. En bilaga på en kommentar hade varit en
 * andra väg in i biblioteket (regel 13).
 *
 * ⛔ TOMT ÄR ETT SVAR (`inga`), ETT FEL ÄR ETT FEL (`fel`), och en kommentar som inte gick fram står kvar i fältet med felet under (regel 5). Efter en egen kommentar läses tråden om,
 * med eller utan prenumeration, så att den som skrev alltid ser sin rad.
 *
 * @param {object} props
 * @param {{ id: string, groupId: string }} props.post
 * @param {import("../data/postkommentarer.js").Postkommentarer} props.kalla Samma objekt mellan ritningarna (`useMemo` i appen): en ny källa läser och följer tråden på nytt.
 * @param {boolean} [props.fokus] Fältet får fokus och rullas fram när tråden ritas: personen valde Kommentera i menyn.
 * @param {string} [props.sprak]
 */
export function BibliotekKommentarer({ post: postProp, kalla, fokus = false, sprak = "sv" }) {
  // ⛔ POSTEN SOM NYCKEL, INTE SOM OBJEKT: biblioteket ger ett nytt objekt för samma post vid varje ritning, och tråden ska läsas och följas en gång per post, inte en gång per ritning.
  const post = useMemo(() => ({ id: postProp.id, groupId: postProp.groupId }), [postProp.id, postProp.groupId]);
  const o = (/** @type {keyof typeof ORD_BIBLIOTEKKOMMENTARER} */ k) => ordet(ORD_BIBLIOTEKKOMMENTARER, k, sprak);
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const [rader, setRader] = useState(/** @type {import("../data/postkommentarer.js").Postkommentar[] | null} */ (null));
  const [fel, setFel] = useState(false);
  const [text, setText] = useState("");
  const [skrivFel, setSkrivFel] = useState("");
  const [skickar, setSkickar] = useState(false);
  const levande = useRef(true);
  const faltRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const las = useCallback(async () => {
    try {
      const svar = await kalla.las(post);
      if (levande.current) {
        setRader(svar.rader);
        setFel(false);
      }
    } catch {
      if (levande.current) setFel(true);
    }
  }, [kalla, post]);

  useEffect(() => {
    levande.current = true;
    void las();
    const sluta = typeof kalla.prenumerera === "function"
      ? kalla.prenumerera(post, { onData: (r) => levande.current && setRader(r), onError: () => levande.current && setFel(true) })
      : null;
    return () => {
      levande.current = false;
      sluta?.();
    };
  }, [kalla, post, las]);

  useEffect(() => {
    if (!fokus) return;
    const el = faltRef.current;
    el?.scrollIntoView?.({ block: "center" });
    el?.querySelector("textarea")?.focus();
  }, [fokus]);

  async function skicka() {
    const ut = text.trim();
    if (!ut || skickar) return;
    setSkickar(true);
    setSkrivFel("");
    try {
      await kalla.kommentera(post, ut);
      if (!levande.current) return;
      setText("");
      await las();
    } catch (e) {
      if (levande.current) setSkrivFel(e instanceof Error && e.message ? e.message : o("skrivFel"));
    } finally {
      if (levande.current) setSkickar(false);
    }
  }

  return (
    <section aria-label={o("rubrik")} data-bibliotek-kommentarer={post.id} className="flex min-w-0 flex-col gap-2">
      <h3 className="m-0 text-sektion uppercase text-ink-muted">{o("rubrik")}</h3>
      {fel ? (
        <p role="alert" data-bibliotek-kommentarer-fel="" className="m-0 text-etikett text-danger">{o("fel")}</p>
      ) : rader === null ? (
        <p role="status" data-bibliotek-kommentarer-laddar="" className="m-0 text-etikett text-ink-muted">{o("laddar")}</p>
      ) : rader.length === 0 ? (
        <p data-bibliotek-kommentarer-tom="" className="m-0 text-etikett text-ink-muted">{o("inga")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rader.map((k) => (
            <li key={k.id} data-bibliotek-kommentar={k.id} className="flex min-w-0 flex-col gap-0.5 rounded-base bg-sunken px-3 py-2">
              <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-liten text-ink-muted">
                <span className="font-medium text-ink-secondary">{k.egen ? o("du") : k.namn}</span>
                {k.gast ? <span data-gast-markning="" className="rounded-full bg-surface px-1.5 py-px text-mikro font-medium text-ink-secondary">{o("gast")}</span> : null}
                <span>{formatDateTime(k.tid, { locale })}</span>
              </span>
              <span className="whitespace-pre-wrap text-etikett text-ink wrap-anywhere">{k.text}</span>
            </li>
          ))}
        </ul>
      )}
      <div ref={faltRef} data-bibliotek-kommentera="" className="flex min-w-0 flex-col gap-2">
        <OpsTextarea value={text} onChange={setText} ariaLabel={o("falt")} placeholder={o("falt")} rows={2} maxLength={kalla.maxTecken ?? MAX_MEDDELANDE - LANKUTRYMME} onSend={() => void skicka()} />
        <div className="flex justify-end">
          <OpsButton variant="secondary" size="sm" busy={skickar} busyLabel={o("skickar")} disabled={!text.trim()} onClick={() => skicka()}>
            {o("kommentera")}
          </OpsButton>
        </div>
        {skrivFel ? <p role="alert" data-bibliotek-kommentera-fel="" className="m-0 text-etikett text-danger">{skrivFel}</p> : null}
      </div>
    </section>
  );
}
