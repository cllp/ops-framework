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
 * @typedef {object} Kalenderpost
 * @property {string} id
 * @property {string} datum `YYYY-MM-DD`.
 * @property {string} titel
 * @property {"oppet"|"pagar"|"vantar"|"klart"|"akut"} [status] Pricken ärver `OpsStatusDot`s toner.
 * @property {string} [url] Finns den blir raden en länk.
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
export function datumnyckel(ar, manad, dag) {
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
 * @param {Date} [idag]
 */
export function idagsnyckel(idag = new Date()) {
  return datumnyckel(idag.getFullYear(), idag.getMonth(), idag.getDate());
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
export function manadsrutnat(ar, manad) {
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
 * @param {Date} idag
 * @param {number} bakat Antal månader före den innevarande.
 * @param {number} framat Antal månader efter den innevarande.
 * @returns {{ ar: number, manad: number }[]}
 */
export function manader(idag, bakat, framat) {
  const ut = [];
  for (let i = -bakat; i <= framat; i += 1) {
    const d = new Date(idag.getFullYear(), idag.getMonth() + i, 1);
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
 * @param {Kalenderpost[]} poster
 * @returns {Map<string, Kalenderpost[]>}
 */
export function perDag(poster) {
  /** @type {Map<string, Kalenderpost[]>} */
  const karta = new Map();
  for (const p of poster || []) {
    if (!p || typeof p.datum !== "string" || !p.datum) continue;
    const fanns = karta.get(p.datum);
    if (fanns) fanns.push(p);
    else karta.set(p.datum, [p]);
  }
  return karta;
}
