import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { OpsMottagare } from "../components/OpsMottagare.jsx";
import { OpsNyttMeddelande } from "../components/OpsNyttMeddelande.jsx";
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

  it("tomhet är ett svar: en grupp utan samtal säger det", async () => {
    render(<OpsMeddelanden kalla={createSamtalskalla({ kalla: createMemorySource({}) })} uid="anna" groupId="tom" gruppNamn="Tom" medlemmar={[]} />);
    expect(await screen.findByText("Inga samtal än")).toBeInTheDocument();
  });

  it("Nytt meddelande-knappen anropar onNytt", async () => {
    const onNytt = vi.fn();
    render(<OpsMeddelanden kalla={createSamtalskalla({ kalla: createMemorySource({}) })} uid="anna" groupId="g" gruppNamn="Alfa" medlemmar={[]} onNytt={onNytt} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Nytt meddelande" }));
    expect(onNytt).toHaveBeenCalledTimes(1);
  });
});

describe("OpsMottagare", () => {
  it("⛔ ärendeläget: Gruppen, aktiva personer (jag märkt du) och agenten, aldrig en borttagen medlem", () => {
    render(<OpsMottagare lage="arende" medlemmar={MEDLEMMAR} uid="anna" value={{ slag: "grupp" }} onChange={() => {}} />);
    const radio = screen.getAllByRole("radio").map((r) => r.querySelector(".truncate")?.textContent);
    expect(radio).toEqual(["Gruppen", "Anna Ek (du)", "Bo Lind", "Cecilia Berg", "Ops-agenten"]);
    expect(screen.getByRole("radio", { name: "Gruppen" })).toHaveAttribute("aria-checked", "true");
  });
  it("⛔ personläget: bara andra aktiva personer, ingen grupp och ingen agent", async () => {
    const onChange = vi.fn();
    render(<OpsMottagare lage="person" medlemmar={MEDLEMMAR} uid="anna" value={null} onChange={onChange} />);
    expect(screen.getAllByRole("radio").map((r) => r.querySelector(".truncate")?.textContent)).toEqual(["Bo Lind", "Cecilia Berg"]);
    await userEvent.setup().click(screen.getByRole("radio", { name: "Bo Lind" }));
    expect(onChange).toHaveBeenCalledWith({ slag: "person", uid: "bo" });
  });
});

describe("OpsNyttMeddelande", () => {
  it("⛔ skickar i det privata samtalet med den valda personen, samma samtal som förut", async () => {
    const { samtal, privat } = await underlag();
    const onKlar = vi.fn();
    render(<OpsNyttMeddelande formId="f" groupId="g" uid="anna" medlemmar={MEDLEMMAR} kalla={samtal} onKlar={onKlar} />);
    const user = userEvent.setup();
    expect(screen.getByText("Bara ni två ser det här.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Bo Lind" }));
    await user.type(screen.getByRole("textbox"), "Ja, jag tittar");
    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(onKlar).toHaveBeenCalledWith(privat.id));
    expect((await samtal.meddelanden(privat.id)).at(-1)).toMatchObject({ text: "Ja, jag tittar", av: "anna" });
  });
  it("⛔ utan mottagare eller utan text skickas inget, och felet står vid fältet", async () => {
    const { samtal } = await underlag();
    const onKlar = vi.fn();
    render(
      <>
        <OpsNyttMeddelande formId="f" groupId="g" uid="anna" medlemmar={MEDLEMMAR} kalla={samtal} onKlar={onKlar} />
        <button type="submit" form="f">
          Skicka
        </button>
      </>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    expect(screen.getByText("Välj vem meddelandet ska till.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Cecilia Berg" }));
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    expect(screen.getByText("Skriv något först.")).toBeInTheDocument();
    expect(onKlar).not.toHaveBeenCalled();
  });
  it("utan grupp säger formuläret det", () => {
    render(<OpsNyttMeddelande formId="f" groupId={null} uid="anna" medlemmar={[]} kalla={createSamtalskalla({ kalla: createMemorySource({}) })} />);
    expect(screen.getByText(/inte med i någon grupp/)).toBeInTheDocument();
  });
});

describe("⛔ skalet: Nytt meddelande i plusset öppnar skapa-panelen med Skicka", () => {
  function Skal({ samtal, onGaTill, start = "g", sektioner = undefined }) {
    const [aktiv, setAktiv] = useState(start);
    return (
      <OpsAppShell
        brand="Ops"
        nav={[{ href: "/", label: "Start" }]}
        activeHref="/"
        grupper={{ lista: [{ id: "g", namn: { sv: "Alfa AB" }, medlemsantal: 3, roll: "agare" }], aktiv, onValj: setAktiv }}
        skapa={{
          sparaEtikett: "Spara",
          lage: aktiv,
          skapaISektioner: sektioner,
          meddelande: ({ formId, groupId, onKlar }) => (
            <OpsNyttMeddelande
              formId={formId}
              groupId={groupId}
              uid="anna"
              medlemmar={MEDLEMMAR}
              kalla={samtal}
              onKlar={(id) => {
                onKlar();
                onGaTill(id);
              }}
            />
          ),
        }}
      >
        <p>appens vy</p>
      </OpsAppShell>
    );
  }

  it("raden finns, panelen är en region med knappen Skicka, och ett skickat meddelande stänger den", async () => {
    const { samtal } = await underlag();
    const onGaTill = vi.fn();
    render(<Skal samtal={samtal} onGaTill={onGaTill} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    await user.click(screen.getByRole("button", { name: "Nytt meddelande" }));
    const panel = screen.getByRole("region", { name: "Nytt meddelande" });
    expect(new URL(window.location.href).searchParams.get("skapa")).toBe("meddelande");
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    await user.click(within(panel).getByRole("radio", { name: "Cecilia Berg" }));
    await user.type(within(panel).getByRole("textbox"), "Hej Cecilia");
    await user.click(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(onGaTill).toHaveBeenCalledWith("g|anna|cecilia"));
    expect(screen.queryByRole("region", { name: "Nytt meddelande" })).toBeNull();
  });

  it("⛔ ingen gruppväljare före panelen: meddelandet skrivs i den aktiva gruppen, också när appen har egna mål (0.35.0, #190)", async () => {
    const { samtal } = await underlag();
    render(<Skal samtal={samtal} onGaTill={() => {}} sektioner={[{ id: "appen", rubrik: "Appen", poster: [{ id: "x", namn: "Appens plats" }] }]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Skapa" }));
    await user.click(screen.getByRole("button", { name: "Nytt meddelande" }));
    expect(screen.queryByRole("dialog", { name: "Skapa i" })).toBeNull();
    const panel = await screen.findByRole("region", { name: "Nytt meddelande" });
    expect(within(panel).getByRole("radio", { name: "Bo Lind" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Skapas i/ })).toBeNull();
  });
});
