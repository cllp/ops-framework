import { useState } from "react";
import { cx } from "../lib/cx.js";
import { sammanstallSvar } from "../lib/handelsemodell.js";
import { forvalda } from "../lib/ord.js";
import { BockIkon, KryssIkon } from "./icons.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { usePersonnamn } from "./usePersonnamn.js";

/**
 * Orden i svarsammanställningen som inte kommer från appen (0.132.0): namnet på en gäst som saknar namn.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSSVAR = {
  gast: { sv: "Gäst", en: "Guest" },
};

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
 * ⛔ PÅ SMAL BREDD LIGGER KNAPPARNA UNDER NAMNET (0.37.0). CP 2026-09-30: det egna namnet trycktes ihop till "Ann..." av två
 * knappar på 44 px bredvid sig vid 390. Knapparna får en egen rad under 768 px (`w-full`), och namnet får hela raden vid
 * avataren. Från 768 px står de bredvid, som förut. Mäts i skalytan, avsnitt 33.
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
 * @param {ReadonlyArray<{ uid: string, namn?: string }>} [props.gaster] (0.132.0, lifehub.app#389) Gruppens aktiva gäster, `uid` är gästens `gastId` (`g_...`, samma id som svarsraden har). De räknas i summan och i antalet, och
 *   får en rad var med ordet `gastEtikett`, utan knappar: en gäst svarar på sin egen sida. ⛔ En gäst som inte finns i listan räknas inte, så en återkallad gästs svar står kvar i databasen men syns inte här,
 *   som för en medlem som lämnat gruppen. Namnlös gäst heter "Gäst".
 * @param {string} [props.gastEtikett] Förval ur ordboken (`ORD_OPSSVAR.gast`, "Gäst" eller "Guest" efter språket).
 * @param {string} [props.sprak] `sv` eller `en`. Utelämnat: språket ur `OpsSprakProvider`.
 */
export function OpsSvar({ svar, medlemmar, uid, onSvara, rubrik = "Svar", gaster = [], gastEtikett: gastEtikettProp, sprak: sprakProp }) {
  const sprakKontext = useOpsSprak();
  const gastEtikett = gastEtikettProp ?? forvalda(ORD_OPSSVAR, sprakProp ?? sprakKontext).gast;
  // ⛔ ALDRIG TOMT ELLER ETT ID SOM NAMN (#218): en medlem utan namn ritades som en tom rad.
  const personnamn = usePersonnamn();
  const summa = sammanstallSvar(svar, [...medlemmar.map((m) => m.uid), ...gaster.map((g) => g.uid)]);
  const per = new Map(svar.map((s) => [s.id, s.svar]));
  return (
    <section aria-label={rubrik} data-ops-svar="" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-rubrik text-ink">{rubrik}</span>
        <span className="rounded-full bg-raised px-2 py-0.5 text-meta font-medium text-ink-secondary">{medlemmar.length + gaster.length}</span>
        <span data-sammanstallning="" className="text-etikett font-medium text-ink-muted">
          {summa.text}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {medlemmar.map((m) => {
          const s = per.get(m.uid);
          const jag = m.uid === uid;
          const { text: visat, saknas } = personnamn(m.namn, m.uid);
          return (
            <li key={m.uid} data-svarsrad={m.uid} className={cx("flex min-w-0 flex-wrap items-center gap-3 rounded-base p-3", jag ? "border border-accent/30 bg-accent-subtle" : "bg-raised")}>
              <OpsIdentity name={visat} seed={m.uid} size="avatar" />
              <span className="min-w-0 flex-1 truncate text-etikett font-medium text-ink" data-namn-saknas={saknas ? "" : undefined}>
                {visat}
                {jag ? " (du)" : ""}
              </span>
              {jag ? (
                <OpsSvarsknappar vald={s} onSvara={onSvara} namn={visat} variant="egen-rad" />
              ) : (
                <span className="shrink-0 text-meta text-ink-secondary">{s === "kommer" ? "Kommer" : s === "kommerInte" ? "Kommer inte" : "Har inte svarat"}</span>
              )}
            </li>
          );
        })}
        {gaster.map((g) => {
          const s = per.get(g.uid);
          return (
            <li key={g.uid} data-svarsrad={g.uid} data-gast="" className="flex min-w-0 flex-wrap items-center gap-3 rounded-base bg-raised p-3">
              <OpsIdentity name={g.namn || gastEtikett} seed={g.uid} size="avatar" />
              <span className="min-w-0 flex-1 truncate text-etikett font-medium text-ink">
                {g.namn || gastEtikett}
                {g.namn ? <span data-gast-markning="" className="ml-2 rounded-full bg-sunken px-2 py-0.5 text-meta font-medium text-ink-secondary">{gastEtikett}</span> : null}
              </span>
              <span className="shrink-0 text-meta text-ink-secondary">{s === "kommer" ? "Kommer" : s === "kommerInte" ? "Kommer inte" : "Har inte svarat"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Svaren som SUMMOR, för den som inte får se vem som svarat vad (0.132.0, lifehub.app#389): en gäst. Samma sammanställning som `OpsSvar` ("3 kommer, 1 kommer inte, 2 har inte svarat", alla tre delarna också när de är noll),
 * mitt eget svar som två knappar (`OpsSvarsknappar`), och inga namn. Summan kommer färdig från servern: gästen får aldrig raderna.
 *
 * @param {object} props
 * @param {{ kommer: number, kommerInte: number, ejSvarat: number, text: string, mitt: "kommer" | "kommerInte" | null }} props.summa Tjänstens `handelse().svar`.
 * @param {(val: "kommer" | "kommerInte") => Promise<unknown> | void} props.onSvara
 * @param {string} props.rubrik Rubriken, på gästens språk (gästens sida har egna ord). Krävs: ramverket gissar inte språket.
 */
export function OpsSvarSummor({ summa, onSvara, rubrik }) {
  if (typeof rubrik !== "string" || rubrik === "") throw new Error("OpsSvarSummor: rubrik krävs, på gästens språk.");
  for (const f of /** @type {const} */ (["kommer", "kommerInte", "ejSvarat"])) {
    if (!Number.isInteger(summa?.[f]) || summa[f] < 0) throw new Error(`OpsSvarSummor: summa.${f} är ett heltal (tjänstens handelse().svar). Utan siffran går "noll" inte att skilja från "ostält".`);
  }
  if (typeof summa.text !== "string" || summa.text === "") throw new Error("OpsSvarSummor: summa.text krävs, sammanställningen som en mening.");
  return (
    <section aria-label={rubrik} data-ops-svar="" data-ops-svar-summor="" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-rubrik text-ink">{rubrik}</span>
        <span data-sammanstallning="" className="text-etikett font-medium text-ink-muted">
          {summa.text}
        </span>
      </div>
      <OpsSvarsknappar vald={summa.mitt ?? undefined} onSvara={onSvara} variant="egen-rad" />
    </section>
  );
}

/**
 * Kommer / Kommer inte, som två knappar. Används på den egna raden i `OpsSvar` och i inkorgens rad (`OpsSvarsrad`).
 * `variant="egen-rad"` ger knapparna en egen rad under 768 px (raden i `OpsSvar`); förvalet `inline` står bredvid.
 *
 * ⛔ KNAPPEN SPÄRRAS MEDAN SVARET SKRIVS, OCH ETT FEL STÅR UTSKRIVET. Ett tryck som inte gick fram och inte säger det ser ut
 * som ett svar, och då står frågan kvar i någon annans sammanställning som "har inte svarat" utan att någon vet varför.
 *
 * @param {{ vald?: string, onSvara: (val: "kommer" | "kommerInte") => Promise<unknown> | void, namn?: string, variant?: "inline" | "egen-rad" }} props
 */
export function OpsSvarsknappar({ vald, onSvara, namn, variant = "inline" }) {
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
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-base border px-3 text-meta font-medium transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 md:min-h-8",
        vald === v ? "border-accent bg-accent text-accent-contrast" : "border-line bg-surface text-ink-secondary hover:bg-accent-faint hover:text-ink",
      )}
    >
      {v === "kommer" ? <BockIkon size={14} /> : <KryssIkon size={14} />}
      {ord}
    </button>
  );
  return (
    <span className={cx("flex shrink-0 flex-col gap-1", variant === "egen-rad" ? "w-full items-start md:w-auto md:items-end" : "items-end")}>
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
