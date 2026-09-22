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
 * @property {string} name Filens namn som användaren ser det.
 * @property {string} kind MIME-typ, tom sträng när webbläsaren inte vet.
 * @property {number} chars Längden på data-URL:en, alltså vad den kostar i dokumentet.
 * @property {number} [width] Bara för bilder som gick att läsa.
 * @property {number} [height] Bara för bilder som gick att läsa.
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
 * ⛔ FINNS FÖR ATT `TECKEN_PER_BYTE` INTE SKA STÅ I EN APP. En bilaga lagrar
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
  return sizeText(Math.round(chars / TECKEN_PER_BYTE));
}

/** @param {number} byte */
export function sizeText(byte) {
  if (!Number.isFinite(byte) || byte <= 0) return "";
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** @param {number} width @param {number} height */
function skalat(width, height) {
  const langst = Math.max(width, height);
  if (langst <= MAX_SIDA) return { width, height };
  const faktor = MAX_SIDA / langst;
  return { width: Math.round(width * faktor), height: Math.round(height * faktor) };
}

/** @param {File | Blob} file @returns {Promise<string>} */
function readAsDataUrl(file) {
  return new Promise((done, error) => {
    const lasare = new FileReader();
    lasare.onerror = () => error(new Error("Filen kunde inte läsas."));
    lasare.onload = () => done(String(lasare.result || ""));
    lasare.readAsDataURL(file);
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

  const { width, height } = skalat(bitmap.width, bitmap.height);
  const duk = document.createElement("canvas");
  duk.width = width;
  duk.height = height;
  const ritare = duk.getContext("2d");
  if (!ritare) {
    bitmap.close?.();
    return null;
  }
  ritare.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const kvalitet of KVALITETER) {
    const dataUrl = duk.toDataURL("image/jpeg", kvalitet);
    if (dataUrl.length <= maxChars) {
      return {
        dataUrl,
        name: nameFor(file),
        // ⛔ `image/jpeg` och inte filens ursprungliga typ. Duken har skrivit om
        // den, och en HEIC som sparas märkt `image/heic` men innehåller JPEG är
        // en lögn nästa läsare tror på.
        kind: "image/jpeg",
        chars: dataUrl.length,
        width,
        height,
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
    const krympt = await shrinkImage(file, maxChars);
    if (krympt) return krympt;
    // Gick inte att avkoda eller inte att krympa nog. Faller igenom till
    // råvägen nedan, som bifogar filen som den är om den ryms.
  }

  const storlek = typeof (/** @type {any} */ (file).size) === "number" ? /** @type {any} */ (file).size : 0;
  if (storlek * TECKEN_PER_BYTE > maxChars) {
    throw new Error(
      `Filen är för stor (${sizeText(storlek)}). ` +
        (isImage(file.type)
          ? "Den här webbläsaren kunde inte läsa bildformatet och kan därför inte krympa den. Spara om den som JPEG eller PNG, eller klistra in en skärmbild."
          : "Dela upp den, eller skicka en sida eller en skärmbild av det som är relevant."),
    );
  }

  const dataUrl = await readAsDataUrl(file);
  if (dataUrl.length > maxChars) {
    throw new Error(`Filen är för stor (${sizeText(storlek)}). Skicka ett utdrag eller en skärmbild i stället.`);
  }
  return { dataUrl, name: nameFor(file), kind: file.type || "", chars: dataUrl.length };
}
