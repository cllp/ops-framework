/**
 * Gruppens egna platser i Biblioteket: namnet, nyckeln och reglerna för vad som får skrivas (0.155.0, cllp/ops-framework#469).
 *
 * ══ ⛔ BESLUTET ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-29, med en skärmbild av Biblioteket i gruppen Music (växlaren visar Music och Mitt bibliotek): "Men man kan inte lägga till flera platser i en grupp. Om man vill ha den sorteringen.
 * Det är detta som saknas." Och beslutet samma dag: egna platser är till för det man själv sorterar (projekt, "Demos", "Live"). En händelses, ett ärendes och chattens filer blir INTE platser i
 * växlaren; en fil hamnar på en egen plats bara för att någon väljer Flytta eller Kopiera dit.
 *
 * ══ ⛔ TVÅ DELAR, OCH VAR DE BOR ════════════════════════════════════════════════════════════════════════════════════════
 *
 *   PLATSEN SOM ADRESS    `plats~<grupp>~<id>` i `groupId` på en bibliotekspost (`platsBibliotek` i `bibliotek.js`). Ingen uppslagning: gruppen står i id:t.
 *   PLATSEN SOM DATA      ett dokument i appens samling (ramverket känner aldrig samlingsnamnet): `<samling>/{grupp}|{id}` med fälten i `PLATSFALT`. Namnet, vem som skapade den, när, och om den är arkiverad.
 *
 * ⛔ ID:T ÄR UNIKT PER GRUPP GENOM DOKUMENT-ID:T. Nyckeln är `<grupp>|<id>` (samma form som en katalograd, `katalognyckel`), och reglerna kräver att nyckeln börjar med radens egen grupp. Ett andra
 * dokument med samma nyckel kan inte finnas: det är en riktig constraint, ingen läs-sedan-skriv-kontroll. Id:t lagras inte på raden (arbetsreglernas punkt 2): adaptern tar det ur nyckeln.
 *
 * ⛔ ID:T ÄNDRAS ALDRIG. Varje post på platsen pekar på det (`groupId` på posten). Att byta namn rör `namn` och inget annat; att arkivera sätter `arkiverad` och rör inga poster. Ingenting raderas:
 * reglerna nekar `delete`, för "varför försvann platsen" frågas alltid i efterhand.
 *
 * ⛔ ANGES ID:T AV ANROPAREN, ANNARS HÄRLEDS DET UR NAMNET. Projekt-modulen i appen skapar en plats med id = projektets tagg (gemener, siffror, bindestreck, högst 24 tecken), så att projektet och platsen
 * delar nyckel. Utan `id` gör `harledPlatsId` ett id ur namnet och lägger på `-2`, `-3` när det redan finns (arkiverade platser räknas också: ett arkiverat id är fortfarande nyckeln posterna pekar på).
 */

import { trimSomRegeln, platsBibliotek, PLATSIDFORM } from "./bibliotek.js";
import { ID_FORM, KATALOGAVGRANSARE, slugUrNamn } from "./katalog.js";
import { byggSkapare } from "./skapare.js";
import { ordet } from "./ord.js";
import { RESERVSPRAK } from "./sprak.js";

/** Fälten ett platsdokument bär. `id` är nyckeln (`<grupp>|<id>`) och lagras inte. Samma lista i regelns `hasOnly`. */
export const PLATSFALT = /** @type {const} */ (["groupId", "namn", "skapadAv", "skapad", "arkiverad"]);

/**
 * Fälten ett platsdokument kan bära när en modul förvaltar platsen (0.155.0): de vanliga och `forvaltas`. Fältet skrivs bara av servern (Admin SDK, modulens egen funktion), aldrig av en klient: reglerna
 * nekar en klient både att sätta det vid skapandet och att ändra något alls på en plats som har det. Samma lista i regelns `hasOnly` för ett dokument som redan finns.
 */
export const PLATSFALT_FORVALTAD = /** @type {const} */ ([...PLATSFALT, "forvaltas"]);

/** Fältet `forvaltas` har exakt ett fält: modulens id. Ramverket känner inte modulen, appen skickar in id:t. */
export const FORVALTNINGSFALT = /** @type {const} */ (["modul"]);

/** Längsta modul-id i `forvaltas.modul`. */
export const MAX_FORVALTARE = 48;

/** Längsta namn, i tecken, efter trim. Samma sorts tak som rubriken på en post, men kortare: namnet står i en växlare. */
export const MAX_PLATSNAMN = 60;

/** Så många platser listan visar utan sökfält. Över det får växlaren ett sökfält (cllp/ops-framework#469, "Hur lång kan växlaren bli? TAM får 13 projekt"). */
export const PLATSER_UTAN_SOK = 8;

/** Avgränsaren i nyckeln, samma som en katalograd och ett medlemskap. Olaglig i ett grupp-id och i ett plats-id. */
export const PLATSNYCKEL_AVGRANSARE = KATALOGAVGRANSARE;

/**
 * @typedef {object} Plats
 * @property {string} id Plats-id:t, alltså delen efter `~` i `plats`. Det som en app kan välja själv (Projekt: projektets tagg).
 * @property {string} groupId Gruppen platsen hör till.
 * @property {string} plats Adressen: `plats~<grupp>~<id>`. Det som är `groupId` på posterna och `id` i växlaren.
 * @property {string} namn Det som visas.
 * @property {import("./skapare.js").Skapare} skapadAv
 * @property {number} skapad Millisekunder.
 * @property {boolean} arkiverad Döljs i växlaren. Posterna ligger kvar och går att flytta ut när platsen tas fram igen.
 * @property {{ modul: string }} [forvaltas] (0.155.0) Platsen förvaltas av en modul (till exempel ett projekts plats): bara servern ändrar namn och arkivering, och en klient kan inte. Saknas fältet sköter gruppen platsen själv.
 */

/**
 * Dokumentets nyckel: `<grupp>|<id>`.
 * @param {unknown} groupId
 * @param {unknown} platsId
 * @returns {string}
 */
export function platsnyckel(groupId, platsId) {
  const g = typeof groupId === "string" ? groupId.trim() : "";
  const i = typeof platsId === "string" ? platsId.trim() : "";
  if (!ID_FORM.test(g) || !PLATSIDFORM.test(i)) {
    throw new Error(`platsnyckel: grupp "${g}" och plats "${i}" går inte att använda. Ett grupp-id (a-z, 0-9, - och _) och ett plats-id (a-z, 0-9, - och _, högst 24 tecken) krävs.`);
  }
  return `${g}${PLATSNYCKEL_AVGRANSARE}${i}`;
}

/**
 * Ett plats-id ur ett namn: gemener, å och ä till a, ö till o, allt annat till ett bindestreck, högst 24 tecken (`PLATSIDFORM`). Ger namnet inga tecken som går att använda blir id:t `plats`. Unikt genom ett
 * suffix (`demos`, `demos-2`): de som redan finns räknas också när de är arkiverade. Anropas bara när en NY plats byggs, och id:t ändras aldrig efteråt.
 *
 * @param {unknown} namn
 * @param {Iterable<string>} [upptagna] Id:n som redan finns i gruppen, arkiverade med.
 * @returns {string}
 */
export function harledPlatsId(namn, upptagna = []) {
  const max = 24;
  const bas = slugUrNamn(namn, max - 3) || "plats";
  const finns = new Set(upptagna);
  if (!finns.has(bas)) return bas;
  for (let n = 2; ; n += 1) {
    const kandidat = `${bas}-${n}`;
    if (!finns.has(kandidat)) return kandidat;
  }
}

/** Felen för ett platsnamn, på båda språken. Ordboken står här och ingen annanstans (arbetsreglernas punkt 2). */
export const ORD_PLATSNAMNFEL = {
  saknas: { sv: "Platsen behöver ett namn.", en: "The place needs a name." },
  forLangt: { sv: "Namnet är {antal} tecken. Taket är {tak}.", en: "The name is {antal} characters. The limit is {tak}." },
  finnsRedan: { sv: "Det finns redan en plats som heter {namn}.", en: "There is already a place called {namn}." },
};

/**
 * Skälet till att ett namn inte går att använda, eller `null`. Trimmat som regeln gör det (`trimSomRegeln`), högst `MAX_PLATSNAMN` tecken.
 *
 * ⛔ TVÅ PLATSER MED SAMMA NAMN I EN VÄXLARE GÅR INTE ATT SKILJA ÅT. Med `befintliga` (platserna i gruppen, arkiverade med) avvisas ett namn som redan finns, utan hänsyn till versaler. `utom` är den plats som
 * byter namn och räknas inte mot sig själv. Reglerna prövar inte detta (de skulle behöva en lista), så det är klientens sak, och ett namn som ändå skrivs dubbelt skadar ingenting.
 *
 * @param {unknown} namn
 * @param {{ befintliga?: ReadonlyArray<{ id: string, namn: string }>, utom?: string, sprak?: string }} [val] `sprak` är `"sv"` eller `"en"`, förval svenska.
 * @returns {string | null}
 */
export function platsnamnFel(namn, val = {}) {
  const sprak = val.sprak ?? RESERVSPRAK;
  const t = (/** @type {keyof typeof ORD_PLATSNAMNFEL} */ nyckel) => ordet(ORD_PLATSNAMNFEL, nyckel, sprak);
  const n = trimSomRegeln(namn);
  if (!n) return t("saknas");
  if (n.length > MAX_PLATSNAMN) return t("forLangt").replace("{antal}", String(n.length)).replace("{tak}", String(MAX_PLATSNAMN));
  const lika = n.toLocaleLowerCase("sv");
  const finns = (val.befintliga ?? []).find((p) => p.id !== val.utom && trimSomRegeln(p.namn).toLocaleLowerCase("sv") === lika);
  if (finns) return t("finnsRedan").replace("{namn}", finns.namn);
  return null;
}

/**
 * Skälet till att ett plats-id inte går att använda, eller `null`.
 * @param {unknown} id
 * @returns {string | null}
 */
export function platsidFel(id) {
  if (typeof id !== "string" || !PLATSIDFORM.test(id)) {
    return `Plats-id:t "${typeof id === "string" ? id : ""}" går inte att använda. Gemener, siffror, bindestreck och understreck, högst 24 tecken, och det börjar på en bokstav eller siffra.`;
  }
  return null;
}

/**
 * Raden som skrivs när en plats skapas, med nyckeln. Kastar med skälet.
 *
 * @param {object} d
 * @param {string} d.groupId
 * @param {string} d.namn
 * @param {Record<string, unknown>} d.skapadAv Skaparstämpeln (`byggSkapare`). Typen ska vara `manniska`: en plats skapas av en medlem, aldrig av en agent.
 * @param {string} [d.id] Plats-id:t. Utelämnat härleds det ur namnet.
 * @param {number} [d.skapad] Förval nu.
 * @param {ReadonlyArray<{ id: string, namn: string }>} [d.befintliga] Gruppens platser, arkiverade med: för unikt id och namn.
 * @returns {{ nyckel: string, id: string, plats: string, rad: Omit<Plats, "id" | "plats"> }}
 */
export function byggPlats(d) {
  const groupId = typeof d?.groupId === "string" ? d.groupId.trim() : "";
  if (!ID_FORM.test(groupId)) throw new Error(`byggPlats: groupId "${groupId}" är inte ett grupp-id.`);
  const befintliga = d.befintliga ?? [];
  const namnFel = platsnamnFel(d.namn, { befintliga });
  if (namnFel) throw new Error(namnFel);
  /** @type {string} */
  let id;
  if (d.id !== undefined && d.id !== null) {
    const idFel = platsidFel(d.id);
    if (idFel) throw new Error(idFel);
    id = String(d.id);
    // ⛔ ETT ID SOM FINNS ÄR ETT ANNAT ÄN ETT NYTT: samma nyckel hade skrivit över platsen (create är set), så anroparen får veta det i stället.
    if (befintliga.some((p) => p.id === id)) throw new Error(`Det finns redan en plats med id:t ${id} i gruppen.`);
  } else {
    id = harledPlatsId(d.namn, befintliga.map((p) => p.id));
  }
  const skapadAv = byggSkapare(/** @type {any} */ (d.skapadAv));
  if (!skapadAv.uid) throw new Error("byggPlats: platsen saknar vem som skapade den.");
  if (skapadAv.typ !== "manniska") throw new Error("byggPlats: en plats skapas av en medlem, och typen på skaparen är manniska.");
  const skapad = d.skapad ?? Date.now();
  if (!Number.isInteger(skapad)) throw new Error("byggPlats: skapad ska vara ett heltal, millisekunder.");
  return {
    nyckel: platsnyckel(groupId, id),
    id,
    plats: platsBibliotek(groupId, id),
    rad: { groupId, namn: trimSomRegeln(d.namn), skapadAv, skapad, arkiverad: false },
  };
}

/**
 * Är platsen förvaltad av en modul? Då ändras namn och arkivering av servern, aldrig av en klient (reglerna nekar det).
 * @param {Pick<Plats, "forvaltas"> | null | undefined} plats
 * @returns {boolean}
 */
export function arForvaltad(plats) {
  return Boolean(plats && plats.forvaltas);
}

/** @param {unknown} modul @returns {string | null} Skälet till att modul-id:t inte går att använda, eller null. */
function modulFel(modul) {
  if (typeof modul !== "string" || !ID_FORM.test(modul) || modul.length > MAX_FORVALTARE) {
    return `Modulens id "${typeof modul === "string" ? modul : ""}" går inte att använda som förvaltare. Gemener, siffror, bindestreck och understreck, högst ${MAX_FORVALTARE} tecken.`;
  }
  return null;
}

/**
 * Dokumentet för en plats en modul förvaltar, med nyckeln. För SERVERN (Admin SDK, modulens egen funktion): en klient kan inte skriva det (reglerna nekar `forvaltas` vid skapande), så det är den här funktionen
 * och regeln som måste vara överens, och de delar `PLATSFALT_FORVALTAD`, `MAX_PLATSNAMN` och namnprövningen. Allt annat är som `byggPlats`: id från anroparen (projektets tagg) eller härlett ur namnet, ett
 * namn som saknas eller redan finns kastar, och skaparen är en person (den som skapade projektet), aldrig en agent.
 *
 * ⛔ SKÄLET (regel 2): projektets namn och platsens namn får inte kunna säga olika saker. Servern skriver båda i SAMMA transaktion, och `byggForvaltadPlats` och `uppdateraForvaltadPlats` ger raderna den skriver.
 *
 * @param {object} d Som `byggPlats`, plus modulen.
 * @param {string} d.modul Modulens id, till exempel `projekt`. Ramverket känner inte modulen.
 * @param {string} d.groupId
 * @param {string} d.namn
 * @param {Record<string, unknown>} d.skapadAv
 * @param {string} [d.id]
 * @param {number} [d.skapad]
 * @param {ReadonlyArray<{ id: string, namn: string }>} [d.befintliga]
 * @returns {{ nyckel: string, id: string, plats: string, rad: Omit<Plats, "id" | "plats"> & { forvaltas: { modul: string } } }}
 */
export function byggForvaltadPlats(d) {
  const fel = modulFel(d?.modul);
  if (fel) throw new Error(`byggForvaltadPlats: ${fel}`);
  const bygg = byggPlats(d);
  return { ...bygg, rad: { ...bygg.rad, forvaltas: { modul: d.modul } } };
}

/**
 * Ändringen servern skriver på en förvaltad plats: ett nytt namn, arkivering eller båda. Kastar med skälet om platsen inte förvaltas av just den här modulen (en annan modul, eller ingen), om namnet inte går att
 * använda (tomt, för långt, ett namn som en annan plats i gruppen redan har) eller om ingenting ändras. Svarar bara med de fält som ändras, så att servern kan skriva dem med en `update` i samma transaktion som projektet.
 *
 * @param {object} d
 * @param {Pick<Plats, "id" | "groupId" | "forvaltas">} d.plats Platsen som den lästes (`platsFranRad`).
 * @param {string} d.modul Modulen som ändrar. Måste vara platsens förvaltare.
 * @param {string} [d.namn]
 * @param {boolean} [d.arkiverad]
 * @param {ReadonlyArray<{ id: string, namn: string }>} [d.befintliga] Gruppens platser, för namnkrocken.
 * @returns {{ nyckel: string, andring: { namn?: string, arkiverad?: boolean } }}
 */
export function uppdateraForvaltadPlats(d) {
  const fel = modulFel(d?.modul);
  if (fel) throw new Error(`uppdateraForvaltadPlats: ${fel}`);
  if (!d.plats?.forvaltas) throw new Error(`uppdateraForvaltadPlats: platsen ${d.plats?.id} förvaltas inte av någon modul. En fri plats ändras av gruppen, inte av servern.`);
  if (d.plats.forvaltas.modul !== d.modul) {
    throw new Error(`uppdateraForvaltadPlats: platsen ${d.plats.id} förvaltas av modulen "${d.plats.forvaltas.modul}", inte av "${d.modul}".`);
  }
  /** @type {{ namn?: string, arkiverad?: boolean }} */
  const andring = {};
  if (d.namn !== undefined) {
    const namnFel = platsnamnFel(d.namn, { befintliga: d.befintliga ?? [], utom: d.plats.id });
    if (namnFel) throw new Error(namnFel);
    andring.namn = trimSomRegeln(d.namn);
  }
  if (d.arkiverad !== undefined) {
    if (typeof d.arkiverad !== "boolean") throw new Error("uppdateraForvaltadPlats: arkiverad ska vara sant eller falskt.");
    andring.arkiverad = d.arkiverad;
  }
  if (Object.keys(andring).length === 0) throw new Error("uppdateraForvaltadPlats: ingenting att ändra. Ange namn eller arkiverad.");
  return { nyckel: platsnyckel(d.plats.groupId, d.plats.id), andring };
}

/**
 * En plats ur en lagrad rad, eller `null` när raden inte är en plats (fel nyckel, fel grupp, ett namn utan innehåll). Ett fel är aldrig tyst: `lasPlatser` samlar dem i `trasiga`.
 *
 * @param {Record<string, any>} rad Raden som den kom ur källan, med `id` = nyckeln.
 * @returns {{ plats: Plats } | { fel: string }}
 */
export function platsFranRad(rad) {
  if (!rad || typeof rad !== "object") return { fel: "Raden saknas." };
  const nyckel = typeof rad.id === "string" ? rad.id : "";
  const [g, i, ...rest] = nyckel.split(PLATSNYCKEL_AVGRANSARE);
  if (rest.length > 0 || !ID_FORM.test(g ?? "") || !PLATSIDFORM.test(i ?? "")) return { fel: `Nyckeln "${nyckel}" är ingen plats (grupp, ${PLATSNYCKEL_AVGRANSARE} och plats-id krävs).` };
  if (rad.groupId !== g) return { fel: `Raden ${nyckel} säger grupp "${rad.groupId}", och nyckeln säger "${g}".` };
  if (!trimSomRegeln(rad.namn) || String(rad.namn).length > MAX_PLATSNAMN) return { fel: `Raden ${nyckel} har inget användbart namn.` };
  return {
    plats: {
      id: i,
      groupId: g,
      plats: platsBibliotek(g, i),
      namn: trimSomRegeln(rad.namn),
      skapadAv: byggSkapare(rad.skapadAv ?? {}),
      skapad: Number.isInteger(rad.skapad) ? rad.skapad : 0,
      arkiverad: rad.arkiverad === true,
      // ⛔ FAIL CLOSED: ett `forvaltas` som finns men är trasigt räknas som förvaltat (med modul ""), inte som fritt. En plats som ser fri ut och nekas vid tryck är sämre än en som säger att den sköts någon annanstans.
      ...(rad.forvaltas !== undefined && rad.forvaltas !== null
        ? { forvaltas: { modul: typeof rad.forvaltas?.modul === "string" ? rad.forvaltas.modul : "" } }
        : {}),
    },
  };
}

/**
 * Raderna som platser, och de som inte gick att läsa. Tomt är ett svar: `{ platser: [], trasiga: [] }` säger att gruppen inte har några egna platser, och en trasig rad syns i `trasiga` i stället för att tystas.
 *
 * @param {ReadonlyArray<Record<string, any>>} rader
 * @returns {{ platser: Plats[], trasiga: { id: string, fel: string }[] }}
 */
export function lasPlatser(rader) {
  /** @type {Plats[]} */
  const platser = [];
  /** @type {{ id: string, fel: string }[]} */
  const trasiga = [];
  for (const rad of rader ?? []) {
    const svar = platsFranRad(rad);
    if ("plats" in svar) platser.push(svar.plats);
    else trasiga.push({ id: String(rad?.id ?? ""), fel: svar.fel });
  }
  platser.sort((a, b) => a.namn.localeCompare(b.namn, "sv") || a.id.localeCompare(b.id));
  return { platser, trasiga };
}

/**
 * Platserna som val i växlaren och i Flytta-menyn (`platser` och `grupper` på `OpsBibliotek`): `{ id: plats, namn }`, utan de arkiverade, sorterade på namn. Appen lägger dem efter gruppens egen plats och Mitt bibliotek.
 *
 * @param {ReadonlyArray<Plats>} platser
 * @returns {{ id: string, namn: string }[]}
 */
export function platsval(platser) {
  return platser.filter((p) => !p.arkiverad).map((p) => ({ id: p.plats, namn: p.namn }));
}

/**
 * Får den här personen byta namn på och arkivera platsen? Samma villkor som regelns `update`: den som skapade den, eller ägare och admin i gruppen, båda som aktiva medlemmar. `jag` är medlemskapet i
 * platsens grupp, eller `null`. Ett utelämnat värde är "vet inte" och ger nej: en knapp som nekas vid tryck är värre än ingen knapp.
 *
 * ⛔ EN FÖRVALTAD PLATS ÄNDRAS INTE AV EN KLIENT (0.155.0): svaret är nej oavsett roll, eftersom reglerna nekar det. Servern (modulens egen funktion) ändrar den.
 *
 * @param {Pick<Plats, "groupId" | "skapadAv" | "forvaltas">} plats
 * @param {{ uid?: string | null, roll?: string, groupId?: string, status?: string, typ?: string } | null | undefined} jag
 * @returns {boolean}
 */
export function farAndraPlats(plats, jag) {
  if (!plats || !jag || typeof jag.uid !== "string" || !jag.uid) return false;
  if (plats.forvaltas) return false;
  if (jag.status !== undefined && jag.status !== "aktiv") return false;
  if (jag.groupId !== undefined && jag.groupId !== plats.groupId) return false;
  if (jag.typ !== undefined && jag.typ !== "person") return false;
  if (plats.skapadAv?.uid === jag.uid) return true;
  return jag.roll === "agare" || jag.roll === "admin";
}
