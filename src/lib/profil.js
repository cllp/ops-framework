/**
 * Profilraden: den skapas vid FÖRSTA inloggningen, och bara då.
 *
 * ══ ⛔ VARFÖR RAMVERKET GÖR DET OCH INTE APPEN (#138) ══════════════════
 *
 * CP 2026-09-27: "finns ingen profil nu, och ingen logout. Jag vill gärna att
 * det skall finnas i ramverket." Varje app som gör det själv gör det lite
 * olika, och den som loggar in i två appar möter då två sorters profil.
 *
 * ══ ⛔ OCH BARA VID FÖRSTA, VILKET ÄR HELA POÄNGEN ════════════════════
 *
 * Språk och tema bor i `users/{uid}` för att de ska följa personen mellan
 * enheter. Skrevs raden vid varje inloggning skulle inloggningens uppgifter
 * skriva över dem, alltså: du byter till mörkt läge på telefonen, loggar in på
 * datorn, och telefonen är ljus igen nästa gång. Det felet ser inte ut som ett
 * fel, det ser ut som att appen inte minns.
 *
 * ⛔ DÄRFÖR LÄSER DEN FÖRST OCH SKRIVER BARA PÅ `null`. Ett `create` med ett
 * eget id ERSÄTTER posten, ordagrant enligt datalagrets kontrakt, så ett
 * ovillkorligt anrop hade varit exakt den överskrivningen.
 *
 * ══ ⛔ NAMN OCH BILD UPPDATERAS INTE AV INLOGGNINGEN ═══════════════════
 *
 * Frestande, eftersom de kommer ur inloggningen och kan ha ändrats där. Men då
 * är raden inte längre personens egen: den som redigerar sitt namn i appen får
 * det överskrivet nästa gång hen loggar in, utan att något sa till. En
 * uppdatering av namnet är en egen åtgärd, inte en bieffekt av att öppna appen.
 *
 * ⛔ #156: DEN EGNA ÅTGÄRDEN FINNS NU, OCH DET ÄR `sparaInstallningar`.
 * Personen kan själv ändra namn, bild, telefon, stad, presentation och länkar,
 * precis som hon redan kan ändra språk och tema. Det som ändras HÄR är att
 * `sparaInstallningar` skriver till FLER fält, inte att raden plötsligt
 * skrivs om av något appen inte bad om.
 *
 * ⛔ MEN `sparaInstallningar` SKRIVER BARA `users/{uid}`. En ändring av namn
 * eller bild lämnar sina denormaliserade kopior i `memberships` (#138)
 * oförändrade, av samma skäl som klienten aldrig får skriva den samlingen
 * alls (#136): `allow write: if false`. Den app som vill hålla
 * medlemslistorna i takt anropar EFTERÅT en server-callable byggd på
 * `uppdateraProfil` (`@staiger/ops-framework/node`), som skriver users OCH
 * alla medlemskap för uid i samma steg. Utan det anropet gäller samma
 * ärvda eftersläpning som redan stod här: ett namn i medlemslistan kan bli
 * inaktuellt, precis som det redan kunde bli mot Google.
 */

import { byggAnvandare } from "./grupp.js";

/**
 * Fälten personen själv äger på sin rad. `id` och `epost` är INTE med: `id`
 * är nyckeln, och `epost` är identiteten och kommer ur inloggningen (se
 * filhuvudet i `grupp.js`).
 */
const PERSONFALT = ["sprak", "tema", "namn", "telefon", "stad", "presentation", "lankar", "bild", "bildSokvag", "ikon", "farg"];

/**
 * @typedef {object} Inloggad
 * @property {string} uid
 * @property {string} [namn]
 * @property {string} [epost]
 * @property {string} [bild]
 */

/**
 * Läser profilraden, och skapar den om den saknas.
 *
 * ⛔ SVARAR ALLTID MED EN RAD, eller kastar. En vy som får `null` här måste
 * rita ett tredje läge mellan "inloggad" och "utloggad", och det läget finns
 * inte i verkligheten: är du inloggad har du en profil.
 *
 * @param {object} config
 * @param {import("../data/contract.js").DataSource<any>} config.kalla
 * @param {Inloggad} config.inloggad
 * @param {string} [config.samling] Förval `users`.
 * @returns {Promise<{ anvandare: import("./grupp.js").Anvandare, skapad: boolean }>}
 */
export async function sakerstallAnvandare({ kalla, inloggad, samling = "users" }) {
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.create !== "function") {
    throw new Error("sakerstallAnvandare: en datakälla med read och create krävs.");
  }
  const uid = typeof inloggad?.uid === "string" ? inloggad.uid.trim() : "";
  if (!uid) {
    throw new Error("sakerstallAnvandare: den inloggades uid krävs. Utan det finns ingen rad att läsa eller skapa.");
  }

  const fanns = await kalla.read(samling, uid);
  if (fanns) {
    /*
     * ⛔ DEN LÄSTA RADEN GÅR OCKSÅ GENOM `byggAnvandare`. En rad som skrevs av
     * en äldre version, eller för hand, kan sakna tema eller bära ett språk som
     * inte finns, och då ska det synas här och inte som en tom rullgardin.
     */
    const lasta = byggAnvandare({ ...fanns, id: uid });
    /*
     * ⛔ ETT TOMT NAMN FYLLS, ETT ÅTERSTÄLLT RÖRS ALDRIG (0.40.1, #218). Raden skapades vid första inloggningen med
     * `namn: inloggad.namn ?? ""`: hade inloggningen inget namn då (e-postlänk, lösenord utan visningsnamn) blev
     * namnet tomt, och inget senare ledde till att det fylldes, så varje medlemskap som skrevs ur raden bar ett tomt
     * namn och en lista ritade uid:t. Här fylls det när det är TOMT och inloggningen nu bär ett. Ett namn som finns
     * skrivs aldrig över (se filhuvudet): fylla en lucka är inte samma sak som att inloggningen vinner över personen.
     */
    const inloggatNamn = typeof inloggad.namn === "string" ? inloggad.namn.trim() : "";
    if (!lasta.namn && inloggatNamn && typeof kalla.update === "function") {
      await kalla.update(samling, uid, { namn: inloggatNamn });
      return { anvandare: byggAnvandare({ ...fanns, id: uid, namn: inloggatNamn }), skapad: false };
    }
    return { anvandare: lasta, skapad: false };
  }

  const ny = byggAnvandare({
    id: uid,
    namn: inloggad.namn ?? "",
    epost: inloggad.epost ?? "",
    bild: inloggad.bild ?? "",
  });
  await kalla.create(samling, ny);
  return { anvandare: ny, skapad: true };
}

/**
 * Sparar det personen själv ändrar: språk, tema, namn, bild, telefon, stad,
 * presentation och länkar.
 *
 * ⛔ BARA DE ÅTTA (`PERSONFALT`). E-posten är identiteten och kommer ur
 * inloggningen, den ändras aldrig här. En funktion som tar emot vad som helst
 * blir vägen runt den gränsen.
 *
 * ⛔ #156: NAMN OCH BILD FICK SÄLLSKAP AV SEX FÄLT TILL. Skriver `andring`
 * `namn` eller `bild` uppdateras BARA `users/{uid}` här. `memberships` bär
 * denormaliserade kopior (#138) och skrivs aldrig av en klient (#136), se
 * filhuvudets not om `uppdateraProfil`.
 *
 * @param {object} config
 * @param {import("../data/contract.js").DataSource<any>} config.kalla
 * @param {import("./grupp.js").Anvandare} config.anvandare
 * @param {{ sprak?: string, tema?: string, namn?: string, telefon?: string, stad?: string, presentation?: string, lankar?: { plattform: string, url: string }[], bild?: string, bildSokvag?: string }} config.andring
 * @param {string} [config.samling]
 * @param {ReadonlyArray<{ id: string }> | ReadonlyArray<string>} [config.tillatnaPlattformar] Vidarebefordras till `byggAnvandare` för `lankar`.
 * @returns {Promise<import("./grupp.js").Anvandare>}
 */
export async function sparaInstallningar({ kalla, anvandare, andring, samling = "users", tillatnaPlattformar }) {
  const okanda = Object.keys(andring || {}).filter((n) => !PERSONFALT.includes(n));
  if (okanda.length > 0) {
    throw new Error(
      `sparaInstallningar: fälten ${okanda.join(", ")} går inte att spara här. Personens egna fält är ${PERSONFALT.join(", ")}. E-posten är identiteten och kommer ur inloggningen.`,
    );
  }
  // ⛔ Validerad FÖRE skrivningen. Ett okänt språk eller en trasig länk som
  // skrivs och valideras vid nästa läsning är en rad som gör appen ostartbar
  // för den som skrev den.
  const nasta = byggAnvandare({ ...anvandare, ...andring }, tillatnaPlattformar);
  /** @type {Record<string, any>} */
  const skriv = {};
  for (const falt of PERSONFALT) skriv[falt] = nasta[/** @type {keyof import("./grupp.js").Anvandare} */ (falt)];
  await kalla.update(samling, anvandare.id, skriv);
  return nasta;
}

/**
 * Vad som ändrats mot den sparade raden, och om något alls har det.
 *
 * ══ ⛔ VARFÖR DET HÄR INTE BOR I VYN (#138) ════════════════════════════
 *
 * `OpsSelect` är en Radix Select, alltså ingen `<select>`. Den går inte att
 * driva med `fireEvent.change` i jsdom, och ett prov som försöker står grönt
 * genom varje fel: spionen anropas aldrig, och `not.toHaveBeenCalled` är sant
 * både när vyn är rätt och när den är trasig.
 *
 * ⛔ SVARET ÄR INTE ETT PROV TILL, UTAN ETT BESLUT PÅ EN MÄTBAR PLATS. Vyn
 * ritar och samlar in; vad "ändrat" betyder och vad som skickas vidare avgörs
 * här, där ett prov kan se det. Det är samma val som `simulera()` i appen och
 * `caseStatus` i händelselistan.
 *
 * ⛔ #156: BROTT UT ÖVER ALLA `PERSONFALT`, INTE BARA SPRÅK OCH TEMA. Samma
 * skäl som förut, fast nu för fler fält: `OpsChip` (plattformsval) och
 * `OpsField`/textarea för namn/telefon/stad/presentation går att driva med
 * `fireEvent.change`, men beslutet om VAD SOM RÄKNAS SOM ÄNDRAT och vad som
 * skickas vidare ska ändå avgöras på ett ställe ett prov kan se, inte
 * upprepas i varje vy som visar en profil.
 *
 * ⛔ `lankar` JÄMFÖRS SOM VÄRDE, INTE SOM REFERENS. Två listor med samma
 * innehåll i samma ordning är inte "ändrade" bara för att den ena är en ny
 * array. `JSON.stringify` räcker: `lankar` är alltid `{ plattform, url }`,
 * alltså platt data utan datum eller annat som kodas olika mellan varv.
 *
 * @param {import("./grupp.js").Anvandare} anvandare Den sparade raden.
 * @param {Partial<Record<typeof PERSONFALT[number], any>>} utkast Det vyn just nu visar.
 * @returns {{ andrat: boolean, andring: Record<typeof PERSONFALT[number], any> }}
 */
export function andringen(anvandare, utkast = {}) {
  /** @type {Record<string, any>} */
  const andring = {};
  let andrat = false;
  for (const falt of PERSONFALT) {
    const varde = /** @type {any} */ (utkast)[falt] ?? /** @type {any} */ (anvandare)[falt];
    andring[falt] = varde;
    const sparat = /** @type {any} */ (anvandare)[falt];
    const olika = falt === "lankar" ? JSON.stringify(varde ?? []) !== JSON.stringify(sparat ?? []) : varde !== sparat;
    if (olika) andrat = true;
  }
  return { andrat, andring: /** @type {any} */ (andring) };
}
