/**
 * ⛔ LADDA NED SPARAR FILEN (0.175.0, lifehub.app QA 2026-11-01): `download` ignoreras när adressen är en annan origin (firebasestorage),
 * så länken öppnade filen i ny flik. Byten hämtas som blob och sparas via en objectURL i samma origin. Går hämtningen fel öppnas
 * adressen som förut, så ingen förlorar vägen till filen.
 *
 * ⛔ TYPEN TVINGAS TILL application/octet-stream, så adressen bara kan sparas och aldrig ritas (till exempel som HTML) i appens origin.
 * Därför ligger den här i lib och inte i en komponent: komponenter skapar aldrig blob-adresser (htmldokument-helfonster-provet).
 * Sedan 0.228.0 (cllp/lifehub.app#765) går också HTML-dokumentet hit: Ladda ned i detaljen är en knapp och inte lagringens `attachment`-länk, så ingen adress med token ritas. Typen ovan gör att det bara
 * kan sparas. Utan appens `hamta` ger detaljen `lasFilbytes` med adressen Biblioteket redan har.
 * @param {{ hamta: (sokvag: string) => Promise<Blob>, sokvag: string, namn: string, adress?: string, doc?: any, url?: any, oppna?: (a: string) => unknown }} arg
 * @returns {Promise<boolean>}
 */
export async function sparaSomFil({ hamta, sokvag, namn, adress, doc = document, url = URL, oppna = (a) => window.open(a, "_blank", "noopener") }) {
  try {
    const blob = new Blob([await hamta(sokvag)], { type: "application/octet-stream" });
    const objektAdress = url.createObjectURL(blob);
    const a = doc.createElement("a");
    a.href = objektAdress;
    a.download = namn;
    a.rel = "noopener";
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => url.revokeObjectURL(objektAdress), 30_000);
    return true;
  } catch {
    if (adress) oppna(adress);
    return false;
  }
}

/**
 * Sparar en text som ramverket själv byggt som en fil (0.209.0, cllp/lifehub.app#706): en anteckning som .md eller .html. Samma väg som `sparaSomFil` (en objectURL i samma origin och en tillfällig länk
 * med `download`), utan hämtning, och därför här i lib: komponenter skapar aldrig blob-adresser.
 *
 * ⛔ TYPEN ÄR DEN SOM GES, MEN EN HTML-SIDA FÅR ALDRIG SIN EGEN TYP. `OpsBibliotek` ger `text/markdown;charset=utf-8` för en .md, som ingen webbläsare ritar som en sida, och `application/octet-stream` för en .html,
 * av samma skäl som `sparaSomFil` tvingar den: en blob-adress med `text/html` i appens origin hade kunnat ritas där om webbläsaren öppnade den i stället för att spara. Sidan är escapad och utan skript
 * (`markdownSomHtml`), och typen är försvaret i djupet. En text-/html-typ här kastar.
 *
 * @param {{ text: string, typ: string, namn: string, doc?: any, url?: any }} arg
 * @returns {boolean} Sant när länken skapades och trycktes.
 */
export function sparaText({ text, typ, namn, doc = document, url = URL }) {
  if (/^text\/html\b/i.test(typ)) throw new Error("sparaText: en HTML-sida sparas som application/octet-stream, aldrig som text/html i appens origin.");
  const blob = new Blob([text], { type: typ });
  const objektAdress = url.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = objektAdress;
  a.download = namn;
  a.rel = "noopener";
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => url.revokeObjectURL(objektAdress), 30_000);
  return true;
}
