import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GASTGRUPPFUNKTIONER, GASTSKRIV_MAX_TECKEN } from "../lib/gast.js";
import { gastBehorighetsrader } from "../lib/gastBehorighet.js";
import { lasGastFlik, skrivGastFlik } from "../lib/gastminne.js";
import { kommentarRotId } from "../lib/postkommentar.js";
import { kortDatum } from "../lib/deladdatum.js";
import { DATUM_EJ_SATT } from "../lib/handelsemodell.js";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsBibliotek } from "./OpsBibliotek.jsx";
import { FULL_HEIGHT_CLASSES, gastTangentbordExtra, useFullHeight } from "../lib/fullHeight.js";
import { tangentbordTackt } from "../lib/tangentbord.js";
import { cx } from "../lib/cx.js";
import { IKON_FOR } from "./ikonlexikon.js";
import { KalenderIkon, MeddelandeIkon } from "./icons.jsx";
import { GastHemskarm } from "./GastHemskarm.jsx";
import { OpsBottomNav } from "./OpsBottomNav.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsGastArenden } from "./OpsGastArenden.jsx";
import { OpsGastChatt } from "./OpsGastChatt.jsx";
import { OpsGastFelrad } from "./OpsGastFelrad.jsx";
import { OpsHandelsePanel } from "./OpsHandelsePanel.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { useGastsidaInfo } from "./gastsidaInfo.js";
import { OpsSprakProvider } from "./OpsSprak.jsx";
import { OpsSpelareProvider } from "./OpsSpelare.jsx";
import { OpsSvarSummor } from "./OpsSvar.jsx";
import { OpsTabPanel, OpsTabs } from "./OpsTabs.jsx";

/** Telefonen: samma brytpunkt som skalets bottenrad (`md`, 48 rem). Under den är flikarna en bottenrad och innehållet fyller höjden. */
const SMAL_SKARM = "(max-width: 47.99rem)";

/** Är skärmen smalare än `md`? `false` där webbläsaren inte kan svara (jsdom utan `matchMedia`), alltså datorns flikrad. @returns {boolean} */
function useSmalSkarm() {
  const las = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(SMAL_SKARM).matches;
  const [smal, setSmal] = useState(las);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const fraga = window.matchMedia(SMAL_SKARM);
    const lyssna = () => setSmal(fraga.matches);
    lyssna();
    if (typeof fraga.addEventListener === "function") {
      fraga.addEventListener("change", lyssna);
      return () => fraga.removeEventListener("change", lyssna);
    }
    fraga.addListener?.(lyssna);
    return () => fraga.removeListener?.(lyssna);
  }, []);
  return smal;
}

/** Ikonerna i gästens bottenrad, en per funktion. */
const FLIKIKON = /** @type {Record<string, import("react").ReactNode>} */ ({
  oversikt: <IKON_FOR.oversikt size={24} aria-hidden="true" />,
  chatt: <MeddelandeIkon size={24} />,
  kalender: <KalenderIkon size={24} />,
  bibliotek: <IKON_FOR.bibliotek size={24} aria-hidden="true" />,
  arenden: <IKON_FOR.arende size={24} aria-hidden="true" />,
});

/**
 * Ytan mellan huvudet och bottenraden på en telefon (0.190.0, CP 2026-11-05 i cllp/lifehub.app#658, del B: "Innehållet får hela höjden"). Höjden är skalets
 * (`useFullHeight`, `FULL_HEIGHT_CLASSES`): den mäts ut till bottenradens överkant, eller spelradens när ljud spelar, och ytan rullar i sig själv. Chatten fyller den
 * (`fyll`), så att skrivfältet står närmast bottenraden.
 *
 * ⛔ EN NY YTA PER FLIK, OCH NYCKELN SITTER DÄR YTAN RITAS (`<GastTelefonyta key={flik}>`), INTE PÅ ELEMENTET INUTI. Granskningen av PR 524, appens montage mot en
 * byggd app: med ljud som spelade i biblioteket blev dokumentet 965 px högt i ett fönster på 844, och ytan slutade på 842 i stället för vid spelradens överkant.
 * Nyckeln satt på `div`:en här inne. Då byttes elementet när fliken byttes, men komponenten och dess `useFullHeight` levde kvar med samma `ref`-objekt, så effekten
 * kördes inte om och mätte och bevakade det gamla, urkopplade elementet. Dess ruta är noll, så nästa mätning (spelraden som dök upp) gav toppen 0 och höjden
 * `botten - 0`. Med nyckeln på komponenten byts allt ihop: ny `ref`, ny effekt, nya observatörer på det element som faktiskt syns.
 * @param {{ flik: string, children: import("react").ReactNode }} props
 */
/**
 * Drar ihop ytan med det tangentbordet täcker, i samma tal som medlemmens chatt (`tangentbordTackt`). 0 när inget tangentbord finns
 * och när underkanten redan är den synliga (spelraden). Provet sätter `botten`; utan den läses layoutfönstret.
 * @param {number} botten
 */
function useGastTangentbord(botten) {
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mat = () => {
      const layout = document.documentElement?.clientHeight || window.innerHeight || 0;
      setExtra(gastTangentbordExtra({ botten, layout, tackt: tangentbordTackt() }));
    };
    mat();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", mat);
    vv?.addEventListener("scroll", mat);
    window.addEventListener("resize", mat);
    return () => {
      vv?.removeEventListener("resize", mat);
      vv?.removeEventListener("scroll", mat);
      window.removeEventListener("resize", mat);
    };
  }, [botten]);
  return extra;
}

/** @param {{ flik: string, children: import("react").ReactNode }} props */
function GastTelefonyta({ flik, children }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  const stil = useFullHeight(ref);
  const botten = Number.parseFloat(String(/** @type {Record<string, string>} */ (stil)["--fullhojd-botten"] ?? ""));
  const extra = useGastTangentbord(Number.isFinite(botten) ? botten : 0);
  // Inline höjd slår klassens när tangentbordet täcker underkanten, och min-höjden släpps så ytan får bli kortare än 15 rem.
  const style = extra > 0 ? { ...stil, height: `calc(var(--fullhojd-botten) - var(--fullhojd-topp) - ${extra}px)`, minHeight: 0 } : stil;
  return (
    <div ref={ref} style={style} data-gast-telefonyta={flik} data-gast-tangentbord={extra > 0 ? String(extra) : undefined} className={cx("flex min-w-0 flex-col", FULL_HEIGHT_CLASSES)}>
      {children}
    </div>
  );
}

/**
 * Orden i gruppens gästvy, på svenska och engelska (0.132.0, cllp/lifehub.app#389, skiva 2). Flikarnas namn härleds ur `GASTGRUPPFUNKTIONER`: ett nytt ord där är en ny flik här.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTGRUPP = {
  flikarEtikett: { sv: "Gruppens delar", en: "Parts of the group" },
  // Översikt, inte Hem: Hem är den privata hemgruppen. Fliken är en vy, inte en behörighet, och står därför inte i GASTGRUPPFUNKTIONER.
  flik_oversikt: { sv: "Översikt", en: "Overview" },
  flik_chatt: { sv: "Chatt", en: "Chat" },
  flik_kalender: { sv: "Kalender", en: "Calendar" },
  flik_bibliotek: { sv: "Bibliotek", en: "Library" },
  flik_arenden: { sv: "Ärenden", en: "Cases" },
  // ⛔ EN RAD UNDER GRUPPENS NAMN (0.190.0, CP 2026-11-05 i cllp/lifehub.app#658, del A). Allt annat om rollen står på översikten (0.192.0, `gastBehorighetsrader`).
  duArGast: { sv: "Du är gäst.", en: "You are a guest." },
  kalenderEtikett: { sv: "Kalender", en: "Calendar" },
  ingetPaGang: { sv: "Inget på gång i gruppen.", en: "Nothing coming up in the group." },
  paGangEtikett: { sv: "På gång", en: "Coming up" },
  kalenderAvkortad: { sv: "Kalendern visar de första {n} händelserna. Det finns fler.", en: "The calendar shows the first {n} events. There are more." },
  kalenderEjVisade: { sv: "{n} händelser visas inte, eftersom deras tid inte går att läsa.", en: "{n} events are not shown, because their time cannot be read." },
  laddar: { sv: "Hämtar", en: "Loading" },
  tillbaka: { sv: "Tillbaka", en: "Back" },
  handelseSaknas: { sv: "Händelsen finns inte längre.", en: "The event no longer exists." },
  svarFel: { sv: "Svaret kunde inte sparas just nu. Försök igen.", en: "The answer could not be saved right now. Try again." },
  svarSaknas: { sv: "Svaren kunde inte hämtas.", en: "The answers could not be loaded." },
  rubrikSvar: { sv: "Svar", en: "Answer" },
  omrostningEjStodd: { sv: "Det finns en omröstning här som inte går att visa i den här versionen av appen.", en: "There is a vote here that cannot be shown in this version of the app." },
  fel_kundeInte: { sv: "Det gick inte just nu. Försök igen.", en: "That did not work right now. Try again." },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
  "fel_ogiltig-text": { sv: "Meddelandet är tomt eller för långt.", en: "The message is empty or too long." },
  "fel_for-manga": { sv: "För många anrop. Vänta en stund och försök igen.", en: "Too many requests. Wait a while and try again." },
  // (0.190.0) Gruppen har stängt av nedladdning för gäster: ett dokument som bara kan laddas ned går inte att öppna.
  "fel_nedladdning-av": { sv: "Gruppen har stängt av nedladdning. Filen går inte att öppna här.", en: "The group has turned off downloads. The file cannot be opened here." },
  fel_saknas: { sv: "Det du bad om finns inte längre.", en: "What you asked for no longer exists." },
  fel_nej: { sv: "Det gick inte.", en: "That did not work." },
  fel_arende: { sv: "Ärendet ligger inte längre hos dig, eller är redan klart.", en: "The case is no longer with you, or is already done." },
  bibliotekTom: { sv: "Gruppens bibliotek är tomt.", en: "The group's library is empty." },
  bibliotekAvkortad: { sv: "Biblioteket visar de första {n} posterna. Det finns fler.", en: "The library shows the first {n} items. There are more." },
  bibliotekFilFel: { sv: "Filen kunde inte hämtas.", en: "The file could not be fetched." },
};

/** Ett fel från ett anrop, med orsaken som nyckel till en text. */
class GastFel extends Error {
  /** @param {string} orsak */
  constructor(orsak) {
    super(orsak);
    this.orsak = orsak;
  }
}

/** Orsaken i ett fel från `kor`. Allt annat (ett avvisat löfte, nätet) är `kundeInte`. Orsaken sparas, texten görs vid ritningen (#675). */
const orsakAv = (/** @type {unknown} */ e) => (e instanceof GastFel ? e.orsak : "kundeInte");

/** Så gammal får en flik vara innan den hämtas om när man kommer tillbaka till den eller fönstret får fokus, i millisekunder. Listorna hämtas på begäran och aldrig på en tidtagare: en kalender är hundratals läsningar. */
const FRISKT_MS = 60_000;

/** @param {ReadonlyArray<{ id: string, tid: number }>} a @param {ReadonlyArray<{ id: string, tid: number }>} b */
function sammanfoga(a, b) {
  const per = new Map();
  for (const m of [...a, ...b]) per.set(m.id, m);
  return [...per.values()].sort((x, y) => x.tid - y.tid || String(x.id).localeCompare(String(y.id)));
}

/** @param {{ tid?: string | null, slutTid?: string | null }} h @param {string} till */
const tidText = (h, till) => (h.tid ? (h.slutTid ? `${h.tid} ${till} ${h.slutTid}` : h.tid) : undefined);

/**
 * Hela gruppen för en gäst: det bantade gränssnittet (0.132.0, cllp/lifehub.app#389, skiva 2). Tre flikar och ingenting annat: chatt, kalender och bibliotek, och en fjärde, Ärenden, bara när gästen har minst ett ärende delegerat till sig (skiva 3, CP 2026-10-20). Gästen ser aldrig gruppens ärendelista (den kan bära sådant som inte rör gästen), bara de ärenden servern valt ut på gästens `gastId`.
 *
 * ══ ⛔ ÄRENDEFLIKEN HÄMTAS VID START OCH VISAS BARA MED INNEHÅLL ═════════════════════════════════════════════════════════════
 *
 * Svaret på `arenden` avgör om fliken finns, så den hämtas direkt (en läsning av gruppens ärenden, på servern) och inte först när fliken öppnas. Ett tomt svar ger ingen flik; ett fel ger fliken med felet, så att ett trasigt
 * anrop aldrig ser ut som att gästen saknar ärenden. Försvinner det sista ärendet (återkallat ansvar, eller ärendet flyttat) hoppar vyn till första fliken.
 *
 * ══ ⛔ BANTAT BETYDER ATT DET INTE FINNS, INTE ATT DET ÄR GÖMT ═══════════════════════════════════════════════════════════
 *
 * Inget skal (`OpsAppShell`), inga andra grupper, ingen hubb, inga Appar, ingen Inställningar, ingen Ekonomi, ingen agent och ingen länk ut ur sidan. Vyn har bara de tre flikarna och de komponenter de
 * ritar, och varken en rutt eller ett anrop till något annat: det den ser är det `api` ger (`gastGruppApi`), och `api` går bara mot gästens egen tjänst. En gäst hade ingen väg dit även om knappen fanns.
 *
 * ══ ⛔ VYERNA ÄR MEDLEMMENS, MED `jag: null` ══════════════════════════════════════════════════════════════════════════════
 *
 * Kalendern är en lista över det som är på gång (0.190.0, ingen månadsvy för gäster) och händelsen `OpsHandelsePanel` utan penna eller flytt, svaren `OpsSvarSummor` (summor och mitt eget svar, inga namn), biblioteket `OpsBibliotek` med `jag: null` (ingen Ny, ingen
 * redigering, ingen radering, ingen delning) och `adresserPaBegaran` (en signering per öppnad fil, aldrig en per post i listan). Chatten är medlemmens bubblor med chattens skrivfält utan bilagor, mikrofon och agent (`OpsGastChatt`): gästen får skriva (CP 2026-10-20), och
 * servern märker meddelandet Gäst.
 *
 * ══ ⛔ LISTORNA HÄMTAS PÅ BEGÄRAN, INTE PÅ EN TIDTAGARE ═══════════════════════════════════════════════════════════════════
 *
 * Mätt i designen: en kalender på 300 händelser är cirka 300 läsningar, och hämtad var minut i åtta timmar blir den 330 000 läsningar per gäst och dag. Därför hämtas en flik när man öppnar den första gången, när man
 * kommer tillbaka till den efter mer än en minut, och när fönstret får fokus. Bara chattens ping (`nyast`, en läsning) går på tidtagare (`intervallMs`, förval 30 s) och bara medan chattfliken syns.
 *
 * ⛔ NEKAS ETT ANROP (`aterkallad`, `nej`) ANROPAS `onNekad`, och sidan byter allt mot texten "Inbjudan är återkallad". Vyn visar aldrig kvar det som lästs när åtkomsten är borta.
 *
 * @param {object} props
 * @param {{ namn: string, funktioner: readonly string[], beskrivning?: string, nedladdning?: boolean, kommentera?: boolean }} props.grupp Tjänstens `hamta().grupp`. `beskrivning` är gruppens befintliga beskrivning, tom när den saknas. (0.190.0) `nedladdning: false`: gruppen har stängt av nedladdning
 *   (`grupp.farLaddaNed`), och varken biblioteket eller spelarens ark ritar Ladda ned. Utelämnad: som förut.
 * @param {ReturnType<typeof import("../lib/gast.js").gastGruppApi>} props.api Anropen mot servern, bundna till sessionen (`gastGruppApi(anrop, sessionsnyckel)`).
 * @param {(orsak: string) => void} [props.onNekad] Ett anrop nekades. Normalt `uppdatera` ur `renderGrupp`, som hämtar om sidan.
 * @param {(arg: { handelse: Record<string, any>, omrostning: Record<string, any>, rosta: (arg: { forslagId: string, val: string }) => Promise<void>, uppdatera: () => Promise<void> }) => import("react").ReactNode} [props.renderOmrostning]
 *   Appens omröstning på ett datum (förslagen och rösterna). `rosta` anropar tjänstens `rosta` och hämtar om händelsen. Utan den visas en text om att omröstningen inte går att visa, när en händelse har en.
 * @param {number} [props.intervallMs] Chattens ping. Förval 30 000. `0` stänger av den.
 * @param {Date} [props.idag] Bara för prov: kalenderns idag.
 * @param {string} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_OPSGASTGRUPP, string>>} [props.ord]
 */
export function OpsGastGrupp({ grupp, api, onNekad, renderOmrostning, intervallMs = 30_000, idag, sprak = "sv", ord }) {
  if (!grupp || typeof grupp.namn !== "string" || !Array.isArray(grupp.funktioner)) throw new Error("OpsGastGrupp: grupp är { namn, funktioner } ur tjänstens hamta().grupp.");
  if (!api || typeof api.chatt !== "function") throw new Error("OpsGastGrupp: api krävs, anropen mot servern (gastGruppApi).");
  const t = { ...forvalda(ORD_OPSGASTGRUPP, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  // ⛔ ORDEN LÄSES GENOM EN REF I DE MINNESLAGDA ANROPEN (0.192.0, cllp/lifehub.app#675). `ladda`, `hamtaAdress` och `kommentarer` byggs om bara när `kor`
  // ändras, och läste därför den första renderingens `t`. Appen sätter språket efter starten (GastSida, `valdSprak`), och felen kom då på engelska.
  const tRef = useRef(t);
  tRef.current = t;
  const funktioner = GASTGRUPPFUNKTIONER.filter((f) => grupp.funktioner.includes(f));
  if (funktioner.length === 0) throw new Error("OpsGastGrupp: gruppen har inga funktioner att visa (grupp.funktioner).");

  // Översikt är landningen. En sparad flik (samma inbjudan, bara flikens namn) vinner, så en gäst som redan valt chatt inte kastas tillbaka.
  const sida = useGastsidaInfo();
  const sparadFlik = lasGastFlik(sida?.minne, sida?.inbjudan);
  const [flik, setFlik] = useState(/** @type {string} */ (sparadFlik === "oversikt" || (sparadFlik && funktioner.includes(sparadFlik)) ? sparadFlik : "oversikt"));
  const smal = useSmalSkarm();
  const [data, setData] = useState(/** @type {Record<string, any>} */ ({}));
  const [fel, setFel] = useState(/** @type {Record<string, string | null>} */ ({}));
  const [laddar, setLaddar] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [aldreLaddar, setAldreLaddar] = useState(false);
  const hamtad = useRef(/** @type {Record<string, number>} */ ({}));
  const levande = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;
  const apiRef = useRef(api);
  apiRef.current = api;
  const nekadRef = useRef(onNekad);
  nekadRef.current = onNekad;
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  /** Ett anrop mot servern. Ett svar som inte är `ok` kastar ett `GastFel` med orsaken; `aterkallad` och `nej` säger dessutom till sidan (`onNekad`) att åtkomsten är borta. */
  const kor = useCallback(async (/** @type {keyof typeof api} */ atgard, /** @type {Record<string, any>} */ args = {}, /** @type {{ utanNekad?: boolean }} */ val = {}) => {
    /** @type {any} */
    let r;
    try {
      r = await apiRef.current[atgard](args);
    } catch {
      throw new GastFel("kundeInte");
    }
    if (r && r.ok === true) return r;
    const orsak = r && typeof r.orsak === "string" ? r.orsak : "nej";
    // ⛔ `utanNekad`: för ett ärende är "nej" tvetydigt (sessionen är borta, eller ärendet ligger inte längre hos gästen: servern svarar medvetet likadant). Anroparen hämtar då om listan, och DEN avgör om åtkomsten är borta.
    if (!val.utanNekad && (orsak === "aterkallad" || orsak === "nej")) nekadRef.current?.(orsak);
    throw new GastFel(orsak);
  }, []);

  /** @param {unknown} e */
  const felText = (e) => felOrd(orsakAv(e));
  /** Texten för en orsak, på det språk som gäller vid den här ritningen. */
  const felOrd = (/** @type {string} */ orsak) => tRef.current[`fel_${orsak}`] ?? tRef.current.fel_nej;

  /** Hämtar en flik. `tyst`: ingen väntan visas och ett fel lämnar det som redan står (tidtagare, fokus). */
  const ladda = useCallback(
    async (/** @type {string} */ namn, /** @type {{ tyst?: boolean, aldre?: boolean, ping?: boolean }} */ val = {}) => {
      // ⛔ EN NY HÄMTNING TAR BORT DET GAMLA FELET (#675). Förut rensades det bara av en lyckad hämtning, och vyn visar felet före väntan:
      // ett flikbyte hämtade på nytt men felet stod kvar tills sidan laddades om.
      if (!val.tyst && !val.aldre) {
        setLaddar((l) => ({ ...l, [namn]: true }));
        setFel((f) => ({ ...f, [namn]: null }));
      }
      if (val.aldre) setAldreLaddar(true);
      try {
        /** @type {any} */
        let r;
        if (namn === "chatt") {
          const nu = /** @type {{ meddelanden: any[], fler: boolean } | undefined} */ (dataRef.current.chatt);
          if (val.ping && nu && nu.meddelanden.length > 0) {
            r = await kor("chatt", { nyast: nu.meddelanden[nu.meddelanden.length - 1].tid });
            if (r.ingetNytt) return;
          } else if (val.aldre && nu && nu.meddelanden.length > 0) {
            r = await kor("chatt", { fore: nu.meddelanden[0].tid });
          } else {
            r = await kor("chatt", {});
          }
          if (!levande.current) return;
          setData((d) => {
            const fore = /** @type {{ meddelanden: any[], fler: boolean } | undefined} */ (d.chatt);
            const meddelanden = sammanfoga(fore?.meddelanden ?? [], r.meddelanden);
            // `fler` gäller äldre än det äldsta vi har: bara en hämtning av äldre, eller den första, får ändra det.
            const fler = val.aldre || !fore || fore.meddelanden.length === 0 ? Boolean(r.fler) : fore.fler;
            return { ...d, chatt: { meddelanden, fler } };
          });
        } else {
          r = await kor(/** @type {any} */ (namn), {});
          if (!levande.current) return;
          setData((d) => ({ ...d, [namn]: r }));
        }
        hamtad.current[namn] = Date.now();
        setFel((f) => ({ ...f, [namn]: null }));
      } catch (e) {
        if (!levande.current) return;
        // ⛔ ORSAKEN SPARAS, INTE TEXTEN (#675). `ladda` minns den första renderingens `t` (beroenden `[kor]`), så en sparad text stod kvar på
        // engelska när appen satte svenska efter starten. Orsaken blir text vid ritningen (`felOrd`).
        if (!val.tyst) setFel((f) => ({ ...f, [namn]: orsakAv(e) }));
      } finally {
        if (levande.current) {
          setLaddar((l) => ({ ...l, [namn]: false }));
          if (val.aldre) setAldreLaddar(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kor],
  );

  // En flik hämtas första gången den visas, och om den är äldre än en minut när man kommer tillbaka till den. Översikt hämtar inget.
  useEffect(() => {
    if (flik === "oversikt") return undefined;
    const ålder = Date.now() - (hamtad.current[flik] ?? 0);
    if (dataRef.current[flik] === undefined) void ladda(flik);
    else if (ålder > FRISKT_MS) void ladda(flik, { tyst: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flik]);

  // Fönstret får fokus: hämta om den flik som syns, om den inte är alldeles färsk.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const fokus = () => {
      if (flik === "oversikt") return;
      if (Date.now() - (hamtad.current[flik] ?? 0) > 15_000) void ladda(flik, { tyst: true });
    };
    window.addEventListener("focus", fokus);
    return () => window.removeEventListener("focus", fokus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flik]);

  // Chattens ping, bara medan chattfliken syns och fönstret är synligt.
  useEffect(() => {
    if (flik !== "chatt" || intervallMs <= 0) return undefined;
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void ladda("chatt", { tyst: true, ping: true });
    }, intervallMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flik, intervallMs]);

  /**
   * Gästen skriver i chatten. Meddelandet läggs in i listan så som servern sparade det, och scrollen följer med. Ett fel kastas som ett Error med texten som ska stå under skrivfältet.
   * @param {string} text
   */
  const skrivChatt = async (text) => {
    /** @type {any} */
    let r;
    try {
      r = await kor("skrivChatt", { text });
    } catch (e) {
      throw new Error(felText(e));
    }
    if (!levande.current) return;
    setData((d) => {
      const fore = /** @type {{ meddelanden: any[], fler: boolean } | undefined} */ (d.chatt);
      return { ...d, chatt: { meddelanden: sammanfoga(fore?.meddelanden ?? [], [r.meddelande]), fler: fore?.fler ?? false } };
    });
  };

  // ── Ärenden delegerade till gästen (skiva 3) ──────────────────────────────────────────────────────────────────────────
  // Hämtas direkt vid start, inte först när fliken öppnas: fliken visas bara om det finns ett ärende, så svaret avgör om den finns.
  useEffect(() => {
    if (funktioner.includes("arenden")) void ladda("arenden");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ett nej på ett ärende är tvetydigt (se `kor`): hämta om listan. Är åtkomsten borta svarar den `nej` eller `aterkallad` och sidan byter till texten; annars har ärendet bara flyttat, och gästen får veta det.
   * @param {unknown} e
   * @returns {Promise<Error>}
   */
  const arendeNej = async (e) => {
    if (e instanceof GastFel && (e.orsak === "nej" || e.orsak === "aterkallad")) {
      await ladda("arenden");
      return new Error(t.fel_arende);
    }
    return new Error(felText(e));
  };

  /**
   * Gästen kommenterar ett ärende. Kommentaren läggs in så som servern sparade den. Ett fel kastas som ett Error med texten som ska stå under fältet.
   * @param {string} arendeId
   * @param {string} text
   */
  const kommenteraArende = async (arendeId, text) => {
    /** @type {any} */
    let r;
    try {
      r = await kor("kommenteraArende", { arendeId, text }, { utanNekad: true });
    } catch (e) {
      throw await arendeNej(e);
    }
    if (!levande.current) return;
    setData((d) => {
      const fore = /** @type {{ poster: any[] } | undefined} */ (d.arenden);
      if (!fore) return d;
      return { ...d, arenden: { ...fore, poster: fore.poster.map((p) => (p.id === arendeId ? { ...p, kommentarer: [...(p.kommentarer ?? []), r.kommentar] } : p)) } };
    });
  };

  /**
   * Gästen markerar ett ärende klart, och listan hämtas om så att statusen är servern.
   * @param {string} arendeId
   */
  const markeraArendeKlart = async (arendeId) => {
    try {
      await kor("markeraArendeKlart", { arendeId }, { utanNekad: true });
    } catch (e) {
      throw await arendeNej(e);
    }
    await ladda("arenden", { tyst: true });
  };

  // ── Kalendern och händelsen ───────────────────────────────────────────────────────────────────────────────────────────
  const [handelseId, setHandelseId] = useState(/** @type {string | null} */ (null));
  const [detalj, setDetalj] = useState(/** @type {Record<string, any> | null | "saknas"} */ (null));
  const [detaljFel, setDetaljFel] = useState(/** @type {string | null} */ (null));
  const [svarFel, setSvarFel] = useState(/** @type {string | null} */ (null));

  const hamtaHandelse = useCallback(
    async (/** @type {string} */ id) => {
      try {
        const r = await kor("handelse", { handelseId: id });
        if (levande.current) {
          setDetalj(r);
          setDetaljFel(null);
        }
      } catch (e) {
        if (!levande.current) return;
        if (e instanceof GastFel && e.orsak === "saknas") setDetalj("saknas");
        else setDetaljFel(felText(e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kor],
  );

  /** @param {string} id */
  const oppnaHandelse = (id) => {
    setHandelseId(id);
    setDetalj(null);
    setDetaljFel(null);
    setSvarFel(null);
    void hamtaHandelse(id);
  };

  const tillKalendern = () => {
    setHandelseId(null);
    setDetalj(null);
  };

  /** @param {"kommer" | "kommerInte"} val */
  const svara = async (val) => {
    if (!handelseId) return;
    setSvarFel(null);
    try {
      await kor("svara", { handelseId, val });
    } catch (e) {
      setSvarFel(felText(e));
      throw new Error(t.svarFel);
    }
    await hamtaHandelse(handelseId);
  };

  // ── Biblioteket ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const [valdPost, setValdPost] = useState(/** @type {any} */ (null));
  const bibliotek = /** @type {any} */ (data.bibliotek);
  const poster = useMemo(
    () => (bibliotek ? bibliotek.poster.map((/** @type {any} */ p) => ({ ...p, groupId: "gast", skapadAv: { uid: "", namn: p.skapadAvNamn ?? "" } })) : []),
    [bibliotek],
  );
  const hamtaAdress = useCallback(
    async (/** @type {string} */ sokvag) => {
      try {
        const r = await kor("fil", { postId: sokvag });
        return r.url;
      } catch (e) {
        throw new Error(e instanceof GastFel && e.orsak !== "kundeInte" ? felText(e) : tRef.current.bibliotekFilFel);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kor],
  );

  /*
   * ⛔ KOMMENTARER PÅ EN POST (0.191.0, cllp/lifehub.app#663): samma tråd som medlemmarnas, genom servern. Tråden läses med `chatt({ trad })` och skrivs med `kommenteraPost`, som skapar
   * roten i gruppchatten första gången och svarar i dess tråd sedan. Bara när servern säger att det går (`grupp.kommentera`). Rotens text bär postens länk, för medlemmarnas kort:
   * här står posten redan öppen, så raden med länken (den som bär kortet för just posten) visas inte.
   */
  const kommentarer = useMemo(() => {
    if (!grupp.kommentera) return null;
    /** @param {any} m @param {string} postId */
    const rad = (m, postId) => {
      const egenLank = new Set((m.kort ?? []).filter((/** @type {any} */ k) => k.postId === postId).map((/** @type {any} */ k) => k.url));
      const text = String(m.text ?? "").split(/\r?\n/).filter((r) => !egenLank.has(r.trim())).join("\n").trim();
      return { id: m.id, namn: m.av?.namn ?? "", text, tid: m.tid, ...(m.egen ? { egen: true } : {}), ...(m.gast ? { gast: true } : {}) };
    };
    /** @type {import("../data/postkommentarer.js").Postkommentarer} */
    const kalla = {
      maxTecken: GASTSKRIV_MAX_TECKEN,
      async las(post) {
        const r = await kor("chatt", { trad: kommentarRotId(post.id) });
        return { rader: r.rot ? [rad(r.rot, post.id), ...r.meddelanden.map((/** @type {any} */ m) => rad(m, post.id))] : [] };
      },
      async kommentera(post, text) {
        try {
          return await kor("kommenteraPost", { postId: post.id, text });
        } catch (e) {
          throw new Error(felText(e));
        }
      },
    };
    return kalla;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupp.kommentera, kor]);
  /** Ett kort i chatten öppnar posten i gästens bibliotek. */
  // Posten ett kort pekar på, tills biblioteket är hämtat. Ett kort öppnas också när biblioteket inte lästs än.
  const [vantarPost, setVantarPost] = useState(/** @type {string | null} */ (null));
  const oppnaPostUrChatten = useCallback((/** @type {string} */ postId) => {
    setFlik("bibliotek");
    skrivGastFlik(sida?.minne, sida?.inbjudan, "bibliotek");
    setVantarPost(postId);
  }, [sida?.minne, sida?.inbjudan]);
  useEffect(() => {
    if (!vantarPost || !bibliotek) return;
    const p = poster.find((/** @type {any} */ x) => x.id === vantarPost);
    if (p) setValdPost(p);
    setVantarPost(null);
  }, [vantarPost, bibliotek, poster]);

  const kalender = /** @type {any} */ (data.kalender);
  /*
   * ══ ⛔ GÄSTENS KALENDER ÄR EN LISTA ÖVER DET SOM ÄR PÅ GÅNG, INGEN MÅNAD (0.190.0, CP 2026-11-05 i cllp/lifehub.app#658, del C) ═══════════════
   *
   * CP: "Skall bara kunna läsa va och således bara en kalendervy som är lista eller?" En gäst lägger inte in något: hen läser, svarar och röstar. Månadsvyn tyngde
   * vyn utan att ge gästen något att göra, och den stryks för gäster (regel 13). Först det som saknar datum (en omröstning om datumet), sedan det som är på gång
   * i tidsordning: en händelse som slutar i dag eller senare. Det som har varit visas inte.
   */
  const idagStr = useMemo(() => {
    const d = idag ?? new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [idag]);
  const paGang = useMemo(() => {
    if (!kalender) return [];
    const utanDatum = kalender.handelser.filter((/** @type {any} */ h) => !h.datum);
    const kommande = kalender.handelser
      .filter((/** @type {any} */ h) => h.datum && String(h.slutDatum ?? h.datum) >= idagStr)
      .sort((/** @type {any} */ a, /** @type {any} */ b) => String(a.datum).localeCompare(String(b.datum)) || (a.heldag ? -1 : 0) - (b.heldag ? -1 : 0) || String(a.tid ?? "").localeCompare(String(b.tid ?? "")) || String(a.id).localeCompare(String(b.id)));
    return [...utanDatum, ...kommande];
  }, [kalender, idagStr]);
  /** När, på en rad: "lör 7 nov 2026 · 18:00 till 20:00", till slutdatum när den är flera dagar, och "Datum ej satt" utan datum. @param {Record<string, any>} h */
  const nartext = (h) => {
    if (!h.datum) return DATUM_EJ_SATT[sprak === "en" ? "en" : "sv"];
    const till = sprak === "en" ? "to" : "till";
    const dagar = h.slutDatum && h.slutDatum !== h.datum ? `${kortDatum(h.datum, sprak)} ${till} ${kortDatum(h.slutDatum, sprak)}` : kortDatum(h.datum, sprak);
    const tid = h.heldag ? "" : tidText(h, till);
    return tid ? `${dagar} · ${tid}` : dagar;
  };

  /** @param {Record<string, any>} h */
  const handelseVy = (h) => ({
    id: h.id,
    titel: h.titel,
    ...(h.datum ? { datum: h.datum } : {}),
    ...(h.slutDatum ? { slutDatum: h.slutDatum } : {}),
    ...(h.tid ? { tid: h.tid } : {}),
    ...(h.slutTid ? { slutTid: h.slutTid } : {}),
    ...(h.heldag ? { heldag: true } : {}),
    ...(h.plats ? { plats: h.plats } : {}),
    ...(h.beskrivning ? { beskrivning: h.beskrivning } : {}),
    kravSvar: h.kravSvar === true,
  });

  const kalenderInnehall = () => {
    if (handelseId) {
      if (detalj === "saknas") {
        return (
          <div data-gast-handelse-saknas="">
            <OpsHandelsePanel handelse={null} onTillbaka={tillKalendern} sprak={sprak} tillbakaEtikett={t.tillbaka} saknasTitel={t.handelseSaknas} saknasText="" />
          </div>
        );
      }
      if (detaljFel) {
        return (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={tillKalendern} className="w-fit cursor-pointer text-etikett text-accent underline">{t.tillbaka}</button>
            <p role="alert" data-gast-handelse-fel="" className="m-0 text-etikett text-danger">{detaljFel}</p>
          </div>
        );
      }
      if (!detalj) return <OpsHandelsePanel handelse={null} laddar onTillbaka={tillKalendern} sprak={sprak} tillbakaEtikett={t.tillbaka} />;
      const h = detalj.handelse;
      return (
        <div data-gast-handelse="" className="flex min-w-0 flex-col gap-4">
          <OpsHandelsePanel
            handelse={handelseVy(h)}
            sprak={sprak}
            tillbakaEtikett={t.tillbaka}
            onTillbaka={tillKalendern}
            svar={
              h.kravSvar === true ? (
                detalj.svar ? (
                  <OpsSvarSummor summa={detalj.svar} onSvara={svara} rubrik={t.rubrikSvar} />
                ) : (
                  <p role="alert" className="m-0 text-etikett text-danger">{t.svarSaknas}</p>
                )
              ) : undefined
            }
          />
          {svarFel ? <p role="alert" data-gast-svar-fel="" className="m-0 text-etikett text-danger">{svarFel}</p> : null}
          {detalj.omrostning ? (
            renderOmrostning ? (
              <div data-gast-omrostning="" className="mx-auto w-full max-w-4xl px-4">
                {renderOmrostning({
                  handelse: h,
                  omrostning: detalj.omrostning,
                  rosta: async ({ forslagId, val }) => {
                    await kor("rosta", { handelseId: h.id, forslagId, val });
                    await hamtaHandelse(h.id);
                  },
                  uppdatera: () => hamtaHandelse(h.id),
                })}
              </div>
            ) : (
              <p data-gast-omrostning-ejstodd="" className="m-0 px-4 text-etikett text-ink-muted">{t.omrostningEjStodd}</p>
            )
          ) : null}
        </div>
      );
    }
    if (fel.kalender) return <OpsGastFelrad data="gast-kalender-fel" text={felOrd(fel.kalender)} forsokIgen={t.forsokIgen} onForsokIgen={() => void ladda("kalender")} />;
    if (!kalender || laddar.kalender) return <OpsEmpty busy title={t.laddar} busyLabel={t.laddar} />;
    return (
      <div data-gast-kalender="" className="flex min-w-0 flex-col gap-3">
        {paGang.length === 0 ? (
          // ⛔ TOMT ÄR EN TYST RAD (0.190.0, QA fynd 9): inte en stor ruta som tar lika mycket plats som innehållet hade gjort.
          <p role="status" data-gast-kalender-tom="" className="m-0 text-etikett text-ink-muted">{t.ingetPaGang}</p>
        ) : (
          <OpsList ariaLabel={t.paGangEtikett}>
            {paGang.map((/** @type {any} */ h) => (
              <OpsListRow key={h.id} interactive onClick={() => oppnaHandelse(h.id)} ariaLabel={h.titel}>
                <span data-gast-pagang={h.id} data-ejsatt={h.datum ? undefined : ""} className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-etikett font-medium text-ink wrap-anywhere">{h.titel}</span>
                  <span className="text-meta text-ink-secondary">{nartext(h)}</span>
                </span>
              </OpsListRow>
            ))}
          </OpsList>
        )}
        {kalender.avkortad ? <p role="status" data-gast-kalender-avkortad="" className="m-0 text-meta text-ink-muted">{t.kalenderAvkortad.replace("{n}", String(kalender.handelser.length))}</p> : null}
        {kalender.ejVisade > 0 ? <p role="status" data-gast-kalender-ejvisade="" className="m-0 text-meta text-ink-muted">{t.kalenderEjVisade.replace("{n}", String(kalender.ejVisade))}</p> : null}
      </div>
    );
  };

  const bibliotekInnehall = () => {
    if (fel.bibliotek) return <OpsGastFelrad data="gast-bibliotek-fel" text={felOrd(fel.bibliotek)} forsokIgen={t.forsokIgen} onForsokIgen={() => void ladda("bibliotek")} />;
    return (
      <div data-gast-bibliotek="" className="flex min-w-0 flex-col gap-3">
        <OpsBibliotek
          poster={poster}
          laddar={!bibliotek || Boolean(laddar.bibliotek)}
          jag={null}
          vald={valdPost}
          onOppna={setValdPost}
          onStang={() => setValdPost(null)}
          onSkapa={() => {}}
          onSpara={async () => false}
          hamtaAdress={hamtaAdress}
          adresserPaBegaran
          utanHubb
          utanNedladdning={grupp.nedladdning === false}
          kommentarer={kommentarer}
        />
        {bibliotek && bibliotek.poster.length === 0 ? <p data-gast-bibliotek-tom="" role="status" className="m-0 text-etikett text-ink-muted">{t.bibliotekTom}</p> : null}
        {bibliotek?.avkortad ? <p role="status" data-gast-bibliotek-avkortad="" className="m-0 text-meta text-ink-muted">{t.bibliotekAvkortad.replace("{n}", String(bibliotek.poster.length))}</p> : null}
      </div>
    );
  };

  // ⛔ ÄRENDEFLIKEN FINNS BARA MED MINST ETT DELEGERAT ÄRENDE (skiva 3), eller när hämtningen föll: ett fel som tystades vore en flik som saknas utan att någon fick veta varför.
  const arendeData = /** @type {{ poster: any[], avkortad?: boolean } | undefined} */ (data.arenden);
  // (0.192.0, #675) Också medan en ny hämtning pågår i den öppna fliken: en ny hämtning rensar felet, och utan raden hade fliken försvunnit under gästen.
  const visaArenden = funktioner.includes("arenden") && ((arendeData?.poster.length ?? 0) > 0 || Boolean(fel.arenden) || (flik === "arenden" && Boolean(laddar.arenden)));
  const synliga = funktioner.filter((f) => f !== "arenden" || visaArenden);
  // Översikt är alltid först och är inte en behörighet. En sparad ärendeflik som inte längre har något att visa faller tillbaka hit.
  const ordning = ["oversikt", ...synliga];
  const aktivFlik = ordning.includes(flik) ? flik : ordning[0];
  const flikar = ordning.map((f) => ({ id: f, label: t[`flik_${f}`] }));
  const chatt = /** @type {{ meddelanden: any[], fler: boolean } | undefined} */ (data.chatt);
  /** @param {string} v */
  const valjFlik = (v) => {
    setFlik(v);
    skrivGastFlik(sida?.minne, sida?.inbjudan, v);
    // Tillbaka i kalenderfliken visas listan, inte en händelse man lämnade.
    if (v !== "kalender") tillKalendern();
  };
  const beskrivning = typeof grupp.beskrivning === "string" ? grupp.beskrivning.trim() : "";
  const behorighet = gastBehorighetsrader(grupp, sprak);
  const oversikt = (
    <div data-gast-oversikt="" className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 data-gast-grupp-namn="" className="m-0 min-w-0 text-titel text-ink wrap-anywhere">{grupp.namn}</h1>
        {beskrivning ? <p data-gast-grupp-beskrivning="" className="m-0 max-w-prose text-etikett text-ink-secondary">{beskrivning}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p data-gast-roll="" className="m-0 text-meta text-ink-secondary">{t.duArGast}</p>
        {behorighet.length > 0 ? (
          <ul data-gast-behorighet="" className="m-0 flex list-none flex-col gap-1 p-0">
            {behorighet.map((rad) => <li key={rad} className="m-0 max-w-prose text-etikett text-ink">{rad}</li>)}
          </ul>
        ) : null}
        {sida?.namn ?? null}
      </div>
      {sida?.integritet ?? null}
      <GastHemskarm sprak={sprak} />
    </div>
  );
  /**
   * Innehållet i en flik, samma på telefon och dator: det är bara ramen runt som skiljer (flikrad eller bottenrad).
   * @param {string} f
   */
  const innehall = (f) =>
    f === "oversikt" ? oversikt : f === "chatt" ? (
      <OpsGastChatt
        meddelanden={chatt?.meddelanden ?? []}
        fler={Boolean(chatt?.fler)}
        onAldre={aldreLaddar ? undefined : () => ladda("chatt", { aldre: true })}
        onSkriv={skrivChatt}
        onLasTrad={(trad) => kor("chatt", { trad })}
        onSkrivITrad={async (trad, text) => {
          try {
            await kor("skrivChatt", { trad, text });
          } catch (e) {
            throw new Error(felText(e));
          }
        }}
        onOppnaPost={funktioner.includes("bibliotek") ? oppnaPostUrChatten : undefined}
        laddar={!chatt && !fel.chatt}
        fel={fel.chatt}
        onForsokIgen={() => void ladda("chatt")}
        sprak={sprak}
        fyll={smal}
      />
    ) : f === "kalender" ? (
      kalenderInnehall()
    ) : f === "bibliotek" ? (
      bibliotekInnehall()
    ) : (
      <OpsGastArenden poster={arendeData?.poster ?? []} avkortad={Boolean(arendeData?.avkortad)} onKommentera={kommenteraArende} onKlar={markeraArendeKlart} laddar={!arendeData && !fel.arenden} fel={fel.arenden} onForsokIgen={() => void ladda("arenden")} sprak={sprak} />
    );

  // ⛔ SPRÅKET GÄLLER HELA GÄSTENS TRÄD (0.190.0, QA fynd 4 i cllp/lifehub.app#658): komponenterna som läser språket ur sammanhanget
  // (`OpsBibliotek`, taggarna, spelaren) fick svenska, eftersom gästsidan ritas utanför appens skal och ingen satte det.
  // ⛔ SAMMA SPELARE SOM I APPEN (0.190.0, CP 2026-11-05, del P): skalets `OpsSpelareProvider` runt gruppen, med spelraden ovanför bottenraden på telefonen och längst ned
  // på datorn, och arket med vågen, -10/+10, hastigheten och Ladda ned. Ingen andra spelare (regel 2): providern är hela monteringen, som i `OpsAppShell`.
  return (
    <OpsSprakProvider sprak={sprak}>
    <OpsSpelareProvider>
    <div data-gast-grupp="" className="flex min-w-0 flex-col gap-4 text-ink sm:rounded-xl sm:border sm:border-line sm:bg-canvas sm:p-5">
      {smal ? (
        <>
          <GastTelefonyta key={aktivFlik} flik={aktivFlik}>{innehall(aktivFlik)}</GastTelefonyta>
          <OpsBottomNav
            utanMeny
            nav={ordning.map((f) => ({ href: `#${f}`, label: t[`flik_${f}`], icon: FLIKIKON[f] }))}
            activeHref={`#${aktivFlik}`}
            navLabel={t.flikarEtikett}
            onNavigate={(href, e) => {
              e?.preventDefault?.();
              valjFlik(href.slice(1));
            }}
          />
        </>
      ) : (
      <OpsTabs
        fast
        tabs={flikar}
        value={aktivFlik}
        onChange={valjFlik}
        ariaLabel={t.flikarEtikett}
      >
        {ordning.map((f) => <OpsTabPanel key={f} id={f}>{innehall(f)}</OpsTabPanel>)}
      </OpsTabs>
      )}
    </div>
    </OpsSpelareProvider>
    </OpsSprakProvider>
  );
}
