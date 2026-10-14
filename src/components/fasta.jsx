import { HubIkon, IdagIkon, KalenderIkon } from "./icons.jsx";
import { validateNav, validateSkapaNyckel } from "../lib/nav.js";
import { text } from "../lib/sprak.js";

/**
 * De tre FASTA posterna i skalets navigering: Idag, Kalender, Hub (0.30.0, #173).
 *
 * ══ ⛔ VARFÖR RAMVERKET ÄGER ORDNING, NAMN OCH IKONER ═══════════════════════
 *
 * CP 2026-09-29: menyn i toppraden och bottenraden ska vara "som SessionStudio",
 * och SessionStudios är Idag, Kalender och sedan resten. Före 0.30.0 skickade
 * appen en fri `nav`-lista, och bolag-ops hade tretton poster i den: Händelser,
 * Översikt, Ekonomi med fem barn, och så vidare, allt i toppraden eller bakom
 * "Meny". Ordningen, namnen och ikonerna var appens, och därför olika i varje
 * app. En ny plattform fick börja om med samma fråga och nå ett annat svar.
 *
 * Nu är de tre ramverkets: appen säger BARA vart var och en leder (`href`).
 * Allt annat i appen är en MODUL, och moduler bor i Hub, aldrig i menyn.
 *
 * ⛔ HUB ÄR EN POST MED BARN, OCH BARNEN ÄR MODULERNA. Toppraden ritar den som
 * vilken post med undermeny som helst (etikett som länk, chevron som knapp,
 * se `RowEntry`), så ingen ny mekanik behövs för att nå modulerna från en dator.
 */

/** Namnen är ramverkets och på båda språken. */
export const FASTA_NAMN = /** @type {const} */ ({
  idag: { sv: "Idag", en: "Today" },
  kalender: { sv: "Kalender", en: "Calendar" },
  // ⛔ "Appar", INTE "Hub" (CP 2026-10-03): "Moduler som vi kallar det idag är egentligen appar som man installerar."
  // Ordet "hub" betydde dessutom två saker: instansen på identity ("Dina hubbar") och listan med moduler här inne.
  // Nyckeln `hub` står kvar: den är mekanik, och ett namnbyte i API:t är ett eget arbete i varje app.
  hub: { sv: "Appar", en: "Apps" },
});

/** Ordningen är ramverkets och går inte att ändra. */
export const FASTA_ORDNING = /** @type {const} */ (["idag", "kalender", "hub"]);

/**
 * Vad ett långtryck på en fast post skapar när appen inte sagt något (0.103.0). CP 2026-10-14: "håller man inne knappen på kalender
 * kommer man direkt in i skapa ny händelse". Kalendern är ramverkets och Ny händelse ramverkets rad, så den genvägen är ramverkets.
 * ⛔ Idag och Appar har ingen: vad Idag skapar är inte givet, och "Skapa app" är appens registrering, inte ramverkets. Appen sätter
 * `fasta.hub.skapa` till den nyckeln. Ett `null` stänger av genvägen.
 */
export const FASTA_SKAPA = /** @type {const} */ ({ idag: null, kalender: "handelse", hub: null });

/**
 * @typedef {object} FastaKonfiguration
 * @property {{ href: string, skapa?: string | null }} idag
 * @property {{ href: string, skapa?: string | null }} kalender `skapa` förval "handelse" (`FASTA_SKAPA`).
 * @property {{ href: string, skapa?: string | null }} hub
 */

/**
 * @param {any} fasta
 * @param {string} vem
 */
export function validateFasta(fasta, vem) {
  if (!fasta || typeof fasta !== "object") {
    throw new Error(`${vem}: fasta måste vara ett objekt { idag: { href }, kalender: { href }, hub: { href } }.`);
  }
  for (const nyckel of FASTA_ORDNING) {
    if (!fasta[nyckel] || typeof fasta[nyckel].href !== "string" || fasta[nyckel].href === "") {
      throw new Error(`${vem}: fasta.${nyckel}.href saknas. De tre fasta posterna är Idag, Kalender och Hub, och alla tre måste veta vart de leder. Ordning, namn och ikon äger ramverket.`);
    }
    validateSkapaNyckel(fasta[nyckel].skapa, vem, `fasta.${nyckel}`);
  }
}

/**
 * De tre posterna som `NavPost`, med Hub bärande modulerna som barn.
 * @param {FastaKonfiguration} fasta
 * @param {import("../lib/nav.js").NavPost[]} moduler
 * @param {string} sprak
 * @returns {import("../lib/nav.js").NavPost[]}
 */
export function byggFasta(fasta, moduler, sprak) {
  validateNav(moduler, "OpsAppShell: moduler");
  /** @param {"idag" | "kalender" | "hub"} n */
  const skapa = (n) => {
    const s = fasta[n].skapa === undefined ? FASTA_SKAPA[n] : fasta[n].skapa;
    return s ? { skapa: s } : {};
  };
  return [
    { href: fasta.idag.href, label: text(FASTA_NAMN.idag, sprak), icon: <IdagIkon />, ...skapa("idag") },
    { href: fasta.kalender.href, label: text(FASTA_NAMN.kalender, sprak), icon: <KalenderIkon />, ...skapa("kalender") },
    // ⛔ Barnen är modulerna, med sina egna barn (en nivå) i sin tur. `validateNav`
    // godtar bara EN nivå, och det är modulernas nivå: Hubs egen rad skickas
    // därför aldrig genom den.
    { href: fasta.hub.href, label: text(FASTA_NAMN.hub, sprak), icon: <HubIkon />, ...skapa("hub"), children: /** @type {any} */ (moduler) },
  ];
}

/**
 * Sant om posten eller något under den, på vilken nivå som helst, är sidan man
 * står på. `entryActive` ser bara ETT steg ner, och Hub har modulernas barn två steg ner.
 * @param {{ href: string, children?: any[] }} post
 * @param {string} activeHref
 * @returns {boolean}
 */
export function djupAktiv(post, activeHref) {
  if (post.href === activeHref) return true;
  return (post.children ?? []).some((barn) => djupAktiv(barn, activeHref));
}
