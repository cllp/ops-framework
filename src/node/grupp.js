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
 * ══ ⛔ EN PERSON KAN SKAPA FLERA GRUPPER (0.32.0, #180, #162) ═════════════
 *
 * Före 0.32.0 nekade `skapaGrupp` den som redan var aktiv medlem i en grupp: delning mellan grupper
 * var #162 och panelen hade ingen yta för grupp nummer två. Ytan finns nu (gruppanelen, växlaren,
 * "Skapa grupp" i huvudets plus), och spärren är borttagen i stället för att stå kvar som ett
 * påstående om en begränsning som inte längre finns. Vitlistan är fortfarande grinden: FÅR du skapa
 * grupper är en fråga om vem du är, inte om hur många du redan har.
 *
 * ══ ⛔ DEN FÖRSTA EGNA GRUPPEN KAN VARA FRI (0.51.0, cllp/lifehub.app#21) ════════════════════
 *
 * CP 2026-10-04: "Saknar man grupp ska man kunna skapa en egen, och den fungerar som en vanlig grupp.
 * Första gruppen är gratis, utan prenumeration och utan paywall." Med vitlistan som enda grind kunde en
 * privatperson logga in och sedan inte göra någonting: hen stod inte på listan, och ingen grupp väntade.
 *
 * ⛔ `forstaGruppenFri` ÄR APPENS VAL OCH FÖRVALET ÄR AV. En app som inte säger något beter sig som förut,
 * alltså öppnar ingen ny väg in av sig själv. Är valet på får den som ALDRIG har ägt en grupp skapa en,
 * utan vitlista och utan e-post (en inloggning via custom token bär ingen adress). Den andra gruppen går
 * genom vitlistan som förut: "FÅR du skapa grupper" är fortfarande frågan, bara inte för den första.
 *
 * ⛔ "ALDRIG ÄGT" OCH INTE "INGEN AKTIV". Ett avslutat ägarskap räknas, annars hade fri grupp nummer två
 * bara varit att lämna den första. Raderna läses med `userId == uid`, samma fråga som `minaGrupper`.
 *
 * ══ ⛔ VITLISTAN GÅR ATT STÄNGA AV (0.59.0) ═════════════════════════════════
 *
 * `forstaGruppenFri` betyder fortfarande bara den första egna gruppen, och den frågan ställs bara när
 * vitlistan krävs. Förvalet är att den krävs: en app som inte säger något beter sig som förut.
 *
 * ⛔ `vitlistaKravs: false` är appens val att inte rådfråga vitlistan alls, tills betalning finns och
 * grinden ska på igen. Då krävs varken en rad i `vitlista` eller e-post på anropet, för den första
 * gruppen och för varje grupp efter den. Samlingen, reglerna och `byggVitlisterad` står kvar. Funktionen
 * tas inte bort: appen slår av kravet, och slår på det igen när betalningen finns.
 *
 * ⛔ `moduler` ÄR APPARNA EN NY GRUPP BÖRJAR MED (0.51.0). Utan dem fick varje ny grupp `moduler: []`, och
 * en grupp vars hub är tom ser trasig ut och inte tom. Appen skickar in id:n, ramverket gissar inga, och
 * listan prövas när tjänsten byggs med samma `byggGrupp` som skrivvägen.
 *
 * ══ ⛔ GRUPPEN OCH ÄGARENS MEDLEMSKAP SKRIVS I EN BATCH, ALLT ELLER INGET (0.32.0, #180) ═════
 *
 * Före 0.32.0 stod här att "samma batch" var två sekventiella anrop och att det inte fanns något
 * skydd mot en krasch mitt emellan. Följden var en grupp utan ägare: en rad ingen kan läsa (`groups`
 * läses av medlemmar) och ingen kan ta bort (`delete: if false`). Datakontraktet har nu `batch`
 * (`src/data/contract.js`, regel 6), och `createGroupService` KRÄVER den: en källa utan `batch` avvisas
 * när tjänsten byggs, inte första gången någon skapar en grupp. Ett tyst fall tillbaka på två anrop
 * vore den gamla luckan med ett nytt namn.
 *
 * ⛔ INBJUDNINGARNA SKRIVS EFTER COMMIT OCH ÄR BEST EFFORT. Gruppen får inte falla för att en adress
 * var felstavad: den finns, ägaren finns, och `fel` säger vilka inbjudningar som inte blev av så att
 * de kan skickas om. Bara INDATA som är fel före första skrivningen (en adress som inte är en adress,
 * rollen agare) kastar, för då finns inget att ha en halv grupp av.
 *
 * ══ ⛔ RAMVERKET KÄNNER INGEN DATABAS ═════════════════════════════════
 *
 * Datakällan skickas in, precis som `createInvitationService`. Det är också
 * det som gör att det här går att prova utan nätverk: minneskällan räcker.
 */

import { agentMedlemskap, byggGrupp, byggMedlemskap, byggVitlisterad, medlemskapsId } from "../lib/grupp.js";
import { byggSkapare } from "../lib/skapare.js";
import { createInvitationService } from "./inbjudan.js";
import { seedoperationer } from "../data/katalogkalla.js";
import { somKatalogStandard } from "./katalog.js";

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
 * @property {string} [anvandare] Förval `users`.
 * @property {string} [inbjudningar] Förval `invitations`.
 */

/**
 * @typedef {object} GruppUppgifter Det formuläret samlar in, allt utom namnet valfritt.
 * @property {string | import("../lib/sprak.js").Namn} namn En sträng blir `{ sv, en }` med samma text, ett `Namn` används som det är.
 * @property {string} [farg] Se `Grupp.farg`.
 * @property {string} [ikon] Se `Grupp.ikon`.
 * @property {string} [bild] Se `Grupp.bild`. Sätts normalt inte här: bilden laddas upp EFTER att gruppen finns, eftersom sökvägen bär gruppens id.
 * @property {string} [beskrivning]
 * @property {string} [ort]
 * @property {"sv"|"en"} [epostsprak]
 */

/**
 * @typedef {object} Inbjudningsrad
 * @property {string} epost
 * @property {"admin"|"medlem"} [roll] Förval `medlem`. Rollen agare finns inte här: skaparen är ägaren.
 */

/**
 * @typedef {object} SkapaGruppSvar
 * @property {string} groupId
 * @property {string[]} tillagda E-postadresser som redan hade ett konto och fick sitt medlemskap direkt.
 * @property {string[]} inbjudna E-postadresser som fick en väntande inbjudan.
 * @property {ReadonlyArray<{ epost: string, fel: string }>} fel Inbjudningar som inte blev av, med skälet. Tom lista är svaret "alla gick", aldrig en utelämnad rad.
 */

/** En adress ska se ut som en adress innan något skrivs. Inte en giltighetskontroll av brevlådan, bara att raden inte är skräp. */
const EPOSTFORM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bygger `skapaGrupp`. En fabrik och inte en lös funktion, samma skäl som
 * `createInvitationService`: den behöver en datakälla och samlingsnamn, och
 * ett anrop som tar emot båda är ett ställe de kan skrivas olika.
 *
 * @param {object} konfig
 * @param {import("../data/contract.js").DataSource<any>} konfig.kalla Måste ha `batch` (kontraktets regel 6).
 * @param {Samlingar} [konfig.samlingar]
 * @param {Record<string, ReadonlyArray<unknown> | import("./katalog.js").KatalogStandard>} [konfig.kataloger]
 *   Appens katalogstandardvärden, en nyckel per samling (#162). Anges de skrivs
 *   de som den nya gruppens kataloger I SAMMA BATCH som gruppen och ägarens
 *   medlemskap (0.33.0). Utelämnade: ingen seedning, och ingen tyst tom sådan heller.
 *   Ramverket ändrar dem aldrig i efterhand: de är startpunkten, gruppen äger sin kopia.
 * @param {ReadonlyArray<string>} [konfig.moduler] Apparna (modul-id) en ny grupp börjar med (0.51.0). Utelämnade: `[]`, som förut.
 * @param {boolean} [konfig.forstaGruppenFri] Den som aldrig ägt en grupp får skapa en utan vitlista och utan e-post (0.51.0). Förval av. Gäller bara när vitlistan krävs.
 * @param {boolean} [konfig.vitlistaKravs] Ska `skapaGrupp` läsa vitlistan (0.59.0). Förval `true`. `false`: ingen vitlista och ingen e-post, för första gruppen och för de följande, tills appen slår på kravet igen.
 * @param {boolean} [konfig.agent] Får en ny grupp sin agent (`agentMedlemskap`) i samma batch som gruppen och ägaren (lifehub.app#47). Förval `false`.
 * @returns {{ skapaGrupp: (b: { uid: string, epost: string, grupp: GruppUppgifter, inbjudningar?: ReadonlyArray<Inbjudningsrad>, skapadAv?: any, namn?: string }) => Promise<SkapaGruppSvar> }}
 */
export function createGroupService(konfig) {
  const { kalla, samlingar = {}, kataloger, moduler: forvaldaModuler, forstaGruppenFri = false, vitlistaKravs = true, agent = false } = konfig ?? {};
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.list !== "function" || typeof kalla.create !== "function") {
    throw new Error("createGroupService: en datakälla med read, list och create krävs. Ramverket känner ingen databas.");
  }
  if (typeof kalla.batch !== "function") {
    throw new Error(
      "createGroupService: datakällan saknar batch. Gruppen och ägarens medlemskap skrivs allt eller inget, och en källa som bara kan skriva ett dokument i taget lämnar en grupp utan ägare om det andra skrivandet faller. Lägg till batch i adaptern (db.batch() med Admin SDK), se datakontraktets regel 6.",
    );
  }
  /*
   * ⛔ KATALOGERNA PRÖVAS NÄR TJÄNSTEN BYGGS, INTE FÖRST NÄR NÅGON SKAPAR EN GRUPP. En trasig
   * standardkategori i appens repo är ett programfel, och det ska synas när functions startar, inte som
   * ett fel i knäet på den första som trycker Skapa grupp. Samma validering som i `skapaGrupp` nedan.
   */
  if (kataloger !== undefined) {
    if (!kataloger || typeof kataloger !== "object" || Array.isArray(kataloger) || Object.keys(kataloger).length === 0) {
      throw new Error("createGroupService: kataloger måste vara ett objekt med minst en samling. Utelämna det helt om appen inte har några kataloger.");
    }
    for (const samling of Object.keys(kataloger)) {
      const { standard, ikoner, textnycklar, faser, farger } = somKatalogStandard(kataloger[samling], samling);
      seedoperationer({ collection: samling, groupId: "provgrupp", standard, ikoner, textnycklar, faser, farger, namn: samling });
    }
  }
  if (typeof forstaGruppenFri !== "boolean") {
    throw new Error("createGroupService: forstaGruppenFri måste vara true eller false. Ett värde som råkar vara sant öppnar annars en väg in ingen valt.");
  }
  if (typeof vitlistaKravs !== "boolean") {
    throw new Error("createGroupService: vitlistaKravs måste vara true eller false. Ett annat värde hade antingen släppt förbi vitlistan eller krävt den utan att någon valt.");
  }
  if (typeof agent !== "boolean") {
    throw new Error("createGroupService: agent måste vara true eller false. Ett värde som råkar vara sant ger varje ny grupp en medlem ingen valt.");
  }
  /*
   * ⛔ APPARNA PRÖVAS NÄR TJÄNSTEN BYGGS, med samma `byggGrupp` som skrivvägen, av samma skäl som katalogerna ovan:
   * ett felstavat modul-id i appens repo ska synas när functions startar, inte som en grupp ingen kan skapa.
   */
  /** @type {string[]} */
  const startmoduler = forvaldaModuler === undefined ? [] : Array.isArray(forvaldaModuler) ? [...forvaldaModuler] : /** @type {any} */ (null);
  if (startmoduler === null) {
    throw new Error("createGroupService: moduler måste vara en lista modul-id. Utelämna den om en ny grupp ska börja utan appar.");
  }
  byggGrupp({ id: "provgrupp", namn: { sv: "Prov", en: "Prov" }, moduler: startmoduler, arkiverad: false, skapadAv: byggSkapare({ typ: "okand", kalla: "createGroupService" }) });

  const GRUPPER = samlingar.grupper ?? "groups";
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";
  const VITLISTA = samlingar.vitlista ?? "vitlista";
  const ANVANDARE = samlingar.anvandare ?? "users";
  const INBJUDNINGAR = samlingar.inbjudningar ?? "invitations";

  /*
   * ⛔ INBJUDNINGARNA GÅR GENOM `bjudIn`, INTE EN EGEN KOPIA AV DEN. "Har personen redan ett konto blir
   * det ett medlemskap direkt, annars en väntande inbjudan" är en regel, och `createGroupService` som
   * skrev den en gång till hade gett två platser där den kan bli olika (arbetsreglernas punkt 2).
   * `bjudIn` kontrollerar också att den som bjuder är ägare eller admin, och skaparen är ägare först
   * när batchen har gått igenom, alltså är det rätt ordning att bjuda in efter commit.
   */
  const inbjudan = createInvitationService({ kalla, samlingar: { anvandare: ANVANDARE, medlemskap: MEDLEMSKAP, inbjudningar: INBJUDNINGAR } });

  return {
    /**
     * Skapar en grupp åt den inloggade, med hen som ägare, och bjuder in de angivna.
     *
     * @param {{ uid: string, epost: string, grupp: GruppUppgifter, inbjudningar?: ReadonlyArray<Inbjudningsrad>, skapadAv?: any, namn?: string }} b
     *   `namn`: den inloggades namn ur anropets inloggning (`request.auth.token.name`). Används BARA när profilraden saknar
     *   namn, så att ägarens medlemskap inte skrivs utan namn fast det fanns ett (0.40.1, #218).
     * @returns {Promise<SkapaGruppSvar>}
     */
    async skapaGrupp(b) {
      const uid = rensa(b?.uid);
      const epost = epostform(b?.epost);
      const uppgifter = b?.grupp && typeof b.grupp === "object" ? b.grupp : null;
      if (!uid) throw new Error("skapaGrupp: uid krävs.");
      if (vitlistaKravs && !epost && !forstaGruppenFri) throw new Error("skapaGrupp: epost krävs. Det är den som kontrolleras mot vitlistan, inte uid.");
      if (!uppgifter) throw new Error("skapaGrupp: grupp krävs, ett objekt med minst ett namn.");

      const namnSv = typeof uppgifter.namn === "string" ? rensa(uppgifter.namn) : rensa(/** @type {any} */ (uppgifter.namn)?.sv);
      if (!namnSv) throw new Error("skapaGrupp: namn krävs. En grupp utan namn är en rad i gruppväljaren som ingen kan känna igen.");

      /*
       * ⛔ INBJUDNINGARNA VALIDERAS INNAN NÅGOT SKRIVS. En adress som inte är en adress, eller rollen
       * agare, är ett fel i INDATA, och det ska stoppa hela anropet medan det inte finns något att
       * städa. Det som INTE valideras här (finns kontot, gick skrivningen) hör till best-effort-halvan
       * efteråt. Skaparens egen adress och dubbletter tas bort tyst: de är inte fel, de är samma
       * person två gånger.
       */
      /** @type {{ epost: string, roll: "admin" | "medlem" }[]} */
      const att = [];
      const sedda = new Set([epost]);
      for (const rad of b.inbjudningar ?? []) {
        const e = epostform(rad?.epost);
        if (!e) throw new Error("skapaGrupp: en inbjudan saknar epost.");
        if (!EPOSTFORM.test(e)) throw new Error(`skapaGrupp: "${e}" är inte en e-postadress. Inget har skrivits.`);
        const roll = rad.roll ?? "medlem";
        if (roll !== "admin" && roll !== "medlem") {
          throw new Error(`skapaGrupp: inbjudan till "${e}" har rollen "${roll}". Vid skapandet går det att bjuda in till admin eller medlem, skaparen är ägaren.`);
        }
        if (sedda.has(e)) continue;
        sedda.add(e);
        att.push({ epost: e, roll });
      }

      /*
       * ⛔ VITLISTAN KONTROLLERAS FÖRST AV ALLT SOM RÖR DATABASEN. En person som inte
       * är vitlistad ska aldrig se hur långt resten av valideringen kommer.
       */
      /*
       * ⛔ VITLISTAN (0.59.0). Krävs den inte läses den inte, och e-post krävs inte heller: första gruppen
       * och varje grupp efter den. `forstaGruppenFri` gäller bara när vitlistan krävs, och betyder fortfarande
       * bara den som aldrig ägt en grupp. Ett avslutat ägarskap räknas.
       */
      let fri = !vitlistaKravs;
      if (!fri && forstaGruppenFri) {
        const agt = (await kalla.list(MEDLEMSKAP, { where: { userId: uid } })).some((m) => m && m.roll === "agare");
        fri = !agt;
      }
      if (!fri) {
        if (!epost) throw new Error("skapaGrupp: epost krävs. Du äger redan en grupp, och en grupp till kräver att adressen står på vitlistan.");
        const vitlisterad = await kalla.read(VITLISTA, epost);
        if (!vitlisterad) {
          throw new Error(`skapaGrupp: "${epost}" står inte på vitlistan. Bara vitlistade adresser får skapa en grupp.`);
        }
      }

      const id = grupp_id(namnSv);
      const anvandaren = await kalla.read(ANVANDARE, uid);
      const skapare = byggSkapare({ uid, namn: anvandaren?.namn || rensa(b.namn) || epost, typ: "manniska", kalla: "skapaGrupp", ...(b.skapadAv ?? {}) });

      /*
       * ⛔ `byggGrupp` KÖRS FÖRE BATCHEN, med samma validering som läsvägen: en färg utanför paletten
       * eller en beskrivning på 300 tecken kastar här, innan något är skrivet.
       */
      const grupp = byggGrupp({
        id,
        namn: typeof uppgifter.namn === "string" ? { sv: namnSv, en: namnSv } : uppgifter.namn,
        moduler: startmoduler,
        arkiverad: false,
        skapadAv: skapare,
        farg: uppgifter.farg,
        ikon: uppgifter.ikon,
        bild: uppgifter.bild,
        beskrivning: uppgifter.beskrivning,
        ort: uppgifter.ort,
        epostsprak: uppgifter.epostsprak,
      });
      /*
       * ⛔ MEDLEMSKAPETS `namn` OCH `bild` ÄR PERSONENS, INTE GRUPPENS (#138, beslut A). Före 0.32.0 fick
       * ägarens medlemskap gruppens namn här, alltså "Mitt bolag" som medlemslistans rad för ägaren.
       * Personens egen rad i `users` är källan, samma som `bjudIn` och `accepteraInbjudningar` läser.
       */
      const medlemskap = byggMedlemskap({
        userId: uid,
        groupId: id,
        roll: "agare",
        typ: "person",
        status: "aktiv",
        /*
         * ⛔ PROFILENS NAMN FÖRST, SEDAN INLOGGNINGENS, ALDRIG TOMT NÄR ETT FANNS (0.40.1, #218). Före 0.40.1 stod här
         * `anvandaren?.namn ?? ""`: saknades profilraden, eller hade den fått tomt namn vid första inloggningen, skrevs
         * ägarens medlemskap utan namn trots att inloggningen bar ett, och `OpsMottagare` ritade uid:t.
         */
        namn: anvandaren?.namn || rensa(b.namn),
        bild: anvandaren?.bild ?? "",
      });

      /*
       * ⛔ KATALOGERNA BYGGS FÖRE BATCHEN OCH SKRIVS I DEN (0.33.0, #162). Före 0.33.0 seedades de
       * EFTER commit, med en skrivning per kategori. Föll en av dem fanns gruppen och ägaren, men
       * katalogen var halv, och en halv katalog är värre än ingen: den ser färdig ut. Dessutom kunde
       * första vyn ritas före sista skrivningen. Nu byggs varje rad här, med samma validering som
       * läsvägen (en trasig standardkategori kastar innan något är skrivet), och går med i batchen.
       */
      /** @type {any[]} */
      const katalogOps = [];
      if (kataloger) {
        for (const samling of Object.keys(kataloger)) {
          const { standard, ikoner, textnycklar, faser, farger } = somKatalogStandard(kataloger[samling], samling);
          katalogOps.push(...seedoperationer({ collection: samling, groupId: id, standard, ikoner, textnycklar, faser, farger, namn: samling }));
        }
      }

      /*
       * ⛔ EN BATCH, ALLT ELLER INGET, OCH GRUPPEN FÖRE MEDLEMSKAPET I LISTAN. Ordningen spelar ingen
       * roll för atomiciteten men den spelar roll för den som läser en logg: gruppen finns först,
       * ägaren pekar på den. Faller batchen finns ingen av dem.
       */
      // `.call(kalla, ...)`: en adapter som skrivit `batch` som en metod får behålla sitt `this`. Fabriken har redan kontrollerat att den finns.
      await /** @type {NonNullable<typeof kalla.batch>} */ (kalla.batch).call(kalla, [
        { op: "create", collection: GRUPPER, data: grupp },
        { op: "create", collection: MEDLEMSKAP, data: medlemskap },
        // ⛔ AGENTEN I SAMMA BATCH (lifehub.app#47): en grupp som skapades utan sin agent är precis det engångssteget finns för att laga.
        ...(agent ? [{ op: "create", collection: MEDLEMSKAP, data: agentMedlemskap(id) }] : []),
        ...katalogOps,
      ]);

      /** @type {string[]} */
      const tillagda = [];
      /** @type {string[]} */
      const inbjudna = [];
      /** @type {{ epost: string, fel: string }[]} */
      const fel = [];
      for (const rad of att) {
        try {
          const svar = await inbjudan.bjudIn({ avUid: uid, groupId: id, epost: rad.epost, roll: rad.roll, skapadAv: skapare });
          if (svar.resultat === "medlemskap") tillagda.push(rad.epost);
          else if (svar.resultat === "inbjudan") inbjudna.push(rad.epost);
          else fel.push({ epost: rad.epost, fel: "finns redan i gruppen" });
        } catch (e) {
          fel.push({ epost: rad.epost, fel: e instanceof Error ? e.message : String(e) });
        }
      }

      return { groupId: id, tillagda, inbjudna, fel };
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
