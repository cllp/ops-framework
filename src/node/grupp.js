/**
 * Den första gruppen: vitlista och `skapaGrupp`, båda på serversidan (#160, #161).
 *
 * ══ ⛔ VARFÖR SERVERSIDAN OCH INTE KLIENTEN, SAMMA SKÄL SOM inbjudan.js ═══
 *
 * `groups` skrivs av ägaren enligt `regelfragment()`, men den FÖRSTA gruppen
 * har per definition ingen ägare än: `opsArAgare(gid)` slår upp ett
 * medlemskap som inte finns förrän gruppen finns. En klient som fick skapa sin
 * första grupp själv hade alltså behövt en egen regelgren för "ingen är ägare
 * än", och den grenen är exakt den lucka en vitlista finns för att stänga:
 * VEM som får skapa något över huvud taget, innan frågan om ägarskap ens
 * ställs. Samma serversida som skriver `memberships` (#136) skriver därför
 * också den första gruppen och det första medlemskapet.
 *
 * ══ ⛔ VITLISTAN KONTROLLERAS HÄR, INTE BARA I EN REGEL SOM INTE FINNS ════
 *
 * `regelfragment()` nekar en klient ALL åtkomst till vitlistan (`allow read,
 * write: if false`), så det finns ingen regelgren att luta sig mot: hela
 * kontrollen ligger i den här funktionen. Det är samma mönster som
 * `kravAgare` i `inbjudan.js`, av samma skäl: en callable kör med Admin SDK,
 * alltså FÖRBI reglerna, och en kontroll som bara stod i regler.js hade gjort
 * den här funktionen till en väg runt dem.
 *
 * ══ ⛔ EN PERSON, EN GRUPP, TILLS #162 ÄR KLAR ═══════════════════════════
 *
 * CP 2026-09-28 (#161): delning mellan grupper finns inte än. Att låta någon
 * skapa grupp nummer två redan i dag hade sparat en rad ingen yta i appen kan
 * visa: gruppväljaren och panelen bygger på `minaGrupper`, men appens NAV och
 * datamodell för att arbeta i flera grupper samtidigt är #162, inte det här
 * ärendet. Spärren är alltså inte ett godtyckligt "en är nog", den är "den
 * andra halvan finns inte att skriva in i ännu".
 *
 * ══ ⛔ "SAMMA BATCH" ÄR SEKVENSIELLA ANROP, INTE EN TRANSAKTION ══════════
 *
 * Datalagrets kontrakt (`src/data/contract.js`) har ingen batch- eller
 * transaktionsoperation, bara `read`/`list`/`create`/`update`/`remove`.
 * `skapaGrupp` skriver gruppen och sedan ägarens medlemskap, i den ordningen,
 * innan funktionen returnerar, precis som `uppdateraProfil` (`profil.js`)
 * skriver `users` och sedan `memberships` "i samma steg". Ett riktigt
 * transaktionellt skydd mot en krasch mitt emellan de två skrivningarna finns
 * inte i den här versionen, och det ska inte stå här och låtsas göra det.
 *
 * ══ ⛔ RAMVERKET KÄNNER INGEN DATABAS ═════════════════════════════════
 *
 * Datakällan skickas in, precis som `createInvitationService`. Det är också
 * det som gör att det här går att prova utan nätverk: minneskällan räcker.
 */

import { byggGrupp, byggMedlemskap, byggVitlisterad, medlemskapsId } from "../lib/grupp.js";
import { byggSkapare } from "../lib/skapare.js";

/** @param {unknown} v @returns {string} */
const epostform = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Ett grupp-id ur ett namn: en slug plus en kort, unik svans.
 *
 * ⛔ SVANSEN OCH INTE BARA SLUGEN. Två grupper som heter samma sak ("Bolaget")
 * ska kunna finnas, och en slug utan svans hade gjort den andra till en
 * krock `kalla.create` löser genom att TYSTA ERSÄTTA den första (se
 * `DataSource.create` i contract.js: "Med ett eget id ERSÄTTER den posten som
 * redan har det id:t, utan att säga ifrån"). Den tystnaden är precis den
 * ramverket aldrig ska producera för en förstagångsskapare.
 *
 * ⛔ INGEN SVENSK BOKSTAV I ID:T. `ID_FORM` (katalog.js) släpper bara
 * `[a-z0-9_-]`, så "Åkeriet" måste bli "akeriet" innan kontrollen, inte
 * kastas för att namnet är svenskt. `normalize("NFKD")` pluss borttagning av
 * diakritiska tecken gör "å" till "a" i stället för att tappa bokstaven helt.
 *
 * @param {string} namn
 * @returns {string}
 */
function grupp_id(namn) {
  const bas = namn
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const svans = Math.random().toString(36).slice(2, 8);
  return `${bas || "grupp"}-${svans}`;
}

/**
 * @typedef {object} Samlingar
 * @property {string} [grupper] Förval `groups`.
 * @property {string} [medlemskap] Förval `memberships`.
 * @property {string} [vitlista] Förval `vitlista`.
 */

/**
 * Bygger `skapaGrupp`. En fabrik och inte en lös funktion, samma skäl som
 * `createInvitationService`: den behöver en datakälla och samlingsnamn, och
 * ett anrop som tar emot båda är ett ställe de kan skrivas olika.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla
 * @param {Samlingar} [konfig.samlingar]
 * @returns {{ skapaGrupp: (b: { uid: string, epost: string, namn: string, skapadAv?: any }) => Promise<import("../lib/grupp.js").Grupp> }}
 */
export function createGroupService(konfig) {
  const { kalla, samlingar = {} } = konfig ?? {};
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.list !== "function" || typeof kalla.create !== "function") {
    throw new Error("createGroupService: en datakälla med read, list och create krävs. Ramverket känner ingen databas.");
  }
  const GRUPPER = samlingar.grupper ?? "groups";
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";
  const VITLISTA = samlingar.vitlista ?? "vitlista";

  return {
    /**
     * Skapar den inloggades FÖRSTA grupp, från ett namn.
     *
     * @param {{ uid: string, epost: string, namn: string, skapadAv?: any }} b
     * @returns {Promise<import("../lib/grupp.js").Grupp>}
     */
    async skapaGrupp(b) {
      const uid = rensa(b?.uid);
      const epost = epostform(b?.epost);
      const namn = rensa(b?.namn);
      if (!uid) throw new Error("skapaGrupp: uid krävs.");
      if (!epost) throw new Error("skapaGrupp: epost krävs. Det är den som kontrolleras mot vitlistan, inte uid.");
      if (!namn) throw new Error("skapaGrupp: namn krävs. Gruppen skapas från ETT namn, inget annat.");

      /*
       * ⛔ VITLISTAN KONTROLLERAS FÖRST, INNAN NÅGOT ANNAT. En person som inte
       * är vitlistad ska aldrig se hur långt resten av valideringen kommer.
       */
      const vitlisterad = await kalla.read(VITLISTA, epost);
      if (!vitlisterad) {
        throw new Error(`skapaGrupp: "${epost}" står inte på vitlistan. Bara vitlistade adresser får skapa en grupp.`);
      }

      /*
       * ⛔ EN GRUPP PER PERSON, TILLS #162. Se filhuvudet: delning mellan
       * grupper är ett annat ärende, och att tillåta grupp nummer två i dag
       * hade skrivit in ett tillstånd appen ännu inte har någon yta för.
       */
      const befintliga = (await kalla.list(MEDLEMSKAP, { where: { userId: uid } })).filter((m) => m.status === "aktiv");
      if (befintliga.length > 0) {
        throw new Error(
          `skapaGrupp: ${uid} är redan aktiv medlem i ${befintliga.length} grupp(er). En andra grupp per person väntar på #162, delning mellan grupper.`,
        );
      }

      const id = grupp_id(namn);
      const grupp = byggGrupp({
        id,
        namn: { sv: namn, en: namn },
        moduler: [],
        arkiverad: false,
        skapadAv: byggSkapare({ uid, namn, typ: "manniska", kalla: "skapaGrupp", ...(b.skapadAv ?? {}) }),
      });
      await kalla.create(GRUPPER, grupp);

      /*
       * ⛔ ÄGARENS MEDLEMSKAP SKRIVS EFTER GRUPPEN, INTE FÖRE. Ett medlemskap
       * som pekar på en grupp som inte finns är en rad ingen regel kan
       * kontrollera (opsArAgare läser gruppen genom medlemskapet, inte
       * tvärtom), så ordningen är den enda som ger ett konsekvent mellanläge
       * om något går fel mellan de två skrivningarna. Se filhuvudet om varför
       * de två ändå inte är en riktig transaktion.
       */
      const medlemskap = byggMedlemskap({ userId: uid, groupId: id, roll: "agare", typ: "person", status: "aktiv", namn, bild: "" });
      await kalla.create(MEDLEMSKAP, medlemskap);

      return grupp;
    },
  };
}

/*
 * ⛔ ÅTEREXPORTERADE HÄRIFRÅN, INTE BARA UR HUVUDINGÅNGEN. `byggVitlisterad`
 * bygger raden SKRIVNINGEN av vitlistan behöver (appens inställningsvy för
 * #161/#162, med Admin SDK), och `medlemskapsId` är nyckeln den skrivningen
 * härleder för ägarens medlemskap. Båda finns redan i huvudingången, men en
 * nodfunktion som skriver vitlistan ska inte behöva dra in React för ett
 * hjälpnamn den redan importerar grannen till.
 */
export { byggVitlisterad, medlemskapsId };
