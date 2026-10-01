/**
 * Händelsepanelens adress och den tid den visar (0.40.0, #214).
 *
 * ══ ⛔ VARFÖR EN PANEL, OCH VARFÖR DEN HAR EN EGEN ADRESS ═════════════════════
 *
 * CP 2026-10-01: "Vi behöver en händelsepanel. Så man navigerar dit från kalender och från idag. Händelsepanelen skall ha en tillbaka
 * knapp. Kolla SessionStudio." En rad i Idag och en post i kalenderns dagpanel kunde fälla ut lite text, men ingen av dem kunde ÖPPNA
 * händelsen: det fanns ingen sida att gå till. SS öppnar `EventDetailRouteView` (en rad "‹ Tillbaka" och händelsen under), och
 * `returnFromEventDetailView` för tillbaka till kalendern eller Idag.
 *
 * ⛔ ADRESSEN ÄR `?handelse=<id>`, PÅ SIDAN MAN STÅR PÅ. Samma mekanism som skapa-panelens `?skapa=` (0.31.0): skalet lägger parametern
 * i adressen med `pushState`, appens vy ligger kvar monterad men dold, och Tillbaka (knappen och webbläsarens) tar bort den igen.
 * Därför kommer man tillbaka till EXAKT det man lämnade: kalenderns månad och valda dagar, Idags flik, filter och rullning. Ett eget
 * ruttträd hade tvingat varje app att bygga om vyn vid tillbaka, och det var just det som gjorde att filter och rullning försvann.
 * Adressen är också det som gör att en händelse går att länka till och att en omladdning öppnar samma panel.
 *
 * ⛔ `id` ÄR APPENS. Ramverket vet inte vad en händelse är i appen, bara att den har ett id som appen kan slå upp.
 */

/** Parametern i adressen. Ett namn, så att skalet, hjälpfunktionerna och proven inte skriver det på tre ställen. */
export const HANDELSEPARAM = "handelse";

/**
 * Adressen till en händelses panel, relativt sidan man står på: `?handelse=<id>`. Används som `href` på en rad, så att en rad är en
 * riktig länk (högerklick, öppna i ny flik) och inte bara en knapp.
 * @param {string} id
 * @returns {string}
 */
export function handelseHref(id) {
  if (typeof id !== "string" || id === "") throw new Error("handelseHref: id krävs, en sträng som inte är tom.");
  return `?${HANDELSEPARAM}=${encodeURIComponent(id)}`;
}

/**
 * Händelsens id ur en adress, eller `null`.
 * @param {string} href En adress eller en `location.href`.
 * @returns {string | null}
 */
export function handelseIdUrAdress(href) {
  const v = new URL(href, "http://x.invalid").searchParams.get(HANDELSEPARAM);
  return v === null || v === "" ? null : v;
}

/**
 * Samma adress med händelsen satt (`id`) eller borttagen (`null`). Allt annat i adressen (sidan, andra parametrar, `#`) står kvar.
 * @param {string} href @param {string | null} id
 * @returns {string} Sökväg, sökning och fragment. Aldrig en annan origin.
 */
export function medHandelse(href, id) {
  const u = new URL(href, "http://x.invalid");
  if (id === null) u.searchParams.delete(HANDELSEPARAM);
  else u.searchParams.set(HANDELSEPARAM, id);
  return `${u.pathname}${u.search}${u.hash}`;
}

/** @param {string} sprak @returns {string} */
const lokal = (sprak) => (sprak === "en" ? "en-GB" : "sv-SE");

/**
 * Ett datum `YYYY-MM-DD` som "måndag 12 oktober 2026". ⛔ Läses som kalenderdag i UTC och skrivs i UTC: `new Date("2026-10-12")` är
 * midnatt UTC, och i en annan zon hade samma sträng blivit dagen innan (samma fälla som `formatDate`).
 * @param {string} datum @param {string} [sprak]
 * @returns {string}
 */
export function langtDatum(datum, sprak = "sv") {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  if (!d) return datum;
  const t = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3])));
  return new Intl.DateTimeFormat(lokal(sprak), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(t);
}

/**
 * @typedef {object} Handelsetid
 * @property {string} datum `YYYY-MM-DD`.
 * @property {string} [slutDatum] Sista dagen, inklusive. Bara när den är efter `datum`.
 * @property {string} [tid] `HH:MM`.
 * @property {string} [slutTid] `HH:MM`.
 * @property {boolean} [heldag]
 */

/**
 * Det som står på raderna för datum och tid: `{ start, slut, tid }`. `slut` finns bara för en händelse över flera dagar, `tid` är
 * "Heldag", "18:00 - 20:00", "18:00" eller en tom sträng när händelsen saknar klockslag.
 *
 * ⛔ SS ordning (`EventDetail.jsx`, `timeHeroLabel`): en händelse över flera dagar visar sina två datum och ingen tid. Ramverkets
 * händelse kan ha båda (22:00 till 02:00 dagen efter, `handelsefel`), och då är tiden en uppgift om vilket klockslag det börjar och
 * slutar, så den står kvar under spannet i stället för att tigas.
 *
 * ⛔ Ett bindestreck och inte tankstreck (arbetsreglernas punkt 6).
 * @param {Handelsetid} h @param {string} [sprak]
 * @returns {{ start: string, slut: string, tid: string }}
 */
export function handelsetid(h, sprak = "sv") {
  const slut = typeof h.slutDatum === "string" && h.slutDatum > h.datum ? langtDatum(h.slutDatum, sprak) : "";
  const tid = h.heldag === true ? (sprak === "en" ? "All day" : "Heldag") : h.tid && h.slutTid ? `${h.tid} - ${h.slutTid}` : h.tid ?? "";
  return { start: langtDatum(h.datum, sprak), slut, tid };
}
