import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OpsHubTillbaka } from "../components/OpsTillbaka.jsx";
import { OpsHuvudmenyProvider } from "../components/OpsHuvudmeny.jsx";

describe("en fäst modul är inbyggd (0.88.1)", () => {
  it("utan provider ritas länken som förut", () => {
    render(<OpsHubTillbaka hubHref="/hub" etikett="Bibliotek" modul="bibliotek" rubrik />);
    expect(screen.getByRole("link", { name: /Tillbaka till/ })).toBeTruthy();
  });

  it("⛔ en fäst modul har ingen länk men behåller rubriken", () => {
    render(
      <OpsHuvudmenyProvider moduler={["bibliotek"]}>
        <OpsHubTillbaka hubHref="/hub" etikett="Bibliotek" modul="bibliotek" rubrik />
      </OpsHuvudmenyProvider>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("heading", { name: "Bibliotek" })).toBeTruthy();
  });

  it("en fäst modul utan rubrik ritar ingenting", () => {
    const { container } = render(
      <OpsHuvudmenyProvider moduler={["meddelanden"]}>
        <OpsHubTillbaka hubHref="/hub" etikett="Meddelanden" modul="meddelanden" />
      </OpsHuvudmenyProvider>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("en modul som inte är fäst har kvar länken", () => {
    render(
      <OpsHuvudmenyProvider moduler={["meddelanden"]}>
        <OpsHubTillbaka hubHref="/hub" etikett="Ekonomi" modul="ekonomi" rubrik />
      </OpsHuvudmenyProvider>,
    );
    expect(screen.getByRole("link", { name: /Tillbaka till/ })).toBeTruthy();
  });

  it("utan modul-id ritas länken även i en provider", () => {
    render(
      <OpsHuvudmenyProvider moduler={["ekonomi"]}>
        <OpsHubTillbaka hubHref="/hub" etikett="Sida" />
      </OpsHuvudmenyProvider>,
    );
    expect(screen.getByRole("link")).toBeTruthy();
  });
});
