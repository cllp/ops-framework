import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/*
 * P0 2026-10-15 (appen på 0.106.0): ett Nytt samtal med agenten gick inte att skicka, och på Windows stod "Meddelandena kunde inte
 * hämtas. Missing or insufficient permissions." direkt när Nytt samtal öppnades. Mätbygget och komponentproven kör minneskällan, som
 * inte har regler, så inget prov såg det.
 *
 * Källan här är minneskällan med de två regler som avgjorde: samtalsdokumentets läsregel (`opsFarLasaSamtal(resource.data)`) nekar ett
 * dokument som inte finns, och allt under ett samtal (meddelanden, läsmärken, status) kräver att samtalet finns (`opsISamtal`). Den
 * har också en `subscribe`, som Firestore-källan, så att en lyssnare mäts. Själva reglerna mäts mot emulatorn i
 * `rules/__tests__/amnen-kalla.test.mjs`; här mäts vilka anrop vyn gör.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Hugo", typ: "agent", status: "aktiv" },
];

/**
 * Minneskällan med reglernas två krav, och en lista över nekade anrop. `nekaNyttSamtal` nekar också skapelsen av ett samtal, som en
 * regel som ännu inte är deployad.
 */
function regelkalla() {
  const regler = { nekaNyttSamtal: false };
  const bas = createMemorySource({});
  /** @type {string[]} */
  const nekade = [];
  const finns = async (/** @type {string} */ sid) => Boolean(await bas.read("samtal", sid));
  /** Samtalets id ur en väg under det, eller null. @param {string} vag */
  const under = (vag) => (vag.startsWith("samtal/") ? decodeURIComponent(vag.split("/")[1]) : null);
  const neka = (/** @type {string} */ vad) => {
    nekade.push(vad);
    return Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
  };
  const kalla = {
    ...bas,
    async read(/** @type {string} */ c, /** @type {string} */ id) {
      if (c === "samtal" && !(await finns(id))) throw neka(`read samtal/${id}`);
      const sid = under(c);
      if (sid && !(await finns(sid))) throw neka(`read ${c}/${id}`);
      return bas.read(c, id);
    },
    async list(/** @type {string} */ c, /** @type {any} */ q) {
      const sid = under(c);
      if (sid && !(await finns(sid))) throw neka(`list ${c}`);
      return bas.list(c, q);
    },
    async create(/** @type {string} */ c, /** @type {any} */ d) {
      if (regler.nekaNyttSamtal && c === "samtal") throw neka(`create samtal/${d.id}`);
      const sid = under(c);
      if (sid && !(await finns(sid))) throw neka(`create ${c}`);
      return bas.create(c, d);
    },
    subscribe(/** @type {string} */ c, /** @type {any} */ q, /** @type {{ onData: (r: any[]) => void, onError: (e: Error) => void }} */ l) {
      let oppen = true;
      const sid = under(c);
      (async () => {
        if (sid && !(await finns(sid))) {
          if (oppen) l.onError(neka(`subscribe ${c}`));
          return;
        }
        const rader = await bas.list(c, q);
        if (oppen) l.onData(rader);
      })();
      return () => {
        oppen = false;
      };
    },
  };
  return { kalla: /** @type {any} */ (kalla), nekade, regler };
}

describe("⛔ P0: Nytt samtal med agenten mot en källa med reglerna", () => {
  it("öppnas utan en nekad läsning, och första Skicka skapar ämnet och visar meddelandet", async () => {
    const { kalla, nekade } = regelkalla();
    const s = /** @type {any} */ (createSamtalskalla({ kalla, amnen: true }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    await s.skicka(g.id, { text: "Hej gruppen", av: "anna" });
    let valt = /** @type {string | null} */ (null);
    const vy = render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Gruppen" medlemmar={MEDLEMMAR} nytt="agent" valt={null} onValj={(id) => (valt = id)} />);
    await waitFor(() => expect(document.querySelector("[data-amne='ny']")).toBeTruthy());
    await new Promise((v) => setTimeout(v, 50));
    // Röd på 0.106.0 om vyn läser eller lyssnar på ämnet innan det finns.
    expect(nekade).toEqual([]);
    expect(screen.queryByText("Meddelandena kunde inte hämtas")).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), { target: { value: "Hur ligger momsen till?" } });
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    // Röd på 0.106.0: `skickaIAmne` läste samtalet som inte fanns, och inget skrevs.
    await waitFor(() => expect(valt).toMatch(/^g\|anna\|ops\|a_/));
    expect(nekade).toEqual([]);
    // Appen väljer ämnet (som lifehub.app gör via adressen), och prenumerationen startar på det nu skapade samtalet.
    vy.rerender(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Gruppen" medlemmar={MEDLEMMAR} valt={valt} onValj={(id) => (valt = id)} />);
    await waitFor(() => expect(screen.getAllByText("Hur ligger momsen till?").length).toBeGreaterThan(0));
    await new Promise((v) => setTimeout(v, 50));
    expect(nekade).toEqual([]);
    expect(screen.queryByText("Meddelandena kunde inte hämtas")).toBeNull();
  });
});

describe("⛔ P0: felraden när Skicka nekas står med sin text, ovanför loggen", () => {
  it("ett nekat skick i ett Nytt samtal säger att meddelandet inte kunde skickas, och raden står utanför den rullande loggen", async () => {
    const { kalla, regler } = regelkalla();
    const s = /** @type {any} */ (createSamtalskalla({ kalla, amnen: true }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    await s.skicka(g.id, { text: "Hej gruppen", av: "anna" });
    // Därefter nekas varje nytt samtal, som av en regel som ännu inte är deployad.
    regler.nekaNyttSamtal = true;
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Gruppen" medlemmar={MEDLEMMAR} nytt="agent" valt={null} onValj={() => {}} />);
    await waitFor(() => expect(document.querySelector("[data-amne='ny']")).toBeTruthy());
    fireEvent.change(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), { target: { value: "Hur ligger momsen till?" } });
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    const rubrik = await screen.findByText("Meddelandet kunde inte skickas");
    expect(screen.getByText("Missing or insufficient permissions.")).toBeTruthy();
    // Röd före rättelsen: rubriken var "Meddelandena kunde inte hämtas", och raden låg i loggen, där den tomma vyn under den
    // fyllde loggens höjd och rullningen till slutet tog den ur sikte.
    expect(screen.queryByText("Meddelandena kunde inte hämtas")).toBeNull();
    expect(rubrik.closest("[role='log']")).toBeNull();
    expect(rubrik.closest("[data-samtalsfel]")?.className).toContain("shrink-0");
    // Texten står kvar, så att den kan skickas igen.
    expect(/** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Skriv ett meddelande" })).value).toBe("Hur ligger momsen till?");
  });
});
