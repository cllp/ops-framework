import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { HandelseDelning } from "../components/HandelseDelning.jsx";
import { MejlaLank } from "../components/MejlaLank.jsx";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { EPOSTFORM, epostFel } from "../lib/mejl.js";
import { byggPost } from "../lib/bibliotek.js";

/**
 * Mejla en delad länk (0.128.0, cllp/lifehub.app#356, CP 2026-10-20): "en delad länk ska kunna skickas med mejl från dialogen Dela länk, via den befintliga mejlvägen."
 * Ramverket skickar ingenting: det prövar adressen med de hjälpare som finns och anropar appens `onMejlaLank({ id, url, till })`.
 */

const LANK = { id: "d1", url: "https://my.life-hub.app/g/travel/lib/avtal-k7f3q9x2" };

describe("epostFel: den befintliga hjälparen", () => {
  it("godtar en adress som ser ut som en, trimmad", () => {
    for (const ok of ["kim@exempel.se", "  kim@exempel.se  ", "kim.k+tag@sub.exempel.org"]) expect(epostFel(ok), ok).toBeNull();
  });

  it("avvisar tomt, fel form och spärrade domäner (samma lista som mejlkön), med skäl", () => {
    expect(epostFel("")).toBe("Skriv en e-postadress.");
    expect(epostFel("   ")).toBe("Skriv en e-postadress.");
    expect(epostFel(undefined)).toBe("Skriv en e-postadress.");
    for (const dalig of ["kim", "kim@", "@exempel.se", "kim@exempel", "kim exempel@x.se", "a@b@c.se"]) expect(epostFel(dalig), dalig).toMatch(/är inte en e-postadress/);
    expect(epostFel("kim@example.com")).toBe("Mejl till example.com skickas inte.");
    expect(epostFel("kim@TEST.se")).toBe("Mejl till test.se skickas inte.");
    expect(epostFel("kim@egen-spar.se", ["egen-spar.se"])).toBe("Mejl till egen-spar.se skickas inte.");
  });

  it("⛔ samma uttryck som servern och gruppformuläret använder (regel 2): en exporterad `EPOSTFORM`", () => {
    expect(EPOSTFORM.test("kim@exempel.se")).toBe(true);
    expect(EPOSTFORM.test("kim@exempel")).toBe(false);
  });
});

describe("MejlaLank", () => {
  it("kräver onMejlaLank och en länk med adress", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<MejlaLank lank={LANK} onMejlaLank={/** @type {any} */ (undefined)} />)).toThrow(/onMejlaLank krävs/);
    expect(() => render(<MejlaLank lank={{ id: "x", url: "" }} onMejlaLank={vi.fn()} />)).toThrow(/url är hela adressen/);
    vi.restoreAllMocks();
  });

  it("⛔ anropar appen med { id, url, till } (adressen trimmad), säger 'Skickat till x.' och tömmer fältet för nästa mottagare", async () => {
    const onMejlaLank = vi.fn(async () => {});
    render(<MejlaLank lank={LANK} onMejlaLank={onMejlaLank} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Skicka till mejl" }), "  kim@exempel.se ");
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(onMejlaLank).toHaveBeenCalledWith({ id: "d1", url: LANK.url, till: "kim@exempel.se" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Skickat till kim@exempel.se.");
    expect(screen.getByRole("textbox", { name: "Skicka till mejl" })).toHaveValue("");
    // En andra mottagare går att skriva, och det gamla beskedet försvinner när ett nytt försök görs.
    await user.type(screen.getByRole("textbox", { name: "Skicka till mejl" }), "alex@exempel.se{Enter}");
    await waitFor(() => expect(onMejlaLank).toHaveBeenCalledTimes(2));
    expect(onMejlaLank).toHaveBeenLastCalledWith({ id: "d1", url: LANK.url, till: "alex@exempel.se" });
  });

  it("⛔ en adress med fel form eller spärrad domän avvisas INNAN appen anropas, med skälet, och fältet står kvar", async () => {
    const onMejlaLank = vi.fn(async () => {});
    render(<MejlaLank lank={LANK} onMejlaLank={onMejlaLank} />);
    const user = userEvent.setup();
    const falt = screen.getByRole("textbox", { name: "Skicka till mejl" });
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Skriv en e-postadress.");
    await user.type(falt, "kim@exempel");
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    expect(screen.getByRole("alert")).toHaveTextContent('"kim@exempel" är inte en e-postadress.');
    await user.clear(falt);
    await user.type(falt, "kim@example.com");
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Mejl till example.com skickas inte.");
    expect(falt).toHaveValue("kim@example.com");
    expect(onMejlaLank).not.toHaveBeenCalled();
  });

  it("⛔ faller utskicket (kast eller false) står orsaken kvar, adressen står kvar i fältet, och inget 'Skickat' visas", async () => {
    const onMejlaLank = vi.fn().mockRejectedValueOnce(new Error("Mejlkön nekade.")).mockResolvedValueOnce(false).mockResolvedValue(undefined);
    render(<MejlaLank lank={LANK} onMejlaLank={onMejlaLank} />);
    const user = userEvent.setup();
    const falt = screen.getByRole("textbox", { name: "Skicka till mejl" });
    await user.type(falt, "kim@exempel.se");
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mejlet gick inte att skicka: Mejlkön nekade.");
    expect(falt).toHaveValue("kim@exempel.se");
    expect(screen.queryByRole("status")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Mejlet skickades inte."));
    expect(falt).toHaveValue("kim@exempel.se");
    // Tredje försöket går igenom, och felet är borta.
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Skickat till kim@exempel.se.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("⛔ två tryck i samma tick skickar ETT mejl", async () => {
    let klar;
    const onMejlaLank = vi.fn(() => new Promise((res) => { klar = res; }));
    render(<MejlaLank lank={LANK} onMejlaLank={onMejlaLank} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Skicka till mejl" }), { target: { value: "kim@exempel.se" } });
    const knapp = screen.getByRole("button", { name: "Skicka" });
    // ⛔ Båda trycken i ETT act: ingen ritning hinner göra knappen avstängd mellan dem. Två fireEvent efter varandra var grönt även utan skyddet, eftersom varje fireEvent
    // ritar om (och stänger knappen) innan nästa; provet mätte då knappen och inte skyddet (regel 4, mätt med skyddet borttaget).
    act(() => {
      knapp.click();
      knapp.click();
    });
    expect(onMejlaLank).toHaveBeenCalledTimes(1);
    klar();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Skickat till"));
  });

  it("engelska texter med sprak='en'", () => {
    render(<MejlaLank lank={LANK} onMejlaLank={vi.fn()} sprak="en" />);
    expect(screen.getByRole("textbox", { name: "Send by email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
});

/* ───────────────────────────── dialogen Dela länk för en händelse ───────────────────────────── */

describe("HandelseDelning: Skicka till mejl efter att länken är skapad", () => {
  const nyLank = { id: "n1", url: "https://my.life-hub.app/g/travel/event/resa", rattighet: "las", harKod: false, giltigTill: null };

  async function skapaLank(props = {}) {
    const onDela = vi.fn(async () => nyLank);
    render(<HandelseDelning handelse={{ titel: "Resa", grupp: "Travel" }} delningar={[]} onDela={onDela} onAterkalla={vi.fn()} {...props} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Dela" }));
    return { user, onDela };
  }

  it("⛔ utan onMejlaLank syns inget fält, varken före eller efter att länken skapats", async () => {
    const { user } = await skapaLank();
    expect(screen.queryByRole("textbox", { name: "Skicka till mejl" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Skapa länk" }));
    await screen.findByText(/Länken är skapad/);
    expect(screen.queryByRole("textbox", { name: "Skicka till mejl" })).toBeNull();
    expect(document.querySelector("[data-mejla-lank]")).toBeNull();
  });

  it("med onMejlaLank syns fältet först när länken finns, och anropet bär den NYA länkens id och adress", async () => {
    const onMejlaLank = vi.fn(async () => {});
    const { user } = await skapaLank({ onMejlaLank });
    expect(screen.queryByRole("textbox", { name: "Skicka till mejl" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Skapa länk" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: "Skicka till mejl" }), "kim@exempel.se");
    await user.click(within(dialog).getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(onMejlaLank).toHaveBeenCalledWith({ id: "n1", url: nyLank.url, till: "kim@exempel.se" }));
    expect(await within(dialog).findByText("Skickat till kim@exempel.se.")).toBeInTheDocument();
  });

  it("onMejlaLank måste vara en funktion, och OpsHandelsePanel kräver onDela för den", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<HandelseDelning handelse={{ titel: "R" }} delningar={[]} onDela={vi.fn()} onAterkalla={vi.fn()} onMejlaLank={/** @type {any} */ ("x")} />)).toThrow(/onMejlaLank måste vara en funktion/);
    expect(() => render(<OpsHandelsePanel handelse={{ id: "h", titel: "R", datum: "2026-12-26", grupp: "G" }} onTillbaka={() => {}} onMejlaLank={vi.fn()} />)).toThrow(/hör till onDela/);
    vi.restoreAllMocks();
  });

  it("panelen vidarebefordrar onMejlaLank till dialogen", async () => {
    const onMejlaLank = vi.fn(async () => {});
    render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Resa", datum: "2026-12-26", grupp: "Travel" }} onTillbaka={() => {}} delningar={[]} onDela={vi.fn(async () => nyLank)} onAterkalla={vi.fn()} onMejlaLank={onMejlaLank} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Dela" }));
    await user.click(screen.getByRole("button", { name: "Skapa länk" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: "Skicka till mejl" }), "kim@exempel.se{Enter}");
    await waitFor(() => expect(onMejlaLank).toHaveBeenCalledWith({ id: "n1", url: nyLank.url, till: "kim@exempel.se" }));
  });
});

/* ───────────────────────────── dialogen Dela länk för en biblioteksfil ───────────────────────────── */

describe("OpsBibliotek: Skicka till mejl i dialogen Dela länk", () => {
  const tid = 1_700_000_000_000;
  const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
  const pdf = { ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Avtal", fil: { sokvag: "grupper/cps-ab/bibliotek/p1/a.pdf", namn: "a.pdf", mime: "application/pdf", byte: 2048 }, skapadAv: skapare, skapad: tid, andrad: tid }), id: "p1" };

  function Vy({ onMejlaLank, onDelaLank = vi.fn(async () => ({ id: "d1", url: "https://my.test/g/grupp/lib/avtal-abc" })), delningar = [] }) {
    const [vald, setVald] = useState(null);
    return (
      <OpsBibliotek
        poster={[pdf]}
        platser={[{ id: "cps-ab", namn: "Grupp" }]}
        jag={{ uid: "uid-1", roll: "medlem" }}
        vald={vald}
        onOppna={setVald}
        onStang={() => setVald(null)}
        onSkapa={() => {}}
        onSpara={() => {}}
        delningar={delningar}
        onDelaLank={onDelaLank}
        onAndraNedladdning={vi.fn(async () => {})}
        onAterkalla={vi.fn(async () => {})}
        onMejlaLank={onMejlaLank}
        hubHref="/hub"
      />
    );
  }

  async function oppnaDialogen(user) {
    await user.click(screen.getByRole("button", { name: "Åtgärder för Avtal" }));
    await user.click(screen.getByRole("menuitem", { name: "Dela länk" }));
    return screen.findByRole("dialog", { name: "Dela länk" });
  }

  it("utan onMejlaLank syns inget fält", async () => {
    const user = userEvent.setup();
    render(<Vy />);
    const dialog = await oppnaDialogen(user);
    await user.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await within(dialog).findByRole("button", { name: "Kopiera adressen" });
    expect(within(dialog).queryByRole("textbox", { name: "Skicka till mejl" })).toBeNull();
  });

  it("⛔ med onMejlaLank: fältet syns under den nyskapade adressen, och mejlet bär länkens id och adress", async () => {
    const onMejlaLank = vi.fn(async () => {});
    const user = userEvent.setup();
    render(<Vy onMejlaLank={onMejlaLank} />);
    const dialog = await oppnaDialogen(user);
    expect(within(dialog).queryByRole("textbox", { name: "Skicka till mejl" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await user.type(await within(dialog).findByRole("textbox", { name: "Skicka till mejl" }), "kim@exempel.se");
    await user.click(within(dialog).getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(onMejlaLank).toHaveBeenCalledWith({ id: "d1", url: "https://my.test/g/grupp/lib/avtal-abc", till: "kim@exempel.se" }));
    expect(await within(dialog).findByText("Skickat till kim@exempel.se.")).toBeInTheDocument();
  });

  it("en länk som lever och har en adress har fältet också; en gammal länk utan adress har det inte", async () => {
    const onMejlaLank = vi.fn(async () => {});
    const user = userEvent.setup();
    const { unmount } = render(<Vy onMejlaLank={onMejlaLank} delningar={[{ id: "d9", postId: "p1", giltigTill: tid + 86_400_000, nedladdning: false, url: "https://my.test/g/grupp/lib/gammal-xyz" }]} />);
    let dialog = await oppnaDialogen(user);
    await user.type(within(dialog).getByRole("textbox", { name: "Skicka till mejl" }), "kim@exempel.se{Enter}");
    await waitFor(() => expect(onMejlaLank).toHaveBeenCalledWith({ id: "d9", url: "https://my.test/g/grupp/lib/gammal-xyz", till: "kim@exempel.se" }));
    unmount();
    render(<Vy onMejlaLank={onMejlaLank} delningar={[{ id: "d8", postId: "p1", giltigTill: tid + 86_400_000, nedladdning: false }]} />);
    dialog = await oppnaDialogen(user);
    expect(within(dialog).queryByRole("textbox", { name: "Skicka till mejl" })).toBeNull();
    expect(within(dialog).getByText(/skapad med en äldre version/)).toBeInTheDocument();
  });

  it("onMejlaLank utan onDelaLank kastas: fältet sitter i en dialog som inte finns", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsBibliotek poster={[]} jag={null} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/h" onMejlaLank={vi.fn()} />)).toThrow(/onMejlaLank \(0\.128\.0\) hör till onDelaLank/);
    vi.restoreAllMocks();
  });
});
