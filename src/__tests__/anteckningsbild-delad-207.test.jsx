import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsDelad } from "../components/OpsDelad.jsx";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { GASTGRUPPATGARDER } from "../lib/gast.js";
import { bildAdressUrBilder } from "../lib/markdown.js";

/**
 * Bilder i en anteckning på en delad sida och i gästens vy (0.207.0, cllp/lifehub.app#696 skiva 2, ramverkets halva).
 *
 * Avtalet med appen: en anteckningspost i det delade svaret eller i gästens bibliotek kan bära `bilder: Record<string, string>`, filnamnet till en
 * signerad https-adress. Proven mäter varje yta åt fyra håll: bilden ritas med adressen ur `bilder`, ett namn som saknas ger felraden, utan `bilder`
 * står raden som före 0.207.0, och en `javascript:`-adress ritas aldrig. Hur bilden SER UT mäts inte här: jsdom kör ingen CSS.
 */

const TEXT = "Kvittot:\n\n![Taxi](taxi.jpg)";
const ADRESS = "https://lagring.example/signerad/taxi.jpg?token=1";

/** Vad som står där bilden står: adressen när en bild ritats, annars raden. */
async function bildlage(/** @type {ParentNode} */ rot = document) {
  return waitFor(() => {
    const img = rot.querySelector("img[data-ops-markdown-bild='klar']");
    if (img) return { lage: "bild", src: img.getAttribute("src"), alt: img.getAttribute("alt") };
    const rad = rot.querySelector("[data-ops-markdown-bild]");
    if (!rad) throw new Error("ingen bild och ingen rad än");
    const lage = rad.getAttribute("data-ops-markdown-bild");
    if (lage === "hamtar") throw new Error("hämtar fortfarande");
    return { lage, text: rad.textContent };
  });
}

const FALLEN = [
  { namn: "bilden ritas med adressen ur `bilder`", bilder: { "taxi.jpg": ADRESS }, vantat: { lage: "bild", src: ADRESS, alt: "Taxi" } },
  { namn: "ett namn som saknas i `bilder` ger felraden", bilder: { "annan.jpg": ADRESS }, vantat: { lage: "fel", text: "Bild: Taxi. Bilden kunde inte visas." } },
  { namn: "utan `bilder` står raden som förut", bilder: undefined, vantat: { lage: "visas-inte", text: "Bild: Taxi. Bilden visas inte här än." } },
  { namn: "⛔ en `javascript:`-adress ritas inte", bilder: { "taxi.jpg": "javascript:alert(1)" }, vantat: { lage: "fel", text: "Bild: Taxi. Bilden kunde inte visas." } },
];

describe("bildAdressUrBilder", () => {
  it("bara https, bara egna nycklar, och inget objekt är ingen funktion", () => {
    const f = /** @type {(namn: string) => string} */ (bildAdressUrBilder({ "a.jpg": ADRESS, "b.jpg": "http://x.se/b.jpg", "c.jpg": "data:image/png;base64,AAAA", "d.jpg": "https://x.se/med mellanslag.jpg", "e.jpg": 7 }));
    expect(f("a.jpg")).toBe(ADRESS);
    for (const n of ["b.jpg", "c.jpg", "d.jpg", "e.jpg", "saknas.jpg", "constructor", "toString", "__proto__"]) expect(f(n), n).toBe("");
    for (const ingen of [undefined, null, "https://x.se", 3, ["https://x.se/a.jpg"]]) expect(bildAdressUrBilder(ingen), String(ingen)).toBeUndefined();
  });
});

describe("OpsDelad: en delad anteckning", () => {
  for (const f of FALLEN) {
    it(f.namn, async () => {
      render(<OpsDelad delning={{ typ: "anteckning", rubrik: "Juli", text: TEXT, ...(f.bilder ? { bilder: f.bilder } : {}) }} />);
      expect(await bildlage()).toEqual(f.vantat);
      expect(document.querySelector("img[src^='javascript']")).toBeNull();
    });
  }
});

describe("DeladLista: en anteckning i en delad lista", () => {
  for (const f of FALLEN) {
    it(f.namn, async () => {
      const post = { id: "a1", typ: "anteckning", rubrik: "Kvitton", text: TEXT, ...(f.bilder ? { bilder: f.bilder } : {}) };
      render(<OpsDelad delning={{ typ: "lista", rubrik: "Resan", poster: [post] }} />);
      const detaljer = /** @type {HTMLDetailsElement} */ (document.querySelector("[data-delad-rad='anteckning'] details"));
      act(() => {
        detaljer.open = true;
        detaljer.dispatchEvent(new Event("toggle"));
      });
      expect(await bildlage(/** @type {HTMLElement} */ (document.querySelector("[data-delad-anteckning]")))).toEqual(f.vantat);
    });
  }
});

describe("gästens vy: en anteckning i gästens bibliotek", () => {
  /** @param {Record<string, string> | undefined} bilder */
  function api(bilder) {
    const post = { id: "a1", typ: "anteckning", rubrik: "Kvitton", text: TEXT, skapad: 1, andrad: 1, skapadAvNamn: "Kim", ...(bilder ? { bilder } : {}) };
    /** @type {Record<string, (a: any) => Promise<any>>} */
    const svar = {
      bibliotek: async () => ({ ok: true, poster: [post], avkortad: false }),
      chatt: async () => ({ ok: true, meddelanden: [], fler: false }),
      arenden: async () => ({ ok: true, poster: [], avkortad: false }),
    };
    return Object.fromEntries(GASTGRUPPATGARDER.map((a) => [a, vi.fn(async (args) => (svar[a] ? svar[a](args ?? {}) : { ok: false, orsak: "nej" }))]));
  }

  for (const f of FALLEN) {
    it(f.namn, async () => {
      render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["bibliotek"] }} api={/** @type {any} */ (api(f.bilder))} intervallMs={0} idag={new Date(2026, 10, 8)} />);
      await act(async () => {
        fireEvent.mouseDown(screen.getByRole("tab", { name: "Bibliotek" }), { button: 0 });
      });
      await act(async () => {
        fireEvent.click(await screen.findByRole("button", { name: "Kvitton" }));
      });
      expect(await bildlage(/** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-detalj='anteckning']")))).toEqual(f.vantat);
    });
  }

  it("appens `bildIAnteckningAdress` vinner över `bilder` när båda finns", async () => {
    const post = { id: "a1", groupId: "g", typ: "anteckning", rubrik: "Kvitton", text: TEXT, skapadAv: { uid: "", namn: "" }, bilder: { "taxi.jpg": ADRESS } };
    const adress = vi.fn(() => "https://appens.example/taxi.jpg");
    render(<OpsBibliotek poster={[post]} jag={null} vald={post} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" bildIAnteckningAdress={adress} />);
    expect(await bildlage()).toEqual({ lage: "bild", src: "https://appens.example/taxi.jpg", alt: "Taxi" });
    expect(adress).toHaveBeenCalledWith({ postId: "a1", plats: "g", namn: "taxi.jpg" });
  });
});
