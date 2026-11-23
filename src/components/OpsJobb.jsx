import { useState } from "react";
import { formatDagOchKlockslag } from "../lib/format.js";
import { JOBBSTEG, jobbTidpunkt, validateJobbschema } from "../lib/jobb.js";
import { ordet } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsSegmented } from "./OpsSegmented.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { OpsVantar } from "./OpsVantar.jsx";

/**
 * Orden i jobbvyn (0.256.0, cllp/lifehub.app#888), på svenska och engelska.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_JOBB = {
  rubrik: { sv: "Jobb", en: "Jobs" },
  ingress: { sv: "Jobben körs av sig själva enligt schemat.", en: "Jobs run by themselves on their schedule." },
  inga: { sv: "Inga jobb ännu", en: "No jobs yet" },
  lage: { sv: "Läge för {jobb}", en: "Mode for {jobb}" },
  av: { sv: "Av", en: "Off" },
  prov: { sv: "Prov", en: "Trial" },
  skarp: { sv: "Skarpt", en: "Live" },
  steg: { sv: "Hur ofta {jobb} körs", en: "How often {jobb} runs" },
  timme: { sv: "Varje timme", en: "Every hour" },
  dag: { sv: "Varje dag", en: "Every day" },
  vecka: { sv: "Varje vecka", en: "Every week" },
  manad: { sv: "Varje månad", en: "Every month" },
  minut: { sv: "Minut för {jobb}", en: "Minute for {jobb}" },
  minutText: { sv: "kl :{minut}", en: "at :{minut}" },
  tid: { sv: "Tid för {jobb}", en: "Time for {jobb}" },
  veckodag: { sv: "Veckodag för {jobb}", en: "Weekday for {jobb}" },
  dagIManad: { sv: "Dag i månaden för {jobb}", en: "Day of the month for {jobb}" },
  denDag: { sv: "den {dag}:e", en: "on day {dag}" },
  nasta: { sv: "Nästa körning: {nar}", en: "Next run: {nar}" },
  nastaAv: { sv: "Nästa körning: inte, jobbet är av", en: "Next run: none, the job is off" },
  nastaSaknas: { sv: "Nästa körning: inte planerad", en: "Next run: not scheduled" },
  senast: { sv: "Senast {nar}: {vad}", en: "Last {nar}: {vad}" },
  senastSaknas: { sv: "Senast: har inte körts", en: "Last: has not run" },
  paborjade: { sv: "{n} påbörjade", en: "{n} started" },
  bekraftade: { sv: "{n} bekräftade", en: "{n} confirmed" },
  klart: { sv: "klart", en: "done" },
  fel: { sv: "fel ({kod})", en: "error ({kod})" },
  hoppad: { sv: "hoppades över ({kod})", en: "skipped ({kod})" },
  okantFel: { sv: "okänt fel", en: "unknown error" },
  korNu: { sv: "Kör nu", en: "Run now" },
  korNuNamn: { sv: "Kör {jobb} nu", en: "Run {jobb} now" },
  kor: { sv: "Kör…", en: "Running…" },
  sparar: { sv: "Sparar…", en: "Saving…" },
  sparFel: { sv: "Ändringen kunde inte sparas.", en: "The change could not be saved." },
  korFel: { sv: "Jobbet kunde inte startas.", en: "The job could not be started." },
};

/**
 * @typedef {import("../lib/jobb.js").Jobbschema} Jobbschema
 * @typedef {import("../lib/jobb.js").Jobblage} Jobblage
 * @typedef {{ id: string, typ: string, lage: Jobblage, schema: Jobbschema, nastaKorning?: unknown, senast?: { tid?: unknown, utfall?: string, paborjat?: number, bekraftat?: number, kod?: string } | null }} Jobbrad
 * @typedef {{ namn: string, steg: readonly string[] }} Jobbtypvisning
 */

/** Kvartarna. ⛔ INTE VARJE MINUT: schemaläggaren går var 15:e minut (design #888), och en tid mellan två varv körs ändå vid nästa. */
const KVARTAR = [0, 15, 30, 45];

/** @param {number} n */
const tva = (n) => String(n).padStart(2, "0");

/** Alla kvartar på dygnet som "HH:MM", och det nuvarande värdet om det inte är en kvart (ett schema som sparats någon annanstans). @param {string | undefined} nu */
function tidsval(nu) {
  const ut = [];
  for (let h = 0; h < 24; h += 1) for (const m of KVARTAR) ut.push(`${tva(h)}:${tva(m)}`);
  if (nu && !ut.includes(nu)) {
    ut.push(nu);
    ut.sort();
  }
  return ut.map((v) => ({ value: v, label: v }));
}

/** @param {number | undefined} nu */
function minutval(nu) {
  const ut = [...KVARTAR];
  if (typeof nu === "number" && !ut.includes(nu)) {
    ut.push(nu);
    ut.sort((a, b) => a - b);
  }
  return ut.map((m) => ({ value: String(m), label: `:${tva(m)}` }));
}

/**
 * Veckodagarnas namn, måndag (1) först. ⛔ UR `Intl`, inte en egen lista (`check-datumnamn`): en lista här hade kunnat ett språk.
 * @param {string} locale
 */
function veckodagar(locale) {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  // 2024-01-01 var en måndag.
  return Array.from({ length: 7 }, (_, i) => {
    const namn = fmt.format(new Date(Date.UTC(2024, 0, 1 + i)));
    return { value: String(i + 1), label: namn.charAt(0).toUpperCase() + namn.slice(1) };
  });
}

/**
 * Schemat när steget byts: stegets fält med förval, och det som redan valts (tiden) behålls. Ett schema med det förra stegets fält
 * kvar hade kastat i `validateJobbschema`, och ett tomt hade inte varit ett schema.
 * @param {string} steg @param {Jobbschema} gammalt @returns {Jobbschema}
 */
export function jobbschemaForSteg(steg, gammalt) {
  const tid = gammalt?.tid ?? "06:00";
  if (steg === "timme") return { steg, minut: typeof gammalt?.minut === "number" ? gammalt.minut : Number(tid.slice(3, 5)) };
  if (steg === "dag") return { steg, tid };
  if (steg === "vecka") return { steg, tid, veckodag: gammalt?.veckodag ?? 1 };
  return { steg: /** @type {"manad"} */ (steg), tid, dag: gammalt?.dag ?? 1 };
}

/**
 * En grupps återkommande jobb: läget, schemat, nästa körning, senaste utfallet och Kör nu (0.256.0, cllp/lifehub.app#888).
 *
 * ══ ⛔ VYN SPARAR INGET SJÄLV ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Ingen klient skriver ett jobb (design #888, "Regler"): `onSpara` och `onKorNu` är appens serverfunktioner, bara för ägare och
 * admin. Vyn prövar schemat med samma `validateJobbschema` som servern innan den skickar det, så att ett steg typen inte tillåter
 * aldrig når servern från den här ytan.
 *
 * ⛔ ETT VAL SPARAS NÄR DET GÖRS, UTAN EN SPARA-KNAPP. Läget och schemat är var för sig ett beslut, och en knapp till hade varit en
 * sak till att titta på (frågan till varje ärende: skärmtid). Medan servern svarar står "Sparar…" i raden, och ett fel står kvar
 * vid raden tills nästa val (regel 5).
 *
 * ⛔ RESULTATET ÄR EN RAD: antal påbörjade och bekräftade, eller felkoden. Mer än så finns inte i dokumentet (servern vitlistar
 * `senast`), och det är avsiktligt: resultatet ska aldrig bära text ur banken.
 *
 * ⛔ `kanAndra={false}` RITAR TEXT, INTE SPÄRRADE KONTROLLER. En medlem läser jobben; en rad grå väljare hade sett ut som något som
 * snart går att ändra.
 *
 * @param {object} props
 * @param {Jobbrad[]} props.jobb
 * @param {Record<string, Jobbtypvisning>} props.typer Typens namn och de steg den tillåter. Banksynken tillåter inte `timme` (bankens tak).
 * @param {(andring: { id: string, typ: string, lage: Jobblage, schema: Jobbschema }) => Promise<unknown>} props.onSpara
 * @param {(id: string) => Promise<unknown>} props.onKorNu
 * @param {boolean} [props.kanAndra]
 * @param {boolean} [props.utanRubrik] Rubriken och ingressen ritas av panelen runt omkring.
 * @param {"sv" | "en"} [props.sprak]
 */
export function OpsJobb({ jobb, typer, onSpara, onKorNu, kanAndra = false, utanRubrik = false, sprak = "sv" }) {
  const o = (/** @type {keyof typeof ORD_JOBB} */ k, /** @type {Record<string, string | number>} */ v = {}) =>
    Object.entries(v).reduce((t, [n, x]) => t.replace(`{${n}}`, String(x)), ordet(ORD_JOBB, k, sprak));
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const rader = Array.isArray(jobb) ? jobb : [];

  return (
    <section className="flex min-w-0 flex-col gap-3">
      {utanRubrik ? null : (
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="m-0 text-etikett font-medium text-ink">{o("rubrik")}</h2>
          <p className="m-0 text-meta text-ink-secondary">{o("ingress")}</p>
        </div>
      )}
      {rader.length === 0 ? (
        <OpsEmpty title={o("inga")} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rader.map((j) => (
            <JobbRad key={j.id} jobb={j} typ={typer?.[j.typ]} onSpara={onSpara} onKorNu={onKorNu} kanAndra={kanAndra} o={o} locale={locale} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * @param {object} props
 * @param {Jobbrad} props.jobb
 * @param {Jobbtypvisning | undefined} props.typ
 * @param {(andring: { id: string, typ: string, lage: Jobblage, schema: Jobbschema }) => Promise<unknown>} props.onSpara
 * @param {(id: string) => Promise<unknown>} props.onKorNu
 * @param {boolean} props.kanAndra
 * @param {(k: keyof typeof ORD_JOBB, v?: Record<string, string | number>) => string} props.o
 * @param {string} props.locale
 */
function JobbRad({ jobb: j, typ, onSpara, onKorNu, kanAndra, o, locale }) {
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState("");
  const namn = typ?.namn ?? j.typ;
  // ⛔ EN TYP APPEN INTE KÄNNER RITAS SOM TEXT. Utan typens tillåtna steg går det inte att veta vilka scheman som är giltiga.
  const andringsbar = kanAndra && Boolean(typ);
  const tillatna = typ ? typ.steg.filter((s) => JOBBSTEG.includes(/** @type {any} */ (s))) : [];
  const schema = j.schema ?? { steg: "dag", tid: "06:00" };

  /**
   * @param {{ lage?: Jobblage, schema?: Jobbschema }} andring
   * @returns {Promise<unknown>}
   */
  async function spara(andring) {
    setFel("");
    /** @type {Jobbschema} */
    let nyttSchema;
    try {
      nyttSchema = validateJobbschema(andring.schema ?? schema, tillatna);
    } catch (e) {
      setFel(e instanceof Error ? e.message : o("sparFel"));
      return;
    }
    setSparar(true);
    try {
      await onSpara({ id: j.id, typ: j.typ, lage: andring.lage ?? j.lage, schema: nyttSchema });
    } catch {
      setFel(o("sparFel"));
    } finally {
      setSparar(false);
    }
  }

  async function korNu() {
    setFel("");
    try {
      await onKorNu(j.id);
    } catch {
      setFel(o("korFel"));
    }
  }

  const stegval = tillatna.map((s) => ({ value: s, label: o(/** @type {any} */ (s)) }));
  const nasta = jobbTidpunkt(j.nastaKorning);
  const nastaText = j.lage === "av" ? o("nastaAv") : nasta ? o("nasta", { nar: formatDagOchKlockslag(nasta, { locale }) }) : o("nastaSaknas");

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-base border border-line bg-raised p-3" data-jobb={j.id}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="m-0 min-w-0 text-etikett font-medium text-ink wrap-anywhere">{namn}</p>
        {andringsbar ? (
          <OpsButton size="sm" variant="secondary" ariaLabel={o("korNuNamn", { jobb: namn })} busyLabel={o("kor")} disabled={j.lage === "av" || sparar} onClick={korNu}>
            {o("korNu")}
          </OpsButton>
        ) : null}
      </div>

      {andringsbar ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <OpsSegmented
            ariaLabel={o("lage", { jobb: namn })}
            value={j.lage}
            onChange={(v) => spara({ lage: v })}
            options={[
              { value: "av", label: o("av") },
              { value: "prov", label: o("prov") },
              { value: "skarp", label: o("skarp") },
            ]}
          />
          <OpsSelect ariaLabel={o("steg", { jobb: namn })} value={schema.steg} options={stegval} onChange={(v) => spara({ schema: jobbschemaForSteg(v, schema) })} />
          {schema.steg === "timme" ? (
            <OpsSelect ariaLabel={o("minut", { jobb: namn })} value={String(schema.minut ?? 0)} options={minutval(schema.minut)} onChange={(v) => spara({ schema: { steg: "timme", minut: Number(v) } })} />
          ) : (
            <OpsSelect ariaLabel={o("tid", { jobb: namn })} value={schema.tid} options={tidsval(schema.tid)} onChange={(v) => spara({ schema: { ...schema, tid: v } })} />
          )}
          {schema.steg === "vecka" ? (
            <OpsSelect ariaLabel={o("veckodag", { jobb: namn })} value={String(schema.veckodag ?? 1)} options={veckodagar(locale)} onChange={(v) => spara({ schema: { ...schema, veckodag: Number(v) } })} />
          ) : null}
          {schema.steg === "manad" ? (
            <OpsSelect
              ariaLabel={o("dagIManad", { jobb: namn })}
              value={String(schema.dag ?? 1)}
              options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
              onChange={(v) => spara({ schema: { ...schema, dag: Number(v) } })}
            />
          ) : null}
        </div>
      ) : (
        <p className="m-0 text-etikett text-ink-secondary">
          {o(/** @type {any} */ (j.lage === "skarp" || j.lage === "prov" ? j.lage : "av"))}. {schemaText(schema, o, locale)}
        </p>
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <p className="m-0 text-meta text-ink-muted">{nastaText}</p>
        <p className="m-0 text-meta text-ink-muted">{senastText(j.senast, o, locale)}</p>
      </div>
      {sparar ? <OpsVantar storlek="sm" text={o("sparar")} /> : null}
      {fel ? (
        <p role="alert" className="m-0 text-etikett text-danger wrap-anywhere">
          {fel}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Schemat som en rad text: "Varje vecka, Måndag 06:15".
 * @param {Jobbschema} s @param {(k: any, v?: Record<string, string | number>) => string} o @param {string} locale
 */
function schemaText(s, o, locale) {
  const steg = o(/** @type {any} */ (s.steg));
  if (s.steg === "timme") return `${steg} ${o("minutText", { minut: tva(s.minut ?? 0) })}`;
  if (s.steg === "vecka") return `${steg}, ${veckodagar(locale)[(s.veckodag ?? 1) - 1]?.label ?? ""} ${s.tid ?? ""}`;
  if (s.steg === "manad") return `${steg}, ${o("denDag", { dag: s.dag ?? 1 })} ${s.tid ?? ""}`;
  return `${steg} ${s.tid ?? ""}`;
}

/**
 * Senaste utfallet som en rad. ⛔ TOMHET ÄR ETT SVAR (regel 5): ett jobb som aldrig körts säger det, i stället för att raden saknas.
 * @param {Jobbrad["senast"]} senast @param {(k: any, v?: Record<string, string | number>) => string} o @param {string} locale
 */
function senastText(senast, o, locale) {
  const nar = jobbTidpunkt(senast?.tid);
  if (!senast || !nar) return o("senastSaknas");
  const kod = senast.kod || o("okantFel");
  /** @type {string[]} */
  const antal = [];
  if (typeof senast.paborjat === "number") antal.push(o("paborjade", { n: senast.paborjat }));
  if (typeof senast.bekraftat === "number") antal.push(o("bekraftade", { n: senast.bekraftat }));
  const vad = senast.utfall === "ok" ? (antal.length > 0 ? antal.join(", ") : o("klart")) : senast.utfall === "hoppad" ? o("hoppad", { kod }) : o("fel", { kod });
  return o("senast", { nar: formatDagOchKlockslag(nar, { locale }), vad });
}
