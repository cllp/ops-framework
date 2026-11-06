/**
 * Diskret hjälp om att lägga sidan på hemskärmen (0.192.0). Ren funktion: inget fönster, ingen hämtning.
 *
 * ⛔ LOVAR INGET SOM INTE ÄR LÄST. `standalone` (redan installerad) ger ingen tipsrad. App-läge ("utan adressfältet") sägs bara när
 * sidan både har `apple-mobile-web-app-capable` och ett manifest vars `display` är standalone, fullscreen eller minimal-ui.
 * Android sägs inget om förrän manifestet är läst. En startadress som inte är den här sidan öppnar startsidan, och det står så.
 * En startadress som är gästsidan är ändå en gemensam installation: texten lovar inte en ikon per grupp.
 *
 * ⛔ INGEN GRUPP OCH INGEN NYCKEL I TEXTEN. Funktionen tar inte emot ett gruppnamn eller en token att skriva ut. Två installationer
 * med olika namn är inte olika identiteter, och det löses inte här (docs/beslut/0015-gast-hemskarm.md).
 */

/** @typedef {"ios-safari" | "ios-chrome" | "android-chrome"} GastHemskarmPlattform */

const IOS_SAFARI = {
  sv: "I Safari trycker du på Dela och sedan Lägg till på hemskärmen. Du gör stegen själv. Sidan läggs inte till automatiskt.",
  en: "In Safari, tap Share and then Add to Home Screen. You do the steps yourself. The page is not added automatically.",
};
const IOS_CHROME = {
  sv: "I Chrome trycker du på Dela och sedan Lägg till på hemskärmen. Du gör stegen själv. Sidan läggs inte till automatiskt.",
  en: "In Chrome, tap Share and then Add to Home Screen. You do the steps yourself. The page is not added automatically.",
};
const UTAN_ADRESSFALT = {
  sv: " Sidan kan då öppnas utan adressfältet.",
  en: " The page can then open without the address bar.",
};
const ANDROID_ANNAN_START = {
  sv: "Chrome installerar den gemensamma appen. Den öppnar startsidan, inte den här gruppen.",
  en: "Chrome installs the shared app. It opens the start page, not this group.",
};
const ANDROID_SAMMA_SIDA = {
  sv: "Chrome har en installation för appen. Den öppnar gästsidan, inte en ikon per grupp.",
  en: "Chrome has one installation for the app. It opens the guest page, not one icon per group.",
};

const APPLAGE = new Set(["standalone", "fullscreen", "minimal-ui"]);

/**
 * @param {string} [ua]
 * @param {boolean} [pek] Macintosh med pekskärm är en iPad som säger att den är en Mac.
 * @returns {GastHemskarmPlattform | null}
 */
export function gastHemskarmPlattform(ua, pek = false) {
  const s = String(ua ?? "");
  if (/CriOS/.test(s)) return "ios-chrome";
  if (/FxiOS|EdgiOS|OPiOS/.test(s)) return null;
  if (/iPad|iPhone|iPod/.test(s)) return "ios-safari";
  if (/Macintosh/.test(s) && pek && !/Chrome|Chromium|Edg\//.test(s)) return "ios-safari";
  if (/Android/.test(s) && /Chrome\/\d/.test(s) && !/EdgA|OPR|SamsungBrowser|CriOS/.test(s)) return "android-chrome";
  return null;
}

/**
 * Är manifestets startadress den sida gästen står på? En absolut adress jämförs på sökvägen. Utan startadress: nej.
 * @param {string | null | undefined} startUrl
 * @param {string | null | undefined} sokvag
 */
export function gastHemskarmStartArSidan(startUrl, sokvag) {
  if (typeof startUrl !== "string" || !startUrl.trim()) return false;
  let path = startUrl.trim();
  try {
    path = /^https?:/i.test(path) ? new URL(path).pathname : path.split("?")[0].split("#")[0];
  } catch {
    return false;
  }
  const norm = (/** @type {string} */ p) => p.replace(/\/+$/, "") || "/";
  return norm(path) === norm(typeof sokvag === "string" && sokvag ? sokvag : "/");
}

/**
 * @param {{
 *   userAgent?: string,
 *   pek?: boolean,
 *   standalone?: boolean,
 *   iosWebbapp?: boolean,
 *   manifest?: { display?: string, start_url?: string } | null,
 *   sokvag?: string,
 *   sprak?: string,
 * }} m
 * @returns {{ plattform: GastHemskarmPlattform, lovarApplage: boolean, text: string } | null}
 */
export function gastHemskarmTips(m) {
  if (m?.standalone === true) return null;
  const plattform = gastHemskarmPlattform(m?.userAgent, m?.pek === true);
  if (!plattform) return null;
  const en = m?.sprak === "en";
  const sprak = en ? "en" : "sv";
  if (plattform === "android-chrome") {
    if (!m?.manifest || typeof m.manifest !== "object") return null;
    const samma = gastHemskarmStartArSidan(m.manifest.start_url, m.sokvag);
    return { plattform, lovarApplage: false, text: (samma ? ANDROID_SAMMA_SIDA : ANDROID_ANNAN_START)[sprak] };
  }
  const display = typeof m?.manifest?.display === "string" ? m.manifest.display : "";
  const lovarApplage = m?.iosWebbapp === true && APPLAGE.has(display);
  const bas = plattform === "ios-chrome" ? IOS_CHROME : IOS_SAFARI;
  return { plattform, lovarApplage, text: bas[sprak] + (lovarApplage ? UTAN_ADRESSFALT[sprak] : "") };
}
