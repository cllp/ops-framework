/**
 * Sökning och sammanslagning av hjälp (0.92.1).
 *
 * ⛔ EN STRÄNG PER AVSNITT. Samma `svar` (eller `md`) ritas och söks. En andra
 * kopia för sökningen hade glidit isär första gången någon rättade en mening.
 */

import { GENERELL_HJALP, GRUND_ID } from "./generell.js";
import { lasHjalpAnkare } from "../lib/modilhjalp.js";

/**
 * @typedef {import("../lib/modilhjalp.js").HjalpAvsnitt} HjalpAvsnitt
 * @typedef {import("./generell.js").HjalpOmrade} HjalpOmrade
 */

/**
 * En sektion på hjälpsidan: grundfunktioner eller en installerad app.
 *
 * @typedef {object} HjalpSektion
 * @property {string} id `grund` eller modulens id.
 * @property {string} rubrik
 * @property {unknown} [ikon] Modulens hubb-ikon, om den finns.
 * @property {"grund" | "modul"} slag
 * @property {ReadonlyArray<HjalpOmrade | { id: string, rubrik: string, avsnitt: ReadonlyArray<HjalpAvsnitt> }>} omraden
 *   För grund: flera områden. För modul: ett område med modulens avsnitt.
 */

/**
 * Ett utdrag runt första träffen.
 *
 * @param {string} text
 * @param {string} fraga
 * @param {number} [runt]
 */
export function utdrag(text, fraga, runt = 70) {
  const plats = text.toLowerCase().indexOf(fraga.toLowerCase());
  if (plats === -1) return "";

  const rensad = text.replace(/\s+/g, " ");
  const i = rensad.toLowerCase().indexOf(fraga.toLowerCase());
  if (i === -1) return "";

  let start = Math.max(0, i - runt);
  let slut = Math.min(rensad.length, i + fraga.length + runt);
  if (start > 0) {
    const mellanslag = rensad.indexOf(" ", start);
    if (mellanslag !== -1 && mellanslag < i) start = mellanslag + 1;
  }
  if (slut < rensad.length) {
    const mellanslag = rensad.lastIndexOf(" ", slut);
    if (mellanslag !== -1 && mellanslag > i + fraga.length) slut = mellanslag;
  }

  return `${start > 0 ? "…" : ""}${rensad.slice(start, slut).trim()}${slut < rensad.length ? "…" : ""}`;
}

/**
 * Söker i fråga, svar och sökord.
 *
 * Tom fråga ger hela listan. Rubrik/fråga väger tyngre än brödtext.
 *
 * @param {ReadonlyArray<HjalpAvsnitt>} avsnitt
 * @param {string} fraga
 * @returns {{ avsnitt: HjalpAvsnitt, iRubrik: boolean, utdrag: string, sektionId: string, omradeId: string }[]}
 */
export function sokAvsnitt(avsnitt, fraga, sektionId = "", omradeId = "") {
  const rensad = String(fraga || "").trim();
  const lista = avsnitt || [];

  if (!rensad) {
    return lista.map((a) => ({ avsnitt: a, iRubrik: false, utdrag: "", sektionId, omradeId }));
  }

  const liten = rensad.toLowerCase();
  /** @type {{ avsnitt: HjalpAvsnitt, iRubrik: boolean, utdrag: string, sektionId: string, omradeId: string }[]} */
  const traffar = [];
  for (const a of lista) {
    const iRubrik = a.fraga.toLowerCase().includes(liten);
    const iSvar = a.svar.toLowerCase().includes(liten);
    const iSokord = (a.sokord || []).some((ord) => ord.toLowerCase().includes(liten));
    if (!iRubrik && !iSvar && !iSokord) continue;
    traffar.push({
      avsnitt: a,
      iRubrik,
      utdrag: iSvar ? utdrag(a.svar, rensad) : "",
      sektionId,
      omradeId,
    });
  }
  return [...traffar.filter((t) => t.iRubrik), ...traffar.filter((t) => !t.iRubrik)];
}

/**
 * En sektion ur en modul som redan har `hjalp` (anroparen har kollat).
 *
 * @param {import("../lib/modul.js").Modul} modul
 * @returns {HjalpSektion}
 */
function sektionFranModul(modul) {
  const hjalp = /** @type {NonNullable<import("../lib/modul.js").Modul["hjalp"]>} */ (modul.hjalp);
  return {
    id: modul.id,
    rubrik: hjalp.rubrik,
    ikon: modul.hubb ? modul.hubb.ikon : undefined,
    slag: "modul",
    omraden: Object.freeze([
      Object.freeze({
        id: modul.id,
        rubrik: hjalp.rubrik,
        avsnitt: hjalp.avsnitt,
      }),
    ]),
  };
}

/**
 * Sektionerna som ska visas: grund först, sedan installerade appar i gruppens
 * ordning, sist moduler utan hubb-kort (Agenter) som alltid hör till gruppen.
 *
 * ⛔ EN AVINSTALLERAD APP BIDRAR INTE. Gruppens `moduler` är listan för appar.
 * En modul utan `hjalp` hoppas över tyst: ingen tom rubrik.
 *
 * ⛔ `hubb: null` ÄR INTE EN APP (0.90.6). Agenter rensas ur `groups.moduler`
 * med `utanAgenterSomApp`, men hjälpen ska ändå synas: agenten hör till
 * gruppen, den installeras inte. Utan det här steget skulle texten i
 * `agenterManifest` aldrig nå hjälpsidan.
 *
 * @param {object} arg
 * @param {ReadonlyArray<import("../lib/modul.js").Modul> | null | undefined} arg.moduler
 * @param {{ moduler?: ReadonlyArray<string> } | null | undefined} arg.grupp
 * @returns {ReadonlyArray<HjalpSektion>}
 */
export function hjalpSektioner({ moduler, grupp }) {
  /** @type {HjalpSektion[]} */
  const ut = [
    {
      id: GENERELL_HJALP.id,
      rubrik: GENERELL_HJALP.rubrik,
      slag: "grund",
      omraden: GENERELL_HJALP.omraden,
    },
  ];

  const pa = Array.isArray(grupp?.moduler) ? grupp.moduler : [];
  const kanda = new Map((moduler || []).map((m) => [m.id, m]));
  /** @type {Set<string>} */
  const lagda = new Set();
  for (const id of pa) {
    const modul = kanda.get(id);
    if (!modul?.hjalp) continue;
    ut.push(sektionFranModul(modul));
    lagda.add(modul.id);
  }

  for (const modul of moduler || []) {
    if (!modul?.hjalp || modul.hubb !== null || lagda.has(modul.id)) continue;
    ut.push(sektionFranModul(modul));
    lagda.add(modul.id);
  }

  return Object.freeze(ut);
}

/**
 * Söker över alla sektioner. Tom fråga: katalogordning. Med fråga: platta träffar.
 *
 * @param {ReadonlyArray<HjalpSektion>} sektioner
 * @param {string} fraga
 */
export function sokHjalp(sektioner, fraga) {
  const rensad = String(fraga || "").trim();
  /** @type {{ avsnitt: HjalpAvsnitt, iRubrik: boolean, utdrag: string, sektionId: string, omradeId: string, sektionRubrik: string, omradeRubrik: string }[]} */
  const alla = [];
  for (const s of sektioner || []) {
    for (const o of s.omraden) {
      for (const t of sokAvsnitt(o.avsnitt, rensad, s.id, o.id)) {
        alla.push({
          ...t,
          sektionRubrik: s.rubrik,
          omradeRubrik: o.rubrik,
        });
      }
    }
  }
  if (!rensad) return alla;
  return [...alla.filter((t) => t.iRubrik), ...alla.filter((t) => !t.iRubrik)];
}

/**
 * Om djuplänken pekar på en sektion som finns.
 *
 * @param {ReadonlyArray<HjalpSektion>} sektioner
 * @param {string | null | undefined} hash
 * @returns {string | null}
 */
export function aktivHjalpSektion(sektioner, hash) {
  const id = lasHjalpAnkare(hash);
  if (!id) return null;
  if (id === GRUND_ID) return GRUND_ID;
  return (sektioner || []).some((s) => s.id === id) ? id : null;
}

export { GRUND_ID, GENERELL_HJALP };
