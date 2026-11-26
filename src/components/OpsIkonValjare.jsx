import { useEffect, useId, useMemo, useState } from "react";
import { cx } from "../lib/cx.js";
import { forvalda } from "../lib/ord.js";
import { gruppikonEtikett } from "../lib/gruppikonnamn.js";
import { gruppikonKomponent } from "../lib/gruppikoner.js";
import { lasSenasteGruppikoner, sparaSenasteGruppikon } from "../lib/gruppikonsenaste.js";
import { VANLIGA_GRUPPIKONER, forslagUrGruppnamn, sokGruppikoner } from "../lib/gruppikonsok.js";

/**
 * Ikonväljaren: sök, förslag ur namnet, senast använda och de vanliga, ur gruppikonernas katalog (Lucide).
 *
 * ══ ⛔ EN VÄLJARE FÖR GRUPPER, PERSONER OCH KALENDRAR ══════════════════════════════════════════════════════════════
 *
 * CP 2026-11-26, med kalenderns åtta ikoner bredvid Mitt kontos väljare: "Vi har alldeles för få ikoner att välja mellan här. Skall det inte vara samma som mitt konto?"
 * Väljaren stod inne i `OpsGruppmarkeValjare`, och kalendrarna hade en egen rad med åtta knappar (`KALENDERIKONER` före 0.265.0). Två väljare för samma sak glider isär
 * (regel 2), så den bröts ut hit. `OpsGruppmarkeValjare` lägger till färgen och initialerna runt den, och `OpsKalendrar` använder den som den är.
 *
 * ⛔ `onIkon` FÅR ALLTID ETT NAMN UR KATALOGEN (`music`), aldrig ett index. Sökningen går på Lucides sökord och svenska synonymer (`gruppikonsok.js`), inte på filnamnet.
 * ⛔ TOMHET SÄGS UT (regel 5). En rad utan förslag skriver att det inte finns några, och en sökning utan träff säger det.
 * ⛔ SENAST ANVÄNDA ÄR EN BEKVÄMLIGHET PER WEBBLÄSARE (`gruppikonsenaste.js`), delad mellan grupper och kalendrar. Den får försvinna, och raden säger då "Inga ännu".
 * ⛔ DEN LEVANDE REGIONEN ÄR EN KORT RAD, INTE RUTNÄTET (granskningen av PR 266): en skärmläsare läste annars upp upp till 48 knappar för varje tangent.
 *
 * @param {object} props
 * @param {string} props.vald Katalognamnet som är valt nu, eller tom sträng.
 * @param {(namn: string) => void} props.onIkon
 * @param {string} [props.namn] Namnet som står i fältet nu. Ger raden "Förslag ur namnet". Utelämnad (en person): ingen sådan rad.
 * @param {"sv"|"en"} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_IKONVALJARE, string>>} [props.t] Egna etiketter, till exempel gruppformulärets. Det som saknas tas ur `ORD_IKONVALJARE`.
 * @param {string} [props.idPrefix]
 * @param {boolean} [props.disabled]
 * @param {{ aktiv: boolean, etikett: string, onValj: () => void }} [props.initialer] Knappen "Aa" först bland de vanliga (gruppens initialer). Utelämnad: ingen knapp.
 */
export function OpsIkonValjare({ vald, onIkon, namn, sprak = "sv", t: egna = {}, idPrefix, disabled = false, initialer }) {
  const autoId = useId();
  const prefix = idPrefix ?? autoId;
  const sokId = `${prefix}-sok`;
  const t = /** @type {Record<keyof typeof ORD_IKONVALJARE, string>} */ ({ ...forvalda(ORD_IKONVALJARE, sprak), ...egna });
  const [fraga, setFraga] = useState("");
  const [senaste, setSenaste] = useState(/** @type {string[]} */ ([]));
  useEffect(() => setSenaste(lasSenasteGruppikoner()), []);

  const medForslag = typeof namn === "string";
  const forslag = useMemo(() => (medForslag ? forslagUrGruppnamn(namn).slice(0, 12) : []), [namn, medForslag]);
  const traffar = useMemo(() => (fraga.trim() ? sokGruppikoner(fraga) : []), [fraga]);

  const valjIkon = (/** @type {string} */ n) => {
    onIkon(n);
    setSenaste(sparaSenasteGruppikon(n));
  };

  /** @param {{ rubrik: string, namn: ReadonlyArray<string>, tomText: string, medInitialer?: boolean, id: string }} r */
  const rad = ({ rubrik, namn: lista, tomText, medInitialer = false, id }) => (
    <div data-ikonrad={id}>
      <p className="m-0 mb-1 text-hjalp text-ink-muted" id={`${prefix}-${id}`}>
        {rubrik}
      </p>
      {lista.length === 0 && !(medInitialer && initialer) ? (
        <p className="m-0 text-hjalp text-ink-muted" data-tom="">
          {tomText}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1" role="group" aria-labelledby={`${prefix}-${id}`}>
          {medInitialer && initialer ? (
            <button
              type="button"
              onClick={initialer.onValj}
              disabled={disabled}
              aria-label={initialer.etikett}
              aria-pressed={initialer.aktiv}
              className={cx(
                "flex size-11 cursor-pointer items-center justify-center rounded-base text-etikett font-medium text-ink-secondary transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
                initialer.aktiv && "bg-accent-subtle text-ink ring-2 ring-accent",
              )}
            >
              Aa
            </button>
          ) : null}
          {lista.map((n) => {
            const Ikon = gruppikonKomponent(n);
            if (!Ikon) return null;
            const ar = vald === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => valjIkon(n)}
                disabled={disabled}
                aria-label={gruppikonEtikett(n, sprak)}
                aria-pressed={ar}
                title={gruppikonEtikett(n, sprak)}
                data-ikonnamn={n}
                className={cx(
                  "flex size-11 cursor-pointer items-center justify-center rounded-base text-ink-secondary transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
                  ar && "bg-accent-subtle text-ink ring-2 ring-accent",
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
    <div data-ikonvaljare="">
      <label htmlFor={sokId} className="m-0 mb-2 block text-meta font-medium text-ink-secondary">
        {t.rubrik}
      </label>
      <input
        id={sokId}
        type="search"
        value={fraga}
        disabled={disabled}
        onChange={(e) => setFraga(e.target.value)}
        placeholder={t.sokIkonPlatshallare}
        aria-label={t.sokIkon}
        autoComplete="off"
        className="mb-2 min-h-11 w-full rounded-base border-[1.5px] border-line bg-surface px-3 py-2 text-brod md:text-etikett text-ink placeholder:text-ink-muted hover:border-line-strong focus-visible:border-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      />
      <p className="sr-only" role="status" aria-live="polite" data-ikonstatus="">
        {fraga.trim() ? (traffar.length > 0 ? t.traffarStatus.replace("{n}", String(traffar.length)) : t.ingetMatchar) : ""}
      </p>
      <div className="flex flex-col gap-2">
        {fraga.trim() ? (
          rad({ id: "traffar", rubrik: `${t.traffar} (${traffar.length})`, namn: traffar.slice(0, 48), tomText: t.ingaTraffar.replace("{fraga}", fraga.trim()) })
        ) : (
          <>
            {medForslag ? rad({ id: "forslag", rubrik: t.forslagUrNamn, namn: forslag, tomText: String(namn).trim() ? t.forslagInga : t.forslagSkrivNamn }) : null}
            {rad({ id: "senaste", rubrik: t.senastAnvanda, namn: senaste, tomText: t.senastInga })}
            {rad({ id: "vanliga", rubrik: t.vanliga, namn: VANLIGA_GRUPPIKONER, tomText: "", medInitialer: true })}
          </>
        )}
      </div>
    </div>
  );
}

/** Väljarens ord. Gruppformuläret skickar sina egna (`t`) för det som skiljer sig, till exempel rubriken "Ikon eller initialer". */
export const ORD_IKONVALJARE = {
  rubrik: { sv: "Ikon", en: "Icon" },
  sokIkon: { sv: "Sök ikon", en: "Search icons" },
  sokIkonPlatshallare: { sv: "Musik, fotboll, kontor ...", en: "Music, football, office ..." },
  forslagUrNamn: { sv: "Förslag ur namnet", en: "Suggested from the name" },
  forslagInga: { sv: "Namnet ger inga förslag. Sök eller välj bland de vanliga.", en: "The name gives no suggestions. Search or pick a common one." },
  forslagSkrivNamn: { sv: "Skriv ett namn så föreslås ikoner som passar.", en: "Type a name to get matching icons." },
  senastAnvanda: { sv: "Senast använda", en: "Recently used" },
  senastInga: { sv: "Inga ännu.", en: "None yet." },
  vanliga: { sv: "Vanliga", en: "Common" },
  traffar: { sv: "Träffar", en: "Matches" },
  traffarStatus: { sv: "{n} träffar", en: "{n} matches" },
  ingetMatchar: { sv: "Inget matchar", en: "Nothing matches" },
  ingaTraffar: { sv: "Inga ikoner matchar \"{fraga}\".", en: "No icons match \"{fraga}\"." },
};
