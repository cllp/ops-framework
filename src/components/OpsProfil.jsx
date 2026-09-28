import { useRef, useState } from "react";
import { SPRAK, text } from "../lib/sprak.js";
import { MAX_PRESENTATION, TEMAN } from "../lib/grupp.js";
import { andringen } from "../lib/profil.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsCard } from "./OpsCard.jsx";
import { OpsChip } from "./OpsChip.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { OpsSectionLabel } from "./OpsSectionLabel.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { OpsView, OpsViewHeader } from "./OpsView.jsx";
import { KryssIkon } from "./icons.jsx";

/**
 * Profilvyn: vem du är, hur du vill ha det, och vilka grupper du är med i.
 *
 * ══ ⛔ VARFÖR DEN LIGGER I RAMVERKET (#138) ════════════════════════════
 *
 * CP 2026-09-27: "finns ingen profil nu, och ingen logout." Varje app som
 * bygger sin egen ger den som loggar in i två appar två sorters profil, på två
 * ställen, med två ord för samma sak.
 *
 * ══ ⛔ #156: "PRECIS SOM SESSIONSTUDIO", OCH GRÄNSEN DÄR ═════════════════
 *
 * CP, handover till developer: "vill ha profil precis som SessionStudio."
 * Mätt mot `ProfileView.jsx`: bild, namn, telefon, stad, presentation och
 * länkar är fält varje app med människor behöver, alltså ramverkets. Det
 * KREATIVA (discipliner, roller, instrument, sökbar som gästmedlem) är
 * SessionStudios egna begrepp och hör INTE hit: ramverket vet inte vad ett
 * instrument är, och ska inte veta det. Den gränsen är `children`-sloten
 * sist i den här vyn, samma snitt som mellan `regelfragment` och appens
 * `extra`.
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
 * ══ ⛔ VAD SOM FORTFARANDE INTE GÅR ATT ÄNDRA HÄR, OCH VARFÖR ═════════
 *
 * E-posten är identiteten och kommer ur inloggningen, den ändras aldrig.
 * Radering av konto finns inte heller, och det är ett eget beslut med egna
 * följder (vad händer med `skapadAv` på alla rader personen skrivit).
 *
 * ⛔ NAMN OCH BILD ÄR SEDAN #156 REDIGERBARA (se `src/lib/profil.js`), MEN
 * VYN VET INTE OM DEN ÄNDRINGEN NÅR MEDLEMSLISTORNA. `onSpara` skriver bara
 * `users/{uid}`; att hålla `memberships` i takt kräver att appen ÄVEN
 * anropar en server-callable byggd på `uppdateraProfil`
 * (`@staiger/ops-framework/node`) när `onSpara` ser namn eller bild i
 * andringen. Det är appens jobb, inte vyns: vyn skriver inte själv.
 *
 * ══ ⛔ VYN SKRIVER INTE SJÄLV ══════════════════════════════════════════
 *
 * `onSpara` kommer utifrån, precis som i `OpsKatalogInstallning`. En komponent
 * som skriver till en databas går inte att prova utan en.
 *
 * ══ ⛔ BILDUPPLADDNINGEN GÅR DIREKT, INTE VIA "SPARA" ═══════════════════
 *
 * Alla andra fält samlas i `andring` och skrivs först när man trycker Spara,
 * så ett halvifyllt formulär inte skriver något i onödan. Bilden är
 * annorlunda: en uppladdning ÄR redan en färdig handling (filen ligger i
 * lagringen så fort valet är gjort), och en knapp till för att "spara" den
 * hade bara varit ett extra klick för något som redan hänt. Samma mönster
 * som `byteTema`: det som redan skett skickas direkt, resten väntar.
 *
 * @param {object} props
 * @param {import("../lib/grupp.js").Anvandare} props.anvandare
 * @param {{ grupp: { id: string, namn: any }, roll: string }[]} [props.grupper] Mina grupper, med roll i var och en.
 * @param {(andring: Record<string, any>) => void | Promise<void>} props.onSpara Kallas med `andring` från
 *   `andringen()` när Spara trycks, OCH direkt (bara `{ bild, bildSokvag }`) vid en bilduppladdning/borttagning/återställning.
 * @param {(tema: string) => void} [props.onTema] Kallas direkt vid temabyte, innan sparandet. Se noten ovan.
 * @param {() => void} [props.onLoggaUt]
 * @param {import("../data/storage.js").StorageSource} [props.lagring] Fillagringen för profilbilder. Utan den
 *   döljs Ladda upp/Ta bort, och profilbilden går bara att se, aldrig ändra (ramverket fungerar utan Storage, #156).
 * @param {(uid: string, filnamn: string) => string} [props.bildSokvag] Bygger sökvägen `laddaUpp` skickar in. Förval
 *   `` `profilbilder/${uid}/${Date.now()}-${filnamn}` ``. ⛔ RAMVERKET KÄNNER INTE PREFIXET: appen äger det, precis
 *   som `lagringsregelfragment({ prefix })`. Prefixen MÅSTE stämma överens, annars nekar regeln uppladdningen.
 * @param {string} [props.inloggningsBild] URL:en profilbilden hade vid inloggningen (t.ex. Googles foto). Utan den
 *   döljs "Återställ".
 * @param {ReadonlyArray<{ id: string, label: string }>} [props.plattformar] Länkarnas plattformar. Utan den (eller
 *   tom) döljs "Lägg till länk", men redan sparade länkar visas ändå (en plattform kan tas bort ur listan efter att
 *   någon länkat till den).
 * @param {string} [props.sprak] Språket VYN ritas på. Skilt från personens valda språk, som är det hon ändrar.
 * @param {string} [props.rubrik]
 * @param {string} [props.epostEtikett]
 * @param {string} [props.sprakEtikett]
 * @param {string} [props.temaEtikett]
 * @param {string} [props.grupperEtikett]
 * @param {string} [props.sparaEtikett]
 * @param {string} [props.loggaUtEtikett]
 * @param {string} [props.ingaGrupperText]
 * @param {string} [props.profilbildEtikett]
 * @param {string} [props.laddaUppEtikett]
 * @param {string} [props.taBortEtikett]
 * @param {string} [props.aterstallEtikett]
 * @param {string} [props.personuppgifterEtikett]
 * @param {string} [props.namnEtikett]
 * @param {string} [props.telefonEtikett]
 * @param {string} [props.stadEtikett]
 * @param {string} [props.presentationEtikett]
 * @param {string} [props.lankarEtikett]
 * @param {string} [props.laggTillLankEtikett]
 * @param {string} [props.urlEtikett]
 * @param {string} [props.taBortLankEtikett]
 * @param {Record<string, string>} [props.sprakNamn] Vad språken heter i väljaren.
 * @param {Record<string, string>} [props.temaNamn] Vad temana heter i väljaren.
 * @param {Record<string, string>} [props.rollNamn] Vad rollerna heter på raden.
 * @param {import("react").ReactNode} [props.children] Appens EGNA sektioner (t.ex. SessionStudios kreativa profil),
 *   ritade efter Länkar och före Spara/Logga ut. Ramverket bestämmer platsen, appen innehållet.
 */
export function OpsProfil({
  anvandare,
  grupper = [],
  onSpara,
  onTema,
  onLoggaUt,
  lagring,
  bildSokvag = (uid, filnamn) => `profilbilder/${uid}/${Date.now()}-${filnamn}`,
  inloggningsBild,
  plattformar = [],
  sprak = "sv",
  rubrik = "Profil",
  epostEtikett = "E-post",
  sprakEtikett = "Språk",
  temaEtikett = "Utseende",
  grupperEtikett = "Mina grupper",
  sparaEtikett = "Spara",
  loggaUtEtikett = "Logga ut",
  ingaGrupperText = "Du är inte med i någon grupp än.",
  profilbildEtikett = "Profilbild",
  laddaUppEtikett = "Ladda upp bild",
  taBortEtikett = "Ta bort",
  aterstallEtikett = "Återställ",
  personuppgifterEtikett = "Personuppgifter",
  namnEtikett = "Namn",
  telefonEtikett = "Telefon",
  stadEtikett = "Stad",
  presentationEtikett = "Presentation",
  lankarEtikett = "Länkar",
  laggTillLankEtikett = "Lägg till länk",
  urlEtikett = "url",
  taBortLankEtikett = "Ta bort länken",
  sprakNamn = { sv: "Svenska", en: "Engelska" },
  temaNamn = { system: "Följ enheten", ljust: "Ljust", morkt: "Mörkt" },
  rollNamn = { agare: "Ägare", medlem: "Medlem" },
  children,
}) {
  const [valtSprak, setValtSprak] = useState(anvandare.sprak);
  const [valtTema, setValtTema] = useState(anvandare.tema);
  const [namn, setNamn] = useState(anvandare.namn);
  const [telefon, setTelefon] = useState(anvandare.telefon);
  const [stad, setStad] = useState(anvandare.stad);
  const [presentation, setPresentation] = useState(anvandare.presentation);
  const [lankar, setLankar] = useState(anvandare.lankar);
  const [sparar, setSparar] = useState(false);
  const [bildLaddar, setBildLaddar] = useState(false);
  const [bildFel, setBildFel] = useState("");
  const filValjare = useRef(/** @type {HTMLInputElement | null} */ (null));

  /* ⛔ Beslutet ligger i `andringen`, inte här. Skälet står i profil.js:
     Radix Select går inte att driva i jsdom, så logiken flyttades dit ett
     prov kan se den i stället för att få ett prov som inte kan faila. */
  const { andrat, andring } = andringen(anvandare, { sprak: valtSprak, tema: valtTema, namn, telefon, stad, presentation, lankar });

  const byteTema = (/** @type {string} */ v) => {
    setValtTema(/** @type {any} */ (v));
    // ⛔ Direkt, se noten i filhuvudet. Sparandet följer när man trycker Spara.
    if (onTema) onTema(v);
  };

  const spara = async () => {
    setSparar(true);
    try {
      await onSpara({ ...andring, lankar: [...andring.lankar] });
    } finally {
      setSparar(false);
    }
  };

  /**
   * Läser vald fil, kontrollerar den, laddar upp, och sparar direkt.
   * ⛔ SAMMA GRÄNS SOM SERVERNS `lagringsregelfragment`, MEN FÖRE UPPLADDNINGEN.
   * En kontroll här är en artighet mot den som väljer fel fil: den riktiga
   * gränsen är regeln, som gäller oavsett vad den här funktionen råkar tro.
   * @param {File} fil
   */
  async function ladda(fil) {
    setBildFel("");
    if (!fil.type.startsWith("image/")) {
      setBildFel("Bara bilder går att ladda upp.");
      return;
    }
    if (fil.size >= 2 * 1024 * 1024) {
      setBildFel("Bilden är för stor. Taket är 2 MB.");
      return;
    }
    if (!lagring) return;
    setBildLaddar(true);
    try {
      const sokvag = bildSokvag(anvandare.id, fil.name);
      const uppladdad = await lagring.laddaUpp({ sokvag, fil });
      const gammal = anvandare.bildSokvag;
      await onSpara({ bild: uppladdad.url, bildSokvag: uppladdad.sokvag });
      /*
       * ⛔ DEN GAMLA FILEN STÄDAS EFTERÅT, OCH ETT MISSLYCKAT FÖRSÖK TYSTAS.
       * Den nya bilden är redan sparad: en lagring full av gamla, oanvända
       * filer är ett mindre problem än en person som byter bild och får se
       * ett fel trots att bytet lyckades.
       */
      if (gammal && gammal !== uppladdad.sokvag) {
        lagring.taBort(gammal).catch(() => {});
      }
    } catch (e) {
      setBildFel(e instanceof Error ? e.message : String(e));
    } finally {
      setBildLaddar(false);
    }
  }

  async function taBortBild() {
    setBildFel("");
    setBildLaddar(true);
    try {
      if (lagring && anvandare.bildSokvag) await lagring.taBort(anvandare.bildSokvag);
      await onSpara({ bild: "", bildSokvag: "" });
    } catch (e) {
      setBildFel(e instanceof Error ? e.message : String(e));
    } finally {
      setBildLaddar(false);
    }
  }

  async function aterstallBild() {
    setBildFel("");
    setBildLaddar(true);
    try {
      // ⛔ INGEN bildSokvag: en URL från inloggningsleverantören ligger inte i
      // VÅR lagring, så det finns ingen sökväg att ta bort den från sedan.
      await onSpara({ bild: inloggningsBild ?? "", bildSokvag: "" });
    } finally {
      setBildLaddar(false);
    }
  }

  const obeskrivnaPlattformar = plattformar.filter((p) => !lankar.some((l) => l.plattform === p.id));

  return (
    <OpsView>
      <OpsViewHeader title={rubrik} />

      <div className="flex flex-col gap-2">
        <OpsSectionLabel>{profilbildEtikett}</OpsSectionLabel>
        <OpsCard>
          <div className="flex items-center gap-3">
            <OpsIdentity name={anvandare.namn || anvandare.epost} seed={anvandare.id} imageUrl={anvandare.bild} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{anvandare.namn || anvandare.epost}</p>
              <p className="truncate text-sm text-ink-secondary">
                <span className="sr-only">{epostEtikett}: </span>
                {anvandare.epost}
              </p>
            </div>
          </div>

          {lagring ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={filValjare}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const fil = e.target.files?.[0];
                  e.target.value = "";
                  if (fil) ladda(fil);
                }}
              />
              <OpsButton variant="secondary" size="sm" busy={bildLaddar} onClick={() => filValjare.current?.click()}>
                {laddaUppEtikett}
              </OpsButton>
              {anvandare.bild ? (
                <OpsButton variant="ghost" size="sm" disabled={bildLaddar} onClick={taBortBild}>
                  {taBortEtikett}
                </OpsButton>
              ) : null}
              {inloggningsBild && inloggningsBild !== anvandare.bild ? (
                <OpsButton variant="ghost" size="sm" disabled={bildLaddar} onClick={aterstallBild}>
                  {aterstallEtikett}
                </OpsButton>
              ) : null}
            </div>
          ) : null}
          {bildFel ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {bildFel}
            </p>
          ) : null}
        </OpsCard>
      </div>

      <div className="flex flex-col gap-3">
        <OpsSectionLabel>{personuppgifterEtikett}</OpsSectionLabel>
        <OpsField label={namnEtikett}>
          <OpsInput value={namn} onChange={setNamn} />
        </OpsField>
        <OpsField label={telefonEtikett} hint="T.ex. +46701234567">
          <OpsInput type="tel" value={telefon} onChange={setTelefon} />
        </OpsField>
        <OpsField label={stadEtikett}>
          <OpsInput value={stad} onChange={setStad} />
        </OpsField>
        <OpsField label={presentationEtikett} hint={`${presentation.length}/${MAX_PRESENTATION}`}>
          <OpsTextarea value={presentation} onChange={setPresentation} maxLength={MAX_PRESENTATION} />
        </OpsField>
      </div>

      <div className="flex flex-col gap-2">
        <OpsSectionLabel>{lankarEtikett}</OpsSectionLabel>
        {lankar.length > 0 ? (
          <div className="flex flex-col gap-2">
            {lankar.map((rad, i) => (
              // ⛔ INDEX SOM NYCKEL, MED FLIT: en länkrad har ingen egen
              // identitet innan den sparats (ingen id, ingen unik url ännu),
              // och radernas ANTAL och ORDNING är det enda listan känner till.
              <div key={i} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-sm text-ink-secondary">
                  {plattformar.find((p) => p.id === rad.plattform)?.label || rad.plattform}
                </span>
                <div className="min-w-0 flex-1">
                  <OpsField label={`${rad.plattform} ${urlEtikett}`}>
                    <OpsInput
                      type="url"
                      value={rad.url}
                      onChange={(v) => setLankar(lankar.map((l, j) => (i === j ? { ...l, url: v } : l)))}
                    />
                  </OpsField>
                </div>
                <OpsButton
                  variant="ghost"
                  size="sm"
                  iconOnly
                  ariaLabel={`${taBortLankEtikett}: ${rad.plattform}`}
                  onClick={() => setLankar(lankar.filter((_l, j) => j !== i))}
                >
                  <KryssIkon size={16} />
                </OpsButton>
              </div>
            ))}
          </div>
        ) : null}
        {obeskrivnaPlattformar.length > 0 ? (
          <div>
            <p className="mb-1 text-xs text-ink-secondary">{laggTillLankEtikett}</p>
            <div className="flex flex-wrap gap-2">
              {obeskrivnaPlattformar.map((p) => (
                <OpsChip key={p.id} onClick={() => setLankar([...lankar, { plattform: p.id, url: "" }])}>
                  {p.label}
                </OpsChip>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {children}

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
