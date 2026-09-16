import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  /**
   * ⛔ Testet kollade tidigare att headern inte hade NÅGOT med aria-expanded.
   *
   * Den proxyn slutade gälla när toppraden fick sin egen "Mer"-meny, som med
   * rätta är expanderbar. Avsikten var aldrig "ingen expanderbar kontroll", den
   * var "ingen andra MOBIL meny i headern": den gamla push-menyn renderade hela
   * navigeringen en gång till, `md:hidden`, parallellt med bottenraden.
   *
   * Ett test som mäter en proxy i stället för avsikten blir antingen falskt rött
   * vid en riktig förbättring, eller falskt grönt när avsikten bryts på ett nytt
   * sätt. Här mäts avsikten: headern bär exakt en navigering.
   */
  it("har ingen andra mobil meny i headern", () => {
    render(
      <OpsAppShell brand="Bolag Ops" nav={NAV} activeHref="/">
        <p>innehåll</p>
      </OpsAppShell>,
    );
    const banner = screen.getByRole("banner");
    expect(banner.querySelectorAll("nav")).toHaveLength(1);
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

  /**
   * ⛔ Tretton platta textlänkar får inte plats på någon skärm.
   *
   * Mätt i bolag-ops: de klämdes ihop tills de sista hamnade UNDER temaväxlaren
   * och två försvann helt ur bild. Rapporten löd "menyn är enorm, man vet inte
   * var man är", och det var två fel i ett: för många poster, och en aktiv
   * markering som såg ut som en knapp i stället för en position.
   */
  it("visar bara de första i toppraden och lägger resten under Mer", async () => {
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    // Fem destinationer får plats som standard; sjunde och sjätte hamnar i menyn.
    expect(within(toppnav).getAllByRole("link")).toHaveLength(5);
    expect(within(toppnav).queryByRole("link", { name: "Kontakter" })).toBeNull();

    // ⛔ fireEvent och inte userEvent, och den första förklaringen till det var
    // fel. Här stod att userEvent:s pekarsimulering hängde. Ommätt: kostnaden
    // ligger i Radix Popover självt i jsdom. En naken Popover som öppnas en gång,
    // utan userEvent och utan den här komponenten, tar cirka 20 s filtid, och
    // profileringen visar att det varken är klicket (96 ms) eller sökningen i
    // DOM:en (1-3 ms) utan väntan efteråt.
    //
    // Skillnaden spelar roll: hade jag trott på den gamla texten hade nästa
    // steg varit att byta frågeverktyg igen, vilket inte hade ändrat någonting.
    // fireEvent är ändå rätt val, men för att det testar rätt sak, inte för att
    // det är snabbare.
    fireEvent.click(within(toppnav).getByRole("button", { name: /^Mer/ }));
    const meny = await screen.findByRole("navigation", { name: "Mer" });
    expect(within(meny).getByRole("link", { name: "Schema" })).toBeInTheDocument();
    expect(within(meny).getByRole("link", { name: "Kontakter" })).toBeInTheDocument();
  });

  it("lägger posterna mellan de två taken både i raden och i menyn", async () => {
    // ⛔ DUBBLETTEN ÄR AVSIKTEN, INTE ETT MISSTAG.
    //
    // Mellan 768 och 1024 får bara tre plats i raden, från 1024 fem. Posterna
    // däremellan renderas på båda ställena och CSS döljer den ena. `display:
    // none` tar bort den ur uppläsningen också, så ingen möter dem två gånger.
    //
    // ⛔ Det här testet kan inte SE det, och det ska stå här: jsdom kör ingen
    // CSS, så `hidden lg:inline-flex` är osynligt. Att raden inte spiller över
    // mäts i Chromium av `matVyport`, och det var den mätningen som hittade
    // felet. Det här bevakar bara att markupen finns kvar på båda ställena,
    // alltså att ingen "städar bort dubbletten" i tron att den är ett slarv.
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    const iRaden = within(toppnav).getByRole("link", { name: "Tillgångar" });
    expect(iRaden.className).toContain("lg:inline-flex");

    fireEvent.click(within(toppnav).getByRole("button", { name: /^Mer/ }));
    const meny = await screen.findByRole("navigation", { name: "Mer" });
    expect(within(meny).getByRole("link", { name: "Tillgångar" }).className).toContain("lg:hidden");
  });

  it("låter appen bestämma hur många som får plats", () => {
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/" maxTopNav={2}>
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    expect(within(toppnav).getAllByRole("link")).toHaveLength(2);
  });

  it("visar ingen Mer-knapp när allt får plats", () => {
    render(
      <OpsAppShell brand="X" nav={NAV.slice(0, 3)} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    expect(within(toppnav).queryByRole("button", { name: /^Mer/ })).toBeNull();
  });

  /**
   * Står man på en sida som ligger i menyn ska raden ändå säga var man är.
   * Annars ser det ut som att ingen destination är vald.
   */
  it("markerar Mer när den aktiva sidan ligger i menyn", () => {
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/kontakter">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    const mer = within(toppnav).getByRole("button", { name: /^Mer/ });
    expect(mer.className).toContain("border-ink");
  });

  /**
   * ⛔ Nav-kontraktet har haft ett `icon`-fält hela tiden, och toppraden slängde
   * det. Bara bottenraden ritade ikoner. Följden var en app helt utan ikonspråk
   * på skrivbordet, vilket rapporterades som "finns inga ikoner?".
   */
  /**
   * ⛔ DET HÄR TESTET SADE TIDIGARE MOTSATSEN, och det är själva poängen med
   * att det står kvar.
   *
   * Det hette "renderar ikonen i toppraden, inte bara i bottenraden" och
   * krävde fem ikoner i raden. Det skrevs efter rapporten "finns inga ikoner?",
   * som gällde att ikonfältet slängdes överallt, och jag drog slutsatsen till
   * toppraden utan att läsa förlagan.
   *
   * SessionStudios header renderar bara etiketten. Testet kodifierade alltså en
   * glidning bort från paritet, och ett grönt test gjorde den svårare att se,
   * inte lättare: den som ändrar tillbaka möts av ett rött test och tror att
   * hen har fel.
   *
   * Ikonerna finns kvar i kontraktet och ritas i bottenraden och i Mer-menyn.
   */
  it("renderar INGEN ikon i toppraden, som SessionStudio", () => {
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    expect(within(toppnav).queryAllByTestId("ikon")).toHaveLength(0);

    // Bottenraden ritar dem fortfarande: fyra destinationer plus Meny.
    const bottennav = screen.getByRole("navigation", { name: "Snabbnavigering" });
    expect(within(bottennav).getAllByTestId("ikon").length).toBeGreaterThan(0);
  });

  it("visar räknaren på fliken och kapar den vid 9+", async () => {
    // ⛔ Avläst ur SessionStudio: `{n.badge > 9 ? "9+" : n.badge}`. En
    // tvåsiffrig räknare spränger cirkeln, och exakt antal är inte det fliken
    // svarar på.
    const medRaknare = NAV.map((p, i) => (i === 1 ? { ...p, badge: 12 } : p));
    render(
      <OpsAppShell brand="X" nav={medRaknare} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    expect(within(toppnav).getAllByText("9+").length).toBeGreaterThan(0);
    // Siffran ensam säger inget uppläst, så ordet följer med.
    expect(within(toppnav).getAllByText(/12 nya/).length).toBeGreaterThan(0);
  });
});
