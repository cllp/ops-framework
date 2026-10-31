import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OpsAtgardsblad } from "../components/OpsAtgardsblad.jsx";

/**
 * ⛔ (lifehub.app#569) MENYN ÄR ALDRIG HÖGRE ÄN UTRYMMET. I 1280x533 eller med 150 % zoom hamnade Arkivera och Radera under
 * skärmkanten och gick inte att rulla fram. Rutan får Radix höjd för utrymmet som finns och rullar själv.
 */
afterEach(cleanup);

describe("#569 menyns höjd", () => {
  it("rutan begränsas till utrymmet och rullar", () => {
    render(
      <OpsAtgardsblad namn="Tankning" poster={[{ id: "a", etikett: "Arkivera", onValj: () => {} }, { id: "r", etikett: "Radera", onValj: () => {} }]}>
        <button type="button">Tankning</button>
      </OpsAtgardsblad>,
    );
    const knapp = document.querySelector("[aria-haspopup]") ?? screen.getAllByRole("button").at(-1);
    fireEvent.click(/** @type {Element} */ (knapp));
    const ruta = /** @type {HTMLElement} */ (screen.getByText("Radera").closest("[data-radix-popper-content-wrapper] > *"));
    expect(ruta.className).toContain("max-h-(--radix-popover-content-available-height)");
    expect(ruta.className).toContain("overflow-y-auto");
  });
});
