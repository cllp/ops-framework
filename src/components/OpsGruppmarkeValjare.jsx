import { useEffect, useId, useMemo, useState } from "react";
import { cx } from "../lib/cx.js";
import { initials } from "../lib/identity.js";
import { GRUPPINITIALER_FORM } from "../lib/grupp.js";
import { GRUPPKULORFORSLAG, fargTillKulor, gruppKulor, kulorTillFarg } from "../lib/gruppfarg.js";
import { gruppikonKomponent, gruppikonNamn } from "../lib/gruppikoner.js";
import { VANLIGA_GRUPPIKONER, forslagUrGruppnamn, sokGruppikoner } from "../lib/gruppikonsok.js";
import { OpsSlider } from "./OpsSlider.jsx";
import { BockIkon } from "./icons.jsx";

/**
 * Gruppens kulör och ikon (0.65.0, #265): det som fälls ut under "Färg och ikon" i `OpsGruppFormular`.
 *
 * ══ ⛔ KULÖR, INTE FÄRG ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Tolv snabbval och ett reglage för alla 360 kulörer. Ljusheten och mättnaden väljs aldrig här: de står i temat
 * (`--gruppmarke-*` i tokens.css) för ljust och mörkt läge, och vakten `check-gruppfarg` mäter kontrasten för varje
 * kulör. Valet och skälet står i `src/lib/gruppfarg.js`.
 *
 * ══ ⛔ IKONEN: SÖKBAR, ETT SET, SPARAD SOM NAMN ═══════════════════════════════════════════════════════════════════
 *
 * Innan något skrivits: förslag ur gruppens namn ("Bandet" ger musikikonerna), de senast använda och tjugo vanliga.
 * Sökningen går på Lucides sökord och svenska synonymer (`gruppikonsok.js`), inte på filnamnet. `onIkon` får alltid
 * ett NAMN (`music`), aldrig ett index. Alla ikoner är Lucides, med samma streckvikt.
 *
 * ⛔ TOMHET SÄGS UT (regel 5). En rad utan förslag skriver att det inte finns några, och en sökning utan träff säger det.
 *
 * ⛔ SENAST ANVÄNDA ÄR EN BEKVÄMLIGHET PER WEBBLÄSARE, i `localStorage`. Den får försvinna (privat fönster, rensad
 * webbplatsdata), och raden säger då "Inga ännu". Den är aldrig gruppens data.
 *
 * @param {object} props
 * @param {string} props.namn Gruppens namn som det står i fältet nu. Förfiltrerar ikonerna.
 * @param {string} props.seed Gruppens id, eller ett stabilt frö för en ny grupp. Ger kulören när ingen valts.
 * @param {string} props.farg Lagringsformen (`kulor:210`, en äldre ton, eller tom).
 * @param {string} props.ikon Lagringsformen (ett namn, ett äldre id, `initialer:AB`, eller tom).
 * @param {(farg: string) => void} props.onFarg
 * @param {(ikon: string) => void} props.onIkon
 * @param {"sv"|"en"} props.sprak
 * @param {{ farg: string, initialer: string, ikonEllerLogotyp: string, egnaInitialer: string, egnaInitialerHint: string, aterstallInitialer: string, kulorExakt: string, kulorGrader: string, kulorAterstall: string, kulorHint: string, sokIkon: string, sokIkonPlatshallare: string, forslagUrNamn: string, forslagInga: string, forslagSkrivNamn: string, senastAnvanda: string, senastInga: string, vanliga: string, traffar: string, ingaTraffar: string }} props.t Formulärets etiketter.
 * @param {string} props.idPrefix
 */
export function OpsGruppmarkeValjare({ namn, seed, farg, ikon, onFarg, onIkon, sprak, t, idPrefix }) {
  const sokId = useId();
  const [fraga, setFraga] = useState("");
  const [senaste, setSenaste] = useState(/** @type {string[]} */ ([]));
  useEffect(() => setSenaste(lasSenaste()), []);

  const kulor = fargTillKulor(farg) ?? gruppKulor(null, seed);
  const standardKulor = gruppKulor(null, seed);
  const valtNamn = gruppikonNamn(ikon);
  const initialerAktiva = ikon === "" || GRUPPINITIALER_FORM.test(ikon);
  const egnaInitialer = GRUPPINITIALER_FORM.exec(ikon)?.[1] ?? "";

  const forslag = useMemo(() => forslagUrGruppnamn(namn).slice(0, 12), [namn]);
  const traffar = useMemo(() => (fraga.trim() ? sokGruppikoner(fraga) : []), [fraga]);

  const valjIkon = (/** @type {string} */ n) => {
    onIkon(n);
    setSenaste(sparaSenaste(n));
  };

  /** @param {{ rubrik: string, namn: ReadonlyArray<string>, tomText: string, medInitialer?: boolean, id: string }} r */
  const rad = ({ rubrik, namn: lista, tomText, medInitialer = false, id }) => (
    <div data-ikonrad={id}>
      <p className="m-0 mb-1 text-hjalp text-ink-muted" id={`${idPrefix}-${id}`}>
        {rubrik}
      </p>
      {lista.length === 0 && !medInitialer ? (
        <p className="m-0 text-hjalp text-ink-muted" data-tom="">
          {tomText}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1" role="group" aria-labelledby={`${idPrefix}-${id}`}>
          {medInitialer ? (
            <button
              type="button"
              onClick={() => onIkon(egnaInitialer ? ikon : "")}
              aria-label={t.initialer}
              aria-pressed={initialerAktiva}
              className={cx(
                "flex size-11 cursor-pointer items-center justify-center rounded-base text-etikett font-semibold text-ink-secondary transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                initialerAktiva && "bg-accent-subtle text-ink ring-2 ring-accent",
              )}
            >
              Aa
            </button>
          ) : null}
          {lista.map((n) => {
            const Ikon = gruppikonKomponent(n);
            if (!Ikon) return null;
            const vald = valtNamn === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => valjIkon(n)}
                aria-label={n.replace(/-/g, " ")}
                aria-pressed={vald}
                title={n}
                data-ikonnamn={n}
                className={cx(
                  "flex size-11 cursor-pointer items-center justify-center rounded-base text-ink-secondary transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  vald && "bg-accent-subtle text-ink ring-2 ring-accent",
                )}
              >
                <Ikon size={18} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div data-kulorvaljare="">
        <p className="m-0 mb-2 text-meta font-semibold text-ink-secondary" id={`${idPrefix}-kulor`}>
          {t.farg}
        </p>
        <div className="flex flex-wrap gap-1" role="group" aria-labelledby={`${idPrefix}-kulor`}>
          {GRUPPKULORFORSLAG.map((f) => {
            const vald = fargTillKulor(farg) === f.kulor;
            return (
              <button
                key={f.kulor}
                type="button"
                onClick={() => onFarg(kulorTillFarg(f.kulor))}
                aria-label={sprak === "en" ? f.en : f.sv}
                title={sprak === "en" ? f.en : f.sv}
                aria-pressed={vald}
                data-kulor={f.kulor}
                className="flex size-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  className={cx("ops-grupp-kulorruta flex size-9 items-center justify-center rounded-full text-ink-inverse transition-all", vald && "scale-105 ring-2 ring-accent ring-offset-2 ring-offset-canvas")}
                  style={/** @type {import("react").CSSProperties} */ ({ "--grupp-kulor": f.kulor })}
                >
                  {vald ? <BockIkon size={16} /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2">
          <OpsSlider
            label={t.kulorExakt}
            value={kulor}
            min={0}
            max={359}
            zero={standardKulor}
            onChange={(v) => onFarg(kulorTillFarg(Math.round(v)))}
            formatValue={(v) => `${Math.round(v)} ${t.kulorGrader}`}
            resetLabel={t.kulorAterstall}
          />
        </div>
        <p className="m-0 mt-1 text-hjalp text-ink-muted">{t.kulorHint}</p>
      </div>

      <div data-ikonvaljare="">
        <label htmlFor={sokId} className="m-0 mb-2 block text-meta font-semibold text-ink-secondary">
          {t.ikonEllerLogotyp}
        </label>
        <input
          id={sokId}
          type="search"
          value={fraga}
          onChange={(e) => setFraga(e.target.value)}
          placeholder={t.sokIkonPlatshallare}
          aria-label={t.sokIkon}
          autoComplete="off"
          className="mb-2 min-h-11 w-full rounded-base border-[1.5px] border-line bg-surface px-3 py-2 text-brod text-ink placeholder:text-ink-muted hover:border-line-strong focus-visible:border-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        />
        <div className="flex flex-col gap-2" aria-live="polite">
          {fraga.trim() ? (
            rad({ id: "traffar", rubrik: `${t.traffar} (${traffar.length})`, namn: traffar.slice(0, 48), tomText: t.ingaTraffar.replace("{fraga}", fraga.trim()) })
          ) : (
            <>
              {rad({ id: "forslag", rubrik: t.forslagUrNamn, namn: forslag, tomText: namn.trim() ? t.forslagInga : t.forslagSkrivNamn })}
              {rad({ id: "senaste", rubrik: t.senastAnvanda, namn: senaste, tomText: t.senastInga })}
              {rad({ id: "vanliga", rubrik: t.vanliga, namn: VANLIGA_GRUPPIKONER, tomText: "", medInitialer: true })}
            </>
          )}
        </div>
      </div>

      {initialerAktiva ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-init`} className="text-hjalp text-ink-muted">
            {t.egnaInitialer}
          </label>
          <p className="m-0 text-hjalp text-ink-muted">{t.egnaInitialerHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`${idPrefix}-init`}
              value={egnaInitialer}
              maxLength={3}
              placeholder={initials(namn)}
              onChange={(e) => {
                const v = e.target.value.replace(/[^a-zA-ZÅÄÖåäö0-9]/g, "").toUpperCase().slice(0, 3);
                onIkon(v ? `initialer:${v}` : "");
              }}
              className="min-h-11 w-24 rounded-base border-[1.5px] border-line bg-surface px-3 py-2 text-brod uppercase text-ink placeholder:normal-case placeholder:text-ink-muted hover:border-line-strong focus-visible:border-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            />
            {egnaInitialer ? (
              <button
                type="button"
                onClick={() => onIkon("")}
                className="min-h-11 cursor-pointer rounded-base px-2 text-meta text-accent hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                {t.aterstallInitialer}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Nyckeln i `localStorage`. Per webbläsare, aldrig gruppens data. */
export const SENASTE_NYCKEL = "ops-gruppikon-senaste";
const MAX_SENASTE = 8;

/** @returns {string[]} */
function lasSenaste() {
  try {
    const varde = JSON.parse(globalThis.localStorage?.getItem(SENASTE_NYCKEL) ?? "[]");
    return Array.isArray(varde) ? varde.filter((n) => typeof n === "string" && gruppikonKomponent(n)).slice(0, MAX_SENASTE) : [];
  } catch {
    // ⛔ Ingen lagring (privat fönster, blockerad) är inget fel: raden säger "Inga ännu".
    return [];
  }
}

/** @param {string} namn @returns {string[]} */
function sparaSenaste(namn) {
  const lista = [namn, ...lasSenaste().filter((n) => n !== namn)].slice(0, MAX_SENASTE);
  try {
    globalThis.localStorage?.setItem(SENASTE_NYCKEL, JSON.stringify(lista));
  } catch {
    // Se `lasSenaste`. Listan gäller ändå för den här visningen.
  }
  return lista;
}
