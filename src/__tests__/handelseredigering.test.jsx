import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell, useOppnaSkapa } from "../components/OpsAppShell.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";

/**
 * 0.40.0 (#214): att ändra en händelse. Pennan i händelsepanelen och skapa-panelen i redigeringsläge.
 *
 * ⛔ Händelsen: CP 2026-10-01: "Kolla med sessionstudio också så att det går att editera en händelse." Händelsepanelen (#214) hade en
 * plats för appens knappar men ingen penna, och skapa-panelen kunde bara skapa. SS har en penna i titelraden som öppnar SAMMA formulär,
 * förifyllt, och Tillbaka därifrån går till händelsen.
 *
 * Provet mäter det en person gör: trycker på pennan, ser formuläret med händelsens värden, ändrar, sparar och ser den ändrade händelsen
 * (eller trycker Tillbaka och ser den oförändrad). Utseendet mäts i webbläsaren (check-skalyta avsnitt 35).
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const nav = [{ href: "/", label: "Idag" }];
const kalendrar = {
  gruppens: [
    { id: "styrelse", namn: { sv: "Styrelse" }, farg: 1, ikon: "kalender", forvald: true, ordning: 0, arkiverad: false },
    { id: "resor", namn: { sv: "Resor" }, farg: 2, ikon: "kalender", forvald: false, ordning: 10, arkiverad: false },
  ],
  mina: [{ id: "privat", namn: "Privat", farg: 5, ikon: "hjarta", ordning: 0, forvald: true, iFlodet: false, arkiverad: false }],
};

/**
 * En liten app: händelserna i state, panelen med pennan, och ett formulär som sparar. Formulärets värden kommer ur händelsen (`redigera`),
 * och skalets val (typ, kalender, Kräv svar) kommer som props, så provet kan se att skalet fyllde i dem.
 * @param {{ start?: any[], tillat?: boolean, hook?: (id: string) => any, ladda?: boolean }} props
 */
function App({ start, tillat = true, hook, extraSkapa = {}, kravSvarFor }) {
  const [rader, setRader] = useState(
    start ?? [{ id: "h1", rubrik: "Styrelsemöte", datum: "2026-10-12", typ: "mote", kalenderId: "resor", kravSvar: true }],
  );
  /** @type {(id: string) => any} */
  const standardHook = (id) => {
    const r = rader.find((x) => x.id === id);
    return r ? { laddar: false, finns: true, typ: r.typ, kalenderId: r.kalenderId ?? "styrelse", kravSvar: r.kravSvar === true } : { laddar: false, finns: false };
  };
  function Form(/** @type {any} */ p) {
    const r = rader.find((x) => x.id === p.redigera);
    const [rubrik, setRubrik] = useState(r?.rubrik ?? "");
    return (
      <form
        id={p.formId}
        aria-label="Händelseformulär"
        onSubmit={(e) => {
          e.preventDefault();
          setRader((rs) => rs.map((x) => (x.id === p.redigera ? { ...x, rubrik, typ: p.typ, kalenderId: p.kalender?.id, kravSvar: p.kravSvar } : x)));
          p.onKlar();
        }}
      >
        <label>
          Rubrik
          <input value={rubrik} onChange={(e) => setRubrik(e.target.value)} />
        </label>
        <p data-vals="">{`${p.typ}|${p.kalender?.id}|${p.kravSvar}|${p.redigera}`}</p>
      </form>
    );
  }
  function Panel({ id, onTillbaka }) {
    const oppna = useOppnaSkapa();
    const h = rader.find((x) => x.id === id);
    return <OpsHandelsePanel handelse={h ? { id, titel: h.rubrik, datum: h.datum } : null} onTillbaka={onTillbaka} onRedigera={tillat ? () => oppna("handelse", { id }) : undefined} />;
  }
  return (
    <OpsAppShell
      brand="Ops"
      nav={nav}
      activeHref="/"
      grupper={{ lista: [{ id: "g1", namn: "CPS AB", roll: "agare" }], aktiv: "g1", onValj: () => {} }}
      handelsepanel={{ rita: ({ id, onTillbaka }) => <Panel id={id} onTillbaka={onTillbaka} /> }}
      skapa={{
        sparaEtikett: "Spara",
        lage: "g1",
        handelse: { form: Form, katalog: "handelsetyper", kalendrar, redigera: hook ?? standardHook, ...(kravSvarFor ? { kravSvarFor } : {}) },
        kataloger: [{ id: "handelsetyper", kategorier: [{ id: "mote", namn: { sv: "Möte" }, ordning: 0 }, { id: "resa", namn: { sv: "Resa" }, ordning: 1 }] }],
        ...extraSkapa,
      }}
    >
      <p>appens vy</p>
    </OpsAppShell>
  );
}

const param = (/** @type {string} */ n) => new URL(window.location.href).searchParams.get(n);
const panelen = () => document.querySelector("[data-handelsepanel]");

describe("OpsHandelsePanel: pennan", () => {
  it("syns med `onRedigera`, med namnet Redigera, och är minst 44 px under md", () => {
    render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Möte", datum: "2026-10-12" }} onTillbaka={() => {}} onRedigera={() => {}} />);
    const penna = screen.getByRole("button", { name: "Redigera" });
    expect(penna).toHaveAttribute("title", "Redigera");
    expect(penna.className).toMatch(/\bsize-11\b/);
    expect(penna.className).toMatch(/\bmd:size-9\b/);
    // Titelraden: samma rad som rubriken.
    expect(penna.closest("div")?.parentElement).toBe(screen.getByRole("heading", { level: 1 }).parentElement);
  });

  it("syns inte utan `onRedigera`: den som inte får ändra ser ingen knapp som nekas", () => {
    render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Möte", datum: "2026-10-12" }} onTillbaka={() => {}} />);
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
  });

  it("etiketten går att byta, och pennan står före appens egna åtgärder", () => {
    render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Möte", datum: "2026-10-12" }} onTillbaka={() => {}} onRedigera={() => {}} redigeraEtikett="Edit" atgarder={<button type="button">Exportera</button>} />);
    const knappar = within(screen.getByRole("heading", { level: 1 }).parentElement).getAllByRole("button");
    expect(knappar.map((k) => k.getAttribute("aria-label") ?? k.textContent)).toEqual(["Edit", "Exportera"]);
  });

  it("en `onRedigera` som inte är en funktion kastar", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsHandelsePanel handelse={null} onTillbaka={() => {}} onRedigera="ja" />)).toThrow(/onRedigera måste vara en funktion/);
    spy.mockRestore();
  });
});

describe("skalet: redigeringsläget i skapa-panelen", () => {
  it("⛔ 0.47.0 (bolag-ops#538): händelsens eget Kräv svar gäller, inte typens policy", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?handelse=h1");
    render(<App start={[{ id: "h1", rubrik: "Middag", datum: "2026-10-12", typ: "resa", kalenderId: "resor", kravSvar: false }]} kravSvarFor={(t) => t === "resa"} />);
    await user.click(await screen.findByRole("button", { name: "Redigera" }));
    await waitFor(() => expect(document.querySelector("[data-vals]")?.textContent).toBe("resa|resor|false|h1"));
    expect(screen.getByRole("switch", { name: /Kräv svar/ })).not.toBeChecked();
  });

  async function oppnaPanelOchPenna() {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?handelse=h1");
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Redigera" }));
    return user;
  }

  it("pennan öppnar 'Redigera händelse' med skalets val ifyllda ur händelsen, och adressen bär redigera=h1", async () => {
    await oppnaPanelOchPenna();
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    expect(within(p).getByRole("heading", { level: 2, name: "Redigera händelse" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Ny händelse" })).toBeNull();
    // typ, kalender, Kräv svar och händelsens id: det skalet fyllde i innan formuläret monterades.
    await waitFor(() => expect(within(p).getByText("mote|resor|true|h1")).toBeInTheDocument());
    expect(within(p).getByRole("textbox", { name: "Rubrik" })).toHaveValue("Styrelsemöte");
    expect(within(p).getByRole("button", { name: "Kalender: Resor" })).toBeInTheDocument();
    expect(within(p).getByRole("switch", { name: /Kräv svar/ })).toBeChecked();
    expect([param("skapa"), param("redigera"), param("handelse")]).toEqual(["handelse", "h1", "h1"]);
  });

  it("Tillbaka går tillbaka till händelsepanelen utan att spara, och adressen tappar redigera", async () => {
    const user = await oppnaPanelOchPenna();
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    await user.clear(within(p).getByRole("textbox", { name: "Rubrik" }));
    await user.type(within(p).getByRole("textbox", { name: "Rubrik" }), "Annat");
    await user.click(within(p).getAllByRole("button", { name: "Tillbaka" })[0]);
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Styrelsemöte" })).toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "Redigera händelse" })).toBeNull();
    expect([param("skapa"), param("redigera"), param("handelse")]).toEqual([null, null, "h1"]);
  });

  it("webbläsarens bakåt är samma gest som Tillbaka", async () => {
    await oppnaPanelOchPenna();
    await screen.findByRole("region", { name: "Redigera händelse" });
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Styrelsemöte" })).toBeInTheDocument());
    expect(panelen()).not.toBeNull();
  });

  it("Spara skriver ändringen och händelsepanelen visar den ändrade händelsen", async () => {
    const user = await oppnaPanelOchPenna();
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    await user.clear(within(p).getByRole("textbox", { name: "Rubrik" }));
    await user.type(within(p).getByRole("textbox", { name: "Rubrik" }), "Flyttat möte");
    await user.click(within(p).getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Flyttat möte" })).toBeInTheDocument());
    expect([param("skapa"), param("redigera")]).toEqual([null, null]);
  });

  it("en omladdning på adressen öppnar samma redigeringspanel", async () => {
    window.history.replaceState(null, "", "/?handelse=h1&skapa=handelse&redigera=h1");
    render(<App />);
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    await waitFor(() => expect(within(p).getByText("mote|resor|true|h1")).toBeInTheDocument());
  });

  it("en händelse som inte finns ger 'Händelsen finns inte' med Tillbaka, och inget formulär som sparar en ny rad", async () => {
    window.history.replaceState(null, "", "/?skapa=handelse&redigera=saknas");
    render(<App />);
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    expect(within(p).getByText("Händelsen finns inte")).toBeInTheDocument();
    expect(within(p).queryByRole("form")).toBeNull();
    expect(within(p).getAllByRole("button", { name: "Tillbaka" }).length).toBeGreaterThan(0);
  });

  it("ett läsfel skrivs ut med sin orsak och är inte 'Händelsen finns inte'", async () => {
    window.history.replaceState(null, "", "/?skapa=handelse&redigera=h1");
    render(<App hook={() => ({ laddar: false, finns: false, fel: new Error("Missing or insufficient permissions.") })} />);
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    expect(within(p).getByText("Händelsen kunde inte läsas")).toBeInTheDocument();
    expect(within(p).getByText("Missing or insufficient permissions.")).toBeInTheDocument();
    expect(within(p).queryByText("Händelsen finns inte")).toBeNull();
  });

  it("väljaren i redigeringsläget har gruppens kalendrar men inte Mina kalendrar (en händelse blir inte en egen post), medan Ny händelse har båda", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?skapa=handelse&redigera=h1");
    const { unmount } = render(<App />);
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    await user.click(await within(p).findByRole("button", { name: "Kalender: Resor" }));
    const v = await screen.findByRole("dialog", { name: "Kalender" });
    expect(within(v).getByRole("region", { name: "CPS AB: kalendrar" })).toBeInTheDocument();
    expect(within(v).queryByRole("region", { name: "Mina kalendrar" })).toBeNull();
    unmount();
    window.history.replaceState(null, "", "/?skapa=handelse");
    render(<App />);
    const ny = await screen.findByRole("region", { name: "Ny händelse" });
    await user.click(await within(ny).findByRole("button", { name: /^Kalender:/ }));
    const v2 = await screen.findByRole("dialog", { name: "Kalender" });
    expect(within(v2).getByRole("region", { name: "Mina kalendrar" })).toBeInTheDocument();
  });

  it("⛔ när formuläret väl ritats byts det inte ut: en händelse som försvinner ur läsningen medan man skriver tar inte bort det man skrivit", async () => {
    /** @type {Set<() => void>} */
    const lyssnare = new Set();
    let finns = true;
    function hook() {
      const [, tick] = useState(0);
      useEffect(() => {
        const l = () => tick((x) => x + 1);
        lyssnare.add(l);
        return () => lyssnare.delete(l);
      }, []);
      return finns ? { laddar: false, finns: true, typ: "mote", kalenderId: "styrelse", kravSvar: false } : { laddar: false, finns: false };
    }
    window.history.replaceState(null, "", "/?skapa=handelse&redigera=h1");
    render(<App hook={hook} />);
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    const rubrik = await within(p).findByRole("textbox", { name: "Rubrik" });
    await userEvent.setup().type(rubrik, " (utkast)");
    finns = false;
    act(() => lyssnare.forEach((l) => l()));
    expect(within(p).getByRole("textbox", { name: "Rubrik" })).toHaveValue("Styrelsemöte (utkast)");
    expect(within(p).queryByText("Händelsen finns inte")).toBeNull();
  });

  it("medan händelsen läses ritas en väntan, inte ett tomt formulär", async () => {
    window.history.replaceState(null, "", "/?skapa=handelse&redigera=h1");
    render(<App hook={() => ({ laddar: true, finns: false })} />);
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    expect(within(p).getAllByText("Hämtar händelsen").length).toBeGreaterThan(0);
    expect(within(p).queryByRole("form")).toBeNull();
  });

  it("utan `redigera` på skapa.handelse kastar oppna, och ett id i adressen ignoreras", async () => {
    let fel = /** @type {any} */ (null);
    function Prov() {
      const oppna = useOppnaSkapa();
      return <button type="button" onClick={() => { try { oppna("handelse", { id: "h1" }); } catch (e) { fel = e; } }}>Prova</button>;
    }
    render(
      <OpsAppShell brand="Ops" nav={nav} activeHref="/" skapa={{ sparaEtikett: "Spara", lage: "g1", handelse: { form: () => <form />, katalog: null } }}>
        <Prov />
      </OpsAppShell>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Prova" }));
    expect(String(fel?.message)).toMatch(/kräver `skapa.handelse` som ett formulär med `redigera`/);
    expect(screen.queryByRole("region", { name: /händelse/i })).toBeNull();
  });

  it("id gäller bara händelsen och kan inte kombineras med datum", async () => {
    /** @type {any[]} */
    const fel = [];
    function Prov() {
      const oppna = useOppnaSkapa();
      return (
        <>
          <button type="button" onClick={() => { try { oppna("arende", { id: "h1" }); } catch (e) { fel.push(e); } }}>Ett</button>
          <button type="button" onClick={() => { try { oppna("handelse", { id: "h1", datum: "2026-10-12" }); } catch (e) { fel.push(e); } }}>Två</button>
          <button type="button" onClick={() => { try { oppna("handelse", { id: "" }); } catch (e) { fel.push(e); } }}>Tre</button>
        </>
      );
    }
    render(
      <OpsAppShell brand="Ops" nav={nav} activeHref="/" skapa={{ sparaEtikett: "Spara", lage: "g1", arende: <p>ä</p>, handelse: { form: () => <form />, katalog: null, redigera: () => ({ laddar: false, finns: false }) } }}>
        <Prov />
      </OpsAppShell>,
    );
    const user = userEvent.setup();
    for (const n of ["Ett", "Två", "Tre"]) await user.click(screen.getByRole("button", { name: n }));
    expect(fel.map((e) => String(e.message))).toEqual([expect.stringMatching(/id gäller bara "handelse"/), expect.stringMatching(/id och datum hör inte ihop/), expect.stringMatching(/id måste vara händelsens id/)]);
  });

  it("utan penna (appen ger ingen `onRedigera`) finns ingen väg in i redigeringsläget från panelen", async () => {
    window.history.replaceState(null, "", "/?handelse=h1");
    render(<App tillat={false} />);
    await screen.findByRole("heading", { level: 1, name: "Styrelsemöte" });
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
  });

  it("Ny händelse är oförändrad: rubriken, inget redigera i adressen och formuläret får inget `redigera`", async () => {
    const user = userEvent.setup();
    function Knapp() {
      const oppna = useOppnaSkapa();
      return <button type="button" onClick={() => oppna("handelse")}>Ny</button>;
    }
    const spy = vi.fn();
    function Form(/** @type {any} */ p) {
      spy(p.redigera);
      return <form id={p.formId} aria-label="f" />;
    }
    render(
      <OpsAppShell brand="Ops" nav={nav} activeHref="/" skapa={{ sparaEtikett: "Spara", lage: "g1", handelse: { form: Form, katalog: null, redigera: () => ({ laddar: false, finns: false }) } }}>
        <Knapp />
      </OpsAppShell>,
    );
    await user.click(screen.getByRole("button", { name: "Ny" }));
    await screen.findByRole("region", { name: "Ny händelse" });
    expect(param("redigera")).toBeNull();
    expect(spy).toHaveBeenCalledWith(undefined);
  });
});
