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
 * 1. Ägaren bjuder in med e-post. Finns personen redan skrivs medlemskapet
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

import { byggInbjudan, byggMedlemskap, medlemskapsId } from "../lib/grupp.js";

/** @param {unknown} v @returns {string} */
const epostform = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");

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
  const ANVANDARE = samlingar.anvandare ?? "users";
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";
  const INBJUDNINGAR = samlingar.inbjudningar ?? "invitations";

  /**
   * ⛔ ÄGARSKAPET KONTROLLERAS HÄR OCH INTE BARA I REGLERNA. En callable kör med
   * Admin SDK, alltså FÖRBI reglerna. Vore kontrollen bara i `firestore.rules`
   * vore den här funktionen en väg runt dem, och det är den vanligaste
   * säkerhetsluckan i ett callable-baserat system.
   *
   * @param {string} uid
   * @param {string} groupId
   */
  async function kravAgare(uid, groupId) {
    const rad = await kalla.read(MEDLEMSKAP, medlemskapsId(uid, groupId));
    if (!rad || rad.status !== "aktiv" || rad.roll !== "agare") {
      throw new Error(`bjudIn: ${uid} är inte aktiv ägare i gruppen "${groupId}" och får inte bjuda in.`);
    }
  }

  return {
    /**
     * Ägaren bjuder in en e-postadress till en grupp.
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

      await kravAgare(avUid, groupId);

      const roll = b.roll ?? "medlem";
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

      const inbjudan = byggInbjudan({
        id: `${groupId}_${epost}`.replace(/[^a-zA-Z0-9_@.-]/g, "-"),
        epost,
        groupId,
        roll,
        status: "vantar",
        skapadAv: b.skapadAv ?? {},
      });
      await kalla.create(INBJUDNINGAR, inbjudan);
      return { resultat: "inbjudan", id: inbjudan.id };
    },

    /**
     * Vid inloggning: gör den inloggades väntande inbjudningar till medlemskap.
     *
     * ⛔ SVARAR MED ANTALET OCH INTE BARA "OK". Klienten anropar vid varje
     * inloggning, och skillnaden mellan "inget väntade" och "två blev till
     * medlemskap" är det enda som avgör om vyn ska säga något.
     *
     * @param {{ uid: string, epost: string }} b
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
              namn: anvandaren?.namn ?? "",
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
