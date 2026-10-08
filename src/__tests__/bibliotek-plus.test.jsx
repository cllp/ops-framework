import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";

describe("plusmenyn, spela in idé", () => {
  it("raden startar inspelningen och säger taket", async () => {
    const spelaIn = vi.fn();
    const inspelare = {
      starta: vi.fn(async () => {}),
      stoppa: vi.fn(async () => ({ blob: new Blob(["a"]), mimeType: "audio/webm", sekunder: 1 })),
      kasta: vi.fn(),
      niva: () => 0,
    };
    render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={{ spelaIn, ideInspelare: inspelare }}>
        <p>x</p>
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Spela in idé" }));
    expect(inspelare.starta).toHaveBeenCalled();
    expect(screen.getByText(/Taket är 10 minuter/)).toBeInTheDocument();
  });
});
