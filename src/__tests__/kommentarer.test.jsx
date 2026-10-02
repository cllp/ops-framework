import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsKommentarer, OpsKommentarsrad } from "../components/OpsKommentarer.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createKommentarkalla } from "../data/kalenderkalla.js";
import { byggKommentar, kommentarsrader, MAX_HANDELSEKOMMENTAR } from "../lib/handelsemodell.js";
import { handelseregelfragment } from "../lib/regler.js";

/**
 * Kommentarer på en händelse (0.48.0, #232, beslut 0002). CP 2026-10-02: "Ja och ja", den som skrev en kommentar får ta bort den,
 * och en ny kommentar syns i Inkorgen. Reglerna provas mot emulatorn i `rules/__tests__/handelsekommentarer.test.mjs`.
 */

const anna = { uid: "anna", namn: "Anna Ek", typ: "manniska", kalla: "prov" };
const bo = { uid: "bo", namn: "Bo Lind", typ: "manniska", kalla: "prov" };
const k = (/** @type {string} */ id, /** @type {any} */ av, /** @type {string} */ skapad, text = id) => ({ id, text, skapad, skapadAv: av });

describe("byggKommentar", () => {
  it("trimmar texten och bär vem och när", () => {
    expect(byggKommentar("  Hej  ", { skapare: anna, nu: () => "2026-10-02T10:00:00.000Z" })).toEqual({ text: "Hej", skapad: "2026-10-02T10:00:00.000Z", skapadAv: anna });
  });
  it("⛔ tom text, text över taket, ingen uid och en tid som inte är ISO kastar med ett fel som säger vad", () => {
    expect(() => byggKommentar("   ", { skapare: anna })).toThrow(/tom/);
    expect(() => byggKommentar("a".repeat(MAX_HANDELSEKOMMENTAR + 1), { skapare: anna })).toThrow(/taket är 5000/);
    expect(byggKommentar("a".repeat(MAX_HANDELSEKOMMENTAR), { skapare: anna }).text).toHaveLength(5000);
    expect(() => byggKommentar("Hej", { skapare: { namn: "Utan uid", typ: "manniska" } })).toThrow(/skapare.uid krävs/);
    expect(() => byggKommentar("Hej", { skapare: anna, nu: () => "igår" })).toThrow(/ISO/);
  });
});

describe("kommentarsrader: inkorgens rader, härledda", () => {
  const handelser = [{ id: "h1", titel: "Höstfest" }, { id: "h2", titel: "Styrelsemöte" }, { id: "h3", titel: "Tyst" }];
  const kommentarer = new Map([
    ["h1", [k("a1", anna, "2026-10-01T09:00:00.000Z"), k("b1", bo, "2026-10-01T10:00:00.000Z"), k("b2", bo, "2026-10-02T08:00:00.000Z", "Senast")]],
    ["h2", [k("b3", bo, "2026-10-02T09:00:00.000Z")]],
    ["h3", [k("a2", anna, "2026-10-02T11:00:00.000Z")]],
  ]);

  it("en rad per händelse där någon annan skrivit efter mitt läsmärke, nyast först, med antal och den senaste", () => {
    const rader = kommentarsrader({ handelser, kommentarer, lastTill: new Map([["h1", "2026-10-01T09:30:00.000Z"]]), uid: "anna" });
    expect(rader.map((r) => [r.handelse.id, r.olasta, r.senaste.text, r.senaste.namn])).toEqual([
      ["h2", 1, "b3", "Bo Lind"],
      ["h1", 2, "Senast", "Bo Lind"],
    ]);
  });
  it("⛔ mina egna kommentarer ger ingen rad", () => {
    expect(kommentarsrader({ handelser, kommentarer, lastTill: new Map(), uid: "anna" }).map((r) => r.handelse.id)).not.toContain("h3");
  });
  it("⛔ utan läsmärke är alla andras kommentarer olästa; ett märke efter den senaste tar bort raden", () => {
    expect(kommentarsrader({ handelser, kommentarer, lastTill: new Map(), uid: "anna" }).find((r) => r.handelse.id === "h1")?.olasta).toBe(2);
    expect(kommentarsrader({ handelser, kommentarer, lastTill: new Map([["h1", "2026-10-02T08:00:00.000Z"], ["h2", "2026-10-02T09:00:00.000Z"]]), uid: "anna" })).toEqual([]);
  });
  it("⛔ uid och kartor krävs", () => {
    expect(() => kommentarsrader({ handelser, kommentarer, lastTill: new Map(), uid: "" })).toThrow(/uid krävs/);
    expect(() => kommentarsrader({ handelser, kommentarer: /** @type {any} */ ({}), lastTill: new Map(), uid: "anna" })).toThrow(/kartor/);
  });
});

describe("createKommentarkalla", () => {
  it("skriver, listar äldst först, flyttar läsmärket och tar bort bara sin egen", async () => {
    const minne = createMemorySource({});
    const kalla = createKommentarkalla({ kalla: minne });
    await kalla.skriv("h1", "Andra", { skapare: bo, nu: () => "2026-10-02T11:00:00.000Z" });
    await kalla.skriv("h1", "Första", { skapare: anna, nu: () => "2026-10-02T10:00:00.000Z" });
    const trad = await kalla.lista("h1");
    expect(trad.map((r) => r.text)).toEqual(["Första", "Andra"]);
    const annas = trad[0];
    await expect(kalla.taBort("h1", trad[1].id, "anna")).rejects.toThrow(/någon annans/);
    await kalla.taBort("h1", annas.id, "anna");
    expect((await kalla.lista("h1")).map((r) => r.text)).toEqual(["Andra"]);
    await kalla.markeraLast("h1", "anna", "2026-10-02T12:00:00.000Z");
    expect(await kalla.lastTill(["h1", "h2"], "anna")).toEqual(new Map([["h1", "2026-10-02T12:00:00.000Z"]]));
    expect(await minne.read("handelser/h1/lasmarken", "anna")).toMatchObject({ lastTill: "2026-10-02T12:00:00.000Z" });
  });
  it("⛔ ett id med snedstreck och ett samlingsnamn som inte är ett namn kastar", async () => {
    expect(() => createKommentarkalla({ kalla: createMemorySource({}), kommentarer: "a/b" })).toThrow(/samlingsnamn/);
    await expect(createKommentarkalla({ kalla: createMemorySource({}) }).lista("a/b")).rejects.toThrow(/inte ett id/);
  });
});

describe("handelseregelfragment: kommentarer och läsmärken", () => {
  it("⛔ två undersamlingar med samma namn kastar", () => {
    expect(() => handelseregelfragment({ kommentarer: "svar" })).toThrow(/olika namn/);
    expect(() => handelseregelfragment({ lasmarken: "kommentarer" })).toThrow(/olika namn/);
  });
  it("namnen följer med in i reglerna", () => {
    const r = handelseregelfragment({ handelser: "kalhandelser", kommentarer: "tradar", lasmarken: "lasta" });
    expect(r).toContain("match /kalhandelser/{hid}/tradar/{kid}");
    expect(r).toContain("match /kalhandelser/{hid}/lasta/{uid}");
  });
});

describe("OpsKommentarer", () => {
  const trad = [k("a1", anna, "2026-10-01T09:00:00.000Z", "Jag tar med kaffe"), k("b1", bo, "2026-10-01T10:00:00.000Z", "Jag tar med kaka")];

  it("⛔ en tom tråd säger det", () => {
    render(<OpsKommentarer kommentarer={[]} uid="anna" onSkriv={() => {}} />);
    expect(screen.getByText("Inga kommentarer än.")).toBeInTheDocument();
  });
  it("ritar tråden i given ordning, och bara min kommentar har Ta bort", () => {
    render(<OpsKommentarer kommentarer={trad} uid="anna" onSkriv={() => {}} onTaBort={() => {}} />);
    const rader = screen.getAllByRole("listitem");
    expect(rader.map((r) => r.getAttribute("data-kommentar"))).toEqual(["a1", "b1"]);
    expect(within(rader[0]).getByText("Anna Ek (du)")).toBeInTheDocument();
    expect(within(rader[0]).getByRole("button", { name: /Ta bort/ })).toBeInTheDocument();
    expect(within(rader[1]).queryByRole("button", { name: /Ta bort/ })).toBeNull();
  });
  it("⛔ utan onTaBort finns ingen Ta bort-knapp, inte ens på min", () => {
    render(<OpsKommentarer kommentarer={trad} uid="anna" onSkriv={() => {}} />);
    expect(screen.queryByRole("button", { name: /Ta bort/ })).toBeNull();
  });
  it("skickar den trimmade texten och tömmer rutan; Skicka är spärrad när rutan är tom", async () => {
    const skrivna = /** @type {string[]} */ ([]);
    render(<OpsKommentarer kommentarer={[]} uid="anna" onSkriv={(t) => { skrivna.push(t); }} />);
    const skicka = screen.getByRole("button", { name: "Skicka" });
    expect(skicka).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Skriv en kommentar"), { target: { value: "  Hej  " } });
    fireEvent.click(skicka);
    await waitFor(() => expect(skrivna).toEqual(["Hej"]));
    await waitFor(() => expect(screen.getByLabelText("Skriv en kommentar")).toHaveValue(""));
  });
  it("⛔ ett skrivfel står utskrivet och texten blir kvar", async () => {
    render(<OpsKommentarer kommentarer={[]} uid="anna" onSkriv={() => Promise.reject(new Error("nekad"))} />);
    fireEvent.change(screen.getByLabelText("Skriv en kommentar"), { target: { value: "Hej" } });
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    expect(await screen.findByText(/Kommentaren sparades inte: nekad/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Skriv en kommentar/)).toHaveValue("Hej");
  });
  it("tar bort min kommentar med id:t", async () => {
    const borttagna = /** @type {string[]} */ ([]);
    render(<OpsKommentarer kommentarer={trad} uid="anna" onSkriv={() => {}} onTaBort={(id) => { borttagna.push(id); }} />);
    fireEvent.click(screen.getByRole("button", { name: /Ta bort/ }));
    await waitFor(() => expect(borttagna).toEqual(["a1"]));
  });
  it("⛔ läsfel står utskrivet med texten, inte som en tom tråd", () => {
    render(<OpsKommentarer kommentarer={[]} uid="anna" onSkriv={() => {}} fel={new Error("Missing or insufficient permissions.")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Kommentarerna kunde inte läsas: Missing or insufficient permissions.");
    expect(screen.queryByText("Inga kommentarer än.")).toBeNull();
  });
  it("engelska ur providern", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsKommentarer kommentarer={[]} uid="anna" onSkriv={() => {}} />
      </OpsSprakProvider>,
    );
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
  it("⛔ utan onSkriv kastar den", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsKommentarer kommentarer={[]} uid="anna" />)).toThrow(/onSkriv krävs/);
    spy.mockRestore();
  });
});

describe("OpsKommentarsrad och panelens slot", () => {
  it("raden säger antalet, vem och vad, och öppnar händelsen", () => {
    const oppna = vi.fn();
    render(<OpsKommentarsrad titel="Höstfest" olasta={2} namn="Bo Lind" text="Jag tar med kaka" onOppna={oppna} />);
    const knapp = screen.getByRole("button", { name: /Höstfest/ });
    expect(knapp).toHaveTextContent("2 nya kommentarer · Bo Lind: Jag tar med kaka");
    fireEvent.click(knapp);
    expect(oppna).toHaveBeenCalledOnce();
  });
  it("med href är raden en länk till händelsen; utan href och onOppna kastar den", () => {
    render(<OpsKommentarsrad titel="Höstfest" olasta={1} namn="" text="Hej" href="?handelse=h1" />);
    const lank = screen.getByRole("link", { name: /Höstfest/ });
    expect(lank).toHaveAttribute("href", "?handelse=h1");
    expect(lank).toHaveTextContent("1 ny kommentar · Namn saknas: Hej");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsKommentarsrad titel="X" olasta={1} namn="" text="" />)).toThrow(/href eller onOppna/);
    spy.mockRestore();
  });
  it("med href OCH onOppna är raden en länk, och onOppna anropas vid klicket (för att markera läst)", () => {
    const markera = vi.fn();
    render(<OpsKommentarsrad titel="Höstfest" olasta={1} namn="Bo" text="Hej" href="#h1" onOppna={markera} />);
    const lank = screen.getByRole("link", { name: /Höstfest/ });
    expect(lank).toHaveAttribute("href", "#h1");
    fireEvent.click(lank);
    expect(markera).toHaveBeenCalledOnce();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    spy.mockRestore();
  });
  it("panelen ritar tråden under händelsen när den får den, och inget utan", () => {
    const { unmount } = render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Höstfest", datum: "2026-10-12" }} onTillbaka={() => {}} statusWords={{}} kommentarer={<p>Tråden</p>} />);
    expect(document.querySelector("[data-handelsekommentarer]")).toHaveTextContent("Tråden");
    unmount();
    render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Höstfest", datum: "2026-10-12" }} onTillbaka={() => {}} statusWords={{}} />);
    expect(document.querySelector("[data-handelsekommentarer]")).toBeNull();
  });
});
