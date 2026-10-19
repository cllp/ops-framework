import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsDeladHandelse } from "../components/OpsDeladHandelse.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { createMemorySource } from "../data/adapters.js";
import { delningsUrl } from "../lib/delning.js";
import { medlemskapsId } from "../lib/grupp.js";
import { createDelningService } from "../node/delning.js";

/**
 * Delade länkar i händelsepanelen (0.125.0, cllp/lifehub.app#377): varje aktiv länk med sin fulla adress som text, Kopiera och Återkalla, och Dela för att skapa en ny.
 * Hela kedjan provas över den riktiga tjänsten (`createDelningService` på en minneskälla) och den publika sidan: det som skapas i rutan öppnas på sidan.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const NU = 1_800_000_000_000;
const BAS = "https://my.life-hub.app";
const GRUPP = "kallan";
const MEDLEM = "uid-medlem";
const HANDELSE = { id: "h1", titel: "Resa med kusiner", datum: "2026-12-26", slutDatum: "2027-01-10", grupp: "Travel" };

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(() => Promise.resolve()) }, configurable: true });
});
afterEach(() => {
  vi.restoreAllMocks();
  window.getSelection()?.removeAllRanges();
});

const lank = (id, extra = {}) => ({ id, url: `${BAS}/g/travel/event/resa-med-kusiner-${id}`, rattighet: "las", harKod: false, giltigTill: null, ...extra });

function Panel({ delningar = [], onDela = vi.fn(), onAterkalla = vi.fn(async () => {}), sprak, ...rest }) {
  return <OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} delningar={delningar} onDela={onDela} onAterkalla={onAterkalla} sprak={sprak} {...rest} />;
}

const sektion = (container) => container.querySelector("[data-handelsedelning]");
const rader = (container) => [...container.querySelectorAll("[data-lankrad]")];
const text = (el) => el?.textContent?.replace(/\s+/g, " ").trim();

describe("Delade länkar i panelen: när den ritas", () => {
  it("⛔ utan onDela finns ingen sektion och ingen Dela-knapp", () => {
    const { container } = render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} />);
    expect(sektion(container)).toBeNull();
    expect(screen.queryByRole("button", { name: /Dela/ })).toBeNull();
  });

  it("⛔ onDela utan onAterkalla, utan delningar eller delningar utan onDela kastar", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} onDela={vi.fn()} delningar={[]} />)).toThrow(/onAterkalla saknas/);
    expect(() => render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} onDela={vi.fn()} onAterkalla={vi.fn()} />)).toThrow(/delningar saknas/);
    expect(() => render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} delningar={[]} />)).toThrow(/hör till onDela/);
    expect(() => render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} onAterkalla={vi.fn()} />)).toThrow(/hör till onDela/);
    expect(() => render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} onDela="x" delningar={[]} onAterkalla={vi.fn()} />)).toThrow(/onDela måste vara en funktion/);
  });

  it("en länk utan adress går inte att skicka vidare och kastar", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Panel delningar={[{ id: "x", url: "" }]} />)).toThrow(/url är hela adressen/);
    expect(() => render(<Panel delningar={[{ id: "x" }]} />)).toThrow(/url är hela adressen/);
  });

  it("⛔ utan länkar står en rad som säger det, inte en tom yta", () => {
    const { container } = render(<Panel delningar={[]} />);
    expect(text(container.querySelector("[data-handelsedelning-tom]"))).toBe("Inga länkar. Den här händelsen är inte delad.");
    expect(container.querySelector("[data-handelsedelning-lista]")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Delade länkar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dela" })).toBeInTheDocument();
  });
});

describe("Delade länkar i panelen: varje länk på en rad", () => {
  const delningar = [
    lank("k7f3q9x2"),
    lank("m2n4p6r8", { harKod: true, giltigTill: new Date(2026, 10, 2, 12).getTime(), url: `${BAS}/g/travel/event/resa-med-kusiner` }),
  ];

  it("⛔ varje aktiv länk står med sin FULLA adress som text, sin rättighet, om den har kod och när den går ut", () => {
    const { container } = render(<Panel delningar={delningar} />);
    const r = rader(container);
    expect(r).toHaveLength(2);
    expect(text(r[0].querySelector("[data-lankrad-url]"))).toBe("https://my.life-hub.app/g/travel/event/resa-med-kusiner-k7f3q9x2");
    expect(text(r[0].querySelector("[data-lankrad-rattighet]"))).toBe("Läslänk");
    expect(text(r[0].querySelector("[data-lankrad-kod]"))).toBe("Utan kod");
    expect(text(r[0].querySelector("[data-lankrad-giltighet]"))).toBe("Ingen gräns");
    expect(text(r[1].querySelector("[data-lankrad-url]"))).toBe("https://my.life-hub.app/g/travel/event/resa-med-kusiner");
    expect(text(r[1].querySelector("[data-lankrad-kod]"))).toBe("Med kod");
    expect(text(r[1].querySelector("[data-lankrad-giltighet]"))).toBe("Gäller till mån 2 nov 2026");
    expect(container.querySelector("[data-handelsedelning-tom]")).toBeNull();
  });

  it("adressen är markerbar text (ett tryck markerar hela)", () => {
    const { container } = render(<Panel delningar={delningar} />);
    expect(rader(container)[0].querySelector("[data-lankrad-url]")?.className).toContain("select-all");
  });

  it("på engelska skrivs raden på engelska", () => {
    const { container } = render(<Panel delningar={delningar} sprak="en" />);
    const r = rader(container);
    expect(text(r[0].querySelector("[data-lankrad-rattighet]"))).toBe("Read link");
    expect(text(r[0].querySelector("[data-lankrad-kod]"))).toBe("No code");
    expect(text(r[0].querySelector("[data-lankrad-giltighet]"))).toBe("No limit");
    expect(text(r[1].querySelector("[data-lankrad-giltighet]"))).toBe("Valid until Mon 2 Nov 2026");
    expect(screen.getByRole("heading", { level: 2, name: "Shared links" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Copy the address" })).toHaveLength(2);
  });
});

describe("Delade länkar i panelen: Kopiera", () => {
  it("⛔ Kopiera skriver HELA adressen till urklipp och säger Kopierad i en statusrad", async () => {
    const { container } = render(<Panel delningar={[lank("k7f3q9x2")]} />);
    const rad = rader(container)[0];
    const status = rad.querySelector("[data-lankrad-status]");
    expect(status).toHaveAttribute("role", "status");
    expect(status?.textContent).toBe("");
    fireEvent.click(within(rad).getByRole("button", { name: "Kopiera adressen" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://my.life-hub.app/g/travel/event/resa-med-kusiner-k7f3q9x2"));
    await waitFor(() => expect(status?.textContent).toBe("Kopierad"));
  });

  it("⛔ går urklipp inte att använda markeras texten, och raden säger att den ska kopieras för hand", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const { container } = render(<Panel delningar={[lank("k7f3q9x2")]} />);
    const rad = rader(container)[0];
    fireEvent.click(within(rad).getByRole("button", { name: "Kopiera adressen" }));
    expect(await within(rad).findByRole("alert")).toHaveTextContent(/kopiera den för hand/);
    expect(window.getSelection()?.toString()).toBe("https://my.life-hub.app/g/travel/event/resa-med-kusiner-k7f3q9x2");
    expect(rad.querySelector("[data-lankrad-status]")?.textContent).toBe("");
  });

  it("⛔ nekar urklipp skrivningen (ett avvisat löfte) händer samma sak", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(() => Promise.reject(new Error("nekad"))) }, configurable: true });
    const { container } = render(<Panel delningar={[lank("k7f3q9x2")]} />);
    const rad = rader(container)[0];
    fireEvent.click(within(rad).getByRole("button", { name: "Kopiera adressen" }));
    expect(await within(rad).findByRole("alert")).toHaveTextContent(/kopiera den för hand/);
    expect(window.getSelection()?.toString()).toContain("/g/travel/event/resa-med-kusiner-k7f3q9x2");
  });
});

describe("Delade länkar i panelen: Återkalla", () => {
  it("⛔ Återkalla anropar onAterkalla med länkens id, och raden försvinner först när servern sagt ja", async () => {
    let klar;
    const onAterkalla = vi.fn(() => new Promise((res) => { klar = res; }));
    const { container } = render(<Panel delningar={[lank("a1"), lank("b2")]} onAterkalla={onAterkalla} />);
    fireEvent.click(within(rader(container)[0]).getByRole("button", { name: /Återkalla länken/ }));
    expect(onAterkalla).toHaveBeenCalledWith({ id: "a1" });
    expect(rader(container)).toHaveLength(2);
    klar();
    await waitFor(() => expect(rader(container)).toHaveLength(1));
    expect(rader(container)[0].dataset.lankrad).toBe("b2");
  });

  it("⛔ faller återkallningen visas orsaken, och länken ligger kvar", async () => {
    const onAterkalla = vi.fn(async () => {
      throw new Error("Du får inte stänga den här länken");
    });
    const { container } = render(<Panel delningar={[lank("a1")]} onAterkalla={onAterkalla} />);
    fireEvent.click(screen.getByRole("button", { name: /Återkalla länken/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Det gick inte att återkalla länken: Du får inte stänga den här länken");
    expect(rader(container)).toHaveLength(1);
  });

  it("⛔ ett dubbeltryck återkallar en gång", async () => {
    let klar;
    const onAterkalla = vi.fn(() => new Promise((res) => { klar = res; }));
    render(<Panel delningar={[lank("a1")]} onAterkalla={onAterkalla} />);
    const knapp = screen.getByRole("button", { name: /Återkalla länken/ });
    // Två tryck i SAMMA tick, innan React hunnit spärra knappen: bara en ref stoppar det andra.
    act(() => {
      knapp.click();
      knapp.click();
    });
    expect(onAterkalla).toHaveBeenCalledTimes(1);
    klar();
    await waitFor(() => expect(screen.queryByRole("button", { name: /Återkalla länken/ })).toBeNull());
  });

  it("när listan läses om utan länken försvinner raden, och en länk som skapats här blir inte en dubblett", async () => {
    const onDela = vi.fn(async () => lank("ny1"));
    const { container, rerender } = render(<Panel delningar={[]} onDela={onDela} />);
    fireEvent.click(screen.getByRole("button", { name: "Dela" }));
    fireEvent.click(await screen.findByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(rader(container).length).toBeGreaterThan(0));
    rerender(<Panel delningar={[lank("ny1")]} onDela={onDela} />);
    expect(rader(container).filter((r) => r.dataset.lankrad === "ny1")).toHaveLength(1);
  });
});

describe("Delade länkar: rutan Dela", () => {
  async function oppna(props = {}) {
    const onDela = props.onDela ?? vi.fn(async () => lank("ny1"));
    const resultat = render(<Panel delningar={[]} {...props} onDela={onDela} />);
    fireEvent.click(screen.getByRole("button", { name: "Dela" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela händelsen" });
    return { dialog, onDela, ...resultat };
  }

  it("⛔ förvalen: ingen gräns, ingen kod, och adressen föreslagen ur gruppens namn och titeln med typsegmentet event", async () => {
    const { dialog } = await oppna();
    expect(within(dialog).getByRole("radio", { name: "Ingen gräns" })).toBeChecked();
    expect(within(dialog).getAllByRole("radio").map((r) => r.closest("label")?.textContent?.trim())).toEqual(["Ingen gräns", "1 dag", "7 dagar", "30 dagar"]);
    expect(within(dialog).getByRole("textbox", { name: "Kod (valfri)" })).toHaveValue("");
    expect(within(dialog).getByRole("textbox", { name: "Gruppens del av adressen" })).toHaveValue("travel");
    expect(within(dialog).getByRole("textbox", { name: "Händelsens del av adressen" })).toHaveValue("resa-med-kusiner");
    expect(text(dialog.querySelector("[data-delalank-forhandsvisning]"))).toBe("Adressen blir: /g/travel/event/resa-med-kusiner-xxxxxxxx");
  });

  it("⛔ utan kod säger rutan att slutet är slumpat, med kod att adressen blir exakt det som skrivs", async () => {
    const { dialog } = await oppna();
    expect(text(dialog.querySelector("[data-delalank-slutmening]"))).toBe("Utan kod får adressen ett slumpat slut som inte går att ta bort, så att den inte går att gissa.");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Kod (valfri)" }), { target: { value: "hemligt1" } });
    expect(text(dialog.querySelector("[data-delalank-slutmening]"))).toBe("Med kod blir adressen exakt som du skriver den. Koden är skyddet.");
    expect(text(dialog.querySelector("[data-delalank-forhandsvisning]"))).toBe("Adressen blir: /g/travel/event/resa-med-kusiner");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Kod (valfri)" }), { target: { value: "" } });
    expect(dialog.querySelector("[data-delalank-slumpslut]")).not.toBeNull();
  });

  it("⛔ Skapa skickar valen: ingen gräns är null, utan kod är null, och delarna rensade", async () => {
    const { dialog, onDela } = await oppna();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Händelsens del av adressen" }), { target: { value: "Åke & Öland 2027!" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(onDela).toHaveBeenCalledWith({ dagar: null, kod: null, gruppdel: "travel", handelsedel: "ake-oland-2027" }));
  });

  it("giltighet och kod som väljs är de som skickas", async () => {
    const { dialog, onDela } = await oppna();
    fireEvent.click(within(dialog).getByRole("radio", { name: "7 dagar" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Kod (valfri)" }), { target: { value: "  hemligt1  " } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Gruppens del av adressen" }), { target: { value: "Min Grupp" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(onDela).toHaveBeenCalledWith({ dagar: 7, kod: "hemligt1", gruppdel: "min-grupp", handelsedel: "resa-med-kusiner" }));
  });

  it("⛔ en kod som är för kort och en tom adress skickas aldrig", async () => {
    const { dialog, onDela } = await oppna();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Kod (valfri)" }), { target: { value: "abc" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Koden ska vara minst 6 tecken.");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Kod (valfri)" }), { target: { value: "" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Gruppens del av adressen" }), { target: { value: "???" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Adressen kan inte vara tom/);
    expect(onDela).not.toHaveBeenCalled();
  });

  it("⛔ den nya länken visas med sin fulla adress i rutan, och står i listan på händelsen", async () => {
    const { dialog, container } = await oppna({ onDela: vi.fn(async () => lank("ny1", { harKod: false })) });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    const skapad = await waitFor(() => {
      const el = dialog.querySelector("[data-handelsedelning-skapad]");
      expect(el).not.toBeNull();
      return el;
    });
    expect(skapad?.textContent).toContain("https://my.life-hub.app/g/travel/event/resa-med-kusiner-ny1");
    expect(within(dialog).getByRole("button", { name: "Kopiera adressen" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Klar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(rader(container)).toHaveLength(1);
    expect(text(rader(container)[0].querySelector("[data-lankrad-url]"))).toBe("https://my.life-hub.app/g/travel/event/resa-med-kusiner-ny1");
    expect(container.querySelector("[data-handelsedelning-tom]")).toBeNull();
  });

  it("⛔ ett fel från servern visas, rutan står kvar och fälten är orörda", async () => {
    const onDela = vi.fn(async () => {
      throw new Error("Du får inte dela den här händelsen.");
    });
    const { dialog } = await oppna({ onDela });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Kod (valfri)" }), { target: { value: "hemligt1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Du får inte dela den här händelsen.");
    expect(screen.getByRole("dialog", { name: "Dela händelsen" })).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "Kod (valfri)" })).toHaveValue("hemligt1");
    expect(within(dialog).getByRole("textbox", { name: "Händelsens del av adressen" })).toHaveValue("resa-med-kusiner");
    expect(dialog.querySelector("[data-handelsedelning-skapad]")).toBeNull();
  });

  it("⛔ ett svar utan adress räknas som ett fel", async () => {
    const { dialog } = await oppna({ onDela: vi.fn(async () => ({ id: "x" })) });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/saknade adressen/);
  });

  it("⛔ en upptagen adress ger ett annat förslag i fältet, och rutan säger det", async () => {
    const upptagen = Object.assign(new Error("skapa: adressen är upptagen"), { kod: "adress-upptagen" });
    const onDela = vi.fn().mockRejectedValueOnce(upptagen).mockResolvedValue(lank("ny2"));
    const { dialog } = await oppna({ onDela });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Kod (valfri)" }), { target: { value: "hemligt1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Adressen är upptagen. Ett annat förslag står nu i fältet");
    expect(within(dialog).getByRole("textbox", { name: "Händelsens del av adressen" })).toHaveValue("resa-med-kusiner-2");
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(onDela).toHaveBeenLastCalledWith(expect.objectContaining({ handelsedel: "resa-med-kusiner-2", kod: "hemligt1" })));
  });

  it("⛔ ett dubbeltryck på Skapa skapar en länk", async () => {
    let klar;
    const onDela = vi.fn(() => new Promise((res) => { klar = res; }));
    const { dialog } = await oppna({ onDela });
    const knapp = within(dialog).getByRole("button", { name: "Skapa länk" });
    // Två tryck i SAMMA tick, innan React hunnit spärra knappen: bara en ref stoppar det andra.
    act(() => {
      knapp.click();
      knapp.click();
    });
    expect(onDela).toHaveBeenCalledTimes(1);
    klar(lank("ny1"));
    await waitFor(() => expect(dialog.querySelector("[data-handelsedelning-skapad]")).not.toBeNull());
  });

  it("på engelska skrivs rutan på engelska", async () => {
    render(<Panel delningar={[]} sprak="en" onDela={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    const dialog = await screen.findByRole("dialog", { name: "Share the event" });
    expect(within(dialog).getByRole("radio", { name: "No limit" })).toBeChecked();
    expect(within(dialog).getByRole("textbox", { name: "Code (optional)" })).toBeInTheDocument();
    expect(text(dialog.querySelector("[data-delalank-slutmening]"))).toMatch(/^Without a code the address gets a random ending/);
    expect(within(dialog).getByRole("button", { name: "Create link" })).toBeInTheDocument();
  });

  it("⛔ inga tankstreck i något ramverket skriver i rutan eller på raderna, på något språk", async () => {
    for (const sprak of ["sv", "en"]) {
      const { container, unmount } = render(<Panel delningar={[lank("a1", { harKod: true, giltigTill: NU })]} sprak={sprak} onDela={vi.fn()} />);
      fireEvent.click(within(container).getByRole("button", { name: sprak === "sv" ? "Dela" : "Share" }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog.textContent).not.toMatch(/[\u2014\u2013]/);
      expect(sektion(container)?.textContent).not.toMatch(/[\u2014\u2013]/);
      unmount();
    }
  });
});

describe("hela kedjan: panelen, tjänsten och den publika sidan", () => {
  function bygg() {
    const kalla = createMemorySource({
      memberships: [{ id: medlemskapsId(MEDLEM, GRUPP), userId: MEDLEM, groupId: GRUPP, roll: "medlem", typ: "person", status: "aktiv", namn: "Medlem" }],
      bibliotek: [],
      handelser: [{ id: "h1", groupId: GRUPP, rubrik: "Resa med kusiner", text: "Ta med pass.", plats: "Visby", datum: "2026-12-26", slutDatum: "2027-01-10", tid: "09:00", slutTid: "17:00" }],
      delningar: [],
    });
    const tjanst = createDelningService({
      kalla,
      lagring: { signeradAdress: async ({ sokvag }) => `https://lagring.test/${sokvag}` },
      samlingar: { delningar: "delningar", bibliotek: "bibliotek", handelser: "handelser" },
      handelseSida: (h) => ({ titel: h.rubrik, beskrivning: h.text, plats: h.plats }),
      klocka: () => NU,
    });
    const onDela = async (val) => {
      const svar = await tjanst.skapa({ uid: MEDLEM, handelseId: "h1", gruppdel: val.gruppdel, handelsedel: val.handelsedel, dagar: val.dagar, kod: val.kod });
      return { id: svar.id, url: delningsUrl(BAS, svar.sokvag), giltigTill: svar.giltigTill, harKod: svar.harKod, rattighet: svar.rattighet };
    };
    const onAterkalla = ({ id }) => tjanst.aterkalla({ uid: MEDLEM, id });
    return { kalla, tjanst, onDela, onAterkalla };
  }

  function Kedja({ onDela, onAterkalla }) {
    const [delningar, setDelningar] = useState([]);
    return (
      <OpsHandelsePanel
        handelse={HANDELSE}
        onTillbaka={() => {}}
        delningar={delningar}
        onDela={async (val) => {
          const ny = await onDela(val);
          setDelningar((l) => [ny, ...l]);
          return ny;
        }}
        onAterkalla={onAterkalla}
      />
    );
  }

  it("⛔ en länk skapad i rutan öppnas på den publika sidan, och en länk med kod kräver koden", async () => {
    const { tjanst, onDela, onAterkalla } = bygg();
    const { container } = render(<Kedja onDela={onDela} onAterkalla={onAterkalla} />);

    fireEvent.click(screen.getByRole("button", { name: "Dela" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela händelsen" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(dialog.querySelector("[data-handelsedelning-skapad]")).not.toBeNull());
    const url = text(dialog.querySelector("[data-lankrad-url]"));
    expect(url).toMatch(/^https:\/\/my\.life-hub\.app\/g\/travel\/event\/resa-med-kusiner-[a-z0-9]{8}$/);

    // Adressen i texten är den som öppnar sidan: appens route skickar sökvägen efter /g/ till hamta.
    const svar = await tjanst.hamta(url.replace(`${BAS}/g/`, ""));
    expect(svar.ok).toBe(true);
    const sida = render(<OpsDeladHandelse delning={svar.delning} sprak="sv" />);
    expect(text(sida.container.querySelector("[data-dh-datum]"))).toBe("lör 26 dec 2026 till sön 10 jan 2027, 16 dagar");
    expect(sida.container.querySelector("[data-dh-titel]")?.textContent).toBe("Resa med kusiner");
    sida.unmount();

    fireEvent.click(within(dialog).getByRole("button", { name: "Klar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // En andra länk, med kod och en egen adress.
    fireEvent.click(screen.getByRole("button", { name: "Dela" }));
    const dialog2 = await screen.findByRole("dialog", { name: "Dela händelsen" });
    fireEvent.change(within(dialog2).getByRole("textbox", { name: "Kod (valfri)" }), { target: { value: "hemligt1" } });
    fireEvent.change(within(dialog2).getByRole("textbox", { name: "Händelsens del av adressen" }), { target: { value: "kusinresan" } });
    fireEvent.click(within(dialog2).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(dialog2.querySelector("[data-handelsedelning-skapad]")).not.toBeNull());
    expect(text(dialog2.querySelector("[data-lankrad-url]"))).toBe("https://my.life-hub.app/g/travel/event/kusinresan");
    fireEvent.click(within(dialog2).getByRole("button", { name: "Klar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(rader(container)).toHaveLength(2);
    expect(await tjanst.hamta("travel/event/kusinresan")).toEqual({ ok: false, orsak: "kod-kravs" });
    expect((await tjanst.hamta("travel/event/kusinresan", { kod: "hemligt1" })).ok).toBe(true);

    // Samma adress en gång till med kod: upptagen, och rutan föreslår kusinresan-2.
    fireEvent.click(screen.getByRole("button", { name: "Dela" }));
    const dialog3 = await screen.findByRole("dialog", { name: "Dela händelsen" });
    fireEvent.change(within(dialog3).getByRole("textbox", { name: "Kod (valfri)" }), { target: { value: "annan-kod" } });
    fireEvent.change(within(dialog3).getByRole("textbox", { name: "Händelsens del av adressen" }), { target: { value: "kusinresan" } });
    fireEvent.click(within(dialog3).getByRole("button", { name: "Skapa länk" }));
    expect(await within(dialog3).findByRole("alert")).toHaveTextContent(/Adressen är upptagen/);
    expect(within(dialog3).getByRole("textbox", { name: "Händelsens del av adressen" })).toHaveValue("kusinresan-2");
  });

  it("⛔ Återkalla i listan stänger länken på servern, och sidan svarar att den är stängd", async () => {
    const { tjanst, onDela, onAterkalla } = bygg();
    const { container } = render(<Kedja onDela={onDela} onAterkalla={onAterkalla} />);
    fireEvent.click(screen.getByRole("button", { name: "Dela" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela händelsen" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(dialog.querySelector("[data-handelsedelning-skapad]")).not.toBeNull());
    const url = text(dialog.querySelector("[data-lankrad-url]"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Klar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((await tjanst.hamta(url.replace(`${BAS}/g/`, ""))).ok).toBe(true);
    fireEvent.click(within(rader(container)[0]).getByRole("button", { name: /Återkalla länken/ }));
    await waitFor(() => expect(rader(container)).toHaveLength(0));
    expect(text(container.querySelector("[data-handelsedelning-tom]"))).toBe("Inga länkar. Den här händelsen är inte delad.");
    expect(await tjanst.hamta(url.replace(`${BAS}/g/`, ""))).toEqual({ ok: false, orsak: "stangd" });
  });
});
