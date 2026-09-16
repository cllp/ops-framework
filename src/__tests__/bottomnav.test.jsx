import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsBottomNav } from "../components/OpsBottomNav.jsx";
import { OpsAppShell } from "../components/OpsAppShell.jsx";

/** @param {() => void} kor @param {RegExp} meddelande */
function forvantaKrasch(kor, meddelande) {
  const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(kor).toThrow(meddelande);
  } finally {
    tyst.mockRestore();
  }
}

const IKON = <svg data-testid="ikon" aria-hidden="true" />;

/** Sju toppdestinationer, en med undersidor. */
const NAV = [
  { href: "/", label: "Översikt", icon: IKON },
  { href: "/inkomster", label: "Inkomster", icon: IKON, badge: 3 },
  {
    href: "/kostnader",
    label: "Kostnader",
    icon: IKON,
    children: [
      { href: "/kostnader/foretag", label: "Företag" },
      { href: "/kostnader/privat", label: "Privat" },
    ],
  },
  { href: "/tillgangar", label: "Tillgångar", icon: IKON },
  { href: "/pension", label: "Pension", icon: IKON },
  { href: "/schema", label: "Schema", icon: IKON },
  { href: "/kontakter", label: "Kontakter", icon: IKON },
];

/**
 * ⛔ Beteende, inte klassnamn. Att baren faktiskt ligger i botten och respekterar
 * säker yta är byggvaktens och hårdvarans sak; här testar vi vad den gör.
 */
describe("OpsBottomNav", () => {
  it("visar högst fem platser i raden och Meny finns alltid med", () => {
    render(<OpsBottomNav nav={NAV} activeHref="/" />);
    const rad = screen.getByRole("navigation", { name: "Snabbnavigering" });
    // Fyra toppdestinationer som länkar, plus Meny som knapp = fem platser.
    expect(within(rad).getAllByRole("link")).toHaveLength(4);
    expect(within(rad).getByRole("button", { name: "Meny" })).toBeInTheDocument();
  });

  it("har Meny även när destinationerna får plats", () => {
    render(<OpsBottomNav nav={NAV.slice(0, 2)} activeHref="/" />);
    const rad = screen.getByRole("navigation", { name: "Snabbnavigering" });
    expect(within(rad).getByRole("button", { name: "Meny" })).toBeInTheDocument();
  });

  it("lägger femte till sjunde destinationen i sheeten, inte i raden", async () => {
    render(<OpsBottomNav nav={NAV} activeHref="/" />);
    const rad = screen.getByRole("navigation", { name: "Snabbnavigering" });
    // Inte i raden.
    expect(within(rad).queryByRole("link", { name: "Pension" })).toBeNull();
    expect(within(rad).queryByRole("link", { name: "Kontakter" })).toBeNull();
    // Men i sheeten när Meny öppnas.
    await userEvent.click(within(rad).getByRole("button", { name: "Meny" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("link", { name: "Pension" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Schema" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Kontakter" })).toBeInTheDocument();
  });

  it("markerar avsnittet i raden när en undersida är aktiv", () => {
    render(<OpsBottomNav nav={NAV} activeHref="/kostnader/foretag" />);
    const rad = screen.getByRole("navigation", { name: "Snabbnavigering" });
    const kostnader = within(rad).getByRole("link", { name: "Kostnader" });
    expect(kostnader).toHaveAttribute("aria-current", "page");
  });

  it("håller sheeten ur DOM:en tills den öppnas", async () => {
    render(<OpsBottomNav nav={NAV} activeHref="/" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Meny" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("lämnar fokus tillbaka till Meny-knappen när sheeten stängs", async () => {
    render(<OpsBottomNav nav={NAV} activeHref="/" />);
    const meny = screen.getByRole("button", { name: "Meny" });
    await userEvent.click(meny);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(meny).toHaveFocus());
  });

  it("visar badge med både siffra och skärmläsartext", () => {
    render(<OpsBottomNav nav={NAV} activeHref="/" badgeText="olästa" />);
    const rad = screen.getByRole("navigation", { name: "Snabbnavigering" });
    expect(within(rad).getByText("3 olästa")).toBeInTheDocument();
  });

  it("kastar med förklarande text när children har egna children", () => {
    const trasig = [
      {
        href: "/a",
        label: "A",
        children: [{ href: "/a/b", label: "B", children: [{ href: "/a/b/c", label: "C" }] }],
      },
    ];
    forvantaKrasch(() => render(<OpsBottomNav nav={trasig} activeHref="/" />), /EN nivå barn/);
  });
});

describe("OpsAppShell efter mobilomställningen", () => {
  it("renderar ingen push-meny-knapp i headern längre", () => {
    render(
      <OpsAppShell brand="Bolag Ops" nav={NAV} activeHref="/">
        <p>innehåll</p>
      </OpsAppShell>,
    );
    // Den gamla push-menyn styrdes av en knapp i headern med aria-controls /
    // aria-expanded. Den ska vara borta; bottenradens Meny ligger utanför headern.
    const banner = screen.getByRole("banner");
    expect(banner.querySelector("[aria-controls]")).toBeNull();
    expect(banner.querySelector("[aria-expanded]")).toBeNull();
  });

  /**
   * ⛔ Den här är inte en petitess om etiketter, den är hela skälet till att
   * `bottomNavLabel` finns som egen prop.
   *
   * Skalet renderar navigeringen två gånger: toppraden `hidden md:flex` och
   * bottenraden `md:hidden`. I en webbläsare ser användaren bara en av dem, för
   * CSS tar bort den andra ur tillgänglighetsträdet. I ett test finns ingen CSS,
   * så båda ligger kvar. Fick de samma `aria-label` blev varje
   * `getByRole("link", { name: ... })` i en app som bygger på ramverket tvetydig,
   * och felet syntes inte här utan i appens egna tester, som en krasch ingen kunde
   * härleda till ramverket. Det var precis så det upptäcktes.
   *
   * Två namn löser det utan att ljuga för användaren: bottenraden ÄR en
   * snabbnavigering med färre platser, inte en andra huvudnavigering.
   */
  it("ger de två navigeringarna skilda skärmläsarnamn", () => {
    render(
      <OpsAppShell brand="Bolag Ops" nav={NAV} activeHref="/">
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const namn = screen.getAllByRole("navigation").map((n) => n.getAttribute("aria-label"));
    expect(namn).toHaveLength(2);
    expect(new Set(namn).size).toBe(2);
    expect(namn).toContain("Huvudnavigering");
    expect(namn).toContain("Snabbnavigering");
  });

  it("låter appen döpa om bottenraden utan att röra toppraden", () => {
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/" bottomNavLabel="Genvägar">
        <p>x</p>
      </OpsAppShell>,
    );
    expect(screen.getByRole("navigation", { name: "Genvägar" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Huvudnavigering" })).toBeInTheDocument();
  });

  it("kastar när nav har children i children", () => {
    const trasig = [
      { href: "/a", label: "A", children: [{ href: "/a/b", label: "B", children: [{ href: "/x", label: "X" }] }] },
    ];
    forvantaKrasch(
      () =>
        render(
          <OpsAppShell brand="X" nav={trasig} activeHref="/">
            <p>x</p>
          </OpsAppShell>,
        ),
      /EN nivå barn/,
    );
  });
});
