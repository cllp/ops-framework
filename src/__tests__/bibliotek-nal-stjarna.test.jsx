import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * Nålen och stjärnan i Biblioteket (0.187.0, cllp/lifehub.app#653). Nålen är taggen `nal` på posten (alla på platsen ser den överst), stjärnan är personens egen (propsen `stjarnor` och
 * `onStjarna`, bor hos appen). Och raden `huvudRad` (cllp/ops-framework#517) som appen äger i huvudet.
 * ⛔ RÖTT UTAN ÄNDRINGEN: menyn hade ingen Nåla fast, ingen stjärnknapp ritades, `stjarnor` och `onStjarna` var okända props, och `huvudRad` ritades inte.
 */
const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const ANNAN = { uid: "uid-2", roll: "medlem" };
const med = (extra) => ({ groupId: "cps-ab", skapadAv: skapare, skapad: tid, andrad: tid, ...extra });
const post = (id, rubrik, extra = {}) => ({ ...byggPost(med({ typ: "anteckning", rubrik, text: "Text", ...extra })), id });

/** Appen: håller posterna och stjärnorna, och skriver det onSpara och onStjarna säger. */
function Vy({ start, jag = JAG, utanStjarna = false, forstjarnor = [], onStjarna, huvudRad, vald: startVald = null }) {
  const [poster, setPoster] = useState(start);
  const [stjarnor, setStjarnor] = useState(new Set(forstjarnor));
  const [vald, setVald] = useState(startVald);
  const stjarna = onStjarna ?? (async (p, pa) => {
    setStjarnor((s) => {
      const n = new Set(s);
      if (pa) n.add(p.id);
      else n.delete(p.id);
      return n;
    });
  });
  return (
    <OpsBibliotek
      poster={poster}
      jag={jag}
      vald={vald && poster.find((p) => p.id === vald.id)}
      onOppna={setVald}
      onStang={() => setVald(null)}
      onSkapa={() => {}}
      onSpara={async (i) => setPoster((ps) => ps.map((p) => (p.id === i.id ? { ...p, ...i } : p)))}
      onRadera={() => {}}
      hubHref="/hub"
      {...(utanStjarna ? {} : { stjarnor, onStjarna: stjarna })}
      huvudRad={huvudRad}
    />
  );
}

const A = post("a", "Alfa");
const B = post("b", "Beta", { taggar: ["nal"] });
const C = post("c", "Cesar");
const titlar = () => [...document.querySelectorAll("[data-bibliotek-lista] li")].map((li) => li.querySelector(".truncate")?.textContent);

describe("Nålen", () => {
  it("⛔ en nålad post står först och bär en nål med ord, och nålen är inget taggpiller", () => {
    render(<Vy start={[A, B, C]} />);
    expect(titlar()[0]).toBe("Beta");
    const kort = document.querySelector("[data-bibliotek-nal]");
    expect(kort).not.toBeNull();
    expect(within(kort).getByText("Nålad")).toBeInTheDocument();
    // Ingen tagg "nal" som piller, och inte i taggfiltret.
    expect(document.querySelector('[data-bibliotek-tagg="nal"]')).toBeNull();
  });

  it("menyn har Nåla fast, och ett val skriver taggen nal genom onSpara med de andra taggarna kvar", async () => {
    const user = userEvent.setup();
    render(<Vy start={[post("a", "Alfa", { taggar: ["kvitto"] }), C]} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Alfa" }));
    await user.click(screen.getByRole("menuitem", { name: "Nåla fast" }));
    await waitFor(() => expect(titlar()[0]).toBe("Alfa"));
    expect(document.querySelectorAll("[data-bibliotek-nal]").length).toBe(1);
    expect(await screen.findByText(/står överst för alla/)).toBeInTheDocument();
    // Tagg-piller: bara kvitto.
    expect([...document.querySelectorAll("[data-bibliotek-tagg]")].map((e) => e.getAttribute("data-bibliotek-tagg"))).toEqual(["kvitto"]);
  });

  it("Ta bort nålen tar bort bara nålen", async () => {
    const user = userEvent.setup();
    const spara = vi.fn(async () => {});
    render(
      <OpsBibliotek poster={[post("b", "Beta", { taggar: ["kvitto", "nal"] })]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={spara} onRadera={() => {}} hubHref="/hub" />,
    );
    await user.click(screen.getByRole("button", { name: "Åtgärder för Beta" }));
    await user.click(screen.getByRole("menuitem", { name: "Ta bort nålen" }));
    expect(spara).toHaveBeenCalledWith({ id: "b", taggar: ["kvitto"] });
  });

  it("⛔ att ändra en annan tagg på en nålad post tar inte bort nålen", async () => {
    const user = userEvent.setup();
    const spara = vi.fn(async () => {});
    render(
      <OpsBibliotek poster={[post("b", "Beta", { taggar: ["kvitto", "nal"] })]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={spara} onRadera={() => {}} hubHref="/hub" />,
    );
    await user.click(screen.getByRole("button", { name: "Ta bort taggen kvitto" }));
    expect(spara).toHaveBeenCalledTimes(1);
    expect(spara.mock.calls[0][0].taggar).toEqual(["nal"]);
  });

  it("⛔ samma rätt som Arkivera: en medlem som inte skrev posten och inte är admin får inte nåla den", async () => {
    const user = userEvent.setup();
    render(<Vy start={[A]} jag={ANNAN} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Alfa" }));
    const rader = within(screen.getByRole("menu", { name: "Alfa" })).queryAllByRole("menuitem").map((r) => r.textContent);
    expect(rader).not.toContain("Nåla fast");
    expect(rader).not.toContain("Arkivera");
  });

  it("ett fel från onSpara syns, och posten blir inte nålad", async () => {
    const user = userEvent.setup();
    render(
      <OpsBibliotek poster={[A]} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={async () => { throw new Error("Nej från servern."); }} onRadera={() => {}} hubHref="/hub" />,
    );
    await user.click(screen.getByRole("button", { name: "Åtgärder för Alfa" }));
    await user.click(screen.getByRole("menuitem", { name: "Nåla fast" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nej från servern.");
    expect(document.querySelector("[data-bibliotek-nal]")).toBeNull();
  });

  it("i detaljen: nålen syns i huvudet, menyn har Ta bort nålen, och ett fel syns också där", async () => {
    const user = userEvent.setup();
    render(
      <OpsBibliotek poster={[B]} vald={B} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={async () => { throw new Error("Nekad."); }} onRadera={() => {}} hubHref="/hub" />,
    );
    const huvud = document.querySelector("[data-bibliotek-detaljhuvud]");
    expect(within(huvud).getByText("Nålad")).toBeInTheDocument();
    await user.click(within(huvud).getByRole("button", { name: /Åtgärder för/ }));
    await user.click(screen.getByRole("menuitem", { name: "Ta bort nålen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nekad.");
  });

  it("på engelska heter raden Pin och Unpin", async () => {
    const user = userEvent.setup();
    render(<OpsSprakProvider sprak="en"><Vy start={[A, B]} /></OpsSprakProvider>);
    await user.click(screen.getByRole("button", { name: "Actions for Alfa" }));
    expect(screen.getByRole("menuitem", { name: "Pin" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Actions for Beta" }));
    expect(screen.getByRole("menuitem", { name: "Unpin" })).toBeInTheDocument();
  });
});

describe("Stjärnan", () => {
  it("⛔ utan stjarnor och onStjarna: ingen stjärnknapp och ingen flik", () => {
    render(<Vy start={[A, B, C]} utanStjarna />);
    expect(document.querySelector("[data-bibliotek-stjarna]")).toBeNull();
    expect(screen.queryByRole("tab", { name: /Stjärnmärkta/ })).toBeNull();
  });

  it("⛔ det ena utan det andra kastar tydligt", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    const bas = { poster: [A], jag: JAG, onOppna: () => {}, onStang: () => {}, onSkapa: () => {}, hubHref: "/hub" };
    expect(() => render(<OpsBibliotek {...bas} stjarnor={new Set()} />)).toThrow(/stjarnor och onStjarna hör ihop/);
    expect(() => render(<OpsBibliotek {...bas} onStjarna={() => {}} />)).toThrow(/stjarnor och onStjarna hör ihop/);
    expect(() => render(<OpsBibliotek {...bas} stjarnor="a" onStjarna={() => {}} />)).toThrow(/Set eller en lista/);
    tyst.mockRestore();
  });

  it("en knapp per rad med aria-pressed, och ett tryck anropar onStjarna med posten och nya läget", async () => {
    const user = userEvent.setup();
    const onStjarna = vi.fn(async () => {});
    render(
      <OpsBibliotek poster={[A, C]} jag={JAG} stjarnor={new Set(["c"])} onStjarna={onStjarna} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} hubHref="/hub" />,
    );
    expect(screen.getByRole("button", { name: "Stjärnmärk" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Ta bort stjärnan" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Stjärnmärk" }));
    expect(onStjarna).toHaveBeenCalledTimes(1);
    expect(onStjarna.mock.calls[0][0].id).toBe("a");
    expect(onStjarna.mock.calls[0][1]).toBe(true);
    await user.click(screen.getByRole("button", { name: "Ta bort stjärnan" }));
    expect(onStjarna.mock.calls[1][0].id).toBe("c");
    expect(onStjarna.mock.calls[1][1]).toBe(false);
  });

  it("⛔ knappen väntar medan anropet pågår (aria-busy, spärrad, ett andra tryck gör inget) och är ledig igen efteråt", async () => {
    const user = userEvent.setup();
    /** @type {() => void} */
    let klart = () => {};
    const onStjarna = vi.fn(() => new Promise((res) => { klart = () => res(undefined); }));
    render(
      <OpsBibliotek poster={[A]} jag={JAG} stjarnor={new Set()} onStjarna={onStjarna} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} hubHref="/hub" />,
    );
    const knapp = screen.getByRole("button", { name: "Stjärnmärk" });
    await user.click(knapp);
    expect(knapp).toHaveAttribute("aria-busy", "true");
    expect(knapp).toBeDisabled();
    await user.click(knapp);
    expect(onStjarna).toHaveBeenCalledTimes(1);
    await act(async () => klart());
    await waitFor(() => expect(screen.getByRole("button", { name: "Stjärnmärk" })).toHaveAttribute("aria-busy", "false"));
  });

  it("⛔ ett fel syns som ett fel och stjärnan ändras inte", async () => {
    const user = userEvent.setup();
    const onStjarna = vi.fn(async () => { throw new Error("Stjärnorna nåddes inte."); });
    render(
      <OpsBibliotek poster={[A]} jag={JAG} stjarnor={new Set()} onStjarna={onStjarna} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} hubHref="/hub" />,
    );
    await user.click(screen.getByRole("button", { name: "Stjärnmärk" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Stjärnorna nåddes inte.");
    expect(screen.getByRole("button", { name: "Stjärnmärk" })).toHaveAttribute("aria-pressed", "false");
  });

  it("fliken Stjärnmärkta syns först när något är stjärnmärkt, räknar, och visar bara de stjärnmärkta", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Vy start={[A, B, C]} />);
    expect(screen.queryByRole("tab", { name: /Stjärnmärkta/ })).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Stjärnmärk" })[1]);
    const flik = await screen.findByRole("tab", { name: /Stjärnmärkta/ });
    expect(flik).toHaveTextContent("1");
    await user.click(flik);
    expect(titlar()).toHaveLength(1);
    // Den sista stjärnan bort: fliken försvinner och listan faller tillbaka till Allt.
    await user.click(screen.getByRole("button", { name: "Ta bort stjärnan" }));
    await waitFor(() => expect(screen.queryByRole("tab", { name: /Stjärnmärkta/ })).toBeNull());
    expect(titlar()).toHaveLength(3);
    unmount();
  });

  it("stjärnmärkta poster som inte finns på platsen räknas inte", () => {
    render(<Vy start={[A, C]} forstjarnor={["finns-inte"]} />);
    expect(screen.queryByRole("tab", { name: /Stjärnmärkta/ })).toBeNull();
  });

  it("i detaljen sitter stjärnknappen i huvudet, och den kan tryckas", async () => {
    const user = userEvent.setup();
    render(<Vy start={[A, C]} vald={A} />);
    const huvud = document.querySelector("[data-bibliotek-detaljhuvud]");
    await user.click(within(huvud).getByRole("button", { name: "Stjärnmärk" }));
    await waitFor(() => expect(within(document.querySelector("[data-bibliotek-detaljhuvud]")).getByRole("button", { name: "Ta bort stjärnan" })).toHaveAttribute("aria-pressed", "true"));
  });

  it("på engelska heter knappen Star och fliken Starred", async () => {
    render(<OpsSprakProvider sprak="en"><Vy start={[A, C]} forstjarnor={["a"]} /></OpsSprakProvider>);
    expect(screen.getByRole("button", { name: "Remove the star" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Star" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Starred/ })).toBeInTheDocument();
  });
});

describe("huvudRad (cllp/ops-framework#517)", () => {
  it("⛔ ritas som en egen rad i huvudet, utanför raden med sök, Ny och Taggar", () => {
    render(<Vy start={[A]} utanStjarna huvudRad={<button type="button">Klistra in</button>} />);
    const rad = document.querySelector("[data-bibliotek-huvudrad]");
    expect(rad).not.toBeNull();
    expect(within(rad).getByRole("button", { name: "Klistra in" })).toBeInTheDocument();
    const sokrad = screen.getByRole("searchbox", { name: "Sök i biblioteket" }).closest("div.flex");
    expect(sokrad.contains(rad)).toBe(false);
    expect(rad.parentElement).toBe(document.querySelector("[data-bibliotek-huvud]"));
  });

  it("utan propen: ingen rad", () => {
    render(<Vy start={[A]} utanStjarna />);
    expect(document.querySelector("[data-bibliotek-huvudrad]")).toBeNull();
  });

  it("⛔ en inbäddad lista har inget huvud, och propen kastar i stället för att tystna", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsBibliotek poster={[A]} jag={JAG} inbaddad onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} huvudRad={<span>x</span>} />)).toThrow(/huvudRad/);
    tyst.mockRestore();
  });
});
