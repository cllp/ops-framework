/**
 * Modulens provsats: det en agent kör för att bevisa att en ny modul passar i ramverket (0.56.0, cllp/ops-framework#244).
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN FINNS ═════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-04: "vi måste kunna låta en agent bygga en LifeHub-app, e.g. ekonomi. [...] Liksom att det faller in i
 * ramverket." Beslut E i #244: appens kod ligger hos plattformen och granskas av någon annan än den som skrev. Granskaren
 * ska inte behöva läsa modulen rad för rad för att veta att den håller kontraktet. Det svaret ska en körning ge.
 *
 * ══ ⛔ PROVSATSEN ANROPAR SAMMA VÄGAR SOM APPEN, DEN KOPIERAR DEM INTE ═══════════════════════════════════════════════
 *
 * Manifestet prövas med `validateModuler`, källorna med `skapaKallregister`, typerna med `typerForGrupp`. En provsats som
 * bar egna regler om vad en rad får innehålla hade kunnat bli grön för en modul som appen sedan avvisar, och då är den
 * sämre än ingen (arbetsreglernas punkt 2 och 4).
 *
 * ══ ⛔ VARJE STEG SKRIVS UT, OCKSÅ DET TOMMA ═════════════════════════════════════════════════════════════════════════
 *
 * En källa som svarar med noll rader är ett godkänt svar, och rapporten säger "0 rader" i stället för att utelämna raden
 * (punkt 5). En yta modulen inte fyller står med som "fyller inte". Annars går "provad och tom" inte att skilja från
 * "aldrig provad".
 *
 * ⛔ EN KÄLLA FRÅGAS FÖR TVÅ GRUPPER. Den första ska ge modulens rader. Den andra är en grupp modulen aldrig sett, och en
 * källa som svarar med rader där har inte filtrerat på gruppen den fick. Det är det fel som läcker en grupps data till en
 * annan, och registret fångar det bara när raden bär `groupId`.
 */

import { KALLTYPER, validateModuler } from "./modul.js";
import { skapaKallregister } from "./kallor.js";
import { TYPYTOR, typerForGrupp } from "./modultyper.js";

/** Gruppen ingen modul kan ha data för. Används för att se att en källa filtrerar på gruppen den fick. */
export const PROV_FRAMMANDE_GRUPP = "prov-frammande-grupp";

/**
 * Ytorna vars rader ÄR gruppens data, och där en annan grupp därför ska ge noll rader.
 *
 * ⛔ INTE ALLA SEX. En widget är ett kort som finns i varje grupp (bara dess antal beror på gruppen), hjälpen svarar på en
 * route och katalogen är modulens kod, samma för varje grupp. Första versionen krävde noll rader överallt och underkände
 * exempelmodulen på två korrekta källor: ett prov som fäller rätt kod lär den som kör det att strunta i provet.
 */
export const GRUPPDATAYTOR = /** @type {const} */ (["handelser", "sok", "notiser"]);

/** Frågan en källa får utöver gruppen, per yta. Det minsta som gör frågan meningsfull. */
const FRAGOR = { handelser: {}, sok: { text: "" }, hjalp: { route: "/" }, notiser: {}, widgets: {}, kataloger: {} };

/**
 * @typedef {object} Provsteg
 * @property {string} namn Vad som provades.
 * @property {boolean} ok
 * @property {string} text Vad som hände, utskrivet också när det gick bra.
 */

/**
 * Provar en modul mot ramverkets kontrakt.
 *
 * @param {Record<string, any>} manifest Manifestet, eller modulen ur `defineModule`.
 * @param {{ groupId: string, fragor?: Partial<Record<string, Record<string, unknown>>> }} val `groupId` är en grupp modulens
 *   egna data har rader för. `fragor` lägger till fält i frågan per yta, till exempel `{ sok: { text: "f-skatt" } }`.
 * @returns {Promise<{ ok: boolean, modul: string, steg: Provsteg[] }>}
 */
export async function provaModul(manifest, val) {
  const groupId = val && typeof val.groupId === "string" ? val.groupId.trim() : "";
  if (!groupId) {
    throw new Error("provaModul: groupId krävs. Utan en grupp med data går det inte att se att källorna svarar, bara att de inte kastar.");
  }
  /** @type {Provsteg[]} */
  const steg = [];
  const id = manifest && typeof manifest.id === "string" ? manifest.id : "(okänd)";

  let modul;
  try {
    [modul] = validateModuler([manifest]);
    steg.push({ namn: "manifestet", ok: true, text: `godkänt av validateModuler: ${modul.nav.length} nav, ${modul.routes.length} routes, ${modul.samlingar.length} samlingar` });
  } catch (fel) {
    steg.push({ namn: "manifestet", ok: false, text: fel instanceof Error ? fel.message : String(fel) });
    return { ok: false, modul: id, steg };
  }

  const register = skapaKallregister([modul]);
  for (const yta of KALLTYPER) {
    if (typeof modul.kallor[yta] !== "function") {
      steg.push({ namn: `källan ${yta}`, ok: true, text: "fyller inte ytan" });
      continue;
    }
    // ⛔ HJÄLPEN FRÅGAS FÖR MODULENS FÖRSTA ROUTE, inte för "/": en modul svarar för sina egna sidor, och en fråga om en sida
    // den inte har ger alltid noll rader och mäter ingenting.
    const forval = yta === "hjalp" && modul.routes[0] ? { route: modul.routes[0].path } : {};
    const fraga = { ...FRAGOR[/** @type {keyof typeof FRAGOR} */ (yta)], ...forval, ...((val.fragor && val.fragor[yta]) || {}) };
    try {
      const egna = await register[yta]({ ...fraga, groupId });
      steg.push({ namn: `källan ${yta}`, ok: true, text: `${egna.length} ${egna.length === 1 ? "rad" : "rader"} för gruppen "${groupId}", alla godkända av registret` });
    } catch (fel) {
      steg.push({ namn: `källan ${yta}`, ok: false, text: fel instanceof Error ? fel.message : String(fel) });
      continue;
    }
    if (!(/** @type {readonly string[]} */ (GRUPPDATAYTOR)).includes(yta)) {
      steg.push({ namn: `källan ${yta}, en annan grupp`, ok: true, text: "provas inte: ytan bär inte gruppens data, och samma svar för varje grupp är rätt" });
      continue;
    }
    try {
      const frammande = await register[yta]({ ...fraga, groupId: PROV_FRAMMANDE_GRUPP });
      const ok = frammande.length === 0;
      steg.push({
        namn: `källan ${yta}, en annan grupp`,
        ok,
        text: ok
          ? "0 rader för en grupp modulen inte har data för"
          : `${frammande.length} rader för gruppen "${PROV_FRAMMANDE_GRUPP}", som modulen inte har data för. Källan filtrerar inte på gruppen den fick.`,
      });
    } catch (fel) {
      steg.push({ namn: `källan ${yta}, en annan grupp`, ok: false, text: fel instanceof Error ? fel.message : String(fel) });
    }
  }

  for (const yta of TYPYTOR) {
    const bidrag = typerForGrupp(yta, { bas: [], moduler: [modul], modulerPa: [modul.id], avvikelser: [] });
    steg.push({ namn: `typer för ${yta}`, ok: true, text: bidrag.length === 0 ? "inga bidrag" : `${bidrag.length}: ${bidrag.map((t) => t.id).join(", ")}` });
  }

  return { ok: steg.every((s) => s.ok), modul: modul.id, steg };
}

/**
 * Rapporten som text, en rad per steg. ⛔ Varje steg står med, också de godkända: den som läser ska se vad som provades.
 * @param {{ ok: boolean, modul: string, steg: Provsteg[] }} svar
 * @returns {string}
 */
export function provrapport(svar) {
  const rader = svar.steg.map((s) => `  ${s.ok ? "ok " : "FEL"} ${s.namn}: ${s.text}`);
  const fel = svar.steg.filter((s) => !s.ok).length;
  return [`prova-modul "${svar.modul}": ${fel === 0 ? `alla ${svar.steg.length} steg godkända` : `${fel} av ${svar.steg.length} steg föll`}`, ...rader].join("\n");
}
