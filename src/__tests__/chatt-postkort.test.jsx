import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * Etapp 7 av chattens nattskiva: länk till post som kort.
 *
 * ⛔ HÄR MÄTS BETEENDE: appens uppslag avgör vilka länkar som blir kort, ramverket lagrar ingen titel, högst två kort, ett uppslag per
 * adress, appens navigering används, och ett fel sägs ut.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];

async function underlag(/** @type {string[]} */ texter) {
  const kalla = createMemorySource({});
  const s = createSamtalskalla({ kalla });
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  for (const text of texter) await s.skicka(p.id, { text, av: "bo" });
  return { kalla, s, p };
}

/** Appens uppslag: bara adresser under /arenden/ är poster. */
const slaUpp = vi.fn(async (/** @type {string} */ url) => {
  const m = url.match(/^https:\/\/app\.exempel\.se\/arenden\/(\d+)$/);
  return m ? { titel: `Ärende ${m[1]}: Moms augusti`, undertitel: "Ärende" } : null;
});

describe("länk till post som kort", () => {
  it("⛔ appen avgör: en intern adress blir ett kort, en extern förblir en länk, och inget lagras i meddelandet", async () => {
    slaUpp.mockClear();
    const { kalla, s, p } = await underlag(["Se https://app.exempel.se/arenden/464 och https://extern.se/x"]);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} postkort={{ slaUpp }} />);
    const kort = await waitFor(() => {
      const k = document.querySelector('[data-postkort="https://app.exempel.se/arenden/464"]');
      expect(k).not.toBeNull();
      return /** @type {HTMLElement} */ (k);
    });
    expect(kort.textContent).toBe("Ärende 464: Moms augustiÄrende");
    expect(kort.getAttribute("href")).toBe("https://app.exempel.se/arenden/464");
    expect(document.querySelector('[data-postkort="https://extern.se/x"]')).toBeNull();
    const [rad] = await kalla.list(`samtal/${p.id}/meddelanden`);
    expect(Object.keys(rad).sort()).toEqual(["av", "id", "text", "tid"]);
  });
  it("⛔ högst två kort, och samma adress slås upp en gång", async () => {
    slaUpp.mockClear();
    const { s, p } = await underlag([
      "https://app.exempel.se/arenden/1 https://app.exempel.se/arenden/2 https://app.exempel.se/arenden/3",
      "Igen: https://app.exempel.se/arenden/1",
    ]);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} postkort={{ slaUpp }} />);
    await waitFor(() => expect(document.querySelectorAll("[data-postkort]").length).toBe(3));
    const forsta = /** @type {HTMLElement} */ (document.querySelectorAll("[data-bubbla]")[0].parentElement);
    expect(forsta.querySelectorAll("[data-postkort]").length).toBe(2);
    expect(slaUpp.mock.calls.filter(([u]) => u === "https://app.exempel.se/arenden/1")).toHaveLength(1);
    expect(slaUpp.mock.calls.some(([u]) => u === "https://app.exempel.se/arenden/3")).toBe(false);
  });
  it("⛔ appens navigering används, och ett uppslag som föll sägs ut", async () => {
    const { s, p } = await underlag(["https://app.exempel.se/arenden/7", "https://app.exempel.se/trasig"]);
    const onOppna = vi.fn((/** @type {string} */ _u, /** @type {any} */ e) => e.preventDefault());
    const sla = async (/** @type {string} */ url) => {
      if (url.endsWith("trasig")) throw new Error("nät");
      return { titel: "Ärende 7" };
    };
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} postkort={{ slaUpp: sla, onOppna }} />);
    const kort = await screen.findByRole("link", { name: "Ärende 7" });
    fireEvent.click(kort);
    expect(onOppna).toHaveBeenCalledWith("https://app.exempel.se/arenden/7", expect.anything());
    expect((await screen.findByText("Länken kunde inte slås upp.")).getAttribute("role")).toBe("alert");
  });
  it("⛔ utan postkort: inga kort och inga uppslag", async () => {
    const { s, p } = await underlag(["https://app.exempel.se/arenden/9"]);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    await within(await screen.findByRole("log")).findByRole("link", { name: "https://app.exempel.se/arenden/9" });
    expect(document.querySelector("[data-postkort]")).toBeNull();
  });
});
