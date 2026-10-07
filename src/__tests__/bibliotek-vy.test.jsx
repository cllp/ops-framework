import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/**
 * Listan och detaljen. jsdom mäter att texten finns och att ett tryck byter vy.
 * Hur det ser ut mäts i montaget, med Playwright.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };

const poster = [
  { ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade om bokslutet.", skapadAv: skapare, skapad: tid, andrad: tid }), id: "a" },
  { ...byggPost({ groupId: "cps-ab", typ: "lank", rubrik: "Bolagsverket", url: "https://bolagsverket.se", skapadAv: skapare, skapad: tid, andrad: tid + 1 }), id: "b" },
];

function Harness({ start = poster, lasfel = null }) {
  const [vald, setVald] = useState(/** @type {(typeof poster)[number] | null} */ (null));
  const [skapar, setSkapar] = useState(/** @type {"anteckning" | "lank" | null} */ (null));
  const [sparat, setSparat] = useState(/** @type {unknown} */ (null));
  return (
    <>
      <OpsBibliotek
        poster={start}
        fel={lasfel}
        vald={vald}
        skapar={skapar}
        onOppna={(p) => { setSkapar(null); setVald(/** @type {any} */ (p)); }}
        onStang={() => { setVald(null); setSkapar(null); }}
        onSkapa={(typ) => { setVald(null); setSkapar(typ); }}
        onSpara={(inmatning) => setSparat(inmatning)}
      />
      <output data-sparat="">{sparat ? JSON.stringify(sparat) : ""}</output>
    </>
  );
}

describe("OpsBibliotek", () => {
  it("säger att biblioteket är tomt, och ett läsfel är inte tomhet", () => {
    const { unmount } = render(<Harness start={[]} />);
    expect(screen.getByText("Biblioteket är tomt.")).toBeInTheDocument();
    unmount();
    render(<Harness start={[]} lasfel="Databasen svarade inte." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Databasen svarade inte.");
    expect(screen.queryByText("Biblioteket är tomt.")).toBeNull();
  });

  it("öppnar anteckningen och sparar en ny länk bara med adress", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.getByDisplayValue("Vi beslutade om bokslutet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    fireEvent.click(screen.getByRole("button", { name: "Ny länk" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Rubrik" }), { target: { value: "Skatteverket" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Adress" }), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/http eller https/);
    expect(document.querySelector("[data-sparat]")?.textContent).toBe("");
    fireEvent.change(screen.getByRole("textbox", { name: "Adress" }), { target: { value: "https://skatteverket.se" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect(document.querySelector("[data-sparat]")?.textContent).toContain("https://skatteverket.se");
    expect(document.querySelector("[data-sparat]")?.textContent).not.toContain("text");
  });
});
