import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { OpsPanel, OpsPanelRow } from "../components/OpsPanel.jsx";
import { lasTokens, granska, PAR } from "../../scripts/check-kontrast.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tokensCss = readFileSync(resolve(__dirname, "../../tokens/tokens.css"), "utf8");

function Prov({ onClear } = {}) {
  return (
    <OpsPanel trigger={<button type="button">Öppna</button>} label="Meny" title="Meny" action={onClear}>
      {(nav) => (
        <>
          <OpsPanelRow
            label="Notiser"
            badge={3}
            badgeText="olästa"
            chevron
            onClick={() => nav.push({ key: "notiser", title: "Notiser", content: <p>Tre nya saker</p> })}
          />
          <OpsPanelRow label="Inställningar" />
        </>
      )}
    </OpsPanel>
  );
}

describe("OpsPanel", () => {
  it("öppnar i en panel och inte i en modal", () => {
    /*
     * ⛔ SKILLNADEN ÄR INTE KOSMETISK. En modal mörklägger sidan och döljer
     * bakgrunden för skärmläsare. Att göra det för att visa att ett jobb kört i
     * natt är att avbryta någon för något som inte kräver ett svar. Provet på
     * det är att TRIGGERN fortfarande går att nå medan panelen är öppen.
     */
    render(<Prov />);
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Öppna" })).toBeInTheDocument();
  });

  it("⛔ BYTER INNEHÅLL PÅ PLATS, panelen stängs inte", () => {
    render(<Prov />);
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    const panel = screen.getByRole("dialog");
    fireEvent.click(within(panel).getByRole("button", { name: /Notiser/ }));

    expect(within(panel).getByText("Tre nya saker")).toBeInTheDocument();
    // Samma panel, inte en ny ruta.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    // Rotens rader är borta.
    expect(within(panel).queryByRole("button", { name: "Inställningar" })).not.toBeInTheDocument();
  });

  it("går tillbaka ett steg med pilen, inte hela vägen ut", () => {
    render(<Prov />);
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    const panel = screen.getByRole("dialog");
    fireEvent.click(within(panel).getByRole("button", { name: /Notiser/ }));
    fireEvent.click(within(panel).getByRole("button", { name: "Tillbaka" }));

    expect(within(panel).getByRole("button", { name: "Inställningar" })).toBeInTheDocument();
    expect(within(panel).queryByText("Tre nya saker")).not.toBeInTheDocument();
  });

  it("⛔ INGEN TILLBAKAPIL PÅ ROTEN", () => {
    // En pil som inte går någonstans är ett löfte som bryts vid första trycket.
    render(<Prov />);
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Tillbaka" })).not.toBeInTheDocument();
  });

  it("⛔ NOLLSTÄLLER STACKEN VID STÄNGNING", () => {
    // Öppnar man igen vill man se roten, inte den detalj man råkade läsa sist.
    render(<Prov />);
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Notiser/ }));
    fireEvent.keyDown(document.activeElement || document.body, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));

    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Inställningar" })).toBeInTheDocument();
  });

  it("stänger med Escape", () => {
    render(<Prov />);
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    fireEvent.keyDown(document.activeElement || document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("OpsPanelRow", () => {
  it("ritar chevron bara när raden leder vidare", () => {
    // ⛔ En pil på en rad som bara växlar något lovar en vy som inte finns.
    const { container, rerender } = render(<OpsPanelRow label="Med" chevron />);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    rerender(<OpsPanelRow label="Utan" />);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("⛔ säger vad antalet BETYDER, inte bara talet", () => {
    // En trea utan ord är en trea. Ordet ligger som sr-only bredvid siffran.
    render(<OpsPanelRow label="Notiser" badge={3} badgeText="olästa" />);
    // Talet och ordet uppläst tillsammans (OpsCountBadge, #97).
    expect(screen.getByText("3 olästa")).toBeInTheDocument();
  });

  it("ritar inget märke på noll", () => {
    render(<OpsPanelRow label="Tomt" badge={0} badgeText="olästa" />);
    expect(screen.queryByText("olästa")).not.toBeInTheDocument();
  });
});

describe("⛔ kontrasten håller AA i BÅDA teman", () => {
  /*
   * Provet kör samma granskning som `scripts/check-kontrast.mjs`, men i sviten,
   * så att en färgändring blir röd där man redan tittar. Vakten finns för
   * grinden; det här finns för den som ändrar ett token och kör proven.
   */
  for (const tema of ["light", "dark"]) {
    it(`${tema}: alla ${PAR.length} par`, () => {
      expect(granska(lasTokens(tokensCss, tema), tema)).toEqual([]);
    });
  }

  it("⛔ läser FAKTISKT mörka värden, inte ljusa två gånger", () => {
    /*
     * Första versionen letade `--dark-*` i fel block, hittade inga, och föll
     * tillbaka på de ljusa. Utfallet var två identiska kolumner och en vakt som
     * var grön på fel grund. Det här provet gör den tystnaden omöjlig.
     */
    const ljus = lasTokens(tokensCss, "light");
    const mork = lasTokens(tokensCss, "dark");
    expect(mork.ink).not.toBe(ljus.ink);
    expect(mork.raised).not.toBe(ljus.raised);
  });
});

describe("⛔ understrecket på fliken med chevron (#90)", () => {
  /*
   * ⛔ DET HÄR PROVET MÄTER INTE PIXLAR, OCH LÅTSAS INTE GÖRA DET. jsdom har
   * ingen layout, så ingen svit i det här repot kan se att ett understreck
   * sitter åtta pixlar för lågt. Mätningen gjordes i Chromium och står i PR:en:
   * före låg Ekonomi på botten 70 med höjd 62, medan Händelser och Översikt låg
   * på 57,8 med höjd 37,5. Efter ligger alla tre på 48,8 och 37,5.
   *
   * Provet vaktar i stället ORSAKEN, som går att se i markup: barnen fick
   * `min-h-11` medan ytterlådan fick `p-0`, så lådan blev 44 px hög och
   * `border-b-2` följde med ned. Det är den raden någon råkar skriva tillbaka.
   */
  const kalla = readFileSync(resolve(__dirname, "../components/OpsAppShell.jsx"), "utf8");
  /* ⛔ BARA SJÄLVA FLIKEN, fram till portalen. Första versionen tog med
     dropdownens rader, och de ska ha `min-h-11`: de är menyrader och inte
     flikar. Ett prov som läser för mycket är rött på rätt regel av fel skäl. */
  const chevronGrenen = kalla.slice(
    kalla.indexOf('return (\n    <span className={cx(classes,'),
    kalla.indexOf("<Popover.Portal>"),
  );

  it("lägger ingen egen höjd på barnen, de sträcker sig i stället", () => {
    expect(chevronGrenen).not.toMatch(/min-h-11/);
    expect(chevronGrenen).toMatch(/self-stretch/);
  });

  it("⛔ behåller ändå 44 px träffyta, utanför flödet", () => {
    // Tumkravet står kvar. Det är bara `::after` som bär det nu, så höjden på
    // lådan är densamma som på en flik utan chevron.
    expect(chevronGrenen).toMatch(/after:h-11/);
    expect(chevronGrenen).toMatch(/after:absolute/);
  });

  it("låter ytterlådan behålla sin egen py, annars sitter strecket för högt", () => {
    // ⛔ Felet byter bara tecken om man tar bort `py-2` i stället.
    expect(chevronGrenen).toMatch(/cx\(classes, "gap-0 px-0"\)/);
  });
});

describe("aktivitetspanelens filterslot", () => {
  const rader = [{ id: "a", nar: "2026-09-25T09:00:00.000Z", slag: "import", rubrik: "En rad", resultat: "ok" }];

  it("⛔ ritas bara när appen skickar ett, och ovanför listan", async () => {
    /*
     * Ramverket vet inte vad som är värt att filtrera bort; appen gör det. En
     * tom filterrad som alltid finns hade tagit plats i en panel som är kort
     * med flit.
     */
    const { OpsActivityButton } = await import("../components/OpsActivity.jsx");
    const { unmount } = render(<OpsActivityButton entries={rader} lasning={{ sedd: null, lasta: [] }} now={new Date("2026-09-25T12:00:00.000Z")} />);
    fireEvent.click(screen.getByRole("button", { name: /Aktivitet/ }));
    expect(within(screen.getByRole("dialog")).queryByText("Visa systemhändelser")).not.toBeInTheDocument();
    unmount();

    render(
      <OpsActivityButton
        entries={rader}
        lasning={{ sedd: null, lasta: [] }}
        filter={<span>Visa systemhändelser</span>}
        now={new Date("2026-09-25T12:00:00.000Z")}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Aktivitet/ }));
    const panel = screen.getByRole("dialog");
    expect(within(panel).getByText("Visa systemhändelser")).toBeInTheDocument();

    // Ovanför listan: filtret kommer före första radens rubrik i DOM-ordning.
    const text = panel.textContent || "";
    expect(text.indexOf("Visa systemhändelser")).toBeLessThan(text.indexOf("En rad"));
  });
});

/**
 * ══ ⛔ YTAN UNDER `md`: SHEET OCH INTE RULLGARDIN ══════════════════════════
 *
 * CP 2026-09-26: "Vill ha notisers funktion med inkorgs utseende. Alltså bara
 * att det är en egen panel och ingen ful dropdown. Den ser inte ut som i
 * SessionStudio och är inget nice i mobil."
 *
 * ⛔ STUBBEN ÄR LOKAL OCH INTE I `setup.js`. En global stubb hade tyst flyttat
 * varje befintligt panelprov ovanför till den nya vägen, och då hade de sexton
 * proven slutat bevaka rullgardinen utan att någon sagt det.
 *
 * @param {boolean} smal
 */
function medBredd(smal) {
  const lyssnare = new Set();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query) => ({
      media: query,
      matches: smal,
      addEventListener: (_, fn) => lyssnare.add(fn),
      removeEventListener: (_, fn) => lyssnare.delete(fn),
      dispatchEvent: () => false,
    }),
  });
  return () => {
    // @ts-expect-error vi tar bort den vi själva satte
    delete window.matchMedia;
  };
}

describe("OpsPanel på smal skärm", () => {
  it("⛔ öppnar som en SHEET, inte som en rullgardin", () => {
    const stad = medBredd(true);
    try {
      render(<Prov />);
      fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
      /*
       * ⛔ YTAN SKILJER DEM ÅT, INTE ROLLEN. Två saker mättes när det här
       * provet skrevs, och båda gissningarna var fel:
       *
       *   `role="dialog"`  Radix Popover.Content sätter den OCKSÅ. Ett prov på
       *                    rollen var grönt på bred skärm, alltså bevakade det
       *                    ingenting.
       *   `aria-modal`     Radix Dialog sätter den inte här. Ett prov på den
       *                    var rött mot en sheet som faktiskt renderades rätt.
       *
       * Det som faktiskt skiljer är BEHÅLLAREN, och det är precis det CP
       * klagade på: en rullgardin hänger under sin knapp, en sheet sitter fast
       * i underkanten och täcker bredden. Klasserna är därför rätt sak att
       * prova, inte en formalitet i märkningen.
       */
      const sheet = screen.getByRole("dialog", { name: "Meny" });
      expect(sheet.className).toContain("fixed");
      expect(sheet.className).toContain("bottom-0");
      expect(sheet.className).not.toContain("w-88");
      expect(within(sheet).getByText("Notiser")).toBeInTheDocument();
    } finally {
      stad();
    }
  });

  it("⛔ har en egen stängknapp, som Meny-sheeten i bottenraden", () => {
    /*
     * En rullgardin stängs genom att man trycker bredvid den, och det är hela
     * ytan man ser. En sheet täcker underkanten med dämpning ovanför, och på en
     * telefon är "bredvid" då en remsa man inte siktar på.
     */
    const stad = medBredd(true);
    try {
      render(<Prov />);
      fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
      fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
      expect(screen.queryByRole("dialog", { name: "Meny" })).not.toBeInTheDocument();
    } finally {
      stad();
    }
  });

  it("⛔ bär samma ytklasser som OpsBottomNavs sheet, inte bara liknande", () => {
    /*
     * De två ska vara SAMMA yta: öppnar man Meny och sedan klockan ska
     * ingenting röra sig. `85dvh` och `--safe-bottom` står här för att de är
     * precis de två som är lätta att glömma, och båda syns bara på en riktig
     * telefon: `dvh` för Safaris verktygsrad, `--safe-bottom` för hemknappen.
     */
    const stad = medBredd(true);
    try {
      const { container } = render(<Prov />);
      fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
      const sheet = screen.getByRole("dialog", { name: "Meny" });
      for (const klass of ["fixed", "inset-x-0", "bottom-0", "max-h-[85dvh]", "rounded-t-xl", "bg-raised", "pb-(--safe-bottom)"]) {
        expect(sheet.className, `sheeten saknar "${klass}"`).toContain(klass);
      }
      expect(container).toBeTruthy();
    } finally {
      stad();
    }
  });

  it("⛔ stacken fungerar likadant i sheeten, inklusive tillbakapilen", () => {
    // Funktionen är notisernas, bara ytan är Inkorgens. Bytte beteendet också
    // vore det en annan komponent som råkar heta samma sak.
    const stad = medBredd(true);
    try {
      render(<Prov />);
      fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
      fireEvent.click(screen.getByText("Notiser"));
      expect(screen.getByText("Tre nya saker")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
      expect(screen.queryByText("Tre nya saker")).not.toBeInTheDocument();
      expect(screen.getByText("Inställningar")).toBeInTheDocument();
    } finally {
      stad();
    }
  });

  it("⛔ på BRED skärm är det fortfarande en rullgardin", () => {
    /*
     * Spegelraden, och den är inte formalia. Utan den kan proven ovan vara
     * gröna för att panelen blivit en sheet i ALLA bredder, alltså för att
     * rullgardinen försvunnit i stället för att sheeten tillkommit.
     */
    const stad = medBredd(false);
    try {
      render(<Prov />);
      fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
      const yta = screen.getByRole("dialog", { name: "Meny" });
      expect(yta.className).toContain("w-88");
      expect(yta.className).not.toContain("bottom-0");
      expect(screen.queryByRole("button", { name: "Stäng" })).not.toBeInTheDocument();
      expect(screen.getByText("Notiser")).toBeInTheDocument();
    } finally {
      stad();
    }
  });

  it("⛔ utan matchMedia blir det rullgardinen, inte ingenting", () => {
    // jsdom och en serverrendering saknar den. Rullgardinen är den yta som
    // fungerar utan att veta något om fönstret.
    expect(typeof window.matchMedia).toBe("undefined");
    render(<Prov />);
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    expect(screen.getByRole("dialog", { name: "Meny" }).className).toContain("w-88");
    expect(screen.getByText("Notiser")).toBeInTheDocument();
  });
});
