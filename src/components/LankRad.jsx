import { useEffect, useRef, useState } from "react";
import { kortDatum } from "../lib/deladdatum.js";
import { definierade, forvalda } from "../lib/ord.js";
import { KopieraIkon } from "./icons.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { useKopiera } from "./useKopiera.js";

/**
 * En aktiv länk med sin fulla adress som text, sin rättighet, om den har kod och när den går ut, med Kopiera och Återkalla (0.125.0, cllp/lifehub.app#377).
 *
 * ══ ⛔ ADRESSEN STÅR SOM TEXT, SÅ ATT DEN GÅR ATT KLIPPA UR (CP 2026-10-19) ══════════════════════════════════════════════
 *
 * CP: "Alla url:er måste framgå på händelsen så man kan klippa ur den och skicka den enkelt." Adressen är en vanlig text i raden, inte bara något som
 * kopieras av en knapp: den kan markeras, och ett tryck på den markerar hela (`select-all`). Kopiera skriver den till urklipp med `navigator.clipboard`. Faller det
 * (en säker adress krävs, och en iPhone kan neka) MARKERAS TEXTEN i stället och meningen säger att den ska kopieras för hand: en knapp som misslyckas tyst är värre än ingen knapp.
 * Statusraden (`role="status"`) säger "Kopierad" en kort stund.
 *
 * ⛔ ÅTERKALLA ÄR SLUTGILTIGT OCH FRÅGAR INTE TVÅ GÅNGER: knappen heter vad den gör, och en ny länk är lika lätt att skapa som den första. Faller anropet visas
 * orsaken i raden och länken ligger kvar. Raden döljs först när servern sagt ja.
 *
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_LANKRAD = {
  kopiera: { sv: "Kopiera", en: "Copy" },
  kopierad: { sv: "Kopierad", en: "Copied" },
  kopieraMisslyckades: { sv: "Det gick inte att kopiera. Adressen är markerad: kopiera den för hand.", en: "Copying failed. The address is selected: copy it by hand." },
  kopieraNamn: { sv: "Kopiera adressen", en: "Copy the address" },
  aterkalla: { sv: "Återkalla", en: "Revoke" },
  aterkallaNamn: { sv: "Återkalla länken {url}", en: "Revoke the link {url}" },
  aterkallaFel: { sv: "Det gick inte att återkalla länken", en: "The link could not be revoked" },
  rattighet_las: { sv: "Läslänk", en: "Read link" },
  medKod: { sv: "Med kod", en: "With code" },
  utanKod: { sv: "Utan kod", en: "No code" },
  gallerTill: { sv: "Gäller till {datum}", en: "Valid until {datum}" },
  ingenGrans: { sv: "Ingen gräns", en: "No limit" },
};

/**
 * @typedef {object} Lank
 * @property {string} id
 * @property {string} url Hela adressen: appens basadress plus `sokvag` ur `skapa` eller `lista` (`delningsUrl`).
 * @property {"las"} [rattighet]
 * @property {boolean} [harKod]
 * @property {number | null} [giltigTill] Millisekunder, eller `null` för ingen gräns.
 */

/** Datumet i lokal tid som `YYYY-MM-DD`. @param {number} ms */
function lokaltDatum(ms) {
  const d = new Date(ms);
  const tvasiffrig = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${tvasiffrig(d.getMonth() + 1)}-${tvasiffrig(d.getDate())}`;
}

/**
 * @param {object} props
 * @param {Lank} props.lank
 * @param {(lank: Lank) => Promise<void>} [props.onAterkalla] Utelämnad: ingen knapp (en vy som bara visar adressen).
 * @param {string} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_LANKRAD, string>>} [props.ord]
 * @param {boolean} [props.nyligen] Länken skapades nyss: raden markeras så att den syns i listan.
 */
export function LankRad({ lank, onAterkalla, sprak = "sv", ord, nyligen = false }) {
  const t = { ...forvalda(ORD_LANKRAD, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const { kopierat, misslyckades, kopiera } = useKopiera("LankRad");
  const text = useRef(/** @type {HTMLParagraphElement | null} */ (null));
  const [fel, setFel] = useState("");
  const [pagar, setPagar] = useState(false);
  const levande = useRef(true);
  // ⛔ EN REF OCH INTE BARA `pagar`: två tryck i samma tick ser samma state, och då skickas återkallningen två gånger.
  const skickar = useRef(false);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  // Faller kopieringen markeras adressen, så att ett långtryck eller Ctrl+C gör jobbet.
  useEffect(() => {
    if (!misslyckades || !text.current || typeof window === "undefined" || !window.getSelection) return;
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.selectNodeContents(text.current);
    sel.removeAllRanges();
    sel.addRange(r);
  }, [misslyckades]);

  async function aterkalla() {
    if (skickar.current || !onAterkalla) return;
    skickar.current = true;
    setFel("");
    setPagar(true);
    try {
      await onAterkalla(lank);
    } catch (e) {
      if (levande.current) setFel(`${t.aterkallaFel}: ${e instanceof Error && e.message ? e.message : String(e)}`);
    } finally {
      skickar.current = false;
      if (levande.current) setPagar(false);
    }
  }

  const till = typeof lank.giltigTill === "number" ? t.gallerTill.replace("{datum}", kortDatum(lokaltDatum(lank.giltigTill), sprak)) : t.ingenGrans;
  return (
    <li data-lankrad={lank.id} data-lankrad-ny={nyligen ? "" : undefined} className="flex min-w-0 flex-col gap-2 rounded-base border border-line bg-raised p-3">
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-muted">
        <span data-lankrad-rattighet="">{t[`rattighet_${lank.rattighet ?? "las"}`] ?? t.rattighet_las}</span>
        <span aria-hidden="true">·</span>
        <span data-lankrad-kod="">{lank.harKod ? t.medKod : t.utanKod}</span>
        <span aria-hidden="true">·</span>
        <span data-lankrad-giltighet="">{till}</span>
      </p>
      <p ref={text} data-lankrad-url="" className="m-0 select-all break-all text-etikett text-ink">{lank.url}</p>
      <div className="flex flex-wrap items-center gap-2">
        <OpsButton size="sm" variant="secondary" ariaLabel={t.kopieraNamn} onClick={() => kopiera(lank.url)}>
          <KopieraIkon size={16} />
          {t.kopiera}
        </OpsButton>
        {onAterkalla ? (
          <OpsButton size="sm" variant="ghost" busy={pagar} ariaLabel={t.aterkallaNamn.replace("{url}", lank.url)} onClick={aterkalla}>
            {t.aterkalla}
          </OpsButton>
        ) : null}
        {/* ⛔ STATUSRADEN FINNS I DOM ÄVEN NÄR DEN ÄR TOM: en live-region som skapas samtidigt som texten läses inte alltid upp. */}
        <span role="status" data-lankrad-status="" className="text-etikett text-ink-secondary">{kopierat ? t.kopierad : ""}</span>
      </div>
      {misslyckades ? <p role="alert" data-lankrad-kopieringsfel="" className="m-0 text-etikett text-danger">{t.kopieraMisslyckades}</p> : null}
      {fel ? <p role="alert" data-lankrad-fel="" className="m-0 text-etikett text-danger wrap-anywhere">{fel}</p> : null}
    </li>
  );
}
