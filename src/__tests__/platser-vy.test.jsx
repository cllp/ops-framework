import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsPlatsfiler } from "../components/OpsPlatsfiler.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { arendeBibliotek, byggPost, mittBibliotek, platsBibliotek } from "../lib/bibliotek.js";
import { defineModule } from "../lib/modul.js";
import { lasPlatser, platsval } from "../lib/platser.js";

/**
 * Gruppens egna platser i vyn (0.155.0, cllp/ops-framework#469): raden "Ny plats", sökfältet över åtta, Byt namn och Arkivera, avsnittet Platser under kugghjulet, och Flytta UT ur ett objekts filer.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött mot 0.154.0:s komponenter (propen finns inte, raderna ritas inte), grönt med grenen. Utfallen står i PR-texten.
 */

const GRUPP = "cps-ab";
const KIM = "uidKim";
const ANNA = "uidAnna";
const NU = 1_800_000_000_000;
const skapare = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" });
const rad = (id, namn, extra = {}) => ({ id: `${GRUPP}|${id}`, groupId: GRUPP, namn, skapadAv: skapare(KIM), skapad: NU, arkiverad: false, ...extra });
const platserUr = (rader) => lasPlatser(rader).platser;
const jag = (uid = KIM, roll = "medlem") => ({ uid, roll, groupId: GRUPP, status: "aktiv" });
const GRUPPEN = { id: GRUPP, namn: "Music" };
const MITT = { id: mittBibliotek(KIM), namn: "Mitt bibliotek" };

function Vy({ egna, jagg = jag(), platser, plats = GRUPP, onPlats = vi.fn(), grupper, onDela, extra = {} }) {
  const [vald, setVald] = useState(null);
  const lista = platser ?? [GRUPPEN, MITT, ...platsval(egna?.platser ?? [])];
  return (
    <OpsBibliotek
      poster={[]}
      jag={jagg}
      vald={vald}
      onOppna={setVald}
      onStang={() => setVald(null)}
      onSkapa={() => {}}
      onSpara={() => {}}
      platser={lista}
      plats={plats}
      onPlats={onPlats}
      grupper={grupper ?? lista}
      onDela={onDela}
      egnaPlatser={egna}
      hubHref="/hub"
      {...extra}
    />
  );
}

const oppnaVaxlaren = async (namn = /Vilket bibliotek/) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: namn }));
  return user;
};

describe("Raden Ny plats i växlaren", () => {
  it("ritas sist i listan när appen ger onNy, och inte alls utan den (förvalet är oförändrat)", async () => {
    const egna = { platser: platserUr([rad("demos", "Demos")]), onNy: vi.fn() };
    const { unmount } = render(<Vy egna={egna} />);
    await oppnaVaxlaren();
    const rader = screen.getAllByRole("menuitem").map((r) => r.textContent);
    expect(rader[rader.length - 1]).toBe("Ny plats");
    expect(screen.getAllByRole("menuitemradio").map((r) => r.textContent)).toEqual(["Music", "Mitt bibliotek", "Demos"]);
    unmount();
    // Utan egnaPlatser: samma växlare som förut, utan rad och utan sökfält.
    render(<Vy egna={undefined} />);
    await oppnaVaxlaren();
    expect(screen.queryByRole("menuitem", { name: "Ny plats" })).toBeNull();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("egnaPlatser utan onNy ritar ingen rad", async () => {
    render(<Vy egna={{ platser: [], onByttNamn: vi.fn() }} />);
    await oppnaVaxlaren();
    expect(screen.queryByRole("menuitem", { name: "Ny plats" })).toBeNull();
  });

  it("tar ett namn, validerar det i formuläret, och en lyckad plats öppnas direkt", async () => {
    const onPlats = vi.fn();
    const onNy = vi.fn(async ({ namn }) => ({ plats: platsBibliotek(GRUPP, "live"), namn }));
    render(<Vy egna={{ platser: platserUr([rad("demos", "Demos")]), onNy }} onPlats={onPlats} />);
    const user = await oppnaVaxlaren();
    await user.click(screen.getByRole("menuitem", { name: "Ny plats" }));
    const fält = screen.getByRole("textbox", { name: "Namn på platsen" });
    // Tomt namn: felet står i formuläret och inget anropas.
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    expect(await screen.findByText("Platsen behöver ett namn.")).toBeInTheDocument();
    expect(onNy).not.toHaveBeenCalled();
    // Ett namn som finns (utan hänsyn till versaler).
    await user.type(fält, "demos");
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    expect(await screen.findByText("Det finns redan en plats som heter Demos.")).toBeInTheDocument();
    expect(onNy).not.toHaveBeenCalled();
    // Ett giltigt namn.
    await user.clear(fält);
    await user.type(fält, "  Live  ");
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    await waitFor(() => expect(onNy).toHaveBeenCalledWith({ namn: "Live" }));
    await waitFor(() => expect(onPlats).toHaveBeenCalledWith("plats~cps-ab~live"));
    // Rutan har stängts.
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Namn på platsen" })).toBeNull());
  });

  it("en plats som ännu inte står i platser ritas ändå i pillret, med sitt namn", async () => {
    const onNy = vi.fn(async ({ namn }) => ({ plats: platsBibliotek(GRUPP, "live"), namn }));
    function Hallare() {
      const [plats, setPlats] = useState(GRUPP);
      return <Vy egna={{ platser: [], onNy }} plats={plats} onPlats={setPlats} />;
    }
    render(<Hallare />);
    const user = await oppnaVaxlaren();
    await user.click(screen.getByRole("menuitem", { name: "Ny plats" }));
    await user.type(screen.getByRole("textbox", { name: "Namn på platsen" }), "Live");
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    expect(await screen.findByRole("button", { name: "Vilket bibliotek: Live" })).toBeInTheDocument();
  });

  it("ett fel från appen står kvar i formuläret med sin text, och formuläret stannar öppet", async () => {
    const onNy = vi.fn(async () => {
      throw new Error("Platsen skapades inte. Du får inte skapa platser här.");
    });
    render(<Vy egna={{ platser: [], onNy }} />);
    const user = await oppnaVaxlaren();
    await user.click(screen.getByRole("menuitem", { name: "Ny plats" }));
    await user.type(screen.getByRole("textbox", { name: "Namn på platsen" }), "Live");
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    expect(await screen.findByText("Platsen skapades inte. Du får inte skapa platser här.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Namn på platsen" })).toHaveValue("Live");
    // Avbryt går tillbaka till listan.
    await user.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(screen.getByRole("menuitem", { name: "Ny plats" })).toBeInTheDocument();
  });

  it("finns även när växlaren annars bara hade en plats, så att en grupp kan skapa sin första", async () => {
    render(<Vy egna={{ platser: [], onNy: vi.fn() }} platser={[GRUPPEN]} />);
    await oppnaVaxlaren();
    expect(screen.getByRole("menuitem", { name: "Ny plats" })).toBeInTheDocument();
    // Utan onNy är en enda plats ingen växlare, som förut.
    const { container } = render(<Vy egna={undefined} platser={[GRUPPEN]} />);
    expect(container.querySelector("[data-bibliotek-plats]")).toBeNull();
  });

  it("en medlem som inte är aktiv ser ingen rad", async () => {
    render(<Vy egna={{ platser: [], onNy: vi.fn() }} jagg={{ ...jag(), status: "avslutad" }} />);
    await oppnaVaxlaren();
    expect(screen.queryByRole("menuitem", { name: "Ny plats" })).toBeNull();
  });

  it("texterna finns på engelska", async () => {
    render(
      <OpsSprakProvider sprak="en">
        <Vy egna={{ platser: [], onNy: vi.fn(async () => ({})) }} />
      </OpsSprakProvider>,
    );
    const user = await oppnaVaxlaren();
    await user.click(screen.getByRole("menuitem", { name: "New place" }));
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("The place needs a name.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name of the place" })).toBeInTheDocument();
  });
});

describe("Sökfältet över åtta rader", () => {
  const manga = (n) => Array.from({ length: n }, (_, i) => rad(`p${i}`, `Projekt ${i + 1}`));

  it("åtta rader i listan har inget sökfält, nio har ett, och det filtrerar utan att ta bort Ny plats", async () => {
    // Music + Mitt + 6 egna = 8 rader: inget sökfält.
    const atta = { platser: platserUr(manga(6)), onNy: vi.fn() };
    const { unmount } = render(<Vy egna={atta} />);
    await oppnaVaxlaren();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(8);
    expect(screen.queryByRole("searchbox", { name: "Sök plats" })).toBeNull();
    unmount();
    // Music + Mitt + 7 egna = 9 rader: sökfält.
    const nio = { platser: platserUr(manga(7)), onNy: vi.fn() };
    render(<Vy egna={nio} />);
    const user = await oppnaVaxlaren();
    const sok = screen.getByRole("searchbox", { name: "Sök plats" });
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(9);
    await user.type(sok, "projekt 3");
    expect(screen.getAllByRole("menuitemradio").map((r) => r.textContent)).toEqual(["Projekt 3"]);
    expect(screen.getByRole("menuitem", { name: "Ny plats" })).toBeInTheDocument();
    await user.clear(sok);
    await user.type(sok, "finns inte");
    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
    expect(screen.getByText("Ingen plats matchar.")).toBeInTheDocument();
  });

  it("ett val i den filtrerade listan byter plats och stänger", async () => {
    const onPlats = vi.fn();
    render(<Vy egna={{ platser: platserUr(manga(7)), onNy: vi.fn() }} onPlats={onPlats} />);
    const user = await oppnaVaxlaren();
    await user.type(screen.getByRole("searchbox", { name: "Sök plats" }), "projekt 5");
    await user.click(screen.getByRole("menuitemradio", { name: "Projekt 5" }));
    expect(onPlats).toHaveBeenCalledWith("plats~cps-ab~p4");
  });
});

describe("Byt namn och Arkivera för en egen plats", () => {
  const demos = () => platserUr([rad("demos", "Demos"), rad("live", "Live", { skapadAv: skapare(ANNA) })]);

  it("skaparen får ⋮ på sin plats och byter namn: id:t och därmed adressen är oförändrade", async () => {
    const onByttNamn = vi.fn(async () => {});
    render(<Vy egna={{ platser: demos(), onByttNamn, onArkivera: vi.fn() }} plats="plats~cps-ab~demos" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Åtgärder för Demos" }));
    await user.click(screen.getByRole("menuitem", { name: "Byt namn" }));
    const ruta = screen.getByRole("dialog", { name: "Byt namn" });
    const falt = within(ruta).getByRole("textbox", { name: "Nytt namn" });
    expect(falt).toHaveValue("Demos");
    await user.clear(falt);
    await user.type(falt, "Live");
    await user.click(within(ruta).getByRole("button", { name: "Spara" }));
    expect(await within(ruta).findByText("Det finns redan en plats som heter Live.")).toBeInTheDocument();
    expect(onByttNamn).not.toHaveBeenCalled();
    await user.clear(falt);
    await user.type(falt, "Demoinspelningar");
    await user.click(within(ruta).getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onByttNamn).toHaveBeenCalledWith({ id: "demos", namn: "Demoinspelningar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Byt namn" })).toBeNull());
  });

  it("Arkivera frågar först, anropar onArkivera med id:t och går sedan till den första plats som finns kvar", async () => {
    const onArkivera = vi.fn(async () => {});
    const onPlats = vi.fn();
    render(<Vy egna={{ platser: demos(), onArkivera }} plats="plats~cps-ab~demos" onPlats={onPlats} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Åtgärder för Demos" }));
    // Bara Arkivera finns när onByttNamn saknas: en rad utan funktion ritas inte.
    expect(screen.queryByRole("menuitem", { name: "Byt namn" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Arkivera" }));
    const ruta = screen.getByRole("dialog", { name: "Arkivera" });
    expect(within(ruta).getByText(/Arkivera platsen Demos\?/)).toBeInTheDocument();
    expect(onArkivera).not.toHaveBeenCalled();
    await user.click(within(ruta).getByRole("button", { name: "Arkivera" }));
    await waitFor(() => expect(onArkivera).toHaveBeenCalledWith({ id: "demos" }));
    await waitFor(() => expect(onPlats).toHaveBeenCalledWith(GRUPP));
  });

  it("ett nej vid arkiveringen står kvar i rutan med skälet, och platsen byts inte", async () => {
    const onPlats = vi.fn();
    render(<Vy egna={{ platser: demos(), onArkivera: vi.fn(async () => { throw new Error("Du får inte ändra platsen."); }) }} plats="plats~cps-ab~demos" onPlats={onPlats} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Åtgärder för Demos" }));
    await user.click(screen.getByRole("menuitem", { name: "Arkivera" }));
    await user.click(within(screen.getByRole("dialog", { name: "Arkivera" })).getByRole("button", { name: "Arkivera" }));
    expect(await screen.findByText("Du får inte ändra platsen.")).toBeInTheDocument();
    expect(onPlats).not.toHaveBeenCalled();
  });

  it("false från appen är också ett nej med en text, aldrig tyst", async () => {
    render(<Vy egna={{ platser: demos(), onByttNamn: vi.fn(async () => false) }} plats="plats~cps-ab~demos" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Åtgärder för Demos" }));
    await user.click(screen.getByRole("menuitem", { name: "Byt namn" }));
    const ruta = screen.getByRole("dialog", { name: "Byt namn" });
    await user.type(within(ruta).getByRole("textbox", { name: "Nytt namn" }), " 2");
    await user.click(within(ruta).getByRole("button", { name: "Spara" }));
    expect(await within(ruta).findByText("Ändringen kunde inte sparas.")).toBeInTheDocument();
  });

  it("ägare och admin får menyn på någon annans plats, en vanlig medlem inte, och gruppens och Mitt biblioteks plats har ingen", () => {
    const egna = { platser: demos(), onByttNamn: vi.fn(), onArkivera: vi.fn() };
    // En annan medlem på Kims plats: ingen meny.
    const a = render(<Vy egna={egna} jagg={jag(ANNA)} plats="plats~cps-ab~demos" />);
    expect(screen.queryByRole("button", { name: "Åtgärder för Demos" })).toBeNull();
    a.unmount();
    // Men Anna skapade Live.
    const b = render(<Vy egna={egna} jagg={jag(ANNA)} plats="plats~cps-ab~live" />);
    expect(screen.getByRole("button", { name: "Åtgärder för Live" })).toBeInTheDocument();
    b.unmount();
    // En admin och en ägare får den på någon annans.
    const c = render(<Vy egna={egna} jagg={jag("uidAdmin", "admin")} plats="plats~cps-ab~demos" />);
    expect(screen.getByRole("button", { name: "Åtgärder för Demos" })).toBeInTheDocument();
    c.unmount();
    const d = render(<Vy egna={egna} jagg={jag("uidAgare", "agare")} plats="plats~cps-ab~demos" />);
    expect(screen.getByRole("button", { name: "Åtgärder för Demos" })).toBeInTheDocument();
    d.unmount();
    // Gruppens egen plats och Mitt bibliotek är inga egna platser.
    const e = render(<Vy egna={egna} jagg={jag("uidAdmin", "admin")} plats={GRUPP} />);
    expect(screen.queryByRole("button", { name: /^Åtgärder för/ })).toBeNull();
    e.unmount();
    render(<Vy egna={egna} plats={MITT.id} />);
    expect(screen.queryByRole("button", { name: /^Åtgärder för/ })).toBeNull();
  });

  it("utan egnaPlatser ritas ingen meny, och en plats utan dokument i listan inte heller", () => {
    render(<Vy egna={undefined} platser={[GRUPPEN, MITT, { id: "plats~cps-ab~demos", namn: "Demos" }]} plats="plats~cps-ab~demos" />);
    expect(screen.queryByRole("button", { name: /^Åtgärder för/ })).toBeNull();
  });
});

describe("Avsnittet Platser under kugghjulet", () => {
  const MODUL = defineModule({
    id: "bibliotek",
    namn: { sv: "Bibliotek", en: "Library" },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: null,
  });
  const ram = (farAndra = true) => ({ farAndra, grupp: { moduler: ["bibliotek"], huvudmeny: [] }, onOrdning: vi.fn(), onSparaHuvudmeny: vi.fn() });
  const installningar = (egna, jagg = jag("uidAdmin", "admin"), farAndra = true) =>
    render(<Vy egna={egna} jagg={jagg} extra={{ ram: ram(farAndra), activeHref: "/bibliotek?lage=installningar", modul: MODUL }} />);

  it("listar alla egna platser, också de arkiverade, och Ta fram igen anropar onTaFram med id:t", async () => {
    const onTaFram = vi.fn(async () => {});
    const egna = { platser: platserUr([rad("demos", "Demos"), rad("gamla", "Gamla", { arkiverad: true })]), onByttNamn: vi.fn(), onArkivera: vi.fn(), onTaFram };
    installningar(egna);
    const sektion = document.querySelector("[data-bibliotek-platsinstallningar]");
    expect(sektion).not.toBeNull();
    const demos = within(/** @type {HTMLElement} */ (document.querySelector('[data-bibliotek-platsrad="demos"]')));
    const gamla = within(/** @type {HTMLElement} */ (document.querySelector('[data-bibliotek-platsrad="gamla"]')));
    expect(demos.getByRole("button", { name: "Arkivera: Demos" })).toBeInTheDocument();
    expect(demos.getByRole("button", { name: "Byt namn: Demos" })).toBeInTheDocument();
    expect(demos.queryByText("Arkiverad")).toBeNull();
    expect(gamla.getByText("Arkiverad")).toBeInTheDocument();
    expect(gamla.queryByRole("button", { name: "Arkivera: Gamla" })).toBeNull();
    fireEvent.click(gamla.getByRole("button", { name: "Ta fram igen: Gamla" }));
    await waitFor(() => expect(onTaFram).toHaveBeenCalledWith({ id: "gamla" }));
  });

  it("en tom lista skrivs ut som tom, inte som en utelämnad rubrik", () => {
    installningar({ platser: [], onNy: vi.fn() });
    expect(screen.getByRole("heading", { name: "Platser" })).toBeInTheDocument();
    expect(screen.getByText(/Gruppen har inga egna platser än/)).toBeInTheDocument();
  });

  it("knapparna ritas bara för den som får ändra platsen, och ett fel i Ta fram igen syns", async () => {
    const egna = { platser: platserUr([rad("gamla", "Gamla", { arkiverad: true })]), onByttNamn: vi.fn(), onArkivera: vi.fn(), onTaFram: vi.fn(async () => { throw new Error("Nekat."); }) };
    // Kim skapade den: en vanlig medlem som skapade platsen får ändra den.
    const { unmount } = installningar(egna, jag(KIM), true);
    fireEvent.click(screen.getByRole("button", { name: "Ta fram igen: Gamla" }));
    expect(await screen.findByText("Nekat.")).toBeInTheDocument();
    unmount();
    // Anna skapade den inte och är ingen förvaltare.
    installningar(egna, jag(ANNA), true);
    expect(screen.getByText("Gamla")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gamla/ })).toBeNull();
  });

  it("utan egnaPlatser är inställningsläget som förut, utan avsnittet", () => {
    render(<Vy egna={undefined} jagg={jag("uidAdmin", "admin")} extra={{ ram: ram(), activeHref: "/bibliotek?lage=installningar", modul: MODUL }} />);
    expect(document.querySelector("[data-bibliotek-platsinstallningar]")).toBeNull();
    expect(screen.getByText("Allmänt")).toBeInTheDocument();
  });
});

describe("Flytta UT ur ett objekts filer (OpsPlatsfiler)", () => {
  const PLATS = arendeBibliotek(GRUPP, "a1");
  function bygg() {
    const post = byggPost({
      groupId: PLATS,
      typ: "fil",
      rubrik: "Biljett",
      fil: { sokvag: `grupper/${PLATS}/bibliotek/p1/b.pdf`, namn: "b.pdf", mime: "application/pdf", byte: 4, klar: true },
      skapadAv: skapare(KIM),
      skapad: NU,
      andrad: NU,
    });
    return createBibliotekskalla({
      source: createMemorySource({ bibliotek: [{ ...post, id: "p1" }] }),
      collection: "bibliotek",
      groupId: PLATS,
      skapare: () => skapare(KIM),
      jag: () => jag(),
      anteckna: () => {},
      lagring: { laddaUpp: vi.fn(async () => {}) },
      sokvag: ({ groupId: g, postId, namn }) => `grupper/${g}/bibliotek/${postId}/${namn}`,
    });
  }
  const oppnaMeny = async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Åtgärder för Biljett" }));
    return user;
  };

  it("författaren får Flytta eller kopiera till gruppens plats och en egen plats, och onDela får platsen", async () => {
    const onDela = vi.fn(async () => {});
    render(<OpsPlatsfiler kalla={bygg()} jag={jag()} kanLaggaTill grupper={[GRUPPEN, { id: "plats~cps-ab~demos", namn: "Demos" }]} onDela={onDela} />);
    const user = await oppnaMeny();
    await user.click(screen.getByRole("menuitem", { name: "Flytta eller kopiera" }));
    const ruta = screen.getByRole("dialog", { name: "Flytta eller kopiera" });
    await user.click(within(ruta).getByRole("combobox", { name: "Flytta eller kopiera till" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Music", "Demos"]);
    await user.click(screen.getByRole("option", { name: "Demos" }));
    await user.click(within(ruta).getByRole("button", { name: "Kopiera" }));
    await waitFor(() => expect(onDela).toHaveBeenCalledWith({ id: "p1", groupId: "plats~cps-ab~demos", satt: "kopiera" }));
    expect(await screen.findByText("Kopierad till Demos.")).toBeInTheDocument();
  });

  it("en vanlig medlem som inte skrev filen får kopiera till gruppens platser men inte flytta, och inte till en annan grupp", async () => {
    const onDela = vi.fn(async () => {});
    render(<OpsPlatsfiler kalla={bygg()} jag={jag(ANNA)} kanLaggaTill grupper={[GRUPPEN, { id: "plats~cps-ab~demos", namn: "Demos" }, { id: "andra-ab", namn: "Andra" }]} onDela={onDela} />);
    const user = await oppnaMeny();
    expect(screen.queryByRole("menuitem", { name: "Flytta eller kopiera" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Kopiera till en plats" }));
    const ruta = screen.getByRole("dialog", { name: "Kopiera" });
    expect(within(ruta).queryByRole("button", { name: "Flytta" })).toBeNull();
    await user.click(within(ruta).getByRole("combobox", { name: "Flytta eller kopiera till" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Music", "Demos"]);
  });

  it("utan grupper och onDela är menyn som förut: ingen flytt", async () => {
    render(<OpsPlatsfiler kalla={bygg()} jag={jag()} kanLaggaTill />);
    await oppnaMeny();
    expect(screen.queryByRole("menuitem", { name: /Flytta|Kopiera/ })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Byt namn" })).toBeInTheDocument();
  });

  it("ett objekts plats i grupper kastar fortfarande, och växlaren och egnaPlatser hör inte hit", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsPlatsfiler kalla={bygg()} jag={jag()} kanLaggaTill grupper={[{ id: PLATS, namn: "Ärendet" }]} onDela={vi.fn()} />)).toThrow(/ett ärendes bibliotek/);
    expect(() => render(<OpsBibliotek poster={[]} jag={jag()} inbaddad onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} egnaPlatser={{ platser: [] }} />)).toThrow(/inbaddad hör ihop med en enda plats/);
    expect(() => render(<OpsBibliotek poster={[]} jag={jag()} hubHref="/hub" onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} egnaPlatser={{}} />)).toThrow(/egnaPlatser ska vara/);
    tyst.mockRestore();
  });
});
