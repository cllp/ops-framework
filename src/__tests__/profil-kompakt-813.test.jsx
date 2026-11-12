import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsProfil } from "../components/OpsProfil.jsx";

/*
 * ══ ⛔ cllp/lifehub.app#813: KONTOLÄGET ÄR EN KORT SIDA OCH ETT ARK FÖR ATT REDIGERA ══════════════════════════════════
 *
 * CP 2026-11-12 om profilen i lifehub.app: "Det ser rörigt ut. Massa saker som syns. Not clean." Kulörerna, reglaget,
 * ikonsökningen, Presentation och Spara stod framme på en gång. Varje prov här är rött mot profilen före #813 (allt på sidan,
 * ingen "Redigera profil", språket med Spara) och grönt efter. Det sista provet vaktar att bolag-ops läge (utan `konto`) är orört.
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
  presentation: "Spelar bas.",
  lankar: /** @type {{ plattform: string, url: string }[]} */ ([]),
  bildSokvag: "",
};
const FALT = /** @type {const} */ (["namn", "telefon", "stad", "presentation", "ikon", "farg", "sprak", "utanBild"]);
const KONTO = { sakerhetHref: "https://konto.example/profile?hubb=my", raderaHref: "https://konto.example/profile?hubb=my#radera-konto" };

/** @param {Partial<import("react").ComponentProps<typeof OpsProfil>>} [p] */
function rita(p = {}) {
  const onSpara = vi.fn(async () => {});
  render(
    <OpsProfil
      anvandare={ANV}
      onSpara={onSpara}
      falt={FALT}
      konto={KONTO}
      grupper={[{ grupp: { id: "my", namn: "Mitt projekt" }, roll: "agare" }]}
      {...p}
    />,
  );
  return { onSpara: /** @type {any} */ (p.onSpara ?? onSpara) };
}

const oppna = () => fireEvent.click(screen.getByRole("button", { name: "Redigera profil" }));
const presentationen = () => /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Presentation" }));

describe("OpsProfil i kontoläget: den korta sidan (#813)", () => {
  it("⛔ sidan visar personen, Redigera profil, Språk, grupperna, säkerheten och Radera som länk, men inga val, fält eller Spara", () => {
    rita({ roll: "Studio Admin" });
    expect(screen.getByText("Claes Philip")).toBeTruthy();
    expect(screen.getByText("cp@staiger.se")).toBeTruthy();
    expect(screen.getByText("Studio Admin")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Redigera profil" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Språk" })).toBeTruthy();
    expect(screen.getByText("Mina grupper")).toBeTruthy();
    expect(screen.getByText("Mitt projekt")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inloggning och säkerhet" }).getAttribute("href")).toBe(KONTO.sakerhetHref);
    const radera = screen.getByRole("link", { name: "Radera kontot" });
    expect(radera.getAttribute("href")).toBe(KONTO.raderaHref);
    // Under Konto-kortet, inte inuti det.
    expect(radera.closest("[data-profilkonto]")).toBeNull();
    expect(screen.queryByRole("group", { name: "Färg" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Namn" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Presentation" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("⛔ Nycklar och kopplingar finns som länk bara när appen ger adressen", () => {
    const { unmount } = render(<OpsProfil anvandare={ANV} onSpara={() => {}} falt={FALT} konto={{ ...KONTO, nycklarHref: "/installningar/nycklar" }} />);
    expect(screen.getByRole("link", { name: /^Nycklar och kopplingar/ }).getAttribute("href")).toBe("/installningar/nycklar");
    expect(screen.getByText("Anslutningar, AI-nycklar och API-nycklar.")).toBeTruthy();
    unmount();
    rita();
    expect(screen.queryByRole("link", { name: /Nycklar och kopplingar/ })).toBeNull();
    expect(screen.queryByText("Nycklar och kopplingar")).toBeNull();
  });

  it("⛔ språket sparas direkt med bara språket, utan Spara", async () => {
    const { onSpara } = rita();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Språk" }));
    await user.click(screen.getByRole("option", { name: "Engelska" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(1));
    expect(onSpara).toHaveBeenCalledWith({ sprak: "en" });
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
  });

  it("⛔ ett nej på språkbytet sägs, och väljaren visar det som är sparat", async () => {
    const onSpara = vi.fn(async () => {
      throw new Error("tak");
    });
    rita({ onSpara, sparaFelText: "Vänta en minut." });
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Språk" }));
    await user.click(screen.getByRole("option", { name: "Engelska" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Vänta en minut.");
    expect(screen.getByRole("combobox", { name: "Språk" }).textContent).toContain("Svenska");
  });
});

describe("OpsProfil i kontoläget: arket Redigera profil (#813)", () => {
  it("⛔ arket bär valen, fälten och Spara, och Spara skickar ändringen och stänger arket", async () => {
    const { onSpara } = rita();
    oppna();
    const ark = screen.getByRole("dialog", { name: "Redigera profil" });
    expect(within(ark).getByRole("group", { name: "Färg" })).toBeTruthy();
    expect(within(ark).getByRole("textbox", { name: "Namn" })).toBeTruthy();
    expect(within(ark).getByText("Det du ändrar här gäller i alla dina hubbar.")).toBeTruthy();
    const spara = within(ark).getByRole("button", { name: "Spara" });
    expect(spara.hasAttribute("disabled")).toBe(true);
    fireEvent.change(presentationen(), { target: { value: "Spelar bas och sjunger." } });
    fireEvent.click(within(ark).getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledWith({ presentation: "Spelar bas och sjunger." }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("⛔ ett nej håller arket öppet, med felet och det som skrevs", async () => {
    const onSpara = vi.fn(async () => {
      throw new Error("nej");
    });
    rita({ onSpara, sparaFelText: "Profilen sparades inte." });
    oppna();
    fireEvent.change(presentationen(), { target: { value: "Ny text" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Profilen sparades inte.");
    expect(screen.getByRole("dialog", { name: "Redigera profil" })).toBeTruthy();
    expect(presentationen().value).toBe("Ny text");
  });

  it("⛔ Avbryt slänger utkastet utan att spara: arket öppnas igen med det sparade värdet", () => {
    const { onSpara } = rita();
    oppna();
    fireEvent.change(presentationen(), { target: { value: "Ångrat" } });
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    oppna();
    expect(presentationen().value).toBe("Spelar bas.");
    expect(screen.getByRole("button", { name: "Spara" }).hasAttribute("disabled")).toBe(true);
    expect(onSpara).not.toHaveBeenCalled();
  });

  it("orden följer språket: Edit profile och Cancel", () => {
    rita({ sprak: "en" });
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});

describe("OpsProfil utan konto (bolag-ops läge): orört av #813", () => {
  it("fälten och Spara står direkt på sidan, utan Redigera profil", () => {
    render(<OpsProfil anvandare={ANV} onSpara={() => {}} />);
    expect(screen.getByRole("button", { name: "Spara" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Presentation" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Färg" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Redigera profil" })).toBeNull();
  });
});
