import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * Etapp 8 av chattens nattskiva: skrivfältet efter CP:s förebild, med TALK till fältet (0.230.0). Bilagorna väntar på modulen i PR 277.
 *
 * ⛔ HÄR MÄTS BETEENDE: platstexten följer samtalet, ingen ljudvåg i skrivfältet (0.230.0, #602: TALK skriver in det sagda, se talk-till-falt), stopp
 * finns bara när något pågår, och plus finns inte utan bilagemodulen. Utseendet och 44 px mäts i check-skalyta 29g (8).
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

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
  it("⛔ ingen ljudvåg i skrivfältet (0.230.0, #602: TALK är den enda röstknappen), utan bilagemodulen inget plus, och inget stopp när inget pågår", async () => {
    const { s, a } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    await within(await screen.findByRole("log")).findByText("Hej");
    expect(screen.queryByRole("button", { name: "Prata in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Bifoga" })).toBeNull();
    expect(document.querySelector("[data-stopp]")).toBeNull();
    expect(screen.getByRole("button", { name: "Skicka" })).toBeTruthy();
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
