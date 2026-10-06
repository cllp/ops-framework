import { useId, useMemo, useState } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import { cx } from "../lib/cx.js";
import { byggKategori, FASER, valjbara } from "../lib/katalog.js";
import { beskrivKonfigandring } from "../lib/konfiglogg.js";
import { SLAGPLATSER, slagPrick } from "../lib/slag.js";
import { text } from "../lib/sprak.js";
import { OpsBanner } from "./OpsBanner.jsx";
import { Delrubrik, delrubrik, useInstallningspanel } from "./OpsInstallningar.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { AndraIkon, ArkiveraIkon, TaFramIkon } from "./icons.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { OpsSelect } from "./OpsSelect.jsx";

/**
 * Inställningsvyn för en katalog: lägg till, döp om, arkivera (#112).
 *
 * ══ ⛔ ARKIVERA, ALDRIG RADERA ═════════════════════════════════════════
 *
 * En raderad kategori lämnar varje rad som pekar på den utan kategori. De
 * raderna försvinner inte, de blir bara omöjliga att filtrera och räkna, och
 * felet upptäcks långt efter att någon tryckt på knappen.
 *
 * Arkiverad betyder: går inte att välja för nya poster, syns fortfarande på
 * gamla, och går att ta fram igen. Det är också det enda ångrbara alternativet,
 * och det är hela skälet.
 *
 * ══ ⛔ VYN SKRIVER INTE SJÄLV ══════════════════════════════════════════
 *
 * `onSpara` och `onArkivera` kommer utifrån, precis som datakällan. Ramverket
 * ska inte veta var den här appens katalog bor, och en komponent som skriver
 * till en databas går inte att prova utan en.
 *
 * ══ ⛔ ÄGAREN OCH ADMIN ÄNDRAR, MEDLEMMEN LÄSER (0.33.0) ═════════════
 *
 * `kanAndra` kommer utifrån, ur rollerna i Fas 1. ⛔ OCH DEN HÄR KONTROLLEN ÄR
 * EN ARTIGHET, INTE ETT SKYDD: den som vill skriva ändå öppnar konsolen. Det
 * riktiga låset är Firestore-reglerna, och det ska stå här så att ingen tror
 * att vyn är låset.
 *
 * ══ ⛔ FÖRHANDSVISNINGEN, OCH VAD DEN INTE KAN ════════════════════════
 *
 * Palettplats 2 säger ingenting för den som väljer, så vyn ritar kategorin som
 * den kommer att se ut. Men den ritar den i det tema som är PÅSLAGET: mörka
 * toner ligger på `:root[data-theme="dark"]`, så en ruta kan inte visa det
 * andra temat bredvid.
 *
 * Det är inte en lucka, det är skälet till att man väljer en PLATS och inte en
 * färg: platserna är mätta mot kontrastgolvet i båda temana av
 * `check-kontrast`. En hex hade behövt den jämförelsen och inte haft den.
 *
 * ══ ⛔ TEXTERNA BÄRS OCH VISAS, DE FÅR INTE TAPPAS (#117) ══════════════
 *
 * Vyn byggde förut en ny kategori av formulärets fält och bara dem. En
 * redigering av en befintlig kategori hade därför RADERAT dess texter, alltså
 * samma tysta förlust som `byggKategori` nyss slutade göra, men utlöst av en
 * knapp och därmed värre.
 *
 * ⛔ OCH DE SOM INTE ÄR DEKLARERADE RITAS OCKSÅ. En text som bärs vidare utan
 * att synas är ett läge där vyn ljuger med utelämnande: den som tittar tror
 * att kategorin har de fält som står där. Union av det deklarerade och det
 * kategorin faktiskt bär, alltså ingenting dolt och ingenting tappat.
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/** Ett tomt utkast, för knappen som lägger till. */
const TOMT = { id: "", sv: "", en: "", farg: SLAGPLATSER[0], ikon: "", fas: "aktiv", ordning: 0, texter: /** @type {Record<string, {sv: string, en: string}>} */ ({}) };

/**
 * Texterna att rita: de deklarerade först, sedan de kategorin bär utöver dem.
 *
 * @param {readonly {nyckel: string, etikett?: unknown, hjalp?: string}[]} deklarerade
 * @param {Record<string, unknown>} bar
 */
function textraderna(deklarerade, bar) {
  const sedda = new Set(deklarerade.map((t) => t.nyckel));
  const extra = Object.keys(bar || {})
    .filter((n) => !sedda.has(n))
    .map((nyckel) => ({ nyckel, etikett: nyckel, hjalp: "Bärs av kategorin men krävs inte av katalogen." }));
  return [...deklarerade, ...extra];
}

/**
 * @param {object} props
 * @param {import("../lib/katalog.js").Kategori[]} props.kategorier
 * @param {readonly string[]} props.ikoner Tillåtelselistan. Appen äger den, eftersom den beror på ikonuppsättningen.
 * @param {(namn: string) => import("react").ReactNode} [props.ikonRitare] Namn till ikon. Utan den ritas ingen ikon. ⛔ Namnet visas
 *   aldrig som text: `wallet` är en nyckel i appens ikonuppsättning, inte ett ord för den som läser (granskningen av PR 278).
 * @param {boolean} [props.kanAndra] Ur rollerna. Falskt ger en läsvy med skälet utskrivet.
 * @param {(kategori: import("../lib/katalog.js").Kategori) => void} props.onSpara
 * @param {(kategori: import("../lib/katalog.js").Kategori, arkiverad: boolean) => void} props.onArkivera
 * @param {string} [props.sprak]
 * @param {string} [props.rubrik]
 * @param {any[]} [props.logg] Ändringsloggens rader, nyast först. Se `createConfigLog`.
 * @param {readonly {nyckel: string, etikett?: unknown, hjalp?: string}[]} [props.textnycklar] Texterna katalogen kräver. Appen äger listan, eftersom den beror på vad appens vyer ritar.
 * @param {boolean} [props.faser] Falskt för en sortkatalog. Då ritas ingen fasväljare, eftersom fältet inte finns på kategorin.
 * @param {boolean} [props.farger] Falskt när kategorierna skiljs åt med ikon. Då ritas ingen färgväljare och ingen prick.
 * @param {string} props.groupId Den aktiva gruppens id (#162, KRÄVS sedan 0.33.0). En ny eller ändrad kategori
 *   byggs med det här `groupId`:t, alltså i den aktiva gruppens katalog och ingen annans. Byts det stängs ett
 *   öppet utkast, se noten vid `forGrupp`.
 */
export function OpsKatalogInstallning({
  kategorier,
  ikoner,
  ikonRitare,
  kanAndra = false,
  onSpara,
  onArkivera,
  sprak: sprakProp,
  rubrik = "Kategorier",
  logg = [],
  textnycklar = [],
  faser = true,
  farger = true,
  groupId,
}) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  if (!Array.isArray(ikoner) || ikoner.length === 0) {
    throw new Error(
      "OpsKatalogInstallning: ikoner krävs och måste ha minst ett namn. Utan tillåtelselista går det att spara en ikon som inte finns, och den blir en tom ruta i varje vy.",
    );
  }

  /*
   * ⛔ groupId KRÄVS (0.33.0). Före 0.33.0 var det valfritt, och utan det byggdes kategorin utan grupp,
   * alltså en rad som delas av alla grupper i samlingen. Inställningsvyn skriver i den aktiva gruppens
   * katalog, och en vy som inte vet vilken grupp det är kan inte göra det.
   */
  if (typeof groupId !== "string" || !groupId.trim()) {
    throw new Error(
      "OpsKatalogInstallning: groupId krävs. Katalogen är den aktiva gruppens (#162), och utan groupId hade en ny kategori sparats utan grupp, alltså synlig för alla grupper.",
    );
  }

  const rubrikId = useId();
  // ⛔ I EN INSTÄLLNINGSPANEL (0.69.0, #274) blir rubriken en nivå under panelens, och samma som panelens ritas den inte alls (`delrubrik`).
  const delen = delrubrik(rubrik, rubrikId, useInstallningspanel());
  // Delarnas rubriker (Arkiverade, Senaste ändringarna) ligger en nivå under närmaste synliga rubrik: katalogens, eller panelens
  // när katalogens inte ritas. ⛔ Regeln är `delrubrik`s (`underniva`), inte katalogens egen (0.71.1, granskningen av PR 278).
  const [redigerar, setRedigerar] = useState(/** @type {string | null} */ (null));
  const [utkast, setUtkast] = useState(TOMT);
  const [fel, setFel] = useState(/** @type {string | null} */ (null));

  /*
   * ⛔ ETT UTKAST HÖR TILL GRUPPEN DET ÖPPNADES I (0.33.0). Före 0.33.0 låg `redigerar` och `utkast`
   * kvar när appen bytte grupp: listan byttes till den nya gruppens kategorier, men formuläret under
   * den stod kvar med den förra gruppens kategori ifylld, och Spara byggde den med det NYA groupId:t.
   * Resultatet var en kopia av grupp A:s kategori i grupp B:s katalog, sparad av någon som trodde sig
   * ändra A. Mätt i `check-skalyta` avsnitt 28. Utkastet stängs därför i samma rendering som gruppen
   * byts (Reacts mönster för att justera state vid en ny prop, ingen effekt som hinner rita det gamla).
   */
  const [forGrupp, setForGrupp] = useState(groupId);
  if (forGrupp !== groupId) {
    setForGrupp(groupId);
    setRedigerar(null);
    setUtkast(TOMT);
    setFel(null);
  }

  const alla = useMemo(() => (Array.isArray(kategorier) ? kategorier : []), [kategorier]);
  const aktiva = useMemo(() => valjbara(alla, sprak), [alla, sprak]);
  const arkiverade = useMemo(() => alla.filter((k) => k && k.arkiverad), [alla]);

  const oppna = (/** @type {import("../lib/katalog.js").Kategori | null} */ kategori) => {
    setFel(null);
    if (!kategori) {
      /*
       * ⛔ EN NY KATEGORI BÖRJAR MED EN GILTIG IKON, inte med ingen. Ett tomt
       * ikonfält ser ut som ett val man kan hoppa över, och valideringen
       * vägrar sedan spara med ett fel som kommer först efter att man fyllt i
       * allt annat.
       */
      setRedigerar("");
      setUtkast({ ...TOMT, ikon: ikoner[0], ordning: alla.length, texter: tomTextpase({}) });
      return;
    }
    setRedigerar(kategori.id);
    setUtkast({
      id: kategori.id,
      sv: kategori.namn.sv,
      en: kategori.namn.en || "",
      farg: kategori.farg || TOMT.farg,
      ikon: kategori.ikon,
      fas: kategori.fas || TOMT.fas,
      ordning: kategori.ordning,
      texter: tomTextpase(kategori.texter),
    });
  };

  /**
   * Utkastets textpåse: det kategorin bär, plus en tom rad för varje
   * deklarerad nyckel som saknas.
   *
   * ⛔ DET KATEGORIN BÄR KOMMER FÖRST OCH SKRIVS ALDRIG ÖVER. En text som inte
   * är deklarerad är inte en text som ska bort: appen kan ha slutat kräva den
   * utan att vilja radera den ur varje kategori, och en radering här hade skett
   * i tysthet vid nästa spara.
   *
   * @param {Record<string, any>} [bar]
   */
  function tomTextpase(bar) {
    /** @type {Record<string, {sv: string, en: string}>} */
    const ut = {};
    for (const [nyckel, namn] of Object.entries(bar || {})) ut[nyckel] = { sv: text(namn, "sv"), en: (namn && namn.en) || "" };
    for (const t of textnycklar) if (!(t.nyckel in ut)) ut[t.nyckel] = { sv: "", en: "" };
    return ut;
  }

  const spara = () => {
    try {
      /*
       * ⛔ SAMMA VALIDERING SOM VID UPPSTART, inte en egen i vyn. En andra
       * uppsättning regler i ett formulär glider isär från den som faktiskt
       * gäller, och då går det att spara något som sedan vägrar läsas in.
       */
      /*
       * ⛔ EN TEXT UTAN SVENSKA SKICKAS INTE MED SOM TOM, den utelämnas. Ett
       * `{ sv: "" }` hade kastat i `byggNamn` med ett meddelande om formen, och
       * frågan är inte formen: den är att texten saknas. Utelämnad får den
       * kravet nedan att säga just det, med nyckelns namn.
       */
      /** @type {Record<string, {sv: string, en?: string}>} */
      const texter = {};
      for (const [nyckel, v] of Object.entries(utkast.texter || {})) {
        const sv = rensa(v && v.sv);
        if (!sv) continue;
        const en = rensa(v && v.en);
        texter[nyckel] = en ? { sv, en } : { sv };
      }

      /*
       * ⛔ #162: kategorin byggs i den aktiva gruppen, med förvalet i `byggKategori` som kräver
       * `groupId` (0.33.0). Katalogkällans `spara` bygger den en gång till och skriver med
       * `katalognyckel`, så appen skickar vidare det här objektet till `spara` och inget annat.
       */
      const kategori = byggKategori(
        {
          id: utkast.id,
          namn: { sv: utkast.sv, en: utkast.en },
          ...(farger ? { farg: utkast.farg } : {}),
          ikon: utkast.ikon,
          ...(faser ? { fas: utkast.fas } : {}),
          ordning: utkast.ordning,
          texter,
          groupId,
        },
        { ikoner, katalog: rubrik, textnycklar: textnycklar.map((t) => t.nyckel), faser, farger },
      );
      onSpara(kategori);
      setRedigerar(null);
      setFel(null);
    } catch (e) {
      // Skälet skrivs ut som det är. Valideringen säger redan vilket fält och
      // varför, och en omskrivning här hade blivit en andra formulering av
      // samma fel.
      setFel(e instanceof Error ? e.message : String(e));
    }
  };

  const rad = (/** @type {import("../lib/katalog.js").Kategori} */ kategori) => (
    <OpsListRow key={kategori.id}>
      {/* ⛔ 0.30.0 (#173): SOM SESSIONSSTUDIOS INSTÄLLNINGSRAD (`SettingsView.jsx`,
          `flex items-center justify-between`): vänsterdelen får ta `min-w-0
          flex-1` och BRYTA sin text, högerdelen (knapparna) behåller sin
          storlek. Före 0.30.0 var raden en enda `flex-wrap` med knapparna som
          `ms-auto` i samma rad, och ett långt kategorinamn (svenska sammansatta
          ord är långa) kunde inte krympa under sitt längsta ord: raden blev
          bredare än sitt kort och vyn fick horisontell scroll på en 390 px
          bred telefon (mätt, se `check-skalyta`). */}
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
        {/* ⛔ Under `sm` STAPLAS raden: texten på egen full rad, knapparna under, så ett ord aldrig trycks ihop till en smal kolumn (CP: texterna får inte plats i mobil). */}
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-3 gap-y-1 sm:basis-auto">
          {/* ⛔ Ordet skickas med: `slagPrick` vägrar en prick utan det, eftersom en färg utan ord inte går att läsa upp och betyder ingenting för den som inte lärt sig koden.
              ⛔ Och ingen prick alls i en katalog utan färger: `slagPrick` kastar på en plats som inte finns, och en grå prick hade sagt att kategorin har en färg som inte laddat. */}
          {kategori.farg ? (
            <span className={cx("size-2 shrink-0 rounded-full", slagPrick(kategori.farg, text(kategori.namn, sprak), "OpsKatalogInstallning"))} aria-hidden="true" />
          ) : null}
          <span className="min-w-0 break-words text-etikett font-medium text-ink">{text(kategori.namn, sprak)}</span>
          {ikonRitare ? <span className="inline-flex shrink-0 text-ink-muted">{ikonRitare(kategori.ikon)}</span> : null}
          {kategori.fas ? <OpsPill tone="neutral">{kategori.fas}</OpsPill> : null}
          {kategori.arkiverad ? <OpsPill tone="warning">Arkiverad</OpsPill> : null}
        </div>
        {kanAndra ? (
          // ⛔ IKON PLUS ORD, INTE IKONEN ENSAM (#164). Mätt mot SessionStudio:
          // en knapp utan text är snabbare att rita men går inte att skanna i
          // en lista med tio rader, man måste läsa varje glyf. Ordet står kvar,
          // ikonen är en genväg för ögat och inte en ersättning för texten.
          <span className="flex shrink-0 gap-2 sm:ms-auto">
            <OpsButton variant="ghost" onClick={() => oppna(kategori)}>
              <AndraIkon />
              Ändra
            </OpsButton>
            <OpsButton variant="ghost" onClick={() => onArkivera(kategori, !kategori.arkiverad)}>
              {kategori.arkiverad ? <TaFramIkon /> : <ArkiveraIkon />}
              {kategori.arkiverad ? "Ta fram" : "Arkivera"}
            </OpsButton>
          </span>
        ) : null}
      </div>
    </OpsListRow>
  );

  return (
    <section aria-labelledby={delen.etikettId} className="flex flex-col gap-3">
      {/* ⛔ RUBRIKEN SYNS (0.44.0, bolag-ops#507). CP: "Bra om ... det är en rubrik på varje sektion." Före 0.44.0 bar `rubrik` bara
          listans namn för skärmläsaren, så fyra kataloger på samma sida stod efter varandra utan att säga vad de var, medan kortet
          från modulerna (`OpsModulTyper`) hade en. Nivå 2 under sidans rubrik; "Arkiverade" och "Senaste ändringarna" en nivå under den (`underniva`). */}
      <Delrubrik niva={delen.niva} id={rubrikId}>{rubrik}</Delrubrik>
      {!kanAndra ? (
        <OpsBanner tone="info" title="Du kan läsa katalogen, inte ändra den">
          Konfigurationen ändras av gruppens ägare och admin, eftersom en ändring här ändrar vad alla andra i gruppen ser. Låset sitter i databasens regler, inte i den här vyn.
        </OpsBanner>
      ) : null}

      <OpsList divided ariaLabel={rubrik}>{aktiva.map(rad)}</OpsList>

      {arkiverade.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Delrubrik niva={delen.underniva}>Arkiverade</Delrubrik>
          <OpsList divided ariaLabel="Arkiverade kategorier">{arkiverade.map(rad)}</OpsList>
        </div>
      ) : null}

      {/* ⛔ LOGGEN STÅR HÄR OCH INTE I EN EGEN VY. En logg man måste leta upp
          läses aldrig, och den här ska läsas i samma ögonblick man undrar
          varför en kategori ser annorlunda ut än i går. */}
      {logg.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Delrubrik niva={delen.underniva}>Senaste ändringarna</Delrubrik>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {logg.slice(0, 5).map((rad) => (
              <li key={`${rad.id}-${rad.nar}`} className="flex flex-wrap items-baseline gap-x-2 text-hjalp text-ink-muted">
                <span className="tabular-nums">{String(rad.nar || "").slice(0, 16).replace("T", " ")}</span>
                <span className="text-ink">{beskrivKonfigandring(rad, sprak)}</span>
                {/* ⛔ Vem, när det finns. Utan namnet är loggen en lista över
                    att något hände, vilket är den halva ingen frågar efter. */}
                {rad.av && rad.av.namn ? <span>{rad.av.namn}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {kanAndra && redigerar === null ? (
        <div>
          <OpsButton variant="primary" onClick={() => oppna(null)}>
            Lägg till kategori
          </OpsButton>
        </div>
      ) : null}

      {kanAndra && redigerar !== null ? (
        <div className="flex flex-col gap-3 rounded-base border border-line p-5">
          {fel ? <OpsBanner tone="danger" title="Det gick inte att spara">{fel}</OpsBanner> : null}

          <OpsField label="Nyckel" hint="Ändras aldrig. Varje rad i databasen pekar på den, så en omdöpning senare byter bara namnet och behåller kopplingen." required>
            <OpsInput value={utkast.id} onChange={(v) => setUtkast({ ...utkast, id: v })} disabled={Boolean(redigerar)} name="id" />
          </OpsField>

          <OpsField label="Namn på svenska" required>
            <OpsInput value={utkast.sv} onChange={(v) => setUtkast({ ...utkast, sv: v })} name="sv" />
          </OpsField>

          <OpsField label="Namn på engelska" hint="Saknas det används det svenska, och vakten räknar upp raden.">
            <OpsInput value={utkast.en} onChange={(v) => setUtkast({ ...utkast, en: v })} name="en" />
          </OpsField>

          {/* ⛔ INGEN FÄRGVÄLJARE NÄR KATEGORIERNA SKILJS ÅT MED IKON. Paletten
              har tre platser, så en katalog med fler kategorier än så kan inte
              ge dem var sin, och en väljare som tvingar fram dubbletter är
              värre än ingen. */}
          {farger ? (
            <OpsField label="Färg" hint="En plats i paletten, inte en färgkod. Platserna är mätta mot kontrastgolvet i både ljust och mörkt tema.">
              <OpsSelect
                options={SLAGPLATSER.map((n) => ({ value: String(n), label: `Plats ${n}` }))}
                value={String(utkast.farg)}
                onChange={(v) => setUtkast({ ...utkast, farg: Number(v) })}
              />
            </OpsField>
          ) : null}

          <OpsField label="Ikon" required>
            <OpsSelect options={ikoner.map((n) => ({ value: n, label: n }))} value={utkast.ikon} onChange={(v) => setUtkast({ ...utkast, ikon: v })} />
          </OpsField>

          {/* ⛔ INGEN FASVÄLJARE I EN SORTKATALOG. Fältet finns inte på
              kategorin där, och en rullgardin för något som inte sparas är
              värre än ingen: den som väljer i den tror att valet betyder
              något. */}
          {faser ? (
            <OpsField label="Fas" hint="Ramverkets fem. De går inte att lägga till, så en vy kan fråga om något är klart utan att veta vad kategorin heter.">
              <OpsSelect options={FASER.map((f) => ({ value: f, label: f }))} value={utkast.fas} onChange={(v) => setUtkast({ ...utkast, fas: v })} />
            </OpsField>
          ) : null}

          {textraderna(textnycklar, utkast.texter).length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* ⛔ Rubriken säger vad de ÄR och inte bara att de finns. Utan
                  den meningen ser arton fält ut som administration, och då
                  fylls de i med ett ord var. */}
              <Delrubrik niva={delen.underniva}>Texter, alltså det som gör formuläret begripligt</Delrubrik>
              {textraderna(textnycklar, utkast.texter).map((t) => (
                <div key={t.nyckel} className="flex flex-col gap-2">
                  <OpsField label={`${text(t.etikett, sprak) || t.nyckel}, svenska`} hint={t.hjalp} required>
                    <OpsInput
                      value={(utkast.texter[t.nyckel] || {}).sv || ""}
                      onChange={(v) => setUtkast({ ...utkast, texter: { ...utkast.texter, [t.nyckel]: { ...(utkast.texter[t.nyckel] || { en: "" }), sv: v } } })}
                      name={`texter.${t.nyckel}.sv`}
                    />
                  </OpsField>
                  <OpsField label={`${text(t.etikett, sprak) || t.nyckel}, engelska`}>
                    <OpsInput
                      value={(utkast.texter[t.nyckel] || {}).en || ""}
                      onChange={(v) => setUtkast({ ...utkast, texter: { ...utkast.texter, [t.nyckel]: { ...(utkast.texter[t.nyckel] || { sv: "" }), en: v } } })}
                      name={`texter.${t.nyckel}.en`}
                    />
                  </OpsField>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Delrubrik niva={delen.underniva}>Så här kommer den att se ut</Delrubrik>
            <div className="flex items-center gap-3">
              {farger ? (
                <span
                  className={cx("size-2 shrink-0 rounded-full", slagPrick(utkast.farg, rensa(utkast.sv) || "Utan namn", "OpsKatalogInstallning"))}
                  aria-hidden="true"
                />
              ) : null}
              <span className="min-w-0 break-words text-etikett font-medium text-ink">{rensa(sprak === "en" ? utkast.en || utkast.sv : utkast.sv) || "Utan namn"}</span>
              {faser ? <OpsPill tone="neutral">{utkast.fas}</OpsPill> : null}
            </div>
          </div>

          <div className="flex gap-2">
            <OpsButton variant="primary" onClick={spara}>
              Spara
            </OpsButton>
            <OpsButton variant="ghost" onClick={() => { setRedigerar(null); setFel(null); }}>
              Avbryt
            </OpsButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
