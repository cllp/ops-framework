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
    expect(screen.getByText("olästa")).toBeInTheDocument();
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
