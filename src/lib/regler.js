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

import {
  ADMINGRUPPFALT, AGARGRUPPFALT, ANVANDARFALT, EXTERNHEMLIGHET_FORM, EXTERNPOSTFALT, EXTERNREPO_FORM, EXTERNREPO_PUNKTNAMN,
  EXTERNTOKEN_FORM, EXTERNTYPER, MAX_EXTERNA, MAX_EXTERNHEMLIGHET, MAX_EXTERNLABEL, MAX_EXTERNREPO, MEDLEMSKAPSAVGRANSARE,
} from "./grupp.js";
import { KATALOGAVGRANSARE, KATEGORIFALT } from "./katalog.js";
import { MAX_TYPAVVIKELSER, MAX_TYPID, MAX_TYPNAMN, MODULTYPID_FORM, TYPAVVIKELSEFALT, TYPYTOR } from "./modultyper.js";
import { KONFIGHANDELSER, KONFIGLOGGFALT } from "./konfiglogg.js";
import { DATUMFORM, KALENDERFALT, KALENDERFARGER, KALENDERPOSTFALT, MAX_KALENDERNAMN, MAX_POSTBESKRIVNING, MAX_POSTPLATS, MAX_POSTTITEL, MINKALENDERFALT, TIDPUNKTSFORM } from "./kalendrar.js";
import { KOMMENTARBILAGAFALT, KOMMENTARBILAGA_TYPER, KOMMENTARFALT, LASMARKESFALT, MAX_BILAGENAMN, MAX_HANDELSEKOMMENTAR, MAX_KOMMENTARBILAGA, SVARSFALT, SVARSVAL } from "./handelsemodell.js";
import { GRUPPSAMTAL, LASTFALT, MAX_MEDDELANDE, MAX_TRADNAMN, MEDDELANDEFALT, SAMTALSAVGRANSARE, SAMTALSFALT, TRADFALT } from "./samtal.js";

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
 * Ett RE2-uttryck för en regels `matches()` ur samma `RegExp` som klientbyggaren använder (#216): ankarna
 * tas bort (`matches` kräver hel träff) och `\/` blir `/`. Ett uttryck med tecken som kräver mer
 * översättning än så avvisas hellre än att tyst skrivas fel.
 *
 * @param {RegExp} re
 * @returns {string}
 */
function regelRegex(re) {
  const k = re.source.replace(/^\^/, "").replace(/\$$/, "").replace(/\\\//g, "/");
  if (k.includes("\\") || k.includes("'")) throw new Error(`regelRegex: ${re} går inte att skriva som ett Firestore-matches() utan översättning.`);
  return k;
}

/**
 * Reglerna för \`externaDatakallor\` (0.41.0, #216), ur samma listor och gränser som \`byggExternaDatakallor\`.
 * Firestore-regler har ingen loop, så giltigheten av varje post rullas ut till \`MAX_EXTERNA\` poster.
 *
 * @returns {string}
 */
function externaDatakallorRegler() {
  const lista = (/** @type {readonly string[]} */ a) => a.map((f) => `'${f}'`).join(", ");
  const poster = Array.from({ length: MAX_EXTERNA }, (_, i) => `(l.size() <= ${i} || opsExternPost(l[${i}]))`).join("\n        && ");
  return `    // ⛔ En extern datakälla på en grupp (0.41.0, #216). Ägaren skriver, en admin gör det inte (fältet står i
    // AGARGRUPPFALT och inte i ADMINGRUPPFALT). Formerna och gränserna är härledda ur src/lib/grupp.js, samma
    // som byggExternaDatakallor kontrollerar i klienten. Ingen loop finns i reglerna, därför rullas
    // posterna ut till MAX_EXTERNA. Fältet saknas eller är [] när gruppen inte har någon datakälla, och det är giltigt.
    //
    // De krävda fälten (type, repo, enabled) och att posten är en map kräver ingen egen rad: varje kontroll
    // nedan kastar ett utvärderingsfel när fältet saknas eller posten inte är en map, och ett fel i en regel
    // är ett nej. Det är provat, se 'saknas' och 'posten är inte en map' i rules/__tests__/grupper.test.mjs.
    function opsExternPost(p) {
      return p.keys().hasOnly([${lista(EXTERNPOSTFALT)}])
        && p.type in [${lista(EXTERNTYPER)}]
        && p.repo is string && p.repo.size() <= ${MAX_EXTERNREPO}
        && p.repo.matches('${regelRegex(EXTERNREPO_FORM)}')
        && !p.repo.matches('${regelRegex(EXTERNREPO_PUNKTNAMN)}')
        && p.enabled is bool
        && (!('label' in p) || (p.label is string && p.label.size() <= ${MAX_EXTERNLABEL}))
        && (!('credentialSecretId' in p)
          || (p.credentialSecretId is string && p.credentialSecretId.size() > 0
            && p.credentialSecretId.size() <= ${MAX_EXTERNHEMLIGHET}
            && p.credentialSecretId.matches('${regelRegex(EXTERNHEMLIGHET_FORM)}')
            && !p.credentialSecretId.matches('${regelRegex(EXTERNTOKEN_FORM)}')));
    }

    function opsExternaGiltiga(d) {
      return !('externaDatakallor' in d)
        || (d.externaDatakallor is list && opsExternLista(d.externaDatakallor));
    }

    function opsExternLista(l) {
      return l.size() <= ${MAX_EXTERNA}
        && ${poster};
    }
`;
}

/**
 * Reglerna för `typavvikelser` (0.42.0, #217), ur samma listor och gränser som `byggTypavvikelser`.
 * Firestore-regler har ingen loop, så giltigheten av varje post rullas ut till `MAX_TYPAVVIKELSER` poster.
 *
 * ⛔ REGLERNA KONTROLLERAR FORMEN OCH ANTALET, INTE ATT MODUL-ID:T FINNS. En regel kan inte slå upp
 * modulernas manifest. Det är ingen lucka som släpper in något farligt: en avvikelse kan bara PEKA på ett
 * bidrag, och sammanslagningen läser dem mot de bidrag modulerna faktiskt lämnat, så en avvikelse som pekar
 * på ett påhittat modul-id döljer eller döper om ingenting. Skrivvägen (`byggGrupp` med modulerna) avvisar den.
 *
 * @returns {string}
 */
function typavvikelserRegler() {
  const lista = (/** @type {readonly string[]} */ a) => a.map((f) => `'${f}'`).join(", ");
  const poster = Array.from({ length: MAX_TYPAVVIKELSER }, (_, i) => `(l.size() <= ${i} || opsTypavvikelse(l[${i}]))`).join("\n        && ");
  return `    // ⛔ Ägarens avvikelser från modulernas typbidrag (0.42.0, #217). Ägaren skriver, en admin gör det inte (fältet
    // står i AGARGRUPPFALT och inte i ADMINGRUPPFALT). Formerna och gränserna är härledda ur src/lib/modultyper.js,
    // samma som byggTypavvikelser kontrollerar i klienten. Ingen loop finns i reglerna, därför rullas posterna ut
    // till MAX_TYPAVVIKELSER. Fältet saknas eller är [] när gruppen inte har någon avvikelse, och det är giltigt.
    // Att id:t pekar på ett bidrag som finns kan en regel inte avgöra, se typavvikelserRegler().
    //
    // ⛔ VARJE LISTA VALIDERAS BARA NÄR DEN ÄNDRAS PÅ EN UPPDATERING (externaDatakallor sedan 0.42.0, typavvikelser
    // sedan 0.42.1, #223). En regel får utvärdera högst 1000 uttryck. En lista som inte ändras är redan validerad den
    // gång den skrevs. Här stod förut att typavvikelser "är billiga nog att få plats" och därför valideras alltid. Mätt
    // 2026-10-01 var det fel: med sex lagrade typavvikelser nekades en skrivning av EN extern datakälla med "maximum
    // of 1000 expressions", alltså kunde en ägare som dolt sex typer inte längre koppla ett repo.
    //
    // ⛔ OCH DE TVÅ LISTORNA SKRIVS ALDRIG I SAMMA ANROP (0.42.1, #223). Mätt: sex typavvikelser och en extern
    // datakälla i samma uppdatering spräcker budgeten, och vid create två datakällor och sex avvikelser. Inget tak
    // på antalet löser det, eftersom summan av båda är det som räknas. I stället nekas kombinationen med ett eget,
    // billigt villkor som utvärderas FÖRE valideringen: ett tydligt nej i stället för ett budgetfel som beror på
    // hur långa listorna råkar vara. Ramverkets skrivvägar skriver alltid en lista åt gången.
    function opsAndrad(d, r, f) {
      return d.diff(r).affectedKeys().hasAny([f]);
    }

    function opsHarPoster(d, f) {
      return f in d && d[f] is list && d[f].size() > 0;
    }
    //
    // 'dold' som bool och 'namn' som map har ingen egen rad: 'p.dold || 'namn' in p' kastar ett utvärderingsfel
    // på en icke-bool, och 'p.namn.keys()' kastar på en icke-map, och ett fel i en regel är ett nej. Det är provat
    // ('dold som inte är bool', 'ett namn som inte är en map' i rules/__tests__/grupper.test.mjs). De två rader som
    // först stod här ('is bool', 'is map') togs bort för att deras mutationer inte gick att slå röda: de var
    // ekvivalenta med kontrollen som redan fanns, och en rad utan eget utfall är en rad som ser ut som en vakt.
    function opsTypavvikelse(p) {
      return p.keys().hasOnly([${lista(TYPAVVIKELSEFALT)}])
        && p.yta in [${lista(TYPYTOR)}]
        && p.id is string && p.id.size() <= ${MAX_TYPID}
        && p.id.matches('${regelRegex(MODULTYPID_FORM)}')
        && (!('namn' in p)
          || (p.namn.keys().hasOnly(['sv', 'en'])
            && p.namn.sv is string && p.namn.sv.size() > 0 && p.namn.sv.size() <= ${MAX_TYPNAMN}
            && (!('en' in p.namn) || (p.namn.en is string && p.namn.en.size() <= ${MAX_TYPNAMN}))))
        && (p.dold || 'namn' in p);
    }

    function opsTypavvikelserGiltiga(d) {
      return !('typavvikelser' in d)
        || (d.typavvikelser is list && opsTypavvikelserLista(d.typavvikelser));
    }

    function opsTypavvikelserLista(l) {
      return l.size() <= ${MAX_TYPAVVIKELSER}
        && ${poster};
    }
`;
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
 * @param {{ kontoAgerPersonen?: boolean }} [val] 0.53.0, cllp/lifehub.app#32. `kontoAgerPersonen: true` när personen ägs
 *   av ett konto utanför appen och speglas in av appens server: då får klienten bara ändra `tema` i sin egen rad, och
 *   aldrig skapa den. Allt annat i raden är en spegel, och en spegel som klienten kan skriva är ett andra original.
 * @returns {string}
 */
export function regelfragment(namn = {}, val = {}) {
  const anvandare = kontrolleraNamn(namn.anvandare ?? "users", "anvandare");
  const grupper = kontrolleraNamn(namn.grupper ?? "groups", "grupper");
  const medlemskap = kontrolleraNamn(namn.medlemskap ?? "memberships", "medlemskap");
  const inbjudningar = kontrolleraNamn(namn.inbjudningar ?? "invitations", "inbjudningar");
  const vitlista = kontrolleraNamn(namn.vitlista ?? "vitlista", "vitlista");

  return `    // ══ Ramverkets grupper och medlemskap. GENERERAD, ändra inte för hand ══
    //
    // Källa: ops-framework, regelfragment() i src/lib/regler.js.
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

${externaDatakallorRegler()}
${typavvikelserRegler()}
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
${
  val.kontoAgerPersonen
    ? `      // ⛔ KONTOT ÄGER PERSONEN (0.53.0, lifehub.app#32). Raden skrivs av appens server ur kontot vid inloggningen.
      // Klienten ändrar bara temat, som är appens eget val, och skapar aldrig raden.
      allow create: if false;
      allow update: if opsInloggad() && request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["tema"]);`
    : `      allow create, update: if opsInloggad() && request.auth.uid == uid
        && request.resource.data.keys().hasOnly([${ANVANDARFALT.map((f) => `"${f}"`).join(", ")}]);`
}
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
      allow create: if opsArAgare(gid)
          && !(opsHarPoster(request.resource.data, 'externaDatakallor') && opsHarPoster(request.resource.data, 'typavvikelser'))
          && opsExternaGiltiga(request.resource.data) && opsTypavvikelserGiltiga(request.resource.data);
      allow update: if (opsArAgare(gid)
          && !(opsAndrad(request.resource.data, resource.data, 'externaDatakallor') && opsAndrad(request.resource.data, resource.data, 'typavvikelser'))
          && (!opsAndrad(request.resource.data, resource.data, 'externaDatakallor') || opsExternaGiltiga(request.resource.data))
          && (!opsAndrad(request.resource.data, resource.data, 'typavvikelser') || opsTypavvikelserGiltiga(request.resource.data))
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
    // Källa: ops-framework, lagringsregelfragment() i src/lib/regler.js.
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

/**
 * Regelfragmentet för konfigurationens ändringslogg (0.39.0, #188): vem ändrade vad i en grupps katalog.
 *
 * ══ ⛔ VAD SOM GÄLLER, OCH VARFÖR ═══════════════════════════════════════
 *
 *   - LÄSA en loggrad: aktiv medlem i RADENS grupp (`resource.data.groupId`), som katalogen själv.
 *   - SKRIVA en loggrad: den som får ändra katalogen, alltså ägare eller admin i radens grupp (`opsArAdmin`,
 *     samma som `katalogregelfragment`). ⛔ Det måste vara SAMMA villkor: en admin som sparar en kategori skriver
 *     katalograden och loggraden i samma tryck, och ett strängare villkor på loggen låter sparningen gå igenom
 *     medan spåret uteblir. Det var felet i #188: appens handskrivna regel frågade efter appens grupp, så en admin
 *     i en ANNAN grupp fick katalogen ändrad och loggraden nekad.
 *   - VEM: raden bär `av` (skaparstämpeln, `{ uid, namn, typ, kalla }` ur `byggSkapare`), och `av.uid` måste vara den
 *     inloggades uid (#211). ⛔ Loggen säger vem som gjorde en ändring, och utan det villkoret kunde en admin skriva en
 *     rad i en annan persons namn: raden hade påstått något databasen inte kunde stå för. Samma villkor som
 *     `skapadAv.uid == request.auth.uid` i appens övriga samlingar. ⛔ `av` SAKNAS INTE LÄNGRE: en rad utan `av`, med
 *     `av: null` (vad `byggKonfigandring` skriver om anroparen glömmer det) eller med `av` utan uid skapas inte. Det är
 *     ett beslut och inte ett förbiseende: en logg-rad som inte kan peka ut någon är en notis och inte ett spår. Gamla
 *     rader med `av: null` läses vidare (regeln gäller bara `create`).
 *   - FORMEN: `hasOnly` härledd ur `KONFIGLOGGFALT`, och `handelse` ur `KONFIGHANDELSER`, aldrig handskrivna kopior.
 *   - ÄNDRA eller RADERA: aldrig. En logg som går att skriva om är inte ett spår.
 *
 * ⛔ EN RAD UTAN `groupId` SKAPAS INTE. Regelns uppslag på radens grupp kan inte byggas utan fältet, och ett fel i
 * en regel är ett nej. Det är avsiktligt: `byggKonfigandring` kastar utan grupp av samma skäl, så ett tyst förval
 * aldrig skriver en rad åt fel grupp.
 *
 * ⛔ EN FRÅGA UTAN `where: { groupId }` NEKAS, som katalogens. Appens läsning måste filtrera på den aktiva gruppen.
 *
 * ⛔ RAMVERKET KÄNNER INTE SAMLINGSNAMNET. Appen skickar in det (`konfiglogg` i bolag-ops). Fragmentet använder
 * `opsArMedlem` och `opsArAdmin` ur `regelfragment()`, alltså ska det limmas in efter det.
 *
 * @param {string} namn Samlingsnamnet för ändringsloggen.
 * @returns {string}
 */
export function konfigloggregelfragment(namn) {
  const samling = kontrolleraNamn(namn, "konfiglogg");
  const lista = (/** @type {readonly string[]} */ f) => f.map((x) => `"${x}"`).join(", ");

  return `    match /${samling}/{id} {
      allow read: if opsArMedlem(resource.data.groupId);
      allow create: if opsArAdmin(request.resource.data.groupId)
        && request.resource.data.av is map
        && request.resource.data.av.uid == request.auth.uid
        && request.resource.data.keys().hasOnly([${lista(KONFIGLOGGFALT)}])
        && request.resource.data.handelse in [${lista(KONFIGHANDELSER)}];
      allow update, delete: if false;
    }
`;
}

/*
 * ═══════════════════════════════════════════════════════════════════════
 * ⛔ EGET, AVGRÄNSAT BLOCK: SAMTALENS REGELFRAGMENT (0.34.0, #182, #185).
 * Fälten kommer ur `src/lib/samtal.js`. Ändras modellen: ändra där.
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * Regelfragmentet för samtalen: gruppchatten, privata samtal och agentsamtal, med meddelanden och läst-status
 * som undersamlingar.
 *
 * ══ ⛔ VAD SOM GÄLLER, OCH VARFÖR ═══════════════════════════════════════
 *
 *   - LÄSA ett samtal och dess meddelanden: aktiv medlem i samtalets grupp, OCH för `personer` och `agent` en av
 *     deltagarna. En borttagen medlem läser alltså inte ens sina egna privata samtal i gruppen: samtalet hör till
 *     gruppen, och den som lämnat gruppen har lämnat dess samtal. Den andra deltagaren läser vidare.
 *   - SKAPA ett samtal: nyckeln måste vara den härledda (se `samtalsnyckel`), skaparen är en aktiv medlem av typen
 *     `person`, och i ett privat samtal är skaparen en av deltagarna och BÅDA är aktiva medlemmar i gruppen. I
 *     `personer` är båda av typen `person`, i `agent` är den andra av typen `agent`.
 *   - ÄNDRA eller RADERA ett samtal: aldrig. Deltagarna kan inte ändras i efterhand (då hade ett privat samtal
 *     kunnat öppnas för en tredje person som läser allt som redan sagts), och `grupp`/`personer` kan inte bytas.
 *   - SKRIVA ett meddelande: den som får läsa samtalet, `av` är den inloggade, och den inloggade är en medlem av
 *     typen `person`. ⛔ EN KLIENT SKRIVER ALDRIG SOM AGENT: agentens svar (#185) skrivs av servern med Admin SDK,
 *     som går förbi reglerna. Också den som skulle ha agentens inloggning nekas här.
 *   - ÄNDRA eller RADERA ett meddelande: aldrig. Ett meddelande är vad som sades. Kan det skrivas om kan ett svar
 *     i efterhand se ut att svara på något annat än det gjorde, och en radering lämnar inget svar på "vad stod
 *     det?". Samma princip som arkivering i stället för radering överallt annars i ramverket.
 *   - LÄST-STATUS: bara personen själv, och bara i ett samtal hen får läsa.
 *   - TRÅDAR (0.68.0, lifehub.app#60): bara i gruppchatten. Läsa: den som får läsa gruppchatten. Starta: en aktiv
 *     person i gruppen, ur ett meddelande som finns i samma samtal (trådens nyckel ÄR rotmeddelandets id), som sig
 *     själv. Döpa om: vem som helst av gruppens personer, och bara `namn`. Trådens meddelanden har samtalets form och
 *     samma krav. Aldrig radering. ⛔ EN KLIENT SKRIVER ALDRIG SOM AGENT här heller.
 *
 * ⛔ `tid` OCH `skapad` ÄR MILLISEKUNDER, OCH REGELN JÄMFÖR DEM MED SERVERNS KLOCKA (inom fem minuter). Annars kan
 * en klient skriva ett meddelande "från i går" eller "i morgon", och ett meddelande daterat i framtiden räknas
 * som oläst för alltid. Fem minuter räcker för en telefon vars klocka går fel.
 *
 * ⛔ RAMVERKET KÄNNER INTE SAMLINGSNAMNEN. `medlemskap` måste vara samma namn som skickas till `regelfragment()`,
 * och fragmentet använder dess `opsArMedlem`, alltså ska båda limmas in.
 *
 * @param {{ samtal?: string, meddelanden?: string, last?: string, tradar?: string, medlemskap?: string }} [namn]
 * @returns {string}
 */
export function samtalsregelfragment(namn = {}) {
  const samtal = kontrolleraNamn(namn.samtal ?? "samtal", "samtal");
  const meddelanden = kontrolleraNamn(namn.meddelanden ?? "meddelanden", "meddelanden");
  const last = kontrolleraNamn(namn.last ?? "last", "last");
  /*
   * ⛔ TRÅDARNA ÄR FRIVILLIGA OCH HAR INGET FÖRVAL (0.68.0, granskningen av PR 268, BÖR 1). Ramverket känner aldrig ett
   * samlingsnamn själv, och en app som inte skickar `tradar` får EXAKT samma regeltext som i 0.67.0, byte för byte (provet
   * mot `rules/__fixturer__/samtalsregelfragment-0.67.0.rules`). Ett förval hade gett varje app nya regler vid en ompinning
   * som ingen bad om.
   */
  const tradar = namn.tradar === undefined ? null : kontrolleraNamn(namn.tradar, "tradar");
  // ⛔ KAN 7: ett trådnamn som är samma som en annan undersamling hade lagt två regler på samma väg.
  if (tradar !== null && (tradar === meddelanden || tradar === last)) {
    throw new Error(`samtalsregelfragment: tradar "${tradar}" krockar med ${tradar === meddelanden ? "meddelanden" : "last"}. Två undersamlingar med samma namn är samma väg, och reglerna hade lagts ihop.`);
  }
  const medlemskap = kontrolleraNamn(namn.medlemskap ?? "memberships", "medlemskap");
  const A = SAMTALSAVGRANSARE;
  const lista = (/** @type {readonly string[]} */ f) => f.map((x) => `"${x}"`).join(", ");
  const utanDeltagare = SAMTALSFALT.filter((f) => f !== "deltagare");

  const version = tradar ? "0.34.0, trådar 0.68.0" : "0.34.0";
  const tradfunktioner = tradar
    ? `    // Gruppchatten s, och den inloggade får läsa den (0.68.0). Trådar finns bara här.
    function opsIGruppchatten(sid) {
      return opsISamtal(sid) && get(opsSamtalet(sid)).data.slag == '${GRUPPSAMTAL}';
    }

    // En aktiv person i gruppchatten s: den som får starta, döpa om och skriva i en tråd.
    function opsPersonIGruppchatten(sid) {
      return opsIGruppchatten(sid) && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person');
    }

    // Ett trådnamn: saknas (det härledda gäller) eller text inom taket.
    function opsGiltigtTradnamn(d) {
      return !('namn' in d) || (d.namn is string && d.namn.size() > 0 && d.namn.size() <= ${MAX_TRADNAMN});
    }

`
    : "";
  const tradblock = tradar
    ? `

      // Trådar (0.68.0): nyckeln är rotmeddelandets id i samma samtal.
      match /${tradar}/{tid} {
        allow read: if opsIGruppchatten(sid);
        allow create: if opsPersonIGruppchatten(sid)
          && exists(/databases/$(database)/documents/${samtal}/$(sid)/${meddelanden}/$(tid))
          && request.resource.data.keys().hasOnly([${lista(TRADFALT)}])
          && request.resource.data.skapadAv == request.auth.uid
          && opsNu(request.resource.data.skapad)
          && opsGiltigtTradnamn(request.resource.data);
        allow update: if opsPersonIGruppchatten(sid)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["namn"])
          && opsGiltigtTradnamn(request.resource.data);
        allow delete: if false;

        match /${meddelanden}/{mid} {
          allow read: if opsIGruppchatten(sid);
          allow create: if opsPersonIGruppchatten(sid)
            && exists(/databases/$(database)/documents/${samtal}/$(sid)/${tradar}/$(tid))
            && request.resource.data.keys().hasOnly([${lista(MEDDELANDEFALT)}])
            && request.resource.data.av == request.auth.uid
            && request.resource.data.text is string
            && request.resource.data.text.size() > 0
            && request.resource.data.text.size() <= ${MAX_MEDDELANDE}
            && opsNu(request.resource.data.tid);
          allow update, delete: if false;
        }
      }`
    : "";

  return `    // ══ Ramverkets samtal (${version}). GENERERAD, ändra inte för hand ══
    //
    // Källa: ops-framework, samtalsregelfragment() i src/lib/regler.js. Kräver regelfragment() ovanför.

    function opsMedlemskapFor(uid, gid) {
      return /databases/$(database)/documents/${medlemskap}/$(uid + '${A}' + gid);
    }

    // Aktiv medlem av en viss typ (person eller agent). exists före get, samma skäl som opsHarMedlemskap.
    function opsArAktivTyp(uid, gid, typ) {
      return exists(opsMedlemskapFor(uid, gid))
        && get(opsMedlemskapFor(uid, gid)).data.status == 'aktiv'
        && get(opsMedlemskapFor(uid, gid)).data.typ == typ;
    }

    // Får den inloggade läsa samtalet s (dess data)?
    function opsFarLasaSamtal(s) {
      return opsArMedlem(s.groupId) && (s.slag == '${GRUPPSAMTAL}' || request.auth.uid in s.deltagare);
    }

    function opsSamtalet(sid) {
      return /databases/$(database)/documents/${samtal}/$(sid);
    }

    function opsISamtal(sid) {
      return opsInloggad() && exists(opsSamtalet(sid)) && opsFarLasaSamtal(get(opsSamtalet(sid)).data);
    }

    // En tid i millisekunder nära serverns klocka.
    function opsNu(t) {
      return t is int && t > request.time.toMillis() - 300000 && t < request.time.toMillis() + 300000;
    }

${tradfunktioner}    // Ett nytt samtal: nyckeln härledd, skaparen en person i gruppen, i ett privat samtal båda aktiva medlemmar.
    function opsNyttSamtal(sid, d) {
      return opsInloggad()
        && d.skapadAv == request.auth.uid
        && d.groupId is string
        && opsNu(d.skapad)
        && opsArAktivTyp(request.auth.uid, d.groupId, 'person')
        && (
          (d.slag == '${GRUPPSAMTAL}'
            && d.keys().hasOnly([${lista(utanDeltagare)}])
            && sid == d.groupId + '${A}${GRUPPSAMTAL}')
          || ((d.slag == 'personer' || d.slag == 'agent')
            && d.keys().hasOnly([${lista(SAMTALSFALT)}])
            && d.deltagare is list && d.deltagare.size() == 2
            && d.deltagare[0] is string && d.deltagare[1] is string
            && d.deltagare[0] < d.deltagare[1]
            && !d.deltagare[0].matches('.*[${A}].*') && !d.deltagare[1].matches('.*[${A}].*')
            && request.auth.uid in d.deltagare
            && sid == d.groupId + '${A}' + d.deltagare[0] + '${A}' + d.deltagare[1]
            && (d.slag == 'personer'
              ? opsArAktivTyp(d.deltagare[0], d.groupId, 'person') && opsArAktivTyp(d.deltagare[1], d.groupId, 'person')
              : opsArAktivTyp(d.deltagare[0], d.groupId, 'agent') || opsArAktivTyp(d.deltagare[1], d.groupId, 'agent')))
        );
    }

    match /${samtal}/{sid} {
      allow read: if opsInloggad() && opsFarLasaSamtal(resource.data);
      allow create: if opsNyttSamtal(sid, request.resource.data);
      allow update, delete: if false;

      match /${meddelanden}/{mid} {
        allow read: if opsISamtal(sid);
        allow create: if opsISamtal(sid)
          && request.resource.data.keys().hasOnly([${lista(MEDDELANDEFALT)}])
          && request.resource.data.av == request.auth.uid
          && opsArAktivTyp(request.auth.uid, get(opsSamtalet(sid)).data.groupId, 'person')
          && request.resource.data.text is string
          && request.resource.data.text.size() > 0
          && request.resource.data.text.size() <= ${MAX_MEDDELANDE}
          && opsNu(request.resource.data.tid);
        allow update, delete: if false;
      }

      match /${last}/{uid} {
        allow read: if request.auth != null && request.auth.uid == uid && opsISamtal(sid);
        allow create, update: if request.auth != null && request.auth.uid == uid && opsISamtal(sid)
          && request.resource.data.keys().hasOnly([${lista(LASTFALT)}])
          && request.resource.data.lastTill is int;
        allow delete: if false;
      }${tradblock}
    }
`;
}

/*
 * ═══════════════════════════════════════════════════════════════════════
 * ⛔ EGET, AVGRÄNSAT BLOCK: KALENDRARNAS REGELFRAGMENT (0.36.0, #179 F0).
 * Fälten, färgerna, taken och datumformerna kommer ur `src/lib/kalendrar.js`. Ändras modellen: ändra där.
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * Ett JavaScript-uttryck som ett regeluttryck: utan ankare (reglernas `matches` kräver alltid hela strängen) och med
 * `[0-9]` i stället för `\d`. ⛔ HÄRLEDD UR SAMMA UTTRYCK SOM `byggKalenderpost` PRÖVAR MED, inte skrivet en gång till:
 * två uttryck för "ett datum" hade glidit isär första gången det ena rättades (arbetsreglernas punkt 2).
 * @param {RegExp} r @returns {string}
 */
const regeluttryck = (r) => r.source.replace(/^\^/, "").replace(/\$$/, "").replace(/\\d/g, "[0-9]");

/**
 * Regelfragmentet för kalendrarna: gruppens kalendrar, mina kalendrar och posterna i mina kalendrar.
 *
 * ══ ⛔ VAD SOM GÄLLER, OCH VARFÖR ═══════════════════════════════════════
 *
 *   - GRUPPENS KALENDRAR: exakt katalogens block (medlem läser, ägare och admin skriver, nyckeln `groupId|id`, aldrig
 *     radering), med kalenderns fält (`KALENDERFALT`). Samma motor som typerna, alltså samma regel.
 *   - MINA KALENDRAR: bara ägaren läser och skriver, nyckeln är radens `id`, namnet är en sträng med tak och färgen en
 *     av de sex. Aldrig radering: en kalender arkiveras, och posterna i den finns kvar och går att flytta.
 *   - POSTERNA I MINA KALENDRAR: bara ägaren. Kalendern måste finnas bland ÄGARENS kalendrar och inte vara arkiverad,
 *     titeln har tak, `heldag` avgör formen på `start` och `slut`, och `slut` är aldrig före `start`.
 *     ⛔ EN POST FÅR RADERAS AV SIN ÄGARE, till skillnad från allt annat i ramverket. Skälet till "arkivering, aldrig
 *     radering" är att någon annan frågar "varför försvann den" i efterhand. En privat post har ingen annan läsare.
 *
 * ⛔ INGEN ANNAN LÄSER NÅGON ANNANS KALENDER. Inte en gruppmedlem, inte en admin. Delning per post till en grupp är en
 * senare fas, och då som en rad i gruppens scope: aldrig som en läsregel här som öppnar en annans hela samling.
 *
 * ⛔ RAMVERKET KÄNNER INTE SAMLINGSNAMNEN. `anvandare` måste vara samma namn som skickas till `regelfragment()`, och
 * fragmentet använder dess `opsInloggad` och `opsArAdmin`, alltså ska båda limmas in.
 *
 * @param {{ anvandare?: string, gruppkalendrar?: string, minaKalendrar?: string, kalenderposter?: string }} [namn]
 * @returns {string}
 */
export function kalenderregelfragment(namn = {}) {
  const anvandare = kontrolleraNamn(namn.anvandare ?? "users", "anvandare");
  const gruppkalendrar = kontrolleraNamn(namn.gruppkalendrar ?? "gruppkalendrar", "gruppkalendrar");
  const minaKalendrar = kontrolleraNamn(namn.minaKalendrar ?? "minaKalendrar", "minaKalendrar");
  const kalenderposter = kontrolleraNamn(namn.kalenderposter ?? "kalenderposter", "kalenderposter");
  const lista = (/** @type {readonly (string|number)[]} */ f) => f.map((x) => (typeof x === "number" ? String(x) : `"${x}"`)).join(", ");
  const datum = regeluttryck(DATUMFORM);
  const tidpunkt = regeluttryck(TIDPUNKTSFORM);
  /*
   * ⛔ `id` LAGRAS INTE PÅ RADEN (rättat 0.37.0). 0.36.0 krävde `request.resource.data.id == kid`, alltså att nyckeln
   * också stod som ett fält. Det är samma uppgift två gånger (arbetsreglernas punkt 2), och det gick dessutom inte att
   * skriva: ramverkets egen Firestore-adapter tar `id` ur datan och gör det till dokumentets nyckel (`create`,
   * `src/data/firestore.js`), så varje skrivning genom `createKalenderkalla` hade nekats. Det syntes inte i 0.36.0
   * eftersom regelproven skrev med `setDoc` direkt och ingen klient skrev ännu. Mätt i `rules/__tests__/kalenderhantering.test.mjs`,
   * som skriver genom adaptern och är röd mot 0.36.0:s regel.
   */
  const utanId = (/** @type {readonly string[]} */ f) => f.filter((x) => x !== "id");

  return `    // ══ Ramverkets kalendrar (0.37.0). GENERERAD, ändra inte för hand ══
    //
    // Källa: ops-framework, kalenderregelfragment() i src/lib/regler.js. Kräver regelfragment() ovanför.

${gruppadSamlingBlock(gruppkalendrar, { skrivvillkor: "opsArAdmin", falt: [...KALENDERFALT], nyckelMedGrupp: true })}
    function opsMinKalender(uid, kid) {
      return /databases/$(database)/documents/${anvandare}/$(uid)/${minaKalendrar}/$(kid);
    }

    match /${anvandare}/{uid}/${minaKalendrar}/{kid} {
      allow read: if opsInloggad() && request.auth.uid == uid;
      allow create, update: if opsInloggad() && request.auth.uid == uid
        && request.resource.data.keys().hasOnly([${lista(utanId(MINKALENDERFALT))}])
        && request.resource.data.namn is string
        && request.resource.data.namn.size() > 0
        && request.resource.data.namn.size() <= ${MAX_KALENDERNAMN}
        && request.resource.data.farg in [${lista(KALENDERFARGER)}];
      allow delete: if false;
    }

    match /${anvandare}/{uid}/${kalenderposter}/{pid} {
      allow read, delete: if opsInloggad() && request.auth.uid == uid;
      allow create, update: if opsInloggad() && request.auth.uid == uid
        && request.resource.data.keys().hasOnly([${lista(utanId(KALENDERPOSTFALT))}])
        && request.resource.data.kalenderId is string
        && exists(opsMinKalender(uid, request.resource.data.kalenderId))
        && get(opsMinKalender(uid, request.resource.data.kalenderId)).data.get('arkiverad', false) != true
        && request.resource.data.titel is string
        && request.resource.data.titel.size() > 0
        && request.resource.data.titel.size() <= ${MAX_POSTTITEL}
        && request.resource.data.get('beskrivning', '').size() <= ${MAX_POSTBESKRIVNING}
        && request.resource.data.get('plats', '').size() <= ${MAX_POSTPLATS}
        && request.resource.data.heldag is bool
        && request.resource.data.start is string
        && request.resource.data.slut is string
        && ((request.resource.data.heldag == true
            && request.resource.data.start.matches('${datum}')
            && request.resource.data.slut.matches('${datum}'))
          || (request.resource.data.heldag == false
            && request.resource.data.start.matches('${tidpunkt}')
            && request.resource.data.slut.matches('${tidpunkt}')))
        && request.resource.data.slut >= request.resource.data.start;
    }
`;
}

/*
 * ═══════════════════════════════════════════════════════════════════════
 * ⛔ EGET, AVGRÄNSAT BLOCK: HÄNDELSEMODELLENS REGELFRAGMENT (0.37.0, #179 F3).
 * Svaren och fälten ramverket läser på appens händelser kommer ur `src/lib/handelsemodell.js`. Ändras modellen: ändra där.
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * Regelfragmentet för händelsemodellen: svaren Kommer / Kommer inte, och en funktion appen anropar i sitt eget
 * händelseblock för ramverkets fält (`kalenderId`, `slutDatum`, `kravSvar`).
 *
 * ══ ⛔ VAD SOM GÄLLER, OCH VARFÖR ═══════════════════════════════════════
 *
 *   - SVAR, LÄSA: aktiv medlem i händelsens grupp. Sammanställningen "3 kommer, 1 kommer inte" är gruppens, och vem som
 *     svarat vad är inte hemligt för den som ska planera efter det.
 *   - SVAR, SKRIVA: BARA PERSONEN SJÄLV (`{uid}` i sökvägen är den inloggade), bara en aktiv medlem i händelsens grupp,
 *     och bara när händelsen kräver svar (`kravSvar == true`). Ett svar på en händelse som inte frågar är ett svar ingen
 *     läser, och en admin som svarar åt någon annan är precis det "bara personen själv" finns för.
 *   - SVAR, ÄNDRA: samma villkor. Man får ändra sig.
 *   - SVAR, RADERA: aldrig. "Har inte svarat" och "svarade men tog tillbaka" är olika saker, och en radering gör dem lika.
 *   - `opsHandelsefaltGiltiga(ny, fore)`: appen anropar den i sitt `create` (med `{}` som `fore`) och sitt `update` (med
 *     `resource.data`). `kalenderId` ska vara en av GRUPPENS kalendrar, i samma grupp som händelsen, och inte arkiverad.
 *     ⛔ KALENDERN PRÖVAS BARA NÄR `kalenderId` ÄNDRAS. Annars hade en kalender som arkiveras efteråt gjort varje gammal
 *     händelse i den omöjlig att arkivera eller rätta, samma fälla som #481 beskrev för appens egna fält.
 *
 * ⛔ RAMVERKET KÄNNER INTE SAMLINGSNAMNEN. `handelser` är APPENS samling, `svar` är undersamlingens namn, och
 * `gruppkalendrar` måste vara samma namn som till `kalenderregelfragment()`. Fragmentet använder `opsInloggad` och
 * `opsArMedlem` ur `regelfragment()`, alltså ska det limmas in efter det.
 *
 *   - KOMMENTARER (0.48.0, #232, beslut 0002), LÄSA: aktiv medlem i händelsens grupp, som svaren.
 *   - KOMMENTARER, SKRIVA: aktiv medlem, bara i eget namn (`skapadAv.uid == request.auth.uid`), exakt fältlista
 *     (`KOMMENTARFALT`), texten 1 till `MAX_HANDELSEKOMMENTAR` tecken och `skapad` en ISO-tid.
 *   - KOMMENTARER, BILAGA (0.71.0, bolag-ops#570): frivilligt fält `bilaga` med inkorgens form (`KOMMENTARBILAGAFALT`), typen i
 *     `KOMMENTARBILAGA_TYPER`, data-URL:en med samma typ och högst `MAX_KOMMENTARBILAGA` tecken, `tecken` lika med dess längd och
 *     namnet 1 till `MAX_BILAGENAMN` tecken. Med bilaga får texten vara tom. Läsningen är kommentarens: bilagan ligger i samma
 *     dokument, så bara gruppens aktiva medlemmar läser den. Prövningen är regelfunktionen `opsKommentarbilagaGiltig(b)`, som
 *     appen får anropa i sina egna kommentarsregler (lifehub.app:s inkorg), så att den står en gång.
 *   - KOMMENTARER, ÄNDRA: aldrig. Ett svar på en kommentar hade annars kunnat stå under en mening som inte längre finns.
 *   - KOMMENTARER, RADERA: bara den som skrev den (CP 2026-10-02: "Ja"). Också efter att hen lämnat gruppen: det är hens text.
 *   - LÄSMÄRKEN (`<händelser>/{hid}/<läsmärken>/{uid}`): bara personen själv läser och skriver sitt, bara som aktiv medlem,
 *     exakt fältet `lastTill` som ISO-tid. Ingen radering: märket flyttas, det tas inte bort.
 *
 * @param {{ handelser?: string, svar?: string, gruppkalendrar?: string, kommentarer?: string, lasmarken?: string }} [namn]
 * @returns {string}
 */
export function handelseregelfragment(namn = {}) {
  const handelser = kontrolleraNamn(namn.handelser ?? "handelser", "handelser");
  const svar = kontrolleraNamn(namn.svar ?? "svar", "svar");
  const kommentarer = kontrolleraNamn(namn.kommentarer ?? "kommentarer", "kommentarer");
  const lasmarken = kontrolleraNamn(namn.lasmarken ?? "lasmarken", "lasmarken");
  if (new Set([svar, kommentarer, lasmarken]).size !== 3) {
    throw new Error(`handelseregelfragment: svar, kommentarer och lasmarken måste ha olika namn (fick "${svar}", "${kommentarer}", "${lasmarken}"). Två undersamlingar med samma namn är samma samling, och då gäller den ena regeln för den andras rader.`);
  }
  const isotid = "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?Z";
  const gruppkalendrar = kontrolleraNamn(namn.gruppkalendrar ?? "gruppkalendrar", "gruppkalendrar");
  const lista = (/** @type {readonly string[]} */ f) => f.map((x) => `"${x}"`).join(", ");
  const datum = regeluttryck(DATUMFORM);

  return `    // ══ Ramverkets händelsemodell (0.37.0). GENERERAD, ändra inte för hand ══
    //
    // Källa: ops-framework, handelseregelfragment() i src/lib/regler.js. Kräver regelfragment() ovanför.

    function opsGruppkalendern(gid, kid) {
      return /databases/$(database)/documents/${gruppkalendrar}/$(gid + '${KATALOGAVGRANSARE}' + kid);
    }

    // Ramverkets fält på en av appens händelser. Appen anropar den i sitt eget block: create med {} som fore,
    // update med resource.data. Kalendern prövas bara när kalenderId ändras.
    function opsHandelsefaltGiltiga(d, fore) {
      return (!('kalenderId' in d)
          || (d.kalenderId is string
            && (fore.get('kalenderId', null) == d.kalenderId
              || (exists(opsGruppkalendern(d.groupId, d.kalenderId))
                && get(opsGruppkalendern(d.groupId, d.kalenderId)).data.get('arkiverad', false) != true))))
        && (!('kravSvar' in d) || d.kravSvar is bool)
        && (!('slutDatum' in d)
          || (d.slutDatum is string && d.slutDatum.matches('${datum}') && d.datum is string && d.slutDatum > d.datum));
    }

    function opsHandelsen(hid) {
      return /databases/$(database)/documents/${handelser}/$(hid);
    }

    match /${handelser}/{hid}/${svar}/{uid} {
      allow read: if opsInloggad() && exists(opsHandelsen(hid))
        && opsArMedlem(get(opsHandelsen(hid)).data.groupId);
      allow create, update: if opsInloggad() && request.auth.uid == uid
        && exists(opsHandelsen(hid))
        && get(opsHandelsen(hid)).data.get('kravSvar', false) == true
        && opsArMedlem(get(opsHandelsen(hid)).data.groupId)
        && request.resource.data.keys().hasOnly([${lista(SVARSFALT)}])
        && request.resource.data.svar in [${lista(SVARSVAL)}];
      allow delete: if false;
    }

    // En bilaga på en kommentar (0.71.0, bolag-ops#570): inkorgens form, typlistan och taket ur modellen. Appen får anropa
    // funktionen i sina egna kommentarsregler, så att prövningen står en gång.
    function opsKommentarbilagaGiltig(b) {
      return b is map
        && b.keys().hasOnly([${lista(KOMMENTARBILAGAFALT)}])
        && b.keys().hasAll([${lista(KOMMENTARBILAGAFALT.slice(0, 4))}])
        && b.typ in [${lista(KOMMENTARBILAGA_TYPER)}]
        && b.dataUrl is string
        && b.dataUrl.size() <= ${MAX_KOMMENTARBILAGA}
        && b.dataUrl.matches('data:' + b.typ + ';base64,.*')
        && b.tecken == b.dataUrl.size()
        && b.namn is string
        && b.namn.size() > 0
        && b.namn.size() <= ${MAX_BILAGENAMN}
        && (!('bredd' in b) || b.bredd is number)
        && (!('hojd' in b) || b.hojd is number);
    }

    match /${handelser}/{hid}/${kommentarer}/{kid} {
      allow read: if opsInloggad() && exists(opsHandelsen(hid))
        && opsArMedlem(get(opsHandelsen(hid)).data.groupId);
      allow create: if opsInloggad() && exists(opsHandelsen(hid))
        && opsArMedlem(get(opsHandelsen(hid)).data.groupId)
        && request.resource.data.keys().hasOnly([${lista([...KOMMENTARFALT, "bilaga"])}])
        && request.resource.data.keys().hasAll([${lista(KOMMENTARFALT)}])
        && request.resource.data.text is string
        && (request.resource.data.text.size() > 0 || 'bilaga' in request.resource.data)
        && request.resource.data.text.size() <= ${MAX_HANDELSEKOMMENTAR}
        && (!('bilaga' in request.resource.data) || opsKommentarbilagaGiltig(request.resource.data.bilaga))
        && request.resource.data.skapad is string
        && request.resource.data.skapad.matches('${isotid}')
        && request.resource.data.skapadAv is map
        && request.resource.data.skapadAv.get('uid', null) == request.auth.uid;
      allow update: if false;
      allow delete: if opsInloggad() && resource.data.skapadAv.get('uid', null) == request.auth.uid;
    }

    match /${handelser}/{hid}/${lasmarken}/{uid} {
      allow read: if opsInloggad() && request.auth.uid == uid;
      allow create, update: if opsInloggad() && request.auth.uid == uid
        && exists(opsHandelsen(hid))
        && opsArMedlem(get(opsHandelsen(hid)).data.groupId)
        && request.resource.data.keys().hasOnly([${lista(LASMARKESFALT)}])
        && request.resource.data.lastTill is string
        && request.resource.data.lastTill.matches('${isotid}');
      allow delete: if false;
    }
`;
}
