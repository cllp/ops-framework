/**
 * ⛔ LADDA NED SPARAR FILEN (0.175.0, lifehub.app QA 2026-11-01): `download` ignoreras när adressen är en annan origin (firebasestorage),
 * så länken öppnade filen i ny flik. Byten hämtas som blob och sparas via en objectURL i samma origin. Går hämtningen fel öppnas
 * adressen som förut, så ingen förlorar vägen till filen.
 *
 * ⛔ TYPEN TVINGAS TILL application/octet-stream, så adressen bara kan sparas och aldrig ritas (till exempel som HTML) i appens origin.
 * Därför ligger den här i lib och inte i en komponent: komponenter skapar aldrig blob-adresser (htmldokument-helfonster-provet).
 * HTML-dokumentet går inte hit, det behåller lagringens `attachment`-länk.
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
