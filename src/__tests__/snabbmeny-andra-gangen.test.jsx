import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { OpsSnabbmeny } from "../components/OpsSnabbmeny.jsx";

/**
 * ⛔ CP 2026-11-05 07:33, life-hub.app v1.0.1117 i telefonen: plus öppnade snabbmenyn, och andra gången gick den inte att
 * stänga. Appen fick stängas. Orsaken: `orsak` stod kvar på "bak" efter första stängningen, och `onOpenChange` hoppar över
 * "bak". Tryck utanför (och krysset, som Radix räknar som utanför) gjorde då ingenting.
 */
afterEach(cleanup);

function Meny({ onValj = vi.fn() }) {
  const [oppen, setOppen] = useState(false);
  return (
    <>
      <button type="button" data-ops-skapa-knapp="" onClick={() => setOppen(true)}>
        Plus
      </button>
      <OpsSnabbmeny
        oppen={oppen}
        onOppen={setOppen}
        variant="skapa"
        etikett="Skapa"
        ankare="[data-ops-skapa-knapp]"
        poster={[{ id: "handelse", etikett: "Ny händelse", ikon: "nyHandelse", onValj }]}
      />
    </>
  );
}

describe("snabbmenyn går att stänga också andra gången", () => {
  it("Escape stänger, gång på gång", async () => {
    render(<Meny />);
    for (let gang = 1; gang <= 3; gang++) {
      fireEvent.click(screen.getByRole("button", { name: "Plus" }));
      await screen.findByRole("dialog", { name: "Skapa" });
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Skapa" }), `gång ${gang}`).toBeNull());
    }
  });

  it("ett val efter en stängning med bakåt stänger och kör valet", async () => {
    const onValj = vi.fn();
    render(<Meny onValj={onValj} />);
    fireEvent.click(screen.getByRole("button", { name: "Plus" }));
    await screen.findByRole("dialog", { name: "Skapa" });
    window.history.back();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Plus" }));
    await screen.findByRole("dialog", { name: "Skapa" });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Plus" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ny händelse" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull());
    await waitFor(() => expect(onValj).toHaveBeenCalledTimes(1));
  });
});
