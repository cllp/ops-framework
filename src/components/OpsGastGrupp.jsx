import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GASTGRUPPFUNKTIONER } from "../lib/gast.js";
import { DATUM_EJ_SATT } from "../lib/handelsemodell.js";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsBibliotek } from "./OpsBibliotek.jsx";
import { OpsCalendar } from "./OpsCalendar.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsGastArenden } from "./OpsGastArenden.jsx";
import { OpsGastChatt } from "./OpsGastChatt.jsx";
import { OpsHandelsePanel } from "./OpsHandelsePanel.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsSvarSummor } from "./OpsSvar.jsx";
import { OpsTabPanel, OpsTabs } from "./OpsTabs.jsx";

/**
 * Orden i gruppens gästvy, på svenska och engelska (0.132.0, cllp/lifehub.app#389, skiva 2). Flikarnas namn härleds ur `GASTGRUPPFUNKTIONER`: ett nytt ord där är en ny flik här.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTGRUPP = {
  flikarEtikett: { sv: "Gruppens delar", en: "Parts of the group" },
  flik_chatt: { sv: "Chatt", en: "Chat" },
  flik_kalender: { sv: "Kalender", en: "Calendar" },
  flik_bibliotek: { sv: "Bibliotek", en: "Library" },
  flik_arenden: { sv: "Ärenden", en: "Cases" },
  gastIngress: {
    sv: "Du är gäst i {grupp}. Du kan läsa och skriva i gruppens chatt, svara och rösta i kalendern och läsa, spela och ladda ned i biblioteket. Du ser inte gruppens ärenden, bara de som gruppen har gett dig.",
    en: "You are a guest in {grupp}. You can read and write in the group's chat, answer and vote in the calendar, and read, play and download in the library. You do not see the group's cases, only those the group has given you.",
  },
  kalenderEtikett: { sv: "Kalender", en: "Calendar" },
  kalenderTom: { sv: "Inga händelser i kalendern än.", en: "No events in the calendar yet." },
  ejSattRubrik: { sv: "Datum ej satt", en: "Date not set" },
  ejSattIngress: { sv: "De här händelserna har inget datum än. Öppna en för att svara eller rösta.", en: "These events have no date yet. Open one to answer or vote." },
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
  "fel_ogiltig-text": { sv: "Meddelandet är tomt eller för långt.", en: "The message is empty or too long." },
  "fel_for-manga": { sv: "För många anrop. Vänta en stund och försök igen.", en: "Too many requests. Wait a while and try again." },
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
 * Kalendern är `OpsCalendar` och händelsen `OpsHandelsePanel` utan penna eller flytt, svaren `OpsSvarSummor` (summor och mitt eget svar, inga namn), biblioteket `OpsBibliotek` med `jag: null` (ingen Ny, ingen
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
 * @param {{ namn: string, funktioner: readonly string[] }} props.grupp Tjänstens `hamta().grupp`.
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
  const funktioner = GASTGRUPPFUNKTIONER.filter((f) => grupp.funktioner.includes(f));
  if (funktioner.length === 0) throw new Error("OpsGastGrupp: gruppen har inga funktioner att visa (grupp.funktioner).");

  const [flik, setFlik] = useState(/** @type {string} */ (funktioner[0]));
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
  const felText = (e) => {
    const orsak = e instanceof GastFel ? e.orsak : "kundeInte";
    return t[`fel_${orsak}`] ?? t.fel_nej;
  };

  /** Hämtar en flik. `tyst`: ingen väntan visas och ett fel lämnar det som redan står (tidtagare, fokus). */
  const ladda = useCallback(
    async (/** @type {string} */ namn, /** @type {{ tyst?: boolean, aldre?: boolean, ping?: boolean }} */ val = {}) => {
      if (!val.tyst && !val.aldre) setLaddar((l) => ({ ...l, [namn]: true }));
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
        if (!val.tyst) setFel((f) => ({ ...f, [namn]: felText(e) }));
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

  // En flik hämtas första gången den visas, och om den är äldre än en minut när man kommer tillbaka till den.
  useEffect(() => {
    const ålder = Date.now() - (hamtad.current[flik] ?? 0);
    if (dataRef.current[flik] === undefined) void ladda(flik);
    else if (ålder > FRISKT_MS) void ladda(flik, { tyst: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flik]);

  // Fönstret får fokus: hämta om den flik som syns, om den inte är alldeles färsk.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const fokus = () => {
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
        throw new Error(e instanceof GastFel && e.orsak !== "kundeInte" ? felText(e) : t.bibliotekFilFel);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kor],
  );

  const kalender = /** @type {any} */ (data.kalender);
  const poster_kalender = useMemo(
    () =>
      kalender
        ? kalender.handelser
            .filter((/** @type {any} */ h) => h.datum)
            .map((/** @type {any} */ h) => ({
              id: h.id,
              date: h.datum,
              title: h.titel,
              handelseId: h.id,
              ...(h.slutDatum ? { endDate: h.slutDatum } : {}),
              ...(h.heldag ? { allDay: true } : {}),
              ...(tidText(h, sprak === "en" ? "to" : "till") ? { not: tidText(h, sprak === "en" ? "to" : "till") } : {}),
            }))
        : [],
    [kalender, sprak],
  );
  const ejSatta = kalender ? kalender.handelser.filter((/** @type {any} */ h) => !h.datum) : [];

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
    if (fel.kalender) return <p role="alert" data-gast-kalender-fel="" className="m-0 text-etikett text-danger">{fel.kalender}</p>;
    if (!kalender || laddar.kalender) return <OpsEmpty busy title={t.laddar} busyLabel={t.laddar} />;
    return (
      <div data-gast-kalender="" className="flex min-w-0 flex-col gap-4">
        {kalender.handelser.length === 0 ? <OpsEmpty title={t.kalenderTom} /> : null}
        {/* ⛔ `pb-6` tar tillbaka det kalendern drar av med `-mb-6` (`FULL_HEIGHT_CLASSES`): den är byggd för att vara sist i sin vy. Utan luften låg rubriken Datum ej satt över månadens sista rad (mätt i skalytans bild). */}
        <div className="pb-6">
        <OpsCalendar
          ariaLabel={t.kalenderEtikett}
          entries={poster_kalender}
          onOppnaHandelse={oppnaHandelse}
          lagring={{ getItem: () => null, setItem: () => {} }}
          emptyText={t.kalenderTom}
          locale={sprak === "en" ? "en-GB" : "sv-SE"}
          {...(idag ? { today: idag } : {})}
        />
        </div>
        {ejSatta.length > 0 ? (
          <section aria-label={t.ejSattRubrik} data-gast-ejsatta="" className="flex min-w-0 flex-col gap-2">
            <h2 className="m-0 text-sektion uppercase text-ink-muted">{DATUM_EJ_SATT[sprak === "en" ? "en" : "sv"]}</h2>
            <p className="m-0 text-etikett text-ink-secondary">{t.ejSattIngress}</p>
            <OpsList ariaLabel={t.ejSattRubrik}>
              {ejSatta.map((/** @type {any} */ h) => (
                <OpsListRow key={h.id} interactive onClick={() => oppnaHandelse(h.id)} ariaLabel={h.titel}>
                  <span data-gast-ejsatt={h.id} className="min-w-0 flex-1 text-etikett text-ink wrap-anywhere">{h.titel}</span>
                </OpsListRow>
              ))}
            </OpsList>
          </section>
        ) : null}
        {kalender.avkortad ? <p role="status" data-gast-kalender-avkortad="" className="m-0 text-meta text-ink-muted">{t.kalenderAvkortad.replace("{n}", String(kalender.handelser.length))}</p> : null}
        {kalender.ejVisade > 0 ? <p role="status" data-gast-kalender-ejvisade="" className="m-0 text-meta text-ink-muted">{t.kalenderEjVisade.replace("{n}", String(kalender.ejVisade))}</p> : null}
      </div>
    );
  };

  const bibliotekInnehall = () => {
    if (fel.bibliotek) return <p role="alert" data-gast-bibliotek-fel="" className="m-0 text-etikett text-danger">{fel.bibliotek}</p>;
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
        />
        {bibliotek && bibliotek.poster.length === 0 ? <p data-gast-bibliotek-tom="" role="status" className="m-0 text-etikett text-ink-muted">{t.bibliotekTom}</p> : null}
        {bibliotek?.avkortad ? <p role="status" data-gast-bibliotek-avkortad="" className="m-0 text-meta text-ink-muted">{t.bibliotekAvkortad.replace("{n}", String(bibliotek.poster.length))}</p> : null}
      </div>
    );
  };

  // ⛔ ÄRENDEFLIKEN FINNS BARA MED MINST ETT DELEGERAT ÄRENDE (skiva 3), eller när hämtningen föll: ett fel som tystades vore en flik som saknas utan att någon fick veta varför.
  const arendeData = /** @type {{ poster: any[], avkortad?: boolean } | undefined} */ (data.arenden);
  const visaArenden = funktioner.includes("arenden") && ((arendeData?.poster.length ?? 0) > 0 || Boolean(fel.arenden));
  const synliga = funktioner.filter((f) => f !== "arenden" || visaArenden);
  const aktivFlik = synliga.includes(/** @type {any} */ (flik)) ? flik : synliga[0];
  const flikar = synliga.map((f) => ({ id: f, label: t[`flik_${f}`] }));
  const chatt = /** @type {{ meddelanden: any[], fler: boolean } | undefined} */ (data.chatt);

  return (
    <div data-gast-grupp="" className="flex min-w-0 flex-col gap-4 text-ink sm:rounded-xl sm:border sm:border-line sm:bg-canvas sm:p-5">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 data-gast-grupp-namn="" className="m-0 text-titel text-ink wrap-anywhere">{grupp.namn}</h1>
        <p data-gast-grupp-ingress="" className="m-0 text-etikett text-ink-secondary">{t.gastIngress.replace("{grupp}", grupp.namn)}</p>
      </header>
      <OpsTabs
        tabs={flikar}
        value={aktivFlik}
        onChange={(v) => {
          setFlik(v);
          // Tillbaka i kalenderfliken visas listan, inte en händelse man lämnade.
          if (v !== "kalender") tillKalendern();
        }}
        ariaLabel={t.flikarEtikett}
      >
        {funktioner.includes("chatt") ? (
          <OpsTabPanel id="chatt">
            <OpsGastChatt
              meddelanden={chatt?.meddelanden ?? []}
              fler={Boolean(chatt?.fler)}
              onAldre={aldreLaddar ? undefined : () => ladda("chatt", { aldre: true })}
              onSkriv={skrivChatt}
              laddar={!chatt && !fel.chatt}
              fel={fel.chatt}
              sprak={sprak}
            />
          </OpsTabPanel>
        ) : null}
        {funktioner.includes("kalender") ? <OpsTabPanel id="kalender">{kalenderInnehall()}</OpsTabPanel> : null}
        {funktioner.includes("bibliotek") ? <OpsTabPanel id="bibliotek">{bibliotekInnehall()}</OpsTabPanel> : null}
        {visaArenden ? (
          <OpsTabPanel id="arenden">
            <OpsGastArenden poster={arendeData?.poster ?? []} avkortad={Boolean(arendeData?.avkortad)} onKommentera={kommenteraArende} onKlar={markeraArendeKlart} laddar={!arendeData && !fel.arenden} fel={fel.arenden} sprak={sprak} />
          </OpsTabPanel>
        ) : null}
      </OpsTabs>
    </div>
  );
}
