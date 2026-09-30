import { useState } from "react";
import { cx } from "../lib/cx.js";
import { sammanstallSvar } from "../lib/handelsemodell.js";
import { BockIkon, KryssIkon } from "./icons.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";

/**
 * Svaren på en händelse: hur det står, mitt eget svar och vem som svarat vad (0.37.0, #179 F3).
 *
 * ══ ⛔ SESSIONSTUDIOS TILLGÄNGLIGHETSLISTA, MED KOMMER / KOMMER INTE ═══════════
 *
 * Förebilden är SS `eventDetail/EventDetailAvailabilityListInline.jsx`: rubriken med antalet, "Kan: N", och en rad per
 * medlem med avatar och namn, där den egna raden är markerad och öppnar svaret. Här är svaret två knappar direkt på den
 * egna raden i stället för en väljare i ett ark, eftersom det bara finns två svar (se `SVARSVAL`).
 *
 * ⛔ SAMMANSTÄLLNINGEN STÅR ALLTID MED ALLA TRE DELARNA, också när de är noll (`sammanstallSvar`, punkt 5).
 *
 * ⛔ BARA MIN RAD HAR KNAPPAR. Regeln låter bara personen själv skriva sitt svar, och en knapp på någon annans rad hade
 * varit en knapp regeln nekar.
 *
 * @param {object} props
 * @param {ReadonlyArray<{ id: string, svar: string }>} props.svar Raderna ur `createSvarskalla().lista`.
 * @param {ReadonlyArray<{ uid: string, namn: string }>} props.medlemmar Gruppens aktiva medlemmar av typen person.
 * @param {string} props.uid Den som tittar.
 * @param {(val: "kommer" | "kommerInte") => Promise<unknown> | void} props.onSvara
 * @param {string} [props.rubrik] Förval "Svar".
 */
export function OpsSvar({ svar, medlemmar, uid, onSvara, rubrik = "Svar" }) {
  const summa = sammanstallSvar(svar, medlemmar.map((m) => m.uid));
  const per = new Map(svar.map((s) => [s.id, s.svar]));
  return (
    <section aria-label={rubrik} data-ops-svar="" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-brod font-semibold text-ink">{rubrik}</span>
        <span className="rounded-full bg-raised px-2 py-0.5 text-meta font-semibold text-ink-secondary">{medlemmar.length}</span>
        <span data-sammanstallning="" className="text-etikett font-medium text-ink-muted">
          {summa.text}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {medlemmar.map((m) => {
          const s = per.get(m.uid);
          const jag = m.uid === uid;
          return (
            <li key={m.uid} data-svarsrad={m.uid} className={cx("flex min-w-0 flex-wrap items-center gap-3 rounded-base p-3", jag ? "border border-accent/30 bg-accent-subtle" : "bg-raised")}>
              <OpsIdentity name={m.namn} seed={m.uid} size="avatar" />
              <span className="min-w-0 flex-1 truncate text-etikett font-medium text-ink">
                {m.namn}
                {jag ? " (du)" : ""}
              </span>
              {jag ? (
                <OpsSvarsknappar vald={s} onSvara={onSvara} namn={m.namn} />
              ) : (
                <span className="shrink-0 text-meta text-ink-muted">{s === "kommer" ? "Kommer" : s === "kommerInte" ? "Kommer inte" : "Har inte svarat"}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Kommer / Kommer inte, som två knappar. Används på den egna raden i `OpsSvar` och i inkorgens rad (`OpsSvarsrad`).
 *
 * ⛔ KNAPPEN SPÄRRAS MEDAN SVARET SKRIVS, OCH ETT FEL STÅR UTSKRIVET. Ett tryck som inte gick fram och inte säger det ser ut
 * som ett svar, och då står frågan kvar i någon annans sammanställning som "har inte svarat" utan att någon vet varför.
 *
 * @param {{ vald?: string, onSvara: (val: "kommer" | "kommerInte") => Promise<unknown> | void, namn?: string }} props
 */
export function OpsSvarsknappar({ vald, onSvara, namn }) {
  const [skriver, setSkriver] = useState(/** @type {null | "kommer" | "kommerInte"} */ (null));
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  /** @param {"kommer" | "kommerInte"} v */
  const tryck = async (v) => {
    setFel(null);
    setSkriver(v);
    try {
      await onSvara(v);
    } catch (e) {
      setFel(`Svaret sparades inte: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSkriver(null);
    }
  };
  const knapp = (/** @type {"kommer" | "kommerInte"} */ v, /** @type {string} */ ord) => (
    <button
      type="button"
      aria-pressed={vald === v}
      aria-label={namn ? `${ord}, ${namn}` : ord}
      disabled={skriver !== null}
      onClick={() => tryck(v)}
      className={cx(
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-base border px-3 text-meta font-semibold transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 md:min-h-8",
        vald === v ? "border-accent bg-accent text-accent-contrast" : "border-line bg-surface text-ink-secondary hover:bg-accent-faint hover:text-ink",
      )}
    >
      {v === "kommer" ? <BockIkon size={14} /> : <KryssIkon size={14} />}
      {ord}
    </button>
  );
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <span data-svarsknappar="" className="flex gap-1.5">
        {knapp("kommer", "Kommer")}
        {knapp("kommerInte", "Kommer inte")}
      </span>
      {fel ? (
        <span role="alert" className="text-meta text-danger">
          {fel}
        </span>
      ) : null}
    </span>
  );
}

/**
 * En rad i inkorgen för en händelse som kräver mitt svar (0.37.0, #179 F3). Raderna räknas fram med `svarsrader`, och
 * raden försvinner när svaret skrivits (se `handelsemodell.js`).
 *
 * @param {object} props
 * @param {string} props.titel
 * @param {string} props.nar Datum och tid i appens ord, t.ex. "Måndag 12 oktober, 18:00".
 * @param {(val: "kommer" | "kommerInte") => Promise<unknown> | void} props.onSvara
 * @param {string} [props.href] Leder till händelsen.
 */
export function OpsSvarsrad({ titel, nar, onSvara, href }) {
  return (
    <div data-ops-svarsrad="" className="flex min-w-0 flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3">
      <span className="min-w-0 flex-1">
        {href ? (
          <a href={href} className="block truncate text-etikett font-medium text-ink hover:underline">
            {titel}
          </a>
        ) : (
          <span className="block truncate text-etikett font-medium text-ink">{titel}</span>
        )}
        <span className="block text-meta text-ink-muted">{nar} · Svar önskas</span>
      </span>
      <OpsSvarsknappar onSvara={onSvara} namn={titel} />
    </div>
  );
}
