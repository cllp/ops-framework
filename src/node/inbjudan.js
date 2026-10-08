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

/** @param {string} groupId @param {string} id */
const redanVantande = (groupId, id) =>
  `bjudIn: adressen har redan en väntande inbjudan i gruppen "${groupId}" (${id}). Skicka om den i stället för att bjuda in igen.`;

/** @param {string} groupId @param {string} id */
const fortfarandeMedlem = (groupId, id) =>
  `bjudIn: personen har redan accepterat inbjudan till gruppen "${groupId}" (${id}) och är redan medlem.`;

/**
 * Felet när någon annan hann skriva raden mellan läsningen och skrivningen.
 * @param {string} groupId @param {string} id @param {Record<string, any> | null | undefined} row
 */
const efterKapplopp = (groupId, id, row) => {
  if (row?.status === "vantar") return redanVantande(groupId, id);
  if (row?.status === "accepterad") return fortfarandeMedlem(groupId, id);
  return `bjudIn: inbjudan ${id} i gruppen "${groupId}" ändrades medan den skrevs (status "${row?.status ?? "saknas"}"). Inget har skrivits över. Försök igen.`;
};

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
  /*
   * ⛔ OCH `updateIf` KRÄVS (0.80.1), AV SAMMA SKÄL. En återkallad eller utgången inbjudan öppnas igen,
   * och två som gör det samtidigt får inte båda lyckas med var sin kod. En läsning följd av en update
   * hade släppt igenom båda.
   */
  if (typeof kalla.updateIf !== "function") {
    throw new Error(
      "createInvitationService: datakällan saknar updateIf. En återkallad inbjudan öppnas igen bara om den fortfarande står som den lästes, och utan ett atomärt villkor kan två återöppningar båda lyckas. Med Admin SDK är updateIf en db.runTransaction, se datakontraktets regel 7.",
    );
  }
  const uppdateraOm = kalla.updateIf;
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
     * @param {{ avUid: string, groupId: string, epost: string, roll?: string, typ?: string, skapadAv?: any, tokenHash?: string }} b
     *   `tokenHash` (0.80.1): SHA-256 i hex av koden appen mejlar, eller utelämnad. Koden själv kommer aldrig hit.
     * @returns {Promise<{ resultat: "medlemskap" | "inbjudan" | "fanns", id: string, ateroppnad?: boolean }>}
     *   `ateroppnad` (0.80.1): `true` när en återkallad eller utgången rad öppnades igen, `false` för en ny rad.
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
       * ══ ⛔ EN INBJUDAN TILL EN ADRESS SOM REDAN HAR EN RAD I GRUPPEN (0.80.1, arkitektens beslut i PR 308) ══
       *
       * Raden för (grupp, adress) avgör, och den hittas på fältet `epost`, aldrig på id:t, så att en rad med
       * det gamla id:t (`${groupId}_${epost}`, före 0.80.1) räknas lika mycket som en med det nya:
       *
       *   ingen rad              createNew, en ny rad med `inbjudningsId`
       *   aterkallad, utgången   raden öppnas igen med updateIf, den skapas inte på nytt
       *   vantar                 kastar: skicka om i stället
       *   accepterad             kastar: personen är redan medlem
       *
       * ⛔ VÄNTANDE KASTAR NU, DET ÅTERANVÄNDS INTE TYST. Före 0.80.1 svarade ett andra klick `fanns`, och
       * den som bjöd in kunde inte se skillnad på "inbjudan finns" och "inbjudan skickades". Ett omutskick
       * är ett eget steg med en ny kod, och det är det felet säger.
       */
      const nyttId = inbjudningsId(groupId, epost);
      const rader = (await kalla.list(INBJUDNINGAR, { where: { epost } })).filter((i) => i.groupId === groupId);
      const rad = rader.find((i) => i.id === nyttId) ?? rader[0];

      /*
       * ⛔ KODEN BYTS VID VARJE NY RUNDA. Ramverket skapar ingen kod: appen skickar in hashen av den kod den
       * mejlar (`tokenHash`), eller ingen, och då står raden utan kod tills appen skickar. Utan hash blir
       * fältet tomt, och en tom hash matchar aldrig något. Den gamla kodens hash överlever alltså aldrig en
       * återöppning: den som fick den förra koden kommer inte in på den.
       */
      const tokenHash = typeof b?.tokenHash === "string" ? b.tokenHash : "";

      if (rad) {
        const status = rad.status;
        const utgangen = status === "vantar" && typeof rad.giltigTill === "string" && Date.parse(rad.giltigTill) <= Date.now();
        if (status === "accepterad") throw new Error(fortfarandeMedlem(groupId, rad.id));
        if (status === "vantar" && !utgangen) throw new Error(redanVantande(groupId, rad.id));
        if (status !== "aterkallad" && !utgangen) {
          throw new Error(`bjudIn: inbjudan ${INBJUDNINGAR}/${rad.id} har statusen "${status}", som ingen gren känner. Inget har skrivits.`);
        }

        /*
         * ⛔ ÖPPNAS MED updateIf, OCH VILLKORET ÄR DET SOM LÄSTES. Två som bjuder in samtidigt läser båda
         * `aterkallad`, och utan villkoret hade båda skrivit, med var sin kod: den ena kodens mejl hade gått
         * ut med en kod som redan inte gällde. Med villkoret vinner en, och den andra får felet att
         * inbjudan redan väntar. För en utgången rad är statusen `vantar` både före och efter, och då
         * ingår den lästa `giltigTill` i villkoret, annars hade villkoret inte skilt de två åt.
         */
        /** @type {Record<string, unknown>} */
        const villkor = { status };
        if (typeof rad.giltigTill === "string") villkor.giltigTill = rad.giltigTill;
        const ny = byggInbjudan({ id: rad.id, epost, groupId, roll, status: "vantar", skapadAv: b.skapadAv ?? {}, tokenHash });
        const data = { status: ny.status, roll: ny.roll, tokenHash: ny.tokenHash, giltigTill: ny.giltigTill, skapadAv: ny.skapadAv };
        const { updated, row } = await uppdateraOm.call(kalla, INBJUDNINGAR, rad.id, villkor, data);
        if (!updated) throw new Error(efterKapplopp(groupId, rad.id, row));
        return { resultat: "inbjudan", id: rad.id, ateroppnad: true };
      }

      /*
       * ⛔ SKAPAS MED `createNew` OCH ALDRIG MED `create` (0.80.1). En rad som dykt upp sedan listningen
       * skrivs inte över: den som hann först vinner, och felet säger vad som står där nu.
       */
      const inbjudan = byggInbjudan({
        id: nyttId,
        epost,
        groupId,
        roll,
        status: "vantar",
        skapadAv: b.skapadAv ?? {},
        tokenHash,
      });
      const { created, row } = await skapaNy.call(kalla, INBJUDNINGAR, inbjudan);
      if (!created) throw new Error(efterKapplopp(groupId, inbjudan.id, row));
      return { resultat: "inbjudan", id: inbjudan.id, ateroppnad: false };
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
