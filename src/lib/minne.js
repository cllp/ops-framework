/**
 * Gruppens minne: en slutsats som en person lyft ur ett samtal, en tråd eller ett meddelande.
 *
 * ⛔ AGENTEN SKRIVER ALDRIG HÄR (lifehub.app#66). Raden bär `lyftAv.typ == "manniska"`, och regeln
 * kräver dessutom att medlemskapet är en person. En läsning är agentens verktyg. En skrivning är
 * knappens, och knappen är en person som trycker.
 *
 * ⛔ RAMVERKET KÄNNER INTE SAMLINGSNAMNET. Fälten och taken bor här. Appen skickar in samlingen
 * till `minnesregelfragment` och till `createMinneskalla`.
 *
 * ⛔ ÄGARE, INTE ADMIN. Den som lyfte raden och gruppens ägare får skriva om den och ta bort den.
 * En admin är en förvaltare (samma skillnad som `opsArAgare` och `opsArAdmin` i regelfragmentet),
 * och minnet är inte gruppens utseende.
 */

import { ID_FORM } from "./katalog.js";
import { trimSomRegeln } from "./bibliotek.js";
import { SKAPARFALT, byggSkapare } from "./skapare.js";

/** Var en rad kan komma ifrån. En ny källa är en egen gren i regeln, inte ett fritt ord. */
export const MINNESKALLOR = /** @type {const} */ (["samtal", "trad", "meddelande"]);

/** Taket för texten. Samma tal skrivs in i regelfragmentet. */
export const MAX_MINNESTEXT = 4000;

/** Taket för ett id i källan (samtal, tråd, meddelande). */
export const MAX_MINNESID = 200;

/**
 * Fälten en rad får bära. `id` är dokumentets nyckel och står inte här.
 *
 * `trad` är en tom sträng när källan inte är en tråd, så att fältlistan är en och inte två.
 */
export const MINNESFALT = /** @type {const} */ (["groupId", "text", "kalla", "lyftAv", "lyft", "andrad"]);

/** Fälten i `kalla`. */
export const MINNESKALLAFALT = /** @type {const} */ (["slag", "samtal", "trad", "meddelande"]);

/**
 * @typedef {object} Minnesrad
 * @property {string} groupId
 * @property {string} text
 * @property {{ slag: "samtal" | "trad" | "meddelande", samtal: string, trad: string, meddelande: string }} kalla
 * @property {import("./skapare.js").Skapare} lyftAv
 * @property {number} lyft Millisekunder, serverns klocka när raden lyftes.
 * @property {number} andrad Millisekunder, serverns klocka vid senaste skrivningen.
 */

const str = trimSomRegeln;

/**
 * Får den här personen skriva om eller ta bort raden? Samma villkor som regelns
 * `update` och `delete`: den som lyfte den, eller ägaren. Admin räcker inte.
 *
 * @param {{ groupId?: string, lyftAv?: { uid?: string | null } } | null | undefined} rad
 * @param {{ uid?: string | null, roll?: string, groupId?: string } | null | undefined} jag
 * @returns {boolean}
 */
export function farAndraMinne(rad, jag) {
  if (!rad || !jag || typeof jag.uid !== "string" || !jag.uid) return false;
  if (jag.groupId !== undefined && jag.groupId !== rad.groupId) return false;
  if (rad.lyftAv?.uid === jag.uid) return true;
  return jag.roll === "agare";
}

/**
 * Källan, eller skälet. `trad` är tom utom när slaget är `trad`.
 *
 * @param {unknown} kalla
 * @returns {string | null}
 */
function kallaFel(kalla) {
  if (!kalla || typeof kalla !== "object") return "Källan saknas. En rad säger var den lyftes ur.";
  const d = /** @type {Record<string, unknown>} */ (kalla);
  const okanda = Object.keys(d).filter((k) => !(/** @type {readonly string[]} */ (MINNESKALLAFALT).includes(k)));
  if (okanda.length > 0) return `Källan har fälten ${okanda.join(", ")}, och de hör inte dit.`;
  const slag = str(d.slag);
  if (!(/** @type {readonly string[]} */ (MINNESKALLOR).includes(slag))) {
    return `Minnet känner inte källan "${slag || "(tom)"}". Giltiga: ${MINNESKALLOR.join(", ")}.`;
  }
  const samtal = str(d.samtal);
  const meddelande = str(d.meddelande);
  const trad = str(d.trad);
  if (!samtal) return "Källan saknar samtalet.";
  if (samtal.length > MAX_MINNESID) return `Samtalets id är ${samtal.length} tecken. Taket är ${MAX_MINNESID}.`;
  if (samtal.includes("/")) return "Samtalets id får inte innehålla ett snedstreck.";
  if (!meddelande) return "Källan saknar meddelandet.";
  if (meddelande.length > MAX_MINNESID) return `Meddelandets id är ${meddelande.length} tecken. Taket är ${MAX_MINNESID}.`;
  if (meddelande.includes("/")) return "Meddelandets id får inte innehålla ett snedstreck.";
  if (slag === "trad") {
    if (!trad) return "En tråd som källa behöver trådens id.";
    if (trad.length > MAX_MINNESID) return `Trådens id är ${trad.length} tecken. Taket är ${MAX_MINNESID}.`;
    if (trad.includes("/")) return "Trådens id får inte innehålla ett snedstreck.";
  } else if (trad) {
    return "Bara en tråd bär ett tråd-id. Övriga källor lämnar det tomt.";
  }
  return null;
}

/**
 * Hela dokumentet, eller skälet till att det inte får skrivas.
 *
 * @param {Record<string, unknown>} d
 * @returns {string | null}
 */
export function minnesradFel(d) {
  if (!d || typeof d !== "object") return "Raden saknas.";
  const okanda = Object.keys(d).filter((k) => k !== "id" && !(/** @type {readonly string[]} */ (MINNESFALT).includes(k)));
  if (okanda.length > 0) return `Fälten ${okanda.join(", ")} hör inte till en minnesrad.`;

  const groupId = str(d.groupId);
  if (!ID_FORM.test(groupId)) return `Gruppen "${groupId}" är inte ett grupp-id.`;

  const text = str(d.text);
  if (!text) return "Texten saknas.";
  if (text.length > MAX_MINNESTEXT) return `Texten är ${text.length} tecken. Taket är ${MAX_MINNESTEXT}.`;

  const kallans = kallaFel(d.kalla);
  if (kallans) return kallans;

  const lyftAv = byggSkapare(/** @type {any} */ (d.lyftAv && typeof d.lyftAv === "object" ? d.lyftAv : {}));
  if (!lyftAv.uid) return "Raden saknar vem som lyfte den.";
  if (lyftAv.typ !== "manniska") return "En minnesrad lyfts av en person, och typen är manniska. Agenten skriver inte i minnet.";
  const lyftnycklar = d.lyftAv && typeof d.lyftAv === "object" ? Object.keys(/** @type {object} */ (d.lyftAv)) : [];
  const extra = lyftnycklar.filter((k) => !(/** @type {readonly string[]} */ (SKAPARFALT).includes(k)));
  if (extra.length > 0) return `Den som lyfte har fälten ${extra.join(", ")}, och de hör inte dit.`;

  if (!Number.isInteger(d.lyft)) return "lyft ska vara ett heltal, millisekunder.";
  if (!Number.isInteger(d.andrad)) return "andrad ska vara ett heltal, millisekunder.";
  if (/** @type {number} */ (d.andrad) < /** @type {number} */ (d.lyft)) return "andrad ligger före lyft.";
  return null;
}

/**
 * Bygger raden som skrivs. Kastar med samma text som `minnesradFel`.
 *
 * @param {Record<string, unknown>} d
 * @returns {Minnesrad}
 */
export function byggMinnesrad(d) {
  const fel = minnesradFel(d);
  if (fel) throw new Error(fel);
  const kalla = /** @type {Record<string, unknown>} */ (d.kalla);
  const slag = /** @type {Minnesrad["kalla"]["slag"]} */ (str(kalla.slag));
  return {
    groupId: str(d.groupId),
    text: str(d.text),
    kalla: {
      slag,
      samtal: str(kalla.samtal),
      trad: slag === "trad" ? str(kalla.trad) : "",
      meddelande: str(kalla.meddelande),
    },
    lyftAv: byggSkapare(/** @type {any} */ (d.lyftAv)),
    lyft: /** @type {number} */ (d.lyft),
    andrad: /** @type {number} */ (d.andrad),
  };
}
