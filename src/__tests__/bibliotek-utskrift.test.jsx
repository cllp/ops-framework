import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * Utskriften av en ljudpost i biblioteket (cllp/lifehub.app#349, 0.115.0).
 *
 * CP 2026-10-17: "När jag spelar in en ny ljudfil i biblioteket vill jag kunna transkribera den också ... use caset när jag ska sjunga in en
 * låt, och så får jag automatiskt texten utskriven." Och strax efter: "det kanske kan få vara ett val." Beslutet i ärendet: knappen "Skriv ut
 * texten" på en ljudpost, texten på samma post (fältet `utskrift`, skrivet av servern) under spelaren, och under texten Kopiera och
 * "Gör en anteckning av texten".
 *
 * ⛔ SERVERN SKRIVER TEXTEN, INTE SVARET. Harnessen nedan gör som en app med en prenumeration: `onSkrivUt` löser till ingenting, och texten
 * kommer in på posten i listan när "servern" skriver den (`serverSkriver`). Det som provas är att vyn läser texten ur posten.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const FORFATTARE = { uid: "uid-1", roll: "medlem" };
const RUBRIK = "Idé 2026-10-17 10:05";

/** @param {Record<string, unknown>} [extra] */
const ljud = (extra = {}) => ({
  ...byggPost({
    groupId: "cps-ab",
    typ: "fil",
    rubrik: RUBRIK,
    fil: { sokvag: "grupper/cps-ab/bibliotek/p/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 4000 },
    skapadAv: skapare,
    skapad: tid,
    andrad: tid,
    ...extra,
  }),
  id: "ljud",
});
const bild = {
  ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Kvitto", fil: { sokvag: "grupper/cps-ab/bibliotek/k/k.jpg", namn: "k.jpg", mime: "image/jpeg", byte: 2000 }, skapadAv: skapare, skapad: tid, andrad: tid }),
  id: "bild",
};

/** @type {(id: string, text: string) => void} */
let serverSkriver = () => {};

/**
 * @param {{ start?: any[], onSkrivUt?: any, onAnteckningAvUtskrift?: any, jag?: any, sprak?: string }} props
 */
function Harness({ start = [ljud()], onSkrivUt, onAnteckningAvUtskrift, jag = FORFATTARE, sprak = "sv" }) {
  const [poster, setPoster] = useState(start);
  const [vald, setVald] = useState(/** @type {any} */ (null));
  useEffect(() => {
    serverSkriver = (id, text) => setPoster((ps) => ps.map((p) => (p.id === id ? { ...p, utskrift: text } : p)));
  }, []);
  return (
    <OpsSprakProvider sprak={sprak}>
      <OpsBibliotek
        poster={poster}
        jag={jag}
        vald={vald}
        onOppna={(p) => setVald(p)}
        onStang={() => setVald(null)}
        onSkapa={() => {}}
        onSpara={() => {}}
        filUrl={() => "https://exempel.se/ide.webm"}
        hubHref="/hub"
        {...(onSkrivUt ? { onSkrivUt } : {})}
        {...(onAnteckningAvUtskrift ? { onAnteckningAvUtskrift } : {})}
      />
    </OpsSprakProvider>
  );
}

const oppna = (rubrik = RUBRIK) => fireEvent.click(screen.getByRole("button", { name: rubrik }));
const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
const gaTid = (/** @type {number} */ ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const utskriften = () => document.querySelector("[data-bibliotek-utskrift]");
/** @returns {{ lofte: Promise<void>, los: () => void, avvisa: (e: Error) => void }} */
function uppskjuten() {
  /** @type {any} */ let los;
  /** @type {any} */ let avvisa;
  const lofte = new Promise((a, b) => {
    los = a;
    avvisa = b;
  });
  return { lofte, los, avvisa };
}

/** @param {unknown} urklipp */
function stubbaUrklipp(urklipp) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: urklipp });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  delete (/** @type {any} */ (navigator)).clipboard;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Skriv ut texten på en ljudpost", () => {
  it("⛔ utan props ritas ingen knapp, varken på ljud, i listan eller på en bild", () => {
    render(<Harness start={[ljud(), bild]} />);
    oppna();
    expect(screen.queryByRole("button", { name: "Skriv ut texten" })).toBeNull();
    expect(document.querySelector("[data-bibliotek-utskrift-kontroll]")).toBeNull();
  });

  it("⛔ knappen anropar onSkrivUt med posten, och statusen Skriver ut… står på posten medan löftet pågår", async () => {
    const u = uppskjuten();
    const onSkrivUt = vi.fn(() => u.lofte);
    render(<Harness onSkrivUt={onSkrivUt} />);
    oppna();
    fireEvent.click(screen.getByRole("button", { name: "Skriv ut texten" }));
    await flush();
    expect(onSkrivUt).toHaveBeenCalledTimes(1);
    expect(onSkrivUt.mock.calls[0][0]).toMatchObject({ id: "ljud", rubrik: RUBRIK });
    expect(screen.getByRole("status").textContent).toBe("Skriver ut…");
    // Ett andra tryck medan det pågår går inte att göra: knappen är bytt mot statusen.
    expect(screen.queryByRole("button", { name: "Skriv ut texten" })).toBeNull();
    expect(onSkrivUt).toHaveBeenCalledTimes(1);
    await act(async () => u.los());
    await flush();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("⛔ ingen knapp på en bild, och inte heller utan att posten är ett ljud", () => {
    render(<Harness start={[bild]} onSkrivUt={vi.fn()} />);
    oppna("Kvitto");
    expect(screen.queryByRole("button", { name: "Skriv ut texten" })).toBeNull();
  });

  it("⛔ ett fel visas på posten med knappen kvar, också ett dygnstak, och ett nytt tryck försöker igen", async () => {
    const onSkrivUt = vi.fn().mockRejectedValueOnce(new Error("Dygnstaket för utskrifter är nått.")).mockResolvedValue(undefined);
    render(<Harness onSkrivUt={onSkrivUt} />);
    oppna();
    fireEvent.click(screen.getByRole("button", { name: "Skriv ut texten" }));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Dygnstaket för utskrifter är nått.");
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Skriv ut texten" }));
    await flush();
    expect(onSkrivUt).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ett fel utan text får ramverkets eget ord", async () => {
    render(<Harness onSkrivUt={vi.fn().mockRejectedValue("nej")} />);
    oppna();
    fireEvent.click(screen.getByRole("button", { name: "Skriv ut texten" }));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Ljudet gick inte att skriva ut.");
  });

  it("⛔ texten som servern skriver visas under spelaren när posten läses om, och knappen försvinner", async () => {
    render(<Harness onSkrivUt={vi.fn(async () => {})} />);
    oppna();
    expect(utskriften()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Skriv ut texten" }));
    await flush();
    // Servern skriver fältet på posten. Detaljen öppnades med den gamla posten och ska ändå visa den nya.
    await act(async () => serverSkriver("ljud", "Första versen\nandra raden\n\nRefräng"));
    expect(utskriften()).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Skriv ut texten" })).toBeNull();
  });

  it("⛔ utskriften visas med radbrytningarna kvar, så att verser syns", () => {
    const text = "Första versen\nandra raden\n\nRefräng\nsista raden";
    render(<Harness start={[ljud({ utskrift: text })]} />);
    oppna();
    const p = /** @type {HTMLElement} */ (utskriften());
    // Texten är oförändrad, med sina \n, och ytan bevarar dem (`white-space: pre-wrap`). jsdom ritar ingen CSS: klassen är det som provas.
    expect(p.textContent).toBe(text);
    expect(p.className).toContain("whitespace-pre-wrap");
    expect(p.tagName).toBe("P");
  });

  it("en tom utskrift är ett svar, och knappen finns kvar för att försöka igen; har posten en text finns ingen knapp", () => {
    const { unmount } = render(<Harness start={[ljud({ utskrift: "" })]} onSkrivUt={vi.fn()} />);
    oppna();
    expect(screen.getByText("Utskriften är tom.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skriv ut texten" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kopiera" })).toBeNull();
    unmount();
    render(<Harness start={[ljud({ utskrift: "Hej" })]} onSkrivUt={vi.fn()} />);
    oppna();
    expect(screen.queryByRole("button", { name: "Skriv ut texten" })).toBeNull();
  });

  it("en läsare ser utskriften och Kopiera, men ingen Skriv ut-knapp när posten redan har en text", () => {
    render(<Harness start={[ljud({ utskrift: "Redan skriven" })]} jag={{ uid: "uid-annan", roll: "medlem" }} />);
    oppna();
    expect(screen.getByText("Redan skriven")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kopiera" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skriv ut texten" })).toBeNull();
  });

  it("ordtabell: Write out the text, Writing it out…, Copy och Make a note of the text på engelska", async () => {
    const u = uppskjuten();
    render(<Harness sprak="en" onSkrivUt={() => u.lofte} onAnteckningAvUtskrift={vi.fn()} start={[ljud({ utskrift: "Hej" })]} />);
    oppna();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Make a note of the text" })).toBeTruthy();
    cleanup();
    render(<Harness sprak="en" onSkrivUt={() => u.lofte} />);
    oppna();
    fireEvent.click(screen.getByRole("button", { name: "Write out the text" }));
    await flush();
    expect(screen.getByRole("status").textContent).toBe("Writing it out…");
    await act(async () => u.los());
  });
});

describe("Kopiera och Gör en anteckning av texten", () => {
  const TEXT = "Första versen\nandra raden";

  it("⛔ Kopiera skriver utskriften till urklipp och säger Kopierat en kort stund", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubbaUrklipp({ writeText });
    render(<Harness start={[ljud({ utskrift: TEXT })]} />);
    oppna();
    fireEvent.click(screen.getByRole("button", { name: "Kopiera" }));
    await flush();
    expect(writeText).toHaveBeenCalledWith(TEXT);
    expect(screen.getByRole("status").textContent).toBe("Kopierat");
    await gaTid(5000);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("⛔ faller urklippet eller saknas det visas felet på posten", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Harness start={[ljud({ utskrift: TEXT })]} />);
    oppna();
    fireEvent.click(screen.getByRole("button", { name: "Kopiera" }));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Texten gick inte att kopiera till urklipp.");
    expect(screen.queryByRole("status")).toBeNull();
    stubbaUrklipp({ writeText: vi.fn().mockRejectedValue(new Error("nekad")) });
    fireEvent.click(screen.getByRole("button", { name: "Kopiera" }));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Texten gick inte att kopiera till urklipp.");
    expect(konsol.mock.calls.filter((c) => c[2]?.steg === "kopiera")).toHaveLength(2);
  });

  it("⛔ Gör en anteckning av texten ritas bara när onAnteckningAvUtskrift getts, anropar den med posten och säger att anteckningen är sparad", async () => {
    const { unmount } = render(<Harness start={[ljud({ utskrift: TEXT })]} />);
    oppna();
    expect(screen.queryByRole("button", { name: "Gör en anteckning av texten" })).toBeNull();
    unmount();

    const u = uppskjuten();
    const onAnteckningAvUtskrift = vi.fn(() => u.lofte);
    render(<Harness start={[ljud({ utskrift: TEXT })]} onAnteckningAvUtskrift={onAnteckningAvUtskrift} />);
    oppna();
    fireEvent.click(screen.getByRole("button", { name: "Gör en anteckning av texten" }));
    await flush();
    expect(onAnteckningAvUtskrift).toHaveBeenCalledTimes(1);
    expect(onAnteckningAvUtskrift.mock.calls[0][0]).toMatchObject({ id: "ljud", utskrift: TEXT });
    await act(async () => u.los());
    await flush();
    expect(screen.getByRole("status").textContent).toBe("Anteckningen är sparad");
    await gaTid(5000);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("⛔ faller anteckningen visas felet på posten, och knappen går att trycka igen", async () => {
    const onAnteckningAvUtskrift = vi.fn().mockRejectedValueOnce(new Error("Biblioteket svarade inte.")).mockResolvedValue(undefined);
    render(<Harness start={[ljud({ utskrift: TEXT })]} onAnteckningAvUtskrift={onAnteckningAvUtskrift} />);
    oppna();
    fireEvent.click(screen.getByRole("button", { name: "Gör en anteckning av texten" }));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Biblioteket svarade inte.");
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gör en anteckning av texten" }));
    await flush();
    expect(onAnteckningAvUtskrift).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Anteckningen är sparad");
  });

  it("⛔ onGorForslag är borta och kastar, så att en app som fortfarande ger den får veta det", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <OpsBibliotek poster={[]} jag={FORFATTARE} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" {...{ onGorForslag: () => {} }} />,
      ),
    ).toThrow(/onGorForslag är borta/);
    fel.mockRestore();
  });

  it("knapparna i raden är små, och texten ligger före dem", () => {
    render(<Harness start={[ljud({ utskrift: TEXT })]} onAnteckningAvUtskrift={vi.fn()} />);
    oppna();
    const kontroll = /** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-utskrift-kontroll]"));
    const knappar = within(kontroll).getAllByRole("button");
    expect(knappar.map((k) => k.textContent)).toEqual(["Kopiera", "Gör en anteckning av texten"]);
    expect(kontroll.firstElementChild).toBe(utskriften());
  });
});
