/**
 * Vägen in för en ny person, i två steg, och båda på serversidan.
 *
 * ══ ⛔ VARFÖR SERVERSIDAN OCH INTE KLIENTEN (#137) ═════════════════════
 *
 * `memberships` skrivs aldrig av en klient (#136). Den som kan skriva sitt eget
 * medlemskap kan ge sig själv rollen ägare i vilken grupp som helst vars id hen
 * gissar. Reglerna säger `allow write: if false`, och det enda som kan skriva är
 * alltså Admin SDK, alltså en callable appen registrerar i sina Functions.
 *
 * ══ ⛔ TVÅ STEG, OCH DET ANDRA ÄR DET SOM GÖR DET TILL ETT FLÖDE ══════
 *
 * 1. Ägaren (eller en admin, 0.32.0) bjuder in med e-post. Finns personen redan skrivs medlemskapet
 *    direkt. Annars skrivs en rad i `invitations`.
 * 2. Vid inloggning anropar klienten en gång "acceptera mina inbjudningar".
 *    Serversidan matchar den inloggades e-post mot väntande inbjudningar och
 *    skriver medlemskapen.
 *
 * Efter steg 2 är det uid som gäller, aldrig e-posten. Inbjudningsraden är
 * historik.
 *
 * ⛔ E-POSTEN JÄMFÖRS I GEMENER, ALLTID. `CP@Staiger.se` och `cp@staiger.se` är
 * samma brevlåda och två strängar. Matchas de inte loggar personen in och möter
 * en tom app utan förklaring, vilket är exakt det fel sidan "inget medlemskap"
 * finns för att inte behöva gissa sig till.
 *
 * ⛔ STEG 2 ÄR IDEMPOTENT. Klienten anropar vid VARJE inloggning, eftersom den
 * inte kan veta om något väntar. Körs den två gånger ska andra gången inte göra
 * något, och inte heller misslyckas: ett fel där hade blivit en röd ruta vid
 * varje inloggning för den som redan är medlem.
 *
 * ══ ⛔ RAMVERKET KÄNNER INGEN DATABAS ═════════════════════════════════
 *
 * Datakällan skickas in, som överallt annars. Det är också det som gör att de
 * här går att prova utan nätverk: minneskällan räcker.
 */

// @ts-expect-error Noden har crypto. Ramverket har inga Node-typer: lib är DOM, för webben. Samma rad som i mejl.js.
import { createHash } from "node:crypto";
import { byggInbjudan, byggMedlemskap, MEDLEMSKAPSAVGRANSARE, medlemskapsId } from "../lib/grupp.js";

/** @param {unknown} v @returns {string} */
const epostform = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/**
 * En inbjudans id: grupp-id:t, avgränsaren och SHA-256 (hex) av adressen i gemener.
 *
 * ══ ⛔ VARFÖR INTE `${groupId}_${epost}` LÄNGRE (0.80.1, granskningen av lifehub.app PR 117, punkt 4) ══
 *
 * Före 0.80.1 var id:t `${groupId}_${epost}`, och `_` är ett lagligt tecken i ett grupp-id (`ID_FORM`
 * i `src/lib/katalog.js`) och i en adress. Nyckeln var alltså tvetydig på samma sätt som medlemskapets
 * var före #152: mätt i lifehub gav `acme` + `team_bob@x.se` och `acme_team` + `bob@x.se` samma
 * dokument, och den andra inbjudan skrev över den första. Två grupper delade en rad, och vilken grupp
 * den gällde avgjordes av vem som bjöd in sist.
 *
 * ⛔ AVGRÄNSAREN ÄR `MEDLEMSKAPSAVGRANSARE`, ALLTSÅ `|`, OCH DEN GÅR INTE ATT SKRIVA I NÅGON AV HALVORNA.
 * `ID_FORM` släpper inte igenom den i ett grupp-id, och kontrollen nedan kastar ändå, samma skäl som i
 * `medlemskapsId`. Den andra halvan är hex, alltså finns tecknet aldrig där. Ett id har därmed precis
 * ett `|`, och två olika par kan bara ge samma id om SHA-256 krockar.
 *
 * ⛔ ADRESSEN HASHAS, DEN STÅR INTE I KLARTEXT. Ett dokument-id syns i loggar, i konsolens adressrad
 * och i felmeddelanden, och adressen tillhör någon som ännu inte är med. Raden bär fortfarande `epost`
 * som fält, och det är på fältet inbjudningarna slås upp, aldrig på id:t.
 *
 * @param {string} groupId
 * @param {string} epost
 * @returns {string}
 */
export function inbjudningsId(groupId, epost) {
  const g = typeof groupId === "string" ? groupId.trim() : "";
  const e = epostform(epost);
  if (!g || !e) throw new Error("inbjudningsId: både groupId och epost krävs.");
  if (g.includes(MEDLEMSKAPSAVGRANSARE)) {
    throw new Error(
      `inbjudningsId: groupId "${g}" innehåller avgränsaren "${MEDLEMSKAPSAVGRANSARE}". Nyckeln är groupId, avgränsaren, adressens hash, så tecknet i grupp-id:t gör nyckeln tvetydig.`,
    );
  }
  return `${g}${MEDLEMSKAPSAVGRANSARE}${createHash("sha256").update(e).digest("hex")}`;
}

/**
 * @typedef {object} Samlingar
 * @property {string} [anvandare] Förval `users`.
 * @property {string} [medlemskap] Förval `memberships`.
 * @property {string} [inbjudningar] Förval `invitations`.
 */

/**
 * Bygger de två serverfunktionerna.
 *
 * ⛔ EN FABRIK OCH INTE TVÅ LÖSA FUNKTIONER, eftersom båda behöver samma
 * datakälla och samma samlingsnamn. Två anrop som var för sig tar emot dem är
 * två ställen där de kan skrivas olika.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla
 * @param {Samlingar} [konfig.samlingar]
 * @returns {{ bjudIn: (b: any) => Promise<any>, accepteraInbjudningar: (b: any) => Promise<any> }}
 */
export function createInvitationService(konfig) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN OCH INTE I PARAMETERLISTAN, och det
   * är ett vaktfynd. `check-config-requirements` fällde den första versionen:
   * med `({ kalla })` i signaturen kastar Node "Cannot destructure property
   * 'kalla' of 'undefined'" INNAN valideringen hinner köra, alltså ett fel som
   * inte nämner fabriken och inte säger vad appen glömde.
   */
  const { kalla, samlingar = {} } = konfig ?? {};
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.list !== "function" || typeof kalla.create !== "function") {
    throw new Error("createInvitationService: en datakälla med read, list och create krävs. Ramverket känner ingen databas.");
  }
  /*
   * ⛔ `createNew` KRÄVS (0.80.1), OCH DET PRÖVAS NÄR TJÄNSTEN BYGGS. En inbjudan skrivs aldrig över:
   * `create` med ett eget id ersätter posten (datakontraktet), och det var så en grupps inbjudan skrev
   * över en annans. Ett tyst fall tillbaka på `create` hade varit den luckan kvar under ett nytt namn,
   * och en läsning före `create` är den läs-sedan-skriv-kontroll regel 2 förbjuder.
   */
  if (typeof kalla.createNew !== "function") {
    throw new Error(
      "createInvitationService: datakällan saknar createNew. En inbjudan får aldrig skriva över en befintlig rad, och en källa som bara kan ersätta gör det. Med Admin SDK är createNew ref.create(), som avvisar ett dokument som redan finns. Se datakontraktets regel 8.",
    );
  }
  const skapaNy = kalla.createNew;
  const ANVANDARE = samlingar.anvandare ?? "users";
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";
  const INBJUDNINGAR = samlingar.inbjudningar ?? "invitations";

  /**
   * ⛔ BEHÖRIGHETEN KONTROLLERAS HÄR OCH INTE BARA I REGLERNA. En callable kör med
   * Admin SDK, alltså FÖRBI reglerna. Vore kontrollen bara i `firestore.rules`
   * vore den här funktionen en väg runt dem, och det är den vanligaste
   * säkerhetsluckan i ett callable-baserat system.
   *
   * ⛔ ÄGARE ELLER ADMIN FÅR BJUDA IN (0.32.0, #180, SS `isGroupAdmin`), MEN BARA EN ÄGARE FÅR BJUDA
   * IN TILL ROLLEN ÄGARE. Utan den andra halvan kan en admin göra vem som helst till ägare genom att
   * bjuda in hen som agare, och gränsen `regelfragment()` drar mellan `opsArAdmin` och `opsArAgare` är
   * då en dörr med ett fönster bredvid.
   *
   * @param {string} uid
   * @param {string} groupId
   * @param {string} roll Rollen som bjuds in till.
   */
  async function kravBehorighet(uid, groupId, roll) {
    const rad = await kalla.read(MEDLEMSKAP, medlemskapsId(uid, groupId));
    if (!rad || rad.status !== "aktiv" || (rad.roll !== "agare" && rad.roll !== "admin")) {
      throw new Error(`bjudIn: ${uid} är inte aktiv ägare eller admin i gruppen "${groupId}" och får inte bjuda in.`);
    }
    if (roll === "agare" && rad.roll !== "agare") {
      throw new Error(`bjudIn: ${uid} är admin i gruppen "${groupId}" och får inte bjuda in till rollen agare. Bara en ägare gör någon till ägare.`);
    }
  }

  return {
    /**
     * Ägaren eller en admin bjuder in en e-postadress till en grupp.
     *
     * @param {{ avUid: string, groupId: string, epost: string, roll?: string, typ?: string, skapadAv?: any }} b
     * @returns {Promise<{ resultat: "medlemskap" | "inbjudan" | "fanns", id: string }>}
     */
    async bjudIn(b) {
      const avUid = typeof b?.avUid === "string" ? b.avUid.trim() : "";
      const groupId = typeof b?.groupId === "string" ? b.groupId.trim() : "";
      const epost = epostform(b?.epost);
      if (!avUid) throw new Error("bjudIn: avUid krävs, alltså vem som bjuder in. Utan den går ägarskapet inte att kontrollera.");
      if (!groupId) throw new Error("bjudIn: groupId krävs.");
      if (!epost) throw new Error("bjudIn: epost krävs. Det är det enda en inbjudan har att matcha på innan personen finns.");

      const roll = b.roll ?? "medlem";
      await kravBehorighet(avUid, groupId, roll);

      const typ = b.typ ?? "person";

      /*
       * ⛔ FINNS PERSONEN REDAN SKRIVS MEDLEMSKAPET DIREKT. En inbjudan som
       * väntar på en inloggning som redan skett är en rad ingen kommer att
       * acceptera, och den som bjöd in ser en person som aldrig dyker upp.
       */
      const anvandare = (await kalla.list(ANVANDARE, { where: { epost } })).find(Boolean);
      if (anvandare) {
        const id = medlemskapsId(anvandare.id, groupId);
        if (await kalla.read(MEDLEMSKAP, id)) return { resultat: "fanns", id };
        /*
         * ⛔ NAMN OCH BILD FÖLJER MED IN I MEDLEMSKAPET (#138, beslut A).
         * E-posten lämnar aldrig `users`, alltså är det här den enda källan
         * medlemslistan har att rita en rad ur. Skrivs de inte här blir listan
         * en rad uid:n, vilket är samma sak som ingen lista.
         */
        const medlemskap = byggMedlemskap({
          userId: anvandare.id,
          groupId,
          roll,
          typ,
          status: "aktiv",
          namn: anvandare.namn ?? "",
          bild: anvandare.bild ?? "",
        });
        await kalla.create(MEDLEMSKAP, medlemskap);
        return { resultat: "medlemskap", id };
      }

      /*
       * ⛔ EN VÄNTANDE INBJUDAN TILL SAMMA ADRESS OCH GRUPP ÅTERANVÄNDS. Två
       * rader för samma sak gör "acceptera" till en fråga om vilken som hittas
       * först, och ägaren som klickar två gånger ska inte skapa ett problem.
       */
      const vantande = (await kalla.list(INBJUDNINGAR, { where: { epost } })).filter(
        (i) => i.groupId === groupId && i.status === "vantar",
      );
      if (vantande.length > 0) return { resultat: "fanns", id: vantande[0].id };

      /*
       * ⛔ SKAPAS MED `createNew` OCH ALDRIG MED `create` (0.80.1). Finns en rad med samma id redan är den
       * inte väntande (den hade hittats ovan), alltså accepterad eller återkallad, och då kastas det med
       * skälet. Före 0.80.1 skrev en ny inbjudan över den raden, och historiken över att den återkallats
       * försvann med den.
       *
       * ⛔ GAMLA RADER LÄSES SOM FÖRUT. En inbjudan skriven före 0.80.1 har id:t `${groupId}_${epost}` och
       * hittas ändå, eftersom varje uppslag går på fältet `epost` och aldrig på id:t: listningen ovan
       * återanvänder en väntande gammal rad, och accepten uppdaterar raden med det id den listade.
       */
      const inbjudan = byggInbjudan({
        id: inbjudningsId(groupId, epost),
        epost,
        groupId,
        roll,
        status: "vantar",
        skapadAv: b.skapadAv ?? {},
      });
      const { created, row } = await skapaNy.call(kalla, INBJUDNINGAR, inbjudan);
      if (!created) {
        throw new Error(
          `bjudIn: det finns redan en inbjudan för adressen i gruppen "${groupId}" (${INBJUDNINGAR}/${inbjudan.id}, status "${row?.status ?? "okänd"}"). En inbjudan skrivs aldrig över, så den återkallade eller accepterade raden står kvar som den är.`,
        );
      }
      return { resultat: "inbjudan", id: inbjudan.id };
    },

    /**
     * Vid inloggning: gör den inloggades väntande inbjudningar till medlemskap.
     *
     * ⛔ SVARAR MED ANTALET OCH INTE BARA "OK". Klienten anropar vid varje
     * inloggning, och skillnaden mellan "inget väntade" och "två blev till
     * medlemskap" är det enda som avgör om vyn ska säga något.
     *
     * @param {{ uid: string, epost: string, namn?: string }} b
     *   `namn`: den inloggades namn ur inloggningen. Används BARA när profilraden saknar namn (0.40.1, #218).
     * @returns {Promise<{ accepterade: string[] }>}
     */
    async accepteraInbjudningar(b) {
      const uid = typeof b?.uid === "string" ? b.uid.trim() : "";
      const epost = epostform(b?.epost);
      if (!uid) throw new Error("accepteraInbjudningar: uid krävs.");
      if (!epost) throw new Error("accepteraInbjudningar: epost krävs, den inloggades. Det är den inbjudningarna matchas mot.");

      const vantande = (await kalla.list(INBJUDNINGAR, { where: { epost } })).filter((i) => i.status === "vantar");

      /** @type {string[]} */
      const accepterade = [];
      /** @type {Record<string, any> | null | undefined} `undefined` = inte läst än, `null` = finns inte. */
      let anvandaren;
      for (const inbjudan of vantande) {
        const id = medlemskapsId(uid, inbjudan.groupId);
        /*
         * ⛔ IDEMPOTENT: ett medlemskap som redan finns rörs inte, men
         * inbjudan markeras ändå accepterad. Annars ligger raden kvar som
         * "vantar" för alltid och räknas varje inloggning.
         */
        if (!(await kalla.read(MEDLEMSKAP, id))) {
          /*
           * ⛔ PROFILEN LÄSES EN GÅNG, INTE EN GÅNG PER INBJUDAN. Den som
           * bjudits in till tre grupper ska inte kosta tre läsningar av samma
           * rad, och alla tre medlemskapen ska dessutom bära samma namn.
           */
          if (anvandaren === undefined) anvandaren = (await kalla.read(ANVANDARE, uid)) ?? null;
          await kalla.create(
            MEDLEMSKAP,
            byggMedlemskap({
              userId: uid,
              groupId: inbjudan.groupId,
              roll: inbjudan.roll,
              typ: "person",
              status: "aktiv",
              // ⛔ Profilens namn, annars inloggningens, aldrig tomt när ett fanns (0.40.1, #218).
              namn: anvandaren?.namn || (typeof b?.namn === "string" ? b.namn.trim() : ""),
              bild: anvandaren?.bild ?? "",
            }),
          );
          accepterade.push(inbjudan.groupId);
        }
        await kalla.update(INBJUDNINGAR, inbjudan.id, { status: "accepterad" });
      }
      return { accepterade };
    },
  };
}
