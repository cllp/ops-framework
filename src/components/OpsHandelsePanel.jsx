import { useId } from "react";
import { cx } from "../lib/cx.js";
import { handelsetid } from "../lib/handelsepanel.js";
import { KALENDERPRICK } from "../lib/kalenderfarg.js";
import { slagText } from "../lib/slag.js";
import { DatumIkon, KlockaIkon, PilHogerIkon, PlatsIkon } from "./icons.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsStatusDot } from "./OpsStatusDot.jsx";
import { TillbakaKnapp } from "./TillbakaKnapp.jsx";

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
 * @property {string} datum `YYYY-MM-DD`.
 * @property {string} [slutDatum] Sista dagen, inklusive.
 * @property {string} [tid] `HH:MM`.
 * @property {string} [slutTid] `HH:MM`.
 * @property {boolean} [heldag]
 * @property {{ namn: string, ikon?: import("react").ReactNode, slag?: 1 | 2 | 3 }} [typ] Typen i appens ord. `slag` färgar ikonen (samma ton som raden i Idag), och `namn` står alltid bredvid: en färg ensam säger ingenting.
 * @property {"oppet" | "pagar" | "vantar" | "klart" | "akut"} [status] Kräver `statusWords`.
 * @property {{ namn: string, farg: 1 | 2 | 3 | 4 | 5 | 6 }} [kalender] Kalendern händelsen ligger i. Färgen står aldrig ensam: namnet står bredvid.
 * @property {string} [grupp] Gruppens namn.
 * @property {string} [plats]
 * @property {import("react").ReactNode} [beskrivning] Löptext, eller en färdig nod (en app som visar markdown skickar `<OpsMarkdown>`).
 * @property {boolean} [kravSvar] Gruppens medlemmar ombeds svara. Kräver `svar`.
 *
 * @param {object} props
 * @param {HandelseVy | null} props.handelse `null`: händelsen finns inte (och `laddar` är inte sant).
 * @param {boolean} [props.laddar] Appen läser händelsen ännu. Visar en väntan i stället för "finns inte".
 * @param {() => void} props.onTillbaka
 * @param {import("react").ReactNode} [props.svar] Svaren. Ritas bara när `handelse.kravSvar` är sant.
 * @param {import("react").ReactNode} [props.atgarder] Appens egna knappar, högst upp till höger bredvid titeln (SS redigera och export).
 * @param {{ oppet?: string, pagar?: string, vantar?: string, klart?: string, akut?: string }} [props.statusWords] KRÄVS för varje status som förekommer, som i `OpsEventList`.
 * @param {string} [props.sprak] Datumens språk, "sv" eller "en". Förval "sv".
 * @param {string} [props.tillbakaEtikett] Förval "Tillbaka".
 * @param {string} [props.gruppEtikett] Orden före gruppens namn. Förval "Grupp".
 * @param {string} [props.laddarEtikett] Förval "Hämtar händelsen".
 * @param {string} [props.saknasTitel] Förval "Händelsen finns inte".
 * @param {string} [props.saknasText] Förval "Den kan ha tagits bort, eller så får du inte se den."
 * @param {string} [props.tillEtikett] Skärmläsarens ord mellan två datum. Förval "till".
 */
export function OpsHandelsePanel({
  handelse,
  laddar = false,
  onTillbaka,
  svar,
  atgarder,
  statusWords = {},
  sprak = "sv",
  tillbakaEtikett = "Tillbaka",
  gruppEtikett = "Grupp",
  laddarEtikett = "Hämtar händelsen",
  saknasTitel = "Händelsen finns inte",
  saknasText = "Den kan ha tagits bort, eller så får du inte se den.",
  tillEtikett = "till",
}) {
  const rubrikId = useId();
  if (typeof onTillbaka !== "function") {
    throw new Error("OpsHandelsePanel: onTillbaka krävs. En panel utan väg tillbaka är en sida man inte kommer ut ur.");
  }
  if (handelse && handelse.status && !statusWords[handelse.status]) {
    throw new Error(`OpsHandelsePanel: händelsen har status ${handelse.status} men statusWords saknar ordet. En färgad prick utan ord bär betydelsen ensam, och då är statusen osynlig för skärmläsaren.`);
  }
  if (handelse && handelse.kravSvar === true && (svar === undefined || svar === null)) {
    throw new Error("OpsHandelsePanel: händelsen kräver svar (kravSvar) men panelen fick inget `svar`. Utan det visas en händelse som frågar utan frågan, och ingen kan svara.");
  }

  const kolumn = "mx-auto flex w-full max-w-4xl flex-col px-4 pt-2 pb-8 md:pt-4";

  if (!handelse) {
    return (
      <section aria-label={laddar ? laddarEtikett : saknasTitel} data-handelsepanel="" className={kolumn}>
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
    <section aria-labelledby={rubrikId} data-handelsepanel="" className={kolumn}>
      {/* ⛔ SS `mb-2 sm:mb-4` under raden: luften bor i raden och inte i rubriken, så den följer med om raden byts. */}
      <TillbakaKnapp onClick={onTillbaka} etikett={tillbakaEtikett} className="self-start md:mb-2" />

      {/* ⛔ TITELN OCH STATUSEN PÅ SAMMA RAD, STATUSEN TILL HÖGER (SS `EventDetailInlinePanel.jsx:56-60`). Titeln får hela resten av
          raden och bryter hellre än trunkeras: en händelse som heter något långt ska gå att läsa. */}
      <div className="mt-1 flex items-start justify-between gap-3">
        <h1 id={rubrikId} className="m-0 min-w-0 flex-1 text-titel font-bold leading-tight text-ink wrap-anywhere md:text-sida">
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
        {atgarder ? <div className="flex shrink-0 items-center gap-1">{atgarder}</div> : null}
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

      {/* ⛔ INFORMATIONSRUTAN (SS `EventDetailInfoTabInline.jsx:129`: `rounded border bg-card p-4 space-y-3`). Datumet är det stora, med en
          ikon i `w-5`; tiden under det i en tyngre vikt än brödtexten. En rad som händelsen inte har ritas inte (`handelsetid`). */}
      <div data-handelseinfo="" className="mt-4 flex flex-col gap-3 rounded-base border border-line bg-raised p-4">
        <div className="flex items-start gap-3 text-ink">
          <span className="mt-0.5 flex shrink-0 items-center">
            <DatumIkon size={20} />
          </span>
          <span data-handelsedatum="" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sida font-bold leading-tight">
            <span>{tid.start}</span>
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
            <span data-handelsetid="" className="text-titel font-semibold">
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

      {handelse.beskrivning ? (
        <div data-handelsebeskrivning="" className="mt-4 rounded-base border border-line bg-sunken p-4 text-etikett text-ink-secondary whitespace-pre-line wrap-anywhere">
          {handelse.beskrivning}
        </div>
      ) : null}

      {handelse.kravSvar === true ? (
        <div data-handelsesvar="" className="mt-6">
          {svar}
        </div>
      ) : null}
    </section>
  );
}
