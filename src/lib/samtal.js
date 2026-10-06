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
