import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * Etapp 8 av chattens nattskiva: skrivfältet efter CP:s förebild, med röstinmatning. Bilagorna väntar på modulen i PR 277.
 *
 * ⛔ HÄR MÄTS BETEENDE: platstexten följer samtalet, ljudvågen finns bara med `onTranscribe`, rösten går in i fältet utan att skickas,
 * en misslyckad transkribering säger det och behåller ljudet för ett nytt försök, stopp finns bara när något pågår, och plus finns
 * inte utan bilagemodulen. Utseendet och 44 px mäts i check-skalyta 29g (8).
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

/** En inspelare utan mikrofon: starta, stoppa med ett ljud, kasta. */
function provinspelare() {
  const blob = new Blob(["ljud"], { type: "audio/webm" });
  return {
    blob,
    kastad: 0,
    starta: vi.fn(async () => {}),
    stoppa: vi.fn(async () => ({ blob, mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(function () {
      this.kastad += 1;
    }),
    niva: () => 0.5,
  };
}

async function underlag(/** @type {{ status?: boolean }} */ val = {}) {
  const kalla = createMemorySource({});
  const s = /** @type {any} */ (createSamtalskalla({ kalla, ...(val.status ? { status: "status" } : {}) }));
  const a = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
  await s.skicka(a.id, { text: "Hej", av: "anna" });
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  await s.skicka(g.id, { text: "Hej gruppen", av: "anna" });
  return { kalla, s, a, g };
}

const ruta = () => /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Skriv ett meddelande" }));

describe("skrivfältet", () => {
  it("⛔ platstexten följer samtalet: gruppen, agenten", async () => {
    const { s, a, g } = await underlag();
    const { rerender } = render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    await within(await screen.findByRole("log")).findByText("Hej gruppen");
    expect(ruta().getAttribute("placeholder")).toBe("Skriv till gruppen");
    rerender(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    await waitFor(() => expect(ruta().getAttribute("placeholder")).toBe("Fråga agenten"));
  });
  it("⛔ utan onTranscribe ingen ljudvåg, utan bilagemodulen inget plus, och inget stopp när inget pågår", async () => {
    const { s, a } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    await within(await screen.findByRole("log")).findByText("Hej");
    expect(screen.queryByRole("button", { name: "Prata in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Bifoga" })).toBeNull();
    expect(document.querySelector("[data-stopp]")).toBeNull();
    expect(screen.getByRole("button", { name: "Skicka" })).toBeTruthy();
  });
  it("⛔ rösten: ljudvågen spelar in, ett andra tryck skriver ut, och texten hamnar i fältet utan att skickas", async () => {
    const { kalla, s, a } = await underlag();
    const insp = provinspelare();
    const onTranscribe = vi.fn(async () => "påminn mig på fredag");
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onTranscribe={onTranscribe} inspelare={insp} />);
    await within(await screen.findByRole("log")).findByText("Hej");
    fireEvent.change(ruta(), { target: { value: "Kan du" } });
    fireEvent.change(ruta(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    await waitFor(() => expect(insp.starta).toHaveBeenCalled());
    expect((await screen.findByText(/Spelar in/)).closest("[role=status]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Avbryt inspelningen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skriv ut det inspelade" }));
    await waitFor(() => expect(ruta().value).toBe("påminn mig på fredag"));
    expect(onTranscribe).toHaveBeenCalledWith(insp.blob);
    expect(await kalla.list(`samtal/${a.id}/meddelanden`)).toHaveLength(1);
    expect(document.querySelector("[data-rostlage]")).toBeNull();
    expect(screen.getByRole("button", { name: "Skicka" })).toBeTruthy();
  });
  it("⛔ en misslyckad transkribering säger det, behåller ljudet, och Försök igen skickar samma ljud", async () => {
    const { s, a } = await underlag();
    const insp = provinspelare();
    const onTranscribe = vi.fn().mockRejectedValueOnce(new Error("Tjänsten svarade 503.")).mockResolvedValueOnce("andra försöket");
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onTranscribe={onTranscribe} inspelare={insp} />);
    await within(await screen.findByRole("log")).findByText("Hej");
    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    await waitFor(() => expect(insp.starta).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Skriv ut det inspelade" }));
    const fel = await screen.findByRole("alert");
    expect(fel.textContent).toContain("Det inspelade kunde inte skrivas ut.");
    expect(fel.textContent).toContain("Tjänsten svarade 503.");
    fireEvent.click(within(fel).getByRole("button", { name: "Försök igen" }));
    await waitFor(() => expect(ruta().value).toBe("andra försöket"));
    expect(onTranscribe).toHaveBeenNthCalledWith(2, insp.blob);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("⛔ Kasta ljudet är det enda som tar bort det, och stopp under inspelningen avbryter utan transkribering", async () => {
    const { s, a } = await underlag();
    const insp = provinspelare();
    const onTranscribe = vi.fn().mockRejectedValue(new Error("nej"));
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onTranscribe={onTranscribe} inspelare={insp} />);
    await within(await screen.findByRole("log")).findByText("Hej");
    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    await waitFor(() => expect(insp.starta).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Avbryt inspelningen" }));
    await waitFor(() => expect(insp.kasta).toHaveBeenCalled());
    expect(onTranscribe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    await waitFor(() => expect(insp.starta).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole("button", { name: "Skriv ut det inspelade" }));
    const fel = await screen.findByRole("alert");
    fireEvent.click(within(fel).getByRole("button", { name: "Kasta ljudet" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(ruta().value).toBe("");
  });
  it("⛔ stopp för agenten bara när den arbetar och appen gett onStoppaAgent", async () => {
    const { kalla, s, a } = await underlag({ status: true });
    await kalla.create(`samtal/${a.id}/status`, { id: "agent", lage: "tanker", sedan: Date.now() });
    const onStoppaAgent = vi.fn();
    const { rerender } = render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    await waitFor(() => expect(document.querySelector('[data-agentstatus="tanker"]')).not.toBeNull());
    expect(document.querySelector("[data-stopp]")).toBeNull();
    rerender(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onStoppaAgent={onStoppaAgent} />);
    fireEvent.click(await screen.findByRole("button", { name: "Stoppa agenten" }));
    expect(onStoppaAgent).toHaveBeenCalledWith(a.id);
  });
});

describe("plusmenyn (kopplas in när bilagemodulen i PR 277 finns)", () => {
  const t = /** @type {any} */ ({ bifoga: "Bifoga", bifogaBild: "Bifoga bild", taFoto: "Ta foto", valjFil: "Välj fil" });
  it("⛔ tre rader, pilarna flyttar, Escape stänger med fokus på plus, och filerna går till appen med sitt slag", async () => {
    const { Plusmeny } = await import("../components/OpsMeddelanden.jsx");
    const onBifoga = vi.fn();
    render(<Plusmeny onBifoga={onBifoga} texter={t} />);
    const plus = screen.getByRole("button", { name: "Bifoga" });
    fireEvent.click(plus);
    const meny = screen.getByRole("menu", { name: "Bifoga" });
    const rader = within(meny).getAllByRole("menuitem");
    expect(rader.map((r) => r.textContent)).toEqual(["Bifoga bild", "Ta foto", "Välj fil"]);
    expect(document.activeElement).toBe(rader[0]);
    fireEvent.keyDown(meny, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rader[1]);
    fireEvent.keyDown(meny, { key: "ArrowUp" });
    fireEvent.keyDown(meny, { key: "ArrowUp" });
    expect(document.activeElement).toBe(rader[2]);
    fireEvent.keyDown(meny, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(plus);
    const foto = /** @type {HTMLInputElement} */ (document.querySelector('[data-plusval="foto"]'));
    expect(foto.getAttribute("capture")).toBe("environment");
    expect(foto.getAttribute("accept")).toBe("image/*");
    expect(document.querySelector('[data-plusval="fil"]')?.hasAttribute("accept")).toBe(false);
    const fil = new File(["x"], "kvitto.jpg", { type: "image/jpeg" });
    fireEvent.change(foto, { target: { files: [fil] } });
    expect(onBifoga).toHaveBeenCalledWith([fil], "foto");
  });
});
