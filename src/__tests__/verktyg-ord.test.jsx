import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsGruppHubb, OpsHubModul, OpsHubTillbaka } from "../components/OpsHub.jsx";
import { FASTA_NAMN } from "../components/fasta.jsx";
import { defineModule, validateModuler } from "../lib/modul.js";

/**
 * ⛔ ORDET ÄR "VERKTYG", INTE "APPAR" (0.227.0). CP 2026-11-14: "Kör på Verktyg".
 *
 * "App" betydde tre saker: LIFE HUB-appen i telefonen, appar i App Store, och Bibliotek, Projekt och Ekonomi i en
 * grupp. Visionen säger redan "genom enkla verktyg". Meningen CP vill kunna säga: "En grupp behöver ett nytt
 * verktyg, inte en ny plattform."
 *
 * Provet läser det användaren ser och hör, inte källan: synlig text, aria-label och title på hubben (tom grupp,
 * grupp med kort, en modul som inte ritas, engelska), bottenraden och toppraden med arket öppet, och tillbakaraden.
 * Ett närvarogrep på strängen i källan hade varit grönt så fort ordet flyttades till en annan fil (regel 4).
 *
 * ⛔ GOLV: varje yta ska ha gett text, och ordet "Verktyg" (eller "Tools") ska finnas i det som lästes. Annars är
 * provet grönt av att ingenting ritades.
 */

const I = () => <svg />;

const modul = (id, namn, rutt) =>
  defineModule({
    id,
    namn: { sv: namn, en: namn },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: rutt ? { ikon: <I />, rutt, startsida: "start", delar: [{ id: "start", namn: { sv: "Start", en: "Start" }, ikon: <I />, rutt: `${rutt}/start` }] } : null,
  });

const EKONOMI = modul("ekonomi", "Ekonomi", "/ekonomi");
const RESOR = modul("resor", "Resor", "/resor");
const INKORG = modul("inkorg", "Inkorg", null);
const MODULER = validateModuler([EKONOMI, RESOR, INKORG]);
const G = (/** @type {string[]} */ ids) => ({ id: "bolaget", namn: { sv: "Bolaget" }, moduler: ids });

/** Det gamla ordet om en modul, på båda språken, i alla former. */
const GAMMALT = /\b(appar|apparna|appars|apps|appen|appens|app)\b/i;

/**
 * Allt en seende läser och en skärmläsare säger: textnoderna och namnen i aria-label och title.
 * @param {HTMLElement} rot
 */
function lasbart(rot) {
  const ut = [];
  const gang = document.createTreeWalker(rot, NodeFilter.SHOW_TEXT);
  for (let n = gang.nextNode(); n; n = gang.nextNode()) {
    const t = (n.textContent ?? "").trim();
    if (t) ut.push(t);
  }
  for (const el of rot.querySelectorAll("[aria-label], [title]")) {
    for (const attr of ["aria-label", "title"]) {
      const v = el.getAttribute(attr);
      if (v && v.trim()) ut.push(v.trim());
    }
  }
  return ut;
}

/** @param {string[]} texter @param {RegExp} ny */
function kontrollera(texter, ny) {
  expect(texter.length).toBeGreaterThanOrEqual(3);
  expect(texter.some((t) => ny.test(t))).toBe(true);
  expect(texter.filter((t) => GAMMALT.test(t))).toEqual([]);
}

afterEach(cleanup);

describe("⛔ ordet är Verktyg i hubben, bottenraden och tillbakaraden (0.227.0)", () => {
  it("de fasta namnen är Verktyg och Tools", () => {
    expect(FASTA_NAMN.hub).toEqual({ sv: "Verktyg", en: "Tools" });
  });

  it("hubben för en tom grupp, med erbjudandet och ägarens väg", () => {
    render(<OpsGruppHubb grupp={G([])} moduler={MODULER} installera={{ onClick: () => {} }} />);
    kontrollera(lasbart(document.body), /Verktyg/);
  });

  it("hubben för en grupp med ett kort, en modul utan kort och en som inte finns här", () => {
    render(<OpsGruppHubb grupp={G(["ekonomi", "inkorg", "bokning"])} moduler={MODULER} />);
    expect(document.querySelector("[data-saknad]")).not.toBeNull();
    kontrollera(lasbart(document.body), /Verktyg/);
  });

  it("hubben på engelska", () => {
    render(<OpsGruppHubb grupp={G([])} moduler={MODULER} sprak="en" />);
    kontrollera(lasbart(document.body), /Tools/);
  });

  it("bottenraden och toppraden, och arket när fliken öppnats", () => {
    render(
      <OpsAppShell
        fasta={{ idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }}
        moduler={[]}
        activeHref="/"
        onNavigate={(_h, e) => e?.preventDefault?.()}
        apparArk={{ moduler: [EKONOMI, RESOR, INKORG], grupp: { moduler: ["inkorg", "ekonomi", "resor"], huvudmeny: [] }, farAndra: true, onOrdning: () => {} }}
      >
        <p>sidan</p>
      </OpsAppShell>,
    );
    const rad = screen.getByRole("navigation", { name: "Snabbnavigering" });
    const flik = within(rad).getByRole("button", { name: "Verktyg" });
    kontrollera(lasbart(document.body), /Verktyg/);
    fireEvent.click(flik);
    const ark = screen.getByRole("dialog");
    kontrollera(lasbart(ark), /Verktyg/);
  });

  it("tillbakaraden, ensam och i en modulsida", () => {
    render(<OpsHubTillbaka hubHref="/hub" etikett="Inkomster" rubrik />);
    kontrollera(lasbart(document.body), /Tillbaka till Verktyg/);
    cleanup();
    render(<OpsHubModul modul={{ href: "/ekonomi", label: "Ekonomi", children: [{ href: "/inkomster", label: "Inkomster" }] }} hubHref="/hub" />);
    kontrollera(lasbart(document.body), /Tillbaka till Verktyg/);
  });
});
