import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell, useOppnaInspelning } from "../components/OpsAppShell.jsx";
import { validateModuler } from "../lib/modul.js";

/*
 * `kanLyssna` på en igenkänning appen ger (0.218.0).
 *
 * ⛔ HÄNDELSEN: på iOS visade varje röstinspelning "Texten kan inte visas just nu…". Appens inbyggda igenkänning kan inte lyssna medan
 * inspelaren har mikrofonen, men en omgång som spelar in (ett låst mål, "Spela in i stället") fick den ändå, eftersom `igkRef` och
 * `igkWebRef` båda kommer ur samma `igenkanning`. Den kunde då bara säga fel (felraden) eller tiga (platshållaren stod kvar). Med
 * `kanLyssna` säger den nej i förväg. Se `kanLyssnaI` i `OpsTalk.jsx`.
 *
 * ⛔ WEBKIT SIMULERAS MED USER AGENT-STRÄNGEN (`arWebKit`), som i `talk-webkit.test.jsx`. Det som provas är ramverkets val av väg.
 */

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const platstext = () => document.querySelector("[data-talk-platstext]");
const textfel = () => document.querySelector("[data-talk-textfel]");

function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/mp4" }), mimeType: "audio/mp4", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** Appens egen igenkänning, som den inbyggda i telefonen. @param {any} [kanLyssna] */
function appensIgenkanning(kanLyssna) {
  return {
    starta: vi.fn(),
    stoppa: vi.fn(async () => ""),
    kasta: vi.fn(),
    ...(kanLyssna === undefined ? {} : { kanLyssna }),
  };
}

/** Som iOS-appen efter ompinningen: lyssnar bara när ingen inspelare har mikrofonen. */
const BARA_UTAN_INSPELARE = (/** @type {{ baraIgenkanning: boolean }} */ { baraIgenkanning }) => baraIgenkanning === true;

const modul = (/** @type {any} */ spara) => ({
  id: "bibliotek",
  namn: { sv: "Bibliotek", en: "Library" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: null,
  tillagg: [{ plats: "inspelning.mal", id: "spara", etikett: { sv: "Spara i Biblioteket", en: "Save in the library" }, spara }],
});

/** @param {any} igenkanning */
function SkalMedLastMal(igenkanning) {
  const Rad = () => {
    const oppna = useOppnaInspelning();
    return <button type="button" onClick={() => oppna("bibliotek")}>Röstinspelning i Biblioteket</button>;
  };
  const t = { onTalk: vi.fn(async () => {}), onAgent: vi.fn(), inspelare: falskInspelare(), igenkanning };
  render(
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t} skapa={{ lage: "g", moduler: validateModuler([modul(vi.fn(async () => {}))]), aktivGrupp: { id: "g", moduler: ["bibliotek"] } }}>
      <Rad />
    </OpsAppShell>,
  );
  return t;
}

/** @param {any} igenkanning @param {Record<string, unknown>} [extra] */
function Skal(igenkanning, extra = {}) {
  const t = { onTalk: vi.fn(async () => {}), onAgent: vi.fn(async () => {}), inspelare: falskInspelare(), igenkanning, ...extra };
  render(
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t}>
      <p>innehåll</p>
    </OpsAppShell>,
  );
  return t;
}

/** @param {import("vitest").MockInstance} konsol @param {string} steg */
const rapporter = (konsol, steg) => konsol.mock.calls.filter((c) => c[2] && typeof c[2] === "object" && c[2].steg === steg).map((c) => c[2]);

describe("WebKit: en igenkänning som inte kan lyssna i omgången står över den", () => {
  /** @type {import("vitest").MockInstance} */
  let ua;
  /** @type {import("vitest").MockInstance} */
  let konsol;
  beforeEach(() => {
    vi.useFakeTimers();
    ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    konsol = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    ua.mockRestore();
    konsol.mockRestore();
    cleanup();
  });

  it("⛔ ett låst mål (Röstinspelning): ingen platstext, ingen felrad, starta anropas aldrig, och inspelaren spelar in", async () => {
    const igk = appensIgenkanning(vi.fn(BARA_UTAN_INSPELARE));
    const t = SkalMedLastMal(igk);
    fireEvent.click(screen.getByRole("button", { name: "Röstinspelning i Biblioteket" }));
    await flush();
    expect(falt()?.getAttribute("data-lage")).toBe("lyssnar");
    expect(t.inspelare.starta).toHaveBeenCalledTimes(1);
    expect(igk.starta).not.toHaveBeenCalled();
    expect(igk.kanLyssna).toHaveBeenCalledWith({ baraIgenkanning: false });
    expect(platstext()).toBeNull();
    expect(textfel()).toBeNull();
  });

  it("⛔ Spela in i stället: andra omgången lyssnar inte, och visar varken platstext eller felrad", async () => {
    const igk = appensIgenkanning(vi.fn(BARA_UTAN_INSPELARE));
    const t = Skal(igk, { tillText: vi.fn(async () => "ring revisorn") });
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(igk.starta).toHaveBeenCalledTimes(1);
    // Igenkänningen faller, och fältet erbjuder Spela in i stället.
    act(() => igk.starta.mock.calls[0][0].onFel?.("not-allowed"));
    await flush();
    fireEvent.click(within(/** @type {HTMLElement} */ (falt())).getByRole("button", { name: "Spela in i stället" }));
    await flush();
    expect(falt()?.getAttribute("data-lage")).toBe("lyssnar");
    expect(t.inspelare.starta).toHaveBeenCalledTimes(1);
    expect(igk.starta).toHaveBeenCalledTimes(1);
    expect(platstext()).toBeNull();
    expect(textfel()).toBeNull();
  });

  it("en omgång med bara igenkänningen (TALK med valen) anropar starta, och textytan står med sin platstext", async () => {
    const igk = appensIgenkanning(vi.fn(BARA_UTAN_INSPELARE));
    const t = Skal(igk);
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(igk.kanLyssna).toHaveBeenCalledWith({ baraIgenkanning: true });
    expect(igk.starta).toHaveBeenCalledTimes(1);
    expect(t.inspelare.starta).not.toHaveBeenCalled();
    expect(platstext()).not.toBeNull();
  });

  it("en igenkänning utan kanLyssna lyssnar som förut, också i ett låst mål", async () => {
    const igk = appensIgenkanning();
    const t = SkalMedLastMal(igk);
    fireEvent.click(screen.getByRole("button", { name: "Röstinspelning i Biblioteket" }));
    await flush();
    expect(t.inspelare.starta).toHaveBeenCalledTimes(1);
    expect(igk.starta).toHaveBeenCalledTimes(1);
    expect(platstext()).not.toBeNull();
  });

  it("⛔ en kanLyssna som kastar rapporteras, och omgången blir en inspelning utan levande text", async () => {
    const igk = appensIgenkanning(() => {
      throw new Error("bryggan svarar inte");
    });
    const t = SkalMedLastMal(igk);
    fireEvent.click(screen.getByRole("button", { name: "Röstinspelning i Biblioteket" }));
    await flush();
    expect(t.inspelare.starta).toHaveBeenCalledTimes(1);
    expect(igk.starta).not.toHaveBeenCalled();
    expect(platstext()).toBeNull();
    expect(textfel()).toBeNull();
    const rapport = rapporter(konsol, "kanLyssna");
    expect(rapport.length).toBeGreaterThanOrEqual(1);
    expect(rapport[0]).toMatchObject({ yta: "OpsTalk", steg: "kanLyssna" });
  });
});

describe("⛔ kanLyssna frågas en gång per kandidat och omgång (granskningen av 0.218.0)", () => {
  /** @type {import("vitest").MockInstance} */
  let ua;
  /** @type {import("vitest").MockInstance} */
  let konsol;
  beforeEach(() => {
    vi.useFakeTimers();
    ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    konsol = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    ua.mockRestore();
    konsol.mockRestore();
    cleanup();
  });

  it("⛔ en igenkänning som svarar ja och sedan nej: omgången med bara igenkänningen lyssnar, och frågan ställs en gång", async () => {
    const svar = [true, false];
    const igk = appensIgenkanning(vi.fn(() => svar.shift() ?? false));
    // Textytans fråga före första starten (ritningen) räknas inte: mocken nollställs efter ritningen.
    const t = Skal(igk);
    igk.kanLyssna.mockClear();
    svar.splice(0, svar.length, true, false);
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(igk.kanLyssna).toHaveBeenCalledTimes(1);
    expect(igk.starta).toHaveBeenCalledTimes(1);
    expect(t.inspelare.starta).not.toHaveBeenCalled();
    expect(platstext()).not.toBeNull();
  });

  it("⛔ en kanLyssna som kastar rapporteras en gång per omgång", async () => {
    const igk = appensIgenkanning(() => {
      throw new Error("bryggan svarar inte");
    });
    Skal(igk);
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(rapporter(konsol, "kanLyssna")).toHaveLength(1);
    expect(igk.starta).not.toHaveBeenCalled();
  });
});
