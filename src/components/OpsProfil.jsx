import { useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { SPRAK, text } from "../lib/sprak.js";
import { MAX_PRESENTATION, TEMAN, PROFILIKONER, PROFILFARGER } from "../lib/grupp.js";
import { andringen } from "../lib/profil.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsCard } from "./OpsCard.jsx";
import { OpsChip } from "./OpsChip.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { PROFILIKON_KOMPONENT } from "../lib/profilikoner.js";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsPill } from "./OpsPill.jsx";
import { OpsSectionLabel } from "./OpsSectionLabel.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { OpsView, OpsViewHeader } from "./OpsView.jsx";
import { KryssIkon } from "./icons.jsx";

/**
 * ⛔ SAMMA MÖNSTER SOM `TONKLASSER` I `OpsIdentity.jsx`, UTSKRIVET AV SAMMA
 * SKÄL: Tailwind hittar bara klasser den kan LÄSA i källkoden, och
 * `` `bg-identity-${id}` `` hade byggt en tom klass. `PROFILFARGER` (grupp.js)
 * äger ID:NA, den här kartan äger bara CSS-klassen för respektive id.
 */
const FARGKLASSER = {
  1: "bg-identity-1",
  2: "bg-identity-2",
  3: "bg-identity-3",
  4: "bg-identity-4",
  5: "bg-identity-5",
  6: "bg-identity-6",
};

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
 * @param {string} [props.roll] Personens EGEN roll, som en liten pill bredvid namnet (#164, korrigering C:
 *   "rollen som en liten pill", t.ex. "Studio Admin"). Ramverket vet inte vad rollen HETER, appen skickar in
 *   den redan översatta texten. Utelämnad ritas ingen pill: rollbegreppet är appens, inte ramverkets.
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
 * @param {string} [props.laddaUppEtikett] Knappen som öppnar filväljaren. #164: förval "Byt" (var "Ladda upp bild").
 * @param {string} [props.taBortEtikett]
 * @param {string} [props.aterstallEtikett]
 * @param {string} [props.valjIkonEtikett] Rubriken över ikonraden (#164, korrigering C).
 * @param {string} [props.fargEtikett] Rubriken över färgraden (#164, korrigering C).
 * @param {string} [props.anvandInitialerEtikett] Knappen som nollställer bild OCH ikon (#164, korrigering C).
 * @param {Record<string, string>} [props.ikonNamn] Vad varje `PROFILIKONER`-id heter i väljarens skärmläsarnamn.
 * @param {string} [props.personuppgifterEtikett]
 * @param {string} [props.namnEtikett]
 * @param {string} [props.telefonEtikett]
 * @param {string} [props.stadEtikett]
 * @param {string} [props.presentationEtikett]
 * @param {string} [props.lankarEtikett]
 * @param {string} [props.installningarEtikett] Rubriken över Språk och Utseende. Utan den låg de två fälten under
 *   närmast föregående rubrik, alltså under Länkar, och såg ut som länkinställningar.
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
  roll,
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
  laddaUppEtikett = "Byt",
  taBortEtikett = "Ta bort",
  aterstallEtikett = "Återställ",
  valjIkonEtikett = "Välj standardikon",
  fargEtikett = "Färg",
  anvandInitialerEtikett = "Använd initialer",
  ikonNamn = { person: "Person", stjarna: "Stjärna", hjarta: "Hjärta", blixt: "Blixt", leende: "Leende", krona: "Krona" },
  personuppgifterEtikett = "Personuppgifter",
  namnEtikett = "Namn",
  telefonEtikett = "Telefon",
  stadEtikett = "Stad",
  presentationEtikett = "Presentation",
  lankarEtikett = "Länkar",
  installningarEtikett = "Inställningar",
  laggTillLankEtikett = "Lägg till länk",
  urlEtikett = "url",
  taBortLankEtikett = "Ta bort länken",
  sprakNamn = { sv: "Svenska", en: "Engelska" },
  temaNamn = { system: "Följ enheten", ljust: "Ljust", morkt: "Mörkt" },
  rollNamn = { agare: "Ägare", admin: "Admin", medlem: "Medlem" },
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

  /**
   * Väljer en standardikon: sparar DIREKT, som bilduppladdningen. #164,
   * korrigering C. ⛔ RENSAR OCKSÅ `bild`: `OpsIdentity` ritar bilden FÖRE
   * ikonen när båda finns, så en ikon vald ovanpå en kvarvarande bild hade
   * synts som "inget hände".
   * @param {string} id
   */
  async function valjIkon(id) {
    setBildFel("");
    setBildLaddar(true);
    try {
      await onSpara({ ikon: id, bild: "", bildSokvag: "" });
    } catch (e) {
      setBildFel(e instanceof Error ? e.message : String(e));
    } finally {
      setBildLaddar(false);
    }
  }

  /**
   * Väljer en bakgrundsfärg för märket. Fungerar oavsett om man visar en
   * ikon eller initialer just nu (#164). Sparas direkt, av samma skäl som
   * `valjIkon`.
   * @param {string} id
   */
  async function valjFarg(id) {
    setBildFel("");
    setBildLaddar(true);
    try {
      await onSpara({ farg: id });
    } catch (e) {
      setBildFel(e instanceof Error ? e.message : String(e));
    } finally {
      setBildLaddar(false);
    }
  }

  /**
   * "Använd initialer": nollställer BÅDE bild och ikon. Färgen (om vald)
   * ligger kvar som bakgrund bakom initialerna, precis som den redan gör
   * bakom en ikon (#164).
   */
  async function anvandInitialer() {
    setBildFel("");
    setBildLaddar(true);
    try {
      await onSpara({ bild: "", bildSokvag: "", ikon: "" });
    } catch (e) {
      setBildFel(e instanceof Error ? e.message : String(e));
    } finally {
      setBildLaddar(false);
    }
  }

  const obeskrivnaPlattformar = plattformar.filter((p) => !lankar.some((l) => l.plattform === p.id));

  /*
   * ══ ⛔ 0.32.1: SS FORM, MÄTT MOT `ProfileView.jsx` ═══════════════════
   *
   * CP 2026-09-30, med en skärmbild av Profil på dator: "Typsnitten på profil är också fel. Storlek / typsnitt".
   *   - KOLUMNEN ÄR 672 px (`width="narrow"`), SS `max-w-2xl mx-auto` (`ProfileView.jsx:106`). Förut `normal` (1024).
   *   - VARJE SEKTION ÄR ETT KORT MED RUBRIKEN INUTI, SS `rounded border p-5` med `h3 ... mb-3` först (`:121-122`, `:241-242`).
   *     Förut stod rubriken ovanför, och Personuppgifter hade inget kort alls.
   *   - FÄLTETIKETTERNA ÄR 10 px, 400, DÄMPADE (`labelSize="liten"`), SS `text-[10px] text-[var(--color-text-muted)]` (`:245`).
   *     Förut 14/500, formulärens storlek, som i en profil med fyra fält läses som fyra rubriker.
   *   - NAMN, TELEFON OCH STAD STÅR I TRE KOLUMNER FRÅN `sm`, SS `grid grid-cols-1 sm:grid-cols-3 gap-3` (`:243`).
   * Vakten är check-skalyta avsnitt 27, vid 390 och 1280.
   */
  return (
    <OpsView width="narrow">
      <OpsViewHeader title={rubrik} />

      <div className="flex flex-col gap-2">
        <OpsCard kant>
          <div className="mb-3">
            <OpsSectionLabel>{profilbildEtikett}</OpsSectionLabel>
          </div>
          <div className="flex items-center gap-3">
            <OpsIdentity
              name={anvandare.namn || anvandare.epost}
              seed={anvandare.id}
              imageUrl={anvandare.bild}
              icon={!anvandare.bild && anvandare.ikon ? PROFILIKON_KOMPONENT[/** @type {keyof typeof PROFILIKON_KOMPONENT} */ (anvandare.ikon)] : undefined}
              tone={anvandare.farg ? /** @type {any} */ (Number(anvandare.farg)) : undefined}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-ink">{anvandare.namn || anvandare.epost}</p>
                {/* ⛔ #164, korrigering C: "rollen som en liten pill" bredvid namnet. Ritas bara
                    när appen skickar en, eftersom rollens ORD är appens (t.ex. "Studio Admin"). */}
                {roll ? <OpsPill tone="neutral">{roll}</OpsPill> : null}
              </div>
              <p className="truncate text-etikett text-ink-secondary">
                <span className="sr-only">{epostEtikett}: </span>
                {anvandare.epost}
              </p>
            </div>
          </div>

          {/* ⛔ #164, korrigering C: IKON OCH FÄRG KRÄVER INGEN LAGRING, till skillnad
              från uppladdningsraden nedanför. Två strängar i `users/{uid}`, inga filer. */}
          <div className="mt-3 flex flex-col gap-2">
            <div>
              <p className="mb-1 text-meta text-ink-secondary">{valjIkonEtikett}</p>
              <div role="group" aria-label={valjIkonEtikett} className="flex flex-wrap gap-2">
                {PROFILIKONER.map((id) => {
                  const Ikon = PROFILIKON_KOMPONENT[id];
                  const vald = !anvandare.bild && anvandare.ikon === id;
                  return (
                    <OpsButton
                      key={id}
                      variant={vald ? "secondary" : "ghost"}
                      size="sm"
                      iconOnly
                      ariaLabel={ikonNamn[id] || id}
                      disabled={bildLaddar}
                      onClick={() => valjIkon(id)}
                    >
                      <Ikon size={18} />
                    </OpsButton>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-1 text-meta text-ink-secondary">{fargEtikett}</p>
              <div role="group" aria-label={fargEtikett} className="flex flex-wrap gap-2">
                {PROFILFARGER.map((id) => {
                  const vald = anvandare.farg === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-label={`${fargEtikett} ${id}`}
                      aria-pressed={vald}
                      disabled={bildLaddar}
                      onClick={() => valjFarg(id)}
                      className={cx(
                        // ⛔ KLASSNAMNEN STÅR UTSKRIVNA, INTE `bg-identity-${id}`. Samma skäl
                        // som `TONKLASSER` i `OpsIdentity.jsx`: en interpolerad sträng genererar
                        // ingen CSS i Tailwinds build, bara i utvecklingsläget.
                        "size-6 shrink-0 rounded-full",
                        FARGKLASSER[id],
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        // ⛔ RINGEN, INTE EN IFYLLD PLATTA: samma "du är här"-mönster som
                        // `OpsIconLink`s aktiva länk, en ring runt den valda pricken.
                        vald ? "ring-2 ring-offset-2 ring-accent ring-offset-surface" : "cursor-pointer",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {lagring ? (
              <>
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
              </>
            ) : null}
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
            {/* ⛔ "ANVÄND INITIALER" RITAS ÄVEN UTAN `lagring`: den nollställer ikonen
                lika gärna som bilden, och kräver ingen Storage. */}
            {anvandare.bild || anvandare.ikon ? (
              <OpsButton variant="ghost" size="sm" disabled={bildLaddar} onClick={anvandInitialer}>
                {anvandInitialerEtikett}
              </OpsButton>
            ) : null}
          </div>
          {bildFel ? (
            <p role="alert" className="mt-2 text-etikett text-danger">
              {bildFel}
            </p>
          ) : null}
        </OpsCard>
      </div>

      <OpsCard kant>
        <div className="mb-3">
          <OpsSectionLabel>{personuppgifterEtikett}</OpsSectionLabel>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OpsField label={namnEtikett} labelSize="liten">
              <OpsInput value={namn} onChange={setNamn} />
            </OpsField>
            <OpsField label={telefonEtikett} hint="T.ex. +46701234567" labelSize="liten">
              <OpsInput type="tel" value={telefon} onChange={setTelefon} />
            </OpsField>
            <OpsField label={stadEtikett} labelSize="liten">
              <OpsInput value={stad} onChange={setStad} />
            </OpsField>
          </div>
          <OpsField label={presentationEtikett} hint={`${presentation.length}/${MAX_PRESENTATION}`} labelSize="liten">
            <OpsTextarea value={presentation} onChange={setPresentation} maxLength={MAX_PRESENTATION} />
          </OpsField>
        </div>
      </OpsCard>

      {/* ⛔ LÄNKSEKTIONEN RITAS BARA NÄR APPEN HAR PLATTFORMAR. Utan `plattformar` finns
          inget att lägga till, och en rubrik "Länkar" över ingenting följdes av Språk
          och Utseende, som då såg ut att höra till länkarna (skärmbild #164, 2026-09-28).
          Tomheten är ett svar i appens beslut att inte skicka plattformar, inte en rad här. */}
      {plattformar.length > 0 || lankar.length > 0 ? (
      <OpsCard kant>
        <div className="mb-3">
          <OpsSectionLabel>{lankarEtikett}</OpsSectionLabel>
        </div>
        <div className="flex flex-col gap-2">
        {lankar.length > 0 ? (
          <div className="flex flex-col gap-2">
            {lankar.map((rad, i) => (
              // ⛔ INDEX SOM NYCKEL, MED FLIT: en länkrad har ingen egen
              // identitet innan den sparats (ingen id, ingen unik url ännu),
              // och radernas ANTAL och ORDNING är det enda listan känner till.
              <div key={i} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-etikett text-ink-secondary">
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
            <p className="mb-1 text-meta text-ink-secondary">{laggTillLankEtikett}</p>
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
      </OpsCard>
      ) : null}

      {children}

      <OpsCard kant>
        <div className="mb-3">
          <OpsSectionLabel>{installningarEtikett}</OpsSectionLabel>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OpsField label={sprakEtikett} labelSize="liten">
            <OpsSelect
              options={SPRAK.map((s) => ({ value: s, label: sprakNamn[s] || s }))}
              value={valtSprak}
              onChange={(v) => setValtSprak(v)}
            />
          </OpsField>

          <OpsField label={temaEtikett} labelSize="liten">
            <OpsSelect options={TEMAN.map((t) => ({ value: t, label: temaNamn[t] || t }))} value={valtTema} onChange={byteTema} />
          </OpsField>
        </div>
      </OpsCard>

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
      {/* ⛔ 0.32.1: samma sektionsrubrik som korten ovanför. Förut en egen `text-etikett font-semibold` i sekundärfärg. */}
      <OpsSectionLabel>{grupperEtikett}</OpsSectionLabel>
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
