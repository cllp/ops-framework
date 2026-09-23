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
export const MAX_SIDE = 1600;

/** Kvalitetssteg, i fallande ordning. Sista steget är fult men läsbart. */
const QUALITIES = [0.75, 0.6, 0.45, 0.3];

/**
 * Hur många tecken en data-URL blir per byte.
 *
 * ⛔ Base64 är 4 tecken per 3 byte, alltså 1,333, plus prefixet `data:...;base64,`.
 * 1,4 är en avrundning UPPÅT med flit: en förhandsbedömning som underskattar
 * släpper igenom filer som sedan avvisas efter inläsningen, och då har man väntat
 * i onödan.
 */
const CHARS_PER_BYTE = 1.4;

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
 * @param {string} kind
 */
export function isImage(kind) {
  return typeof kind === "string" && kind.indexOf("image/") === 0;
}

/**
 * Ungefär hur stor en LAGRAD bilaga är, utifrån vad den kostar i dokumentet.
 *
 * ⛔ FINNS FÖR ATT `CHARS_PER_BYTE` INTE SKA STÅ I EN APP. En bilaga lagrar
 * `chars` och inte byte, eftersom det är tecknen som räknas mot dokumentgränsen.
 * En vy som vill visa en storlek måste då räkna tillbaka, och gjorde den det
 * själv skulle 1,4 stå i varje app som visar en bilaga. Det är samma tal på tre
 * ställen, och det tredje är alltid det som glöms den dag det ändras.
 *
 * ⛔ Resultatet är en UNGEFÄRLIG storlek och ska läsas så. Base64-overheaden är
 * inte exakt 1,4, och prefixet räknas med. Skillnaden syns inte i "2 kB", vilket
 * är precis den precision frågan har.
 *
 * @param {number} chars
 */
export function attachmentSize(chars) {
  return sizeText(Math.round(chars / CHARS_PER_BYTE));
}

/** @param {number} byte */
export function sizeText(byte) {
  if (!Number.isFinite(byte) || byte <= 0) return "";
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** @param {number} width @param {number} height */
function scaled(width, height) {
  const longest = Math.max(width, height);
  if (longest <= MAX_SIDE) return { width, height };
  const factor = MAX_SIDE / longest;
  return { width: Math.round(width * factor), height: Math.round(height * factor) };
}

/** @param {File | Blob} file @returns {Promise<string>} */
function readAsDataUrl(file) {
  return new Promise((done, error) => {
    const reader = new FileReader();
    reader.onerror = () => error(new Error("Filen kunde inte läsas."));
    reader.onload = () => done(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

/**
 * @param {File | Blob} file
 * @param {number} maxChars
 * @returns {Promise<Bilaga | null>} null när bilden inte gick att avkoda, så anroparen kan falla tillbaka på att bifoga den som fil.
 */
async function shrinkImage(file, maxChars) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // ⛔ Inte ett fel här, utan ett "nej". Webbläsare skiljer sig i vilka
    // bildformat de kan AVKODA (HEIC är det vanliga fallet), och en fil som inte
    // går att visa går fortfarande utmärkt att bifoga. Anroparen avgör.
    return null;
  }

  const { width, height } = scaled(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const painter = canvas.getContext("2d");
  if (!painter) {
    bitmap.close?.();
    return null;
  }
  painter.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const quality of QUALITIES) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= maxChars) {
      return {
        dataUrl,
        namn: nameFor(file),
        // ⛔ `image/jpeg` och inte filens ursprungliga typ. Duken har skrivit om
        // den, och en HEIC som sparas märkt `image/heic` men innehåller JPEG är
        // en lögn nästa läsare tror på.
        typ: "image/jpeg",
        tecken: dataUrl.length,
        bredd: width,
        hojd: height,
      };
    }
  }
  return null;
}

/** @param {File | Blob} file */
function nameFor(file) {
  const name = /** @type {any} */ (file).name;
  if (typeof name === "string" && name) return name;
  // Urklippsbilder är Blob utan namn. Ett tomt namn i en lista ser ut som en
  // trasig post, så den får säga vad den är.
  return isImage(file.type) ? "Urklipp" : "Fil";
}

/**
 * Läser filen till en bilaga, eller kastar med ett besked användaren kan agera på.
 *
 * ⛔ FELMEDDELANDENA SÄGER VAD MAN SKA GÖRA. "Kunde inte spara" lämnar den som
 * försöker med ett val mellan att ge upp och att försöka igen i blindo, och det
 * är så folk slutar rapportera saker.
 *
 * @param {File | Blob} file
 * @param {{ maxChars: number }} granser
 * @returns {Promise<Bilaga>}
 */
export async function readAttachment(file, { maxChars }) {
  if (!file) throw new Error("Ingen fil vald.");

  if (isImage(file.type)) {
    const shrunk = await shrinkImage(file, maxChars);
    if (shrunk) return shrunk;
    // Gick inte att avkoda eller inte att krympa nog. Faller igenom till
    // råvägen nedan, som bifogar filen som den är om den ryms.
  }

  const size = typeof (/** @type {any} */ (file).size) === "number" ? /** @type {any} */ (file).size : 0;
  if (size * CHARS_PER_BYTE > maxChars) {
    throw new Error(
      `Filen är för stor (${sizeText(size)}). ` +
        (isImage(file.type)
          ? "Den här webbläsaren kunde inte läsa bildformatet och kan därför inte krympa den. Spara om den som JPEG eller PNG, eller klistra in en skärmbild."
          : "Dela upp den, eller skicka en sida eller en skärmbild av det som är relevant."),
    );
  }

  const dataUrl = await readAsDataUrl(file);
  if (dataUrl.length > maxChars) {
    throw new Error(`Filen är för stor (${sizeText(size)}). Skicka ett utdrag eller en skärmbild i stället.`);
  }
  return { dataUrl, namn: nameFor(file), typ: file.type || "", tecken: dataUrl.length };
}
