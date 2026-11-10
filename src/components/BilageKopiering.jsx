import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { bilagaKanKopieras } from "../data/bibliotekkalla.js";
import { ordet } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField } from "./OpsField.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/*
 * Kopiera en chattbilaga till en plats i Biblioteket (0.155.0, cllp/ops-framework#469).
 *
 * ⛔ KNAPPEN FINNS BARA NÄR APPEN GER DEN ETT MÅL. Utan `OpsBilagekopiering` runt chatten ritas ingenting, och chatten ser ut som förut. Det är appen som vet vilka platser personen får skriva i och hur
 * filen läggs dit (`kopieraBilagaTillPlats` mot den platsens `createBibliotekskalla`), så komponenten skriver ingenting själv.
 * ⛔ KOPIERA, INTE FLYTTA: bilagan är en del av meddelandet. ⛔ EN TYP BIBLIOTEKET INTE TAR EMOT (till exempel text/csv) FÅR INGEN KNAPP (`bilagaKanKopieras`): en knapp som alltid svarar nej är värre än ingen.
 */

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_BILAGEKOPIERING = {
  knapp: { sv: "Kopiera till en plats", en: "Copy to a place" },
  rubrik: { sv: "Kopiera bilagan till Biblioteket", en: "Copy the attachment to the Library" },
  etikett: { sv: "Plats", en: "Place" },
  kopiera: { sv: "Kopiera", en: "Copy" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
  klar: { sv: "Kopierad till {namn}.", en: "Copied to {namn}." },
  ejKopplad: { sv: "Kopieringen är inte kopplad. Bilagan ligger kvar i chatten.", en: "Copying is not connected. The attachment stays in the chat." },
  misslyckades: { sv: "Bilagan kunde inte kopieras.", en: "The attachment could not be copied." },
  // 0.213.0 (cllp/lifehub.app#752): vad som pågår, och vad som hände när det står still.
  kopierar: { sv: "Kopierar…", en: "Copying…" },
  forbereder: { sv: "Förbereder filen…", en: "Preparing the file…" },
  post: { sv: "Skapar posten i Biblioteket…", en: "Creating the item in the Library…" },
  fil: { sv: "Laddar upp…", en: "Uploading…" },
  filAndel: { sv: "Laddar upp, {andel} %", en: "Uploading, {andel} %" },
  klarSteg: { sv: "Gör klart…", en: "Finishing…" },
  stillaStar: {
    sv: "Kopieringen har inte kommit vidare på {sekunder} sekunder. Den kan fortfarande bli klar: titta i Biblioteket innan du försöker igen.",
    en: "The copy has not moved on in {sekunder} seconds. It may still finish: check the Library before you try again.",
  },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
  klarTva: {
    sv: "Kopierad till {namn}. Ett tidigare försök hann också bli klart, så kopian finns två gånger där. Ta bort den ena i Biblioteket.",
    en: "Copied to {namn}. An earlier attempt also finished, so the copy is there twice. Remove one in the Library.",
  },
};

/**
 * Hur länge kopieringen får stå utan ett tecken på liv innan dialogen säger det (0.213.0, cllp/lifehub.app#752). Räknas från senaste steget eller andelen, inte från
 * början, så en stor fil som går upp långsamt men stadigt aldrig får beskedet. ⛔ BEDÖMNING, INTE MÄTT: en bilaga vid taket är cirka en halv megabyte, och 30 sekunder
 * utan att en enda procent går upp är ett nät eller en server som står still, inte en långsam uppladdning.
 */
export const TIDSGRANS_KOPIERING_MS = 30000;

/**
 * @typedef {object} Bilagekopiering
 * @property {readonly { id: string, namn: string }[]} platser Platserna personen får lägga en fil på (`id` är platsens adress: `mitt~...`, gruppens id eller `plats~grupp~id`).
 * @property {(inmatning: { bilaga: { namn?: string, typ?: string, dataUrl?: string }, platsId: string, rapportera: (lage: import("../data/bibliotekkalla.js").Kopieringslage) => void, signal: AbortSignal }) => void | Promise<void>} onKopiera Appens kopiering. Kastar den visas texten i dialogen.
 *   `signal` (0.213.0): avbryts när ett annat försök i samma dialog blivit klart. Skicka den vidare till `kopieraBilagaTillPlats({ ..., signal })`, så skrivs ingen andra post.
 *   `rapportera` (0.213.0): skicka den vidare till `kopieraBilagaTillPlats({ ..., rapportera })`, så visar dialogen vilket steg som pågår och hur mycket som är uppladdat.
 *   Utan den står "Kopierar…", och tidsgränsen räknas från början.
 */

const Kontext = createContext(/** @type {Bilagekopiering | null} */ (null));

/**
 * Ger bilagorna i chatten under sig knappen "Kopiera till en plats".
 * @param {{ platser: Bilagekopiering["platser"], onKopiera: Bilagekopiering["onKopiera"], children?: import("react").ReactNode }} props
 */
export function OpsBilagekopiering({ platser, onKopiera, children }) {
  if (!Array.isArray(platser)) throw new Error("OpsBilagekopiering: platser ska vara en lista av { id, namn }.");
  if (typeof onKopiera !== "function") throw new Error("OpsBilagekopiering: onKopiera ska vara en funktion. Komponenten skriver inget själv.");
  return <Kontext.Provider value={{ platser, onKopiera }}>{children}</Kontext.Provider>;
}

/**
 * Knappen och dialogen under en bilaga. Ritar ingenting utan provider, utan mål eller för en typ som inte kan kopieras.
 *
 * ══ ⛔ INGEN TYST SNURRA (0.213.0, cllp/lifehub.app#752) ═════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-10 09.40 från sin iPhone: "Kopiera fil till en plats funkar inget bra." Knappen Kopiera snurrade och ingenting annat syntes, och dialogen väntade på appens
 * `onKopiera` utan gräns: svarade den aldrig snurrade knappen för alltid (regel 5). Nu:
 *
 *   - **Det som pågår står i dialogen** (`role="status"`): förbereder, skapar posten, laddar upp med procent, gör klart. Steget kommer ur `rapportera`, som dialogen
 *     ger `onKopiera`. En app som inte skickar den vidare får "Kopierar…".
 *   - **Tidsgränsen** (`TIDSGRANS_KOPIERING_MS`, från senaste tecknet på liv): när den passerats slutar snurran och en rad säger vad som hände, att kopieringen kan bli
 *     klar ändå, och att Biblioteket är stället att titta innan man försöker igen. Kopieringen avbryts inte (lagringen har inget avbrott att ge), och blir den klar
 *     senare står kvittot som vanligt.
 *   - **Ett andra försök medan det första står still** är tillåtet, med knappen "Försök igen". Ett fel sägs bara för det senaste försöket; ett tidigare som blir klart
 *     ger kvittot, eftersom kopian då finns.
 *
 * @param {{ bilaga: { namn?: string, typ?: string, dataUrl?: string } }} props
 */
export function KopieraBilagaKnapp({ bilaga }) {
  const val = useContext(Kontext);
  const sprak = useOpsSprak();
  const t = (/** @type {keyof typeof ORD_BILAGEKOPIERING} */ k) => ordet(ORD_BILAGEKOPIERING, k, sprak);
  const [oppen, setOppen] = useState(false);
  const [mal, setMal] = useState("");
  const [fel, setFel] = useState("");
  const [upptagen, setUpptagen] = useState(false);
  const [klar, setKlar] = useState("");
  const [lage, setLage] = useState(/** @type {import("../data/bibliotekkalla.js").Kopieringslage | null} */ (null));
  const [stilla, setStilla] = useState(false);
  const forsok = useRef(0);
  /** Försöken som pågår, med var sitt avbrott. */
  const pagande = useRef(/** @type {Map<number, AbortController>} */ (new Map()));
  /** Har ett försök redan blivit klart, sedan dialogen öppnades? Då är ett till en andra kopia. */
  const klarFor = useRef(false);
  const klocka = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const monterad = useRef(true);
  useEffect(() => {
    monterad.current = true;
    return () => {
      monterad.current = false;
      if (klocka.current) clearTimeout(klocka.current);
    };
  }, []);
  if (!val || val.platser.length === 0 || !bilagaKanKopieras(/** @type {any} */ (bilaga))) return null;
  const { platser, onKopiera } = val;
  const valt = mal || platser[0].id;
  const pagar = upptagen && !stilla;
  const stang = () => {
    if (pagar) return;
    setOppen(false);
    setFel("");
  };
  /** Startar om tidsgränsen. Bara för det senaste försöket. @param {number} nr */
  const vacka = (nr) => {
    if (klocka.current) clearTimeout(klocka.current);
    klocka.current = setTimeout(() => {
      if (monterad.current && forsok.current === nr) setStilla(true);
    }, TIDSGRANS_KOPIERING_MS);
  };
  async function kopiera() {
    if (pagar) return;
    forsok.current += 1;
    const nr = forsok.current;
    const avbryt = new AbortController();
    pagande.current.set(nr, avbryt);
    setFel("");
    setStilla(false);
    setLage(null);
    setUpptagen(true);
    vacka(nr);
    const namn = platser.find((p) => p.id === valt)?.namn ?? valt;
    try {
      await onKopiera({
        bilaga,
        platsId: valt,
        signal: avbryt.signal,
        rapportera: (l) => {
          if (!monterad.current || forsok.current !== nr || !l || typeof l !== "object") return;
          setLage(l);
          setStilla(false);
          vacka(nr);
        },
      });
      pagande.current.delete(nr);
      if (!monterad.current) return;
      /*
       * ⛔ VILKET FÖRSÖK SOM HELST SOM BLIR KLART AVSLUTAR DIALOGEN (granskningen av 0.213.0). Efter tidsgränsen och Försök igen kan det första försöket bli
       * klart medan det andra pågår. Då finns kopian: dialogen stängs med kvittot, och de andra försöken avbryts (`signal`), så att de inte skriver en
       * andra post. Ett försök som redan hunnit förbi sista punkten där det går att avbryta blir klart ändå, och då säger kvittot att kopian finns två gånger.
       */
      const dubbel = klarFor.current;
      klarFor.current = true;
      setKlar(t(dubbel ? "klarTva" : "klar").replace("{namn}", namn));
      for (const [annat, c] of pagande.current) {
        c.abort();
        pagande.current.delete(annat);
      }
      if (klocka.current) clearTimeout(klocka.current);
      setOppen(false);
      setUpptagen(false);
      setStilla(false);
      setLage(null);
    } catch (e) {
      pagande.current.delete(nr);
      // Ett försök vi själva avbröt för att ett annat blev klart är inget fel att visa.
      if (avbryt.signal.aborted) return;
      if (!monterad.current || forsok.current !== nr) return;
      if (klocka.current) clearTimeout(klocka.current);
      setFel(e instanceof Error && e.message ? e.message : t("misslyckades"));
      setUpptagen(false);
      setStilla(false);
      setLage(null);
    }
  }
  const lageText = !lage
    ? t("kopierar")
    : lage.steg === "forbereder"
      ? t("forbereder")
      : lage.steg === "post"
        ? t("post")
        : lage.steg === "klar"
          ? t("klarSteg")
          : typeof lage.andel === "number" && Number.isFinite(lage.andel)
            ? t("filAndel").replace("{andel}", String(Math.round(Math.min(1, Math.max(0, lage.andel)) * 100)))
            : t("fil");
  return (
    <span data-bilaga-kopiera="" className="mt-1 flex flex-wrap items-center gap-2">
      <OpsButton variant="secondary" onClick={() => { setKlar(""); klarFor.current = false; setOppen(true); }}>
        <Copy size={14} aria-hidden="true" /> {t("knapp")}
      </OpsButton>
      {klar ? <span role="status" data-bilaga-kopierad="" className="text-meta text-ink-muted">{klar}</span> : null}
      <OpsModal
        open={oppen}
        onOpenChange={(o) => { if (!o) stang(); }}
        title={t("rubrik")}
        size="sm"
        footer={(
          <>
            <OpsButton variant="secondary" onClick={stang} disabled={pagar}>{t("avbryt")}</OpsButton>
            <OpsButton variant="primary" onClick={kopiera} busy={pagar}>{stilla ? t("forsokIgen") : t("kopiera")}</OpsButton>
          </>
        )}
      >
        <OpsField label={t("etikett")} error={fel || undefined}>
          <OpsSelect value={valt} onChange={setMal} options={platser.map((p) => ({ value: p.id, label: p.namn }))} />
        </OpsField>
        <p role="status" aria-live="polite" data-bilaga-kopiering-lage={pagar ? (lage?.steg ?? "kopierar") : undefined} className="m-0 mt-2 min-h-5 text-meta text-ink-muted">
          {pagar ? lageText : ""}
        </p>
        {stilla ? (
          <p role="alert" data-bilaga-kopiering-stilla="" className="m-0 text-meta text-danger">
            {t("stillaStar").replace("{sekunder}", String(Math.round(TIDSGRANS_KOPIERING_MS / 1000)))}
          </p>
        ) : null}
      </OpsModal>
    </span>
  );
}
