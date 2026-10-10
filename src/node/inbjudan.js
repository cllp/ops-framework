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
 * 1. Ägaren (eller en admin, 0.32.0) bjuder in med e-post. Det skrivs alltid en rad i `invitations`,
 *    också när personen redan har ett konto (0.82.0, #313, se `bjudIn`).
 * 2. Vid inloggning anropar klienten en gång "acceptera mina inbjudningar".
 *    Serversidan matchar den inloggades verifierade e-post mot väntande
 *    inbjudningar och skriver medlemskapen.
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

/**
 * ⛔ INTE "REDAN MEDLEM" (granskningen av PR 308, B2). En accepterad rad säger bara att accepten tog raden, inte att
 * medlemskapet skrevs, så felet påstår inget om medlemskapet.
 * @param {string} groupId @param {string} id
 */
const accepteradesUnderTiden = (groupId, id) =>
  `bjudIn: inbjudan ${id} i gruppen "${groupId}" accepterades medan den skrevs. Inget har skrivits över. Bjud in igen om personen inte kommit in.`;

/**
 * Är en väntande inbjudan utgången? En rad utan `giltigTill` (skriven före 0.32.0) räknas som giltig.
 *
 * ⛔ EN DEFINITION FÖR BÅDE `bjudIn` OCH ACCEPTEN (0.80.1, granskningen av PR 308, K1). Räknade de olika
 * kunde en inbjudan vara för gammal för att bjudas in igen och ändå ny nog att accepteras.
 *
 * @param {Record<string, any>} rad
 * @param {number} [nu]
 */
const arUtgangen = (rad, nu = Date.now()) =>
  rad.status === "vantar" && typeof rad.giltigTill === "string" && Date.parse(rad.giltigTill) <= nu;

/**
 * Vilken rad som är raden för (grupp, adress) när det finns flera, och det kan det göra: en gammal med id:t
 * `${groupId}_${epost}` och en ny med `inbjudningsId`.
 *
 * ⛔ DETERMINISTISKT, INTE LISTNINGENS ORDNING (0.80.1, granskningen av PR 308, K2). En giltig väntande rad
 * går först, sedan en accepterad, sedan en utgången och sist en återkallad. Svaret beror alltså inte på vilken
 * rad databasen råkade lista först, och en giltig väntande rad gör aldrig att en annan rad öppnas bredvid den.
 * Inom samma sort går det nya id:t först, sedan id:t i bokstavsordning.
 *
 * @param {Array<Record<string, any>>} rader
 * @param {string} nyttId
 * @param {number} [nu]
 */
const raden = (rader, nyttId, nu = Date.now()) => {
  /** @param {Record<string, any>} r */
  const sort = (r) => (r.status === "vantar" && !arUtgangen(r, nu) ? 0 : r.status === "accepterad" ? 1 : arUtgangen(r, nu) ? 2 : r.status === "aterkallad" ? 3 : 4);
  return [...rader].sort((a, b) => sort(a) - sort(b) || Number(b.id === nyttId) - Number(a.id === nyttId) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
};

/**
 * Felet när någon annan hann skriva raden mellan läsningen och skrivningen.
 * @param {string} groupId @param {string} id @param {Record<string, any> | null | undefined} row
 */
const efterKapplopp = (groupId, id, row) => {
  if (row?.status === "vantar") return redanVantande(groupId, id);
  if (row?.status === "accepterad") return accepteradesUnderTiden(groupId, id);
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
  return inbjudningstjanst(konfig, "createInvitationService");
}

/**
 * Själva fabriken, med namnet på den tjänst som byggs.
 *
 * ⛔ NAMNET STÅR I VARJE FEL (0.80.1, granskningen av PR 308, K4). `createGroupService` bygger den här
 * tjänsten inuti sig, och ett fel som sade `createInvitationService` pekade då på en fabrik appen aldrig
 * anropat. Felet ska namnge det appen faktiskt skrev.
 *
 * @param {any} konfig
 * @param {string} namn
 * @returns {{ bjudIn: (b: any) => Promise<any>, accepteraInbjudningar: (b: any) => Promise<any> }}
 */
export function inbjudningstjanst(konfig, namn) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN OCH INTE I PARAMETERLISTAN, och det
   * är ett vaktfynd. `check-config-requirements` fällde den första versionen:
   * med `({ kalla })` i signaturen kastar Node "Cannot destructure property
   * 'kalla' of 'undefined'" INNAN valideringen hinner köra, alltså ett fel som
   * inte nämner fabriken och inte säger vad appen glömde.
   */
  const { kalla, samlingar = {} } = konfig ?? {};
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.list !== "function" || typeof kalla.create !== "function") {
    throw new Error(`${namn}: en datakälla med read, list och create krävs. Ramverket känner ingen databas.`);
  }
  /*
   * ⛔ `createNew` KRÄVS (0.80.1), OCH DET PRÖVAS NÄR TJÄNSTEN BYGGS. En inbjudan skrivs aldrig över:
   * `create` med ett eget id ersätter posten (datakontraktet), och det var så en grupps inbjudan skrev
   * över en annans. Ett tyst fall tillbaka på `create` hade varit den luckan kvar under ett nytt namn,
   * och en läsning före `create` är den läs-sedan-skriv-kontroll regel 2 förbjuder.
   */
  if (typeof kalla.createNew !== "function") {
    throw new Error(
      `${namn}: datakällan saknar createNew. En inbjudan får aldrig skriva över en befintlig rad, och en källa som bara kan ersätta gör det. Med Admin SDK är createNew ref.create(), som avvisar ett dokument som redan finns. Se datakontraktets regel 8.`,
    );
  }
  /*
   * ⛔ ANROPEN GÅR TILL KÄLLAN VARJE GÅNG, METODEN FÅNGAS INTE VID BYGGET. En källa som byts ut eller lindas in
   * efteråt (en spårning, ett prov som injicerar ett fel) ska träffas av samma anrop som `read` och `list`.
   */
  /** @type {(samling: string, data: any) => Promise<{ created: boolean, row: any }>} */
  const skapaNy = (samling, data) => kalla.createNew(samling, data);
  /*
   * ⛔ OCH `updateIf` KRÄVS (0.80.1), AV SAMMA SKÄL. En återkallad eller utgången inbjudan öppnas igen,
   * och två som gör det samtidigt får inte båda lyckas med var sin kod. En läsning följd av en update
   * hade släppt igenom båda.
   */
  if (typeof kalla.updateIf !== "function") {
    throw new Error(
      `${namn}: datakällan saknar updateIf. En återkallad inbjudan öppnas igen bara om den fortfarande står som den lästes, och utan ett atomärt villkor kan två återöppningar båda lyckas. Med Admin SDK är updateIf en db.runTransaction, se datakontraktets regel 7.`,
    );
  }
  /** @type {(samling: string, id: string, villkor: Record<string, unknown>, data: any) => Promise<{ updated: boolean, row: any }>} */
  const uppdateraOm = (samling, id, villkor, data) => kalla.updateIf(samling, id, villkor, data);
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
     * @param {{ avUid: string, groupId: string, epost: string, roll?: string, skapadAv?: any, tokenHash?: string }} b
     *   ⛔ `typ` FINNS INTE LÄNGRE (0.82.0, #313), och ett anrop som ändå skickar den kastar. Den bestämde typen på
     *   medlemskapet grenen för en befintlig person skrev, och den grenen är borttagen. Accepten skriver `typ: "person"`.
     *   `tokenHash` (0.80.1): SHA-256 i hex av koden appen mejlar, eller utelämnad. Koden själv kommer aldrig hit.
     * @returns {Promise<{ resultat: "inbjudan", id: string, ateroppnad: boolean, fran?: string }>}
     *   ⛔ ALLTID `inbjudan` SEDAN 0.82.0 (#313). `medlemskap` och `fanns` kom ur grenen som litade på `users.epost`, och
     *   den finns inte längre.
     *   `ateroppnad` (0.80.1): `true` när en befintlig rad öppnades igen, `false` för en ny rad. `fran` säger vad raden
     *   var: `aterkallad`, `utgangen` eller `accepterad`. Den sista betyder att personen kanske redan är med.
     */
    async bjudIn(b) {
      const avUid = typeof b?.avUid === "string" ? b.avUid.trim() : "";
      const groupId = typeof b?.groupId === "string" ? b.groupId.trim() : "";
      const epost = epostform(b?.epost);
      if (!avUid) throw new Error("bjudIn: avUid krävs, alltså vem som bjuder in. Utan den går ägarskapet inte att kontrollera.");
      if (!groupId) throw new Error("bjudIn: groupId krävs.");
      if (!epost) throw new Error("bjudIn: epost krävs. Det är det enda en inbjudan har att matcha på innan personen finns.");

      /*
       * ⛔ `typ` KASTAR, DEN IGNORERAS INTE (0.82.0, granskningen av PR 314, KAN 4). Den bestämde typen på medlemskapet
       * grenen för en befintlig användare skrev, och grenen är borttagen (#313). En app som ändå skickar den tror att
       * värdet hamnar någonstans, och ett tyst bortfall ser ut som att allt gick bra (regel 5).
       */
      if ((/** @type {any} */ (b))?.typ !== undefined) {
        throw new Error(
          `bjudIn: typ togs bort i 0.82.0 (#313). Den styrde bara medlemskapet som bjudIn skrev direkt, och bjudIn skriver inget medlemskap längre: accepten skriver typ "person". Ta bort typ ur anropet.`,
        );
      }

      const roll = b.roll ?? "medlem";
      await kravBehorighet(avUid, groupId, roll);

      /*
       * ══ ⛔ INGEN GREN FÖR "PERSONEN FINNS REDAN" (0.82.0, #313) ══
       *
       * Före 0.82.0 slog `bjudIn` upp adressen i `users` med `where epost ==`, och fanns en rad skrevs
       * medlemskapet direkt, med inbjudans roll. Fältet bevisade ingenting: förvalets regel lät klienten
       * skriva vilken adress som helst i sin egen rad, och en app vars serverspegel sparade en overifierad
       * adress (lifehub, mätt i granskningen av lifehub.app#117) gjorde samma sak från serversidan. Mätt i
       * emulatorn: en overifierad växling med offrets adress, följd av `bjudIn` som `agare`, gav angriparen
       * medlemskapet `roll: "agare"`.
       *
       * ⛔ GRENEN ÄR BORTTAGEN, INTE SKYDDAD AV ETT FÄLT TILL. Ett fält som `epostVerifierad: true` i
       * `users` hade varit en ny uppgift om personen, skriven av en spegel ramverket inte äger, och en app
       * som glömde den hade varit lika öppen som förut (regel 13: det som gör modellen tyngre stryks). Nu går
       * varje inbjudan samma väg: en rad i `invitations`, som blir ett medlemskap först när personen själv
       * loggar in och `accepteraInbjudningar` får adressen ur inloggningen, med `epostVerifierad: true`.
       * Adressen bevisas av den som äger brevlådan, aldrig av en rad i databasen.
       *
       * ⛔ DET HÄR KOSTAR NÅGOT, OCH DET ÄR RÄTT PRIS. En person som redan har ett konto blir medlem vid
       * nästa accept och inte i samma sekund, och en adress som redan är medlem får en väntande rad i stället
       * för svaret `fanns`. Accepten rör inte ett aktivt medlemskap, så ingen roll höjs för den som redan
       * är med. Ett avslutat medlemskap återaktiveras vid accepten (0.91.0, #317).
       */

      /*
       * ══ ⛔ EN INBJUDAN TILL EN ADRESS SOM REDAN HAR EN RAD I GRUPPEN (0.80.1, arkitektens beslut i PR 308) ══
       *
       * Raden för (grupp, adress) avgör, och den hittas på fältet `epost`, aldrig på id:t, så att en rad med
       * det gamla id:t (`${groupId}_${epost}`, före 0.80.1) räknas lika mycket som en med det nya:
       *
       *   ingen rad              createNew, en ny rad med `inbjudningsId`
       *   aterkallad, utgången   raden öppnas igen med updateIf, den skapas inte på nytt
       *   vantar                 kastar: skicka om i stället
       *   accepterad             raden öppnas igen, se nedan
       *
       * ⛔ VÄNTANDE KASTAR NU, DET ÅTERANVÄNDS INTE TYST. Före 0.80.1 svarade ett andra klick `fanns`, och
       * den som bjöd in kunde inte se skillnad på "inbjudan finns" och "inbjudan skickades". Ett omutskick
       * är ett eget steg med en ny kod, och det är det felet säger.
       */
      const nyttId = inbjudningsId(groupId, epost);
      const rader = (await kalla.list(INBJUDNINGAR, { where: { epost } })).filter((/** @type {Record<string, any>} */ i) => i.groupId === groupId);
      const rad = raden(rader, nyttId);

      /*
       * ⛔ KODEN BYTS VID VARJE NY RUNDA. Ramverket skapar ingen kod: appen skickar in hashen av den kod den
       * mejlar (`tokenHash`), eller ingen, och då står raden utan kod tills appen skickar. Utan hash blir
       * fältet tomt, och en tom hash matchar aldrig något. Den gamla kodens hash överlever alltså aldrig en
       * återöppning: den som fick den förra koden kommer inte in på den.
       */
      const tokenHash = typeof b?.tokenHash === "string" ? b.tokenHash : "";

      if (rad) {
        const status = rad.status;
        const utgangen = arUtgangen(rad);
        if (status === "vantar" && !utgangen) throw new Error(redanVantande(groupId, rad.id));
        /*
         * ⛔ EN ACCEPTERAD RAD ÖPPNAS IGEN, DEN SÄGER INTE "REDAN MEDLEM" (0.80.1, granskningen av PR 308, B2).
         * `bjudIn` vet inte vem adressen tillhör (0.82.0, #313: den slår inte upp `users`), alltså inget uid,
         * och utan uid går medlemskapet inte att slå upp. "Redan medlem" vore därför ett påstående ingen kontrollerat, och det är osant just i det
         * halva läget: inbjudan står `accepterad` men medlemskapet skrevs aldrig, för att processen dog
         * mellan anspråket och skrivningen. Då hade personen aldrig kommit in, och den som bjöd in hade fått
         * höra att hen redan var med.
         *
         * Att öppna raden igen är det säkra valet, för det ger aldrig mer än den som bjuder in får ge nu
         * (`kravBehorighet` ovan). Saknas medlemskapet skrivs det vid nästa accept med den nya rollen.
         * Ett aktivt medlemskap rör accepten inte, så ingen roll höjs för den som redan är med.
         * Ett avslutat medlemskap återaktiveras (0.91.0, #317, CP 2026-10-08): en ny inbjudan från ägare
         * eller admin är ett uttryckligt val, och accepten sätter status till aktiv och rollen till
         * inbjudans, med `updateIf` på status `avslutad`. Svaret säger `fran: "accepterad"`, vilket kan
         * betyda att personen redan är med, att hen har tagits bort och kommer in igen vid accepten,
         * eller att medlemskapet aldrig skrevs.
         */
        if (status !== "aterkallad" && status !== "accepterad" && !utgangen) {
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
        const { updated, row } = await uppdateraOm(INBJUDNINGAR, rad.id, villkor, data);
        if (!updated) throw new Error(efterKapplopp(groupId, rad.id, row));
        return { resultat: "inbjudan", id: rad.id, ateroppnad: true, fran: utgangen ? "utgangen" : status };
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
      const { created, row } = await skapaNy(INBJUDNINGAR, inbjudan);
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
     * @param {{ uid: string, epost: string, epostVerifierad: boolean, namn?: string }} b
     *   `namn`: den inloggades namn ur inloggningen. Används BARA när profilraden saknar namn (0.40.1, #218).
     *   `epostVerifierad` (0.82.0, #313): `request.auth.token.email_verified`, rakt ur inloggningen. Krävs och måste vara `true`.
     * @returns {Promise<{ accepterade: string[], utgangna: string[] }>}
     *   `accepterade`: grupper där den här körningen skrev ett nytt medlemskap eller återaktiverade ett avslutat.
     *   Ett medlemskap som redan var aktivt står inte här. Tom lista, aldrig utelämnad.
     *   `utgangna` (0.80.1): grupperna vars väntande inbjudan hade gått ut och därför inte accepterades. Tom lista, aldrig utelämnad.
     */
    async accepteraInbjudningar(b) {
      const uid = typeof b?.uid === "string" ? b.uid.trim() : "";
      const epost = epostform(b?.epost);
      if (!uid) throw new Error("accepteraInbjudningar: uid krävs.");
      if (!epost) throw new Error("accepteraInbjudningar: epost krävs, den inloggades. Det är den inbjudningarna matchas mot.");
      /*
       * ⛔ ADRESSEN MÅSTE VARA VERIFIERAD, OCH RAMVERKET FRÅGAR (0.82.0, #313). Sedan `bjudIn` inte längre skriver
       * medlemskapet direkt är accepten den enda vägen in, och adressen är det enda den matchar på. Ett konto med
       * e-post och lösenord kan skapas på vilken adress som helst utan att brevlådan öppnats, och en accept på en
       * sådan adress ger offrets inbjudan, med dess roll, åt den som skapade kontot.
       *
       * ⛔ FLAGGAN KRÄVS, DEN FÖRVALS INTE. Ett förval på `true` hade låtit en app som aldrig läste token vara lika
       * öppen som förut utan att något sade det, och ett förval på `false` hade gjort varje accept tom i tysthet
       * (regel 5). Saknas den, eller är den något annat än `true`, kastar accepten och säger varför.
       */
      if (b?.epostVerifierad !== true) {
        throw new Error(
          `accepteraInbjudningar: adressen "${epost}" är inte verifierad (epostVerifierad är ${b?.epostVerifierad === false ? "false" : "inte satt"}). Ingen inbjudan accepteras på en adress som inte bevisats. Skicka request.auth.token.email_verified, och be personen verifiera adressen.`,
        );
      }

      /*
       * ⛔ EN UTGÅNGEN INBJUDAN ACCEPTERAS INTE (0.80.1, granskningen av PR 308, K1a). Före 0.80.1 blev en
       * väntande rad ett medlemskap hur gammal den än var, med den roll den bar när den skrevs. Samma
       * `arUtgangen` som `bjudIn`, och de utgångna står i svaret (`utgangna`) i stället för att tyst falla bort.
       */
      const nu = Date.now();
      /** @type {Array<Record<string, any>>} */
      const listade = (await kalla.list(INBJUDNINGAR, { where: { epost } })).filter((/** @type {Record<string, any>} */ i) => i.status === "vantar");
      const vantande = listade.filter((i) => !arUtgangen(i, nu));
      const utgangna = listade.filter((i) => arUtgangen(i, nu)).map((i) => i.groupId);

      /** @type {string[]} */
      const accepterade = [];
      /** @type {Record<string, any> | null | undefined} `undefined` = inte läst än, `null` = finns inte. */
      let anvandaren;
      for (const inbjudan of vantande) {
        const id = medlemskapsId(uid, inbjudan.groupId);

        /*
         * ⛔ ANSPRÅKET FÖRST, MEDLEMSKAPET SEDAN (0.80.1, granskningen av PR 308, K1b). Före 0.80.1 lästes
         * raden, medlemskapet skrevs och raden fick sedan en vanlig `update` till `accepterad`. Återkallades
         * inbjudan mellan läsningen och skrivningen blev personen ändå medlem, och `update` skrev över
         * `aterkallad`: mätt av granskaren, återkallelsen försvann. Nu tar accepten raden med `updateIf` på
         * det som lästes (status, roll och giltigTill), och bara den som vinner skriver medlemskapet.
         *
         * ⛔ ORDNINGEN ÄR VALD, OCH DEN HAR ETT HALVT LÄGE. Den omvända ordningen (medlemskapet först) är
         * felet ovan. Med anspråket först är det halva läget en inbjudan som står `accepterad` utan att
         * medlemskapet skrevs, om skrivningen av medlemskapet faller. Då lämnas raden tillbaka till `vantar`,
         * med samma villkorade skrivning, så att nästa inloggning försöker igen, och felet går vidare till
         * anroparen. Faller också återlämningen går felet vidare ändå: det halva läget syns, det tystas inte.
         * Ett medlemskap utan inbjudan hade varit värre än en inbjudan utan medlemskap, för det ger åtkomst.
         */
        /** @type {Record<string, unknown>} */
        const villkor = { status: "vantar" };
        if (inbjudan.roll !== undefined) villkor.roll = inbjudan.roll;
        if (typeof inbjudan.giltigTill === "string") villkor.giltigTill = inbjudan.giltigTill;
        const { updated } = await uppdateraOm(INBJUDNINGAR, inbjudan.id, villkor, { status: "accepterad" });
        if (!updated) continue;

        /*
         * ⛔ ALLT EFTER ANSPRÅKET LIGGER I SAMMA try (granskningen av PR 308, B2). Före rättelsen låg läsningen
         * av medlemskapet utanför, och ett tillfälligt fel där lämnade raden `accepterad` utan medlemskap: nästa
         * inloggning gjorde ingenting, eftersom raden inte längre väntade. Nu lämnas raden tillbaka till
         * `vantar` vid varje fel, och nästa inloggning försöker igen.
         *
         * ⛔ ÅTERLÄMNINGEN ÄR OCKSÅ VILLKORAD: bara en rad som fortfarande står `accepterad` lämnas tillbaka.
         * Har någon återkallat den under tiden står återkallelsen kvar.
         *
         * ⛔ DET SOM ÅTERSTÅR: dör processen mellan anspråket och medlemskapet hinner ingen återlämning köras,
         * och raden står `accepterad` utan medlemskap. Det läget repareras av `bjudIn`, som öppnar en
         * accepterad rad igen, och av att personen loggar in igen efter det. Se README.
         */
        let ny = false;
        try {
          /*
           * ⛔ TRE UTFALL, OCH INBJUDAN ÄR REDAN ACCEPTERAD (0.91.0, #317).
           *   ingen rad        createNew, som förut
           *   status aktiv     rörs inte: ingen roll höjs för den som redan är med
           *   status avslutad  updateIf till aktiv, med inbjudans roll. Villkoret är status avslutad,
           *                    så en rad som hunnit bli aktiv mellan läsningen och skrivningen står kvar
           *                    med den roll den fick då
           *
           * Inbjudan markeras accepterad ovan i alla tre, annars ligger raden kvar som "vantar" och räknas
           * varje inloggning. Bara en ny rad och en återaktivering hamnar i `accepterade`, så att en
           * inloggning som släppte in personen syns i svaret.
           */
          const tidigare = await kalla.read(MEDLEMSKAP, id);
          if (!tidigare) {
            /*
             * ⛔ PROFILEN LÄSES EN GÅNG, INTE EN GÅNG PER INBJUDAN. Den som
             * bjudits in till tre grupper ska inte kosta tre läsningar av samma
             * rad, och alla tre medlemskapen ska dessutom bära samma namn.
             */
            if (anvandaren === undefined) anvandaren = (await kalla.read(ANVANDARE, uid)) ?? null;
            /*
             * ⛔ createNew OCH INTE create (granskningen av PR 308, K3). Två rader som väntar för samma grupp,
             * en gammal och en ny eller två accepter samtidigt, får inte skriva över varandras medlemskap: den
             * som hann först står kvar, med sin roll.
             */
            const { created } = await skapaNy(
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
            ny = created;
          } else if (tidigare.status === "avslutad") {
            /*
             * ⛔ updateIf PÅ STATUS, INTE EN VANLIG update (CP 2026-10-08, #317). Mellan läsningen och
             * skrivningen kan raden ha blivit aktiv, till exempel av en samtidig accept. Utan villkoret
             * hade den skrivningen skrivits över med inbjudans roll. Stämmer villkoret inte, och raden
             * inte är aktiv, lämnas inbjudan tillbaka: annars är den förbrukad och personen är fortfarande
             * ute, samma tysta läge som före rättelsen.
             */
            const roll = typeof inbjudan.roll === "string" && inbjudan.roll ? inbjudan.roll : tidigare.roll;
            const { updated } = await uppdateraOm(MEDLEMSKAP, id, { status: "avslutad" }, { status: "aktiv", roll });
            if (updated) {
              ny = true;
            } else {
              const nuvarande = await kalla.read(MEDLEMSKAP, id);
              if (nuvarande?.status !== "aktiv") {
                const lage = nuvarande?.status ?? "borta";
                throw new Error(
                  `accepteraInbjudningar: medlemskapet i gruppen "${inbjudan.groupId}" står "${lage}" och kunde inte återaktiveras från avslutad. Inbjudan lämnas tillbaka.`,
                );
              }
            }
          }
        } catch (fel) {
          /*
           * ⛔ DET URSPRUNGLIGA FELET FÖRSVINNER INTE (omgranskningen av 42d8f1e, K5). Kastar också återlämningen
           * hade dess fel annars ersatt orsaken. Då bär det nya felet båda meddelandena, säger att raden står
           * `accepterad` utan medlemskap och hur det repareras, och har det ursprungliga felet som `cause`.
           */
          try {
            await uppdateraOm(INBJUDNINGAR, inbjudan.id, { status: "accepterad" }, { status: "vantar" });
          } catch (aterFel) {
            const orsak = fel instanceof Error ? fel.message : String(fel);
            const aterOrsak = aterFel instanceof Error ? aterFel.message : String(aterFel);
            throw new Error(
              `accepteraInbjudningar: medlemskapet i gruppen "${inbjudan.groupId}" kunde inte skrivas (${orsak}), och inbjudan ${inbjudan.id} kunde inte lämnas tillbaka (${aterOrsak}). Den står accepterad utan medlemskap. Bjud in adressen igen för att reparera.`,
              { cause: fel },
            );
          }
          throw fel;
        }
        if (ny) accepterade.push(inbjudan.groupId);
      }
      return { accepterade, utgangna };
    },
  };
}
