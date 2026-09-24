/**
 * Händelser: hur bråttom något är, och var det hör hemma.
 *
 * ── ⛔ VARFÖR DET HÄR ÄR RAMVERK OCH INTE APP ─────────────────────────────
 *
 * En händelse är något som ska ske en viss dag, med någon ansvarig. Det går att
 * beskriva utan att veta vad plattformen handlar om, och varje ops-plattform
 * har dem. Vad händelsen HANDLAR om (moms, leverans, uppsägning) är appens ord
 * och står aldrig här.
 *
 * ⛔ BRÅDSKAN ÄR HÄRLEDD, ALDRIG LAGRAD. Appen skickar ett datum, det här
 * räknar. Ett lagrat `status: "forsenat"` blir fel klockan tolv på natten utan
 * att något ändras, och den sortens fel syns inte: raden ser lika lugn ut dagen
 * efter som dagen före.
 *
 * ⛔ DET FÄLT SOM NU HETER `status` ÄR NÅGOT ANNAT ÄN DET, och läs det här
 * innan du tror att regeln ovan har mjuknat. Brådska är en funktion av KLOCKAN
 * och får därför aldrig lagras. `status` är var ett ärende står i sitt eget
 * flöde: öppet, pågår, väntar på en motpart, klart, akut. Det ändras bara när
 * någon ändrar det, och det finns ingen klocka som kan göra ett lagrat värde
 * osant över en natt. Därför skickas det in, medan brådskan fortsätter räknas.
 */

/**
 * @typedef {object} OpsEvent
 * @property {string} id
 * @property {string} title
 * @property {number | null} daysLeft Negativt = passerat, 0 = idag eller pågående, positivt = framåt, null = odaterat.
 * @property {boolean} [pagar] Sant när ett intervall är igång just nu.
 * @property {string} [when] Färdig text, t.ex. "I morgon (12)". Appen äger formuleringen.
 * @property {import("react").ReactNode} [role] Appens egen roll-etikett. ⛔ ReactNode och inte string:
 *   ramverket TOLKAR den inte, det ritar den. Skulle den vara en sträng måste ramverket
 *   översätta den till något visuellt, och då måste det veta vad rollerna betyder. Det är
 *   precis det ord som inte får finnas här.
 * @property {import("react").ReactNode} [kind] Vad för sorts händelse det är, i appens ord.
 * @property {import("react").ReactNode} [kindIcon] Slagets ikon, före ordet på raden.
 *   ⛔ Samma ikon som filtrets meny visar för samma slag. Två olika ikoner för
 *   samma sak är hur man slutar lita på båda. Färgas ur `slag`.
 * @property {1|2|3} [slag] Vad raden ÄR, ur slagpaletten. Färgar kortets kant
 *   och ikonen ovan, och är samma ton som kalenderns prick för samma post.
 *   ⛔ Vinner över `edge`, som svarar på VEM raden tillhör.
 * @property {string} [slagLabel] Vad slaget heter. ⛔ Krävs när `slag` finns.
 *   ⛔ SVARAR PÅ EN ANNAN FRÅGA ÄN `role`, och blandas de ihop blir båda obrukbara.
 *   `role` säger VEM som ska göra något (du, en agent, ingen alls). `kind` säger VAD FÖR
 *   SORTS sak det är (ett möte, en betalning, en uppgift). Ett filter på det ena kan inte
 *   svara på det andra.
 *   ReactNode av samma skäl som `role`: ramverket ritar den, tolkar den aldrig.
 * @property {string} [deadline] Absolut sista dag, i appens ord ("Förfaller 2026-09-30").
 *   ⛔ NÄR det finns en sådan. `when` säger hur långt bort något är ("Om 2 veckor"),
 *   vilket är brådskan; `deadline` säger vilken dag, vilket är det man skriver in i
 *   en kalender. De är olika fakta och båda behövs, men skriv inte datumet i båda:
 *   står det på två ställen på samma rad börjar man leta efter skillnaden.
 * @property {import("react").ReactNode} [details] Fälls ut under raden. Utan den får
 *   raden ingen chevron: en pil som inte öppnar något är ett löfte som inte infrias.
 * @property {string} [url]
 * @property {string} [urlLabel] Synlig länktext, t.ex. "#183". Utan den står "Öppna".
 * @property {1|2|3|4|5|6} [edge] Färgad vänsterkant ur identitetspaletten, som säger vilken
 *   GRUPP raden tillhör. ⛔ APPENS SIFFRA OCH INTE RAMVERKETS BETYDELSE: vilket slag som
 *   är grönt beror på vilka slagen ÄR, och det vet bara appen. Ramverket ritar kanten,
 *   det tolkar den aldrig.
 * @property {string} [edgeLabel] Vad kanten betyder, i ord. ⛔ KRÄVS när `edge` finns:
 *   en färg utan ord säger ingenting till den som inte lärt sig koden, går inte att läsa
 *   upp, och är osynlig för var tjugonde man. `OpsCard` kastar hellre än att rita den.
 * @property {string} [updatedAt] Senast ändrad (t.ex. "2026-09-18"), höger i kompakta raden.
 * @property {import("react").ReactNode} [atgard] Appens egen kontroll för raden, till exempel
 *   en knapp som bockar av den. ⛔ RAMVERKET RITAR DEN, TOLKAR DEN ALDRIG: vad en åtgärd
 *   gör är appens sak, var den hamnar och att den hamnar likadant på varje rad är vår.
 *   ⛔ Har någon rad en `atgard` KRÄVER `OpsEventList` att listan förklarar de rader som
 *   saknar en, i sin `actionHint`. Skälet står i komponenten.
 * @property {"oppet" | "pagar" | "vantar" | "klart" | "akut"} [status] Var raden står, som en
 *   prick i kortets rubrik. ⛔ EN SLUTEN MÄNGD OCH INTE EN ReactNode, till skillnad från `role`
 *   och `kind`. Skillnaden är avsiktlig: rollens ORD är appens, men vilka FÄRGER ett tillstånd
 *   får är ramverkets, precis som brådskan. Skickade appen in sin egen prick skulle nästa app
 *   välja sin egen gula, och samma läge visas på två sätt i två plattformar.
 *   Orden kommer ur `OpsEventList`s `statusWords`, eftersom bara appen vet vad `waiting` betyder
 *   hos just den.
 */

/**
 * Hur bråttom en händelse är.
 *
 * ⛔ TRE LÄGEN, INTE TVÅ, och det tredje är dyrköpt. Ett intervall man står mitt
 * i (dag 15-20, och det är den 16:e) är varken passerat eller framtid. Räknar
 * man bara mot första dagen blir svaret "passerat", och raden säger att något
 * skulle gjorts igår när det i själva verket är dags nu. Det felet levde i
 * bolag-ops tills CP såg det.
 *
 * @param {OpsEvent} event
 * @returns {"forsenat" | "pagar" | "framat" | "odaterat"}
 */
export function urgency(event) {
  if (!event || event.daysLeft === null || event.daysLeft === undefined) return "odaterat";
  if (event.pagar) return "pagar";
  if (event.daysLeft < 0) return "forsenat";
  if (event.daysLeft === 0) return "pagar";
  return "framat";
}

/**
 * Delar händelser i Idag och Kommande.
 *
 * ⛔ FÖRSENAT LIGGER I IDAG, inte i en egen tredje hink. Något som skulle gjorts
 * i förrgår kräver dig just nu, och en egen flik hade gömt det bakom ett klick.
 * Det är dessutom den enda hinken som kostar något att missa, så den ska inte
 * vara den som är svårast att hitta.
 *
 * ⛔ ODATERAT LIGGER I KOMMANDE. Det är inte planerat till en dag, men det
 * kräver dig inte heller idag, och lägger man det i Idag blir den siffran
 * meningslös: den slutar svara på "hur mycket måste jag göra nu".
 *
 * @param {OpsEvent[]} events
 * @returns {{ today: OpsEvent[], upcoming: OpsEvent[], forsenat: number }}
 */
export function splitTodayUpcoming(events) {
  const today = [];
  const upcoming = [];
  let forsenat = 0;

  for (const h of events || []) {
    const b = urgency(h);
    if (b === "forsenat") forsenat += 1;
    if (b === "forsenat" || b === "pagar") today.push(h);
    else upcoming.push(h);
  }

  return { today, upcoming, forsenat };
}

/**
 * Hela dagar mellan två datum, tid på dygnet borträknad.
 *
 * ⛔ KALENDERDAGAR OCH INTE DYGN, och skillnaden är hela poängen. Klockan 23.59
 * i kväll och 00.01 i morgon är två minuter isär och ETT dygnsskifte, alltså en
 * dag. En rak millisekundsdifferens svarar noll på det, och raden säger "Idag"
 * om något som förfaller i morgon bitti.
 *
 * ⛔ NORMALISERAS VIA `Date.UTC` PÅ LOKALA DATUMDELAR. Sommartidsskiftet gör ett
 * dygn 23 eller 25 timmar långt, och räknar man i millisekunder driver siffran
 * en gång per halvår. Här plockas år, månad och dag ut lokalt och jämförs i UTC,
 * så skiftet inte finns att drabbas av.
 *
 * @param {Date} a @param {Date} b
 * @returns {number} Positivt när `b` ligger efter `a`.
 */
export function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / ms);
}

/**
 * Dagar kvar till ett ISO-datum (`YYYY-MM-DD`).
 *
 * ⛔ `null` VID OLÄSLIGT DATUM, ALDRIG NOLL. Noll betyder "idag" i hela kedjan,
 * och ett trasigt datumfält som svarar noll lägger posten överst under Idag med
 * full brådska. Ett fel som ser ut som en deadline är dyrare än en rad som
 * uteblir, för den som ser den agerar på den.
 *
 * ⛔ `T00:00:00` UTAN `Z`, alltså lokal midnatt och inte UTC-midnatt. Läser man
 * ISO-datumet rakt tolkar JS det som UTC, och i svensk sommartid blir det 02.00
 * lokalt kvällen innan. Datumet hade då legat en dag fel under halva året, i den
 * riktning som får en deadline att se ut att ha passerat.
 *
 * @param {string} iso @param {Date} today
 * @returns {number | null}
 */
export function daysUntil(iso, today) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return daysBetween(today, d);
}

/**
 * Slår ihop flera källor till en lista, sorterad som en människa läser den.
 *
 * ── ⛔ VARFÖR SAMMANSLAGNINGEN ÄR RAMVERK OCH MAPPNINGARNA INTE ───────────
 *
 * Appen vet vad en kundfaktura är. Ramverket vet inte, och ska inte veta. Men
 * ORDNINGEN är densamma för varje ops-plattform: närmast först, odaterat sist,
 * och inom samma dag det som kräver en människa före det som sköter sig självt.
 *
 * Därför tar den här emot FÄRDIGA `OpsEvent`-listor, en per källa. Appen har
 * redan gjort sina mappningar och äger varje ord i dem.
 *
 * ⛔ LISTOR OCH INTE FUNKTIONER. Skickade appen in mappers hade ramverket
 * behövt bestämma vad de får som argument, alltså haft en åsikt om appens
 * datakällor. Det är precis den gränsen som ska ligga hos appen.
 *
 * ── ⛔ ODATERAT SIST, OCH DET ÄR ETT PÅSTÅENDE ────────────────────────────
 *
 * `daysLeft: null` betyder "har ingen dag", inte "har dagen noll". Sorterar man
 * naivt blir `null` mindre än varje tal och allt odaterat hamnar ÖVERST, alltså
 * precis framför det som faktiskt brinner. Det felet är tyst: listan ser sorterad
 * ut.
 *
 * @param {object} [arg]
 * @param {OpsEvent[][]} [arg.sources] En lista per källa. Tomma listor är i sin ordning.
 * @param {(event: OpsEvent) => number} [arg.order] Tie-break inom samma dag, lägre först.
 *   ⛔ EN FUNKTION FRÅN APPEN OCH INGEN INBYGGD RANGORDNING. `OpsEvent.role` är
 *   uttryckligen något ramverket ritar men aldrig tolkar (se typedefen ovan), och en
 *   inbyggd vikt på "human" före "auto" hade gjort just den tolkningen i smyg. Appen
 *   vet vilka roller den har och vilken av dem som inte går att skala.
 *   Utan den behålls källornas inbördes ordning inom samma dag.
 * @returns {OpsEvent[]}
 */
export function collectEvents({ sources = [], order } = {}) {
  /** @type {{ h: OpsEvent, place: number, weight: number }[]} */
  const all = [];
  for (const list of sources) {
    for (const h of list || []) {
      // ⛔ `place` gör sorteringen STABIL utan att lita på motorns sort.
      // Array.prototype.sort är stabil i dagens V8, men det är en egenskap hos
      // körningen och inte hos den här funktionen. Ett index kostar ingenting
      // och gör ordningen till något som går att prova.
      all.push({ h, place: all.length, weight: order ? order(h) : 0 });
    }
  }

  all.sort((a, b) => {
    const ad = a.h.daysLeft;
    const bd = b.h.daysLeft;
    const aUndated = ad === null || ad === undefined;
    const bUndated = bd === null || bd === undefined;
    if (aUndated !== bUndated) return aUndated ? 1 : -1;
    if (!aUndated && !bUndated && ad !== bd) return /** @type {number} */ (ad) - /** @type {number} */ (bd);
    if (a.weight !== b.weight) return a.weight - b.weight;
    return a.place - b.place;
  });

  return all.map((x) => x.h);
}
