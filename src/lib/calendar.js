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
 * @property {string} [endDate] Sista dagen, `YYYY-MM-DD`, inklusive (0.36.0, #179 F1). Finns den och ligger efter
 *   `date` ritas posten som ett BAND över dagarna, en rad per vecka, i stället för ett märke i varje ruta.
 * @property {boolean} [allDay] Heldag (0.36.0). Ritas som ett band också när den är en enda dag, och kortet säger
 *   "Heldag" i stället för ett klockslag.
 * @property {{ id: string, namn: string, farg: 1|2|3|4|5|6 }} [kalender] Kalendern posten ligger i (0.36.0, #179 F0).
 *   Färgen är en ton ur identitetspaletten och står ALDRIG ensam: namnet står bredvid den i kortet och i filtret.
 *   ⛔ Saknas den hör posten till den förvalda kalendern i `OpsCalendar`s `kalendrar` (en händelse skriven före
 *   0.36.0 har ingen kalender, och ska inte försvinna ur ett filter för det).
 * @property {string} [typ] Typens id ur appens typkatalog (0.36.0). Det verktygsradens typfilter jämför med.
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
  /** @param {string} dag @param {CalendarEntry} p */
  const lagg = (dag, p) => {
    const existed = byKey.get(dag);
    if (existed) existed.push(p);
    else byKey.set(dag, [p]);
  };
  for (const p of entries || []) {
    if (!p || typeof p.date !== "string" || !p.date) continue;
    /*
     * ⛔ EN FLERDAGSPOST LIGGER PÅ VARJE DAG DEN TÄCKER (0.36.0). Dagpanelen och snabbtitten ska visa den oavsett vilken
     * av dagarna man tryckte på, och räknaren i rutan ska räkna den. Taket (`MAX_SPANN`) finns för att en post med ett
     * felskrivet slutår inte ska bli trettiotusen nycklar.
     */
    if (typeof p.endDate === "string" && p.endDate > p.date) {
      for (const dag of datumOmfang(p.date, p.endDate).slice(0, MAX_SPANN)) lagg(dag, p);
    } else {
      lagg(p.date, p);
    }
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

/*
 * ═══════════════════════════════════════════════════════════════════════
 * ⛔ 0.36.0 (#179 F1): MÅNADSVYN SOM SESSIONSTUDIO. Allt nedan är ren logik av samma skäl som filhuvudet: veckans
 * nummer, ett band över tre veckor och vad ett andra tryck gör ska gå att prova utan att rendera något.
 * ═══════════════════════════════════════════════════════════════════════
 */

/** Tak för hur många dagar en post kan spänna över innan den kapas i rutnätet. Ett år och en dag. */
export const MAX_SPANN = 367;

/**
 * Dagen efter, som sträng. Via UTC, så att en sommartidsövergång aldrig ger samma dag två gånger.
 * @param {string} dag @param {number} [n] @returns {string}
 */
export function plusDagar(dag, n = 1) {
  const [a, m, d] = dag.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${two(dt.getUTCMonth() + 1)}-${two(dt.getUTCDate())}`;
}

/**
 * Alla dagar från och med `fran` till och med `till`, i ordning. Omvänd ordning ger samma svar, eftersom en
 * dra-markering kan gå bakåt.
 * @param {string} fran @param {string} till @returns {string[]}
 */
export function datumOmfang(fran, till) {
  const [a, b] = fran <= till ? [fran, till] : [till, fran];
  const ut = [];
  for (let d = a; d <= b && ut.length <= MAX_SPANN; d = plusDagar(d)) ut.push(d);
  return ut;
}

/**
 * ISO-veckonumret för en dag (måndag först, vecka 1 är den som innehåller årets första torsdag). SS `getISOWeek`.
 * @param {number} ar @param {number} month 0-indexerad @param {number} day @returns {number}
 */
export function isoVecka(ar, month, day) {
  const d = new Date(Date.UTC(ar, month, day));
  const veckodag = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - veckodag + 3);
  const forstaTorsdag = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - forstaTorsdag.getTime()) / 86400000 - 3 + ((forstaTorsdag.getUTCDay() + 6) % 7)) / 7);
}

/**
 * Fönstret kalendern ritar: första dagen i den tidigaste månaden till sista dagen i den senaste.
 *
 * ⛔ EN FUNKTION SOM BÅDE VYN OCH APPENS LÄSVÄG ANVÄNDER. `/kalender` läste Idags 60 dagar framåt och ingenting
 * bakåt (cllp/bolag-ops `web/src/data/events.js`), så tolv månader historik ritades tomma. Ska appen läsa rätt fönster
 * får den inte räkna fram det själv: två räkningar av samma fönster glider isär första gången standardvärdet ändras.
 *
 * @param {string | Date} idag `YYYY-MM-DD` eller ett datum.
 * @param {number} [bakat] Förval 12, som SS `CalView.jsx` (`monthsBefore = 12`).
 * @param {number} [framat] Förval 12, som SS `CalendarView.jsx` (`monthsToShow={12}`).
 * @returns {{ fran: string, till: string }}
 */
export function kalenderfonster(idag, bakat = 12, framat = 12) {
  const bas = typeof idag === "string" ? franNyckel(idag) : idag;
  const lista = months(bas, bakat, framat);
  const forsta = lista[0];
  const sista = lista[lista.length - 1];
  return { fran: dateKey(forsta.ar, forsta.month, 1), till: dateKey(sista.ar, sista.month, daysInMonth(sista.ar, sista.month)) };
}

/**
 * Ett datum ur en nyckel, klockan tolv lokal tid (aldrig midnatt: då kan en sommartidsövergång flytta den en dag).
 * @param {string} nyckel @returns {Date}
 */
export function franNyckel(nyckel) {
  const [a, m, d] = nyckel.split("-").map(Number);
  return new Date(a, m - 1, d, 12);
}

/**
 * Ett band i en veckorad.
 * @typedef {object} Bandbit
 * @property {CalendarEntry} entry
 * @property {number} startCol 0 till 6.
 * @property {number} colSpan
 * @property {boolean} borjar Posten börjar i den här veckan (bandets vänstra ände är rund, och titeln står där).
 * @property {boolean} slutar Posten slutar i den här veckan.
 * @property {number} fil Vilken rad bandet ligger i när flera överlappar.
 */

/**
 * Banden i en veckorad: flerdagsposter och heldagsposter, med fil per överlapp (SS `getSpanSegmentsForWeekRow`).
 *
 * ⛔ FILERNA DELAS UT GIRIGT: varje bit i den lägsta fil vars senaste bit slutar före den här börjar. Samma regel som
 * SS, och av samma skäl: två band som överlappar ska staplas och inte ritas ovanpå varandra.
 *
 * @param {(string | null)[]} rad Veckans sju nycklar, `null` för en tom ruta.
 * @param {CalendarEntry[]} entries
 * @returns {Bandbit[]}
 */
export function bandIVecka(rad, entries) {
  /** @type {Bandbit[]} */
  const bitar = [];
  for (const e of entries || []) {
    if (!e || typeof e.date !== "string") continue;
    const slut = typeof e.endDate === "string" && e.endDate > e.date ? e.endDate : e.date;
    if (!(slut > e.date || e.allDay)) continue;
    let startCol = -1;
    let endCol = -1;
    rad.forEach((dag, col) => {
      if (dag && dag >= e.date && dag <= slut) {
        if (startCol < 0) startCol = col;
        endCol = col;
      }
    });
    if (startCol < 0) continue;
    bitar.push({ entry: e, startCol, colSpan: endCol - startCol + 1, borjar: rad[startCol] === e.date, slutar: rad[endCol] === slut, fil: 0 });
  }
  bitar.sort((a, b) => a.startCol - b.startCol || b.colSpan - a.colSpan || String(a.entry.title).localeCompare(String(b.entry.title)));
  /** @type {number[]} */
  const filSlut = [];
  for (const b of bitar) {
    let fil = 0;
    while (fil < filSlut.length && filSlut[fil] >= b.startCol) fil += 1;
    b.fil = fil;
    filSlut[fil] = b.startCol + b.colSpan - 1;
  }
  return bitar;
}

/**
 * Om en post är ett band (flerdag eller heldag) och därför inte ett märke i rutan.
 * @param {CalendarEntry} e @returns {boolean}
 */
export const arBand = (e) => Boolean(e && ((typeof e.endDate === "string" && e.endDate > e.date) || e.allDay));

/**
 * Ett tryck på en dag: med i urvalet om den inte var det, ur urvalet om den var det. Sorterat.
 *
 * ⛔ SAMMA SVAR SOM SS `handleCalDaySelect`, som skiljer på "en vald dag" och "flera valda" men gör samma sak i båda:
 * ett andra tryck på en annan dag lägger till den, ett tryck på en vald dag tar bort den.
 *
 * @param {readonly string[]} valda @param {string} dag @returns {string[]}
 */
export function valjDag(valda, dag) {
  return valda.includes(dag) ? valda.filter((d) => d !== dag) : [...valda, dag].sort();
}

/**
 * Ett tryck på veckonumret: är hela veckan redan vald tas den bort, annars läggs den till (SS `handleCalWeekSelect`).
 * @param {readonly string[]} valda @param {readonly string[]} vecka @returns {string[]}
 */
export function valjVecka(valda, vecka) {
  const alla = vecka.length > 0 && vecka.every((d) => valda.includes(d));
  const s = new Set(valda);
  for (const d of vecka) {
    if (alla) s.delete(d);
    else s.add(d);
  }
  return [...s].sort();
}

/**
 * En dra-markering: intervallet läggs till urvalet (SS `handleCalRangeSweepSelect`). Under två dagar är det ett tryck,
 * inte ett drag, och urvalet lämnas orört.
 * @param {readonly string[]} valda @param {readonly string[]} dagar @returns {string[]}
 */
export function valjIntervall(valda, dagar) {
  if (dagar.length < 2) return [...valda];
  return [...new Set([...valda, ...dagar])].sort();
}

/**
 * Om en post träffar en sökning: titel, rad under titeln eller kalenderns namn, utan hänsyn till versaler.
 * @param {CalendarEntry} e @param {string} fraga @returns {boolean}
 */
export function traffar(e, fraga) {
  const f = fraga.trim().toLocaleLowerCase("sv");
  if (!f) return true;
  return [e.title, e.not, e.kalender && e.kalender.namn].some((t) => typeof t === "string" && t.toLocaleLowerCase("sv").includes(f));
}

/**
 * Kalendern en post utan `kalender` hör till: gruppens förvalda, annars gruppens första, annars en förvald av mina.
 *
 * ⛔ GRUPPENS FÖRST. En post utan kalender är en av appens händelser skriven före 0.36.0, och en händelse ligger alltid i
 * gruppen, aldrig i någons egen kalender (`handelsensKalenderId`).
 *
 * @param {ReadonlyArray<{ id: string, grupp?: boolean, forvald?: boolean }> | undefined} kalendrar @returns {string}
 */
export function forvaldKalenderId(kalendrar) {
  const alla = kalendrar || [];
  const g = alla.filter((k) => k.grupp);
  return ((g.find((k) => k.forvald) || g[0] || alla.find((k) => k.forvald)) || { id: "" }).id;
}

/**
 * Posterna som syns med ett filter: valda kalendrar, typ och status (0.37.0, utbruten ur `OpsCalendar`, #179 F2).
 *
 * ⛔ REN FUNKTION, SÅ ATT KLARKRITERIET GÅR ATT PROVA DIREKT: "en post i en bortvald kalender syns inte, och syns igen när
 * kalendern väljs". Filtret avgör vad som RITAS, inte vad som finns: snabbtitten visar resten märkt "Dold".
 *
 * ⛔ `valdaKalendrar: null` ÄR ALLA, OCH ETT TOMT URVAL BLIR ALDRIG "INGA" (verktygsraden gör det till `null`).
 *
 * @param {ReadonlyArray<CalendarEntry>} entries
 * @param {{ valdaKalendrar: ReadonlyArray<string> | null, forvaldId: string, typ?: string, status?: string }} filter
 * @returns {CalendarEntry[]}
 */
export function filtreraPoster(entries, { valdaKalendrar, forvaldId, typ = "alla", status = "alla" }) {
  return entries.filter((e) => {
    if (valdaKalendrar && !valdaKalendrar.includes(e.kalender ? e.kalender.id : forvaldId)) return false;
    if (typ !== "alla" && e.typ !== typ) return false;
    if (status !== "alla" && e.status !== status) return false;
    return true;
  });
}

/**
 * Märkena i en dagsruta på telefon: streck för flerdagsposter och prickar för endagsposter, i två rader (0.37.0).
 *
 * ══ ⛔ SESSIONSTUDIOS FORMAT RAKT AV (CP 2026-09-30) ══════════════════════════
 *
 * CP, med en skärmbild ur SS-appen på telefonen: "Vi kanske skall ta SessionStudios format rakt av och ha prickar och
 * streck istället med rätt färg för kategori?" Förebilden är SS `apps/mobile/lib/calendarDayMarkerLayout.js` (CP spec
 * 2026-06-28), talen är dess:
 *   - Ett streck tar två prickars plats, och en rad har tre prickplatser.
 *   - Bara endagsposter: upp till 3 prickar överst och 2 under (högst 5), sedan "+N" i nedre raden.
 *   - Ett streck: strecket och högst 1 prick överst; resten under (högst 3), vid överflöd 2 prickar och "+N".
 *   - Två streck: båda överst, inga prickar bredvid; endagsposterna under (högst 3), vid överflöd 2 och "+N".
 *   - Fler än två flerdagsposter räknas in i "+N".
 * Varje ruta reserverar två rader, så att alla rutor har samma höjd och strecken alltid står på samma höjd.
 *
 * ⛔ INGET TAPPAS TYST: det som inte ryms står i `plus` (arbetsreglernas punkt 5). Summan av det ritade och `plus` är
 * alltid antalet poster.
 *
 * ⛔ SS:s "källtäckning" (en grupppost och en personlig post ska båda synas före överflödet) är inte med: färgen här är
 * kategorins, inte källans, och en sortering efter källa hade flyttat posterna ur sin ordning utan att någon valt det.
 *
 * @template T
 * @param {ReadonlyArray<T>} spann Flerdagsposter som täcker dagen.
 * @param {ReadonlyArray<T>} enkla Endagsposter.
 * @returns {{ streck: T[], ovre: T[], nedre: T[], plus: number }}
 */
export function markorlayout(spann, enkla) {
  const streck = spann.slice(0, 2);
  const extraSpann = Math.max(0, spann.length - streck.length);
  if (streck.length === 0) {
    const ovre = enkla.slice(0, 3);
    const rest = enkla.slice(3);
    const nedre = rest.slice(0, 2);
    return { streck: [], ovre, nedre, plus: rest.length - nedre.length };
  }
  const ovre = enkla.slice(0, streck.length === 1 ? 1 : 0);
  const rest = enkla.slice(ovre.length);
  if (rest.length <= 3 && extraSpann === 0) return { streck, ovre, nedre: rest.slice(), plus: 0 };
  const nedre = rest.slice(0, 2);
  return { streck, ovre, nedre, plus: rest.length - nedre.length + extraSpann };
}
