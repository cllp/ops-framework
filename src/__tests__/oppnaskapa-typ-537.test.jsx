import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell, useOppnaSkapa } from "../components/OpsAppShell.jsx";

/** 0.170.0 (cllp/lifehub.app#537): `useOppnaSkapa()("handelse", { typ })` förväljer typen. Kalendern förväljer Sammankomst. */
afterEach(() => window.history.replaceState(null, "", "/"));

function HandelseForm({ formId, typ }) {
  return <form id={formId} aria-label="Händelseformulär"><p>typ:{typ ?? "-"}</p></form>;
}
const KATALOGER = [{ id: "typer", kategorier: [{ id: "uppgift", namn: "Uppgift", ordning: 1 }, { id: "sammankomst", namn: "Sammankomst", ordning: 2 }] }];
/** @param {{ extra?: any }} p */
function Skal({ extra }) {
  function Knapp() {
    const oppna = useOppnaSkapa();
    return <button type="button" onClick={() => oppna("handelse", extra)}>Ny</button>;
  }
  return (
    <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={{ sparaEtikett: "Spara", lage: "g", kataloger: KATALOGER, handelse: { form: HandelseForm, katalog: "typer" } }}>
      <Knapp />
    </OpsAppShell>
  );
}

describe("#537 förvald typ", () => {
  it("typ: sammankomst förväljs", async () => {
    render(<Skal extra={{ typ: "sammankomst" }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Ny" }));
    await waitFor(() => expect(screen.getByText("typ:sammankomst")).toBeInTheDocument());
  });
  it("utan typ blir det den första, och en okänd typ ger också den första", async () => {
    render(<Skal extra={{ typ: "finnsinte" }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Ny" }));
    await waitFor(() => expect(screen.getByText("typ:uppgift")).toBeInTheDocument());
  });
  it("kastar för typ till en annan nyckel och för typ med id", () => {
    /** @type {any} */ let oppna;
    function Fanga() { oppna = useOppnaSkapa(); return null; }
    render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={{ sparaEtikett: "Spara", lage: "g", kataloger: KATALOGER, handelse: { form: HandelseForm, katalog: "typer" }, grupp: () => null }}>
        <Fanga />
      </OpsAppShell>,
    );
    expect(() => oppna("grupp", { typ: "x" })).toThrow(/typ gäller bara "handelse"/);
    expect(() => oppna("handelse", { id: "h1", typ: "x" })).toThrow(/typ och id/);
  });
});
