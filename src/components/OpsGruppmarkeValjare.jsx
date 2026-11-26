import { initials } from "../lib/identity.js";
import { GRUPPINITIALER_FORM } from "../lib/grupp.js";
import { gruppKulor } from "../lib/gruppfarg.js";
import { gruppikonNamn } from "../lib/gruppikoner.js";
import { OpsFargvalLat } from "./OpsFargvalLat.jsx";
import { OpsField } from "./OpsField.jsx";
import { OpsIkonValjare } from "./OpsIkonValjare.jsx";

/**
 * Gruppens kulör och ikon (0.65.0, #265): det som fälls ut under "Färg och ikon" i `OpsGruppFormular`.
 *
 * ══ ⛔ KULÖR, INTE FÄRG ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Tolv snabbval och ett reglage för alla 360 kulörer, i `OpsFargval slag="kulor"` sedan 0.238.0 (cllp/lifehub.app#882: en
 * färgväljare överallt). Ljusheten och mättnaden väljs aldrig här: de står i temat (`--gruppmarke-*` i tokens.css) för ljust
 * och mörkt läge, och vakten `check-gruppfarg` mäter kontrasten för varje kulör. Valet och skälet står i `src/lib/gruppfarg.js`.
 * ⛔ `t.kulorExakt` och `t.kulorGrader` läses inte sedan 0.238.0: reglaget heter "Kulör" och säger graderna själv, som i Hubbens färger.
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
 * webbplatsdata), och raden säger då "Inga ännu". Den är aldrig gruppens data. Läsningen och skrivningen bor i
 * `src/lib/gruppikonsenaste.js` sedan 0.70.0, så att en väljare utan React delar samma lista.
 *
 * @param {object} props
 * @param {string} props.namn Gruppens namn som det står i fältet nu. Förfiltrerar ikonerna.
 * @param {string} props.seed Gruppens id, eller ett stabilt frö för en ny grupp. Ger kulören när ingen valts.
 * @param {string} props.farg Lagringsformen (`kulor:210`, en äldre ton, eller tom).
 * @param {string} props.ikon Lagringsformen (ett namn, ett äldre id, `initialer:AB`, eller tom).
 * @param {(farg: string) => void} props.onFarg
 * @param {(ikon: string) => void} props.onIkon
 * @param {"sv"|"en"} props.sprak
 * @param {{ farg: string, initialer: string, ikonEllerLogotyp: string, egnaInitialer: string, egnaInitialerHint: string, aterstallInitialer: string, kulorExakt: string, kulorGrader: string, kulorAterstall: string, kulorHint: string, sokIkon: string, sokIkonPlatshallare: string, forslagUrNamn: string, forslagInga: string, forslagSkrivNamn: string, senastAnvanda: string, senastInga: string, vanliga: string, traffar: string, ingaTraffar: string, traffarStatus: string, ingetMatchar: string }} props.t Formulärets etiketter.
 * @param {string} props.idPrefix
 * @param {boolean} [props.person] (cllp/lifehub.app#786) Väljaren för en PERSON, i `OpsProfil`: ingen rad "Förslag ur namnet" och inga egna
 *   initialer. Samma skillnader som Identitys väljare (lifehub.identity `web/src/markevaljare.ts`): ett personnamn ("Claes Philip") säger
 *   ingenting om vilken ikon som passar, och `byggAnvandare` nekar formen `initialer:AB` för en person. `t.forslag*`, `t.egnaInitialer*` och
 *   `t.aterstallInitialer` läses då inte. Utelämnad: gruppens väljare, som förut.
 */
export function OpsGruppmarkeValjare({ namn, seed, farg, ikon, onFarg, onIkon, sprak, t, idPrefix, person = false }) {
  const standardKulor = gruppKulor(null, seed);
  const valtNamn = gruppikonNamn(ikon);
  const initialerAktiva = ikon === "" || GRUPPINITIALER_FORM.test(ikon);
  const egnaInitialer = GRUPPINITIALER_FORM.exec(ikon)?.[1] ?? "";

  return (
    <>
      {/* ⛔ FÄRGEN VÄLJS I RAMVERKETS ENDA FÄRGVÄLJARE (0.238.0, cllp/lifehub.app#882), i kulörläge: samma fält och ruta som Hubbens färger
          och kalendrarna. Snabbvalen, reglaget och återställningen ligger i rutan. */}
      <div data-gruppfarg="">
        <OpsField label={t.farg} hint={t.kulorHint}>
          <OpsFargvalLat slag="kulor" value={farg} onChange={onFarg} standard={standardKulor} aterstall={t.kulorAterstall} />
        </OpsField>
      </div>

      {/* ⛔ IKONEN I RAMVERKETS ENDA IKONVÄLJARE (0.265.0, CP 2026-11-26): samma som kalendrarna. Här med knappen "Aa" för initialerna, och utan förslag för en person. */}
      <OpsIkonValjare
        vald={valtNamn}
        onIkon={onIkon}
        namn={person ? undefined : namn}
        sprak={sprak}
        idPrefix={idPrefix}
        t={{ ...t, rubrik: t.ikonEllerLogotyp }}
        initialer={{ aktiv: initialerAktiva, etikett: t.initialer, onValj: () => onIkon(egnaInitialer ? ikon : "") }}
      />

      {initialerAktiva && !person ? (
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
              className="min-h-11 w-24 rounded-base border-[1.5px] border-line bg-surface px-3 py-2 text-brod md:text-etikett uppercase text-ink placeholder:normal-case placeholder:text-ink-muted hover:border-line-strong focus-visible:border-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
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
