/**
 * Regelfragmentet: grupptillhörighet som EN funktion appen inkluderar.
 *
 * ══ ⛔ VARFÖR RAMVERKET SKRIVER REGLERNA OCH INTE APPEN (#136) ═════════
 *
 * Firestore-regler har ingen import. Utan det här blir "du måste vara medlem i
 * radens grupp" en textsnutt någon klistrar in per samling, och den dagen
 * villkoret ändras sitter den gamla versionen kvar i de samlingar ingen kom
 * ihåg. Det är inte en hypotes: rotens `CLAUDE.md` i bolag-ops bär redan
 * berättelsen om en samling som saknade sitt block och föll på catch-allen, och
 * felet syntes först i CP:s knä som "Missing or insufficient permissions".
 *
 * Här genereras texten i stället, ur ETT uttryck, och appen limmar in den.
 *
 * ⛔ DET HÄR ÄR FÖRBEREDELSEN FÖR #130, där varje modul bidrar med sitt eget
 * regelfragment och de genererade reglerna ska bli identiska med dagens.
 *
 * ══ ⛔ ETT UPPSLAG, INGA CLAIMS, INGEN ARRAY ══════════════════════════
 *
 * "Får du läsa raden" är `exists(memberships/{uid}|{radens groupId})` plus
 * status aktiv. Ingen `array-contains`, inga JWT-claims, inget OR.
 *
 * En claim hade varit snabbare och är fel av ett mätbart skäl: den ligger i en
 * token som redan är utdelad, så en borttagen medlem är kvar tills token
 * förnyas. En array på raden hade varit delning inbakad i datamodellen, alltså
 * exakt det `check-gruppnyckel` finns för att stoppa.
 *
 * ══ ⛔ RAMVERKET KÄNNER INTE SAMLINGSNAMNEN ═══════════════════════════
 *
 * De skickas in, precis som för katalogen. Det är den raden som gör att en kund
 * kan bli ett eget projekt utan att datamodellen ändras.
 */

import { ADMINGRUPPFALT, AGARGRUPPFALT, ANVANDARFALT, MEDLEMSKAPSAVGRANSARE } from "./grupp.js";
import { KATALOGAVGRANSARE, KATEGORIFALT } from "./katalog.js";

/**
 * @typedef {object} Samlingsnamn
 * @property {string} [anvandare] Förval `users`.
 * @property {string} [grupper] Förval `groups`.
 * @property {string} [medlemskap] Förval `memberships`.
 * @property {string} [inbjudningar] Förval `invitations`.
 * @property {string} [vitlista] Förval `vitlista`. #161.
 */

/** Ett samlingsnamn får inte bära snedstreck: det är ett namn, inte en sökväg. */
const SAMLINGSFORM = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * @param {string} namn
 * @param {string} falt
 * @returns {string}
 */
function kontrolleraNamn(namn, falt) {
  if (typeof namn !== "string" || !SAMLINGSFORM.test(namn)) {
    throw new Error(
      `regelfragment: ${falt} "${namn}" är inte ett samlingsnamn. Ett snedstreck gör det till en sökväg, och sökvägen är appens beslut, inte modellens.`,
    );
  }
  return namn;
}

/**
 * Hjälpfunktionerna plus de fyra samlingar ramverket äger, som text att limma
 * in i appens `firestore.rules`, inuti `match /databases/{database}/documents`.
 *
 * ⛔ FUNKTIONSNAMNEN ÄR PREFIXADE MED `ops`. Appen har egna hjälpfunktioner, och
 * en krock mellan `arMedlem` här och `arMedlem` där hade varit ett fel som
 * bara syns när reglerna deployas, alltså i produktion.
 *
 * @param {Samlingsnamn} [namn]
 * @returns {string}
 */
export function regelfragment(namn = {}) {
  const anvandare = kontrolleraNamn(namn.anvandare ?? "users", "anvandare");
  const grupper = kontrolleraNamn(namn.grupper ?? "groups", "grupper");
  const medlemskap = kontrolleraNamn(namn.medlemskap ?? "memberships", "medlemskap");
  const inbjudningar = kontrolleraNamn(namn.inbjudningar ?? "invitations", "inbjudningar");
  const vitlista = kontrolleraNamn(namn.vitlista ?? "vitlista", "vitlista");

  return `    // ══ Ramverkets grupper och medlemskap. GENERERAD, ändra inte för hand ══
    //
    // Källa: @staiger/ops-framework, regelfragment() i src/lib/regler.js.
    // En ändring hör hemma där och kommer hit när fragmentet genereras om.

    function opsInloggad() {
      return request.auth != null;
    }

    function opsMedlemskapet(gid) {
      return get(/databases/$(database)/documents/${medlemskap}/$(request.auth.uid + '${MEDLEMSKAPSAVGRANSARE}' + gid));
    }

    // ⛔ exists FÖRE get. Ett get på en rad som inte finns är ett fel i regeln,
    // inte ett nej, och ett fel läses som "insufficient permissions" av den som
    // råkar vara utanför gruppen. Det är samma symptom som ett riktigt nej och
    // omöjligt att skilja åt i en logg.
    function opsHarMedlemskap(gid) {
      return opsInloggad()
        && exists(/databases/$(database)/documents/${medlemskap}/$(request.auth.uid + '${MEDLEMSKAPSAVGRANSARE}' + gid));
    }

    function opsArMedlem(gid) {
      return opsHarMedlemskap(gid) && opsMedlemskapet(gid).data.status == 'aktiv';
    }

    function opsArAgare(gid) {
      return opsArMedlem(gid) && opsMedlemskapet(gid).data.roll == 'agare';
    }

    // ⛔ ADMIN ÄR ÄGARE ELLER ADMIN (0.32.0, #180), SS \`isGroupAdmin\`. Det är den som får ändra
    // gruppens utseende och uppgifter och se inbjudningarna. Det som kräver ÄGARE (moduler, arkivering,
    // roller) står kvar på opsArAgare: en admin är en delegerad förvaltare, inte en andra ägare.
    function opsArAdmin(gid) {
      return opsArMedlem(gid)
        && (opsMedlemskapet(gid).data.roll == 'agare' || opsMedlemskapet(gid).data.roll == 'admin');
    }

    // Profilen. Bara sin egen rad, och e-posten kommer ur inloggningen.
    //
    // ⛔ #156, RÄTTAT EFTER GRANSKNING: hasOnly-LISTAN ÄR HÄRLEDD UR
    // ANVANDARFALT (src/lib/grupp.js), INTE EN HANDSKRIVEN KOPIA AV DEN.
    // En handskriven kopia hade varit precis den sortens andra sanning
    // arbetsreglernas punkt 2 förbjuder: ett fält som läggs till i modellen
    // men glöms här sparas som ett skrivfel den dagen appen försöker skriva
    // det, och syns bara som "Missing or insufficient permissions" hos
    // personen som sparade sin profil. Med en härledning kan de två inte
    // glida isär alls. check-gruppnyckel.mjs vaktar ändå att härledningen
    // faktiskt skedde, alltså att ingen framtida ändring gör listan till en
    // kopia igen.
    //
    // ⛔ create/update SKILT FRÅN read/delete, OCH DET ÄR INTE KOSMETIK.
    // request.resource finns bara på en skrivning som bär ett inkommande
    // dokument: en läsning har inget, och en radering har inget nytt
    // dokument att jämföra mot. Ett gemensamt \`allow read, write\` med
    // hasOnly i villkoret hade fått en LÄSNING att utvärdera
    // request.resource.data, alltså ett fält som inte finns, och den enda
    // ärliga utgången av det är ett regelfel, inte ett nej.
    match /${anvandare}/{uid} {
      allow read, delete: if opsInloggad() && request.auth.uid == uid;
      allow create, update: if opsInloggad() && request.auth.uid == uid
        && request.resource.data.keys().hasOnly([${ANVANDARFALT.map((f) => `"${f}"`).join(", ")}]);
    }

    // Gruppen. Medlem läser. Admin ändrar utseende och uppgifter, ägare även moduler och arkivering.
    // Aldrig radering: arkivering finns för att svaret på "varför försvann den" alltid efterfrågas i
    // efterhand.
    //
    // ⛔ diff().affectedKeys().hasOnly(...) OCH INTE keys().hasOnly(...) (0.32.0, #180). keys() på det
    // nya dokumentet är ALLA fält, också de oförändrade, så en lista av redigerbara fält hade avvisat
    // varje uppdatering av en grupp som bär \`id\` och \`skapadAv\`. affectedKeys() är bara det som
    // ÄNDRADES, och \`id\` och \`skapadAv\` står i ingen av listorna: ingen klient ändrar vem som skapade
    // gruppen. Listorna är härledda ur ADMINGRUPPFALT/AGARGRUPPFALT (src/lib/grupp.js), inte en
    // handskriven kopia.
    match /${grupper}/{gid} {
      allow read: if opsArMedlem(gid);
      allow create: if opsArAgare(gid);
      allow update: if (opsArAgare(gid)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly([${AGARGRUPPFALT.map((f) => `"${f}"`).join(", ")}]))
        || (opsArAdmin(gid)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly([${ADMINGRUPPFALT.map((f) => `"${f}"`).join(", ")}]));
      allow delete: if false;
    }

    // ⛔ MEDLEMSKAP SKRIVS ALDRIG AV EN KLIENT. Den som kan skriva sitt eget
    // medlemskap kan ge sig själv rollen ägare i vilken grupp som helst vars id
    // hen gissar. Serversidan skriver, med Admin SDK, och den går förbi de här
    // reglerna. Samma beslut som SessionStudio ADR-019.
    //
    // ⛔ EN MEDLEM LÄSER GRUPPENS ÖVRIGA MEDLEMSKAP (0.32.0, #180), inte bara sitt eget. Medlemslistan
    // är en yta varje medlem ser (SS visar den), och den bär namn och bild, aldrig e-post (se
    // MEDLEMSKAPSFALT). Läsningen är fortfarande ETT uppslag mot radens egen grupp: en medlem i en
    // ANNAN grupp läser inte den här, och en avslutad medlem gör det inte heller.
    match /${medlemskap}/{mid} {
      allow read: if opsInloggad()
        && (resource.data.userId == request.auth.uid || opsArMedlem(resource.data.groupId));
      allow write: if false;
    }

    // Inbjudan. Gruppens ägare och admin ser den, eftersom den bär en e-postadress till någon som
    // ännu inte är med.
    //
    // ⛔ ALDRIG SKAPAD AV EN KLIENT (0.32.0, #180). \`bjudIn\` (node-sidan) skriver raden, med Admin SDK,
    // eftersom raden bär \`tokenHash\` och \`giltigTill\` och ingen av dem får sättas av den som ska
    // bjudas in eller av den som bjuder. Vore \`create\` öppen kunde en admin skriva en inbjudan med
    // rollen agare, och därmed göra vem som helst till ägare via en accept. Klienten bjuder in genom
    // en callable, aldrig genom att skriva raden.
    match /${inbjudningar}/{iid} {
      allow read: if opsArAdmin(resource.data.groupId);
      allow create: if false;
      // ⛔ BARA STATUS GÅR ATT ÄNDRA FRÅN EN KLIENT, alltså återkalla. Gruppen av samma skäl som på en
      // vanlig rad. Rollen eftersom en inbjudan är ett löfte som någon redan fått: höjs den i efterhand
      // blir en accepterad inbjudan till medlem plötsligt ett ägarskap, utan att den som accepterade såg
      // det. tokenHash och giltigTill av skälet ovan: en klient som kan förlänga eller byta koden kan
      // hålla en inbjudan vid liv i evighet. Ska något annat ändras återkallas inbjudan och en ny skrivs.
      allow update: if opsArAdmin(resource.data.groupId)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["status"]);
      allow delete: if false;
    }

    // ⛔ VITLISTAN, ALDRIG EN KLIENT (#160, #161). Dokumentets id är
    // e-postadressen, gemener. \`skapaGrupp\` (node-sidan) kontrollerar den
    // med Admin SDK, som går förbi den här regeln, precis som memberships.
    // Läser en klient samlingen ser den varje adress som är värd att gissa
    // lösenord för, och det är hela skälet att den inte ens går att LÄSA
    // härifrån, till skillnad från gruppen och inbjudan.
    match /${vitlista}/{epost} {
      allow read, write: if false;
    }
`;
}

/**
 * Storage-regelfragmentet: bara sin egen sökväg, bara bilder, en storleksgräns.
 *
 * ══ ⛔ VARFÖR RAMVERKET SKRIVER ÄVEN DE HÄR (#156) ══════════════════════
 *
 * Samma skäl som `regelfragment()`: Storage-regler har heller ingen import,
 * och "bara sin egen bild, bara en bild, inte hur stor som helst" är precis
 * den sortens villkor som annars klistras in för hand i varje app och glider
 * isär den dagen gränsen ändras.
 *
 * ⛔ RAMVERKET KÄNNER INTE BUCKETEN ELLER PREFIXET. Precis som samlingsnamnen
 * i `regelfragment()`: appen skickar in var bilderna ligger, så en kund senare
 * kan bli ett eget Firebase-projekt utan att den här texten ändras.
 *
 * ⛔ TEXTEN ÄR ETT FRAGMENT, INTE EN HEL REGELFIL. Precis som `gruppadSamling`
 * limmas den in av appen, den här gången i `storage.rules`, inuti
 * `match /b/{bucket}/o`. Ramverket genererar, appen committar och deployar.
 *
 * @param {{ prefix?: string }} [konfig] `prefix` förval `"profilbilder"`.
 * @returns {string}
 */
export function lagringsregelfragment(konfig = {}) {
  const prefix = kontrolleraNamn(konfig.prefix ?? "profilbilder", "prefix");

  return `    // ══ Ramverkets profilbilder. GENERERAD, ändra inte för hand ══
    //
    // Källa: @staiger/ops-framework, lagringsregelfragment() i src/lib/regler.js.
    // En ändring hör hemma där och kommer hit när fragmentet genereras om.
    //
    // ⛔ BARA SIN EGEN SÖKVÄG. \`uid\` i sökvägen måste vara den inloggades eget,
    // annars kan vem som helst skriva över eller ta bort en annans bild.
    // ⛔ BARA BILDER. En profilbild-yta som tar emot vad som helst blir en
    // gratis fillagring för den som hittar uppladdningsvägen.
    // ⛔ EN STORLEKSGRÄNS. Utan den kostar en enda uppladdning lika mycket
    // som tusen små, och en telefonbild på 12 MB tar lika lång tid att ladda
    // upp på ett dåligt nät som appen sedan tar att kännas trasig.
    //
    // ⛔ create/update SKILT FRÅN delete, SAMMA SKÄL SOM users-BLOCKET OVAN.
    // \`write\` täcker även radering, och en radering har inget \`request.resource\`
    // att läsa storlek eller innehållstyp ur. Ett gemensamt \`allow write\` med
    // de villkoren hade fått en RADERING att utvärdera ett fält som inte finns.
    match /${prefix}/{uid}/{fil} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
      allow delete: if request.auth != null && request.auth.uid == uid;
    }
`;
}

/**
 * Ett block för en av APPENS samlingar: läs och skriv om du är aktiv medlem i
 * radens grupp.
 *
 * ⛔ `request.resource.data.groupId` PÅ SKRIVNING OCH `resource.data.groupId`
 * PÅ LÄSNING, och båda vid uppdatering. Kontrolleras bara den ena kan en rad
 * FLYTTAS till en grupp man inte är med i, eller ut ur en man är med i, och
 * båda är samma hål från var sitt håll.
 *
 * ⛔ `allow delete: if false`, OCH DET ÄR INTE EN GLÖMSKA (granskningsfynd på
 * #151). Här stod `${skrivvillkor}(resource.data.groupId)`, alltså att en
 * medlem fick radera. Epikens beslut och #136 säger arkivering och aldrig
 * radering, eftersom svaret på "varför försvann den" alltid efterfrågas i
 * efterhand, och ramverkets EGNA samlingar har redan `delete: if false`.
 *
 * Generatorn hade alltså infört den enda raderingsvägen i hela modellen, och
 * den hade kommit in som ett förval ingen valt. Behöver en modul radera ska
 * det vara ett beslut i manifestet med sitt skäl utskrivet.
 *
 * ⛔ INGEN EGEN KONTROLL AV ATT `groupId` FINNS, OCH DET ÄR ETT MUTATIONSFYND.
 * Här stod `request.resource.data.groupId is string` före medlemskapsuppslaget.
 * Svepet tog bort den och emulatorproven stod gröna: en rad utan grupp nekas
 * ändå, eftersom uppslaget då sker mot ett medlemskap som inte finns, och en
 * grupp som inte är en sträng faller på att sökvägen inte går att bygga.
 *
 * Inget värde skiljer de två versionerna åt, alltså kan inget prov göra det
 * heller, och en kontroll som inget prov kan se är ett påstående om skydd.
 * Samma beslut som den borttagna `Array.isArray` i `defineModule` (#135): den
 * togs bort i stället för att få ett prov som inte mäter något.
 *
 * @param {string} samling Appens samlingsnamn.
 * @param {{ agareKravsForSkrivning?: boolean, falt?: ReadonlyArray<string> | null }} [config]
 * @returns {string}
 */
export function gruppadSamling(samling, config = {}) {
  return gruppadSamlingBlock(samling, {
    skrivvillkor: config.agareKravsForSkrivning ? "opsArAgare" : "opsArMedlem",
    falt: config.falt,
    nyckelMedGrupp: false,
  });
}

/**
 * Blocket bakom `gruppadSamling` och `katalogregelfragment`. Internt: skrivrollen och nyckelformen är
 * ramverkets val per samling, inte något ett manifest ska kunna ställa in.
 *
 * @param {string} samling
 * @param {{ skrivvillkor: "opsArMedlem" | "opsArAdmin" | "opsArAgare", falt?: ReadonlyArray<string> | null, nyckelMedGrupp: boolean }} config
 * @returns {string}
 */
function gruppadSamlingBlock(samling, config) {
  const namn = kontrolleraNamn(samling, "samling");
  const skrivvillkor = config.skrivvillkor;

  /*
   * ⛔ FORMVALIDERINGEN ÄR EN EGEN RAD OCH INTE EN DEL AV VILLKORET, så att en
   * diff mot en handskriven fil visar exakt vad som tillkom. Utelämnas `falt`
   * skrivs raden inte alls: en samling utan deklarerade fält ska få samma block
   * som förut, inte ett block som låser allt ute.
   */
  const falt = Array.isArray(config.falt) ? config.falt : null;
  if (falt && falt.length === 0) {
    throw new Error(
      `gruppadSamling: "${namn}" har en tom fältlista. Det hade genererat keys().hasOnly([]), alltså en regel som avvisar varje rad. Utelämna falt om samlingen inte ska formvalideras.`,
    );
  }
  const formrad = falt ? `\n        && request.resource.data.keys().hasOnly([${falt.map((f) => `"${f}"`).join(", ")}])` : "";
  /*
   * ⛔ NYCKELN BÖRJAR PÅ RADENS EGEN GRUPP (0.33.0, katalogerna). Utan den här raden kunde en admin i
   * grupp A skapa dokumentet `B|uppgift` med `groupId: "A"`: skapelsen släpps in (A är hens grupp),
   * och när grupp B:s admin sedan sparar sin "uppgift" är det en UPPDATERING av en rad vars groupId är
   * A, alltså ett nej. Grupp B kan då aldrig spara den kategorin, och det enda som syns är "Missing or
   * insufficient permissions". Med raden måste nyckeln vara `<radens groupId>|<id>`, samma form som
   * `katalognyckel` bygger. Gruppens id har `ID_FORM` (a-z, 0-9, - och _), och inget av de tecknen
   * betyder något i ett reguljärt uttryck utanför en teckenklass.
   */
  const nyckelrad = config.nyckelMedGrupp
    ? `\n        && id.matches(request.resource.data.groupId + '[${KATALOGAVGRANSARE}][a-z0-9][a-z0-9_-]*')`
    : "";

  return `    match /${namn}/{id} {
      allow read: if opsArMedlem(resource.data.groupId);
      allow create: if ${skrivvillkor}(request.resource.data.groupId)${formrad}${nyckelrad};
      allow update: if ${skrivvillkor}(resource.data.groupId)
        && request.resource.data.groupId == resource.data.groupId${formrad};
      allow delete: if false;
    }
`;
}

/**
 * Hela regelfilen ur modulernas manifest.
 *
 * ══ ⛔ VARFÖR EN GENERATOR OCH INTE EN MALL ATT KOPIERA (#130) ═════════
 *
 * Fas 1 och Fas 2 skrev reglerna för ramverkets egna samlingar för hand, en
 * gång per samling, och de ser likadana ut. Nästa modul med tre samlingar hade
 * betytt tre handskrivna kopior av samma mönster, och arbetsreglernas punkt 2
 * säger en sanning plus en genererad kopia med vakt.
 *
 * ══ ⛔ GENERATORN ERSÄTTER MÖNSTRET, INTE TÄNKANDET ═══════════════════
 *
 * Det appen behöver utöver mönstret skrivs för hand och skickas in som `extra`.
 * Grundarreserven i bolag-ops är ett sådant undantag: den har ett slutdatum och
 * ett skäl, och den hör hemma i appens text, aldrig i generatorn. En generator
 * som bar appens undantag hade blivit en andra plats att leta på när en regel
 * beter sig oväntat.
 *
 * ══ ⛔ RAMVERKET GENERERAR, APPEN COMMITTAR ══════════════════════════
 *
 * Ingen deploy härifrån. Texten går till appens `firestore.rules`, appen
 * granskar diffen och appen deployar. Det är också därför byte-för-byte-vakten
 * mot dagens fil bor i APPENS kedja: där finns båda halvorna. Ramverkets egen
 * vakt bevisar att generatorn är stabil mot sina fixturer, vilket är det enda
 * ramverket kan uttala sig om utan att klona ett annat repo.
 *
 * @param {ReadonlyArray<import("./modul.js").Modul>} moduler Ur `validateModuler`.
 * @param {{ namn?: Samlingsnamn, extra?: string, rot?: string }} [config]
 *   `extra` limmas in efter modulernas block och före catch-allen.
 *   `rot` är sökvägen samlingarna ligger under, förval `databases/{database}/documents`.
 * @returns {string}
 */
export function generateRules(moduler, config = {}) {
  if (!Array.isArray(moduler)) {
    throw new Error(`generateRules: moduler måste vara en lista, inte ${typeof moduler}.`);
  }

  /** @type {Map<string, { modul: string, samling: import("./modul.js").Samling }>} */
  const samlingar = new Map();
  for (const modul of moduler) {
    if (!modul || typeof modul !== "object" || !Array.isArray(modul.samlingar)) {
      throw new Error(
        "generateRules: varje modul måste vara byggd av defineModule. Ett rått manifest kan sakna samlingar, och en regelfil som tyst blir kortare är det farligaste den kan bli.",
      );
    }
    for (const samling of modul.samlingar) {
      /*
       * ⛔ TVÅ MODULER MED SAMMA SAMLING ÄR ETT FEL HÄR OCKSÅ, fast
       * `validateModuler` redan fäller det. Generatorn anropas med en lista
       * någon satt ihop, och två block för samma sökväg gör vilket som gäller
       * till en fråga om ordning i filen.
       */
      const fanns = samlingar.get(samling.namn);
      if (fanns) {
        throw new Error(`generateRules: modulerna "${fanns.modul}" och "${modul.id}" ger båda samlingen "${samling.namn}". Två block för samma sökväg avgörs av ordningen i filen.`);
      }
      samlingar.set(samling.namn, { modul: modul.id, samling });
    }
  }

  /*
   * ⛔ GOLV. En tom lista ger en regelfil där catch-allen är allt, alltså en
   * app där ingenting går att läsa. Det är ett giltigt läge bara om någon
   * uttryckligen ville det, och en generator som tyst producerar den filen ur
   * ett tomt manifest är hur en app slutar fungera utan att något blev rött.
   */
  if (samlingar.size === 0 && !config.extra) {
    throw new Error(
      "generateRules: noll samlingar och ingen extra text. Resultatet hade blivit en regelfil som nekar allt. Skicka in modulerna, eller extra om appen medvetet bara vill ha ramverkets samlingar.",
    );
  }

  const rot = config.rot ?? "databases/{database}/documents";
  const block = [...samlingar.values()].map(({ samling }) =>
    gruppadSamling(samling.namn, { agareKravsForSkrivning: samling.agareKravsForSkrivning, falt: samling.falt }),
  );

  return `rules_version = '2';
service cloud.firestore {
  match /${rot} {
${regelfragment(config.namn)}
${block.join("")}${config.extra ? `${config.extra.replace(/\n*$/, "")}\n\n` : ""}    // ⛔ Allt som inte har ett block ovan nekas. En samling utan regel är en
    // samling ingen kan läsa, och det är rätt utfall: alternativet är att en
    // ny samling är öppen tills någon kommer ihåg att stänga den.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;
}

/*
 * ═══════════════════════════════════════════════════════════════════════
 * ⛔ EGET, AVGRÄNSAT BLOCK: KATALOGENS REGELFRAGMENT (#162). Tillagt
 * 2026-09-28. Rör INGET ovanför den här linjen. Ändras katalogens fält
 * (`KATEGORIFALT`, `src/lib/katalog.js`) eller mönstret för en gruppad
 * samling (`gruppadSamling` ovan): ändra där, den här funktionen ärver det
 * automatiskt eftersom den bara binder ihop de två.
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * Regelfragmentet för katalogens delade samling(ar): medlem läser, ägare och
 * admin skriver, uppslag på radens `groupId`, nyckeln `groupId|id`.
 *
 * ══ ⛔ VARFÖR EN NAMNGIVEN GENVÄG OCH INTE BARA `gruppadSamling` (#162) ═
 *
 * Ärendet, väg C i cllp/ops-framework#160: katalogerna blir gruppens egna.
 * `gruppadSamling` gör redan precis det en gruppad samling behöver, så den
 * här funktionen inför INGET nytt mönster. Den finns för att binda ihop TVÅ
 * saker som annars är två handskrivna sanningar om samma fält (arbetsreglernas
 * punkt 2): katalogens fältlista `KATEGORIFALT` (`katalog.js`, som
 * `byggKategori` redan vaktar) och regelns `hasOnly`. Utan bindningen hade en
 * app som lade till ett fält i `KATEGORIFALT` behövt komma ihåg att lägga
 * till det HÄR också, och glömde den det syns först som "Missing or
 * insufficient permissions" på nästa kategori som sparas med det nya fältet,
 * exakt den bugklassen #136:s filhuvud beskriver.
 *
 * ⛔ ÄGARE OCH ADMIN SKRIVER, INTE MEDLEM (0.33.0, rollmodellen ur 0.32.0).
 * Katalogen ÄR gruppens konfiguration: en inställningsvy som lägger till eller
 * arkiverar en kategori ändrar vad ALLA i gruppen ser i sina rullgardiner, så en
 * medlem skriver inte. Men den är samma SORTS konfiguration som gruppens
 * utseende och uppgifter (`ADMINGRUPPFALT`), som admin redan får ändra sedan
 * 0.32.0: namn, färg, ikon, ordning, och arkivering som går att ångra och står
 * i ändringsloggen. Det som 0.32.0 lämnade åt ägaren ensam är det STRUKTURELLA,
 * `moduler` (vilka moduler, alltså vilka samlingar och regler som finns) och att
 * arkivera hela gruppen. En kategori är inte strukturell i den meningen: en
 * sort som saknar beteende i koden ritas som reserv tills koden finns (se
 * appens inställningsvy). Före 0.33.0 stod `opsArAgare` här, skrivet innan
 * rollen admin fanns (0.29.0), och det hade gjort admin till en förvaltare som
 * får byta gruppens färg men inte döpa om en händelsetyp.
 *
 * ⛔ NYCKELN LÅSES TILL `groupId|id` VID SKAPELSE, se `gruppadSamlingBlock`.
 *
 * ⛔ FLERA SAMLINGSNAMN I ETT ANROP, EFTERSOM EN APP KAN HA FLER ÄN EN DELAD
 * KATALOG (händelsetyper, statusar, sorter, ...). De delar mönster och fält,
 * inte samlingsnamn. Samma form som `generateRules`, som tar en LISTA moduler
 * i stället för en åt gången.
 *
 * ⛔ RAMVERKET KÄNNER INTE SAMLINGSNAMNET/-NAMNEN, av samma skäl som överallt
 * annars här: appen väljer, så en kund senare kan bli ett eget Firebase-
 * projekt utan att den här funktionen ändras.
 *
 * @param {string | readonly string[]} namn Ett eller flera samlingsnamn för katalogens delade samling(ar).
 * @returns {string}
 */
export function katalogregelfragment(namn) {
  const samlingar = (Array.isArray(namn) ? namn : [namn]).map((n) => (typeof n === "string" ? n : ""));
  if (samlingar.length === 0 || samlingar.some((s) => !s.trim())) {
    throw new Error(
      "katalogregelfragment: minst ett samlingsnamn krävs, och inget får vara tomt. Ramverket känner aldrig samlingsnamnet självt, det är appens val.",
    );
  }
  /*
   * ⛔ `[...KATEGORIFALT]`, EN KOPIA. `gruppadSamling` muterar inte sitt
   * `falt`-argument, men en importerad `const`-array som råkar delas rakt av
   * med en framtida anropare som muterar den vore en bugg som visar sig i en
   * helt annan fil. En spridd kopia kostar ingenting och stänger den dörren.
   */
  return samlingar.map((s) => gruppadSamlingBlock(s, { skrivvillkor: "opsArAdmin", falt: [...KATEGORIFALT], nyckelMedGrupp: true })).join("");
}
