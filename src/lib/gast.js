/**
 * Gäster: det som vyn, reglerna och servern delar om en person som bjudits in utan konto (0.131.0, cllp/lifehub.app#389, skiva 1; 0.132.0, skiva 2: hela gruppen).
 *
 * ══ ⛔ EN GÄST ÄR EN INBJUDAN, INTE ETT KONTO OCH INTE ETT MEDLEMSKAP (CP 2026-10-20) ═══════════════════════════════════════
 *
 * CP 2026-10-20: "Kör på alla 3, men sätt max 5 gäster." Beslutet var väg B i designförslaget (lifehub.app#389): appen får en egen gästväg vid sidan
 * av Identity. En gäst har ingen Auth-användare, ingen katalogpost, ingen Firebase-token och ingen rad i `memberships`. Det sista är det viktiga:
 * mätt i designförslaget (lifehub.app 7ffc669) provas ett aktivt medlemskap på 55 ställen i appens regler och 25 i ramverkets fragment, och 32 + 15 `status`-prov
 * på `aktiv` finns i functions och src. Hade en gäst varit en aktiv rad med `typ: "gast"` hade varje sådant prov släppt in hen, och varje
 * missat ställe hade varit ett hål (beslut 7 i epiken, skydd per funktion, hade blivit fail-open). Se `docs/beslut/0011`.
 *
 * Gästen når därför bara servern (`POST /api/gast`) och aldrig Firestore. Filen här är det rena: konstanter, former, texter och
 * `gastId`. Nyckeln, sessionen, platserna och tjänsten ligger i `src/node/gast.js` (`node:crypto` ska aldrig bundlas till en webbläsare).
 *
 * ══ ⛔ GÄSTENS IDENTITET ÄR HÄRLEDD, INTE LAGRAD (regel 2) ══════════════════════════════════════════════════════════════
 *
 * `gastId` är `g_` plus de 40 första tecknen av SHA-256 av den normaliserade adressen. En person med flera inbjudningar är en gäst. Rösten (appens
 * dokument) bär `gastId` som id i samma samling som medlemmarnas, och prefixet `g_` kan inte krocka med ett Firebase-uid (28 tecken, aldrig ett
 * understreck på andra plats). Att härleda det kräver en hash som fungerar i webbläsaren också (medlemmens vy ska kunna koppla en röst till en
 * inbjudan), så SHA-256 är skriven här i ren JS och provad mot `node:crypto` i `gast.test.js`. Hashen skyddar ingen hemlighet: adressen ser
 * medlemmarna ändå.
 */

import { epostFel } from "./mejl.js";

/** Så många gäster en grupp får gratis (CP 2026-10-20: "max 5 gäster"). Ett tal på ETT ställe: platsdokumenten, texten "X av 5" och taket härleds ur det. */
export const GAST_PLATSER_GRATIS = 5;

/**
 * Vad en inbjudan gäller: `sak` (en omröstning, skiva 1) eller `grupp` (hela gruppen, 0.132.0). Slaget ingår i inbjudans id via `gastomfangsnyckel`, så att samma adress till
 * en sak och till hela gruppen är två rader men en person (och en plats).
 */
export const GASTSLAG = /** @type {const} */ (["sak", "grupp"]);

/** Vad en gäst får göra med en SAK. Skiva 1: rösta. Skyddet gäller per funktion, inte per post (epikens beslut 7). */
export const GASTFUNKTIONER = /** @type {const} */ (["rosta"]);

/**
 * Vad en gäst med omfånget `grupp` får göra: se och skriva i chatten, kalendern (och svara och rösta där), biblioteket och de ärenden som delegerats till hen. En gruppinbjudan ger alla fyra. Att välja en delmängd per
 * gäst byggs inte (CP 2026-10-20, designen: en andra konstant, grenar i `session()` och en omfångsnyckel som då måste bära valet).
 *
 * ⛔ `arenden` GER INTE GRUPPENS ÄRENDEN (skiva 3, CP 2026-10-20). Funktionen ger de ärenden där gästen är ansvarig (`gastDelegerad`) och inga andra: ärendelistan kan bära sådant som inte rör gästen (buggar, ekonomi),
 * så urvalet görs av servern på gästens `gastId` och aldrig av vyn. Den finns bara när appen gett `grupp.arenden`.
 */
export const GASTGRUPPFUNKTIONER = /** @type {const} */ (["chatt", "kalender", "bibliotek", "arenden"]);

/** Tak per svar (hela listan eller en sida), så att en lista som kapats aldrig ser ut som hela listan (`avkortad`). */
export const GASTCHATT_SIDA = 50;
/** Flest händelser i gästens kalender. Samma tak som kalenderflödet (5 000). */
export const GASTKALENDER_MAX = 5000;
/** Flest ärenden i gästens lista (skiva 3): de som delegerats till gästen, inte gruppens. Öppna först, nyast först; finns fler säger svaret `avkortad`. */
export const GASTARENDE_MAX = 100;
/** Flest av gästens EGNA ärenden servern läser (frågan är på gästens `gastId`, inte på hela gruppen), innan de sorteras och `GASTARENDE_MAX` visas. Nås det säger svaret `avkortad`: en kapad lista ser aldrig ut som hela. */
export const GASTARENDE_SKANNA_MAX = 2000;
/** Flest kommentarer per ärende hos gästen (de senaste). Finns fler bär ärendet `fler`. */
export const GASTARENDEKOMMENTARER_MAX = 100;
/** Flest biblioteksposter i gästens lista. */
export const GASTBIBLIOTEK_MAX = 1000;
/** Högsta antalet anrop per inbjudan och minut (gruppens funktioner). Därefter `for-manga`, som appen svarar 429 på. */
export const GASTANROP_PER_MINUT = 60;
/** Högsta antalet filer (signerade adresser) per inbjudan och dygn. Trafiken ut ur lagringen är den enda kostnad en gäst kan driva upp själv. */
export const GASTFIL_PER_DYGN = 50;

/** Hur länge länken i ett brev går att lösa in, i dagar räknat från senaste utskicket. Gäller bara länken, inte åtkomsten: en gäst som redan loggat in har en session. */
export const GASTLANKDAGAR = 30;

/** Hur länge en session lever efter sitt senaste anrop, i dagar. */
export const GASTSESSIONSDAGAR = 90;

/** Högsta antalet felaktiga försök att lösa in en inbjudan per fönster. Därefter svarar den `for-manga` även på rätt adress (som delningens `FELKOD_MAX`). */
export const GASTFEL_MAX = 5;

/** Fönstret för `GASTFEL_MAX`, i millisekunder. */
export const GASTFEL_FONSTER_MS = 15 * 60 * 1000;

/** Högsta antalet misslyckade försök att lösa in en inbjudan per IP och fönster, över alla inbjudningar. */
export const GASTIP_MAX = 30;

/** Fönstret för `GASTIP_MAX`, i millisekunder. */
export const GASTIP_FONSTER_MS = 15 * 60 * 1000;

/** Högsta antalet "skicka ny länk" per IP och fönster. */
export const GASTNYLANKIP_MAX = 10;

/** Fönstret för `GASTNYLANKIP_MAX`, i millisekunder. */
export const GASTNYLANKIP_FONSTER_MS = 60 * 60 * 1000;

/** Högsta antalet brev med nya länkar till samma adress och dygn (CP-förslaget i #389: tre). */
export const GASTNYLANK_BREV_PER_DYGN = 3;

/** Högsta antalet länkar (en per aktiv inbjudan) som ett enda brev med nya länkar bär. */
export const GASTNYLANK_MAX_LANKAR = 5;

/** Längsta namn en gäst eller den som bjuder får ge, i tecken. */
export const MAX_GASTNAMN = 80;

/** En nyckel (och en sessionsnyckel) är 32 slumpbyte i base64url utan utfyllnad: 43 tecken. Bara hashen lagras. */
export const GASTNYCKELFORM = /^[A-Za-z0-9_-]{43}$/;

/** Dokument-id:t för en inbjudan: SHA-256 i hex. */
export const GASTINBJUDNINGSIDFORM = /^[0-9a-f]{64}$/;

/** Gästens identitet: `g_` och 40 hextecken. */
export const GASTIDFORM = /^g_[0-9a-f]{40}$/;

/**
 * Är det här en gästs identitet (`av` på ett chattmeddelande)? Det ENDA sättet att se att ett meddelande skrevs av en gäst: ingen andra fält bär det, så ingen kan glida isär från `av`.
 * Ett Firebase-uid kan inte ha den formen (28 tecken, utan understreck).
 * @param {unknown} av
 * @returns {boolean}
 */
export function arGastId(av) {
  return typeof av === "string" && GASTIDFORM.test(av);
}

/** Namnet på en gäst som skrivit utan att ha något namn. Märket Gäst står vid varje gästs meddelande ändå. */
export const GASTNAMNLOS = "Gäst";

/**
 * ══ (SKIVA 3) ETT ÄRENDE KAN HA EN GÄST SOM ANSVARIG ══════════════════════════════════════════════════════════════════════
 *
 * Appens ärende bär sin mottagare i fältet `mottagare` (`{ slag: "person", uid }`, se `byggMottagare`). En gäst är ett slag till: `{ slag: "gast", gastId, namn }`. `gastId` är gästens identitet
 * (`gastId(epost)`), den ENDA nyckeln servern urskiljer gästens ärenden på; `namn` är ett visningsnamn som medlemmarna ritar, för att en medlem inte kan läsa gästens inbjudan.
 *
 * ⛔ FORMEN HAR ETT HEM (regel 2). Appens utdelning (`byggArendemottagare` i `samtal.js`), serverns urval av gästens ärenden (`gastDelegerad`) och medlemmarnas rad (`tolkaGastMottagare`) läser samma tre
 * funktioner. Servern litar aldrig på en separat lista över "gästens ärenden": urvalet är radens egen `mottagare` mot sessionens `gastId`, varje gång.
 *
 * ⛔ "ÅTERKALLAD" LAGRAS INTE PÅ ÄRENDET. Det härleds ur inbjudan varje gång (`tolkaGastMottagare` med listan ur tjänstens `levandeGaster`): ett märke på raden hade glidit isär från inbjudan, och en ny inbjudan
 * till samma adress hade lämnat märket kvar. Delegeringen står kvar när inbjudan dras tillbaka, och medlemmarna ser då "Gäst (inbjudan återkallad)".
 */

/**
 * Bygger en gäst som ansvarig för ett ärende, eller kastar med skälet. Med `levande` (tjänstens `levandeGaster().gaster`) prövas också att gästen har en levande gruppinbjudan: det är appens utdelning som
 * ska ge det beskedet innan raden skrivs.
 *
 * @param {unknown} m
 * @param {ReadonlyArray<{ gastId: string }>} [levande]
 * @returns {Readonly<{ slag: "gast", gastId: string, namn: string }>}
 */
export function byggGastMottagare(m, levande) {
  const rad = /** @type {Record<string, unknown>} */ (m && typeof m === "object" ? m : {});
  if (rad.slag !== "gast") throw new Error(`byggGastMottagare: slaget är "gast", fick ${JSON.stringify(rad.slag)}.`);
  const okanda = Object.keys(rad).filter((k) => k !== "slag" && k !== "gastId" && k !== "namn");
  if (okanda.length) throw new Error(`byggGastMottagare: okända fält ${okanda.join(", ")}. Formen är { slag: "gast", gastId, namn }. En adress eller ett uid har ingen plats på ärendet.`);
  if (!arGastId(rad.gastId)) throw new Error("byggGastMottagare: gastId krävs, gästens identitet (g_ och 40 tecken) ur tjänstens levandeGaster.");
  const namn = typeof rad.namn === "string" ? rad.namn.trim() : "";
  if (namn.length > MAX_GASTNAMN) throw new Error(`byggGastMottagare: namnet får vara högst ${MAX_GASTNAMN} tecken.`);
  if (levande && !levande.some((g) => g && g.gastId === rad.gastId)) throw new Error(`byggGastMottagare: "${rad.gastId}" har ingen levande gruppinbjudan. Ett ärende delegeras bara till en gäst som är inbjuden.`);
  return Object.freeze({ slag: "gast", gastId: /** @type {string} */ (rad.gastId), namn: namn || GASTNAMNLOS });
}

/**
 * Är ärendets mottagare den här gästen? Den ENDA definitionen av vilka ärenden en gäst ser och får röra (regel 2): servern prövar den på varje rad, i `arenden` såväl som i `kommenteraArende` och
 * `markeraArendeKlart`. En rad utan mottagare, med en person, gruppen eller en annan gäst som mottagare är `false`.
 *
 * @param {unknown} mottagare Radens `mottagare`.
 * @param {string} gId Sessionens `gastId`.
 * @returns {boolean}
 */
export function gastDelegerad(mottagare, gId) {
  const m = /** @type {Record<string, unknown> | null} */ (mottagare);
  return arGastId(gId) && m !== null && typeof m === "object" && m.slag === "gast" && m.gastId === gId;
}

/**
 * Medlemmarnas läsning av en gäst som ansvarig: namnet, och om inbjudan lever. `null` när mottagaren inte är en gäst.
 *
 * `levande` är tjänstens `levandeGaster().gaster`. ⛔ TRE UTFALL OCH INTE TVÅ: `aterkallad: false` (gästen finns i listan), `true` (listan finns och gästen saknas i den), och `null` när `levande` inte gavs. "Vet inte"
 * är inte "inte återkallad", och vyn visar då bara Gäst. Namnet är inbjudans när gästen lever (det kan ha ändrats), annars det som stod på ärendet, annars "Gäst".
 *
 * @param {unknown} mottagare
 * @param {ReadonlyArray<{ gastId: string, namn?: string }>} [levande]
 * @returns {{ gastId: string, namn: string, aterkallad: boolean | null } | null}
 */
export function tolkaGastMottagare(mottagare, levande) {
  const m = /** @type {Record<string, unknown> | null} */ (mottagare);
  if (!m || typeof m !== "object" || m.slag !== "gast" || !arGastId(m.gastId)) return null;
  const traff = levande ? levande.find((g) => g && g.gastId === m.gastId) : undefined;
  const lagrat = typeof m.namn === "string" ? m.namn.trim() : "";
  const levandeNamn = typeof traff?.namn === "string" ? traff.namn.trim() : "";
  return { gastId: /** @type {string} */ (m.gastId), namn: levandeNamn || lagrat || GASTNAMNLOS, aterkallad: levande ? !traff : null };
}

/** Högsta antal tecken i ett meddelande en gäst skriver i chatten (0.132.0, CP 2026-10-20: "Gästen får skriva"). Lägre än en medlems tak (`MAX_MEDDELANDE`): en gäst skriver inget långt. */
export const GASTSKRIV_MAX_TECKEN = 1000;
/** Högsta antal meddelanden en gäst skriver per inbjudan och minut. Räknas i `gastraknare`, som övriga gästräknare, och är strängare än läsningen (`GASTANROP_PER_MINUT`). */
export const GASTSKRIV_PER_MINUT = 10;

/** Sökvägen gästsidan ritas på. Appen lägger sidan där före sin inloggningsgrind. */
export const GASTSOKVAG = "/gast";

/**
 * Fälten i en inbjudningspost. `id` är hashen av (grupp, adress, omfång) och är dokumentets id, inte ett fält.
 * `nyckelHash` är SHA-256 av nyckeln i brevet: nyckeln själv lagras aldrig.
 */
export const GASTFALT = /** @type {const} */ ([
  "groupId",
  "epost",
  "namn",
  "omfang",
  "skapadAv",
  "skapad",
  "skickad",
  "antalSkickade",
  "lankGiltigTill",
  "nyckelHash",
  "forstInloggad",
  "aterkallad",
  "felAntal",
  "felFonster",
]);

/**
 * Fälten på en gäst i medlemmens lista (`lista`). Inte `nyckelHash` och inte felräknarna: en lista som bär dem är ett svar som kan läcka mer än den visar.
 * `id` är med (för Skicka igen och Dra tillbaka), liksom `status`, som härleds (`gastStatus`) och inte lagras.
 */
export const GASTLISTFALT = /** @type {const} */ ([
  "id",
  "gastId",
  "epost",
  "namn",
  "omfang",
  "skapadAv",
  "skapad",
  "skickad",
  "antalSkickade",
  "forstInloggad",
  "aterkallad",
  "status",
]);

/**
 * Fälten i det svar en gäst får, och inget annat lämnar servern (`hamta`): inte gruppen, medlemmarna, andra gäster, adresser, chatten eller något av
 * appens fält som appen inte uttryckligen listat i `sak.falt`. En öppen lista, som `HANDELSESVARSFALT`: allt som skickas ut är något som kan läcka.
 * `grupp` (0.132.0) är gruppens namn och vilka funktioner gästen har, för en gruppinbjudan.
 */
export const GASTSVARSFALT = /** @type {const} */ (["ok", "namn", "funktion", "sak", "grupp"]);

/**
 * (0.132.0) Fälten i gruppens svar, per åtgärd. ⛔ ÖPPNA LISTOR, EN PER ÅTGÄRD: allt som skickas ut till en gäst bygges fält för fält ur de här, aldrig genom att ett helt
 * dokument sprids ut. En medlems adress, uid eller namn har ingen plats i någon av dem utom där det står: chattens avsändarnamn är ett namn och aldrig en adress eller ett uid.
 */
export const GASTGRUPPSVARSFALT = /** @type {const} */ ({
  /** `hamta` för en gruppinbjudan: gruppens namn och funktionerna. */
  hamta: ["namn", "funktioner"],
  /** Svaret på `chatt`. `fler`: det finns äldre meddelanden. `ingetNytt`: en ping där inget är nyare än `nyast`. */
  chatt: ["ok", "meddelanden", "fler", "ingetNytt"],
  /** Svaret på `skrivChatt`: meddelandet som det nu står i chatten, i samma form som en rad i `chatt`. */
  skrivChatt: ["ok", "meddelande"],
  /** Svaret på `kalender`. */
  kalender: ["ok", "handelser", "kalendrar", "avkortad", "ejVisade"],
  /** Svaret på `handelse`. */
  handelse: ["ok", "handelse", "svar", "omrostning"],
  /** Svaret på `bibliotek`. */
  bibliotek: ["ok", "poster", "avkortad"],
  /** (Skiva 3) Svaret på `arenden`: bara ärenden delegerade till gästen. `avkortad`: gästen har fler än listan visar. */
  arenden: ["ok", "poster", "avkortad"],
  /** (Skiva 3) Svaret på `kommenteraArende`: kommentaren som den nu står, i samma form som en rad i ett ärendes `kommentarer`. */
  kommenteraArende: ["ok", "kommentar"],
  /** (Skiva 3) Svaret på `markeraArendeKlart`. Vyn hämtar om ärendena, så svaret bär bara att det gick. */
  markeraArendeKlart: ["ok"],
  /** Svaret på `fil`. */
  fil: ["ok", "url", "namn", "mime"],
});

/**
 * (Skiva 3) Fälten på ett ärende hos en gäst: rubrik, text, status, förfallodag och kommentarer. ⛔ ALDRIG ärendets GitHub-adress eller repots namn, och aldrig ett uid, en adress eller ett annat fält appen har på raden.
 * `id` är ärendets id (det vyn skickar tillbaka). `fler`: det finns äldre kommentarer än de som visas.
 */
export const GASTARENDEFALT = /** @type {const} */ (["id", "rubrik", "text", "status", "forfallodag", "kommentarer", "fler"]);
/** (Skiva 3) Fälten på en kommentar hos en gäst. `av` är `{ namn }` och aldrig ett uid; `gast` är sant när en gäst skrev den (märket Gäst) och `egen` när det är gästens egen. */
export const GASTARENDEKOMMENTARFALT = /** @type {const} */ (["id", "text", "tid", "av", "gast", "egen"]);

/** Fälten på ett chattmeddelande hos en gäst. `av` är `{ namn }`; `gast` är sant när en gäst skrev det (märket Gäst) och `egen` när det är gästens eget (0.132.0); `svarPa` är ett citat `{ id, namn, text }` med kapad text; `namner` är namn och aldrig uid. */
export const GASTCHATTFALT = /** @type {const} */ (["id", "av", "text", "tid", "svarPa", "namner", "bilaga", "gast", "egen"]);

/**
 * Åtgärderna en gruppgäst anropar på servern (`POST /api/gast`), förutom `los`, `hamta`, `namn`, `nylank` och `raderaMig` som varje gäst har. Namnen står här och ingen annanstans (regel 2):
 * tjänstens metoder, appens vitlista för vad en handler släpper in, och vyns anrop läser samma lista.
 */
export const GASTGRUPPATGARDER = /** @type {const} */ (["chatt", "skrivChatt", "kalender", "handelse", "svara", "rosta", "bibliotek", "fil", "arenden", "kommenteraArende", "markeraArendeKlart"]);

/**
 * Bygger gruppvyns `api` av appens ENDA anrop mot `/api/gast`. `anrop` får `{ atgard, sessionsnyckel, ...argument }` och ska svara med serverns JSON (`{ ok, ... }`); appens handler skickar
 * `atgard` vidare till tjänstens metod med samma namn. Sessionsnyckeln läggs på här, så att vyn aldrig hanterar den.
 *
 * @param {(kropp: Record<string, any>) => Promise<any>} anrop
 * @param {string} sessionsnyckel
 * @returns {Record<(typeof GASTGRUPPATGARDER)[number], (argument?: Record<string, any>) => Promise<any>>}
 */
export function gastGruppApi(anrop, sessionsnyckel) {
  if (typeof anrop !== "function") throw new Error("gastGruppApi: anrop krävs, appens funktion som postar till /api/gast.");
  if (typeof sessionsnyckel !== "string" || !GASTNYCKELFORM.test(sessionsnyckel)) throw new Error("gastGruppApi: sessionsnyckel krävs, 43 tecken (ur sidan).");
  return /** @type {any} */ (Object.fromEntries(GASTGRUPPATGARDER.map((atgard) => [atgard, (/** @type {Record<string, any>} */ argument = {}) => anrop({ ...argument, atgard, sessionsnyckel })])));
}

/** Det en gäst ser i stället för namnet på en avsändare som inte längre finns bland gruppens medlemskap. Utskrivet, aldrig tomt (regel 5). */
export const GASTTIDIGAREMEDLEM = "Tidigare medlem";

/** Fälten på en händelse i gästens kalender. Ur appens händelse listas bara titel, beskrivning och plats (`grupp.handelseSida`), resten är ramverkets `HANDELSEKONTRAKT`. */
export const GASTHANDELSEFALT = /** @type {const} */ (["id", "titel", "beskrivning", "plats", "datum", "slutDatum", "tid", "slutTid", "heldag", "kalenderId", "kravSvar", "ejSatt"]);

/** Fälten på en gruppkalender i gästens svar. */
export const GASTKALENDERFALT = /** @type {const} */ (["id", "namn", "farg"]);

/** Fälten på en biblioteksfil i gästens svar. `sokvag` är postens id och ingen lagringssökväg: den riktiga sökvägen lämnar aldrig servern. */
export const GASTFILFALT = /** @type {const} */ (["sokvag", "namn", "mime", "byte", "klar"]);

/** Fälten på en biblioteksspost i gästens svar. */
export const GASTBIBLIOTEKFALT = /** @type {const} */ (["id", "typ", "rubrik", "text", "url", "kalla", "bild", "poster", "taggar", "fil", "utskrift", "durationMs", "peaks", "skapad", "andrad", "skapadAvNamn"]);

/** Fälten på en person i medlemmens lista (0.132.0, `lista` för en grupp): en rad per person och inte per inbjudan. Adressen ser medlemmarna ändå (CP 2026-10-20). */
export const GASTPERSONFALT = /** @type {const} */ (["gastId", "epost", "namn", "status", "inbjudningar"]);

/** Fälten på en av personens inbjudningar i medlemmens lista. `titel` är omröstningens rubrik när appen gett `grupp.handelseSida`. */
export const GASTPERSONINBJUDANFALT = /** @type {const} */ (["id", "omfang", "titel", "status", "skapad", "skickad", "antalSkickade", "forstInloggad", "aterkallad"]);

/**
 * Orsakerna till att en gäst inte släpps in, och inget annat.
 *
 * ⛔ `nej` ÄR ETT SVAR FÖR ALLT SOM SKULLE LÅTA EN OBEHÖRIG SKILJA FALL ÅT: okänt id, fel nyckel, fel adress, en sessionsnyckel som inte finns. Svaret är byte
 * för byte detsamma, annars går det att pröva sig fram till vilka inbjudningar som finns. `aterkallad` och `utgangen` ges först när nyckeln OCH adressen
 * stämde (eller sessionen fanns): då är det gästen själv, eller någon som har allt gästen har. `for-manga` är den enda orsaken som inte hör till inbjudan:
 * för många felaktiga försök. `saknas` är sakens egen: händelsen finns inte längre.
 */
export const GASTORSAKER = /** @type {const} */ (["nej", "aterkallad", "utgangen", "for-manga", "saknas"]);

/** @type {Record<"nej" | "aterkallad" | "utgangen" | "for-manga" | "saknas", string>} */
export const GASTFEL = {
  nej: "Länken eller adressen stämde inte",
  aterkallad: "Inbjudan är återkallad",
  utgangen: "Länken har gått ut",
  "for-manga": "För många försök. Vänta en stund och försök igen",
  saknas: "Det du bjöds in till finns inte längre",
};

/**
 * Felkoderna som tjänsten lägger på sina fel (`fel.kod`), för appens callable att översätta. Meddelandet är för loggen, koden är för klienten.
 * `platser-slut` är den som rutan svarar på med "Gruppen har 5 gäster".
 */
export const GASTFELKODER = /** @type {const} */ ([
  "ogiltig-epost",
  "ogiltigt-namn",
  "finns-inte",
  "ej-behorig",
  "platser-slut",
  "aterkallad",
  "brev-misslyckades",
  "ogiltigt-omfang",
  "ogiltig-text",
]);

/**
 * Svaret när någon ber om en ny länk, hur det än gick. ⛔ ALLTID DETTA, byte för byte: ett annat svar för en adress som har en inbjudan hade låtit vem som
 * helst fråga vilka adresser som är gäster (samma tanke som Identitys `ATERSTALL_SVAR`).
 */
export const GASTNYLANK_SVAR = "Om adressen har en inbjudan har vi skickat en länk.";

/** @type {readonly string[]} */
const STATUSAR = ["aterkallad", "utgangen", "har-rostat", "inloggad", "vantar"];

/** Gästens lägen i listan, i den ordning de prövas. `har-rostat` är appens kunskap (`harRostat`), de andra ligger i raden. */
export const GASTSTATUSAR = /** @type {readonly ("aterkallad" | "utgangen" | "har-rostat" | "inloggad" | "vantar")[]} */ (STATUSAR);

// ── Adressen och identiteten ──────────────────────────────────────────────────────────────────────────────────────────

/** Längsta adress som godtas, i tecken (RFC 5321: 254). */
export const MAX_GASTEPOST = 254;

/**
 * Adressen som den jämförs och lagras: trimmad, NFC och gemener. `null` om den inte går att skicka till (`epostFel`: tom, fel form eller en spärrad domän),
 * är längre än `MAX_GASTEPOST` eller innehåller tecken som inte hör hemma i en adress (blanksteg, styrtecken). Samma funktion på servern och i vyn:
 * "samma adress" betyder samma sak överallt (regel 2).
 *
 * @param {unknown} epost
 * @param {readonly string[]} [extraSparrade] Appens egna spärrade domäner (`epostFel`).
 * @returns {string | null}
 */
export function normaliseraGastepost(epost, extraSparrade = []) {
  if (typeof epost !== "string") return null;
  const a = epost.normalize("NFC").trim().toLowerCase();
  if (a.length === 0 || a.length > MAX_GASTEPOST) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(a)) return null;
  return epostFel(a, extraSparrade) === null ? a : null;
}

/** SHA-256:s rundkonstanter: de 32 första bitarna av bråkdelarna av kubikrötterna ur de 64 första primtalen. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** @param {number} x @param {number} n */
const ror = (x, n) => (x >>> n) | (x << (32 - n));

/**
 * SHA-256 i hex av en text (UTF-8). Ren JS och synkron, så att samma funktion kan köras i webbläsaren och på servern.
 *
 * ⛔ EN HEMGJORD SHA-256 ÄR BARA OKEJ HÄR FÖR ATT HASHEN INTE SKYDDAR NÅGOT. `gastId` är ett namn på en adress som medlemmarna ändå ser. Alla nycklar, sessioner
 * och inbjudnings-id i `src/node/gast.js` hashas med `node:crypto`. `gast.test.js` kräver att den här ger exakt samma svar som `node:crypto` för 300 texter
 * (tom, ASCII, åäö, emoji, och längder runt blockgränserna 55, 56, 63 och 64 byte där utfyllnaden går fel först).
 *
 * @param {string} text
 * @returns {string}
 */
export function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  const l = bytes.length;
  const total = ((l + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[l] = 0x80;
  const vy = new DataView(buf.buffer);
  vy.setUint32(total - 8, Math.floor(l / 0x20000000));
  vy.setUint32(total - 4, (l << 3) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = vy.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = ror(w[t - 15], 7) ^ ror(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = ror(w[t - 2], 17) ^ ror(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}

/**
 * Gästens identitet ur adressen: `g_` och de 40 första tecknen av SHA-256 av den normaliserade adressen (`normaliseraGastepost`). Samma adress ger samma
 * gäst, oavsett hur många inbjudningar eller grupper adressen finns i. Kastar för något som inte är en adress, så att en felskriven rad aldrig blir en gäst.
 *
 * @param {string} epost
 * @returns {string}
 */
export function gastId(epost) {
  const a = normaliseraGastepost(epost);
  if (a === null) throw new Error("gastId: en gäst har en e-postadress. Det som skickades in är ingen adress som går att skicka till.");
  return `g_${sha256Hex(a).slice(0, 40)}`;
}

// ── Omfånget, platserna och länken ────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ slag: "sak", funktion: "rosta", handelseId: string } | { slag: "grupp" }} Gastomfang
 *   `sak`: en omröstning på en händelse (skiva 1). `grupp` (0.132.0): hela gruppen, och gruppen står i inbjudans `groupId` och aldrig i omfånget (en sanning, regel 2).
 */

/**
 * Omfånget som text: `sak:rosta:<handelseId>` eller `grupp`. Det ingår i inbjudans id, så att samma adress till samma sak är en och samma rad.
 *
 * ⛔ DE BEFINTLIGA ID:N ÄNDRAS ALDRIG. `sak:rosta:<handelseId>` är exakt det skiva 1 skrev (ett prov låser fem id som fasta hashar), och `grupp` är en ny nyckel som inget
 * `sak`-id kan krocka med: ett handelseId står efter två kolon och nyckeln `grupp` har inga. Kastar för ett omfång som ingen version känner.
 *
 * @param {unknown} omfang
 * @returns {string}
 */
export function gastomfangsnyckel(omfang) {
  const o = /** @type {Record<string, unknown> | null} */ (omfang);
  if (!o || typeof o !== "object") throw new Error("gastomfangsnyckel: ett omfång krävs, { slag: 'sak', funktion: 'rosta', handelseId } eller { slag: 'grupp' }.");
  if (!(/** @type {readonly unknown[]} */ (GASTSLAG).includes(o.slag))) throw new Error(`gastomfangsnyckel: slaget ${JSON.stringify(o.slag)} finns inte. Giltiga: ${GASTSLAG.join(", ")}.`);
  if (o.slag === "grupp") {
    // ⛔ INGET ANNAT FÄLT PÅ ETT GRUPPOMFÅNG: ett handelseId eller en funktion hade gjort två rader av samma sak, eller en gruppinbjudan som ser ut som en omröstning.
    const extra = Object.keys(o).filter((k) => k !== "slag");
    if (extra.length > 0) throw new Error(`gastomfangsnyckel: omfånget grupp har inga andra fält (fick ${extra.join(", ")}). Gruppen står i inbjudans groupId.`);
    return "grupp";
  }
  if (!(/** @type {readonly unknown[]} */ (GASTFUNKTIONER).includes(o.funktion))) {
    throw new Error(`gastomfangsnyckel: funktionen ${JSON.stringify(o.funktion)} finns inte. Giltiga: ${GASTFUNKTIONER.join(", ")}.`);
  }
  if (typeof o.handelseId !== "string" || o.handelseId.trim() === "") throw new Error("gastomfangsnyckel: handelseId krävs för en sak.");
  return `${o.slag}:${o.funktion}:${o.handelseId}`;
}

/**
 * Ger omfånget gästen den här funktionen? Den enda definitionen (regel 2): tjänstens `session` prövar den, och vyn och proven läser samma.
 *
 *   - krav `{ slag: "grupp", funktion: "chatt" }`: bara en gruppinbjudan, och bara för en av `GASTGRUPPFUNKTIONER`.
 *   - krav `{ slag: "sak", funktion: "rosta" }` eller `{ funktion: "rosta" }` (skiva 1): bara en sakinbjudan vars funktion är den.
 *   - ett krav på en funktion som inget omfång ger, eller ett slag som inte är omfångets: nej.
 *
 * @param {unknown} omfang
 * @param {{ slag?: unknown, funktion?: unknown }} krav
 * @returns {boolean}
 */
export function gastOmfangGer(omfang, krav) {
  const o = /** @type {Record<string, unknown> | null} */ (omfang);
  if (!o || typeof o !== "object" || !krav || typeof krav !== "object") return false;
  if (krav.slag !== undefined && krav.slag !== o.slag) return false;
  if (o.slag === "grupp") return typeof krav.funktion === "string" && /** @type {readonly string[]} */ (GASTGRUPPFUNKTIONER).includes(krav.funktion);
  if (o.slag === "sak") return typeof krav.funktion === "string" && krav.funktion === o.funktion;
  return false;
}

/** Platsnumren: 1 till `GAST_PLATSER_GRATIS`. Härledda ur taket, aldrig en egen lista. */
export const GASTPLATSNUMMER = Object.freeze(Array.from({ length: GAST_PLATSER_GRATIS }, (_, i) => i + 1));

/**
 * Dokument-id:t för en plats: `<grupp>|<nummer>`. Fem fasta dokument per grupp, och att ta en plats är att skapa ett av dem (`createNew`): taket är då en
 * egenskap hos nycklarna och inte en räkning som två samtidiga inbjudningar kan korsa. Avgränsaren är medlemskapets (ett grupp-id kan inte innehålla den).
 *
 * @param {string} groupId
 * @param {number} nummer
 * @returns {string}
 */
export function gastplatsId(groupId, nummer) {
  if (typeof groupId !== "string" || groupId === "" || groupId.includes("|") || groupId.includes("/")) {
    throw new Error("gastplatsId: groupId krävs, utan | och /.");
  }
  if (!GASTPLATSNUMMER.includes(nummer)) throw new Error(`gastplatsId: platsen ${String(nummer)} finns inte. Giltiga: 1 till ${GAST_PLATSER_GRATIS}.`);
  return `${groupId}|${nummer}`;
}

/**
 * Länken i brevet: appens basadress, `/gast` och ett FRAGMENT med id och nyckel (`#i=<id>&k=<nyckel>`).
 *
 * ⛔ NYCKELN LIGGER I FRAGMENTET, INTE I SÖKVÄGEN. Ett fragment skickas aldrig till en server av webbläsaren: det hamnar inte i Hostings begärandelogg, inte i
 * `Referer` och inte i ett mejlprograms förhandshämtning, som bara hämtar sidan och aldrig kör dess skript. Delningens `/g/<adress>` ligger i sökvägen och loggas;
 * det är rätt för en publik adress och fel för en nyckel. Sidan postar nyckeln själv, först när gästen skrivit sin adress.
 *
 * @param {string} bas Instansens adress med protokoll och utan sökväg, till exempel `https://my.life-hub.app`.
 * @param {{ id: string, nyckel: string }} lank
 * @returns {string}
 */
export function gastLank(bas, lank) {
  if (typeof bas !== "string" || !/^https?:\/\/[^\s/]+$/.test(bas.replace(/\/+$/, ""))) {
    throw new Error("gastLank: basadressen är instansens adress med protokoll och utan sökväg, till exempel https://my.life-hub.app.");
  }
  if (!lank || !GASTINBJUDNINGSIDFORM.test(lank.id) || !GASTNYCKELFORM.test(lank.nyckel)) {
    throw new Error("gastLank: { id, nyckel } krävs, id som 64 hextecken och nyckeln som 43 tecken ur A-Z, a-z, 0-9, - och _.");
  }
  return `${bas.replace(/\/+$/, "")}${GASTSOKVAG}#i=${lank.id}&k=${lank.nyckel}`;
}

/**
 * Id och nyckel ur adressens fragment (`location.hash`), eller `null` om det inte är en gästlänk. Tolerant för ett inledande `#`, strikt för formen:
 * en halv länk (bara id) ger `null`, så att sidan frågar efter adressen i stället för att försöka lösa in något som aldrig kan stämma.
 *
 * @param {unknown} fragment
 * @returns {{ id: string, nyckel: string } | null}
 */
export function tolkaGastLank(fragment) {
  if (typeof fragment !== "string") return null;
  const delar = fragment.replace(/^#/, "").split("&");
  /** @type {Record<string, string>} */
  const v = {};
  for (const d of delar) {
    const i = d.indexOf("=");
    if (i > 0) v[d.slice(0, i)] = d.slice(i + 1);
  }
  if (!v.i || !v.k || !GASTINBJUDNINGSIDFORM.test(v.i) || !GASTNYCKELFORM.test(v.k)) return null;
  return { id: v.i, nyckel: v.k };
}

/**
 * Gästens läge i listan, härlett ur raden och inte lagrat (regel 2: ett fält som kunde säga emot raderna vore en andra sanning).
 * Prövas i den här ordningen: `aterkallad`, `utgangen` (länken har gått ut och ingen har loggat in), `har-rostat` (appens `harRostat`), `inloggad`, `vantar`.
 *
 * @param {{ aterkallad?: number | null, forstInloggad?: number | null, lankGiltigTill?: number | null }} rad
 * @param {{ nu: number, harRostat?: boolean }} val
 * @returns {"aterkallad" | "utgangen" | "har-rostat" | "inloggad" | "vantar"}
 */
export function gastStatus(rad, val) {
  if (typeof rad?.aterkallad === "number") return "aterkallad";
  const inloggad = typeof rad?.forstInloggad === "number";
  if (!inloggad && typeof rad?.lankGiltigTill === "number" && rad.lankGiltigTill <= val.nu) return "utgangen";
  if (val.harRostat === true) return "har-rostat";
  return inloggad ? "inloggad" : "vantar";
}
