import { useEffect, useState } from "react";

/**
 * Höjden ut till skärmens underkant, mätt en gång och räknad i CSS.
 *
 * ══ ⛔ VARFÖR DEN FINNS, OCH VARFÖR DEN INTE ÄR EN KLASS ════════════════
 *
 * En yta som ska rulla i sig själv i stället för att rulla sidan måste veta hur
 * hög den får vara. `flex-1 min-h-0` räcker när ytan bor i en kolumn med känd
 * höjd, vilket den gör i SessionStudio. I en app där skalet rullar dokumentet
 * finns ingen sådan förälder: ytan sitter mitt på en sida och vet ingenting om
 * var den hamnade.
 *
 * ⛔ DÄRFÖR MÄTS AVSTÅNDET TILL FÖNSTRETS ÖVERKANT, en gång, och läggs i en
 * CSS-variabel. Höjden räknas sedan i klassen. Det är det enda sättet att få
 * BÅDE en mätning och en brytpunkt: en inline-stil kan inte ha en media-fråga,
 * och en klass kan inte veta var elementet hamnade.
 *
 * ⛔ DOKUMENTETS OFFSET OCH INTE RUTANS. `getBoundingClientRect().top` ensamt är
 * avståndet till fönstrets överkant PRECIS NU, alltså ett annat tal så fort
 * sidan rullats. Med `scrollY` adderat blir det avståndet vid sidans topp, ett
 * fast tal som inte ruttnar.
 *
 * ⛔ OMMÄTS VID RESIZE, alltså också när telefonen vrids. Utan det blir höjden
 * kvar från stående läge i liggande, och då sticker ytan ut under skärmen.
 *
 * ══ ⛔ EN DELAD HOOK OCH INTE TVÅ KOPIOR ═══════════════════════════════
 *
 * Kalendern fick det här först. När listan behövde samma sak (CP 2026-09-22:
 * "filterraden är fast i kalendervyn men den scrollar i listvyn, låt listvyn
 * fungera precis som kalendervyn") fanns två vägar: kopiera tjugo rader, eller
 * flytta dem hit. En kopia hade glidit isär första gången någon rättade den ena,
 * och den rättelsen hade inte synts på den andra sidan förrän någon jämförde dem.
 */

/**
 * Klassraderna som räknar höjden ur variabeln.
 *
 * ⛔ BOTTENRADEN DRAS BORT UNDER 768 px OCH INTE ÖVER, eftersom `OpsBottomNav`
 * är `md:hidden`. Drogs den bort på båda skulle ytan sluta 56 px för tidigt på
 * en dator, alltså en remsa tomhet som ingen kan förklara.
 *
 * ⛔ ETT GOLV PÅ `min-h-60`, för den dag ytan hamnar långt ner på en kort sida.
 * Utan det kan uttrycket bli noll eller negativt, och då försvinner innehållet
 * helt i stället för att bli obekvämt litet.
 */
export const FULLHOJD_KLASSER = [
  "overflow-y-auto overscroll-contain",
  "h-[calc(100svh_-_var(--fullhojd-topp)_-_var(--bottom-nav-h)_-_var(--safe-bottom))]",
  "md:h-[calc(100svh_-_var(--fullhojd-topp)_-_var(--safe-bottom))]",
  "min-h-60",
].join(" ");

/**
 * Mäter ett elements avstånd till sidans topp och ger stilen som bär talet.
 *
 * @param {{ current: HTMLElement | null }} ref Elementet som ska rulla.
 * @returns {import("react").CSSProperties} Sätts som `style` på samma element.
 */
export function useFullHojd(ref) {
  const [topp, setTopp] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const mat = () => {
      const rect = el.getBoundingClientRect();
      setTopp(Math.max(0, Math.round(rect.top + (window.scrollY || 0))));
    };
    mat();
    window.addEventListener("resize", mat);
    return () => window.removeEventListener("resize", mat);
  }, [ref]);

  /*
   * ⛔ Kastad till `CSSProperties`, eftersom TypeScript inte känner till egna
   * CSS-variabler i ett stilobjekt. Det är typsystemets lucka och inte en
   * osäkerhet: webbläsaren tar emot `--fullhojd-topp` som vilken deklaration
   * som helst.
   */
  return /** @type {import("react").CSSProperties} */ ({ "--fullhojd-topp": `${topp}px` });
}
