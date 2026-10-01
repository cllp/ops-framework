import { cx } from "../lib/cx.js";
import { formatDagOchKlockslag } from "../lib/format.js";
import { laesSkapare } from "../lib/skapare.js";
import { OpsProvenance } from "./OpsProvenance.jsx";

/**
 * Raden "Skapad av Namn, 29 sep 09:12, i Ekonomi" under en händelses titel, i listan och i händelsepanelen (0.43.0, #224).
 *
 * ══ ⛔ ETT STÄLLE FÖR RADEN ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-01: "Vem skapade händelsen och var hör den hemma." Svaret ska stå i listan OCH i panelen (CP: "ja på båda"), och två
 * ritningar av samma rad hade sagt olika saker efter första ändringen. `OpsEventList` och `OpsHandelsePanel` ritar båda den här.
 *
 * ⛔ VEM OCH NÄR RITAS BARA NÄR BÅDA FINNS, som sedan 0.30.0: ett namn utan tid eller en tid utan namn är en halv rad, och en halv rad
 * läses som att resten inte laddat klart. URSPRUNGET står ensamt när det saknas en skapare: "Från Ekonomi".
 *
 * ⛔ URSPRUNGET ÄR APPENS ORD, HÄRLETT UR TYPEN. `typensUrsprung(typenForRad(...))` ger `{ modul }`; appen lägger till en `url` när det
 * finns något att trycka sig tillbaka till (kvittot i Ekonomi). Länken är appens, eftersom bara appen vet var posten bor.
 *
 * @typedef {object} Ursprung
 * @property {string} modul Modulens namn i appens språk, till exempel "Ekonomi". ⛔ Krävs och får inte vara tomt.
 * @property {string} [url] Vart ett tryck på modulnamnet leder: posten i modulen som händelsen kom ur.
 * @property {string} [urlEtikett] Länkens namn för skärmläsaren, till exempel "Öppna kvittot i Ekonomi". Utan den är namnet modulens.
 */

const URSPRUNGSFALT = ["modul", "url", "urlEtikett"];

/**
 * Kastar för ett ursprung som inte går att rita. Ett tomt modulnamn hade gett raden "Från " och inget mer.
 *
 * @param {unknown} u
 * @param {string} komponent
 * @returns {Ursprung}
 */
export function kontrolleraUrsprung(u, komponent) {
  if (!u || typeof u !== "object" || Array.isArray(u)) {
    throw new Error(`${komponent}: ursprung måste vara ett objekt { modul, url?, urlEtikett? }.`);
  }
  const rad = /** @type {Record<string, unknown>} */ (u);
  const okanda = Object.keys(rad).filter((k) => !URSPRUNGSFALT.includes(k));
  if (okanda.length > 0) {
    throw new Error(`${komponent}: ursprung bär okända fält (${okanda.join(", ")}). Fälten är ${URSPRUNGSFALT.join(", ")}.`);
  }
  if (typeof rad.modul !== "string" || rad.modul.trim() === "") {
    throw new Error(`${komponent}: ursprung.modul krävs och får inte vara tomt. En rad som säger "Från" och inget mer är sämre än ingen rad.`);
  }
  if (rad.url !== undefined && (typeof rad.url !== "string" || rad.url.trim() === "")) {
    throw new Error(`${komponent}: ursprung.url måste vara en adress, eller utelämnas. En tom länk är en död länk.`);
  }
  if (rad.urlEtikett !== undefined && typeof rad.urlEtikett !== "string") {
    throw new Error(`${komponent}: ursprung.urlEtikett måste vara text, eller utelämnas.`);
  }
  return /** @type {Ursprung} */ (u);
}

/**
 * @param {object} props
 * @param {unknown} [props.skapadAv]
 * @param {string} [props.skapad]
 * @param {Ursprung} [props.ursprung]
 * @param {string} props.skapadAvEtikett "Skapad av".
 * @param {string} props.iModulEtikett Ordet före modulen efter en skapare: "i".
 * @param {string} props.franModulEtikett Ordet före modulen utan skapare: "Från".
 * @param {string} props.sprak
 * @param {(href: string, event: any) => void} [props.onNavigate] Som listans: anropas i stället för webbläsarens navigering.
 * @param {string} props.komponent Namnet i felmeddelandet.
 */
export function Ursprungsrad({ skapadAv, skapad, ursprung, skapadAvEtikett, iModulEtikett, franModulEtikett, sprak, onNavigate, komponent }) {
  const u = ursprung === undefined ? null : kontrolleraUrsprung(ursprung, komponent);
  const skapare = skapadAv && skapad ? laesSkapare(skapadAv) : null;
  const vem = skapare && skapare.namn ? `${skapadAvEtikett} ${skapare.namn}, ${formatDagOchKlockslag(/** @type {string} */ (skapad), { locale: sprak })}` : null;
  if (!vem && !u) return null;

  const modul = u ? (
    u.url ? (
      <a
        href={u.url}
        onClick={(e) => onNavigate?.(/** @type {string} */ (u.url), e)}
        aria-label={u.urlEtikett || undefined}
        data-ursprungslank=""
        className={cx(
          "relative z-10 rounded-sm font-medium text-accent underline underline-offset-2 hover:no-underline",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        {u.modul}
      </a>
    ) : (
      <span className="font-medium text-ink-secondary">{u.modul}</span>
    )
  ) : null;

  if (!vem) {
    return (
      <span data-ursprungsrad="" className="mt-0.5 text-hjalp text-ink-muted">
        {franModulEtikett} {modul}
      </span>
    );
  }
  // ⛔ EN MÄNNISKA OCH EN AGENT SER OLIKA UT (`OpsProvenance`: agentens robot och ordet för skärmläsaren). En okänd sorts skapare (`okand`,
  // äldre rader) är vanlig text och inte en påhittad roll.
  if (skapare && (skapare.typ === "manniska" || skapare.typ === "agent")) {
    return (
      <span data-ursprungsrad="" className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <OpsProvenance kind={skapare.typ === "agent" ? "agent" : "human"} label={vem} />
        {modul ? (
          <span className="text-hjalp text-ink-muted">
            {iModulEtikett} {modul}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span data-ursprungsrad="" className="mt-0.5 text-hjalp text-ink-muted">
      {modul ? (
        <>
          {vem}, {iModulEtikett} {modul}
        </>
      ) : (
        vem
      )}
    </span>
  );
}
