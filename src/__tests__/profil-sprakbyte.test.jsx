import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OpsProfil } from "../components/OpsProfil.jsx";

/*
 * CP 2026-11-15: "Det tar tid att växla språk i apparna, helt ok men det behöver en progress, den nya snygga."
 * Medan språket sparas visar profilen OpsVantar ("Byter språk…"), och den försvinner när sparandet är klart.
 * Rött utan ändringen: ingen väntan ritades.
 */
const ANV = { id: "u", namn: "CP", epost: "cp@x.se", bild: "", sprak: "sv", tema: /** @type {const} */ ("system"), telefon: "", stad: "", presentation: "", lankar: [], bildSokvag: "" };

describe("språkbytet i kontoläget", () => {
  it("visar Byter språk medan sparandet pågår, och släpper den när det är klart", async () => {
    /** @type {() => void} */
    let klar = () => {};
    const onSpara = () => new Promise((ok) => { klar = () => ok(undefined); });
    render(<OpsProfil anvandare={ANV} roll="Ägare" onSpara={onSpara} falt={["sprak"]} kontoUrl="https://k.example/p" raderaKontoUrl="https://k.example/p#radera-konto" grupper={[]} />);
    expect(document.querySelector("[data-profil-sprakbyte]")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "EN" }));
    await waitFor(() => expect(document.querySelector("[data-profil-sprakbyte]")).not.toBeNull());
    await waitFor(() => expect(screen.getByText("Byter språk…")).toBeTruthy(), { timeout: 2000 });
    klar();
    await waitFor(() => expect(document.querySelector("[data-profil-sprakbyte]")).toBeNull());
  });
});
