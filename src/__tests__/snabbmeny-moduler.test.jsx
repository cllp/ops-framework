import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { validateModuler } from "../lib/modul.js";

/**
 * ⛔ HÄNDELSEN (0.234.0). CP ville ha Ny anteckning i pluset. Med `snabbmenyer` ritade skalets snabbmeny bara de fyra fasta raderna
 * (`skapaSnabbPoster`), i pluset, långtrycket och den flytande knappen, och modulernas `skapa.rad` syntes aldrig där. Nu står de efter
 * de fasta, i modulordning, och kör modulens `onSkapa({ grupp })`.
 */

/** @param {string} id @param {any[]} tillagg */
const MODUL = (id, tillagg) => ({ id, namn: { sv: id, en: id }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: null, tillagg });
/** @param {Record<string, any>} [over] */
const RAD = (over = {}) => ({ plats: "skapa.rad", id: "ny-anteckning", etikett: { sv: "Ny anteckning", en: "New note" }, ikon: createElement("svg", { "data-ikon": "anteckning" }), onSkapa: () => {}, ...over });
const inspelare = () => ({
  starta: vi.fn(() => Promise.resolve()),
  stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["a"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 1 })),
  kasta: vi.fn(),
  niva: () => 0,
});

/** @param {any[]} moduler @param {any} aktivGrupp */
function skal(moduler, aktivGrupp) {
  render(
    <OpsAppShell
      brand="Ops"
      fasta={{ idag: { href: "/idag" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }}
      moduler={[]}
      activeHref="/idag"
      snabbmenyer
      talk={{ onTalk: vi.fn(), inspelare: inspelare() }}
      flytandeSkapa={["/idag"]}
      skapa={{ handelse: () => null, arende: () => null, nyttMeddelande: () => {}, grupp: () => null, lage: "g", moduler, aktivGrupp }}
    >
      <p>innehåll</p>
    </OpsAppShell>,
  );
}

const namn = (/** @type {HTMLElement} */ rot) => [...rot.querySelectorAll("button")].map((k) => k.textContent);

describe("⛔ snabbmenyn ritar modulernas skapa.rad", () => {
  it("raden står efter de fyra fasta, i modulordning, med modulens ikon, och bara för en påslagen modul", async () => {
    const moduler = validateModuler([
      MODUL("bibliotek", [RAD()]),
      MODUL("projekt", [RAD({ id: "nytt-projekt", etikett: { sv: "Nytt projekt", en: "New project" } })]),
      MODUL("avslagen", [RAD({ id: "ny-x", etikett: { sv: "Avslagen rad", en: "Off" } })]),
    ]);
    skal(moduler, { id: "g", moduler: ["bibliotek", "projekt"] });
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector("[data-ops-flytande-skapa]")));
    const dialog = await screen.findByRole("dialog", { name: "Skapa" });
    expect(namn(dialog)).toEqual(["Ny händelse", "Nytt ärende", "Nytt meddelande", "Ny grupp", "Ny anteckning", "Nytt projekt"]);
    expect(dialog.querySelector('[data-ikon="anteckning"]')).not.toBeNull();
  });

  it("ett val stänger menyn och kör modulens onSkapa med den aktiva gruppen, en gång", async () => {
    const onSkapa = vi.fn();
    const grupp = { id: "g", moduler: ["bibliotek"] };
    skal(validateModuler([MODUL("bibliotek", [RAD({ onSkapa })])]), grupp);
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector("[data-ops-flytande-skapa]")));
    const dialog = await screen.findByRole("dialog", { name: "Skapa" });
    fireEvent.click(/** @type {HTMLElement} */ ([...dialog.querySelectorAll("button")].find((k) => k.textContent === "Ny anteckning")));
    await waitFor(() => expect(onSkapa).toHaveBeenCalledTimes(1));
    expect(onSkapa).toHaveBeenCalledWith({ grupp });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Skapa" })).toBeNull());
  });
});
