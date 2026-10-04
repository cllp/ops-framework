import { useId, useState } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import { slagPrick } from "../lib/slag.js";
import { MAX_TYPNAMN, typmarke } from "../lib/modultyper.js";
import { text } from "../lib/sprak.js";
import { cx } from "../lib/cx.js";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { AndraIkon, ArkiveraIkon, TaFramIkon } from "./icons.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsPill } from "./OpsPill.jsx";

const rensa = (/** @type {unknown} */ v) => (typeof v === "string" ? v.trim() : "");

/**
 * Typerna modulerna bidrar med, i gruppens inställningar (0.42.0, #217).
 *
 * ══ ⛔ VAD VYN ÄR OCH INTE ÄR ═══════════════════════════════════════════════════
 *
 * Gruppens egna kategorier ändras i `OpsKatalogInstallning`. Det här är den ANDRA listan:
 * det modulerna lagt till av sig själva, märkt «från Ekonomi» så den inte förväxlas med en
 * fri kategori (tydlighetsregeln i `lib/modultyper.js`). Ägaren kan DÖLJA ett bidrag eller
 * DÖPA OM det. Ägaren kan inte skapa ett: ett bidrag finns för att en modul lämnat det, och en
 * knapp för att lägga till ett modul-id vore en knapp för att hitta på en modul.
 *
 * ⛔ VYN SKRIVER INTE SJÄLV. `onAndra({ yta, id, dold, namn? })` får det ÖNSKADE tillståndet för ETT bidrag,
 * och appen lägger det i gruppens `typavvikelser` med `medAvvikelse` och sparar gruppen (som
 * `byggGrupp(rad, moduler)` kontrollerar mot de installerade modulerna). Samma form som
 * `onSpara`/`onArkivera` i `OpsKatalogInstallning`.
 *
 * ⛔ `kanAndra` ÄR EN ARTIGHET, INTE ETT SKYDD. Samma not som i `OpsKatalogInstallning`: låset är att
 * `typavvikelser` står i `AGARGRUPPFALT` och alltså bara går att skriva för gruppens ÄGARE, i reglerna.
 * Ge `kanAndra` ur ägarrollen och inte adminrollen.
 *
 * ⛔ TOMHET ÄR ETT SVAR (arbetsreglernas punkt 5). En grupp utan modulbidrag får en rad som säger det,
 * inte en sektion som försvinner.
 *
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/modultyper.js").Typval>} props.bidrag Ur `bidragForGrupp(yta, ...)`: bidragen från påslagna moduler, dolda med.
 * @param {import("../lib/modultyper.js").Typyta} props.yta Ytan bidragen gäller (`inkorg`, `kalender`, `handelser`, `aktivitet`). Skickas tillbaka i `onAndra`.
 * @param {(avvikelse: { yta: import("../lib/modultyper.js").Typyta, id: string, dold: boolean, namn?: { sv: string, en?: string } | null }) => void} [props.onAndra]
 * @param {boolean} [props.kanAndra] Sant för gruppens ägare.
 * @param {"sv" | "en"} [props.sprak]
 * @param {string} [props.rubrik]
 * @param {(ikon: string) => import("react").ReactNode} [props.ikonRitare] Ritar ett ikonnamn. Utan den visas inget (ikonen är valfri).
 */
export function OpsModulTyper({ bidrag, yta, onAndra, kanAndra = false, sprak: sprakProp, rubrik = "Typer från moduler", ikonRitare }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const rubrikId = useId();
  if (!Array.isArray(bidrag)) {
    throw new Error("OpsModulTyper: bidrag krävs och måste vara en lista, även när den är tom. Skicka resultatet av bidragForGrupp.");
  }
  if (typeof yta !== "string" || !yta) {
    throw new Error("OpsModulTyper: yta krävs (inkorg, kalender, handelser eller aktivitet). Den skickas tillbaka i onAndra, och en avvikelse utan yta vet inte vilken lista den gäller.");
  }
  const [redigerar, setRedigerar] = useState(/** @type {string | null} */ (null));
  const [sv, setSv] = useState("");
  const [en, setEn] = useState("");

  const oppna = (/** @type {import("../lib/modultyper.js").Typval} */ t) => {
    setRedigerar(t.id);
    setSv(t.omdopt ? text(t.namn, "sv") : "");
    setEn(t.omdopt ? t.namn.en || "" : "");
  };
  const spara = (/** @type {import("../lib/modultyper.js").Typval} */ t) => {
    const svNamn = rensa(sv);
    const enNamn = rensa(en);
    onAndra?.({ yta, id: t.id, dold: t.tillstand === "dold", namn: svNamn ? (enNamn ? { sv: svNamn, en: enNamn } : { sv: svNamn }) : null });
    setRedigerar(null);
  };

  const rad = (/** @type {import("../lib/modultyper.js").Typval} */ t) => (
    <OpsListRow key={t.id}>
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-3 gap-y-1 sm:basis-auto">
          {t.farg ? <span className={cx("size-2 shrink-0 rounded-full", slagPrick(t.farg, text(t.namn, sprak), "OpsModulTyper"))} aria-hidden="true" /> : null}
          <span className={cx("min-w-0 break-words text-etikett font-medium", t.tillstand === "dold" ? "text-ink-muted" : "text-ink")}>{text(t.namn, sprak)}</span>
          {t.ikon && ikonRitare ? <span className="min-w-0 break-all text-etikett text-ink-muted">{ikonRitare(t.ikon)}</span> : null}
          {/* ⛔ MÄRKET HÄRLEDS (`typmarke`) och skrivs aldrig om här: det är samma ord som valen i skapa-formulären bär. */}
          <OpsPill tone={t.tillstand === "dold" ? "warning" : "info"}>{typmarke(t, sprak)}</OpsPill>
        </div>
        {kanAndra && redigerar !== t.id ? (
          <span className="flex shrink-0 flex-wrap gap-2 sm:ms-auto">
            <OpsButton variant="ghost" onClick={() => oppna(t)}>
              <AndraIkon />
              Byt namn
            </OpsButton>
            <OpsButton variant="ghost" onClick={() => onAndra?.({ yta, id: t.id, dold: t.tillstand !== "dold", namn: t.omdopt ? t.namn : null })}>
              {t.tillstand === "dold" ? <TaFramIkon /> : <ArkiveraIkon />}
              {t.tillstand === "dold" ? "Visa" : "Dölj"}
            </OpsButton>
          </span>
        ) : null}
      </div>
      {kanAndra && redigerar === t.id ? (
        <div className="mt-3 flex flex-col gap-3">
          <OpsField label="Eget namn på svenska" hint={`Ersätter modulens namn «${text(t.namn, "sv")}» i den här gruppen. Lämna tomt för att gå tillbaka till modulens. Högst ${MAX_TYPNAMN} tecken.`}>
            <OpsInput value={sv} onChange={setSv} name="typnamn-sv" />
          </OpsField>
          <OpsField label="Eget namn på engelska">
            <OpsInput value={en} onChange={setEn} name="typnamn-en" />
          </OpsField>
          <div className="flex gap-2">
            <OpsButton variant="primary" onClick={() => spara(t)}>
              Spara
            </OpsButton>
            <OpsButton variant="ghost" onClick={() => setRedigerar(null)}>
              Avbryt
            </OpsButton>
          </div>
        </div>
      ) : null}
    </OpsListRow>
  );

  return (
    <section aria-labelledby={rubrikId} className="flex flex-col gap-3">
      {/* ⛔ NIVÅ 2, SOM KATALOGERNAS (0.44.0, bolag-ops#507): kortet står bredvid `OpsKatalogInstallning` i inställningarna, och två
          kort på samma sida med olika rubriknivå hade gett skärmläsarens rubriklista en ordning som inte finns på skärmen. */}
      <h2 id={rubrikId} className="m-0 text-sektion uppercase text-accent">{rubrik}</h2>
      {!kanAndra ? (
        <OpsBanner tone="info" title="Du kan läsa listan, inte ändra den">
          Det är gruppens ägare som döljer eller döper om typer från moduler. Låset sitter i databasens regler, inte i den här vyn.
        </OpsBanner>
      ) : null}
      {bidrag.length === 0 ? (
        <p className="m-0 text-hjalp text-ink-muted">Ingen modul i den här gruppen bidrar med typer just nu.</p>
      ) : (
        <OpsList divided ariaLabel={rubrik}>
          {bidrag.map(rad)}
        </OpsList>
      )}
    </section>
  );
}
