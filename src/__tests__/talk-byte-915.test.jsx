import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";

/*
 * TALK följer en ny igenkänning och uppläsning från appen (0.248.0, cllp/lifehub.app#915).
 *
 * CP 2026-11-20: "är soniox på i en grupp så är den på i alla ... det skall styras en och en." Appen ger en annan igenkänning när
 * personen byter till en grupp som valt en annan röst. Skalet monterar inte om TALK vid ett gruppbyte, och förut lästes pluggarna en
 * gång vid montering, så den första gruppens röst gällde tills sidan laddades om. Tre saker provas, alla genom skalet:
 *   1. en ny igenkänning används i nästa omgång och förbereds när den kommer;
 *   2. en omgång som pågår när bytet sker stoppas av den igenkänning som startade den;
 *   3. en ny uppläsning läser nästa svar.
 */

function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** @param {string} text */
function falskIgenkanning(text) {
  return {
    forbered: vi.fn(),
    starta: vi.fn((/** @type {any} */ o) => o.onText(text)),
    stoppa: vi.fn(() => Promise.resolve(text)),
    kasta: vi.fn(),
  };
}

function falskUpplasning() {
  return { las: vi.fn(() => Promise.resolve()), stoppa: vi.fn(), forbered: vi.fn() };
}

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () => act(async () => {});
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const klar = () => fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));

/** @param {any} talk */
const skal = (talk) => (
  <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={talk}>
    <p>innehåll</p>
  </OpsAppShell>
);

/** @param {{ igenkanning?: any, upplasning?: any, onAgent?: any }} val */
const talk = ({ igenkanning, upplasning, onAgent }) => ({
  onTalk: async () => {},
  onMeddelande: () => {},
  inspelare: falskInspelare(),
  igenkanning,
  ...(upplasning ? { upplasning } : {}),
  ...(onAgent ? { onAgent } : {}),
});

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("en ny igenkänning från appen", () => {
  it("⛔ används i nästa omgång, och förbereds när den kommer", async () => {
    const a = falskIgenkanning("Hej från A");
    const b = falskIgenkanning("Hej från B");
    const t = talk({ igenkanning: a });
    const { rerender } = render(skal(t));
    await flush();
    fireEvent.click(huvudMikrofon());
    await flush();
    klar();
    await flush();
    expect(a.starta).toHaveBeenCalledTimes(1);

    rerender(skal({ ...t, igenkanning: b }));
    await flush();
    expect(b.forbered).toHaveBeenCalled();

    fireEvent.click(huvudMikrofon());
    await flush();
    expect(b.starta).toHaveBeenCalledTimes(1);
    expect(a.starta).toHaveBeenCalledTimes(1);
  });

  it("⛔ en omgång som pågår vid bytet stoppas av den som startade den", async () => {
    const a = falskIgenkanning("Hej från A");
    const b = falskIgenkanning("Hej från B");
    const t = talk({ igenkanning: a });
    const { rerender } = render(skal(t));
    await flush();
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(a.starta).toHaveBeenCalledTimes(1);
    rerender(skal({ ...t, igenkanning: b }));
    await flush();
    klar();
    await flush();
    expect(a.stoppa).toHaveBeenCalledTimes(1);
    expect(b.stoppa).not.toHaveBeenCalled();
  });
});

describe("en ny uppläsning från appen", () => {
  it("⛔ läser nästa svar", async () => {
    const igk = falskIgenkanning("Fråga");
    const u1 = falskUpplasning();
    const u2 = falskUpplasning();
    const onAgent = vi.fn(async () => ({ svar: async () => "Svaret.", vidare: vi.fn() }));
    const t = talk({ igenkanning: igk, upplasning: u1, onAgent });
    const { rerender } = render(skal(t));
    await flush();
    rerender(skal({ ...t, upplasning: u2 }));
    await flush();
    fireEvent.click(huvudMikrofon());
    await flush();
    klar();
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Agent" }));
    await flush();
    await flush();
    expect(onAgent).toHaveBeenCalled();
    expect(u2.las).toHaveBeenCalledWith("Svaret.", expect.anything());
    expect(u1.las).not.toHaveBeenCalled();
  });
});
