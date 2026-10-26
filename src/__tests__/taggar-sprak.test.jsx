import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OpsSprakProvider, OpsTaggFilter, OpsTaggPiller, OpsTaggRad, ORD_TAGGAR } from "../index.js";

/**
 * Taggkomponenterna följer språket (0.149.0, cllp/ops-framework#444).
 *
 * ⛔ HÄNDELSEN: taggpillret, taggraden och taggfiltret flyttades ur Biblioteket till en gemensam plats och började användas i Inkorgen och
 * Ärenden (0.143.0). Etiketterna följde med som svenska litteraler i JSX. Appen hade engelska för samma knappar i sin egen version, så den
 * som bytte språk i profilen fick svenska taggetiketter i tre vyer. `check-sprak` fångar det inte: den räknar bara förval i parameterlistan.
 *
 * Proven på engelska är röda mot koden utan ordboken (inget `ORD_TAGGAR`, svenska litteraler) och gröna med den. Proven på svenska är gröna
 * åt båda håll med avsikt: de låser att ingen svensk text ändrades.
 */

/** Svenska ord som aldrig får synas i det som ritas på engelska. Skrivna som hela ord eller fraser, så att en tagg som heter "el" inte träffar. */
const SVENSKT = /Taggar|Alla taggar|Rensa alla|Visa bara|Ta bort|Lägg till|Ny tagg|Förslag|Inga taggar|Sparandet|kunde inte|valda/;

describe("ORD_TAGGAR", () => {
  it("har svenska och engelska för varje ord, och engelskan är ingen kopia av svenskan", () => {
    const nycklar = Object.keys(ORD_TAGGAR);
    // Golv: en ordbok som blev tom ser ut som en ordbok där allt stämmer.
    expect(nycklar.length).toBeGreaterThanOrEqual(12);
    for (const nyckel of nycklar) {
      const ord = /** @type {{ sv: string, en: string }} */ (/** @type {any} */ (ORD_TAGGAR)[nyckel]);
      expect(ord.sv, `${nyckel}.sv`).toBeTruthy();
      expect(ord.en, `${nyckel}.en`).toBeTruthy();
      expect(ord.en, `${nyckel}: engelskan är samma text som svenskan`).not.toBe(ord.sv);
    }
  });
});

describe("OpsTaggPiller på engelska", () => {
  it("heter Show only och Remove the tag, ur providern", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsTaggPiller tagg="faktura" vald onFilter={() => {}} onTaBort={() => {}} />
      </OpsSprakProvider>,
    );
    expect(screen.getByRole("button", { name: "Show only faktura" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove the tag faktura" })).toBeInTheDocument();
  });

  it("ett sprak som appen ger direkt vinner över providern", () => {
    render(
      <OpsSprakProvider sprak="sv">
        <OpsTaggPiller tagg="faktura" sprak="en" onFilter={() => {}} onTaBort={() => {}} />
      </OpsSprakProvider>,
    );
    expect(screen.getByRole("button", { name: "Show only faktura" })).toBeInTheDocument();
  });
});

describe("OpsTaggRad på engelska", () => {
  it("knappen, fältet, förslagen och felen är engelska, och inget svenskt läcker", async () => {
    const user = userEvent.setup();
    const onAndra = vi.fn(() => false);
    const { container } = render(
      <OpsSprakProvider sprak="en">
        <OpsTaggRad taggar={[]} kanAndra forslag={["el", "vvs"]} onAndra={onAndra} />
      </OpsSprakProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Add tag" }));
    const falt = screen.getByLabelText("New tag");
    expect(falt).toHaveAttribute("placeholder", "tag");
    const forslag = screen.getByRole("listbox", { name: "Suggestions" });
    expect(within(forslag).getByRole("option", { name: "vvs" })).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onAndra).toHaveBeenCalledWith(["el"]);
    expect(await screen.findByRole("alert")).toHaveTextContent("The tags could not be saved.");
    expect(container.innerHTML).not.toMatch(SVENSKT);
  });

  it("knappen heter Tag när det redan finns taggar", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsTaggRad taggar={["el"]} kanAndra onAndra={() => {}} />
      </OpsSprakProvider>,
    );
    expect(screen.getByRole("button", { name: "Tag" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add tag" })).toBeNull();
  });

  it("ett sprak som appen ger raden går vidare till pillren i den, utan provider", () => {
    render(<OpsTaggRad taggar={["el"]} kanAndra sprak="en" onFilter={() => {}} onAndra={() => {}} />);
    expect(screen.getByRole("button", { name: "Show only el" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove the tag el" })).toBeInTheDocument();
  });

  it("utan koppling till sparandet säger felet det på engelska", async () => {
    const user = userEvent.setup();
    render(
      <OpsSprakProvider sprak="en">
        <OpsTaggRad taggar={["el"]} kanAndra />
      </OpsSprakProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Tag" }));
    await user.type(screen.getByLabelText("New tag"), "vvs{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Saving is not connected. The tags were not changed.");
  });
});

describe("OpsTaggFilter på engelska", () => {
  it("knappen, rubriken, Rensa alla och menyn är engelska", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <OpsSprakProvider sprak="en">
        <OpsTaggFilter taggar={[{ tagg: "vvs", antal: 2 }]} valda={["vvs"]} onValda={() => {}} />
      </OpsSprakProvider>,
    );

    const knapp = screen.getByRole("button", { name: "Tags, 1 selected" });
    expect(knapp).toHaveTextContent("Tags (1)");
    await user.click(knapp);
    expect(screen.getByText("All tags")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeInTheDocument();
    expect(screen.getByRole("menu", { name: "Tags" })).toBeInTheDocument();
    expect(baseElement.innerHTML).not.toMatch(SVENSKT);
  });

  it("utan valda heter knappen Tags, och en tom lista säger det på engelska", async () => {
    const user = userEvent.setup();
    render(
      <OpsSprakProvider sprak="en">
        <OpsTaggFilter taggar={[]} valda={[]} onValda={() => {}} />
      </OpsSprakProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Tags" }));
    expect(screen.getByText("No tags yet. Add one to a post.")).toBeInTheDocument();
  });
});

describe("taggkomponenterna på svenska (låser att ingen text ändrades)", () => {
  it("utan provider är allt svenskt som förut", async () => {
    const user = userEvent.setup();
    render(
      <>
        <OpsTaggPiller tagg="faktura" onFilter={() => {}} onTaBort={() => {}} />
        <OpsTaggFilter taggar={[]} valda={[]} onValda={() => {}} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Visa bara faktura" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ta bort taggen faktura" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Taggar" }));
    expect(screen.getByText("Alla taggar")).toBeInTheDocument();
    expect(screen.getByText("Inga taggar ännu. Lägg till en på en post.")).toBeInTheDocument();
  });

  it("med providern på svenska och ett okänt språk blir det svenska", async () => {
    const user = userEvent.setup();
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <OpsSprakProvider sprak="de">
        <OpsTaggRad taggar={[]} kanAndra onAndra={() => true} />
      </OpsSprakProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Lägg till tagg" }));
    expect(screen.getByLabelText("Ny tagg")).toHaveAttribute("placeholder", "tagg");
    fel.mockRestore();
  });
});
