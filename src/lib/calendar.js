/**
 * Kalenderns räkning: månader, rutnät och vilka poster som ligger på en dag.
 *
 * ⛔ REN LOGIK, INGEN JSX. Att den 1 oktober 2026 är en torsdag, och att en
 * måndagsförsta månad inleds med tre tomma rutor, går att prova utan att rendera
 * något. Ett prov som måste montera en komponent för att kontrollera en
 * veckodag är ett prov som blir rött av fel anledning den dagen någon byter en
 * klass.
 *
 * ⛔ MÅNDAG FÖRST. Svensk vecka börjar på måndag, och `Date.getDay()` säger 0
 * för söndag. Den omräkningen är precis en sådan rad man skriver fel en gång
 * och sedan aldrig tittar på igen, så den bor här med ett eget prov.
 *
 * ⛔ DATUM ÄR STRÄNGAR, `YYYY-MM-DD`, HELA VÄGEN. Ett `Date`-objekt bär en
 * tidszon, och en post som skrivs "2026-10-31" i en JSON blir kvällen den 30:e
 * i en webbläsare väster om Greenwich. Jämför man strängar finns det problemet
 * inte att ha.
 */

/**
 * @typedef {object} CalendarEntry
 * @property {string} id
 * @property {string} date `YYYY-MM-DD`.
 * @property {string} title
 * @property {"oppet"|"pagar"|"vantar"|"klart"|"akut"} [status] Pricken ärver `OpsStatusDot`s toner.
 * @property {string} [url] Finns den blir det en länk i kortets utfällning.
 * @property {string} [urlLabel] Länkens synliga ord, t.ex. "#249". Utan den står "Öppna".
 * @property {import("react").ReactNode} [details] Appens eget innehåll i utfällningen.
 *   ⛔ Ramverket ritar den, tolkar den aldrig: vad som är värt att fälla ut om en
 *   post beror på vad posten ÄR hos just den appen.
 * @property {string} [not] En rad extra under titeln i dagslistan.
 * @property {1|2|3|4|5|6} [edge] Färgad vänsterkant ur identitetspaletten, samma
 *   plats som `OpsCard` tar. För poster som tillhör något: ett slag, en grupp.
 *   ⛔ Vilken plats en sort får är APPENS beslut och aldrig ramverkets. Ramverket
 *   vet inte vilka sorter en plattform har, bara att en sort ska se likadan ut
 *   varje gång den syns.
 * @property {string} [edgeLabel] Vad kanten betyder. ⛔ Krävs när `edge` finns,
 *   annars kastar kortet. Se `lib/kant.js`.
 * @property {1|2|3} [slag] Vad posten ÄR, ur slagpaletten. Färgar både kortets
 *   kant och PRICKEN i rutnätet, så de två aldrig kan säga olika saker.
 *   ⛔ Vinner över `edge` när båda finns: pricken kan bara visa ett av dem.
 * @property {string} [slagLabel] Vad slaget heter. ⛔ Krävs när `slag` finns,
 *   och kastet sker redan när RUTNÄTET ritas, inte först när dagen öppnas.
 * @property {import("react").ReactNode} [kindIcon] Slagets bild. Ritas i stället
 *   för pricken i RUTNÄTET, i slagets färg.
 *   ⛔ BARA I RUTNÄTET. Dagspanelens kort bär redan statusprick, kant och slagets
 *   ord; en fjärde markör på samma rad är brus på ett kort som ska gå att läsa.
 *   Rutan är den enda yta där slaget inte gick att se alls.
 *   ⛔ SAMMA FÄLTNAMN SOM `OpsEventList` REDAN TAR, med flit. Samma post syns i
 *   båda ytorna, och två namn för samma bild är hur de börjar visa olika saker.
 *   ⛔ Ramverket bestämmer STORLEKEN i rutnätet och appen bestämmer BILDEN. En
 *   16 px ikon som passar en rad spränger en kalenderruta, och appen kan inte
 *   veta hur bred rutan är hos den som tittar.
 */

/**
 * Två siffror, alltid. `${m + 1}` ger "9" och inte "09", och då sorterar strängarna fel.
 *
 * @param {number} n
 */
function two(n) {
  return String(n).padStart(2, "0");
}

/**
 * Datumsträngen för ett år, en månad (0-indexerad) och en dag.
 *
 * @param {number} ar @param {number} month @param {number} day
 */
export function dateKey(ar, month, day) {
  return `${ar}-${two(month + 1)}-${two(day)}`;
}

/**
 * Dagens datum som sträng, i LOKAL tid.
 *
 * ⛔ INTE `toISOString()`. Den går via UTC, så i svensk sommartid blir klockan
 * 01.30 den 5:e till "2026-10-04". Kalendern hade ramat in fel dag som idag, och
 * bara mellan midnatt och två på natten, vilket är precis den sortens fel ingen
 * lyckas återskapa.
 *
 * @param {Date} [today]
 */
export function todayKey(today = new Date()) {
  return dateKey(today.getFullYear(), today.getMonth(), today.getDate());
}

/**
 * Vilken kolumn den 1:a hamnar i, med måndag som kolumn noll.
 *
 * @param {number} ar @param {number} month
 */
export function firstColumn(ar, month) {
  return (new Date(ar, month, 1).getDay() + 6) % 7;
}

/**
 * Antal dagar i månaden. Dag 0 i nästa månad ÄR sista dagen i den här.
 *
 * @param {number} ar @param {number} month
 */
export function daysInMonth(ar, month) {
  return new Date(ar, month + 1, 0).getDate();
}

/**
 * Månadens rutor, radvis, med `null` för tomma platser före den 1:a.
 *
 * ⛔ TOMMA PLATSER OCH INTE FÖREGÅENDE MÅNADS DAGAR. En grå 29:a bredvid en
 * svart 1:a inbjuder till ett tryck som antingen inte gör något eller hoppar
 * till en annan månad. En tom ruta lovar ingenting.
 *
 * ⛔ SISTA RADEN FYLLS INTE UT. Ett rutnät med `grid-cols-7` radar upp sig ändå,
 * och utfyllnad hade bara varit fler element att rita.
 *
 * @param {number} ar @param {number} month
 * @returns {(number | null)[][]} En lista rader, varje rad sju platser.
 */
export function monthGrid(ar, month) {
  /** @type {(number | null)[]} */
  const boxes = [];
  for (let i = 0; i < firstColumn(ar, month); i += 1) boxes.push(null);
  for (let d = 1; d <= daysInMonth(ar, month); d += 1) boxes.push(d);

  /** @type {(number | null)[][]} */
  const rows = [];
  for (let i = 0; i < boxes.length; i += 7) rows.push(boxes.slice(i, i + 7));
  return rows;
}

/**
 * Månaderna som ska ritas, bakåt och framåt från en utgångspunkt.
 *
 * @param {Date} today
 * @param {number} back Antal månader före den innevarande.
 * @param {number} ahead Antal månader efter den innevarande.
 * @returns {{ ar: number, month: number }[]}
 */
export function months(today, back, ahead) {
  const out = [];
  for (let i = -back; i <= ahead; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    out.push({ ar: d.getFullYear(), month: d.getMonth() });
  }
  return out;
}

/**
 * Posterna per dag.
 *
 * ⛔ EN KARTA OCH INTE EN FILTRERING PER RUTA. Ett rutnät på tre månader är
 * drygt nittio rutor, och en filtrering i varje ruta läser hela listan nittio
 * gånger. Kartan byggs en gång.
 *
 * ⛔ ORDNINGEN INOM DAGEN ÄR DEN INSKICKADE. Appen vet vad som är viktigast på
 * en dag; kalendern vet det inte och ska inte gissa.
 *
 * @param {CalendarEntry[]} entries
 * @returns {Map<string, CalendarEntry[]>}
 */
export function perDay(entries) {
  /** @type {Map<string, CalendarEntry[]>} */
  const byKey = new Map();
  for (const p of entries || []) {
    if (!p || typeof p.date !== "string" || !p.date) continue;
    const existed = byKey.get(p.date);
    if (existed) existed.push(p);
    else byKey.set(p.date, [p]);
  }
  return byKey;
}

/**
 * Språket kalendern talar tills språkvalet per användare finns.
 *
 * ⛔ EN BCP-47-STRÄNG, inte ett locale-objekt från ett bibliotek. Resten av
 * ramverket räknar redan så (`src/lib/format.js`), och två sorters språkvärde
 * i samma paket blir två sorters språkval i varje app som använder det.
 *
 * Fas 2 i cllp/ops-framework#92 ger användaren valet. Till dess är förvalet
 * svenska, precis som förut, men det är nu ett förval och inte en vägg.
 */
export const DEFAULT_LOCALE = "sv-SE";

/** @type {Map<string, string[]>} */
const manadscache = new Map();

/**
 * Månadernas namn i ett språk, i den form som står i en mening: "17 september".
 *
 * ⛔ UR `Intl`, INTE UR EN EGEN LISTA. En egen lista är tolv ord per språk som
 * någon ska skriva, stava rätt och hålla i takt, och webbläsaren kan dem redan
 * för varje språk som finns. Mätt: `sv-SE` ger exakt de tolv ord som stod
 * hårdkodade här innan, alltså är bytet osynligt på svenska och gratis på
 * resten (cllp/ops-framework#95).
 *
 * ⛔ DEN GAMLA INVÄNDNINGEN STÅR KVAR, den är bara flyttad. Skälet till att
 * `toLocaleDateString` var förbjudet i `dateText` var att den läser
 * WEBBLÄSARENS språk, så en dator satt på engelska skrev "October 12" mitt i ett
 * svenskt gränssnitt. Det som fixade det var aldrig den egna listan, utan att
 * språket bestäms av appen. Här står det i ett argument.
 *
 * ⛔ MELLANLAGRAT PER SPRÅK. `Intl.DateTimeFormat` är dyr att konstruera, och
 * `monthNames()` anropas en gång per månadsrubrik i en rulle som kan vara
 * femtio månader lång.
 *
 * @param {string} [locale]
 * @returns {string[]} Tolv namn, januari först.
 */
export function monthNames(locale = DEFAULT_LOCALE) {
  const nyckel = String(locale || DEFAULT_LOCALE);
  const fanns = manadscache.get(nyckel);
  if (fanns) return fanns;
  const fmt = new Intl.DateTimeFormat(nyckel, { month: "long" });
  // Dag 1 i en månad utan sommartidsbyte: rubriken får aldrig bero på klockan.
  const namn = Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2021, i, 1)));
  manadscache.set(nyckel, namn);
  return namn;
}

/** @type {Map<string, string[]>} */
const veckodagscache = new Map();

/**
 * Veckodagarnas korta namn, måndag först.
 *
 * ⛔ MÅNDAG FÖRST OCH INTE SPRÅKETS EGEN VECKOSTART. Rutnätet i `OpsCalendar`
 * räknar sin första kolumn ur `firstColumn()`, som är måndagsbaserad. Hämtade
 * raden sin ordning från språket medan rutorna behöll sin, hade varje dag
 * hamnat under fel rubrik i en engelsk app. Det är ett fel som ser ut som en
 * kalender: allt står snyggt, och allt är en dag fel.
 *
 * ⛔ STOR BOKSTAV PÅTVINGAD. Svenskan skriver veckodagar med liten bokstav, och
 * `Intl` svarar därefter ("mån"), medan engelskan svarar "Mon". En rubrikrad där
 * halva paketet är gement och halva versalt ser ut som ett fel, och versalisering
 * av en redan versal bokstav kostar ingenting.
 *
 * ⛔ Mätt 2026-09-25, Node ICU 78.2: `sv-SE` ger mån tis ons tors fre lör sön.
 * Den gamla hårdkodade raden sade "Tor", `Intl` säger "tors". Det är den korrekta
 * svenska förkortningen, och kolumnen rymmer den.
 *
 * @param {string} [locale]
 * @returns {string[]} Sju namn, måndag först.
 */
export function weekdayNames(locale = DEFAULT_LOCALE) {
  const nyckel = String(locale || DEFAULT_LOCALE);
  const fanns = veckodagscache.get(nyckel);
  if (fanns) return fanns;
  const fmt = new Intl.DateTimeFormat(nyckel, { weekday: "short" });
  // 2024-01-01 var en måndag. Sju dagar framåt ger veckan i rätt ordning.
  const namn = Array.from({ length: 7 }, (_, i) => {
    const ord = fmt.format(new Date(2024, 0, 1 + i));
    return ord.charAt(0).toUpperCase() + ord.slice(1);
  });
  veckodagscache.set(nyckel, namn);
  return namn;
}

/**
 * Datumnyckeln som läsbar rubrik: "2026-10-12" blir "12 oktober".
 *
 * ⛔ RUBRIKEN I DAGSBUBBLAN ÄR INTE NYCKELN. Bubblan öppnas genom att man
 * trycker på en dag man ser, alltså vet man redan året och månaden; det som
 * behövs är en bekräftelse på VILKEN dag man träffade. "2026-10-12" är en
 * maskinnyckel och läses som en post, inte som en rubrik.
 *
 * ⛔ INGEN `toLocaleDateString`. Den läser WEBBLÄSARENS språk, så samma app hade
 * skrivit "October 12" på en dator satt på engelska medan resten av gränssnittet
 * står på svenska. Språket är appens beslut och kommer in som argument, aldrig
 * ur maskinen (cllp/ops-framework#95).
 *
 * ⛔ STRÄNGEN SOM INTE ÄR ETT DATUM GER TILLBAKA SIG SJÄLV i stället för
 * "NaN undefined". En rubrik som skriker är sämre än en som är tråkig.
 *
 * @param {string} key `YYYY-MM-DD`.
 * @param {string} [locale]
 */
export function dateText(key, locale = DEFAULT_LOCALE) {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || "");
  if (!hit) return key || "";
  const month = Number(hit[2]) - 1;
  if (month < 0 || month > 11) return key;
  return `${Number(hit[3])} ${monthNames(locale)[month]}`;
}

/**
 * Åt vilket håll man ska rulla för att nå ett element som lämnat rutan.
 *
 * ══ ⛔ VARFÖR DET HÄR ÄR EN FUNKTION OCH INTE TVÅ RADER I EN OBSERVATÖR ══
 *
 * CP 2026-09-22, med bild: "Idag-bubblan för att komma tillbaka till idag visar
 * alltid ner-pil. När idag är uppåt skall pilen gå uppåt."
 *
 * Den gamla raden jämförde elementets NEDERKANT med rutans överkant. Det låter
 * rätt och är fel i praktiken, för `IntersectionObserver` skickar sitt svar i
 * samma ögonblick som elementet KORSAR tröskeln, alltså när nederkanten ligger
 * på ungefär samma pixel som rutans överkant. En bråkdels pixel åt fel håll,
 * och jämförelsen svarar "under" fast månaden just försvann uppåt. Därför pekade
 * pilen nedåt så gott som alltid.
 *
 * ⛔ ÖVERKANT MOT ÖVERKANT I STÄLLET. Den jämförelsen är inte hårfin: har
 * månaden lämnat uppåt ligger dess överkant en hel månadshöjd ovanför rutans,
 * och har den lämnat nedåt ligger den långt under. Det finns ingen situation där
 * de två är nära varandra och elementet ändå är ur bild.
 *
 * ⛔ REN FUNKTION, FÖR ATT DEN SKA GÅ ATT PROVA. jsdom har ingen
 * `IntersectionObserver` och ingen layout, så beslutet går inte att nå genom att
 * rendera något. Som funktion är det två tal in och ett ord ut.
 *
 * @param {{ top: number }} theElement Elementets rektangel.
 * @param {{ top: number } | null} theBox Rullbehållarens rektangel, eller null.
 * @returns {"upp" | "ner"} "upp" = rulla uppåt för att nå det.
 */
export function scrollDirection(theElement, theBox) {
  const boxTop = theBox ? theBox.top : 0;
  return theElement.top < boxTop ? "upp" : "ner";
}
