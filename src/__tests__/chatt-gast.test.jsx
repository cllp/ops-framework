import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Meddelanderader } from "../components/OpsMeddelanden.jsx";
import { gastId } from "../lib/gast.js";

/**
 * En gästs meddelanden i medlemmarnas chatt (0.132.0, cllp/lifehub.app#389, CP 2026-10-20: "Gästen får skriva"): servern skriver `av` = gästens `g_`-id och `avNamn`, och medlemmens chatt visar namnet
 * med märket Gäst. Märket härleds ur `av` och ingenting annat, så det kan inte saknas på ett meddelande en gäst skrev och inte sitta på en medlems.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

beforeEach(() => {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});

const ANNA = gastId("anna@foretag.se");
const BO = gastId("bo@foretag.se");
const T = Date.UTC(2026, 9, 19, 9, 0);

const rita = (meddelanden) =>
  render(<Meddelanderader meddelanden={meddelanden} uid="u-jag" namnFor={(id) => (id === "u-maja" ? "Maja Medlem" : "Namn saknas")} medlemmar={[]} locale="sv-SE" visaNamn />);

describe("medlemmens chatt med en gästs meddelande", () => {
  it("en gäst visas med sitt namn ur meddelandet och märket Gäst, och en medlem har inget märke", () => {
    rita([
      { id: "a", av: "u-maja", text: "Hej från Maja", tid: T },
      { id: "b", av: ANNA, avNamn: "Anna Gäst", text: "Hej från gästen", tid: T + 10 * 60000 },
    ]);
    const markningar = [...document.querySelectorAll("[data-gast-markning]")];
    expect(markningar.map((m) => m.textContent)).toEqual(["Gäst"]);
    // Namnet står bredvid märket, och inte "Namn saknas".
    expect(within(markningar[0].parentElement).getByText("Anna Gäst")).toBeInTheDocument();
    expect(document.querySelector("[data-namn-saknas]")).toBeNull();
    expect(screen.getByText("Maja Medlem")).toBeInTheDocument();
    expect(screen.getByText("Hej från gästen", { selector: "[data-bubbla] *" })).toBeInTheDocument();
  });

  it("en gäst utan namn på meddelandet heter Gäst, aldrig ett id, och märket sitter kvar", () => {
    rita([{ id: "b", av: BO, text: "Hej", tid: T }]);
    const m = document.querySelector("[data-gast-markning]");
    expect(m).not.toBeNull();
    expect(m.parentElement.textContent).toBe("GästGäst");
    expect(document.body.textContent).not.toContain(BO);
  });

  it("⛔ märket härleds ur av: en medlem vars meddelande bär ett avNamn får inget märke", () => {
    rita([{ id: "a", av: "u-maja", avNamn: "Falsk Gäst", text: "Hej", tid: T }]);
    expect(document.querySelector("[data-gast-markning]")).toBeNull();
    expect(screen.getByText("Maja Medlem")).toBeInTheDocument();
    expect(screen.queryByText("Falsk Gäst")).toBeNull();
  });

  it("två gäster med olika namn håller isär sina namn", () => {
    rita([
      { id: "a", av: ANNA, avNamn: "Anna Gäst", text: "1", tid: T },
      { id: "b", av: BO, avNamn: "Bo Gäst", text: "2", tid: T + 10 * 60000 },
    ]);
    expect(screen.getByText("Anna Gäst")).toBeInTheDocument();
    expect(screen.getByText("Bo Gäst")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-gast-markning]")).toHaveLength(2);
  });
});
