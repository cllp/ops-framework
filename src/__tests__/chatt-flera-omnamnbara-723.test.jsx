import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * API-agenterna i @-listan (cllp/lifehub.app#723). Appen lägger API-nycklarnas medlemskap med status "avslutad", bara för att namnge vad de skrev: chatten tar
 * "första aktiva agenten" ur samma lista, och en nyckel får inte bli något man pratar med. `flerOmnamnbara` lägger dem till @-kandidaterna och ingenting annat.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4), utfallen står i commit-meddelandet.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
  // Nyckelns medlemskap: avslutat. Det får aldrig bli agenten chatten väljer.
  { userId: "k_bygg", namn: "Byggnyckeln", typ: "agent", status: "avslutad" },
];
const NYCKLAR = [
  { userId: "k_bygg", namn: "Byggnyckeln", typ: "agent" },
  { userId: "k_rapport", namn: "Rapportnyckeln" },
];

async function underlag() {
  const kalla = createMemorySource({});
  const s = /** @type {any} */ (createSamtalskalla({ kalla, omnamnanden: true, amnen: true }));
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  await s.skicka(g.id, { text: "Hej", av: "bo" });
  return { kalla, s, g };
}

async function ritaMed(/** @type {Record<string, any>} */ extra) {
  const k = await underlag();
  render(<OpsMeddelanden kalla={k.s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={k.g.id} {...extra} />);
  const ruta = /** @type {HTMLTextAreaElement} */ (await screen.findByRole("textbox", { name: "Skriv ett meddelande" }));
  return { ...k, ruta };
}

async function kandidater(/** @type {Record<string, any>} */ extra) {
  const { ruta } = await ritaMed(extra);
  fireEvent.change(ruta, { target: { value: "Fråga @", selectionStart: 7 } });
  const lista = await screen.findByRole("listbox", { name: "Nämn någon" });
  return within(lista).getAllByRole("option").map((o) => o.textContent);
}

describe("@-listan med flerOmnamnbara", () => {
  it("⛔ utan propen är listan exakt som förut: aktiva medlemmar utom en själv, och alla", async () => {
    expect(await kandidater({})).toEqual(["@Bo Lind", "Ops-agenten", "alla"]);
  });

  it("⛔ med propen läggs nycklarna till med appens namn, utan dubbletter, utan en själv och utan tomt id", async () => {
    const namn = await kandidater({ flerOmnamnbara: [...NYCKLAR, { userId: "ops", namn: "Falsk dubblett" }, { userId: "anna", namn: "Jag själv" }, { userId: "", namn: "Tomt id" }] });
    expect(namn).toEqual(["@Bo Lind", "Ops-agenten", "Byggnyckeln", "Rapportnyckeln", "alla"]);
  });

  it("⛔ ett nämnande av en nyckel skrivs i namner som uid, som för en medlem", async () => {
    const { kalla, g, ruta } = await ritaMed({ flerOmnamnbara: NYCKLAR });
    fireEvent.change(ruta, { target: { value: "Fråga @rapp", selectionStart: 11 } });
    await waitFor(() => expect(within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Rapportnyckeln"]));
    fireEvent.keyDown(ruta, { key: "Enter" });
    expect(ruta.value).toBe("Fråga @Rapportnyckeln ");
    fireEvent.keyDown(ruta, { key: "Enter" });
    await waitFor(async () => {
      const rader = await kalla.list(`samtal/${g.id}/meddelanden`);
      expect(rader.find((/** @type {any} */ r) => r.text.startsWith("Fråga"))?.namner).toEqual(["k_rapport"]);
    });
  });
});

describe("flerOmnamnbara påverkar inte vilken agent chatten väljer", () => {
  it("⛔ Nytt samtal med agenten går till gruppens aktiva agent, med och utan propen", async () => {
    for (const extra of [{}, { flerOmnamnbara: [{ userId: "a_forst", namn: "Först", typ: "agent" }, ...NYCKLAR] }]) {
      const { s } = await underlag();
      let valt = /** @type {string | null} */ (null);
      const vy = render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} nytt="agent" valt={null} onValj={(/** @type {string | null} */ id) => (valt = id)} {...extra} />);
      await waitFor(() => expect(document.querySelector("[data-amne='ny']")).toBeTruthy());
      fireEvent.change(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), { target: { value: "Hur ligger momsen till?" } });
      fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
      await waitFor(() => expect(valt).toMatch(/^g\|anna\|ops\|a_/));
      vy.unmount();
    }
  });
});
