import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { FileText, Image as BildIkon, Library, Link, Music, Plus, StickyNote } from "lucide-react";
import { OpsAtgardsblad } from "./OpsAtgardsblad.jsx";
import { OpsDokument } from "./OpsDokument.jsx";
import { OpsMarkdown } from "./OpsMarkdown.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { OpsSvepRad } from "./OpsSvepRad.jsx";
import { ADRESSFORM, BIBLIOTEKTYPER, MAX_TAGGAR, allaTaggar, arLjudpost, farAndra, normaliseraTagg, normaliseraTaggar, taggarFel, filInmatningsfel, filSort, filtreraBibliotek, inmatningsfel, ljudDatum, ljudRubrik, normaliseraAdress, trimSomRegeln } from "../lib/bibliotek.js";
import { HOPP_SEKUNDER, formateraTid, ljudStyrning } from "../lib/ljudspelare.js";
import { useInspelningOppnare } from "./OpsAppShell.jsx";
import { cx } from "../lib/cx.js";
import { arInstallningslage } from "../lib/apparark.js";
import { modulTillbaka } from "../lib/modulram.js";
import { radBehallare, radKlass } from "../lib/radKlass.js";
import { OpsButton, knappKlass } from "./OpsButton.jsx";
import { OpsChip } from "./OpsChip.jsx";
import { OpsTag } from "./OpsTag.jsx";
import { OpsLjudspelare } from "./OpsLjudspelare.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsList } from "./OpsList.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsTabPanel, OpsTabs } from "./OpsTabs.jsx";
import { TillbakaKnapp } from "./TillbakaKnapp.jsx";
import { ModulLageKnapp, OpsModulRam, kravRam } from "./OpsModulRam.jsx";
import { OpsView } from "./OpsView.jsx";

/**
 * Gruppens bibliotek: lista och detalj för anteckning och länk.
 *
 * Ytan följer SessionStudios lista (ikon, rubrik, öppna raden) och håller
 * sökningen i det som redan lästs. Flikarna är en segmentväljare med tre lägen,
 * också när en typ har noll poster: noll är beskedet att typen finns och är tom.
 *
 * Komponenten skriver ingenting själv. `onSpara` får typ, rubrik och text eller
 * adress. Källan sätter grupp, författare och klockslag.
 *
 * ⛔ FORMULÄRET ÄR ETT LÄGE, INTE ÖPPNINGEN (CP, Bibliotekets anteckningar).
 * Öppning visar texten, markdown via `OpsMarkdown`. Redigera (pennan) byter till
 * fält, med Spara och Avbryt. Ett nytt dokument börjar i redigering, för det
 * finns inget att läsa. Vem som får redigera är `farAndra`, samma villkor som
 * regelns `update`: författaren eller admin. Andra ser läsläge utan penna. Ett
 * formulär som regeln sedan nekar är ett löfte vyn inte kan hålla.
 * `jag: null` betyder att den inloggade inte är medlem: allt är läsläge och
 * inga knappar för att lägga till.
 *
 * ⛔ RADERA SITTER INTE I FORMULÄRET (#311, och CP: den stora röda knappen).
 * Samma `farAndra`, samma väg för varje typ (anteckning, länk, ljud, fil):
 * ⋯ och svep i listan, ⋯ i detaljen, bekräftelse (modal) respektive Ångra (svep).
 * En trasig rad har samma fråga när raden bär grupp och skapare nog för `farAndra`.
 *
 * ⛔ DETALJHUVUDET ÄR GEMENSAMT (CP 2026-10-10). Tillbaka, ikon och ⋯ på en rad,
 * rubriken på egen rad med rollen `rubrik`, sedan metadata. Typen fyller bara
 * innehållet. Förr delade anteckningens `text-sida`-rubrik rad med ikonen och
 * Redigera, och ordet trängdes på telefonen.
 *
 * ⛔ `jag` KRÄVS, OCH `null` ÄR ETT SVAR (regel 5, granskningen av #304). Med
 * `null` som förval såg en app som glömt propen ut som en icke-medlem: inga
 * knappar och inget fel, och den som faktiskt får skriva fick bara läsa. Nu
 * kastar komponenten när `jag` saknas, och appen säger `null` när personen inte
 * är medlem.
 *
 * ══ ⛔ SIDAN SER UT OCH NAVIGERAS SOM EKONOMI (0.83.0) ════════════════════
 *
 * CP 2026-10-08 17:52, med bilder från telefonen av Bibliotek och Ekonomi: "Bibliotek behöver en tillbaka knapp också
 * precis som ekonomi. Sedan navigeringen på liknande sätt. Sök och komponenter är ihoptryckta." Tre ändringar, alla mätta:
 *
 * - **Tillbaka och rubriken är modulens ram**, samma `OpsView`-rad som `OpsModulSida` ritar (`modulTillbaka` i
 *   `modulram.js`): "‹ Tillbaka" upp till hubben och "Bibliotek" som rubrik. Därför krävs `hubHref`, som för
 *   `OpsModulSida`: en tillbaka-rad som inte vet vart den leder är en knapp som inte gör något.
 *   Detaljen (läsning och formulär) går ett steg tillbaka till listan, inte till hubben, och ritar därför
 *   `TillbakaKnapp`: samma chevron och vänsterställda text som skapa- och händelsepanelen. En `OpsButton` i
 *   vyns kolumn sträcks till hela bredden och centrerar ordet, och den har ingen chevron.
 * - **Typerna är Ekonomis flikrad** (`OpsTabs` med `medOrd`): ikon, namn, antal och accentlinjen, med samma klasser.
 *   Före var de en segmentväljare i pillerform. Att de inte är länkar som Ekonomis delar är ett beslut: typen är ett
 *   urval i samma lista, inte en egen sida, och sökordet ska stå kvar när man byter flik.
 * - **Luften är vyns rytm.** Mätt med Playwright mot appens mätbygge: mellan sökfältet, segmentet, knapparna och listan
 *   stod 0 px, eftersom allt låg i ett omslag (`data-bibliotek`) utan vyns `gap`. I Ekonomi är luften 16 px (`gap-4`)
 *   mellan rubriken, raden och innehållet. Omslaget har nu samma rytm, och flikpanelen lika så.
 *
 * ⛔ SÖK OCH "+ NY" PÅ EN RAD, SOM SESSIONSTUDIOS BIBLIOTEK. Två stora knappar ("Ny anteckning", "Ny länk") under
 * segmentet tog en egen rad och bredde ut sig. Under Alla öppnar "+ Ny" ett val mellan anteckning och länk. Under en typ
 * skapar den den typen direkt, och dess namn säger vilken ("Ny anteckning"): ett val med ett enda alternativ är ett tryck
 * för mycket. Sökfältet har ingen synlig etikett längre: ordet "Sök" ovanför fältet tog en rad och sade samma sak som
 * platshållaren och skärmläsarnamnet.
 *
 * ⛔ EN LÄNK GÅR ATT ÖPPNA. Den visas som en `<a>` i ny flik med
 * `rel="noopener noreferrer"`, och bara när adressen klarar `ADRESSFORM`, alltså
 * http eller https.
 */

/**
 * @param {object} props
 * @param {readonly (import("../lib/bibliotek.js").Bibliotekspost & { id: string })[]} props.poster
 * @param {string | null} [props.fel] Läsningen misslyckades. Tom lista med fel är inte "biblioteket är tomt".
 * @param {readonly { id: string, fel: string, groupId?: string, skapadAv?: { uid?: string | null } }[]} [props.trasiga] Rader källan inte kunde läsa (`las().trasiga`). De visas som ett antal med skäl, aldrig tyst. Den som får raderar raden.
 * @param {{ uid: string, roll: string, groupId?: string } | null} props.jag Den inloggades aktiva medlemskap i gruppen, eller `null` när personen inte är medlem. Krävs.
 * @param {boolean} [props.laddar]
 * @param {(import("../lib/bibliotek.js").Bibliotekspost & { id: string }) | null} [props.vald]
 * @param {"anteckning" | "lank" | "fil" | null} [props.skapar]
 * @param {(post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }) => void} props.onOppna
 * @param {() => void} props.onStang
 * @param {(typ: "anteckning" | "lank" | "fil") => void} props.onSkapa
 * @param {(inmatning: { id?: string, typ?: string, rubrik?: string, text?: string, url?: string, taggar?: string[] }) => void | boolean | Promise<void | boolean>} props.onSpara Kastar den eller avvisas löftet visas felet i formuläret och läget står kvar (0.93.0). `false` betyder att det inte gick.
 * @param {(id: string) => void | Promise<void>} [props.onRadera] Tar bort posten efter bekräftelse. Saknas den och någon bekräftar visas felet, posten rörs inte.
 * @param {(inmatning: { id?: string, rubrik: string, fil: File }) => void | Promise<void>} [props.onLaddaUpp] Sparar en fil. Saknas den och någon försöker visas felet, filen laddas inte upp.
 * @param {(inmatning: { id: string, durationMs?: number, peaks?: string }) => void | Promise<void>} [props.onFyllLjud] Skriver längd och våg på en post som saknar dem. Listan räknar dem i bakgrunden, utan att någon trycker på spela. (0.93.0) Anropas bara när `jag` får ändra posten (`farAndra`): reglerna nekar alla andra, och längden visas ändå.
 * @param {(post: { fil?: { sokvag?: string } }) => string} [props.filUrl] Appen ger adressen till en fil. Tom sträng visas som att adressen saknas. Synkron, och vinner när den är ifylld.
 * @param {(sokvag: string) => Promise<string>} [props.hamtaAdress] (0.88.2) Nedladdningsadressen för `fil.sokvag`, när `filUrl` är tom. Svaret cachas per sökväg, så listan och detaljen delar den. Medan den hämtas visas inte "Filen har ingen adress."
 * @param {unknown} [props.onSpelaIn] Borttagen (0.90.8). Skickas den kastas ett fel: listan hade en egen inspelare, och att tysta propen hade sett ut som att ljudet fortfarande sparades där.
 * @param {unknown} [props.inspelare] Borttagen tillsammans med listans inspelare. Skickas den kastas ett fel.
 * @param {readonly { id: string, namn: string }[]} [props.grupper] Grupper posten kan flyttas eller kopieras till.
 * @param {(inmatning: { id: string, groupId: string, satt: "flytta" | "kopiera" }) => void | Promise<void>} [props.onDela] Flytta eller kopiera. Saknas den visas felet, posten är kvar.
 * @param {(post: { id: string }) => { text: string, forslag?: "anteckning" | "arende" } | Promise<{ text: string, forslag?: "anteckning" | "arende" }>} [props.onSkrivUt] Ber servern om en utskrift. Felet visas, också ett dygnstak.
 * @param {(inmatning: { id: string, satt: "anteckning" | "arende" }) => void | Promise<void>} [props.onGorForslag] Personen väljer. Inget skapas utan trycket.
 * @param {string} [props.modulId] (0.88.1) Modulens id i appen, förval "bibliotek". Står den i huvudmenyn har listan ingen tillbaka-rad.
 * @param {string} props.hubHref (0.83.0) Hubbens adress: tillbaka-radens mål, som `OpsModulSida`. Krävs.
 * @param {string} [props.hubEtikett] Förval "Appar".
 * @param {(href: string, event: any) => void} [props.onNavigate] Tillbaka-länkens klick, som `OpsModulSida`.
 * @param {import("./OpsModulRam.jsx").ModulRam | null} [props.ram] (0.89.0) Inställningsläget. Utelämnad: listan som förut, utan kugghjul.
 * @param {string} [props.activeHref] (0.89.0) Krävs tillsammans med `ram` och `modul`. `?lage=installningar` visar inställningarna.
 * @param {import("../lib/modul.js").Modul | null} [props.modul] (0.89.0) Manifestet inställningarna läser. Krävs med `ram`.
 */
export function OpsBibliotek({ poster, fel = null, trasiga = [], laddar = false, vald = null, skapar = null, jag, onOppna, onStang, onSkapa, onSpara, onRadera, onLaddaUpp, onFyllLjud, onSpelaIn, inspelare, filUrl, hamtaAdress, grupper = [], onDela, onSkrivUt, onGorForslag, hubHref, hubEtikett, onNavigate, modulId = "bibliotek", ram = null, activeHref, modul = null }) {
  if (jag === undefined) {
    throw new Error("OpsBibliotek: jag krävs, den inloggades aktiva medlemskap i gruppen ({ uid, roll }), eller null när personen inte är medlem. Utan propen ser en medlem ut som en som bara får läsa.");
  }
  if (typeof hubHref !== "string" || hubHref === "") {
    throw new Error("OpsBibliotek: hubHref krävs (0.83.0), hubbens adress. Sidan har Ekonomis tillbaka-rad, och en rad som inte vet vart den leder är en knapp som inte gör något.");
  }
  kravRam(ram, "OpsBibliotek");
  if (ram && (typeof activeHref !== "string" || activeHref === "" || !modul)) {
    throw new Error("OpsBibliotek: ram kräver activeHref och modul. Inställningsläget behöver adressen och appens manifest.");
  }
  if (onSpelaIn !== undefined || inspelare !== undefined) {
    throw new Error("OpsBibliotek: inspelningen i listan är borta. Röstinspelning i Ny-menyn öppnar skalets inspelare, med målet förvalt till modulens inspelning.mal.");
  }
  const sprak = useOpsSprak();
  const oppnaInspelning = useInspelningOppnare();
  const [flik, setFlik] = useState(/** @type {"alla" | "anteckning" | "lank" | "ljud" | "fil"} */ ("alla"));
  const [rostFel, setRostFel] = useState("");
  const [ljus, setLjus] = useState("");
  const [sok, setSok] = useState("");
  const [valdaTaggar, setValdaTaggar] = useState(/** @type {string[]} */ ([]));
  const [taggar, setTaggar] = useState(/** @type {null | (import("../lib/bibliotek.js").Bibliotekspost & { id: string })} */ (null));
  const [startLage, setStartLage] = useState(/** @type {"las" | "redigera"} */ ("las"));
  const [byter, setByter] = useState(/** @type {null | (import("../lib/bibliotek.js").Bibliotekspost & { id: string })} */ (null));
  const [namnUtkast, setNamnUtkast] = useState("");
  const [namnFel, setNamnFel] = useState("");
  const [namnBusy, setNamnBusy] = useState(false);
  // Flaggan i en ref: två tryck i samma tick ser annars båda `namnBusy === false`.
  const namnSparar = useRef(false);
  const [raderar, setRaderar] = useState(/** @type {string | null} */ (null));
  const [raderaFel, setRaderaFel] = useState("");
  const [delar, setDelar] = useState(/** @type {null | (import("../lib/bibliotek.js").Bibliotekspost & { id: string })} */ (null));
  const [status, setStatus] = useState("");
  const adresser = useFilAdresser(poster, vald, filUrl, hamtaAdress);
  const adressFor = (/** @type {{ typ?: string, fil?: { sokvag?: string, mime?: string } }} */ post) => losAdress(post, filUrl, hamtaAdress, adresser);
  const [fylld, setFylld] = useState(/** @type {Record<string, { durationMs?: number, peaks?: string }>} */ ({}));
  const sparatMeta = useRef(/** @type {Set<string>} */ (new Set()));
  const onFyllRef = useRef(onFyllLjud);
  onFyllRef.current = onFyllLjud;
  /**
   * Längd och våg som räknats i den här visningen, ovanpå det posten redan bär.
   * @template {import("../lib/bibliotek.js").Bibliotekspost & { id: string }} T
   * @param {T} post
   * @returns {T}
   */
  function medFyll(post) {
    const extra = fylld[post.id];
    if (!extra) return post;
    return /** @type {T} */ ({ ...post, ...extra });
  }
  /**
   * Bakgrund: spelaren räknar längd och toppar utan att någon trycker på spela,
   * och det här skriver dem på posten så nästa lista visar längden direkt.
   * @param {string} id
   * @param {{ durationMs?: number, peaks?: string }} meta
   */
  function togMeta(id, meta) {
    if (!id || !meta || (!meta.durationMs && !meta.peaks)) return;
    setFylld((f) => {
      const prev = f[id] || {};
      const nasta = {
        ...prev,
        ...(meta.durationMs && !prev.durationMs ? { durationMs: meta.durationMs } : {}),
        ...(meta.peaks && !prev.peaks ? { peaks: meta.peaks } : {}),
      };
      if (nasta.durationMs === prev.durationMs && nasta.peaks === prev.peaks) return f;
      return { ...f, [id]: nasta };
    });
    const cb = onFyllRef.current;
    if (typeof cb !== "function") return;
    // ⛔ BARA DEN SOM FÅR ÄNDRA POSTEN SKRIVER (0.93.0). Reglerna släpper bara författaren och en admin till en uppdatering.
    // Varje annan medlem som lyssnade på ett ljud skickade en skrivning som nekades, i bakgrunden, för varje rad. Längden
    // visas ändå ur `fylld` ovan: den är en visning, skrivningen är en hjälp till nästa lista.
    const post = poster.find((p) => p.id === id) ?? (vald && vald.id === id ? vald : null);
    if (!post || !farAndra(post, jag)) return;
    // ⛔ LÄNGDEN OCH VÅGEN SKICKAS SOM TVÅ ANROP, I TUR OCH ORDNING (0.93.0). Då nekades en skrivning med `peaks` av reglernas
    // uttryckstak (https://github.com/cllp/ops-framework/issues/349), och bar den längden i samma skrivning nekades den med. Vågen är
    // sedan 0.98.0 en sträng som prövas med ett uttryck, så taket är borta, men delningen står kvar: en app som ännu inte deployat
    // de nya reglerna nekar vågen, och längden ska gå igenom ändå. I tur och ordning, inte samtidigt: `spara` läser raden och skriver
    // om den, och två samtidiga skrivningar hade lämnat den andra med en rad utan den förstas fält.
    //
    // ⛔ ETT FEL SYNS I KONSOLEN MED POSTENS ID, det sväljs inte. Listan visar längden ändå (`fylld`), men ett skrivfel som
    // försvinner ser ut som att det gick bra, och då vet ingen varför längden saknas nästa gång listan öppnas.
    /** @type {Array<{ nyckel: string, vad: string, del: { durationMs?: number, peaks?: string } }>} */
    const delar = [];
    if (meta.durationMs) delar.push({ nyckel: `${id}:langd:${meta.durationMs}`, vad: "längden", del: { durationMs: meta.durationMs } });
    if (meta.peaks) delar.push({ nyckel: `${id}:vag:${meta.peaks.length}`, vad: "vågen", del: { peaks: meta.peaks } });
    const att = delar.filter((d) => !sparatMeta.current.has(d.nyckel));
    att.forEach((d) => sparatMeta.current.add(d.nyckel));
    att.reduce(
      (foregaende, d) => foregaende.then(async () => {
        try {
          await cb({ id, ...d.del });
        } catch (e) {
          console.error(`OpsBibliotek: ${d.vad} kunde inte sparas på posten ${id}.`, e);
        }
      }),
      Promise.resolve(),
    );
  }
  const skaparTyp = jag ? skapar : null;
  const detalj = Boolean(skaparTyp || vald);

  /**
   * @param {import("../lib/bibliotek.js").Bibliotekspost & { id: string }} post
   * @param {"las" | "redigera"} lage
   */
  function oppnaMed(post, lage) {
    setStartLage(lage);
    onOppna(post);
  }

  /**
   * @param {{ typ?: string, url?: string, fil?: { sokvag?: string, mime?: string } }} post
   */
  function lankAttKopiera(post) {
    if (post.typ === "lank" && typeof post.url === "string" && ADRESSFORM.test(post.url)) return post.url;
    if (post.typ === "fil") {
      const lage = adressFor(post);
      if (lage.lage === "klar" && ADRESSFORM.test(lage.adress)) return lage.adress;
    }
    return "";
  }

  /**
   * @param {string} url
   */
  function kopieraLank(url) {
    const miss = () => setStatus(`Länken kunde inte kopieras. Adressen är ${url}`);
    try {
      const skriv = navigator.clipboard?.writeText;
      if (typeof skriv !== "function") {
        miss();
        return;
      }
      Promise.resolve(skriv.call(navigator.clipboard, url)).then(() => setStatus("Länken är kopierad.")).catch(() => miss());
    } catch {
      miss();
    }
  }

  /**
   * @param {string} id
   */
  function fragaRadera(id) {
    setRaderaFel("");
    setRaderar(id);
  }

  function korRadera() {
    if (!raderar) return;
    if (typeof onRadera !== "function") {
      setRaderaFel("Raderingen är inte kopplad. Posten är kvar.");
      return;
    }
    try {
      const svar = onRadera(raderar);
      if (svar && typeof svar.then === "function") {
        svar.then(() => setRaderar(null)).catch((e) => setRaderaFel(e instanceof Error ? e.message : String(e)));
        return;
      }
      setRaderar(null);
    } catch (e) {
      setRaderaFel(e instanceof Error ? e.message : String(e));
    }
  }

  /**
   * @param {import("../lib/bibliotek.js").Bibliotekspost & { id: string }} post
   */
  function borjaNamn(post) {
    setNamnFel("");
    setNamnUtkast(post.rubrik);
    setByter(post);
  }

  function sparaNamn() {
    if (!byter || namnSparar.current) return;
    const inmatning = byter.typ === "anteckning"
      ? { id: byter.id, typ: byter.typ, rubrik: namnUtkast, text: byter.text ?? "" }
      : byter.typ === "fil"
        ? { id: byter.id, typ: byter.typ, rubrik: namnUtkast, fil: byter.fil }
        : { id: byter.id, typ: byter.typ, rubrik: namnUtkast, url: byter.url ?? "" };
    const felNamn = inmatningsfel(inmatning);
    if (felNamn) {
      setNamnFel(felNamn);
      return;
    }
    setNamnFel("");
    // ⛔ Dialogen stängs först när sparandet gått igenom (0.93.0). Förut stängdes den direkt och ett avvisat löfte
    // försvann: namnet såg ut att vara bytt och var det inte.
    /** @param {unknown} e */
    const visa = (e) => setNamnFel(e instanceof Error && e.message ? e.message : String(e));
    let svar;
    try {
      svar = onSpara(inmatning);
    } catch (e) {
      visa(e);
      return;
    }
    if (svar === false) {
      setNamnFel("Namnet kunde inte sparas.");
      return;
    }
    if (svar && typeof svar === "object" && typeof svar.then === "function") {
      namnSparar.current = true;
      setNamnBusy(true);
      svar.then(
        (/** @type {void | boolean} */ v) => {
          namnSparar.current = false;
          setNamnBusy(false);
          if (v === false) setNamnFel("Namnet kunde inte sparas.");
          else setByter(null);
        },
        (/** @type {unknown} */ e) => {
          namnSparar.current = false;
          setNamnBusy(false);
          visa(e);
        },
      );
      return;
    }
    setByter(null);
  }

  /**
   * @param {import("../lib/bibliotek.js").Bibliotekspost & { id: string }} post
   * @param {boolean} iDetalj
   * @param {(lage: "redigera") => void} [sattRedigera]
   */
  function menyFor(post, iDetalj, sattRedigera) {
    const far = farAndra(post, jag);
    /** @type {import("./OpsAtgardsblad.jsx").Atgard[]} */
    const ut = [];
    if (!iDetalj) ut.push({ id: "oppna", etikett: "Öppna", onValj: () => oppnaMed(post, "las") });
    if (far) {
      ut.push({
        id: "redigera",
        etikett: "Redigera",
        onValj: () => (iDetalj && sattRedigera ? sattRedigera("redigera") : oppnaMed(post, "redigera")),
      });
      ut.push({ id: "namn", etikett: "Byt namn", onValj: () => borjaNamn(post) });
      // ⛔ TAGGAR I SAMMA MENY SOM BYT NAMN (lifehub.app#214, #226: långtrycket). Samma rätt som att ändra posten: författaren och admin.
      ut.push({ id: "taggar", etikett: "Taggar", onValj: () => setTaggar(post) });
    }
    const lank = lankAttKopiera(post);
    if (lank) ut.push({ id: "kopiera", etikett: "Kopiera länk", onValj: () => kopieraLank(lank) });
    if (arLjudpost(post)) {
      const id = post.id;
      ut.push(
        { id: "bakat", etikett: "10 sekunder bakåt", onValj: () => ljudStyrning(id)?.hoppa(-HOPP_SEKUNDER) },
        { id: "framat", etikett: "10 sekunder framåt", onValj: () => ljudStyrning(id)?.hoppa(HOPP_SEKUNDER) },
        { id: "hastighet", etikett: "Hastighet", onValj: () => ljudStyrning(id)?.bytHastighet() },
        { id: "ned", etikett: "Ladda ned", onValj: () => ljudStyrning(id)?.laddaNed() },
      );
    }
    if (far && grupper.length > 0 && typeof onDela === "function") {
      ut.push({ id: "dela", etikett: "Dela", onValj: () => setDelar(post) });
    }
    if (far) ut.push({ id: "radera", etikett: "Radera", fara: true, onValj: () => fragaRadera(post.id) });
    return ut;
  }

  /**
   * @param {import("../lib/bibliotek.js").Bibliotekspost & { id: string }} post
   */
  function svepFor(post) {
    if (!farAndra(post, jag)) return [];
    return [{
      id: "radera",
      etikett: "Radera",
      fara: true,
      angraMeddelande: `${arLjudpost(post) ? ljudRubrik(post) : post.rubrik} tas bort.`,
      onValj: () => {
        if (typeof onRadera !== "function") throw new Error("Raderingen är inte kopplad. Posten är kvar.");
        return onRadera(post.id);
      },
    }];
  }

  const antal = {
    alla: poster.length,
    anteckning: poster.filter((p) => p.typ === "anteckning").length,
    lank: poster.filter((p) => p.typ === "lank").length,
    ljud: poster.filter((p) => arLjudpost(p)).length,
    fil: poster.filter((p) => p.typ === "fil" && !arLjudpost(p)).length,
  };
  // ⛔ GRUPPENS TAGGAR RÄKNAS UR POSTERNA (regel 2). Ett val på en tagg som inte längre finns (sista posten raderad eller omtaggad)
  // faller bort, annars hade listan stått tom med ett filter ingen kan se eller ta bort.
  const gruppensTaggar = allaTaggar(poster);
  const valda = valdaTaggar.filter((t) => gruppensTaggar.some((g) => g.tagg === t));
  const synliga = filtreraBibliotek(poster, { flik, sok, taggar: valda });
  const installningar = Boolean(ram && modul && arInstallningslage(/** @type {string} */ (activeHref)));
  if (installningar && modul) {
    return (
      <OpsModulRam modul={modul} activeHref={/** @type {string} */ (activeHref)} hubHref={hubHref} hubEtikett={hubEtikett} onNavigate={onNavigate} sprak={sprak} ram={ram}>
        {null}
      </OpsModulRam>
    );
  }
  const visaKnapp = Boolean(ram && ram.farAndra);
  const listTillbaka = {
    ...modulTillbaka({ namn: "Bibliotek", hubHref, hubEtikett, onNavigate, sprak, modulId }),
    ...(visaKnapp ? { atgard: <ModulLageKnapp ram={ram} activeHref={/** @type {string} */ (activeHref)} onNavigate={onNavigate} sprak={sprak} installningar={false} /> } : {}),
  };

  // ⛔ DETALJEN HAR SIN EGEN TILLBAKA, TILL LISTAN. Två "Tillbaka" på samma sida, en till hubben och en till listan, hade
  // lämnat läsaren att gissa vilken som är vilken. Knappen är `TillbakaKnapp`, inte en egen spökknapp.
  // Inställningsläget vinner över detaljen: länken från arket öppnar inställningarna, inte posten.
  return (
    <OpsView tillbaka={detalj ? undefined : listTillbaka}>
      <div data-bibliotek="" className="flex min-w-0 w-full flex-col gap-4">
        {detalj ? (
          <Detalj key={`${skaparTyp ?? ""}:${vald?.id ?? ""}:${startLage}`} post={vald ? medFyll(vald) : null} skapar={skaparTyp} jag={jag} startLage={startLage} onStang={onStang} onSpara={onSpara} onLaddaUpp={onLaddaUpp} filUrl={filUrl} adressFor={adressFor} onLjus={setLjus} onSkrivUt={onSkrivUt} onGorForslag={onGorForslag} menyFor={menyFor} onMeta={togMeta} />
        ) : (
          <OpsTabs
            ariaLabel="Typ i biblioteket"
            medOrd
            value={flik}
            onChange={(v) => setFlik(/** @type {typeof flik} */ (v))}
            tabs={[
              { id: "alla", label: "Alla", icon: <Library size={16} />, badge: antal.alla },
              { id: "anteckning", label: "Anteckningar", icon: <StickyNote size={16} />, badge: antal.anteckning },
              { id: "lank", label: "Länkar", icon: <Link size={16} />, badge: antal.lank },
              { id: "ljud", label: "Ljud", icon: <Music size={16} />, badge: antal.ljud },
              { id: "fil", label: "Filer", icon: <FileText size={16} />, badge: antal.fil },
            ]}
          >
            <OpsTabPanel id={flik}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <OpsInput value={sok} onChange={setSok} type="search" ariaLabel="Sök i biblioteket" placeholder="Sök i rubrik, text eller adress" />
                    </div>
                    {jag ? (
                      <NyKnapp
                        flik={flik}
                        onSkapa={onSkapa}
                        onRost={() => {
                          try {
                            setRostFel("");
                            oppnaRost(oppnaInspelning, modulId);
                          } catch (e) {
                            setRostFel(e instanceof Error ? e.message : String(e));
                          }
                        }}
                      />
                    ) : null}
                  </div>
                  {rostFel ? <p role="alert">{rostFel}</p> : null}
                  {gruppensTaggar.length > 0 ? (
                    <div role="group" aria-label="Taggar" data-bibliotek-taggfilter="" className="flex flex-wrap gap-2">
                      {gruppensTaggar.map(({ tagg, antal: n }) => {
                        const pa = valda.includes(tagg);
                        return (
                          <OpsChip key={tagg} selected={pa} onClick={() => setValdaTaggar(pa ? valda.filter((t) => t !== tagg) : [...valda, tagg])}>
                            {`#${tagg} ${n}`}
                          </OpsChip>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                {trasiga.length > 0 ? (
                  <div role="status" data-bibliotek-trasiga={trasiga.length} className="text-meta text-ink-muted">
                    <p>{trasiga.length === 1 ? "1 post kunde inte läsas och visas inte." : `${trasiga.length} poster kunde inte läsas och visas inte.`}</p>
                    <ul>
                      {trasiga.map((t) => (
                        <li key={t.id} className="flex flex-col gap-2">
                          <span>{t.id}: {t.fel}</span>
                          {farAndra({ groupId: t.groupId, skapadAv: t.skapadAv }, jag) ? (
                            <OpsButton variant="secondary" size="sm" ariaLabel={`Radera ${t.id}`} onClick={() => fragaRadera(t.id)}>Radera</OpsButton>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {fel ? (
                  <p role="alert" data-bibliotek-fel="">{fel}</p>
                ) : laddar ? (
                  <OpsEmpty busy title="Hämtar biblioteket" />
                ) : synliga.length === 0 ? (
                  <OpsEmpty
                    icon={sok || valda.length > 0 ? null : <Library size={28} />}
                    title={sok || valda.length > 0 ? "Inga träffar." : poster.length === 0 ? "Biblioteket är tomt." : flik === "anteckning" ? "Inga anteckningar ännu." : flik === "lank" ? "Inga länkar ännu." : flik === "ljud" ? "Inga ljud ännu." : "Inga filer ännu."}
                    description={sok ? `Inget matchar "${sok}"${valda.length > 0 ? ` med ${valda.map((t) => `#${t}`).join(" och ")}` : ""}.` : valda.length > 0 ? `Inget här har ${valda.map((t) => `#${t}`).join(" och ")}.` : "Lägg till en anteckning, en länk, ett ljud eller en fil."}
                  />
                ) : (
                  <OpsList ariaLabel="Biblioteket" divided>
                    {synliga.map((rad) => {
                      const post = medFyll(rad);
                      const ljud = arLjudpost(post);
                      const bild = post.typ === "fil" && filSort(post.fil?.mime) === "bild";
                      const lage = adressFor(post);
                      const meny = menyFor(rad, false);
                      if (ljud) {
                        return (
                          <OpsSvepRad key={post.id} atgarder={svepFor(rad)}>
                            <BibliotekListrad namn={ljudRubrik(post)} meny={meny}>
                              <Ljudrad post={post} lage={lage} onOppna={() => oppnaMed(rad, "las")} onMeta={togMeta} />
                            </BibliotekListrad>
                          </OpsSvepRad>
                        );
                      }
                      const namn = trimSomRegeln(post.rubrik) || "Post";
                      return (
                        <OpsSvepRad key={post.id} atgarder={svepFor(post)}>
                          <BibliotekListrad
                            namn={namn}
                            meny={meny}
                            ikon={<PostMark post={post} bildAdress={bild && lage.lage === "klar" ? lage.adress : ""} />}
                            meta={medTaggar(postRad(post), post)}
                            onOppna={() => oppnaMed(post, "las")}
                          />
                        </OpsSvepRad>
                      );
                    })}
                  </OpsList>
                )}
                {status ? <p role="status">{status}</p> : null}
              </div>
            </OpsTabPanel>
          </OpsTabs>
        )}
        {ljus ? (
          <div role="dialog" aria-label="Förhandsvisning" data-bibliotek-ljus="" className="flex flex-col gap-2">
            <img src={ljus} alt="" />
            <OpsButton variant="secondary" onClick={() => setLjus("")}>Stäng</OpsButton>
          </div>
        ) : null}
      </div>
      <OpsModal
        open={raderar !== null}
        onOpenChange={(oppen) => {
          if (!oppen) {
            setRaderar(null);
            setRaderaFel("");
          }
        }}
        title="Radera"
        size="sm"
        footer={(
          <>
            <OpsButton variant="secondary" onClick={() => { setRaderar(null); setRaderaFel(""); }}>Avbryt</OpsButton>
            <OpsButton variant="danger" onClick={korRadera}>Radera posten</OpsButton>
          </>
        )}
      >
        <p>Radera posten? Den går inte att ångra.</p>
        {raderaFel ? <p role="alert">{raderaFel}</p> : null}
      </OpsModal>
      <OpsModal
        open={byter !== null}
        onOpenChange={(oppen) => { if (!oppen) setByter(null); }}
        title="Byt namn"
        size="sm"
        footer={(
          <>
            <OpsButton variant="secondary" onClick={() => setByter(null)}>Avbryt</OpsButton>
            <OpsButton variant="primary" onClick={sparaNamn} busy={namnBusy}>Spara</OpsButton>
          </>
        )}
      >
        <OpsField label="Rubrik" error={namnFel || undefined}>
          <OpsInput value={namnUtkast} onChange={setNamnUtkast} ariaLabel="Nytt namn" />
        </OpsField>
      </OpsModal>
      <OpsModal
        open={taggar !== null}
        onOpenChange={(oppen) => { if (!oppen) setTaggar(null); }}
        title="Taggar"
        size="sm"
      >
        {taggar ? <TaggRedigerare key={taggar.id} post={taggar} forslag={gruppensTaggar.map((g) => g.tagg)} onSpara={onSpara} onKlar={() => setTaggar(null)} /> : <p>Ingen post vald.</p>}
      </OpsModal>
      <OpsModal
        open={delar !== null}
        onOpenChange={(oppen) => { if (!oppen) setDelar(null); }}
        title="Dela"
        size="sm"
      >
        {delar ? <DelaKontroll id={delar.id} grupper={grupper} onDela={onDela} /> : <p>Ingen post vald.</p>}
      </OpsModal>
    </OpsView>
  );
}

const TYPNAMN = /** @type {const} */ ({ anteckning: "Anteckning", lank: "Länk", fil: "Fil" });
const NYTT_NAMN = /** @type {const} */ ({ anteckning: "Ny anteckning", lank: "Ny länk", fil: "Ny fil", ljud: "Ny röstinspelning" });

/**
 * @param {number | undefined} byte
 * @returns {string}
 */
function filStorlek(byte) {
  if (!Number.isInteger(byte) || /** @type {number} */ (byte) < 0) return "";
  if (/** @type {number} */ (byte) < 1024) return `${byte} B`;
  if (/** @type {number} */ (byte) < 1024 * 1024) return `${Math.round(/** @type {number} */ (byte) / 1024)} kB`;
  return `${(/** @type {number} */ (byte) / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {{ typ?: string, text?: string, url?: string, fil?: { namn?: string, mime?: string, byte?: number, sokvag?: string } }} post
 * @param {((post: { fil?: { sokvag?: string } }) => string) | undefined} filUrl
 * @returns {string}
 */
function postAdress(post, filUrl) {
  if ((post.typ != null && post.typ !== "fil") || typeof filUrl !== "function") return "";
  const adress = filUrl(post);
  return typeof adress === "string" ? adress : "";
}

/**
 * @typedef {{ lage: "klar" | "hamtar" | "fel" | "saknas", adress: string, fel: string }} Adresslage
 */

/**
 * Synkron `filUrl` vinner. Annars sökvägens cachade svar, ett pågående anrop, eller att adressen saknas.
 *
 * @param {{ typ?: string, fil?: { sokvag?: string } }} post
 * @param {((post: { fil?: { sokvag?: string } }) => string) | undefined} filUrl
 * @param {((sokvag: string) => Promise<string>) | undefined} hamtaAdress
 * @param {{ klar: Record<string, string>, fel: Record<string, string> }} cache
 * @returns {Adresslage}
 */
function losAdress(post, filUrl, hamtaAdress, cache) {
  const synk = postAdress(post, filUrl);
  if (synk) return { lage: "klar", adress: synk, fel: "" };
  const sokvag = typeof post?.fil?.sokvag === "string" ? post.fil.sokvag.trim() : "";
  if (!sokvag || typeof hamtaAdress !== "function") return { lage: "saknas", adress: "", fel: "" };
  if (cache.klar[sokvag]) return { lage: "klar", adress: cache.klar[sokvag], fel: "" };
  if (cache.fel[sokvag]) return { lage: "fel", adress: "", fel: cache.fel[sokvag] };
  return { lage: "hamtar", adress: "", fel: "" };
}

/**
 * Hämtar nedladdningsadresser en gång per sökväg. `filUrl` som redan svarar med en adress hoppas över.
 *
 * @param {readonly { id?: string, typ?: string, fil?: { sokvag?: string } }[]} poster
 * @param {{ id?: string, typ?: string, fil?: { sokvag?: string } } | null} vald
 * @param {((post: { fil?: { sokvag?: string } }) => string) | undefined} filUrl
 * @param {((sokvag: string) => Promise<string>) | undefined} hamtaAdress
 */
function useFilAdresser(poster, vald, filUrl, hamtaAdress) {
  const [klar, setKlar] = useState(/** @type {Record<string, string>} */ ({}));
  const [fel, setFel] = useState(/** @type {Record<string, string>} */ ({}));
  const klarRef = useRef(klar);
  const felRef = useRef(fel);
  const pagaende = useRef(/** @type {Set<string>} */ (new Set()));
  const hamtaRef = useRef(hamtaAdress);
  klarRef.current = klar;
  felRef.current = fel;
  hamtaRef.current = hamtaAdress;
  const harHamta = typeof hamtaAdress === "function";
  const underlag = vald && !poster.some((p) => p === vald || (p.id && p.id === vald.id)) ? [...poster, vald] : poster;
  const nyckel = underlag
    .map((post) => {
      if (postAdress(post, filUrl)) return "";
      const s = post?.typ === "fil" && typeof post.fil?.sokvag === "string" ? post.fil.sokvag.trim() : "";
      return s;
    })
    .filter(Boolean)
    .join("\n");

  useEffect(() => {
    if (!harHamta || !nyckel) return undefined;
    const hamta = hamtaRef.current;
    if (typeof hamta !== "function") return undefined;
    let kvar = true;
    const lista = nyckel.split("\n").filter((s) => !klarRef.current[s] && !felRef.current[s] && !pagaende.current.has(s));
    if (lista.length === 0) return undefined;
    for (const s of lista) pagaende.current.add(s);
    for (const s of lista) {
      Promise.resolve()
        .then(() => hamta(s))
        .then((url) => {
          if (!kvar) return;
          if (typeof url !== "string" || url === "") {
            setFel((f) => ({ ...f, [s]: "Filen har ingen adress." }));
            return;
          }
          setKlar((c) => ({ ...c, [s]: url }));
        })
        .catch((e) => {
          if (!kvar) return;
          const text = e instanceof Error && e.message ? e.message : "Filen har ingen adress.";
          setFel((f) => ({ ...f, [s]: text }));
        })
        .finally(() => {
          pagaende.current.delete(s);
        });
    }
    return () => {
      kvar = false;
      for (const s of lista) pagaende.current.delete(s);
    };
  }, [nyckel, harHamta]);

  return { klar, fel };
}

/**
 * @param {{ post: { typ: string, fil?: { mime?: string, sokvag?: string } }, filUrl?: (post: { fil?: { sokvag?: string } }) => string }} props
 */
function PostIkon({ post }) {
  if (post.typ === "fil") {
    const sort = filSort(post.fil?.mime);
    if (sort === "bild") return <BildIkon size={20} />;
    if (sort === "ljud") return <Music size={20} />;
    return <FileText size={20} />;
  }
  if (post.typ === "lank") return <Link size={20} />;
  return <StickyNote size={20} />;
}

/**
 * @param {{ typ: string, text?: string, url?: string, fil?: { namn?: string, mime?: string, byte?: number } }} post
 */
function postRad(post) {
  const typ = arLjudpost(post) ? "Ljud" : post.typ === "anteckning" || post.typ === "lank" || post.typ === "fil" ? TYPNAMN[post.typ] : "";
  let rest = "";
  if (post.typ === "anteckning") rest = (post.text ?? "").replace(/\s+/g, " ").trim();
  else if (post.typ === "lank") rest = post.url ?? "";
  else {
    const namn = post.fil?.namn ?? "";
    const storlek = filStorlek(post.fil?.byte);
    rest = storlek ? `${namn} · ${storlek}` : namn;
  }
  if (rest.length > 80) rest = `${rest.slice(0, 77)}...`;
  return rest ? `${typ} · ${rest}` : typ;
}

/**
 * Datum och längd på en ljudrad. Längden utelämnas när den inte är räknad:
 * "0:00" vore ett påstående om att ljudet är tomt.
 *
 * @param {{ skapad?: number, durationMs?: number }} post
 * @returns {string}
 */
function ljudMetaRad(post) {
  const datum = ljudDatum(post?.skapad);
  const ms = post?.durationMs;
  const langd = Number.isInteger(ms) && /** @type {number} */ (ms) > 0 ? formateraTid(/** @type {number} */ (ms) / 1000) : "";
  if (datum && langd) return `${datum} · ${langd}`;
  return datum || langd;
}

/**
 * Metaraden med postens taggar efter: "Anteckning · 2 okt · #kvitto · #bil". Taggarna står i texten och inte bara som färg, så de
 * hörs i skärmläsaren och syns i en smal rad.
 *
 * @param {string} meta @param {{ taggar?: readonly string[] }} post
 */
function medTaggar(meta, post) {
  const t = Array.isArray(post.taggar) ? post.taggar.map((x) => `#${x}`) : [];
  return [meta, ...t].filter(Boolean).join(" · ");
}

/**
 * Taggarna på en post: de som finns, med en knapp per tagg som tar bort den, ett fält som lägger till, och gruppens andra taggar
 * som förslag. Sparar genom samma `onSpara` som Byt namn, med bara `taggar` ändrat.
 *
 * ⛔ FELET STÅR I RUTAN OCH RUTAN STÅR KVAR (samma som Byt namn sedan 0.93.0): en tagg som inte går att spara, eller ett sparande som
 * föll, får aldrig se ut som att det gick.
 *
 * @param {{ post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }, forslag: readonly string[], onSpara?: (inmatning: { id?: string, typ?: string, rubrik?: string, taggar?: string[] }) => void | boolean | Promise<void | boolean>, onKlar: () => void }} props
 */
function TaggRedigerare({ post, forslag, onSpara, onKlar }) {
  const [lista, setLista] = useState(/** @type {string[]} */ (Array.isArray(post.taggar) ? [...post.taggar] : []));
  const [utkast, setUtkast] = useState("");
  const [fel, setFel] = useState("");
  const [sparar, setSparar] = useState(false);
  const lagg = (/** @type {string} */ ord) => {
    const ny = normaliseraTaggar([...lista, ...ord.split(",")]);
    const problem = taggarFel(ny);
    if (problem) {
      setFel(problem);
      return false;
    }
    setFel("");
    setLista(ny);
    setUtkast("");
    return true;
  };
  const spara = async () => {
    let ny = lista;
    if (normaliseraTagg(utkast)) {
      ny = normaliseraTaggar([...lista, ...utkast.split(",")]);
      const problem = taggarFel(ny);
      if (problem) {
        setFel(problem);
        return;
      }
    }
    if (typeof onSpara !== "function") {
      setFel("Sparandet är inte kopplat. Taggarna ändrades inte.");
      return;
    }
    setSparar(true);
    try {
      const svar = await onSpara({ id: post.id, taggar: ny });
      if (svar === false) throw new Error("Taggarna kunde inte sparas.");
      onKlar();
    } catch (e) {
      setFel(e instanceof Error && e.message ? e.message : String(e));
    } finally {
      setSparar(false);
    }
  };
  const ovriga = forslag.filter((t) => !lista.includes(t));
  return (
    <div className="flex flex-col gap-4" data-bibliotek-taggruta="">
      {lista.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {lista.map((t) => <OpsTag key={t} label={`#${t}`} onRemove={() => setLista(lista.filter((x) => x !== t))} removeLabel={`Ta bort taggen ${t}`} />)}
        </div>
      ) : (
        <p className="m-0 text-meta text-ink-muted">Posten har inga taggar.</p>
      )}
      {/* ⛔ ETT FORMULÄR OCH INTE EN TANGENTHANTERARE: `OpsInput` tar medvetet ingen `onKeyDown` (stängt API), och Enter i ett fält
          skickar formuläret i varje webbläsare. Enter lägger alltså till taggen, och Spara nedan sparar. */}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (normaliseraTagg(utkast)) lagg(utkast);
        }}
      >
        <div className="min-w-0 flex-1">
          <OpsField label="Ny tagg" hint={`Högst ${MAX_TAGGAR}. Skriv och tryck Lägg till, eller skilj flera med komma.`}>
            <OpsInput value={utkast} onChange={setUtkast} ariaLabel="Ny tagg" placeholder="till exempel kvitto" />
          </OpsField>
        </div>
        <OpsButton type="submit" variant="secondary" disabled={!normaliseraTagg(utkast)}>Lägg till</OpsButton>
      </form>
      {ovriga.length > 0 ? (
        <div role="group" aria-label="Gruppens taggar" className="flex flex-wrap gap-2">
          {ovriga.map((t) => <OpsChip key={t} onClick={() => lagg(t)}>{`#${t}`}</OpsChip>)}
        </div>
      ) : null}
      {fel ? <p role="alert" className="m-0 text-meta text-danger">{fel}</p> : null}
      <div className="flex justify-end gap-2">
        <OpsButton variant="secondary" onClick={onKlar}>Avbryt</OpsButton>
        <OpsButton variant="primary" busy={sparar} onClick={spara}>Spara</OpsButton>
      </div>
    </div>
  );
}

/**
 * Gemensam listrad: ⋯ via `OpsAtgardsblad`, och antingen standardrad (ikon,
 * rubrik, meta) eller eget innehåll (ljudraden med spelare). Svepet sitter utanför.
 *
 * @param {{ namn: string, meny: import("./OpsAtgardsblad.jsx").Atgard[], ikon?: import("react").ReactNode, meta?: string, onOppna?: () => void, children?: import("react").ReactNode }} props
 */
function BibliotekListrad({ namn, meny, ikon = null, meta = "", onOppna, children = null }) {
  return (
    <OpsAtgardsblad namn={namn} poster={meny}>
      {children ?? (
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 bg-transparent text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          onClick={onOppna}
          aria-label={namn}
        >
          {ikon}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-brod font-medium text-ink">{namn}</span>
            {meta ? <span className="block truncate text-meta text-ink-muted">{meta}</span> : null}
          </span>
        </button>
      )}
    </OpsAtgardsblad>
  );
}

/**
 * Listans ljudinnehåll: ett element till vänster (spela), rubrik, datum och längd, våg.
 * Ikonen ritas inte här. Den och spelknappen på samma rad är det som överlappade.
 * ⋯ och svep kommer från `BibliotekListrad` / `OpsSvepRad`, samma som övriga typer.
 *
 * @param {{ post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }, lage: Adresslage, onOppna: () => void, onMeta: (id: string, meta: { durationMs?: number, peaks?: string }) => void }} props
 */
function Ljudrad({ post, lage, onOppna, onMeta }) {
  const rubrik = ljudRubrik(post);
  const meta = ljudMetaRad(post);
  const taggrad = medTaggar("", post);
  const text = (
    <button
      type="button"
      onClick={onOppna}
      aria-label={rubrik}
      className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center bg-transparent text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <span className="block truncate text-brod font-medium text-ink">{rubrik}</span>
      {meta ? <span data-ljud-langd="" className="block truncate text-meta text-ink-muted">{meta}</span> : null}
    </button>
  );
  return (
    <div data-bibliotek-ljudrad="" className="flex min-w-0 w-full flex-1 flex-col gap-1">
      {lage.lage === "klar" ? (
        <OpsLjudspelare
          kompakt
          src={lage.adress}
          namn={rubrik}
          meta={meta}
          durationMs={post.durationMs}
          peaks={post.peaks}
          styrId={post.id}
          onOppna={onOppna}
          onMeta={(inmata) => onMeta(post.id, inmata)}
        />
      ) : null}
      {taggrad ? <span data-bibliotek-taggar="" className="block truncate text-meta text-ink-muted">{taggrad}</span> : null}
      {lage.lage === "klar" ? null : (
        <>
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-muted" aria-hidden="true" />
            {text}
          </div>
          {lage.lage === "hamtar" ? (
            <p role="status" className="m-0 text-meta text-ink-secondary">Hämtar ljudet.</p>
          ) : (
            <p role={lage.lage === "fel" ? "alert" : "status"} className="m-0 text-meta text-danger">{lage.fel || "Filen har ingen adress."}</p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Ikonen i en ruta, samma på listan och i detaljen. En bild fyller rutan.
 * SessionStudios rad är ikon, rubrik och en metarad. Synlighet per post ritas inte.
 *
 * @param {{ post: { typ: string, fil?: { mime?: string, sokvag?: string } }, bildAdress?: string }} props
 */
function PostMark({ post, bildAdress = "" }) {
  const bild = post.typ === "fil" && filSort(post.fil?.mime) === "bild";
  const adress = bild ? bildAdress : "";
  return (
    <span data-bibliotek-ikon={post.typ} className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-raised text-ink-secondary" aria-hidden="true">
      {adress ? <img src={adress} alt="" className="size-10 object-cover" /> : <PostIkon post={post} />}
    </span>
  );
}

/**
 * "+ Ny" bredvid sökfältet. Under Alla ett val mellan typerna, under en typ den typen direkt.
 *
 * ⛔ AVTRYCKAREN ÄR INTE EN `OpsButton` MEN SER UT SOM EN (`knappKlass`): Radix `Popover.Trigger` ritar sitt eget
 * `<button>`, och `OpsButton` har ingen `forwardRef`. Samma skäl som plusset i `OpsAppShell`.
 *
 * Röstinspelning ligger i menyn under Alla (0.90.8). Den öppnar skalets inspelare, inte en rad i listan.
 *
 * @param {{ flik: "alla" | "anteckning" | "lank" | "ljud" | "fil", onSkapa: (typ: "anteckning" | "lank" | "fil") => void, onRost: () => void }} props
 */
function NyKnapp({ flik, onSkapa, onRost }) {
  const [oppen, setOppen] = useState(false);
  const innehall = (
    <>
      <Plus size={16} aria-hidden="true" />
      <span>Ny</span>
    </>
  );
  if (flik === "ljud") {
    return (
      <button type="button" aria-label={NYTT_NAMN.ljud} onClick={onRost} className={cx(knappKlass(), "shrink-0 cursor-pointer")}>
        {innehall}
      </button>
    );
  }
  if (flik !== "alla") {
    return (
      <button type="button" aria-label={NYTT_NAMN[flik]} onClick={() => onSkapa(flik)} className={cx(knappKlass(), "shrink-0 cursor-pointer")}>
        {innehall}
      </button>
    );
  }
  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger aria-label="Ny post" aria-haspopup="menu" className={cx(knappKlass(), "shrink-0 cursor-pointer")}>
        {innehall}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className={cx("z-(--z-dropdown) min-w-44 p-1", radBehallare())}>
          <div role="menu" aria-label="Ny post">
            {BIBLIOTEKTYPER.map((typ) => (
              <button
                key={typ}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOppen(false);
                  onSkapa(typ);
                }}
                className={radKlass({ stor: true })}
              >
                <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-4">
                  {typ === "anteckning" ? <StickyNote size={16} /> : typ === "lank" ? <Link size={16} /> : <FileText size={16} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{TYPNAMN[typ]}</span>
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOppen(false);
                onRost();
              }}
              className={radKlass({ stor: true })}
            >
              <span aria-hidden="true" className="flex shrink-0 items-center text-ink-secondary [&_svg]:size-4">
                <Music size={16} />
              </span>
              <span className="min-w-0 flex-1 truncate">Röstinspelning</span>
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Bild öppnas i förhandsvisning. PDF och övrigt i ny flik. Utan adress sägs det.
 *
 * @param {{ post: { id?: string, typ?: string, rubrik?: string, skapad?: number, durationMs?: number, peaks?: string, fil?: { namn?: string, mime?: string, byte?: number, sokvag?: string } }, lage: Adresslage, kopplad: boolean, onLjus?: (adress: string) => void, onMeta?: (id: string, meta: { durationMs?: number, peaks?: string }) => void }} props
 */
function FilVisning({ post, lage, kopplad, onLjus, onMeta }) {
  const sort = filSort(post.fil?.mime);
  const namn = post.fil?.namn ?? "Fil";
  const rad = `${namn}${filStorlek(post.fil?.byte) ? ` · ${filStorlek(post.fil?.byte)}` : ""}`;
  if (lage.lage === "hamtar") {
    return <p role="status" data-bibliotek-fil="">Hämtar filen.</p>;
  }
  if (lage.lage !== "klar") {
    const text = lage.fel || (kopplad ? `Filen har ingen adress. ${rad}` : rad);
    return (
      <p role={lage.fel ? "alert" : "status"} data-bibliotek-fil="">
        {text}
      </p>
    );
  }
  const adress = lage.adress;
  if (sort === "bild") {
    return (
      <button type="button" aria-label={`Förhandsvisa ${post.rubrik ?? namn}`} data-bibliotek-forhands="" onClick={() => onLjus?.(adress)} className="w-fit">
        <img src={adress} alt={post.rubrik ?? namn} className="max-h-48 rounded-sm object-contain" />
      </button>
    );
  }
  if (sort === "ljud") {
    const rubrik = ljudRubrik(post);
    const id = post.id || "";
    return (
      <OpsLjudspelare
        src={adress}
        namn={rubrik}
        visaNamn={false}
        durationMs={post.durationMs}
        peaks={post.peaks}
        styrId={id}
        onMeta={id && onMeta ? (meta) => onMeta(id, meta) : undefined}
      />
    );
  }
  return (
    <a href={adress} target="_blank" rel="noopener noreferrer" data-bibliotek-fil="" className="text-brod text-accent underline underline-offset-2">
      {rad}
    </a>
  );
}

/**
 * En adress som går att öppna, eller texten när den inte klarar `ADRESSFORM`.
 *
 * @param {{ url: string }} props
 */
function Adress({ url }) {
  if (!ADRESSFORM.test(url)) return <p className="text-brod text-ink break-all">{url}</p>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-bibliotek-lank=""
      className="block break-all rounded-sm text-brod text-accent underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {url}
    </a>
  );
}

/**
 * @param {object} props
 * @param {(import("../lib/bibliotek.js").Bibliotekspost & { id: string }) | null} props.post
 * @param {"anteckning" | "lank" | "fil" | null} props.skapar
 * @param {{ uid: string, roll: string, groupId?: string } | null} props.jag
 * @param {"las" | "redigera"} props.startLage
 * @param {() => void} props.onStang
 * @param {(inmatning: { id?: string, typ: string, rubrik: string, text?: string, url?: string, fil?: { sokvag: string, namn: string, mime: string, byte: number } }) => void | boolean | Promise<void | boolean>} props.onSpara Kastar den eller avvisas löftet visas felet i formuläret och läget står kvar (0.93.0). `false` betyder att det inte gick.
 * @param {(inmatning: { id?: string, rubrik: string, fil: File }) => void | Promise<void>} [props.onLaddaUpp]
 * @param {(post: { fil?: { sokvag?: string } }) => string} [props.filUrl]
 * @param {(post: { typ?: string, fil?: { sokvag?: string, mime?: string } }) => Adresslage} [props.adressFor]
 * @param {(adress: string) => void} [props.onLjus]
 * @param {(post: { id: string }) => { text: string, forslag?: "anteckning" | "arende" } | Promise<{ text: string, forslag?: "anteckning" | "arende" }>} [props.onSkrivUt]
 * @param {(inmatning: { id: string, satt: "anteckning" | "arende" }) => void | Promise<void>} [props.onGorForslag]
 * @param {(post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }, iDetalj: boolean, sattRedigera?: (lage: "redigera") => void) => import("./OpsAtgardsblad.jsx").Atgard[]} props.menyFor
 * @param {(id: string, meta: { durationMs?: number, peaks?: string }) => void} [props.onMeta]
 */
function Detalj({ post, skapar, jag, startLage, onStang, onSpara, onLaddaUpp, filUrl, adressFor, onLjus, onSkrivUt, onGorForslag, menyFor, onMeta }) {
  const typ = skapar ?? post?.typ ?? "anteckning";
  const [rubrik, setRubrik] = useState(post && !skapar ? post.rubrik : "");
  const [text, setText] = useState(post && !skapar && post.typ === "anteckning" ? post.text ?? "" : "");
  const [url, setUrl] = useState(post && !skapar && post.typ === "lank" ? post.url ?? "" : "");
  const [formfel, setFormfel] = useState("");
  const [valdFil, setValdFil] = useState(/** @type {File | null} */ (null));
  const filFalt = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [lage, setLage] = useState(/** @type {"las" | "redigera"} */ (skapar ? "redigera" : startLage));
  const nyckel = `${skapar ?? ""}:${post?.id ?? ""}`;

  useEffect(() => {
    setRubrik(post && !skapar ? post.rubrik : "");
    setText(post && !skapar && post.typ === "anteckning" ? post.text ?? "" : "");
    setUrl(post && !skapar && post.typ === "lank" ? post.url ?? "" : "");
    setFormfel("");
    setValdFil(null);
    // Nyckeln är beroendet: en ny lista med samma post ska inte tömma ett halvskrivet formulär.
  }, [nyckel]);

  const kan = Boolean(!skapar && post && farAndra(post, jag));
  const ljud = Boolean(post && post.typ === "fil" && filSort(post.fil?.mime) === "ljud");
  const rubrikVy = skapar ? (typ === "anteckning" ? "Ny anteckning" : typ === "lank" ? "Ny länk" : "Ny fil") : ljud && post ? ljudRubrik(post) : post?.rubrik ?? "Post";
  const tomLage = /** @type {Adresslage} */ ({ lage: "saknas", adress: "", fel: "" });
  const filLage = post && typeof adressFor === "function" ? adressFor({ typ: post.typ, fil: post.fil }) : tomLage;
  const kopplad = typeof filUrl === "function" || filLage.lage !== "saknas";
  const mark = <PostMark post={{ typ, fil: post?.fil }} bildAdress={filLage.lage === "klar" ? filLage.adress : ""} />;

  function aterstall() {
    setRubrik(post && !skapar ? post.rubrik : "");
    setText(post && !skapar && post.typ === "anteckning" ? post.text ?? "" : "");
    setUrl(post && !skapar && post.typ === "lank" ? post.url ?? "" : "");
    setFormfel("");
    setValdFil(null);
  }

  /** @returns {boolean | void | Promise<void | boolean>} */
  function forsokSpara() {
    if (typ === "fil" && (valdFil || skapar)) {
      if (!valdFil) {
        setFormfel("Välj en fil.");
        return false;
      }
      if (!trimSomRegeln(rubrik)) {
        setFormfel("Rubriken saknas.");
        return false;
      }
      if (typeof onLaddaUpp !== "function") {
        setFormfel("Uppladdningen är inte kopplad. Filen är kvar på enheten.");
        return false;
      }
      let svar;
      try {
        svar = onLaddaUpp({ rubrik, fil: valdFil, ...(post && !skapar ? { id: post.id } : {}) });
      } catch (e) {
        setFormfel(e instanceof Error ? e.message : String(e));
        return false;
      }
      if (svar && typeof svar.then === "function") {
        return svar.catch((e) => {
          setFormfel(e instanceof Error ? e.message : String(e));
          return false;
        });
      }
      return;
    }
    const inmatning = typ === "anteckning"
      ? { typ, rubrik, text, ...(post && !skapar ? { id: post.id } : {}) }
      : typ === "fil"
        ? { typ, rubrik, fil: post?.fil, ...(post && !skapar ? { id: post.id } : {}) }
        : { typ, rubrik, url: normaliseraAdress(url), ...(post && !skapar ? { id: post.id } : {}) };
    const fel = inmatningsfel(inmatning);
    if (fel) {
      setFormfel(fel);
      return false;
    }
    setFormfel("");
    // ⛔ LÖFTET LÄMNAS TILLBAKA (0.93.0), som filgrenen gör. `OpsDokument` stannar då i redigering tills sparandet gått igenom, och ett
    // avvisat löfte blir ett fel i formuläret. Förut kastades svaret bort: formuläret gick till läsning och felet försvann.
    /** @param {unknown} e */
    const visa = (e) => setFormfel(e instanceof Error && e.message ? e.message : String(e));
    let svar;
    try {
      svar = onSpara(inmatning);
    } catch (e) {
      visa(e);
      return false;
    }
    if (svar && typeof svar === "object" && typeof svar.then === "function") {
      return svar.then(
        (/** @type {void | boolean} */ v) => {
          if (v === false) setFormfel("Posten kunde inte sparas.");
          return v;
        },
        (/** @type {unknown} */ e) => {
          visa(e);
          return false;
        },
      );
    }
    if (svar === false) {
      setFormfel("Posten kunde inte sparas.");
      return false;
    }
    return undefined;
  }

  const lasning = typ === "anteckning" ? (
    post?.text ? <OpsMarkdown text={post.text} dokument /> : <p className="text-brod text-ink">Anteckningen har ingen text.</p>
  ) : typ === "fil" && post ? (
    <FilVisning post={post} lage={filLage} kopplad={kopplad} onLjus={onLjus} onMeta={onMeta} />
  ) : (
    <Adress url={post?.url ?? url} />
  );

  const redigering = (
    <>
      <OpsField label="Rubrik" error={formfel && !trimSomRegeln(rubrik) ? formfel : undefined}>
        <OpsInput value={rubrik} onChange={setRubrik} ariaLabel="Rubrik" />
      </OpsField>
      {typ === "anteckning" ? (
        <OpsField label="Text">
          <OpsTextarea value={text} onChange={setText} ariaLabel="Text" rows={8} />
        </OpsField>
      ) : typ === "fil" ? (
        <OpsField label="Fil">
          {/* ⛔ Det råa filfältet är dolt och knappen är ramverkets (0.95.0). Förut stod webbläsarens egen "Välj fil,
              ingen fil vald" synlig här. Namnet på den valda filen skrivs ut, och tomheten med (arbetsreglerna, punkt 5). */}
          <div className="flex flex-wrap items-center gap-2">
            <OpsButton variant="secondary" onClick={() => filFalt.current?.click()}>{valdFil ? "Byt fil" : "Välj fil"}</OpsButton>
            <span className="min-w-0 truncate text-etikett text-ink-muted">{valdFil ? valdFil.name : post && !skapar ? "Den sparade filen behålls." : "Ingen fil vald."}</span>
          </div>
          <input
            ref={filFalt}
            type="file"
            aria-label="Fil"
            className="hidden"
            onChange={(e) => {
              const vald = e.target.files?.[0] ?? null;
              if (!vald) {
                setValdFil(null);
                return;
              }
              const fel = filInmatningsfel({ namn: vald.name, mime: vald.type, byte: vald.size });
              if (fel) {
                setValdFil(null);
                setFormfel(fel);
                return;
              }
              setFormfel("");
              setValdFil(vald);
              if (!trimSomRegeln(rubrik)) setRubrik(vald.name.replace(/\.[^.]+$/, "") || vald.name);
            }}
          />
        </OpsField>
      ) : (
        <OpsField label="Adress">
          <OpsInput value={url} onChange={setUrl} ariaLabel="Adress" placeholder="https://" />
        </OpsField>
      )}
    </>
  );

  const menyNamn = ljud && post ? ljudRubrik(post) : (post ? (trimSomRegeln(post.rubrik) || "Post") : rubrikVy);
  const metaText = lage === "las" && post
    ? (post.skapadAv?.namn ? `Skriven av ${post.skapadAv.namn}.` : "Författaren saknar namn.")
    : "";

  return (
    <div data-bibliotek-detalj={typ} data-bibliotek-lasning={lage === "las" ? "" : undefined} className="flex flex-col gap-4">
      <BibliotekDetaljHuvud
        onTillbaka={onStang}
        ikon={mark}
        rubrik={rubrikVy}
        meta={metaText}
        meny={post && !skapar ? <OpsAtgardsblad baraKnapp namn={menyNamn} poster={menyFor(post, true, setLage)} /> : null}
      />
      <OpsDokument
        ny={Boolean(skapar)}
        kanRedigera={false}
        visaRubrik={false}
        lage={lage}
        onLage={setLage}
        rubrik={rubrikVy}
        lasning={lasning}
        redigering={redigering}
        fel={formfel && trimSomRegeln(rubrik) ? formfel : ""}
        onSpara={forsokSpara}
        onAvbryt={() => {
          if (skapar) onStang();
          else aterstall();
        }}
      />
      {lage === "las" && post && ljud ? (
        kan ? (
          <UtskriftKontroll post={post} onSkrivUt={onSkrivUt} onGorForslag={onGorForslag} />
        ) : (
          post.utskrift != null ? <p data-bibliotek-utskrift="">{post.utskrift === "" ? "Utskriften är tom." : post.utskrift}</p> : null
        )
      ) : null}
    </div>
  );
}

/**
 * Gemensamt detaljhuvud för alla typer: Tillbaka, ikon och ⋯ på en rad,
 * rubriken på egen rad med rollen `rubrik`, sedan metadata.
 *
 * @param {{ onTillbaka: () => void, ikon: import("react").ReactNode, rubrik: string, meta?: string, meny?: import("react").ReactNode }} props
 */
function BibliotekDetaljHuvud({ onTillbaka, ikon, rubrik, meta = "", meny = null }) {
  return (
    <header data-bibliotek-detaljhuvud="" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <TillbakaKnapp onClick={onTillbaka} etikett="Tillbaka" className="self-start" />
        <span className="shrink-0">{ikon}</span>
        <span className="min-w-0 flex-1" aria-hidden="true" />
        {meny}
      </div>
      <h1 className="m-0 min-w-0 text-rubrik text-ink wrap-anywhere">{rubrik}</h1>
      {meta ? <p data-bibliotek-meta="" className="m-0 text-meta text-ink-muted">{meta}</p> : null}
    </header>
  );
}

/**
 * Röstinspelning öppnar skalets enda inspelare och förväljer modulens mål.
 * Utan skal kastas: en menyrad som inte öppnar något ser ut som att inspelningen börjat.
 * @param {((modulId: string) => void) | null} oppna
 * @param {string} modulId
 */
function oppnaRost(oppna, modulId) {
  if (!oppna) {
    throw new Error("OpsBibliotek: Röstinspelning öppnar skalets inspelare. Komponenten står utanför OpsAppShell.");
  }
  oppna(modulId);
}

/**
 * @param {{ post: { id: string, utskrift?: string }, onSkrivUt?: (post: { id: string }) => { text: string, forslag?: "anteckning" | "arende" } | Promise<{ text: string, forslag?: "anteckning" | "arende" }>, onGorForslag?: (inmatning: { id: string, satt: "anteckning" | "arende" }) => void | Promise<void> }} props
 */
function UtskriftKontroll({ post, onSkrivUt, onGorForslag }) {
  const [text, setText] = useState(/** @type {string | null} */ (post.utskrift ?? null));
  const [forslag, setForslag] = useState(/** @type {null | "anteckning" | "arende"} */ (null));
  const [fel, setFel] = useState("");
  const [visarVal, setVisarVal] = useState(false);
  return (
    <div data-bibliotek-utskrift-kontroll="" className="flex flex-col gap-2">
      {text != null ? <p data-bibliotek-utskrift="">{text === "" ? "Utskriften är tom." : text}</p> : null}
      {fel ? <p role="alert">{fel}</p> : null}
      <OpsButton
        variant="secondary"
        onClick={() => {
          if (typeof onSkrivUt !== "function") {
            setFel("Utskriften är inte kopplad. Inget skickades.");
            return;
          }
          setFel("");
          Promise.resolve()
            .then(() => onSkrivUt(post))
            .then((svar) => {
              if (!svar || typeof svar.text !== "string") {
                setFel("Servern svarade utan text. Ingenting sparades.");
                return;
              }
              setText(svar.text);
              setForslag(svar.forslag === "anteckning" || svar.forslag === "arende" ? svar.forslag : null);
              setVisarVal(true);
            })
            .catch((e) => setFel(e instanceof Error ? e.message : String(e)));
        }}
      >
        Skriv ut
      </OpsButton>
      {visarVal ? (
        <div className="flex gap-2">
          <OpsButton variant="secondary" onClick={() => {
            if (typeof onGorForslag !== "function") {
              setFel("Förslaget är inte kopplat. Ingenting skapades.");
              return;
            }
            onGorForslag({ id: post.id, satt: "anteckning" });
          }}>
            {forslag === "anteckning" ? "Spara som anteckning, förslag" : "Spara som anteckning"}
          </OpsButton>
          <OpsButton variant="secondary" onClick={() => {
            if (typeof onGorForslag !== "function") {
              setFel("Förslaget är inte kopplat. Ingenting skapades.");
              return;
            }
            onGorForslag({ id: post.id, satt: "arende" });
          }}>
            {forslag === "arende" ? "Skapa ärende, förslag" : "Skapa ärende"}
          </OpsButton>
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{ id: string, grupper: readonly { id: string, namn: string }[], onDela?: (inmatning: { id: string, groupId: string, satt: "flytta" | "kopiera" }) => void | Promise<void> }} props
 */
function DelaKontroll({ id, grupper, onDela }) {
  const [mal, setMal] = useState(grupper[0]?.id ?? "");
  const [fel, setFel] = useState("");
  if (grupper.length === 0) return null;
  const kor = (/** @type {"flytta" | "kopiera"} */ satt) => {
    if (!mal) {
      setFel("Välj en grupp.");
      return;
    }
    if (typeof onDela !== "function") {
      setFel("Delning är inte kopplad. Posten är kvar.");
      return;
    }
    try {
      const svar = onDela({ id, groupId: mal, satt });
      if (svar && typeof svar.then === "function") {
        svar.catch((e) => setFel(e instanceof Error ? e.message : String(e)));
      }
    } catch (e) {
      setFel(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div data-bibliotek-dela="" className="flex flex-col gap-2">
      {/* ⛔ OpsSelect och inte en rå `<select>` (0.95.0). CP 2026-10-13: "Det skall aldrig finnas en ostylad
          komponent som använder webläsarens scroll eller style." Den här listan var webbläsarens egen, i ramverket
          självt, trots att OpsSelect sade att den är förbjuden. `check-webblasarkontroller` fäller den nu. */}
      <OpsField label="Dela till">
        <OpsSelect
          ariaLabel="Grupp att dela till"
          value={mal}
          onChange={setMal}
          options={grupper.map((g) => ({ value: g.id, label: g.namn }))}
        />
      </OpsField>
      {fel ? <p role="alert">{fel}</p> : null}
      <div className="flex gap-2">
        <OpsButton variant="secondary" onClick={() => kor("flytta")}>Flytta</OpsButton>
        <OpsButton variant="secondary" onClick={() => kor("kopiera")}>Kopiera</OpsButton>
      </div>
    </div>
  );
}

