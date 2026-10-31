import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell, useOppnaSkapa } from "../components/OpsAppShell.jsx";

/**
 * 0.166.0 (cllp/lifehub.app#552): `useOppnaSkapa()("handelse", { forifyllt })` når formuläret.
 * ⛔ RÖTT MOT 0.165.0: skalet släppte `forifyllt`, och projektets "Ny händelse" öppnade ett tomt formulär utan projektets tagg.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

function HandelseForm({ formId, forifyllt }) {
  return (
    <form id={formId} aria-label="Händelseformulär">
      <p>rubrik:{forifyllt?.rubrik ?? "-"}</p>
      <p>taggar:{forifyllt?.taggar ? forifyllt.taggar.join(",") : "-"}</p>
    </form>
  );
}

function Knapp({ extra }) {
  const oppna = useOppnaSkapa();
  return <button type="button" onClick={() => oppna("handelse", extra)}>Ny händelse i projektet</button>;
}

function Skal({ extra }) {
  return (
    <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={{ sparaEtikett: "Spara", lage: "g", handelse: { form: HandelseForm, katalog: null } }}>
      <Knapp extra={extra} />
    </OpsAppShell>
  );
}

describe("⛔ appens forifyllt till Ny händelse (#552)", () => {
  it("formuläret får rubriken och taggarna, och adressen bär dem inte", async () => {
    render(<Skal extra={{ forifyllt: { rubrik: "Möte", taggar: ["projekt-x"] } }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Ny händelse i projektet" }));
    await waitFor(() => expect(screen.getByText("taggar:projekt-x")).toBeInTheDocument());
    expect(screen.getByText("rubrik:Möte")).toBeInTheDocument();
    const u = new URL(window.location.href);
    expect(u.searchParams.get("skapa")).toBe("handelse");
    expect(u.search).not.toMatch(/projekt-x|M%C3%B6te/);
  });

  it("utan forifyllt är formuläret som förut", async () => {
    render(<Skal extra={undefined} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Ny händelse i projektet" }));
    await waitFor(() => expect(screen.getByText("taggar:-")).toBeInTheDocument());
  });

  it("kastar för forifyllt till en annan nyckel än handelse och för forifyllt med id", () => {
    let oppna;
    function Fanga() {
      oppna = useOppnaSkapa();
      return null;
    }
    render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={{ sparaEtikett: "Spara", lage: "g", handelse: { form: HandelseForm, katalog: null }, grupp: () => null }}>
        <Fanga />
      </OpsAppShell>,
    );
    expect(() => oppna("grupp", { forifyllt: { rubrik: "x" } })).toThrow(/forifyllt gäller bara "handelse"/);
    expect(() => oppna("handelse", { id: "h1", forifyllt: { rubrik: "x" } })).toThrow(/forifyllt och id/);
    expect(() => oppna("handelse", { forifyllt: { taggar: "x" } })).toThrow(/lista med texter/);
  });
});
