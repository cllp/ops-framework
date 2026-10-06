import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import { cx } from "../lib/cx.js";
import { formatDate, formatTime, formatRelativeDate } from "../lib/format.js";
import { AGENTSTATUS_MAX_ALDER, MAX_MEDDELANDE, MAX_TRADNAMN, REAKTIONSKODER, agentstatus, delaSamtalsnyckel, samtalsnyckel, summeraReaktioner, tradensNamn, utdrag } from "../lib/samtal.js";
import { useSamtal } from "../data/useSamtal.jsx";
import { harCitat, harOmnamnanden, harReaktioner, harStatus, harTradar } from "../data/samtalskalla.js";
import { OpsMarkdown } from "./OpsMarkdown.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { NAMN_SAKNAS } from "../lib/personnamn.js";
import { usePersonnamn } from "./usePersonnamn.js";
import { OpsIconLink } from "./OpsIconLink.jsx";
import { OpsMottagare } from "./OpsMottagare.jsx";
import { OpsCountBadge } from "./counter.jsx";
import { AgentIkon, AndraIkon, ChevronHogerIkon, ChevronNedIkon, CiteraIkon, ChevronVansterIkon, GruppIkon, KryssIkon, LasIkon, LeendeIkon, MeddelandeIkon, PlusIkon, SkickaIkon, SokIkon, TradIkon } from "./icons.jsx";

/**
 * Meddelanden: inkorgen med gruppchatten och de privata samtalen, och samtalet bredvid (0.34.0, #182, #185).
 *
 * ══ ⛔ SS ChatInboxPanel ÄR FÖREBILDEN (regel 12) ══════════════════════════════════════════════════
 *
 * `cllp/sessions-platform` `apps/web/src/components/ChatInboxPanel.jsx`: på dator en lista till vänster (35 procent,
 * minst 220 px, högst 40, `:959`) och samtalet till höger (`:1194`), båda som kort med rundade hörn på sidans bakgrund
 * (`sm:gap-2 sm:p-2`, `:957`). På telefon är listan hela sidan, och ett valt samtal ersätter den med en rad
 * "‹ Tillbaka" överst (`:880-892`). Överst i listan: filtret Alla / Olästa (`:968-1000`) och sökningen (`:1065-1085`).
 * En rad (`:698-760`): en ruta på 40 px med samtalets ikon, räknaren i dess hörn, namnet (fetare när det finns
 * olästa), tiden, en etikett för slaget och det senaste meddelandet med avsändaren först.
 *
 * ⛔ STORLEKARNA ÄR RAMVERKETS ROLLER, INTE SS PIXLAR (check-typografi). SS 9 px (tid, etikett) blir 10 (`text-liten`),
 * 11 px (sökningen) blir `text-hjalp`, bubblans 13 px blir 14 (`text-etikett`). Jämförelsen står i
 * `docs/jamforelser/0.34.0/jamforelse.md`.
 *
 * ⛔ ANDRAS BUBBLOR, DEN VALDA RADEN OCH ETIKETTEN GRUPP ÄR `bg-hover`, INTE `bg-raised`. I det ljusa temat är `raised` samma färg
 * som `surface` (tokens.css), så en bubbla i `raised` på samtalets yta hade varit text utan bubbla. Upptäckt i montaget mot SS,
 * där `--color-chat-bubble-other-bg` skiljer sig från ytan, och mätt i check-skalyta avsnitt 29.
 *
 * ⛔ DET PRIVATA SYNS. Ett privat samtal bär etiketten "Privat" i listan och raden "Bara ni två ser det här" i huvudet.
 *
 * ⛔ "NYTT MEDDELANDE" LÄMNAR ALDRIG MEDDELANDEN (0.63.0, #263). CP 2026-10-06 11:22, med en skärminspelning från LifeHub: "steget
 * med att öppna en liten chattfönster till är lite konstigt", och "Chatten dök upp långt senare...". Knappen öppnade skalets
 * skapa-panel, som dolde hela vyn, och tråden ritades bara när samtalet fanns bland raderna, som lästes om först vid nästa
 * `focus`. Förebilden är SS: man väljer en person i inkorgen (`ChatInboxPanel.jsx:1091-1124`), samtalet öppnas eller skapas
 * (`ensureDMConversation`, `:477-505`), och tråden ritas på det VALDA samtalet (`:186-191`, `DMPanel.jsx:95-97`). Här:
 *   - läget "nytt" i högerpanelen, med Till överst och trådens skrivfält längst ned, och listan kvar till vänster;
 *   - valet i Till öppnar samtalet direkt med `oppnaPrivat`. Finns det redan öppnas det, med sin historik;
 *   - tråden ritas på `valdId`. Saknas raden läses gruppen och paret ur nyckeln (`delaSamtalsnyckel`), och rubriken ur
 *     medlemmarna;
 *   - raden läggs in i listan lokalt (`laggIn`) efter öppnandet och efter Skicka, och listan läses sedan om.
 *
 * ⛔ TRÅDAR I GRUPPCHATTEN (0.68.0, cllp/lifehub.app#60). CP 2026-10-06: "Vore ju snyggt om gruppen i gruppchatt kan starta en
 * tråd och när som helst blanda in en agent som är med i tråden för alla." Under varje meddelande i gruppchatten står "Svara i
 * tråd", eller, när tråden finns, ett märke med antal svar och trådens namn. Tråden öppnas i högerpanelen i stället för chatten,
 * med en rad tillbaka till gruppchatten överst, rotmeddelandet först, svaren och samma skrivfält. Listan står kvar till vänster
 * på dator. Namnet härleds ur rotmeddelandet (`tradensNamn`) och går att döpa om. Tråden skapas först med det första svaret, så
 * ett "Svara i tråd" som ångras lämnar ingen tom tråd. Inget läsmärke och ingen notis per tråd i första skivan (regel 13).
 *
 * ⛔ ETT SAMTAL ÄR EN MODELL (CP:s beslut 4). Gruppchatten, ett privat samtal och ett agentsamtal ritas av samma vy;
 * skillnaden är huvudets rad och vilka namn som skrivs ut.
 */

/**
 * @typedef {object} Medlemsrad
 * @property {string} userId
 * @property {string} [namn]
 * @property {string} [bild]
 * @property {string} [typ]
 * @property {string} [status]
 */

/**
 * @typedef {object} Meddelandetexter
 * @property {string} [rubrik] Förval "Meddelanden".
 * @property {string} [nytt] Förval "Nytt meddelande".
 * @property {string} [alla] Förval "Alla".
 * @property {string} [olasta] Förval "Olästa".
 * @property {string} [sok] Förval "Sök i meddelanden".
 * @property {string} [rensaSok] Förval "Rensa sökningen".
 * @property {string} [tomt] Förval "Inga samtal än".
 * @property {string} [tomtOlasta] Förval "Inget oläst".
 * @property {string} [ingenTraff] Förval "Ingen träff".
 * @property {string} [valjSamtal] Förval "Välj ett samtal".
 * @property {string} [tillbaka] Förval "Tillbaka".
 * @property {string} [grupp] Etiketten för gruppchatten. Förval "Grupp".
 * @property {string} [privat] Förval "Privat".
 * @property {string} [agent] Förval "Agent".
 * @property {string} [privatRad] Förval "Bara ni två ser det här".
 * @property {string} [gruppRad] Förval "Alla i gruppen ser det här".
 * @property {string} [agentRad] Förval "Bara du och agenten ser det här".
 * @property {string} [inga] Förval "Inga meddelanden än".
 * @property {string} [skriv] Förval "Skriv ett meddelande".
 * @property {string} [skicka] Förval "Skicka".
 * @property {string} [du] Förval "Du".
 * @property {string} [olastaText] Substantivet efter räknarens siffra. Förval "olästa".
 * @property {string} [fel] Förval "Meddelandena kunde inte hämtas".
 * @property {string} [till] Mottagarväljarens etikett i läget "nytt". Förval "Till".
 * @property {string} [valjMottagare] Felet när man skickar i läget "nytt" utan att ha valt någon. Förval "Välj vem meddelandet ska till.".
 * @property {string} [oppnaFel] Rubriken när samtalet inte kunde öppnas. Förval "Samtalet kunde inte öppnas".
 * @property {string} [ingenAnnan] När det inte finns någon att skriva till. Förval "Det finns ingen annan i gruppen att skriva till.".
 * @property {string} [helaGruppen] (0.68.0) Raden under Till som öppnar gruppchatten. Förval "Hela gruppen".
 * @property {string} [gruppTom] (0.68.0) Gruppchattens tomma läge. Förval "Alla i gruppen ser det som skrivs här.".
 * @property {string} [oppnarGrupp] (0.68.0) Medan gruppchatten öppnas första gången. Förval "Öppnar gruppchatten…".
 * @property {string} [svaraITrad] (0.68.0) Förval "Svara i tråd".
 * @property {string} [svar] (0.68.0) Substantivet efter antalet i trådens märke. Förval "svar".
 * @property {string} [tradRad] (0.68.0) Förval "Alla i gruppen ser tråden".
 * @property {string} [tradFel] (0.68.0) Förval "Tråden kunde inte hämtas".
 * @property {string} [ingaSvar] (0.68.0) Förval "Inga svar än. Skriv det första.".
 * @property {string} [dopOm] (0.68.0) Förval "Döp om".
 * @property {string} [tradnamn] (0.68.0) Namnfältets etikett. Förval "Trådens namn".
 * @property {string} [spara] (0.68.0) Förval "Spara".
 * @property {string} [avbryt] (0.68.0) Förval "Avbryt".
 * @property {string} [automatisktNamn] (0.68.0) Förval "Använd det automatiska namnet".
 * @property {string} [rotSaknas] (0.68.0) När meddelandet tråden startades ur inte går att läsa. Förval "Meddelandet tråden startades ur går inte att läsa.".
 * @property {string} [tradarFel] (0.68.0) En diskret rad när trådarnas märken inte kunde läsas. Förval "Trådarna kunde inte hämtas.".
 * @property {string} [svarPa] (0.68.0) Förled för skärmläsaren: vems meddelande "Svara i tråd" gäller. Förval "Meddelande från".
 * @property {string} [visaAldre] (chattens nattskiva) Knappen överst i loggen. Förval "Visa äldre".
 * @property {string} [hamtarAldre] Förval "Hämtar äldre…".
 * @property {string} [ingaAldre] När samtalets början är nådd. Förval "Inga äldre meddelanden".
 * @property {string} [aldreFel] Förval "Äldre meddelanden kunde inte hämtas.".
 * @property {string} [reagera] (chattens nattskiva) Knappen som öppnar reaktionerna. Förval "Reagera".
 * @property {string} [valjReaktion] Gruppens namn för skärmläsaren. Förval "Välj en reaktion".
 * @property {string} [duHarReagerat] Läggs till i en reaktions namn när den är din. Förval "du har reagerat".
 * @property {string} [reaktionFel] Förval "Reaktionen kunde inte sparas.".
 * @property {string} [reaktionerFel] Förval "Reaktionerna kunde inte hämtas.".
 * @property {string} [reaktionerFler] När läsningen nådde sitt tak. Förval "Äldre reaktioner visas inte.".
 * @property {Partial<Record<(typeof REAKTIONSKODER)[number], string>>} [reaktionsnamn] Reaktionernas namn för skärmläsaren.
 * @property {string} [allaNamn] (chattens nattskiva) Förslaget som nämner hela gruppen. Förval "alla".
 * @property {string} [namnForslag] @-listans namn för skärmläsaren. Förval "Nämn någon".
 * @property {string} [citera] (chattens nattskiva) Förval "Svara med citat".
 * @property {string} [svararPa] Raden ovanför skrivfältet. Förval "Svarar på".
 * @property {string} [avbrytCitat] Förval "Avbryt citatet".
 * @property {string} [citatSaknas] När det citerade meddelandet inte går att läsa. Förval "Meddelandet går inte att läsa.".
 * @property {string} [sokISamtalet] Förval "Sök i samtalet".
 * @property {string} [stangSok] Förval "Stäng sökningen".
 * @property {string} [nastaTraff] Förval "Nästa träff".
 * @property {string} [forraTraff] Förval "Föregående träff".
 * @property {string} [ingenTraffLaddade] Förval "Ingen träff bland de laddade meddelandena.".
 * @property {string} [sokOmfang] Hur långt sökningen når. `{n}` byts mot antalet. Förval "Söker bland de {n} laddade meddelandena. Visa äldre för att söka längre bak.".
 * @property {string} [agentTanker] (#273) Förval "Agenten tänker".
 * @property {string} [agentSkriver] (#273) Förval "Agenten skriver".
 * @property {string} [agentFastnat] (#273) När statusen är äldre än två minuter. Förval "Agenten har inte svarat på två minuter. Skriv igen om du fortfarande väntar.".
 * @property {string} [agentstatusFel] (#273) När statusen inte kunde läsas, eller inte har statusens form. Förval "Agentens status kunde inte läsas.".
 */

/** @type {Required<Meddelandetexter>} */
const TEXTER = {
  rubrik: "Meddelanden",
  nytt: "Nytt meddelande",
  alla: "Alla",
  olasta: "Olästa",
  sok: "Sök i meddelanden",
  rensaSok: "Rensa sökningen",
  tomt: "Inga samtal än",
  tomtOlasta: "Inget oläst",
  ingenTraff: "Ingen träff",
  valjSamtal: "Välj ett samtal",
  tillbaka: "Tillbaka",
  grupp: "Grupp",
  privat: "Privat",
  agent: "Agent",
  privatRad: "Bara ni två ser det här",
  gruppRad: "Alla i gruppen ser det här",
  agentRad: "Bara du och agenten ser det här",
  inga: "Inga meddelanden än",
  skriv: "Skriv ett meddelande",
  skicka: "Skicka",
  du: "Du",
  olastaText: "olästa",
  fel: "Meddelandena kunde inte hämtas",
  till: "Till",
  valjMottagare: "Välj vem meddelandet ska till.",
  oppnaFel: "Samtalet kunde inte öppnas",
  ingenAnnan: "Det finns ingen annan i gruppen att skriva till.",
  helaGruppen: "Hela gruppen",
  gruppTom: "Alla i gruppen ser det som skrivs här.",
  oppnarGrupp: "Öppnar gruppchatten…",
  svaraITrad: "Svara i tråd",
  svar: "svar",
  tradRad: "Alla i gruppen ser tråden",
  tradFel: "Tråden kunde inte hämtas",
  ingaSvar: "Inga svar än. Skriv det första.",
  dopOm: "Döp om",
  tradnamn: "Trådens namn",
  spara: "Spara",
  avbryt: "Avbryt",
  automatisktNamn: "Använd det automatiska namnet",
  rotSaknas: "Meddelandet tråden startades ur går inte att läsa.",
  tradarFel: "Trådarna kunde inte hämtas.",
  svarPa: "Meddelande från",
  visaAldre: "Visa äldre",
  hamtarAldre: "Hämtar äldre…",
  ingaAldre: "Inga äldre meddelanden",
  aldreFel: "Äldre meddelanden kunde inte hämtas.",
  reagera: "Reagera",
  valjReaktion: "Välj en reaktion",
  duHarReagerat: "du har reagerat",
  reaktionFel: "Reaktionen kunde inte sparas.",
  reaktionerFel: "Reaktionerna kunde inte hämtas.",
  reaktionerFler: "Äldre reaktioner visas inte.",
  reaktionsnamn: {},
  citera: "Svara med citat",
  svararPa: "Svarar på",
  avbrytCitat: "Avbryt citatet",
  citatSaknas: "Meddelandet går inte att läsa.",
  sokISamtalet: "Sök i samtalet",
  stangSok: "Stäng sökningen",
  nastaTraff: "Nästa träff",
  forraTraff: "Föregående träff",
  ingenTraffLaddade: "Ingen träff bland de laddade meddelandena.",
  sokOmfang: "Söker bland de {n} laddade meddelandena. Visa äldre för att söka längre bak.",
  allaNamn: "alla",
  namnForslag: "Nämn någon",
  agentTanker: "Agenten tänker",
  agentSkriver: "Agenten skriver",
  agentFastnat: "Agenten har inte svarat på två minuter. Skriv igen om du fortfarande väntar.",
  agentstatusFel: "Agentens status kunde inte läsas.",
};

/**
 * Tiden på en rad: klockslag i dag, annars datum.
 * @param {number} tid @param {number} nu @param {string} locale
 */
function radtid(tid, nu, locale) {
  const d = new Date(tid);
  const n = new Date(nu);
  return d.toDateString() === n.toDateString() ? formatTime(tid, { locale }) : formatDate(tid, { locale });
}

/** "i dag" blir "I dag" i avdelaren, som SS (`ChatDateDivider.jsx`). @param {string} t */
const forstaVersal = (t) => (t ? t.charAt(0).toLocaleUpperCase("sv") + t.slice(1) : t);

/**
 * Ingången till meddelandena, med antalet olästa (0.34.0). En `OpsIconLink` med ramverkets ikon, för appens `actions`.
 *
 * @param {{ href: string, olasta: number, olastaFler?: boolean, etikett?: string, olastaText?: string, onNavigate?: (href: string, e: any) => void, active?: boolean }} props
 *   `olastaFler` (chattens nattskiva): antalet är ett golv, märket visar "50+". Ges av `onOlasta`:s andra argument.
 */
export function OpsMeddelandeLank({ href, olasta, olastaFler = false, etikett = "Meddelanden", olastaText = "olästa", onNavigate, active }) {
  return <OpsIconLink href={href} icon={<MeddelandeIkon size={20} />} label={etikett} badge={olasta} badgeFler={olastaFler} badgeText={olastaText} onNavigate={onNavigate} active={active} />;
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>} props.kalla
 * @param {string} props.uid
 * @param {string | null} props.groupId
 * @param {string} props.gruppNamn Gruppchattens namn i listan.
 * @param {ReadonlyArray<Medlemsrad>} props.medlemmar Gruppens medlemskap, för namn och bilder.
 * @param {string | null} [props.valt] Valt samtal, när appen styr det (t.ex. ur adressen). Tråden ritas på id:t också när
 *   samtalet ännu inte finns bland raderna (0.63.0, #263).
 * @param {boolean} [props.nytt] (0.63.0, #263) Läget "nytt" i högerpanelen, när appen styr det (t.ex. ur adressen, `?nytt=1`).
 *   Utelämnad: komponenten håller läget själv.
 * @param {(samtalId: string | null, val?: { nytt: true }) => void} [props.onValj] Anropas med det valda samtalet, eller med
 *   `(null, { nytt: true })` när läget "nytt" öppnas. Ett anrop utan `val` betyder att läget "nytt" är stängt. EN signal för
 *   båda, så att en app som har dem i adressen skriver adressen en gång.
 * @param {(antal: number, val: { fler: boolean }) => void} [props.onOlasta] Anropas med antalet olästa när det ändras, för ingångens räknare.
 *   `val.fler` (chattens nattskiva): antalet är ett golv, eftersom en räkning nådde sidans storlek. Skicka det till `OpsMeddelandeLank olastaFler`.
 * @param {string | null} [props.valtTrad] (0.68.0) Vald tråd i gruppchatten, rotmeddelandets id, när appen styr det (t.ex. ur
 *   adressen, `?trad=`). Gäller bara när det valda samtalet är gruppchatten. Utelämnad: komponenten håller valet själv.
 * @param {(tid: string | null) => void} [props.onValjTrad] (0.68.0) Anropas med tråden som öppnas, eller `null` när man går
 *   tillbaka till gruppchatten. Ett nytt val av samtal stänger tråden, och då anropas den inte: det är `onValj` som säger det.
 * @param {string} [props.sprak] "sv" eller "en", för tiderna. Förval "sv".
 * @param {Meddelandetexter} [props.texter]
 */
export function OpsMeddelanden({ kalla, uid, groupId, gruppNamn, medlemmar, valt, nytt, onValj, onOlasta, valtTrad, onValjTrad, sprak: sprakProp, texter = {} }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const t = { ...TEXTER, ...texter };
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const { rader, laddar, fel, olasta, olastaFler, lasOm, laggIn } = useSamtal({ kalla, groupId, uid });
  const [egetVal, setEgetVal] = useState(/** @type {string | null} */ (null));
  const [egetNytt, setEgetNytt] = useState(false);
  // ⛔ Läget "nytt" vinner över ett valt samtal: det är det man senast bad om.
  const nyttLage = Boolean(groupId) && (nytt !== undefined ? nytt : egetNytt);
  const valdId = nyttLage ? null : valt !== undefined ? valt : egetVal;
  /** @param {string | null} id @param {{ nytt: true }} [val] */
  const valj = (id, val) => {
    if (valt === undefined) setEgetVal(id);
    if (nytt === undefined) setEgetNytt(Boolean(val?.nytt));
    onValj?.(id, val);
  };
  // Det man skrev i läget "nytt" innan man valt någon följer med in i tråden.
  const utkast = useRef(/** @type {{ id: string, text: string } | null} */ (null));
  const [filter, setFilter] = useState(/** @type {"alla" | "olasta"} */ ("alla"));
  const [sok, setSok] = useState("");

  useEffect(() => {
    onOlasta?.(olasta, { fler: olastaFler });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [olasta, olastaFler]);

  // Ett nytt val nollar sökningen i samtalet, inte i listan. Byts gruppen stängs samtalet: det hör till den förra gruppen.
  useEffect(() => {
    if (valt === undefined) setEgetVal(null);
  }, [groupId, valt]);
  useEffect(() => {
    if (nytt === undefined) setEgetNytt(false);
  }, [groupId, nytt]);

  const namn = useMemo(() => {
    /** @type {Map<string, Medlemsrad>} */
    const m = new Map();
    for (const r of medlemmar ?? []) if (r?.userId) m.set(r.userId, r);
    return m;
  }, [medlemmar]);
  // ⛔ ALDRIG ETT ID SOM NAMN (#218): medlemskapets namn, den inloggades eget namn, annars "Namn saknas".
  const personnamn = usePersonnamn();
  const namnFor = (/** @type {string} */ id) => personnamn(namn.get(id)?.namn, id).text;

  /*
   * ⛔ GRUPPCHATTEN FINNS ALLTID I LISTAN, ÖVERST (0.68.0). CP 2026-10-06, i en grupp med en medlem: "Hur skriver jag ett
   * meddelande till hela gruppen?" Det gick inte. Listan visade bara agentsamtalet, och Till i "Nytt meddelande" bara Agent:
   * `oppnaGrupp` anropades aldrig från vyn, så gruppchatten fanns bara där någon redan hade skapat den (i mätdatan var den sådd).
   * Raden härleds här ur gruppen, den lagras inte: ett tomt samtalsdokument per grupp hade varit en rad i databasen som
   * bara finns för att vyn ska ha något att rita. Samtalet skapas med `oppnaGrupp` när någon öppnar raden (`ej: true`).
   */
  const gruppSid = groupId ? samtalsnyckel({ groupId, slag: "grupp" }) : null;
  /** @type {Array<typeof rader[number] & { ej?: true }>} */
  const allaRader = useMemo(() => {
    if (!gruppSid || !groupId) return rader;
    const finns = rader.find((r) => r.samtal.id === gruppSid);
    const ovriga = rader.filter((r) => r.samtal.id !== gruppSid);
    if (finns) return [finns, ...ovriga];
    if (laddar || fel) return rader;
    return [{ samtal: { id: gruppSid, groupId, slag: "grupp", skapad: 0, skapadAv: "" }, senaste: null, olasta: 0, lastTill: 0, motpart: null, ej: true }, ...ovriga];
  }, [rader, gruppSid, groupId, laddar, fel]);

  const nu = Date.now();
  const visade = allaRader
    .filter((r) => (filter === "olasta" ? r.olasta > 0 : true))
    .filter((r) => {
      const q = sok.trim().toLocaleLowerCase("sv");
      if (!q) return true;
      const rubrik = r.samtal.slag === "grupp" ? gruppNamn : namnFor(r.motpart ?? "");
      return rubrik.toLocaleLowerCase("sv").includes(q) || (r.senaste?.text ?? "").toLocaleLowerCase("sv").includes(q);
    });
  /*
   * ⛔ TRÅDEN RITAS PÅ DET VALDA ID:T, INTE PÅ LISTAN (#263, SS `ChatInboxPanel.jsx:186-191`). Raden ur listan när den finns.
   * Annars läses gruppen och paret ur nyckeln: ett id i en annan grupp, eller ett par jag inte är med i, ritar ingen tråd.
   * Slaget avgörs av vem den andra är, ur medlemmarna, på samma sätt som regeln skiljer `personer` från `agent`.
   */
  /** @type {(typeof rader[number] & { ej?: true }) | null} */
  const vald = useMemo(() => {
    if (!valdId) return null;
    const rad = allaRader.find((r) => r.samtal.id === valdId);
    if (rad) return rad;
    const d = delaSamtalsnyckel(valdId, groupId);
    if (!d || d.groupId !== groupId || !uid) return null;
    // Gruppchatten ur adressen innan listan svarat: `oppnaGrupp` ger den som finns, eller skapar den (0.68.0).
    if ("slag" in d) return { samtal: { id: valdId, groupId: d.groupId, slag: "grupp", skapad: 0, skapadAv: "" }, senaste: null, olasta: 0, lastTill: 0, motpart: null, ej: true };
    if (!d.deltagare.includes(uid)) return null;
    const annan = d.deltagare[0] === uid ? d.deltagare[1] : d.deltagare[0];
    const slag = namn.get(annan)?.typ === "agent" ? "agent" : "personer";
    return { samtal: { id: valdId, groupId: d.groupId, slag, deltagare: d.deltagare, skapad: 0, skapadAv: "" }, senaste: null, olasta: 0, lastTill: 0, motpart: annan };
  }, [valdId, allaRader, groupId, uid, namn]);
  const hoger = nyttLage || Boolean(vald);
  // ⛔ TRÅDEN GÄLLER BARA GRUPPCHATTEN, och ett nytt samtalsval stänger den (0.68.0). Ett trådid kvar från förra samtalet hade
  // öppnat en tråd under fel samtal.
  const [egenTrad, setEgenTrad] = useState(/** @type {string | null} */ (null));
  useEffect(() => {
    if (valtTrad === undefined) setEgenTrad(null);
  }, [valdId, valtTrad]);
  // ⛔ TRÅDAR BARA NÄR KÄLLAN HAR DEM (BÖR 2): en app som inte skickat `tradar` får varken knapp, märke eller trådvy.
  const medTradar = harTradar(kalla);
  const tradId = medTradar && vald?.samtal.slag === "grupp" ? (valtTrad !== undefined ? valtTrad : egenTrad) : null;
  /*
   * ⛔ MÄRKENA LIGGER KVAR NÄR TRÅDEN ÖPPNAS OCH STÄNGS (BÖR 4). Chatten monteras om när man går tillbaka från en tråd, och utan
   * ett minne utanför den hade varje återkomst läst alla rötter igen. Minnet är per samtal; ett svar eller en omdöpning i tråden
   * ändrar bara sin egen rad.
   */
  const tradminne = useRef(/** @type {Map<string, Map<string, Tradrad>>} */ (new Map()));
  // Fokus tillbaka till märket när tråden stängs (KAN 6).
  const [fokusRot, setFokusRot] = useState(/** @type {string | null} */ (null));
  /** @param {string | null} tid */
  const valjTrad = (tid) => {
    if (tid === null && tradId) setFokusRot(tradId);
    if (valtTrad === undefined) setEgenTrad(tid);
    onValjTrad?.(tid);
  };
  /** @param {string} sid @param {string} tid @param {Partial<Tradrad>} andring */
  const andraTradrad = (sid, tid, andring) => {
    const m = tradminne.current.get(sid) ?? new Map();
    m.set(tid, { ...(m.get(tid) ?? { finns: false }), ...andring });
    tradminne.current.set(sid, m);
  };
  // Utkastet hör till den tråd som just öppnades ur läget "nytt". Den har läst det när den monterades; sedan glöms det.
  useEffect(() => {
    utkast.current = null;
  }, [valdId]);

  /** @param {typeof rader[number]} r */
  const rubrikFor = (r) => (r.samtal.slag === "grupp" ? gruppNamn : namnFor(r.motpart ?? ""));
  /** @param {typeof rader[number]} r @param {"md" | "sm"} storlek */
  const markeFor = (r, storlek) => {
    if (r.samtal.slag === "grupp") return <OpsIdentity name={gruppNamn} seed={groupId ?? "grupp"} size={storlek} icon={GruppIkon} />;
    const m = namn.get(r.motpart ?? "");
    if (r.samtal.slag === "agent") return <OpsIdentity name={m?.namn || t.agent} seed={r.motpart ?? "agent"} size={storlek} icon={AgentIkon} rund />;
    return <OpsIdentity name={namnFor(r.motpart ?? "")} seed={r.motpart ?? ""} imageUrl={m?.bild || undefined} size={storlek} rund />;
  };
  /** @param {typeof rader[number]} r */
  const slagetFor = (r) => (r.samtal.slag === "grupp" ? t.grupp : r.samtal.slag === "agent" ? t.agent : t.privat);

  return (
    /* ⛔ HÖJDEN ÄR FÖNSTRET MINUS SKALETS RAMAR (huvudet med sin kant på 1 px, och bottenraden under md), så att listan och
       samtalet rullar var för sig och skrivfältet står kvar längst ned, som SS (`h-full`, `:957`). Mätt i check-skalyta
       avsnitt 29: utan den enda pixeln för huvudets kant rullade hela sidan en pixel, och skrivfältet hamnade under bottenraden. */
    <div
      data-ops-meddelanden=""
      className="flex h-[calc(100dvh-var(--safe-top)-var(--topbar-height)-1px-var(--bottom-nav-h)-var(--safe-bottom))] min-h-0 flex-col bg-canvas md:h-[calc(100dvh-var(--safe-top)-var(--topbar-height)-1px)] md:flex-row md:gap-2 md:p-2"
    >
      {/* ── Listan ─────────────────────────────────────────────────────────────────────────── */}
      <section
        aria-label={t.rubrik}
        data-samtalslista=""
        className={cx(
          "min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface md:flex md:w-[35%] md:min-w-[220px] md:max-w-[40%] md:flex-none md:shrink-0 md:rounded-xl",
          hoger ? "hidden" : "flex",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-1">
          <span className="text-accent">
            <MeddelandeIkon size={18} />
          </span>
          <h2 className="m-0 min-w-0 flex-1 truncate text-etikett font-semibold text-ink">{t.rubrik}</h2>
          {groupId ? (
            <button
              type="button"
              aria-pressed={nyttLage}
              onClick={() => valj(null, { nytt: true })}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-base px-2 text-meta font-medium text-accent transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <PlusIkon size={14} />
              <span>{t.nytt}</span>
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 px-3 py-1">
          <div role="group" aria-label={t.rubrik} className="flex items-center rounded-base border border-line bg-canvas p-0.5">
            {/** @type {const} */ (["alla", "olasta"]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cx(
                  "relative min-h-8 cursor-pointer rounded-sm px-2.5 text-liten font-medium transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  filter === f ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                {f === "alla" ? t.alla : t.olasta}
                {f === "olasta" ? <OpsCountBadge count={olasta} fler={olastaFler} text={t.olastaText} placement="corner" /> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="shrink-0 px-3 py-1.5">
          <label className="flex min-h-9 items-center gap-1.5 rounded-base border border-line bg-surface px-2.5 text-ink-muted focus-within:outline-2 focus-within:outline-accent">
            <SokIkon size={14} />
            <input
              type="search"
              value={sok}
              onChange={(e) => setSok(e.target.value)}
              placeholder={t.sok}
              aria-label={t.sok}
              className="min-w-0 flex-1 bg-transparent text-hjalp text-ink outline-none placeholder:text-ink-muted"
            />
            {sok ? (
              <button type="button" onClick={() => setSok("")} aria-label={t.rensaSok} className="inline-flex cursor-pointer text-ink-muted hover:text-ink">
                <KryssIkon size={14} />
              </button>
            ) : null}
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {fel ? (
            <OpsBanner tone="danger" title={t.fel}>
              {fel.message}
            </OpsBanner>
          ) : laddar ? (
            <p className="m-0 px-2 py-6 text-center text-meta text-ink-muted" role="status">
              …
            </p>
          ) : visade.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span className="text-ink-muted">
                <MeddelandeIkon size={40} />
              </span>
              <p className="m-0 mt-3 text-etikett text-ink-muted">{sok.trim() ? t.ingenTraff : filter === "olasta" ? t.tomtOlasta : t.tomt}</p>
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {visade.map((r) => {
                const aktiv = r.samtal.id === valdId;
                const s = r.senaste;
                return (
                  <li key={r.samtal.id}>
                    <button
                      type="button"
                      data-samtalsrad={r.samtal.slag}
                      aria-current={aktiv || undefined}
                      onClick={() => valj(r.samtal.id)}
                      className={cx(
                        "flex w-full cursor-pointer items-center gap-3 rounded-card px-3 py-1.5 text-left transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                        aktiv ? "bg-hover" : "hover:bg-hover",
                      )}
                    >
                      <span className="relative shrink-0">
                        <span aria-hidden="true" className="inline-flex">
                          {markeFor(r, "md")}
                        </span>
                        <OpsCountBadge count={r.olasta} fler={r.olastaFler === true} text={t.olastaText} placement="corner" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cx("min-w-0 flex-1 truncate text-etikett font-medium", r.olasta > 0 ? "text-ink" : "text-ink-secondary")}>{rubrikFor(r)}</span>
                          {s ? <span data-tid="" className="shrink-0 text-liten tabular-nums text-ink-muted">{radtid(s.tid, nu, locale)}</span> : null}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1">
                          <span data-slag="" className={cx("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-liten font-medium", r.samtal.slag === "grupp" ? "bg-hover text-ink-secondary" : "bg-accent-faint text-accent")}>
                            {r.samtal.slag !== "grupp" ? <LasIkon size={10} /> : null}
                            {slagetFor(r)}
                          </span>
                        </span>
                        {s ? (
                          <span className={cx("mt-0.5 block truncate text-meta", r.olasta > 0 ? "text-ink-secondary" : "text-ink-muted")}>
                            <span className="text-ink-muted" data-namn-saknas={s.av !== uid && namnFor(s.av) === NAMN_SAKNAS ? "" : undefined}>{s.av === uid ? t.du : namnFor(s.av)}: </span>
                            {utdrag(s.text)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── Samtalet, eller läget "nytt" ─────────────────────────────────────────────────────── */}
      <section
        aria-label={nyttLage ? t.nytt : vald ? rubrikFor(vald) : t.valjSamtal}
        className={cx("min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden bg-surface md:flex md:rounded-xl", hoger ? "flex" : "hidden")}
      >
        {hoger && !(vald && tradId) ? (
          /* Telefon: en rad "‹ Tillbaka" överst, som SS (`ChatInboxPanel.jsx:880-892`). Läget "nytt" har samma rad.
             ⛔ INTE I EN TRÅD (0.68.0): tråden har sin egen rad tillbaka till gruppchatten, och två rader tillbaka ovanför
             varandra, till två olika ställen, är samma sorts dubblering som den dubblerade hamburgaren i #164. */
          <button
            type="button"
            onClick={() => valj(null)}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b border-line px-3 text-meta text-ink-secondary hover:text-ink md:hidden"
          >
            <ChevronVansterIkon size={14} />
            <span>{t.tillbaka}</span>
          </button>
        ) : null}
        {nyttLage && groupId ? (
          /*
           * ⛔ EN NY `NyttSamtal` PER GRUPP. Annars stod mottagaren och ett fel från `oppnaPrivat` i g kvar i h när appen
           * styr läget och det överlever bytet. Utkastet följer med ut: det är avsett. Det skrevs till någon i g, och
           * mottagarna i h är andra människor. Ett utkast som bytte grupp med en är ett meddelande till fel personer.
           */
          <NyttSamtal
            key={groupId}
            gruppMarke={<OpsIdentity name={gruppNamn} seed={groupId} size="sm" icon={GruppIkon} />}
            kalla={kalla}
            uid={uid}
            groupId={groupId}
            medlemmar={medlemmar}
            texter={t}
            onOppnat={(s, text) => {
              // Ett samtal i en grupp som inte längre visas når aldrig hit: `NyttSamtal` monteras om per grupp (`key`), och en
              // avmonterad gör ingenting med svaret (`monterad`). En egen gruppkontroll här var grön utan sig själv i varje prov
              // och togs bort i fjärde varvet av granskningen av PR 264 (regel 4).
              utkast.current = { id: s.id, text };
              // ⛔ Som SS (`ChatInboxPanel.jsx:484-487`): filtret och sökningen nollas, annars döljer "Olästa" det nya samtalet.
              setFilter("alla");
              setSok("");
              laggIn(s);
              valj(s.id);
            }}
          />
        ) : vald && tradId ? (
          <OpsTrad
            key={`${vald.samtal.id}|${tradId}`}
            kalla={kalla}
            uid={uid}
            samtal={vald.samtal}
            tid={tradId}
            gruppNamn={gruppNamn}
            namnFor={namnFor}
            medlemmar={medlemmar}
            onStang={() => valjTrad(null)}
            // Ett svar gör tråden till en tråd och gör antalet okänt: chatten räknar om just den raden när den visas igen.
            onSvarat={() => andraTradrad(vald.samtal.id, tradId, { finns: true, antal: undefined })}
            onDopt={(/** @type {string | null} */ n) => andraTradrad(vald.samtal.id, tradId, { finns: true, namn: n ?? undefined })}
            sprak={sprak}
            texter={t}
          />
        ) : vald?.ej && groupId ? (
          <OppnaGruppchatt key={vald.samtal.id} kalla={kalla} uid={uid} groupId={groupId} texter={t} onOppnad={(s) => laggIn(s)} />
        ) : vald ? (
          <OpsSamtal
            key={vald.samtal.id}
            // ⛔ Om källan har trådar avgör OpsSamtal själv (`harTradar`), en vakt och inte två (regel 4).
            onOppnaTrad={valjTrad}
            tradminne={tradminne.current}
            fokusRot={fokusRot}
            onFokuserad={() => setFokusRot(null)}
            kalla={kalla}
            uid={uid}
            samtal={vald.samtal}
            rubrik={rubrikFor(vald)}
            marke={markeFor(vald, "md")}
            lastTill={vald.lastTill}
            namnFor={namnFor}
            medlemmar={medlemmar}
            onLast={lasOm}
            onSkickat={(m) => laggIn(vald.samtal, m)}
            utkast={utkast.current?.id === vald.samtal.id ? utkast.current.text : undefined}
            sprak={sprak}
            texter={t}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="text-ink-muted opacity-50">
              <MeddelandeIkon size={48} />
            </span>
            <p className="m-0 mt-3 text-etikett font-medium text-ink-muted">{t.valjSamtal}</p>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Gruppchatten som ingen har öppnat än (0.68.0): skapas med `oppnaGrupp` när någon öppnar raden, och läggs sedan in i listan
 * (`onOppnad`), så att vyn ritar det riktiga samtalet. Fel står kvar som en banderoll, aldrig tyst.
 *
 * @param {{ kalla: ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>, uid: string, groupId: string, texter: Required<Meddelandetexter>, onOppnad: (s: import("../lib/samtal.js").Samtal) => void }} props
 */
function OppnaGruppchatt({ kalla, uid, groupId, texter: t, onOppnad }) {
  const [fel, setFel] = useState(/** @type {string | null} */ (null));
  useEffect(() => {
    let levande = true;
    kalla.oppnaGrupp({ groupId, uid }).then(
      (s) => levande && onOppnad(s),
      (e) => levande && setFel(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      levande = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, groupId, uid]);
  return (
    <div data-ops-oppnar-grupp="" aria-busy={!fel || undefined} className="flex min-h-0 flex-1 flex-col px-3 py-3">
      {fel ? (
        <OpsBanner tone="danger" title={t.oppnaFel}>
          {fel}
        </OpsBanner>
      ) : (
        <p role="status" className="m-0 py-6 text-center text-meta text-ink-muted">
          {t.oppnarGrupp}
        </p>
      )}
    </div>
  );
}

/**
 * Läget "nytt" i högerpanelen (0.63.0, #263): Till överst, med raden om vem som ser samtalet, och trådens skrivfält längst ned.
 *
 * ⛔ VALET ÖPPNAR SAMTALET DIREKT, innan något är skrivet, som SS "Starta chatt" (`ChatInboxPanel.jsx:1091-1124`, `:477-505`).
 * `oppnaPrivat` ger samma samtal som förra gången (nyckeln är härledd), så ett befintligt samtal öppnas med sin historik och
 * inget nytt skapas. Det första meddelandet skrivs sedan i trådens eget skrivfält, och man står kvar i tråden.
 *
 * ⛔ DET MAN SKRIVIT INNAN VALET FÖLJER MED, och ett Skicka utan mottagare säger vad som saknas i stället för att inte göra något.
 *
 * @param {{ kalla: ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>, uid: string, groupId: string, medlemmar: ReadonlyArray<Medlemsrad>, texter: Required<Meddelandetexter>, gruppMarke: import("react").ReactNode, onOppnat: (samtal: import("../lib/samtal.js").Samtal, text: string) => void }} props
 */
function NyttSamtal({ kalla, uid, groupId, medlemmar, texter: t, gruppMarke, onOppnat }) {
  const [mottagare, setMottagare] = useState(/** @type {import("../lib/samtal.js").Mottagare | null} */ (null));
  const [text, setTextState] = useState("");
  // ⛔ Texten läses ur en ref när samtalet öppnats, inte ur stängningen: det man skrev MEDAN `oppnaPrivat` pågick följer med.
  const textNu = useRef("");
  const setText = (/** @type {string} */ v) => {
    textNu.current = v;
    setTextState(v);
  };
  const [fel, setFel] = useState(/** @type {{ falt?: "till", text: string } | null} */ (null));
  const [oppnar, setOppnar] = useState(false);
  const tillId = useId();
  const monterad = useRef(true);
  useEffect(() => {
    monterad.current = true;
    return () => {
      monterad.current = false;
    };
  }, []);

  /** @param {import("../lib/samtal.js").Mottagare} m */
  const oppna = async (m) => {
    // Spärren först: ett andra val medan det första öppnas byter inte mottagare under ett samtal som redan är på väg.
    if (oppnar) return;
    setMottagare(m);
    if (m.slag !== "grupp" && ((m.slag !== "person" && m.slag !== "agent") || !m.uid)) return;
    setFel(null);
    setOppnar(true);
    try {
      // ⛔ "Hela gruppen" (0.68.0) öppnar gruppchatten, och skapar den om ingen har skrivit i den än.
      const s =
        m.slag === "grupp"
          ? await kalla.oppnaGrupp({ groupId, uid })
          : await kalla.oppnaPrivat(m.slag === "agent" ? { groupId, uid, annan: m.uid ?? "", slag: "agent" } : { groupId, uid, annan: m.uid });
      // ⛔ Avmonterad under öppnandet, t.ex. för att man tryckte Tillbaka: tråden öppnas inte bakom ryggen på en som ångrade sig.
      if (!monterad.current) return;
      onOppnat(s, textNu.current);
    } catch (e) {
      // Ingen kontroll av `monterad` här: en setState på en avmonterad komponent gör ingenting i React 18, så en kontroll
      // hade inte gått att se falla (samma skäl som gruppkontrollen i `onOppnat`, fjärde varvet av granskningen av PR 264).
      setFel({ text: e instanceof Error ? e.message : String(e) });
      setOppnar(false);
    }
  };

  return (
    <div data-ops-nytt="" aria-busy={oppnar || undefined} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-faint text-accent">
          <PlusIkon size={18} />
        </span>
        <h3 className="m-0 min-w-0 flex-1 truncate text-etikett font-semibold text-ink">{t.nytt}</h3>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {fel && !fel.falt ? (
          <OpsBanner tone="danger" title={t.oppnaFel}>
            {fel.text}
          </OpsBanner>
        ) : null}
        <span id={tillId} className="text-meta font-medium text-ink-secondary">
          {t.till}
        </span>
        <OpsMottagare lage="person" helaGruppen={t.helaGruppen} gruppMarke={gruppMarke} medlemmar={medlemmar} uid={uid} value={mottagare} onChange={oppna} ariaLabel={t.till} tomText={t.ingenAnnan} />
        {/*
          ⛔ RADEN FÖLJER VALET, OCH FINNS INTE INNAN NÅGOT ÄR VALT (0.68.0, omgranskningen av PR 268, A6). Förut stod "Bara ni två
          ser det här" redan innan valet, med "Hela gruppen" först under Till var det fel om det som låg närmast till hands.
          Valet öppnar samtalet direkt, och samtalets huvud säger sedan samma sak.
        */}
        {mottagare ? (
          <p data-privat="" className="m-0 flex items-center gap-1.5 text-meta text-ink-secondary">
            {mottagare.slag !== "grupp" ? <LasIkon size={14} /> : null}
            <span>{mottagare.slag === "grupp" ? t.gruppRad : mottagare.slag === "agent" ? t.agentRad : t.privatRad}</span>
          </p>
        ) : null}
        {fel?.falt === "till" ? (
          <p role="alert" className="m-0 text-meta text-danger">
            {fel.text}
          </p>
        ) : null}
      </div>
      <Skrivfalt
        text={text}
        setText={setText}
        skickar={oppnar}
        texter={t}
        onSkicka={() => {
          if (!mottagare) setFel({ falt: "till", text: t.valjMottagare });
        }}
      />
    </div>
  );
}

/**
 * @typedef {object} Omnamnande (chattens nattskiva) Vilka som går att nämna i skrivfältet.
 * @property {ReadonlyArray<{ uid: string, namn: string, typ: string }>} kandidater Aktiva medlemmar utom en själv: personer och agenten.
 * @property {boolean} alla Om "@alla" erbjuds (gruppchatten och trådar).
 */

/** Hur många förslag @-listan visar. */
const MAX_FORSLAG = 6;

/**
 * Trådens skrivfält: en textruta och knappen Skicka. Samma i ett samtal och i läget "nytt", så att det första meddelandet
 * skrivs på samma ställe som alla andra (SS: trådens `ComposerBar`).
 *
 * ⛔ OMNÄMNANDEN (chattens nattskiva, med `omnamnande`): "@" följt av bokstäver öppnar en lista ur gruppens medlemmar och agenten.
 * Valet skriver `@Namn` i texten och minns UID:t. Vid Skicka går `namner` med de uid vars `@Namn` fortfarande står i texten, så att
 * ett omnämnande man raderat ur texten inte skickas. "@alla" blir `["alla"]`. Listan nås med tangentbordet: pilarna väljer, Enter
 * eller Tab tar valet, Escape stänger.
 *
 * `fokusNyckel`: när den ändras (ett citat valdes) får fältet fokus. `onEscape`: Escape utan öppen lista (avbryter citatet).
 *
 * @param {{ text: string, setText: (t: string) => void, skickar: boolean, onSkicka: (extra?: { namner?: string[] }) => void, texter: Required<Meddelandetexter>, fokus?: boolean, omnamnande?: Omnamnande | null, fokusNyckel?: string, onEscape?: () => void }} props
 */
function Skrivfalt({ text, setText, skickar, onSkicka, texter: t, fokus = false, omnamnande = null, fokusNyckel, onEscape }) {
  const ruta = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const listId = useId();
  const valda = useRef(/** @type {Map<string, string>} */ (new Map()));
  const [fraga, setFraga] = useState(/** @type {{ start: number, q: string } | null} */ (null));
  const [aktiv, setAktiv] = useState(0);
  useEffect(() => {
    if (fokus) ruta.current?.focus({ preventScroll: true });
    // Bara när fältet monteras: tråden som just öppnades ur läget "nytt" tar emot skrivandet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const forslag = useMemo(() => {
    if (!omnamnande || !fraga) return [];
    const q = fraga.q.toLocaleLowerCase("sv");
    const personer = omnamnande.kandidater.filter((k) => k.namn.toLocaleLowerCase("sv").split(/\s+/).some((d) => d.startsWith(q)) || k.namn.toLocaleLowerCase("sv").startsWith(q));
    const alla = omnamnande.alla && t.allaNamn.toLocaleLowerCase("sv").startsWith(q) ? [{ uid: "alla", namn: t.allaNamn, typ: "alla" }] : [];
    return [...personer, ...alla].slice(0, MAX_FORSLAG);
  }, [omnamnande, fraga, t.allaNamn]);
  const oppen = forslag.length > 0;
  useEffect(() => {
    if (fokusNyckel) ruta.current?.focus({ preventScroll: true });
  }, [fokusNyckel]);
  /** @param {string} v @param {number} markor */
  const las = (v, markor) => {
    if (!omnamnande) return setFraga(null);
    const m = v.slice(0, markor).match(/(^|\s)@([\p{L}\p{N}_.-]*)$/u);
    setFraga(m ? { start: markor - m[2].length - 1, q: m[2] } : null);
    setAktiv(0);
  };
  /** @param {{ uid: string, namn: string }} k */
  const valj = (k) => {
    if (!fraga) return;
    const fore = text.slice(0, fraga.start);
    const efter = text.slice(fraga.start + 1 + fraga.q.length);
    const insatt = `@${k.namn} `;
    valda.current.set(k.uid, k.namn);
    setText(`${fore}${insatt}${efter.replace(/^ /, "")}`);
    setFraga(null);
    const pos = fore.length + insatt.length;
    requestAnimationFrame(() => ruta.current?.setSelectionRange(pos, pos));
  };
  const skicka = () => {
    const namner = [...valda.current].filter(([, namn]) => text.includes(`@${namn}`)).map(([uid]) => uid);
    valda.current = new Map();
    setFraga(null);
    // ⛔ "@alla" står ensamt (modellen): hela gruppen är redan alla.
    onSkicka(namner.length ? { namner: namner.includes("alla") ? ["alla"] : namner } : undefined);
  };
  return (
    <form
      className="relative flex shrink-0 items-end gap-2 border-t border-line px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        skicka();
      }}
    >
      {oppen ? (
        <ul id={listId} role="listbox" aria-label={t.namnForslag} data-omnamnande="" className="absolute bottom-full left-3 z-10 mb-1 max-w-[calc(100%-1.5rem)] min-w-56 list-none overflow-hidden rounded-card border border-line bg-surface p-1 shadow-md">
          {forslag.map((k, i) => (
            <li
              key={k.uid}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === aktiv}
              data-forslag={k.uid}
              onMouseDown={(e) => {
                e.preventDefault();
                valj(k);
              }}
              className={cx("flex min-h-11 cursor-pointer items-center gap-2 rounded-base px-2 text-etikett text-ink", i === aktiv ? "bg-hover" : "")}
            >
              <span className="text-ink-muted">{k.typ === "agent" ? <AgentIkon size={14} /> : k.typ === "alla" ? <GruppIkon size={14} /> : "@"}</span>
              <span className="min-w-0 truncate">{k.namn}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        ref={ruta}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          las(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (oppen) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setAktiv((a) => (a + (e.key === "ArrowDown" ? 1 : forslag.length - 1)) % forslag.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              valj(forslag[aktiv] ?? forslag[0]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setFraga(null);
              return;
            }
          }
          if (e.key === "Escape" && onEscape) {
            e.preventDefault();
            onEscape();
            return;
          }
          // ⛔ Enter skickar, Skift plus Enter bryter raden, som SS skrivfält (`ComposerBar.jsx`).
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            skicka();
          }
        }}
        rows={1}
        maxLength={MAX_MEDDELANDE}
        placeholder={t.skriv}
        aria-label={t.skriv}
        aria-controls={oppen ? listId : undefined}
        aria-activedescendant={oppen ? `${listId}-${aktiv}` : undefined}
        aria-autocomplete={omnamnande ? "list" : undefined}
        className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-canvas px-3.5 py-2.5 text-etikett text-ink outline-none placeholder:text-ink-muted focus-visible:border-accent"
      />
      <button
        type="submit"
        aria-label={t.skicka}
        disabled={skickar || !text.trim()}
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-contrast transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-hover disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <SkickaIkon size={18} />
      </button>
    </form>
  );
}

/**
 * Vilka som går att nämna: aktiva medlemmar utom en själv, och "@alla" i gruppchatten och trådar. `null` när källan saknar
 * omnämnanden eller samtalet är privat (där finns ingen att nämna som inte redan läser).
 * @param {unknown} kalla @param {string} slag @param {ReadonlyArray<Medlemsrad> | undefined} medlemmar @param {string} uid
 * @param {(uid: string) => string} namnFor
 * @returns {Omnamnande | null}
 */
function omnamnandeFor(kalla, slag, medlemmar, uid, namnFor) {
  if (!harOmnamnanden(kalla) || slag !== "grupp") return null;
  const kandidater = (medlemmar ?? [])
    .filter((m) => m && m.userId !== uid && (m.status ?? "aktiv") === "aktiv")
    .map((m) => ({ uid: m.userId, namn: namnFor(m.userId), typ: m.typ ?? "person" }));
  return { kandidater, alla: true };
}

/**
 * Ett samtal: huvudet, meddelandena och skrivfältet. Samma vy för gruppchatten, ett privat samtal och ett agentsamtal.
 *
 * ⛔ LÄSMÄRKET FLYTTAS NÄR SAMTALET ÄR ÖPPET OCH NÅGOT NYTT FINNS, och bara framåt. Den som har samtalet öppet har sett
 * det som står där.
 *
 * @param {object} props
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>} props.kalla
 * @param {string} props.uid
 * @param {import("../lib/samtal.js").Samtal} props.samtal
 * @param {string} props.rubrik
 * @param {import("react").ReactNode} [props.marke]
 * @param {number} [props.lastTill]
 * @param {(uid: string) => string} props.namnFor
 * @param {ReadonlyArray<Medlemsrad>} [props.medlemmar]
 * @param {() => void} [props.onLast] Anropas när läsmärket flyttats, så att inkorgens räknare kan läsas om.
 * @param {(meddelande: import("../lib/samtal.js").Meddelande & { id: string }) => void} [props.onSkickat] (0.63.0, #263) Anropas med
 *   det skickade meddelandet, så att inkorgen kan lägga in raden direkt i stället för vid nästa omläsning.
 * @param {string} [props.utkast] (0.63.0) Text som redan står i skrivfältet när samtalet öppnas, och fältet får fokus.
 * @param {(tid: string) => void} [props.onOppnaTrad] (0.68.0) Öppnar tråden ur ett meddelande. Utelämnad, eller en källa utan
 *   trådar (`harTradar`): inga trådar visas.
 * @param {Map<string, Map<string, Tradrad>>} [props.tradminne] (0.68.0) Märkenas minne per samtal, så att en återkomst från en tråd
 *   inte läser alla rötter igen. Utelämnat: ett eget minne som lever så länge vyn.
 * @param {string | null} [props.fokusRot] (0.68.0) Märket som ska få fokus när det ritats, efter att tråden stängts.
 * @param {() => void} [props.onFokuserad] (0.68.0) Anropas när fokus har flyttats dit.
 *   ⛔ GÄLLER BARA GRUPPCHATTEN, och det avgörs här och inte av den som skickar in funktionen: ett privat samtal ritas utan
 *   trådar också när en app skickar den.
 * @param {string} [props.sprak]
 * @param {Meddelandetexter} [props.texter]
 */
export function OpsSamtal({ kalla, uid, samtal, rubrik, marke, lastTill = 0, namnFor, medlemmar, onLast, onSkickat, utkast, onOppnaTrad, tradminne, fokusRot, onFokuserad, sprak: sprakProp, texter = {} }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const t = { ...TEXTER, ...texter };
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const [meddelanden, setMeddelanden] = useState(/** @type {Array<import("../lib/samtal.js").Meddelande & { id: string }> | null} */ (null));
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));
  const [text, setText] = useState(utkast ?? "");
  const [skickar, setSkickar] = useState(false);
  const markt = useRef(lastTill);
  const lyssnar = useRef(false);
  const medTradar = Boolean(onOppnaTrad) && samtal.slag === "grupp" && harTradar(kalla);
  const loggRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const historik = useHistorik({ kalla, sid: samtal.id, live: meddelanden, logg: loggRef });
  const alla = historik.alla;
  const reakt = useReaktioner(harReaktioner(kalla) ? kalla : null, samtal.id, undefined, uid);
  // ⛔ Citat bara utanför gruppchatten (regeln kräver det): där är tråden svaret.
  const medCitat = harCitat(kalla) && samtal.slag !== "grupp";
  const [svarPa, setSvarPa] = useState(/** @type {(import("../lib/samtal.js").Meddelande & { id: string }) | null} */ (null));
  const citatuppslag = useCitatuppslag(medCitat || alla.some((m) => m.svarPa) ? kalla : null, samtal.id, alla);
  const sok = useSokISamtal(alla, loggRef);
  const { rader: tradar, fel: tradfel } = useTradmarken({ kalla: medTradar ? kalla : null, sid: samtal.id, meddelanden: meddelanden ? alla : null, minne: tradminne });
  const slut = useRef(/** @type {HTMLDivElement | null} */ (null));

  const lasIn = async () => {
    try {
      setMeddelanden(await kalla.meddelanden(samtal.id));
      setFel(null);
    } catch (e) {
      setFel(e instanceof Error ? e : new Error(String(e)));
    }
  };

  useEffect(() => {
    const stang = kalla.prenumerera(samtal.id, {
      onData: (rader) => {
        setMeddelanden(rader);
        setFel(null);
      },
      onError: (e) => setFel(e),
    });
    lyssnar.current = Boolean(stang);
    if (!stang) lasIn();
    return () => stang?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, samtal.id]);

  // Läsmärket: den senaste tiden i samtalet, om den är senare än det förra märket.
  useEffect(() => {
    if (!meddelanden || meddelanden.length === 0) return;
    const senast = meddelanden[meddelanden.length - 1].tid;
    if (senast > markt.current) {
      markt.current = senast;
      kalla.markeraLast(samtal.id, uid, senast).then(() => onLast?.(), () => {});
    }
    // ⛔ Bara när något NYTT kommit: en sida bakåt ("Visa äldre") ändrar inte `meddelanden` och ska inte rulla till slutet.
    slut.current?.scrollIntoView?.({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meddelanden]);

  // Fokus tillbaka till märket när tråden stängts (KAN 6). Efter rullningen till slutet, så att märket rullas fram.
  useEffect(() => {
    if (!fokusRot || !meddelanden) return;
    const knapp = /** @type {HTMLElement | null} */ (loggRef.current?.querySelector(`[data-tradrot="${CSS.escape(fokusRot)}"]`) ?? null);
    if (!knapp) return;
    knapp.focus();
    onFokuserad?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fokusRot, meddelanden, tradar]);

  /** @param {{ namner?: string[] }} [extra] */
  const skicka = async (extra) => {
    if (skickar || !text.trim()) return;
    setSkickar(true);
    try {
      const ny = await kalla.skicka(samtal.id, { text, av: uid, ...(extra?.namner ? { namner: extra.namner } : {}), ...(svarPa ? { svarPa: svarPa.id } : {}) });
      setText("");
      setSvarPa(null);
      if (ny && typeof ny.tid === "number") onSkickat?.(/** @type {any} */ (ny));
      // Med en prenumeration kommer meddelandet av sig självt. Utan den läses samtalet om.
      if (!lyssnar.current) await lasIn();
    } catch (e) {
      setFel(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSkickar(false);
    }
  };

  const agent = samtal.slag === "agent";
  const privatRad = samtal.slag === "grupp" ? t.gruppRad : agent ? t.agentRad : t.privatRad;

  return (
    <div data-ops-samtal={samtal.slag} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        {marke}
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-etikett font-semibold text-ink">{rubrik}</h3>
          <p data-privat-rad="" className="m-0 flex items-center gap-1 text-liten text-ink-muted">
            {samtal.slag !== "grupp" ? <LasIkon size={10} /> : null}
            <span>{privatRad}</span>
          </p>
        </div>
        <button
          type="button"
          data-sok-samtal=""
          aria-label={t.sokISamtalet}
          aria-expanded={sok.oppen}
          onClick={() => (sok.oppen ? sok.stang() : sok.oppna())}
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <SokIkon size={16} />
        </button>
      </header>
      {sok.oppen ? <Sokrad sok={sok} antal={alla.length} kanFinnasAldre={historik.kanFinnasAldre} texter={t} /> : null}

      <div ref={loggRef} role="log" aria-label={rubrik} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {fel ? (
          <OpsBanner tone="danger" title={t.fel}>
            {fel.message}
          </OpsBanner>
        ) : null}
        {tradfel ? (
          /* ⛔ KAN 5: aldrig tyst. Meddelandena står kvar och "Svara i tråd" öppnar tråden, men raden säger att märkena kan saknas. */
          <p data-tradarfel="" role="status" className="m-0 py-1 text-center text-liten text-ink-muted">
            {t.tradarFel}
          </p>
        ) : null}
        <VisaAldre historik={historik} texter={t} />
        <Reaktionslage reakt={reakt} texter={t} />
        {meddelanden && meddelanden.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <span className="text-ink-muted opacity-40">
              <MeddelandeIkon size={28} />
            </span>
            <p className="m-0 mt-3 text-etikett text-ink-muted">{t.inga}</p>
            <p data-tomrad="" className="m-0 mt-1 text-liten text-ink-muted">{samtal.slag === "grupp" ? t.gruppTom : privatRad}</p>
          </div>
        ) : null}
        <Meddelanderader
          meddelanden={alla}
          reakt={reakt}
          texter={t}
          citat={{ pa: medCitat, onCitera: (m) => setSvarPa(m), uppslag: citatuppslag }}
          traffar={sok.oppen ? { ids: sok.traffar, aktuell: sok.aktuell } : null}
          uid={uid}
          namnFor={namnFor}
          medlemmar={medlemmar}
          locale={locale}
          visaNamn={samtal.slag === "grupp"}
          efter={
            medTradar
              ? (m) => {
                  const tr = tradar.get(m.id);
                  const finns = Boolean(tr?.finns);
                  const beskrivning = `tradrot-${m.id}`;
                  return (
                    <>
                      <span id={beskrivning} className="sr-only">
                        {`${t.svarPa} ${m.av === uid ? t.du : namnFor(m.av)}: ${utdrag(m.text, 60)}`}
                      </span>
                      <button
                        type="button"
                        data-tradmarke={finns ? "finns" : "ny"}
                        data-tradrot={m.id}
                        aria-describedby={beskrivning}
                        onClick={() => onOppnaTrad?.(m.id)}
                        className={cx(
                          /* ⛔ KAN 6: träffytan är 44 px, men raden växer inte: de negativa marginalerna lägger ytan i luften
                             mellan meddelandena. KAN 9: på dator syns "Svara i tråd" först när pekaren eller fokus är på
                             meddelandet, så att en lång chatt inte blir en rad knappar. På telefon finns ingen hover, och en
                             meny vore ett steg till för det vanligaste: där står den kvar. Märket syns alltid, det är innehåll. */
                          "-my-2 inline-flex min-h-11 max-w-full cursor-pointer items-center gap-1 rounded-full px-2 text-liten font-medium transition-[color,background-color,opacity] duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                          finns
                            ? "text-accent hover:bg-accent-faint"
                            : "text-ink-muted hover:bg-hover hover:text-ink md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100",
                        )}
                      >
                        <TradIkon size={12} />
                        {finns ? (
                          <span className="min-w-0 truncate">
                            {tr?.antal === undefined ? "…" : <span className="tabular-nums">{tr.fler ? `${tr.antal}+` : tr.antal}</span>} {t.svar}
                            {/* ⛔ KAN 9: namnet bara när det inte är rotens egen rad, som står precis ovanför. */}
                            {tr?.namn ? <span className="text-ink-secondary"> · {tr.namn}</span> : null}
                          </span>
                        ) : (
                          <span>{t.svaraITrad}</span>
                        )}
                      </button>
                    </>
                  );
                }
              : undefined
          }
        />
        <Agentrad kalla={kalla} sid={samtal.id} texter={t} />
        <div ref={slut} />
      </div>

      {svarPa ? (
        <div data-svarar-pa={svarPa.id} className="flex shrink-0 items-center gap-2 border-t border-line px-3 pt-2 text-meta text-ink-secondary">
          <CiteraIkon size={14} />
          <span className="min-w-0 flex-1 truncate">
            {t.svararPa} <span className="font-medium text-ink">{svarPa.av === uid ? t.du : namnFor(svarPa.av)}</span>: {utdrag(svarPa.text, 60)}
          </span>
          <button
            type="button"
            aria-label={t.avbrytCitat}
            onClick={() => setSvarPa(null)}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <KryssIkon size={14} />
          </button>
        </div>
      ) : null}
      <Skrivfalt text={text} setText={setText} skickar={skickar} onSkicka={skicka} texter={t} fokus={utkast !== undefined} omnamnande={omnamnandeFor(kalla, samtal.slag, medlemmar, uid, namnFor)} fokusNyckel={svarPa?.id} onEscape={svarPa ? () => setSvarPa(null) : undefined} />
    </div>
  );
}

/**
 * @typedef {object} Tradrad (0.68.0) Vad chatten vet om tråden ur ett meddelande.
 * @property {boolean} finns
 * @property {string} [namn] Bara när en person döpt om tråden.
 * @property {number} [antal] Okänt (`undefined`) tills det räknats, och efter ett svar.
 * @property {boolean} [fler]
 */

/** Hur många av de senaste meddelandena utan tråd som prövas igen när fönstret får fokus. */
const NYA_ROTTER_VID_FOKUS = 10;

/**
 * Märkena under gruppchattens meddelanden (0.68.0, granskningen av PR 268, BÖR 4).
 *
 * ⛔ LÄSNINGARNA, OCH VARFÖR DE ÄR SÅ FÅ:
 *   - en tråd läses per rot, och bara för rötter som inte redan finns i minnet: ett nytt meddelande i chatten är EN läsning;
 *   - antalet svar är en aggregatfråga där källan kan (`count`), och räknas bara för trådar vars antal är okänt;
 *   - märkets namn läser inga meddelanden: det är trådens `namn`, eller inget (roten står redan ovanför).
 *
 * ⛔ ETT SVAR FRÅN NÅGON ANNAN NÅR MÄRKET NÄR FÖNSTRET FÅR FOKUS. Det är den billigaste vägen som håller: en lyssnare per tråd
 * hade varit en öppen läsning per synlig tråd så länge chatten är öppen, och en räknare på tråden hade varit en andra sanning om
 * meddelandena och en skrivning per svar som kan misslyckas för sig. Fokus är samma signal som inkorgen läser om på
 * (`useSamtal`). Vid fokus räknas de kända trådarna om, och de senaste `NYA_ROTTER_VID_FOKUS` rötterna utan tråd prövas igen,
 * eftersom en ny tråd nästan alltid startas ur något som nyss sades. Egna svar och omdöpningar ändrar minnet direkt.
 *
 * @param {{ kalla: (ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> & import("../data/samtalskalla.js").Tradfunktioner) | null, sid: string, meddelanden: ReadonlyArray<{ id: string }> | null, minne?: Map<string, Map<string, Tradrad>> }} p
 * @returns {{ rader: Map<string, Tradrad>, fel: Error | null }}
 */
function useTradmarken({ kalla, sid, meddelanden, minne }) {
  const eget = useRef(/** @type {Map<string, Map<string, Tradrad>>} */ (new Map()));
  const alla = minne ?? eget.current;
  if (!alla.has(sid)) alla.set(sid, new Map());
  const rader = /** @type {Map<string, Tradrad>} */ (alla.get(sid));
  const [, setVersion] = useState(0);
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));

  /** @param {ReadonlyArray<string>} rotter @param {boolean} raknaKanda */
  const las = async (rotter, raknaKanda) => {
    if (!kalla) return;
    try {
      if (rotter.length) {
        const funna = await kalla.tradarFor(sid, rotter);
        const efterId = new Map(funna.map((t) => [t.id, t]));
        for (const r of rotter) {
          const t = efterId.get(r);
          rader.set(r, t ? { ...(rader.get(r) ?? {}), finns: true, namn: t.namn } : { finns: false });
        }
      }
      const raknas = [...rader.entries()].filter(([, v]) => v.finns && (raknaKanda || v.antal === undefined)).map(([k]) => k);
      await Promise.all(
        raknas.map(async (tid) => {
          const { antal, fler } = await kalla.antalSvar(sid, tid);
          rader.set(tid, { ...(/** @type {Tradrad} */ (rader.get(tid))), antal, fler });
        }),
      );
      setFel(null);
    } catch (e) {
      setFel(e instanceof Error ? e : new Error(String(e)));
    }
    setVersion((v) => v + 1);
  };

  // Nya rötter, och trådar vars antal blivit okänt (ett eget svar i tråden).
  useEffect(() => {
    if (!kalla || !meddelanden) return;
    las(meddelanden.map((m) => m.id).filter((id) => !rader.has(id)), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, sid, meddelanden]);

  useEffect(() => {
    if (!kalla || typeof window === "undefined") return undefined;
    const fokus = () => {
      const senaste = (meddelanden ?? []).slice(-NYA_ROTTER_VID_FOKUS).map((m) => m.id).filter((id) => rader.get(id)?.finns === false);
      las(senaste, true);
    };
    window.addEventListener("focus", fokus);
    return () => window.removeEventListener("focus", fokus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, sid, meddelanden]);

  return { rader, fel };
}

/**
 * Meddelandena i en logg: dagens avdelare, bubblorna och tiden. Samma i ett samtal och i en tråd (0.68.0), så att en tråd ser ut
 * som det samtal den hör till.
 *
 * @param {object} props
 * @param {ReadonlyArray<import("../lib/samtal.js").Meddelande & { id: string }>} props.meddelanden
 * @param {string} props.uid
 * @param {(uid: string) => string} props.namnFor
 * @param {ReadonlyArray<Medlemsrad>} [props.medlemmar]
 * @param {string} props.locale
 * @param {boolean} props.visaNamn Avsändarens namn över en annans bubbla (gruppchatten och tråden).
 * @param {(m: import("../lib/samtal.js").Meddelande & { id: string }) => import("react").ReactNode} [props.efter] Det som står efter
 *   tiden under bubblan: trådens märke i gruppchatten.
 * @param {number} [props.forraTid] Tiden på meddelandet före det första, när listan fortsätter en annan (trådens svar efter
 *   roten). Samma dag ger då ingen ny avdelare: två "I dag" på rad är en avdelare som inte avdelar något.
 * @param {ReturnType<typeof useReaktioner>} [props.reakt] (chattens nattskiva) Reaktionerna, när källan har dem.
 * @param {Required<Meddelandetexter>} [props.texter]
 * @param {{ pa: boolean, onCitera: (m: import("../lib/samtal.js").Meddelande & { id: string }) => void, uppslag: Map<string, (import("../lib/samtal.js").Meddelande & { id: string }) | null> }} [props.citat]
 *   (chattens nattskiva) Citaten: knappen när `pa`, och det citerade meddelandet ur `uppslag` (`null`: går inte att läsa).
 * @param {{ ids: ReadonlySet<string>, aktuell: string | null } | null} [props.traffar] Sökningens träffar i samtalet.
 */
function Meddelanderader({ meddelanden, uid, namnFor, medlemmar, locale, visaNamn, efter, forraTid, reakt, texter = TEXTER, citat, traffar }) {
  const medlemsbild = (/** @type {string} */ id) => (medlemmar ?? []).find((m) => m.userId === id)?.bild || undefined;
  const medlemstyp = (/** @type {string} */ id) => (medlemmar ?? []).find((m) => m.userId === id)?.typ;
  return (
    <>
      {meddelanden.map((m, i, alla) => {
        const egen = m.av === uid;
        const forra = alla[i - 1];
        const fore = forra ? forra.tid : forraTid;
        const nyDag = fore === undefined || new Date(fore).toDateString() !== new Date(m.tid).toDateString();
        const fortsattning = !nyDag && forra && forra.av === m.av && m.tid - forra.tid < 5 * 60000;
        const extra = efter?.(m);
        return (
          <div key={m.id}>
            {nyDag ? (
              <div className="flex justify-center py-3">
                <span className="rounded-full bg-canvas px-3 py-1 text-liten font-medium text-ink-muted">{forstaVersal(formatRelativeDate(m.tid, { locale }))}</span>
              </div>
            ) : null}
            <div data-meddelande={egen ? "eget" : "annans"} className={cx("group flex gap-2", fortsattning ? "mt-px" : "mt-2", egen ? "flex-row-reverse" : "")}>
              {!egen ? (
                <span className="w-8 shrink-0">
                  {!fortsattning ? (
                    /* ⛔ KAN 9: agentens svar bär agentens ikon, som agentsamtalets rad i listan, så att ett svar från agenten
                       aldrig ser ut som en persons. */
                    medlemstyp(m.av) === "agent" ? (
                      <OpsIdentity name={namnFor(m.av)} seed={m.av} size="sm" icon={AgentIkon} rund />
                    ) : (
                      <OpsIdentity name={namnFor(m.av)} seed={m.av} imageUrl={medlemsbild(m.av)} size="sm" rund />
                    )
                  ) : null}
                </span>
              ) : null}
              <div className={cx("flex min-w-0 max-w-[70%] flex-col", egen ? "items-end" : "items-start")}>
                {!egen && !fortsattning && visaNamn ? <span className="mb-0.5 ml-1 text-liten text-ink-muted" data-namn-saknas={namnFor(m.av) === NAMN_SAKNAS ? "" : undefined}>{namnFor(m.av)}</span> : null}
                {m.svarPa && citat ? <Citat mid={m.svarPa} uppslag={citat.uppslag} egen={egen} uid={uid} namnFor={namnFor} texter={texter} /> : null}
                <div
                  data-bubbla=""
                  data-traff={traffar?.ids.has(m.id) ? (traffar.aktuell === m.id ? "aktuell" : "traff") : undefined}
                  className={cx(
                    "min-w-0 rounded-2xl px-3.5 py-2 text-etikett leading-relaxed break-words",
                    traffar?.ids.has(m.id) ? (traffar.aktuell === m.id ? "outline-2 outline-offset-2 outline-accent" : "outline-1 outline-offset-2 outline-line-strong") : "",
                    egen ? "bg-accent text-accent-contrast" : "bg-hover text-ink",
                    fortsattning && egen ? "rounded-tr-lg" : "",
                    fortsattning && !egen ? "rounded-tl-lg" : "",
                  )}
                >
                  {/* ⛔ #273: chattens delmängd av markdown, med klickbara http- och https-länkar och ingen HTML. Färgen ärvs från
                      bubblan: den egna är accentfärgad. */}
                  <OpsMarkdown text={m.text} chatt />
                </div>
                {reakt?.pa ? <Reaktionschips m={m} egen={egen} reakt={reakt} texter={texter} /> : null}
                <span className={cx("relative mt-0.5 flex max-w-full items-center gap-1.5", egen ? "mr-1 flex-row-reverse" : "ml-1")}>
                  <span className="text-liten tabular-nums text-ink-muted">{formatTime(m.tid, { locale })}</span>
                  {extra}
                  {reakt?.pa ? <ReageraKnapp m={m} egen={egen} reakt={reakt} texter={texter} /> : null}
                  {citat?.pa ? (
                    <button
                      type="button"
                      data-citera={m.id}
                      aria-label={texter.citera}
                      onClick={() => citat.onCitera(m)}
                      className="-my-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-[color,background-color,opacity] duration-(--duration-fast) ease-standard hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100"
                    >
                      <CiteraIkon size={16} />
                    </button>
                  ) : null}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * En tråd i gruppchatten (0.68.0, cllp/lifehub.app#60): raden tillbaka till gruppchatten, trådens namn med Döp om,
 * rotmeddelandet, svaren och skrivfältet.
 *
 * ⛔ TRÅDEN SKAPAS MED DET FÖRSTA SVARET (`skickaITrad`), inte när vyn öppnas. Döp om finns därför först när tråden finns.
 *
 * ⛔ NAMNET HÄRLEDS UR ROTMEDDELANDET OCH DE FÖRSTA SVAREN (`tradensNamn`), samma regel som appens agent använder, så att
 * agenten och personerna kallar tråden samma sak.
 *
 * @param {object} props
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>} props.kalla
 * @param {string} props.uid
 * @param {import("../lib/samtal.js").Samtal} props.samtal Gruppchatten.
 * @param {string} props.tid Rotmeddelandets id.
 * @param {string} props.gruppNamn
 * @param {(uid: string) => string} props.namnFor
 * @param {ReadonlyArray<Medlemsrad>} [props.medlemmar]
 * @param {() => void} props.onStang Tillbaka till gruppchatten.
 * @param {() => void} [props.onSvarat] Anropas efter ett skickat svar, så att chattens märke kan räknas om.
 * @param {(namn: string | null) => void} [props.onDopt] Anropas efter en omdöpning, med namnet eller `null` för det härledda.
 * @param {string} [props.sprak]
 * @param {Meddelandetexter} [props.texter]
 */
export function OpsTrad({ kalla: kallan, uid, samtal, tid, gruppNamn, namnFor, medlemmar, onStang, onSvarat, onDopt, sprak: sprakProp, texter = {} }) {
  if (!harTradar(kallan)) throw new Error("OpsTrad: källan har inga trådar. Skicka `tradar` till createSamtalskalla, med samma namn som till samtalsregelfragment.");
  const kalla = kallan;
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const t = { ...TEXTER, ...texter };
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const [rot, setRot] = useState(/** @type {(import("../lib/samtal.js").Meddelande & { id: string }) | null | undefined} */ (undefined));
  const [trad, setTrad] = useState(/** @type {import("../lib/samtal.js").Trad | null} */ (null));
  const [svar, setSvar] = useState(/** @type {Array<import("../lib/samtal.js").Meddelande & { id: string }> | null} */ (null));
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));
  const [text, setText] = useState("");
  const [skickar, setSkickar] = useState(false);
  const [redigerar, setRedigerar] = useState(false);
  const [utkastNamn, setUtkastNamn] = useState("");
  const lyssnar = useRef(false);
  const slut = useRef(/** @type {HTMLDivElement | null} */ (null));
  const tradlogg = useRef(/** @type {HTMLDivElement | null} */ (null));
  const historik = useHistorik({ kalla, sid: samtal.id, trad: tid, live: svar, logg: tradlogg });
  // ⛔ Trådens reaktioner bor under tråden (regeln följer tråden). Rotmeddelandets reaktioner står i gruppchatten.
  const reakt = useReaktioner(harReaktioner(kalla) ? kalla : null, samtal.id, tid, uid);
  const namnId = useId();
  const dopKnapp = useRef(/** @type {HTMLButtonElement | null} */ (null));
  // ⛔ KAN 6: fokus stannar i rubriken när Döp om stängs (Spara, Avbryt eller Escape), i stället för att falla till dokumentet.
  const stangDop = () => {
    setRedigerar(false);
    requestAnimationFrame(() => dopKnapp.current?.focus());
  };
  const somFel = (/** @type {unknown} */ e) => (e instanceof Error ? e : new Error(String(e)));

  const lasTraden = async () => {
    try {
      setTrad(await kalla.trad(samtal.id, tid));
    } catch (e) {
      setFel(somFel(e));
    }
  };
  const lasSvar = async () => {
    try {
      setSvar(await kalla.tradmeddelanden(samtal.id, tid));
    } catch (e) {
      setFel(somFel(e));
    }
  };

  useEffect(() => {
    kalla.rotmeddelande(samtal.id, tid).then(
      (r) => setRot(r ? { ...r, id: tid } : null),
      (e) => setFel(somFel(e)),
    );
    lasTraden();
    const stang = kalla.prenumereraTrad(samtal.id, tid, {
      onData: (rader) => setSvar(rader),
      onError: (e) => setFel(e),
    });
    lyssnar.current = Boolean(stang);
    if (!stang) lasSvar();
    return () => stang?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, samtal.id, tid]);

  useEffect(() => {
    slut.current?.scrollIntoView?.({ block: "end" });
  }, [svar]);

  const namn = tradensNamn(trad, [...(rot ? [rot] : []), ...historik.alla]);

  /** @param {{ namner?: string[] }} [extra] */
  const skicka = async (extra) => {
    if (skickar || !text.trim()) return;
    setSkickar(true);
    try {
      await kalla.skickaITrad(samtal.id, tid, { text, av: uid, ...(extra?.namner ? { namner: extra.namner } : {}) });
      setText("");
      onSvarat?.();
      if (!trad) await lasTraden();
      if (!lyssnar.current) await lasSvar();
    } catch (e) {
      setFel(somFel(e));
    } finally {
      setSkickar(false);
    }
  };

  /** @param {string | null} nytt */
  const spara = async (nytt) => {
    try {
      await kalla.dopOm(samtal.id, tid, nytt);
      onDopt?.(nytt && nytt.trim() ? nytt.trim() : null);
      await lasTraden();
      stangDop();
    } catch (e) {
      setFel(somFel(e));
    }
  };

  return (
    <div data-ops-trad="" className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        data-tillbaka-chatten=""
        onClick={onStang}
        className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b border-line px-3 text-meta text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronVansterIkon size={14} />
        <span className="min-w-0 truncate">{gruppNamn}</span>
      </button>
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-faint text-accent">
          <TradIkon size={18} />
        </span>
        {redigerar ? (
          <form
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                stangDop();
              }
            }}
            onSubmit={(e) => {
              e.preventDefault();
              spara(utkastNamn);
            }}
          >
            <label htmlFor={namnId} className="sr-only">
              {t.tradnamn}
            </label>
            <input
              id={namnId}
              value={utkastNamn}
              onChange={(e) => setUtkastNamn(e.target.value)}
              maxLength={MAX_TRADNAMN}
              autoFocus
              className="min-h-9 min-w-0 flex-1 rounded-base border border-line bg-canvas px-2.5 text-etikett text-ink outline-none focus-visible:border-accent"
            />
            <button type="submit" className="inline-flex min-h-9 cursor-pointer items-center rounded-base bg-accent px-3 text-meta font-medium text-accent-contrast hover:bg-accent-hover">
              {t.spara}
            </button>
            <button type="button" onClick={stangDop} className="inline-flex min-h-9 cursor-pointer items-center rounded-base px-2 text-meta text-ink-secondary hover:bg-hover">
              {t.avbryt}
            </button>
            {trad?.namn ? (
              <button type="button" onClick={() => spara(null)} className="inline-flex min-h-9 cursor-pointer items-center rounded-base px-2 text-meta text-accent hover:bg-accent-faint">
                {t.automatisktNamn}
              </button>
            ) : null}
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <h3 data-tradnamn="" className="m-0 truncate text-etikett font-semibold text-ink">
                {namn}
              </h3>
              <p data-privat-rad="" className="m-0 flex items-center gap-1 text-liten text-ink-muted">
                <GruppIkon size={10} />
                <span>{t.tradRad}</span>
              </p>
            </div>
            {trad ? (
              <button
                ref={dopKnapp}
                type="button"
                aria-label={t.dopOm}
                onClick={() => {
                  setUtkastNamn(namn);
                  setRedigerar(true);
                }}
                className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <AndraIkon size={16} />
              </button>
            ) : null}
          </>
        )}
      </header>

      <div ref={tradlogg} role="log" aria-label={namn} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {fel ? (
          <OpsBanner tone="danger" title={t.tradFel}>
            {fel.message}
          </OpsBanner>
        ) : null}
        <div data-rotmeddelande="" className="border-b border-line pb-2">
          {rot ? (
            <Meddelanderader meddelanden={[rot]} uid={uid} namnFor={namnFor} medlemmar={medlemmar} locale={locale} visaNamn />
          ) : rot === null ? (
            <p className="m-0 py-3 text-meta text-ink-muted">{t.rotSaknas}</p>
          ) : null}
        </div>
        <p data-antal-svar="" className="m-0 py-2 text-liten font-medium text-ink-muted">
          {historik.alla.length > 0 ? `${historik.alla.length}${historik.kanFinnasAldre ? "+" : ""} ${t.svar}` : t.ingaSvar}
        </p>
        <VisaAldre historik={historik} texter={t} />
        <Reaktionslage reakt={reakt} texter={t} />
        <Meddelanderader meddelanden={historik.alla} reakt={reakt} texter={t} uid={uid} namnFor={namnFor} medlemmar={medlemmar} locale={locale} visaNamn forraTid={rot?.tid} />
        <Agentrad kalla={kalla} sid={samtal.id} tid={tid} texter={t} />
        <div ref={slut} />
      </div>

      <Skrivfalt text={text} setText={setText} skickar={skickar} onSkicka={skicka} texter={t} fokus omnamnande={omnamnandeFor(kalla, samtal.slag, medlemmar, uid, namnFor)} />
    </div>
  );
}

/**
 * Agentens status som en rad där svaret kommer (#273): "Agenten tänker" eller "Agenten skriver", eller en felrad.
 *
 * ⛔ BARA NÄR KÄLLAN HAR STATUS (`harStatus`). En app som inte skickat `status` får ingen rad och ingen läsning.
 *
 * ⛔ EN STATUS ÄLDRE ÄN TVÅ MINUTER VISAS INTE, OCH DÅ STÅR EN FELRAD I STÄLLET (ärendets krav, regel 5). En agent som kraschade
 * tar aldrig bort sin status, och "tänker" för alltid hade varit en tyst nedsläppsväg som ser ut som arbete. Vyn räknar om när
 * gränsen passeras, med en timer till exakt den tidpunkten, så att raden byts också när ingenting annat händer i samtalet.
 *
 * ⛔ EN LUGN ANIMATION, OCH INGEN ALLS FÖR DEN SOM BETT OM DET (`motion-safe:`). Raden är en `status` och läses upp en gång när
 * den kommer, inte vid varje punkt som tänds.
 *
 * @param {{ kalla: ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>, sid: string, tid?: string, texter: Required<Meddelandetexter> }} props
 */
function Agentrad({ kalla, sid, tid, texter: t }) {
  const { dok, fel } = useAgentstatusdok(harStatus(kalla) ? kalla : null, sid, tid);
  const [nu, setNu] = useState(() => Date.now());
  const visning = agentstatus(dok, nu);
  // Räkna om när statusen passerar sitt tak, också om inget nytt kommer.
  useEffect(() => {
    if (!visning || "fel" in visning) return undefined;
    const kvar = visning.sedan + AGENTSTATUS_MAX_ALDER - Date.now() + 1;
    const h = setTimeout(() => setNu(Date.now()), Math.max(0, kvar));
    return () => clearTimeout(h);
  }, [visning && "sedan" in visning ? visning.sedan : null, visning && "lage" in visning ? visning.lage : null]);
  useEffect(() => {
    setNu(Date.now());
  }, [dok]);
  if (fel || (visning && "fel" in visning)) {
    const text = visning && "fel" in visning && visning.fel === "gammal" ? t.agentFastnat : t.agentstatusFel;
    return (
      <p data-agentstatus="fel" role="alert" className="m-0 mt-2 flex items-center gap-1.5 text-meta text-danger">
        <AgentIkon size={14} />
        <span>{text}</span>
      </p>
    );
  }
  if (!visning) return null;
  return (
    <p data-agentstatus={visning.lage} role="status" className="m-0 mt-2 flex items-center gap-2 text-meta text-ink-muted">
      <span className="inline-flex size-8 shrink-0 items-center justify-center text-accent">
        <AgentIkon size={16} />
      </span>
      <span>{visning.lage === "tanker" ? t.agentTanker : t.agentSkriver}</span>
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1 rounded-full bg-current motion-safe:animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
        ))}
      </span>
    </p>
  );
}

/**
 * Statusdokumentet, med en lyssnare där källan kan, annars en läsning.
 * @param {(ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> & import("../data/samtalskalla.js").Statusfunktioner) | null} kalla
 * @param {string} sid @param {string | undefined} tid
 * @returns {{ dok: any, fel: Error | null }}
 */
function useAgentstatusdok(kalla, sid, tid) {
  const [lage, setLage] = useState(/** @type {{ dok: any, fel: Error | null }} */ ({ dok: null, fel: null }));
  useEffect(() => {
    if (!kalla) return undefined;
    let levande = true;
    const val = tid === undefined ? {} : { tid };
    const stang = kalla.prenumereraStatus(sid, { onData: (dok) => levande && setLage({ dok, fel: null }), onError: (e) => levande && setLage({ dok: null, fel: e }) }, val);
    if (!stang) {
      kalla.lasStatus(sid, val).then(
        (dok) => levande && setLage({ dok, fel: null }),
        (e) => levande && setLage({ dok: null, fel: e instanceof Error ? e : new Error(String(e)) }),
      );
    }
    return () => {
      levande = false;
      stang?.();
    };
  }, [kalla, sid, tid]);
  return lage;
}

/**
 * Loggens meddelanden: det senaste urvalet (`live`) plus allt som redan setts, och "Visa äldre" (chattens nattskiva).
 *
 * ⛔ DET SOM SETTS STANNAR. Prenumerationen ger de senaste `sida` meddelandena, och när ett nytt kommer faller det äldsta ur urvalet.
 * Hade loggen ritat bara urvalet hade en sida som hämtats bakåt fått ett hål mot urvalet så snart någon skrev. Meddelanden ändras
 * och raderas aldrig (regeln), så att samla det som setts är aldrig fel.
 *
 * ⛔ RULLNINGEN STÅR KVAR NÄR EN SIDA LÄGGS IN ÖVERST. Den som läser bakåt ska se samma meddelande efter klicket, inte hamna högst
 * upp i en sida hen aldrig bad om.
 *
 * @param {{ kalla: ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>, sid: string, trad?: string, live: ReadonlyArray<import("../lib/samtal.js").Meddelande & { id: string }> | null, logg: { current: HTMLElement | null } }} p
 */
function useHistorik({ kalla, sid, trad, live, logg }) {
  const [sedda, setSedda] = useState(/** @type {Map<string, import("../lib/samtal.js").Meddelande & { id: string }>} */ (new Map()));
  const [lage, setLage] = useState(/** @type {{ laddar: boolean, fel: Error | null, bladdrat: boolean, fler: boolean | null }} */ ({ laddar: false, fel: null, bladdrat: false, fler: null }));
  const fore = useRef(/** @type {{ hojd: number, topp: number } | null} */ (null));
  useEffect(() => {
    if (!live) return;
    setSedda((m) => {
      const ny = new Map(m);
      for (const r of live) ny.set(r.id, r);
      return ny;
    });
  }, [live]);
  const alla = useMemo(() => [...sedda.values()].sort((a, b) => a.tid - b.tid || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), [sedda]);
  // Innan någon bläddrat: en full första sida betyder att det kan finnas mer. Efter: det senaste svaret avgör.
  const kanFinnasAldre = lage.bladdrat ? lage.fler === true : Boolean(live && live.length >= kalla.sida);
  useLayoutEffect(() => {
    const f = fore.current;
    const el = logg.current;
    if (!f || !el) return;
    fore.current = null;
    el.scrollTop = el.scrollHeight - f.hojd + f.topp;
  }, [alla, logg]);
  const hamta = async () => {
    if (lage.laddar || alla.length === 0) return;
    setLage((l) => ({ ...l, laddar: true, fel: null }));
    try {
      const svar = await kalla.aldreMeddelanden(sid, { tid: alla[0].tid, kanda: alla.map((m) => m.id), ...(trad === undefined ? {} : { trad }) });
      const el = logg.current;
      if (el) fore.current = { hojd: el.scrollHeight, topp: el.scrollTop };
      setSedda((m) => {
        const ny = new Map(m);
        for (const r of svar.rader) ny.set(r.id, r);
        return ny;
      });
      setLage({ laddar: false, fel: null, bladdrat: true, fler: svar.fler });
    } catch (e) {
      setLage((l) => ({ ...l, laddar: false, fel: e instanceof Error ? e : new Error(String(e)) }));
    }
  };
  return { alla, kanFinnasAldre, laddar: lage.laddar, fel: lage.fel, slut: lage.bladdrat && lage.fler === false, hamta };
}

/**
 * "Visa äldre" överst i loggen, och vad som hände (chattens nattskiva). ⛔ Varje utfall står utskrivet: hämtar, fel (med knappen kvar
 * för ett nytt försök) och "Inga äldre meddelanden" när början är nådd. En knapp som försvann utan ett ord hade inte sagt om
 * historiken tog slut eller om hämtningen föll (regel 5).
 *
 * @param {{ historik: ReturnType<typeof useHistorik>, texter: Required<Meddelandetexter> }} props
 */
function VisaAldre({ historik, texter: t }) {
  if (historik.slut) {
    return (
      <p data-aldre-slut="" className="m-0 py-2 text-center text-liten text-ink-muted">
        {t.ingaAldre}
      </p>
    );
  }
  if (!historik.kanFinnasAldre) return null;
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {historik.fel ? (
        <p data-aldre-fel="" role="alert" className="m-0 text-liten text-danger">
          {t.aldreFel}
        </p>
      ) : null}
      <button
        type="button"
        data-visa-aldre=""
        aria-busy={historik.laddar || undefined}
        disabled={historik.laddar}
        onClick={historik.hamta}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-meta font-medium text-accent transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {historik.laddar ? t.hamtarAldre : t.visaAldre}
      </button>
    </div>
  );
}

/** Reaktionernas tecken och namn. ⛔ Bara här: datan bär koden (`REAKTIONSKODER`), vyn tecknet. */
const REAKTIONSVY = /** @type {Record<(typeof REAKTIONSKODER)[number], [string, string]>} */ ({
  tumme: ["👍", "Tummen upp"],
  hjarta: ["❤️", "Hjärta"],
  skratt: ["😂", "Skratt"],
  eld: ["🔥", "Eld"],
  klapp: ["👏", "Applåd"],
  bock: ["✅", "Klart"],
});

/**
 * Reaktionerna i ett samtal eller en tråd: en lyssnare (eller en läsning), räknade per meddelande, och växlingen av den egna.
 *
 * ⛔ FEL SÄGS (regel 5): en läsning som föll och en växling som nekades blir var sin rad, aldrig en tyst knapp som inte gör något.
 *
 * @param {(ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> & import("../data/samtalskalla.js").Reaktionsfunktioner) | null} kalla
 * @param {string} sid @param {string | undefined} trad @param {string} uid
 */
function useReaktioner(kalla, sid, trad, uid) {
  const [lage, setLage] = useState(/** @type {{ rader: any[], fler: boolean, fel: Error | null, skrivfel: Error | null }} */ ({ rader: [], fler: false, fel: null, skrivfel: null }));
  const lyssnar = useRef(false);
  const val = trad === undefined ? {} : { trad };
  const lasIn = async () => {
    if (!kalla) return;
    try {
      const svar = await kalla.lasReaktioner(sid, val);
      setLage((l) => ({ ...l, rader: svar.rader, fler: svar.fler, fel: null }));
    } catch (e) {
      setLage((l) => ({ ...l, fel: e instanceof Error ? e : new Error(String(e)) }));
    }
  };
  useEffect(() => {
    if (!kalla) return undefined;
    let levande = true;
    const stang = kalla.prenumereraReaktioner(
      sid,
      { onData: (svar) => levande && setLage((l) => ({ ...l, rader: svar.rader, fler: svar.fler, fel: null })), onError: (e) => levande && setLage((l) => ({ ...l, fel: e })) },
      val,
    );
    lyssnar.current = Boolean(stang);
    if (!stang) lasIn();
    return () => {
      levande = false;
      stang?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, sid, trad]);
  const sammanfattning = useMemo(() => summeraReaktioner(lage.rader, uid), [lage.rader, uid]);
  /** @param {string} mid @param {(typeof REAKTIONSKODER)[number]} kod */
  const vaxla = async (mid, kod) => {
    if (!kalla) return;
    const har = lage.rader.some((r) => r.mid === mid && r.kod === kod && r.av === uid);
    try {
      if (har) await kalla.taBortReaktion(sid, { mid, kod, av: uid }, val);
      else await kalla.reagera(sid, { mid, kod, av: uid }, val);
      setLage((l) => ({ ...l, skrivfel: null }));
      if (!lyssnar.current) await lasIn();
    } catch (e) {
      setLage((l) => ({ ...l, skrivfel: e instanceof Error ? e : new Error(String(e)) }));
    }
  };
  return { pa: Boolean(kalla), sammanfattning, vaxla, fler: lage.fler, fel: lage.fel, skrivfel: lage.skrivfel };
}

/**
 * Raderna om reaktionerna som gäller hela loggen: läsningen föll, en växling nekades, eller taket nåddes.
 * @param {{ reakt: ReturnType<typeof useReaktioner>, texter: Required<Meddelandetexter> }} props
 */
function Reaktionslage({ reakt, texter: t }) {
  if (!reakt.pa) return null;
  return (
    <>
      {reakt.fel ? (
        <p data-reaktionsfel="lasa" role="alert" className="m-0 py-1 text-center text-liten text-danger">
          {t.reaktionerFel}
        </p>
      ) : null}
      {reakt.skrivfel ? (
        <p data-reaktionsfel="skriva" role="alert" className="m-0 py-1 text-center text-liten text-danger">
          {t.reaktionFel}
        </p>
      ) : null}
      {reakt.fler ? (
        <p data-reaktioner-fler="" role="status" className="m-0 py-1 text-center text-liten text-ink-muted">
          {t.reaktionerFler}
        </p>
      ) : null}
    </>
  );
}

/** @param {(typeof REAKTIONSKODER)[number]} kod @param {Required<Meddelandetexter>} t */
const reaktionsnamn = (kod, t) => t.reaktionsnamn?.[kod] ?? REAKTIONSVY[kod][1];

/**
 * Reaktionerna under en bubbla: en knapp per kod med antalet. ⛔ En tryckning växlar den EGNA reaktionen, och knappen säger om den
 * är din (`aria-pressed`). Träffytan är 44 px utan att raden växer (negativa marginaler, samma grepp som trådens märke).
 *
 * @param {{ m: { id: string }, egen: boolean, reakt: ReturnType<typeof useReaktioner>, texter: Required<Meddelandetexter> }} props
 */
function Reaktionschips({ m, egen, reakt, texter: t }) {
  const lista = reakt.sammanfattning.get(m.id);
  if (!lista || lista.length === 0) return null;
  return (
    <div data-reaktioner={m.id} className={cx("mt-1 flex max-w-full flex-wrap gap-1", egen ? "justify-end" : "justify-start")}>
      {lista.map((r) => (
        <button
          key={r.kod}
          type="button"
          data-reaktion={r.kod}
          aria-pressed={r.egen}
          aria-label={`${reaktionsnamn(r.kod, t)}, ${r.antal}${r.egen ? `, ${t.duHarReagerat}` : ""}`}
          onClick={() => reakt.vaxla(m.id, r.kod)}
          className="group/chip -my-1.5 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center focus-visible:outline-none"
        >
          <span
            aria-hidden="true"
            className={cx(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-meta tabular-nums transition-colors duration-(--duration-fast) ease-standard group-focus-visible/chip:outline-2 group-focus-visible/chip:outline-offset-1 group-focus-visible/chip:outline-accent",
              r.egen ? "border-accent bg-accent-faint text-ink" : "border-line bg-surface text-ink-secondary group-hover/chip:bg-hover",
            )}
          >
            <span>{REAKTIONSVY[r.kod][0]}</span>
            <span>{r.antal}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * "Reagera" och väljaren med de sex reaktionerna.
 *
 * ⛔ TANGENTBORDET FÅR SAMMA VÄG SOM PEKAREN (SS #1701: en verktygsrad som bara syns vid hovring finns inte för tangentbordet).
 * Knappen syns på dator vid hover och fokus, på telefon alltid. Väljaren tar fokus när den öppnas, pilarna flyttar mellan
 * reaktionerna, Escape stänger och lämnar fokus på Reagera, och fokus som lämnar väljaren stänger den.
 *
 * @param {{ m: { id: string }, egen: boolean, reakt: ReturnType<typeof useReaktioner>, texter: Required<Meddelandetexter> }} props
 */
function ReageraKnapp({ m, egen, reakt, texter: t }) {
  const [oppen, setOppen] = useState(false);
  const knapp = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const panel = useRef(/** @type {HTMLDivElement | null} */ (null));
  const panelId = useId();
  useEffect(() => {
    if (oppen) /** @type {HTMLElement | null} */ (panel.current?.querySelector("button") ?? null)?.focus();
  }, [oppen]);
  const stang = () => {
    setOppen(false);
    knapp.current?.focus();
  };
  return (
    <>
      <button
        ref={knapp}
        type="button"
        data-reagera={m.id}
        aria-label={t.reagera}
        aria-expanded={oppen}
        aria-controls={oppen ? panelId : undefined}
        onClick={() => setOppen((o) => !o)}
        className={cx(
          "-my-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-[color,background-color,opacity] duration-(--duration-fast) ease-standard hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
          oppen ? "text-ink" : "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100",
        )}
      >
        <LeendeIkon size={16} />
      </button>
      {oppen ? (
        <div
          ref={panel}
          id={panelId}
          role="group"
          aria-label={t.valjReaktion}
          data-reaktionsvaljare={m.id}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              stang();
              return;
            }
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const knappar = /** @type {HTMLElement[]} */ ([...(panel.current?.querySelectorAll("button") ?? [])]);
              const i = knappar.indexOf(/** @type {HTMLElement} */ (document.activeElement));
              const n = knappar.length;
              knappar[(i + (e.key === "ArrowRight" ? 1 : n - 1)) % n]?.focus();
            }
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(/** @type {Node | null} */ (e.relatedTarget)) && e.relatedTarget !== knapp.current) setOppen(false);
          }}
          className={cx(
            "absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-full border border-line bg-surface p-0.5 shadow-md",
            egen ? "right-0" : "left-0",
          )}
        >
          {REAKTIONSKODER.map((kod) => (
            <button
              key={kod}
              type="button"
              data-valj-reaktion={kod}
              aria-label={reaktionsnamn(kod, t)}
              onClick={() => {
                reakt.vaxla(m.id, kod);
                stang();
              }}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-brod transition-colors duration-(--duration-fast) ease-standard hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true">{REAKTIONSVY[kod][0]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * Citatet ovanför ett svar (chattens nattskiva): namnet och ett utdrag, HÄRLETT ur det citerade meddelandet. ⛔ Ingen kopia av
 * texten i svaret (SS kopierade den, och fick städa citaten när ett konto raderades). Går meddelandet inte att läsa sägs det.
 *
 * @param {{ mid: string, uppslag: Map<string, (import("../lib/samtal.js").Meddelande & { id: string }) | null>, egen: boolean, uid: string, namnFor: (uid: string) => string, texter: Required<Meddelandetexter> }} props
 */
function Citat({ mid, uppslag, egen, uid, namnFor, texter: t }) {
  const m = uppslag.get(mid);
  return (
    <div data-citat={mid} className={cx("mb-0.5 max-w-full rounded-lg border-l-2 border-line-strong bg-canvas px-2.5 py-1 text-meta text-ink-secondary", egen ? "self-end" : "self-start")}>
      {m === undefined ? (
        <span aria-busy="true">…</span>
      ) : m === null ? (
        <span data-citat-saknas="">{t.citatSaknas}</span>
      ) : (
        <>
          <span className="font-medium text-ink">{m.av === uid ? t.du : namnFor(m.av)}</span>
          <span>: {utdrag(m.text, 80)}</span>
        </>
      )}
    </div>
  );
}

/**
 * De citerade meddelandena: de som redan är laddade, och de andra lästa en gång var (`kalla.meddelande`). `null`: finns inte.
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla> | null} kalla
 * @param {string} sid @param {ReadonlyArray<import("../lib/samtal.js").Meddelande & { id: string }>} alla
 */
function useCitatuppslag(kalla, sid, alla) {
  const [lasta, setLasta] = useState(/** @type {Map<string, (import("../lib/samtal.js").Meddelande & { id: string }) | null>} */ (new Map()));
  const begarda = useRef(/** @type {Set<string>} */ (new Set()));
  const laddade = useMemo(() => new Map(alla.map((m) => [m.id, m])), [alla]);
  useEffect(() => {
    if (!kalla) return;
    const saknas = [...new Set(alla.map((m) => m.svarPa).filter((x) => typeof x === "string" && !laddade.has(x) && !begarda.current.has(x)))];
    for (const mid of /** @type {string[]} */ (saknas)) {
      begarda.current.add(mid);
      kalla.meddelande(sid, mid).then(
        (m) => setLasta((f) => new Map(f).set(mid, m ? { ...m, id: mid } : null)),
        () => setLasta((f) => new Map(f).set(mid, null)),
      );
    }
  }, [kalla, sid, alla, laddade]);
  return useMemo(() => new Map([...lasta, ...laddade]), [lasta, laddade]);
}

/**
 * Sökningen i det öppna samtalet (chattens nattskiva): träffarna bland de laddade meddelandena, och den aktuella rullad fram.
 * @param {ReadonlyArray<import("../lib/samtal.js").Meddelande & { id: string }>} alla @param {{ current: HTMLElement | null }} logg
 */
function useSokISamtal(alla, logg) {
  const [oppen, setOppen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const lista = useMemo(() => {
    const n = q.trim().toLocaleLowerCase("sv");
    return n ? alla.filter((m) => m.text.toLocaleLowerCase("sv").includes(n)).map((m) => m.id) : [];
  }, [alla, q]);
  // Den senaste träffen först, som SS: det man letar efter har oftast nyss sagts.
  const aktuell = lista.length ? lista[Math.max(0, lista.length - 1 - (index % lista.length))] : null;
  useEffect(() => {
    if (!aktuell) return;
    const el = logg.current?.querySelector(`[data-traff="aktuell"]`);
    /** @type {any} */ (el)?.scrollIntoView?.({ block: "center" });
  }, [aktuell, logg]);
  return {
    oppen,
    q,
    setQ: (/** @type {string} */ v) => {
      setQ(v);
      setIndex(0);
    },
    traffar: new Set(lista),
    antal: lista.length,
    plats: lista.length ? (index % lista.length) + 1 : 0,
    aktuell,
    // "Föregående" är äldre (uppåt i loggen), "nästa" nyare (nedåt). Båda varvar runt.
    forra: () => setIndex((i) => (i + 1) % Math.max(1, lista.length)),
    nasta: () => setIndex((i) => (i + Math.max(1, lista.length) - 1) % Math.max(1, lista.length)),
    oppna: () => setOppen(true),
    stang: () => {
      setOppen(false);
      setQ("");
      setIndex(0);
    },
  };
}

/**
 * Sökraden under samtalets huvud. ⛔ Den säger hur långt den når: bara de laddade meddelandena, och "Visa äldre" för att nå längre.
 * Noll träffar sägs ut, med samma förbehåll (regel 5).
 * @param {{ sok: ReturnType<typeof useSokISamtal>, antal: number, kanFinnasAldre: boolean, texter: Required<Meddelandetexter> }} props
 */
function Sokrad({ sok, antal, kanFinnasAldre, texter: t }) {
  const falt = useRef(/** @type {HTMLInputElement | null} */ (null));
  useEffect(() => {
    falt.current?.focus();
  }, []);
  return (
    <div data-sokrad="" className="flex shrink-0 flex-col gap-1 border-b border-line px-3 py-2">
      <div className="flex items-center gap-1">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-base border border-line bg-surface px-2.5 text-ink-muted focus-within:outline-2 focus-within:outline-accent">
          <SokIkon size={14} />
          <input
            ref={falt}
            type="search"
            value={sok.q}
            onChange={(e) => sok.setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Enter letar bakåt i samtalet, Skift plus Enter framåt.
                if (e.shiftKey) sok.nasta();
                else sok.forra();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                sok.stang();
              }
            }}
            aria-label={t.sokISamtalet}
            placeholder={t.sokISamtalet}
            className="min-w-0 flex-1 bg-transparent text-hjalp text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
        <span data-sok-plats="" role="status" className="min-w-12 text-center text-liten tabular-nums text-ink-muted">
          {sok.q.trim() ? `${sok.plats} av ${sok.antal}` : ""}
        </span>
        <button type="button" aria-label={t.forraTraff} disabled={sok.antal < 2} onClick={sok.forra} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent">
          <span className="inline-flex -rotate-90"><ChevronHogerIkon size={16} /></span>
        </button>
        <button type="button" aria-label={t.nastaTraff} disabled={sok.antal < 2} onClick={sok.nasta} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronNedIkon size={16} />
        </button>
        <button type="button" aria-label={t.stangSok} onClick={sok.stang} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-base text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
          <KryssIkon size={14} />
        </button>
      </div>
      {sok.q.trim() && sok.antal === 0 ? (
        <p data-sok-ingen="" className="m-0 text-liten text-ink-muted">
          {t.ingenTraffLaddade}
        </p>
      ) : null}
      {kanFinnasAldre ? (
        <p data-sok-omfang="" className="m-0 text-liten text-ink-muted">
          {t.sokOmfang.replace("{n}", String(antal))}
        </p>
      ) : null}
    </div>
  );
}
