/**
 * Vem som skapade en post.
 *
 * ══ ⛔ VARFÖR EN E-POSTADRESS INTE ÄR EN IDENTITET ══════════════════════
 *
 * Fältet `skapadAv` bar en fri sträng, och tre olika sorters värde hamnade i
 * det. Mätt i bolag-ops 2026-09-25: klienten skrev `user.email`, agenten skrev
 * `"ops-agent"`, och mätbygget skrev `"matning@example.invalid"`.
 *
 * En adress går att byta. Den säger ingenting om huruvida skribenten var en
 * människa eller ett jobb. Och framför allt: den går inte att kontrollera i en
 * Firestore-regel, eftersom regeln bara har `request.auth.uid` att jämföra med.
 * Så länge fältet är en sträng är det ett PÅSTÅENDE, och en identitet som bara
 * är ett påstående är värdelös i precis det ögonblick den behövs.
 *
 * ══ ⛔ FYRA FÄLT, OCH VARFÖR INGET AV DEM GÅR ATT HÄRLEDA ══════════════
 *
 *   uid    Firebase Auth-uid, eller null för en skrivare utan inloggning.
 *          Det ENDA reglerna kan jämföra mot.
 *   namn   Det som visas. Ingen vy ska rita ett uid.
 *   typ    "manniska", "agent" eller "okand".
 *   kalla  Vilket jobb eller vilken vy som skrev.
 *
 * ⛔ `typ` HÄRLEDS INTE UR `uid`. Frestelsen är att säga "uid finns, alltså en
 * människa". Det går sönder i båda riktningarna: en agent kan få ett eget konto
 * (det är till och med den väg som föreslås i cllp/bolag-ops#376), och en
 * människa kan skrivas in av ett importskript. Ett fält som ibland gissar är
 * sämre än ett fält som alltid frågar.
 *
 * ⛔ `okand` FINNS OCH ÄR INTE ETT FEL. Bakfyllnaden av gamla dokument
 * (cllp/bolag-ops#377) träffar rader där ingen vet vem som skrev. Att gissa CP
 * där hade skapat ett faktum av en tomhet, vilket är värre än ett tomt fält:
 * det går inte att skilja från de rader där vi faktiskt vet.
 *
 * ══ ⛔ LÄSAREN TÅL DEN GAMLA STRÄNGEN, OCH DET ÄR INTE SNÄLLHET ════════
 *
 * Ordningen i en migrering är tvingande: läsaren måste tåla båda formerna INNAN
 * skrivaren byter, annars visar varje vy tomt för varje omigrerat dokument i
 * samma sekund. Utan en läsare här skriver i stället varje vy sin egen
 * `typeof === "string"`-gren, och då är det fem ställen som ska städas den dag
 * bakfyllnaden är klar i stället för ett.
 */

/**
 * @typedef {object} Skapare
 * @property {string | null} uid Firebase Auth-uid, eller null.
 * @property {string} namn Det som visas.
 * @property {"manniska" | "agent" | "okand"} typ
 * @property {string} kalla Vilket jobb eller vilken vy.
 */

/** De tre tillåtna sorterna. */
export const SKAPARTYPER = /** @type {const} */ (["manniska", "agent", "okand"]);

/** @type {Skapare} */
const OKAND = Object.freeze({ uid: null, namn: "", typ: "okand", kalla: "" });

/** @param {unknown} v @returns {string} */
const text = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Bygger fältet.
 *
 * ⛔ KASTAR PÅ EN OKÄND `typ` i stället för att tyst skriva den vidare. Ett
 * stavfel som `"människa"` hade annars legat i databasen och matchat ingenting,
 * och symptomet vore en rad som ritas utan sort. Samma regel som resten av
 * ramverket: en okänd sort är ett programfel och inte data.
 *
 * @param {{ uid?: string | null, namn?: string, typ?: string, kalla?: string }} [d]
 * @returns {Skapare}
 */
export function byggSkapare(d = {}) {
  const typ = text(d.typ) || "okand";
  if (!(/** @type {readonly string[]} */ (SKAPARTYPER).includes(typ))) {
    throw new Error(`byggSkapare: okänd typ "${typ}". Giltiga: ${SKAPARTYPER.join(", ")}.`);
  }
  const uid = text(d.uid);
  return {
    uid: uid || null,
    namn: text(d.namn),
    typ: /** @type {Skapare["typ"]} */ (typ),
    kalla: text(d.kalla),
  };
}

/**
 * Läser fältet, oavsett vilken form det har i databasen.
 *
 * Svarar ALLTID med den nya formen, så anroparen aldrig behöver veta vilken
 * form dokumentet hade.
 *
 * ⛔ EN GAMMAL STRÄNG BLIR `typ: "okand"` OCH INTE `"manniska"`. Strängen var
 * oftast en e-postadress, men `"ops-agent"` skrevs i samma fält. Att kalla båda
 * människor hade gjort agentens rader omöjliga att skilja ut, alltså förstört
 * precis den spårbarhet fältet byggs om för.
 *
 * ⛔ NAMNET BEHÅLLS ÄNDÅ. Det är det som står i vyn i dag, och en migrering som
 * gör raden tommare än den var läses som att data försvunnit.
 *
 * @param {unknown} varde
 * @returns {Skapare}
 */
export function laesSkapare(varde) {
  if (typeof varde === "string") {
    const namn = varde.trim();
    return namn ? { uid: null, namn, typ: "okand", kalla: "" } : OKAND;
  }
  if (!varde || typeof varde !== "object") return OKAND;
  const o = /** @type {Record<string, unknown>} */ (varde);
  const typ = text(o.typ);
  return {
    uid: text(o.uid) || null,
    namn: text(o.namn),
    // ⛔ Ett halvt objekt ur en halvfärdig migrering faller till "okand" i
    // stället för att kasta. Läsaren körs i en vy, och en vy som kastar på en
    // enda trasig rad tar ned hela listan.
    typ: /** @type {Skapare["typ"]} */ (/** @type {readonly string[]} */ (SKAPARTYPER).includes(typ) ? typ : "okand"),
    kalla: text(o.kalla),
  };
}

/**
 * Det som ska stå i en vy.
 *
 * ⛔ FALLER TILLBAKA PÅ UID:T:S BÖRJAN OCH INTE PÅ HELA UID:T. Ett uid är 28
 * tecken utan mening för en människa, och ett sådant i en metarad ser ut som ett
 * fel. Åtta tecken räcker för att skilja två rader åt när namnet saknas, och
 * signalerar att det är en maskinnyckel och inte ett namn.
 *
 * @param {unknown} varde @returns {string}
 */
export function skaparensNamn(varde) {
  const s = laesSkapare(varde);
  if (s.namn) return s.namn;
  if (s.uid) return s.uid.slice(0, 8);
  return "";
}

/**
 * Om fältet fortfarande bär den gamla formen.
 *
 * Finns för bakfyllnaden: den ska kunna köras om utan att röra det som redan är
 * migrerat, och räkningen efteråt ska kunna visa noll.
 *
 * @param {unknown} varde @returns {boolean}
 */
export function arGammalForm(varde) {
  return typeof varde === "string" && varde.trim().length > 0;
}
