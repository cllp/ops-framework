/**
 * Tilläggen: var en app får plugga in på en ramverksyta, och var den syns (0.60.0, #251).
 *
 * ══ ⛔ EN APP ÄNDRAR ALDRIG EN RAMVERKSYTA (BESLUT 0003) ══════════════════
 *
 * CP 2026-10-05: "Om jag skulle vilja i en grupp addera specifik funktionalitet för händelser [...] Jag vill kanske ha en ny yta som
 * hör till en app eller kunna förändra en yta. Var drar vi gränsen?" Svaret: en app pluggar bara in där ytan har lämnat en plats, och
 * saknas platsen öppnar ramverket den, en gång, för alla appar. Fick appar skriva om ytor hade varje app haft sin egen version av
 * "händelse", och ramverket hade inte längre kunnat ändra den utan att något gick sönder hos någon.
 *
 * ⛔ PLATSERNA ÄR RAMVERKETS OCH NAMNGES HÄR. En modul som anger en plats som inte står i listan avvisas vid uppstart
 * (`defineModule`), med modulens namn och fältet i felet. En plats som tolereras utan att någon yta ritar den är ett tillägg som
 * försvinner tyst (regel 5).
 */

import { text } from "./sprak.js";
import { medKarna } from "./karna.js";

/**
 * Platserna på händelseytan.
 *
 * - `handelse.sektion`: en sektion i `OpsHandelsePanel`, efter informationsrutan. Etiketten är sektionens rubrik.
 * - `handelse.atgard`: en rad i plusmenyns händelsedel, direkt efter "Ny händelse".
 * - `handelse.skapa` (0.127.0, cllp/lifehub.app#383): en ruta i formuläret för en NY händelse, direkt efter "Kräv svar". Se nedan.
 *
 * `handelse.sektion` och `handelse.atgard`: komponenten får `{ handelse, grupp }` och inget annat. I plusmenyn finns ingen händelse, och där
 * är `handelse` `null`.
 *
 * ══ ⛔ `handelse.skapa`: EN APP ÄNDRAR INTE FORMULÄRET, DEN FÅR EN RUTA I DET (0.127.0) ══════════════════════════════
 *
 * CP 2026-10-19, efter att ha skapat "Rösta för rep" i Music: formuläret Ny händelse kräver ett datum, och omröstningen finns först i händelsens
 * panel när händelsen redan har ett. "ja det är bättre att röstningen går till så", alltså att omröstningen väljs redan i formuläret. Ramverket
 * känner inte appen Datumomröstning och ska inte göra det (beslut 0003): det som är ramverkets är PLATSEN, och tillägget fyller den.
 *
 * Komponenten får `{ grupp, varde, onVarde }`. `varde` är tilläggets eget värde, som skalet håller per tillägg på samma sätt som "Kräv svar"
 * (`undefined` tills komponenten anropat `onVarde`, och nollställt varje gång formuläret öppnas). Ramverket tolkar det aldrig.
 * Tillägget bär dessutom fältet `skapa`, som är hur formuläret frågar tillägget utan att veta vad det är:
 *
 *   - `datumEjSatt(varde) => boolean`: "tillägget vill att datum inte sätts nu". Sant döljer appens datumfält och formuläret skriver
 *     händelsen utan `datum` (läget "Datum ej satt", `lib/handelsemodell.js`).
 *   - `fel(varde) => string[]`: skäl att inte spara än, som meningar att visa (som `handelsefel`). Tom lista: inget fel.
 *   - `efterSkapa({ handelseId, varde, grupp }) => Promise<void>`: anropas EN gång efter att händelsen är skriven. Faller den ligger händelsen kvar och
 *     formuläret skriver ut felet (ingen bakåtrullning: en skrivning efter en skrivning kan inte vara atomär i reglerna).
 *
 * Alla tre är valfria men minst en krävs. Ritas bara vid SKAPANDE (inte när en händelse ändras) och bara i en gruppkalender. En avslagen moduls
 * tillägg ritas inte och dess funktioner anropas inte.
 */
export const HANDELSE_PLATSER = /** @type {const} */ (["handelse.sektion", "handelse.atgard", "handelse.skapa"]);

/**
 * Platsen på inspelningen.
 *
 * - `inspelning.mal`: ett mål i den delade inspelaren, bredvid appens egna mål (händelse, meddelande).
 *   Etiketten är valet personen ser. `spara` tar emot ljudet. Ramverket ritar valet och känner inte
 *   modulens namn: Biblioteket är ett mål för att modulen registrerat det, inte för att skalet vet vad det är.
 */
export const INSPELNING_PLATSER = /** @type {const} */ (["inspelning.mal"]);

/**
 * Platsen på appens inställningar (0.140.0, cllp/lifehub.app, "Bokning går att installera").
 *
 * - `installningar.sektion`: en sektion i appens inställningar, ritad som en rad i listan och en egen panel (`OpsInstallningar`).
 *   Etiketten är sektionens rubrik. Komponenten får `{ grupp }` och inget annat, utom det appen själv lägger till i
 *   `installningsSektioner` (`extra`, till exempel `kanAndra`).
 *
 * ══ ⛔ HÄNDELSEN: EN APP SOM BARA HAR EN SEKTION I INSTÄLLNINGARNA KUNDE ALDRIG INSTALLERAS ══════════════════════════
 *
 * CP 2026-10-23, med en skärmbild av gruppens Appar: "Jag har slått på bokning överallt, men kan inte se den under appar att kunna
 * installera." Under "Appar som kan läggas till" stod Ekonomi och Datumomröstning, inte Bokning. Mätt: erbjudandet läser
 * `(m.hubb || arBaraTillagg(m))`, och Bokningens manifest hade `hubb: null` och inga tillägg. Dess enda yta var en sektion i
 * Inställningar som appen ritade själv, så ramverket visste inte att modulen hade en yta och kunde aldrig erbjuda den.
 *
 * Platsen löser det utan att ramverket ritar appens inställningar: `OpsInstallningar` är redan ramverkets, och sektionerna i den är
 * appens. Det som saknades var att modulen kunde SÄGA att den bidrar med en sektion. Nu gör den det i manifestet, och
 * `installningsSektioner` ger appens inställningsvy raderna. ⛔ Appen ritar platsen: ramverket äger vyn bara som skal
 * (`OpsInstallningar`), och en plats som ingen yta ritar är ett tillägg som försvinner tyst (regel 5). Därför finns hjälparen, och
 * därför står i README och CHANGELOG vad appen måste göra.
 */
export const INSTALLNINGAR_PLATSER = /** @type {const} */ (["installningar.sektion"]);

/** @typedef {typeof HANDELSE_PLATSER[number] | typeof INSPELNING_PLATSER[number] | typeof INSTALLNINGAR_PLATSER[number]} Plats */

/**
 * Alla platser, för valideringen. ⛔ Härledd ur ytornas listor och aldrig skriven för sig: en andra lista hade kunnat sakna en plats
 * som en yta ritar.
 * @type {ReadonlyArray<string>}
 */
export const PLATSER = Object.freeze([...HANDELSE_PLATSER, ...INSPELNING_PLATSER, ...INSTALLNINGAR_PLATSER]);

/**
 * Ytornas namn som användaren ser dem, nyckel är platsens första led (`handelse` i `handelse.sektion`).
 *
 * ⛔ "Syns på" i gruppens inställningar läser härifrån. Ett namn per yta och inte per plats: användaren vet var händelserna är, inte
 * vad en sektion är.
 * @type {Readonly<Record<string, import("./sprak.js").Namn>>}
 */
export const PLATSYTOR = Object.freeze({
  handelse: Object.freeze({ sv: "Händelser", en: "Events" }),
  inspelning: Object.freeze({ sv: "Inspelning", en: "Recording" }),
  installningar: Object.freeze({ sv: "Inställningar", en: "Settings" }),
});

/** @param {string} plats @returns {string} */
const ytaFor = (plats) => plats.split(".")[0];

/**
 * Målen i den delade inspelaren: appens egna först, sedan påslagna modulers `inspelning.mal`.
 *
 * ⛔ RAMVERKET NAMNGER INGET MÅL. Appen skickar etiketten på sina (händelse, meddelande). Modulen skickar
 * etiketten på sina. En avstängd modul bidrar inte, och dess `spara` anropas inte.
 *
 * @param {object} arg
 * @param {ReadonlyArray<{ id: string, etikett: string }> | null | undefined} arg.appMal
 * @param {ReadonlyArray<import("./modul.js").Modul> | null | undefined} arg.moduler
 * @param {{ moduler?: ReadonlyArray<string> } | null | undefined} arg.grupp
 * @param {string} [arg.sprak]
 * @returns {Array<{ id: string, etikett: string, spara: ((inmatning: { blob: Blob, mimeType: string, sekunder: number, rapportera: (andel: number) => void, grupp: unknown }) => void | Promise<void>) | null, maxSekunder?: number }>}
 */
export function malForInspelning({ appMal, moduler, grupp, sprak = "sv" }) {
  if (appMal != null && !Array.isArray(appMal)) {
    throw new Error("malForInspelning: appens mål ska vara en lista { id, etikett }, eller utelämnas. Ett ensamt objekt hade sett ut som ett mål och tappat resten.");
  }
  /** @type {Array<{ id: string, etikett: string, spara: any }>} */
  const ut = [];
  (appMal ?? []).forEach((m, i) => {
    const id = m && typeof m === "object" ? String(m.id ?? "").trim() : "";
    const etikett = m && typeof m === "object" && typeof m.etikett === "string" ? m.etikett.trim() : "";
    if (!id || !etikett) {
      throw new Error(`malForInspelning: mål ${i} ska vara { id, etikett }. Ett mål utan ord går inte att välja.`);
    }
    if (ut.some((x) => x.id === id)) throw new Error(`malForInspelning: id "${id}" står två gånger bland appens mål.`);
    ut.push({ id, etikett, spara: null });
  });
  if (moduler) {
    for (const t of tillaggFor({ moduler, grupp, plats: "inspelning.mal" })) {
      const id = `${t.modulId}:${t.id}`;
      if (ut.some((x) => x.id === id)) throw new Error(`malForInspelning: id "${id}" finns redan bland appens mål. Modulens id stämplas som modulId:id, och appens mål får inte ta samma nyckel.`);
      // `maxSekunder` följer med bara när modulen angav ett (0.93.0). Utan det gäller TALK:s tak.
      const max = /** @type {any} */ (t).maxSekunder;
      ut.push({ id, etikett: text(t.etikett, sprak), spara: /** @type {any} */ (t).spara, ...(max !== undefined ? { maxSekunder: max } : {}) });
    }
  }
  return ut;
}

/**
 * Tilläggen på en plats från modulerna som är påslagna i gruppen, i modulernas registreringsordning.
 *
 * ⛔ EN AVSLAGEN MODUL BIDRAR INTE, OCH DESS KOMPONENT ANROPAS INTE. Samma regel som `skaparFor`: gruppens `moduler` är listan.
 * Utan grupp är ingenting påslaget.
 *
 * @param {object} arg
 * @param {ReadonlyArray<import("./modul.js").Modul> | null | undefined} arg.moduler Appens moduler, ur `validateModuler`.
 * @param {{ moduler?: ReadonlyArray<string> } | null | undefined} arg.grupp
 * @param {Plats} arg.plats
 * @returns {Array<import("./modul.js").Tillagg & { modulId: string }>}
 */
export function tillaggFor({ moduler, grupp, plats }) {
  if (!PLATSER.includes(plats)) {
    throw new Error(`tillaggFor: platsen "${plats}" finns inte. Platserna är ramverkets: ${PLATSER.join(", ")}.`);
  }
  // ⛔ En kärnmodul är alltid påslagen (0.106.0, #386, `karna.js`).
  const pa = new Set(medKarna(grupp?.moduler, moduler));
  /** @type {Array<any>} */
  const ut = [];
  for (const modul of moduler ?? []) {
    if (!pa.has(modul.id)) continue;
    for (const t of modul.tillagg ?? []) {
      // ⛔ `modulId` stämplas av ramverket, som i `skaparFor`: vem som äger raden ska inte vara modulens eget påstående.
      if (t.plats === plats) ut.push({ ...t, modulId: modul.id });
    }
  }
  return ut;
}

/**
 * Var en app syns, härlett ur manifestet.
 *
 * ⛔ HÄRLETT, ALDRIG ETT HANDSKRIVET FÄLT (regel 2). Ett eget "syns på"-fält i manifestet hade kunnat säga "Händelser" om en modul
 * som slutat ha ett tillägg där.
 *
 * ⛔ EGEN YTA ÄR `nav` ELLER `hubb`. En modul med ett kort i hubben och tom `nav` har en egen sida att gå till.
 *
 * @param {Pick<import("./modul.js").Modul, "nav" | "hubb" | "tillagg">} modul
 * @returns {{ egenYta: boolean, ytor: string[] }} `ytor` är nycklar i `PLATSYTOR`, var och en en gång, i platsernas ordning.
 */
export function synsPa(modul) {
  const egenYta = (modul.nav?.length ?? 0) > 0 || Boolean(modul.hubb);
  /** @type {string[]} */
  const ytor = [];
  for (const plats of PLATSER) {
    const yta = ytaFor(plats);
    if (!ytor.includes(yta) && (modul.tillagg ?? []).some((t) => t.plats === plats)) ytor.push(yta);
  }
  return { egenYta, ytor };
}

/**
 * Raden "Syns på: ..." i ord.
 * @param {ReturnType<typeof synsPa>} syns
 * @param {{ egenYta: string, ingenting: string }} ord
 * @param {string} [sprak]
 * @returns {string} Listan utan prefix, eller `ord.ingenting` när appen inte syns någonstans (regel 5: tomhet skrivs ut).
 */
export function synsPaText(syns, ord, sprak = "sv") {
  const delar = [...(syns.egenYta ? [ord.egenYta] : []), ...syns.ytor.map((y) => text(PLATSYTOR[y], sprak))];
  return delar.length > 0 ? delar.join(", ") : ord.ingenting;
}
