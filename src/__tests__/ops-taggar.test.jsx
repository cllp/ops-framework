import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek, OpsTaggFilter, OpsTaggPiller, OpsTaggRad, taggfarg } from "../index.js";

const JAG = { uid: "u-1", roll: "member" };
const SKAPARE = { uid: "u-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };

describe("OpsTaggPiller (0.143.0, lifehub.app#398)", () => {
  it("ritar samma deterministiska palettfärg som taggfarg och aldrig en knapp inuti en knapp", async () => {
    const user = userEvent.setup();
    const onFilter = vi.fn();
    const onTaBort = vi.fn();

    const { container, rerender } = render(
      <OpsTaggPiller tagg="faktura" vald onFilter={onFilter} onTaBort={onTaBort} />,
    );

    const piller = container.querySelector('[data-bibliotek-tagg="faktura"]');
    expect(piller).not.toBeNull();
    expect(piller?.className).toContain(`bg-tagg-${taggfarg("faktura")}`);

    const filterKnapp = screen.getByRole("button", { name: "Visa bara faktura" });
    const taBortKnapp = screen.getByRole("button", { name: "Ta bort taggen faktura" });
    expect(filterKnapp).toHaveAttribute("aria-pressed", "true");
    expect(filterKnapp.contains(taBortKnapp)).toBe(false);

    await user.click(filterKnapp);
    expect(onFilter).toHaveBeenCalledWith("faktura");

    await user.click(taBortKnapp);
    expect(onTaBort).toHaveBeenCalledWith("faktura");

    rerender(<OpsTaggPiller tagg="faktura" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("faktura")).toBeInTheDocument();
  });
});

describe("OpsTaggRad fristående (0.143.0, lifehub.app#398)", () => {
  it("lägger till och tar bort taggar via onAndra, föreslår ur forslag och rullar tillbaka vid fel", async () => {
    const user = userEvent.setup();
    /** @type {(v: boolean) => void} */
    let los = () => {};
    const onAndra = vi.fn(() => new Promise((r) => { los = r; }));

    const { container } = render(
      <OpsTaggRad
        taggar={["el"]}
        kanAndra
        forslag={["el", "vvs", "faktura"]}
        onAndra={onAndra}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Tagg$/i }));
    const forslag = screen.getByRole("listbox", { name: "Förslag" });
    expect(within(forslag).getByRole("option", { name: "vvs" })).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onAndra).toHaveBeenCalledWith(["el", "vvs"]);
    expect(container.querySelector("[data-bibliotek-tagg=\"vvs\"]")).not.toBeNull();

    los(false);
    expect(await screen.findByRole("alert")).toHaveTextContent(/kunde inte sparas/i);
    expect(container.querySelector("[data-bibliotek-tagg=\"vvs\"]")).toBeNull();
  });

  it("när onAndra avvisar vid borttagning kommer taggen tillbaka och felet syns", async () => {
    const user = userEvent.setup();
    const onAndra = vi.fn(() => Promise.reject(new Error("Nekad av servern")));

    const { container } = render(
      <OpsTaggRad
        taggar={["viktigt", "el"]}
        kanAndra
        forslag={["viktigt", "el"]}
        onAndra={onAndra}
      />,
    );

    expect(container.querySelector("[data-bibliotek-tagg=\"viktigt\"]")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Ta bort taggen viktigt" }));
    expect(onAndra).toHaveBeenCalledWith(["el"]);
    expect(await screen.findByRole("alert")).toHaveTextContent(/nekad av servern/i);
    expect(container.querySelector("[data-bibliotek-tagg=\"viktigt\"]")).not.toBeNull();
  });
});

describe("OpsTaggFilter med extra sektion (0.143.0, lifehub.app#398)", () => {
  it("räknar både taggar och extra i knappen, ritar egen meny för extra och nollar båda på Rensa alla", async () => {
    const user = userEvent.setup();
    const onValda = vi.fn();
    const onExtraValda = vi.fn();

    const { rerender } = render(
      <OpsTaggFilter
        taggar={[
          { tagg: "vvs", antal: 2 },
          { tagg: "el", antal: 1 },
        ]}
        valda={["vvs"]}
        onValda={onValda}
        extra={{
          rubrik: "GitHub-labels",
          ikon: <span data-testid="gh-ikon">G</span>,
          lista: [
            { namn: "bug", antal: 3 },
            { namn: "enhancement", antal: 1 },
          ],
          valda: ["bug"],
          onValda: onExtraValda,
        }}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Taggar, 2 valda" });
    expect(trigger).toHaveTextContent("Taggar (2)");

    await user.click(trigger);

    const taggMeny = screen.getByRole("menu", { name: "Taggar" });
    const extraMeny = screen.getByRole("menu", { name: "GitHub-labels" });
    expect(within(taggMeny).getByRole("menuitemcheckbox", { name: /vvs/i })).toHaveAttribute("aria-checked", "true");
    expect(within(extraMeny).getByRole("menuitemcheckbox", { name: /bug/i })).toHaveAttribute("aria-checked", "true");

    await user.click(within(extraMeny).getByRole("menuitemcheckbox", { name: /enhancement/i }));
    expect(onExtraValda).toHaveBeenCalledWith(["bug", "enhancement"]);

    await user.click(screen.getByRole("button", { name: "Rensa alla" }));
    expect(onValda).toHaveBeenCalledWith([]);
    expect(onExtraValda).toHaveBeenCalledWith([]);

    rerender(
      <OpsTaggFilter
        taggar={[]}
        valda={[]}
        onValda={onValda}
      />,
    );
    expect(screen.getByRole("button", { name: "Taggar" })).toBeInTheDocument();
  });
});

describe("OpsBibliotek med gruppTaggar (0.143.0, lifehub.app#398)", () => {
  it("visar taggar från Inkorgen och Ärenden i både TaggFilter och TaggRad-förslag utan dubbletter", async () => {
    const user = userEvent.setup();
    render(
      <OpsBibliotek
        hubHref="#/appar"
        jag={JAG}
        gruppTaggar={["vvs", "faktura", "avtal"]}
        poster={[
          {
            id: "b1",
            groupId: "g-1",
            typ: "anteckning",
            rubrik: "Elavtal",
            text: "Text",
            taggar: ["avtal"],
            skapadAv: SKAPARE,
            skapad: 1700000000000,
            andrad: 1700000000000,
          },
        ]}
        onSpara={vi.fn()}
      />,
    );

    const taggFilterKnapp = screen.getByRole("button", { name: "Taggar" });
    await user.click(taggFilterKnapp);
    const meny = screen.getByRole("menu", { name: "Taggar" });
    const rader = within(meny).getAllByRole("menuitemcheckbox");
    expect(rader.map((r) => r.textContent)).toEqual(["avtal1", "faktura0", "vvs0"]);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /^Tagg$/i }));
    const forslag = screen.getByRole("listbox", { name: "Förslag" });
    expect(within(forslag).getByRole("option", { name: "faktura" })).toBeInTheDocument();
    expect(within(forslag).getByRole("option", { name: "vvs" })).toBeInTheDocument();
  });
});
