import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsCheckbox, OpsSwitch } from "../components/OpsToggle.jsx";

/**
 * ⛔ Den här filen finns för att avgöra ett påstående, inte för att bekräfta en
 * åsikt.
 *
 * UX-auditen av bolag-ops (cllp/bolag-ops#97) skrev att träffytorna på custom
 * controls är svåra "även på Primitiver", och misstänkte att en dekorativ
 * `<span>` fångar klicket i stället för den riktiga kryssrutan. Den misstanken
 * är rimlig: det är precis så de flesta handrullade kryssrutor går sönder.
 *
 * Att läsa koden och säga "nej, det stämmer inte" är inte ett svar. Ett
 * påstående i en audit ska avgöras av en körning, annars står ord mot ord och
 * ingen vet vem som hade rätt om ett halvår.
 *
 * Testerna nedan klickar på den dekorativa rutan, på texten och på båda i en
 * grupp, och kräver att exakt EN kryssruta ändras varje gång. Går de igenom är
 * ramverkets kryssruta inte orsaken till att fem tillgångar avmarkeras
 * samtidigt i bolag-ops, och den buggen ligger i appens state
 * (cllp/bolag-ops#101).
 */

describe("kryssrutans träffyta", () => {
  it("växlar när man klickar på den dekorativa rutan, inte bara på etiketten", async () => {
    const vidValt = vi.fn();
    const { container } = render(<OpsCheckbox label="Ta med i rapporten" checked={false} onChange={vidValt} />);

    // Den dekorativa rutan är det aria-hidden-spannet inuti etiketten.
    const ruta = container.querySelector("label > span[aria-hidden='true']");
    expect(ruta).not.toBeNull();

    await userEvent.click(/** @type {Element} */ (ruta));
    expect(vidValt).toHaveBeenCalledTimes(1);
    expect(vidValt).toHaveBeenCalledWith(true);
  });

  it("växlar när man klickar på texten", async () => {
    const vidValt = vi.fn();
    render(<OpsCheckbox label="Ta med i rapporten" checked={false} onChange={vidValt} />);
    await userEvent.click(screen.getByText("Ta med i rapporten"));
    expect(vidValt).toHaveBeenCalledTimes(1);
  });

  /**
   * ⛔ Kärnan i auditens fynd: ett klick fick alla fem att avmarkeras. Här står
   * två kryssrutor bredvid varandra och bara den klickade får höra av sig.
   * Delade de `id` eller `name` skulle båda reagera.
   */
  it("rör bara sin egen rad när flera står bredvid varandra", async () => {
    const forst = vi.fn();
    const sedan = vi.fn();
    const { container } = render(
      <>
        <OpsCheckbox label="Bostad" checked onChange={forst} />
        <OpsCheckbox label="Pension" checked onChange={sedan} />
      </>,
    );

    const rutor = container.querySelectorAll("label > span[aria-hidden='true']");
    expect(rutor).toHaveLength(2);

    await userEvent.click(rutor[0]);
    expect(forst).toHaveBeenCalledTimes(1);
    expect(sedan).not.toHaveBeenCalled();

    await userEvent.click(rutor[1]);
    expect(sedan).toHaveBeenCalledTimes(1);
    expect(forst).toHaveBeenCalledTimes(1);
  });

  it("går att växla med mellanslag från tangentbordet", async () => {
    const vidValt = vi.fn();
    render(<OpsCheckbox label="Bostad" checked={false} onChange={vidValt} />);
    const input = screen.getByRole("checkbox", { name: "Bostad" });
    input.focus();
    await userEvent.keyboard(" ");
    expect(vidValt).toHaveBeenCalledWith(true);
  });

  it("gör ingenting när den är spärrad", async () => {
    const vidValt = vi.fn();
    const { container } = render(<OpsCheckbox label="Bostad" checked={false} onChange={vidValt} disabled />);
    await userEvent.click(/** @type {Element} */ (container.querySelector("label > span[aria-hidden='true']")));
    expect(vidValt).not.toHaveBeenCalled();
  });

  it("reglaget beter sig likadant och annonseras som switch", async () => {
    const vidValt = vi.fn();
    const { container } = render(<OpsSwitch label="Kompakt läge" checked={false} onChange={vidValt} />);
    expect(screen.getByRole("switch", { name: "Kompakt läge" })).toBeInTheDocument();
    await userEvent.click(/** @type {Element} */ (container.querySelector("label > span[aria-hidden='true']")));
    expect(vidValt).toHaveBeenCalledWith(true);
  });

  /**
   * Golvet i sig mäts i webbläsaren av `check-scaffold`, eftersom jsdom inte
   * lägger någon CSS och därför inte kan mäta höjd. Här kontrolleras bara att
   * klassen som bär golvet faktiskt sitter kvar, så att en omskrivning av
   * etiketten inte tyst tar bort den.
   */
  it("behåller höjdgolvet på telefon i etikettens klasser", () => {
    const { container } = render(<OpsCheckbox label="Bostad" checked onChange={() => {}} />);
    const label = container.querySelector("label");
    expect(label?.className).toContain("min-h-11");
    expect(label?.className).toContain("md:min-h-0");
  });
});
