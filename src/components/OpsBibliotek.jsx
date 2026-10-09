import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { FileText, Image as BildIkon, Library, Link, Music, Pause, Play, Plus, StickyNote } from "lucide-react";
import { OpsAtgardsblad } from "./OpsAtgardsblad.jsx";
import { OpsDokument } from "./OpsDokument.jsx";
import { OpsMarkdown } from "./OpsMarkdown.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { OpsSvepRad } from "./OpsSvepRad.jsx";
import { ADRESSFORM, BIBLIOTEKTYPER, IDE_MAX_SEKUNDER, farAndra, filInmatningsfel, filSort, filtreraBibliotek, ideRubrik, inmatningsfel, normaliseraAdress, trimSomRegeln } from "../lib/bibliotek.js";
import { TalkPrickar, useTalk } from "./OpsTalk.jsx";
import { cx } from "../lib/cx.js";
import { arInstallningslage } from "../lib/apparark.js";
import { modulTillbaka } from "../lib/modulram.js";
import { radBehallare, radKlass } from "../lib/radKlass.js";
import { OpsButton, knappKlass } from "./OpsButton.jsx";
import { MikrofonIkon } from "./icons.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsList } from "./OpsList.jsx";
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
 * Samma `farAndra`. I listan avslöjar ett svep åt vänster Radera, och trycket
 * ger ångra innan `onRadera`. Menyn (långtryck, högerklick, ⋮) frågar först.
 * En trasig rad har samma fråga när raden bär grupp och skapare nog för `farAndra`.
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
 * @param {(inmatning: { id?: string, typ: string, rubrik: string, text?: string, url?: string }) => void} props.onSpara
 * @param {(id: string) => void | Promise<void>} [props.onRadera] Tar bort posten efter bekräftelse. Saknas den och någon bekräftar visas felet, posten rörs inte.
 * @param {(inmatning: { id?: string, rubrik: string, fil: File }) => void | Promise<void>} [props.onLaddaUpp] Sparar en fil. Saknas den och någon försöker visas felet, filen laddas inte upp.
 * @param {(post: { fil?: { sokvag?: string } }) => string} [props.filUrl] Appen ger adressen till en fil. Tom sträng visas som att adressen saknas. Synkron, och vinner när den är ifylld.
 * @param {(sokvag: string) => Promise<string>} [props.hamtaAdress] (0.88.2) Nedladdningsadressen för `fil.sokvag`, när `filUrl` är tom. Svaret cachas per sökväg, så listan och detaljen delar den. Medan den hämtas visas inte "Filen har ingen adress."
 * @param {(inmatning: { blob: Blob, mimeType: string, sekunder: number, rubrik: string }) => void | Promise<void>} [props.onSpelaIn] Sparar en idé. Saknas funktionen ritas ingen mikrofon: en rad som kastar "inte kopplad" efter inspelningen ser ut som att ljudet sparades.
 * @param {import("../lib/talk.js").Inspelare} [props.inspelare] Samma valfria inspelare som TALK. Utelämnad används webbläsarens. Appen skickar den när den redan har en.
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
export function OpsBibliotek({ poster, fel = null, trasiga = [], laddar = false, vald = null, skapar = null, jag, onOppna, onStang, onSkapa, onSpara, onRadera, onLaddaUpp, onSpelaIn, inspelare, filUrl, hamtaAdress, grupper = [], onDela, onSkrivUt, onGorForslag, hubHref, hubEtikett, onNavigate, modulId = "bibliotek", ram = null, activeHref, modul = null }) {
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
  const sprak = useOpsSprak();
  const [flik, setFlik] = useState(/** @type {"alla" | "anteckning" | "lank" | "fil"} */ ("alla"));
  const [ljus, setLjus] = useState("");
  const [sok, setSok] = useState("");
  const [startLage, setStartLage] = useState(/** @type {"las" | "redigera"} */ ("las"));
  const [byter, setByter] = useState(/** @type {null | (import("../lib/bibliotek.js").Bibliotekspost & { id: string })} */ (null));
  const [namnUtkast, setNamnUtkast] = useState("");
  const [namnFel, setNamnFel] = useState("");
  const [raderar, setRaderar] = useState(/** @type {string | null} */ (null));
  const [raderaFel, setRaderaFel] = useState("");
  const [delar, setDelar] = useState(/** @type {null | (import("../lib/bibliotek.js").Bibliotekspost & { id: string })} */ (null));
  const [status, setStatus] = useState("");
  const adresser = useFilAdresser(poster, vald, filUrl, hamtaAdress);
  const adressFor = (/** @type {{ typ?: string, fil?: { sokvag?: string, mime?: string } }} */ post) => losAdress(post, filUrl, hamtaAdress, adresser);
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
    if (!byter) return;
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
    onSpara(inmatning);
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
    }
    const lank = lankAttKopiera(post);
    if (lank) ut.push({ id: "kopiera", etikett: "Kopiera länk", onValj: () => kopieraLank(lank) });
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
      angraMeddelande: `${post.rubrik} tas bort.`,
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
    fil: poster.filter((p) => p.typ === "fil").length,
  };
  const synliga = filtreraBibliotek(poster, { flik, sok });
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
          <Detalj key={`${skaparTyp ?? ""}:${vald?.id ?? ""}:${startLage}`} post={vald} skapar={skaparTyp} jag={jag} startLage={startLage} onStang={onStang} onSpara={onSpara} onLaddaUpp={onLaddaUpp} filUrl={filUrl} adressFor={adressFor} onLjus={setLjus} onSkrivUt={onSkrivUt} onGorForslag={onGorForslag} menyFor={menyFor} />
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
                    {jag ? <NyKnapp flik={flik} onSkapa={onSkapa} /> : null}
                  </div>
                  {jag && typeof onSpelaIn === "function" ? <SpelaIn onSpelaIn={onSpelaIn} inspelare={inspelare} /> : null}
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
                    icon={sok ? null : <Library size={28} />}
                    title={sok ? "Inga träffar." : poster.length === 0 ? "Biblioteket är tomt." : flik === "anteckning" ? "Inga anteckningar ännu." : flik === "lank" ? "Inga länkar ännu." : "Inga filer ännu."}
                    description={sok ? `Inget matchar "${sok}".` : "Lägg till en anteckning, en länk eller en fil."}
                  />
                ) : (
                  <OpsList ariaLabel="Biblioteket" divided>
                    {synliga.map((post) => {
                      const ljud = post.typ === "fil" && filSort(post.fil?.mime) === "ljud";
                      const bild = post.typ === "fil" && filSort(post.fil?.mime) === "bild";
                      const lage = adressFor(post);
                      return (
                        <OpsSvepRad key={post.id} atgarder={svepFor(post)}>
                          <OpsAtgardsblad namn={post.rubrik} poster={menyFor(post, false)}>
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 bg-transparent text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                              onClick={() => oppnaMed(post, "las")}
                              aria-label={post.rubrik}
                            >
                              <PostMark post={post} bildAdress={bild && lage.lage === "klar" ? lage.adress : ""} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-brod font-medium text-ink">{post.rubrik}</span>
                                <span className="block truncate text-meta text-ink-muted">{postRad(post)}</span>
                              </span>
                            </button>
                            {ljud ? (lage.lage === "klar" ? <Ljudspelare src={lage.adress} /> : lage.lage === "hamtar" ? <p role="status">Hämtar ljudet.</p> : <p role={lage.lage === "fel" ? "alert" : "status"}>{lage.fel || "Filen har ingen adress."}</p>) : null}
                          </OpsAtgardsblad>
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
            <OpsButton variant="primary" onClick={sparaNamn}>Spara</OpsButton>
          </>
        )}
      >
        <OpsField label="Rubrik" error={namnFel || undefined}>
          <OpsInput value={namnUtkast} onChange={setNamnUtkast} ariaLabel="Nytt namn" />
        </OpsField>
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
const NYTT_NAMN = /** @type {const} */ ({ anteckning: "Ny anteckning", lank: "Ny länk", fil: "Ny fil" });

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
  const typ = post.typ === "anteckning" || post.typ === "lank" || post.typ === "fil" ? TYPNAMN[post.typ] : "";
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
 * @param {{ flik: "alla" | "anteckning" | "lank" | "fil", onSkapa: (typ: "anteckning" | "lank" | "fil") => void }} props
 */
function NyKnapp({ flik, onSkapa }) {
  const [oppen, setOppen] = useState(false);
  const innehall = (
    <>
      <Plus size={16} aria-hidden="true" />
      <span>Ny</span>
    </>
  );
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
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Bild öppnas i förhandsvisning. PDF och övrigt i ny flik. Utan adress sägs det.
 *
 * @param {{ post: { typ?: string, rubrik?: string, fil?: { namn?: string, mime?: string, byte?: number, sokvag?: string } }, lage: Adresslage, kopplad: boolean, onLjus?: (adress: string) => void }} props
 */
function FilVisning({ post, lage, kopplad, onLjus }) {
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
  if (sort === "ljud") return <Ljudspelare src={adress} />;
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
 * @param {(inmatning: { id?: string, typ: string, rubrik: string, text?: string, url?: string, fil?: { sokvag: string, namn: string, mime: string, byte: number } }) => void} props.onSpara
 * @param {(inmatning: { id?: string, rubrik: string, fil: File }) => void | Promise<void>} [props.onLaddaUpp]
 * @param {(post: { fil?: { sokvag?: string } }) => string} [props.filUrl]
 * @param {(post: { typ?: string, fil?: { sokvag?: string, mime?: string } }) => Adresslage} [props.adressFor]
 * @param {(adress: string) => void} [props.onLjus]
 * @param {(post: { id: string }) => { text: string, forslag?: "anteckning" | "arende" } | Promise<{ text: string, forslag?: "anteckning" | "arende" }>} [props.onSkrivUt]
 * @param {(inmatning: { id: string, satt: "anteckning" | "arende" }) => void | Promise<void>} [props.onGorForslag]
 * @param {(post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }, iDetalj: boolean, sattRedigera?: (lage: "redigera") => void) => import("./OpsAtgardsblad.jsx").Atgard[]} props.menyFor
 */
function Detalj({ post, skapar, jag, startLage, onStang, onSpara, onLaddaUpp, filUrl, adressFor, onLjus, onSkrivUt, onGorForslag, menyFor }) {
  const typ = skapar ?? post?.typ ?? "anteckning";
  const [rubrik, setRubrik] = useState(post && !skapar ? post.rubrik : "");
  const [text, setText] = useState(post && !skapar && post.typ === "anteckning" ? post.text ?? "" : "");
  const [url, setUrl] = useState(post && !skapar && post.typ === "lank" ? post.url ?? "" : "");
  const [formfel, setFormfel] = useState("");
  const [valdFil, setValdFil] = useState(/** @type {File | null} */ (null));
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
  const rubrikVy = skapar ? (typ === "anteckning" ? "Ny anteckning" : typ === "lank" ? "Ny länk" : "Ny fil") : post?.rubrik ?? "Post";
  const tomLage = /** @type {Adresslage} */ ({ lage: "saknas", adress: "", fel: "" });
  const filLage = post && typeof adressFor === "function" ? adressFor({ typ: post.typ, fil: post.fil }) : tomLage;
  const kopplad = typeof filUrl === "function" || filLage.lage !== "saknas";
  const mark = <PostMark post={{ typ, fil: post?.fil }} bildAdress={filLage.lage === "klar" ? filLage.adress : ""} />;
  const ljud = Boolean(post && post.typ === "fil" && filSort(post.fil?.mime) === "ljud");

  function aterstall() {
    setRubrik(post && !skapar ? post.rubrik : "");
    setText(post && !skapar && post.typ === "anteckning" ? post.text ?? "" : "");
    setUrl(post && !skapar && post.typ === "lank" ? post.url ?? "" : "");
    setFormfel("");
    setValdFil(null);
  }

  /** @returns {false | void | Promise<void | false>} */
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
      const svar = onLaddaUpp({ rubrik, fil: valdFil, ...(post && !skapar ? { id: post.id } : {}) });
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
    onSpara(inmatning);
  }

  const lasning = typ === "anteckning" ? (
    post?.text ? <OpsMarkdown text={post.text} dokument /> : <p className="text-brod text-ink">Anteckningen har ingen text.</p>
  ) : typ === "fil" && post ? (
    <FilVisning post={post} lage={filLage} kopplad={kopplad} onLjus={onLjus} />
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
          <input
            type="file"
            aria-label="Fil"
            className="text-brod text-ink"
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

  return (
    <div data-bibliotek-detalj={typ} data-bibliotek-lasning={lage === "las" ? "" : undefined} className="flex flex-col gap-4">
      <TillbakaKnapp onClick={onStang} etikett="Tillbaka" className="self-start" />
      <div className="flex items-start gap-3">
        {mark}
        <div className="min-w-0 flex-1">
          <OpsDokument
            ny={Boolean(skapar)}
            kanRedigera={kan}
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
            extra={post && !skapar ? <OpsAtgardsblad baraKnapp namn={post.rubrik} poster={menyFor(post, true, setLage)} /> : null}
          />
        </div>
      </div>
      {lage === "las" && post ? (
        <p className="text-meta text-ink-muted">{post.skapadAv?.namn ? `Skriven av ${post.skapadAv.namn}.` : "Författaren saknar namn."}</p>
      ) : null}
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
 * @param {number} sekunder
 */
function visaTid(sekunder) {
  const s = Number.isFinite(sekunder) && sekunder > 0 ? Math.floor(sekunder) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * @param {{ src: string }} props
 */
function Ljudspelare({ src }) {
  const ljud = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const [spelar, setSpelar] = useState(false);
  const [tid, setTid] = useState(0);
  const [langd, setLangd] = useState(0);
  const [fel, setFel] = useState("");
  return (
    <div data-bibliotek-spelare="" className="flex items-center gap-2">
      <audio
        ref={ljud}
        src={src}
        preload="metadata"
        onPlay={() => setSpelar(true)}
        onPause={() => setSpelar(false)}
        onTimeUpdate={() => setTid(ljud.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setLangd(ljud.current?.duration ?? 0)}
      />
      <button
        type="button"
        aria-label={spelar ? "Pausa" : "Spela"}
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-raised text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={() => {
          const el = ljud.current;
          if (!el) return;
          if (!el.paused) {
            el.pause();
            return;
          }
          const svar = el.play();
          if (svar && typeof svar.catch === "function") {
            svar.catch((e) => setFel(e instanceof Error ? e.message : String(e)));
          }
        }}
      >
        {spelar ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
      </button>
      <span className="text-meta text-ink-muted">{visaTid(tid)} / {visaTid(langd)}</span>
      {fel ? <p role="alert">{fel}</p> : null}
    </div>
  );
}

/**
 * @param {{ onSpelaIn: (inmatning: { blob: Blob, mimeType: string, sekunder: number, rubrik: string }) => void | Promise<void>, inspelare?: import("../lib/talk.js").Inspelare }} props
 */
function SpelaIn({ onSpelaIn, inspelare }) {
  const [sekunder, setSekunder] = useState(0);
  const startad = useRef(0);
  const styr = useTalk({
    maxSekunder: IDE_MAX_SEKUNDER,
    inspelare,
    onKlick: () => {},
    onTalk: (blob, meta) => onSpelaIn({ blob, mimeType: meta.mimeType, sekunder: meta.sekunder, rubrik: ideRubrik() }),
  });
  const pagar = styr.lage === "lyssnar" || styr.lage === "haller" || styr.lage === "skickar";
  useEffect(() => {
    if (!pagar) return undefined;
    startad.current = Date.now();
    const id = setInterval(() => setSekunder(Math.floor((Date.now() - startad.current) / 1000)), 250);
    return () => clearInterval(id);
  }, [pagar]);
  // ⛔ STOR OCH CENTRERAD (CP 2026-10-09, telefon). Den lilla raden "Spela in idé" syntes inte som en inspelning.
  // Mikrofonen är 96 px. Medan den lyssnar ritas TALK:s nivåprickar, samma som fältet, så det syns att ljudet tas emot.
  const mikrofon = (
    <span aria-hidden="true" className={cx("inline-flex size-24 items-center justify-center rounded-full", pagar ? "bg-accent text-accent-contrast" : "bg-raised text-ink")}>
      <MikrofonIkon size={40} />
    </span>
  );
  if (pagar) {
    return (
      <div data-bibliotek-inspelning="" className="flex flex-col items-center gap-4 py-4">
        {mikrofon}
        <div className="w-56">
          <TalkPrickar niva={styr.niva} lyssnar={styr.lage !== "skickar"} skickar={styr.lage === "skickar"} />
        </div>
        <span role="status" className="text-brod text-ink">Spelar in. {visaTid(sekunder)} / {visaTid(IDE_MAX_SEKUNDER)}</span>
        <div className="flex items-center gap-2">
          <OpsButton variant="primary" onClick={() => styr.skickaIn()}>Spara idé</OpsButton>
          <OpsButton variant="secondary" onClick={() => styr.avbryt()}>Avbryt</OpsButton>
        </div>
      </div>
    );
  }
  return (
    <div data-bibliotek-inspelning="vila" className="flex flex-col items-center gap-3 py-6">
      {styr.fel ? <p role="alert" className="text-center">{styr.fel}</p> : null}
      <button type="button" aria-label="Spela in idé" data-bibliotek-inspelning="start" onClick={() => styr.direkt()} className="inline-flex size-24 cursor-pointer items-center justify-center rounded-full bg-raised text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <MikrofonIkon size={40} />
      </button>
    </div>
  );
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
      <label className="text-meta text-ink-muted">
        Dela till
        <select aria-label="Grupp att dela till" value={mal} onChange={(e) => setMal(e.target.value)} className="ml-2">
          {grupper.map((g) => <option key={g.id} value={g.id}>{g.namn}</option>)}
        </select>
      </label>
      {fel ? <p role="alert">{fel}</p> : null}
      <div className="flex gap-2">
        <OpsButton variant="secondary" onClick={() => kor("flytta")}>Flytta</OpsButton>
        <OpsButton variant="secondary" onClick={() => kor("kopiera")}>Kopiera</OpsButton>
      </div>
    </div>
  );
}

