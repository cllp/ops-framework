import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { paminnelser, SORTER } from "../../examples/paminnelser/index.js";
import { PaminnelserVy } from "../../examples/paminnelser/PaminnelserVy.jsx";
import { skapaKallregister } from "../lib/kallor.js";
import { validateModuler } from "../lib/modul.js";
import { generateRules } from "../lib/regler.js";

/**
 * Fas 3: exempelmodulen (#131).
 *
 * ⛔ PROVEN KÖR EXEMPLET SOM EN RIKTIG MODUL, genom registret och generatorn.
 * Ett exempel som bara läses ruttnar: det är först när ramverkets egen
 * validering tar emot det som README:s löfte är mätt.
 */

const BOLAGET = { groupId: "bolaget" };

describe("exempelmodulen tas emot av ramverket", () => {
  it("går genom validateModuler utan tillägg", () => {
    expect(validateModuler([paminnelser])[0].id).toBe("paminnelser");
  });

  it("fyller alla sex ytorna, alltså visar hela kontraktet", () => {
    const register = skapaKallregister([paminnelser]);
    for (const yta of ["handelser", "sok", "hjalp", "notiser", "widgets", "kataloger"]) {
      expect(register.modulerFor(yta)).toEqual(["paminnelser"]);
    }
  });

  it("bär två språk överallt där ett namn står", () => {
    expect(paminnelser.namn).toEqual({ sv: "Påminnelser", en: "Reminders" });
    expect(SORTER.map((k) => k.namn.en)).toEqual(["Bill", "Contract"]);
  });
});

describe("källorna svarar per grupp", () => {
  const register = () => skapaKallregister([paminnelser]);

  it("ger bara den frågade gruppens rader", async () => {
    expect((await register().handelser(BOLAGET)).map((r) => r.id)).toEqual(["p1", "p2"]);
    expect((await register().handelser({ groupId: "privat" })).map((r) => r.id)).toEqual(["p3"]);
  });

  it("söker i titlarna", async () => {
    const traffar = await register().sok({ groupId: "bolaget", text: "skatt" });
    expect(traffar.map((t) => t.id)).toEqual(["p1"]);
  });

  it("svarar på sin egen route och tiger om andras", async () => {
    expect((await register().hjalp({ groupId: "bolaget", route: "/paminnelser" })).length).toBe(1);
    expect(await register().hjalp({ groupId: "bolaget", route: "/ekonomi" })).toEqual([]);
  });

  it("notiserar bara det som är nära", async () => {
    expect((await register().notiser(BOLAGET)).map((n) => n.id)).toEqual(["p1"]);
  });

  it("ger en widget och en katalog med två kategorier", async () => {
    expect((await register().widgets(BOLAGET)).length).toBe(1);
    const kataloger = await register().kataloger(BOLAGET);
    expect(kataloger[0].kategorier.map((k) => k.id)).toEqual(["rakning", "avtal"]);
  });
});

describe("modulen ger regler ur sitt manifest", () => {
  it("genererar ett block med formvalidering ur fältlistan", () => {
    const text = generateRules([paminnelser]);
    expect(text).toContain("match /paminnelser/{id}");
    expect(text).toContain('keys().hasOnly(["id", "groupId", "titel", "sort", "dagar"])');
  });
});

describe("modulens vy", () => {
  it("ritar raderna", () => {
    render(<PaminnelserVy rader={[{ id: "p1", titel: "Betala F-skatt", dagar: 3 }]} />);
    expect(screen.getByText("Betala F-skatt")).toBeTruthy();
  });

  it("säger ifrån när gruppen är tom, i stället för att rita ingenting", () => {
    render(<PaminnelserVy rader={[]} />);
    expect(screen.getByText(/Inga påminnelser/)).toBeTruthy();
  });
});

describe("manifestet går att läsa utan en bundler", () => {
  /*
   * ⛔ DET HÄR ÄR MODULENS VIKTIGASTE LÄRDOM. Regelgeneratorn körs i ett Node-
   * skript i appens CI, och Node kan inte läsa JSX. En manifestfil som
   * importerar sin vy direkt faller på "Unknown file extension .jsx", och
   * felet dyker upp långt från sin orsak. Med lazy är vyn ett löfte.
   */
  it("importerar inte JSX rakt av", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const kalla = fs.readFileSync(path.resolve(process.cwd(), "examples/paminnelser/index.js"), "utf8");
    expect(kalla).toContain("lazy(() => import(");
    expect(kalla).not.toMatch(/^import .* from "\.\/[^"]*\.jsx";$/m);
  });

  it("routen pekar ändå ut en vy, eftersom lazy ger ett objekt", () => {
    expect(paminnelser.routes[0].vy).toBeTruthy();
  });
});
