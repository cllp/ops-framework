/**
 * Läser en vald fil till en data-URL som ryms i ett dokument.
 *
 * ══ ⛔ VARFÖR EN DATA-URL OCH INTE EN UPPLADDNING ════════════════════════
 *
 * Ramverket vet inte om plattformen har en fillagring, och får inte anta det.
 * En data-URL går att skriva i samma dokument som resten av posten, alltså EN
 * skrivning som antingen lyckas eller misslyckas. Två skrivningar ger två
 * felfall, och det ena är en föräldralös fil som ingen städar.
 *
 * ⛔ DET HÄR SLUTAR VARA RÄTT när bilagorna ska vara många, stora eller
 * långlivade. Då är en riktig fillagring svaret och den här filen ska bort, inte
 * byggas ut med undantag.
 *
 * ══ ⛔ BILDER KRYMPS, ANDRA FILER GÖR DET INTE ═══════════════════════════
 *
 * En bild går att skala ned utan att sluta vara samma bild. En PDF, ett
 * kalkylark eller ett kontoutdrag gör det inte: det finns inget "nästan lika bra"
 * att falla tillbaka på. Därför krymps bilder i steg, och allt annat får antingen
 * plats eller avvisas med besked.
 *
 * ⛔ Storleken kontrolleras INNAN filen läses in när den omöjligt kan rymmas. Att
 * läsa in en 40 MB fil för att sedan säga nej är ett sätt att låta webbläsaren
 * hänga i flera sekunder på en telefon, och det ser ut som att appen kraschat.
 */

/** Längsta sidan i pixlar efter nedskalning. En telefonbild är 3000 px och behöver inte vara det. */
export const MAX_SIDA = 1600;

/** Kvalitetssteg, i fallande ordning. Sista steget är fult men läsbart. */
const KVALITETER = [0.75, 0.6, 0.45, 0.3];

/**
 * Hur många tecken en data-URL blir per byte.
 *
 * ⛔ Base64 är 4 tecken per 3 byte, alltså 1,333, plus prefixet `data:...;base64,`.
 * 1,4 är en avrundning UPPÅT med flit: en förhandsbedömning som underskattar
 * släpper igenom filer som sedan avvisas efter inläsningen, och då har man väntat
 * i onödan.
 */
const TECKEN_PER_BYTE = 1.4;

/**
 * @typedef {object} Bilaga
 * @property {string} dataUrl
 * @property {string} namn Filens namn som användaren ser det.
 * @property {string} typ MIME-typ, tom sträng när webbläsaren inte vet.
 * @property {number} tecken Längden på data-URL:en, alltså vad den kostar i dokumentet.
 * @property {number} [bredd] Bara för bilder som gick att läsa.
 * @property {number} [hojd] Bara för bilder som gick att läsa.
 */

/**
 * Är det här en bild?
 *
 * ⛔ Tar MIME-TYPEN och inte filen, så samma fråga går att ställa om en fil man
 * just valt och om en bilaga man läst ur en databas. Två funktioner för samma
 * fråga hade varit två ställen att glömma `image/svg+xml` på.
 *
 * @param {string} typ
 */
export function arBild(typ) {
  return typeof typ === "string" && typ.indexOf("image/") === 0;
}

/** @param {number} byte */
export function storlekstext(byte) {
  if (!Number.isFinite(byte) || byte <= 0) return "";
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** @param {number} bredd @param {number} hojd */
function skalat(bredd, hojd) {
  const langst = Math.max(bredd, hojd);
  if (langst <= MAX_SIDA) return { bredd, hojd };
  const faktor = MAX_SIDA / langst;
  return { bredd: Math.round(bredd * faktor), hojd: Math.round(hojd * faktor) };
}

/** @param {File | Blob} fil @returns {Promise<string>} */
function lasSomDataUrl(fil) {
  return new Promise((klart, fel) => {
    const lasare = new FileReader();
    lasare.onerror = () => fel(new Error("Filen kunde inte läsas."));
    lasare.onload = () => klart(String(lasare.result || ""));
    lasare.readAsDataURL(fil);
  });
}

/**
 * @param {File | Blob} fil
 * @param {number} maxTecken
 * @returns {Promise<Bilaga | null>} null när bilden inte gick att avkoda, så anroparen kan falla tillbaka på att bifoga den som fil.
 */
async function krympBild(fil, maxTecken) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(fil);
  } catch {
    // ⛔ Inte ett fel här, utan ett "nej". Webbläsare skiljer sig i vilka
    // bildformat de kan AVKODA (HEIC är det vanliga fallet), och en fil som inte
    // går att visa går fortfarande utmärkt att bifoga. Anroparen avgör.
    return null;
  }

  const { bredd, hojd } = skalat(bitmap.width, bitmap.height);
  const duk = document.createElement("canvas");
  duk.width = bredd;
  duk.height = hojd;
  const ritare = duk.getContext("2d");
  if (!ritare) {
    bitmap.close?.();
    return null;
  }
  ritare.drawImage(bitmap, 0, 0, bredd, hojd);
  bitmap.close?.();

  for (const kvalitet of KVALITETER) {
    const dataUrl = duk.toDataURL("image/jpeg", kvalitet);
    if (dataUrl.length <= maxTecken) {
      return {
        dataUrl,
        namn: namnFor(fil),
        // ⛔ `image/jpeg` och inte filens ursprungliga typ. Duken har skrivit om
        // den, och en HEIC som sparas märkt `image/heic` men innehåller JPEG är
        // en lögn nästa läsare tror på.
        typ: "image/jpeg",
        tecken: dataUrl.length,
        bredd,
        hojd,
      };
    }
  }
  return null;
}

/** @param {File | Blob} fil */
function namnFor(fil) {
  const namn = /** @type {any} */ (fil).name;
  if (typeof namn === "string" && namn) return namn;
  // Urklippsbilder är Blob utan namn. Ett tomt namn i en lista ser ut som en
  // trasig post, så den får säga vad den är.
  return arBild(fil.type) ? "Urklipp" : "Fil";
}

/**
 * Läser filen till en bilaga, eller kastar med ett besked användaren kan agera på.
 *
 * ⛔ FELMEDDELANDENA SÄGER VAD MAN SKA GÖRA. "Kunde inte spara" lämnar den som
 * försöker med ett val mellan att ge upp och att försöka igen i blindo, och det
 * är så folk slutar rapportera saker.
 *
 * @param {File | Blob} fil
 * @param {{ maxTecken: number }} granser
 * @returns {Promise<Bilaga>}
 */
export async function lasBilaga(fil, { maxTecken }) {
  if (!fil) throw new Error("Ingen fil vald.");

  if (arBild(fil.type)) {
    const krympt = await krympBild(fil, maxTecken);
    if (krympt) return krympt;
    // Gick inte att avkoda eller inte att krympa nog. Faller igenom till
    // råvägen nedan, som bifogar filen som den är om den ryms.
  }

  const storlek = typeof (/** @type {any} */ (fil).size) === "number" ? /** @type {any} */ (fil).size : 0;
  if (storlek * TECKEN_PER_BYTE > maxTecken) {
    throw new Error(
      `Filen är för stor (${storlekstext(storlek)}). ` +
        (arBild(fil.type)
          ? "Den här webbläsaren kunde inte läsa bildformatet och kan därför inte krympa den. Spara om den som JPEG eller PNG, eller klistra in en skärmbild."
          : "Dela upp den, eller skicka en sida eller en skärmbild av det som är relevant."),
    );
  }

  const dataUrl = await lasSomDataUrl(fil);
  if (dataUrl.length > maxTecken) {
    throw new Error(`Filen är för stor (${storlekstext(storlek)}). Skicka ett utdrag eller en skärmbild i stället.`);
  }
  return { dataUrl, namn: namnFor(fil), typ: fil.type || "", tecken: dataUrl.length };
}
