/**
 * Samtalsmodellen: gruppchatt, privata meddelanden och Assistent-tråden som EN modell (0.34.0, #182, #185).
 *
 * ══ ⛔ VARFÖR EN MODELL OCH INTE TRE (CP 2026-09-30) ═══════════════════════════════════════════════
 *
 * #182 (beslutat 2026-09-30 08:12) bygger privata meddelanden till en person. #185 bygger "Chat" med en
 * Assistent-tråd. Arkitektens second opinion på #185, punkt 1: "Görs de var för sig blir det tre ytor för
 * samma sak, och två sanningar för vad ett meddelande är." CP:s beslut 4 samma dag: chatt, meddelanden och
 * Assistent-tråden är EN modell och byggs en gång.
 *
 *   - Ett SAMTAL har ett `slag`: `grupp` (gruppens chatt, alla aktiva medlemmar), `personer` (privat, exakt
 *     två deltagare) eller `agent` (en person och en medlem av typen `agent`, platsen för #185).
 *   - Ett MEDDELANDE ligger i sitt samtal och bär bara `text`, `av` och `tid`. Vem som får läsa det avgörs av
 *     samtalet, aldrig av en kopia av deltagarlistan på meddelandet (arbetsreglernas punkt 2).
 *   - LÄST-STATUS är en rad per person och samtal med `lastTill` (en tid). Antalet olästa räknas fram ur
 *     meddelandena, det lagras aldrig (punkt 2: en räknare och meddelandena glider isär första gången en
 *     skrivning lyckas och den andra inte).
 *
 * ══ ⛔ NYCKELN HÄRLEDS, DEN SKRIVS INTE ═════════════════════════════════════════════════════════════
 *
 * Högst ett privat samtal per par och grupp. Det löses med nyckeln, inte med en fråga "finns det redan ett?"
 * före skrivningen (punkt 2: unikhet med riktiga constraints, aldrig en läs-sedan-skriv-kontroll). Nyckeln är
 * `<groupId>|<uid>|<uid>` med de två uid:na SORTERADE, så att A skriver till B och B skriver till A landar i
 * samma dokument. Regeln kräver exakt den nyckeln vid skapelse, och en andra skapelse av samma nyckel är en
 * uppdatering, som regeln nekar. Gruppchatten har nyckeln `<groupId>|grupp`: en per grupp av samma skäl.
 *
 * ⛔ TVÅ DELTAGARE, INTE N (0.34.0). Regelspråket har ingen `join`, så en nyckel av N sorterade uid:n går inte
 * att kontrollera i regeln, och en nyckel regeln inte kan kontrollera är en unikhet som bara klienten lovar.
 * Deltagarna är ändå en LISTA, så att ett samtal med fler personer senare är en ändring av regeln och inte
 * av datamodellen.
 *
 * ⛔ `personer` OCH `agent` DELAR NYCKELFORM, OCH DE KAN INTE KROCKA. I `personer` är båda deltagarna av typen
 * `person`, i `agent` är den ena av typen `agent`. Paret avgör alltså slaget, och samma nyckel kan aldrig bära
 * två slag.
 *
 * ══ ⛔ INGET `senast` PÅ SAMTALET (avvikelse från förslaget i uppdraget, mätt) ════════════════════════
 *
 * Förslaget hade `senast` (tid och utdrag av senaste meddelandet) på samtalet. Det är samma uppgift två gånger:
 * det senaste meddelandet finns redan, i samtalet. Inkorgen måste dessutom läsa meddelandena ändå för att RÄKNA
 * olästa, eftersom räknaren inte lagras. Ett `senast` hade alltså sparat noll läsningar och lagt till en skrivning
 * per meddelande som kan misslyckas för sig, och ett fält som vem som helst i gruppchatten kan skriva om (ett
 * falskt utdrag) med en regel som bara kan kontrollera formen. Utdraget härleds i stället, se `utdrag`.
 * Växer volymen så att det blir dyrt är rätt plats en server som skriver fältet (Admin SDK), inte klienten.
 */

/** Samtalens slag. */
export const SAMTALSSLAG = /** @type {const} */ (["grupp", "personer", "agent"]);

/** Fälten ett samtal får bära. `deltagare` bara för `personer` och `agent`. */
export const SAMTALSFALT = /** @type {const} */ (["groupId", "slag", "deltagare", "skapad", "skapadAv"]);

/** Fälten ett meddelande får bära. */
export const MEDDELANDEFALT = /** @type {const} */ (["text", "av", "tid"]);

/** Fältet på läst-raden. */
export const LASTFALT = /** @type {const} */ (["lastTill"]);

/** Tak för ett meddelandes text, i tecken. Regeln har samma tak, härlett härifrån. */
export const MAX_MEDDELANDE = 4000;

/** Gruppchattens nyckeldel efter gruppen. */
export const GRUPPSAMTAL = "grupp";

/** Avgränsaren i samtalsnyckeln. Samma tecken som i medlemskapets nyckel. */
export const SAMTALSAVGRANSARE = "|";

/** Mottagarens slag på en post (ärende, meddelande). */
export const MOTTAGARSLAG = /** @type {const} */ (["grupp", "person", "agent"]);

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * @param {unknown} uid
 * @param {string} vem
 * @returns {string}
 */
function kravUid(uid, vem) {
  const u = rensa(uid);
  if (!u) throw new Error(`${vem}: ett uid krävs.`);
  if (u.includes(SAMTALSAVGRANSARE)) {
    // ⛔ Ett uid med avgränsaren gör nyckeln tvetydig: "a|b" och "c" ger samma nyckel som "a" och "b|c".
    throw new Error(`${vem}: uid "${u}" innehåller "${SAMTALSAVGRANSARE}", som är nyckelns avgränsare. Nyckeln hade blivit tvetydig.`);
  }
  return u;
}

/**
 * ⛔ Ett groupId med avgränsaren gör nyckeln tvetydig: "g|a" med paret b, c och "g" med "a|b", c. Felet sägs, det faller inte tyst
 * till en nyckel som läses baklänges till fel grupp (0.63.0, #263).
 * @param {string} groupId @param {string} vem
 */
function kravGruppUtanAvgransare(groupId, vem) {
  if (groupId.includes(SAMTALSAVGRANSARE)) {
    throw new Error(`${vem}: groupId "${groupId}" innehåller "${SAMTALSAVGRANSARE}", som är nyckelns avgränsare. Nyckeln hade blivit tvetydig.`);
  }
}

/**
 * Samtalets nyckel, härledd ur gruppen och deltagarna.
 *
 * @param {{ groupId: string, slag: "grupp" | "personer" | "agent", deltagare?: ReadonlyArray<string> }} d
 * @returns {string}
 */
export function samtalsnyckel(d) {
  const groupId = rensa(d?.groupId);
  if (!groupId) throw new Error("samtalsnyckel: groupId krävs. Ett samtal hör alltid till en grupp.");
  kravGruppUtanAvgransare(groupId, "samtalsnyckel");
  if (d.slag === "grupp") return `${groupId}${SAMTALSAVGRANSARE}${GRUPPSAMTAL}`;
  if (d.slag !== "personer" && d.slag !== "agent") {
    throw new Error(`samtalsnyckel: slaget "${d.slag}" finns inte. Giltiga: ${SAMTALSSLAG.join(", ")}.`);
  }
  const par = sorteradePar(d.deltagare, "samtalsnyckel");
  return [groupId, ...par].join(SAMTALSAVGRANSARE);
}

/**
 * @param {unknown} deltagare
 * @param {string} vem
 * @returns {[string, string]}
 */
function sorteradePar(deltagare, vem) {
  if (!Array.isArray(deltagare) || deltagare.length !== 2) {
    throw new Error(`${vem}: exakt två deltagare krävs. Regeln kan bara kontrollera nyckeln för ett par, se filhuvudet i samtal.js.`);
  }
  const a = kravUid(deltagare[0], vem);
  const b = kravUid(deltagare[1], vem);
  if (a === b) throw new Error(`${vem}: samma person två gånger är inget samtal.`);
  // ⛔ Samma jämförelse som regelns `<` på strängar: kodpunktsordning, inte localeCompare.
  return a < b ? [a, b] : [b, a];
}

/**
 * @typedef {object} Samtal
 * @property {string} id
 * @property {string} groupId
 * @property {"grupp" | "personer" | "agent"} slag
 * @property {ReadonlyArray<string>} [deltagare] Sorterade. Bara `personer` och `agent`.
 * @property {number} skapad Millisekunder sedan 1970.
 * @property {string} skapadAv
 */

/**
 * Bygger ett samtal, eller kastar med skälet.
 *
 * @param {{ groupId: string, slag: string, deltagare?: ReadonlyArray<string>, skapad?: number, skapadAv: string }} d
 * @returns {Samtal}
 */
export function byggSamtal(d) {
  const groupId = rensa(d?.groupId);
  if (!groupId) throw new Error("byggSamtal: groupId krävs.");
  const slag = rensa(d.slag);
  if (!(/** @type {readonly string[]} */ (SAMTALSSLAG).includes(slag))) {
    throw new Error(`byggSamtal: slaget "${d.slag}" finns inte. Giltiga: ${SAMTALSSLAG.join(", ")}.`);
  }
  const skapadAv = kravUid(d.skapadAv, "byggSamtal");
  const skapad = d.skapad ?? Date.now();
  if (!Number.isInteger(skapad)) throw new Error("byggSamtal: skapad är millisekunder, ett heltal.");
  if (slag === "grupp") {
    if (d.deltagare !== undefined) {
      throw new Error("byggSamtal: gruppchatten har inga deltagare. Alla aktiva medlemmar deltar, och en lista hade varit en andra sanning om vilka det är.");
    }
    const s = { groupId, slag: /** @type {const} */ ("grupp"), skapad, skapadAv };
    return Object.freeze({ id: samtalsnyckel(s), ...s });
  }
  const deltagare = sorteradePar(d.deltagare, "byggSamtal");
  if (!deltagare.includes(skapadAv)) {
    throw new Error("byggSamtal: den som skapar ett privat samtal måste vara en av deltagarna.");
  }
  const s = { groupId, slag: /** @type {"personer" | "agent"} */ (slag), deltagare: Object.freeze(deltagare), skapad, skapadAv };
  return Object.freeze({ id: samtalsnyckel(s), ...s });
}

/**
 * @typedef {object} Meddelande
 * @property {string} [id]
 * @property {string} text
 * @property {string} av Avsändarens uid.
 * @property {number} tid Millisekunder sedan 1970.
 */

/**
 * Bygger ett meddelande, eller kastar med skälet.
 *
 * @param {{ text: string, av: string, tid?: number }} d
 * @returns {Meddelande}
 */
export function byggMeddelande(d) {
  const text = rensa(d?.text);
  if (!text) throw new Error("byggMeddelande: texten är tom. Ett tomt meddelande är en avisering om ingenting.");
  if (text.length > MAX_MEDDELANDE) throw new Error(`byggMeddelande: texten är ${text.length} tecken, taket är ${MAX_MEDDELANDE}.`);
  const av = kravUid(d.av, "byggMeddelande");
  const tid = d.tid ?? Date.now();
  if (!Number.isInteger(tid)) throw new Error("byggMeddelande: tid är millisekunder, ett heltal.");
  return Object.freeze({ text, av, tid });
}

/**
 * Antalet olästa i ett samtal: meddelanden efter `lastTill` som någon ANNAN skrev.
 *
 * ⛔ EGNA MEDDELANDEN ÄR ALDRIG OLÄSTA. Den som just skrev något ska inte få en etta på sin egen ingång.
 *
 * @param {ReadonlyArray<{ av: string, tid: number }>} meddelanden
 * @param {number | null | undefined} lastTill
 * @param {string} uid
 * @returns {number}
 */
export function olastaI(meddelanden, lastTill, uid) {
  const grans = typeof lastTill === "number" ? lastTill : 0;
  let n = 0;
  for (const m of meddelanden ?? []) if (m && m.av !== uid && m.tid > grans) n += 1;
  return n;
}

/**
 * Den andra deltagaren i ett privat samtal, eller `null` i gruppchatten.
 *
 * @param {Pick<Samtal, "slag" | "deltagare">} samtal
 * @param {string} uid
 * @returns {string | null}
 */
export function motpart(samtal, uid) {
  if (!samtal || samtal.slag === "grupp") return null;
  return (samtal.deltagare ?? []).find((d) => d !== uid) ?? null;
}

/**
 * Läser nyckeln baklänges: vilken grupp och vilka deltagare ett samtals id betyder (0.63.0, #263). Inverterar `samtalsnyckel`.
 *
 * ⛔ VARFÖR. Ett valt samtal (ur adressen, eller nyss öppnat med `oppnaPrivat`) ska ritas innan inkorgen hunnit läsa in det.
 * Nyckeln BÄR redan gruppen och paret, eftersom den är härledd ur dem (filhuvudet), så tråden kan ritas på id:t utan en
 * läsning och utan en kopia någonstans. Slaget `personer` eller `agent` avgörs av vem paret är, och det vet bara den som
 * har medlemmarna: därför lämnas det åt anroparen.
 *
 * Med `groupId` (gruppen man läser i) kastar den när gruppen själv bär avgränsaren: då går ingen nyckel i gruppen att läsa
 * baklänges, och det är ett fel i anroparen, inte ett id som inte är ett samtal.
 *
 * @param {unknown} id
 * @param {string | null} [groupId]
 * @returns {{ groupId: string, slag: "grupp" } | { groupId: string, deltagare: [string, string] } | null} `null` när id:t inte är en samtalsnyckel.
 */
export function delaSamtalsnyckel(id, groupId) {
  if (typeof groupId === "string") kravGruppUtanAvgransare(groupId, "delaSamtalsnyckel");
  if (typeof id !== "string") return null;
  const delar = id.split(SAMTALSAVGRANSARE);
  if (delar.some((d) => d.trim() === "" || d !== d.trim())) return null;
  if (delar.length === 2 && delar[1] === GRUPPSAMTAL) return { groupId: delar[0], slag: "grupp" };
  if (delar.length !== 3 || delar[1] === delar[2]) return null;
  // ⛔ Bara en nyckel som `samtalsnyckel` hade kunnat skriva: paret sorterat. Annars är det inget samtals id.
  if (!(delar[1] < delar[2])) return null;
  return { groupId: delar[0], deltagare: [delar[1], delar[2]] };
}

/**
 * Ett kort utdrag av en text, för inkorgens rad och för notisen. Härlett, aldrig lagrat (se filhuvudet).
 *
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
export function utdrag(text, max = 80) {
  const t = rensa(text).replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * @typedef {{ slag: "grupp" } | { slag: "person", uid: string } | { slag: "agent", uid?: string }} Mottagare
 */

/**
 * Bygger en mottagare, eller kastar med skälet (#182).
 *
 * ⛔ FORMEN ÄR RAMVERKETS, SAMLINGEN ÄR APPENS. Appens ärenden ligger i appens samling och appen skriver deras
 * regler. Formen `{ slag, uid? }` är densamma överallt, så att en inkorg som visar "Till mig" läser samma fält
 * oavsett vilken app den står i.
 *
 * Med `medlemmar` (rader ur medlemskapen) prövas också att en person är en aktiv medlem av typen `person` och att
 * en agent med uid är en aktiv medlem av typen `agent`. Utan dem prövas bara formen.
 *
 * @param {unknown} m
 * @param {ReadonlyArray<{ userId: string, typ?: string, status?: string }>} [medlemmar]
 * @returns {Mottagare}
 */
export function byggMottagare(m, medlemmar) {
  const rad = /** @type {Record<string, unknown>} */ (m && typeof m === "object" ? m : {});
  const slag = rensa(rad.slag);
  if (!(/** @type {readonly string[]} */ (MOTTAGARSLAG).includes(slag))) {
    throw new Error(`byggMottagare: slaget "${rad.slag}" finns inte. Giltiga: ${MOTTAGARSLAG.join(", ")}.`);
  }
  const okanda = Object.keys(rad).filter((k) => k !== "slag" && k !== "uid");
  if (okanda.length) throw new Error(`byggMottagare: okända fält ${okanda.join(", ")}. Formen är { slag, uid? }.`);
  if (slag === "grupp") {
    if (rad.uid !== undefined) throw new Error("byggMottagare: en mottagare av slaget grupp har inget uid. Hela gruppen är mottagaren.");
    return Object.freeze({ slag: "grupp" });
  }
  const uid = rad.uid === undefined && slag === "agent" ? "" : rensa(rad.uid);
  if (slag === "person" && !uid) throw new Error("byggMottagare: en mottagare av slaget person kräver uid.");
  if (medlemmar && uid) {
    const typ = slag === "person" ? "person" : "agent";
    const finns = medlemmar.some((x) => x && x.userId === uid && (x.status ?? "aktiv") === "aktiv" && (x.typ ?? "person") === typ);
    if (!finns) throw new Error(`byggMottagare: "${uid}" är inte en aktiv medlem av typen ${typ} i gruppen.`);
  }
  return Object.freeze(slag === "person" ? { slag: "person", uid } : uid ? { slag: "agent", uid } : { slag: "agent" });
}

/*
 * ══ ⛔ TRÅDAR I GRUPPCHATTEN (0.66.0, cllp/lifehub.app#60) ══════════════════════════════════════════════════════
 *
 * CP 2026-10-06: "Vore ju snyggt om gruppen i gruppchatt kan starta en tråd och när som helst blanda in en agent som är
 * med i tråden för alla." Före det fanns ett enda flöde per grupp, och fem spår i samma flöde gav kopplingar mellan
 * spåren som inte hade uppstått om de legat isär. Tråden är GRUPPENS: vem som helst i gruppen startar den ur ett
 * meddelande, och den syns för hela gruppen.
 *
 *   <samtal>/{sid}/<tradar>/{tid}                       tråden: { skapad, skapadAv, namn? }
 *   <samtal>/{sid}/<tradar>/{tid}/<meddelanden>/{mid}    trådens meddelanden, samma form som samtalets
 *
 * ⛔ TRÅDENS NYCKEL ÄR ROTMEDDELANDETS ID, OCH DET FINNS INGET `rot`-FÄLT. Högst en tråd per meddelande kommer ur
 * nyckeln och regeln (en andra skapelse av samma nyckel är en uppdatering, som bara får röra namnet), inte ur en fråga
 * "finns det redan en?" före skrivningen. Ett `rot` bredvid hade varit samma uppgift två gånger.
 *
 * ⛔ INGET `groupId` PÅ TRÅDEN. Den ligger under sitt samtal, och samtalet bär gruppen: samma skäl som för meddelandena.
 *
 * ⛔ BARA I GRUPPCHATTEN. Ett privat samtal har två läsare och ingen publik, och en tråd där hade varit en tråd utan grupp.
 *
 * ⛔ INGET LÄSMÄRKE OCH INGEN NOTIS PER TRÅD I FÖRSTA SKIVAN (beslut 2026-10-06, regel 13). Märket under meddelandet visar
 * antal svar. Ett läsmärke per tråd hade varit en samling till, en läsning till per tråd i inkorgen och en regel till, för
 * ett behov ingen ännu har sett.
 *
 * ══ ⛔ NAMNET HÄRLEDS, DET LAGRAS BARA NÄR NÅGON DÖPER OM ═══════════════════════════════════════════════════════
 *
 * En enkel regel, inte ett modellanrop. Rotmeddelandet ÄR frågan, så regeln ger ett begripligt namn direkt och kostar
 * ingenting; ett modellanrop hade tagit en plats ur agentens dygnskvot för varje tråd, också i grupper som aldrig nämner
 * agenten, och tråden hade stått namnlös tills svaret kom. Ett lagrat automatiskt namn hade varit en andra sanning om
 * rotmeddelandet. `namn` på tråden betyder därför bara en sak: en person döpte om den. Tas det bort gäller det härledda.
 *
 * ⛔ EN REGEL, ETT HEM. Vyn och appens agent (node-delen) läser samma funktion, så att agenten och personerna kallar
 * tråden samma sak.
 */

/** Fälten en tråd får bära. `namn` bara när en person döpt om den. */
export const TRADFALT = /** @type {const} */ (["skapad", "skapadAv", "namn"]);

/** Tak för ett namn, i tecken. Regeln har samma tak, härlett härifrån. */
export const MAX_TRADNAMN = 80;

/** Hur långt ett härlett namn blir innan det kortas vid ett ordslut. */
export const AUTONAMN_LANGD = 60;

/** Kortare än så säger ett rotmeddelande för lite, och nästa meddelande tas med. */
export const AUTONAMN_MINST = 16;

/** Namnet när inget meddelande har någon text kvar efter rensningen. Utskrivet, inte tomt (punkt 5). */
export const NAMNLOS_TRAD = "Tråd utan text";

/**
 * Ett meddelandes text som en bit av ett namn: första raden med innehåll, utan @-nämnanden, länkar och markdowntecken.
 * @param {unknown} text
 * @returns {string}
 */
export function rensaForNamn(text) {
  if (typeof text !== "string") return "";
  const rad = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .map((r) => r.replace(/https?:\/\/\S+/giu, ""))
    .map((r) => r.replace(/(^|\s)@[\p{L}\p{N}_.-]+/gu, "$1"))
    .map((r) => r.replace(/[*_`#>~]+/g, ""))
    .map((r) => r.replace(/^[\s,.:;!?-]+/u, "").replace(/\s+/g, " ").trim())
    .find((r) => r.length > 0);
  if (!rad) return "";
  return rad.charAt(0).toLocaleUpperCase("sv") + rad.slice(1);
}

/** @param {string} text @param {number} max */
function kortaVidOrd(text, max) {
  if (text.length <= max) return text;
  const bit = text.slice(0, max - 1);
  const slut = bit.lastIndexOf(" ");
  // ⛔ Ett enda långt ord kortas mitt i ordet hellre än att namnet blir tomt.
  return `${(slut > max / 2 ? bit.slice(0, slut) : bit).replace(/[\s,.:;]+$/u, "")}…`;
}

/**
 * Trådens härledda namn ur de första meddelandena, rotmeddelandet först.
 *
 * @param {ReadonlyArray<{ text?: unknown }>} meddelanden Rotmeddelandet och sedan trådens meddelanden, äldst först.
 * @returns {string}
 */
export function autonamn(meddelanden) {
  /** @type {string[]} */
  const delar = [];
  for (const m of Array.isArray(meddelanden) ? meddelanden : []) {
    const bit = rensaForNamn(m?.text);
    if (!bit) continue;
    delar.push(bit);
    if (delar.join(" / ").length >= AUTONAMN_MINST) break;
  }
  if (!delar.length) return NAMNLOS_TRAD;
  return kortaVidOrd(delar.join(" / "), AUTONAMN_LANGD);
}

/**
 * Namnet som visas: det en person satte, annars det härledda.
 *
 * @param {{ namn?: unknown } | null | undefined} trad
 * @param {ReadonlyArray<{ text?: unknown }>} meddelanden
 * @returns {string}
 */
export function tradensNamn(trad, meddelanden) {
  const satt = typeof trad?.namn === "string" ? trad.namn.trim() : "";
  return satt ? satt.slice(0, MAX_TRADNAMN) : autonamn(meddelanden);
}

/**
 * @typedef {object} Trad
 * @property {string} id Rotmeddelandets id.
 * @property {number} skapad
 * @property {string} skapadAv
 * @property {string} [namn] Bara när en person döpt om tråden.
 */

/**
 * Bygger en ny tråd, eller kastar med skälet.
 *
 * @param {{ rot: string, skapadAv: string, skapad?: number, namn?: string | null }} d
 * @returns {Trad}
 */
export function byggTrad(d) {
  const rot = rensa(d?.rot);
  if (!rot) throw new Error("byggTrad: rot krävs, id:t på meddelandet tråden startas ur. Det är trådens nyckel.");
  if (rot.includes("/")) throw new Error(`byggTrad: rot "${rot}" är inget dokument-id.`);
  const skapadAv = kravUid(d.skapadAv, "byggTrad");
  const skapad = d.skapad ?? Date.now();
  if (!Number.isInteger(skapad)) throw new Error("byggTrad: skapad är millisekunder, ett heltal.");
  const namn = kravTradnamn(d.namn, "byggTrad");
  return Object.freeze({ id: rot, skapad, skapadAv, ...(namn ? { namn } : {}) });
}

/**
 * Ett namn en person satt, eller `null` för att gå tillbaka till det härledda. Kastar när det är för långt.
 * @param {unknown} namn @param {string} vem
 * @returns {string | null}
 */
export function kravTradnamn(namn, vem = "kravTradnamn") {
  if (namn === null || namn === undefined) return null;
  if (typeof namn !== "string") throw new Error(`${vem}: namnet är text.`);
  const n = namn.trim().replace(/\s+/g, " ");
  if (!n) return null;
  if (n.length > MAX_TRADNAMN) throw new Error(`${vem}: namnet är ${n.length} tecken, taket är ${MAX_TRADNAMN}.`);
  return n;
}
