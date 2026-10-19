/**
 * Flytta en post eller en händelse till en annan kalender (0.123.0, cllp/lifehub.app#371).
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN FINNS ═════════════════════════════════════════════
 *
 * CP 2026-10-19, med en skärmbild av GSEMS-händelsen i Barnveckor: "Det går dock inte att ändra en händelse. Vidare borde det gå att
 * flytta en händelse till en annan kalender." Efter 0.120.0 öppnas en post i en egen kalender i `OpsHandelsePanel`, men det fanns
 * ingen väg att byta kalender, varken på en post eller på en händelse.
 *
 * ══ ⛔ FYRA FLYTTAR, TRE ERBJUDS (CP:s beslut 2026-10-19, kommentaren på lifehub.app#371) ═══════════════════════════════
 *
 *   FRÅN                 TILL                   VAD SOM HÄNDER
 *   egen kalender        egen kalender          `kalenderId` byts på posten. Direkt, personens egen sak.
 *   gruppkalender        gruppkalender (samma   `kalenderId` byts på händelsen. Bara den som får redigera den.
 *                        grupp)
 *   egen kalender        gruppkalender          Posten BLIR en gruppens händelse och tas bort ur den egna kalendern, i ett
 *                                               serveranrop. Personen bekräftar först: gruppens medlemmar ser den då.
 *   gruppkalender        egen kalender          ERBJUDS INTE. En gruppens händelse ska inte kunna försvinna ur gruppen genom att en
 *                                               medlem flyttar den, och en händelse har svar och kommentarer en post inte har.
 *   gruppkalender        annan grupps kalender  ERBJUDS INTE, av samma skäl: den lämnar sin grupp.
 *
 * ⛔ EN FUNKTION SOM SVARAR PÅ "VART FÅR JAG FLYTTA DEN" OCH INTE TVÅ. Panelen ritar listan, appen anropar rätt serveranrop efter
 * `atgard`, och servern (`createFlyttaService`) prövar samma sak en gång till med de uppgifter den själv läser. Listan är ett
 * erbjudande och ingen behörighet: det som släpper igenom eller nekar en flytt är servern.
 *
 * @typedef {object} Flyttmal Ett val i "Flytta till kalender".
 * @property {string} id Kalenderns id.
 * @property {string} namn
 * @property {1|2|3|4|5|6} farg
 * @property {string} ikon
 * @property {"byt" | "konvertera"} atgard `byt`: kalendern byts på samma rad (`flyttaPost`, `flyttaHandelse`). `konvertera`: posten blir en
 *   gruppens händelse (`goraPostTillHandelse`), och panelen ber om en bekräftelse först. Den enda uppgiften om vilken flytt det är:
 *   `groupId` säger bara vart den går, och en flytt inom gruppen (`byt`) har också en.
 * @property {string} [groupId] Bara för en gruppkalender: gruppen den hör till. Saknas för en av mina.
 * @property {string} [gruppnamn] Gruppens namn, när `groupId` finns. Bekräftelsen skriver ut det.
 */

import { valjbara } from "./katalog.js";
import { text } from "./sprak.js";

/** @param {unknown} v @returns {boolean} */
const arText = (v) => typeof v === "string" && v.trim() !== "";

/**
 * Vart den här posten eller händelsen får flyttas, som val i panelen. Tom lista: ingenstans, och panelen ritar då ingen knapp.
 *
 * ⛔ DEN HÄR FUNKTIONEN ÄR ERBJUDANDET, INTE BEHÖRIGHETEN. `farRedigera` är appens svar (appen äger regeln om vem som får ändra en
 * händelse), och servern prövar det på nytt innan något skrivs.
 *
 * ⛔ ARKIVERADE KALENDRAR ERBJUDS INTE (`valjbara`), och inte heller kalendern det redan ligger i. En flytt till det som redan gäller är
 * ett val som inte gör något.
 *
 * ⛔ `farRedigera` MÅSTE VARA EXAKT `true`. Ett utelämnat värde är "vet inte", och då erbjuds inget: en knapp som nekas vid tryck är
 * värre än ingen knapp.
 *
 * @param {object} arg
 * @param {{ slag: "post", kalenderId: string } | { slag: "handelse", groupId: string, kalenderId: string }} arg.fran Det som ska flyttas.
 *   `kalenderId` är dess EFFEKTIVA kalender: en händelse utan `kalenderId` ligger i gruppens förvalda (`handelsensKalenderId`).
 * @param {ReadonlyArray<import("./kalendrar.js").MinKalender>} [arg.mina] Mina kalendrar.
 * @param {ReadonlyArray<{ id: string, namn: string | import("./sprak.js").Namn, kalendrar: ReadonlyArray<import("./kalendrar.js").Gruppkalender> }>} [arg.grupper]
 *   Grupperna personen får skriva händelser i, med sina kalendrar. För en post är det grupperna den kan bli en händelse i, så appen skickar
 *   bara dem personen får skapa händelser i. För en händelse behövs bara dess egen grupp.
 * @param {boolean} [arg.farRedigera] Bara för en händelse: personen får redigera just den här händelsen.
 * @param {string} [arg.sprak]
 * @returns {Flyttmal[]}
 */
export function flyttmal({ fran, mina = [], grupper = [], farRedigera = false, sprak = "sv" }) {
  if (!fran || typeof fran !== "object" || (fran.slag !== "post" && fran.slag !== "handelse")) {
    throw new Error('flyttmal: fran.slag är "post" eller "handelse". Ramverket vet inte vad som annars ska flyttas.');
  }
  if (!arText(fran.kalenderId)) {
    throw new Error("flyttmal: fran.kalenderId krävs, den kalender det ligger i nu. Utan den går det inte att utesluta den ur listan.");
  }
  /**
   * @param {import("./kalendrar.js").Gruppkalender} k
   * @param {{ id: string, namn: string | import("./sprak.js").Namn }} g
   * @param {"byt" | "konvertera"} atgard
   * @returns {Flyttmal}
   */
  const gruppmal = (k, g, atgard) => ({ id: k.id, namn: text(k.namn, sprak), farg: k.farg, ikon: k.ikon, atgard, groupId: g.id, gruppnamn: text(g.namn, sprak) });

  if (fran.slag === "post") {
    /** @type {Flyttmal[]} */
    const egna = valjbara(/** @type {any} */ (mina), sprak)
      .filter((k) => k.id !== fran.kalenderId)
      .map((/** @type {any} */ k) => ({ id: k.id, namn: text(k.namn, sprak), farg: k.farg, ikon: k.ikon, atgard: /** @type {const} */ ("byt") }));
    const gruppernas = grupper.flatMap((g) => valjbara(/** @type {any} */ (g.kalendrar), sprak).map((/** @type {any} */ k) => gruppmal(k, g, "konvertera")));
    return [...egna, ...gruppernas];
  }

  // En händelse: bara gruppens egna kalendrar, och bara för den som får redigera den. Aldrig en av mina, aldrig en annan grupps.
  if (!arText(fran.groupId)) throw new Error("flyttmal: fran.groupId krävs för en händelse. Det är gruppen den stannar i.");
  if (farRedigera !== true) return [];
  const g = grupper.find((x) => x.id === fran.groupId);
  if (!g) return [];
  return valjbara(/** @type {any} */ (g.kalendrar), sprak)
    .filter((k) => k.id !== fran.kalenderId)
    .map((/** @type {any} */ k) => gruppmal(k, g, "byt"));
}

/**
 * Postens tid som en händelses tidsfält: `datum`, `slutDatum`, `tid`, `slutTid`, `heldag`. Motsatsen till det `postTillHandelse` ritar.
 *
 * ⛔ DEN ENDA PLATSEN SOM OMVANDLAR EN POSTS START OCH SLUT TILL EN HÄNDELSES FÄLT. Servern sätter dem efter appens egen rad, så att en
 * app som bygger en händelse ur en post inte kan tappa en dag eller ett klockslag på vägen. Samma former som `handelsefel` prövar.
 *
 * ⛔ BARA DET POSTEN HAR. `slutDatum` bara när slutet ligger en senare dag, `slutTid` bara när slutet skiljer sig från starten, `heldag`
 * bara när det är sant, och inget klockslag alls för en heldag. Därför går resultatet igenom `handelsefel` för varje post som
 * `byggKalenderpost` släpper in.
 *
 * @param {Pick<import("./kalendrar.js").Kalenderpost, "start" | "slut" | "heldag">} post
 * @returns {{ datum: string, slutDatum?: string, tid?: string, slutTid?: string, heldag?: true }}
 */
export function postensTidsfalt(post) {
  if (!post || typeof post.start !== "string" || typeof post.slut !== "string") {
    throw new Error("postensTidsfalt: en post med start och slut krävs (byggKalenderpost).");
  }
  const datum = post.start.slice(0, 10);
  const slutDatum = post.slut.slice(0, 10);
  if (post.heldag === true) return { datum, ...(slutDatum > datum ? { slutDatum } : {}), heldag: true };
  const tid = post.start.slice(11);
  const slutTid = post.slut.slice(11);
  return { datum, ...(slutDatum > datum ? { slutDatum } : {}), tid, ...(post.slut !== post.start ? { slutTid } : {}) };
}
