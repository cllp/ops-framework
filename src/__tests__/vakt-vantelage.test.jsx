import { act, render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GOLV, UNDANTAG, granska } from "../../scripts/lib/vantelage.mjs";
import { FORDROJNING_MS, OpsVantar } from "../components/OpsVantar.jsx";
import { OpsEmpty } from "../components/OpsEmpty.jsx";

/**
 * Väntelägen som rör sig (0.229.0, CP 2026-11-14: "progressbars som rör sig överallt där vi behöver vänta").
 *
 * DEL 1, VAKTEN (`scripts/lib/vantelage.mjs`, `npm run check:vantelage`): grön mot komponenterna, röd för ett inplanterat stillastående
 * väntläge och en fristående snurra, röd för ett dött undantag och under golvet. Mutationerna görs på komponenternas egen källtext.
 *
 * DEL 2, KOMPONENTEN: roll, text och fördröjningen. ⛔ jsdom kör ingen CSS: att raden RÖR SIG mäts i `check-skalyta` (Playwright).
 */

const KOMPONENTER = path.resolve(import.meta.dirname, "../components");

/** @returns {Record<string, string>} */
function komponenter() {
  /** @type {Record<string, string>} */
  const ut = {};
  for (const f of fs.readdirSync(KOMPONENTER).filter((x) => x.endsWith(".jsx")).sort()) ut[f] = fs.readFileSync(path.join(KOMPONENTER, f), "utf8");
  return ut;
}

/** @param {Record<string, string>} filer @param {string} fil @param {string} gammal @param {string} ny */
function mutera(filer, fil, gammal, ny) {
  expect(filer[fil].split(gammal).length - 1, `"${gammal}" ska finnas exakt en gång i ${fil}`).toBe(1);
  return { ...filer, [fil]: filer[fil].replace(gammal, ny) };
}

describe("vakten check-vantelage: varje väntläge är OpsVantar", () => {
  const filer = komponenter();

  it("grön mot komponenterna, över golvet", () => {
    const r = granska(filer);
    expect(r.brott).toEqual([]);
    expect(r.golv).toEqual([]);
    expect(r.stat.filer).toBeGreaterThanOrEqual(GOLV.filer);
    expect(r.stat.statusytor).toBeGreaterThanOrEqual(GOLV.statusytor);
    expect(r.stat.vantelagen).toBeGreaterThanOrEqual(GOLV.vantelagen);
  });

  it("röd för en stillastående väntetext i en role=status (planterad: OpsKarta tillbaka till sin gamla rad)", () => {
    const m = mutera(filer, "OpsKarta.jsx", '<div data-karta-lage="hamtar" className="m-0 text-etikett text-ink-muted"><OpsVantar text={texter.hamtar} /></div>', '<p role="status" className="m-0">{texter.hamtar}</p>');
    const r = granska(m);
    expect(r.brott.map((b) => `${b.fil}:${b.regel}`)).toEqual(["OpsKarta.jsx:stilla-vantan"]);
  });

  it("röd för bokstavlig väntetext, för aria-busy och för data-värdet hamtar", () => {
    for (const rad of ['<p role="status">Läser nycklarna</p>', '<div role="status" aria-busy="true">x</div>', '<span role="status" data-x="hamtar">{a}</span>']) {
      const r = granska({ ...filer, "Planterad.jsx": `export function P() { return ${rad}; }` });
      expect(r.brott.map((b) => b.fil), rad).toEqual(["Planterad.jsx"]);
    }
  });

  it("röd för en annonserande OpsSpinner som väntande yta, grön för en dekorativ", () => {
    const rod = granska({ ...filer, "Planterad.jsx": 'export function P() { return <OpsSpinner label="Hämtar" />; }' });
    expect(rod.brott.map((b) => b.regel)).toEqual(["fristaende-snurra"]);
    const gron = granska({ ...filer, "Planterad.jsx": "export function P() { return <OpsSpinner decorative />; }" });
    expect(gron.brott).toEqual([]);
  });

  it("grön för en statusyta som inte väntar, och kommentarer räknas inte", () => {
    const r = granska({ ...filer, "Planterad.jsx": '// <p role="status">Hämtar</p>\nexport function P() { return <p role="status">{t("tom")}</p>; }' });
    expect(r.brott).toEqual([]);
  });

  it("röd för ett undantag som inte längre täcker något", () => {
    const [fil] = Object.keys(UNDANTAG);
    const r = granska({ ...filer, [fil]: "export function X() { return null; }" });
    expect(r.brott.map((b) => b.regel)).toEqual(["dott-undantag"]);
  });

  it("röd under golvet (tomt underlag)", () => {
    const r = granska({ "En.jsx": "export const x = 1;" });
    expect(r.golv.length).toBe(3);
  });
});

describe("OpsVantar", () => {
  afterEach(() => vi.useRealTimers());

  it("har role=status, aria-live, aria-busy och texten, och syns först efter fördröjningen", () => {
    vi.useFakeTimers();
    render(<OpsVantar text="Läser nycklarna" />);
    const s = screen.getByRole("status");
    expect(s.getAttribute("aria-live")).toBe("polite");
    expect(s.getAttribute("aria-busy")).toBe("true");
    expect(s.textContent).toBe("Läser nycklarna");
    expect(s.getAttribute("data-ops-vantar")).toBe("vilar");
    expect(s.className).toContain("opacity-0");
    act(() => vi.advanceTimersByTime(FORDROJNING_MS - 1));
    expect(s.getAttribute("data-ops-vantar")).toBe("vilar");
    act(() => vi.advanceTimersByTime(1));
    expect(s.getAttribute("data-ops-vantar")).toBe("syns");
    expect(s.className).toContain("opacity-100");
  });

  it("raden är dekor med animationsklassen, och står still men syns med reducerad rörelse", () => {
    const { container } = render(<OpsVantar text="Hämtar" storlek="sm" />);
    const rad = container.querySelector("[data-ops-vantar-rad]");
    expect(rad?.getAttribute("aria-hidden")).toBe("true");
    const bit = rad?.firstElementChild;
    expect(bit?.className).toContain("animate-vantar");
    expect(bit?.className).toContain("motion-reduce:animate-none");
  });

  it("vägrar tom text och okänd storlek", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsVantar text="" />)).toThrow(/text krävs/);
    // @ts-expect-error okänd storlek provas med flit
    expect(() => render(<OpsVantar text="x" storlek="lg" />)).toThrow(/okänd storlek/);
  });

  it("OpsEmpty busy väntar med OpsVantar, med en enda statusyta", () => {
    render(<OpsEmpty busy title="Inga" busyLabel="Hämtar listan" />);
    const s = screen.getAllByRole("status");
    expect(s).toHaveLength(1);
    expect(s[0].getAttribute("data-ops-vantar")).not.toBeNull();
    expect(s[0].textContent).toBe("Hämtar listan");
  });
});
