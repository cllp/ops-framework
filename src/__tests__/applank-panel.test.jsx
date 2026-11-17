import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsMarkdown } from "../components/OpsMarkdown.jsx";

/**
 * ⛔ EN LÄNK TILL APPEN I EN ÖPPEN PANEL STÄNGER PANELEN (granskningen av 0.234.0). Kontexten fick `onNavigate` rakt av, så en länk i
 * skapa-panelen eller en händelses beskrivning navigerade bakom panelen: appen bytte sida, panelen låg kvar ovanpå och det såg ut som att
 * ingenting hände. Kontexten får nu skalets `onActivate`, samma väg som en flik.
 */

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () => act(async () => {});
const inspelare = () => ({
  starta: vi.fn(() => Promise.resolve()),
  stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 1 })),
  kasta: vi.fn(),
  niva: () => 0.5,
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("länk i appen inne i en panel", () => {
  it("⛔ navigerar och stänger skapa-panelen", async () => {
    const onNavigate = vi.fn();
    render(
      <OpsAppShell
        brand="Ops"
        fasta={fasta}
        moduler={[]}
        activeHref="/kalender"
        onNavigate={onNavigate}
        talk={{ onTalk: vi.fn(), inspelare: inspelare() }}
        skapa={{ arende: <OpsMarkdown text="[Till hubben](/hub)" /> }}
        flytandeSkapa={["/kalender"]}
      >
        <p>innehåll</p>
      </OpsAppShell>,
    );
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector("[data-ops-flytande-skapa]")));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Nytt ärende" }));
    act(() => vi.advanceTimersByTime(10));
    await flush();
    const lank = screen.getByRole("link", { name: "Till hubben" });
    fireEvent.click(lank);
    await flush();
    act(() => vi.advanceTimersByTime(500));
    await flush();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toBe("/hub");
    expect(screen.queryByRole("link", { name: "Till hubben" })).toBeNull();
  });
});
