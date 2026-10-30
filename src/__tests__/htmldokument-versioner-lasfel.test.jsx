import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * Går versionsraden inte att hämta (nätet föll, eller en ny version är utlagd och den gamla biten finns inte längre) syns det (0.159.0, arbetsreglernas punkt 5): en mening i stället för raden,
 * och Biblioteket runt den står kvar. Utan gränsen i `BibliotekHtmlVersionerLat` kastar `lazy` felet uppåt och hela detaljen försvinner.
 *
 * ⛔ Modulen byts mot en som kastar när den läses. Ett eget provfil, eftersom `vi.mock` gäller hela filen.
 */
vi.mock("../components/BibliotekHtmlVersioner.jsx", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

const tid = 1_700_000_000_000;
const KIM = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const post = {
  ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Rapport", fil: { sokvag: "grupper/cps-ab/bibliotek/p1/rapport.html", namn: "rapport.html", mime: "text/html", byte: 20, klar: true }, skapadAv: KIM, skapad: tid, andrad: tid }),
  id: "p1",
};

describe("Versionsraden som inte gick att hämta", () => {
  it("⛔ säger det i stället för att tas bort tyst, och dokumentet under står kvar", async () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <OpsSprakProvider sprak="sv">
        <OpsBibliotek poster={[post]} jag={{ uid: "uid-1", roll: "medlem" }} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} hamtaFil={async () => new Blob(["<h1>Nu</h1>"], { type: "text/html" })} htmlVersioner={async () => ({ nuvarande: 1, versioner: [] })} />
      </OpsSprakProvider>,
    );
    const mening = await screen.findByText("Versionsraden gick inte att läsa in. Ladda om sidan.");
    expect(mening.getAttribute("role")).toBe("alert");
    expect(document.querySelector("[data-html-versioner]")).toBeNull();
    expect(document.querySelector("[data-html-versioner-vantar]")).toBeNull();
    // Dokumentet självt ritas fortfarande.
    expect(document.querySelector("iframe")).not.toBeNull();
    tyst.mockRestore();
  });
});
