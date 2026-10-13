/**
 * Beskrivna appar, byggsätt A (beslut 0005, lifehub.app#213): en app är en BESKRIVNING, och motorn ritar och sparar den.
 *
 * ══ ⛔ VARFÖR EN BESKRIVNING OCH INTE KOD (beslut 0005) ═════════════════════
 *
 * CP 2026-10-13: "Nu skall vi skapa funktionen för att bygga appar från agenten under natten." Agenten ska kunna bygga en
 * app åt en grupp. Skriver den kod körs koden som den inloggade personen, och en slarvig eller lurad agent öppnar då
 * gruppens data. En beskrivning är data: den kan bara be motorn om listor och fält ur en fast uppsättning, och motorn
 * bestämmer vad som får hända. Därför har formatet en sluten lista av fälttyper, och ett okänt fält är ett fel och inte
 * något som tyst släpps igenom (`modul.js`, "MANIFESTET ÄR DATA").
 *
 * ══ ⛔ FELEN ÄR SKRIVNA FÖR EN AGENT SOM SKA RÄTTA SIG ═══════════════════════
 *
 * `validateBeskrivning` samlar ALLA fel, inte det första, och varje fel börjar med sökvägen i beskrivningen
 * (`listor[0].falt[2].typ: ...`) och säger vad som är giltigt. Agenten får svaret som verktygsresultat och försöker igen:
 * ett fel som bara säger "ogiltig" kostar ett varv per fel, ett som säger vad som gäller kostar ett varv totalt.
 *
 * ══ ⛔ EN SANNING FÖR TAKEN ══════════════════════════════════════════════════
 *
 * Taken bor här. Regelfragmenten (`beskrivenappdataregelfragment`, `beskrivningsregelfragment`) och valideringen läser
 * samma konstanter, så en regel och en prövning inte kan säga olika om hur stort något får vara.
 *
 * ══ ⛔ RADENS VÄRDEN PRÖVAS HÄR OCH INTE I REGELN ═══════════════════════════
 *
 * En regel kan inte veta vilken beskrivning en rad hör till utan ett `get()` per skrivning, och beslut 0005 säger att
 * regeln är EN för all appdata: gruppens aktiva medlemmar. Regeln låser därför formen (rätt fält, rätt grupp, rätt
 * storlek) och `validateRad` låser innehållet i klienten och på servern. Den som skriver förbi klienten kan lägga ett
 * felaktigt värde i en rad i sin egen grupp, och vyn visar då värdet som text i stället för att kasta (se
 * `OpsBeskrivenApp`). Det är medvetet: skulle regeln hämta beskrivningen vore varje apps regel beroende av ett annat
 * dokument, och det är precis det "permissions-träsk" beslut 0005 undviker.
 *
 * ⛔ FILEN ÄR REN och ligger därför i båda ingångarna (`ops-framework/node`): appens Cloud Functions validerar en
 * beskrivning med exakt samma funktion som klienten. Ingen React, ingen databas.
 */

import { ADRESSFORM } from "./bibliotek.js";
import { GRUPPIKONKATALOG } from "./gruppikonkatalog.generated.js";
import { VANLIGA_GRUPPIKONER, sokGruppikoner } from "./gruppikonsok.js";
import { modulinstallningsId } from "./modulinstallningar.js";
import { MAX_UIDLANGD } from "./samtal.js";
import { byggSkapare } from "./skapare.js";

/** Formatets version. Ett nytt format får ett nytt tal, och `validateBeskrivning` avvisar det den inte känner. */
export const BESKRIVNINGSFORMAT = 1;

/** Fälttyperna i format 1. Slutna: en agent kan inte hitta på en egen. */
export const FALTTYPER = /** @type {const} */ (["text", "langtext", "tal", "datum", "val", "janej", "lank", "person"]);

/**
 * Fält-id som är upptagna. `id` är radens egen nyckel: tabellen nycklar raden på `row.id`, och ett fält med id `id` skrev över den
 * (dubbla nycklar, granskningen av 0.99.0). Bara `id` är upptaget: `constructor` och de andra nycklarna på ett objekt är giltiga id,
 * eftersom vyn och prövningen läser dem med `Object.hasOwn` och aldrig rakt ur objektet.
 */
export const RESERVERADE_FALTID = /** @type {const} */ (["id"]);

/** Hur en lista visas. `lista` är förvalet. */
export const VISNINGAR = /** @type {const} */ (["lista", "tabell"]);

/**
 * Formen på ett id: appens, en listas och ett fälts. Små bokstäver, siffror och bindestreck, börjar med en bokstav, 2 till 40 tecken.
 * Delmängd av `ID_FORM`, så ett app-id går att använda i dokumentets id (`beskrivningsId`) utan att tilde-delningen blir tvetydig.
 * Regeln skriver samma uttryck via `regelRegex`.
 */
export const BESKRIVNINGSIDFORM = /^[a-z][a-z0-9-]{1,39}$/;

/** Tak. Samma tal skrivs in i regelfragmenten, ur de här konstanterna. */
export const MAX_BESKRIVNINGSNAMN = 60;
export const MAX_APPBESKRIVNING = 500;
export const MIN_LISTOR = 1;
export const MAX_LISTOR = 5;
export const MIN_FALT = 1;
export const MAX_FALT = 20;
export const MIN_VAL = 2;
export const MAX_VAL = 30;
export const MAX_VALTEXT = 60;
/** Värdenas tak i en rad. */
export const MAX_TEXTVARDE = 200;
export const MAX_LANGTEXTVARDE = 4000;
export const MAX_LANKVARDE = 2000;

/** Fälten beskrivningen får bära. Allt annat är ett fel. */
export const BESKRIVNINGSFALT = /** @type {const} */ (["format", "id", "namn", "ikon", "beskrivning", "listor"]);
/** Fälten en lista får bära. */
export const LISTFALT = /** @type {const} */ (["id", "namn", "falt", "rubrikfalt", "visning"]);
/** Fälten ett fält får bära. */
export const FALTFALT = /** @type {const} */ (["id", "namn", "typ", "krav", "val"]);

/**
 * Fälten en rad bär i databasen, för regelns `hasOnly`. `id` är dokumentets nyckel och står inte här.
 * `varden` är en map från fältets id till värdet.
 */
export const BESKRIVENAPPDATAFALT = /** @type {const} */ (["groupId", "appId", "lista", "varden", "skapadAv", "skapad", "andrad"]);

/**
 * Fälten ett beskrivningsdokument bär. Appens id står inte som ett eget fält: det är `beskrivning.id`, och dokumentets id
 * härleds ur det (`beskrivningsId`). En kopia av id:t vid sidan av hade varit en andra sanning (arbetsreglernas punkt 2).
 */
export const BESKRIVNINGSDOKUMENTFALT = /** @type {const} */ (["groupId", "beskrivning", "skapadAv", "skapad", "andrad"]);

/** Antal fel som skrivs ut. Resten räknas, så en agent som skickar skräp inte får ett svar på tusen rader. */
const MAX_FEL = 25;

const IKONNAMN = new Set(GRUPPIKONKATALOG.map((i) => i.namn));

/**
 * Dokumentets id för en beskrivning: längden på gruppens id i bas 36, gruppen och appen, skilda av `~`.
 * Samma schema som `modulinstallningsId`, och samma skäl: ett id som bär gruppen kan inte hamna på en annan grupps plats,
 * och regeln binder id:t till kroppen. Funktionen ÄR `modulinstallningsId`: ett schema, inte två.
 *
 * @param {string} groupId
 * @param {string} appId
 * @returns {string}
 */
export function beskrivningsId(groupId, appId) {
  return modulinstallningsId(groupId, appId);
}

/** @param {unknown} v @returns {boolean} */
const arObjekt = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Vad värdet ÄR, i ett ord agenten förstår.
 * @param {unknown} v
 * @returns {string}
 */
function typnamn(v) {
  if (v === undefined) return "inget värde";
  if (v === null) return "null";
  if (Array.isArray(v)) return "en lista";
  if (typeof v === "string") return "text";
  if (typeof v === "number") return "ett tal";
  if (typeof v === "boolean") return "sant eller falskt";
  if (typeof v === "object") return "ett objekt";
  return typeof v;
}

/**
 * Värdet som det skrivs i ett felmeddelande, kortat.
 * @param {unknown} v
 * @returns {string}
 */
function visa(v) {
  let s;
  try {
    s = typeof v === "string" ? JSON.stringify(v) : String(JSON.stringify(v));
  } catch {
    s = String(v);
  }
  return s.length > 40 ? `${s.slice(0, 37)}...` : s;
}

// Styrtecken: allt under mellanslag och DEL. Radbrytning släpps in där flera rader är meningen (`beskrivning`, `langtext`).
const STYRTECKEN = /[\u0000-\u001f\u007f]/;
const STYRTECKEN_UTOM_RADBRYTNING = /[\u0000-\u0009\u000b-\u001f\u007f]/;

/**
 * Prövar att något är text av rätt längd, och ger den trimmade texten, eller `null` med felet inskrivet.
 *
 * @param {unknown} v
 * @param {string} sokvag
 * @param {string[]} fel
 * @param {{ min: number, max: number, radbrytning?: boolean, tomtOk?: boolean, krav?: string }} g
 * @returns {string | null}
 */
function textVarde(v, sokvag, fel, g) {
  if (v === undefined) {
    fel.push(`${sokvag}: krävs.${g.krav ? ` ${g.krav}` : ""}`);
    return null;
  }
  if (typeof v !== "string") {
    fel.push(`${sokvag}: måste vara text, inte ${typnamn(v)}.`);
    return null;
  }
  const t = v.trim();
  if (t.length < g.min) {
    fel.push(`${sokvag}: är tom. Skriv ${g.min === 1 ? "minst ett tecken" : `minst ${g.min} tecken`}.`);
    return null;
  }
  if (t.length > g.max) {
    fel.push(`${sokvag}: är för lång, ${t.length} tecken. Högst ${g.max}.`);
    return null;
  }
  if ((g.radbrytning ? STYRTECKEN_UTOM_RADBRYTNING : STYRTECKEN).test(t)) {
    fel.push(`${sokvag}: får inte innehålla ${g.radbrytning ? "styrtecken" : "radbrytning, tabb eller andra styrtecken"}.`);
    return null;
  }
  return t;
}

/**
 * Okända nycklar är fel, med sökvägen till varje.
 *
 * @param {Record<string, unknown>} o
 * @param {ReadonlyArray<string>} tillatna
 * @param {string} prefix Sökvägen till objektet, tom för det yttersta.
 * @param {string[]} fel
 */
function okandaNycklar(o, tillatna, prefix, fel) {
  for (const k of Object.keys(o)) {
    if (!tillatna.includes(k)) {
      fel.push(`${prefix ? `${prefix}.` : ""}${k}: okänt fält. Tillåtna fält: ${tillatna.join(", ")}.`);
    }
  }
}

/**
 * Ett id: slug och unikt bland sina syskon.
 *
 * @param {unknown} v
 * @param {string} sokvag
 * @param {string[]} fel
 * @param {Set<string>} sedda
 * @param {string} vad Vad id:t namnger, för "står två gånger".
 * @returns {string | null}
 */
function idVarde(v, sokvag, fel, sedda, vad) {
  if (v === undefined) {
    fel.push(`${sokvag}: krävs. Ett id med små bokstäver, siffror och bindestreck, till exempel "utlaning".`);
    return null;
  }
  if (typeof v !== "string") {
    fel.push(`${sokvag}: måste vara text, inte ${typnamn(v)}.`);
    return null;
  }
  if (!BESKRIVNINGSIDFORM.test(v)) {
    fel.push(`${sokvag}: ${visa(v)} är inget giltigt id. Använd små bokstäver a-z, siffror och bindestreck, börja med en bokstav, 2 till 40 tecken (till exempel "utlaning" eller "lanad-av").`);
    return null;
  }
  if (sedda.has(v)) {
    fel.push(`${sokvag}: ${vad} ${visa(v)} står två gånger. Varje id ska vara unikt.`);
    return null;
  }
  sedda.add(v);
  return v;
}

/**
 * @typedef {object} Falt
 * @property {string} id
 * @property {string} namn
 * @property {"text"|"langtext"|"tal"|"datum"|"val"|"janej"|"lank"|"person"} typ
 * @property {boolean} krav
 * @property {string[]} [val] Bara på typen `val`.
 */

/**
 * @typedef {object} Lista
 * @property {string} id
 * @property {string} namn
 * @property {Falt[]} falt
 * @property {string} rubrikfalt Id på ett fält av typen `text` i samma lista. Det som står som radens rubrik.
 * @property {"lista"|"tabell"} visning
 */

/**
 * @typedef {object} Beskrivning
 * @property {1} format
 * @property {string} id
 * @property {string} namn
 * @property {string} ikon Ett namn ur gruppikonernas katalog (`GRUPPIKONKATALOG`).
 * @property {string} beskrivning Tom sträng när appen inte har någon.
 * @property {Lista[]} listor
 */

/**
 * @param {unknown} v
 * @param {string} sokvag
 * @param {string[]} fel
 * @param {Set<string>} sedda Fältens id i listan hittills.
 * @returns {Falt | null}
 */
function byggFalt(v, sokvag, fel, sedda) {
  if (!arObjekt(v)) {
    fel.push(`${sokvag}: måste vara ett objekt { ${FALTFALT.join(", ")} }, inte ${typnamn(v)}.`);
    return null;
  }
  const o = /** @type {Record<string, unknown>} */ (v);
  const start = fel.length;
  okandaNycklar(o, FALTFALT, sokvag, fel);
  const id = idVarde(o.id, `${sokvag}.id`, fel, sedda, "fältet");
  if (id !== null && (/** @type {readonly string[]} */ (RESERVERADE_FALTID)).includes(id)) {
    fel.push(`${sokvag}.id: ${visa(id)} är upptaget, det är radens egen nyckel. Välj ett annat id, till exempel ${visa(`${id}-nummer`)}.`);
  }
  const namn = textVarde(o.namn, `${sokvag}.namn`, fel, { min: 1, max: MAX_BESKRIVNINGSNAMN });

  /** @type {Falt["typ"] | null} */
  let typ = null;
  if (o.typ === undefined) fel.push(`${sokvag}.typ: krävs. Giltiga: ${FALTTYPER.join(", ")}.`);
  else if (typeof o.typ !== "string" || !(/** @type {readonly string[]} */ (FALTTYPER)).includes(o.typ)) {
    fel.push(`${sokvag}.typ: okänd typ ${visa(o.typ)}. Giltiga: ${FALTTYPER.join(", ")}.`);
  } else typ = /** @type {Falt["typ"]} */ (o.typ);

  let krav = false;
  if (o.krav !== undefined) {
    if (typeof o.krav !== "boolean") fel.push(`${sokvag}.krav: måste vara true eller false, inte ${typnamn(o.krav)}.`);
    else krav = o.krav;
  }

  /** @type {string[] | undefined} */
  let val;
  if (typ === "val") {
    if (o.val === undefined) {
      fel.push(`${sokvag}.val: krävs för typen val. En lista med ${MIN_VAL} till ${MAX_VAL} alternativ, till exempel ["Bra", "Sliten", "Trasig"].`);
    } else if (!Array.isArray(o.val)) {
      fel.push(`${sokvag}.val: måste vara en lista med alternativ, inte ${typnamn(o.val)}.`);
    } else {
      if (o.val.length < MIN_VAL || o.val.length > MAX_VAL) {
        fel.push(`${sokvag}.val: har ${o.val.length} alternativ. Det ska vara ${MIN_VAL} till ${MAX_VAL}.`);
      }
      /** @type {string[]} */
      const ut = [];
      let helt = o.val.length >= MIN_VAL && o.val.length <= MAX_VAL;
      const unika = new Set();
      o.val.forEach((/** @type {unknown} */ alt, /** @type {number} */ i) => {
        const t = textVarde(alt, `${sokvag}.val[${i}]`, fel, { min: 1, max: MAX_VALTEXT });
        if (t === null) {
          helt = false;
          return;
        }
        if (unika.has(t)) {
          fel.push(`${sokvag}.val[${i}]: ${visa(t)} står två gånger. Varje alternativ ska vara unikt.`);
          helt = false;
          return;
        }
        unika.add(t);
        ut.push(t);
      });
      if (helt) val = ut;
    }
  } else if (o.val !== undefined && typ !== null) {
    fel.push(`${sokvag}.val: hör bara till typen val, inte ${visa(typ)}. Ta bort fältet.`);
  }

  if (fel.length > start || id === null || namn === null || typ === null) return null;
  /** @type {Falt} */
  const ut = { id, namn, typ, krav };
  if (val) ut.val = val;
  return ut;
}

/**
 * @param {unknown} v
 * @param {string} sokvag
 * @param {string[]} fel
 * @param {Set<string>} sedda
 * @returns {Lista | null}
 */
function byggLista(v, sokvag, fel, sedda) {
  if (!arObjekt(v)) {
    fel.push(`${sokvag}: måste vara ett objekt { ${LISTFALT.join(", ")} }, inte ${typnamn(v)}.`);
    return null;
  }
  const o = /** @type {Record<string, unknown>} */ (v);
  const start = fel.length;
  okandaNycklar(o, LISTFALT, sokvag, fel);
  const id = idVarde(o.id, `${sokvag}.id`, fel, sedda, "listan");
  const namn = textVarde(o.namn, `${sokvag}.namn`, fel, { min: 1, max: MAX_BESKRIVNINGSNAMN });

  /** @type {Falt[]} */
  const falt = [];
  /** @type {Map<string, Falt["typ"]>} */
  const typer = new Map();
  if (o.falt === undefined) {
    fel.push(`${sokvag}.falt: krävs. En lista med ${MIN_FALT} till ${MAX_FALT} fält.`);
  } else if (!Array.isArray(o.falt)) {
    fel.push(`${sokvag}.falt: måste vara en lista, inte ${typnamn(o.falt)}.`);
  } else {
    if (o.falt.length < MIN_FALT || o.falt.length > MAX_FALT) {
      fel.push(`${sokvag}.falt: har ${o.falt.length} fält. Det ska vara ${MIN_FALT} till ${MAX_FALT}.`);
    }
    const sedda2 = new Set();
    o.falt.forEach((/** @type {unknown} */ f, /** @type {number} */ i) => {
      const r = byggFalt(f, `${sokvag}.falt[${i}]`, fel, sedda2);
      if (r) {
        falt.push(r);
        typer.set(r.id, r.typ);
      }
    });
  }

  /** @type {string | null} */
  let rubrikfalt = null;
  if (o.rubrikfalt === undefined) {
    fel.push(`${sokvag}.rubrikfalt: krävs. Id på ett fält av typen text i listan, det som står som radens rubrik.`);
  } else if (typeof o.rubrikfalt !== "string") {
    fel.push(`${sokvag}.rubrikfalt: måste vara text (ett fält-id), inte ${typnamn(o.rubrikfalt)}.`);
  } else if (!typer.has(o.rubrikfalt)) {
    // Ett fält som själv har ett fel finns inte i `typer`. Då vore "finns inte" missvisande, så det sägs bara när alla fält är hela.
    const allaHela = Array.isArray(o.falt) && falt.length === o.falt.length;
    if (allaHela) {
      fel.push(`${sokvag}.rubrikfalt: ${visa(o.rubrikfalt)} finns inte bland fälten i listan. Fälten: ${[...typer.keys()].join(", ")}.`);
    }
  } else if (typer.get(o.rubrikfalt) !== "text") {
    fel.push(`${sokvag}.rubrikfalt: ${visa(o.rubrikfalt)} är av typen ${typer.get(o.rubrikfalt)}. Rubrikfältet måste vara av typen text.`);
  } else {
    rubrikfalt = o.rubrikfalt;
  }

  /** @type {Lista["visning"]} */
  let visning = "lista";
  if (o.visning !== undefined) {
    if (typeof o.visning !== "string" || !(/** @type {readonly string[]} */ (VISNINGAR)).includes(o.visning)) {
      fel.push(`${sokvag}.visning: okänd visning ${visa(o.visning)}. Giltiga: ${VISNINGAR.join(", ")}. Utelämnad blir den lista.`);
    } else visning = /** @type {Lista["visning"]} */ (o.visning);
  }

  if (fel.length > start || id === null || namn === null || rubrikfalt === null) return null;
  return { id, namn, falt, rubrikfalt, visning };
}

/**
 * @param {string[]} fel
 * @returns {string[]}
 */
function begransa(fel) {
  if (fel.length <= MAX_FEL) return fel;
  return [...fel.slice(0, MAX_FEL), `...och ${fel.length - MAX_FEL} fel till. Rätta de här först, så visas resten.`];
}

/**
 * Prövar en beskrivning och ger den normaliserad, eller ALLA fel.
 *
 * Normaliserad betyder: texter trimmade, `krav` alltid en boolean, `visning` alltid satt, `val` bara på typen val. Det
 * gör funktionen idempotent: en redan normaliserad beskrivning ger sig själv, så den som sparar kan pröva igen utan att
 * något ändras.
 *
 * @param {unknown} b
 * @returns {{ ok: true, beskrivning: Beskrivning } | { ok: false, fel: string[] }}
 */
export function validateBeskrivning(b) {
  /** @type {string[]} */
  const fel = [];
  if (!arObjekt(b)) {
    return { ok: false, fel: [`beskrivningen: måste vara ett objekt { ${BESKRIVNINGSFALT.join(", ")} }, inte ${typnamn(b)}.`] };
  }
  const o = /** @type {Record<string, unknown>} */ (b);
  okandaNycklar(o, BESKRIVNINGSFALT, "", fel);

  if (o.format === undefined) fel.push(`format: krävs. Skriv talet ${BESKRIVNINGSFORMAT}.`);
  else if (o.format !== BESKRIVNINGSFORMAT) fel.push(`format: måste vara talet ${BESKRIVNINGSFORMAT}, inte ${visa(o.format)}.`);

  const id = idVarde(o.id, "id", fel, new Set(), "appen");
  const namn = textVarde(o.namn, "namn", fel, { min: 1, max: MAX_BESKRIVNINGSNAMN });

  /** @type {string | null} */
  let ikon = null;
  if (o.ikon === undefined) {
    fel.push(`ikon: krävs. Ett ikonnamn ur gruppikonernas katalog, till exempel ${VANLIGA_GRUPPIKONER.slice(0, 5).map((i) => `"${i}"`).join(", ")}.`);
  } else if (typeof o.ikon !== "string") {
    fel.push(`ikon: måste vara text (ett ikonnamn), inte ${typnamn(o.ikon)}.`);
  } else if (!IKONNAMN.has(o.ikon)) {
    const forslag = sokGruppikoner(o.ikon).slice(0, 5);
    const exempel = forslag.length > 0 ? forslag : VANLIGA_GRUPPIKONER.slice(0, 8);
    fel.push(`ikon: okänd ikon ${visa(o.ikon)}. Använd ett namn ur gruppikonernas katalog (GRUPPIKONKATALOG), till exempel ${exempel.map((i) => `"${i}"`).join(", ")}.`);
  } else ikon = o.ikon;

  let text = null;
  if (o.beskrivning === undefined) {
    fel.push('beskrivning: krävs. Skriv "" om appen inte behöver någon beskrivning.');
  } else {
    text = textVarde(o.beskrivning, "beskrivning", fel, { min: 0, max: MAX_APPBESKRIVNING, radbrytning: true });
  }

  /** @type {Lista[]} */
  const listor = [];
  if (o.listor === undefined) {
    fel.push(`listor: krävs. En lista med ${MIN_LISTOR} till ${MAX_LISTOR} listor.`);
  } else if (!Array.isArray(o.listor)) {
    fel.push(`listor: måste vara en lista, inte ${typnamn(o.listor)}.`);
  } else {
    if (o.listor.length < MIN_LISTOR || o.listor.length > MAX_LISTOR) {
      fel.push(`listor: har ${o.listor.length} listor. Det ska vara ${MIN_LISTOR} till ${MAX_LISTOR}.`);
    }
    const sedda = new Set();
    o.listor.forEach((/** @type {unknown} */ l, /** @type {number} */ i) => {
      const r = byggLista(l, `listor[${i}]`, fel, sedda);
      if (r) listor.push(r);
    });
  }

  if (fel.length > 0 || id === null || namn === null || ikon === null || text === null) {
    return { ok: false, fel: begransa(fel) };
  }
  return { ok: true, beskrivning: { format: BESKRIVNINGSFORMAT, id, namn, ikon, beskrivning: text, listor } };
}

/**
 * Är det ett riktigt kalenderdatum på formen ÅÅÅÅ-MM-DD?
 * @param {string} s
 * @returns {boolean}
 */
function arDatum(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [ar, man, dag] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(0);
  d.setUTCFullYear(ar, man - 1, dag);
  return d.getUTCFullYear() === ar && d.getUTCMonth() === man - 1 && d.getUTCDate() === dag;
}

/**
 * Prövar värdet i ett fält. Ger det normaliserade värdet, eller ett skäl.
 *
 * @param {Falt} f
 * @param {unknown} raw
 * @returns {{ varde: string | number | boolean } | { skal: string }}
 */
function faltVarde(f, raw) {
  switch (f.typ) {
    case "text":
    case "langtext": {
      if (typeof raw !== "string") return { skal: `måste vara text, inte ${typnamn(raw)}.` };
      const t = raw.trim();
      const max = f.typ === "text" ? MAX_TEXTVARDE : MAX_LANGTEXTVARDE;
      if (t.length > max) return { skal: `är för lång, ${t.length} tecken. Högst ${max}.` };
      if ((f.typ === "text" ? STYRTECKEN : STYRTECKEN_UTOM_RADBRYTNING).test(t)) {
        return { skal: f.typ === "text" ? "får inte innehålla radbrytning eller andra styrtecken. Använd en lång text för flera rader." : "får inte innehålla styrtecken." };
      }
      return { varde: t };
    }
    case "tal":
      if (typeof raw === "number" && !Number.isFinite(raw)) return { skal: `måste vara ett ändligt tal, inte ${String(raw)}.` };
      if (typeof raw !== "number") return { skal: `måste vara ett tal, inte ${typeof raw === "string" ? visa(raw) : typnamn(raw)}.` };
      return { varde: raw };
    case "datum": {
      if (typeof raw !== "string") return { skal: `måste vara ett datum som text på formen ÅÅÅÅ-MM-DD, inte ${typnamn(raw)}.` };
      const t = raw.trim();
      if (!arDatum(t)) return { skal: `${visa(raw)} är inget datum. Skriv ÅÅÅÅ-MM-DD, till exempel 2026-10-13.` };
      return { varde: t };
    }
    case "val": {
      const alternativ = f.val ?? [];
      if (typeof raw !== "string") return { skal: `måste vara ett av alternativen, inte ${typnamn(raw)}. Alternativ: ${alternativ.join(", ")}.` };
      const t = raw.trim();
      if (!alternativ.includes(t)) return { skal: `${visa(raw)} är inget av alternativen. Alternativ: ${alternativ.join(", ")}.` };
      return { varde: t };
    }
    case "janej":
      if (typeof raw !== "boolean") return { skal: `måste vara sant eller falskt, inte ${typnamn(raw)}.` };
      return { varde: raw };
    case "lank": {
      if (typeof raw !== "string") return { skal: `måste vara en adress som text, inte ${typnamn(raw)}.` };
      const t = raw.trim();
      if (t.length > MAX_LANKVARDE) return { skal: `är för lång, ${t.length} tecken. Högst ${MAX_LANKVARDE}.` };
      if (!ADRESSFORM.test(t)) return { skal: `${visa(raw)} är ingen webbadress. Den ska börja med http:// eller https:// och inte innehålla blanksteg.` };
      return { varde: t };
    }
    case "person": {
      if (typeof raw !== "string") return { skal: `måste vara en persons id som text, inte ${typnamn(raw)}.` };
      const t = raw.trim();
      if (t.length > MAX_UIDLANGD || !/^\S+$/.test(t)) return { skal: `är inget giltigt person-id (högst ${MAX_UIDLANGD} tecken, inga blanksteg).` };
      return { varde: t };
    }
    default:
      return { skal: "har en typ som inte känns igen." };
  }
}

/**
 * Prövar värdena i en rad mot beskrivningen och ger dem normaliserade, eller felen.
 *
 * `faltfel` är samma fel utan sökvägen, per fält-id, så ett formulär kan sätta rätt text på rätt fält. `fel` är samma fel
 * med sökvägen (`varden.namn: krävs.`), för en agent eller en logg. Ett tomt värde (saknas, `null` eller en tom text) är
 * "inget värde": det är ett fel för ett krävt fält och utelämnas annars, så en rad aldrig bär ett tomt fält.
 *
 * ⛔ BESKRIVNINGEN PRÖVAS OM HÄR. Anroparen har oftast redan en normaliserad, men den som bara har en rad och en
 * beskrivning ur databasen ska inte behöva komma ihåg att pröva den först: en beskrivning som inte håller ger ett fel här,
 * inte en tyst godkänd rad mot ett schema ingen har sett.
 *
 * @param {unknown} beskrivning
 * @param {string} listaId
 * @param {unknown} varden
 * @returns {{ ok: true, varden: Record<string, string | number | boolean> } | { ok: false, fel: string[], faltfel: Record<string, string> }}
 */
export function validateRad(beskrivning, listaId, varden) {
  const b = validateBeskrivning(beskrivning);
  if (!b.ok) return { ok: false, fel: [`beskrivningen: är ogiltig. ${b.fel[0]}`], faltfel: {} };
  const lista = b.beskrivning.listor.find((l) => l.id === listaId);
  if (!lista) {
    return { ok: false, fel: [`lista: ${visa(listaId)} finns inte i appen. Listor: ${b.beskrivning.listor.map((l) => l.id).join(", ")}.`], faltfel: {} };
  }
  if (!arObjekt(varden)) {
    return { ok: false, fel: [`varden: måste vara ett objekt med fältens id som nycklar, inte ${typnamn(varden)}.`], faltfel: {} };
  }
  const o = /** @type {Record<string, unknown>} */ (varden);
  /** @type {string[]} */
  const fel = [];
  /** @type {Record<string, string>} */
  const faltfel = {};
  /** @type {(id: string, skal: string) => void} */
  const felPa = (id, skal) => {
    fel.push(`varden.${id}: ${skal}`);
    faltfel[id] = skal;
  };
  const ids = lista.falt.map((f) => f.id);
  for (const k of Object.keys(o)) {
    if (!ids.includes(k)) felPa(k, `okänt fält i listan ${visa(lista.id)}. Fälten: ${ids.join(", ")}.`);
  }
  /** @type {Record<string, string | number | boolean>} */
  const ut = {};
  for (const f of lista.falt) {
    const raw = Object.hasOwn(o, f.id) ? o[f.id] : undefined;
    const tomt = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "" && f.typ !== "janej");
    if (tomt) {
      if (f.krav) felPa(f.id, "krävs.");
      continue;
    }
    const r = faltVarde(f, raw);
    if ("skal" in r) felPa(f.id, r.skal);
    else ut[f.id] = r.varde;
  }
  if (fel.length > 0) return { ok: false, fel: begransa(fel), faltfel };
  return { ok: true, varden: ut };
}

/**
 * Beskrivningsdokumentet som skrivs i databasen, och dess id. Klienten (`createBeskrivningskalla`) och en server med Admin
 * SDK (appens `skapaApp`) bygger dokumentet här, så formen inte kan glida isär.
 *
 * Kastar med alla fel om beskrivningen inte håller. `skapadAv` går genom `byggSkapare`.
 *
 * @param {{ groupId: string, beskrivning: unknown, skapadAv: { uid?: string | null, namn?: string, typ?: string, kalla?: string }, skapad: number, andrad?: number }} d
 * @returns {{ id: string, data: { groupId: string, beskrivning: Beskrivning, skapadAv: import("./skapare.js").Skapare, skapad: number, andrad: number } }}
 */
export function byggBeskrivningsdokument(d) {
  const r = validateBeskrivning(d.beskrivning);
  if (!r.ok) throw new Error(`byggBeskrivningsdokument: beskrivningen håller inte.\n${r.fel.join("\n")}`);
  if (typeof d.groupId !== "string" || !d.groupId.trim()) throw new Error("byggBeskrivningsdokument: groupId krävs.");
  if (!Number.isFinite(d.skapad)) throw new Error("byggBeskrivningsdokument: skapad krävs, millisekunder.");
  const groupId = d.groupId.trim();
  return {
    id: beskrivningsId(groupId, r.beskrivning.id),
    data: {
      groupId,
      beskrivning: r.beskrivning,
      skapadAv: byggSkapare(d.skapadAv),
      skapad: d.skapad,
      andrad: d.andrad ?? d.skapad,
    },
  };
}
