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
 * "Får du läsa raden" är `exists(memberships/{uid}_{radens groupId})` plus
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

/**
 * @typedef {object} Samlingsnamn
 * @property {string} [anvandare] Förval `users`.
 * @property {string} [grupper] Förval `groups`.
 * @property {string} [medlemskap] Förval `memberships`.
 * @property {string} [inbjudningar] Förval `invitations`.
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

  return `    // ══ Ramverkets grupper och medlemskap. GENERERAD, ändra inte för hand ══
    //
    // Källa: @staiger/ops-framework, regelfragment() i src/lib/regler.js.
    // En ändring hör hemma där och kommer hit när fragmentet genereras om.

    function opsInloggad() {
      return request.auth != null;
    }

    function opsMedlemskapet(gid) {
      return get(/databases/$(database)/documents/${medlemskap}/$(request.auth.uid + '_' + gid));
    }

    // ⛔ exists FÖRE get. Ett get på en rad som inte finns är ett fel i regeln,
    // inte ett nej, och ett fel läses som "insufficient permissions" av den som
    // råkar vara utanför gruppen. Det är samma symptom som ett riktigt nej och
    // omöjligt att skilja åt i en logg.
    function opsHarMedlemskap(gid) {
      return opsInloggad()
        && exists(/databases/$(database)/documents/${medlemskap}/$(request.auth.uid + '_' + gid));
    }

    function opsArMedlem(gid) {
      return opsHarMedlemskap(gid) && opsMedlemskapet(gid).data.status == 'aktiv';
    }

    function opsArAgare(gid) {
      return opsArMedlem(gid) && opsMedlemskapet(gid).data.roll == 'agare';
    }

    // Profilen. Bara sin egen rad, och e-posten kommer ur inloggningen.
    match /${anvandare}/{uid} {
      allow read, write: if opsInloggad() && request.auth.uid == uid;
    }

    // Gruppen. Medlem läser, ägare skriver. Aldrig radering: arkivering finns
    // för att svaret på "varför försvann den" alltid efterfrågas i efterhand.
    match /${grupper}/{gid} {
      allow read: if opsArMedlem(gid);
      allow create, update: if opsArAgare(gid);
      allow delete: if false;
    }

    // ⛔ MEDLEMSKAP SKRIVS ALDRIG AV EN KLIENT. Den som kan skriva sitt eget
    // medlemskap kan ge sig själv rollen ägare i vilken grupp som helst vars id
    // hen gissar. Serversidan skriver, med Admin SDK, och den går förbi de här
    // reglerna. Samma beslut som SessionStudio ADR-019.
    match /${medlemskap}/{mid} {
      allow read: if opsInloggad()
        && (resource.data.userId == request.auth.uid || opsArAgare(resource.data.groupId));
      allow write: if false;
    }

    // Inbjudan. Bara gruppens ägare ser och skriver den, eftersom den bär en
    // e-postadress till någon som ännu inte är med.
    match /${inbjudningar}/{iid} {
      allow read: if opsArAgare(resource.data.groupId);
      allow create: if opsArAgare(request.resource.data.groupId);
      // ⛔ VARKEN GRUPPEN ELLER ROLLEN GÅR ATT ÄNDRA (#137). Gruppen av samma
      // skäl som på en vanlig rad. Rollen eftersom en inbjudan är ett löfte
      // som någon redan fått: höjs den i efterhand blir en accepterad inbjudan
      // till medlem plötsligt ett ägarskap, utan att den som accepterade såg
      // det. Ska rollen ändras återkallas inbjudan och en ny skrivs.
      allow update: if opsArAgare(resource.data.groupId)
        && request.resource.data.groupId == resource.data.groupId
        && request.resource.data.roll == resource.data.roll;
      allow delete: if false;
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
  const namn = kontrolleraNamn(samling, "samling");
  const skrivvillkor = config.agareKravsForSkrivning ? "opsArAgare" : "opsArMedlem";

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

  return `    match /${namn}/{id} {
      allow read: if opsArMedlem(resource.data.groupId);
      allow create: if ${skrivvillkor}(request.resource.data.groupId)${formrad};
      allow update: if ${skrivvillkor}(resource.data.groupId)
        && request.resource.data.groupId == resource.data.groupId${formrad};
      allow delete: if ${skrivvillkor}(resource.data.groupId);
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
