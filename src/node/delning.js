/**
 * Publik delning av en biblioteksfil: en länk utan inloggning (0.119.0, lifehub.app#356).
 *
 * ══ ⛔ VARFÖR SERVERSIDAN, OCH VARFÖR REGLERNA NEKAR ALLT ═══════════════════════════════════════════════════════════════
 *
 * En delningsrad skrivs och läses bara av Admin SDK. `delningsregelfragment()` säger `allow read, write: if false`, så en klient
 * kan varken ge sig själv en länk till en fil i en grupp hen inte är med i eller läsa vilka länkar som finns. Eftersom en
 * callable kör FÖRBI reglerna kontrolleras behörigheten här, i funktionen, på samma sätt som i `createInvitationService`.
 *
 * ══ ⛔ TOKENET SPARAS ALDRIG, BARA DESS HASH ═══════════════════════════════════════════════════════════════════════════
 *
 * Tokenet är 32 slumpbyte i base64url (43 tecken) och finns bara i svaret från `skapa`, en gång. Dokumentets id är SHA-256
 * (hex) av det. Den som läser databasen, en logg eller en säkerhetskopia får hashen, och hashen går inte att vända till en
 * länk. Det betyder också att en länk inte går att visa igen: tappas den stängs den och en ny skapas, med ett nytt token.
 *
 * ══ ⛔ ETT OKÄNT TOKEN SVARAR SOM ETT UTGÅNGET ═══════════════════════════════════════════════════════════════════════
 *
 * `hamta` är en publik funktion. Skilde svaret på "finns inte" och "har gått ut" gick det att pröva sig fram till vilka tokens
 * som någon gång funnits. Därför är de ett och samma svar, byte för byte. "Stängd" och "filen finns inte" kan bara ses av den
 * som redan har ett riktigt token, och den får veta det: hen ska inte tro att länken är trasig när någon stängt den.
 *
 * ══ ⛔ SVARET HAR EN ÖPPEN LISTA FÄLT OCH INGET ANNAT ═════════════════════════════════════════════════════════════════
 *
 * `DELNINGSSVARSFALT` är hela svaret. Sökvägen i lagringen, grupp-id, taggar, utskrift, skaparens e-post och uid lämnar aldrig
 * servern genom den här funktionen: den publika sidan behöver dem inte, och allt som skickas ut är något som kan läcka.
 *
 * ══ ⛔ RAMVERKET KÄNNER INGEN DATABAS OCH INGEN LAGRING ═══════════════════════════════════════════════════════════════
 *
 * Datakällan och lagringen skickas in, samlingsnamnen likaså (`delningar` och `bibliotek` har inga förval: det är appens
 * namn). Lagringen behöver bara en metod, `signeradAdress`, som med Admin SDK är `bucket.file(sokvag).getSignedUrl(...)`.
 */

// @ts-expect-error Noden har crypto. Ramverket har inga Node-typer: lib är DOM, för webben. Samma rad som i inbjudan.js.
import { createHash, randomBytes } from "node:crypto";
import { arLjudpost, arMittBibliotek, gruppForPlats, ljudRubrik, mittBibliotek, peaksGiltiga, trimSomRegeln } from "../lib/bibliotek.js";
import { DELNINGSDAGAR, SIGNERAD_SEKUNDER, TOKENFORM, delningsTyp } from "../lib/delning.js";
import { medlemskapsId } from "../lib/grupp.js";

const DYGN_MS = 24 * 60 * 60 * 1000;

/** Samma form som regelfragmentens samlingsnamn: ett namn, inte en sökväg. */
const SAMLINGSFORM = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** @param {unknown} v @returns {string} */
const text = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Ett nytt token: 32 slumpbyte i base64url. Det enda stället ett token blir till.
 * @returns {string}
 */
export function nyttDelningstoken() {
  return randomBytes(32).toString("base64url");
}

/**
 * Dokument-id:t för ett token: SHA-256 i hex. Kastar för något som inte är ett token, så att en felskriven hash aldrig blir ett id.
 *
 * @param {string} token
 * @returns {string}
 */
export function delningsId(token) {
  if (typeof token !== "string" || !TOKENFORM.test(token)) {
    throw new Error("delningsId: ett token är 43 tecken ur A-Z, a-z, 0-9, - och _ (32 slumpbyte i base64url).");
  }
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Delningspostens form, eller felet som säger varför den inte går att bygga.
 *
 * ⛔ `id` ÄR HASHEN AV TOKENET OCH TOKENET FINNS INTE I RADEN. En kopia av tokenet i raden vore en andra sanning om hur länken
 * ser ut, och det är precis den som en läsning av databasen inte får ge.
 *
 * ⛔ UTGÅNGSTIDEN ÄR EN AV `DELNINGSDAGAR`, och det finns ingen "ingen utgång" (CP 2026-10-19). `nedladdning` är sant eller
 * falskt och inget annat: en sträng "false" är sann i en jämförelse, och ett förval på sant hade gjort varje länk till en
 * nedladdning.
 *
 * @param {object} d
 * @param {string} d.token
 * @param {string} d.postId
 * @param {string} d.groupId
 * @param {{ uid: string, namn?: string }} d.skapadAv
 * @param {number} d.skapad Millisekunder.
 * @param {number} d.dagar En av `DELNINGSDAGAR`.
 * @param {boolean} d.nedladdning
 * @returns {{ id: string, postId: string, groupId: string, skapadAv: { uid: string, namn: string }, skapad: number, giltigTill: number, aterkallad: null, nedladdning: boolean }}
 */
export function byggDelning(d) {
  if (!d || typeof d !== "object") throw new Error("byggDelning: en delning krävs.");
  const postId = text(d.postId);
  const groupId = text(d.groupId);
  const uid = text(d.skapadAv?.uid);
  if (!postId) throw new Error("byggDelning: postId krävs.");
  if (!groupId) throw new Error("byggDelning: groupId krävs.");
  if (!uid) throw new Error("byggDelning: skapadAv.uid krävs. Utan den går det inte att se vem som får stänga länken.");
  if (!Number.isInteger(d.skapad) || d.skapad < 0) throw new Error("byggDelning: skapad ska vara ett heltal, millisekunder.");
  if (!(/** @type {readonly number[]} */ (DELNINGSDAGAR).includes(d.dagar))) {
    throw new Error(`byggDelning: utgångstiden ${String(d.dagar)} dagar finns inte. Giltiga: ${DELNINGSDAGAR.join(", ")}. Ingen utgång finns inte.`);
  }
  if (typeof d.nedladdning !== "boolean") throw new Error("byggDelning: nedladdning ska vara sant eller falskt.");
  return {
    id: delningsId(d.token),
    postId,
    groupId,
    skapadAv: { uid, namn: text(d.skapadAv?.namn) },
    skapad: d.skapad,
    giltigTill: d.skapad + d.dagar * DYGN_MS,
    aterkallad: null,
    nedladdning: d.nedladdning,
  };
}

/**
 * Headern som lagringen sätter på svaret: `inline` när nedladdning är av, `attachment` med filnamn när den är på.
 *
 * ⛔ FILNAMNET ÄR ANVÄNDARENS TEXT OCH BLIR EN HEADER. Citationstecken, radbrytningar och allt utanför ASCII rensas ur den enkla
 * formen, och den riktiga formen går som `filename*` med procentkodning (RFC 5987). Annars är ett filnamn med `"` eller en
 * radbrytning ett sätt att skriva egna headrar.
 *
 * @param {string} namn
 * @param {boolean} bifoga
 * @returns {string}
 */
export function delningsDisposition(namn, bifoga) {
  if (!bifoga) return "inline";
  const rent = (typeof namn === "string" ? namn : "").trim();
  const enkel = rent.replace(/[^A-Za-z0-9._ -]/g, "_") || "fil";
  const kodad = encodeURIComponent(rent || "fil").replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${enkel}"; filename*=UTF-8''${kodad}`;
}

/**
 * @typedef {object} Delningssamlingar
 * @property {string} delningar Samlingen delningarna ligger i. Inget förval: det är appens namn.
 * @property {string} bibliotek Samlingen biblioteksposterna ligger i. Inget förval.
 * @property {string} [medlemskap] Förval `memberships`.
 */

/**
 * @typedef {object} Delningslagring
 * @property {(b: { sokvag: string, sekunder: number, disposition: string, mime: string }) => Promise<string>} signeradAdress
 *   En adress till filen som gäller i `sekunder` och svarar med headern `disposition` som `Content-Disposition`. Med Admin SDK:
 *   `bucket.file(sokvag).getSignedUrl({ version: "v4", action: "read", expires, responseDisposition, responseType })`.
 */

/**
 * Svaret för en länk som inte går att visa. Alltid en ny kopia: svaret är samma sak men inte samma objekt.
 * @param {"utgangen" | "stangd" | "saknas"} orsak
 */
const nej = (orsak) => ({ ok: /** @type {const} */ (false), orsak });

/**
 * Bygger tjänsten bakom länken.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Kräver `createNew` och `updateIf`.
 * @param {Delningslagring} konfig.lagring
 * @param {Delningssamlingar} konfig.samlingar
 * @param {() => number} [konfig.klocka] Millisekunder. Förval `Date.now`. Provens enda sätt att låta en länk gå ut.
 */
export function createDelningService(konfig) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, av samma skäl som i `inbjudningstjanst`: `({ kalla })` i signaturen kastar Nodes
   * "Cannot destructure" innan valideringen hinner köra, och det felet nämner inte fabriken.
   */
  const { kalla, lagring, samlingar, klocka = Date.now } = konfig ?? {};
  const namn = "createDelningService";
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.list !== "function") {
    throw new Error(`${namn}: en datakälla med read och list krävs. Ramverket känner ingen databas.`);
  }
  if (typeof kalla.createNew !== "function") {
    throw new Error(`${namn}: datakällan saknar createNew. Id:t är en hash och en delning skrivs aldrig över. Se datakontraktets regel 8.`);
  }
  if (typeof kalla.updateIf !== "function") {
    throw new Error(`${namn}: datakällan saknar updateIf. Att stänga en länk och att ändra nedladdning får inte kunna korsa varandra, och en läsning följd av en skrivning gör det. Se datakontraktets regel 7.`);
  }
  if (!lagring || typeof lagring.signeradAdress !== "function") {
    throw new Error(`${namn}: en lagring med signeradAdress krävs. Den publika sidan får aldrig en öppen sökväg, bara en adress som går ut.`);
  }
  for (const falt of /** @type {const} */ (["delningar", "bibliotek"])) {
    const v = samlingar?.[falt];
    if (typeof v !== "string" || !SAMLINGSFORM.test(v)) {
      throw new Error(`${namn}: samlingar.${falt} krävs, ett samlingsnamn. Ramverket känner inte appens samlingsnamn och gissar inget.`);
    }
  }
  /*
   * ⛔ ANROPEN GÅR TILL KÄLLAN VARJE GÅNG, METODEN FÅNGAS INTE VID BYGGET (samma skäl som i `inbjudningstjanst`). En källa som lindas in efteråt,
   * till exempel av ett prov som lägger in ett fel mellan läsningen och skrivningen, träffas av samma anrop som `read`.
   */
  /** @type {(samling: string, data: any) => Promise<{ created: boolean, row: any }>} */
  const skapaNy = (samling, data) => /** @type {any} */ (kalla).createNew(samling, data);
  /** @type {(samling: string, id: string, villkor: Record<string, unknown>, data: any) => Promise<{ updated: boolean, row: any }>} */
  const uppdateraOm = (samling, id, villkor, data) => /** @type {any} */ (kalla).updateIf(samling, id, villkor, data);
  const DELNINGAR = samlingar.delningar;
  const BIBLIOTEK = samlingar.bibliotek;
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";

  /**
   * @param {string} uid
   * @param {string} groupId
   */
  async function aktivtMedlemskap(uid, groupId) {
    // ⛔ EN HÄNDELSES FILER DELAR GRUPPENS MEDLEMSKAP (0.121.0, lifehub.app#366). Platsen `handelse~<grupp>~<händelse>` är ingen grupp, och ett
    // medlemskap med hela strängen som grupp finns inte: utan uppslaget via `gruppForPlats` hade en händelsefil nekats tyst, för alla.
    const rad = await kalla.read(MEDLEMSKAP, medlemskapsId(uid, gruppForPlats(groupId)));
    return rad && rad.status === "aktiv" && rad.typ !== "agent" ? rad : null;
  }

  /**
   * @param {string} uid
   * @param {string} groupId
   */
  async function forvaltar(uid, groupId) {
    if (arMittBibliotek(groupId)) return false;
    const m = await aktivtMedlemskap(uid, groupId);
    return Boolean(m) && (m.roll === "agare" || m.roll === "admin");
  }

  /**
   * Den som delade, eller en admin eller ägare i delningens grupp, får ändra den.
   *
   * ⛔ DEN SOM DELADE FÅR ALLTID STÄNGA, ÄVEN EFTER ATT HEN LÄMNAT GRUPPEN. Att kräva ett aktivt medlemskap här hade låtit en
   * länk leva vidare efter att personen som skapade den inte längre kunde stänga den.
   *
   * @param {string} vem
   * @param {Record<string, any>} rad
   * @param {string} vad
   */
  async function kravForvalta(vem, rad, vad) {
    if (rad.skapadAv?.uid === vem) return;
    if (typeof rad.groupId === "string" && (await forvaltar(vem, rad.groupId))) return;
    throw new Error(`${vad}: ${vem} är inte den som delade och inte admin eller ägare i platsen. Länken ändras inte.`);
  }

  /**
   * Att SLÅ PÅ nedladdning kräver mer än att stänga: den som delade ska fortfarande höra till platsen, annars krävs admin eller ägare.
   *
   * ⛔ EN BORTTAGEN MEDLEM FÅR STÄNGA MEN INTE ÖPPNA. Att stänga minskar vad en länk ger, så det är rätt även efter att personen lämnat
   * gruppen. Att slå på nedladdning ökar det, och en person som tagits bort ur gruppen hade annars kunnat göra en fil i gruppen
   * nedladdningsbar för vem som helst med länken. Samma krav gäller att slå av, för ett enda villkor är lättare att resonera om.
   *
   * @param {string} vem
   * @param {Record<string, any>} rad
   * @param {string} vad
   */
  async function kravAndraNedladdning(vem, rad, vad) {
    if (rad.skapadAv?.uid === vem && typeof rad.groupId === "string") {
      if (arMittBibliotek(rad.groupId)) {
        // I ett eget bibliotek är platsen personens egen så länge uid:t är ägarens.
        let egen = "";
        try {
          egen = mittBibliotek(vem);
        } catch {
          egen = "";
        }
        if (rad.groupId === egen) return;
      } else if (await aktivtMedlemskap(vem, rad.groupId)) {
        return;
      }
    }
    if (typeof rad.groupId === "string" && (await forvaltar(vem, rad.groupId))) return;
    throw new Error(`${vad}: ${vem} är inte aktiv medlem som delade, och inte admin eller ägare i platsen. Länken ändras inte.`);
  }

  /**
   * @param {unknown} v
   * @param {string} falt
   * @param {string} vad
   */
  function kravText(v, falt, vad) {
    const t = text(v);
    if (!t) throw new Error(`${vad}: ${falt} krävs.`);
    return t;
  }

  /**
   * En fil som är färdig uppladdad. En post utan `klar` räknas som klar (poster före 0.117.0), `klar: false` gör den inte.
   * @param {Record<string, any> | null | undefined} post
   */
  const arKlarFil = (post) => Boolean(post) && post?.typ === "fil" && Boolean(post.fil) && typeof post.fil.sokvag === "string" && post.fil.sokvag !== "" && post.fil.klar !== false;

  return {
    /**
     * Delar en fil. Svarar med tokenet, och det är enda gången det finns.
     *
     * ⛔ POSTENS EGEN GRUPP ÄR DEN SOM GÄLLER (IDOR). `groupId` i anropet är det anroparen tror, och det är posten som avgör. En
     * medlem i grupp A som skickar groupId "A" med en post-id ur grupp B får samma nej som för en post som inte finns:
     * behörigheten prövas mot den grupp posten faktiskt ligger i, aldrig mot den som angavs.
     *
     * @param {{ uid: string, postId: string, groupId: string, dagar: number, nedladdning?: boolean, namn?: string }} b
     * @returns {Promise<{ token: string, id: string, giltigTill: number, nedladdning: boolean }>}
     */
    async skapa(b) {
      const uid = kravText(b?.uid, "uid", "skapa");
      const postId = kravText(b?.postId, "postId", "skapa");
      const groupId = kravText(b?.groupId, "groupId", "skapa");
      if (!(/** @type {readonly number[]} */ (DELNINGSDAGAR).includes(b?.dagar))) {
        throw new Error(`skapa: utgångstiden ${String(b?.dagar)} dagar finns inte. Giltiga: ${DELNINGSDAGAR.join(", ")}.`);
      }
      const nedladdning = b.nedladdning === undefined ? false : b.nedladdning;
      if (typeof nedladdning !== "boolean") throw new Error("skapa: nedladdning ska vara sant eller falskt.");

      const post = await kalla.read(BIBLIOTEK, postId);
      if (!arKlarFil(post) || post.groupId !== groupId) {
        throw new Error(`skapa: posten finns inte i platsen "${groupId}", eller är inte en färdig fil. Inget har delats.`);
      }

      let medlem = null;
      if (arMittBibliotek(groupId)) {
        // ⛔ I ETT EGET BIBLIOTEK GÄLLER BARA ÄGAREN, samma som regeln för posten. En roll i en grupp ger ingenting här.
        let egen = "";
        try {
          egen = mittBibliotek(uid);
        } catch {
          egen = "";
        }
        if (groupId !== egen || post.skapadAv?.uid !== uid) {
          throw new Error(`skapa: ${uid} äger inte biblioteket "${groupId}" och får inte dela ur det.`);
        }
      } else {
        medlem = await aktivtMedlemskap(uid, groupId);
        if (!medlem) throw new Error(`skapa: ${uid} är inte aktiv medlem i gruppen "${groupId}" och får inte dela.`);
        const alla = medlem.roll === "agare" || medlem.roll === "admin";
        // En vanlig medlem delar bara sina egna poster. Admin och ägare delar alla i gruppen.
        if (!alla && post.skapadAv?.uid !== uid) {
          throw new Error(`skapa: ${uid} har inte skrivit posten och är inte admin eller ägare i "${groupId}". En medlem delar bara sina egna poster.`);
        }
      }

      const token = nyttDelningstoken();
      const rad = byggDelning({
        token,
        postId,
        groupId,
        skapadAv: { uid, namn: text(b.namn) || text(medlem?.namn) },
        skapad: klocka(),
        dagar: b.dagar,
        nedladdning,
      });
      const { created } = await skapaNy(DELNINGAR, rad);
      if (!created) throw new Error("skapa: delningen kunde inte skrivas, id:t fanns redan. Försök igen.");
      return { token, id: rad.id, giltigTill: rad.giltigTill, nedladdning };
    },

    /**
     * Slår på eller av nedladdning. Bara på en länk som inte är stängd.
     *
     * ⛔ VILLKORAT PÅ ATT LÄNKEN INTE ÄR STÄNGD, I SAMMA STEG. En stängd länk öppnas aldrig igen, och en ändring som korsar en
     * stängning får inte lyckas.
     *
     * @param {{ uid: string, id: string, nedladdning: boolean }} b
     * @returns {Promise<{ id: string, nedladdning: boolean }>}
     */
    async andraNedladdning(b) {
      const uid = kravText(b?.uid, "uid", "andraNedladdning");
      const id = kravText(b?.id, "id", "andraNedladdning");
      if (typeof b.nedladdning !== "boolean") throw new Error("andraNedladdning: nedladdning ska vara sant eller falskt.");
      const rad = await kalla.read(DELNINGAR, id);
      if (!rad) throw new Error("andraNedladdning: delningen finns inte.");
      await kravAndraNedladdning(uid, rad, "andraNedladdning");
      if (rad.aterkallad !== null && rad.aterkallad !== undefined) throw new Error("andraNedladdning: länken är stängd. En stängd länk öppnas inte igen, skapa en ny.");
      const { updated, row } = await uppdateraOm(DELNINGAR, id, { aterkallad: null }, { nedladdning: b.nedladdning });
      if (!updated) throw new Error("andraNedladdning: länken stängdes medan ändringen gjordes. Skapa en ny länk.");
      return { id, nedladdning: Boolean(row?.nedladdning) };
    },

    /**
     * Stänger länken, för alltid. Att stänga en stängd länk är inget fel: svaret är då tiden den redan stängdes.
     *
     * @param {{ uid: string, id: string }} b
     * @returns {Promise<{ id: string, aterkallad: number }>}
     */
    async aterkalla(b) {
      const uid = kravText(b?.uid, "uid", "aterkalla");
      const id = kravText(b?.id, "id", "aterkalla");
      const rad = await kalla.read(DELNINGAR, id);
      if (!rad) throw new Error("aterkalla: delningen finns inte.");
      await kravForvalta(uid, rad, "aterkalla");
      const nu = klocka();
      const { updated, row } = await uppdateraOm(DELNINGAR, id, { aterkallad: null }, { aterkallad: nu });
      if (updated) return { id, aterkallad: nu };
      if (typeof row?.aterkallad === "number") return { id, aterkallad: row.aterkallad };
      throw new Error("aterkalla: länken kunde inte stängas. Försök igen.");
    },

    /**
     * Länkarna som lever i en plats: de som inte är stängda och inte har gått ut.
     * En vanlig medlem ser sina egna, en admin och en ägare ser alla i gruppen. Raderna bär inget token (det finns inte).
     *
     * @param {{ uid: string, groupId: string }} b
     * @returns {Promise<Array<{ id: string, postId: string, giltigTill: number, nedladdning: boolean, skapadAv: { uid: string, namn: string } }>>}
     */
    async lista(b) {
      const uid = kravText(b?.uid, "uid", "lista");
      const groupId = kravText(b?.groupId, "groupId", "lista");
      let alla = false;
      if (arMittBibliotek(groupId)) {
        if (groupId !== mittBibliotek(uid)) throw new Error(`lista: ${uid} äger inte biblioteket "${groupId}".`);
      } else {
        const m = await aktivtMedlemskap(uid, groupId);
        if (!m) throw new Error(`lista: ${uid} är inte aktiv medlem i gruppen "${groupId}".`);
        alla = m.roll === "agare" || m.roll === "admin";
      }
      const nu = klocka();
      const rader = await kalla.list(DELNINGAR, { where: { groupId } });
      return rader
        .filter((r) => (r.aterkallad === null || r.aterkallad === undefined) && typeof r.giltigTill === "number" && r.giltigTill > nu)
        .filter((r) => alla || r.skapadAv?.uid === uid)
        .map((r) => ({ id: r.id, postId: r.postId, giltigTill: r.giltigTill, nedladdning: r.nedladdning === true, skapadAv: { uid: r.skapadAv?.uid ?? "", namn: r.skapadAv?.namn ?? "" } }));
    },

    /**
     * Det den publika sidan får veta om en länk. Anropas utan inloggning, med tokenet ur adressen.
     *
     * @param {unknown} token
     * @returns {Promise<
     *   | { ok: false, orsak: "utgangen" | "stangd" | "saknas" }
     *   | { ok: true, delning: { rubrik: string, typ: string, mime: string, storlek: number | null, langd: number | null, peaks: string | null, nedladdning: boolean, url: string, visaUrl: string | null } }
     * >}
     */
    async hamta(token) {
      // ⛔ ETT TOKEN I FEL FORM SLÅS INTE UPP, och svarar som ett utgånget. Det kastar aldrig: skräp i adressen är inget serverfel.
      if (typeof token !== "string" || !TOKENFORM.test(token)) return nej("utgangen");
      const rad = await kalla.read(DELNINGAR, delningsId(token));
      if (!rad) return nej("utgangen");
      if (rad.aterkallad !== null && rad.aterkallad !== undefined) return nej("stangd");
      // En rad med en utgångstid som inte är ett tal gäller inte: fel i datan öppnar aldrig en länk.
      if (typeof rad.giltigTill !== "number" || rad.giltigTill <= klocka()) return nej("utgangen");
      if (typeof rad.postId !== "string" || typeof rad.groupId !== "string") return nej("saknas");

      const post = await kalla.read(BIBLIOTEK, rad.postId);
      // ⛔ POSTENS GRUPP MÅSTE VARA DELNINGENS. En post som flyttats till en annan grupp eller till Mitt bibliotek delades inte dit.
      if (!arKlarFil(post) || post.groupId !== rad.groupId) return nej("saknas");

      const nedladdning = rad.nedladdning === true;
      const filnamn = text(post.fil.namn);
      const typ = delningsTyp(post.fil.mime);
      const sign = (/** @type {boolean} */ bifoga) =>
        lagring.signeradAdress({ sokvag: post.fil.sokvag, sekunder: SIGNERAD_SEKUNDER, disposition: delningsDisposition(filnamn, bifoga), mime: post.fil.mime });
      const url = await sign(nedladdning);
      // En PDF som ska visas inbäddad kan inte komma från en adress med `attachment`: webbläsaren sparar den i stället för att visa den.
      const visaUrl = nedladdning && typ === "pdf" ? await sign(false) : null;
      const rubrik = arLjudpost(post) ? ljudRubrik(post) : trimSomRegeln(post.rubrik) || filnamn;
      return {
        ok: true,
        delning: {
          rubrik,
          typ,
          mime: post.fil.mime,
          storlek: Number.isInteger(post.fil.byte) ? post.fil.byte : null,
          langd: Number.isInteger(post.durationMs) ? post.durationMs : null,
          peaks: peaksGiltiga(post.peaks) ? post.peaks : null,
          nedladdning,
          url,
          visaUrl,
        },
      };
    },
  };
}
