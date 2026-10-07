/**
 * Reaktionernas ikon och namn, per kod.
 *
 * ⛔ BARA VYN BÄR DET HÄR. Datan bär koden (`REAKTIONSKODER`, `src/lib/samtal.js`). Byts en ikon ändras den här tabellen, inte
 * datan, och en reaktion som sparats före bytet ritas med den nya ikonen utan migrering.
 *
 * ⛔ LUCIDE OCH INTE ENHETENS EMOJI (0.75.0, CP 2026-10-07: "Kör Lucide Ikoner som reaktioner"). Emoji ritas av enheten, så samma
 * reaktion såg olika ut på iPad, Windows och Android och följde inte appens linjestil ("ser ut som Windows 98"). Ingen kod får
 * falla tillbaka på ett tecken: `chatt-reaktioner.test.jsx` kräver en ikon för varje kod och ingen text utöver antalet.
 */

import { REAKTIONSKODER } from "../lib/samtal.js";
import { ApplodIkon, BockIkon, EldIkon, HjartaIkon, SkrattIkon, TummeUppIkon } from "./icons.jsx";

/** @typedef {(typeof REAKTIONSKODER)[number]} Reaktionskod */

/** @type {Readonly<Record<Reaktionskod, { Ikon: (p: { size?: number }) => import("react").ReactElement, namn: { sv: string, en: string } }>>} */
export const REAKTIONSVY = Object.freeze({
  tumme: { Ikon: TummeUppIkon, namn: { sv: "Tummen upp", en: "Thumbs up" } },
  hjarta: { Ikon: HjartaIkon, namn: { sv: "Hjärta", en: "Heart" } },
  skratt: { Ikon: SkrattIkon, namn: { sv: "Skratt", en: "Laugh" } },
  eld: { Ikon: EldIkon, namn: { sv: "Eld", en: "Fire" } },
  klapp: { Ikon: ApplodIkon, namn: { sv: "Applåd", en: "Applause" } },
  bock: { Ikon: BockIkon, namn: { sv: "Klart", en: "Done" } },
});

/**
 * Reaktionernas namn på ett språk. Engelska när `sprak` är "en", annars svenska (reserven).
 * @param {string} [sprak]
 * @returns {Record<Reaktionskod, string>}
 */
export function reaktionsnamnPa(sprak) {
  const s = sprak === "en" ? "en" : "sv";
  return /** @type {Record<Reaktionskod, string>} */ (Object.fromEntries(REAKTIONSKODER.map((k) => [k, REAKTIONSVY[k].namn[s]])));
}
