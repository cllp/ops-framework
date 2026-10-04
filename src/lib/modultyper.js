/**
 * Modulernas bidrag till typer: vad en modul får lägga till, hur det slås ihop
 * med gruppens egna kategorier och vad som visas när en modul är av (0.42.0, #217).
 *
 * ══ ⛔ HÄNDELSEN (CP 2026-10-01, med en skärmbild från telefonen) ═══════════════
 *
 * "Nytt ärende" listade Ärende, Bugg, Ekonomisk uppdatering, Förbättring,
 * Kvitto/utlägg och Övrigt, och CP frågade: "Vissa av dessa typer kommer ju med
 * modulerna? Ekonomi t ex." Svaret var nej: allt låg i EN fast lista i appen
 * (`web/src/data/inbox.js`), och en grupp utan Ekonomi såg ändå "Kvitto, utlägg".
 * Samma fråga gäller kalenderns typer och händelsernas.
 *
 * ══ ⛔ TRE LAGER, OCH DE BLANDAS ALDRIG (CP 2026-10-01) ═════════════════════════
 *
 * 1. **Appens bas.** Gruppens egna kategorier (`katalog.js`), redigerbara i
 *    gruppens inställningar, gäller alltid.
 * 2. **Modulens bidrag.** `defineModule({ typer: { inkorg: [...], kalender: [...], handelser: [...], aktivitet: [...] } })`.
 *    `aktivitet` (0.55.0, cllp/ops-framework#244 beslut A) är aktivitetsloggens slag: en körning modulen gör (`ekonomi:synk`)
 *    märks «från Ekonomi» i flödet på samma sätt som ett typbidrag, och appen ger den samma ord som ett eget slag.
 *    När gruppen har modulen PÅ läggs bidragen till listan VID RENDER:
 *    `bas ∪ bidrag(påslagna moduler)`. Inget synkjobb och ingen kopia i
 *    databasen: en kopia av en modul-typ i gruppens katalog är samma faktum
 *    skrivet två gånger (arbetsreglernas punkt 2), och den dag modulen byter
 *    namn på typen hade den ena kopian glidit.
 * 3. **Gruppens avvikelse.** Ägaren kan DÖLJA eller DÖPA OM ett bidrag
 *    (`grupp.typavvikelser`), men inte skapa ett modul-id som modulen inte
 *    lämnat. Egna kategorier hör till lager 1.
 *
 * ⛔ **Tydlighetsregeln:** ett bidrag märks i varje yta där det visas
 * («från Ekonomi»), så det inte förväxlas med en fri kategori. Märket härleds
 * (`typmarke`), det skrivs aldrig för hand av en app.
 *
 * ══ ⛔ ID:T ÄR `modul:id`, OCH KOLONET ÄR VALET ═════════════════════════════════
 *
 * Det värde en rad bär som sin typ är `ekonomi:kvitto`, inte `kvitto`. Tre skäl,
 * alla mätbara i provet:
 *
 * - **Ingen krock går att uppstå.** Ett id i en katalog följer `ID_FORM`, som inte
 *   släpper kolon. Gruppens egna kategorier kan alltså aldrig ha samma värde som
 *   ett bidrag, och två moduler kan aldrig krocka med varandra, hur gruppen än
 *   döper sina kategorier. Samma knep som `|` i `katalognyckel`: avgränsaren är
 *   ett tecken som inte får finnas i någon av halvorna. Utan det hade en grupp som
 *   själv skapat kategorin `kvitto` fått en tyst krock den dag Ekonomi lade till
 *   samma id, och vilken av dem en rad pekade på hade avgjorts av ordningen.
 * - **Raden vet vilken modul den kom från även när modulen är borta.** En rad med
 *   `ekonomi:kvitto` kan märkas «arkiverad modul» utan att modulen finns kvar att
 *   slå upp, och det är exakt fallet när modulen stängts av eller avinstallerats.
 * - **Överstyrningen pekar på samma värde.** `{ yta, id: "ekonomi:kvitto" }`
 *   behöver inget separat modulfält som kan peka på något annat än id:t.
 *
 * Priset: en rad som redan bär ett gammalt omärkt id (`kvitto` ur appens fasta
 * lista) är en rad i BASLAGRET tills den migreras. Migreringen av gamla rader
 * ingår inte i #217, och `typenForRad` ger `null` för ett omärkt id som inte finns
 * i basen, i stället för att gissa vilken modul det borde ha hört till.
 *
 * ══ ⛔ ORDNINGEN I LISTAN ÄR BAS FÖRST, SEDAN MODULERNA ═════════════════════════
 *
 * Bas i sin egen `ordning`, därefter bidragen i modullistans ordning och i den
 * ordning modulen deklarerat dem. Ingen sortering över lagren: en blandad ordning
 * hade gjort märket till det enda som skilde dem åt.
 *
 * ══ ⛔ INGET TYST NEDSLÄPP ═══════════════════════════════════════════════════════
 *
 * `moduler`, `modulerPa`, `bas` och `avvikelser` KRÄVS som listor i varje anrop,
 * även när de är tomma. En app som glömde skicka in `moduler` fick annars en lista
 * utan bidrag och ingen anledning att undra: samma form som `kandaModuler` i
 * `byggGrupp` och arbetsreglernas punkt 5.
 */

import { ID_FORM, kategorin, valjbara } from "./katalog.js";
import { SLAGPLATSER } from "./slag.js";
import { byggNamn, text } from "./sprak.js";

/**
 * Listorna en modul kan bidra till. Ramverkets, och de går inte att lägga till.
 * Hänvisningen är nyckeln i `typer`, alltså ASCII (`handelser`, inte `händelser`):
 * samma skäl som `externaDatakallor` (#216), ett fältnamn i en regel är ASCII.
 */
export const TYPYTOR = /** @type {const} */ (["inkorg", "kalender", "handelser", "aktivitet"]);

/** Tecknet mellan modul och id i ett bidrags värde. Står inte i `ID_FORM`, se filhuvudet. */
export const MODULTYPAVGRANSARE = ":";

/** Fälten ett bidrag får bära i manifestet. Allt annat avvisas. */
export const TYPFALT = ["id", "namn", "ikon", "farg"];

/** Fälten en avvikelse får bära. `yta`, `id` och `dold` krävs, `namn` är valfri. */
export const TYPAVVIKELSEFALT = ["yta", "id", "dold", "namn"];
export const TYPAVVIKELSEKRAVDA = ["yta", "id", "dold"];

/**
 * Högst så många avvikelser per grupp. Reglerna har ingen loop och rullar ut posterna till samma tal.
 *
 * ⛔ SEX, OCH TALET ÄR MÄTT MOT DET VÄRSTA FALLET: en regel får utvärdera högst 1000 uttryck per skrivning, och en
 * post med omdöpt namn på båda språken är den dyraste. I emulatorn nekades ägarens giltiga skrivning vid TJUGO poster
 * ("maximum of 1000 expressions to evaluate has been reached"), och vid åtta av de dyraste; sju går igenom, sex är taket
 * med en marginal. Ett tak som regeln inte klarar att utvärdera är sämre än ett lågt tak, eftersom det nekar en giltig
 * skrivning utan att säga varför. Den första versionen hade tio och mättes bara mot billiga poster: det var fel.
 */
export const MAX_TYPAVVIKELSER = 6;
/** Högst så många tecken i ett omdöpt namn, per språk. */
export const MAX_TYPNAMN = 60;
/** Högst så många tecken i ett bidrags värde (`modul:id`). */
export const MAX_TYPID = 100;

/**
 * Formen på ett bidrags värde: `modul:id`, båda halvorna på `ID_FORM`. Härledd ur
 * `ID_FORM` och inte en egen uppsättning tecken, så den inte kan glida ifrån den.
 */
export const MODULTYPID_FORM = new RegExp(`^${ID_FORM.source.replace(/^\^/, "").replace(/\$$/, "")}${MODULTYPAVGRANSARE}${ID_FORM.source.replace(/^\^/, "").replace(/\$$/, "")}$`);

/**
 * @typedef {"inkorg" | "kalender" | "handelser" | "aktivitet"} Typyta
 */

/**
 * @typedef {object} Modultyp Ett bidrag i en byggd modul.
 * @property {string} id Modulens eget id för typen (`kvitto`). Värdet en rad bär är `modultypId(modul, id)`.
 * @property {import("./sprak.js").Namn} namn
 * @property {string | null} ikon Ett namn ur appens tillåtelselista, eller `null`. Ramverket kan inte avgöra vilken lista som gäller förrän appen ritar.
 * @property {number | null} farg En palettplats ur `SLAGPLATSER`, eller `null`.
 */

/**
 * @typedef {object} Typavvikelse Ägarens avvikelse från ett bidrag.
 * @property {Typyta} yta
 * @property {string} id Bidragets värde, `modul:id`.
 * @property {boolean} dold Sant när bidraget inte längre erbjuds som val.
 * @property {import("./sprak.js").Namn} [namn] Ägarens eget namn på bidraget.
 */

/**
 * @typedef {object} Typval En rad i en typlista, oavsett lager.
 * @property {string} id Värdet en rad bär: kategorins id (bas) eller `modul:id` (bidrag).
 * @property {import("./sprak.js").Namn} namn
 * @property {string | null} ikon
 * @property {number | null} farg
 * @property {number} ordning
 * @property {"bas" | { modul: string }} kalla `"bas"` för gruppens egna, `{ modul }` för ett bidrag.
 * @property {import("./sprak.js").Namn | null} modulNamn Modulens namn när det är känt, annars `null`.
 * @property {"aktiv" | "dold" | "arkiverad" | "modul-av" | "modul-okand"} tillstand `aktiv`: går att välja. `dold`: ägaren dolde det.
 *   `arkiverad`: en egen kategori som arkiverats. `modul-av`: modulen är avstängd i gruppen. `modul-okand`: modulen eller typen finns inte längre.
 * @property {boolean} omdopt Sant när ägarens namn ersatt modulens.
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/** @param {unknown} o @returns {o is Record<string, any>} */
const arObjekt = (o) => Boolean(o) && typeof o === "object" && !Array.isArray(o);

/**
 * Värdet en rad bär för ett bidrag.
 * @param {string} modulId
 * @param {string} id
 * @returns {string}
 */
export function modultypId(modulId, id) {
  const m = rensa(modulId);
  const i = rensa(id);
  if (!ID_FORM.test(m) || !ID_FORM.test(i)) {
    throw new Error(`modultypId: både modul och id måste ha id-formen (små bokstäver, siffror, - och _). Fick modul "${m}" och id "${i}".`);
  }
  return `${m}${MODULTYPAVGRANSARE}${i}`;
}

/**
 * Delar ett värde i modul och id, eller `null` när det inte är ett bidrag
 * (gruppens egna id har aldrig kolon, så `null` är svaret för en egen kategori).
 *
 * @param {unknown} varde
 * @returns {{ modul: string, id: string } | null}
 */
export function delaModultypId(varde) {
  const v = rensa(varde);
  if (!MODULTYPID_FORM.test(v)) return null;
  const i = v.indexOf(MODULTYPAVGRANSARE);
  return { modul: v.slice(0, i), id: v.slice(i + 1) };
}

/**
 * Bygger `typer` ur ett manifest, eller kastar med skälet. Anropas av `defineModule`.
 *
 * ⛔ FRÅNVARANDE FÄLT GER TRE TOMMA LISTOR OCH INTE ETT FEL, och det är ett val med
 * pris. `hubb` KRÄVS ÄVEN TOMT (0.37.0), men `typer` är ett BIDRAG och inget en modul
 * behöver för att fungera: ett krav hade fällt varje redan skriven modul (appens,
 * `tam`:s, mallarnas) på en minorversion. Tomhet skrivs ändå ut: den byggda modulen
 * bär ALLTID alla tre listorna, så ingen konsument behöver fråga om en nyckel finns.
 *
 * @param {unknown} varde Manifestets `typer`.
 * @param {(falt: string, skal: string) => Error} var_
 * @returns {Readonly<Record<Typyta, ReadonlyArray<Modultyp>>>}
 */
export function byggModulTyper(varde, var_) {
  /** @type {Record<string, Modultyp[]>} */
  const ut = Object.fromEntries(TYPYTOR.map((yta) => [yta, []]));
  if (varde === undefined) return frysTyper(ut);
  if (!arObjekt(varde)) {
    throw var_("typer", `måste vara ett objekt { ${TYPYTOR.join(", ")} } med en lista per yta, inte ${Array.isArray(varde) ? "en lista" : varde === null ? "null" : typeof varde}. Utelämna fältet helt när modulen inte bidrar med några typer.`);
  }
  const okandaYtor = Object.keys(varde).filter((n) => !(/** @type {readonly string[]} */ (TYPYTOR)).includes(n));
  if (okandaYtor.length > 0) {
    throw var_(
      `typer.${okandaYtor.join(", typer.")}`,
      `finns inte. Ytorna är ramverkets och går inte att lägga till: ${TYPYTOR.join(", ")}. Nyckeln är ASCII, alltså handelser och inte händelser, av samma skäl som varje annat fältnamn.`,
    );
  }
  for (const yta of TYPYTOR) {
    const lista = /** @type {Record<string, unknown>} */ (varde)[yta];
    if (lista === undefined) continue;
    if (!Array.isArray(lista)) {
      throw var_(`typer.${yta}`, `måste vara en lista, även när den är tom, inte ${lista === null ? "null" : typeof lista}.`);
    }
    lista.forEach((/** @type {any} */ rad, /** @type {number} */ i) => {
      const plats = `typer.${yta}[${i}]`;
      if (!arObjekt(rad)) throw var_(plats, `måste vara ett objekt med ${TYPFALT.join(", ")}.`);
      const okanda = Object.keys(rad).filter((n) => !TYPFALT.includes(n));
      if (okanda.length > 0) {
        throw var_(plats, `bär fälten ${okanda.join(", ")} som inte känns igen. Ett bidrag bär ${TYPFALT.join(", ")}. Beteende hör inte hemma här, och en modul kan inte påstå att den äger en fas: faserna är ramverkets.`);
      }
      const id = rensa(rad.id);
      if (!id) throw var_(`${plats}.id`, "krävs. Det är nyckeln en rad pekar på, tillsammans med modulens id.");
      if (!ID_FORM.test(id)) {
        throw var_(`${plats}.id "${id}"`, "får bara innehålla små bokstäver, siffror, bindestreck och understreck. Kolon är ramverkets avgränsare mellan modul och id, och står därför aldrig i ett id: det är det som gör att ett bidrag aldrig kan krocka med en egen kategori.");
      }
      if (ut[yta].some((x) => x.id === id)) throw var_(`${plats}.id "${id}"`, `står två gånger i typer.${yta}. Två bidrag med samma id ser ut som ett i varje vy.`);
      if (typeof rad.namn === "string") {
        throw var_(`${plats}.namn för "${id}"`, 'är en sträng. Ett namn är { sv, en }, som modulens eget. Det finns inga gamla manifest att migrera.');
      }
      let namn;
      try {
        namn = byggNamn(arObjekt(rad.namn) ? rad.namn : {});
      } catch (fel) {
        throw var_(`${plats}.namn för "${id}"`, fel instanceof Error ? fel.message.replace(/^byggNamn: /, "") : String(fel));
      }
      /** @type {string | null} */
      let ikon = null;
      if (rad.ikon !== undefined && rad.ikon !== null) {
        ikon = rensa(rad.ikon);
        if (!ikon) throw var_(`${plats}.ikon för "${id}"`, "måste vara ett ikonnamn som sträng, eller utelämnas. Namnet kontrolleras mot appens tillåtelselista när det ritas, eftersom ramverket inte vet vilken lista som gäller.");
      }
      /** @type {number | null} */
      let farg = null;
      if (rad.farg !== undefined && rad.farg !== null) {
        farg = Number(rad.farg);
        if (!SLAGPLATSER.includes(farg)) {
          throw var_(`${plats}.farg för "${id}"`, `måste vara en palettplats (${SLAGPLATSER.join(", ")}), inte ${JSON.stringify(rad.farg)}. En hex följer inte med när mörkt tema eller en ny identitet kommer.`);
        }
      }
      ut[yta].push({ id, namn, ikon, farg });
    });
  }
  return frysTyper(ut);
}

/** @param {Record<string, Modultyp[]>} ut */
function frysTyper(ut) {
  // ⛔ HÄRLEDD UR `TYPYTOR` (0.55.0). Här stod de tre ytorna uppräknade för hand, och när `aktivitet` lades till i listan
  // tappade varje byggd modul den fjärde: provet "en tom lista per yta" blev rött på just den raden.
  return /** @type {Readonly<Record<Typyta, ReadonlyArray<Modultyp>>>} */ (
    Object.freeze(Object.fromEntries(TYPYTOR.map((yta) => [yta, Object.freeze((ut[yta] || []).map((t) => Object.freeze(t)))])))
  );
}

/**
 * Bygger gruppens `typavvikelser`, eller kastar med skälet. Anropas av `byggGrupp`.
 * Frånvarande ger `[]`, så en grupp skriven före 0.42.0 läses utan migrering.
 *
 * ⛔ DET ÄR HÄR "INGA PÅHITTADE MODUL-ID" AVGÖRS. En avvikelse kan bara PEKA på ett
 * bidrag, aldrig skapa ett: sammanslagningen läser avvikelser mot de bidrag
 * modulerna faktiskt lämnat, så en avvikelse utan bidrag bakom sig har ingen
 * effekt. Skrivvägen skickar dessutom in de kända modulerna och avvisar den som
 * pekar på en modul eller en typ som inte finns (en skrivfelad avvikelse sparas
 * annars som en dold typ ingen hittar). Reglerna kan inte slå upp modulernas
 * typer, så de kontrollerar formen och antalet, inte att id:t finns: det är
 * läsvägens tolerans och skrivvägens kontroll, samma uppdelning som `kandaModuler`.
 *
 * ⛔ EN AVVIKELSE SOM INTE GÖR NÅGOT AVVISAS. `dold: false` utan eget namn är samma
 * sak som ingen avvikelse, och en sådan rad är brus som ser ut som ett beslut.
 * `medAvvikelse` tar bort den i stället för att skriva den.
 *
 * @param {unknown} varde
 * @param {string} gruppId För felmeddelandena.
 * @param {ReadonlyArray<{ id: string, typer?: Record<string, ReadonlyArray<{ id: string }>> }> | ReadonlyArray<string>} [kandaModuler]
 * @returns {ReadonlyArray<Typavvikelse>}
 */
export function byggTypavvikelser(varde, gruppId, kandaModuler) {
  if (varde === undefined) return Object.freeze([]);
  if (!Array.isArray(varde)) {
    throw new Error(`groups: typavvikelser för "${gruppId}" måste vara en lista, även när den är tom, inte ${typeof varde}.`);
  }
  if (varde.length > MAX_TYPAVVIKELSER) {
    throw new Error(`groups: typavvikelser för "${gruppId}" har ${varde.length} poster. Taket är ${MAX_TYPAVVIKELSER}.`);
  }
  const kanda = Array.isArray(kandaModuler) ? kandaModuler.map((m) => (typeof m === "string" ? { id: m } : m)).filter((m) => m && typeof m.id === "string") : null;
  /** @type {Typavvikelse[]} */
  const ut = [];
  varde.forEach((/** @type {any} */ p, /** @type {number} */ i) => {
    const var_ = `groups: typavvikelser[${i}] för "${gruppId}"`;
    if (!arObjekt(p)) throw new Error(`${var_} måste vara ett objekt.`);
    const okanda = Object.keys(p).filter((n) => !TYPAVVIKELSEFALT.includes(n));
    if (okanda.length > 0) throw new Error(`${var_} bär fälten ${okanda.join(", ")}. Tillåtna: ${TYPAVVIKELSEFALT.join(", ")}.`);
    for (const k of TYPAVVIKELSEKRAVDA) {
      if (!(k in p)) throw new Error(`${var_} saknar ${k}.`);
    }
    if (!(/** @type {readonly string[]} */ (TYPYTOR)).includes(p.yta)) {
      throw new Error(`${var_} har ytan ${JSON.stringify(p.yta)}. Giltiga: ${TYPYTOR.join(", ")}.`);
    }
    const id = typeof p.id === "string" ? p.id : "";
    const delat = delaModultypId(id);
    if (!delat || id.length > MAX_TYPID) {
      throw new Error(`${var_} har id:t ${JSON.stringify(p.id)}, som inte är på formen modul:id (båda halvorna med små bokstäver, siffror, - och _, högst ${MAX_TYPID} tecken). En avvikelse pekar på ett bidrag och kan aldrig vara en egen kategori: de ändras i katalogen.`);
    }
    if (typeof p.dold !== "boolean") throw new Error(`${var_} har dold ${JSON.stringify(p.dold)}. Det måste vara true eller false.`);
    /** @type {Typavvikelse} */
    let post = { yta: p.yta, id, dold: p.dold };
    if (p.namn !== undefined) {
      if (typeof p.namn === "string" || !arObjekt(p.namn)) throw new Error(`${var_} har ett namn som inte är { sv, en }.`);
      const okandaNamn = Object.keys(p.namn).filter((n) => n !== "sv" && n !== "en");
      if (okandaNamn.length > 0) throw new Error(`${var_} har ett namn med fälten ${okandaNamn.join(", ")}. Ett namn är { sv, en }.`);
      let namn;
      try {
        namn = byggNamn(p.namn);
      } catch (fel) {
        throw new Error(`${var_} har ett namn som ${fel instanceof Error ? fel.message.replace(/^byggNamn: /, "") : String(fel)}`);
      }
      if (namn.sv.length > MAX_TYPNAMN || (namn.en && namn.en.length > MAX_TYPNAMN)) {
        throw new Error(`${var_} har ett namn längre än ${MAX_TYPNAMN} tecken.`);
      }
      post = { ...post, namn };
    }
    if (!post.dold && !post.namn) {
      throw new Error(`${var_} (${id}) gör ingenting: dold är false och inget eget namn finns. Ta bort raden i stället för att skriva en avvikelse som inte avviker.`);
    }
    if (ut.some((x) => x.yta === post.yta && x.id === post.id)) {
      throw new Error(`${var_} (${id}, ${post.yta}) står två gånger. Vilken av dem som gällde avgjordes av ordningen.`);
    }
    if (kanda) {
      const modul = kanda.find((m) => m.id === /** @type {{ modul: string }} */ (delat).modul);
      if (!modul) {
        throw new Error(
          `${var_} pekar på modulen "${delat.modul}", som inte är registrerad. Kända: ${kanda.length > 0 ? kanda.map((m) => m.id).join(", ") : "inga"}. En avvikelse kan inte skapa ett modul-id, bara ändra ett bidrag som en modul lämnat.`,
        );
      }
      if (modul.typer && !(modul.typer[p.yta] || []).some((/** @type {{ id: string }} */ t) => t.id === delat.id)) {
        throw new Error(`${var_} pekar på "${id}", men modulen "${delat.modul}" bidrar inte med någon typ "${delat.id}" till ${p.yta}. En avvikelse kan inte skapa ett bidrag.`);
      }
    }
    ut.push(Object.freeze(post));
  });
  return Object.freeze(ut);
}

/**
 * Listan efter att EN avvikelse lagts till, ersatt eller tagits bort.
 *
 * `ny` är det önskade tillståndet för ett bidrag: `{ yta, id, dold, namn? }`. Gör den
 * ingenting (`dold: false`, inget namn) tas den befintliga avvikelsen bort och ingen
 * ny skrivs, så en ägare som visar ett dolt bidrag och återställer namnet får en
 * tom lista tillbaka och inte en rad som ser ut som ett beslut.
 *
 * Kontrollen mot modulerna görs när gruppen byggs (`byggGrupp(rad, moduler)`), inte här.
 *
 * @param {ReadonlyArray<Typavvikelse>} lista
 * @param {{ yta: string, id: string, dold: boolean, namn?: { sv?: string, en?: string } | null }} ny
 * @returns {ReadonlyArray<Typavvikelse>}
 */
export function medAvvikelse(lista, ny) {
  if (!Array.isArray(lista)) throw new Error(`medAvvikelse: lista måste vara en lista, inte ${typeof lista}. Skicka [] när gruppen inte har några avvikelser.`);
  if (!arObjekt(ny)) throw new Error("medAvvikelse: ny måste vara ett objekt { yta, id, dold, namn? }.");
  const ovriga = lista.filter((x) => !(x.yta === ny.yta && x.id === ny.id));
  const harNamn = ny.namn !== undefined && ny.namn !== null && rensa(ny.namn.sv) !== "";
  if (ny.dold !== true && !harNamn) return byggTypavvikelser(ovriga, "medAvvikelse");
  const post = { yta: ny.yta, id: ny.id, dold: ny.dold === true, ...(harNamn ? { namn: ny.namn } : {}) };
  return byggTypavvikelser([...ovriga, post], "medAvvikelse");
}

/**
 * @typedef {object} Typsammanhang
 * @property {ReadonlyArray<any>} bas Gruppens egna kategorier för ytan (`kategorier` ur katalogkällan), eller `[]`.
 * @property {ReadonlyArray<import("./modul.js").Modul>} moduler De INSTALLERADE modulerna (ur `validateModuler`), inte bara gruppens.
 * @property {ReadonlyArray<string>} modulerPa Gruppens `moduler`: vilka som är påslagna.
 * @property {ReadonlyArray<Typavvikelse>} avvikelser Gruppens `typavvikelser`, eller `[]`.
 */

/**
 * @param {string} yta
 * @param {any} sammanhang
 * @param {string} vem
 * @returns {{ bas: ReadonlyArray<any>, moduler: ReadonlyArray<import("./modul.js").Modul>, modulerPa: ReadonlyArray<string>, avvikelser: ReadonlyArray<Typavvikelse> }}
 */
function kontrollera(yta, sammanhang, vem) {
  if (!(/** @type {readonly string[]} */ (TYPYTOR)).includes(yta)) {
    throw new Error(`${vem}: ytan "${yta}" finns inte. Ytorna är ${TYPYTOR.join(", ")}.`);
  }
  const s = arObjekt(sammanhang) ? sammanhang : {};
  for (const nyckel of ["bas", "moduler", "modulerPa", "avvikelser"]) {
    if (!Array.isArray(s[nyckel])) {
      throw new Error(
        `${vem}: ${nyckel} krävs och måste vara en lista, även när den är tom. En app som glömt skicka den ser likadan ut som en grupp utan ${nyckel === "moduler" || nyckel === "modulerPa" ? "moduler" : nyckel === "bas" ? "egna kategorier" : "avvikelser"}, och bidragen försvinner då utan ett ljud.`,
      );
    }
  }
  for (const m of s.moduler) {
    if (!m || typeof m !== "object" || typeof m.id !== "string" || !arObjekt(m.typer) || !Array.isArray(m.typer[yta])) {
      throw new Error(`${vem}: moduler måste vara byggda moduler (resultatet av defineModule eller validateModuler). Fick ${JSON.stringify(m && m.id)} utan typer.`);
    }
  }
  return /** @type {any} */ (s);
}

/**
 * @param {import("./modul.js").Modul} modul
 * @param {Modultyp} t
 * @param {Typyta} yta
 * @param {Typsammanhang["avvikelser"]} avvikelser
 * @param {boolean} pa
 * @returns {Typval}
 */
function bidrag(modul, t, yta, avvikelser, pa) {
  const id = modultypId(modul.id, t.id);
  const avvik = avvikelser.find((a) => a.yta === yta && a.id === id);
  /** @type {Typval["tillstand"]} */
  const tillstand = !pa ? "modul-av" : avvik && avvik.dold ? "dold" : "aktiv";
  return Object.freeze({
    id,
    namn: avvik && avvik.namn ? avvik.namn : t.namn,
    ikon: t.ikon,
    farg: t.farg,
    ordning: 0,
    kalla: Object.freeze({ modul: modul.id }),
    modulNamn: modul.namn,
    tillstand,
    omdopt: Boolean(avvik && avvik.namn),
  });
}

/**
 * Alla bidrag modulerna lämnat för en yta, med sitt tillstånd i gruppen, i modullistans ordning.
 *
 * @param {Typyta} yta
 * @param {Typsammanhang} sammanhang
 * @returns {Typval[]}
 */
function allaBidrag(yta, sammanhang) {
  /** @type {Typval[]} */
  const ut = [];
  sammanhang.moduler.forEach((modul) => {
    const pa = sammanhang.modulerPa.includes(modul.id);
    for (const t of modul.typer[yta]) ut.push(bidrag(modul, t, yta, sammanhang.avvikelser, pa));
  });
  return ut.map((t, i) => Object.freeze({ ...t, ordning: i }));
}

/**
 * @param {any} k En kategori ur basen.
 * @returns {Typval}
 */
function basrad(k) {
  return Object.freeze({
    ...k,
    ikon: k.ikon ?? null,
    farg: k.farg ?? null,
    kalla: /** @type {const} */ ("bas"),
    modulNamn: null,
    tillstand: /** @type {"arkiverad" | "aktiv"} */ (k.arkiverad ? "arkiverad" : "aktiv"),
    omdopt: false,
  });
}

/**
 * Typerna att VÄLJA mellan i en yta: gruppens egna (ej arkiverade) följda av bidragen
 * från de moduler gruppen har PÅ, minus de ägaren dolt, med ägarens egna namn där det finns.
 *
 * `bas ∪ bidrag(påslagna)` vid render, ingen kopia i databasen (se filhuvudet). En
 * modul som är AV bidrar inte till valen men raderna som redan bär dess typer
 * förlorar ingenting: `typenForRad` svarar för dem.
 *
 * @param {Typyta} yta
 * @param {Typsammanhang & { sprak?: string }} sammanhang
 * @returns {Typval[]}
 */
export function typerForGrupp(yta, sammanhang) {
  const s = kontrollera(yta, sammanhang, "typerForGrupp");
  const sprak = (sammanhang && sammanhang.sprak) || "sv";
  const bas = valjbara(/** @type {any} */ (s.bas), sprak).map(basrad);
  const bidragen = allaBidrag(yta, s).filter((t) => t.tillstand === "aktiv");
  return [...bas, ...bidragen];
}

/**
 * Bidragen till en yta som gruppens ägare kan hantera: de från PÅSLAGNA moduler, både de
 * som erbjuds (`aktiv`) och de ägaren dolt (`dold`). Moduler som är av räknas inte upp:
 * de har inget att hantera förrän de slås på igen.
 *
 * @param {Typyta} yta
 * @param {Typsammanhang} sammanhang
 * @returns {Typval[]}
 */
export function bidragForGrupp(yta, sammanhang) {
  const s = kontrollera(yta, sammanhang, "bidragForGrupp");
  return allaBidrag(yta, s).filter((t) => t.tillstand === "aktiv" || t.tillstand === "dold");
}

/**
 * Typen en SKRIVEN rad pekar på, för att visa den. Tappar aldrig en rad:
 *
 * - Ett omärkt värde slås upp bland gruppens egna kategorier, arkiverade med (en arkiverad
 *   kategori ska fortfarande kunna visas på raderna som bär den), och ger `null` när det
 *   inte finns där, som `kategorin`.
 * - Ett `modul:id`-värde slås upp bland modulernas bidrag. Är modulen AV i gruppen, eller
 *   finns modulen eller typen inte längre, ges raden ändå tillbaka, med `tillstand`
 *   `modul-av` eller `modul-okand`: den visas som «arkiverad modul» och försvinner inte.
 *   Dolt av ägaren ger `dold`, som fortfarande går att visa på raderna som redan bär det.
 *
 * ⛔ ETT NAMN SOM INTE KAN SLÅS UPP SKRIVS UT SOM DET ÄR, i stället för att bli en tom
 * etikett. `modul-okand` bär id-halvan som namn: en rad vars typ är borta ska gå att
 * känna igen, och en tom sträng ser ut som en rad som inte laddat.
 *
 * @param {unknown} varde
 * @param {Typyta} yta
 * @param {Typsammanhang} sammanhang
 * @returns {Typval | null}
 */
export function typenForRad(varde, yta, sammanhang) {
  const s = kontrollera(yta, sammanhang, "typenForRad");
  const v = rensa(varde);
  if (!v) return null;
  const delat = delaModultypId(v);
  if (!delat) {
    const k = kategorin(/** @type {any} */ (s.bas), v);
    return k ? basrad(k) : null;
  }
  const funnen = allaBidrag(yta, s).find((t) => t.id === v);
  if (funnen) return funnen;
  return Object.freeze({
    id: v,
    namn: { sv: delat.id },
    ikon: null,
    farg: null,
    ordning: 0,
    kalla: Object.freeze({ modul: delat.modul }),
    modulNamn: null,
    tillstand: /** @type {const} */ ("modul-okand"),
    omdopt: false,
  });
}

/**
 * Märket som säger varifrån en typ kommer: «från Ekonomi», «arkiverad modul», eller `null` för
 * gruppens egna kategorier, som inte behöver något märke.
 *
 * ⛔ HÄRLEDD, ALDRIG SKRIVEN FÖR HAND. En app som skriver «från Ekonomi» själv glömmer märket på
 * nästa yta, och då har vyn två sorters rader som ser likadana ut (tydlighetsregeln i filhuvudet).
 *
 * @param {Typval} typ
 * @param {string} [sprak]
 * @returns {string | null}
 */
export function typmarke(typ, sprak = "sv") {
  if (!typ || typ.kalla === "bas") return null;
  const en = sprak === "en";
  if (typ.tillstand === "modul-av" || typ.tillstand === "modul-okand") return en ? "archived module" : "arkiverad modul";
  const modul = text(typ.modulNamn, sprak) || typ.kalla.modul;
  const grund = en ? `from ${modul}` : `från ${modul}`;
  return typ.tillstand === "dold" ? (en ? `${grund}, hidden` : `${grund}, dold`) : grund;
}

/**
 * Modulen en händelse hör hemma i, härledd ur dess typ (0.43.0, cllp/ops-framework#224), eller `null` för en typ ur
 * gruppens egna kategorier: den kom inte från någon modul.
 *
 * ⛔ INGET EGET FÄLT PÅ HÄNDELSEN. Typen `ekonomi:kvitto` säger redan att händelsen kom från Ekonomi, och ett fält
 * `ursprungsmodul` bredvid hade varit en andra kopia av samma faktum som kan glida isär från typen (arbetsreglernas
 * punkt 2). Appen lägger svaret i händelsens `ursprung` när den ritar listan eller panelen, tillsammans med en länk
 * tillbaka om det finns något att länka till (ett kvitto, en faktura): DEN är appens, inte typens.
 *
 * ⛔ EN MODUL SOM ÄR AV ELLER BORTA NÄMNS ÄNDÅ, med «arkiverad modul» efter namnet. En händelse vars ursprung
 * försvann ur raden hade sett ut som en händelse någon skapat för hand.
 *
 * @param {Typval | null | undefined} typ Svaret ur `typenForRad`.
 * @param {string} [sprak]
 * @returns {{ modul: string } | null}
 */
export function typensUrsprung(typ, sprak = "sv") {
  if (!typ || typ.kalla === "bas") return null;
  const namn = text(typ.modulNamn, sprak) || typ.kalla.modul;
  if (typ.tillstand === "modul-av" || typ.tillstand === "modul-okand") {
    return Object.freeze({ modul: `${namn}, ${sprak === "en" ? "archived module" : "arkiverad modul"}` });
  }
  return Object.freeze({ modul: namn });
}

/**
 * Typerna som alternativ till `OpsRadioGroup` (och andra val): `value` är värdet raden bär, `label`
 * namnet, och `hint` märket för ett bidrag. Gruppens egna kategorier får ingen `hint`.
 *
 * @param {ReadonlyArray<Typval>} typer
 * @param {string} [sprak]
 * @returns {Array<{ value: string, label: string, hint?: string }>}
 */
export function typerTillValg(typer, sprak = "sv") {
  return typer.map((t) => {
    const marke = typmarke(t, sprak);
    return { value: t.id, label: text(t.namn, sprak), ...(marke ? { hint: marke } : {}) };
  });
}
