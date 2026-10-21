import { useId, useState } from "react";
import { cx } from "../lib/cx.js";
import { KALENDERPRICK } from "../lib/kalenderfarg.js";
import { lagerFarg } from "../lib/kalenderlager.js";
import { radKlass, radRubrikKlass } from "../lib/radKlass.js";
import { ChevronNedIkon, KalenderIkon } from "./icons.jsx";
import { OpsSegmented } from "./OpsSegmented.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { ValRad } from "./ValRad.jsx";

/**
 * Listan Kalendrar (0.134.0, cllp/lifehub.app#402): EN rad per kalender med färgprick, namn, en `OpsSwitch` för om den syns, och en utfällning för
 * hur den visas (Händelser, Ram eller Båda).
 *
 * ══ ⛔ DEN ERSÄTTER "VISA BARA" OCH KALENDERLAGREN, INTE BARA KOMPLETTERAR DEM ═══════════════════════════════════════
 *
 * Till 0.133.0 betydde ett tryck på en kalender i väljaren "visa bara den", och valet sparades inte alls. Samtidigt matade appen in samma
 * Apple-kalender en andra gång som ett LAGER, med ett eget val som sparades någon annanstans. CP 2026-10-20: "Kaka på kaka. Det är allvarliga
 * saker som skall fixas." Nu är varje kalender en rad, raden har en växel, och växeln är det enda som avgör om kalendern syns. Ett tryck
 * på en rad slår AV den (och på igen), aldrig "visa bara denna".
 *
 * ⛔ INGA RÅA KRYSSRUTOR. Växeln är `OpsSwitch` (`placering="rad"`), samma som resten av ramverkets inställningsrader: hela raden är träffytan.
 *
 * ⛔ RAMVERKET KÄNNER INGA SEKTIONER. Appen skickar `sektion` per kalender ("Gruppens kalendrar", "Mina kalendrar", "Från Mitt konto", "Ärenden"), och
 * ordningen är raderna första uppträdande, utom att gruppens kommer före mina när appen inte skickat `sektioner`. En sektion utan rader ritas bara
 * om appen gett den en `tomText` (arbetsreglernas punkt 5: tomt är ett svar), och aldrig som en rubrik utan något under.
 *
 * @param {object} props
 * @param {ReadonlyArray<import("./OpsCalendar.jsx").KalenderVal>} props.kalendrar
 * @param {ReturnType<typeof import("../lib/useKalenderSynlighet.js").useKalenderSynlighet>} props.syn
 * @param {ReadonlyArray<{ namn: string, tomText?: string }>} [props.sektioner] Ordningen och tomtexterna. Utan den: gruppens, mina, resten.
 * @param {import("react").ReactNode} [props.efter] Raden Hantera kalendrar.
 */
export function OpsKalenderLista({ kalendrar, syn, sektioner, efter }) {
  const [oppen, setOppen] = useState(/** @type {string | null} */ (null));
  const grupper = sektionerFor(kalendrar, sektioner);
  return (
    <div data-kalenderlista="" className="flex flex-col">
      <ValRad chosen={syn.arForval} onClick={syn.aterstall} ikon={<KalenderIkon size={16} />}>
        Alla kalendrar
      </ValRad>
      {grupper.map((g) => (
        <div key={g.namn} role="group" aria-label={g.namn} data-kalendersektion={g.namn} className="mt-2 flex flex-col">
          <p className={radRubrikKlass}>{g.namn}</p>
          {g.rader.length > 0 ? (
            g.rader.map((k) => <Kalenderrad key={k.id} k={k} syn={syn} oppen={oppen === k.id} onOppna={() => setOppen((o) => (o === k.id ? null : k.id))} />)
          ) : (
            <p data-kalendersektion-tom="" className="m-0 px-3 py-1.5 text-meta text-ink-muted">
              {g.tomText}
            </p>
          )}
        </div>
      ))}
      {efter}
    </div>
  );
}

/** Namnen på visningarna, i den ordning de står i väljaren. */
const VISNINGSORD = /** @type {const} */ ({ handelser: "Händelser", ram: "Ram", bada: "Båda" });

/**
 * @param {object} props
 * @param {import("./OpsCalendar.jsx").KalenderVal} props.k
 * @param {ReturnType<typeof import("../lib/useKalenderSynlighet.js").useKalenderSynlighet>} props.syn
 * @param {boolean} props.oppen
 * @param {() => void} props.onOppna
 */
function Kalenderrad({ k, syn, oppen, onOppna }) {
  const id = useId();
  const syns = syn.arSynlig(k.id);
  const visning = syn.visning(k.id);
  return (
    <div data-kalenderrad={k.id} data-syns={syns ? "ja" : "nej"} data-visning={visning} className="flex flex-col">
      <OpsSwitch
        placering="rad"
        label={k.namn}
        hint={k.marke || undefined}
        checked={syns}
        onChange={() => syn.vaxla(k.id)}
        ikon={<span data-kalenderprick={lagerFarg(k)} className={cx("block size-2.5 rounded-full", KALENDERPRICK[lagerFarg(k)])} />}
      />
      {/* ⛔ VISNINGEN FINNS BARA FÖR EN KALENDER SOM SYNS. Hur en dold kalender skulle visas är ingen fråga någon ställer, och en rad per kalender
          med ett val under hade gjort listan dubbelt så hög på en telefon. Ordet står kvar på knappen, så att valet syns utan att fällas ut. */}
      {syns ? (
        <div className="flex flex-col gap-1.5 pr-3 pb-1.5 pl-9">
          <button
            type="button"
            data-kalendervisning-knapp=""
            aria-expanded={oppen}
            aria-controls={`${id}-visning`}
            onClick={onOppna}
            className={cx(radKlass({ klickbar: true }), "min-h-8 w-auto self-start px-2 py-1 text-etikett text-ink-muted md:min-h-0")}
          >
            <span>
              Visas som <span className="font-semibold text-ink-secondary">{VISNINGSORD[visning]}</span>
            </span>
            <span aria-hidden="true" className={cx("flex shrink-0 transition-transform duration-(--duration-fast) ease-standard", oppen && "rotate-180")}>
              <ChevronNedIkon size={12} />
            </span>
          </button>
          <div id={`${id}-visning`} hidden={!oppen}>
            {oppen ? (
              <OpsSegmented
                ariaLabel={`Visning för ${k.namn}`}
                value={visning}
                onChange={(v) => syn.valjVisning(k.id, v)}
                options={[
                  { value: "handelser", label: VISNINGSORD.handelser },
                  { value: "ram", label: VISNINGSORD.ram },
                  { value: "bada", label: VISNINGSORD.bada },
                ]}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const GRUPPENS = "Gruppens kalendrar";
const MINA = "Mina kalendrar";
const MINA_TOM = "Du har inga egna kalendrar ännu.";

/**
 * Sektionerna i den ordning de ritas.
 * @param {ReadonlyArray<import("./OpsCalendar.jsx").KalenderVal>} kalendrar
 * @param {ReadonlyArray<{ namn: string, tomText?: string }> | undefined} deklarerade
 * @returns {{ namn: string, tomText?: string, rader: import("./OpsCalendar.jsx").KalenderVal[] }[]}
 */
function sektionerFor(kalendrar, deklarerade) {
  /** @param {import("./OpsCalendar.jsx").KalenderVal} k */
  const namnPa = (k) => (typeof k.sektion === "string" && k.sektion.trim() ? k.sektion.trim() : k.grupp ? GRUPPENS : MINA);
  /** @type {Map<string, { namn: string, tomText?: string, rader: import("./OpsCalendar.jsx").KalenderVal[] }>} */
  const karta = new Map();
  // Utan deklarerade sektioner är det de två gamla som gäller: gruppens (bara med rader) och mina (alltid, med sin tomrad).
  const start = deklarerade ?? [{ namn: GRUPPENS }, { namn: MINA, tomText: MINA_TOM }];
  for (const s of start) if (s && typeof s.namn === "string" && s.namn && !karta.has(s.namn)) karta.set(s.namn, { namn: s.namn, tomText: s.tomText, rader: [] });
  for (const k of kalendrar) {
    const namn = namnPa(k);
    if (!karta.has(namn)) karta.set(namn, { namn, rader: [] });
    karta.get(namn)?.rader.push(k);
  }
  return [...karta.values()].filter((s) => s.rader.length > 0 || Boolean(s.tomText));
}
