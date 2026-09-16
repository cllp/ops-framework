import { cx } from "../lib/cx.js";

/**
 * Tillförlitlighet: hur sann är den här siffran?
 *
 * ⛔ Det är INTE samma fråga som `OpsProvenance` svarar på. Proveniens säger vem
 * som producerade något, människa, agent eller automatik. Den här säger om det
 * går att lita på. En agent kan skriva en uppmätt siffra och en människa kan
 * gissa, så de två går inte att härleda ur varandra och får inte slås ihop.
 *
 * ── ⛔ VARFÖR DEN FINNS ─────────────────────────────────────────────────────
 *
 * Utan den här skillnaden ser fyra olika saker likadana ut på skärmen. Mätt i
 * bolag-ops: en pensionsprognos ligger visuellt bredvid faktiskt kassaflöde, ett
 * månadssnitt av en rörlig kostnad ser ut som ett bokfört belopp, och
 * "Företag 0 kr tillgångar" går inte att skilja från "vi vet inte".
 *
 * Det sista är det farliga. **Noll och okänt är motsatser som ser likadana ut**,
 * och den som läser har ingen anledning att misstro siffran.
 *
 * ── ⛔ MÄRK DÄR BLANDNINGEN SKER, INTE ÖVERALLT ────────────────────────────
 *
 * Är allt på en sida märkt är inget märkt. Märkningen blir mönstrad tapet och
 * ögat slutar se den, vilket är precis det den skulle motverka.
 *
 * Regeln är: märk på den nivå där olika sorters siffror möts. Är en hel tabell
 * uppmätt hör märket på tabellen, en gång, inte på varje rad. Ligger ett
 * scenario bland verkliga belopp hör märket på scenariot.
 *
 * Därav att `uppmatt` är den tystaste tonen av de fyra: den är normalfallet och
 * ska inte skrika.
 *
 * ── ⛔ ORDET SKRIVS ALLTID UT ───────────────────────────────────────────────
 *
 * Aldrig bara en färg. Samma regel som för identitet och proveniens: en färgad
 * prick går inte att läsa upp, säger ingenting till den som inte redan lärt sig
 * koden, och var tjugonde man ser inte skillnad på två av färgerna.
 */

const SLAG = {
  uppmatt: { klass: "bg-fact-uppmatt-bg text-fact-uppmatt", text: "Uppmätt" },
  uppskattat: { klass: "bg-fact-uppskattat-bg text-fact-uppskattat", text: "Uppskattat" },
  okant: { klass: "bg-fact-okant-bg text-fact-okant", text: "Okänt" },
  scenario: { klass: "bg-fact-scenario-bg text-fact-scenario", text: "Scenario" },
};

/**
 * @param {object} props
 * @param {"uppmatt"|"uppskattat"|"okant"|"scenario"} props.kind
 * @param {string} [props.label] Egen text i stället för standardordet, t.ex. "Snitt 12 mån" eller "Vid 3 % avkastning".
 * @param {string} [props.value] Siffran märket gäller, när märket bär den själv. ⛔ Aldrig tillsammans med `okant`.
 */
export function OpsFact({ kind, label, value }) {
  const s = SLAG[kind];
  if (!s) {
    throw new Error(`OpsFact: okänt kind "${kind}". Giltiga: ${Object.keys(SLAG).join(", ")}.`);
  }

  // ⛔ Okänt med ett värde är hela poängen upp och ner. Skriver någon
  // `<OpsFact kind="okant" value="0 kr" />` påstår märket samtidigt att vi inte
  // vet och att svaret är noll, och läsaren tror på siffran. Det är exakt det
  // fel komponenten finns för att stoppa, så den kastar i stället för att
  // rendera något som ser rimligt ut.
  if (kind === "okant" && value != null && value !== "") {
    throw new Error(
      'OpsFact: kind="okant" kan inte ha ett value. Vet vi siffran är den inte okänd, och vet vi den inte ska rutan vara tom. Noll och okänt är motsatser och får aldrig se likadana ut.',
    );
  }

  const text = label ?? s.text;

  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold leading-tight", s.klass)}>
      {value != null && value !== "" ? (
        <>
          <span className="tabular-nums">{value}</span>
          {/* Avdelaren är dekor. Skärmläsaren läser "1 200 kr Uppskattat", och
              en punkt däremellan skulle bli ett uppläst skiljetecken. */}
          <span aria-hidden="true" className="opacity-50">
            ·
          </span>
        </>
      ) : null}
      {text}
    </span>
  );
}
