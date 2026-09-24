/**
 * Slagets färg, på de tre ytor som måste visa samma svar.
 *
 * ── ⛔ VARFÖR DEN FINNS ──────────────────────────────────────────────────
 *
 * CP 2026-09-24, med bild: "Prickarna i kalendern skall ju också ha färgen av
 * vilken typ det är."
 *
 * Samma post syns på tre ställen i samma app: som ett kort i en lista, som ett
 * kort i kalenderns dagspanel, och som en PRICK i en kalenderruta. Ska de tre
 * säga samma sak måste färgen komma ur en källa. Skrevs klasserna på tre
 * ställen skulle de börja glida isär vid första justeringen, och det som glider
 * märks inte: två ytor i nästan samma gröna ser ut som ett slarv, inte som ett
 * fel.
 *
 * ── ⛔ EGEN PALETT, OCH DET ÄR MÄTT ─────────────────────────────────────
 *
 * Kanten fick identitetstoner först. De fungerar DÄR, eftersom kanten sitter
 * bredvid ett ord som bär betydelsen. En prick har inget ord bredvid sig.
 *
 * Körda som prickar genom paletteringsvalidatorn, ljust läge: identity-1 och
 * identity-4 ligger under kromagolvet, alltså läses grön och blå som GRÅTT, och
 * avståndet mellan dem är delta E 7,4 mot golvet 15. Två prickar ingen kan
 * skilja åt är värre än en prick.
 *
 * `--color-slag-*` är svaret: lika dämpad som identitetstonerna, men över
 * kromagolvet. Se den långa noten i `tokens.css` för siffrorna och för varför
 * platserna är tre och inte sex.
 *
 * ── ⛔ KLASSNAMNEN STÅR UTSKRIVNA ───────────────────────────────────────
 *
 * Tailwind läser källkoden som text. `bg-slag-${n}` genererar ingen CSS, och
 * resultatet är en prick utan färg som fungerar i utvecklingsläge och tappar
 * färgen i bygget. Samma fälla som `lib/kant.js` bär en kommentar om.
 */
/** @type {Record<number, string>} */
const KANT = {
  1: "border-l-slag-1",
  2: "border-l-slag-2",
  3: "border-l-slag-3",
};

/** @type {Record<number, string>} */
const PRICK = {
  1: "bg-slag-1",
  2: "bg-slag-2",
  3: "bg-slag-3",
};

/** @type {Record<number, string>} */
const TEXT = {
  1: "text-slag-1",
  2: "text-slag-2",
  3: "text-slag-3",
};

/** Platserna som finns. För prov, och för den som bygger en egen yta. */
export const SLAGPLATSER = Object.keys(KANT).map(Number);

/**
 * ⛔ ETT SLAG UTAN ORD ÄR EN FÄRG SOM LÅTSAS BETYDA NÅGOT.
 *
 * En färg går inte att läsa upp, den är osynlig för var tjugonde man, och den
 * säger ingenting alls till den som inte redan lärt sig koden. Validatorn
 * lämnar dessutom en varning som står kvar med flit: vid rödgrönblindhet ligger
 * slag-1 mot slag-2 på delta E 6,9, vilket är tillåtet BARA med en andra
 * kodning. Ordet ÄR den kodningen, så ytan kastar hellre än att rita utan det.
 *
 * @param {number | undefined} plats
 * @param {string | undefined} ord
 * @param {string} avsandare Komponentens namn, så felet pekar på rätt yta.
 * @returns {plats is number}
 */
function kontrollera(plats, ord, avsandare) {
  if (plats === undefined) return false;
  if (!KANT[plats]) {
    throw new Error(`${avsandare}: okänt slag "${plats}". Giltiga: ${SLAGPLATSER.join(", ")}.`);
  }
  if (!ord) {
    throw new Error(
      `${avsandare}: slag kräver slagLabel. En färg utan ord går inte att läsa upp och betyder ingenting för den som inte lärt sig koden.`,
    );
  }
  return true;
}

/**
 * Vänsterkanten, eller `null` när inget slag angetts.
 *
 * @param {number} [plats] @param {string} [ord] @param {string} [avsandare]
 */
export function slagKant(plats, ord, avsandare = "Slaget") {
  return kontrollera(plats, ord, avsandare) ? KANT[plats] : null;
}

/**
 * Prickens fyllning, eller `null`.
 *
 * ⛔ PRICKEN KRÄVER OCKSÅ ETT ORD, trots att den är ren dekor i sin ruta.
 * Ordet står inte vid pricken utan i rutans knappnamn ("12, 2 poster"), och det
 * är just därför kravet ligger kvar: tas det bort här blir det fritt fram att
 * rita en prick vars enda upplysning är en färg.
 *
 * @param {number} [plats] @param {string} [ord] @param {string} [avsandare]
 */
export function slagPrick(plats, ord, avsandare = "Slaget") {
  return kontrollera(plats, ord, avsandare) ? PRICK[plats] : null;
}

/**
 * Ikonens färg, eller `null`.
 *
 * @param {number} [plats] @param {string} [ord] @param {string} [avsandare]
 */
export function slagText(plats, ord, avsandare = "Slaget") {
  return kontrollera(plats, ord, avsandare) ? TEXT[plats] : null;
}
