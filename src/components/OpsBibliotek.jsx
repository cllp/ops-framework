import { useEffect, useId, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Tabs from "@radix-ui/react-tabs";
import { Check, File as FilIkon, FileText, Globe, Image as BildIkon, Library, Link2, Mic, Plus, SlidersHorizontal, Tag, Video as VideoIkon, X } from "lucide-react";
import { OpsAtgardsblad } from "./OpsAtgardsblad.jsx";
import { OpsDokument } from "./OpsDokument.jsx";
import { OpsMarkdown } from "./OpsMarkdown.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { OpsSvepRad } from "./OpsSvepRad.jsx";
import { ADRESSFORM, BIBLIOTEKTYPER, uppladdningAvbruten, uppladdningenAvbrytsKl, MAX_TAGGAR, MAX_TAGGLANGD, allaTaggar, arLjudpost, arMittBibliotek, farAndra, normaliseraTagg, normaliseraTaggar, taggarFel, taggfarg, anteckningsrubrikNu, beskrivObjektbibliotek, filInmatningsfel, mimeUrFilnamn, filadressFel, filSort, filtreraBibliotek, inmatningsfel, ljudDatum, ljudRubrik, normaliseraAdress, trimSomRegeln } from "../lib/bibliotek.js";
import { formateraTid } from "../lib/ljudspelare.js";
import { useInspelningOppnare, useKanSpelaIn } from "./OpsAppShell.jsx";
import { cx } from "../lib/cx.js";
import { arInstallningslage } from "../lib/apparark.js";
import { modulTillbaka } from "../lib/modulram.js";
import { radBehallare, radKlass } from "../lib/radKlass.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsLjudspelare } from "./OpsLjudspelare.jsx";
import { OpsSpelaKnapp, OpsSpelarKontroller, useSpelare } from "./OpsSpelare.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { OpsField, OpsInput, OpsTextarea } from "./OpsField.jsx";
import { OpsSelect } from "./OpsSelect.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { DELNINGSDAGAR, FORVAL_DELNINGSDAGAR } from "../lib/delning.js";
import { DelaLankFalt, useDelaLankFalt } from "./DelaLankFalt.jsx";
import { LankRad } from "./LankRad.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { useKopiera, useKortVisning } from "./useKopiera.js";
import { ordet } from "../lib/ord.js";
import { talkOrd } from "../lib/talk.js";
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
 * ⛔ LISTAN LÄSER OM SJÄLV NÄR EN POST SKRIVS (0.114.0, cllp/ops-framework#403). CP 2026-10-17: efter en röstinspelning syntes den inte förrän
 * han laddat om. Appen läste med `kalla.las()`, en engångsläsning, och ingenting sade åt listan att läsa om när en annan källa skrev en rad.
 * Med `kalla` läser vyn själv: `kalla.prenumerera` när bibliotekskällan har den (datakällan har `subscribe`), annars `kalla.las()` en gång,
 * som förut. Ingen polling. Ett fel i strömmen står i `fel` och ersätts av nästa lyckade leverans. Prenumerationen stängs när vyn
 * lämnar eller `kalla` byts, så en kalla ska vara stabil mellan renderingar (skapa den en gång, `useMemo`).
 * @param {{ las: () => Promise<{ poster: any[], kalla: string, fel: Error | null, trasiga: any[] }>, prenumerera?: (lyssnare: (svar: { poster: any[], kalla: string, fel: Error | null, trasiga: any[] }) => void, onFel: (fel: Error) => void) => () => void } | null | undefined} kalla
 */
function useBibliotekskalla(kalla) {
  const [lage, setLage] = useState({ poster: /** @type {any[]} */ ([]), trasiga: /** @type {any[]} */ ([]), fel: /** @type {string | null} */ (null), laddar: Boolean(kalla) });
  useEffect(() => {
    if (!kalla) return undefined;
    let levande = true;
    setLage((f) => ({ ...f, laddar: true }));
    /** @param {{ poster: any[], kalla: string, fel: Error | null, trasiga: any[] }} svar */
    const till = (svar) => {
      if (!levande) return;
      setLage({ poster: svar.poster, trasiga: svar.trasiga, fel: svar.kalla === "fel" ? (svar.fel?.message || "?") : null, laddar: false });
    };
    if (typeof kalla.prenumerera === "function") {
      const avreg = kalla.prenumerera(till, (e) => {
        if (levande) setLage((f) => ({ ...f, fel: e.message || "?", laddar: false }));
      });
      return () => {
        levande = false;
        avreg();
      };
    }
    kalla.las().then(till);
    return () => {
      levande = false;
    };
  }, [kalla]);
  return kalla ? lage : null;
}

/**
 * @param {object} props
 * @param {{ las: () => Promise<any>, prenumerera?: (lyssnare: (svar: any) => void, onFel: (fel: Error) => void) => () => void }} [props.kalla] (0.114.0) Bibliotekskällan (`createBibliotekskalla`). Med den läser vyn själv och en ny post syns direkt, se `useBibliotekskalla`. Ges den ska `poster`, `fel`, `trasiga` och `laddar` utelämnas: vyn har då två sanningar om samma lista, och den ena hade vunnit tyst.
 * @param {readonly (import("../lib/bibliotek.js").Bibliotekspost & { id: string })[]} [props.poster] Krävs om inte `kalla` ges (0.114.0).
 * @param {string | null} [props.fel] Läsningen misslyckades. Tom lista med fel är inte "biblioteket är tomt".
 * @param {readonly { id: string, fel: string, groupId?: string, skapadAv?: { uid?: string | null } }[]} [props.trasiga] Rader källan inte kunde läsa (`las().trasiga`). De visas som ett antal med skäl, aldrig tyst. Den som får raderar raden.
 * @param {{ uid: string, roll: string, groupId?: string, status?: string } | null} props.jag Den inloggades aktiva medlemskap i gruppen, eller `null` när personen inte är medlem. Krävs.
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
 * @param {readonly { id: string, namn: string }[]} [props.grupper] Platser posten kan flyttas eller kopieras till. Mitt bibliotek (`mittBibliotek(uid)`) är en av dem när appen ger den (0.101.0): menyn får då Flytta till och Kopiera till Mitt bibliotek, och i Mitt bibliotek Dela med gruppen.
 * @param {(inmatning: { id: string, groupId: string, satt: "flytta" | "kopiera" }) => void | Promise<void>} [props.onDela] Flytta eller kopiera. Saknas den visas felet, posten är kvar. `flyttaBibliotekspost` gör flytten.
 * @param {readonly { id: string, namn: string }[]} [props.platser] (0.101.0) Platserna personen växlar mellan, till exempel gruppens bibliotek och Mitt bibliotek. Färre än två: ingen växlare.
 * @param {string} [props.plats] (0.101.0) Platsen som visas nu, ett `id` ur `platser`.
 * @param {(id: string) => void} [props.onPlats] (0.101.0) Personen valde en annan plats.
 * @param {(post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }) => Promise<void> | void} [props.onSkrivUt] (0.115.0, cllp/lifehub.app#349) Ber servern skriva ut ett ljud. Knappen "Skriv ut texten" ritas på en
 *   ljudpost när propen ges och posten inte har någon utskrift än. Medan löftet pågår står "Skriver ut…" på posten, och ett fel (också ett dygnstak)
 *   visas på posten med knappen kvar. ⛔ TEXTEN KOMMER INTE I SVARET: servern skriver fältet `utskrift` på posten (Admin SDK), och vyn visar den när
 *   posten läses om. Det löftet löser till ignoreras. Utan propen ritas ingen knapp. Före 0.115.0 löste den till `{ text, forslag }` och vyn höll en egen kopia.
 * @param {(post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }) => Promise<void> | void} [props.onAnteckningAvUtskrift] (0.115.0, cllp/lifehub.app#349) "Gör en anteckning av texten" under utskriften.
 *   Ritas bara när propen ges. Ett fel visas på posten, och lyckas den står "Anteckningen är sparad" en stund.
 * @param {unknown} [props.onGorForslag] Borttagen (0.115.0). Skickas den kastas ett fel: förslagsknapparna "Spara som anteckning" och "Skapa ärende" är ersatta av `onAnteckningAvUtskrift`.
 * @param {readonly { id: string, postId: string, giltigTill: number, nedladdning: boolean, url?: string, harKod?: boolean }[]} [props.delningar] (0.119.0, lifehub.app#356) De delningslänkar som lever, för posterna som visas (`lista()` ur `createDelningService`). En post med en länk här får markeringen "Delad" i listan, och dialogen visar länkens läge. Appen läser dem själv: raderna går inte att läsa i klienten.
 *   (0.125.0) `url` är hela adressen (`delningsUrl(bas, rad.sokvag)`) för en länk skapad med 0.125.0 eller senare: dialogen visar den då som text med Kopiera. En gammal tokenlänk har ingen `sokvag` och därför ingen `url`, och dialogen säger som förut att adressen bara visades när den skapades.
 * @param {string} [props.gruppnamn] (0.127.0) Gruppens namn, för förslaget till gruppdelen i "Dela länk" när `platser` och `grupper` inte säger det: den inbäddade vyn (`OpsPlatsfiler`) har en enda plats som inte är gruppens egen (`handelse~<grupp>~<händelse>`), så platsen ger inget namn. Utan både namn och `delningGruppdel` är gruppdelen tom och personen skriver den själv (Skapa säger det). Ett fast ord föreslås aldrig, eftersom en gruppdel tillhör den första gruppen som tar den.
 * @param {string} [props.delningGruppdel] (0.125.0, granskningen av PR 417) Gruppdelen platsen redan använt i en länk (`gruppdelar({ uid, groupId }).senaste`), föreslagen i "Dela länk" före ett namn ur gruppens namn. En gruppdel tillhör en plats för alltid: en annan grupps svarar servern `adress-upptagen` med `del: "gruppdel"` och dialogen föreslår en annan.
 * @param {(inmatning: { postId: string, dagar: number, nedladdning: boolean, kod: string | null, gruppdel: string, fildel: string }) => Promise<{ id: string, url: string, giltigTill?: number, harKod?: boolean }>} [props.onDelaLank] (0.119.0) Skapar länken. Ritar "Dela länk" i menyn för en färdig fil som personen får dela (`farAndra`). Löftet ska lösa till länkens id och HELA adressen (appen bygger den: `delningsUrl(bas, svar.sokvag)`).
 *   (0.125.0) Inmatningen har också `kod` (`null` utan kod, annars koden i klartext till servern, som hashar den), `gruppdel` och `fildel`: adressen är `/g/<gruppdel>/lib/<fildel>`, föreslagen ur gruppens namn och filens rubrik, och personen kan ändra båda. Utan kod lägger servern till ett slumpat slut. Kastar anropet med `kod: "adress-upptagen"` föreslår dialogen en annan adress. Kräver `onAndraNedladdning` och `onAterkalla`: en länk som inte går att stänga får inte kunna skapas.
 * @param {(inmatning: { id: string, nedladdning: boolean }) => Promise<void> | void} [props.onAndraNedladdning] (0.119.0) Slår på eller av nedladdning på en länk som lever. Ett fel visas i dialogen och reglaget står kvar.
 * @param {(inmatning: { id: string }) => Promise<void> | void} [props.onAterkalla] (0.119.0) Stänger länken, för alltid. "Stäng länken" i dialogen. En ny delning ger ett nytt token.
 * @param {string} [props.modulId] (0.88.1) Modulens id i appen, förval "bibliotek". Står den i huvudmenyn har listan ingen tillbaka-rad.
 * @param {string} [props.hubHref] (0.83.0) Hubbens adress: tillbaka-radens mål, som `OpsModulSida`. Krävs, utom med `inbaddad` (0.121.0).
 * @param {string} [props.hubEtikett] Förval "Appar".
 * @param {(href: string, event: any) => void} [props.onNavigate] Tillbaka-länkens klick, som `OpsModulSida`.
 * @param {import("./OpsModulRam.jsx").ModulRam | null} [props.ram] (0.89.0) Inställningsläget. Utelämnad: listan som förut, utan kugghjul.
 * @param {string} [props.activeHref] (0.89.0) Krävs tillsammans med `ram` och `modul`. `?lage=installningar` visar inställningarna.
 * @param {import("../lib/modul.js").Modul | null} [props.modul] (0.89.0) Manifestet inställningarna läser. Krävs med `ram`.
 * @param {boolean} [props.inbaddad] (0.121.0, lifehub.app#366) Listan som en sektion i en annan vy, till exempel en händelses eller ett ärendes Filer (`OpsPlatsfiler`). Ingen vyram och ingen
 *   tillbaka-rad till hubben (`hubHref` krävs inte), ingen sök-, tagg-, flik- eller "+ Ny"-rad, bara listan och detaljen: den som äger sektionen (`OpsPlatsfiler`) ritar rubriken och Ladda upp
 *   och sätter `skapar` (`"fil"`), eftersom en händelses och ett ärendes bibliotek har bara filer. Detaljens tillbaka heter "Filer". `ram`, `platser`, `plats`, `onPlats`, `grupper` och `onDela` hör inte hit och kastar: en inbäddad lista har en plats.
 * @param {string} [props.tomText] (0.122.0) Beskrivningen under "Inga filer än." när den inbäddade listan är tom. Förval "Filer som läggs till här hör bara till händelsen." (en konstant, inte ett parameterförval; `OpsPlatsfiler` skickar rätt mening för ärendet).
 */
export function OpsBibliotek({ poster: posterProp, kalla, fel: felProp = null, trasiga: trasigaProp = [], laddar: laddarProp = false, vald = null, skapar = null, jag, onOppna, onStang, onSkapa, onSpara, onRadera, onLaddaUpp, onFyllLjud, onSpelaIn, inspelare, filUrl, hamtaAdress, grupper = [], onDela, platser = [], plats, onPlats, onSkrivUt, onAnteckningAvUtskrift, onGorForslag, delningar = [], delningGruppdel, gruppnamn: gruppnamnProp, onDelaLank, onAndraNedladdning, onAterkalla, hubHref, hubEtikett, onNavigate, modulId = "bibliotek", ram = null, activeHref, modul = null, inbaddad = false, tomText }) {
  if (kalla !== undefined && (posterProp !== undefined || felProp !== null || laddarProp !== false || (Array.isArray(trasigaProp) && trasigaProp.length > 0))) {
    throw new Error("OpsBibliotek: kalla och poster/fel/trasiga/laddar kan inte ges tillsammans. Med kalla läser vyn själv, och två sanningar om samma lista hade låtit den ena vinna tyst.");
  }
  if (kalla === undefined && posterProp === undefined) {
    throw new Error("OpsBibliotek: poster krävs, eller kalla (0.114.0). Utan någon av dem finns ingen lista att rita.");
  }
  if (jag === undefined) {
    throw new Error("OpsBibliotek: jag krävs, den inloggades aktiva medlemskap i gruppen ({ uid, roll }), eller null när personen inte är medlem. Utan propen ser en medlem ut som en som bara får läsa.");
  }
  // ⛔ EN HÄNDELSES ELLER ETT ÄRENDES BIBLIOTEK FINNS INTE BLAND PLATSERNA (0.121.0, 0.122.0, lifehub.app#366). Platsväljaren och Flytta-menyn bygger på listorna appen ger, och en
  // plats som hamnat där är en plats man kan flytta en fil in i eller ut ur: ett synlighetsbeslut utan objektets villkor. Kastar hellre än filtrerar tyst.
  const objektplats = [...platser, ...grupper].find((p) => beskrivObjektbibliotek(p?.id));
  if (objektplats) {
    const objekt = /** @type {{ ord: string, objekt: string }} */ (beskrivObjektbibliotek(objektplats.id));
    throw new Error(`OpsBibliotek: platsen "${objektplats.id}" är ${objekt.ord} och hör inte hemma i platser eller grupper. Filerna hör till ${objekt.objekt} och flyttas inte dit eller därifrån; de visas av OpsPlatsfiler.`);
  }
  if (inbaddad && (ram || platser.length > 0 || grupper.length > 0 || plats !== undefined || onPlats !== undefined || onDela !== undefined)) {
    throw new Error("OpsBibliotek: inbaddad hör ihop med en enda plats. ram, platser, plats, onPlats, grupper och onDela är för det fristående biblioteket.");
  }
  if (!inbaddad && (typeof hubHref !== "string" || hubHref === "")) {
    throw new Error("OpsBibliotek: hubHref krävs (0.83.0), hubbens adress. Sidan har Ekonomis tillbaka-rad, och en rad som inte vet vart den leder är en knapp som inte gör något.");
  }
  kravRam(ram, "OpsBibliotek");
  if (ram && (typeof activeHref !== "string" || activeHref === "" || !modul)) {
    throw new Error("OpsBibliotek: ram kräver activeHref och modul. Inställningsläget behöver adressen och appens manifest.");
  }
  if (onGorForslag !== undefined) {
    throw new Error("OpsBibliotek: onGorForslag är borta (0.115.0). Utskriften skrivs av servern på posten, och under texten finns Kopiera och \"Gör en anteckning av texten\" (onAnteckningAvUtskrift). Att tysta propen hade sett ut som att förslagsknapparna fortfarande fanns.");
  }
  if (onSpelaIn !== undefined || inspelare !== undefined) {
    throw new Error("OpsBibliotek: inspelningen i listan är borta. Röstinspelning i Ny-menyn öppnar skalets inspelare, med målet förvalt till modulens inspelning.mal.");
  }
  if (typeof onDelaLank === "function" && (typeof onAndraNedladdning !== "function" || typeof onAterkalla !== "function")) {
    throw new Error("OpsBibliotek: onDelaLank (0.119.0) kräver onAndraNedladdning och onAterkalla. En länk som inte går att stänga eller ändra efteråt får inte kunna skapas härifrån.");
  }
  const sprak = useOpsSprak();
  const oppnaInspelning = useInspelningOppnare();
  // ⛔ RÖSTINSPELNING ERBJUDS BARA MED EN MOTTAGARE (cllp/ops-framework#391). Utan skal (`null`) ritas raden som förut och kastar tydligt
  // vid tryck: en felkoppling som utvecklaren ska se. Inom skalet avgör gruppen: en avinstallerad eller dold app har ingen mottagare.
  const kanSpelaIn = useKanSpelaIn();
  const erbjudRost = kanSpelaIn ? kanSpelaIn(modulId) : true;
  // ⛔ Listan kommer ur propsen eller ur kallan, aldrig ur båda (kastat ovan).
  const levande = useBibliotekskalla(kalla);
  const poster = levande ? levande.poster : /** @type {NonNullable<typeof posterProp>} */ (posterProp);
  const fel = levande ? levande.fel : felProp;
  const trasiga = levande ? levande.trasiga : trasigaProp;
  const laddar = levande ? levande.laddar : laddarProp;
  const [flik, setFlik] = useState(/** @type {Flik} */ ("alla"));
  const [rostFel, setRostFel] = useState("");
  const [ljus, setLjus] = useState("");
  const [sok, setSok] = useState("");
  const [valdaTaggar, setValdaTaggar] = useState(/** @type {string[]} */ ([]));
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
  // ⛔ Dela länk (0.119.0): dialogen för en publik länk till en fil.
  const [delarLank, setDelarLank] = useState(/** @type {null | (import("../lib/bibliotek.js").Bibliotekspost & { id: string })} */ (null));
  // Poster som flyttas eller kopieras just nu, ur menyn. Deras flyttval visas inte förrän svaret kommit.
  const [flyttar, setFlyttar] = useState(/** @type {string[]} */ ([]));
  const [status, setStatus] = useState("");
  const adresser = useFilAdresser(poster, vald, filUrl, hamtaAdress);
  useUppladdningsklocka(poster, vald);
  const adressFor = (/** @type {{ typ?: string, skapad?: number, fil?: { sokvag?: string, mime?: string, klar?: boolean } }} */ post) => losAdress(post, filUrl, hamtaAdress, adresser);
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
   * Menyn för en post: långtryck, högerklick och ⋮.
   *
   * ⛔ MENYN ÄR KORT (0.102.0). CP 2026-10-14, med en skärmbild av en meny med tio rader: "Kanske popup med en kortare meny för
   * artefakten? Vad är detta med hastighet mm och spolning när en låt/ljud inte ens har startat?" Det som togs bort, och var det
   * finns i stället:
   * - Öppna i listan: ett tryck på kortet öppnar redan.
   * - Taggar: taggarna läggs till och tas bort på kortet, som i SessionStudio.
   * - 10 sekunder bakåt, 10 sekunder framåt, Hastighet och Ladda ned för ljud: spelarens egna knappar i detaljen. I menyn styrde
   *   de en spelare som inte spelade, och de stod där för varje ljud oavsett om det startats.
   * - Redigera i listan: står kvar i detaljen, där formuläret öppnas.
   * - Kopiera till Mitt bibliotek för den som skrev posten: ligger i "Flytta eller kopiera", bredvid de andra platserna.
   *
   * @param {import("../lib/bibliotek.js").Bibliotekspost & { id: string }} post
   * @param {boolean} iDetalj
   * @param {(lage: "redigera") => void} [sattRedigera]
   */
  function menyFor(post, iDetalj, sattRedigera) {
    const far = farAndra(post, jag);
    /** @type {import("./OpsAtgardsblad.jsx").Atgard[]} */
    const ut = [];
    if (far && iDetalj && sattRedigera) ut.push({ id: "redigera", etikett: "Redigera", onValj: () => sattRedigera("redigera") });
    if (far) ut.push({ id: "namn", etikett: "Byt namn", onValj: () => borjaNamn(post) });
    // ⛔ DELA LÄNK (0.119.0, lifehub.app#356): bara en färdig fil, och bara den som får ändra posten (`farAndra`: författaren, en admin eller
    // en ägare, och i Mitt bibliotek bara ägaren). Samma villkor som servern kontrollerar, så knappen lovar inget som funktionen sedan nekar.
    if (far && typeof onDelaLank === "function" && post.typ === "fil" && post.fil?.klar !== false) {
      ut.push({ id: "dela-lank", etikett: "Dela länk", onValj: () => setDelarLank(post) });
    }
    const lank = lankAttKopiera(post);
    if (lank) ut.push({ id: "kopiera", etikett: "Kopiera länk", onValj: () => kopieraLank(lank) });
    // ⛔ MITT BIBLIOTEK OCH GRUPPEN (0.101.0, lifehub.app#226). Beslutet: "Flytta till Mitt bibliotek / Dela med gruppen" i samma
    // meny som Byt namn. Att flytta ut ur gruppen får bara författaren: en admin som flyttade någon annans post till sitt eget
    // bibliotek hade tagit den från gruppen. Att kopiera dit får den som läser, eftersom läsningen redan ger innehållet.
    //
    // ⛔ SAMMA GRÄNS FÖR EN ANNAN GRUPP (granskningen av PR 365): en flytt tar posten ur gruppen och gör den som flyttar till
    // författare, så bara författaren flyttar. En admin kopierar. Och medan en flytt av posten pågår visas inga flyttval för den:
    // ett andra tryck hade gjort två kopior och sedan sagt att posten låg på båda ställena, vilket inte hade varit sant.
    const mitt = grupper.find((g) => arMittBibliotek(g.id) && g.id !== post.groupId);
    const andra = grupper.filter((g) => !arMittBibliotek(g.id) && g.id !== post.groupId);
    const ensam = arMittBibliotek(post.groupId);
    const aktiv = Boolean(jag) && (jag?.status === undefined || jag?.status === "aktiv");
    const egen = aktiv && post.skapadAv?.uid === jag?.uid;
    if (aktiv && !flyttar.includes(post.id)) {
      // ⛔ `egen || far` STÅR KVAR SOM FÖRSVAR I DJUPET (granskningen av PR 366, KAN 10). I dag läser bara ägaren Mitt bibliotek, men
      // menyn ska inte lita på att reglerna alltid säger det.
      if (ensam && (egen || far)) {
        if (andra.length === 1) ut.push({ id: "dela-grupp", etikett: `Dela med ${andra[0].namn}`, onValj: () => delaDirekt(post, andra[0], "flytta") });
        else if (andra.length > 1) ut.push({ id: "dela", etikett: "Dela med en grupp", onValj: () => setDelar(post) });
      } else if (!ensam) {
        if (mitt) {
          ut.push(egen
            ? { id: "till-mitt", etikett: "Flytta till Mitt bibliotek", onValj: () => delaDirekt(post, mitt, "flytta") }
            : { id: "kopia-mitt", etikett: "Kopiera till Mitt bibliotek", onValj: () => delaDirekt(post, mitt, "kopiera") });
        }
        // Fler platser i en ruta: författaren flyttar eller kopierar till Mitt bibliotek och de andra grupperna, en admin kopierar
        // till de andra grupperna.
        const platserIRutan = egen ? (mitt ? 1 : 0) + andra.length : far ? andra.length : 0;
        if (platserIRutan > 0) {
          ut.push({ id: "dela", etikett: egen ? "Flytta eller kopiera" : "Kopiera till en annan grupp", onValj: () => setDelar(post) });
        }
      }
    }
    if (far) ut.push({ id: "radera", etikett: "Radera", fara: true, onValj: () => fragaRadera(post.id) });
    return ut;
  }

  /**
   * Flytta eller kopiera direkt ur menyn, utan väljare: målet är redan ett (Mitt bibliotek, eller den enda gruppen).
   *
   * ⛔ SVARET SYNS. Medan det pågår står det i statusraden, och ett fel står kvar där med skälet. En flytt som tyst inte blev
   * av hade lämnat personen att tro att posten låg i sitt eget bibliotek.
   *
   * @param {{ id: string }} post
   * @param {{ id: string, namn: string }} mal
   * @param {"flytta" | "kopiera"} satt
   */
  function delaDirekt(post, mal, satt) {
    if (typeof onDela !== "function") {
      setStatus("Flytten är inte kopplad. Posten är kvar.");
      return;
    }
    if (flyttar.includes(post.id)) return;
    setFlyttar((f) => [...f, post.id]);
    const klar = () => setFlyttar((f) => f.filter((id) => id !== post.id));
    setStatus(satt === "flytta" ? `Flyttar till ${mal.namn}…` : `Kopierar till ${mal.namn}…`);
    Promise.resolve()
      .then(() => onDela({ id: post.id, groupId: mal.id, satt }))
      .then(
        () => {
          klar();
          setStatus(satt === "flytta" ? `Flyttad till ${mal.namn}.` : `Kopierad till ${mal.namn}.`);
        },
        (e) => {
          klar();
          setStatus(e instanceof Error && e.message ? e.message : String(e));
        },
      );
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

  // ⛔ GRUPPENS TAGGAR RÄKNAS UR POSTERNA (regel 2). Ett val på en tagg som inte längre finns (sista posten raderad eller omtaggad)
  // faller bort, annars hade listan stått tom med ett filter ingen kan se eller ta bort.
  const gruppensTaggar = allaTaggar(poster);
  const valda = valdaTaggar.filter((t) => gruppensTaggar.some((g) => g.tagg === t));
  const antal = /** @type {Record<Flik, number>} */ (Object.fromEntries(FLIKAR.map((f) => [f.id, filtreraBibliotek(poster, { flik: f.id }).length])));
  // ⛔ EN TOM FLIK VISAS INTE, UTOM ALLT OCH LJUD (0.102.0, som SessionStudios `useMyLibraryTabs`). En flik som tömts medan den var
  // vald faller tillbaka till Allt, härlett här och inte i ett eget tillstånd: en flik som inte syns kan inte heller vara vald.
  const synligaFlikar = FLIKAR.filter((f) => f.alltid || antal[f.id] > 0);
  const aktivFlik = synligaFlikar.some((f) => f.id === flik) ? flik : "alla";
  const synliga = filtreraBibliotek(poster, { flik: aktivFlik, sok, taggar: valda });
  const installningar = Boolean(ram && modul && arInstallningslage(/** @type {string} */ (activeHref)));
  if (installningar && modul) {
    return (
      <OpsModulRam modul={modul} activeHref={/** @type {string} */ (activeHref)} hubHref={/** @type {string} */ (hubHref)} hubEtikett={hubEtikett} onNavigate={onNavigate} sprak={sprak} ram={ram}>
        {null}
      </OpsModulRam>
    );
  }
  const visaKnapp = Boolean(ram && ram.farAndra);
  const platsValjare =
    platser.length >= 2 && plats ? (
      <PlatsValjare
        platser={platser}
        plats={plats}
        onPlats={(v) => {
          setValdaTaggar([]);
          setStatus("");
          if (typeof onPlats === "function") onPlats(v);
        }}
      />
    ) : null;
  // ⛔ HUVUDET ÄR MEDDELANDENS (0.102.0, CP 2026-10-14: "Kolla header panelen på chatt. Den är mycket tunnare och bättre än
  // bibliotek. Gör dessa enhetliga"): ikonen, "Bibliotek", platsen som piller och kugghjulet på en rad. Raden "N objekt" är
  // borta: antalet står redan i fliken Allt, och två ställen för samma tal är två ställen som kan säga olika (regel 2).
  const atgard =
    platsValjare || visaKnapp ? (
      <>
        {platsValjare}
        {visaKnapp ? <ModulLageKnapp ram={ram} activeHref={/** @type {string} */ (activeHref)} onNavigate={onNavigate} sprak={sprak} installningar={false} /> : null}
      </>
    ) : null;
  const listTillbaka = inbaddad
    ? undefined
    : {
        ...modulTillbaka({ namn: "Bibliotek", hubHref: /** @type {string} */ (hubHref), hubEtikett, onNavigate, sprak, modulId, ikon: <Library size={18} /> }),
        ...(atgard ? { atgard } : {}),
      };

  // ⛔ DETALJEN HAR SIN EGEN TILLBAKA, TILL LISTAN. Två "Tillbaka" på samma sida, en till hubben och en till listan, hade
  // lämnat läsaren att gissa vilken som är vilken. Knappen är `TillbakaKnapp`, inte en egen spökknapp.
  // Inställningsläget vinner över detaljen: länken från arket öppnar inställningarna, inte posten.
  const Rot = inbaddad ? InbaddadRot : OpsView;
  return (
    <Rot tillbaka={detalj ? undefined : listTillbaka}>
      <div data-bibliotek="" className="flex min-w-0 w-full flex-col gap-4">
        {detalj ? (
          <Detalj key={`${skaparTyp ?? ""}:${vald?.id ?? ""}:${startLage}`} post={vald ? medFyll(poster.find((p) => p.id === vald.id) ?? vald) : null} skapar={skaparTyp} startLage={startLage} onStang={onStang} onSpara={onSpara} onLaddaUpp={onLaddaUpp} filUrl={filUrl} adressFor={adressFor} onLjus={setLjus} onSkrivUt={onSkrivUt} onAnteckningAvUtskrift={onAnteckningAvUtskrift} menyFor={menyFor} onMeta={togMeta} tillbakaEtikett={inbaddad ? "Filer" : "Tillbaka"} />
        ) : (
          <div data-bibliotek-huvud="" className="flex min-w-0 flex-col gap-3">
            {/* ⛔ SESSIONSTUDIOS HUVUD, SOM I APPEN (0.102.0, CP 2026-10-14 med skärmbilder från SessionStudios app: "Listningen
                och taggar i föregående bild."): sök, "+ Ny" och Taggar på en rad, och flikarna som en rad man rullar i sidled.
                Platsen som piller står i vyns huvud, bredvid kugghjulet. */}
            {inbaddad ? null : <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1">
                <OpsInput value={sok} onChange={setSok} type="search" ariaLabel="Sök i biblioteket" placeholder="Sök..." />
              </div>
              {jag ? (
                <NyKnapp
                  flik={aktivFlik}
                  onSkapa={onSkapa}
                  erbjudRost={erbjudRost}
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
              <TaggFilter taggar={gruppensTaggar} valda={valda} onValda={setValdaTaggar} />
            </div>}
            <Tabs.Root value={aktivFlik} onValueChange={(v) => setFlik(/** @type {Flik} */ (v))} className="flex min-w-0 flex-col gap-3">
            {inbaddad ? null : <Flikar flikar={synligaFlikar} antal={antal} />}
            {rostFel ? <p role="alert">{rostFel}</p> : null}
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
            <Tabs.Content value={aktivFlik} data-bibliotek-panel="" aria-label={FLIKAR.find((f) => f.id === aktivFlik)?.namn ?? "Allt"} className="flex min-w-0 flex-col gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {fel ? (
                <p role="alert" data-bibliotek-fel="">{fel}</p>
              ) : laddar ? (
                <OpsEmpty busy title={inbaddad ? "Hämtar filerna" : "Hämtar biblioteket"} />
              ) : synliga.length === 0 ? (
                <OpsEmpty
                  icon={inbaddad || sok || valda.length > 0 ? null : <Library size={28} />}
                  title={inbaddad ? "Inga filer än." : sok || valda.length > 0 ? "Inga träffar." : poster.length === 0 ? "Biblioteket är tomt." : "Inget här ännu."}
                  description={inbaddad ? (tomText ?? TOM_FILER_FORVAL) : sok ? `Inget matchar "${sok}"${valda.length > 0 ? ` med ${valda.join(" och ")}` : ""}.` : valda.length > 0 ? `Inget här har ${valda.join(" och ")}.` : "Lägg till en anteckning, en länk, ett ljud eller en fil."}
                />
              ) : (
                <ul aria-label="Biblioteket" data-bibliotek-lista="" className="m-0 flex list-none flex-col gap-3 p-0">
                  {synliga.map((rad) => {
                    const post = medFyll(rad);
                    const kanAndra = farAndra(rad, jag);
                    return (
                      <BibliotekKort
                        key={post.id}
                        post={post}
                        lage={adressFor(post)}
                        meny={menyFor(rad, false)}
                        svep={svepFor(rad)}
                        delad={delningar.some((d) => d.postId === rad.id)}
                        onOppna={() => oppnaMed(rad, "las")}
                        onMeta={togMeta}
                        taggrad={(
                          <TaggRad
                            post={rad}
                            kanAndra={kanAndra}
                            forslag={gruppensTaggar.map((g) => g.tagg)}
                            valda={valda}
                            onFilter={(t) => setValdaTaggar(valda.includes(t) ? valda.filter((x) => x !== t) : [...valda, t])}
                            onSpara={onSpara}
                          />
                        )}
                      />
                    );
                  })}
                </ul>
              )}
            </Tabs.Content>
            </Tabs.Root>
            {status ? <p role="status">{status}</p> : null}
          </div>
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
        open={delarLank !== null}
        onOpenChange={(oppen) => { if (!oppen) setDelarLank(null); }}
        title="Dela länk"
        size="sm"
      >
        {delarLank && typeof onDelaLank === "function" && typeof onAndraNedladdning === "function" && typeof onAterkalla === "function" ? (
          <DelaLankKontroll
            key={delarLank.id}
            post={delarLank}
            gruppnamn={[...platser, ...grupper].find((g) => g.id === delarLank.groupId)?.namn ?? gruppnamnProp}
            gruppdelForslag={delningGruppdel}
            delningar={delningar}
            onDelaLank={onDelaLank}
            onAndraNedladdning={onAndraNedladdning}
            onAterkalla={onAterkalla}
            onKlar={(text) => {
              setDelarLank(null);
              setStatus(text);
            }}
          />
        ) : <p>Ingen post vald.</p>}
      </OpsModal>
      <OpsModal
        open={delar !== null}
        onOpenChange={(oppen) => { if (!oppen) setDelar(null); }}
        title={delar && arMittBibliotek(delar.groupId) ? "Dela med en grupp" : delar && Boolean(jag) && delar.skapadAv?.uid === jag?.uid ? "Flytta eller kopiera" : "Kopiera"}
        size="sm"
      >
        {delar ? (
          <DelaKontroll
            id={delar.id}
            // Författaren ser Mitt bibliotek bland platserna (0.102.0): kopian dit flyttade hit ur menyn, för att korta den.
            grupper={grupper.filter((g) => g.id !== delar.groupId && (!arMittBibliotek(g.id) || (Boolean(jag) && delar.skapadAv?.uid === jag?.uid)))}
            kanFlytta={Boolean(jag) && delar.skapadAv?.uid === jag?.uid}
            onDela={onDela}
            onStart={(id) => setFlyttar((f) => (f.includes(id) ? f : [...f, id]))}
            onSlut={(id) => setFlyttar((f) => f.filter((x) => x !== id))}
            onKlar={(text) => {
              setDelar(null);
              setStatus(text);
            }}
          />
        ) : <p>Ingen post vald.</p>}
      </OpsModal>
    </Rot>
  );
}

/**
 * Roten när biblioteket ligger inbäddat i en annan vy (0.121.0): ingen `OpsView`-ram med sina marginaler och sin tillbaka-rad, bara en kolumn
 * som tar den bredd värden ger.
 * @param {{ children: import("react").ReactNode }} props
 */
function InbaddadRot({ children }) {
  return (
    <div data-bibliotek-inbaddad="" className="flex min-w-0 w-full flex-col gap-4">
      {children}
    </div>
  );
}

/**
 * "+ Ny" som i SessionStudios app: en knapp med kant och hörn som fälten, inte ett piller (0.102.0). `knappKlass` ritar alltid ett
 * piller, och på en telefon bröt pillret raden med sök och Taggar till två.
 */
/** Meningen under "Inga filer än." i den inbäddade listan när appen inte säger något annat (`tomText`). Händelsens, eftersom det var den första. */
const TOM_FILER_FORVAL = "Filer som läggs till här hör bara till händelsen.";

const NY_KLASS = "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-transparent px-4 text-etikett font-medium text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
 * @typedef {{ lage: "klar" | "hamtar" | "fel" | "saknas" | "avbruten", adress: string, fel: string }} Adresslage
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
  // ⛔ EN UPPLADDNING SOM ALDRIG BLEV KLAR HÄMTAR INTE FÖR ALLTID (granskningen av PR 408). `klar: false` hoppar över hämtningen, och
  // utan en gräns stod "Hämtar filen." kvar för alla medlemmar när fliken stängts mitt i. Efter `UPPLADDNING_MAX_MS` säger posten det.
  if (uppladdningAvbruten(/** @type {any} */ (post))) return { lage: "avbruten", adress: "", fel: TEXT_AVBRUTEN };
  const synk = postAdress(post, filUrl);
  if (synk) return { lage: "klar", adress: synk, fel: "" };
  const sokvag = typeof post?.fil?.sokvag === "string" ? post.fil.sokvag.trim() : "";
  if (!sokvag || typeof hamtaAdress !== "function") return { lage: "saknas", adress: "", fel: "" };
  if (cache.klar[sokvag]) return { lage: "klar", adress: cache.klar[sokvag], fel: "" };
  if (cache.fel[sokvag]) return { lage: "fel", adress: "", fel: cache.fel[sokvag] };
  return { lage: "hamtar", adress: "", fel: "" };
}

/** Texten på en post vars uppladdning avbröts. Står i listan och i detaljen, och aldrig som "Hämtar". */
const TEXT_AVBRUTEN = "Uppladdningen blev inte klar";

/** Väntan i ms före varje nytt försök när filen ännu inte finns i lagringen. */
const SAKNAS_FORSOK = [1500, 3000, 6000];

/**
 * Ritar om vid den tidpunkt en pågående uppladdning räknas som avbruten (granskningen av PR 408). Ingenting i posten ändras då, så utan
 * en egen väckning hade "Hämtar" stått kvar tills något annat ritade om. Ger ingenting tillbaka: `losAdress` läser klockan själv.
 *
 * @param {readonly { typ?: string, skapad?: unknown, fil?: { klar?: unknown } }[]} poster
 * @param {{ typ?: string, skapad?: unknown, fil?: { klar?: unknown } } | null} vald
 */
function useUppladdningsklocka(poster, vald) {
  const [, setTick] = useState(0);
  const underlag = vald ? [...poster, vald] : poster;
  const tider = underlag.map((p) => uppladdningenAvbrytsKl(/** @type {any} */ (p))).filter((t) => t !== null);
  const narmast = tider.length > 0 ? Math.min(.../** @type {number[]} */ (tider)) : null;
  useEffect(() => {
    if (narmast === null) return undefined;
    const vantan = Math.max(0, narmast - Date.now());
    const t = setTimeout(() => setTick((n) => n + 1), vantan);
    return () => clearTimeout(t);
  }, [narmast]);
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
      // ⛔ EN FIL SOM INTE ÄR KLAR HÄMTAS INTE (CP 2026-10-18). Posten syns direkt, byte kommer sekunder senare. Nyckeln ändras när
      // `klar` blir sann, och då hämtas adressen.
      if (/** @type {any} */ (post)?.fil?.klar === false) return "";
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
      /*
       * ⛔ "FINNS INTE" FÖRSÖKS IGEN (CP 2026-10-18, NewRecord.Song1.ver5). Mätt i lifehub-my: posten skrevs 00:13:33 och filen
       * fanns 00:13:35, hel. Listan hämtade adressen under de två sekunderna, fick storage/object-not-found och sparade felet för
       * sökvägen, så det stod kvar fast filen kom. Äldre poster utan `klar` får därför tre nya försök innan felet visas.
       */
      const forsok = async () => {
        for (let i = 0; ; i++) {
          try {
            return await hamta(s);
          } catch (e) {
            const kod = e && typeof e === "object" ? /** @type {any} */ (e).code : "";
            if (kod !== "storage/object-not-found" || i >= SAKNAS_FORSOK.length || !kvar) throw e;
            await new Promise((r) => setTimeout(r, SAKNAS_FORSOK[i]));
          }
        }
      };
      Promise.resolve()
        .then(forsok)
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
          setFel((f) => ({ ...f, [s]: filadressFel(e) }));
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
 * @typedef {"alla" | "ljud" | "anteckning" | "bild" | "fil" | "lank"} Flik
 */

/**
 * Flikarna i SessionStudios ordning (0.102.0): Allt, Inspelningar, Anteckningar, Bilder, Dokument och Länkar. "Ljud" heter så här
 * och inte "Inspelningar", eftersom en uppladdad ljudfil hamnar där med. `alltid` är de två som syns också när de är tomma: Allt,
 * och Ljud, som SessionStudio, så att det finns en väg till en röstinspelning innan den första finns.
 *
 * @type {ReadonlyArray<{ id: Flik, namn: string, ikon: import("react").ReactNode, alltid?: boolean }>}
 */
const FLIKAR = [
  { id: "alla", namn: "Allt", ikon: <Library size={16} aria-hidden="true" />, alltid: true },
  { id: "ljud", namn: "Ljud", ikon: <Mic size={16} aria-hidden="true" />, alltid: true },
  { id: "anteckning", namn: "Anteckningar", ikon: <FileText size={16} aria-hidden="true" /> },
  { id: "bild", namn: "Bilder", ikon: <BildIkon size={16} aria-hidden="true" /> },
  { id: "fil", namn: "Dokument", ikon: <FilIkon size={16} aria-hidden="true" /> },
  { id: "lank", namn: "Länkar", ikon: <Globe size={16} aria-hidden="true" /> },
];

/**
 * Taggfärgerna som verktygsklasser. Skrivna ut ord för ord: Tailwind läser källan och bygger bara de klasser som står i den.
 * `taggfarg` ger 1 till 8.
 */
const TAGGBAKGRUND = ["bg-tagg-1", "bg-tagg-2", "bg-tagg-3", "bg-tagg-4", "bg-tagg-5", "bg-tagg-6", "bg-tagg-7", "bg-tagg-8"];

/** @param {string} tagg */
const taggKlass = (tagg) => TAGGBAKGRUND[taggfarg(tagg) - 1];

/**
 * Flikarna som i SessionStudios app: en rad man rullar i sidled, med ikon, namn och antal, och den valda på en ljusare platta.
 *
 * ⛔ DET HÄR ÄR INTE EKONOMINS FLIKRAD LÄNGRE (0.102.0). CP 2026-10-08 bad om navigering "på liknande sätt" som Ekonomi, och
 * 0.83.0 gav Biblioteket Ekonomis `OpsTabs`. CP 2026-10-14, med SessionStudios bibliotek bredvid: "Det måste se ut exakt som
 * SessionStudio." Det senare beslutet gäller, och tillbaka-raden och rytmen från 0.83.0 står kvar.
 *
 * ⛔ OCKSÅ PÅ TELEFONEN EN RAD, INTE EN VÄLJARE. SessionStudios webb gör flikarna till en rullgardin på smal skärm, men appen, som
 * CP visade, har raden. En rad visar alla typer och antalen utan ett extra tryck.
 *
 * @param {{ flikar: ReadonlyArray<{ id: Flik, namn: string, ikon: import("react").ReactNode }>, antal: Record<Flik, number> }} props
 */
function Flikar({ flikar, antal }) {
  /*
   * ⛔ RADIX TABS, INTE HANDBYGGDA FLIKAR (granskningen av PR 366, MÅSTE 3). Raden hade `role="tablist"` och `role="tab"` men
   * inga piltangenter, ingen Home och End, ingen rörlig `tabIndex` och ingen `aria-controls`: skärmläsaren sade "flik 1 av 6" och
   * pilarna gjorde ingenting. `OpsTabs` säger samma sak i sitt filhuvud. Utseendet är SessionStudios piller, beteendet Radix.
   */
  return (
    // Raden tonar ut mot högerkanten, som SessionStudios där sista fliken är avklippt: annars syns det inte att fler flikar finns
    // när raden slutar jämnt vid en flik (granskningen av PR 366, montaget).
    <Tabs.List aria-label="Typ i biblioteket" data-bibliotek-flikar="rad" className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none]">
      {flikar.map((f) => (
        <Tabs.Trigger
          key={f.id}
          value={f.id}
          className={cx(
            "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-4 text-etikett font-medium",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
            "text-ink-muted hover:text-ink-secondary data-[state=active]:bg-raised data-[state=active]:text-ink",
          )}
        >
          {f.ikon}
          <span>{f.namn}</span>
          <span className="tabular-nums">{antal[f.id]}</span>
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
}

/**
 * Pilarna i en meny (#372): upp och ned flyttar fokus mellan raderna, Home och End till första och sista, och det slår runt.
 * Tab och Enter fungerar som förut. En egen liten hanterare i stället för Radix DropdownMenu, så att Popover, bocken och
 * "Rensa alla" står kvar som de är.
 *
 * @param {import("react").KeyboardEvent<HTMLElement>} e
 */
export function menyPilar(e) {
  const rader = /** @type {HTMLElement[]} */ ([...e.currentTarget.querySelectorAll('[role^="menuitem"]')]);
  if (rader.length === 0) return;
  const nu = rader.indexOf(/** @type {HTMLElement} */ (document.activeElement));
  let till = -1;
  if (e.key === "ArrowDown") till = nu < 0 ? 0 : (nu + 1) % rader.length;
  else if (e.key === "ArrowUp") till = nu < 0 ? rader.length - 1 : (nu - 1 + rader.length) % rader.length;
  else if (e.key === "Home") till = 0;
  else if (e.key === "End") till = rader.length - 1;
  if (till < 0) return;
  e.preventDefault();
  rader[till].focus();
}

/**
 * Platsen som ett piller med reglage-ikonen, och en lista med platserna under (SessionStudios "My Library" i appen). Den valda
 * har en bock.
 *
 * @param {{ platser: readonly { id: string, namn: string }[], plats: string, onPlats: (id: string) => void }} props
 */
export function PlatsValjare({ platser, plats, onPlats }) {
  const [oppen, setOppen] = useState(false);
  const namn = platser.find((p) => p.id === plats)?.namn ?? plats;
  return (
    <div data-bibliotek-plats={arMittBibliotek(plats) ? "mitt" : "grupp"} className="min-w-0">
      <Popover.Root open={oppen} onOpenChange={setOppen}>
        <Popover.Trigger
          aria-label={`Vilket bibliotek: ${namn}`}
          className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-full border border-ink-secondary px-4 text-etikett font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <SlidersHorizontal size={18} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 truncate">{namn}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={4} collisionPadding={8} className={cx("z-(--z-dropdown) min-w-56 p-1", radBehallare())}>
            <div role="menu" aria-label="Vilket bibliotek" onKeyDown={menyPilar}>
              {platser.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={p.id === plats}
                  onClick={() => {
                    setOppen(false);
                    if (p.id !== plats) onPlats(p.id);
                  }}
                  className={radKlass({ stor: true })}
                >
                  <span className="min-w-0 flex-1 truncate">{p.namn}</span>
                  {p.id === plats ? <Check size={16} aria-hidden="true" className="shrink-0 text-accent" /> : null}
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

/**
 * "Taggar" bredvid sökfältet: alla taggar i platsen med färg och antal, flerval, och "Rensa alla" (SessionStudios
 * `TagFilterDropdown`). Valda taggar är "OCH", som i `filtreraBibliotek`.
 *
 * ⛔ TOMT ÄR ETT SVAR (regel 5): utan taggar säger panelen det. SessionStudio skrev "Alla taggar" två gånger där.
 *
 * @param {{ taggar: ReadonlyArray<{ tagg: string, antal: number }>, valda: readonly string[], onValda: (valda: string[]) => void }} props
 */
export function TaggFilter({ taggar, valda, onValda }) {
  const [oppen, setOppen] = useState(false);
  const aktiv = valda.length > 0;
  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        data-bibliotek-taggfilter=""
        aria-label={aktiv ? `Taggar, ${valda.length} valda` : "Taggar"}
        className={cx(
          "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-4 text-etikett font-medium",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          aktiv ? "border-transparent bg-accent text-accent-contrast" : "border-line bg-raised text-ink hover:bg-hover",
        )}
      >
        <span>{aktiv ? `Taggar (${valda.length})` : "Taggar"}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} collisionPadding={8} className={cx("z-(--z-dropdown) w-64 max-w-[calc(100vw-1rem)] p-2", radBehallare())}>
          <div className="flex items-center justify-between gap-2 border-b border-line px-1 pb-2">
            <span className="text-meta font-medium text-ink-secondary">Alla taggar</span>
            {aktiv ? (
              <button type="button" onClick={() => onValda([])} className="cursor-pointer rounded-sm bg-transparent text-meta font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent">
                Rensa alla
              </button>
            ) : null}
          </div>
          {taggar.length === 0 ? (
            <p className="m-0 px-1 pt-2 text-meta text-ink-muted">Inga taggar ännu. Lägg till en på en post.</p>
          ) : (
            <div role="menu" aria-label="Taggar" onKeyDown={menyPilar} className="flex max-h-64 flex-col overflow-y-auto pt-1">
              {taggar.map(({ tagg, antal: n }) => {
                const pa = valda.includes(tagg);
                return (
                  <button
                    key={tagg}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={pa}
                    onClick={() => onValda(pa ? valda.filter((t) => t !== tagg) : [...valda, tagg])}
                    className={cx(radKlass(), pa && "bg-accent-subtle")}
                  >
                    <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", taggKlass(tagg))} />
                    <span className="min-w-0 flex-1 truncate">{tagg}</span>
                    <span className="shrink-0 text-hjalp text-ink-muted tabular-nums">{n}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Postens taggar som färgade piller, med ett kryss som tar bort och "Lägg till tagg" som öppnar ett fält på raden
 * (SessionStudios `TagChipRowEditable`). Ett tryck på en tagg filtrerar listan på den, och ett tryck till tar bort filtret.
 *
 * ⛔ ETT FEL SYNS OCH TAGGARNA GÅR TILLBAKA. Taggen visas direkt när den läggs till eller tas bort, och faller sparandet visas
 * felet under raden och listan står som den var. En tagg som ser sparad ut och inte är det hade varit en tyst nedsläppsväg.
 *
 * ⛔ SAMMA RÄTT SOM BYT NAMN: `kanAndra` är `farAndra`, författaren och admin. Andra ser taggarna och kan filtrera på dem.
 *
 * @param {{ post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }, kanAndra: boolean, forslag: readonly string[], valda?: readonly string[], onFilter?: (tagg: string) => void, onSpara?: (inmatning: { id?: string, taggar?: string[] }) => void | boolean | Promise<void | boolean> }} props
 */
function TaggRad({ post, kanAndra, forslag, valda = [], onFilter, onSpara }) {
  const sparade = Array.isArray(post.taggar) ? post.taggar : [];
  const [visas, setVisas] = useState(/** @type {string[] | null} */ (null));
  const [skriver, setSkriver] = useState(false);
  const [utkast, setUtkast] = useState("");
  // ⛔ ESCAPE AVBRYTER, ÄVEN OM FÄLTET SEDAN TAPPAR FOKUS. Fältet tas bort i samma rendering som Escape, och en webbläsare som
  // skickar blur då hade sett det gamla utkastet i `onBlur` och sparat taggen man just avbröt.
  const avbruten = useRef(false);
  const [fel, setFel] = useState("");
  const lista = visas ?? sparade;

  /** @param {string[]} ny */
  const spara = (ny) => {
    const problem = taggarFel(ny);
    if (problem) {
      setFel(problem);
      return;
    }
    if (typeof onSpara !== "function") {
      setFel("Sparandet är inte kopplat. Taggarna ändrades inte.");
      return;
    }
    setFel("");
    setVisas(ny);
    Promise.resolve()
      .then(() => onSpara({ id: post.id, taggar: ny }))
      .then(
        (svar) => {
          if (svar === false) throw new Error("Taggarna kunde inte sparas.");
          setVisas(null);
        },
        (e) => {
          throw e;
        },
      )
      .catch((e) => {
        setVisas(null);
        setFel(e instanceof Error && e.message ? e.message : String(e));
      });
  };
  /** @param {string} ord */
  const laggTill = (ord) => {
    const nya = normaliseraTaggar(ord.split(","));
    if (nya.length === 0) return;
    const ny = normaliseraTaggar([...lista, ...nya]);
    setUtkast("");
    if (ny.length === lista.length) return;
    spara(ny);
  };
  const forslagen = forslag.filter((t) => !lista.includes(t) && t.includes(normaliseraTagg(utkast))).slice(0, 8);
  // ⛔ TAGGFÖRSLAGEN MED TANGENTBORDET (#372): pil upp och ned flyttar markeringen i förslagen, Enter väljer den. Fokus stannar i
  // fältet (aria-activedescendant), så Tab gör inte blur för att nå ett förslag.
  const [aktivt, setAktivt] = useState(-1);
  const listId = useId();
  const markerat = aktivt >= 0 && aktivt < forslagen.length ? aktivt : -1;
  if (!kanAndra && lista.length === 0) return null;
  return (
    <div data-bibliotek-taggar="" className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {lista.map((t) => (
          <span key={t} data-bibliotek-tagg={t} className={cx("pointer-events-auto inline-flex h-7 max-w-full items-center rounded-full text-meta font-medium text-tagg-text", taggKlass(t))}>
            {typeof onFilter === "function" ? (
              <button
                type="button"
                onClick={() => onFilter(t)}
                aria-pressed={valda.includes(t)}
                aria-label={`Visa bara ${t}`}
                className={cx("h-full min-w-0 cursor-pointer truncate rounded-full bg-transparent pl-2.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent", kanAndra ? "pr-0.5" : "pr-2.5")}
              >
                {t}
              </button>
            ) : (
              <span className={cx("min-w-0 truncate pl-2.5", kanAndra ? "pr-0.5" : "pr-2.5")}>{t}</span>
            )}
            {kanAndra ? (
              <button
                type="button"
                aria-label={`Ta bort taggen ${t}`}
                onClick={() => spara(lista.filter((x) => x !== t))}
                className="mr-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X size={12} aria-hidden="true" />
              </button>
            ) : null}
          </span>
        ))}
        {kanAndra && lista.length < MAX_TAGGAR ? (
          skriver ? (
            <span className="pointer-events-auto relative inline-flex">
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus -- fältet öppnas av ett tryck på "Lägg till tagg", och fokus ska följa med
                autoFocus
                value={utkast}
                maxLength={MAX_TAGGLANGD}
                aria-label="Ny tagg"
                placeholder="tagg"
                aria-autocomplete="list"
                aria-controls={forslagen.length > 0 ? listId : undefined}
                aria-activedescendant={markerat >= 0 ? `${listId}-${markerat}` : undefined}
                onChange={(e) => {
                  const v = e.target.value;
                  setAktivt(-1);
                  if (v.endsWith(",")) laggTill(v);
                  else setUtkast(v);
                }}
                onKeyDown={(e) => {
                  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && forslagen.length > 0) {
                    e.preventDefault();
                    const steg = e.key === "ArrowDown" ? 1 : -1;
                    setAktivt((markerat + steg + forslagen.length + (markerat < 0 && steg < 0 ? 1 : 0)) % forslagen.length);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    setAktivt(-1);
                    laggTill(markerat >= 0 ? forslagen[markerat] : utkast);
                  } else if (e.key === "Escape") {
                    avbruten.current = true;
                    setUtkast("");
                    setSkriver(false);
                  } else if (e.key === "Backspace" && utkast === "" && lista.length > 0) {
                    spara(lista.slice(0, -1));
                  }
                }}
                onBlur={() => {
                  if (!avbruten.current && normaliseraTagg(utkast)) laggTill(utkast);
                  avbruten.current = false;
                  setSkriver(false);
                }}
                className="h-8 w-36 rounded-full border border-line bg-transparent px-3 text-meta text-ink outline-none focus:border-accent"
              />
              {forslagen.length > 0 ? (
                <span id={listId} role="listbox" aria-label="Förslag" className={cx("absolute top-9 left-0 z-(--z-dropdown) flex min-w-32 flex-col p-1", radBehallare())}>
                  {forslagen.map((t, i) => (
                    <button
                      key={t}
                      id={`${listId}-${i}`}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={i === markerat}
                      data-markerat={i === markerat ? "" : undefined}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => laggTill(t)}
                      className={radKlass({ active: i === markerat })}
                    >
                      <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", taggKlass(t))} />
                      <span className="min-w-0 flex-1 truncate">{t}</span>
                    </button>
                  ))}
                </span>
              ) : null}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFel("");
                avbruten.current = false;
                setSkriver(true);
              }}
              className="pointer-events-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-ink-muted/50 bg-transparent px-3 text-meta font-medium text-ink-secondary hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              <Tag size={14} aria-hidden="true" />
              {lista.length === 0 ? "Lägg till tagg" : "Tagg"}
            </button>
          )
        ) : null}
      </div>
      {fel ? <p role="alert" className="pointer-events-auto m-0 text-meta text-danger">{fel}</p> : null}
    </div>
  );
}

/**
 * Typens ikon i typens färg, 16 px och utan ruta (SessionStudios `LibraryRow`). Bilden fyller en ruta i stället.
 *
 * @param {{ post: { typ: string, fil?: { mime?: string } } }} props
 */
function TypIkon({ post }) {
  if (post.typ === "fil") {
    const sort = filSort(post.fil?.mime);
    if (sort === "ljud") return <Mic size={20} aria-hidden="true" className="text-typ-ljud" />;
    if (sort === "bild") return <BildIkon size={20} aria-hidden="true" className="text-typ-lank" />;
    if (sort === "video") return <VideoIkon size={20} aria-hidden="true" className="text-ink-secondary" />;
    return <FilIkon size={20} aria-hidden="true" className="text-ink-secondary" />;
  }
  if (post.typ === "lank") return <Globe size={20} aria-hidden="true" className="text-typ-lank" />;
  return <FileText size={20} aria-hidden="true" className="text-typ-anteckning" />;
}

/**
 * Plattan bakom ikonen, i typens ton (SessionStudios app): ljud rosa, länk och bild blå, anteckning lila, dokument neutral.
 *
 * @param {{ typ: string, fil?: { mime?: string } }} post
 */
function plattKlass(post) {
  if (post.typ === "fil") {
    const sort = filSort(post.fil?.mime);
    if (sort === "ljud") return "bg-typ-ljud/15";
    if (sort === "bild") return "bg-typ-lank/15";
    return "bg-raised";
  }
  if (post.typ === "lank") return "bg-typ-lank/15";
  return "bg-typ-anteckning/15";
}

/**
 * Typetiketten i versaler och i singular, som i SessionStudios app ("SONG", "RECORDING · M4A"): "ANTECKNING", "LÄNK",
 * "LJUD · WEBM", "BILD · HEIC", "DOKUMENT · PDF". Ändelsen ur filnamnet, annars ur MIME.
 *
 * @param {{ typ: string, fil?: { namn?: string, mime?: string } }} post
 */
function typEtikett(post) {
  if (post.typ === "anteckning") return "Anteckning";
  if (post.typ === "lank") return "Länk";
  const sort = filSort(post.fil?.mime);
  const namn = sort === "ljud" ? "Ljud" : sort === "bild" ? "Bild" : sort === "video" ? "Video" : "Dokument";
  const ur = /\.([a-z0-9]{1,6})$/i.exec(post.fil?.namn ?? "")?.[1] ?? /\/([a-z0-9.+-]+)$/i.exec(post.fil?.mime ?? "")?.[1]?.replace(/^x-/, "") ?? "";
  return ur ? `${namn} · ${ur}` : namn;
}

/**
 * Förhandsvisningen under typetiketten: anteckningens text och länkens adress. Filer har ingen, deras namn står i rubriken.
 *
 * @param {{ typ: string, text?: string, url?: string }} post
 */
function forhandsText(post) {
  if (post.typ === "anteckning") return (post.text ?? "").replace(/[#*_`>[\]()]/g, "").replace(/\s+/g, " ").trim();
  if (post.typ === "lank") return post.url ?? "";
  return "";
}

/**
 * Metaraden: storlek, längd och datum. Längden som "1:04" och inte som SessionStudios "64", som är sekunder utan enhet.
 *
 * @param {{ typ: string, skapad?: number, andrad?: number, durationMs?: number, fil?: { byte?: number, mime?: string } }} post
 */
function kortMeta(post) {
  const delar = [];
  if (post.typ === "fil") {
    const storlek = filStorlek(post.fil?.byte);
    if (storlek) delar.push(storlek);
  }
  const ms = post.durationMs;
  if (arLjudpost(post) && Number.isInteger(ms) && /** @type {number} */ (ms) > 0) delar.push(formateraTid(/** @type {number} */ (ms) / 1000));
  const datum = ljudDatum(arLjudpost(post) ? post.skapad : post.andrad ?? post.skapad);
  if (datum) delar.push(datum);
  return delar;
}

/**
 * Ett kort i listan, SessionStudios rad (0.102.0): typens ikon i typens färg, rubriken, taggarna som färgade piller,
 * typetiketten i versaler, en förhandsvisning och en metarad. Varje post är ett eget kort med luft emellan, ingen avdelare.
 *
 * ⛔ HELA KORTET ÖPPNAR, OCH TAGGARNA GÅR ÄNDÅ ATT TRYCKA PÅ. En knapp som täcker kortet ligger under innehållet, och innehållet
 * släpper igenom trycket (`pointer-events-none`) utom taggarna och fältet. En knapp runt allt hade gjort taggarnas knappar till
 * knappar i en knapp, och det är ogiltigt och går inte att nå med tangentbordet.
 *
 * ⛔ LJUDET SPELAS PÅ KORTET (lifehub.app#163), men kortet är format som de andra (0.102.0): en liten spelknapp där ikonen står,
 * och längden i metaraden som "1:04". Förut hade ljudet en egen rad med stor knapp och våg, och listan såg ut som två listor.
 * Vågen, hoppen och hastigheten finns i detaljen.
 *
 * ⛔ EN DELAD POST BÄR EN LITEN MARKERING (0.119.0, lifehub.app#356): ordet "Delad" med en länkikon i metaraden. Den som ser listan ska inte
 * behöva öppna en meny för att veta vad som har en publik länk, och ikonen ensam säger det inte.
 *
 * @param {{ post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }, lage: Adresslage, meny: import("./OpsAtgardsblad.jsx").Atgard[], svep: any[], onOppna: () => void, onMeta: (id: string, meta: { durationMs?: number, peaks?: string }) => void, taggrad: import("react").ReactNode, delad?: boolean }} props
 */
function BibliotekKort({ post, lage, meny, svep, onOppna, onMeta, taggrad, delad = false }) {
  const spelare = useSpelare();
  const ljud = arLjudpost(post);
  const bild = post.typ === "fil" && filSort(post.fil?.mime) === "bild";
  const namn = ljud ? ljudRubrik(post) : trimSomRegeln(post.rubrik) || "Post";
  const forhands = forhandsText(post);
  const meta = kortMeta(post);
  // Ljudet bär sin status i metaraden när adressen inte är klar: "Hämtar ljudet." eller felet. Aldrig tyst (regel 5).
  const [spelFel, setSpelFel] = useState("");
  const ljudStatus = ljud && lage.lage !== "klar" ? (lage.lage === "hamtar" ? "Hämtar ljudet." : lage.fel || "Filen har ingen adress.") : spelFel;
  // I skalet spelar ljudet i skalets spelare, med knappen till höger. Utanför skalet finns ingen spelrad, och kortet har då en egen
  // liten spelare där ikonen står.
  const iSkalet = Boolean(spelare);
  return (
    <OpsSvepRad kort atgarder={svep}>
      <OpsAtgardsblad kort namn={namn} poster={meny}>
        <div data-bibliotek-kort={ljud ? "ljud" : bild ? "bild" : post.typ === "fil" ? "dokument" : post.typ} className="relative flex min-w-0 flex-1 items-start gap-4">
          <button
            type="button"
            aria-label={namn}
            onClick={onOppna}
            className="absolute inset-0 z-0 cursor-pointer rounded-lg bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <span data-bibliotek-ikon={post.typ} className={cx("relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full", ljud && !iSkalet ? "" : "pointer-events-none", plattKlass(post))}>
            {ljud && !iSkalet && lage.lage === "klar" ? (
              <OpsLjudspelare
                liten
                src={lage.adress}
                namn={namn}
                durationMs={post.durationMs}
                peaks={post.peaks}
                styrId={post.id}
                onMeta={(inmata) => onMeta(post.id, inmata)}
                onFel={setSpelFel}
              />
            ) : bild && lage.lage === "klar" ? (
              <img src={lage.adress} alt="" aria-hidden="true" className="size-11 object-cover" />
            ) : (
              <span aria-hidden="true"><TypIkon post={post} /></span>
            )}
          </span>
          <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="block truncate text-brod font-medium text-ink">{namn}</span>
            <span data-bibliotek-typ="" className="text-meta tracking-wide text-ink-muted uppercase">{typEtikett(post)}</span>
            {taggrad}
            {forhands ? <span data-bibliotek-forhands-text="" className="line-clamp-2 text-meta text-ink-secondary wrap-anywhere">{forhands}</span> : null}
            {meta.length > 0 || delad ? (
              <span data-bibliotek-metarad="" className="flex flex-wrap gap-3 text-meta text-ink-muted">
                {meta.map((m) => <span key={m} data-ljud-langd={m.includes(":") ? "" : undefined}>{m}</span>)}
                {delad ? <span data-bibliotek-delad="" className="inline-flex items-center gap-1"><Link2 size={12} aria-hidden="true" />Delad</span> : null}
              </span>
            ) : null}
            {ljudStatus ? <span role={lage.lage === "hamtar" ? "status" : "alert"} className={cx("text-meta", lage.lage === "hamtar" ? "text-ink-secondary" : "text-danger")}>{ljudStatus}</span> : null}
          </div>
          {ljud && iSkalet && lage.lage === "klar" ? (
            <span className="relative shrink-0">
              <OpsSpelaKnapp
                spar={{
                  id: post.id,
                  namn,
                  src: lage.adress,
                  durationMs: post.durationMs,
                  peaks: post.peaks,
                  onMeta: (m) => onMeta(post.id, m),
                }}
              />
            </span>
          ) : null}
        </div>
      </OpsAtgardsblad>
    </OpsSvepRad>
  );
}

/**
 * Ikonen i detaljhuvudet, samma färg som på kortet. En bild fyller en ruta.
 *
 * @param {{ post: { typ: string, fil?: { mime?: string, sokvag?: string } }, bildAdress?: string }} props
 */
function PostMark({ post, bildAdress = "" }) {
  const bild = post.typ === "fil" && filSort(post.fil?.mime) === "bild";
  const adress = bild ? bildAdress : "";
  return (
    <span data-bibliotek-ikon={post.typ} className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-raised" aria-hidden="true">
      {adress ? <img src={adress} alt="" className="size-10 object-cover" /> : <TypIkon post={post} />}
    </span>
  );
}

/**
 * "+ Ny" bredvid sökfältet. Under Alla ett val mellan typerna, under en typ den typen direkt.
 *
 * ⛔ AVTRYCKAREN ÄR INTE EN `OpsButton` (`NY_KLASS`): Radix `Popover.Trigger` ritar sitt eget
 * `<button>`, och `OpsButton` har ingen `forwardRef`. Samma skäl som plusset i `OpsAppShell`.
 *
 * Röstinspelning ligger i menyn under Alla (0.90.8). Den öppnar skalets inspelare, inte en rad i listan.
 *
 * Under Bilder och Dokument skapas en fil (0.102.0): bild eller dokument avgörs av filen, inte av fliken.
 *
 * ⛔ UTAN MOTTAGARE FINNS INGEN RÖSTINSPELNING ATT ERBJUDA (`erbjudRost`, cllp/ops-framework#391): raden i menyn ritas inte, och i fliken
 * Ljud, där knappen bara gör det, ritas ingen knapp. Förut stod de kvar och gav skalets utvecklartext när gruppen inte hade appen.
 *
 * @param {{ flik: Flik, onSkapa: (typ: "anteckning" | "lank" | "fil") => void, onRost: () => void, erbjudRost: boolean }} props
 */
function NyKnapp({ flik, onSkapa, onRost, erbjudRost }) {
  const [oppen, setOppen] = useState(false);
  const innehall = (
    <>
      <Plus size={16} aria-hidden="true" />
      <span>Ny</span>
    </>
  );
  if (flik === "ljud") {
    if (!erbjudRost) return null;
    return (
      <button type="button" aria-label={NYTT_NAMN.ljud} onClick={onRost} className={NY_KLASS}>
        {innehall}
      </button>
    );
  }
  if (flik !== "alla") {
    const typ = flik === "bild" ? "fil" : flik;
    return (
      <button type="button" aria-label={NYTT_NAMN[typ]} onClick={() => onSkapa(typ)} className={NY_KLASS}>
        {innehall}
      </button>
    );
  }
  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger aria-label="Ny post" aria-haspopup="menu" className={NY_KLASS}>
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
                  {typ === "anteckning" ? <FileText size={16} /> : typ === "lank" ? <Globe size={16} /> : <FilIkon size={16} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{TYPNAMN[typ]}</span>
              </button>
            ))}
            {erbjudRost ? (
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
                  <Mic size={16} />
                </span>
                <span className="min-w-0 flex-1 truncate">Röstinspelning</span>
              </button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Bild öppnas i förhandsvisning. PDF och övrigt i ny flik. Utan adress sägs det.
 *
 * @param {{ post: { id?: string, typ?: string, rubrik?: string, skapad?: number, durationMs?: number, peaks?: string, fil?: { namn?: string, mime?: string, byte?: number, sokvag?: string } }, lage: Adresslage, kopplad: boolean, onLjus?: (adress: string) => void, onMeta?: (id: string, meta: { durationMs?: number, peaks?: string }) => void, onRadera?: () => void }} props
 */
function FilVisning({ post, lage, kopplad, onLjus, onMeta, onRadera }) {
  const spelare = useSpelare();
  const sort = filSort(post.fil?.mime);
  const namn = post.fil?.namn ?? "Fil";
  const rad = `${namn}${filStorlek(post.fil?.byte) ? ` · ${filStorlek(post.fil?.byte)}` : ""}`;
  // ⛔ EN AVBRUTEN UPPLADDNING SÄGER DET OCH ERBJUDER RADERA (granskningen av PR 408), för den som får radera posten. Den raderar via
  // postens egen meny-rad (`menyFor`), så behörigheten är densamma som där.
  if (lage.lage === "avbruten") {
    return (
      <div data-bibliotek-fil="" data-bibliotek-avbruten="" className="flex flex-col items-start gap-2">
        <p role="status">{lage.fel}</p>
        {onRadera ? <OpsButton variant="secondary" size="sm" onClick={onRadera}>Radera</OpsButton> : null}
      </div>
    );
  }
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
    // ⛔ I SKALET ÄR DETALJENS SPELARE SKALETS (0.102.0): vågen och kontrollerna styr spelraden, så ljudet spelar vidare när man
    // går tillbaka till listan. Utanför skalet spelar posten själv, som förut.
    if (spelare) {
      return <OpsSpelarKontroller spar={{ id, namn: rubrik, src: adress, durationMs: post.durationMs, peaks: post.peaks, onMeta: id && onMeta ? (m) => onMeta(id, m) : undefined }} />;
    }
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
  if (sort === "video") {
    // ⛔ EN VANLIG `<video controls playsinline>` UTAN EGEN SPELARE (CP 2026-10-19, cllp/lifehub.app#358). `playsInline` så att iPhone spelar
    // i sidan och inte tvingar helskärm. `preload="metadata"` hämtar bara första bilden och längden: en fil på 100 MB laddas inte ner av att
    // posten öppnas. Länken under är utvägen när webbläsaren inte kan avkoda filen (en iPhone-film i HEVC i en webbläsare utan stöd): då syns
    // en svart ruta, och utan länken finns ingenstans att gå.
    return (
      <div data-bibliotek-fil="" className="flex flex-col gap-2">
        <video data-bibliotek-video="" src={adress} controls playsInline preload="metadata" aria-label={post.rubrik ?? namn} className="block h-auto max-h-96 w-full rounded-lg bg-sunken" />
        <a href={adress} target="_blank" rel="noopener noreferrer" className="w-fit text-etikett text-accent underline underline-offset-2">
          {rad}
        </a>
      </div>
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
 * @param {"las" | "redigera"} props.startLage
 * @param {() => void} props.onStang
 * @param {(inmatning: { id?: string, typ: string, rubrik: string, text?: string, url?: string, fil?: { sokvag: string, namn: string, mime: string, byte: number } }) => void | boolean | Promise<void | boolean>} props.onSpara Kastar den eller avvisas löftet visas felet i formuläret och läget står kvar (0.93.0). `false` betyder att det inte gick.
 * @param {(inmatning: { id?: string, rubrik: string, fil: File }) => void | Promise<void>} [props.onLaddaUpp]
 * @param {(post: { fil?: { sokvag?: string } }) => string} [props.filUrl]
 * @param {(post: { typ?: string, skapad?: number, fil?: { sokvag?: string, mime?: string, klar?: boolean } }) => Adresslage} [props.adressFor]
 * @param {(adress: string) => void} [props.onLjus]
 * @param {(post: any) => Promise<void> | void} [props.onSkrivUt]
 * @param {(post: any) => Promise<void> | void} [props.onAnteckningAvUtskrift]
 * @param {(post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }, iDetalj: boolean, sattRedigera?: (lage: "redigera") => void) => import("./OpsAtgardsblad.jsx").Atgard[]} props.menyFor
 * @param {(id: string, meta: { durationMs?: number, peaks?: string }) => void} [props.onMeta]
 * @param {string} props.tillbakaEtikett (0.121.0) "Tillbaka", eller i en händelse "Filer". Inbäddad i en händelse heter den "Filer", så den inte förväxlas med panelens egen.
 */
function Detalj({ post, skapar, startLage, onStang, onSpara, onLaddaUpp, filUrl, adressFor, onLjus, onSkrivUt, onAnteckningAvUtskrift, menyFor, onMeta, tillbakaEtikett }) {
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

  const ljud = Boolean(post && post.typ === "fil" && filSort(post.fil?.mime) === "ljud");
  const rubrikVy = skapar ? (typ === "anteckning" ? "Ny anteckning" : typ === "lank" ? "Ny länk" : "Ny fil") : ljud && post ? ljudRubrik(post) : post?.rubrik ?? "Post";
  const tomLage = /** @type {Adresslage} */ ({ lage: "saknas", adress: "", fel: "" });
  const filLage = post && typeof adressFor === "function" ? adressFor({ typ: post.typ, fil: post.fil, skapad: post.skapad }) : tomLage;
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
    // ⛔ TOM RUBRIK PÅ EN NY ANTECKNING FÅR DATUM OCH TID (CP 2026-10-18), aldrig textens början. En skriven eller dikterad rubrik vinner.
    const anteckningsrubrik = typ === "anteckning" && skapar && !trimSomRegeln(rubrik) ? anteckningsrubrikNu() : rubrik;
    const inmatning = typ === "anteckning"
      ? { typ, rubrik: anteckningsrubrik, text, ...(post && !skapar ? { id: post.id } : {}) }
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

  const radera = post && !skapar ? menyFor(post, true, setLage).find((m) => m.id === "radera") : undefined;
  const lasning = typ === "anteckning" ? (
    post?.text ? <OpsMarkdown text={post.text} dokument /> : <p className="text-brod text-ink">Anteckningen har ingen text.</p>
  ) : typ === "fil" && post ? (
    <FilVisning post={post} lage={filLage} kopplad={kopplad} onLjus={onLjus} onMeta={onMeta} onRadera={radera ? radera.onValj : undefined} />
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
              const fel = filInmatningsfel({ namn: vald.name, mime: vald.type || mimeUrFilnamn(vald.name), byte: vald.size });
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
          <OpsInput value={url} onChange={setUrl} ariaLabel="Adress" placeholder="https://" tal={false} />
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
        tillbakaEtikett={tillbakaEtikett}
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
        <UtskriftKontroll post={post} onSkrivUt={onSkrivUt} onAnteckningAvUtskrift={onAnteckningAvUtskrift} />
      ) : null}
    </div>
  );
}

/**
 * Gemensamt detaljhuvud för alla typer: Tillbaka, ikon och ⋯ på en rad,
 * rubriken på egen rad med rollen `rubrik`, sedan metadata.
 *
 * @param {{ onTillbaka: () => void, tillbakaEtikett: string, ikon: import("react").ReactNode, rubrik: string, meta?: string, meny?: import("react").ReactNode }} props
 */
function BibliotekDetaljHuvud({ onTillbaka, tillbakaEtikett, ikon, rubrik, meta = "", meny = null }) {
  return (
    <header data-bibliotek-detaljhuvud="" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <TillbakaKnapp onClick={onTillbaka} etikett={tillbakaEtikett} className="self-start" />
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
 * Orden i utskriften på posten (0.115.0, cllp/lifehub.app#349), på båda språken.
 *
 * ⛔ BARA DE ORD SOM INTE REDAN FINNS I TALK. "Skriver ut…", Kopiera, Kopierat, urklippsfelet och "Anteckningen är sparad" står i `ORD_TALK`
 * och läses därifrån (`talkOrd`): samma ord för samma sak i fältet och på posten, och en text som inte kan stå på två ställen (regel 2).
 * @type {import("../lib/ord.js").Ordbok}
 */
const ORD_BIBLIOTEKUTSKRIFT = {
  skrivUt: { sv: "Skriv ut texten", en: "Write out the text" },
  tom: { sv: "Utskriften är tom.", en: "The transcript is empty." },
  felSkrivUt: { sv: "Ljudet gick inte att skriva ut.", en: "The recording could not be written out." },
  gorAnteckning: { sv: "Gör en anteckning av texten", en: "Make a note of the text" },
};

/**
 * Utskriften av ett ljud, på posten (0.115.0, cllp/lifehub.app#349; CP 2026-10-17: "när jag ska sjunga in en låt, och så får jag automatiskt
 * texten utskriven", och strax efter: "det kanske kan få vara ett val").
 *
 * ⛔ TEXTEN HÖR TILL POSTEN OCH LÄSES UR DEN. Servern skriver fältet `utskrift` (Admin SDK), så ljudet och texten är ett dokument (regel 2). Vyn
 * håller ingen egen kopia av texten: `onSkrivUt` löser till ingenting, och texten visas när posten läses om. Förut höll vyn en kopia i ett tillstånd
 * som inte följde med när posten ändrades någon annanstans.
 *
 * ⛔ RADBRYTNINGAR BEVARAS (`whitespace-pre-wrap`): en sång skrivs rad för rad, i verser, och ett stycke utan sina brytningar är en text ingen kan sjunga.
 *
 * ⛔ INGENTING FALLER TYST. Medan servern skriver ut står "Skriver ut…" på posten. Ett fel, också ett dygnstak, står på posten och knappen
 * finns kvar, så att det går att försöka igen. Har posten redan en text ritas ingen knapp: ett nytt tryck hade skrivit över den och räknats mot taket.
 * En tom utskrift är ett svar ("Utskriften är tom."), och där finns knappen kvar.
 *
 * @param {{ post: { id: string, utskrift?: string }, onSkrivUt?: (post: any) => Promise<void> | void, onAnteckningAvUtskrift?: (post: any) => Promise<void> | void }} props
 */
function UtskriftKontroll({ post, onSkrivUt, onAnteckningAvUtskrift }) {
  const sprak = useOpsSprak();
  /** @param {string} k */
  const o = (k) => ordet(ORD_BIBLIOTEKUTSKRIFT, k, sprak);
  const [pagar, setPagar] = useState(false);
  const [gorAnteckning, setGorAnteckning] = useState(false);
  const [fel, setFel] = useState("");
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);
  const anteckningKlar = useKortVisning(3000);
  const { kopierat, misslyckades, kopiera } = useKopiera("OpsBibliotek");
  const text = typeof post.utskrift === "string" ? post.utskrift : null;
  const harText = text !== null && text.trim() !== "";
  const kanSkrivaUt = typeof onSkrivUt === "function" && !harText;
  if (text === null && !kanSkrivaUt && !pagar) return null;

  /** @param {unknown} e @param {string} reserv */
  const felText = (e, reserv) => (e instanceof Error && e.message ? e.message : reserv);
  const skrivUt = () => {
    if (pagar || typeof onSkrivUt !== "function") return;
    setFel("");
    setPagar(true);
    Promise.resolve()
      .then(() => onSkrivUt(post))
      .then(
        () => {},
        (e) => {
          if (levande.current) setFel(felText(e, o("felSkrivUt")));
        },
      )
      .then(() => {
        if (levande.current) setPagar(false);
      });
  };
  const goraAnteckning = () => {
    if (gorAnteckning || typeof onAnteckningAvUtskrift !== "function") return;
    setFel("");
    setGorAnteckning(true);
    Promise.resolve()
      .then(() => onAnteckningAvUtskrift(post))
      .then(
        () => anteckningKlar.visa(),
        (e) => {
          if (levande.current) setFel(felText(e, talkOrd("felAnteckning", sprak)));
        },
      )
      .then(() => {
        if (levande.current) setGorAnteckning(false);
      });
  };

  const status = pagar ? "skriverUt" : kopierat ? "kopierat" : anteckningKlar.synlig ? "anteckningKlar" : null;
  const felVisas = fel || (misslyckades ? talkOrd("felKopiera", sprak) : "");
  return (
    <div data-bibliotek-utskrift-kontroll="" className="flex min-w-0 flex-col gap-3">
      {text !== null ? (
        <p data-bibliotek-utskrift="" className="m-0 min-w-0 whitespace-pre-wrap text-brod text-ink wrap-anywhere">
          {text === "" ? o("tom") : text}
        </p>
      ) : null}
      {harText ? (
        <div className="flex flex-wrap gap-2">
          <OpsButton variant="secondary" size="sm" onClick={() => kopiera(text)}>{talkOrd("kopiera", sprak)}</OpsButton>
          {typeof onAnteckningAvUtskrift === "function" ? (
            <OpsButton variant="secondary" size="sm" busy={gorAnteckning} onClick={goraAnteckning}>{o("gorAnteckning")}</OpsButton>
          ) : null}
        </div>
      ) : null}
      {status ? (
        <p role="status" aria-live="polite" data-bibliotek-utskrift-status={status} className="m-0 flex items-center gap-2 text-etikett text-ink-secondary">
          {status === "skriverUt" ? (
            <>
              <OpsSpinner size="sm" decorative />
              {talkOrd("skriverUt", sprak)}
            </>
          ) : status === "kopierat" ? (
            talkOrd("kopierat", sprak)
          ) : (
            talkOrd("anteckningSparad", sprak)
          )}
        </p>
      ) : null}
      {felVisas ? <p role="alert" data-bibliotek-utskrift-fel="" className="m-0 text-etikett text-danger">{felVisas}</p> : null}
      {kanSkrivaUt && !pagar ? <OpsButton variant="secondary" size="sm" onClick={skrivUt}>{o("skrivUt")}</OpsButton> : null}
    </div>
  );
}

/**
 * @param {{ id: string, grupper: readonly { id: string, namn: string }[], onDela?: (inmatning: { id: string, groupId: string, satt: "flytta" | "kopiera" }) => void | Promise<void>, onKlar?: (text: string) => void, onStart?: (id: string) => void, onSlut?: (id: string) => void, kanFlytta?: boolean }} props `onStart` och `onSlut` lägger posten i listans spärr medan flytten pågår, också om rutan stängs under tiden (granskningen av PR 365, varv 2). `kanFlytta` är falskt för den som inte skrev posten: en admin kopierar men flyttar inte någon annans post.
 */
function DelaKontroll({ id, grupper, onDela, onKlar, onStart, onSlut, kanFlytta = true }) {
  const [mal, setMal] = useState(grupper[0]?.id ?? "");
  const [fel, setFel] = useState("");
  const [pagar, setPagar] = useState(/** @type {"flytta" | "kopiera" | null} */ (null));
  if (grupper.length === 0) return null;
  const kor = (/** @type {"flytta" | "kopiera"} */ satt) => {
    if (pagar) return;
    if (satt === "flytta" && !kanFlytta) return;
    if (!mal) {
      setFel("Välj en grupp.");
      return;
    }
    if (typeof onDela !== "function") {
      setFel("Delning är inte kopplad. Posten är kvar.");
      return;
    }
    const namn = grupper.find((g) => g.id === mal)?.namn ?? mal;
    setFel("");
    setPagar(satt);
    if (typeof onStart === "function") onStart(id);
    // ⛔ RUTAN STÄNGS FÖRST NÄR DET GICK (0.101.0). Förut stod den kvar utan besked efter ett lyckat tryck, och ett andra tryck
    // på Flytta hade försökt flytta en post som redan var borta.
    Promise.resolve()
      .then(() => onDela({ id, groupId: mal, satt }))
      .then(
        () => {
          setPagar(null);
          if (typeof onSlut === "function") onSlut(id);
          if (typeof onKlar === "function") onKlar(satt === "flytta" ? `Flyttad till ${namn}.` : `Kopierad till ${namn}.`);
        },
        (e) => {
          setPagar(null);
          if (typeof onSlut === "function") onSlut(id);
          setFel(e instanceof Error ? e.message : String(e));
        },
      );
  };
  return (
    <div data-bibliotek-dela="" className="flex flex-col gap-2">
      {/* ⛔ OpsSelect och inte en rå `<select>` (0.95.0). CP 2026-10-13: "Det skall aldrig finnas en ostylad
          komponent som använder webläsarens scroll eller style." Den här listan var webbläsarens egen, i ramverket
          självt, trots att OpsSelect sade att den är förbjuden. `check-webblasarkontroller` fäller den nu. */}
      {/* ⛔ NAMNET ÄR DEN SYNLIGA ETIKETTEN. Här stod "Till" synligt och ett annat namn i `ariaLabel`, vilket OpsSelect förbjuder
          inne i en OpsField: den som hör namnet och den som ser etiketten fick två olika ord för samma fält. */}
      <OpsField label="Flytta eller kopiera till">
        <OpsSelect
          value={mal}
          onChange={setMal}
          options={grupper.map((g) => ({ value: g.id, label: g.namn }))}
        />
      </OpsField>
      {fel ? <p role="alert">{fel}</p> : null}
      <div className="flex gap-2">
        {kanFlytta ? <OpsButton variant="secondary" busy={pagar === "flytta"} onClick={() => kor("flytta")}>Flytta</OpsButton> : null}
        <OpsButton variant="secondary" busy={pagar === "kopiera"} onClick={() => kor("kopiera")}>Kopiera</OpsButton>
      </div>
    </div>
  );
}


/**
 * Dialogen för en publik länk till en fil (0.119.0, lifehub.app#356).
 *
 * ══ ⛔ TRE LÄGEN, OCH ADRESSEN FINNS BARA I ETT ═══════════════════════════════════════════════════════════════════════
 *
 * 1. **Ingen länk än.** Utgångstid (1, 7 eller 30 dagar, förval 7), reglaget för nedladdning (förval AV) och "Skapa länk".
 * 2. **Länken är nyss skapad.** Hela adressen och Kopiera. Tokenet sparas aldrig, så adressen visas här och inte igen: stängs dialogen är den borta.
 * 3. **En länk som lever, skapad förut.** Dess giltighet, reglaget för nedladdning och "Stäng länken". Adressen visas inte, och dialogen säger varför,
 *    så att ingen letar efter en Kopiera-knapp som inte finns. Behövs adressen igen stängs länken och en ny skapas.
 *
 * ⛔ "STÄNG LÄNKEN" ÄR SLUTGILTIGT. Den dialogen frågar inte "är du säker" med en andra ruta: knappen heter vad den gör, och en stängd
 * länk ersätts av en ny med ett nytt token, vilket är lika lätt som att skapa den första.
 *
 * ⛔ ETT FEL SYNS OCH LÄGET STÅR KVAR. Svarar appen med ett fel står texten i dialogen, reglaget är där det var, och länken är inte
 * stängd. Ett svar utan länk räknas som ett fel: en skapad delning vars adress ingen fick se är en länk som ingen kan dela och ingen vet om.
 *
* @param {{ post: import("../lib/bibliotek.js").Bibliotekspost & { id: string }, gruppnamn?: string, gruppdelForslag?: string, delningar: readonly { id: string, postId: string, giltigTill: number, nedladdning: boolean, url?: string, harKod?: boolean }[], onDelaLank: NonNullable<Parameters<typeof OpsBibliotek>[0]["onDelaLank"]>, onAndraNedladdning: NonNullable<Parameters<typeof OpsBibliotek>[0]["onAndraNedladdning"]>, onAterkalla: NonNullable<Parameters<typeof OpsBibliotek>[0]["onAterkalla"]>, onKlar: (text: string) => void }} props
 */
function DelaLankKontroll({ post, gruppnamn, gruppdelForslag, delningar, onDelaLank, onAndraNedladdning, onAterkalla, onKlar }) {
  const sprak = useOpsSprak();
  const [nedladdning, setNedladdning] = useState(false);
  const [skapad, setSkapad] = useState(/** @type {null | { id: string, url: string, giltigTill?: number, harKod?: boolean }} */ (null));
  const [stangda, setStangda] = useState(/** @type {string[]} */ ([]));
  const [andrad, setAndrad] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [pagar, setPagar] = useState(/** @type {null | "skapa" | "stang" | "andra"} */ (null));
  const [fel, setFel] = useState("");
  // ⛔ 0.125.0: giltighet, kod och adress är samma fält som för en händelse (`DelaLankFalt`), med en fils giltigheter (1, 7 och 30 dagar) och typsegmentet `lib`.
  const falt = useDelaLankFalt({ slag: "post", grupp: gruppnamn, titel: post.rubrik || post.fil?.namn, gruppdelForslag, dagval: DELNINGSDAGAR, forvalDagar: FORVAL_DELNINGSDAGAR, sprak });
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);

  // Den nyligen skapade länken först, annars den senast gående som lever för posten och inte stängts här.
  const lever = delningar.filter((d) => d.postId === post.id && !stangda.includes(d.id)).sort((a, b) => b.giltigTill - a.giltigTill);
  const aktiv = skapad
    ? (delningar.find((d) => d.id === skapad.id) ?? { id: skapad.id, postId: post.id, giltigTill: skapad.giltigTill, nedladdning, url: skapad.url, harKod: skapad.harKod })
    : lever[0];
  const nedNu = aktiv ? (andrad[aktiv.id] ?? aktiv.nedladdning) : nedladdning;
  /** @param {unknown} e */
  const visaFel = (e) => setFel(e instanceof Error && e.message ? e.message : String(e));

  async function skapa() {
    if (pagar) return;
    const p = falt.pro();
    if (!p.ok) {
      setFel(p.fel);
      return;
    }
    setFel("");
    falt.setMeddelande("");
    setPagar("skapa");
    try {
      const svar = await onDelaLank({ postId: post.id, dagar: /** @type {number} */ (p.varde.dagar), nedladdning, kod: p.varde.kod, gruppdel: p.varde.gruppdel, fildel: p.varde.sista });
      if (!svar || typeof svar.id !== "string" || svar.id === "" || typeof svar.url !== "string" || svar.url === "") {
        throw new Error("Länken skapades men svaret saknade adressen. Stäng den och skapa en ny.");
      }
      if (levande.current) setSkapad({ id: svar.id, url: svar.url, giltigTill: typeof svar.giltigTill === "number" ? svar.giltigTill : undefined, harKod: svar.harKod === true });
    } catch (e) {
      if (!levande.current) return;
      if (e && typeof e === "object" && /** @type {{ kod?: unknown }} */ (e).kod === "adress-upptagen") {
        if (/** @type {{ del?: unknown }} */ (e).del === "gruppdel") falt.gruppdelUpptagen();
        else falt.upptagen();
      } else visaFel(e);
    } finally {
      if (levande.current) setPagar(null);
    }
  }

  /** @param {boolean} varde */
  async function bytNedladdning(varde) {
    if (!aktiv || pagar) return;
    setFel("");
    setPagar("andra");
    try {
      await onAndraNedladdning({ id: aktiv.id, nedladdning: varde });
      if (levande.current) setAndrad((a) => ({ ...a, [aktiv.id]: varde }));
    } catch (e) {
      if (levande.current) visaFel(e);
    } finally {
      if (levande.current) setPagar(null);
    }
  }

  async function stang() {
    if (!aktiv || pagar) return;
    setFel("");
    setPagar("stang");
    try {
      await onAterkalla({ id: aktiv.id });
      if (!levande.current) return;
      setStangda((s) => [...s, aktiv.id]);
      setSkapad(null);
      onKlar("Länken är stängd.");
    } catch (e) {
      if (levande.current) visaFel(e);
    } finally {
      if (levande.current) setPagar(null);
    }
  }

  if (!aktiv) {
    return (
      <div data-bibliotek-delalank="ny" className="flex flex-col gap-4">
        <p className="m-0 text-brod text-ink-secondary">Den som har länken kan se filen utan att logga in.</p>
        <DelaLankFalt falt={falt} sprak={sprak} disabled={pagar !== null} />
        <OpsSwitch label="Tillåt nedladdning" hint="Av som förval. Den som har länken kan se filen oavsett." checked={nedladdning} onChange={setNedladdning} />
        {fel ? <p role="alert" className="m-0 text-etikett text-danger">{fel}</p> : null}
        <div className="flex gap-2">
          <OpsButton variant="primary" busy={pagar === "skapa"} onClick={skapa}>Skapa länk</OpsButton>
        </div>
      </div>
    );
  }

  const till = ljudDatum(aktiv.giltigTill);
  return (
    <div data-bibliotek-delalank={skapad ? "skapad" : "lever"} className="flex flex-col gap-4">
      {aktiv.url ? (
        // ⛔ 0.125.0: en länk med en adress visar den alltid, som text med Kopiera, så att den går att klippa ur och skicka. Adressen lagras (se `byggAdressdelning`).
        <ul data-bibliotek-delalank-url="" className="m-0 flex list-none flex-col p-0">
          <LankRad lank={{ id: aktiv.id, url: aktiv.url, harKod: aktiv.harKod === true, giltigTill: aktiv.giltigTill }} sprak={sprak} />
        </ul>
      ) : (
        <>
          <p className="m-0 text-brod text-ink-secondary">Det finns en länk till filen, skapad med en äldre version. Den visades bara när den skapades. Behöver du adressen igen stänger du länken och skapar en ny.</p>
          {till ? <p className="m-0 text-etikett text-ink-muted">Gäller till {till}.</p> : null}
        </>
      )}
      <OpsSwitch label="Tillåt nedladdning" checked={nedNu} disabled={pagar !== null} onChange={bytNedladdning} />
      {fel ? <p role="alert" className="m-0 text-etikett text-danger">{fel}</p> : null}
      <div className="flex gap-2">
        <OpsButton variant="danger" busy={pagar === "stang"} onClick={stang}>Stäng länken</OpsButton>
      </div>
    </div>
  );
}
