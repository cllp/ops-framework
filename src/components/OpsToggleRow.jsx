import { cx } from "../lib/cx.js";

/**
 * En rad som går att tona ned: med i summan, eller inte.
 *
 * ── ⛔ VARFÖR INTE EN KRYSSRUTA ───────────────────────────────────────────
 *
 * Den här ersätter `OpsCheckbox` i summeringslistor, och skälet är inte bara
 * att kryssrutan är ful (CP: "istället för checkbox som är svinfult").
 *
 * En kryssruta ställer frågan "är det här sant?". I en summeringslista är
 * frågan en annan: "ska det här räknas med?". Det är ett filter, inte ett
 * påstående, och kryssrutan får raden att se ut som data man redigerar snarare
 * än som ett urval man leker med.
 *
 * ── ⛔ EN SYNLIG KNAPP, INTE BARA NEDTONAD TEXT ──────────────────────────
 *
 * Första versionen var en osynlig yta: ingen ram, ingen bakgrund, bara opacitet
 * som skillnad. Den var lugn och gick inte att se att den gick att trycka på.
 *
 * CP föreslog formen som gäller nu: "knappar med text och rundade hörn som blir
 * utgråade (unselected) och aktiverade genom tryckning". Raden har därför en
 * egen yta med ram och rundade hörn. Påslagen är den upphöjd, avslagen är den
 * nedsänkt och gråare.
 *
 * ⛔ Den behåller sina TVÅ KOLUMNER, och det var det som avgjorde valet mellan
 * en full bredd och ett piller. Beloppen i en tillgångslista spänner från
 * 99 947 till 6 800 000 kr. Står de högerställda i en kolumn ser man med en
 * blick vilka poster som dominerar; sitter de inuti ett piller som radbryts
 * måste man läsa varje för sig, och den visuella rangordningen försvinner.
 * Pillerformen hör hemma där det inte finns siffror, alltså i `OpsFilterChip`.
 *
 * ── ⛔ TRE SAKER BÄR TILLSTÅNDET, OCH DET ÄR MÄTT ────────────────────────
 *
 * 1. `aria-pressed` gör tillståndet läsbart för skärmläsare. Utan den finns
 *    urvalet helt enkelt inte för den som inte ser skärmen.
 * 2. Beloppet får genomstruken stil. Grå text kan läsas som "inaktiv" eller
 *    "inte klar" lika gärna som "räknas inte"; en genomstrykning betyder en sak.
 * 3. Ytan sänks och texten dämpas, men BARA till `ink-secondary`.
 *
 * ⛔ Punkt tre är en rättning av ett mätt fel. Avslaget läge använde
 * `ink-muted`, och kontrasten blev då 3,13:1 i ljust läge och 2,84:1 i mörkt.
 * WCAG AA kräver 4,5:1 för brödtext. Undantaget för inaktiva kontroller gäller
 * INTE här: raden är inte avstängd, den är fullt tryckbar och ska gå att ångra.
 * Med `ink-secondary` blev det 8,11:1 respektive 4,49:1.
 *
 * Den gamla `opacity-45`-varianten mätte 2,88:1 i ljust läge, alltså sämre än
 * båda. "Nedtonad" får inte betyda "oläslig": man ska kunna läsa vad man valt
 * bort, annars går urvalet inte att granska.
 *
 * ⛔ Nedtonad är INTE `disabled`. En `disabled`-knapp faller ur tabbordningen,
 * alltså går urvalet inte att ångra med tangentbord.
 *
 * ⛔ Raden äger inte sitt eget avstånd till nästa rad. Den har en synlig ram, så
 * en lista behöver luft mellan raderna: ge behållaren `gap`.
 *
 * ── ⛔ `kontroll`: EN KONTROLL PÅ RADEN, UTANFÖR KNAPPEN ─────────────────
 *
 * CP 2026-09-20: "Skulle vilja att reglage fanns i varje post direkt att man
 * kan dra i reglaget."
 *
 * Det gick inte förut, och skälet stod utskrivet i bolag-ops: raden VAR en
 * knapp. Ett reglage inuti en `<button>` är ogiltig HTML, och varje drag hade
 * dessutom bubblat upp och växlat radens nedtoning. Man hade tonat ned posten
 * genom att simulera den.
 *
 * Därför bär nu ett OMSLAG ramen och färgen, medan knappen är genomskinlig och
 * äger översta raden. Kontrollen ligger som syskon till knappen, alltså utanför
 * den. Ingen händelse från kontrollen når knappen, och ingen av dem ligger i den
 * andra.
 *
 * ⛔ UTAN `kontroll` ÄR MARKUPEN OFÖRÄNDRAD I ALLT SOM SYNS. Ramen flyttade ett
 * steg ut, men måtten, färgerna och tillstånden är desamma. En lista utan
 * kontroller ska inte betala något för att möjligheten finns.
 *
 * ⛔ RAMVERKET AVGÖR INTE OM EN NEDTONAD RAD FÅR HA EN KONTROLL. Det vet bara
 * appen: i bolag-ops är en nedtonad post borträknad och kan därför inte
 * simuleras, så där skickas ingen kontroll in för den. En annan app kan ha en
 * kontroll som är meningsfull även avstängd. Komponenten ritar det den får.
 */

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.label Vänsterkolumnen: vad raden heter.
 * @param {import("react").ReactNode} [props.value] Högerkolumnen: beloppet eller talet.
 * @param {boolean} props.on Sant = räknas med, skarp. Falskt = nedtonad.
 * @param {(on: boolean) => void} props.onChange
 * @param {string} [props.offLabel] Vad nedtonat betyder, för skärmläsare. Läggs efter etiketten.
 * @param {import("react").ReactNode} [props.kontroll] En kontroll på raden, till exempel ett reglage.
 *   ⛔ Renderas UTANFÖR knappen: se doktexten. Utelämnad ritas ingenting extra.
 */
export function OpsToggleRow({ label, value, on, onChange, offLabel = "räknas inte", kontroll }) {
  const knapp = (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cx(
        "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-left",
        kontroll ? null : "px-4 py-3",
        kontroll ? "px-1" : null,
        "transition-colors duration-(--duration-fast) ease-standard",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        on ? "text-ink" : "text-ink-secondary",
      )}
    >
      <span className="min-w-0 flex-1 truncate font-medium">
        {label}
        {/* ⛔ Ordet, inte bara ytan. Skärmläsaren får `aria-pressed`, men den som
            ser skärmen med nedsatt färgseende får ingenting av en gråare
            bakgrund, och det här kostar ingenting.

            ⛔ INGET KOMMATECKEN i strängen. Det stod ", {offLabel}" här, och
            Chromium lade som väntat till ett eget blanksteg mellan textnoderna
            när namnet räknades fram. Mätt med `ariaSnapshot`:

              button "Fonder , räknas inte 3 000 000 kr"

            Skiljetecknet hamnade alltså löst mitt i namnet. Utan det blir raden
            "Fonder räknas inte 3 000 000 kr", som är en läsbar mening. Lita inte
            på att egen interpunktion mellan element hamnar där du tänkte: det är
            namnberäkningen och inte du som bestämmer avstånden. */}
        {on ? null : <span className="sr-only">{offLabel}</span>}
      </span>
      {value === undefined || value === null ? null : (
        <span className={cx("shrink-0 tabular-nums", on ? "text-ink-secondary" : "line-through")}>{value}</span>
      )}
    </button>
  );

  /*
   * ⛔ RAMEN BOR PÅ OMSLAGET OCH INTE PÅ KNAPPEN, så att kontrollen ligger
   * innanför samma yta utan att ligga inuti knappen. `group` finns för att
   * knappens hover ska kunna färga omslagets kant: annars reagerar ramen inte på
   * att man är på väg att trycka, och raden känns död.
   */
  const omslag = cx(
    "rounded-lg border transition-colors duration-(--duration-fast) ease-standard",
    on
      ? "border-line-strong bg-raised hover:border-accent"
      : "border-line bg-sunken hover:border-line-strong",
  );

  if (!kontroll) return <div className={omslag}>{knapp}</div>;

  return (
    <div className={cx(omslag, "flex flex-col gap-1 px-3 py-2")}>
      {knapp}
      {/* ⛔ EGET SYSKON, ALDRIG INUTI KNAPPEN. Ett reglage i en `<button>` är
          ogiltig HTML, och draget hade växlat radens nedtoning. */}
      <div className="px-1 pb-1">{kontroll}</div>
    </div>
  );
}
