import { useId } from "react";
import { cx } from "../lib/cx.js";
import { AgentIkon, BockIkon, GruppIkon } from "./icons.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { usePersonnamn } from "./usePersonnamn.js";

/**
 * Mottagarväljaren: Till gruppen, en person i gruppen eller agenten (0.34.0, #182 F1).
 *
 * ══ ⛔ EN VÄLJARE FÖR ÄRENDEN OCH MEDDELANDEN ═══════════════════════════════════════════════════════
 *
 * CP 2026-09-30 08:12: "Skall kunna välja i grupp och vem i gruppen (optional) den är adresserad till." Samma val finns
 * på två ställen: ett ärende (mottagaren valfri, förval gruppen, personen syns för hela gruppen) och ett meddelande
 * (mottagaren krävs och är en person, och meddelandet är privat). Två väljare hade varit två listor av samma medlemmar,
 * med två uppfattningar om vilka som går att välja. Här är det EN, med `lage`:
 *
 *   - `lage="arende"`: Gruppen (förval), varje aktiv person, och Agenten när gruppen har en medlem av typen `agent`.
 *   - `lage="person"`: aktiva personer utom en själv, och gruppens agent när den är aktiv (lifehub.app#47). Det är
 *     meddelandets läge: ett privat samtal med sig själv finns inte, ett med agenten är ett samtal av slaget `agent`.
 *     En avstängd agent står inte med, den svarar inte.
 *
 * ⛔ PERSONERNA KOMMER UR GRUPPENS MEDLEMSKAP, med namn och bild denormaliserade där (#138). Profilerna (`users`) läses
 * bara av personen själv, så en lista som byggde på dem hade varit tom för alla andra.
 *
 * ⛔ EN RADIOGRUPP, INTE EN RULLGARDIN. SS väljer mottagare i en lista med avatarer (`DMPanel.jsx:238`, "Nytt
 * meddelande"), och en grupp har sällan fler än ett tjugotal. En rullgardin döljer vem man väljer mellan.
 *
 * Värdet har formen `byggMottagare` prövar: `{ slag: "grupp" } | { slag: "person", uid } | { slag: "agent", uid? }`.
 *
 * @param {object} props
 * @param {"arende" | "person"} [props.lage] Förval `"arende"`.
 * @param {ReadonlyArray<{ userId: string, namn?: string, bild?: string, typ?: string, status?: string }>} props.medlemmar Gruppens medlemskap.
 * @param {string} [props.uid] Den inloggade. I personläget visas hen inte, i ärendeläget märks hen med `duEtikett`.
 * @param {import("../lib/samtal.js").Mottagare | null} props.value
 * @param {(m: import("../lib/samtal.js").Mottagare) => void} props.onChange
 * @param {string} [props.gruppNamn] Namnet på raden Gruppen. Förval "Gruppen".
 * @param {string} [props.agentNamn] Förval "Agenten".
 * @param {string} [props.duEtikett] Förval "du".
 * @param {string} [props.ariaLabel] Förval "Till".
 * @param {string} [props.helaGruppen] (0.68.0) I `lage="person"`: en rad överst med den här etiketten, värdet `{ slag: "grupp" }`.
 *   Meddelandets läge använder den för gruppchatten. Utan den har läget ingen grupprad, som förut.
 * @param {import("react").ReactNode} [props.gruppMarke] (0.68.0) Gruppradens märke. Meddelanden skickar samma märke som
 *   gruppchattens rad i listan, så att "Hela gruppen" har gruppens färg och ikon och inte en egen (omgranskningen av PR 268, A6).
 *   Utan den ritas ett märke ur etiketten.
 * @param {string} [props.tomText] När det inte finns någon att välja. Förval "Det finns ingen annan i gruppen att skriva till."
 */
export function OpsMottagare({
  lage = "arende",
  medlemmar,
  uid,
  value,
  onChange,
  gruppNamn = "Gruppen",
  agentNamn = "Agenten",
  duEtikett = "du",
  ariaLabel = "Till",
  tomText = "Det finns ingen annan i gruppen att skriva till.",
  helaGruppen,
  gruppMarke,
}) {
  const namnId = useId();
  const personnamn = usePersonnamn();
  const aktiva = (medlemmar ?? []).filter((m) => m && m.userId && (m.status ?? "aktiv") === "aktiv");
  const personer = aktiva
    .filter((m) => (m.typ ?? "person") === "person" && (lage === "arende" || m.userId !== uid))
    .sort((a, b) => personnamn(a.namn, a.userId).text.localeCompare(personnamn(b.namn, b.userId).text, "sv"));
  const agent = aktiva.find((m) => m.typ === "agent");

  /** @type {Array<{ nyckel: string, varde: import("../lib/samtal.js").Mottagare, namn: string, saknas?: boolean, ikon: import("react").ReactNode }>} */
  const rader = [];
  if (lage === "person" && helaGruppen) {
    rader.push({ nyckel: "grupp", varde: { slag: "grupp" }, namn: helaGruppen, ikon: gruppMarke ?? <OpsIdentity name={helaGruppen} seed="grupp" size="sm" icon={GruppIkon} /> });
  }
  if (lage === "arende") {
    rader.push({ nyckel: "grupp", varde: { slag: "grupp" }, namn: gruppNamn, ikon: <OpsIdentity name={gruppNamn} seed="grupp" size="sm" icon={GruppIkon} /> });
  }
  for (const p of personer) {
    /*
     * ⛔ ALDRIG ETT ID SOM NAMN (#218). CP 2026-10-01: raden stod som `eA2ILzNei5TQ2rcHy68aBZPpR1B3 (du)`. Medlemskapets namn
     * först, den inloggades eget namn ur inloggningen om raden är hens, annars "Namn saknas" (märkt med `data-namn-saknas`).
     */
    const { text: namn, saknas } = personnamn(p.namn, p.userId);
    rader.push({
      nyckel: `person:${p.userId}`,
      varde: { slag: "person", uid: p.userId },
      namn: p.userId === uid ? `${namn} (${duEtikett})` : namn,
      saknas,
      ikon: <OpsIdentity name={namn} seed={p.userId} imageUrl={p.bild || undefined} size="sm" rund />,
    });
  }
  if (agent) {
    rader.push({ nyckel: "agent", varde: { slag: "agent", uid: agent.userId }, namn: agent.namn || agentNamn, ikon: <OpsIdentity name={agentNamn} seed={agent.userId} size="sm" icon={AgentIkon} rund /> });
  }

  const vald = value ? (value.slag === "person" ? `person:${value.uid}` : value.slag) : null;

  if (rader.length === 0) {
    return <p className="m-0 text-etikett text-ink-secondary">{tomText}</p>;
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} id={namnId} className="flex flex-col gap-0.5">
      {rader.map((r) => {
        const ar = vald === r.nyckel;
        return (
          <button
            key={r.nyckel}
            type="button"
            role="radio"
            aria-checked={ar}
            onClick={() => onChange(r.varde)}
            className={cx(
              "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-base px-2 py-1.5 text-left text-etikett transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              ar ? "bg-accent-faint font-semibold text-ink" : "text-ink hover:bg-raised",
            )}
          >
            {/* ⛔ Märket är dekor här: namnet står bredvid, och ett märke med eget namn hade läst upp det två gånger. */}
            <span aria-hidden="true" className="inline-flex shrink-0">
              {r.ikon}
            </span>
            <span className="min-w-0 flex-1 truncate" data-namn-saknas={r.saknas ? "" : undefined}>
              {r.namn}
            </span>
            {ar ? (
              <span className="shrink-0 text-accent">
                <BockIkon size={16} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
