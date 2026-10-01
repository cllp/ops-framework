import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { defineModule } from "../lib/modul.js";
import { byggKategori } from "../lib/katalog.js";
import { typenForRad, typensUrsprung } from "../lib/modultyper.js";
import { OpsEventList } from "../components/OpsEventList.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { OpsProvenance } from "../components/OpsProvenance.jsx";
import * as Ops from "../index.js";

/*
 * ⛔ #224 (0.43.0). CP 2026-10-01: "Vem skapade händelsen och var hör den hemma." Svaren på frågorna i ärendet: ursprunget syns i listan
 * OCH i panelen, med en länk tillbaka till modulens post, och en agents rad märks med en robot (CP: "går på rekommendation").
 */

/** Ett avsiktligt kast loggas av React. Tyst under provet, så att ett riktigt fel inte drunknar. */
function forvantaKrasch(/** @type {() => void} */ kor, /** @type {RegExp} */ message) {
  const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(kor).toThrow(message);
  } finally {
    tyst.mockRestore();
  }
}

const ekonomi = () =>
  defineModule({
    id: "ekonomi",
    namn: { sv: "Ekonomi", en: "Economy" },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: null,
    typer: { handelser: [{ id: "bokslut", namn: { sv: "Bokslut" } }] },
  });
const BAS = [byggKategori({ id: "mote", namn: { sv: "Möte" }, farg: 1, ikon: "inbox", ordning: 0, groupId: "cps-ab" }, { faser: false, ikoner: ["inbox"] })];
const ctx = (over = {}) => ({ bas: BAS, moduler: [ekonomi()], modulerPa: ["ekonomi"], avvikelser: [], ...over });

describe("typensUrsprung: modulen ur typen, inget eget fält", () => {
  it("en typ ur gruppens egna kategorier har inget ursprung", () => {
    expect(typensUrsprung(typenForRad("mote", "handelser", ctx()))).toBeNull();
    expect(typensUrsprung(null)).toBeNull();
  });

  it("en modultyp ger modulens namn, på språket", () => {
    expect(typensUrsprung(typenForRad("ekonomi:bokslut", "handelser", ctx()))).toEqual({ modul: "Ekonomi" });
    expect(typensUrsprung(typenForRad("ekonomi:bokslut", "handelser", ctx()), "en")).toEqual({ modul: "Economy" });
  });

  it("⛔ en modul som är av, eller borta, nämns ändå och märks arkiverad", () => {
    expect(typensUrsprung(typenForRad("ekonomi:bokslut", "handelser", ctx({ modulerPa: [] })))).toEqual({ modul: "Ekonomi, arkiverad modul" });
    expect(typensUrsprung(typenForRad("borta:x", "handelser", ctx()))).toEqual({ modul: "borta, arkiverad modul" });
  });

  it("exporteras ur paketets ingång", () => {
    expect(Ops.typensUrsprung).toBe(typensUrsprung);
  });
});

const rad = { id: "h1", title: "Bokslutsmöte", daysLeft: 3 };
const skapad = new Date(2026, 8, 29, 9, 12).toISOString();

describe("ursprunget i listan", () => {
  it("efter skaparen: 'i Ekonomi', och modulen är en länk tillbaka till posten", () => {
    const onNavigate = vi.fn((_href, e) => e.preventDefault());
    render(
      <OpsEventList
        onNavigate={onNavigate}
        events={[{ ...rad, skapadAv: { namn: "Claes Philip", typ: "manniska" }, skapad, ursprung: { modul: "Ekonomi", url: "/ekonomi/kvitto/k1", urlEtikett: "Öppna kvittot i Ekonomi" } }]}
      />,
    );
    const rad1 = /** @type {HTMLElement} */ (document.querySelector("[data-ursprungsrad]"));
    expect(rad1.textContent).toBe("Människa: Skapad av Claes Philip, 29 sep 09:12i Ekonomi");
    const lank = screen.getByRole("link", { name: "Öppna kvittot i Ekonomi" });
    expect(lank.getAttribute("href")).toBe("/ekonomi/kvitto/k1");
    expect(lank.textContent).toBe("Ekonomi");
    fireEvent.click(lank);
    expect(onNavigate).toHaveBeenCalledWith("/ekonomi/kvitto/k1", expect.anything());
  });

  it("utan skapare står ursprunget ensamt: 'Från Ekonomi', utan länk när url saknas", () => {
    render(<OpsEventList events={[{ ...rad, ursprung: { modul: "Ekonomi" } }]} />);
    expect(/** @type {HTMLElement} */ (document.querySelector("[data-ursprungsrad]")).textContent).toBe("Från Ekonomi");
    expect(screen.queryByRole("link", { name: "Ekonomi" })).toBeNull();
  });

  it("en okänd sorts skapare får ursprunget i samma text: 'Skapad av ..., i Ekonomi'", () => {
    render(<OpsEventList events={[{ ...rad, skapadAv: "gammal@example.se", skapad, ursprung: { modul: "Ekonomi" } }]} />);
    expect(/** @type {HTMLElement} */ (document.querySelector("[data-ursprungsrad]")).textContent).toBe("Skapad av gammal@example.se, 29 sep 09:12, i Ekonomi");
  });

  it("orden går att byta (engelska)", () => {
    render(<OpsEventList sprak="en" skapadAvEtikett="Created by" iModulEtikett="in" franModulEtikett="From" events={[{ ...rad, ursprung: { modul: "Economy" } }]} />);
    expect(/** @type {HTMLElement} */ (document.querySelector("[data-ursprungsrad]")).textContent).toBe("From Economy");
  });

  it("utan skapare och utan ursprung ritas ingen rad", () => {
    render(<OpsEventList events={[rad]} />);
    expect(document.querySelector("[data-ursprungsrad]")).toBeNull();
  });

  it("⛔ ett ursprung som inte går att rita kastar i stället för att rita 'Från' och inget mer", () => {
    for (const fel of [{ modul: "" }, { modul: "  " }, { modul: "Ekonomi", url: "" }, { modul: "Ekonomi", extra: 1 }, "Ekonomi"]) {
      forvantaKrasch(() => render(<OpsEventList events={[{ ...rad, ursprung: /** @type {any} */ (fel) }]} />), /OpsEventList: ursprung/);
    }
  });
});

describe("⛔ agenten märks med en robot, och ordet läses upp", () => {
  it("OpsProvenance: agenten bär en ikon och ordet för skärmläsaren när namnet ersätter det, människan bär ingen ikon", () => {
    const { container: agent } = render(<OpsProvenance kind="agent" label="Skapad av ops-agent" />);
    expect(agent.querySelector("svg")).not.toBeNull();
    expect(agent.textContent).toBe("Agent: Skapad av ops-agent");
    const { container: manniska } = render(<OpsProvenance kind="human" label="Skapad av Claes Philip" />);
    expect(manniska.querySelector("svg")).toBeNull();
    expect(manniska.textContent).toBe("Människa: Skapad av Claes Philip");
  });

  it("i listan skiljer sig en agents rad från en människas med mer än färgen", () => {
    render(
      <OpsEventList
        events={[
          { ...rad, id: "a", skapadAv: { namn: "ops-agent", typ: "agent" }, skapad },
          { ...rad, id: "m", skapadAv: { namn: "Claes Philip", typ: "manniska" }, skapad },
        ]}
      />,
    );
    const [a, m] = /** @type {HTMLElement[]} */ ([...document.querySelectorAll("[data-ursprungsrad]")]);
    expect(a.querySelector("svg")).not.toBeNull();
    expect(m.querySelector("svg")).toBeNull();
  });
});

describe("ursprunget i händelsepanelen", () => {
  const h = { id: "h1", titel: "Bokslut", datum: "2026-10-12" };

  it("samma rad som i listan: vem, när och var, med länken tillbaka", () => {
    render(
      <OpsHandelsePanel
        handelse={{ ...h, skapadAv: { namn: "ops-agent", typ: "agent" }, skapad, ursprung: { modul: "Ekonomi", url: "/ekonomi/k1" } }}
        onTillbaka={() => {}}
      />,
    );
    const r = /** @type {HTMLElement} */ (document.querySelector("[data-handelsepanel] [data-ursprungsrad]"));
    expect(r.textContent).toBe("Agent: Skapad av ops-agent, 29 sep 09:12i Ekonomi");
    expect(r.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Ekonomi" }).getAttribute("href")).toBe("/ekonomi/k1");
  });

  it("utan skapare och ursprung ritas ingen rad, och ett trasigt ursprung kastar", () => {
    const { unmount } = render(<OpsHandelsePanel handelse={h} onTillbaka={() => {}} />);
    expect(document.querySelector("[data-ursprungsrad]")).toBeNull();
    unmount();
    forvantaKrasch(() => render(<OpsHandelsePanel handelse={{ ...h, ursprung: /** @type {any} */ ({ modul: "" }) }} onTillbaka={() => {}} />), /OpsHandelsePanel: ursprung\.modul/);
  });
});
