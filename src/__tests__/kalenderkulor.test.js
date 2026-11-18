import { describe, expect, it } from "vitest";
import { ARV_TON_KULOR, GRUPPKULOR_FORM, fargTillKulor } from "../lib/gruppfarg.js";
import { KALENDERFARGER, arGiltigKalenderfarg, byggGruppkalender, byggMinKalender, kalenderformFel, lasMinKalender } from "../lib/kalendrar.js";
import { fargprick, kalenderKulor, kalenderfargKulor, postklasser } from "../lib/kalenderfarg.js";
import { byggKategori } from "../lib/katalog.js";
import { kalenderregelfragment } from "../lib/regler.js";

/**
 * Kalendrarnas färg som kulör (0.238.0, cllp/lifehub.app#882). Rött mot 0.237.1: där tog `byggMinKalender`, `byggGruppkalender`, `kalenderformFel`
 * och regeln bara emot tonerna 1 till 6, och `GRUPPKULOR_FORM` släppte in `kulor:999` (gränsen stod bara i `fargTillKulor`).
 */

const G = "g1";
const min = (/** @type {unknown} */ farg) => byggMinKalender({ id: "privat", namn: "Privat", farg, ikon: "hjarta" });
const grupp = (/** @type {unknown} */ farg) => byggGruppkalender({ id: "styrelse", namn: { sv: "Styrelsen" }, farg, ikon: "kalender", groupId: G });

/** Former som ska släppas in, och som ska nekas. Golvet nedan säger att listorna mäter något. */
const JA = ["kulor:0", "kulor:7", "kulor:99", "kulor:100", "kulor:210", "kulor:299", "kulor:300", "kulor:359"];
const NEJ = ["kulor:360", "kulor:999", "kulor:007", "kulor:07", "kulor:00", "kulor:-1", "kulor:", "kulor:1.5", " kulor:7", "KULOR:7", "7", "#ff0000", ""];

describe("⛔ en form för kulören, med övre gränsen i mönstret", () => {
  it("golv: minst åtta godkända och tolv nekade former", () => {
    expect(JA.length).toBeGreaterThanOrEqual(8);
    expect(NEJ.length).toBeGreaterThanOrEqual(12);
  });
  it.each(JA)("%s matchar GRUPPKULOR_FORM och läses som sin kulör", (f) => {
    expect(GRUPPKULOR_FORM.test(f)).toBe(true);
    expect(fargTillKulor(f)).toBe(Number(f.slice(6)));
  });
  it.each([...NEJ, "3"])("%s matchar inte GRUPPKULOR_FORM", (f) => {
    expect(GRUPPKULOR_FORM.test(f)).toBe(false);
  });
  it("⛔ varje kulör 0 till 359 matchar, och 360 till 999 gör det inte (hela intervallet, inte stickprov)", () => {
    for (let g = 0; g < 1000; g++) expect(GRUPPKULOR_FORM.test(`kulor:${g}`), String(g)).toBe(g <= 359);
  });
});

describe("⛔ mina kalendrar och gruppens tar emot en kulör, och läser de äldre tonerna vidare", () => {
  it.each(JA)("byggMinKalender och byggGruppkalender sparar %s som den står", (f) => {
    expect(min(f).farg).toBe(f);
    expect(grupp(f).farg).toBe(f);
    expect(arGiltigKalenderfarg(f)).toBe(true);
    expect(kalenderformFel("kalender", "privat", { namn: "P", farg: f })).toEqual([]);
  });
  it.each(NEJ)("%j nekas av byggarna och mätningen", (f) => {
    expect(() => min(f)).toThrow(/farg/);
    expect(() => grupp(f)).toThrow(/farg/);
    expect(arGiltigKalenderfarg(f)).toBe(false);
    expect(kalenderformFel("kalender", "privat", { namn: "P", farg: f })).toContain("farg");
  });
  it.each([...KALENDERFARGER])("⛔ den äldre tonen %i läses och sparas vidare som tal", (t) => {
    expect(min(t).farg).toBe(t);
    expect(grupp(t).farg).toBe(t);
    expect(lasMinKalender({ id: "privat", namn: "P", farg: t, ikon: "hjarta" }).farg).toBe(t);
    expect(kalenderformFel("kalender", "privat", { namn: "P", farg: t })).toEqual([]);
  });
  it("text som \"3\" byggs som talet 3, som förut (byggaren), men är ingen giltig lagrad färg (reglerna tar emot talet)", () => {
    expect(min("3").farg).toBe(3);
    expect(arGiltigKalenderfarg("3")).toBe(false);
  });
  it("⛔ slagpalettens kategorier tar INTE emot en kulör: bara en katalog med `kulorer`", () => {
    const kat = { id: "rep", namn: { sv: "Rep" }, farg: "kulor:210", ikon: "check", fas: "ny", groupId: G };
    expect(() => byggKategori(kat, { ikoner: ["check"] })).toThrow(/palettplats/);
    expect(byggKategori(kat, { ikoner: ["check"], kulorer: true }).farg).toBe("kulor:210");
  });
});

describe("⛔ regeln läser samma mönster som ramverket", () => {
  it("regeltexten bär GRUPPKULOR_FORM som det står (utan ^ och $), och tonerna", () => {
    const text = kalenderregelfragment();
    const kalla = GRUPPKULOR_FORM.source.replace(/^\^/, "").replace(/\$$/, "");
    expect(text).toContain(`d.farg.matches('${kalla}')`);
    expect(text).toContain(`d.farg in [${KALENDERFARGER.join(", ")}]`);
  });
});

describe("⛔ ritningen: en kulör, och tonens kulör för en äldre ton", () => {
  it("kalenderfargKulor läser tal, text och kulör, och ger null för det okända", () => {
    expect(kalenderfargKulor(3)).toBe(ARV_TON_KULOR[3]);
    expect(kalenderfargKulor("3")).toBe(ARV_TON_KULOR[3]);
    expect(kalenderfargKulor("kulor:210")).toBe(210);
    expect(kalenderfargKulor(7)).toBeNull();
    expect(kalenderfargKulor(2.5)).toBeNull();
    expect(kalenderfargKulor(undefined)).toBeNull();
  });
  it("kalenderKulor faller tillbaka på tonens kulör ur id, som lagerFarg gjorde", () => {
    expect(kalenderKulor({ id: "x", farg: "kulor:12" })).toBe(12);
    expect(Object.values(ARV_TON_KULOR)).toContain(kalenderKulor({ id: "x" }));
  });
  it("prick, kant, ton och ring är kulörklasser med kulören som variabel; slaget och accenten är oförändrade", () => {
    const k = postklasser({ id: "a", date: "2026-10-12", title: "A", kalender: { id: "k", namn: "Rep", farg: "kulor:40" } });
    expect(k).toEqual({ prick: "ops-kulor-prick", kant: "ops-kulor-kant", ton: "ops-kulor-ton", ring: "ops-kulor-ring", stil: { "--grupp-kulor": 40 } });
    expect(postklasser({ id: "a", date: "2026-10-12", title: "A", slag: 1, slagLabel: "X" }).stil).toBeUndefined();
    expect(postklasser({ id: "a", date: "2026-10-12", title: "A", kalender: { id: "k", namn: "Rep", farg: /** @type {any} */ (9) } }).prick).toBe("bg-accent");
    expect(fargprick(undefined)).toEqual({ klass: "bg-accent", stil: undefined, kulor: null });
    expect(fargprick(4).stil).toEqual({ "--grupp-kulor": ARV_TON_KULOR[4] });
  });
  it("⛔ en kalenderfärg utan namn kastar, som kanten alltid har gjort: en färg utan ord betyder ingenting", () => {
    expect(() => postklasser({ id: "a", date: "2026-10-12", title: "A", kalender: { id: "k", namn: "", farg: 2 } })).toThrow(/namn/);
  });
});
