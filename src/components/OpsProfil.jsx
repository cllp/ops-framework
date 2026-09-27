import { useState } from "react";
import { SPRAK, text } from "../lib/sprak.js";
import { TEMAN } from "../lib/grupp.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField } from "./OpsField.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { OpsView, OpsViewHeader } from "./OpsView.jsx";

/**
 * Profilvyn: vem du är, hur du vill ha det, och vilka grupper du är med i.
 *
 * ══ ⛔ VARFÖR DEN LIGGER I RAMVERKET (#138) ════════════════════════════
 *
 * CP 2026-09-27: "finns ingen profil nu, och ingen logout." Varje app som
 * bygger sin egen ger den som loggar in i två appar två sorters profil, på två
 * ställen, med två ord för samma sak.
 *
 * ══ ⛔ SPRÅK OCH TEMA SPARAS I DATABASEN, INTE BARA I WEBBLÄSAREN ═════
 *
 * `localStorage` följer enheten, inte personen. Byter du till mörkt läge på
 * telefonen och öppnar datorn är den ljus, och det ser ut som att appen inte
 * minns. Raden i `users/{uid}` följer personen.
 *
 * ⛔ TEMAT SKRIVS ÄNDÅ TILL WEBBLÄSAREN FÖRST, via `onTema`. Väntar vyn på ett
 * svar från databasen innan färgen ändras känns knappen trasig, och en
 * inställning som svarar långsamt slutar man använda.
 *
 * ══ ⛔ VAD SOM INTE GÅR ATT ÄNDRA HÄR, OCH VARFÖR ═════════════════════
 *
 * E-posten är identiteten och kommer ur inloggningen. Namnet och bilden med
 * den: en ändring som skrivs över nästa gång man loggar in är värre än ingen
 * ändring, eftersom ingen säger till. Radering av konto finns inte heller, och
 * det är ett eget beslut med egna följder (vad händer med `skapadAv` på alla
 * rader personen skrivit).
 *
 * ══ ⛔ VYN SKRIVER INTE SJÄLV ══════════════════════════════════════════
 *
 * `onSpara` kommer utifrån, precis som i `OpsKatalogInstallning`. En komponent
 * som skriver till en databas går inte att prova utan en.
 *
 * @param {object} props
 * @param {import("../lib/grupp.js").Anvandare} props.anvandare
 * @param {{ grupp: { id: string, namn: any }, roll: string }[]} [props.grupper] Mina grupper, med roll i var och en.
 * @param {(andring: { sprak?: string, tema?: string }) => void | Promise<void>} props.onSpara
 * @param {(tema: string) => void} [props.onTema] Kallas direkt vid temabyte, innan sparandet. Se noten ovan.
 * @param {() => void} [props.onLoggaUt]
 * @param {string} [props.sprak] Språket VYN ritas på. Skilt från personens valda språk, som är det hon ändrar.
 * @param {string} [props.rubrik]
 * @param {string} [props.epostEtikett]
 * @param {string} [props.sprakEtikett]
 * @param {string} [props.temaEtikett]
 * @param {string} [props.grupperEtikett]
 * @param {string} [props.sparaEtikett]
 * @param {string} [props.loggaUtEtikett]
 * @param {string} [props.ingaGrupperText]
 * @param {Record<string, string>} [props.sprakNamn] Vad språken heter i väljaren.
 * @param {Record<string, string>} [props.temaNamn] Vad temana heter i väljaren.
 * @param {Record<string, string>} [props.rollNamn] Vad rollerna heter på raden.
 */
export function OpsProfil({
  anvandare,
  grupper = [],
  onSpara,
  onTema,
  onLoggaUt,
  sprak = "sv",
  rubrik = "Profil",
  epostEtikett = "E-post",
  sprakEtikett = "Språk",
  temaEtikett = "Utseende",
  grupperEtikett = "Mina grupper",
  sparaEtikett = "Spara",
  loggaUtEtikett = "Logga ut",
  ingaGrupperText = "Du är inte med i någon grupp än.",
  sprakNamn = { sv: "Svenska", en: "Engelska" },
  temaNamn = { system: "Följ enheten", ljust: "Ljust", morkt: "Mörkt" },
  rollNamn = { agare: "Ägare", medlem: "Medlem" },
}) {
  const [valtSprak, setValtSprak] = useState(anvandare.sprak);
  const [valtTema, setValtTema] = useState(anvandare.tema);
  const [sparar, setSparar] = useState(false);

  const andrat = valtSprak !== anvandare.sprak || valtTema !== anvandare.tema;

  const byteTema = (/** @type {string} */ v) => {
    setValtTema(/** @type {any} */ (v));
    // ⛔ Direkt, se noten i filhuvudet. Sparandet följer när man trycker Spara.
    if (onTema) onTema(v);
  };

  const spara = async () => {
    setSparar(true);
    try {
      await onSpara({ sprak: valtSprak, tema: valtTema });
    } finally {
      setSparar(false);
    }
  };

  return (
    <OpsView>
      <OpsViewHeader title={rubrik} />

      <div className="flex items-center gap-3">
        <OpsIdentity name={anvandare.namn || anvandare.epost} seed={anvandare.id} imageUrl={anvandare.bild} size="lg" />
        <div className="min-w-0">
          {/* ⛔ Namnet kan saknas: en inloggning utan visningsnamn är vanlig.
              Då står e-posten där i stället, aldrig en tom rad. */}
          <p className="truncate font-semibold text-ink">{anvandare.namn || anvandare.epost}</p>
          <p className="truncate text-sm text-ink-secondary">
            <span className="sr-only">{epostEtikett}: </span>
            {anvandare.epost}
          </p>
        </div>
      </div>

      <OpsField label={sprakEtikett}>
        <OpsSelect
          options={SPRAK.map((s) => ({ value: s, label: sprakNamn[s] || s }))}
          value={valtSprak}
          onChange={(v) => setValtSprak(v)}
        />
      </OpsField>

      <OpsField label={temaEtikett}>
        <OpsSelect options={TEMAN.map((t) => ({ value: t, label: temaNamn[t] || t }))} value={valtTema} onChange={byteTema} />
      </OpsField>

      <div className="flex flex-wrap gap-2">
        <OpsButton variant="primary" onClick={spara} disabled={!andrat} busy={sparar}>
          {sparaEtikett}
        </OpsButton>
        {onLoggaUt ? (
          <OpsButton variant="secondary" onClick={onLoggaUt}>
            {loggaUtEtikett}
          </OpsButton>
        ) : null}
      </div>

      {/* ⛔ TOMHET ÄR ETT SVAR. En person utan grupper ser en mening om det,
          aldrig en rubrik med ingenting under. Arbetsreglernas punkt 5. */}
      <p className="text-sm font-semibold uppercase tracking-wide text-ink-secondary">{grupperEtikett}</p>
      <OpsList ariaLabel={grupperEtikett}>
        {grupper.length === 0 ? (
          <OpsListRow>
            <span className="text-ink-secondary">{ingaGrupperText}</span>
          </OpsListRow>
        ) : (
          grupper.map(({ grupp, roll }) => (
            <OpsListRow key={grupp.id}>
              <span className="min-w-0 flex-1 truncate text-ink">{text(grupp.namn, sprak) || grupp.id}</span>
              <OpsPill tone={roll === "agare" ? "info" : "neutral"}>{rollNamn[roll] || roll}</OpsPill>
            </OpsListRow>
          ))
        )}
      </OpsList>
    </OpsView>
  );
}
