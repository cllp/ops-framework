/**
 * Utskriften av ett ljud, som läget på posten: pågår den, gick den fel, är den klar? (0.133.0, lifehub.app#349, CP 2026-10-20.)
 *
 * ══ ⛔ VARFÖR LÄGET LIGGER PÅ POSTEN OCH INTE I KOMPONENTEN ═════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-20: "Kan man göra så att man kan ta bort transkribering på en ljudupptagning och köra om den?" och att utskriften ska gå i bakgrunden, fortsätta även om man går
 * därifrån, stå tydligt att den gör det och att man ska få veta när den är klar. Mätt före: `skrivUtInspelning` är en synkron callable (300 s) och "Skriver ut…" var bara ett lokalt
 * tillstånd i komponenten. Posten bar inget om att en utskrift pågick, så den som gick därifrån och kom tillbaka såg ingenting.
 *
 * Fältet `utskriftJobb` på posten är därför sanningen: `{ status: "pagar" | "fel", startad, av: { uid, namn }, fel? }`. Servern sätter det när den tar emot jobbet, tar bort det när
 * utskriften är klar (då finns `utskrift`) och sätter `status: "fel"` om det misslyckas. Vyn ritar ur posten (`utskriftLage`), så läget överlever att man går från sidan,
 * byter enhet eller öppnar posten igen.
 *
 * ⛔ EN "pagar" SOM ÄR ÄLDRE ÄN `UTSKRIFT_TAK_MS` TOLKAS SOM ETT FEL. Servern kan dö mitt i ett jobb utan att hinna skriva status "fel", och en rad som för alltid säger "pågår" är en rad som
 * ingen kan komma ur (regel 5: en tyst nedsläppsväg är värre än ett fel). Efter 15 minuter säger läget "fel" med `UTSKRIFT_TIMEOUT_TEXT`, och knappen Försök igen finns.
 *
 * ⛔ FÄLTEN SOM RENSAS ÄR EN LISTA OCH DEN BOR HÄR (`UTSKRIFT_FALT`, regel 2). Appens server ska ta bort exakt dessa när en utskrift tas bort eller körs om, och inte ha en egen lista som
 * glider isär den dag ett statusfält tillkommer.
 *
 * Filen är ren: inget Firebase, ingen React, ingen klocka (tiden skickas in).
 */

/**
 * Fälten på en ljudpost som hör till utskriften: texten och jobbets status. Det en server tar bort (`FieldValue.delete()`) när utskriften tas bort eller ska göras om, och det
 * en klient aldrig får skriva (reglerna ska neka `utskriftJobb`, och `utskrift` skrivs bara av servern).
 */
export const UTSKRIFT_FALT = /** @type {const} */ (["utskrift", "utskriftJobb"]);

/** Så länge ett jobb får stå som pågående innan det räknas som misslyckat: 15 minuter. Callablen har 300 sekunder, så ett jobb som lever längre har dött. */
export const UTSKRIFT_TAK_MS = 15 * 60 * 1000;

/** Texten för ett jobb som stått som pågående för länge, eller vars status vi inte känner igen. */
export const UTSKRIFT_TIMEOUT_TEXT = "Utskriften blev inte klar. Försök igen.";

/** Statusarna ett jobb kan ha i dokumentet. Utskriften som är klar har inget jobb alls. */
export const UTSKRIFTJOBB_STATUS = /** @type {const} */ (["pagar", "fel"]);

/**
 * Så länge vyn väntar på att posten ska visa jobbet efter att servern tagit emot det (millisekunder). Callablen löser när jobbet är mottaget och posten uppdateras strax efter.
 * Händer ingenting inom tiden har appen inte lagt in `utskriftJobb` (en app som inte uppgraderats), och då gäller det gamla beteendet: det lokala "Skriver ut…" tills löftet löste.
 */
export const UTSKRIFT_VANTETID_MS = 5000;

/**
 * Bedömningen av hur länge en utskrift tar, ur ljudets längd.
 *
 * ⛔ DET HÄR ÄR EN BEDÖMNING, INTE EN MÄTNING (regel 3 och 10). Ingen körning har mätts. Konstanterna är en gissning om en modell som skriver ut många gånger snabbare än ljudet
 * spelas: en fast del för att ta emot och hämta filen (`fast`) plus en andel av ljudets längd (`andel`). De ska bytas mot medianen av riktiga körningar (jobbens `startad` och när
 * `utskriftJobb` togs bort) så fort det finns några, och texten som visas säger "uppskattning" så länge det är en gissning.
 */
export const UTSKRIFT_UPPSKATTNING = Object.freeze({ fastMs: 30_000, andel: 0.25 });

/**
 * @typedef {object} Utskriftslage
 * @property {"ingen" | "pagar" | "fel" | "klar"} lage
 * @property {number | null} startad Millisekunder, när jobbet startade (`pagar` och `fel`).
 * @property {{ uid: string, namn: string } | null} av Vem som startade jobbet.
 * @property {string} fel Texten för `fel`, annars en tom sträng.
 */

/** @param {unknown} v */
const arTal = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Läget för en posts utskrift.
 *
 * - **pagar:** `utskriftJobb.status` är `pagar` och jobbet startade för högst `UTSKRIFT_TAK_MS` sedan. Gäller också när posten har en gammal `utskrift` (utskriften körs om).
 * - **fel:** status `fel` (med jobbets text), en `pagar` som är äldre än taket (`UTSKRIFT_TIMEOUT_TEXT`), eller ett jobb vi inte kan tolka (okänd status, `startad` som inte är ett tal):
 *   fel i datan öppnar aldrig ett "pågår" som ingen kan ta sig ur.
 * - **klar:** inget jobb och en `utskrift` som är en sträng. En TOM sträng är en klar utskrift (en tyst inspelning), inte ingen.
 * - **ingen:** inget jobb och ingen `utskrift`.
 *
 * @param {{ utskrift?: unknown, utskriftJobb?: unknown } | null | undefined} post
 * @param {number} nu Millisekunder.
 * @returns {Utskriftslage}
 */
export function utskriftLage(post, nu) {
  const jobb = post?.utskriftJobb;
  if (jobb !== undefined && jobb !== null) {
    const j = /** @type {{ status?: unknown, startad?: unknown, av?: { uid?: unknown, namn?: unknown } | null, fel?: unknown }} */ (typeof jobb === "object" ? jobb : {});
    const startad = arTal(j.startad) ? /** @type {number} */ (j.startad) : null;
    const uid = typeof j.av?.uid === "string" ? j.av.uid : "";
    const av = uid ? { uid, namn: typeof j.av?.namn === "string" ? j.av.namn : "" } : null;
    if (j.status === "pagar" && startad !== null && nu - startad <= UTSKRIFT_TAK_MS) {
      return { lage: "pagar", startad, av, fel: "" };
    }
    if (j.status === "fel" && typeof j.fel === "string" && j.fel.trim() !== "") {
      return { lage: "fel", startad, av, fel: j.fel.trim() };
    }
    return { lage: "fel", startad, av, fel: UTSKRIFT_TIMEOUT_TEXT };
  }
  return { lage: typeof post?.utskrift === "string" ? "klar" : "ingen", startad: null, av: null, fel: "" };
}

/**
 * Hur många hela minuter en utskrift av ett ljud av den här längden brukar ta, enligt bedömningen `UTSKRIFT_UPPSKATTNING`, avrundat uppåt och aldrig under en minut. `null` när längden
 * inte är känd (en gammal post): då finns ingen uppskattning, och vyn säger det i stället för att gissa en siffra.
 *
 * @param {unknown} durationMs Ljudets längd, millisekunder.
 * @returns {number | null}
 */
export function uppskattadUtskriftstid(durationMs) {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  const ms = UTSKRIFT_UPPSKATTNING.fastMs + durationMs * UTSKRIFT_UPPSKATTNING.andel;
  return Math.max(1, Math.ceil(ms / 60_000));
}

/**
 * Hur länge ett jobb pågått, som text: "mindre än en minut" eller "N min".
 *
 * @param {number | null} startad
 * @param {number} nu
 * @returns {string}
 */
export function utskriftPagatText(startad, nu) {
  if (startad === null) return "";
  const min = Math.floor(Math.max(0, nu - startad) / 60_000);
  return min < 1 ? "mindre än en minut" : `${min} min`;
}

/**
 * Postens fält utan utskriften: texten och jobbet borta (`UTSKRIFT_FALT`). Det servern gör med `FieldValue.delete()`, som en ren funktion för prov och för en minneskälla.
 *
 * @template {Record<string, any>} T
 * @param {T} post
 * @returns {Omit<T, "utskrift" | "utskriftJobb">}
 */
export function utanUtskrift(post) {
  const ut = { ...post };
  for (const f of UTSKRIFT_FALT) delete ut[f];
  return ut;
}
