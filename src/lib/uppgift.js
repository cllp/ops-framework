/**
 * Uppgift: en inkorgstyp med en dag eller en tid, vem och prioritet (0.78.0, lifehub.app#103 lane 19).
 *
 * ══ ⛔ EN SANNING, I INKORGEN ═══════════════════════════════════════════════
 *
 * CP 2026-10-07: uppgiften lagras en gång, i Inkorgen. Idag, Kommande och
 * Kalendern visar den och kopierar den aldrig. Den är ingen händelse, så den
 * har inga svar och inga deltagare, och den får inget `handelseId`.
 *
 * ⛔ "SÅ SNART SOM MÖJLIGT" BLIR ALDRIG ETT DATUM. Ett automatiskt dagens datum
 * gör uppgiften försenad i morgon, fast ingen bestämt en dag. Vilket
 * prioritetsvärde som betyder det skickar appen in (`snarast`): listan är
 * ärendenas, och ordet är appens.
 */

import React from "react";
import { BockIkon } from "../components/icons.jsx";
import { daysUntil } from "./events.js";
import { giltigtDatum } from "./kalendrar.js";

/** `YYYY-MM-DDTHH:MM`, lokal tid. Ingen zon: en `Z` hade flyttat dagen. */
const UTFORSFORM = /^(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))T([01]\d|2[0-3]):[0-5]\d$/;

const STATUS = /** @type {const} */ (["ny", "hanterad", "avskriven"]);

/**
 * @typedef {object} Uppgift
 * @property {string} [id]
 * @property {string} rubrik
 * @property {"ny" | "hanterad" | "avskriven"} [status]
 * @property {string} [deadline] Senast den dagen, `YYYY-MM-DD`. Aldrig tillsammans med `utfors`.
 * @property {string} [utfors] Dag och tid, `YYYY-MM-DDTHH:MM`. Aldrig tillsammans med `deadline`.
 * @property {string} [vem] Medlemmens uid.
 * @property {string} [prio] Prioritetens värde, ur samma lista som ärenden.
 */

/**
 * Det som är fel i en uppgift, som meningar. Tom lista: inget fel.
 *
 * @param {unknown} post
 * @returns {string[]}
 */
export function uppgiftFel(post) {
  const r = post && typeof post === "object" ? /** @type {Record<string, unknown>} */ (post) : {};
  /** @type {string[]} */
  const fel = [];
  const rubrik = typeof r.rubrik === "string" ? r.rubrik.trim() : "";
  if (!rubrik) fel.push("Skriv en rubrik.");
  const harDeadline = r.deadline !== undefined && r.deadline !== null && r.deadline !== "";
  const harUtfors = r.utfors !== undefined && r.utfors !== null && r.utfors !== "";
  if (harDeadline && harUtfors) fel.push("En uppgift har antingen en deadline eller en tid den ska utföras, aldrig båda.");
  if (harDeadline && (typeof r.deadline !== "string" || !giltigtDatum(r.deadline))) fel.push("Deadline ska vara ett datum, ÅÅÅÅ-MM-DD.");
  if (harUtfors && (typeof r.utfors !== "string" || !UTFORSFORM.test(r.utfors) || !giltigtDatum(r.utfors.slice(0, 10)))) {
    fel.push("Utförs ska vara en dag och ett klockslag, ÅÅÅÅ-MM-DDTHH:MM.");
  }
  if (r.vem !== undefined && r.vem !== null && r.vem !== "" && (typeof r.vem !== "string" || !r.vem.trim())) fel.push("Vem ska vara en medlem.");
  if (r.prio !== undefined && r.prio !== null && r.prio !== "" && (typeof r.prio !== "string" || !r.prio.trim())) fel.push("Prioriteten ska vara ett värde ur listan.");
  if (r.status !== undefined && r.status !== null && r.status !== "" && !STATUS.includes(/** @type {any} */ (r.status))) {
    fel.push(`Status är ${STATUS.join(", ")}.`);
  }
  return fel;
}

/**
 * Bygger uppgiften som skrivs i inkorgen, eller kastar med skälet.
 *
 * @param {Uppgift} post
 * @returns {Uppgift}
 */
export function byggUppgift(post) {
  const fel = uppgiftFel(post);
  if (fel.length) throw new Error(fel.join(" "));
  const rubrik = post.rubrik.trim();
  /** @type {Uppgift} */
  const ut = { rubrik, status: post.status || "ny" };
  if (post.id) ut.id = post.id;
  if (post.deadline) ut.deadline = post.deadline;
  if (post.utfors) ut.utfors = post.utfors;
  if (post.vem) ut.vem = post.vem.trim();
  if (post.prio) ut.prio = post.prio.trim();
  return Object.freeze(ut);
}

/**
 * @param {string} id
 * @param {(id: string) => void} onKlar
 * @param {string} text
 */
function bockKnapp(id, onKlar, text) {
  return React.createElement(
    "button",
    {
      type: "button",
      "aria-label": text,
      "data-uppgift-klar": id,
      className: "relative z-10 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-accent",
      onClick: (/** @type {React.MouseEvent} */ e) => {
        e.preventDefault();
        e.stopPropagation();
        onKlar(id);
      },
    },
    React.createElement(BockIkon, { size: 18 }),
  );
}

/**
 * Var uppgifterna syns, härlett ur inkorgens poster. Ingenting skrivs.
 *
 * @param {ReadonlyArray<Uppgift & { id?: string }>} poster
 * @param {{ idag: Date, snarast: string, onKlar?: (id: string) => void, bock?: string, namnFor?: (uid: string) => string }} config
 * @returns {{
 *   idag: import("./events.js").OpsEvent[],
 *   kommande: import("./events.js").OpsEvent[],
 *   kalender: import("./calendar.js").CalendarEntry[],
 *   inkorg: Uppgift[],
 *   hanterade: Uppgift[],
 *   avvisade: { id: string, fel: string[] }[],
 * }}
 */
export function visaUppgifter(poster, config) {
  if (!config || !(config.idag instanceof Date) || Number.isNaN(config.idag.getTime())) {
    throw new Error("visaUppgifter: idag krävs, ett datum. Utan det blir \"i dag\" ett klockslag som ingen kan återskapa.");
  }
  if (!config.snarast || typeof config.snarast !== "string") {
    throw new Error("visaUppgifter: snarast krävs, prioritetens värde för så snart som möjligt. Utan det blir en odaterad uppgift tyst bara en inkorgsrad.");
  }
  const bock = config.bock || "Markera klar";
  /** @type {import("./events.js").OpsEvent[]} */
  const idag = [];
  /** @type {import("./events.js").OpsEvent[]} */
  const kommande = [];
  /** @type {import("./calendar.js").CalendarEntry[]} */
  const kalender = [];
  /** @type {Uppgift[]} */
  const inkorg = [];
  /** @type {Uppgift[]} */
  const hanterade = [];
  /** @type {{ id: string, fel: string[] }[]} */
  const avvisade = [];

  for (const post of poster || []) {
    const id = post && post.id ? String(post.id) : "";
    const fel = uppgiftFel(post);
    if (!id) fel.push("Uppgiften saknar id.");
    if (fel.length) {
      avvisade.push({ id, fel });
      continue;
    }
    if (post.status === "hanterad" || post.status === "avskriven") {
      hanterade.push(post);
      continue;
    }
    const dag = post.deadline || (post.utfors ? post.utfors.slice(0, 10) : "");
    const tid = post.utfors ? post.utfors.slice(11, 16) : "";
    const dagar = dag ? daysUntil(dag, config.idag) : null;
    const snarast = !dag && post.prio === config.snarast;
    const atgard = config.onKlar ? bockKnapp(id, config.onKlar, bock) : undefined;
    const vem = post.vem ? (config.namnFor ? config.namnFor(post.vem) : post.vem) : undefined;
    /** @type {import("./events.js").OpsEvent} */
    const rad = {
      id,
      title: post.rubrik.trim(),
      daysLeft: snarast ? 0 : dagar,
      ...(vem ? { role: vem } : {}),
      ...(atgard ? { atgard } : {}),
      ...(post.deadline ? { deadline: post.deadline } : {}),
      ...(tid ? { when: tid } : {}),
    };
    if (!dag && !snarast) {
      inkorg.push(post);
      continue;
    }
    if (snarast || (dagar !== null && dagar <= 0)) idag.push(rad);
    else if (dagar !== null && dagar > 0) kommande.push(rad);
    else {
      avvisade.push({ id, fel: ["Datumet gick inte att läsa."] });
      continue;
    }
    if (dag && dagar !== null) {
      kalender.push({
        id,
        date: dag,
        title: post.rubrik.trim(),
        ...(post.deadline ? { allDay: true } : {}),
        ...(tid ? { not: tid } : {}),
        ...(atgard ? { atgard } : {}),
      });
    }
  }

  // Försenat först, sedan i dag, sedan en odaterad "så snart som möjligt" (daysLeft 0 men utan dag).
  const ordning = (/** @type {import("./events.js").OpsEvent} */ r) => (r.daysLeft === 0 && !r.deadline && !r.when ? 0.5 : /** @type {number} */ (r.daysLeft));
  idag.sort((a, b) => ordning(a) - ordning(b));
  kommande.sort((a, b) => /** @type {number} */ (a.daysLeft) - /** @type {number} */ (b.daysLeft));
  return { idag, kommande, kalender, inkorg, hanterade, avvisade };
}
