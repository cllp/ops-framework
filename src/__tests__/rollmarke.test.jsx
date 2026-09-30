import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsRollmarke, ROLLMARKE_MATT } from "../components/OpsRollmarke.jsx";
import { OpsEventList } from "../components/OpsEventList.jsx";
import { OpsPill } from "../components/OpsPill.jsx";

/**
 * 0.32.1, CP 2026-09-30 08:04: "Kolla storleken och fint på texten i händelserna. Matchar inte det vi har i
 * SessionStudio. Dubbelkolla även inkorgen." Storlekarna i pixlar mäts i en riktig webbläsare (check-skalyta
 * avsnitt 25). Här provas det jsdom kan svara på: vad som kastar, och att två märken delar EN klassrad.
 */
describe("OpsRollmarke", () => {
  it("skriver appens ord och har samma mått som brådskans Försenat", () => {
    render(
      <OpsEventList
        events={[{ id: "a", title: "Moms", daysLeft: -2, role: <OpsRollmarke kind="human" label="Du" /> }]}
      />,
    );
    const du = screen.getByText("Du");
    const forsenat = screen.getByText("Försenat");
    // ⛔ Samma konstant på båda. En kopia av klassraden hade glidit isär första gången någon rättade den ena.
    for (const klass of ROLLMARKE_MATT.split(" ")) {
      expect(du.className).toContain(klass);
      expect(forsenat.className).toContain(klass);
    }
  });

  it("kastar utan ord och på en okänd roll", () => {
    // ⛔ En färgad ruta utan ord bär rollen i färgen ensam.
    expect(() => render(<OpsRollmarke kind="human" label="" />)).toThrow(/label krävs/);
    expect(() => render(<OpsRollmarke kind={/** @type {any} */ ("chef")} label="Chef" />)).toThrow(/okänt kind/);
  });
});

describe("OpsPill size", () => {
  it("liten är rollen liten med SS luft, standard är oförändrad", () => {
    render(
      <>
        <OpsPill size="liten">Ärende</OpsPill>
        <OpsPill>Ny</OpsPill>
      </>,
    );
    expect(screen.getByText("Ärende").className).toMatch(/\btext-liten\b/);
    expect(screen.getByText("Ärende").className).toMatch(/\bpx-1\.5\b/);
    expect(screen.getByText("Ny").className).toMatch(/\bpx-3 py-1 text-meta font-semibold\b/);
  });

  it("kastar på en okänd storlek", () => {
    expect(() => render(<OpsPill size={/** @type {any} */ ("stor")}>x</OpsPill>)).toThrow(/okänd size/);
  });
});

describe("OpsField labelSize (0.32.1)", async () => {
  const { OpsField, OpsInput } = await import("../components/OpsField.jsx");
  it("liten är 10 px-rollen, standard är oförändrad, okänd kastar", () => {
    render(
      <>
        <OpsField label="Namn" labelSize="liten"><OpsInput value="" onChange={() => {}} /></OpsField>
        <OpsField label="Rubrik"><OpsInput value="" onChange={() => {}} /></OpsField>
      </>,
    );
    expect(screen.getByText("Namn").className).toMatch(/\btext-liten\b/);
    expect(screen.getByText("Rubrik").className).toMatch(/\btext-etikett font-medium\b/);
    expect(() => render(<OpsField label="x" labelSize={/** @type {any} */ ("stor")}><span /></OpsField>)).toThrow(/okänd labelSize/);
  });
});
