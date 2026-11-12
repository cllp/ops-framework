import { useEffect, useId, useRef, useState } from "react";
import { definierade, forvalda } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { SPRAK, text } from "../lib/sprak.js";
import { MAX_PRESENTATION } from "../lib/grupp.js";
import { PROFILENS_FALT, andringen } from "../lib/profil.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsCard } from "./OpsCard.jsx";
import { OpsChip } from "./OpsChip.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsGruppmarkeValjare } from "./OpsGruppmarkeValjare.jsx";
import { personmarkeProps } from "../lib/gruppikoner.js";
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
 * ══ ⛔ #202: PROFILEN DUPLICERAR INTE KONTROLLER SOM REDAN HAR EN PLATS ═
 *
 * CP 2026-09-30: "I Min profil: ta bort 1. Utseende (finns redan i headern,
 * temaväljare) 2. Logga ut (finns redan under meny). Profilen ska inte
 * duplicera kontroller som redan har en tydlig plats." Temaväljaren är en
 * `OpsThemeToggle` i skalets `actions`, och Logga ut är menyns sista rad
 * (`meny.onLoggaUt`). Vyn har därför varken `onTema`, `onLoggaUt`,
 * `temaEtikett`, `temaNamn` eller `loggaUtEtikett` längre. Språk är kvar: det
 * har ingen annan plats. `users/{uid}.tema` finns kvar i datamodellen och
 * `andringen()` skickar med det sparade värdet orört; att temaknappen i
 * headern ÄVEN skriver det till raden är appens val, inte vyns.
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
 * (`ops-framework/node`) när `onSpara` ser namn eller bild i
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
 * hade bara varit ett extra klick för något som redan hänt. Samma sak för
 * Ta bort, Återställ och Använd initialer, som rör bilden.
 *
 * ══ ⛔ IKON OCH FÄRG: DIREKT, ELLER MED SPARA I `falt`-LÄGET (cllp/lifehub.app#786) ═
 *
 * Väljaren är gruppens (`OpsGruppmarkeValjare`, `person`): tolv kulörer, ett reglage för alla 360, återställning till
 * kulören ur id:t, och ikonkatalogen med sökning. Samma val som Identitys profil (lifehub.identity `markevaljare.ts`).
 * Utan `falt` sparas ett val direkt, som före #786 (bolag-ops och tam sparar i sin egen rad). Med `falt` ligger valet i
 * utkastet, syns i märket direkt, och skrivs med Spara: med ett reglage hade det annars blivit en sparning per steg medan
 * man drar, och ett konto som tar emot profilen (Identity) har ett tak per minut.
 *
 * ══ ⛔ TRE SÄTT ATT BÄRA BILDEN, OCH APPEN VÄLJER (cllp/lifehub.app#786) ═
 *
 * - `lagring`: appens egen uppladdning (Byt, Ta bort, Återställ), som förut.
 * - `utanBild` (sant eller falskt) och ingen `lagring`: bilden är inloggningens (`inloggningsBild`), och det enda valet
 *   är att visa den eller inte. EN knapp, "Visa inte bilden" eller "Visa bilden", och Spara skickar `utanBild`.
 *   Varken Ta bort eller Återställ, som skickar `bild` som text: ett konto som äger bilden tar inte emot en adress.
 * - ingetdera: profilbilden visas, och bara ikon och färg går att välja.
 *
 * ══ ⛔ `falt`: BARA DET APPEN SPARAR (cllp/lifehub.app#786) ═══════════════
 *
 * Med `falt` ritas bara de fälten, och Spara skickar bara de av dem som ändrats (`andringen`). Utan `falt` skickas
 * hela raden, som förut. Ett konto som äger personen nekar `lankar` och `tema`, så en app som sparar dit listar fälten.
 *
 * @param {object} props
 * @param {import("../lib/grupp.js").Anvandare} props.anvandare
 * @param {string} [props.roll] Personens EGEN roll, som en liten pill bredvid namnet (#164, korrigering C:
 *   "rollen som en liten pill", t.ex. "Studio Admin"). Ramverket vet inte vad rollen HETER, appen skickar in
 *   den redan översatta texten. Utelämnad ritas ingen pill: rollbegreppet är appens, inte ramverkets.
 * @param {{ grupp: { id: string, namn: any }, roll: string }[]} [props.grupper] Mina grupper, med roll i var och en.
 * @param {(andring: Record<string, any>) => void | Promise<void>} [props.onSpara] Kallas med `andring` från
 *   `andringen()` när Spara trycks, OCH direkt (bara `{ bild, bildSokvag }`, med `ikon` för Använd initialer) vid en
 *   bilduppladdning/borttagning/återställning. Krävs utom i kontolägets skrivskyddade form (`konto.href`).
 * @param {ReadonlyArray<"sprak"|"tema"|"namn"|"telefon"|"stad"|"presentation"|"lankar"|"bild"|"bildSokvag"|"ikon"|"farg"|"utanBild">} [props.falt]
 *   (cllp/lifehub.app#786) Fälten appen sparar. Bara de ritas, och Spara skickar bara de av dem som ändrats. Ett okänt
 *   namn kastar. Utelämnad: alla fält ritas och Spara skickar hela raden, som förut.
 * @param {boolean} [props.utanBild] (cllp/lifehub.app#786) Om personen valt att inte visa bilden, när bilden är
 *   inloggningens och inte appens egen. Sant eller falskt, och ingen `lagring`: bildraden blir en knapp som visar eller
 *   döljer `inloggningsBild`, och Spara skickar `utanBild`. Utelämnad: som förut.
 * @param {import("../data/storage.js").StorageSource} [props.lagring] Fillagringen för profilbilder. Utan den
 *   döljs Ladda upp/Ta bort, och profilbilden går bara att se, aldrig ändra (ramverket fungerar utan Storage, #156).
 * @param {(uid: string, filnamn: string) => string} [props.bildSokvag] Bygger sökvägen `laddaUpp` skickar in. Förval
 *   `` `profilbilder/${uid}/${Date.now()}-${filnamn}` ``. ⛔ RAMVERKET KÄNNER INTE PREFIXET: appen äger det, precis
 *   som `lagringsregelfragment({ prefix })`. Prefixen MÅSTE stämma överens, annars nekar regeln uppladdningen.
 * @param {string} [props.inloggningsBild] URL:en profilbilden hade vid inloggningen (t.ex. Googles foto). Utan den
 *   döljs "Återställ", och med `utanBild` knappen som visar eller döljer bilden.
 * @param {ReadonlyArray<{ id: string, label: string }>} [props.plattformar] Länkarnas plattformar. Utan den (eller
 *   tom) döljs "Lägg till länk", men redan sparade länkar visas ändå (en plattform kan tas bort ur listan efter att
 *   någon länkat till den).
 * @param {string} [props.sprak] Språket VYN ritas på. Skilt från personens valda språk, som är det hon ändrar.
 * @param {string} [props.rubrik]
 * @param {string} [props.epostEtikett]
 * @param {string} [props.sprakEtikett]
 * @param {string} [props.grupperEtikett]
 * @param {string} [props.sparaEtikett]
 * @param {string} [props.sparaVantarEtikett] Verbet medan Spara väntar.
 * @param {string | ((fel: unknown) => string | undefined)} [props.sparaFelText] (cllp/lifehub.app#786) Texten när `onSpara` avslås,
 *   eller en funktion som får felet och ger texten (appen känner sina felkoder: ett tak per minut, ett fält i fel form). Tom eller
 *   utelämnad: `sparaFelForval`. Texten står med `role="alert"` bredvid Spara, och utkastet står kvar.
 * @param {string} [props.sparaFelForval] Förvalet när appen inte ger någon text.
 * @param {string} [props.ingaGrupperText]
 * @param {string} [props.profilbildEtikett]
 * @param {string} [props.laddaUppEtikett] Knappen som öppnar filväljaren. #164: förval "Byt" (var "Ladda upp bild").
 * @param {string} [props.taBortEtikett]
 * @param {string} [props.aterstallEtikett]
 * @param {string} [props.visaBildEtikett] Knappen som visar inloggningens bild igen (`utanBild`).
 * @param {string} [props.doljBildEtikett] Knappen som döljer inloggningens bild (`utanBild`).
 * @param {string} [props.valjIkonEtikett] Rubriken över ikonerna. Förval "Ikon eller initialer" sedan cllp/lifehub.app#786.
 * @param {string} [props.fargEtikett] Rubriken över kulörerna.
 * @param {string} [props.initialerEtikett] Knappen "Aa" som väljer initialerna.
 * @param {string} [props.kulorExakt]
 * @param {string} [props.kulorGrader]
 * @param {string} [props.kulorAterstall] Reglagets återställning till kulören ur personens id.
 * @param {string} [props.kulorHint]
 * @param {string} [props.sokIkon]
 * @param {string} [props.sokIkonPlatshallare]
 * @param {string} [props.senastAnvanda]
 * @param {string} [props.senastInga]
 * @param {string} [props.vanliga]
 * @param {string} [props.traffar]
 * @param {string} [props.traffarStatus] `{n}` byts mot antalet.
 * @param {string} [props.ingetMatchar]
 * @param {string} [props.ingaTraffar] `{fraga}` byts mot det som skrivits.
 * @param {string} [props.anvandInitialerEtikett] Knappen som nollställer bild OCH ikon (#164, korrigering C).
 * @param {Record<string, string>} [props.ikonNamn] Används inte sedan cllp/lifehub.app#786: katalogens ikoner har egna
 *   namn på båda språken. Tas emot så att en app som skickar den inte går sönder.
 * @param {string} [props.personuppgifterEtikett]
 * @param {string} [props.namnEtikett]
 * @param {string} [props.telefonEtikett]
 * @param {string} [props.telefonHint] Exemplet under telefonfältet, på vyns språk (cllp/lifehub.app#786; var hårdkodad svenska).
 * @param {string} [props.stadEtikett]
 * @param {string} [props.presentationEtikett]
 * @param {string} [props.lankarEtikett]
 * @param {string} [props.installningarEtikett] Rubriken över Språk. Utan den låg fältet under närmast föregående
 *   rubrik, alltså under Länkar, och såg ut som en länkinställning.
 * @param {string} [props.laggTillLankEtikett]
 * @param {string} [props.urlEtikett]
 * @param {string} [props.taBortLankEtikett]
 * @param {Record<string, string>} [props.sprakNamn] Vad språken heter i väljaren.
 * @param {Record<string, string>} [props.rollNamn] Vad rollerna heter på raden.
 * @param {import("react").ReactNode} [props.children] Appens EGNA sektioner (t.ex. SessionStudios kreativa profil),
 *   ritade efter Länkar och före Spara/Logga ut. Ramverket bestämmer platsen, appen innehållet.
 * @param {{ href: string } | { sakerhetHref?: string, raderaHref?: string }} [props.konto] Personen ägs av ett konto
 *   utanför appen (LifeHubs Identity). Två former:
 *   `{ href }` (0.53.0, cllp/lifehub.app#32): personen ritas skrivskyddad med länken "Ändra i Mitt konto", inga fält och
 *   ingen Spara. `onSpara` anropas aldrig. Grupperna och appens egna sektioner står kvar.
 *   `{ sakerhetHref, raderaHref }` (cllp/lifehub.app#786): formuläret är redigerbart och sparar genom `onSpara`, och
 *   kontot får en sektion med länkarna "Inloggning och säkerhet" och "Radera kontot", dit det som inte hör till appen
 *   bor. Minst en av dem krävs. ⛔ `href` ihop med någon av dem kastar: två lägen, en vy kan inte vara båda.
 * @param {string} [props.kontoText]
 * @param {string} [props.kontoLankEtikett]
 * @param {string} [props.kontoRedigerbarText] Meningen under personen i det redigerbara kontoläget.
 * @param {string} [props.kontoRubrik] Rubriken över kontots länkar.
 * @param {string} [props.kontoSakerhetEtikett]
 * @param {string} [props.kontoRaderaEtikett]
 */
function OpsProfilRitad({
  anvandare,
  roll,
  grupper = [],
  onSpara,
  falt,
  utanBild,
  lagring,
  bildSokvag = (uid, filnamn) => `profilbilder/${uid}/${Date.now()}-${filnamn}`,
  inloggningsBild,
  plattformar = [],
  sprak = "sv",
  rubrik = ORD_OPSPROFIL.rubrik.sv,
  epostEtikett = ORD_OPSPROFIL.epostEtikett.sv,
  sprakEtikett = ORD_OPSPROFIL.sprakEtikett.sv,
  grupperEtikett = ORD_OPSPROFIL.grupperEtikett.sv,
  sparaEtikett = ORD_OPSPROFIL.sparaEtikett.sv,
  sparaVantarEtikett = ORD_OPSPROFIL.sparaVantarEtikett.sv,
  sparaFelText,
  sparaFelForval = ORD_OPSPROFIL.sparaFelForval.sv,
  ingaGrupperText = ORD_OPSPROFIL.ingaGrupperText.sv,
  profilbildEtikett = ORD_OPSPROFIL.profilbildEtikett.sv,
  laddaUppEtikett = ORD_OPSPROFIL.laddaUppEtikett.sv,
  taBortEtikett = ORD_OPSPROFIL.taBortEtikett.sv,
  aterstallEtikett = ORD_OPSPROFIL.aterstallEtikett.sv,
  visaBildEtikett = ORD_OPSPROFIL.visaBildEtikett.sv,
  doljBildEtikett = ORD_OPSPROFIL.doljBildEtikett.sv,
  valjIkonEtikett = ORD_OPSPROFIL.valjIkonEtikett.sv,
  fargEtikett = ORD_OPSPROFIL.fargEtikett.sv,
  initialerEtikett = ORD_OPSPROFIL.initialerEtikett.sv,
  kulorExakt = ORD_OPSPROFIL.kulorExakt.sv,
  kulorGrader = ORD_OPSPROFIL.kulorGrader.sv,
  kulorAterstall = ORD_OPSPROFIL.kulorAterstall.sv,
  kulorHint = ORD_OPSPROFIL.kulorHint.sv,
  sokIkon = ORD_OPSPROFIL.sokIkon.sv,
  sokIkonPlatshallare = ORD_OPSPROFIL.sokIkonPlatshallare.sv,
  senastAnvanda = ORD_OPSPROFIL.senastAnvanda.sv,
  senastInga = ORD_OPSPROFIL.senastInga.sv,
  vanliga = ORD_OPSPROFIL.vanliga.sv,
  traffar = ORD_OPSPROFIL.traffar.sv,
  traffarStatus = ORD_OPSPROFIL.traffarStatus.sv,
  ingetMatchar = ORD_OPSPROFIL.ingetMatchar.sv,
  ingaTraffar = ORD_OPSPROFIL.ingaTraffar.sv,
  anvandInitialerEtikett = ORD_OPSPROFIL.anvandInitialerEtikett.sv,
  personuppgifterEtikett = ORD_OPSPROFIL.personuppgifterEtikett.sv,
  namnEtikett = ORD_OPSPROFIL.namnEtikett.sv,
  telefonEtikett = ORD_OPSPROFIL.telefonEtikett.sv,
  telefonHint = ORD_OPSPROFIL.telefonHint.sv,
  stadEtikett = ORD_OPSPROFIL.stadEtikett.sv,
  presentationEtikett = ORD_OPSPROFIL.presentationEtikett.sv,
  lankarEtikett = ORD_OPSPROFIL.lankarEtikett.sv,
  installningarEtikett = ORD_OPSPROFIL.installningarEtikett.sv,
  laggTillLankEtikett = ORD_OPSPROFIL.laggTillLankEtikett.sv,
  urlEtikett = ORD_OPSPROFIL.urlEtikett.sv,
  taBortLankEtikett = ORD_OPSPROFIL.taBortLankEtikett.sv,
  sprakNamn = { sv: "Svenska", en: "Engelska" },
  rollNamn = { agare: "Ägare", admin: "Admin", medlem: "Medlem" },
  konto,
  kontoText = ORD_OPSPROFIL.kontoText.sv,
  kontoLankEtikett = ORD_OPSPROFIL.kontoLankEtikett.sv,
  kontoRedigerbarText = ORD_OPSPROFIL.kontoRedigerbarText.sv,
  kontoRubrik = ORD_OPSPROFIL.kontoRubrik.sv,
  kontoSakerhetEtikett = ORD_OPSPROFIL.kontoSakerhetEtikett.sv,
  kontoRaderaEtikett = ORD_OPSPROFIL.kontoRaderaEtikett.sv,
  children,
}) {
  const markeId = useId();
  /*
   * ══ ⛔ UTKASTET ÄR BARA DET PERSONEN RÖRT (cllp/lifehub.app#786, granskningen 8b) ═══════════════════════════════════
   *
   * Förut var varje fält ett `useState` ur den FÖRSTA `anvandare`, och en profil som ändrades utifrån (en annan flik, appens
   * omläsning efter en sparning, en annan person i samma vy) stod kvar med de gamla värdena. Nu står bara de fält personen
   * ändrat i utkastet, och resten läses ur `anvandare` vid varje ritning. Regeln:
   *   - ett fält i utkastet släpps när den sparade raden kommit ikapp det (samma värde), alltså efter en lyckad sparning;
   *   - ett fält personen ändrat och som skiljer sig från raden står kvar, också när raden ändras: mitt i en ändring vinner personen;
   *   - en annan person (`anvandare.id`) tömmer utkastet helt.
   */
  const [utkastet, setUtkastet] = useState(/** @type {Record<string, any>} */ ({}));
  const satt = (/** @type {string} */ f, /** @type {any} */ v) => setUtkastet((u) => ({ ...u, [f]: v }));
  const [sparar, setSparar] = useState(false);
  const [sparaFel, setSparaFel] = useState("");
  const [bildLaddar, setBildLaddar] = useState(false);
  const [bildFel, setBildFel] = useState("");
  const filValjare = useRef(/** @type {HTMLInputElement | null} */ (null));

  const kontoLasning = Boolean(konto && "href" in konto && konto.href !== undefined);
  const kontoLankar = konto && !kontoLasning ? /** @type {{ sakerhetHref?: string, raderaHref?: string }} */ (konto) : null;
  if (konto && kontoLasning && ("sakerhetHref" in konto || "raderaHref" in konto)) {
    throw new Error("OpsProfil: konto.href (skrivskyddad) och konto.sakerhetHref/raderaHref (redigerbar) går inte ihop. Skicka det ena.");
  }
  if (kontoLankar && !kontoLankar.sakerhetHref && !kontoLankar.raderaHref) {
    throw new Error("OpsProfil: konto utan href behöver sakerhetHref eller raderaHref, adresserna dit det som inte hör till appen bor.");
  }
  if (!kontoLasning && typeof onSpara !== "function") {
    throw new Error("OpsProfil: onSpara krävs när profilen går att ändra. Bara kontolägets skrivskyddade form (konto.href) klarar sig utan.");
  }

  const visas = (/** @type {string} */ f) => !falt || falt.includes(/** @type {any} */ (f));
  const doldBildLage = !lagring && typeof utanBild === "boolean";
  const bas = doldBildLage ? { ...anvandare, utanBild } : anvandare;
  const nu = /** @type {typeof bas & { utanBild?: boolean }} */ ({ ...bas, ...utkastet });
  const { sprak: valtSprak, namn, telefon, stad, presentation, lankar } = nu;

  // Regeln ovan, i två steg. En annan person: tomt utkast.
  useEffect(() => {
    setUtkastet({});
  }, [anvandare.id]);
  // Den sparade raden har kommit ikapp ett fält: fältet släpps ur utkastet.
  const sparadNyckel = JSON.stringify(PROFILENS_FALT.map((f) => /** @type {any} */ (bas)[f] ?? null));
  useEffect(() => {
    setUtkastet((u) => {
      const kvar = Object.fromEntries(Object.entries(u).filter(([f, v]) => JSON.stringify(v ?? null) !== JSON.stringify(/** @type {any} */ (bas)[f] ?? null)));
      return Object.keys(kvar).length === Object.keys(u).length ? u : kvar;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nyckeln ÄR raden: bas byts vid varje ritning, värdena gör det inte.
  }, [sparadNyckel]);
  const visadBild = doldBildLage ? (nu.utanBild ? "" : inloggningsBild || anvandare.bild) : nu.bild;

  /* ⛔ Beslutet ligger i `andringen`, inte här. Skälet står i profil.js:
     Radix Select går inte att driva i jsdom, så logiken flyttades dit ett
     prov kan se den i stället för att få ett prov som inte kan faila. */
  const beslut = andringen(bas, utkastet, falt);
  let { andrat } = beslut;
  const { andring } = beslut;
  // Utan `falt` men med `utanBild`: hela raden som förut, plus valet om bilden när det ändrats.
  if (!falt && doldBildLage && nu.utanBild !== utanBild) {
    andring.utanBild = nu.utanBild;
    andrat = true;
  }

  /*
   * ⛔ ETT NEJ FRÅN SPARNINGEN SÄGS VID KNAPPEN (granskningen av #786, punkt 1). Förut `try/finally` utan `catch`: Spara blev tryckbar
   * igen och ingenting sades, så den som fått ett nej (ett telefonnummer i fel form, taket per minut) trodde att det sparats. Felet står
   * nu med `role="alert"` bredvid Spara, i appens ord (`sparaFelText`) eller med förvalet, och utkastet står kvar så att det går att rätta.
   */
  const felTexten = (/** @type {unknown} */ fel) => {
    const egen = typeof sparaFelText === "function" ? sparaFelText(fel) : sparaFelText;
    return typeof egen === "string" && egen.trim() ? egen : sparaFelForval;
  };

  const spara = async () => {
    setSparar(true);
    setSparaFel("");
    try {
      await onSpara?.(falt ? { ...andring } : { ...andring, lankar: [...andring.lankar] });
    } catch (fel) {
      setSparaFel(felTexten(fel));
    } finally {
      setSparar(false);
    }
  };

  /** Det som sparats direkt ska inte stå kvar i utkastet. @param {ReadonlyArray<string>} falten */
  const glom = (falten) =>
    setUtkastet((m) => {
      const ut = { ...m };
      for (const f of falten) delete (/** @type {any} */ (ut))[f];
      return ut;
    });

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
      await onSpara?.({ bild: uppladdad.url, bildSokvag: uppladdad.sokvag });
      glom(["bild", "bildSokvag"]);
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
      await onSpara?.({ bild: "", bildSokvag: "" });
      glom(["bild", "bildSokvag"]);
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
      await onSpara?.({ bild: inloggningsBild ?? "", bildSokvag: "" });
      glom(["bild", "bildSokvag"]);
    } finally {
      setBildLaddar(false);
    }
  }

  /**
   * "Använd initialer": nollställer BÅDE bild och ikon, direkt, eftersom den rör bilden. Färgen (om vald) ligger kvar
   * som bakgrund bakom initialerna, precis som den redan gör bakom en ikon (#164).
   */
  async function anvandInitialer() {
    setBildFel("");
    setBildLaddar(true);
    try {
      await onSpara?.({ bild: "", bildSokvag: "", ikon: "" });
      glom(["bild", "bildSokvag", "ikon"]);
    } catch (e) {
      setBildFel(e instanceof Error ? e.message : String(e));
    } finally {
      setBildLaddar(false);
    }
  }

  /*
   * ══ ⛔ IKON OCH FÄRG: DIREKT UTAN `falt`, I UTKASTET MED (granskningen av #786, punkt 5) ═══════════════════════════════
   *
   * Utan `falt` sparas ett ikonval och ett färgval direkt, som före #786, så att appar som sparar i sin egen rad (bolag-ops, tam)
   * inte ändrar beteende. Med `falt` (appen sparar i ett konto med tak per minut, Identity) står valet i utkastet och skrivs med
   * Spara: reglaget hade annars gett en sparning per steg.
   * ⛔ En ikon ovanpå en kvarvarande bild hade synts som "inget hände" (`OpsIdentity` ritar bilden först), så ikonvalet rensar bilden,
   * som förut. Inte med `utanBild`: där är bilden kontots och döljs med knappen.
   */
  const ikonRensarBild = !doldBildLage && visas("bild");
  /** @param {Record<string, any>} varden */
  async function direkt(varden) {
    setBildFel("");
    setBildLaddar(true);
    try {
      await onSpara?.(varden);
      glom(Object.keys(varden));
    } catch (e) {
      setBildFel(felTexten(e));
    } finally {
      setBildLaddar(false);
    }
  }
  /** @param {string} f */
  function valjFarg(f) {
    if (falt) satt("farg", f);
    else void direkt({ farg: f });
  }
  /** @param {string} i */
  function valjIkon(i) {
    const varden = { ikon: i, ...(ikonRensarBild ? { bild: "", bildSokvag: "" } : {}) };
    if (falt) setUtkastet((u) => ({ ...u, ...varden }));
    else void direkt(varden);
  }

  const obeskrivnaPlattformar = plattformar.filter((p) => !lankar.some((l) => l.plattform === p.id));

  const grupplistan = (
    <>
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
    </>
  );

  // ⛔ MÄRKET RITAS UR UTKASTET: den som väljer en kulör ser den i huvudet innan Spara, inte först efteråt.
  const visadPerson = { ...anvandare, namn: namn || anvandare.namn, ikon: nu.ikon, farg: nu.farg, bild: visadBild };
  const identitet = (
    <div className="flex items-center gap-3">
      <OpsIdentity
        name={visadPerson.namn || visadPerson.epost}
        seed={anvandare.id}
        imageUrl={visadBild}
        {...personmarkeProps(visadPerson)}
        size="lg"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-ink">{anvandare.namn || anvandare.epost}</p>
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
  );

  /*
   * ══ ⛔ 0.53.0: KONTOLÄGET, SKRIVSKYDDAT (cllp/lifehub.app#32) ═══════════
   *
   * CP 2026-10-04: "Vi behöver fixa min profil så att man kommer till sitt användarkonto och ställer in allt där."
   * Med `konto={{ href }}` är varje fält här en andra kopia av samma person. Därför inga fält alls i det läget, och
   * ingen Spara som kunde skriva förbi kontot: bara vem du är, en länk dit du ändrar det, grupperna och appens egna
   * sektioner. Den redigerbara formen (`{ sakerhetHref, raderaHref }`, cllp/lifehub.app#786) sparar genom kontot med
   * `onSpara` i stället, och står nedanför.
   */
  if (kontoLasning) {
    return (
      <OpsView width="narrow">
        <OpsViewHeader title={rubrik} />
        <OpsCard kant>
          {identitet}
          <p className="mt-3 text-etikett text-ink-secondary">{kontoText}</p>
          <div className="mt-3">
            <OpsButton variant="secondary" href={/** @type {{ href: string }} */ (konto).href}>
              {kontoLankEtikett}
            </OpsButton>
          </div>
        </OpsCard>
        {children}
        {grupplistan}
      </OpsView>
    );
  }

  const markeT = {
    farg: fargEtikett,
    ikonEllerLogotyp: valjIkonEtikett,
    initialer: initialerEtikett,
    kulorExakt,
    kulorGrader,
    kulorAterstall,
    kulorHint,
    sokIkon,
    sokIkonPlatshallare,
    senastAnvanda,
    senastInga,
    vanliga,
    traffar,
    traffarStatus,
    ingetMatchar,
    ingaTraffar,
    // ⛔ Läses inte med `person` (OpsGruppmarkeValjare), men formen kräver dem.
    forslagUrNamn: "",
    forslagInga: "",
    forslagSkrivNamn: "",
    egnaInitialer: "",
    egnaInitialerHint: "",
    aterstallInitialer: "",
  };
  const visaMarke = visas("ikon") || visas("farg");
  const visaUppgifter = visas("namn") || visas("telefon") || visas("stad") || visas("presentation");

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
          {identitet}
          {kontoLankar ? <p className="mt-3 text-etikett text-ink-secondary">{kontoRedigerbarText}</p> : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {lagring && visas("bild") ? (
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
            {/* ⛔ cllp/lifehub.app#786: bilden är inloggningens. Ett val, visa eller inte, i utkastet och med Spara. */}
            {doldBildLage && inloggningsBild && visas("utanBild") ? (
              <OpsButton variant="secondary" size="sm" onClick={() => satt("utanBild", !nu.utanBild)}>
                {nu.utanBild ? visaBildEtikett : doljBildEtikett}
              </OpsButton>
            ) : null}
            {!doldBildLage && anvandare.bild && visas("bild") ? (
              <OpsButton variant="ghost" size="sm" disabled={bildLaddar} onClick={taBortBild}>
                {taBortEtikett}
              </OpsButton>
            ) : null}
            {!doldBildLage && inloggningsBild && inloggningsBild !== anvandare.bild && visas("bild") ? (
              <OpsButton variant="ghost" size="sm" disabled={bildLaddar} onClick={aterstallBild}>
                {aterstallEtikett}
              </OpsButton>
            ) : null}
            {/* ⛔ "ANVÄND INITIALER" RITAS ÄVEN UTAN `lagring`: den nollställer ikonen
                lika gärna som bilden, och kräver ingen Storage. Inte med `utanBild`: där är
                initialerna "Aa" i väljaren, och bilden rörs med knappen ovanför. */}
            {!doldBildLage && (anvandare.bild || anvandare.ikon) && visas("ikon") && visas("bild") ? (
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

          {/* ⛔ cllp/lifehub.app#786: gruppens väljare, i personens form. Samma val som Identitys profil. */}
          {visaMarke ? (
            <div className="mt-3 flex flex-col gap-3" data-profilmarke="">
              <OpsGruppmarkeValjare
                person
                namn={namn}
                seed={anvandare.id}
                farg={nu.farg}
                ikon={nu.ikon}
                onFarg={valjFarg}
                onIkon={valjIkon}
                sprak={sprak === "en" ? "en" : "sv"}
                t={markeT}
                idPrefix={markeId}
              />
            </div>
          ) : null}
        </OpsCard>
      </div>

      {visaUppgifter ? (
        <OpsCard kant>
          <div className="mb-3">
            <OpsSectionLabel>{personuppgifterEtikett}</OpsSectionLabel>
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {visas("namn") ? (
                <OpsField label={namnEtikett} labelSize="liten">
                  <OpsInput value={namn} onChange={(v) => satt("namn", v)} />
                </OpsField>
              ) : null}
              {visas("telefon") ? (
                <OpsField label={telefonEtikett} hint={telefonHint} labelSize="liten">
                  <OpsInput type="tel" value={telefon} onChange={(v) => satt("telefon", v)} />
                </OpsField>
              ) : null}
              {visas("stad") ? (
                <OpsField label={stadEtikett} labelSize="liten">
                  <OpsInput value={stad} onChange={(v) => satt("stad", v)} />
                </OpsField>
              ) : null}
            </div>
            {visas("presentation") ? (
              <OpsField label={presentationEtikett} hint={`${presentation.length}/${MAX_PRESENTATION}`} labelSize="liten">
                <OpsTextarea value={presentation} onChange={(v) => satt("presentation", v)} maxLength={MAX_PRESENTATION} />
              </OpsField>
            ) : null}
          </div>
        </OpsCard>
      ) : null}

      {/* ⛔ LÄNKSEKTIONEN RITAS BARA NÄR APPEN HAR PLATTFORMAR. Utan `plattformar` finns
          inget att lägga till, och en rubrik "Länkar" över ingenting följdes av Språk
          och Utseende, som då såg ut att höra till länkarna (skärmbild #164, 2026-09-28).
          Tomheten är ett svar i appens beslut att inte skicka plattformar, inte en rad här. */}
      {visas("lankar") && (plattformar.length > 0 || lankar.length > 0) ? (
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
                      onChange={(v) => satt("lankar", lankar.map((l, j) => (i === j ? { ...l, url: v } : l)))}
                    />
                  </OpsField>
                </div>
                <OpsButton
                  variant="ghost"
                  size="sm"
                  iconOnly
                  ariaLabel={`${taBortLankEtikett}: ${rad.plattform}`}
                  onClick={() => satt("lankar", lankar.filter((_l, j) => j !== i))}
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
                <OpsChip key={p.id} onClick={() => satt("lankar", [...lankar, { plattform: p.id, url: "" }])}>
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

      {visas("sprak") ? (
        <OpsCard kant>
          <div className="mb-3">
            <OpsSectionLabel>{installningarEtikett}</OpsSectionLabel>
          </div>
          <OpsField label={sprakEtikett} labelSize="liten">
            <OpsSelect
              options={SPRAK.map((s) => ({ value: s, label: sprakNamn[s] || s }))}
              value={valtSprak}
              onChange={(v) => satt("sprak", v)}
            />
          </OpsField>
        </OpsCard>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <OpsButton variant="primary" onClick={spara} disabled={!andrat} busy={sparar} busyLabel={sparaVantarEtikett}>
          {sparaEtikett}
        </OpsButton>
        {sparaFel ? (
          <p role="alert" className="m-0 self-center text-etikett text-danger" data-profil-sparafel="">
            {sparaFel}
          </p>
        ) : null}
      </div>

      {/* ⛔ cllp/lifehub.app#786: det som inte hör till appen (inloggning, säkerhet, radering) bor i kontot. Länkarna dit,
          inte en andra kopia av sidorna. */}
      {kontoLankar ? (
        <OpsCard kant>
          <div className="mb-3">
            <OpsSectionLabel>{kontoRubrik}</OpsSectionLabel>
          </div>
          <div className="flex flex-wrap gap-2" data-profilkonto="">
            {kontoLankar.sakerhetHref ? (
              <OpsButton variant="secondary" size="sm" href={kontoLankar.sakerhetHref}>
                {kontoSakerhetEtikett}
              </OpsButton>
            ) : null}
            {kontoLankar.raderaHref ? (
              <OpsButton variant="ghost" size="sm" href={kontoLankar.raderaHref}>
                {kontoRaderaEtikett}
              </OpsButton>
            ) : null}
          </div>
        </OpsCard>
      ) : null}

      {grupplistan}
    </OpsView>
  );
}

/**
 * OpsProfils förvalda texter (0.46.0, cllp/bolag-ops#528). Den enda källan till dem: den inre komponentens förval pekar hit.
 * @type {import("../lib/ord.js").Ordbok}
 */
/** Vad språken heter i väljaren, på varje språk. */
const SPRAKNAMN = { sv: { sv: "Svenska", en: "Engelska" }, en: { sv: "Swedish", en: "English" } };

export const ORD_OPSPROFIL = {
  rubrik: { sv: "Profil", en: "Profile" },
  epostEtikett: { sv: "E-post", en: "Email" },
  sprakEtikett: { sv: "Språk", en: "Language" },
  grupperEtikett: { sv: "Mina grupper", en: "My groups" },
  sparaEtikett: { sv: "Spara", en: "Save" },
  sparaVantarEtikett: { sv: "Sparar…", en: "Saving…" },
  sparaFelForval: { sv: "Profilen kunde inte sparas. Försök igen.", en: "Your profile could not be saved. Try again." },
  ingaGrupperText: { sv: "Du är inte med i någon grupp än.", en: "You are not in any group yet." },
  profilbildEtikett: { sv: "Profilbild", en: "Profile picture" },
  laddaUppEtikett: { sv: "Byt", en: "Change" },
  taBortEtikett: { sv: "Ta bort", en: "Remove" },
  aterstallEtikett: { sv: "Återställ", en: "Reset" },
  visaBildEtikett: { sv: "Visa bilden", en: "Show the picture" },
  doljBildEtikett: { sv: "Visa inte bilden", en: "Do not show the picture" },
  // cllp/lifehub.app#786: rubrikerna i gruppens väljare, i personens form. Samma ord som Identitys profil.
  valjIkonEtikett: { sv: "Ikon eller initialer", en: "Icon or initials" },
  fargEtikett: { sv: "Färg", en: "Colour" },
  initialerEtikett: { sv: "Initialer", en: "Initials" },
  kulorExakt: { sv: "Exakt kulör", en: "Exact hue" },
  kulorGrader: { sv: "grader", en: "degrees" },
  kulorAterstall: { sv: "Kulör ur kontot", en: "Hue from the account" },
  kulorHint: { sv: "Ljusheten följer temat, ljust eller mörkt, så ikonen alltid syns.", en: "The lightness follows light and dark mode, so the icon is always visible." },
  sokIkon: { sv: "Sök ikon", en: "Search icons" },
  sokIkonPlatshallare: { sv: "Musik, fotboll, kontor ...", en: "Music, football, office ..." },
  senastAnvanda: { sv: "Senast använda", en: "Recently used" },
  senastInga: { sv: "Inga ännu.", en: "None yet." },
  vanliga: { sv: "Vanliga", en: "Common" },
  traffar: { sv: "Träffar", en: "Matches" },
  traffarStatus: { sv: "{n} träffar", en: "{n} matches" },
  ingetMatchar: { sv: "Inget matchar", en: "Nothing matches" },
  ingaTraffar: { sv: "Inga ikoner matchar \"{fraga}\".", en: "No icons match \"{fraga}\"." },
  anvandInitialerEtikett: { sv: "Använd initialer", en: "Use initials" },
  personuppgifterEtikett: { sv: "Personuppgifter", en: "Personal details" },
  namnEtikett: { sv: "Namn", en: "Name" },
  telefonEtikett: { sv: "Telefon", en: "Phone" },
  telefonHint: { sv: "T.ex. +46701234567", en: "For example +46701234567" },
  stadEtikett: { sv: "Stad", en: "City" },
  presentationEtikett: { sv: "Presentation", en: "About" },
  lankarEtikett: { sv: "Länkar", en: "Links" },
  installningarEtikett: { sv: "Inställningar", en: "Settings" },
  laggTillLankEtikett: { sv: "Lägg till länk", en: "Add link" },
  urlEtikett: { sv: "url", en: "url" },
  taBortLankEtikett: { sv: "Ta bort länken", en: "Remove the link" },
  kontoText: {
    sv: "Namn, bild och dina uppgifter ändrar du i Mitt konto. De gäller i alla dina hubbar.",
    en: "You change your name, picture and details in My account. They apply in all your hubs.",
  },
  kontoLankEtikett: { sv: "Ändra i Mitt konto", en: "Edit in My account" },
  kontoRedigerbarText: { sv: "Det du ändrar här gäller i alla dina hubbar.", en: "What you change here applies in all your hubs." },
  kontoRubrik: { sv: "Konto", en: "Account" },
  kontoSakerhetEtikett: { sv: "Inloggning och säkerhet", en: "Sign-in and security" },
  kontoRaderaEtikett: { sv: "Radera kontot", en: "Delete account" },
};

/**
 * OpsProfil på det språk appen ritas på (`OpsSprakProvider`), med ordbokens texter där appen inte skickat egna.
 * @param {Parameters<typeof OpsProfilRitad>[0]} props
 */
export function OpsProfil(props) {
  const kontext = useOpsSprak();
  const sprak = props.sprak ?? kontext;
  // ⛔ Språkens namn i väljaren följer också språket: "Engelska" i en engelsk profil är ett ord den som bytte inte kan läsa.
  const sprakNamn = props.sprakNamn ?? SPRAKNAMN[sprak === "en" ? "en" : "sv"];
  return <OpsProfilRitad {...forvalda(ORD_OPSPROFIL, sprak)} {...definierade(props)} sprak={sprak} sprakNamn={sprakNamn} />;
}
