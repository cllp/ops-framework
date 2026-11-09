import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
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

describe("gästens vy: bilderna hämtas när gästen öppnar anteckningen (regel 13)", () => {
  /**
   * Ett api som svarar som gästtjänsten: listan bär inga bilder, och `anteckningsbilder` ger dem för en öppnad anteckning.
   * @param {Record<string, string>} bilder
   * @param {{ vanta?: boolean }} [val]
   */
  function api(bilder, val = {}) {
    const post = { id: "a1", typ: "anteckning", rubrik: "Kvitton", text: TEXT, skapad: 1, andrad: 1, skapadAvNamn: "Kim" };
    const annan = { id: "a2", typ: "anteckning", rubrik: "Annan", text: "![](taxi.jpg)", skapad: 0, andrad: 0, skapadAvNamn: "Kim" };
    /** @type {(v: any) => void} */
    let svara = () => {};
    /** @type {Record<string, (a: any) => Promise<any>>} */
    const svar = {
      bibliotek: async () => ({ ok: true, poster: [post, annan], avkortad: false }),
      anteckningsbilder: async ({ postId }) => (val.vanta ? new Promise((los) => { svara = los; }) : { ok: true, bilder: postId === "a1" ? bilder : {} }),
      chatt: async () => ({ ok: true, meddelanden: [], fler: false }),
      arenden: async () => ({ ok: true, poster: [], avkortad: false }),
    };
    const a = Object.fromEntries(GASTGRUPPATGARDER.map((n) => [n, vi.fn(async (args) => (svar[n] ? svar[n](args ?? {}) : { ok: false, orsak: "nej" }))]));
    return { api: a, svara: (/** @type {any} */ v) => svara(v) };
  }

  async function oppna(/** @type {any} */ a, rubrik = "Kvitton") {
    const vy = render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["bibliotek"] }} api={a} intervallMs={0} idag={new Date(2026, 10, 8)} />);
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Bibliotek" }), { button: 0 });
    });
    await screen.findByRole("button", { name: rubrik });
    // ⛔ Listan har hämtats och ingen bild har signerats.
    expect(a.anteckningsbilder).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: rubrik }));
    });
    return vy;
  }

  it("⛔ listan frågar inte efter bilderna; öppningen gör det, en gång för anteckningen, och bilden ritas med adressen", async () => {
    const { api: a } = api({ "taxi.jpg": ADRESS });
    await oppna(a);
    expect(await bildlage(/** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-detalj='anteckning']")))).toEqual({ lage: "bild", src: ADRESS, alt: "Taxi" });
    expect(a.anteckningsbilder).toHaveBeenCalledTimes(1);
    expect(a.anteckningsbilder).toHaveBeenCalledWith({ postId: "a1" });
  });

  it("tills svaret kommit står \"Hämtar bilden.\"", async () => {
    const { api: a, svara } = api({}, { vanta: true });
    await oppna(a);
    expect(screen.getByText("Bild: Taxi. Hämtar bilden.")).toBeInTheDocument();
    await act(async () => svara({ ok: true, bilder: { "taxi.jpg": ADRESS } }));
    expect(await bildlage()).toEqual({ lage: "bild", src: ADRESS, alt: "Taxi" });
  });

  it("ett namn som inte finns i svaret, och en `javascript:`-adress, ger felraden", async () => {
    for (const bilder of [{ "annan.jpg": ADRESS }, { "taxi.jpg": "javascript:alert(1)" }]) {
      const { api: a } = api(bilder);
      const { unmount } = await oppna(a);
      expect(await bildlage()).toEqual({ lage: "fel", text: "Bild: Taxi. Bilden kunde inte visas." });
      expect(document.querySelector("img[src^='javascript']")).toBeNull();
      unmount();
    }
  });

  it("⛔ en annan anteckning frågar efter sina egna bilder och får aldrig den förstas", async () => {
    const { api: a } = api({ "taxi.jpg": ADRESS });
    await oppna(a, "Annan");
    expect(await bildlage()).toEqual({ lage: "fel", text: "Bilden kunde inte visas." });
    expect(a.anteckningsbilder).toHaveBeenCalledWith({ postId: "a2" });
    expect(a.anteckningsbilder).not.toHaveBeenCalledWith({ postId: "a1" });
  });
});

describe("en adress som gått ut (0.207.0)", () => {
  const NY = "https://lagring.example/signerad/taxi.jpg?token=2";
  const img = () => /** @type {HTMLImageElement | null} */ (document.querySelector("img[data-ops-markdown-bild='klar']"));

  /** Appen: `onNyUrl` hämtar länken igen och ger ett nytt svar med nya adresser. */
  function App({ onNyUrl, svar = [{ "taxi.jpg": ADRESS }, { "taxi.jpg": NY }], text = TEXT, lista = false }) {
    const [nr, setNr] = useState(0);
    const bilder = svar[Math.min(nr, svar.length - 1)];
    const hamtaIgen = onNyUrl === null ? undefined : async () => {
      await onNyUrl();
      setNr((n) => n + 1);
    };
    const anteckning = { typ: "anteckning", rubrik: "Juli", text, bilder };
    return <OpsDelad delning={lista ? { typ: "lista", rubrik: "Resan", poster: [{ id: "a1", ...anteckning, rubrik: "Kvitton" }] } : anteckning} onNyUrl={hamtaIgen} />;
  }

  it("⛔ bilden ber om ett nytt svar med `onNyUrl` och ritas med den nya adressen; faller också den står \"Ladda om sidan för att se bilden.\", utan en andra fråga", async () => {
    const onNyUrl = vi.fn(async () => {});
    render(<App onNyUrl={onNyUrl} />);
    await waitFor(() => expect(img()).toHaveAttribute("src", ADRESS));
    fireEvent.error(/** @type {HTMLImageElement} */ (img()));
    await waitFor(() => expect(img()).toHaveAttribute("src", NY));
    expect(onNyUrl).toHaveBeenCalledTimes(1);
    fireEvent.error(/** @type {HTMLImageElement} */ (img()));
    expect(await screen.findByText("Bild: Taxi. Ladda om sidan för att se bilden.")).toBeInTheDocument();
    expect(onNyUrl).toHaveBeenCalledTimes(1);
  });

  it("⛔ två bilder som går ut samtidigt ger EN hämtning", async () => {
    const onNyUrl = vi.fn(async () => {});
    const svar = [{ "a.jpg": "https://l.example/a1", "b.jpg": "https://l.example/b1" }, { "a.jpg": "https://l.example/a2", "b.jpg": "https://l.example/b2" }];
    render(<App onNyUrl={onNyUrl} svar={svar} text={"![](a.jpg)\n\n![](b.jpg)"} />);
    await waitFor(() => expect(document.querySelectorAll("img[data-ops-markdown-bild='klar']")).toHaveLength(2));
    for (const el of Array.from(document.querySelectorAll("img"))) fireEvent.error(el);
    await waitFor(() => expect(Array.from(document.querySelectorAll("img")).map((el) => el.getAttribute("src"))).toEqual(["https://l.example/a2", "https://l.example/b2"]));
    expect(onNyUrl).toHaveBeenCalledTimes(1);
  });

  it("utan `onNyUrl`, och när hämtningen faller, står raden om att ladda om sidan", async () => {
    const { unmount } = render(<App onNyUrl={null} />);
    await waitFor(() => expect(img()).not.toBeNull());
    fireEvent.error(/** @type {HTMLImageElement} */ (img()));
    expect(await screen.findByText("Bild: Taxi. Ladda om sidan för att se bilden.")).toBeInTheDocument();
    unmount();
    render(<App onNyUrl={async () => { throw new Error("nätet"); }} />);
    await waitFor(() => expect(img()).not.toBeNull());
    fireEvent.error(/** @type {HTMLImageElement} */ (img()));
    expect(await screen.findByText("Bild: Taxi. Ladda om sidan för att se bilden.")).toBeInTheDocument();
  });

  it("i en delad lista går frågan samma väg", async () => {
    const onNyUrl = vi.fn(async () => {});
    render(<App onNyUrl={onNyUrl} lista />);
    const detaljer = /** @type {HTMLDetailsElement} */ (document.querySelector("[data-delad-rad='anteckning'] details"));
    act(() => {
      detaljer.open = true;
      detaljer.dispatchEvent(new Event("toggle"));
    });
    await waitFor(() => expect(img()).toHaveAttribute("src", ADRESS));
    fireEvent.error(/** @type {HTMLImageElement} */ (img()));
    await waitFor(() => expect(img()).toHaveAttribute("src", NY));
    expect(onNyUrl).toHaveBeenCalledTimes(1);
  });

  it("i gästens bibliotek står raden om att ladda om sidan, och utan `bildIAnteckningFel` behåller appens egen adress det allmänna felet", async () => {
    const post = { id: "a1", typ: "anteckning", rubrik: "Kvitton", text: TEXT, skapad: 1, andrad: 1, skapadAvNamn: "Kim" };
    const svar = { bibliotek: async () => ({ ok: true, poster: [post], avkortad: false }), anteckningsbilder: async () => ({ ok: true, bilder: { "taxi.jpg": ADRESS } }) };
    const a = Object.fromEntries(GASTGRUPPATGARDER.map((n) => [n, vi.fn(async (args) => (/** @type {any} */ (svar)[n] ? /** @type {any} */ (svar)[n](args ?? {}) : { ok: false, orsak: "nej" }))]));
    const { unmount } = render(<OpsGastGrupp grupp={{ namn: "Källan", funktioner: ["bibliotek"] }} api={/** @type {any} */ (a)} intervallMs={0} idag={new Date(2026, 10, 8)} />);
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Bibliotek" }), { button: 0 });
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Kvitton" }));
    });
    await waitFor(() => expect(img()).not.toBeNull());
    fireEvent.error(/** @type {HTMLImageElement} */ (img()));
    expect(await screen.findByText("Bild: Taxi. Ladda om sidan för att se bilden.")).toBeInTheDocument();
    unmount();
    const p2 = { ...post, groupId: "g", skapadAv: { uid: "", namn: "" } };
    render(<OpsBibliotek poster={[p2]} jag={null} vald={p2} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" bildIAnteckningAdress={() => "https://appens.example/taxi.jpg"} />);
    await waitFor(() => expect(img()).not.toBeNull());
    fireEvent.error(/** @type {HTMLImageElement} */ (img()));
    expect(await screen.findByText("Bild: Taxi. Bilden kunde inte visas.")).toBeInTheDocument();
  });
});
