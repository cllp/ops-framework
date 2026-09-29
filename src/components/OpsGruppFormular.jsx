import { useId, useMemo, useState } from "react";
import { cx } from "../lib/cx.js";
import { GRUPPIKONER, GRUPPINITIALER_FORM, MAX_GRUPPBESKRIVNING, MAX_GRUPPORT, PROFILFARGER } from "../lib/grupp.js";
import { GRUPPIKON_KOMPONENT, gruppmarkeProps } from "../lib/gruppikoner.js";
import { initials } from "../lib/identity.js";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { BockIkon, ChevronNedIkon, KryssIkon, PlusIkon } from "./icons.jsx";

/**
 * Formuläret "Ny grupp": SessionStudios `ManageGroupModal` i sin `inline`-form, som en PANEL (0.32.0, #180).
 *
 * ══ ⛔ SAMMA ORDNING SOM SS, MÄTT UR KÄLLAN (CP 2026-09-29 23:30) ═════════════════════════════════════════
 *
 * CP: "Skapa grupp och bjuda in till grupp finns inte ännu. Skapa grupp i web skall ha samma funktion som i SessionStudio."
 * SS `ManageGroupModal.jsx:479-640` (kroppen) och `ManageGroupModalGroupImages.jsx`:
 *
 *   1. En rad "Visuell identitet" (`:34-45`): märket i en cirkel, "Färg och ikon", en hint och en chevron. Ett tryck fäller ut
 *      (`identityOpen`) färgprickar (`w-9 h-9 rounded-full`, vald med ring och bock), en rad ikonrutor (`w-8 h-8`) med en
 *      "Aa"-ruta för initialer först, och när initialer är valda ett fält om 1 till 3 tecken med "Återställ".
 *   2. Namn (`:590`), Beskrivning (`:594`), Ort (`:598`).
 *   3. Medlemmar (`ManageGroupModalMembersSection`): en rad "e-post, roll, Lägg till" och listan under.
 *   4. "Mer inställningar" (`MoreSettingsDisclosure`), hopfälld, med resten. Här: E-postspråk.
 *
 * Före 0.32.0 fanns ingen väg att skapa en grupp i ramverket, bara `OpsUtanMedlemskap` med ETT namnfält för den FÖRSTA gruppen.
 *
 * ══ ⛔ EN PANEL, INTE EN MODAL, OCH KNAPPRADEN ÄR SKALETS ═══════════════════════════════════════════════════
 *
 * Formuläret ritas av `OpsAppShell` i skapa-panelen (`skapa.grupp`), med Tillbaka, rubrik och en fast knapprad. `Spara` är skalets
 * `type="submit" form={formId}`: formuläret ger sitt `<form>` `id={formId}` och har ingen egen sparaknapp.
 *
 * ══ ⛔ FORMULÄRET ÄGER INGEN DATA OCH INGEN ANROPSVÄG ══════════════════════════════════════════════════════
 *
 * `onSkapa({ grupp, inbjudningar })` är appens callable (`skapaGrupp` på nodsidan, `@staiger/ops-framework/node`). Formuläret vet inte
 * hur den anropas, bara vad den svarar: `{ groupId, tillagda, inbjudna, fel }`. Faller den visas felet i formuläret och ingenting
 * har sparats som en halv grupp (`skapaGrupp` skriver gruppen och ägaren i en batch).
 *
 * ⛔ INBJUDNINGARNA SAMLAS FÖRE SPARA, SOM I SS, och skickas i samma anrop. Före 0.32.0 gick det inte att bjuda in någon i ett
 * formulär alls. Rollen agare finns inte i väljaren: skaparen är ägaren.
 *
 * ⛔ BILDEN LADDAS UPP FÖRST NÄR GRUPPEN FINNS (SS `ManageGroupModalGroupImages.jsx:139`: `!isNew && form.id`). En sökväg i lagringen
 * bär gruppens id, och det finns inget id förrän gruppen är skapad. Formuläret säger det (`bildHint`) i stället för att visa en
 * uppladdning som inte kan fungera, och `onSkapad(groupId, svar)` ger appen id:t att navigera till gruppens sida med, där bilden läggs till.
 *
 * ⛔ FALLER NÅGON INBJUDAN VISAS DET. Gruppen finns då, och panelen visar vilka adresser som inte blev av och varför i stället för att
 * stängas: en tyst nedsläppsväg är värre än ett fel (arbetsreglernas punkt 5). Ett tryck på Spara eller "Öppna gruppen" går vidare, och först då får appen `onSkapad`.
 *
 * ⛔ TYPSNITT ÄR RAMVERKETS ROLLER (`text-etikett`, `text-sektion`, `text-hjalp`), aldrig en rå storlek (`check-typografi`).
 */

/** @typedef {import("../lib/sprak.js").Namn} Namn */

/**
 * @typedef {object} GruppFormularEtiketter
 * @property {string} [visuellIdentitet] "Visuell identitet".
 * @property {string} [fargOchIkon] "Färg och ikon".
 * @property {string} [visuellIdentitetHint]
 * @property {string} [farg] "Färg".
 * @property {string} [ikonEllerLogotyp]
 * @property {string} [initialer] Skärmläsarnamn på "Aa"-rutan.
 * @property {string} [egnaInitialer]
 * @property {string} [egnaInitialerHint]
 * @property {string} [aterstallInitialer]
 * @property {string} [bildHint] Vad som gäller för bilden när gruppen skapas.
 * @property {string} [namn] "Gruppnamn".
 * @property {string} [namnPlatshallare]
 * @property {string} [namnKravs] Felet när namnet saknas.
 * @property {string} [beskrivning]
 * @property {string} [beskrivningPlatshallare]
 * @property {string} [ort]
 * @property {string} [ortPlatshallare]
 * @property {string} [medlemmar] Rubrik, följd av antalet.
 * @property {string} [epost] "E-postadress".
 * @property {string} [roll] "Roll".
 * @property {string} [lagg] "Lägg till".
 * @property {string} [taBort] "Ta bort" (följs av adressen).
 * @property {string} [epostFel] Felet när adressen inte är en adress.
 * @property {string} [epostDubblett] Felet när adressen redan är tillagd.
 * @property {string} [medlemmarHint]
 * @property {Record<"admin"|"medlem", string>} [roller]
 * @property {string} [merInstallningar]
 * @property {string} [epostsprak] "E-postspråk".
 * @property {string} [epostsprakHint]
 * @property {Record<"sv"|"en", string>} [spraknamn]
 * @property {string} [sparar]
 * @property {string} [skapadTitel] Rubriken på resultatvyn när någon inbjudan föll.
 * @property {string} [skapadText]
 * @property {string} [oppnaGruppen]
 * @property {string} [felTitel] Rubriken när gruppen inte kunde skapas.
 */

/** @type {Record<"sv"|"en", Required<GruppFormularEtiketter>>} */
const STANDARD = {
  sv: {
    visuellIdentitet: "Visuell identitet",
    fargOchIkon: "Färg och ikon",
    visuellIdentitetHint: "Hur gruppen syns i listor och i gruppväljaren",
    farg: "Färg",
    ikonEllerLogotyp: "Ikon eller initialer",
    initialer: "Initialer",
    egnaInitialer: "Egna initialer",
    egnaInitialerHint: "Ett till tre tecken. Tomt fält ger initialer ur gruppens namn.",
    aterstallInitialer: "Återställ till automatiska",
    bildHint: "En bild går att lägga till när gruppen har skapats.",
    namn: "Gruppnamn",
    namnPlatshallare: "Vad heter gruppen?",
    namnKravs: "Gruppen behöver ett namn.",
    beskrivning: "Beskrivning",
    beskrivningPlatshallare: "En kort beskrivning",
    ort: "Ort",
    ortPlatshallare: "Till exempel Visby",
    medlemmar: "Medlemmar",
    epost: "E-postadress",
    roll: "Roll",
    lagg: "Lägg till",
    taBort: "Ta bort",
    epostFel: "Det där ser inte ut som en e-postadress.",
    epostDubblett: "Den adressen är redan tillagd.",
    medlemmarHint: "De får en inbjudan när gruppen har skapats. Du är gruppens ägare.",
    roller: { admin: "Admin", medlem: "Medlem" },
    merInstallningar: "Mer inställningar",
    epostsprak: "E-postspråk",
    epostsprakHint: "Språket gruppens utskick skrivs på, till exempel inbjudningar.",
    spraknamn: { sv: "Svenska", en: "English" },
    sparar: "Sparar",
    skapadTitel: "Gruppen är skapad, men alla inbjudningar gick inte iväg",
    skapadText: "Du kan bjuda in dem igen från gruppens sida.",
    oppnaGruppen: "Öppna gruppen",
    felTitel: "Gruppen kunde inte skapas",
  },
  en: {
    visuellIdentitet: "Visual identity",
    fargOchIkon: "Color and icon",
    visuellIdentitetHint: "How the group appears in lists and in the group switcher",
    farg: "Color",
    ikonEllerLogotyp: "Icon or initials",
    initialer: "Initials",
    egnaInitialer: "Custom initials",
    egnaInitialerHint: "One to three characters. An empty field uses the initials of the group name.",
    aterstallInitialer: "Reset to automatic",
    bildHint: "An image can be added once the group has been created.",
    namn: "Group name",
    namnPlatshallare: "What is the group called?",
    namnKravs: "The group needs a name.",
    beskrivning: "Description",
    beskrivningPlatshallare: "A short description",
    ort: "City",
    ortPlatshallare: "For example Visby",
    medlemmar: "Members",
    epost: "Email address",
    roll: "Role",
    lagg: "Add",
    taBort: "Remove",
    epostFel: "That does not look like an email address.",
    epostDubblett: "That address has already been added.",
    medlemmarHint: "They get an invitation once the group has been created. You are the owner of the group.",
    roller: { admin: "Admin", medlem: "Member" },
    merInstallningar: "More settings",
    epostsprak: "Email language",
    epostsprakHint: "The language the group's messages are written in, for example invitations.",
    spraknamn: { sv: "Svenska", en: "English" },
    sparar: "Saving",
    skapadTitel: "The group was created, but not every invitation went out",
    skapadText: "You can invite them again from the group's page.",
    oppnaGruppen: "Open the group",
    felTitel: "The group could not be created",
  },
};

/** Samma tumregel som servern (`EPOSTFORM` i `src/node/grupp.js`): en rad som inte är skräp, inte en kontroll av brevlådan. */
const EPOSTFORM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ⛔ KLASSNAMNEN STÅR UTSKRIVNA, INTE BYGGDA med `bg-identity-${n}`: Tailwind läser källkoden som text (se `OpsIdentity`).
 * @type {Record<string, string>}
 */
const PRICKKLASS = { 1: "bg-identity-1", 2: "bg-identity-2", 3: "bg-identity-3", 4: "bg-identity-4", 5: "bg-identity-5", 6: "bg-identity-6" };

/**
 * @typedef {object} GruppFormularSvar Vad `onSkapa` svarar med (`skapaGrupp` på nodsidan).
 * @property {string} groupId
 * @property {ReadonlyArray<string>} [tillagda]
 * @property {ReadonlyArray<string>} [inbjudna]
 * @property {ReadonlyArray<{ epost: string, fel: string }>} [fel]
 */

/**
 * @param {object} props
 * @param {string} [props.formId] `id` på `<form>`, så skapa-panelens fasta Spara (`type="submit" form`) når det. Skalet skickar det.
 * @param {(b: { grupp: { namn: string, farg: string, ikon: string, beskrivning: string, ort: string, epostsprak: "sv"|"en" }, inbjudningar: Array<{ epost: string, roll: "admin"|"medlem" }> }) => Promise<GruppFormularSvar>} props.onSkapa
 *   Appens anrop av `skapaGrupp`. Ett kast visas i formuläret.
 * @param {(groupId: string, svar: GruppFormularSvar) => void} [props.onSkapad] Gruppen finns. Appen navigerar till dess sida.
 * @param {() => void} [props.onKlar] Stänger panelen (skalet skickar den).
 * @param {"sv"|"en"} [props.sprak] Språket på etiketterna och förvalet för gruppens e-postspråk.
 * @param {GruppFormularEtiketter} [props.etiketter] Enskilda texter att byta ut.
 */
export function OpsGruppFormular({ formId, onSkapa, onSkapad, onKlar, sprak = "sv", etiketter }) {
  if (typeof onSkapa !== "function") {
    throw new Error("OpsGruppFormular: onSkapa krävs, appens anrop av skapaGrupp. Ett formulär som inte kan skapa något är en ruta som ser ut som en grupp.");
  }
  const t = { ...STANDARD[sprak === "en" ? "en" : "sv"], ...(etiketter ?? {}) };

  const [namn, setNamn] = useState("");
  const [beskrivning, setBeskrivning] = useState("");
  const [ort, setOrt] = useState("");
  const [farg, setFarg] = useState("");
  const [ikon, setIkon] = useState("");
  const [epostsprak, setEpostsprak] = useState(/** @type {"sv"|"en"} */ (sprak === "en" ? "en" : "sv"));
  const [identitetOppen, setIdentitetOppen] = useState(false);
  const [merOppet, setMerOppet] = useState(false);
  const [inbjudna, setInbjudna] = useState(/** @type {Array<{ epost: string, roll: "admin"|"medlem" }>} */ ([]));
  const [nyEpost, setNyEpost] = useState("");
  const [nyRoll, setNyRoll] = useState(/** @type {"admin"|"medlem"} */ ("medlem"));
  const [epostFel, setEpostFel] = useState("");
  const [namnFel, setNamnFel] = useState("");
  const [upptagen, setUpptagen] = useState(false);
  const [felmeddelande, setFelmeddelande] = useState("");
  const [resultat, setResultat] = useState(/** @type {GruppFormularSvar | null} */ (null));

  const identitetId = useId();
  const merId = useId();

  const initialerAktiva = ikon === "" || GRUPPINITIALER_FORM.test(ikon);
  const egnaInitialer = GRUPPINITIALER_FORM.exec(ikon)?.[1] ?? "";
  const marke = useMemo(() => gruppmarkeProps({ farg, ikon }), [farg, ikon]);

  /**
   * Går vidare efter att gruppen finns: panelen stängs FÖRST, sedan får appen id:t.
   *
   * ⛔ ORDNINGEN ÄR ETT BESLUT. Appen navigerar till gruppens sida i `onSkapad`. Stängde panelen efter det kunde dess
   * (asynkrona) väg tillbaka i historiken landa efter appens navigering och ångra den. Skalets `onKlar` stänger
   * dessutom utan att gå bakåt (`stangSkapa(true)`), men den som använder formuläret utan skalet ska inte behöva veta det.
   */
  const klar = (/** @type {GruppFormularSvar} */ svar) => {
    onKlar?.();
    onSkapad?.(svar.groupId, svar);
  };

  const laggTill = () => {
    const e = nyEpost.trim().toLowerCase();
    if (!e) return;
    if (!EPOSTFORM.test(e)) {
      setEpostFel(t.epostFel);
      return;
    }
    if (inbjudna.some((r) => r.epost === e)) {
      setEpostFel(t.epostDubblett);
      return;
    }
    setInbjudna((lista) => [...lista, { epost: e, roll: nyRoll }]);
    setNyEpost("");
    setEpostFel("");
  };

  /** @param {import("react").FormEvent} e */
  const skicka = async (e) => {
    e.preventDefault();
    // ⛔ Resultatvyn har samma `<form>`: ett tryck på panelens Spara där betyder "gå vidare", inte "skapa en till".
    if (resultat) {
      klar(resultat);
      return;
    }
    if (upptagen) return;
    if (!namn.trim()) {
      setNamnFel(t.namnKravs);
      return;
    }
    setNamnFel("");
    setFelmeddelande("");
    setUpptagen(true);
    try {
      /*
       * ⛔ EN ADRESS SOM STÅR KVAR I FÄLTET NÄR MAN TRYCKER SPARA ÄR EN ADRESS MAN MENADE. Utan det här skulle
       * någon som skrev en adress och gick direkt till Spara skapa gruppen utan den personen, och inget säger det.
       */
      const ut = [...inbjudna];
      const kvar = nyEpost.trim().toLowerCase();
      if (kvar && EPOSTFORM.test(kvar) && !ut.some((r) => r.epost === kvar)) ut.push({ epost: kvar, roll: nyRoll });
      if (kvar && !EPOSTFORM.test(kvar)) {
        setEpostFel(t.epostFel);
        setUpptagen(false);
        return;
      }
      const svar = await onSkapa({
        grupp: { namn: namn.trim(), farg, ikon, beskrivning: beskrivning.trim(), ort: ort.trim(), epostsprak },
        inbjudningar: ut,
      });
      if ((svar.fel ?? []).length > 0) {
        setResultat(svar);
      } else {
        klar(svar);
      }
    } catch (fel) {
      setFelmeddelande(fel instanceof Error ? fel.message : String(fel));
    } finally {
      setUpptagen(false);
    }
  };

  if (resultat) {
    return (
      <form id={formId} onSubmit={skicka} className="flex flex-col gap-4" data-gruppformular="resultat">
        <OpsBanner tone="warning" title={t.skapadTitel}>
          {t.skapadText}
        </OpsBanner>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {(resultat.fel ?? []).map((f) => (
            <li key={f.epost} className="text-etikett text-ink">
              <span className="font-medium">{f.epost}</span>
              <span className="text-ink-secondary">{`: ${f.fel}`}</span>
            </li>
          ))}
        </ul>
        <div>
          <OpsButton variant="secondary" onClick={() => klar(resultat)}>
            {t.oppnaGruppen}
          </OpsButton>
        </div>
      </form>
    );
  }

  return (
    <form id={formId} onSubmit={skicka} noValidate className="flex flex-col gap-4 pb-8" data-gruppformular="">
      {felmeddelande ? (
        <OpsBanner tone="danger" title={t.felTitel} onDismiss={() => setFelmeddelande("")}>
          {felmeddelande}
        </OpsBanner>
      ) : null}

      {/* ── 1. Visuell identitet (SS ManageGroupModalGroupImages.jsx:34-45) ───────────────────────────── */}
      <div data-gruppidentitet="">
        <p className="m-0 mb-1.5 text-sektion uppercase text-ink-muted">{t.visuellIdentitet}</p>
        <button
          type="button"
          onClick={() => setIdentitetOppen((v) => !v)}
          aria-expanded={identitetOppen}
          aria-controls={identitetId}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-base border border-line-strong bg-surface px-3 py-3 text-left transition-colors duration-(--duration-fast) ease-standard hover:border-accent/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          {/* ⛔ FÖRHANDSVISNINGEN ÄR DEKORATION FÖR SKÄRMLÄSAREN: knappens text säger vad raden är, och märket har inget eget namn att läsa upp
              (gruppen är inte skapad än, och en "Gruppnamn"-bild bredvid fältet med samma namn är två saker med samma etikett). */}
          <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-faint p-1">
            <OpsIdentity name={namn.trim()} seed="ny-grupp" size="lg" rund {...marke} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-etikett font-semibold text-ink">{t.fargOchIkon}</span>
            <span className="block truncate text-meta text-ink-muted">{t.visuellIdentitetHint}</span>
          </span>
          <span aria-hidden="true" className={cx("shrink-0 text-ink-muted transition-transform duration-(--duration-fast)", identitetOppen && "rotate-180")}>
            <ChevronNedIkon />
          </span>
        </button>

        {identitetOppen ? (
          <div id={identitetId} className="mt-3 flex flex-col gap-3 rounded-base border border-line bg-canvas p-3">
            <div>
              <p className="m-0 mb-2 text-meta font-semibold text-ink-secondary">{t.farg}</p>
              <div className="flex flex-wrap gap-1" role="group" aria-label={t.farg}>
                {PROFILFARGER.map((f) => {
                  const vald = farg === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFarg(f)}
                      aria-label={`${t.farg} ${f}`}
                      aria-pressed={vald}
                      className="flex size-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                    >
                      <span className={cx("flex size-9 items-center justify-center rounded-full text-ink-inverse transition-all", PRICKKLASS[f], vald && "scale-105 ring-2 ring-accent ring-offset-2 ring-offset-canvas")}>
                        {vald ? <BockIkon size={16} /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="m-0 mb-2 text-meta font-semibold text-ink-secondary">{t.ikonEllerLogotyp}</p>
              <div className="flex flex-wrap gap-1" role="group" aria-label={t.ikonEllerLogotyp}>
                <button
                  type="button"
                  onClick={() => setIkon(egnaInitialer ? ikon : "")}
                  aria-label={t.initialer}
                  aria-pressed={initialerAktiva}
                  className={cx(
                    "flex size-11 cursor-pointer items-center justify-center rounded-base text-etikett font-semibold text-ink-secondary transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    initialerAktiva && "bg-accent-subtle text-ink ring-2 ring-accent",
                  )}
                >
                  Aa
                </button>
                {GRUPPIKONER.map((id) => {
                  const Ikon = GRUPPIKON_KOMPONENT[id];
                  const vald = ikon === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setIkon(id)}
                      aria-label={id}
                      aria-pressed={vald}
                      className={cx(
                        "flex size-11 cursor-pointer items-center justify-center rounded-base text-ink-secondary transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                        vald && "bg-accent-subtle text-ink ring-2 ring-accent",
                      )}
                    >
                      <Ikon size={18} />
                    </button>
                  );
                })}
              </div>

              {initialerAktiva ? (
                <div className="mt-2 flex flex-col gap-1">
                  <label htmlFor={`${identitetId}-init`} className="text-hjalp text-ink-muted">
                    {t.egnaInitialer}
                  </label>
                  <p className="m-0 text-hjalp text-ink-muted">{t.egnaInitialerHint}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id={`${identitetId}-init`}
                      value={egnaInitialer}
                      maxLength={3}
                      placeholder={initials(namn)}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^a-zA-ZÅÄÖåäö0-9]/g, "").toUpperCase().slice(0, 3);
                        setIkon(v ? `initialer:${v}` : "");
                      }}
                      className="min-h-11 w-24 rounded-base border-[1.5px] border-line bg-surface px-3 py-2 text-rubrik uppercase text-ink placeholder:normal-case placeholder:text-ink-muted hover:border-line-strong focus-visible:border-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:text-brod"
                    />
                    {egnaInitialer ? (
                      <button
                        type="button"
                        onClick={() => setIkon("")}
                        className="min-h-11 cursor-pointer rounded-base px-2 text-meta text-accent hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                      >
                        {t.aterstallInitialer}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <p className="m-0 mt-2 text-hjalp text-ink-muted">{t.bildHint}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── 2. Namn, beskrivning, ort ──────────────────────────────────────────────────────────────── */}
      <OpsField label={t.namn} required error={namnFel || undefined}>
        <OpsInput value={namn} onChange={(v) => { setNamn(v); if (v.trim()) setNamnFel(""); }} placeholder={t.namnPlatshallare} disabled={upptagen} autoComplete="off" />
      </OpsField>
      <OpsField label={t.beskrivning} hint={`${beskrivning.length}/${MAX_GRUPPBESKRIVNING}`}>
        <OpsInput value={beskrivning} onChange={setBeskrivning} placeholder={t.beskrivningPlatshallare} disabled={upptagen} maxLength={MAX_GRUPPBESKRIVNING} />
      </OpsField>
      <OpsField label={t.ort}>
        <OpsInput value={ort} onChange={setOrt} placeholder={t.ortPlatshallare} disabled={upptagen} maxLength={MAX_GRUPPORT} />
      </OpsField>

      {/* ── 3. Medlemmar: inbjudningar samlas före spara (SS ManageGroupModalMembersSection) ──────────── */}
      <section aria-label={t.medlemmar} data-gruppmedlemmar="" className="flex flex-col gap-2">
        <h3 className="m-0 text-etikett font-medium text-ink-secondary">{`${t.medlemmar} (${inbjudna.length})`}</h3>
        <p className="m-0 text-hjalp text-ink-muted">{t.medlemmarHint}</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <OpsField label={t.epost} error={epostFel || undefined}>
              <OpsInput
                type="email"
                value={nyEpost}
                onChange={(v) => { setNyEpost(v); if (epostFel) setEpostFel(""); }}
                placeholder="namn@exempel.se"
                disabled={upptagen}
                autoComplete="off"
              />
            </OpsField>
          </div>
          <div className="md:w-40">
            <OpsField label={t.roll}>
              <OpsSelect
                value={nyRoll}
                onChange={(v) => setNyRoll(v === "admin" ? "admin" : "medlem")}
                options={[{ value: "medlem", label: t.roller.medlem }, { value: "admin", label: t.roller.admin }]}
                disabled={upptagen}
              />
            </OpsField>
          </div>
          <div className="md:pt-6">
            <OpsButton variant="secondary" onClick={laggTill} disabled={upptagen || !nyEpost.trim()}>
              <PlusIkon size={16} />
              {t.lagg}
            </OpsButton>
          </div>
        </div>
        {inbjudna.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {inbjudna.map((r) => (
              <li key={r.epost} className="flex min-h-11 items-center gap-2 rounded-base border border-line bg-surface pl-3 pr-1">
                <span className="min-w-0 flex-1 truncate text-etikett text-ink">{r.epost}</span>
                <OpsPill tone={r.roll === "admin" ? "info" : "neutral"}>{t.roller[r.roll]}</OpsPill>
                <button
                  type="button"
                  onClick={() => setInbjudna((lista) => lista.filter((x) => x.epost !== r.epost))}
                  disabled={upptagen}
                  aria-label={`${t.taBort} ${r.epost}`}
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <KryssIkon size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* ── 4. Mer inställningar (SS MoreSettingsDisclosure.jsx:56-100), hopfälld ────────────────────── */}
      <div data-mer-installningar="">
        <hr className="m-0 border-0 border-t border-line" />
        <button
          type="button"
          onClick={() => setMerOppet((v) => !v)}
          aria-expanded={merOppet}
          aria-controls={merId}
          className="flex min-h-11 cursor-pointer items-center gap-2 py-2 text-etikett font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <span>{t.merInstallningar}</span>
          <span aria-hidden="true" className={cx("transition-transform duration-200", merOppet && "rotate-180")}>
            <ChevronNedIkon />
          </span>
        </button>
        <div id={merId} role="region" aria-label={t.merInstallningar} hidden={!merOppet} className="flex flex-col gap-4 pt-3">
          <OpsField label={t.epostsprak} hint={t.epostsprakHint}>
            <OpsSelect
              value={epostsprak}
              onChange={(v) => setEpostsprak(v === "en" ? "en" : "sv")}
              options={[{ value: "sv", label: t.spraknamn.sv }, { value: "en", label: t.spraknamn.en }]}
              disabled={upptagen}
            />
          </OpsField>
        </div>
      </div>

      {upptagen ? (
        <p role="status" className="m-0 text-etikett text-ink-secondary">
          {t.sparar}
        </p>
      ) : null}
    </form>
  );
}
