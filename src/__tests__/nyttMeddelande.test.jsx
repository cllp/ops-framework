import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { useOppnaSkapa } from "../index.js";

/**
 * "Nytt meddelande" lämnar aldrig Meddelanden (0.63.0, cllp/ops-framework#263).
 *
 * ⛔ HÄNDELSEN. CP 2026-10-06 11:22, med en skärminspelning från LifeHub: "steget med att öppna en liten chattfönster till
 * är lite konstigt", och "Chatten dök upp långt senare...". Han skickade frågan till agenten två gånger, eftersom ingenting
 * syntes hända. Tre fel samverkade: plusset dolde hela vyn bakom en skapa-panel, `useSamtal` läste bara om vid `focus`, och
 * tråden ritades bara när samtalet redan fanns bland raderna.
 *
 * ⛔ PROVEN MONTERAR `OpsMeddelanden` I SKALET, inte `<p>appens vy</p>`. Skalprovet i `meddelanden.test.jsx` (0.34.0) hade
 * appens vy som en paragraf och mätte därför bara att `onGaTill` anropades, och stod grönt genom hela felet.
 *
 * ⛔ INGEN `focus`-HÄNDELSE NÅGONSTANS I DEN HÄR FILEN. Det var den enda vägen som fick raden att synas före fixen, och ett
 * prov som skickar den hade varit grönt av samma skäl som felet var osynligt.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Agent", typ: "agent", status: "aktiv" },
];

/** Appens vy, som LifeHub kopplar den: valt samtal och läget "nytt" i appens state (där LifeHub har adressen). */
function Vy({ kalla, valt, setValt, nytt, setNytt }) {
  return (
    <OpsMeddelanden
      kalla={kalla}
      uid="anna"
      groupId="g"
      gruppNamn="Alfa"
      medlemmar={MEDLEMMAR}
      valt={valt}
      nytt={nytt}
      onValj={(id, val) => {
        setNytt(Boolean(val?.nytt));
        setValt(id);
      }}
    />
  );
}

function App({ kalla }) {
  const [valt, setValt] = useState(/** @type {string | null} */ (null));
  const [nytt, setNytt] = useState(false);
  return (
    <OpsAppShell
      brand="Ops"
      nav={[{ href: "/", label: "Start" }]}
      activeHref="/"
      grupper={{ lista: [{ id: "g", namn: { sv: "Alfa" }, medlemsantal: 3, roll: "agare" }], aktiv: "g", onValj: () => {} }}
      skapa={{
        sparaEtikett: "Spara",
        lage: "g",
        // ⛔ Plussets rad leder hit i läget "nytt", den öppnar ingen panel.
        nyttMeddelande: () => {
          setValt(null);
          setNytt(true);
        },
      }}
    >
      <Vy kalla={kalla} valt={valt} setValt={setValt} nytt={nytt} setNytt={setNytt} />
    </OpsAppShell>
  );
}

const lista = () => /** @type {HTMLElement} */ (document.querySelector("[data-samtalslista]"));

describe("⛔ Nytt meddelande i skalet: tråden öppnas bredvid listan och samtalet syns direkt (#263)", () => {
  it("tom inkorg, Nytt meddelande, agenten, skriv, Skicka: samtalsraden och tråden syns utan någon focus-händelse", async () => {
    const kalla = createSamtalskalla({ kalla: createMemorySource({}) });
    render(<App kalla={kalla} />);
    expect(await screen.findByText("Inga samtal än")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Nytt meddelande" })[0]);
    // ⛔ Listan står kvar i DOM:en, och ingen skapa-panel öppnades.
    expect(lista()).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Nytt meddelande" })?.closest("[data-ops-meddelanden]")).toBeTruthy();
    // Raden under Till följer valet: före valet "Bara ni två", med agenten vald samma ord som trådens huvud sedan bär.
    expect(document.querySelector("[data-privat]")?.textContent).toBe("Bara ni två ser det här");
    await user.click(screen.getByRole("radio", { name: "Agent" }));
    // Valet öppnar tråden direkt, innan något är skrivet.
    await waitFor(() => expect(document.querySelector("[data-ops-samtal]")).not.toBeNull());
    expect(document.querySelector("[data-privat-rad]")?.textContent).toBe("Bara du och agenten ser det här");
    expect(lista()).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "vilka ärenden är öppna?");
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(document.querySelectorAll("[data-samtalsrad]")).toHaveLength(1));
    expect(document.querySelector('[data-samtalsrad="agent"]')).not.toBeNull();
    expect(document.querySelector('[data-ops-samtal="agent"]')).not.toBeNull();
    expect(screen.queryByText("Inga samtal än")).toBeNull();
    // Meddelandet står i tråden, och raden bär utdraget.
    expect(within(/** @type {HTMLElement} */ (document.querySelector("[role=log]"))).getByText("vilka ärenden är öppna?")).toBeInTheDocument();
    await waitFor(() => expect(within(lista()).getByText(/vilka ärenden är öppna\?/)).toBeInTheDocument());
    expect(lista()).toBeInTheDocument();
  });

  it("plussets rad Nytt meddelande leder till läget nytt i Meddelanden, och ingen skapa-panel öppnas", async () => {
    const kalla = createSamtalskalla({ kalla: createMemorySource({}) });
    render(<App kalla={kalla} />);
    await screen.findByText("Inga samtal än");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    const rader = screen.getAllByRole("button", { name: "Nytt meddelande" });
    // Plussets rad är den som inte ligger i Meddelanden.
    await user.click(/** @type {HTMLElement} */ (rader.find((r) => !r.closest("[data-ops-meddelanden]"))));
    expect(new URL(window.location.href).searchParams.get("skapa")).toBeNull();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    // ⛔ Ingen OpsSkapaPanel: CP 2026-10-06 såg plussets rad hamna på ett helsideformulär med "Skapas i" och en stor textruta.
    expect(document.querySelector("[data-skapa-panel]")).toBeNull();
    expect(document.querySelector("[data-skapa-knappar]")).toBeNull();
    expect(screen.queryByText(/Skapas i/)).toBeNull();
    const nytt = await screen.findByRole("region", { name: "Nytt meddelande" });
    expect(nytt.closest("[data-ops-meddelanden]")).toBeTruthy();
    expect(lista()).toBeInTheDocument();
    expect(within(nytt).getByRole("radio", { name: "Bo Lind" })).toBeInTheDocument();
  });
});

describe("⛔ tråden ritas på det valda id:t, inte på listan (#263)", () => {
  it("ett valt id som ännu inte finns bland raderna öppnar tråden, med rubriken ur medlemmarna", async () => {
    const kallan = createSamtalskalla({ kalla: createMemorySource({}) });
    const s = await kallan.oppnaPrivat({ groupId: "g", uid: "bo", annan: "anna" });
    await kallan.skicka(s.id, { text: "Hej Anna, är du där?", av: "bo" });
    // ⛔ Listan svarar som en läsning gjord INNAN samtalet fanns: tom. Precis det läget gav "Inga samtal än" i 0.60.0, fast
    // adressen pekade på rätt `?samtal=`. Källan är fryst, så den tomma översikten sitter på en kopia.
    const oversikt = vi.fn(async () => []);
    const kalla = { ...kallan, oversikt };
    render(<OpsMeddelanden kalla={kalla} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={MEDLEMMAR} valt={s.id} />);
    await screen.findByText("Inga samtal än");
    expect(oversikt).toHaveBeenCalled();
    expect(document.querySelectorAll("[data-samtalsrad]")).toHaveLength(0);
    // Vyn har ingen rad för samtalet, men tråden ska ändå stå där, med rubriken och raden om vem som ser det.
    const tradar = document.querySelectorAll('[data-ops-samtal="personer"]');
    expect(tradar).toHaveLength(1);
    expect(within(/** @type {HTMLElement} */ (tradar[0])).getByRole("heading", { name: "Bo Lind" })).toBeInTheDocument();
    expect(tradar[0].querySelector("[data-privat-rad]")?.textContent).toBe("Bara ni två ser det här");
    expect(await within(/** @type {HTMLElement} */ (tradar[0])).findByText("Hej Anna, är du där?")).toBeInTheDocument();
  });

  it("ett valt id som inte är mitt eller inte hör till gruppen öppnar ingen tråd, och det står att man ska välja ett samtal", async () => {
    const kalla = createSamtalskalla({ kalla: createMemorySource({}) });
    const { rerender } = render(<OpsMeddelanden kalla={kalla} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={MEDLEMMAR} valt="g|bo|cecilia" />);
    await screen.findByText("Inga samtal än");
    expect(document.querySelector("[data-ops-samtal]")).toBeNull();
    expect(screen.getByText("Välj ett samtal")).toBeInTheDocument();
    rerender(<OpsMeddelanden kalla={kalla} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={MEDLEMMAR} valt="h|anna|bo" />);
    expect(document.querySelector("[data-ops-samtal]")).toBeNull();
  });
});

describe("⛔ agenten med ett befintligt samtal ger samma samtal, ingen ny skapelse, och historiken syns (#263)", () => {
  it("samma id, inget nytt create av samtalet, och de gamla meddelandena står i tråden", async () => {
    const kalla = createMemorySource({});
    const samtal = createSamtalskalla({ kalla });
    const fore = await samtal.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
    await samtal.skicka(fore.id, { text: "Förra veckans fråga", av: "anna" });
    await samtal.skicka(fore.id, { text: "Förra veckans svar", av: "ops" });
    const create = vi.spyOn(kalla, "create");
    const onValj = vi.fn();
    function Vald() {
      const [valt, setValt] = useState(/** @type {string | null} */ (null));
      const [nytt, setNytt] = useState(true);
      return (
        <OpsMeddelanden
          kalla={samtal}
          uid="anna"
          groupId="g"
          gruppNamn="Alfa"
          medlemmar={MEDLEMMAR}
          valt={valt}
          nytt={nytt}
          onValj={(id, val) => {
            onValj(id, val);
            setNytt(Boolean(val?.nytt));
            setValt(id);
          }}
        />
      );
    }
    render(<Vald />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Agent" }));
    await waitFor(() => expect(onValj).toHaveBeenLastCalledWith(fore.id, undefined));
    const trad = await waitFor(() => /** @type {HTMLElement} */ (document.querySelector('[data-ops-samtal="agent"]')));
    expect(await within(trad).findByText("Förra veckans fråga")).toBeInTheDocument();
    expect(within(trad).getByText("Förra veckans svar")).toBeInTheDocument();
    // Läsmärket får skrivas (det är `samtal/<id>/last`), men inget nytt samtal skapas.
    const samtalsskapelser = create.mock.calls.filter(([vag]) => vag === "samtal");
    expect(samtalsskapelser).toHaveLength(0);
    expect(document.querySelectorAll('[data-samtalsrad="agent"]')).toHaveLength(1);
  });
});

describe("⛔ listan står kvar i DOM:en under hela flödet (#263)", () => {
  it("från tom inkorg via läget nytt och tråden till efter Skicka finns samma lista hela tiden", async () => {
    const kalla = createSamtalskalla({ kalla: createMemorySource({}) });
    render(<App kalla={kalla} />);
    await screen.findByText("Inga samtal än");
    const forsta = lista();
    const user = userEvent.setup();
    /** @type {boolean[]} */
    const kvar = [];
    const observer = new MutationObserver(() => kvar.push(forsta.isConnected && document.querySelector("[data-samtalslista]") === forsta));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    await user.click(screen.getAllByRole("button", { name: "Nytt meddelande" })[0]);
    await user.click(screen.getByRole("radio", { name: "Bo Lind" }));
    await waitFor(() => expect(document.querySelector('[data-ops-samtal="personer"]')).not.toBeNull());
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Hej Bo");
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(document.querySelectorAll("[data-samtalsrad]")).toHaveLength(1));
    observer.disconnect();
    // Golv: flödet ändrade DOM:en många gånger, annars mätte observatören ingenting.
    expect(kvar.length).toBeGreaterThan(5);
    expect(kvar.every(Boolean)).toBe(true);
  });

  it("Tillbaka i läget nytt stänger läget och går inte till någon annan sida", async () => {
    const kalla = createSamtalskalla({ kalla: createMemorySource({}) });
    render(<App kalla={kalla} />);
    await screen.findByText("Inga samtal än");
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Nytt meddelande" })[0]);
    expect(screen.getByRole("region", { name: "Nytt meddelande" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    expect(screen.queryByRole("region", { name: "Nytt meddelande" })).toBeNull();
    expect(screen.getByText("Välj ett samtal")).toBeInTheDocument();
  });

  it("text skriven före valet följer med in i tråden, och Skicka utan mottagare säger vad som saknas", async () => {
    const kalla = createSamtalskalla({ kalla: createMemorySource({}) });
    render(<App kalla={kalla} />);
    await screen.findByText("Inga samtal än");
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Nytt meddelande" })[0]);
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Hej{Enter}");
    expect(screen.getByText("Välj vem meddelandet ska till.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Bo Lind" }));
    const trad = await waitFor(() => /** @type {HTMLElement} */ (document.querySelector('[data-ops-samtal="personer"]')));
    expect(within(trad).getByRole("textbox", { name: "Skriv ett meddelande" })).toHaveValue("Hej");
  });

  it("ett fel när samtalet öppnas står i läget nytt, och ingenting försvinner tyst", async () => {
    const kalla = createSamtalskalla({ kalla: createMemorySource({}) });
    const felande = { ...kalla, oppnaPrivat: async () => { throw new Error("Nätet är nere"); } };
    render(<OpsMeddelanden kalla={/** @type {any} */ (felande)} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={MEDLEMMAR} nytt />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Bo Lind" }));
    expect(await screen.findByText("Nätet är nere")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Nytt meddelande" })).toBeInTheDocument();
    await act(async () => {});
  });
});

/**
 * ⛔ `laggIn` MÄTS MOT EN FRYST KÄLLA (granskningen av PR 264). Med en källa som svarar som vanligt syntes raden ändå, via
 * läsmärket (`markeraLast`, `onLast`, `lasOm`), och alla prov var gröna med `laggIn` som no-op. Här svarar `oversikt` alltid
 * med det den hade när provet började, så det enda som kan sätta raden i listan är den lokala inläggningen.
 */
describe("⛔ laggIn mot en källa som aldrig svarar med det nya samtalet (#263, granskningen)", () => {
  /** Källan med en `oversikt` som är fryst vid sitt första svar. */
  async function frystKalla() {
    let t = Date.now() - 60000;
    const kallan = createSamtalskalla({ kalla: createMemorySource({}), klocka: () => (t += 1000) });
    const g = await kallan.oppnaGrupp({ groupId: "g", uid: "anna" });
    await kallan.skicka(g.id, { text: "Gammalt i gruppen", av: "bo" });
    const fryst = await kallan.oversikt({ groupId: "g", uid: "anna" });
    const oversikt = vi.fn(async () => fryst);
    return { kalla: { ...kallan, oversikt }, oversikt };
  }
  const raderna = () => [...document.querySelectorAll("[data-samtalsrad]")].map((r) => r.textContent ?? "");

  it("raden står i listan direkt efter valet och står kvar efter omläsningen, utdraget finns efter Skicka, och den nya raden ligger överst", async () => {
    const { kalla, oversikt } = await frystKalla();
    render(<App kalla={kalla} />);
    await waitFor(() => expect(raderna()).toHaveLength(1));
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Nytt meddelande" })[0]);
    const lasningarFore = oversikt.mock.calls.length;
    await user.click(screen.getByRole("radio", { name: "Bo Lind" }));
    await waitFor(() => expect(raderna()).toHaveLength(2));
    expect(raderna().some((r) => r.includes("Bo Lind"))).toBe(true);
    // Källan har läst om efter valet och svarat utan samtalet. Raden står kvar.
    await waitFor(() => expect(oversikt.mock.calls.length).toBeGreaterThan(lasningarFore));
    await act(async () => {});
    expect(raderna().some((r) => r.includes("Bo Lind"))).toBe(true);
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Ny fråga till Bo{Enter}");
    await waitFor(() => expect(raderna()[0]).toContain("Ny fråga till Bo"));
    // Sorteringen: det just skickade ligger överst, gruppchatten med sitt äldre meddelande under.
    expect(raderna()[0]).toContain("Bo Lind");
    expect(raderna()[1]).toContain("Gammalt i gruppen");
    const efterSkicka = oversikt.mock.calls.length;
    await waitFor(() => expect(oversikt.mock.calls.length).toBeGreaterThan(efterSkicka - 1));
    await act(async () => {});
    expect(raderna()[0]).toContain("Ny fråga till Bo");
  });

  it("text som skrivs medan samtalet öppnas följer med in i tråden", async () => {
    const kallan = createSamtalskalla({ kalla: createMemorySource({}) });
    /** @type {(v?: unknown) => void} */
    let slapp = () => {};
    const oppnaPrivat = async (/** @type {any} */ d) => {
      await new Promise((r) => (slapp = r));
      return kallan.oppnaPrivat(d);
    };
    render(<App kalla={{ ...kallan, oppnaPrivat }} />);
    await screen.findByText("Inga samtal än");
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Nytt meddelande" })[0]);
    const falt = () => screen.getByRole("textbox", { name: "Skriv ett meddelande" });
    await user.type(falt(), "Hej ");
    await user.click(screen.getByRole("radio", { name: "Bo Lind" }));
    await user.type(falt(), "Bo");
    await act(async () => slapp());
    const trad = await waitFor(() => /** @type {HTMLElement} */ (document.querySelector('[data-ops-samtal="personer"]')));
    expect(within(trad).getByRole("textbox", { name: "Skriv ett meddelande" })).toHaveValue("Hej Bo");
  });

  it("filtret Olästa och sökningen nollas när ett samtal startas, så att det nya samtalet syns", async () => {
    const { kalla } = await frystKalla();
    render(<App kalla={kalla} />);
    await waitFor(() => expect(raderna()).toHaveLength(1));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Olästa/ }));
    await user.type(screen.getByRole("searchbox", { name: "Sök i meddelanden" }), "xyz");
    await user.click(screen.getAllByRole("button", { name: "Nytt meddelande" })[0]);
    await user.click(screen.getByRole("radio", { name: "Bo Lind" }));
    await waitFor(() => expect(raderna().some((r) => r.includes("Bo Lind"))).toBe(true));
    expect(screen.getByRole("button", { name: "Alla" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("searchbox", { name: "Sök i meddelanden" })).toHaveValue("");
  });
});
