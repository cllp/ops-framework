import { useKallor } from "../data/useKallor.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { OpsStatusDot } from "./OpsStatusDot.jsx";

/**
 * Notispanelen: modulernas poster för en grupp, med läsmärke per person.
 *
 * ══ ⛔ LÄSMÄRKET ÄR RAMVERKETS DATA, INTE MODULENS (#141) ══════════════
 *
 * Vem som läst vad hör till personen och inte till posten, precis som
 * `lasmarken` redan gör i bolag-ops. En modul som fick äga läsmärket hade
 * behövt känna till användarna, och då hade varje modul haft sin egen
 * uppfattning om vad "oläst" betyder.
 *
 * ⛔ DÄRFÖR SKICKAS `lasta` IN. Ramverket ritar, appen äger lagringen. Samma
 * delning som överallt annars: ramverket känner inte projekt-id eller
 * samlingsnamn.
 *
 * ⛔ RÄKNAREN RÄKNAR BARA DEN FRÅGADE GRUPPEN, och det följer av att källan
 * frågas per grupp. En grupp jag inte är med i frågas aldrig, alltså kan dess
 * poster inte komma in i räkningen. Det är kontraktets förtjänst och inte en
 * kontroll här, och därför finns ingen sådan kontroll: den hade varit ett
 * andra uttryck för samma regel.
 */

/** Ordningen posterna visas i. Brådskande först, och inom samma prio källans ordning. */
/** @type {Record<string, number>} */
const ORDNING = { hog: 0, normal: 1, lag: 2 };

/**
 * Olästa poster.
 *
 * ⛔ EN REN FUNKTION, av samma skäl som `andringen` i profilen: en räknare som
 * bara går att mäta genom att rita en panel är en räknare vars fel syns först
 * på skärmen.
 *
 * @param {ReadonlyArray<{ id: string }>} poster
 * @param {ReadonlyArray<string>} lasta
 */
export function olasta(poster, lasta) {
  const set = new Set(lasta ?? []);
  return (poster ?? []).filter((p) => !set.has(p.id));
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../lib/kallor.js").skapaKallregister> | null} props.register
 * @param {{ groupId: string }} props.fraga
 * @param {ReadonlyArray<string>} [props.lasta] Id på det jag redan läst. Appens data.
 * @param {(id: string) => void} [props.onLast]
 * @param {(href: string) => void} [props.onOppna]
 * @param {string} [props.ariaLabel]
 * @param {string} [props.tomText]
 * @param {Record<string, string>} [props.prioord] Orden för de tre prioriteterna. ⛔ Krävs som text: färgen får aldrig bära betydelsen ensam.
 */
export function OpsNotiser({ register, fraga, lasta = [], onLast, onOppna, ariaLabel = "Notiser", tomText = "Inget nytt.", prioord = { hog: "Brådskande", normal: "Normal", lag: "Kan vänta" } }) {
  const { rader, laddar, fel } = useKallor(register, "notiser", fraga);

  if (fel) return <OpsBanner tone="danger" title="Notiserna kunde inte hämtas">{fel.message}</OpsBanner>;
  if (laddar) return <OpsSpinner label="Hämtar notiser" />;
  if (rader.length === 0) return <OpsEmpty title={tomText} />;

  const lasteSet = new Set(lasta);
  const sorterade = [...rader].sort((a, b) => (ORDNING[a.prio] ?? 1) - (ORDNING[b.prio] ?? 1));

  return (
    <OpsList divided ariaLabel={ariaLabel}>
      {sorterade.map((n) => {
        const oläst = !lasteSet.has(n.id);
        return (
          <OpsListRow
            key={`${n.modulId}-${n.id}`}
            interactive={Boolean((n.href && onOppna) || onLast)}
            onClick={() => {
              /* ⛔ LÄSMÄRKET SÄTTS FÖRE NAVIGERINGEN. Går ordningen omvänt hinner
                 vyn bytas, och märket sätts på en panel som inte längre finns. */
              if (oläst && onLast) onLast(n.id);
              if (n.href && onOppna) onOppna(n.href);
            }}
          >
            {/* ⛔ Prickens betydelse står också i text, eftersom färg aldrig får
                vara den enda bäraren. */}
            <OpsStatusDot status={n.prio === "hog" ? "akut" : n.prio === "lag" ? "vantar" : "oppet"} label={prioord[n.prio] ?? prioord.normal} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate ${oläst ? "font-semibold text-ink" : "text-ink-secondary"}`}>{n.titel}</span>
              {n.text ? <span className="block truncate text-sm text-ink-secondary">{n.text}</span> : null}
            </span>
          </OpsListRow>
        );
      })}
    </OpsList>
  );
}
