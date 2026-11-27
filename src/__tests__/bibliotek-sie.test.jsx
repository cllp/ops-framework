import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { SIE_BYTE } from "../components/SieForhandsvisning.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * En SIE-fil i Biblioteket visas tolkad i detaljen (0.268.0, cllp/lifehub.app#884). Tolkningen provas i sie.test.js; här provas vägen dit och det som ritas.
 * Röda före 0.268.0: en .se hade ingen förhandsvisning, och `[data-bibliotek-sie]` fanns inte.
 * ⛔ SYNTETISK FIL, INGA RIKTIGA BOLAGSDATA.
 */
const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const SIE = [
  "#FLAGGA 0",
  "#SIETYP 4",
  '#PROGRAM "Provprogrammet" 1.0',
  '#FNAMN "Provbolaget AB"',
  "#ORGNR 556000-0000",
  "#RAR 0 20250101 20251231",
  '#KONTO 1930 "Företagskonto"',
  '#KONTO 3001 "Försäljning"',
  '#KONTO 5410 "Förbrukningsinventarier"',
  "#IB 0 1930 10000.00",
  "#UB 0 1930 22500.50",
  "#RES 0 3001 -15000.00",
  "#RES 0 5410 2499.50",
  '#VER A 1 20250310 "Kund betalar"',
  "{",
  "#TRANS 1930 {} 15000.00",
  "#TRANS 3001 {} -15000.00",
  "}",
].join("\n");
const post = (/** @type {string} */ namn, /** @type {string} */ mime) => ({ ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Bokföringen", fil: { sokvag: `g/a/${namn}`, namn, mime, byte: SIE.length, klar: true }, skapadAv: skapare, skapad: tid, andrad: tid }), id: "s1" });
const visa = (/** @type {any} */ p, /** @type {Record<string, unknown>} */ extra) =>
  render(<OpsBibliotek poster={[p]} vald={p} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/x"} {...extra} />);

describe("SIE i Biblioteket (#884)", () => {
  it("⛔ företaget, räkenskapsåret, årets resultat och kontona, med Ladda ned under", async () => {
    const hamtaFil = vi.fn(async () => new Blob([SIE]));
    const { container } = visa(post("bokforing.se", "text/x-sie"), { hamtaFil });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-sie=klar]")).not.toBeNull());
    expect(hamtaFil).toHaveBeenCalledWith("g/a/bokforing.se");
    const region = screen.getByRole("region", { name: "Bokföringen i Bokföringen" });
    expect(within(region).getByText("Provbolaget AB, 556000-0000")).toBeInTheDocument();
    expect(within(region).getByText("2025-01-01 till 2025-12-31")).toBeInTheDocument();
    // Intäkter är kredit i SIE: -15 000 + 2 499,50 ger vinsten 12 500,50.
    expect(container.querySelector("[data-sie-resultat]")?.textContent?.replace(/\s/g, " ")).toMatch(/Årets resultat: 12 500,50/);
    expect(within(region).getByText("Försäljning")).toBeInTheDocument();
    fireEvent.mouseDown(within(region).getByRole("tab", { name: /Balans/ }), { button: 0 });
    expect(within(region).getByText("Företagskonto")).toBeInTheDocument();
    expect(within(region).getByText(/22 500,50/)).toBeInTheDocument();
    fireEvent.mouseDown(within(region).getByRole("tab", { name: /Verifikationer/ }), { button: 0 });
    expect(within(region).getByText("Kund betalar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ladda ned" })).toBeInTheDocument();
  });

  it("en .se som webbläsaren kallade text/plain visas också tolkad", async () => {
    const { container } = visa(post("bokforing.se", "text/plain"), { hamtaFil: vi.fn(async () => new Blob([SIE])) });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-sie=klar]")).not.toBeNull());
  });

  it("en fil som inte är SIE visas som text, med en rad som säger det", async () => {
    const { container } = visa(post("anteckning.se", "text/x-sie"), { hamtaFil: vi.fn(async () => new Blob(["Bara en anteckning."])) });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-sie=text]")).not.toBeNull());
    expect(screen.getByText("Filen går inte att läsa som SIE, så den visas som text.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Bara en anteckning.")).toBeInTheDocument());
  });

  it("över taket tolkas ingenting, och ett fel säger varför", async () => {
    const stor = visa(post("stor.se", "text/x-sie"), { hamtaFil: vi.fn(async () => new Blob([new Uint8Array(SIE_BYTE + 1)])) });
    await waitFor(() => expect(stor.container.querySelector("[data-bibliotek-sie=stor]")).not.toBeNull());
    stor.unmount();
    const fel = visa(post("fel.se", "text/x-sie"), { hamtaFil: vi.fn(async () => { throw new Error("nekad"); }) });
    await waitFor(() => expect(fel.container.querySelector("[data-bibliotek-sie=fel]")).not.toBeNull());
  });
});
