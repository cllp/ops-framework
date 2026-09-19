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
 */

/**
 * @typedef {object} Handelse
 * @property {string} id
 * @property {string} titel
 * @property {number | null} dagarKvar Negativt = passerat, 0 = idag eller pågående, positivt = framåt, null = odaterat.
 * @property {boolean} [pagar] Sant när ett intervall är igång just nu.
 * @property {string} [nar] Färdig text, t.ex. "I morgon (12)". Appen äger formuleringen.
 * @property {import("react").ReactNode} [roll] Appens egen roll-etikett. ⛔ ReactNode och inte string:
 *   ramverket TOLKAR den inte, det ritar den. Skulle den vara en sträng måste ramverket
 *   översätta den till något visuellt, och då måste det veta vad rollerna betyder. Det är
 *   precis det ord som inte får finnas här.
 * @property {import("react").ReactNode} [slag] Vad för sorts händelse det är, i appens ord.
 *   ⛔ SVARAR PÅ EN ANNAN FRÅGA ÄN `roll`, och blandas de ihop blir båda obrukbara.
 *   `roll` säger VEM som ska göra något (du, en agent, ingen alls). `slag` säger VAD FÖR
 *   SORTS sak det är (ett möte, en betalning, en uppgift). Ett filter på det ena kan inte
 *   svara på det andra.
 *   ReactNode av samma skäl som `roll`: ramverket ritar den, tolkar den aldrig.
 * @property {string} [deadline] Absolut sista dag, i appens ord ("Förfaller 2026-09-30").
 *   ⛔ NÄR det finns en sådan. `nar` säger hur långt bort något är ("Om 2 veckor"),
 *   vilket är brådskan; `deadline` säger vilken dag, vilket är det man skriver in i
 *   en kalender. De är olika fakta och båda behövs, men skriv inte datumet i båda:
 *   står det på två ställen på samma rad börjar man leta efter skillnaden.
 * @property {import("react").ReactNode} [detaljer] Fälls ut under raden. Utan den får
 *   raden ingen chevron: en pil som inte öppnar något är ett löfte som inte infrias.
 * @property {string} [url]
 * @property {import("react").ReactNode} [atgard] Appens egen kontroll för raden, till exempel
 *   en knapp som bockar av den. ⛔ RAMVERKET RITAR DEN, TOLKAR DEN ALDRIG: vad en åtgärd
 *   gör är appens sak, var den hamnar och att den hamnar likadant på varje rad är vår.
 *   ⛔ Har någon rad en `atgard` KRÄVER `OpsEventList` att listan förklarar de rader som
 *   saknar en, i sin `atgardsforklaring`. Skälet står i komponenten.
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
 * @param {Handelse} handelse
 * @returns {"forsenat" | "pagar" | "framat" | "odaterat"}
 */
export function bradska(handelse) {
  if (!handelse || handelse.dagarKvar === null || handelse.dagarKvar === undefined) return "odaterat";
  if (handelse.pagar) return "pagar";
  if (handelse.dagarKvar < 0) return "forsenat";
  if (handelse.dagarKvar === 0) return "pagar";
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
 * @param {Handelse[]} handelser
 * @returns {{ idag: Handelse[], kommande: Handelse[], forsenat: number }}
 */
export function delaIdagKommande(handelser) {
  const idag = [];
  const kommande = [];
  let forsenat = 0;

  for (const h of handelser || []) {
    const b = bradska(h);
    if (b === "forsenat") forsenat += 1;
    if (b === "forsenat" || b === "pagar") idag.push(h);
    else kommande.push(h);
  }

  return { idag, kommande, forsenat };
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
export function dagarMellan(a, b) {
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
 * @param {string} iso @param {Date} idag
 * @returns {number | null}
 */
export function dagarTill(iso, idag) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return dagarMellan(idag, d);
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
 * Därför tar den här emot FÄRDIGA `Handelse`-listor, en per källa. Appen har
 * redan gjort sina mappningar och äger varje ord i dem.
 *
 * ⛔ LISTOR OCH INTE FUNKTIONER. Skickade appen in mappers hade ramverket
 * behövt bestämma vad de får som argument, alltså haft en åsikt om appens
 * datakällor. Det är precis den gränsen som ska ligga hos appen.
 *
 * ── ⛔ ODATERAT SIST, OCH DET ÄR ETT PÅSTÅENDE ────────────────────────────
 *
 * `dagarKvar: null` betyder "har ingen dag", inte "har dagen noll". Sorterar man
 * naivt blir `null` mindre än varje tal och allt odaterat hamnar ÖVERST, alltså
 * precis framför det som faktiskt brinner. Det felet är tyst: listan ser sorterad
 * ut.
 *
 * @param {object} [arg]
 * @param {Handelse[][]} [arg.kallor] En lista per källa. Tomma listor är i sin ordning.
 * @param {(handelse: Handelse) => number} [arg.ordning] Tie-break inom samma dag, lägre först.
 *   ⛔ EN FUNKTION FRÅN APPEN OCH INGEN INBYGGD RANGORDNING. `Handelse.roll` är
 *   uttryckligen något ramverket ritar men aldrig tolkar (se typedefen ovan), och en
 *   inbyggd vikt på "human" före "auto" hade gjort just den tolkningen i smyg. Appen
 *   vet vilka roller den har och vilken av dem som inte går att skala.
 *   Utan den behålls källornas inbördes ordning inom samma dag.
 * @returns {Handelse[]}
 */
export function samlaHandelser({ kallor = [], ordning } = {}) {
  /** @type {{ h: Handelse, plats: number, vikt: number }[]} */
  const alla = [];
  for (const lista of kallor) {
    for (const h of lista || []) {
      // ⛔ `plats` gör sorteringen STABIL utan att lita på motorns sort.
      // Array.prototype.sort är stabil i dagens V8, men det är en egenskap hos
      // körningen och inte hos den här funktionen. Ett index kostar ingenting
      // och gör ordningen till något som går att prova.
      alla.push({ h, plats: alla.length, vikt: ordning ? ordning(h) : 0 });
    }
  }

  alla.sort((a, b) => {
    const ad = a.h.dagarKvar;
    const bd = b.h.dagarKvar;
    const aOdaterad = ad === null || ad === undefined;
    const bOdaterad = bd === null || bd === undefined;
    if (aOdaterad !== bOdaterad) return aOdaterad ? 1 : -1;
    if (!aOdaterad && !bOdaterad && ad !== bd) return /** @type {number} */ (ad) - /** @type {number} */ (bd);
    if (a.vikt !== b.vikt) return a.vikt - b.vikt;
    return a.plats - b.plats;
  });

  return alla.map((x) => x.h);
}
