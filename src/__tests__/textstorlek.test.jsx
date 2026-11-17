import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { OpsTextstorlek } from "../components/OpsTextstorlek.jsx";
import { getTextstorlek, initTextstorlek, setTextstorlek, TEXTSKALOR, TEXTSTORLEKAR } from "../lib/textstorlek.js";
import { byggAnvandare } from "../lib/grupp.js";
import { createMemorySource } from "../data/adapters.js";
import { sakerstallAnvandare, sparaInstallningar } from "../lib/profil.js";
import { regelfragment } from "../lib/regler.js";

/*
 * Textstorleken Liten, Mellan och Stor (cllp/lifehub.app#873, CP 2026-11-17).
 *
 * ⛔ VAD SOM RITAS mäts inte här: jsdom kör ingen CSS. Att rollerna, radhöjden, body och fältets golv följer valet mäts i Chromium
 * av `scripts/check-textstorlek.mjs`. Här provas det som går att se utan CSS: attributet på `<html>`, minnet per enhet, väljaren,
 * raden i `users` och regeln som släpper in fältet.
 */

const rot = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  rot().removeAttribute("data-textstorlek");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("textstorleken på enheten", () => {
  it("tre lägen, Mellan är 1 och i mitten", () => {
    expect(TEXTSTORLEKAR).toEqual(["liten", "mellan", "stor"]);
    expect(TEXTSKALOR.mellan).toBe(1);
    expect(TEXTSKALOR.liten).toBeLessThan(1);
    expect(TEXTSKALOR.stor).toBeGreaterThan(1);
  });

  it("Stor skrivs på <html> och sparas, Mellan tar bort attributet", () => {
    setTextstorlek("stor");
    expect(rot().getAttribute("data-textstorlek")).toBe("stor");
    expect(getTextstorlek()).toBe("stor");
    setTextstorlek("mellan");
    expect(rot().hasAttribute("data-textstorlek")).toBe(false);
    expect(getTextstorlek()).toBe("mellan");
  });

  it("initTextstorlek lägger på det sparade valet före första renderingen", () => {
    localStorage.setItem("ops-textstorlek", "liten");
    initTextstorlek();
    expect(rot().getAttribute("data-textstorlek")).toBe("liten");
  });

  it("ett okänt sparat värde läses som Mellan, ett okänt val kastar", () => {
    localStorage.setItem("ops-textstorlek", "jattestor");
    expect(getTextstorlek()).toBe("mellan");
    expect(() => setTextstorlek(/** @type {any} */ ("jattestor"))).toThrow(/okänt läge "jattestor"/);
  });

  it("⛔ blockerad lagring: förvalet vid läsning, och valet gäller ändå på sidan", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(getTextstorlek()).toBe("mellan");
    setTextstorlek("stor");
    expect(rot().getAttribute("data-textstorlek")).toBe("stor");
  });
});

describe("OpsTextstorlek", () => {
  it("tre segment, det sparade valt, och ett tryck byter direkt och säger till appen", () => {
    setTextstorlek("liten");
    const onChange = vi.fn();
    render(<OpsTextstorlek onChange={onChange} />);
    expect(screen.getByRole("tablist", { name: "Textstorlek" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Liten" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Stor" }));
    expect(rot().getAttribute("data-textstorlek")).toBe("stor");
    expect(screen.getByRole("tab", { name: "Stor" }).getAttribute("aria-selected")).toBe("true");
    expect(onChange).toHaveBeenCalledWith("stor");
  });
});

describe("textstorleken per person, på raden i users", () => {
  const RAD = { id: "uid-1", namn: "CP", epost: "cp@staiger.se" };

  it("en rad utan fältet läses som Mellan, inte som ett fel", () => {
    expect(byggAnvandare(RAD).textstorlek).toBe("mellan");
  });

  it("ett okänt värde avvisas med vilka som gäller", () => {
    expect(() => byggAnvandare({ ...RAD, textstorlek: "jattestor" })).toThrow(/textstorleken "jattestor" för "uid-1" finns inte\. Giltiga: liten, mellan, stor/);
  });

  it("sparaInstallningar skriver valet, och det står kvar efter nästa inloggning", async () => {
    const kalla = createMemorySource({ users: [] });
    const inloggad = { uid: "uid-1", namn: "CP", epost: "cp@staiger.se" };
    const { anvandare } = await sakerstallAnvandare({ kalla, inloggad });
    await sparaInstallningar({ kalla, anvandare, andring: { textstorlek: "stor" } });
    expect(await kalla.read("users", "uid-1")).toMatchObject({ textstorlek: "stor" });
    expect((await sakerstallAnvandare({ kalla, inloggad })).anvandare.textstorlek).toBe("stor");
  });

  it("⛔ regeln släpper in fältet, också när kontot äger personen", () => {
    const anvandarregeln = (/** @type {string} */ text) => text.slice(text.indexOf("match /users/{uid} {"), text.indexOf("\n    }", text.indexOf("match /users/{uid} {")));
    expect(anvandarregeln(regelfragment({}, { kontoAgerPersonen: true }))).toContain('affectedKeys().hasOnly(["tema", "textstorlek"])');
    expect(anvandarregeln(regelfragment())).toContain('"textstorlek"');
  });
});
