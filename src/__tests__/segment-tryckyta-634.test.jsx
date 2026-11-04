import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { List, Columns3 } from "lucide-react";

import { OpsSegmented } from "../components/OpsSegmented.jsx";

/**
 * ⛔ SEGMENTEN ÄR 44 PX PÅ TELEFON (lifehub.app#634, 2026-11-04). jsdom kör ingen CSS, så det här provet mäter klasserna och inte pixlarna: storleken mäts på riktigt
 * av appens `check:layout` i Playwright, där fynden för tryckytan gick från 21 till 14 med ändringen. Provet finns för att en ändring av klasserna inte ska ta tillbaka
 * 36 px på telefon utan att någon ser det: rött mot 0.182.1, där segmentet bara hade `min-h-9`.
 */
afterEach(cleanup);

describe("OpsSegmented: tryckytan på telefon", () => {
  it("⛔ ett segment med ord är minst 44 px högt under md, och 36 px från md", () => {
    render(<OpsSegmented ariaLabel="Visa" value="a" onChange={() => {}} options={[{ value: "a", label: "Alla" }, { value: "b", label: "Öppna" }]} />);
    const knapp = screen.getByRole("tab", { name: "Alla" });
    expect(knapp.className.split(/\s+/)).toEqual(expect.arrayContaining(["min-h-11", "md:min-h-9"]));
    expect(knapp.className.split(/\s+/)).not.toContain("min-h-9");
  });

  it("⛔ ett ikonsegment är minst 44 x 44 px under md", () => {
    render(
      <OpsSegmented
        ariaLabel="Vy"
        value="lista"
        onChange={() => {}}
        options={[
          { value: "lista", label: "Lista", icon: <List size={16} /> },
          { value: "tavla", label: "Tavla", icon: <Columns3 size={16} /> },
        ]}
      />,
    );
    const klasser = screen.getByRole("tab", { name: "Tavla" }).className.split(/\s+/);
    expect(klasser).toEqual(expect.arrayContaining(["min-h-11", "min-w-11", "md:min-h-9", "md:min-w-9"]));
  });
});
