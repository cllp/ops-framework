import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpsCalendar } from "../components/OpsCalendar.jsx";

/**
 * Kalendern ritas när webbläsaren blockerar lagring (0.257.0, cllp/lifehub.app#890).
 *
 * ⛔ Att bara LÄSA `window.localStorage` kastar SecurityError i ett blockerat läge (privat läge i vissa webbläsare, en inbäddad vy,
 * eller en sida utan ursprung). `OpsCalendar` läste den utan skydd, och gästens Månad och Vecka visade "Kalendern gick inte att visa"
 * i stället för kalendern. Hittat av check-skalyta, vars sida laddas utan ursprung.
 */

afterEach(() => vi.restoreAllMocks());

describe("kalendern utan lagring", () => {
  it("⛔ ritas när window.localStorage kastar vid läsning", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Access is denied for this document.", "SecurityError");
    });
    render(<OpsCalendar ariaLabel="Kalender" today={new Date(2026, 10, 23, 12)} monthsBack={0} monthsForward={0} entries={[{ id: "a", date: "2026-11-24", title: "Möte" }]} />);
    expect(screen.getByRole("region", { name: "Kalender" })).toBeInTheDocument();
    expect(document.querySelector('[data-cal-day="2026-11-24"]')).not.toBeNull();
  });
});
