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
 * ══ ⛔ NAMN OCH BILD UPPDATERAS INTE HELLER ═══════════════════════════
 *
 * Frestande, eftersom de kommer ur inloggningen och kan ha ändrats där. Men då
 * är raden inte längre personens egen: den som redigerar sitt namn i appen får
 * det överskrivet nästa gång hen loggar in, utan att något sa till. En
 * uppdatering av namnet är en egen åtgärd, inte en bieffekt av att öppna appen.
 */

import { byggAnvandare } from "./grupp.js";

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
    return { anvandare: byggAnvandare({ ...fanns, id: uid }), skapad: false };
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
 * Sparar det personen själv ändrar: språk och tema.
 *
 * ⛔ BARA DE TVÅ. E-posten är identiteten och kommer ur inloggningen, och namn
 * och bild hör till en egen åtgärd. En funktion som tar emot vad som helst blir
 * vägen runt de gränserna.
 *
 * @param {object} config
 * @param {import("../data/contract.js").DataSource<any>} config.kalla
 * @param {import("./grupp.js").Anvandare} config.anvandare
 * @param {{ sprak?: string, tema?: string }} config.andring
 * @param {string} [config.samling]
 * @returns {Promise<import("./grupp.js").Anvandare>}
 */
export async function sparaInstallningar({ kalla, anvandare, andring, samling = "users" }) {
  const okanda = Object.keys(andring || {}).filter((n) => n !== "sprak" && n !== "tema");
  if (okanda.length > 0) {
    throw new Error(
      `sparaInstallningar: fälten ${okanda.join(", ")} går inte att spara här. Bara sprak och tema är personens egna. E-posten är identiteten, och namn och bild hör till en egen åtgärd.`,
    );
  }
  // ⛔ Validerad FÖRE skrivningen. Ett okänt språk som skrivs och valideras vid
  // nästa läsning är en rad som gör appen ostartbar för den som skrev den.
  const nasta = byggAnvandare({ ...anvandare, ...andring });
  await kalla.update(samling, anvandare.id, { sprak: nasta.sprak, tema: nasta.tema });
  return nasta;
}
