import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OpsProfil } from "../components/OpsProfil.jsx";
import { OpsByLifeHub } from "../components/OpsByLifeHub.jsx";

/*
 * ══ ⛔ KONTOT HAR ETT HEM, LIFE-HUB.APP (CP 2026-11-14, "Ja på alla frågor", cllp/lifehub.identity#178) ══════════════════
 *
 * Hubben visar kontot och ändrar det inte. Profilen i kontoläget är kortet (bild, namn, e-post, roll), språkväxlaren SV/EN,
 * knappen "Ditt Life Hub-konto ↗" med en tonad rad under, en tyst länk "Radera kontot" (Apple 5.1.1(v)) och grupperna under
 * "I den här hubben". Arket "Redigera profil", rullistan för språk, "Nycklar och kopplingar" och sektionen Konto är borta.
 * Ramverket känner aldrig Identitys adresser: appen skickar `kontoUrl` och `raderaKontoUrl`. Varje prov här är rött mot 0.228.0.
 */

const ANV = {
  id: "uid-1",
  namn: "Claes Philip",
  epost: "cp@staiger.se",
  bild: "",
  sprak: "sv",
  tema: /** @type {const} */ ("system"),
  telefon: "",
  stad: "",
  presentation: "",
  lankar: /** @type {{ plattform: string, url: string }[]} */ ([]),
  bildSokvag: "",
};
const KONTO_URL = "https://konto.example/konto?hubb=my";
const RADERA_URL = "https://konto.example/konto?hubb=my#radera-konto";

/** @param {Partial<import("react").ComponentProps<typeof OpsProfil>>} [p] */
function rita(p = {}) {
  const onSpara = vi.fn(async () => {});
  const r = render(
    <OpsProfil
      anvandare={ANV}
      roll="Studio Admin"
      onSpara={onSpara}
      falt={["sprak"]}
      kontoUrl={KONTO_URL}
      raderaKontoUrl={RADERA_URL}
      grupper={[{ grupp: { id: "my", namn: "Mitt projekt" }, roll: "agare" }]}
      {...p}
    />,
  );
  return { ...r, onSpara: /** @type {any} */ (p.onSpara ?? onSpara) };
}

describe("OpsProfil med Life Hub-kontot", () => {
  it("⛔ kortet visar namn, e-post och roll, utan redigering, rullista, nycklar eller säkerhetssektion", () => {
    rita();
    expect(screen.getByText("Claes Philip")).toBeTruthy();
    expect(screen.getByText("cp@staiger.se")).toBeTruthy();
    expect(screen.getByText("Studio Admin")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Redigera profil" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Nycklar och kopplingar")).toBeNull();
    expect(screen.queryByText("Inloggning och säkerhet")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
  });

  it("⛔ växlaren SV/EN byter språk genom samma callback, med bara språket", async () => {
    const { onSpara } = rita();
    const en = screen.getByRole("tab", { name: "EN" });
    expect(screen.getByRole("tab", { name: "SV" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(en);
    await waitFor(() => expect(onSpara).toHaveBeenCalledWith({ sprak: "en" }));
  });

  it("⛔ knappen och raderalänken bär appens adresser, och raden under säger var kontot bor", () => {
    rita();
    const konto = screen.getByRole("link", { name: /Ditt Life Hub-konto/ });
    expect(konto.getAttribute("href")).toBe(KONTO_URL);
    expect(screen.getByRole("link", { name: "Radera kontot" }).getAttribute("href")).toBe(RADERA_URL);
    expect(screen.getByText("Namn, bild, inloggning och kopplingar ändras i ditt Life Hub-konto på konto.example.")).toBeTruthy();
  });

  it("grupperna står under I den här hubben, och märket by Life Hub ritas", () => {
    rita();
    expect(screen.getByText("I den här hubben")).toBeTruthy();
    expect(screen.getByText("Mitt projekt")).toBeTruthy();
    expect(screen.getByText("by Life Hub")).toBeTruthy();
  });

  it("orden följer språket", () => {
    rita({ sprak: "en" });
    expect(screen.getByRole("link", { name: /Your Life Hub account/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Delete account" })).toBeTruthy();
    expect(screen.getByText("In this hub")).toBeTruthy();
  });

  it("⛔ kontoUrl utan raderaKontoUrl kastar (Apple 5.1.1(v)), en adress som inte är https kastar, och den gamla konto-formen kastar med vägen vidare", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => rita({ raderaKontoUrl: undefined })).toThrow(/raderaKontoUrl/);
      expect(() => rita({ kontoUrl: "javascript:alert(1)" })).toThrow(/https/);
      expect(() => render(<OpsProfil anvandare={ANV} onSpara={() => {}} konto={/** @type {any} */ ({ sakerhetHref: "https://x.example" })} />)).toThrow(/kontoUrl/);
    } finally {
      tyst.mockRestore();
    }
  });
});

describe("OpsProfil utan konto (bolag-ops läge): orört", () => {
  // Flyttat ur profil-kompakt-813.test.jsx, som togs bort med läget det provade (arket Redigera profil).
  it("fälten och Spara står direkt på sidan, utan växlare eller kontoknapp", () => {
    render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
    expect(screen.getByRole("button", { name: "Spara" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Presentation" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Färg" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Life Hub-konto/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: "EN" })).toBeNull();
  });
});

describe("OpsByLifeHub", () => {
  it("ritar by Life Hub på båda språken", () => {
    render(<OpsByLifeHub />);
    expect(screen.getByText("by Life Hub")).toBeTruthy();
  });
});
