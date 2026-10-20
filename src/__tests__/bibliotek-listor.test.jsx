import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/**
 * Listor i Biblioteket (0.128.0, cllp/lifehub.app#378, CP 2026-10-20): "Listor är en post i Biblioteket som pekar på andra poster från samma bibliotek i en bestämd ordning.
 * Poster läggs till med långtryck eller inifrån listan, ordningen ändras genom att dra och posterna tas bort lika lätt."
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const annans = { uid: "uid-2", namn: "Alex", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const SPOTIFY = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";

const anteckning = (id, rubrik, steg = 0) => ({ ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik, text: `Text ${rubrik}`, skapadAv: skapare, skapad: tid, andrad: tid + steg }), id });
const lank = (id, rubrik, url, steg = 0) => ({ ...byggPost({ groupId: "cps-ab", typ: "lank", rubrik, url, skapadAv: skapare, skapad: tid, andrad: tid + steg }), id });
const lista = (id, rubrik, poster, extra = {}) => ({ ...byggPost({ groupId: "cps-ab", typ: "lista", rubrik, poster, skapadAv: skapare, skapad: tid, andrad: tid + 50, ...extra }), id });

const A = anteckning("a", "Alfa", 3);
const B = anteckning("b", "Beta", 2);
const C = lank("c", "Ceta, Artist", SPOTIFY, 1);

/**
 * Värden som sparar: onSpara skriver in ändringen i listan med poster, som en app gör, och skriver upp varje anrop. `fall` låter ett anrop falla.
 */
function Host({ start, jag = JAG, fall = undefined, grupper = [] }) {
  const [poster, setPoster] = useState(start);
  const [vald, setVald] = useState(/** @type {any} */ (null));
  const [skapar, setSkapar] = useState(/** @type {any} */ (null));
  const [anrop, setAnrop] = useState(/** @type {any[]} */ ([]));
  const nr = useRef(0);
  async function onSpara(inm) {
    setAnrop((a) => [...a, inm]);
    if (fall && (await fall(inm)) === false) return false;
    setPoster((prev) => {
      if (inm.id) {
        return prev.map((p) => {
          if (p.id !== inm.id) return p;
          const { id: _id, ...utanId } = p;
          return { ...byggPost({ ...utanId, ...inm, andrad: tid + 100 + nr.current++ }), id: p.id };
        });
      }
      return [...prev, { ...byggPost({ groupId: "cps-ab", ...inm, skapadAv: skapare, skapad: tid, andrad: tid + 200 + nr.current++ }), id: `ny${nr.current}` }];
    });
  }
  return (
    <>
      <OpsBibliotek
        poster={poster}
        jag={jag}
        vald={vald && poster.find((p) => p.id === vald.id)}
        skapar={skapar}
        grupper={grupper}
        onOppna={(p) => { setSkapar(null); setVald(p); }}
        onStang={() => { setVald(null); setSkapar(null); }}
        onSkapa={(typ) => { setVald(null); setSkapar(typ); }}
        onSpara={onSpara}
        hubHref="/hub"
      />
      <div data-anrop="" hidden>{JSON.stringify(anrop)}</div>
    </>
  );
}

const anropen = () => JSON.parse(document.querySelector("[data-anrop]")?.textContent || "[]");
const radIds = () => Array.from(document.querySelectorAll("[data-lista-rad]")).map((r) => r.getAttribute("data-lista-rad"));
const oppnaLista = async (user, namn = "Spellista") => {
  await user.click(screen.getByRole("button", { name: namn }));
};

describe("Ny lista", () => {
  it("Ny post har en rad 'Lista', formuläret har bara en rubrik, och Spara skriver en tom lista (`poster: []`)", async () => {
    const user = userEvent.setup();
    render(<Host start={[A]} />);
    await user.click(screen.getByRole("button", { name: "Ny post" }));
    await user.click(screen.getByRole("menuitem", { name: "Lista" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ny lista");
    expect(screen.getAllByRole("textbox").map((t) => t.getAttribute("aria-label") ?? t.id)).toHaveLength(1);
    expect(screen.queryByRole("textbox", { name: "Adress" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Spara" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Rubriken saknas.");
    expect(anropen()).toHaveLength(0);
    await user.type(screen.getByRole("textbox", { name: "Rubrik" }), "Playlist 1");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    expect(anropen()).toEqual([{ typ: "lista", rubrik: "Playlist 1", poster: [] }]);
  });

  it("under fliken Listor skapar Ny direkt en lista", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, lista("l1", "Spellista", ["a"])]} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Listor/ }), { button: 0 });
    await user.click(screen.getByRole("button", { name: "Ny lista" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ny lista");
  });
});

describe("fliken Listor och listans kort", () => {
  it("⛔ fliken finns bara när det finns en lista, med antalet; Allt visar listorna också", () => {
    const { unmount } = render(<Host start={[A, B]} />);
    expect(screen.queryByRole("tab", { name: /^Listor/ })).toBeNull();
    unmount();
    render(<Host start={[A, B, lista("l1", "Spellista", ["a", "b"]), lista("l2", "Tom", [])]} />);
    const flik = screen.getByRole("tab", { name: /^Listor/ });
    expect(flik).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /^Allt/ })).toHaveTextContent("4");
    fireEvent.mouseDown(flik, { button: 0 });
    expect(screen.getByRole("button", { name: "Spellista" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alfa" })).toBeNull();
  });

  it("kortet säger Lista och hur många poster, och en tom lista säger Tom lista (regel 5)", () => {
    render(<Host start={[A, B, lista("l1", "Spellista", ["a", "b"]), lista("l2", "Tom", []), lista("l3", "Ensam", ["a"])]} />);
    const kort = (namn) => screen.getByRole("button", { name: namn }).closest("[data-bibliotek-kort]");
    expect(kort("Spellista")?.textContent).toContain("2 poster");
    expect(kort("Tom")?.textContent).toContain("Tom lista");
    expect(kort("Ensam")?.textContent).toContain("1 post");
    expect(kort("Spellista")?.querySelector("[data-bibliotek-typ]")?.textContent).toBe("Lista");
  });

  it("menyn för en lista har Byt namn och Radera men varken Lägg i lista eller Flytta/Kopiera (en lista flyttas inte)", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, lista("l1", "Spellista", ["a"])]} grupper={[{ id: "mitt~uid-1", namn: "Mitt bibliotek" }, { id: "miranda-ab", namn: "Miranda" }]} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Spellista" }));
    expect(within(screen.getByRole("menu", { name: "Spellista" })).getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Byt namn", "Radera"]);
    await user.keyboard("{Escape}");
    // En vanlig post på samma plats får däremot flyttvalen.
    await user.click(screen.getByRole("button", { name: "Åtgärder för Alfa" }));
    const rader = within(screen.getByRole("menu", { name: "Alfa" })).getAllByRole("menuitem").map((r) => r.textContent);
    expect(rader).toContain("Lägg i lista");
    expect(rader.some((r) => /Flytta|Kopiera/.test(r ?? ""))).toBe(true);
  });
});

describe("Lägg i lista ur menyn", () => {
  it("läggs sist i en befintlig lista, med besked, och listans antal stiger", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, B, lista("l1", "Spellista", ["b"])]} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Alfa" }));
    await user.click(screen.getByRole("menuitem", { name: "Lägg i lista" }));
    expect(screen.getByRole("dialog", { name: "Lägg i lista" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lägg i Spellista" }));
    await waitFor(() => expect(anropen()).toEqual([{ id: "l1", typ: "lista", rubrik: "Spellista", poster: ["b", "a"] }]));
    expect(await screen.findByRole("status")).toHaveTextContent("Alfa är lagd i listan Spellista.");
    expect(screen.queryByRole("dialog", { name: "Lägg i lista" })).toBeNull();
    expect(screen.getByRole("button", { name: "Spellista" }).closest("[data-bibliotek-kort]")?.textContent).toContain("2 poster");
  });

  it("⛔ ligger posten redan i listan skrivs ingenting, och det sägs", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, lista("l1", "Spellista", ["a"])]} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Alfa" }));
    await user.click(screen.getByRole("menuitem", { name: "Lägg i lista" }));
    await user.click(screen.getByRole("button", { name: "Lägg i Spellista" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Alfa ligger redan i listan Spellista.");
    expect(anropen()).toHaveLength(0);
  });

  it("en NY lista med posten i: namnet krävs, och listan skrivs med postens id", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, B]} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Beta" }));
    await user.click(screen.getByRole("menuitem", { name: "Lägg i lista" }));
    // Inga listor än: det sägs, och en ny lista går att göra.
    expect(screen.getByText("Det finns inga listor du kan lägga till i än.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skapa lista" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Rubriken saknas.");
    expect(anropen()).toHaveLength(0);
    await user.type(screen.getByRole("textbox"), "Ny favoritlista");
    await user.click(screen.getByRole("button", { name: "Skapa lista" }));
    await waitFor(() => expect(anropen()).toEqual([{ typ: "lista", rubrik: "Ny favoritlista", poster: ["b"] }]));
    expect(await screen.findByRole("status")).toHaveTextContent("Listan Ny favoritlista är gjord, med Beta i.");
    expect(screen.getByRole("button", { name: "Ny favoritlista" })).toBeInTheDocument();
  });

  it("⛔ bara listor personen får ändra erbjuds: någon annans lista syns inte, och en admins syns", async () => {
    const annansLista = lista("l2", "Alex lista", ["b"], { skapadAv: annans });
    const egen = lista("l1", "Min lista", ["b"]);
    const user = userEvent.setup();
    const { unmount } = render(<Host start={[A, egen, annansLista]} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Alfa" }));
    await user.click(screen.getByRole("menuitem", { name: "Lägg i lista" }));
    expect(screen.getByRole("button", { name: "Lägg i Min lista" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lägg i Alex lista" })).toBeNull();
    unmount();
    render(<Host start={[A, egen, annansLista]} jag={{ uid: "uid-9", roll: "admin" }} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Alfa" }));
    await user.click(screen.getByRole("menuitem", { name: "Lägg i lista" }));
    expect(screen.getByRole("button", { name: "Lägg i Min lista" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lägg i Alex lista" })).toBeInTheDocument();
  });

  it("⛔ faller sparandet står orsaken kvar i rutan, och ingenting är hälften gjort", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, lista("l1", "Spellista", ["b"])]} fall={async () => { throw new Error("Nätverket föll."); }} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Alfa" }));
    await user.click(screen.getByRole("menuitem", { name: "Lägg i lista" }));
    await user.click(screen.getByRole("button", { name: "Lägg i Spellista" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nätverket föll.");
    expect(screen.getByRole("dialog", { name: "Lägg i lista" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("ingen 'Lägg i lista' för den som inte är medlem", async () => {
    const user = userEvent.setup();
    render(<Host start={[A]} jag={null} />);
    expect(screen.queryByRole("button", { name: "Åtgärder för Alfa" })).toBeNull();
    void user;
  });
});

describe("listans detalj", () => {
  const start = () => [A, B, C, lista("l1", "Spellista", ["c", "a", "b"])];

  it("visar posterna i listans ordning, med typ, och en musiklänk som en riktig länk", async () => {
    const user = userEvent.setup();
    render(<Host start={start()} />);
    await oppnaLista(user);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Spellista");
    expect(radIds()).toEqual(["c", "a", "b"]);
    const rader = document.querySelectorAll("[data-lista-rad]");
    expect(rader[0]?.textContent).toContain("Ceta, Artist");
    expect(rader[0]?.textContent).toContain("Länk · Spotify");
    expect(within(/** @type {HTMLElement} */ (rader[0])).getByRole("link", { name: "Öppna Ceta, Artist" })).toHaveAttribute("href", SPOTIFY);
    expect(within(/** @type {HTMLElement} */ (rader[1])).getByRole("button", { name: "Öppna Alfa" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Posterna i Spellista" }).tagName).toBe("OL");
  });

  it("ett tryck på en post (inte en musiklänk) öppnar den", async () => {
    const user = userEvent.setup();
    render(<Host start={start()} />);
    await oppnaLista(user);
    await user.click(screen.getByRole("button", { name: "Öppna Alfa" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Alfa");
  });

  it("⛔ en tom lista säger det, och hur man lägger till", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, lista("l1", "Spellista", [])]} />);
    await oppnaLista(user);
    expect(document.querySelector("[data-bibliotek-lista-tom]")).toHaveTextContent("Listan är tom. Lägg till poster med knappen ovan, eller ur menyn på en post.");
    expect(radIds()).toEqual([]);
  });

  it("⛔ en post som tagits bort står kvar som 'Finns inte längre': inget filtreras tyst, och raden går att ta bort", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, lista("l1", "Spellista", ["a", "borta1", "borta2"])]} />);
    await oppnaLista(user);
    expect(radIds()).toEqual(["a", "borta1", "borta2"]);
    const saknade = document.querySelectorAll("[data-lista-saknas='saknas']");
    expect(saknade).toHaveLength(2);
    expect(saknade[0]).toHaveTextContent("Finns inte längre");
    expect(screen.getAllByRole("button", { name: "Ta bort raden som inte finns längre ur listan" })).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "Ta bort raden som inte finns längre ur listan" })[0]);
    await waitFor(() => expect(anropen().at(-1)).toMatchObject({ poster: ["a", "borta2"] }));
    expect(radIds()).toEqual(["a", "borta2"]);
  });

  it("⛔ BARA FRÅN SAMMA PLATS: ett id från en annan plats visas som 'Finns inte längre', aldrig dess innehåll", async () => {
    const user = userEvent.setup();
    // `utomplats` är en post i en annan grupp. Vyn har aldrig fått den, så listan som pekar på den kan inte visa den.
    render(<Host start={[A, lista("l1", "Spellista", ["utomplats", "a"])]} />);
    await oppnaLista(user);
    expect(document.querySelector("[data-lista-rad='utomplats']")).toHaveTextContent("Finns inte längre");
    expect(screen.queryByText(/Text utomplats/)).toBeNull();
  });

  it("en lista i listan visas inte som innehåll: raden säger det och kan tas bort", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, lista("l2", "Annan", []), lista("l1", "Spellista", ["l2", "a"])]} />);
    await oppnaLista(user);
    expect(document.querySelector("[data-lista-rad='l2']")).toHaveTextContent("Listor kan inte ligga i en lista.");
    expect(document.querySelector("[data-lista-rad='l2'] [data-lista-bort]")).not.toBeNull();
  });

  it("⛔ den som inte får ändra listan ser den men har varken grepp, ta bort eller Lägg till", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, B, lista("l1", "Alex lista", ["a", "b"], { skapadAv: annans })]} />);
    await user.click(screen.getByRole("button", { name: "Alex lista" }));
    expect(radIds()).toEqual(["a", "b"]);
    expect(document.querySelector("[data-lista-grepp]")).toBeNull();
    expect(document.querySelector("[data-lista-bort]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lägg till" })).toBeNull();
    // Posterna går ändå att öppna.
    expect(screen.getByRole("button", { name: "Öppna Alfa" })).toBeInTheDocument();
  });
});

describe("ordningen: tangentbord och drag", () => {
  const start = () => [A, B, C, lista("l1", "Spellista", ["c", "a", "b"])];

  it("⛔ pil ned på greppet flyttar raden ett steg och sparar listan, fokus följer med, och pil upp flyttar tillbaka", async () => {
    const user = userEvent.setup();
    render(<Host start={start()} />);
    await oppnaLista(user);
    const grepp = () => /** @type {HTMLElement} */ (document.querySelector("[data-lista-grepp='c']"));
    grepp().focus();
    expect(grepp()).toHaveAttribute("aria-keyshortcuts", "ArrowUp ArrowDown");
    expect(grepp().getAttribute("aria-label")).toMatch(/^Flytta Ceta, Artist, plats 1 av 3\./);
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(anropen().at(-1)).toEqual({ id: "l1", typ: "lista", rubrik: "Spellista", poster: ["a", "c", "b"] }));
    expect(radIds()).toEqual(["a", "c", "b"]);
    expect(document.activeElement).toBe(grepp());
    expect(grepp().getAttribute("aria-label")).toMatch(/plats 2 av 3/);
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(anropen().at(-1)).toMatchObject({ poster: ["c", "a", "b"] }));
    expect(radIds()).toEqual(["c", "a", "b"]);
  });

  it("översta raden kan inte flyttas upp och understa inte ned: inget sparas", async () => {
    const user = userEvent.setup();
    render(<Host start={start()} />);
    await oppnaLista(user);
    /** @type {HTMLElement} */ (document.querySelector("[data-lista-grepp='c']")).focus();
    await user.keyboard("{ArrowUp}");
    /** @type {HTMLElement} */ (document.querySelector("[data-lista-grepp='b']")).focus();
    await user.keyboard("{ArrowDown}");
    expect(anropen()).toHaveLength(0);
    expect(radIds()).toEqual(["c", "a", "b"]);
  });

  it("⛔ drag: greppet släppt på en annan rad lägger raden där den raden stod, och sparar", async () => {
    const user = userEvent.setup();
    render(<Host start={start()} />);
    await oppnaLista(user);
    const grepp = /** @type {HTMLElement} */ (document.querySelector("[data-lista-grepp='c']"));
    const sista = /** @type {HTMLElement} */ (document.querySelector("[data-lista-rad='b']"));
    fireEvent.pointerDown(grepp, { button: 0, pointerId: 1 });
    expect(document.querySelector("[data-lista-drar]")).toHaveAttribute("data-lista-rad", "c");
    fireEvent.pointerMove(sista, { pointerId: 1 });
    expect(document.querySelector("[data-lista-mal]")).toHaveAttribute("data-lista-rad", "b");
    fireEvent.pointerUp(sista, { pointerId: 1 });
    await waitFor(() => expect(anropen().at(-1)).toEqual({ id: "l1", typ: "lista", rubrik: "Spellista", poster: ["a", "b", "c"] }));
    expect(radIds()).toEqual(["a", "b", "c"]);
    expect(document.querySelector("[data-lista-drar]")).toBeNull();
  });

  it("ett släpp på samma rad, utanför raderna eller efter ett avbrott ändrar ingenting", async () => {
    const user = userEvent.setup();
    render(<Host start={start()} />);
    await oppnaLista(user);
    const grepp = /** @type {HTMLElement} */ (document.querySelector("[data-lista-grepp='c']"));
    fireEvent.pointerDown(grepp, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(grepp, { pointerId: 1 });
    fireEvent.pointerDown(grepp, { button: 0, pointerId: 1 });
    fireEvent.pointerCancel(grepp, { pointerId: 1 });
    fireEvent.pointerUp(document.querySelector("[data-lista-rad='a']") ?? grepp, { pointerId: 1 });
    expect(anropen()).toHaveLength(0);
    expect(radIds()).toEqual(["c", "a", "b"]);
    // Inget drag utan att börja på ett grepp.
    fireEvent.pointerDown(/** @type {HTMLElement} */ (document.querySelector("[data-lista-rad='a']")), { button: 0, pointerId: 1 });
    fireEvent.pointerUp(/** @type {HTMLElement} */ (document.querySelector("[data-lista-rad='b']")), { pointerId: 1 });
    expect(anropen()).toHaveLength(0);
  });

  it("⛔ en ordning som inte sparades rullas tillbaka och felet står kvar (regel 5)", async () => {
    const user = userEvent.setup();
    render(<Host start={start()} fall={async () => { throw new Error("Reglerna nekade."); }} />);
    await oppnaLista(user);
    /** @type {HTMLElement} */ (document.querySelector("[data-lista-grepp='c']")).focus();
    await user.keyboard("{ArrowDown}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Reglerna nekade.");
    await waitFor(() => expect(radIds()).toEqual(["c", "a", "b"]));
  });

  it("två snabba flytt skrivs i tur och ordning, den andra med den förstas resultat", async () => {
    const user = userEvent.setup();
    /** @type {Array<() => void>} */
    const slapp = [];
    render(<Host start={start()} fall={() => new Promise((res) => { slapp.push(() => res(undefined)); })} />);
    await oppnaLista(user);
    /** @type {HTMLElement} */ (document.querySelector("[data-lista-grepp='c']")).focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    // Båda ändringarna syns direkt (optimistiskt)...
    expect(radIds()).toEqual(["a", "b", "c"]);
    // ...men det andra anropet startar först när det första är klart.
    await waitFor(() => expect(anropen()).toHaveLength(1));
    expect(anropen()[0].poster).toEqual(["a", "c", "b"]);
    await act(async () => { slapp[0](); });
    await waitFor(() => expect(anropen()).toHaveLength(2));
    expect(anropen()[1].poster).toEqual(["a", "b", "c"]);
    await act(async () => { slapp[1](); });
  });
});

describe("att ta bort och lägga till inifrån listan", () => {
  const start = () => [A, B, C, lista("l1", "Spellista", ["a"])];

  it("X tar bort posten ur listan men inte ur biblioteket", async () => {
    const user = userEvent.setup();
    render(<Host start={start()} />);
    await oppnaLista(user);
    await user.click(screen.getByRole("button", { name: "Ta bort Alfa ur listan" }));
    await waitFor(() => expect(anropen().at(-1)).toEqual({ id: "l1", typ: "lista", rubrik: "Spellista", poster: [] }));
    expect(radIds()).toEqual([]);
    expect(screen.getByText(/Listan är tom/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    expect(screen.getByRole("button", { name: "Alfa" })).toBeInTheDocument();
  });

  it("Lägg till öppnar en ruta med platsens poster som inte redan ligger i listan, och varje val läggs sist", async () => {
    const user = userEvent.setup();
    render(<Host start={[...start(), lista("l2", "Annan lista", [])]} />);
    await oppnaLista(user);
    await user.click(screen.getByRole("button", { name: "Lägg till" }));
    const ruta = screen.getByRole("dialog", { name: "Lägg till i listan" });
    const kandidater = Array.from(ruta.querySelectorAll("[data-lista-kandidat]")).map((r) => r.getAttribute("data-lista-kandidat"));
    // Inte `a` (ligger redan i listan) och inte `l2` (en lista).
    expect(kandidater.sort()).toEqual(["b", "c"]);
    await user.click(within(ruta).getByRole("button", { name: "Lägg till Ceta, Artist" }));
    await waitFor(() => expect(anropen().at(-1)).toEqual({ id: "l1", typ: "lista", rubrik: "Spellista", poster: ["a", "c"] }));
    // Posten är borta ur kandidaterna men rutan står kvar, så fler går att lägga till.
    await waitFor(() => expect(ruta.querySelector("[data-lista-kandidat='c']")).toBeNull());
    await user.click(within(ruta).getByRole("button", { name: "Lägg till Beta" }));
    await waitFor(() => expect(anropen().at(-1)).toMatchObject({ poster: ["a", "c", "b"] }));
    await waitFor(() => expect(ruta.querySelector("[data-bibliotek-lista-inget]")).toHaveTextContent("Det finns inget mer att lägga till."));
    await user.click(within(ruta).getByRole("button", { name: "Klar" }));
    expect(radIds()).toEqual(["a", "c", "b"]);
  });

  it("rutan går att söka i, och en sökning utan träff säger det", async () => {
    const user = userEvent.setup();
    render(<Host start={start()} />);
    await oppnaLista(user);
    await user.click(screen.getByRole("button", { name: "Lägg till" }));
    const ruta = screen.getByRole("dialog", { name: "Lägg till i listan" });
    await user.type(within(ruta).getByRole("searchbox", { name: "Sök bland posterna" }), "beta");
    expect(Array.from(ruta.querySelectorAll("[data-lista-kandidat]")).map((r) => r.getAttribute("data-lista-kandidat"))).toEqual(["b"]);
    await user.clear(within(ruta).getByRole("searchbox", { name: "Sök bland posterna" }));
    await user.type(within(ruta).getByRole("searchbox", { name: "Sök bland posterna" }), "zzz");
    expect(ruta).toHaveTextContent('Inget matchar "zzz".');
  });

  it("en full lista (200) har en avstängd Lägg till som säger varför", async () => {
    const ids = Array.from({ length: 200 }, (_, i) => `p${i}`);
    const user = userEvent.setup();
    render(<Host start={[A, lista("l1", "Spellista", ids)]} />);
    await oppnaLista(user);
    expect(screen.getByRole("button", { name: "Lägg till" })).toBeDisabled();
    expect(screen.getByText("Listan är full: högst 200 poster.")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-lista-rad]")).toHaveLength(200);
  });

  it("Byt namn på en lista behåller posterna", async () => {
    const user = userEvent.setup();
    render(<Host start={[A, B, lista("l1", "Spellista", ["b", "a"])]} />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Spellista" }));
    await user.click(screen.getByRole("menuitem", { name: "Byt namn" }));
    await user.clear(screen.getByRole("textbox", { name: "Nytt namn" }));
    await user.type(screen.getByRole("textbox", { name: "Nytt namn" }), "Bästa");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(anropen()).toEqual([{ id: "l1", typ: "lista", rubrik: "Bästa", poster: ["b", "a"] }]));
  });
});
