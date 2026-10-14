import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { OpsInspelning, useTalk } from "./OpsTalk.jsx";
import { LjudvagIkon } from "./icons.jsx";

/**
 * Röstinmatning i ett textfält: TALK:s inspelning (`useTalk`) och yta (`OpsInspelning`), och det sagda lämnat till fältet.
 *
 * ══ ⛔ EN RÖSTINMATNING I RAMVERKET, INTE EN PER FÄLT (0.104.0, regel 2) ══════════════════════════════════════════════════════
 *
 * CP 2026-10-14, med en skärmbild av Skapa app i lifehub.app (ett `OpsTextarea` med "Beskriv appen du vill ha"): "Jag vill gärna ha
 * TALK funktionen även här på skapa app." Fram till 0.103.0 bodde det här i chattens skrivfält (`OpsMeddelanden.jsx`), inbyggt och
 * omöjligt att återanvända. Nu bor det här, och både chatten och `OpsTextarea` (propen `tal`) använder det. Skillnaden mellan dem är
 * en enda sak, och den skickas in som `onTal`: chatten SKICKAR det sagda som ett meddelande, textfältet SKRIVER IN det där markören står.
 *
 * ⛔ EXPORTERAD FRÅN FILEN, INTE UR RAMVERKET (`src/index.js`). Appen når den genom `OpsTextarea` och `OpsMeddelanden`.
 */

/**
 * Texterna röstinmatningen behöver. Chatten och textfältet har var sina, eftersom chatten skickar och fältet skriver in.
 * @typedef {object} Rosttexter
 * @property {string} transkriptionFel När appens `onTranscribe` föll eller inte finns.
 * @property {string} ingenUtskrift Läggs efter `transkriptionFel` när inget hördes och appen saknar `onTranscribe`.
 * @property {string} ingetHordes Läggs efter `transkriptionFel` när appens utskrift kom tillbaka tom.
 * @property {string} lamnaFel När `onTal` föll: chattens "Det du sa kunde inte skickas.".
 * @property {string} textFel När taligenkänningen föll medan man pratar.
 * @property {string} skriverUt Ytans statusrad medan appens `onTranscribe` skriver ut ljudet.
 * @property {string} lamnar Ytans statusrad medan det sagda lämnas till `onTal`.
 */

/**
 * Röstinmatningen: TALK:s inspelning, och det sagda till `onTal`.
 *
 * ══ ⛔ VILKEN TEXT SOM LÄMNAS, I DEN HÄR ORDNINGEN (0.103.0) ═════════════════════════════════════════════════════════════════
 *
 *   1. Igenkänningens hela text (`meta.text` från `useTalk`).
 *   2. Annars det som stod i ytan när inspelningen slutade (`talk.text`): det personen såg är det som lämnas, alltså räknas den
 *      preliminära texten vid stopp. ⛔ INTE när igenkänningen föll (`talk.textFel`): ytan har då sagt att texten inte kan visas
 *      och att det sagda skrivs ut, och en halv mening som lämnades i stället hade varit ett annat löfte än det som stod.
 *   3. Annars, och bara då, appens `onTranscribe` på ljudet. Ytan säger `skriverUt` så länge.
 * Utan igenkänning, eller där webbläsaren saknar den, är det alltid steg 3: ett beteende, inte två.
 *
 * ⛔ DET SAGDA FÖRSVINNER ALDRIG TYST (regel 5, och rättelsen för cllp/lifehub.app#253). Finns ingen text och ingen utskrift, eller
 * kommer utskriften tillbaka tom, eller faller `onTal`, står felet i ytan med Försök igen. Ett tomt `onTal` anropas aldrig. Försök igen
 * lämnar samma text om den redan fanns, och skriver annars ut samma ljud på nytt. Bara krysset tar bort ljudet och texten.
 * Mikrofonen släpps av `useTalk` i alla vägar ut: Klar, Avbryt, ett fel och avmonteringen.
 *
 * ⛔ IGENKÄNNINGEN ÄR APPENS VAL (granskningen av PR 358, MÅSTE 3). Den är av som förval och slås på med `igenkanning`, som i TALK,
 * eftersom webbläsaren skickar talet till Google eller Apple.
 *
 * @param {{ onTranscribe?: (blob: Blob) => Promise<string>, inspelare?: import("../lib/talk.js").Inspelare, igenkanning?: import("../lib/talk.js").Igenkanning | boolean, texter: Rosttexter, onTal: (text: string) => void | Promise<void> }} p
 */
export function useRostinmatning({ onTranscribe, inspelare, igenkanning, texter: t, onTal }) {
  /** Det som stod i ytan senast medan inspelningen pågick, eller tom när igenkänningen föll. Steg 2 ovan. */
  const visat = useRef("");
  /** Texten som ska lämnas, när den väl är bestämd. Försök igen efter ett `onTal` som föll skriver då inte ut ljudet en gång till. */
  const bestamd = useRef(/** @type {string | null} */ (null));
  /** Vad ytan säger medan Klar arbetar: att det sagda lämnas, eller att appen skriver ut ljudet. */
  const [steg, setSteg] = useState(/** @type {"lamnar" | "skriver"} */ ("lamnar"));
  /** Texten som lämnas just nu, så att ytan visar den tills den är framme. */
  const [lamnas, setLamnas] = useState("");
  const talRef = useRef(onTal);
  talRef.current = onTal;
  const nollstall = () => {
    visat.current = "";
    bestamd.current = null;
    setSteg("lamnar");
    setLamnas("");
  };
  const talk = useTalk({
    inspelare,
    igenkanning,
    onKlick: () => {},
    onTalk: async (blob, meta) => {
      let ut = bestamd.current;
      if (ut === null) {
        const hort = String(meta.text || visat.current || "").trim();
        if (hort) {
          ut = hort;
        } else {
          if (!onTranscribe) throw new Error(`${t.transkriptionFel} ${t.ingenUtskrift}`);
          setSteg("skriver");
          setLamnas("");
          /** @type {string} */
          let utskrivet;
          try {
            utskrivet = String((await onTranscribe(blob)) ?? "").trim();
          } catch (e) {
            throw new Error(`${t.transkriptionFel}${e instanceof Error && e.message ? ` ${e.message}` : ""}`);
          }
          if (!utskrivet) throw new Error(`${t.transkriptionFel} ${t.ingetHordes}`);
          ut = utskrivet;
        }
        bestamd.current = ut;
      }
      setSteg("lamnar");
      setLamnas(ut);
      try {
        await talRef.current(ut);
      } catch (e) {
        throw new Error(`${t.lamnaFel}${e instanceof Error && e.message ? ` ${e.message}` : ""}`);
      }
      nollstall();
    },
  });
  const spelarNu = talk.lage === "haller" || talk.lage === "lyssnar";
  // ⛔ Medan inspelningen pågår är det här det personen ser. Läst vid varje rendering, så att också taket (`MAX_SEKUNDER`), som
  // stoppar utan Klar, får med texten.
  if (spelarNu) visat.current = talk.textFel ? "" : talk.text;
  /** Ytan står i fältets plats i de här lägena. I "sparat" är det sagda framme och fältet tillbaka. */
  const yta = spelarNu || talk.lage === "skickar" || talk.lage === "fel";
  return {
    yta,
    /** Läget för `data-rostlage`: "spelar", "skickar" (det sagda lämnas), "skriver" (appens utskrift) och "fel". */
    ytlage: talk.lage === "fel" ? "fel" : talk.lage === "skickar" ? (steg === "skriver" ? "skriver" : "skickar") : "spelar",
    /** Texten syns i ytan medan den hörs: igenkänningen är påslagen, finns i webbläsaren, och mikrofonen är öppen. */
    live: spelarNu && talk.medText,
    lage: talk.lage,
    fel: talk.fel,
    niva: talk.niva,
    sekunder: talk.sekunder,
    tak: talk.tak,
    kanIgen: talk.kanIgen,
    medText: talk.medText,
    text: talk.lage === "skickar" ? lamnas : talk.text,
    textFel: talk.textFel ? t.textFel : "",
    skickarText: steg === "skriver" ? t.skriverUt : t.lamnar,
    starta: () => {
      nollstall();
      talk.direkt();
    },
    klar: () => talk.skickaIn(),
    igen: () => talk.igen(),
    avbryt: () => {
      nollstall();
      talk.avbryt();
    },
  };
}

/** @typedef {ReturnType<typeof useRostinmatning>} Rost */

/**
 * ⛔ FOKUS FÖLJER YTAN. Mikrofonen som trycktes försvinner när ytan kommer, och utan ett nytt mål hamnar tangentbordet i sidans topp.
 * I ytan går fokus till Klar, och i ett fel till den sista knappen (Försök igen eller Stäng). När ytan går tillbaka till fältet anropas
 * `tillbaka`, som ger fältet fokus: efter Klar, efter Avbryt och efter ett fel som stängs.
 *
 * @param {Rost} rost
 * @param {import("react").RefObject<HTMLDivElement | null>} ytaRef
 * @param {() => void} tillbaka
 */
export function useRostfokus(rost, ytaRef, tillbaka) {
  const ytaFanns = useRef(false);
  const tillbakaRef = useRef(tillbaka);
  tillbakaRef.current = tillbaka;
  useEffect(() => {
    const yta = ytaRef.current;
    if (rost.yta && yta) {
      ytaFanns.current = true;
      if (!yta.contains(document.activeElement)) {
        const knappar = /** @type {HTMLElement[]} */ ([...yta.querySelectorAll("button")]);
        (/** @type {HTMLElement | null} */ (yta.querySelector("[data-talk-skicka]")) ?? knappar[knappar.length - 1] ?? null)?.focus({ preventScroll: true });
      }
      return;
    }
    if (!rost.yta && ytaFanns.current) {
      ytaFanns.current = false;
      tillbakaRef.current();
    }
  }, [rost.yta, rost.lage, ytaRef]);
}

/** Ramen runt ytan: chattens skrivfält har sin kantlinje och sitt avstånd, textfältet står fritt i formuläret. */
const RAMAR = {
  chatt: "shrink-0 border-t border-line px-3 py-2",
  falt: "min-w-0",
};

/**
 * TALK:s yta i fältets plats medan rösten arbetar: prickarna, tiden, texten som hörs, Avbryt och Klar.
 *
 * `data-rostlage` säger läget för proven och skalytan: "spelar", "skickar", "skriver" (appens utskrift) och "fel".
 *
 * ⛔ `namn` GÖR YTAN TILL EN GRUPP MED FÄLTETS NAMN (0.104.0, granskningen av PR 384, KAN 7). Ytan står i fältets plats, och utan namn
 * hörde den som lyssnar "Klar" och "Avbryt" utan att veta vilket fält de gällde. `etikettId` pekar på fältets etikett i `OpsField`,
 * `text` är fältets `ariaLabel`. Chattens yta har inget namn: den står där skrivfältet står, och samtalets rubrik säger var man är.
 *
 * @param {{ rost: Rost, klarEtikett: string, ytaRef: import("react").RefObject<HTMLDivElement | null>, ram: "chatt" | "falt", namn?: { etikettId?: string, text?: string } }} props
 */
export function Rostyta({ rost, klarEtikett, ytaRef, ram, namn }) {
  return (
    <div
      ref={ytaRef}
      data-rostyta=""
      data-rostlage={rost.ytlage}
      data-live={rost.live ? "" : undefined}
      className={RAMAR[ram]}
      role={namn ? "group" : undefined}
      aria-labelledby={namn?.etikettId}
      aria-label={namn?.etikettId ? undefined : namn?.text}
    >
      <div className="rounded-3xl border border-line-strong bg-raised p-4 shadow-sm">
        <OpsInspelning
          lage={rost.lage}
          fel={rost.fel}
          niva={rost.niva}
          sekunder={rost.sekunder}
          tak={rost.tak}
          framsteg={null}
          kanIgen={rost.kanIgen}
          text={rost.text}
          textFel={rost.textFel}
          medText={rost.medText}
          skickarText={rost.skickarText}
          klarEtikett={klarEtikett}
          onKlar={rost.klar}
          onAvbryt={rost.avbryt}
          onIgen={rost.igen}
          onTillatMikrofon={rost.starta}
        />
      </div>
    </div>
  );
}

/**
 * Mikrofonen i ett fält: en ljudvåg i en rund knapp. ⛔ TRÄFFYTAN ÄR KNAPPEN, 44 PX; cirkeln inuti är det man ser. Samma knapp i
 * chattens skrivfält och i `OpsTextarea`, så att de två ser likadana ut och inte kan glida isär.
 *
 * @param {{ lage: string, etikett: string, onClick: () => void, placering?: "rad" | "falt" }} props `falt`: i textfältets nedre hörn.
 */
export function Mikrofonknapp({ lage, etikett, onClick, placering = "rad" }) {
  return (
    <button
      type="button"
      data-mikrofon={lage}
      aria-label={etikett}
      onClick={onClick}
      className={cx("group/knapp inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none", placering === "falt" && "absolute end-3 bottom-0.5")}
    >
      <span className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-sm transition-colors duration-(--duration-fast) ease-standard group-hover/knapp:bg-hover group-focus-visible/knapp:outline-2 group-focus-visible/knapp:outline-offset-1 group-focus-visible/knapp:outline-accent">
        <LjudvagIkon size={18} />
      </span>
    </button>
  );
}
