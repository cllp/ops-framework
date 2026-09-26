import { useMemo, useState } from "react";
import { cx } from "../lib/cx.js";
import { byggKategori, FASER, valjbara } from "../lib/katalog.js";
import { beskrivKonfigandring } from "../lib/konfiglogg.js";
import { SLAGPLATSER, slagPrick } from "../lib/slag.js";
import { text } from "../lib/sprak.js";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsButton } from "./OpsButton.jsx";
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
 * ══ ⛔ ÄGAREN ÄNDRAR, MEDLEMMEN LÄSER ══════════════════════════════════
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
 * @param {(namn: string) => import("react").ReactNode} [props.ikonRitare] Namn till ikon. Utan den visas namnet som text.
 * @param {boolean} [props.kanAndra] Ur rollerna. Falskt ger en läsvy med skälet utskrivet.
 * @param {(kategori: import("../lib/katalog.js").Kategori) => void} props.onSpara
 * @param {(kategori: import("../lib/katalog.js").Kategori, arkiverad: boolean) => void} props.onArkivera
 * @param {string} [props.sprak]
 * @param {string} [props.rubrik]
 * @param {any[]} [props.logg] Ändringsloggens rader, nyast först. Se `createConfigLog`.
 * @param {readonly {nyckel: string, etikett?: unknown, hjalp?: string}[]} [props.textnycklar] Texterna katalogen kräver. Appen äger listan, eftersom den beror på vad appens vyer ritar.
 */
export function OpsKatalogInstallning({
  kategorier,
  ikoner,
  ikonRitare,
  kanAndra = false,
  onSpara,
  onArkivera,
  sprak = "sv",
  rubrik = "Kategorier",
  logg = [],
  textnycklar = [],
}) {
  if (!Array.isArray(ikoner) || ikoner.length === 0) {
    throw new Error(
      "OpsKatalogInstallning: ikoner krävs och måste ha minst ett namn. Utan tillåtelselista går det att spara en ikon som inte finns, och den blir en tom ruta i varje vy.",
    );
  }

  const [redigerar, setRedigerar] = useState(/** @type {string | null} */ (null));
  const [utkast, setUtkast] = useState(TOMT);
  const [fel, setFel] = useState(/** @type {string | null} */ (null));

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
      farg: kategori.farg,
      ikon: kategori.ikon,
      fas: kategori.fas,
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

      const kategori = byggKategori(
        { id: utkast.id, namn: { sv: utkast.sv, en: utkast.en }, farg: utkast.farg, ikon: utkast.ikon, fas: utkast.fas, ordning: utkast.ordning, texter },
        { ikoner, katalog: rubrik, textnycklar: textnycklar.map((t) => t.nyckel) },
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
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
        {/* ⛔ Ordet skickas med: `slagPrick` vägrar en prick utan det, eftersom en färg utan ord inte går att läsa upp och betyder ingenting för den som inte lärt sig koden. */}
        <span className={cx("size-2 shrink-0 rounded-full", slagPrick(kategori.farg, text(kategori.namn, sprak), "OpsKatalogInstallning"))} aria-hidden="true" />
        <span className="font-medium text-ink">{text(kategori.namn, sprak)}</span>
        <span className="text-sm text-ink-muted">{ikonRitare ? ikonRitare(kategori.ikon) : kategori.ikon}</span>
        <OpsPill tone="neutral">{kategori.fas}</OpsPill>
        {kategori.arkiverad ? <OpsPill tone="warning">Arkiverad</OpsPill> : null}
        {kanAndra ? (
          <span className="ms-auto flex gap-2">
            <OpsButton variant="ghost" onClick={() => oppna(kategori)}>
              Ändra
            </OpsButton>
            <OpsButton variant="ghost" onClick={() => onArkivera(kategori, !kategori.arkiverad)}>
              {kategori.arkiverad ? "Ta fram" : "Arkivera"}
            </OpsButton>
          </span>
        ) : null}
      </div>
    </OpsListRow>
  );

  return (
    <section className="flex flex-col gap-4">
      {!kanAndra ? (
        <OpsBanner tone="info" title="Du kan läsa katalogen, inte ändra den">
          Konfigurationen ändras av ägaren, eftersom en ändring här ändrar vad alla andra ser. Låset sitter i databasens regler, inte i den här vyn.
        </OpsBanner>
      ) : null}

      <OpsList divided ariaLabel={rubrik}>{aktiva.map(rad)}</OpsList>

      {arkiverade.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-sm text-ink-muted">Arkiverade</h3>
          <OpsList divided ariaLabel="Arkiverade kategorier">{arkiverade.map(rad)}</OpsList>
        </div>
      ) : null}

      {/* ⛔ LOGGEN STÅR HÄR OCH INTE I EN EGEN VY. En logg man måste leta upp
          läses aldrig, och den här ska läsas i samma ögonblick man undrar
          varför en kategori ser annorlunda ut än i går. */}
      {logg.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-sm text-ink-muted">Senaste ändringarna</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {logg.slice(0, 5).map((rad) => (
              <li key={`${rad.id}-${rad.nar}`} className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-muted">
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
        <div className="flex flex-col gap-3 rounded-md border border-divider p-4">
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

          <OpsField label="Färg" hint="En plats i paletten, inte en färgkod. Platserna är mätta mot kontrastgolvet i både ljust och mörkt tema.">
            <OpsSelect
              options={SLAGPLATSER.map((n) => ({ value: String(n), label: `Plats ${n}` }))}
              value={String(utkast.farg)}
              onChange={(v) => setUtkast({ ...utkast, farg: Number(v) })}
            />
          </OpsField>

          <OpsField label="Ikon" required>
            <OpsSelect options={ikoner.map((n) => ({ value: n, label: n }))} value={utkast.ikon} onChange={(v) => setUtkast({ ...utkast, ikon: v })} />
          </OpsField>

          <OpsField label="Fas" hint="Ramverkets fem. De går inte att lägga till, så en vy kan fråga om något är klart utan att veta vad kategorin heter.">
            <OpsSelect options={FASER.map((f) => ({ value: f, label: f }))} value={utkast.fas} onChange={(v) => setUtkast({ ...utkast, fas: v })} />
          </OpsField>

          {textraderna(textnycklar, utkast.texter).length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* ⛔ Rubriken säger vad de ÄR och inte bara att de finns. Utan
                  den meningen ser arton fält ut som administration, och då
                  fylls de i med ett ord var. */}
              <h3 className="m-0 text-sm text-ink-muted">Texter, alltså det som gör formuläret begripligt</h3>
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
            <h3 className="m-0 text-sm text-ink-muted">Så här kommer den att se ut</h3>
            <div className="flex items-center gap-3">
              <span
                className={cx("size-2 shrink-0 rounded-full", slagPrick(utkast.farg, rensa(utkast.sv) || "Utan namn", "OpsKatalogInstallning"))}
                aria-hidden="true"
              />
              <span className="font-medium text-ink">{rensa(sprak === "en" ? utkast.en || utkast.sv : utkast.sv) || "Utan namn"}</span>
              <OpsPill tone="neutral">{utkast.fas}</OpsPill>
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
