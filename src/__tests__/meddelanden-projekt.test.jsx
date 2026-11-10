import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * Projektens chattar i medlemmens inkorg (0.215.0, cllp/lifehub.app#760 skiva 2). En projektchatt står i listan först när den har ett meddelande, med projektets namn ur appen,
 * etiketten Projekt och utan lås (alla i gruppen ser den). Öppnad ur adressen skapas den med `oppnaProjekt`, som gruppchatten. jsdom mäter text, inte utseende.
 * ⛔ VARJE PROV HAR SETTS FALLA: mutationerna och utfallen står i rapporten.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];
const NAMN = { koket: "Ombyggnad av köket", badrum: "Badrummet" };
const projektnamn = (/** @type {string} */ t) => NAMN[/** @type {keyof typeof NAMN} */ (t)] ?? null;

async function underlag() {
  let t = Date.now() - 60000;
  const samtal = createSamtalskalla({ kalla: createMemorySource({}), projekt: true, klocka: () => (t += 1000) });
  const kok = await samtal.oppnaProjekt({ groupId: "g", uid: "bo", tagg: "koket" });
  await samtal.skicka(kok.id, { text: "Kakel på onsdag?", av: "bo" });
  // Badrummets chatt är öppnad men tom: den ska inte stå i inkorgen.
  await samtal.oppnaProjekt({ groupId: "g", uid: "bo", tagg: "badrum" });
  // Ett projekt utan namn i appen: taggen står som namn.
  const vinden = await samtal.oppnaProjekt({ groupId: "g", uid: "bo", tagg: "vinden" });
  await samtal.skicka(vinden.id, { text: "Isolering", av: "bo" });
  return { samtal, kok };
}

describe("OpsMeddelanden: projektens chattar", () => {
  it("⛔ en projektchatt med meddelanden står med projektets namn och etiketten Projekt, utan lås, och en tom står inte alls", async () => {
    const { samtal } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" projektnamn={projektnamn} medlemmar={MEDLEMMAR} />);
    const lista = await screen.findByRole("region", { name: "Meddelanden" });
    // Gruppchatten (härledd), köket och vinden. Badrummet saknas.
    await waitFor(() => expect(within(lista).getAllByRole("listitem")).toHaveLength(3));
    expect(within(lista).getByText("Ombyggnad av köket")).toBeInTheDocument();
    expect(within(lista).getByText("vinden")).toBeInTheDocument();
    expect(within(lista).queryByText("Badrummet")).toBeNull();
    const rader = [...lista.querySelectorAll('[data-samtalsrad="projekt"]')];
    expect(rader).toHaveLength(2);
    for (const r of rader) {
      expect(r).toHaveTextContent("Projekt");
      expect(r.querySelector("[data-slag] svg")).toBeNull();
    }
  });

  it("projektets chatt öppnas med sin rubrik och säger vilka som ser den", async () => {
    const { samtal, kok } = await underlag();
    const user = userEvent.setup();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" projektnamn={projektnamn} medlemmar={MEDLEMMAR} />);
    const lista = await screen.findByRole("region", { name: "Meddelanden" });
    await user.click(await within(lista).findByText("Ombyggnad av köket"));
    await waitFor(() => expect(document.querySelector('[data-ops-samtal="projekt"]')).not.toBeNull());
    const samtalet = document.querySelector('[data-ops-samtal="projekt"]');
    await waitFor(() => expect(samtalet).toHaveTextContent("Kakel på onsdag?"));
    expect(samtalet).toHaveTextContent("Gruppen och projektets gäster ser det här");
    expect(within(/** @type {HTMLElement} */ (samtalet)).getByRole("textbox")).toHaveAttribute("placeholder", "Skriv till projektet");
    expect(kok.id).toBe("g|projekt|koket");
  });

  it("en projektchatt ur adressen som ingen öppnat skapas med oppnaProjekt", async () => {
    const { samtal } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" projektnamn={projektnamn} medlemmar={MEDLEMMAR} valt="g|projekt|garaget" />);
    await waitFor(() => expect(document.querySelector('[data-ops-samtal="projekt"]')).not.toBeNull());
    expect((await samtal.lista({ groupId: "g", uid: "anna" })).map((s) => s.id)).toContain("g|projekt|garaget");
  });
});
