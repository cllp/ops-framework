import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsKommentarer, OpsKommentarsrad } from "../components/OpsKommentarer.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { OppnaHandelseKontext } from "../lib/handelsekontext.js";
import { createMemorySource } from "../data/adapters.js";
import { createKommentarkalla } from "../data/kalenderkalla.js";
import { byggKommentar, KOMMENTARBILAGA_TYPER, kommentarbilagaFel, kommentarsrader, MAX_HANDELSEKOMMENTAR, MAX_KOMMENTARBILAGA } from "../lib/handelsemodell.js";
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
  it("⛔ inne i skalet öppnar länken panelen utan omladdning; med Cmd följer den länken som vanligt", () => {
    const oppnade = /** @type {string[]} */ ([]);
    render(
      <OppnaHandelseKontext.Provider value={(id) => oppnade.push(id)}>
        <OpsKommentarsrad titel="Höstfest" olasta={1} namn="Bo" text="Hej" href="?handelse=h1" />
      </OppnaHandelseKontext.Provider>,
    );
    const lank = screen.getByRole("link", { name: /Höstfest/ });
    expect(fireEvent.click(lank)).toBe(false);
    expect(oppnade).toEqual(["h1"]);
    expect(fireEvent.click(lank, { metaKey: true })).toBe(true);
    expect(oppnade).toEqual(["h1"]);
  });
  it("panelen ritar tråden under händelsen när den får den, och inget utan", () => {
    const { unmount } = render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Höstfest", datum: "2026-10-12" }} onTillbaka={() => {}} statusWords={{}} kommentarer={<p>Tråden</p>} />);
    expect(document.querySelector("[data-handelsekommentarer]")).toHaveTextContent("Tråden");
    unmount();
    render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Höstfest", datum: "2026-10-12" }} onTillbaka={() => {}} statusWords={{}} />);
    expect(document.querySelector("[data-handelsekommentarer]")).toBeNull();
  });
});

/*
 * ══ ⛔ BILD OCH FIL I KOMMENTARER (0.71.0, cllp/bolag-ops#570) ═══════════════════════════════════════════════════════════════
 *
 * CP 2026-10-06: "Vill kunna klistra in bild i kommentar." Regelproven (icke-medlem nekas, för stor fil och fel typ nekas i
 * regeln) ligger i `rules/__tests__/handelsekommentarer.test.mjs`. Här: modellen, filväljarens avslag och inklistringen.
 */
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const bild = (extra = {}) => ({ dataUrl: PNG, namn: "skarm.png", typ: "image/png", tecken: PNG.length, ...extra });

/** Klistrar in filer på dokumentet, som Cmd+V gör med en skärmbild i urklippet. */
const klistraIn = (/** @type {File[]} */ filer) => {
  const e = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clipboardData", { value: { files: filer } });
  document.dispatchEvent(e);
};

describe("kommentarens bilaga: modellen", () => {
  it("med en bilaga får texten vara tom, och bilagan följer med i inkorgens form", () => {
    const r = byggKommentar("", { skapare: anna, nu: () => "2026-10-06T10:00:00.000Z", bilaga: bild() });
    expect(r).toEqual({ text: "", skapad: "2026-10-06T10:00:00.000Z", skapadAv: anna, bilaga: bild() });
  });
  it("⛔ fel typ, för stor, innehåll som inte är typen och okända fält kastar med ett besked", () => {
    expect(() => byggKommentar("", { skapare: anna, bilaga: bild({ typ: "image/svg+xml", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=", tecken: 26 }) })).toThrow(/går inte att bifoga/);
    const stor = "data:application/pdf;base64," + "A".repeat(MAX_KOMMENTARBILAGA);
    expect(() => byggKommentar("Hej", { skapare: anna, bilaga: { dataUrl: stor, namn: "a.pdf", typ: "application/pdf", tecken: stor.length } })).toThrow(/för stor/);
    expect(kommentarbilagaFel(bild({ typ: "application/pdf" }))).toMatch(/stämmer inte med dess typ/);
    expect(kommentarbilagaFel(bild({ url: "https://x" }))).toMatch(/url/);
    expect(kommentarbilagaFel(bild({ tecken: 1 }))).toMatch(/storlek/);
    expect(kommentarbilagaFel(bild())).toBeNull();
  });
  it("regeln bär samma typer och samma tak som modellen", () => {
    const r = handelseregelfragment();
    expect(KOMMENTARBILAGA_TYPER.length).toBeGreaterThanOrEqual(5);
    for (const t of KOMMENTARBILAGA_TYPER) expect(r).toContain(`"${t}"`);
    expect(r).toContain(`bilaga.dataUrl.size() <= ${MAX_KOMMENTARBILAGA}`);
    expect(r).not.toContain("svg");
  });
});

describe("OpsKommentarer med bilagor", () => {
  it("⛔ utan bilagor finns ingen filväljare, och en befintlig bilaga visas ändå", () => {
    render(<OpsKommentarer kommentarer={[{ ...k("a1", bo, "2026-10-06T09:00:00.000Z", ""), bilaga: bild() }]} uid="anna" onSkriv={() => {}} />);
    expect(screen.queryByLabelText("Bifoga bild eller fil")).toBeNull();
    expect(screen.getByRole("img", { name: "Bilaga från Bo Lind: skarm.png" })).toBeInTheDocument();
  });

  it("en fil som inte är en bild visas med sitt namn och laddas ned", () => {
    const pdf = "data:application/pdf;base64,JVBERi0=";
    render(<OpsKommentarer kommentarer={[{ ...k("a1", bo, "2026-10-06T09:00:00.000Z", "Utdraget"), bilaga: { dataUrl: pdf, namn: "utdrag.pdf", typ: "application/pdf", tecken: pdf.length } }]} uid="anna" onSkriv={() => {}} />);
    const lank = screen.getByRole("link", { name: /utdrag\.pdf/ });
    expect(lank).toHaveAttribute("download", "utdrag.pdf");
    expect(lank.getAttribute("data-kommentar-bilaga-visad")).toBe("fil");
  });

  it("inklistring (Cmd+V) ger en bilaga med förhandsvisning, och den skickas med texten", async () => {
    /** @type {any[]} */
    const skrivna = [];
    render(<OpsKommentarer bilagor kommentarer={[]} uid="anna" onSkriv={(t, x) => { skrivna.push([t, x]); }} />);
    expect(screen.getByRole("button", { name: "Skicka" })).toBeDisabled();
    fireEvent.focus(screen.getByLabelText("Skriv en kommentar"));
    klistraIn([new File([new Uint8Array([137, 80, 78, 71])], "skarm.png", { type: "image/png" })]);
    const forhand = await screen.findByRole("img", { name: "Vald bilaga: skarm.png" });
    expect(forhand.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    // ⛔ Bara bilagan räcker: Skicka går att trycka utan text.
    expect(screen.getByRole("button", { name: "Skicka" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(skrivna).toHaveLength(1));
    const [text, { bilaga }] = skrivna[0];
    expect(text).toBe("");
    expect(bilaga).toMatchObject({ namn: "skarm.png", typ: "image/png" });
    expect(kommentarbilagaFel(bilaga)).toBeNull();
    await waitFor(() => expect(screen.queryByRole("img", { name: /Vald bilaga/ })).toBeNull());
  });

  it("⛔ en inklistring när fokus inte är i tråden tas inte, så två öppna trådar inte får samma bild", async () => {
    render(
      <>
        <OpsKommentarer bilagor kommentarer={[]} uid="anna" onSkriv={() => {}} rubrik="Första" />
        <OpsKommentarer bilagor kommentarer={[]} uid="anna" onSkriv={() => {}} rubrik="Andra" />
      </>,
    );
    const [forsta, andra] = /** @type {HTMLElement[]} */ ([...document.querySelectorAll("[data-ops-kommentarer]")]);
    fireEvent.focus(within(andra).getByLabelText("Skriv en kommentar"));
    klistraIn([new File([new Uint8Array([137, 80, 78, 71])], "skarm.png", { type: "image/png" })]);
    expect(await within(andra).findByRole("img", { name: "Vald bilaga: skarm.png" })).toBeInTheDocument();
    expect(within(forsta).queryByRole("img", { name: /Vald bilaga/ })).toBeNull();
  });

  it("⛔ fel typ nekas i klienten med besked, och ingen bilaga skickas", async () => {
    const onSkriv = vi.fn();
    render(<OpsKommentarer bilagor kommentarer={[]} uid="anna" onSkriv={onSkriv} />);
    fireEvent.focus(screen.getByLabelText("Skriv en kommentar"));
    klistraIn([new File(["MZ"], "program.exe", { type: "application/x-msdownload" })]);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Filtypen "application\/x-msdownload" går inte att bifoga/);
    expect(screen.getByRole("button", { name: "Skicka" })).toBeDisabled();
    expect(onSkriv).not.toHaveBeenCalled();
  });

  it("⛔ för stor fil nekas i klienten innan den läses", async () => {
    render(<OpsKommentarer bilagor kommentarer={[]} uid="anna" onSkriv={() => {}} />);
    const stor = new File([new Uint8Array(Math.ceil(MAX_KOMMENTARBILAGA / 1.4) + 1024)], "stor.pdf", { type: "application/pdf" });
    fireEvent.focus(screen.getByLabelText("Skriv en kommentar"));
    klistraIn([stor]);
    expect(await screen.findByRole("alert")).toHaveTextContent(/för stor/);
    expect(screen.getByRole("button", { name: "Skicka" })).toBeDisabled();
  });
});
