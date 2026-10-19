import { useEffect, useId, useRef } from "react";
import { definierade, forvalda } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { cx } from "../lib/cx.js";
import { attachmentSize, isImage } from "../lib/file.js";
import { handelsetid } from "../lib/handelsepanel.js";
import { DATUM_EJ_SATT } from "../lib/handelsemodell.js";
import { KALENDERPRICK } from "../lib/kalenderfarg.js";
import { slagText } from "../lib/slag.js";
import { text } from "../lib/sprak.js";
import { tillaggFor } from "../lib/tillagg.js";
import { AndraIkon, DatumIkon, FilIkon, KlockaIkon, PilHogerIkon, PlatsIkon } from "./icons.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsStatusDot } from "./OpsStatusDot.jsx";
import { TillbakaKnapp } from "./TillbakaKnapp.jsx";
import { HandelseDelning } from "./HandelseDelning.jsx";
import { HandelseFlytta } from "./HandelseFlytta.jsx";
import { Ursprungsrad } from "./Ursprungsrad.jsx";

/**
 * Händelsepanelen: en händelse på en egen sida, med Tillbaka överst (0.40.0, #214).
 *
 * ══ ⛔ SESSIONSTUDIOS EVENTDETAIL, I SS ORDNING (CP 2026-10-01) ═════════════════════════════════════════════════════
 *
 * CP: "Vi behöver en händelsepanel. Så man navigerar dit från kalender och från idag. Händelsepanelen skall ha en tillbaka knapp.
 * Kolla SessionStudio." SS `views/EventDetailRouteView.jsx:97-104` är en rad "‹ Tillbaka" (`text-sm text-muted`, `ChevronLeft w-5`)
 * och `components/eventDetail/EventDetailInlinePanel.jsx:54-83` + `EventDetailInfoTabInline.jsx:129-165` ritar händelsen under den, i den här
 * ordningen, och den här panelen ritar samma:
 *
 *   1. Tillbaka.
 *   2. Titeln (`text-lg sm:text-xl font-bold`) med statusen på samma rad, till höger.
 *   3. Raden under titeln: typen (ikon och ord), gruppen ("Grupp: Namn") och kalendern.
 *   4. Informationsrutan: datumet stort med en kalenderikon, tiden med en klocka, platsen. Bara det händelsen HAR.
 *   5. Beskrivningen, i en egen ruta.
 *   6. Svaren (Kommer / Kommer inte), bara för en händelse som kräver svar.
 *
 * ⛔ DET SOM INTE ÄR MED, OCH VARFÖR: SS har fyra flikar under rubriken (Info, Bibliotek, Chatt, Aktivitet), en statusväljare, redigera
 * och exportknappar, serie, datumomröstning och bokade resurser. Det är appens data och appens åtgärder, och ramverket känner inte
 * ett bibliotek eller en chatt. Det en app vill lägga till går in som `atgarder` (knapparna högst upp, som SS penna och export) och
 * som `svar`; flikar och bibliotek hör till en senare leverans och ritas inte som döda flikar i väntan på den.
 * ⛔ 0.60.0 (#251, beslut 0003): en APP som vill lägga till en sektion gör det som ett tillägg på platsen `handelse.sektion` (`moduler`
 * och `grupp` nedan), aldrig genom att ändra panelen.
 *
 * ══ ⛔ ALLTID EN VÄG TILLBAKA ═════════════════════════════════════════════════════════════════════════════════════════
 *
 * Tillbaka står överst i ALLA tre lägen: händelsen finns, den läses (`laddar`) och den finns inte (`handelse` är `null`). En länk
 * till en händelse som tagits bort, eller som personen inte får se, ska inte lämna någon på en tom sida utan utgång. "Finns inte"
 * skrivs ut som ett svar och inte som en tom ruta (arbetsreglernas punkt 5), och är inte detsamma som "läses".
 *
 * ══ ⛔ RAMVERKET KÄNNER INTE APPENS DATA ═════════════════════════════════════════════════════════════════════════════
 *
 * Panelen får en färdig `handelse` ur appens egen källa, i de fält ramverket redan läser på en händelse (`HANDELSEKONTRAKT`: `datum`,
 * `slutDatum`, `tid`, `slutTid`, `heldag`, `kravSvar`) plus det appen löst upp till ord: titel, typens namn och ikon, gruppens namn.
 * Svaren kommer som `svar`, en färdig nod (appens `<OpsSvar>` med sin källa): ramverket vet inte var svaren ligger. Kräver händelsen
 * svar (`kravSvar`) och `svar` saknas kastar panelen, för då hade en händelse som frågar visat sig utan frågan.
 *
 * ⛔ Panelen öppnas av skalet (`OpsAppShell` `handelsepanel`, adressen `?handelse=<id>`, se `lib/handelsepanel.js`). Den kan också
 * ritas fristående, med en egen `onTillbaka`.
 *
 * @typedef {object} HandelseVy
 * @property {string} id
 * @property {string} titel
 * @property {string} [datum] `YYYY-MM-DD`. ⛔ Saknas i läget "Datum ej satt" (0.127.0, `lib/handelsemodell.js`): informationsrutan säger då `datumEjSattEtikett`
 *   i stället för ett datum, och ritar ingen tid.
 * @property {string} [slutDatum] Sista dagen, inklusive.
 * @property {string} [tid] `HH:MM`.
 * @property {string} [slutTid] `HH:MM`.
 * @property {boolean} [heldag]
 * @property {{ namn: string, ikon?: import("react").ReactNode, slag?: 1 | 2 | 3 }} [typ] Typen i appens ord. `slag` färgar ikonen (samma ton som raden i Idag), och `namn` står alltid bredvid: en färg ensam säger ingenting.
 * @property {"oppet" | "pagar" | "vantar" | "klart" | "akut"} [status] Kräver `statusWords`.
 * @property {{ namn: string, farg: 1 | 2 | 3 | 4 | 5 | 6 }} [kalender] Kalendern händelsen ligger i. Färgen står aldrig ensam: namnet står bredvid.
 * @property {string} [grupp] Gruppens namn.
 * @property {string} [plats]
 * @property {{ namn: string, typ?: "manniska" | "agent" | "okand" } | string} [skapadAv] (0.43.0, #224) Vem som skapade händelsen, i `laesSkapare`s form.
 * @property {string} [skapad] (0.43.0, #224) När, ISO-8601. Raden "Skapad av Namn, 29 sep 09:12" ritas bara när båda finns, som i listan.
 * @property {import("./Ursprungsrad.jsx").Ursprung} [ursprung] (0.43.0, #224) Var händelsen hör hemma: modulen, och valfritt en länk tillbaka.
 * @property {import("react").ReactNode} [beskrivning] Löptext, eller en färdig nod (en app som visar markdown skickar `<OpsMarkdown>`).
 * @property {boolean} [kravSvar] Gruppens medlemmar ombeds svara. Kräver `svar`.
 * @property {import("../lib/file.js").Bilaga | null} [bilaga] (0.45.0, #221) En bild eller ett dokument, i SAMMA form som ett ärendes bilaga
 *   (`OpsFilePicker` och `lib/file.js`): en data-URL i händelsens eget dokument. ⛔ LAGRINGEN OCH TAKET ÄR APPENS. Ramverket ritar bara det
 *   appen skickar; hur stor bilagan får vara (`maxChars` på `OpsFilePicker`) följer av var appen lagrar den. I Firestore är dokumentets gräns
 *   1 048 576 byte och dokumentet bär mer än bilagan, så taket ska ligga under den med marginal (bolag-ops: 700 000 tecken, samma som ärenden).
 *   Ska bilagorna bli många, stora eller långlivade är svaret en fillagring och inte ett högre tak.
 *
 * @param {object} props
 * @param {HandelseVy | null} props.handelse `null`: händelsen finns inte (och `laddar` är inte sant).
 * @param {boolean} [props.laddar] Appen läser händelsen ännu. Visar en väntan i stället för "finns inte".
 * @param {() => void} props.onTillbaka
 * @param {import("react").ReactNode} [props.svar] Svaren. Ritas bara när `handelse.kravSvar` är sant.
 * @param {import("react").ReactNode} [props.kommentarer] (0.48.0, #232) Tråden, normalt appens `<OpsKommentarer>` med sin källa. Ritas sist,
 *   under svaren, för varje händelse som får den. Ramverket vet inte var kommentarerna ligger.
 * @param {import("react").ReactNode} [props.filer] (0.121.0, cllp/lifehub.app#366) Händelsens filer, normalt appens `<OpsHandelsefiler>` med sin källa. Ritas efter bilagan och före svaren, för varje
 *   händelse som får den. Sektionen har sin egen rubrik ("Filer"), så panelen lägger ingen. Ramverket vet inte var filerna ligger. Den singulära `bilaga` ovan är kvar tills appen migrerat den (beslut 0002, steg 3).
 * @param {() => void} [props.onRedigera] (0.40.0) Pennan: SS redigera. Ritas BARA när appen ger den, så att en person som inte får ändra händelsen inte ser en knapp som nekas. Normalt `() => oppna("handelse", { id })` ur `useOppnaSkapa()`, som öppnar skalets skapa-panel i redigeringsläge. Ramverket känner varken regeln eller datan: appen avgör vem som får, och formuläret och sparandet är appens.
 * @param {string} [props.redigeraEtikett] Pennans namn för skärmläsaren. Förval "Redigera".
 * @param {string} [props.flyttaEtikett] (0.123.0) Knappen och rutans rubrik. Förval "Flytta till kalender".
 * @param {string} [props.flyttaMinaRubrik] (0.123.0) Rubriken över mina egna kalendrar i rutan. Förval "Mina kalendrar".
 * @param {string} [props.bekraftaTitel] (0.123.0) Bekräftelsens rubrik när en post blir en gruppens händelse. Förval "Flytta till gruppens kalender?".
 * @param {string} [props.bekraftaText] (0.123.0) Bekräftelsens text, med `{titel}`, `{grupp}` och `{kalender}`. Förval säger att gruppens medlemmar ser den och att den tas bort ur den egna kalendern.
 * @param {string} [props.bekraftaKnapp] (0.123.0) Förval "Flytta".
 * @param {string} [props.avbrytEtikett] (0.123.0) Förval "Avbryt".
 * @param {string} [props.stangEtikett] (0.123.0) Skärmläsarnamn på rutans stängknapp. Förval "Stäng".
 * @param {string} [props.flyttFelEtikett] (0.123.0) Orden före orsaken när en flytt faller. Förval "Det gick inte att flytta".
 * @param {ReadonlyArray<import("../lib/flytta.js").Flyttmal>} [props.flyttmal] (0.123.0, cllp/lifehub.app#371) Vart den här posten eller händelsen får flyttas, ur
 *   `flyttmal()`. Med minst ett val ritar panelen "Flytta till kalender" under informationsrutan; tom eller utelämnad ritar ingenting (en knapp
 *   utan val är en död knapp). ⛔ Listan är ett ERBJUDANDE och ingen behörighet: servern (`createFlyttaService`) prövar allt på nytt.
 * @param {(mal: import("../lib/flytta.js").Flyttmal) => void | Promise<void>} [props.onFlytta] (0.123.0) Anropas med valet. Appen anropar rätt serveranrop efter
 *   `mal.atgard` (`byt`: `flyttaPost` eller `flyttaHandelse`, `konvertera`: `goraPostTillHandelse`) och navigerar efteråt, till exempel till den nya händelsen.
 *   Kräver `flyttmal`-val (kastar annars). Kastar anropet visar panelen orsaken och lämnar rutan öppen. En `konvertera` frågar först: "gruppens medlemmar ser den då".
 * @param {ReadonlyArray<import("./LankRad.jsx").Lank>} [props.delningar] (0.125.0, cllp/lifehub.app#377) Händelsens aktiva publika länkar, ur `lista({ uid, groupId, handelseId })` med `url` ifylld (`delningsUrl(bas, rad.sokvag)`; en gammal rad utan `sokvag` är ingen händelselänk). Varje länk står i panelen med sin FULLA adress som text,
 *   sin rättighet, om den har kod och när den går ut, med Kopiera och Återkalla, så att den går att klippa ur och skicka. Utan länkar står en rad som säger det. Krävs med `onDela` (kastar annars): en tom lista är "inga länkar", en utelämnad är "inte läst".
 * @param {(val: { dagar: number | null, kod: string | null, gruppdel: string, handelsedel: string }) => Promise<import("./LankRad.jsx").Lank>} [props.onDela] (0.125.0) Ritar sektionen "Delade länkar" med knappen Dela. Anropas med valen i rutan (`dagar` är `null` för ingen gräns, som är förvalet; `kod` är `null` utan kod; `gruppdel` och `handelsedel` är
 *   rensade adressdelar) och ska svara med den nya länken `{ id, url, giltigTill, harKod }`, normalt anropet till `createDelningService().skapa({ handelseId, gruppdel, handelsedel, dagar, kod })` och `delningsUrl(bas, svar.sokvag)`. Kastar anropet visas orsaken och rutan står kvar; är felets `kod` `adress-upptagen` föreslås en annan adress. ⛔ Ritas bara när appen ger den, som `onRedigera`: servern prövar medlemskapet och appens regel.
 * @param {(arg: { id: string }) => Promise<void>} [props.onAterkalla] (0.125.0) Återkallar en länk (`createDelningService().aterkalla`). Krävs med `onDela`. Raden försvinner först när anropet lyckats; kastar det visas orsaken i raden.
 * @param {string} [props.delningGruppdel] (0.125.0, granskningen av PR 417) Gruppdelen gruppen redan använt i en länk (`gruppdelar({ uid, groupId }).senaste`), föreslagen i Dela-rutan före ett namn ur gruppens namn. En gruppdel tillhör en grupp för alltid: tar en annan grupp den först svarar servern `adress-upptagen` med `del: "gruppdel"` och rutan föreslår en annan.
 * @param {import("react").ReactNode} [props.atgarder] Appens egna knappar, högst upp till höger bredvid titeln (SS export m.fl.), efter pennan.
 * @param {{ oppet?: string, pagar?: string, vantar?: string, klart?: string, akut?: string }} [props.statusWords] KRÄVS för varje status som förekommer, som i `OpsEventList`.
 * @param {string} [props.sprak] Datumens språk, "sv" eller "en". Förval "sv".
 * @param {string} [props.tillbakaEtikett] Förval "Tillbaka".
 * @param {string} [props.gruppEtikett] Orden före gruppens namn. Förval "Grupp".
 * @param {string} [props.laddarEtikett] Förval "Hämtar händelsen".
 * @param {string} [props.saknasTitel] Förval "Händelsen finns inte".
 * @param {string} [props.saknasText] Förval "Den kan ha tagits bort, eller så får du inte se den."
 * @param {string} [props.tillEtikett] Skärmläsarens ord mellan två datum. Förval "till".
 * @param {string} [props.datumEjSattEtikett] (0.127.0) Det som står i stället för datumet när händelsen saknar `datum`. Förval "Datum ej satt" (`DATUM_EJ_SATT`, samma ord som kalenderns preliminära poster).
 * @param {string} [props.bilagaEtikett] (0.45.0, #221) Rubriken över bilagan, och ordet i bildens alt-text. Förval "Bilaga".
 * @param {string} [props.skapadAvEtikett] (0.43.0, #224) Förval "Skapad av".
 * @param {string} [props.iModulEtikett] (0.43.0, #224) Ordet före modulen efter en skapare. Förval "i".
 * @param {string} [props.franModulEtikett] (0.43.0, #224) Ordet före modulen utan skapare. Förval "Från".
 * @param {(href: string, event: any) => void} [props.onNavigate] (0.43.0, #224) Anropas när länken tillbaka till modulens post trycks, i stället för webbläsarens navigering.
 * @param {ReadonlyArray<import("../lib/modul.js").Modul>} [props.moduler] (0.60.0, #251) Appens moduler, ur `validateModuler`. Deras tillägg på platsen
 *   `handelse.sektion` ritas som sektioner efter informationsrutan, med etiketten som rubrik och komponenten med `{ handelse, grupp }`.
 * @param {{ id: string, moduler: ReadonlyArray<string> } & Record<string, unknown>} [props.grupp] (0.60.0, #251) Gruppen händelsen hör till. ⛔ Bara
 *   moduler i dess `moduler` ritas; en avslagen moduls komponent anropas inte. Utan grupp ritas inga tillägg.
 */
function OpsHandelsePanelRitad({
  handelse,
  laddar = false,
  onTillbaka,
  svar,
  kommentarer,
  filer,
  atgarder,
  onRedigera,
  redigeraEtikett = ORD_OPSHANDELSEPANEL.redigeraEtikett.sv,
  flyttmal,
  onFlytta,
  delningar,
  onDela,
  onAterkalla,
  delningGruppdel,
  flyttaEtikett = ORD_OPSHANDELSEPANEL.flyttaEtikett.sv,
  flyttaMinaRubrik = ORD_OPSHANDELSEPANEL.flyttaMinaRubrik.sv,
  bekraftaTitel = ORD_OPSHANDELSEPANEL.bekraftaTitel.sv,
  bekraftaText = ORD_OPSHANDELSEPANEL.bekraftaText.sv,
  bekraftaKnapp = ORD_OPSHANDELSEPANEL.bekraftaKnapp.sv,
  avbrytEtikett = ORD_OPSHANDELSEPANEL.avbrytEtikett.sv,
  stangEtikett = ORD_OPSHANDELSEPANEL.stangEtikett.sv,
  flyttFelEtikett = ORD_OPSHANDELSEPANEL.flyttFelEtikett.sv,
  statusWords = {},
  sprak = "sv",
  tillbakaEtikett = ORD_OPSHANDELSEPANEL.tillbakaEtikett.sv,
  gruppEtikett = ORD_OPSHANDELSEPANEL.gruppEtikett.sv,
  laddarEtikett = ORD_OPSHANDELSEPANEL.laddarEtikett.sv,
  saknasTitel = ORD_OPSHANDELSEPANEL.saknasTitel.sv,
  saknasText = ORD_OPSHANDELSEPANEL.saknasText.sv,
  tillEtikett = ORD_OPSHANDELSEPANEL.tillEtikett.sv,
  datumEjSattEtikett = ORD_OPSHANDELSEPANEL.datumEjSattEtikett.sv,
  bilagaEtikett = ORD_OPSHANDELSEPANEL.bilagaEtikett.sv,
  skapadAvEtikett = ORD_OPSHANDELSEPANEL.skapadAvEtikett.sv,
  iModulEtikett = ORD_OPSHANDELSEPANEL.iModulEtikett.sv,
  franModulEtikett = ORD_OPSHANDELSEPANEL.franModulEtikett.sv,
  onNavigate,
  moduler,
  grupp,
}) {
  const rubrikId = useId();
  const ref = useRef(/** @type {HTMLElement | null} */ (null));
  // ⛔ FOKUS FLYTTAS TILL PANELEN NÄR DEN ÖPPNAS. Länken man tryckte på ligger nu i en dold vy, och fokus som blir kvar där försvinner till `body`:
  // tangentbords- och skärmläsaranvändaren börjar då om från sidans topp. Panelen får fokus (och läses upp med rubriken som namn), och skalet
  // ger fokus tillbaka till länken vid Tillbaka.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  if (typeof onTillbaka !== "function") {
    throw new Error("OpsHandelsePanel: onTillbaka krävs. En panel utan väg tillbaka är en sida man inte kommer ut ur.");
  }
  if (onRedigera !== undefined && typeof onRedigera !== "function") {
    throw new Error("OpsHandelsePanel: onRedigera måste vara en funktion (eller utelämnas). En penna utan åtgärd är en död knapp.");
  }
  if (flyttmal !== undefined && !Array.isArray(flyttmal)) {
    throw new Error("OpsHandelsePanel: flyttmal måste vara en lista (ur flyttmal()), eller utelämnas.");
  }
  if (onFlytta !== undefined && typeof onFlytta !== "function") {
    throw new Error("OpsHandelsePanel: onFlytta måste vara en funktion (eller utelämnas).");
  }
  if (flyttmal && flyttmal.length > 0 && typeof onFlytta !== "function") {
    throw new Error("OpsHandelsePanel: flyttmal har val men onFlytta saknas. Ett val som inte gör något är en död knapp.");
  }
  if (onDela !== undefined && typeof onDela !== "function") {
    throw new Error("OpsHandelsePanel: onDela måste vara en funktion (eller utelämnas).");
  }
  if (onDela && typeof onAterkalla !== "function") {
    throw new Error("OpsHandelsePanel: onDela finns men onAterkalla saknas. En länk man kan skapa men inte stänga är en länk som lever för alltid.");
  }
  if (onDela && !Array.isArray(delningar)) {
    throw new Error("OpsHandelsePanel: onDela finns men delningar saknas. Ge listan med de aktiva länkarna, tom när det inte finns några: utan den går det inte att skilja 'inga länkar' från 'inte läst'.");
  }
  if (!onDela && (onAterkalla !== undefined || delningar !== undefined || delningGruppdel !== undefined)) {
    throw new Error("OpsHandelsePanel: delningar, onAterkalla och delningGruppdel hör till onDela. Utan onDela ritas ingen sektion, och listan hade bara varit en dold yta.");
  }
  for (const m of flyttmal ?? []) {
    if (!m || typeof m.id !== "string" || typeof m.namn !== "string" || (m.atgard !== "byt" && m.atgard !== "konvertera")) {
      throw new Error("OpsHandelsePanel: ett flyttmal har formen { id, namn, farg, ikon, atgard: \"byt\" | \"konvertera\", groupId?, gruppnamn? } (flyttmal()).");
    }
    if ((m.atgard === "konvertera" || m.groupId) && typeof m.gruppnamn !== "string") {
      throw new Error(`OpsHandelsePanel: flyttmålet "${m.namn}" hör till en grupp men saknar gruppnamn. Bekräftelsen och listan måste säga vilken grupp.`);
    }
  }
  if (handelse && handelse.status && !statusWords[handelse.status]) {
    throw new Error(`OpsHandelsePanel: händelsen har status ${handelse.status} men statusWords saknar ordet. En färgad prick utan ord bär betydelsen ensam, och då är statusen osynlig för skärmläsaren.`);
  }
  if (handelse && handelse.bilaga != null && !(typeof handelse.bilaga === "object" && typeof handelse.bilaga.dataUrl === "string" && handelse.bilaga.dataUrl)) {
    throw new Error("OpsHandelsePanel: handelse.bilaga saknar dataUrl. En bilaga som inte går att visa ritades förut inte alls, och då ser en händelse med en trasig bilaga ut som en händelse utan bilaga (#221). Skicka `null` när det inte finns någon.");
  }
  if (handelse && handelse.kravSvar === true && (svar === undefined || svar === null)) {
    throw new Error("OpsHandelsePanel: händelsen kräver svar (kravSvar) men panelen fick inget `svar`. Utan det visas en händelse som frågar utan frågan, och ingen kan svara.");
  }

  const kolumn = "mx-auto flex w-full max-w-4xl flex-col px-4 pt-2 pb-8 md:pt-4";

  if (!handelse) {
    return (
      <section ref={ref} tabIndex={-1} aria-label={laddar ? laddarEtikett : saknasTitel} data-handelsepanel="" className={cx(kolumn, "outline-none")}>
        <TillbakaKnapp onClick={onTillbaka} etikett={tillbakaEtikett} className="self-start" />
        <div className="mt-2">
          {laddar ? <OpsEmpty title={laddarEtikett} busy busyLabel={laddarEtikett} /> : <OpsEmpty title={saknasTitel} description={saknasText} />}
        </div>
      </section>
    );
  }

  const tid = handelsetid(handelse, sprak);
  const slagfarg = handelse.typ ? slagText(handelse.typ.slag, handelse.typ.namn, "OpsHandelsePanel") : null;
  const statusord = handelse.status ? (statusWords[handelse.status] ?? "") : "";
  const harMetarad = Boolean(handelse.typ || handelse.grupp || handelse.kalender);
  return (
    <section ref={ref} tabIndex={-1} aria-labelledby={rubrikId} data-handelsepanel="" className={cx(kolumn, "outline-none")}>
      {/* ⛔ SS `mb-2 sm:mb-4` under raden: luften bor i raden och inte i rubriken, så den följer med om raden byts. */}
      <TillbakaKnapp onClick={onTillbaka} etikett={tillbakaEtikett} className="self-start md:mb-2" />

      {/* ⛔ TITELN OCH STATUSEN PÅ SAMMA RAD, STATUSEN TILL HÖGER (SS `EventDetailInlinePanel.jsx:56-60`). Titeln får hela resten av
          raden och bryter hellre än trunkeras: en händelse som heter något långt ska gå att läsa. */}
      <div className="mt-1 flex items-start justify-between gap-3">
        <h1 id={rubrikId} className="m-0 min-w-0 flex-1 text-titel leading-tight text-ink wrap-anywhere md:text-sida">
          {handelse.titel}
        </h1>
        {handelse.status ? (
          <span data-handelsestatus="" className="flex shrink-0 items-center gap-1.5 pt-0.5 text-meta font-semibold text-ink-secondary">
            <OpsStatusDot status={handelse.status} label={statusord} />
            {/* ⛔ ORDET SYNS HÄR, och inte bara för skärmläsaren som i en listrad: på en egen sida finns plats, och en färgad prick ensam säger ingenting
                för den som inte lärt sig färgerna. `akut` skriver `OpsStatusDot` ut själv, så ordet ritas inte två gånger. */}
            {handelse.status !== "akut" ? <span aria-hidden="true">{statusord}</span> : null}
          </span>
        ) : null}
        {/* ⛔ PENNAN STÅR I TITELRADEN, TILL HÖGER OM STATUSEN (SS `EventDetailInlinePanel.jsx:84-86`: `p-2`, `Edit w-5`, `title` och
            `aria-label` "Redigera", bara när `onEdit` finns). Under md är träffytan 44 px (SS `p-2` ger 36); en ikon ensam har ett namn. */}
        {onRedigera || atgarder ? (
          <div className="flex shrink-0 items-center gap-1">
            {onRedigera ? (
              <button
                type="button"
                data-handelse-redigera=""
                onClick={onRedigera}
                aria-label={redigeraEtikett}
                title={redigeraEtikett}
                className="-my-1 inline-flex size-11 cursor-pointer items-center justify-center rounded-base text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:size-9"
              >
                <AndraIkon size={20} />
              </button>
            ) : null}
            {atgarder}
          </div>
        ) : null}
      </div>

      {harMetarad ? (
        <div data-handelsemeta="" className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-muted">
          {handelse.typ ? (
            <span className="flex min-w-0 items-center gap-1">
              {handelse.typ.ikon ? (
                <span aria-hidden="true" className={cx("flex shrink-0 items-center", slagfarg ?? "text-ink-muted")}>
                  {handelse.typ.ikon}
                </span>
              ) : null}
              <span className="min-w-0">{handelse.typ.namn}</span>
            </span>
          ) : null}
          {handelse.grupp ? (
            <span className="min-w-0">
              {gruppEtikett}: <span className="font-medium text-ink-secondary">{handelse.grupp}</span>
            </span>
          ) : null}
          {handelse.kalender ? (
            <span data-handelsekalender="" className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", KALENDERPRICK[handelse.kalender.farg] || "bg-accent")} />
              {handelse.kalender.namn}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* ⛔ VEM OCH VAR (0.43.0, #224, CP 2026-10-01: "Vem skapade händelsen och var hör den hemma"). Samma rad som i listan, ur samma
          komponent, under typen och gruppen: det är ett faktum om händelsen och inte en del av när den är. */}
      <Ursprungsrad
        skapadAv={handelse.skapadAv}
        skapad={handelse.skapad}
        ursprung={handelse.ursprung}
        skapadAvEtikett={skapadAvEtikett}
        iModulEtikett={iModulEtikett}
        franModulEtikett={franModulEtikett}
        sprak={sprak}
        onNavigate={onNavigate}
        komponent="OpsHandelsePanel"
      />

      {/* ⛔ INFORMATIONSRUTAN (SS `EventDetailInfoTabInline.jsx:129`: `rounded border bg-card p-4 space-y-3`). Datumet är det stora, med en
          ikon i `w-5`; tiden under det i en tyngre vikt än brödtexten. En rad som händelsen inte har ritas inte (`handelsetid`). */}
      <div data-handelseinfo="" className="mt-4 flex flex-col gap-3 rounded-base border border-line bg-raised p-4">
        <div className="flex items-start gap-3 text-ink">
          <span className="mt-0.5 flex shrink-0 items-center">
            <DatumIkon size={20} />
          </span>
          <span data-handelsedatum={tid.start ? "" : "ej-satt"} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sida leading-tight">
            {/* ⛔ "DATUM EJ SATT" ÄR ETT SVAR OCH INGEN TOM RAD (0.127.0, punkt 5): en händelse som väntar på att gruppen väljer dag. */}
            <span>{tid.start || datumEjSattEtikett}</span>
            {tid.slut ? (
              <>
                <span className="flex shrink-0 items-center text-ink-muted">
                  <PilHogerIkon size={16} />
                  <span className="sr-only">{tillEtikett}</span>
                </span>
                <span>{tid.slut}</span>
              </>
            ) : null}
          </span>
        </div>
        {tid.tid ? (
          <div className="flex items-center gap-3 text-ink-secondary">
            <span className="flex shrink-0 items-center">
              <KlockaIkon size={20} />
            </span>
            <span data-handelsetid="" className="text-titel">
              {tid.tid}
            </span>
          </div>
        ) : null}
        {handelse.plats ? (
          <div className="flex min-w-0 items-center gap-3 text-ink-secondary">
            <span className="flex shrink-0 items-center">
              <PlatsIkon size={20} />
            </span>
            <span data-handelseplats="" className="min-w-0 text-etikett wrap-anywhere md:text-brod">
              {handelse.plats}
            </span>
          </div>
        ) : null}
      </div>

      {/* ⛔ FLYTTA TILL KALENDER (0.123.0, cllp/lifehub.app#371): under informationsrutan, bara när det finns något att flytta till. Se `HandelseFlytta`. */}
      {flyttmal && flyttmal.length > 0 && onFlytta ? (
        <HandelseFlytta
          mal={flyttmal}
          onFlytta={onFlytta}
          titel={handelse.titel}
          ord={{ flyttaEtikett, flyttaMinaRubrik, bekraftaTitel, bekraftaText, bekraftaKnapp, avbrytEtikett, stangEtikett, flyttFelEtikett }}
        />
      ) : null}

      {/* ⛔ DELADE LÄNKAR (0.125.0, cllp/lifehub.app#377): varje aktiv publik länk med sin fulla adress, Kopiera och Återkalla, och Dela för en ny. Se `HandelseDelning`. */}
      {onDela && onAterkalla && delningar ? (
        <HandelseDelning handelse={{ titel: handelse.titel, grupp: handelse.grupp }} delningar={delningar} onDela={onDela} onAterkalla={onAterkalla} gruppdel={delningGruppdel} sprak={sprak} />
      ) : null}

      {/* ⛔ PLATSEN `handelse.sektion` (0.60.0, #251, beslut 0003): appens tillägg, efter informationsrutan. Ramverket äger platsen och
          rubriken, modulen äger innehållet. Komponenten får `{ handelse, grupp }` och inget annat. */}
      {tillaggFor({ moduler, grupp, plats: "handelse.sektion" }).map((t) => (
        <HandelseTillagg key={`${t.modulId}:${t.id}`} tillagg={t} handelse={handelse} grupp={/** @type {any} */ (grupp)} sprak={sprak} />
      ))}

      {/* ⛔ SS `CollapsibleDescription.jsx`: `text-base` (16) med tre rader och "Visa hela beskrivningen". Texten här är HELA beskrivningen utan tak: panelen
          är sidan där man läser den, och ett "visa mer" för tre rader på en egen sida är ett tryck för ingenting. Storleken är SS. */}
      {handelse.beskrivning ? (
        <div data-handelsebeskrivning="" className="mt-4 rounded-base border border-line bg-sunken p-4 text-brod leading-relaxed text-ink-secondary whitespace-pre-line wrap-anywhere">
          {handelse.beskrivning}
        </div>
      ) : null}

      {/* ⛔ BILAGAN (0.45.0, #221), som ett ärendes i inkorgen: en bild visas, annat är en länk med namn och storlek. En inbäddad PDF
          renderas olika i varje webbläsare och en ruta som ibland är tom ser ut som att filen inte kom fram; namnet och storleken svarar på
          de två frågor man har. `download` med filnamnet, annars heter den nedladdade filen något i stil med "ab12cd" (källan är en data-URL). */}
      {handelse.bilaga ? <HandelseBilaga bilaga={handelse.bilaga} titel={handelse.titel} etikett={bilagaEtikett} /> : null}

      {filer ? (
        <div data-handelsefiler-slot="" className="mt-6">
          {filer}
        </div>
      ) : null}

      {handelse.kravSvar === true ? (
        <div data-handelsesvar="" className="mt-6">
          {svar}
        </div>
      ) : null}

      {kommentarer ? (
        <div data-handelsekommentarer="" className="mt-6">
          {kommentarer}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Ett tillägg på platsen `handelse.sektion`, i samma form som bilagan: en rubrik i sektionsstil och innehållet under.
 * @param {{ tillagg: import("../lib/modul.js").Tillagg & { modulId: string }, handelse: HandelseVy, grupp: any, sprak: string }} props
 */
function HandelseTillagg({ tillagg, handelse, grupp, sprak }) {
  const rubrikId = useId();
  const Komponent = /** @type {import("react").ComponentType<{ handelse: HandelseVy, grupp: any }>} */ (tillagg.komponent);
  return (
    <section data-tillagg={`${tillagg.modulId}:${tillagg.id}`} aria-labelledby={rubrikId} className="mt-4 flex flex-col gap-2">
      <h2 id={rubrikId} className="m-0 text-sektion uppercase text-ink-muted">{text(tillagg.etikett, sprak)}</h2>
      <Komponent handelse={handelse} grupp={grupp} />
    </section>
  );
}

/**
 * @param {{ bilaga: import("../lib/file.js").Bilaga, titel: string, etikett: string }} props
 */
function HandelseBilaga({ bilaga, titel, etikett }) {
  const namn = bilaga.namn || etikett;
  const storlek = typeof bilaga.tecken === "number" && bilaga.tecken > 0 ? attachmentSize(bilaga.tecken) : "";
  const rubrikId = useId();
  const lank = "font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent wrap-anywhere";
  return (
    <section data-handelsebilaga="" aria-labelledby={rubrikId} className="mt-4 flex flex-col gap-2">
      <h2 id={rubrikId} className="m-0 text-sektion uppercase text-ink-muted">{etikett}</h2>
      {isImage(bilaga.typ) ? (
        <figure className="m-0 flex flex-col gap-1.5">
          {/* ⛔ Bilden är också en länk till sig själv i full storlek: på en telefon är rutan liten, och att kunna öppna bilden är skälet att den finns här (jfr #509). */}
          <a href={bilaga.dataUrl} target="_blank" rel="noopener" className="block self-start overflow-hidden rounded-base border border-line bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <img src={bilaga.dataUrl} alt={`${etikett} till ${titel}: ${namn}`} className="block max-h-72 max-w-full" />
          </a>
          <figcaption className="text-meta text-ink-muted">
            <a href={bilaga.dataUrl} download={bilaga.namn || "bilaga"} className={lank}>
              {namn}
            </a>
            {storlek ? ` · ${storlek}` : ""}
          </figcaption>
        </figure>
      ) : (
        <p className="m-0 flex min-w-0 items-center gap-2 text-etikett text-ink-secondary">
          <span className="flex shrink-0 items-center text-ink-muted">
            <FilIkon size={20} />
          </span>
          <a href={bilaga.dataUrl} download={bilaga.namn || "bilaga"} className={lank}>
            {namn}
          </a>
          {storlek ? <span className="shrink-0 text-ink-muted">· {storlek}</span> : null}
        </p>
      )}
    </section>
  );
}

/**
 * OpsHandelsePanels förvalda texter (0.46.0, cllp/bolag-ops#528). Den enda källan till dem: den inre komponentens förval pekar hit.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSHANDELSEPANEL = {
  redigeraEtikett: { sv: "Redigera", en: "Edit" },
  flyttaEtikett: { sv: "Flytta till kalender", en: "Move to calendar" },
  flyttaMinaRubrik: { sv: "Mina kalendrar", en: "My calendars" },
  bekraftaTitel: { sv: "Flytta till gruppens kalender?", en: "Move to the group's calendar?" },
  bekraftaText: {
    sv: "{titel} blir en händelse i {grupp}, i kalendern {kalender}. Gruppens medlemmar ser den då. Den tas bort från din egen kalender.",
    en: "{titel} becomes an event in {grupp}, in the calendar {kalender}. The group's members will then see it. It is removed from your own calendar.",
  },
  bekraftaKnapp: { sv: "Flytta", en: "Move" },
  avbrytEtikett: { sv: "Avbryt", en: "Cancel" },
  stangEtikett: { sv: "Stäng", en: "Close" },
  flyttFelEtikett: { sv: "Det gick inte att flytta", en: "Could not move" },
  tillbakaEtikett: { sv: "Tillbaka", en: "Back" },
  gruppEtikett: { sv: "Grupp", en: "Group" },
  laddarEtikett: { sv: "Hämtar händelsen", en: "Loading the event" },
  saknasTitel: { sv: "Händelsen finns inte", en: "The event does not exist" },
  saknasText: { sv: "Den kan ha tagits bort, eller så får du inte se den.", en: "It may have been removed, or you may not have access to it." },
  tillEtikett: { sv: "till", en: "to" },
  datumEjSattEtikett: DATUM_EJ_SATT,
  bilagaEtikett: { sv: "Bilaga", en: "Attachment" },
  skapadAvEtikett: { sv: "Skapad av", en: "Created by" },
  iModulEtikett: { sv: "i", en: "in" },
  franModulEtikett: { sv: "Från", en: "From" },
};

/**
 * OpsHandelsePanel på det språk appen ritas på (`OpsSprakProvider`), med ordbokens texter där appen inte skickat egna.
 * @param {Parameters<typeof OpsHandelsePanelRitad>[0]} props
 */
export function OpsHandelsePanel(props) {
  const kontext = useOpsSprak();
  const sprak = props.sprak ?? kontext;
  return <OpsHandelsePanelRitad {...forvalda(ORD_OPSHANDELSEPANEL, sprak)} {...definierade(props)} sprak={sprak} />;
}
