import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import * as rent from "../gruppmarke/index.js";
import * as rot from "../index.js";
import { byggAnvandare } from "../lib/grupp.js";
import { gruppikonKomponent, personmarkeProps } from "../lib/gruppikoner.js";
import { PROFILIKON_KOMPONENT } from "../lib/profilikoner.js";
import { GRUPPIKON_SVG } from "../lib/gruppikonsvg.generated.js";
import { OpsProfil } from "../components/OpsProfil.jsx";

/**
 * `ops-framework/gruppmarke` och personens märke (0.70.0, cllp/lifehub.identity#27).
 *
 * ⛔ Varje block nedan har setts falla: provet mutades mot det skydd det vaktar och blev rött, se PR-texten.
 */

const ANV = (/** @type {Record<string, unknown>} */ d = {}) => ({ id: "u1", epost: "cp@staiger.se", namn: "Claes Philip", sprak: "sv", ...d });
/** @param {string} m */
const utanKlass = (m) => m.replace(/ class="[^"]*"/, "");

describe("en sanning: ingången är samma funktioner som roten, inte kopior", () => {
  it("varje namn som också finns i roten är SAMMA objekt", () => {
    const gemensamma = Object.keys(rent).filter((n) => n in rot);
    expect(gemensamma.length).toBeGreaterThanOrEqual(15);
    for (const n of gemensamma) expect(rent[/** @type {keyof typeof rent} */ (n)], n).toBe(rot[/** @type {keyof typeof rot} */ (n)]);
  });
});

describe("SVG-datan ritar samma ikon som komponenten", () => {
  it("gruppikonSvg är byte för byte komponentens markup, för varje ikon i katalogen", () => {
    expect(rent.GRUPPIKONKATALOG.length).toBeGreaterThanOrEqual(150);
    expect(Object.keys(GRUPPIKON_SVG)).toEqual(rent.GRUPPIKONKATALOG.map((i) => i.namn));
    for (const { namn } of rent.GRUPPIKONKATALOG) {
      const Ikon = /** @type {import("react").ComponentType<{ size?: number }>} */ (gruppikonKomponent(namn));
      expect(rent.gruppikonSvg(namn, 18), namn).toBe(utanKlass(renderToStaticMarkup(createElement(Ikon, { size: 18 }))));
    }
  });

  it("ett okänt namn ger tom sträng, ett äldre id ger sin ikon", () => {
    expect(rent.gruppikonSvg("drake")).toBe("");
    expect(rent.gruppikonSvg("leende")).toBe(rent.gruppikonSvg("smile"));
    expect(rent.gruppikonSvg("hus")).toBe(rent.gruppikonSvg("house"));
  });
});

describe("bakåtkompatibelt: de äldre profilvärdena ritas som förut", () => {
  it("varje äldre profil-id ritar SAMMA ikon som PROFILIKON_KOMPONENT ritade", () => {
    expect(rent.PROFILIKONER.length).toBe(6);
    for (const id of rent.PROFILIKONER) {
      const forut = renderToStaticMarkup(createElement(PROFILIKON_KOMPONENT[id], { size: 20 }));
      const nu = renderToStaticMarkup(createElement(/** @type {any} */ (gruppikonKomponent(id)), { size: 20 }));
      // Bara strecken jämförs: förut ritades ikonen med icons.jsx-omslagets klass, nu med katalogens.
      expect(nu.replace(/^<svg[^>]*>/, ""), id).toBe(forut.replace(/^<svg[^>]*>/, ""));
      expect(rent.personmarke(ANV({ ikon: id })).ikon).toBe(rent.ARV_PROFILIKON[id]);
    }
  });

  it("tonerna 1 till 6 ritas med sin kulör, och tom färg ger kulören ur id", () => {
    for (const ton of rent.PROFILFARGER) expect(rent.personmarke(ANV({ farg: ton })).kulor).toBe(rent.ARV_TON_KULOR[/** @type {1} */ (Number(ton))]);
    expect(rent.personmarke(ANV({ farg: "kulor:210" })).kulor).toBe(210);
    expect(rent.personmarke(ANV({ farg: "" })).kulor).toBe(rent.gruppKulor({ id: "u1" }));
  });

  it("ett okänt värde ritas som om det inte fanns, läsvägen kastar inte", () => {
    expect(rent.personmarke(ANV({ ikon: "drake", farg: "kulor:999" }))).toEqual({ kulor: rent.gruppKulor({ id: "u1" }), ikon: "", initialer: "CP" });
  });
});

describe("validering: byggAnvandare tar emot katalognamn och kulor:N, och avvisar resten", () => {
  it.each([["music"], ["building-2"], ["user"], ["person"], ["leende"], [""]])("ikonen %s tas emot", (ikon) => {
    expect(byggAnvandare(ANV({ ikon })).ikon).toBe(ikon);
  });
  it.each([["drake"], ["initialer:AB"], ["portfolj"], ["Music"], ["0"]])("ikonen %s avvisas", (ikon) => {
    expect(() => byggAnvandare(ANV({ ikon }))).toThrow(/ikonen/);
  });
  it.each([["kulor:0"], ["kulor:359"], ["kulor:210"], ["3"], [""]])("färgen %s tas emot", (farg) => {
    expect(byggAnvandare(ANV({ farg })).farg).toBe(farg);
  });
  it.each([["kulor:360"], ["kulor:007"], ["kulor:-1"], ["7"], ["#ff0000"], ["kulor:"]])("färgen %s avvisas", (farg) => {
    expect(() => byggAnvandare(ANV({ farg }))).toThrow(/färgen/);
  });
});

describe("senast använda, delad mellan gruppens och personens väljare", () => {
  beforeEach(() => localStorage.clear());
  it("sparar först, utan dubbletter, högst MAX_SENASTE, och släpper okända namn", () => {
    for (const n of ["music", "star", "music", "heart", "a", "b", "c", "d", "e", "f"]) rent.sparaSenasteGruppikon(n);
    localStorage.setItem(rent.SENASTE_NYCKEL, JSON.stringify(["drake", ...JSON.parse(localStorage.getItem(rent.SENASTE_NYCKEL) ?? "[]")]));
    // "a" till "f" och "drake" är inte katalognamn och släpps vid läsningen; music står en gång.
    expect(rent.lasSenasteGruppikoner()).toEqual(["heart", "music", "star"]);
  });
  it("taket MAX_SENASTE håller", () => {
    for (const { namn } of rent.GRUPPIKONKATALOG.slice(0, 12)) rent.sparaSenasteGruppikon(namn);
    expect(rent.lasSenasteGruppikoner().length).toBe(rent.MAX_SENASTE);
  });
  it("trasig lagring är tomt, inte ett fel", () => {
    localStorage.setItem(rent.SENASTE_NYCKEL, "{inte json");
    expect(rent.lasSenasteGruppikoner()).toEqual([]);
  });
});

describe("OpsProfil ritar personen som en grupp", () => {
  it("kulören på en tonad platta, med ikonen ur katalogen", () => {
    render(<OpsProfil anvandare={{ ...ANV({ ikon: "music", farg: "kulor:200" }), bild: "", telefon: "", stad: "", presentation: "", lankar: [], bildSokvag: "", tema: "system" }} onSpara={() => {}} />);
    const huvud = screen.getByRole("img", { name: "Claes Philip" });
    expect(huvud.className).toContain("ops-gruppmarke");
    expect(huvud.getAttribute("data-grupp-kulor")).toBe("200");
    expect(huvud.querySelector(".lucide-music")).toBeTruthy();
  });
  it("personmarkeProps utan ikon ger bara kulören, så att OpsIdentity ritar initialerna", () => {
    expect(personmarkeProps(ANV({ farg: "kulor:12" }))).toEqual({ kulor: 12 });
  });
});
