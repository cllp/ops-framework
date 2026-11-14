import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * Tillägg till skrivfältet i ett öppet samtal (0.226.0, cllp/ops-framework#592).
 *
 * CP 2026-11-14, beslutet "Jag går på Fables rekommendation", punkt 3: "Öppen tråd med människor: talet läggs i trådens skrivfält, och man
 * trycker Skicka själv." Fable: "Fel ord till en grupp går inte att ta tillbaka och står i någon annans telefon."
 *
 * ⛔ HÄR MÄTS ATT TEXTEN HAMNAR I RÄTT SKRIVFÄLT OCH ATT INGENTING SKICKAS: källans `skicka` bevakas, och de lagrade meddelandena räknas.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];

async function underlag() {
  let t = Date.now() - 60000;
  const kalla = createMemorySource({});
  const samtal = createSamtalskalla({ kalla, klocka: () => (t += 1000) });
  const g = await samtal.oppnaGrupp({ groupId: "g", uid: "anna" });
  await samtal.skicka(g.id, { text: "Hej alla", av: "bo" });
  const p = await samtal.oppnaPrivat({ groupId: "g", uid: "bo", annan: "anna" });
  await samtal.skicka(p.id, { text: "Kan du titta på fakturan?", av: "bo" });
  // Källan är fryst: bevakningen är en kopia där `skicka` är en spion som ändå skickar, så att ett skick syns både här och i lagret.
  const skicka = vi.fn(samtal.skicka);
  return { samtal: { ...samtal, skicka }, privat: p, grupp: g, skicka };
}

/** @param {any} samtal @param {Record<string, any>} p */
const vy = (samtal, p) => <OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} {...p} />;
const falt = () => /** @type {Promise<HTMLTextAreaElement>} */ (screen.findByRole("textbox", { name: "Skriv ett meddelande" }));

describe("skrivfaltTillagg", () => {
  it("⛔ texten står i det valda samtalets skrivfält, fältet har fokus, och ingenting skickas", async () => {
    const { samtal, privat, skicka } = await underlag();
    render(vy(samtal, { valt: privat.id, skrivfaltTillagg: { samtal: privat.id, text: "Jag tittar i kväll", nyckel: 1 } }));
    const ruta = await falt();
    await waitFor(() => expect(ruta.value).toBe("Jag tittar i kväll"));
    expect(document.activeElement).toBe(ruta);
    expect(skicka).not.toHaveBeenCalled();
    expect(await samtal.meddelanden(privat.id)).toHaveLength(1);
  });

  it("⛔ ett annat samtals id gör ingenting", async () => {
    const { samtal, privat, grupp, skicka } = await underlag();
    render(vy(samtal, { valt: privat.id, skrivfaltTillagg: { samtal: grupp.id, text: "Till gruppen", nyckel: 1 } }));
    const ruta = await falt();
    await within(await screen.findByRole("log", { name: "Bo Lind" })).findByText("Kan du titta på fakturan?");
    expect(ruta.value).toBe("");
    expect(skicka).not.toHaveBeenCalled();
  });

  it("⛔ samma nyckel läggs in en gång, också när samtalet öppnas igen, och en ny nyckel läggs till med ett mellanslag", async () => {
    const { samtal, privat, grupp, skicka } = await underlag();
    const tillagg = { samtal: privat.id, text: "Jag tittar", nyckel: "a" };
    const { rerender } = render(vy(samtal, { valt: privat.id, skrivfaltTillagg: tillagg }));
    const ruta = await falt();
    await waitFor(() => expect(ruta.value).toBe("Jag tittar"));
    rerender(vy(samtal, { valt: privat.id, skrivfaltTillagg: { ...tillagg } }));
    expect(ruta.value).toBe("Jag tittar");
    rerender(vy(samtal, { valt: privat.id, skrivfaltTillagg: { samtal: privat.id, text: "i kväll", nyckel: "b" } }));
    await waitFor(() => expect(ruta.value).toBe("Jag tittar i kväll"));
    // Till gruppchatten och tillbaka: samtalet monteras om med ett tomt fält, och tillägget som redan lagts in kommer inte igen.
    rerender(vy(samtal, { valt: grupp.id, skrivfaltTillagg: { samtal: privat.id, text: "i kväll", nyckel: "b" } }));
    await screen.findByRole("log", { name: "Alfa AB" });
    rerender(vy(samtal, { valt: privat.id, skrivfaltTillagg: { samtal: privat.id, text: "i kväll", nyckel: "b" } }));
    await screen.findByRole("log", { name: "Bo Lind" });
    expect((await falt()).value).toBe("");
    expect(skicka).not.toHaveBeenCalled();
  });

  it("⛔ en felformad skrivfaltTillagg kastar, på svenska", async () => {
    const { samtal } = await underlag();
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(vy(samtal, { skrivfaltTillagg: { samtal: "", text: " ", nyckel: null } }))).toThrow(/skrivfaltTillagg samtal ska vara samtalets id, text ska vara en sträng som inte är tom, nyckel ska vara en sträng eller ett tal/);
    } finally {
      konsol.mockRestore();
    }
  });
});
