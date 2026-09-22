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

  it("upprepar inte en bar-post (eller dess barn) i Mer", async () => {
    // ⛔ Kostnader syns i bottenraden. Mer = samma överlopp som header-hamburgaren,
    // inte föräldern och inte barn-lyft. Undersidor nås via avsnittet i baren.
    render(<OpsBottomNav nav={NAV} activeHref="/" />);
    const rad = screen.getByRole("navigation", { name: "Snabbnavigering" });
    expect(within(rad).getByRole("link", { name: "Kostnader" })).toBeInTheDocument();
    await userEvent.click(within(rad).getByRole("button", { name: "Meny" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).queryByRole("link", { name: "Kostnader" })).toBeNull();
    expect(within(sheet).queryByRole("link", { name: "Företag" })).toBeNull();
    expect(within(sheet).queryByRole("link", { name: "Privat" })).toBeNull();
  });

  it("använder moreNav från skalet så botten-Mer = header-Mer", async () => {
    const more = [
      { href: "/schema", label: "Schema", icon: IKON },
      { href: "/kontakter", label: "Kontakter", icon: IKON },
    ];
    render(<OpsBottomNav nav={NAV} moreNav={more} activeHref="/" />);
    await userEvent.click(screen.getByRole("button", { name: "Meny" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("link", { name: "Schema" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Kontakter" })).toBeInTheDocument();
    // Inte hela överloppet från nav — moreNav styr.
    expect(within(sheet).queryByRole("link", { name: "Pension" })).toBeNull();
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
    const name = screen.getAllByRole("navigation").map((n) => n.getAttribute("aria-label"));
    expect(name).toHaveLength(2);
    expect(new Set(name).size).toBe(2);
    expect(name).toContain("Huvudnavigering");
    expect(name).toContain("Snabbnavigering");
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
  it("visar bara de första i toppraden och lägger resten i hamburgarmenyn", async () => {
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    /*
     * ⛔ FEM DESTINATIONER ÄR FEM LÄNKAR, plus en knapp för chevronen på den
     * post som har barn. Siffran fem är kravet; knappen är en följd av att
     * etiketten och chevronen är två kontroller som gör var sin sak.
     */
    expect(within(toppnav).getAllByRole("link")).toHaveLength(5);
    expect(within(toppnav).getAllByRole("button")).toHaveLength(1);
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
    fireEvent.click(screen.getByRole("button", { name: /fler destinationer/ }));
    const meny = await screen.findByRole("navigation", { name: "Meny" });
    expect(within(meny).getByRole("link", { name: "Schema" })).toBeInTheDocument();
    expect(within(meny).getByRole("link", { name: "Kontakter" })).toBeInTheDocument();
  });

  it("öppnar en riktig meny på posten med barn, i stället för att bara rita en pil", async () => {
    /*
     * ⛔ CP 2026-09-22: "Ekonomi är ingen dropdown. Sublänkar saknas."
     *
     * Toppraden ritade en chevron så fort en post hade `children`, men posten
     * var en naken `<a href>`: ett tryck gick till föräldersidan och menyn fanns
     * inte. Barnen ritades bara i MOBILENS Mer-ark, så på en dator gick de bara
     * att nå genom att först besöka föräldersidan och trycka på ett kort.
     *
     * ⛔ PROVET KRÄVER ATT BARNEN INTE SYNS FÖRRÄN MAN TRYCKER. Ett prov som
     * bara letade efter dem efteråt hade varit grönt även med fem länkar
     * permanent utlagda i raden, alltså med en rad som inte får plats.
     */
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });

    /*
     * ⛔ SÖKT PÅ HELA SIDAN OCH INTE INUTI `<nav>`, och den skillnaden är hela
     * provets värde. Radix portalerar menyn till `body`, alltså UTANFÖR navet.
     * Första versionen frågade `within(toppnav)` och var därför grön även med
     * menyn tvångsöppnad: den letade på ett ställe där svaret aldrig kunde
     * finnas. Mutationen "öppen från start" avslöjade det.
     */
    expect(screen.queryByRole("link", { name: "Företag" })).toBeNull();

    fireEvent.click(within(toppnav).getByRole("button", { name: /Kostnader/ }));
    expect(await screen.findByRole("link", { name: "Företag" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privat" })).toBeInTheDocument();
  });

  it("säger ordet en gång: etiketten är länken, chevronen är knappen", async () => {
    /*
     * ⛔ CP 2026-09-22, med bild: "Men varför står Ekonomi två gånger?"
     *
     * Första versionen lade föräldern som FÖRSTA RAD i menyn, så att sidan
     * skulle gå att nå från raden. Priset blev ordet två gånger med tjugo
     * pixlar emellan, alltså exakt den dubblett som Fråga och Översikt-kortet
     * fick stryka på foten för samma kväll.
     *
     * ⛔ PROVET HAR TVÅ HALVOR. Att dubbletten är borta går att uppfylla genom
     * att göra föräldersidan onåbar. Andra halvan kräver att etiketten fortsatt
     * LÄNKAR dit, vilket är hela skälet att den inte bara blev en knapp.
     */
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });

    expect(within(toppnav).getByRole("link", { name: "Kostnader" })).toHaveAttribute("href", "/kostnader");

    fireEvent.click(within(toppnav).getByRole("button", { name: /Kostnader/ }));
    await screen.findByRole("link", { name: "Företag" });

    /*
     * ⛔ RÄKNAT I HELA HEADERN OCH INTE `within(toppnav)`, och det är andra
     * gången samma fälla slår till i kväll: Radix portalerar menyn till `body`,
     * alltså UTANFÖR navet. En fråga inom navet kan därför aldrig se menyns
     * rader, och första versionen av det här provet var grönt även med
     * föräldern återinsatt som menyns första rad, alltså med precis det fel CP
     * rapporterade.
     *
     * ⛔ HEADERN OCH INTE `screen`, för "Kostnader" står också i mobilens
     * bottenrad, som renderas samtidigt i jsdom.
     */
    const iHeadern = document.querySelectorAll('header a[href="/kostnader"], [data-radix-popper-content-wrapper] a[href="/kostnader"]');
    expect(iHeadern).toHaveLength(1);
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

    fireEvent.click(screen.getByRole("button", { name: /fler destinationer/ }));
    const meny = await screen.findByRole("navigation", { name: "Meny" });
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

  it("visar ingen hamburgare när allt får plats", () => {
    render(
      <OpsAppShell brand="X" nav={NAV.slice(0, 3)} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    expect(screen.queryByRole("button", { name: /fler destinationer/ })).toBeNull();
  });

  it("visar hamburgare för menuExtras även när nav ryms", () => {
    // ⛔ Öppnar inte popovern: Radix Popover tar ~20 s i jsdom (se testet ovan).
    // Här räcker att knappen finns med rätt aria när bara extras kräver Mer.
    render(
      <OpsAppShell
        brand="X"
        nav={NAV.slice(0, 3)}
        activeHref="/"
        menuExtras={<button type="button">Utseende</button>}
      >
        <p>x</p>
      </OpsAppShell>,
    );
    expect(screen.getByRole("button", { name: /fler åtgärder/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fler destinationer/ })).toBeNull();
  });

  it("skickar menuExtras till botten-Mer och fyller luckan när smaltTak > barens tak", async () => {
    // Header visar 4, bottenrad med primaryAction visar 3. Index 3 (Fråga) måste
    // finnas i sheeten. Botten-Dialog är snabbare än header-Popover i jsdom.
    const lang = [
      { href: "/", label: "Idag", icon: IKON },
      { href: "/oversikt", label: "Översikt", icon: IKON },
      { href: "/ekonomi", label: "Ekonomi", icon: IKON },
      { href: "/fraga", label: "Fråga", icon: IKON },
      { href: "/schema", label: "Schema", icon: IKON },
    ];
    render(
      <OpsAppShell
        brand="X"
        nav={lang}
        activeHref="/"
        maxTopNav={4}
        maxTopNavSmal={4}
        primaryAction={{ label: "Nytt", onClick: () => {} }}
        menuExtras={<button type="button">Utseende</button>}
      >
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    expect(within(toppnav).getByRole("link", { name: "Fråga" })).toBeInTheDocument();

    const botten = screen.getByRole("navigation", { name: "Snabbnavigering" });
    fireEvent.click(within(botten).getByRole("button", { name: "Meny" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("link", { name: "Fråga" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Schema" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Utseende" })).toBeInTheDocument();
  });

  it("använder två header-kolumner under md så actions inte landar i mitten", () => {
    // ⛔ När nav är display:none försvinner den ur griden. Tre kolumner
    // (`1fr auto 1fr`) placerade då actions i mitten-auto. Kontraktet är
    // `1fr auto` under md, tre kolumner från md.
    const { container } = render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const rad = container.querySelector("header > div");
    expect(rad?.className).toMatch(/grid-cols-\[1fr_auto\]/);
    expect(rad?.className).toMatch(/md:grid-cols-\[1fr_auto_1fr\]/);
  });

  it("döljer header-hamburgaren under md utan inline-flex-krock", () => {
    // ⛔ Bar `inline-flex` + `hidden` = synlig på mobil (Tailwind-ordning).
    // Knappen får bara `hidden md:inline-flex` som display.
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    const meny = screen.getByRole("button", { name: /fler destinationer/ });
    expect(meny.className).toMatch(/\bhidden\b/);
    expect(meny.className).toMatch(/md:inline-flex/);
    // Ingen fristående inline-flex som krockar med hidden under md.
    expect(meny.className.split(/\s+/).filter((c) => c === "inline-flex")).toHaveLength(0);
  });

  /**
   * Står man på en sida som ligger i menyn ska raden ändå säga var man är.
   * Annars ser det ut som att ingen destination är vald.
   */
  it("markerar hamburgaren när den aktiva sidan ligger i menyn", () => {
    render(
      <OpsAppShell brand="X" nav={NAV} activeHref="/kontakter">
        <p>x</p>
      </OpsAppShell>,
    );
    const toppnav = screen.getByRole("navigation", { name: "Huvudnavigering" });
    const meny = screen.getByRole("button", { name: /fler destinationer/ });
    expect(meny.className).toContain("text-ink");
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
   * Ikonerna finns kvar i kontraktet och ritas i bottenraden och i hamburgarmenyn.
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

describe("OpsBottomNav, huvudåtgärden", () => {
  const nav = [
    { href: "/", label: "Idag", icon: <span>i</span> },
    { href: "/oversikt", label: "Översikt", icon: <span>o</span> },
    { href: "/ekonomi", label: "Ekonomi", icon: <span>e</span> },
    { href: "/schema", label: "Schema", icon: <span>s</span> },
    { href: "/sok", label: "Sök", icon: <span>k</span> },
  ];

  it("ritar en knapp som går att trycka på, med ett namn", () => {
    // ⛔ Namnet ligger i aria-label och aldrig som synlig etikett: en knapp på
    // 56 px rymmer inget ord, och ett avhugget ord under den ser ut som ett fel.
    const onClick = vi.fn();
    render(<OpsBottomNav nav={nav} activeHref="/" primaryAction={{ label: "Nytt ärende", onClick }} />);

    const knapp = screen.getByRole("button", { name: "Nytt ärende" });
    fireEvent.click(knapp);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ger plats åt knappen genom att flytta en flik till menyn", () => {
    // ⛔ MÄTT, och det är ingen besparing att göra på: raden är 390 px. Fyra
    // flikar plus Meny plus en knapp på 56 px ger sex platser, alltså 56 px var
    // med noll luft och avhuggna etiketter.
    const { rerender } = render(<OpsBottomNav nav={nav} activeHref="/" navLabel="Bottenrad" />);
    const rad = () => screen.getByRole("navigation", { name: "Bottenrad" });
    expect(within(rad()).getAllByRole("link")).toHaveLength(4);

    rerender(<OpsBottomNav nav={nav} activeHref="/" navLabel="Bottenrad" primaryAction={{ label: "Nytt", onClick: () => {} }} />);
    expect(within(rad()).getAllByRole("link")).toHaveLength(3);
  });

  it("har flikar på BÅDA sidor om knappen", () => {
    /*
     * ⛔ Sist skulle den bli en femte flik som råkar vara rund, och skillnaden
     * mellan "gå till" och "gör" försvinner. Mitten är det som gör den till en
     * annan sorts sak utan att något behöver skrivas ut.
     *
     * ⛔ FÖRSTA VERSIONEN KRÄVDE BARA "INTE SIST", och det var för svagt: med
     * knappen efter alla flikar men före Meny-knappen var provet grönt. Mätt
     * genom plantering, inte resonerat fram. Kravet är att det finns en LÄNK på
     * var sida, alltså att den faktiskt delar raden.
     */
    const { container } = render(
      <OpsBottomNav nav={nav} activeHref="/" primaryAction={{ label: "Nytt", onClick: () => {} }} />,
    );
    const platser = [...container.querySelectorAll("a, button")].filter((el) => el.closest("[class*='items-stretch']"));
    const index = platser.findIndex((el) => el.getAttribute("aria-label") === "Nytt");

    const fore = platser.slice(0, index).filter((el) => el.tagName === "A");
    const efter = platser.slice(index + 1).filter((el) => el.tagName === "A");
    expect(fore.length).toBeGreaterThan(0);
    expect(efter.length).toBeGreaterThan(0);
  });

  it("kastar när knappen saknar namn eller handling", () => {
    // ⛔ Etiketten är knappens enda namn för den som inte ser den. En rund knapp
    // utan namn är en knapp ingen kan använda, och det syns inte i granskningen.
    expect(() =>
      render(<OpsBottomNav nav={nav} activeHref="/" primaryAction={/** @type {any} */ ({ onClick: () => {} })} />),
    ).toThrow(/label/);
    expect(() =>
      render(<OpsBottomNav nav={nav} activeHref="/" primaryAction={/** @type {any} */ ({ label: "Nytt" })} />),
    ).toThrow(/onClick/);
  });

  it("lägger inte knappen i överflödesmenyn", () => {
    // ⛔ En åtgärd i en destinationslista läses som en sida man kan navigera
    // tillbaka från.
    render(<OpsBottomNav nav={nav} activeHref="/" primaryAction={{ label: "Nytt ärende", onClick: () => {} }} />);
    fireEvent.click(screen.getByRole("button", { name: "Meny" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).queryByText("Nytt ärende")).toBeNull();
  });
});
