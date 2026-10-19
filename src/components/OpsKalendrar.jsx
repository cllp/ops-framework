import { useId, useState } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import { cx } from "../lib/cx.js";
import { text } from "../lib/sprak.js";
import {
  KALENDERFARGER,
  KALENDERIKONER,
  MAX_GITHUBETIKETT,
  MAX_KALENDERNAMN,
  arkiveraKalender,
  byggGruppkalender,
  byggMinKalender,
  flyttaKalender,
  forvaldKalender,
  kalenderIdUrNamn,
  kontrolleraGithubEtiketter,
  nastaOrdning,
  valjForvald,
} from "../lib/kalendrar.js";
import { valjbara } from "../lib/katalog.js";
import { ordet } from "../lib/ord.js";
import { KALENDERIKON_KOMPONENT, KALENDERIKON_NAMN } from "../lib/kalenderikoner.js";
import { AndraIkon, ArkiveraIkon, ChevronNedIkon, PlusIkon, TaFramIkon } from "./icons.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsCheckbox } from "./OpsToggle.jsx";

/**
 * Texterna som är nya sedan språkhanteringen (0.108.0, cllp/lifehub.app#259), på båda språken. Resten av vyn är svensk sedan 0.37.0 och
 * flyttas till den här ordboken en rad i taget när den rörs: en halv flytt i en PR hade gjort granskningen till en omskrivning av vyn.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSKALENDRAR = {
  githubEtikett: { sv: "GitHub-etikett", en: "GitHub label" },
  githubEtikettHjalp: {
    sv: "Ärenden med den här etiketten och ett datum (due:ÅÅÅÅ-MM-DD) visas i kalendern.",
    en: "Issues with this label and a date (due:YYYY-MM-DD) are shown in the calendar.",
  },
  githubEtikettExempel: { sv: "Till exempel styrelsen", en: "For example board" },
};

/**
 * Hantera kalendrar: gruppens kalendrar och mina kalendrar (0.37.0, #179 F2).
 *
 * ══ ⛔ SESSIONSTUDIOS "MINA KALENDRAR", GÅNGER TVÅ ═════════════════════════════
 *
 * Förebilden är SS `components/PersonalCalendarsInlineSection.jsx` i kalenderhubben (`views/CalendarHubView.jsx`): ett
 * kort per sektion (`bg-surface rounded border p-5`), rubrik och en rad hjälptext, en rad per kalender med märket
 * (`CalendarMark`, 24 px), namnet och "Förvald" under det, en penna, och "+ Ny kalender" under listan. Redigeraren fälls ut
 * under listan med namn, färg, ikon och "Förvald", och Avbryt / Spara i två lika breda knappar.
 *
 * Tre skillnader mot SS, alla med skäl:
 *   - TVÅ SEKTIONER, INTE EN. SS har bara personliga kalendrar; CP beslutade 2026-09-29 att gruppen också har flera.
 *     Gruppens sektion kommer först, eftersom det är den de flesta poster ligger i.
 *   - ARKIVERA I STÄLLET FÖR RADERA. SS raderar kalendern (`onDelete`, soptunna). Här arkiveras den: posterna i den finns
 *     kvar, och "varför försvann den" har ett svar. Arkiverade ligger under en egen rubrik med "Ta fram".
 *   - ORDNING. SS har `ordning` i modellen men ingen väg att ändra den. Här flyttas en kalender upp eller ned, och den
 *     ordningen är filtrets och "Skapa i".
 *
 * ⛔ "TAS MED I FLÖDET" VISAS INTE ÄN. SS har rutan, men prenumerationsflödet är fas F4 och finns inte. En ruta som
 * sparar något ingenting läser är ett val som inte gör något (arbetsreglernas punkt 5). Fältet `iFlodet` bevaras orört
 * när en kalender sparas.
 *
 * ⛔ GITHUB-ETIKETTEN (0.108.0, cllp/lifehub.app#259) FINNS BARA PÅ GRUPPENS KALENDRAR. Ärenden med etiketten och ett datum ritas av appen i
 * kalendern, och en privat kalender har ingen grupp vars ärenden det kunde vara. Rutan ritas bara i gruppens sektion, och
 * `byggMinKalender` avvisar fältet ändå. Unikheten inom gruppen (utan hänsyn till skiftläge) kontrolleras vid sparandet, med en mening
 * på vyns språk, ur samma funktion som kalenderkällan använder (`kontrolleraGithubEtiketter`).
 *
 * ⛔ BARA ÄGARE OCH ADMIN ÄNDRAR GRUPPENS KALENDRAR, OCH DET STÅR UTSKRIVET. Utan rätten ritas gruppens lista utan knappar
 * och med en rad som säger varför, i stället för knappar som regeln sedan nekar. Mina kalendrar ändrar bara ägaren, och
 * det är alltid den som tittar.
 *
 * ⛔ VARJE ÄNDRING SKICKAR BARA DE RADER SOM ÄNDRATS (`onSparaGruppens(rader)`, `onSparaMina(rader)`), ur de rena
 * funktionerna i `lib/kalendrar.js`. Att byta förvald ger två rader, som källan skriver i en batch.
 *
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/kalendrar.js").Gruppkalender>} props.gruppens Den aktiva gruppens kalendrar, också arkiverade.
 * @param {ReadonlyArray<import("../lib/kalendrar.js").MinKalender>} props.mina Mina kalendrar, också arkiverade.
 * @param {string} props.groupId
 * @param {boolean} props.kanAndraGruppens Ägare eller admin i gruppen.
 * @param {(rader: import("../lib/kalendrar.js").Gruppkalender[], sprak: string) => Promise<unknown> | void} props.onSparaGruppens
 * @param {(rader: import("../lib/kalendrar.js").MinKalender[], sprak: string) => Promise<unknown> | void} props.onSparaMina
 * @param {string} [props.gruppNamn] Står i gruppsektionens rubrik ("Alfa AB:s kalendrar"). Utan den "Gruppens kalendrar".
 * @param {string} [props.sprak]
 */
export function OpsKalendrar({ gruppens, mina, groupId, kanAndraGruppens, onSparaGruppens, onSparaMina, gruppNamn, sprak: sprakProp }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  return (
    <div data-ops-kalendrar="" className="flex flex-col gap-5">
      <Sektion
        slag="grupp"
        rubrik={gruppNamn ? `${gruppNamn}: kalendrar` : "Gruppens kalendrar"}
        hjalp="Gruppens kalendrar syns för alla i gruppen. En händelse hamnar i den förvalda om inget annat väljs."
        lista={gruppens}
        kanAndra={kanAndraGruppens}
        lasText="Bara gruppens ägare och admin ändrar gruppens kalendrar."
        sprak={sprak}
        bygg={(r) => byggGruppkalender({ ...r, groupId })}
        onSpara={onSparaGruppens}
      />
      <Sektion
        slag="mina"
        rubrik="Mina kalendrar"
        hjalp="Dina egna kalendrar syns bara för dig. Poster i dem kan blockera din tillgänglighet."
        tomText="Du har inga egna kalendrar ännu."
        lista={mina}
        kanAndra
        lasText=""
        sprak={sprak}
        bygg={(r) => byggMinKalender(r)}
        onSpara={onSparaMina}
      />
    </div>
  );
}

/**
 * @typedef {{ id: string, namn: any, farg: number, ikon: string, ordning: number, forvald: boolean, arkiverad: boolean, iFlodet: boolean, githubEtikett?: string }} Kal
 */

/**
 * En sektion: listan, arkiverade och redigeraren.
 * @param {{ slag: "grupp" | "mina", rubrik: string, hjalp: string, tomText?: string, lista: ReadonlyArray<any>, kanAndra: boolean, lasText: string, sprak: string, bygg: (r: Record<string, any>) => any, onSpara: (rader: any[], sprak: string) => Promise<unknown> | void }} props
 */
function Sektion({ slag, rubrik, hjalp, tomText, lista, kanAndra, lasText, sprak, bygg, onSpara }) {
  const rubrikId = useId();
  const [utkast, setUtkast] = useState(/** @type {null | { id: string | null, namn: string, farg: number, ikon: string, forvald: boolean, forvaldFran: boolean, githubEtikett: string }} */ (null));
  const [upptagen, setUpptagen] = useState(false);
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  const valbara = /** @type {Kal[]} */ (/** @type {unknown} */ (valjbara(/** @type {any} */ (lista), sprak)));
  const arkiverade = lista.filter((k) => k.arkiverad);
  const forvald = forvaldKalender(/** @type {any} */ (lista));

  /** @param {any[]} rader */
  const spara = async (rader) => {
    if (rader.length === 0) return true;
    setFel(null);
    setUpptagen(true);
    try {
      const byggda = rader.map(bygg);
      /*
       * ⛔ ETIKETTEN FÅR INTE VARA UPPTAGEN AV EN ANNAN KALENDER I GRUPPEN (0.108.0). Kontrollen ser läget EFTER sparandet (de nya
       * raderna över listan), också när en arkiverad kalender tas fram. Felet är en hel mening på vyns språk och visas i redigeraren
       * eller ovanför listan, som alla andra fel här. Mina kalendrar har ingen etikett och kontrolleras inte.
       */
      if (slag === "grupp") kontrolleraGithubEtiketter(lista, { rader: byggda, sprak });
      // ⛔ Vyns språk följer med som andra argument, så att en app som sparar genom källan (`sparaGruppens(groupId, rader, { sprak })`) skriver
      // ett eventuellt etikettfel på samma språk som vyn, och inte på svenska.
      await onSpara(byggda, sprak);
      return true;
    } catch (e) {
      // ⛔ FELET VISAS, DET SVÄLJS INTE. En kalender som inte sparades och inte säger det ser ut som att knappen inte fungerar.
      setFel(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setUpptagen(false);
    }
  };

  const oppnaNy = () => {
    setFel(null);
    setUtkast({ id: null, namn: "", farg: KALENDERFARGER[(lista.length) % KALENDERFARGER.length], ikon: KALENDERIKONER[0], forvald: false, forvaldFran: false, githubEtikett: "" });
  };
  /** @param {Kal} k */
  const oppnaRedigera = (k) => {
    setFel(null);
    const ar = !!forvald && forvald.id === k.id;
    setUtkast({ id: k.id, namn: text(k.namn, sprak), farg: k.farg, ikon: k.ikon, forvald: ar, forvaldFran: ar, githubEtikett: k.githubEtikett ?? "" });
  };

  const sparaUtkast = async () => {
    if (!utkast) return;
    const namn = utkast.namn.trim();
    if (!namn) {
      setFel("Kalendern behöver ett namn.");
      return;
    }
    const gammal = utkast.id ? lista.find((k) => k.id === utkast.id) : null;
    const namnFalt = slag === "grupp" ? { ...(gammal && typeof gammal.namn === "object" ? gammal.namn : {}), [sprak]: namn } : namn;
    /** @type {Record<string, any>} */
    const rad = gammal
      ? { ...gammal, namn: namnFalt, farg: utkast.farg, ikon: utkast.ikon }
      : { id: kalenderIdUrNamn(namn, lista), namn: namnFalt, farg: utkast.farg, ikon: utkast.ikon, ordning: nastaOrdning(lista), forvald: false, iFlodet: false, arkiverad: false };
    /*
     * ⛔ ETIKETTEN ÄR ETT FÄLT SOM TAS BORT NÄR RUTAN ÄR TOM, DEN SKRIVS INTE SOM "". Raden bygger på `gammal`, så en rensad ruta måste
     * ta bort nyckeln uttryckligen, annars följer den gamla etiketten med in i `byggGruppkalender`. Källan ersätter dokumentet
     * (`setDoc`), så en rad utan fältet tar bort det i databasen. Mina kalendrar har ingen etikett och skickar aldrig fältet.
     */
    if (slag === "grupp") {
      const etikett = utkast.githubEtikett.trim();
      if (etikett) rad.githubEtikett = etikett;
      else delete rad.githubEtikett;
    }
    const med = gammal ? lista.map((k) => (k.id === rad.id ? rad : k)) : [...lista, rad];
    /*
     * ⛔ FÖRVALET RÖRS BARA OM RUTAN ÄNDRATS. En kalender som är förvald för att den står först (härledd, inte lagrad)
     * visar rutan ikryssad, och att spara ett nytt namn på den ska inte skriva `forvald: true` som ingen valde.
     * `valjForvald` svarar med raden själv (med nya namn, färg och ikon ur `med`) och den som var förvald.
     */
    /** @type {any[]} */
    const rader =
      utkast.forvald === utkast.forvaldFran ? [rad] : utkast.forvald ? valjForvald(med, rad.id) : [{ ...rad, forvald: false }];
    if (await spara(rader)) setUtkast(null);
  };

  return (
    <section aria-labelledby={rubrikId} data-kalendersektion={slag} className="rounded-base border border-line bg-surface p-5">
      <h3 id={rubrikId} className="m-0 mb-2 text-brod font-semibold text-ink">
        {rubrik}
      </h3>
      <p className="m-0 mb-4 text-etikett text-ink-secondary">{hjalp}</p>
      {!kanAndra ? <p className="m-0 mb-3 text-meta text-ink-muted" data-las-text="">{lasText}</p> : null}

      {/* ⛔ GRUPPEN ÄR KALENDERN (lane 6 steg F) VAR BESLUTET FRAM TILL 0.119.0, och är ersatt (0.120.0, cllp/lifehub.app#367): varje
          grupp får en standardkalender vid skapandet (`createGroupService({ standardkalender: true })`), och en befintlig får den med
          `createStandardkalenderService`. Skälet: utan en namngiven kalender föll förvalet för en ny händelse på personens egen. Gruppsektionen
          har fortfarande ingen tomrad, för en grupp där en admin arkiverat allt har gjort ett val, och det ska inte se ut som ett fel.
          Egna kalendrar skickar fortfarande tomText, och den ritas. */}
      {valbara.length === 0 && tomText ? <p className="m-0 mb-3 py-2 text-center text-etikett text-ink-muted">{tomText}</p> : null}

      <ul className="m-0 mb-3 flex list-none flex-col gap-2 p-0">
        {valbara.map((k, i) => {
          const namn = text(k.namn, sprak);
          const arForvald = !!forvald && forvald.id === k.id;
          const Ikon = KALENDERIKON_KOMPONENT[/** @type {keyof typeof KALENDERIKON_KOMPONENT} */ (k.ikon)];
          return (
            <li
              key={k.id}
              data-kalenderrad={k.id}
              className={cx("flex min-w-0 items-center gap-2 rounded-base border bg-canvas p-2", utkast && utkast.id === k.id ? "border-accent" : "border-line")}
            >
              <OpsIdentity name={namn} seed={k.id} tone={/** @type {1|2|3|4|5|6} */ (k.farg)} icon={Ikon} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-etikett text-ink">{namn}</span>
                {arForvald ? <span className="block text-meta text-ink-muted">Förvald</span> : null}
              </span>
              {kanAndra ? (
                <span className="flex shrink-0 items-center gap-0.5">
                  <IkonKnapp etikett={`Flytta upp ${namn}`} disabled={upptagen || i === 0} onClick={() => spara(flyttaKalender(/** @type {any} */ (lista), k.id, -1, sprak))}>
                    <span className="flex rotate-180">
                      <ChevronNedIkon size={16} />
                    </span>
                  </IkonKnapp>
                  <IkonKnapp etikett={`Flytta ned ${namn}`} disabled={upptagen || i === valbara.length - 1} onClick={() => spara(flyttaKalender(/** @type {any} */ (lista), k.id, 1, sprak))}>
                    <ChevronNedIkon size={16} />
                  </IkonKnapp>
                  <IkonKnapp etikett={`Redigera ${namn}`} disabled={upptagen} onClick={() => oppnaRedigera(k)}>
                    <AndraIkon size={16} />
                  </IkonKnapp>
                  <IkonKnapp etikett={`Arkivera ${namn}`} disabled={upptagen} onClick={() => spara([arkiveraKalender(/** @type {any} */ (lista), k.id)])}>
                    <ArkiveraIkon size={16} />
                  </IkonKnapp>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {arkiverade.length > 0 ? (
        <details className="mb-3" data-arkiverade="">
          <summary className="cursor-pointer text-meta font-medium text-ink-muted">Arkiverade ({arkiverade.length})</summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {arkiverade.map((k) => {
              const namn = text(k.namn, sprak);
              return (
                <li key={k.id} className="flex min-w-0 items-center gap-2 rounded-base border border-line p-2 opacity-70">
                  <span className="min-w-0 flex-1 truncate text-etikett text-ink-secondary">{namn}</span>
                  {kanAndra ? (
                    <IkonKnapp etikett={`Ta fram ${namn}`} disabled={upptagen} onClick={() => spara([arkiveraKalender(/** @type {any} */ (lista), k.id, false)])}>
                      <TaFramIkon size={16} />
                    </IkonKnapp>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {fel && !utkast ? (
        <p role="alert" className="m-0 mb-3 text-meta text-danger">
          {fel}
        </p>
      ) : null}

      {kanAndra && !utkast ? (
        <button
          type="button"
          onClick={oppnaNy}
          disabled={upptagen}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-base border border-line px-3 text-meta font-semibold text-ink-secondary hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 md:min-h-9"
        >
          <PlusIkon size={14} />
          Ny kalender
        </button>
      ) : null}

      {kanAndra && utkast ? (
        <Redigerare
          utkast={utkast}
          setUtkast={setUtkast}
          upptagen={upptagen}
          fel={fel}
          ny={!utkast.id}
          medEtikett={slag === "grupp"}
          sprak={sprak}
          onAvbryt={() => {
            setUtkast(null);
            setFel(null);
          }}
          onSpara={sparaUtkast}
        />
      ) : null}
    </section>
  );
}

/** @param {{ etikett: string, disabled?: boolean, onClick: () => void, children: import("react").ReactNode }} props */
function IkonKnapp({ etikett, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={etikett}
      title={etikett}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-base text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40 md:size-8"
    >
      {children}
    </button>
  );
}

/** Färgrutornas klass, utskriven (Tailwind läser källan som text). @type {Record<number, string>} */
const FARGRUTA = { 1: "bg-identity-1", 2: "bg-identity-2", 3: "bg-identity-3", 4: "bg-identity-4", 5: "bg-identity-5", 6: "bg-identity-6" };

/**
 * Redigeraren: namn, färg, ikon, förvald, och för en gruppkalender GitHub-etiketten. SS `PersonalCalendarsInlineSection.jsx:181-288`.
 * @param {{ utkast: { id: string | null, namn: string, farg: number, ikon: string, forvald: boolean, forvaldFran: boolean, githubEtikett: string }, setUtkast: (f: (u: any) => any) => void, upptagen: boolean, fel: string | null, ny: boolean, medEtikett: boolean, sprak: string, onAvbryt: () => void, onSpara: () => void }} props
 */
function Redigerare({ utkast, setUtkast, upptagen, fel, ny, medEtikett, sprak, onAvbryt, onSpara }) {
  const Ikon = KALENDERIKON_KOMPONENT[/** @type {keyof typeof KALENDERIKON_KOMPONENT} */ (utkast.ikon)];
  return (
    <div data-kalenderredigerare="" className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="m-0 text-etikett font-medium text-ink-secondary">{ny ? "Ny kalender" : "Redigera kalender"}</p>
      {fel ? (
        <p role="alert" className="m-0 text-meta text-danger">
          {fel}
        </p>
      ) : null}
      <div className="flex min-w-0 items-end gap-3">
        <OpsIdentity name={utkast.namn || "Kalender"} seed={utkast.id || "ny"} tone={/** @type {1|2|3|4|5|6} */ (utkast.farg)} icon={Ikon} size="md" />
        <div className="min-w-0 flex-1">
          <OpsField label="Namn">
            <OpsInput value={utkast.namn} onChange={(v) => setUtkast((u) => ({ ...u, namn: v }))} maxLength={MAX_KALENDERNAMN} placeholder="Till exempel Styrelsen" />
          </OpsField>
        </div>
      </div>
      <div role="group" aria-label="Färg" className="flex flex-wrap gap-2">
        {KALENDERFARGER.map((f) => (
          <button
            key={f}
            type="button"
            aria-label={`Färg ${f}`}
            aria-pressed={utkast.farg === f}
            disabled={upptagen}
            onClick={() => setUtkast((u) => ({ ...u, farg: f }))}
            className={cx("size-8 cursor-pointer rounded-md border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", FARGRUTA[f], utkast.farg === f ? "border-accent" : "border-transparent")}
          />
        ))}
      </div>
      <div role="group" aria-label="Ikon" className="flex flex-wrap gap-1.5">
        {KALENDERIKONER.map((id) => {
          const I = KALENDERIKON_KOMPONENT[id];
          return (
            <button
              key={id}
              type="button"
              aria-label={KALENDERIKON_NAMN[id]}
              aria-pressed={utkast.ikon === id}
              disabled={upptagen}
              onClick={() => setUtkast((u) => ({ ...u, ikon: id }))}
              className={cx(
                "inline-flex size-10 cursor-pointer items-center justify-center rounded-base border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                utkast.ikon === id ? "border-accent bg-accent-subtle text-accent" : "border-line text-ink-muted hover:text-ink",
              )}
            >
              <I size={18} />
            </button>
          );
        })}
      </div>
      {medEtikett ? (
        <OpsField label={ordet(ORD_OPSKALENDRAR, "githubEtikett", sprak)} hint={ordet(ORD_OPSKALENDRAR, "githubEtikettHjalp", sprak)}>
          {/* ⛔ `tal={false}`: en etikett är ett namn på GitHub, inte en mening att diktera, och mikrofonen på ett kort fält är brus. */}
          <OpsInput
            value={utkast.githubEtikett}
            onChange={(v) => setUtkast((u) => ({ ...u, githubEtikett: v }))}
            maxLength={MAX_GITHUBETIKETT}
            placeholder={ordet(ORD_OPSKALENDRAR, "githubEtikettExempel", sprak)}
            disabled={upptagen}
            autoComplete="off"
            tal={false}
          />
        </OpsField>
      ) : null}
      <OpsCheckbox label="Förvald" hint="Nya poster hamnar här när inget annat väljs." checked={utkast.forvald} disabled={upptagen} onChange={(v) => setUtkast((u) => ({ ...u, forvald: v }))} />
      <div className="flex gap-2 pt-1">
        <div className="flex-1">
          <OpsButton variant="secondary" fullWidth disabled={upptagen} onClick={onAvbryt}>
            Avbryt
          </OpsButton>
        </div>
        <div className="flex-1">
          <OpsButton variant="primary" fullWidth busy={upptagen} disabled={!utkast.namn.trim()} onClick={onSpara}>
            {ny ? "Skapa kalender" : "Spara ändringar"}
          </OpsButton>
        </div>
      </div>
    </div>
  );
}
