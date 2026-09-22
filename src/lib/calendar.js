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
 * @property {"open"|"inProgress"|"waiting"|"done"|"urgent"} [status] Pricken ärver `OpsStatusDot`s toner.
 * @property {string} [url] Finns den blir det en länk i kortets utfällning.
 * @property {string} [urlLabel] Länkens synliga ord, t.ex. "#249". Utan den står "Öppna".
 * @property {import("react").ReactNode} [details] Appens eget innehåll i utfällningen.
 *   ⛔ Ramverket ritar den, tolkar den aldrig: vad som är värt att fälla ut om en
 *   post beror på vad posten ÄR hos just den appen.
 * @property {string} [not] En rad extra under titeln i dagslistan.
 */

/**
 * Två siffror, alltid. `${m + 1}` ger "9" och inte "09", och då sorterar strängarna fel.
 *
 * @param {number} n
 */
function tva(n) {
  return String(n).padStart(2, "0");
}

/**
 * Datumsträngen för ett år, en månad (0-indexerad) och en dag.
 *
 * @param {number} ar @param {number} manad @param {number} dag
 */
export function dateKey(ar, manad, dag) {
  return `${ar}-${tva(manad + 1)}-${tva(dag)}`;
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
 * @param {number} ar @param {number} manad
 */
export function forstaKolumnen(ar, manad) {
  return (new Date(ar, manad, 1).getDay() + 6) % 7;
}

/**
 * Antal dagar i månaden. Dag 0 i nästa månad ÄR sista dagen i den här.
 *
 * @param {number} ar @param {number} manad
 */
export function dagarIManaden(ar, manad) {
  return new Date(ar, manad + 1, 0).getDate();
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
 * @param {number} ar @param {number} manad
 * @returns {(number | null)[][]} En lista rader, varje rad sju platser.
 */
export function monthGrid(ar, manad) {
  /** @type {(number | null)[]} */
  const rutor = [];
  for (let i = 0; i < forstaKolumnen(ar, manad); i += 1) rutor.push(null);
  for (let d = 1; d <= dagarIManaden(ar, manad); d += 1) rutor.push(d);

  /** @type {(number | null)[][]} */
  const rader = [];
  for (let i = 0; i < rutor.length; i += 7) rader.push(rutor.slice(i, i + 7));
  return rader;
}

/**
 * Månaderna som ska ritas, bakåt och framåt från en utgångspunkt.
 *
 * @param {Date} today
 * @param {number} bakat Antal månader före den innevarande.
 * @param {number} ahead Antal månader efter den innevarande.
 * @returns {{ ar: number, manad: number }[]}
 */
export function months(today, bakat, ahead) {
  const ut = [];
  for (let i = -bakat; i <= ahead; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    ut.push({ ar: d.getFullYear(), manad: d.getMonth() });
  }
  return ut;
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
  const karta = new Map();
  for (const p of entries || []) {
    if (!p || typeof p.date !== "string" || !p.date) continue;
    const existed = karta.get(p.date);
    if (existed) existed.push(p);
    else karta.set(p.date, [p]);
  }
  return karta;
}

/**
 * Månadernas namn, i den form som står i en mening: "17 september".
 *
 * ⛔ HÄR OCH INTE I KOMPONENTEN. Rubriken över ett månadsrutnät och rubriken i
 * dagsbubblan är samma ord, och två listor hade glidit isär första gången någon
 * rättade en stavning i den ena.
 */
export const MONTH_NAMES = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];

/**
 * Datumnyckeln som läsbar rubrik: "2026-10-12" blir "12 oktober".
 *
 * ⛔ RUBRIKEN I DAGSBUBBLAN ÄR INTE NYCKELN. Bubblan öppnas genom att man
 * trycker på en dag man ser, alltså vet man redan året och månaden; det som
 * behövs är en bekräftelse på VILKEN dag man träffade. "2026-10-12" är en
 * maskinnyckel och läses som en post, inte som en rubrik.
 *
 * ⛔ INGEN `toLocaleDateString`. Den läser webbläsarens språk, så samma app hade
 * skrivit "October 12" på en dator satt på engelska medan resten av gränssnittet
 * står på svenska. Kalendern har redan sina veckodagar och månadsnamn i koden,
 * och två källor till samma ord glider isär.
 *
 * ⛔ STRÄNGEN SOM INTE ÄR ETT DATUM GER TILLBAKA SIG SJÄLV i stället för
 * "NaN undefined". En rubrik som skriker är sämre än en som är tråkig.
 *
 * @param {string} nyckel `YYYY-MM-DD`.
 */
export function datumtext(nyckel) {
  const traff = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nyckel || "");
  if (!traff) return nyckel || "";
  const manad = Number(traff[2]) - 1;
  if (manad < 0 || manad > 11) return nyckel;
  return `${Number(traff[3])} ${MONTH_NAMES[manad]}`;
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
 * @param {{ top: number }} elementet Elementets rektangel.
 * @param {{ top: number } | null} rutan Rullbehållarens rektangel, eller null.
 * @returns {"upp" | "ner"} "upp" = rulla uppåt för att nå det.
 */
export function rullriktning(elementet, rutan) {
  const rutansTopp = rutan ? rutan.top : 0;
  return elementet.top < rutansTopp ? "upp" : "ner";
}
