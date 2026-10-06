import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { OpsMottagare } from "../components/OpsMottagare.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * Meddelanden (0.34.0, #182): inkorgen, samtalet, "Nytt meddelande" och mottagarväljaren, mot minnesadaptern.
 *
 * ⛔ HÄR MÄTS BETEENDE: vad som listas, vad som räknas som oläst, att ett privat samtal säger att det är privat, att ett
 * skickat meddelande hamnar i rätt samtal och att läsmärket flyttas när samtalet öppnas. Hur det SER UT mot SS mäts i
 * Chromium av `check-skalyta` avsnitt 29, eftersom jsdom inte kör någon CSS.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "cecilia", namn: "Cecilia Berg", typ: "person", status: "aktiv" },
  { userId: "david", namn: "David Borta", typ: "person", status: "avslutad" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

async function underlag() {
  let t = Date.now() - 60000;
  const kalla = createMemorySource({});
  const samtal = createSamtalskalla({ kalla, klocka: () => (t += 1000) });
  const g = await samtal.oppnaGrupp({ groupId: "g", uid: "anna" });
  await samtal.skicka(g.id, { text: "Hej alla, möte på fredag", av: "cecilia" });
  const p = await samtal.oppnaPrivat({ groupId: "g", uid: "bo", annan: "anna" });
  await samtal.skicka(p.id, { text: "Kan du titta på fakturan?", av: "bo" });
  await samtal.skicka(p.id, { text: "Den från i måndags", av: "bo" });
  // Ett samtal Anna inte deltar i: det får aldrig synas i hennes inkorg.
  const annat = await samtal.oppnaPrivat({ groupId: "g", uid: "bo", annan: "cecilia" });
  await samtal.skicka(annat.id, { text: "Hemligt mellan Bo och Cecilia", av: "bo" });
  return { kalla, samtal, privat: p, grupp: g };
}

describe("OpsMeddelanden: inkorgen", () => {
  it("⛔ listar gruppchatten och mina privata samtal, aldrig andras, med olästa räknade", async () => {
    const { samtal } = await underlag();
    const onOlasta = vi.fn();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} onOlasta={onOlasta} />);
    const lista = await screen.findByRole("region", { name: "Meddelanden" });
    await waitFor(() => expect(within(lista).getAllByRole("listitem")).toHaveLength(2));
    expect(within(lista).getByText("Alfa AB")).toBeInTheDocument();
    expect(within(lista).getByText("Bo Lind")).toBeInTheDocument();
    expect(screen.queryByText(/Hemligt mellan Bo och Cecilia/)).toBeNull();
    // Gruppchatten: ett oläst från Cecilia. Det privata: två från Bo.
    await waitFor(() => expect(onOlasta).toHaveBeenLastCalledWith(3));
    expect(within(lista).getByText("Privat")).toBeInTheDocument();
    expect(within(lista).getByText("Grupp")).toBeInTheDocument();
  });

  it("filtret Olästa och sökningen", async () => {
    const { samtal, grupp } = await underlag();
    await samtal.markeraLast(grupp.id, "anna", Date.now() + 1000);
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} />);
    const user = userEvent.setup();
    const lista = await screen.findByRole("region", { name: "Meddelanden" });
    await waitFor(() => expect(within(lista).getAllByRole("listitem")).toHaveLength(2));
    await user.click(within(lista).getByRole("button", { name: /^Olästa/ }));
    expect(within(lista).getAllByRole("listitem")).toHaveLength(1);
    expect(within(lista).getByText("Bo Lind")).toBeInTheDocument();
    await user.click(within(lista).getByRole("button", { name: "Alla" }));
    await user.type(within(lista).getByRole("searchbox", { name: "Sök i meddelanden" }), "möte");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(1);
    expect(within(lista).getByText("Alfa AB")).toBeInTheDocument();
    await user.clear(within(lista).getByRole("searchbox"));
    await user.type(within(lista).getByRole("searchbox"), "zzz");
    expect(within(lista).getByText("Ingen träff")).toBeInTheDocument();
  });

  it("⛔ ett öppnat privat samtal säger att det är privat, flyttar läsmärket och tar emot ett svar", async () => {
    const { samtal, privat } = await underlag();
    const onOlasta = vi.fn();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} onOlasta={onOlasta} />);
    const user = userEvent.setup();
    await waitFor(() => expect(onOlasta).toHaveBeenLastCalledWith(3));
    await user.click(await screen.findByRole("button", { name: /Bo Lind/ }));
    const vy = await screen.findByRole("log", { name: "Bo Lind" });
    await waitFor(() => expect(within(vy).getByText("Den från i måndags")).toBeInTheDocument());
    expect(screen.getByText("Bara ni två ser det här")).toBeInTheDocument();
    // Läsmärket: bara gruppchattens olästa återstår.
    await waitFor(() => expect(onOlasta).toHaveBeenLastCalledWith(1));
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Jag tittar nu{Enter}");
    await waitFor(() => expect(within(vy).getByText("Jag tittar nu")).toBeInTheDocument());
    const lagrat = await samtal.meddelanden(privat.id);
    expect(lagrat.at(-1)).toMatchObject({ text: "Jag tittar nu", av: "anna" });
  });

  it("gruppchatten säger att alla i gruppen ser den, och skriver ut avsändarens namn", async () => {
    const { samtal } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /Alfa AB/ }));
    const vy = await screen.findByRole("log", { name: "Alfa AB" });
    await waitFor(() => expect(within(vy).getByText("Cecilia Berg")).toBeInTheDocument());
    expect(screen.getByText("Alla i gruppen ser det här")).toBeInTheDocument();
  });

  it("tomhet är ett svar: med sökningen utan träff säger listan det", async () => {
    render(<OpsMeddelanden kalla={createSamtalskalla({ kalla: createMemorySource({}) })} uid="anna" groupId="tom" gruppNamn="Tom" medlemmar={[]} />);
    await screen.findByRole("button", { name: /Tom/ });
    await userEvent.setup().type(screen.getByRole("searchbox"), "finns inte");
    expect(await screen.findByText("Ingen träff")).toBeInTheDocument();
  });

  // 0.63.0 (#263): knappen öppnar läget "nytt" i högerpanelen och meddelar appen med EN signal, `onValj(null, { nytt: true })`.
  it("Nytt meddelande-knappen öppnar läget nytt och säger det till appen", async () => {
    const onValj = vi.fn();
    render(<OpsMeddelanden kalla={createSamtalskalla({ kalla: createMemorySource({}) })} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={MEDLEMMAR} onValj={onValj} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Nytt meddelande" }));
    expect(onValj).toHaveBeenCalledWith(null, { nytt: true });
    const nytt = screen.getByRole("region", { name: "Nytt meddelande" });
    expect(within(nytt).getByText("Bara ni två ser det här")).toBeInTheDocument();
    expect(within(nytt).getByRole("textbox", { name: "Skriv ett meddelande" })).toBeInTheDocument();
  });

  it("utan grupp finns ingen knapp Nytt meddelande, och läget nytt öppnas inte", () => {
    render(<OpsMeddelanden kalla={createSamtalskalla({ kalla: createMemorySource({}) })} uid="anna" groupId={null} gruppNamn="Alfa" medlemmar={MEDLEMMAR} nytt />);
    expect(screen.queryByRole("button", { name: "Nytt meddelande" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Nytt meddelande" })).toBeNull();
  });

  it("⛔ läget nytt: valet öppnar samma privata samtal som förut, och svaret skrivs i trådens fält", async () => {
    const { samtal, privat } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={MEDLEMMAR} nytt={undefined} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nytt meddelande" }));
    await user.click(screen.getByRole("radio", { name: "Bo Lind" }));
    const trad = await waitFor(() => /** @type {HTMLElement} */ (document.querySelector('[data-ops-samtal="personer"]')));
    expect(await within(trad).findByText("Kan du titta på fakturan?")).toBeInTheDocument();
    await user.type(within(trad).getByRole("textbox", { name: "Skriv ett meddelande" }), "Ja, jag tittar{Enter}");
    await waitFor(async () => expect((await samtal.meddelanden(privat.id)).at(-1)).toMatchObject({ text: "Ja, jag tittar", av: "anna" }));
  });
});

describe("OpsMottagare", () => {
  it("⛔ ärendeläget: Gruppen, aktiva personer (jag märkt du) och agenten, aldrig en borttagen medlem", () => {
    render(<OpsMottagare lage="arende" medlemmar={MEDLEMMAR} uid="anna" value={{ slag: "grupp" }} onChange={() => {}} />);
    const radio = screen.getAllByRole("radio").map((r) => r.querySelector(".truncate")?.textContent);
    expect(radio).toEqual(["Gruppen", "Anna Ek (du)", "Bo Lind", "Cecilia Berg", "Ops-agenten"]);
    expect(screen.getByRole("radio", { name: "Gruppen" })).toHaveAttribute("aria-checked", "true");
  });
  // lifehub.app#47: agenten går att skriva till privat, som en person. Före 0.60.0 stod den inte med här.
  it("⛔ personläget: andra aktiva personer och den aktiva agenten, ingen grupp", async () => {
    const onChange = vi.fn();
    render(<OpsMottagare lage="person" medlemmar={MEDLEMMAR} uid="anna" value={null} onChange={onChange} />);
    expect(screen.getAllByRole("radio").map((r) => r.querySelector(".truncate")?.textContent)).toEqual(["Bo Lind", "Cecilia Berg", "Ops-agenten"]);
    await userEvent.setup().click(screen.getByRole("radio", { name: "Bo Lind" }));
    expect(onChange).toHaveBeenCalledWith({ slag: "person", uid: "bo" });
  });
});

/*
 * ⛔ GRUPPCHATTEN UTAN SÅDD GRUPPCHATT (0.68.0). CP 2026-10-06, i gruppen "Philip Staiger AB" med en medlem och agenten:
 * "Hur skriver jag ett meddelande till hela gruppen?" Listan visade bara agentsamtalet och Till bara Agent, eftersom vyn aldrig
 * anropade `oppnaGrupp`. Alla prov ovan sår gruppchatten i `underlag()`, och därför såg inget av dem felet.
 */
describe("⛔ gruppchatten finns innan någon har skrivit i den (CP 2026-10-06)", () => {
  const ENSAM = [
    { userId: "cp", namn: "Claes Philip", typ: "person", status: "aktiv" },
    { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
  ];
  async function ensamGrupp() {
    const samtal = createSamtalskalla({ kalla: createMemorySource({}) });
    // Bara agentsamtalet finns, precis som i CP:s grupp.
    await samtal.oppnaPrivat({ groupId: "psab", uid: "cp", annan: "ops", slag: "agent" });
    return samtal;
  }

  it("raden står överst med gruppens namn och märket Grupp, utan att något skrivs i databasen; att öppna den skapar samtalet, och det första meddelandet syns", async () => {
    const kallan = await ensamGrupp();
    // Källan är fryst, så spionen sitter på en kopia.
    const oppnaGrupp = vi.fn(kallan.oppnaGrupp);
    const samtal = { ...kallan, oppnaGrupp };
    render(<OpsMeddelanden kalla={samtal} uid="cp" groupId="psab" gruppNamn="Philip Staiger AB" medlemmar={ENSAM} />);
    const lista = await screen.findByRole("region", { name: "Meddelanden" });
    await waitFor(() => expect(within(lista).getAllByRole("listitem")).toHaveLength(2));
    const rader = within(lista).getAllByRole("listitem");
    expect(rader[0].textContent).toContain("Philip Staiger AB");
    expect(rader[0].querySelector('[data-samtalsrad="grupp"] [data-slag]')?.textContent).toBe("Grupp");
    // ⛔ Raden är härledd: inget samtalsdokument för gruppen förrän någon öppnar den.
    expect((await samtal.lista({ groupId: "psab", uid: "cp" })).map((x) => x.slag)).toEqual(["agent"]);
    expect(oppnaGrupp).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(within(rader[0]).getByRole("button"));
    const vy = await screen.findByRole("log", { name: "Philip Staiger AB" });
    expect(oppnaGrupp).toHaveBeenCalledWith({ groupId: "psab", uid: "cp" });
    expect(vy.querySelector("[data-tomrad]")?.textContent).toBe("Alla i gruppen ser det som skrivs här.");
    expect((await samtal.lista({ groupId: "psab", uid: "cp" })).map((x) => x.slag).sort()).toEqual(["agent", "grupp"]);
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Till hela gruppen{Enter}");
    expect(await within(vy).findByText("Till hela gruppen")).toBeInTheDocument();
    await waitFor(() => expect(within(lista).getAllByRole("listitem")[0].textContent).toContain("Till hela gruppen"));
  });

  it("Nytt meddelande: Hela gruppen står först under Till, och valet öppnar gruppchatten", async () => {
    const samtal = await ensamGrupp();
    render(<OpsMeddelanden kalla={samtal} uid="cp" groupId="psab" gruppNamn="Philip Staiger AB" medlemmar={ENSAM} />);
    await screen.findByRole("button", { name: /Philip Staiger AB/ });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Nytt meddelande" }));
    const val = within(screen.getByRole("radiogroup", { name: "Till" })).getAllByRole("radio");
    expect(val.map((r) => r.textContent)).toEqual(["Hela gruppen", "Ops-agenten"]);
    await user.click(val[0]);
    await waitFor(() => expect(document.querySelector('[data-ops-samtal="grupp"]')).not.toBeNull());
    expect(await screen.findByRole("log", { name: "Philip Staiger AB" })).toBeInTheDocument();
  });
});
