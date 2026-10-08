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

const FORFATTARE = { uid: "uid-1", roll: "medlem" };

function Harness({ start = poster, lasfel = null, jag = FORFATTARE, trasiga = [] }) {
  const [vald, setVald] = useState(/** @type {(typeof poster)[number] | null} */ (null));
  const [skapar, setSkapar] = useState(/** @type {"anteckning" | "lank" | null} */ (null));
  const [sparat, setSparat] = useState(/** @type {unknown} */ (null));
  return (
    <>
      <OpsBibliotek
        poster={start}
        fel={lasfel}
        jag={jag}
        trasiga={trasiga}
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

  it("en länk går att öppna, i ny flik och bara på http eller https", () => {
    const ond = { ...poster[1], id: "ond", rubrik: "Ond", url: "javascript:alert(1)" };
    render(<Harness start={[poster[1], ond]} jag={{ uid: "uid-annan", roll: "medlem" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Bolagsverket" }));
    const lank = screen.getByRole("link", { name: "https://bolagsverket.se/" });
    expect(lank).toHaveAttribute("href", "https://bolagsverket.se/");
    expect(lank).toHaveAttribute("target", "_blank");
    expect(lank).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    fireEvent.click(screen.getByRole("button", { name: "Ond" }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
  });

  it("formuläret visas för författaren och admin, och andra ser läsläge", () => {
    const { unmount } = render(<Harness jag={{ uid: "uid-annan", roll: "medlem" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.getByText("Vi beslutade om bokslutet.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    unmount();

    const admin = render(<Harness jag={{ uid: "uid-annan", roll: "admin" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.getByRole("textbox", { name: "Text" })).toHaveValue("Vi beslutade om bokslutet.");
    admin.unmount();

    render(<Harness jag={null} />);
    expect(screen.queryByRole("button", { name: "Ny länk" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Protokoll" }));
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
  });

  it("trasiga rader visas som ett antal med skäl, inte tyst", () => {
    render(<Harness trasiga={[{ id: "x", fel: "Anteckningen saknar text." }]} />);
    const ruta = document.querySelector("[data-bibliotek-trasiga]");
    expect(ruta).toHaveAttribute("role", "status");
    expect(ruta).toHaveTextContent("1 post kunde inte läsas och visas inte.");
    expect(ruta).toHaveTextContent("x: Anteckningen saknar text.");
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
  });
});
