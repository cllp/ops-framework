import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { LANGTRYCK_MS } from "../lib/apparark.js";

/**
 * ⛔ HÄNDELSEN (0.234.0, cllp/lifehub.app#842 C). Ett tryck på Verktyg öppnade bara de fästa verktygen, och bara ett långtryck öppnade alla,
 * "och det hittar ingen". Överst i menyn står nu Alla verktyg, en streckad ring med ett plus ("Typ en ring med ett +"), som gör samma sak
 * som långtrycket.
 */

afterEach(() => vi.useRealTimers());

function skal() {
  const onNavigate = vi.fn();
  render(
    <OpsAppShell
      brand="Ops"
      fasta={{ idag: { href: "/idag" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }}
      moduler={[]}
      activeHref="/idag"
      snabbmenyer
      onNavigate={onNavigate}
      apparArk={{
        moduler: [
          { id: "bibliotek", namn: { sv: "Bibliotek", en: "Library" }, hubb: { rutt: "/bibliotek", ikon: null, delar: [] } },
          { id: "meddelanden", namn: { sv: "Meddelanden", en: "Messages" }, hubb: { rutt: "/meddelanden", ikon: null, delar: [] } },
        ],
        grupp: { moduler: ["bibliotek", "meddelanden"], huvudmeny: [] },
        farAndra: false,
      }}
    >
      <p>innehåll</p>
    </OpsAppShell>,
  );
  return { onNavigate, knapp: /** @type {HTMLElement} */ (document.querySelector("[data-ops-appar-knapp]")) };
}

describe("⛔ Alla verktyg överst i Verktyg-menyn", () => {
  it("knappen står först i menyn, som en riktig knapp med namn, och med en streckad ring", async () => {
    const { knapp } = skal();
    fireEvent.click(knapp);
    const dialog = await screen.findByRole("dialog", { name: "Verktyg" });
    const knappar = [...dialog.querySelectorAll("button")];
    expect(knappar[0].getAttribute("aria-label")).toBe("Alla verktyg");
    expect(knappar.map((k) => k.getAttribute("aria-label") ?? k.textContent)).toEqual(["Alla verktyg", "Bibliotek", "Meddelanden"]);
    expect(knappar[0].querySelector(".border-dashed")).not.toBeNull();
    expect(knappar[0].querySelector(".lucide-plus")).not.toBeNull();
  });

  it("ett tryck öppnar alla verktyg, samma väg som långtrycket", async () => {
    const { knapp, onNavigate } = skal();
    fireEvent.click(knapp);
    const dialog = await screen.findByRole("dialog", { name: "Verktyg" });
    fireEvent.click(/** @type {HTMLElement} */ (dialog.querySelector("[data-snabbmeny-alla]")));
    await vi.waitFor(() => expect(onNavigate).toHaveBeenCalledWith("/hub", expect.anything()));
  });

  it("långtrycket på Verktyg går till alla verktyg som förut, utan menyn", () => {
    vi.useFakeTimers();
    const { knapp, onNavigate } = skal();
    act(() => {
      knapp.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 40, clientY: 460, button: 0 }));
    });
    act(() => {
      vi.advanceTimersByTime(LANGTRYCK_MS + 50);
    });
    expect(onNavigate).toHaveBeenCalledWith("/hub", expect.anything());
    expect(screen.queryByRole("dialog", { name: "Verktyg" })).toBeNull();
  });
});
