import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { OpsPublikHuvud, radKlass, faltKlass } from "../index.js";

/**
 * Kontot i den publika toppraden (0.150.0, #352). Life Hub Identity la förut avataren över ramverkets topprad med CSS
 * (`#account-slot`); nu har raden en plats för den. jsdom kör ingen CSS, så provet bevisar STRUKTUREN: var kontot sitter i
 * trädet, vad det ersätter och att raden utan `konto` är den gamla. Att den ligger rätt i pixlar mäts av `check-brand`.
 */

const TEXTER = { huvudnavigering: "Huvudnavigering", oppnaMeny: "Öppna meny", stangMeny: "Stäng meny", mobilmeny: "Mobilmeny" };
const LOGGA = { src: "/logga.svg", alt: "Exempelhubben" };
const LANKAR = [
  { href: "/a", label: "Alfa" },
  { href: "/b", label: "Beta" },
];
const LOGGA_IN = { href: "/app", label: "Logga in" };
const KOM = { href: "/app", label: "Kom igång" };
const SPRAK = { aktiv: "sv", val: [{ kod: "sv", label: "SV" }, { kod: "en", label: "EN" }], onVal: () => {}, etikett: "Språk" };
const KONTO = (
  <button type="button" aria-label="Konto: Anna Ek">
    AE
  </button>
);

describe("OpsPublikHuvud: konto", () => {
  it("ritar kontot EN gång, i toppraden, i sin egen plats", () => {
    const { container } = render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} loggaIn={LOGGA_IN} kom={KOM} konto={KONTO} texter={TEXTER} />);
    const nav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    expect(screen.getAllByRole("button", { name: "Konto: Anna Ek" })).toHaveLength(1);
    const plats = container.querySelector("[data-publik-konto]");
    expect(plats).not.toBeNull();
    expect(nav.contains(plats)).toBe(true);
    expect(plats.contains(screen.getByRole("button", { name: "Konto: Anna Ek" }))).toBe(true);
  });

  it("ERSÄTTER Logga in och accentknappen: de ritas inte i raden", () => {
    render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} loggaIn={LOGGA_IN} kom={KOM} konto={KONTO} texter={TEXTER} />);
    expect(screen.queryByText("Logga in")).toBeNull();
    expect(screen.queryByText("Kom igång")).toBeNull();
  });

  it("⛔ och inte heller i mobilmenyn: en inloggad erbjuds inte att logga in där", () => {
    render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} loggaIn={LOGGA_IN} kom={KOM} konto={KONTO} texter={TEXTER} />);
    fireEvent.click(screen.getByRole("button", { name: "Öppna meny" }));
    const dialog = screen.getByRole("dialog", { name: "Mobilmeny" });
    expect(within(dialog).getByText("Alfa")).toBeTruthy();
    expect(within(dialog).queryByText("Logga in")).toBeNull();
    expect(within(dialog).queryByText("Kom igång")).toBeNull();
  });

  it("⛔ på mobilen står kontot BREDVID hamburgaren och inte i menyn, och finns kvar medan menyn är öppen", () => {
    const { container } = render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} konto={KONTO} texter={TEXTER} />);
    const hamburgare = screen.getByRole("button", { name: "Öppna meny" });
    const plats = container.querySelector("[data-publik-konto]");
    // Samma kluster, kontot före hamburgaren.
    expect(plats.parentElement).toBe(hamburgare.parentElement);
    expect(plats.compareDocumentPosition(hamburgare) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(hamburgare);
    const dialog = screen.getByRole("dialog", { name: "Mobilmeny" });
    expect(dialog.contains(plats)).toBe(false);
    // Radix döljer resten av sidan för skärmläsare medan menyn är öppen (`hidden: true`), men kontot ritas inte om eller dubbleras.
    expect(container.querySelectorAll("[data-publik-konto]")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Konto: Anna Ek", hidden: true })).toHaveLength(1);
  });

  it("språkvalet står kvar med ett konto, före kontot", () => {
    const { container } = render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} sprak={SPRAK} konto={KONTO} texter={TEXTER} />);
    const grupp = screen.getByRole("group", { name: "Språk" });
    const plats = container.querySelector("[data-publik-konto]");
    expect(grupp.compareDocumentPosition(plats) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("utan konto är huvudet oförändrat: ingen kontoplats, Logga in och accentknappen kvar, samma barn i raden som förut", () => {
    const { container } = render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} loggaIn={LOGGA_IN} kom={KOM} sprak={SPRAK} texter={TEXTER} />);
    expect(container.querySelector("[data-publik-konto]")).toBeNull();
    expect(screen.getAllByText("Logga in").length).toBe(1);
    expect(screen.getAllByText("Kom igång").length).toBe(1);
    // Raden har samma fyra barn som i 0.149.0 (loggan, länkarna, högerdelen, hamburgaren), utan ett extra omslag.
    const rad = container.querySelector("nav > div");
    expect([...rad.children].map((c) => c.tagName)).toEqual(["A", "UL", "DIV", "BUTTON"]);
    expect(rad.children[2].className).toContain("md:flex");
    expect(rad.children[3].className).toContain("md:hidden");
    fireEvent.click(screen.getByRole("button", { name: "Öppna meny" }));
    const dialog = screen.getByRole("dialog", { name: "Mobilmeny" });
    expect(within(dialog).getByText("Logga in")).toBeTruthy();
    expect(within(dialog).getByText("Kom igång")).toBeTruthy();
  });

  it("konto={null} och konto={false} är samma sak som inget konto (appen har inte alltid ett)", () => {
    for (const tomt of [null, false, undefined]) {
      const { container, unmount } = render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} loggaIn={LOGGA_IN} kom={KOM} konto={tomt} texter={TEXTER} />);
      expect(container.querySelector("[data-publik-konto]")).toBeNull();
      expect(screen.getAllByText("Logga in")).toHaveLength(1);
      unmount();
    }
  });
});

describe("hamburgaren ritas bara när menyn har något att visa", () => {
  const hamburgare = () => screen.queryByRole("button", { name: "Öppna meny" });
  it("⛔ ett konto, inga länkar och inget språkval: ingen hamburgare (menyn hade bara haft stängknappen)", () => {
    render(<OpsPublikHuvud logga={LOGGA} lankar={[]} loggaIn={LOGGA_IN} kom={KOM} konto={KONTO} texter={TEXTER} />);
    expect(hamburgare()).toBeNull();
    expect(screen.getAllByRole("button", { name: "Konto: Anna Ek" })).toHaveLength(1);
  });
  it("länkar, ett språkval eller (utan konto) Logga in ger menyn ett innehåll, och då finns hamburgaren", () => {
    const { unmount: a } = render(<OpsPublikHuvud logga={LOGGA} lankar={LANKAR} konto={KONTO} texter={TEXTER} />);
    expect(hamburgare()).not.toBeNull();
    a();
    const { unmount: b } = render(<OpsPublikHuvud logga={LOGGA} lankar={[]} sprak={SPRAK} konto={KONTO} texter={TEXTER} />);
    expect(hamburgare()).not.toBeNull();
    b();
    render(<OpsPublikHuvud logga={LOGGA} lankar={[]} loggaIn={LOGGA_IN} texter={TEXTER} />);
    expect(hamburgare()).not.toBeNull();
  });
  it("utan konto och utan något alls i menyn ritas ingen heller", () => {
    render(<OpsPublikHuvud logga={LOGGA} lankar={[]} texter={TEXTER} />);
    expect(hamburgare()).toBeNull();
  });
});

describe("radKlass och faltKlass är exporterade (regel 2: en app skriver inte av dem för hand)", () => {
  it("är funktioner som ger en klasssträng, och samma som ramverkets egna kontroller använder", () => {
    expect(typeof radKlass).toBe("function");
    expect(typeof faltKlass).toBe("function");
    expect(radKlass()).toContain("rounded-base");
    expect(radKlass({ active: true })).toContain("text-accent");
    expect(faltKlass()).toContain("min-h-11");
    expect(faltKlass({ invalid: true })).toContain("border-danger");
  });
});
