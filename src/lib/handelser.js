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
 * @property {string} [url]
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
