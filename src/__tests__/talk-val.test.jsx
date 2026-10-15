import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsInspelning } from "../components/OpsTalk.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { TALK_RUBRIK_MAX, talkForifyllt, talkNasta, talkUnderlag } from "../lib/talk.js";

/*
 * Valen efter talet (0.105.0): Meddelande, Händelse, Ärende och Agent.
 *
 * CP 2026-10-14, med en skärmbild av TALK-panelen: "talk gör att man pratar in så att man ser texten direkt i realtid. Sen så finns de
 * tre knapparna där direkt. Meddelande, ärende, kalender. Och sen så adderar vi en agentknapp. Så att man får trycka på agenten om man
 * vill att agenten ska svara för att hålla en dialog." Och om var dialogen står: "Kör chatten". Agent lämnar det sagda till appens
 * `onAgent(text)`, och fältet stängs: appen öppnar chatten med agenten.
 *
 * ⛔ PROVEN GÅR GENOM SKALET, så att vägen från appens `talk` och `skapa` till fältet och vidare till formuläret provas.
 */

/** En inspelare utan mikrofon. */
function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** En igenkänning som hör en ny mening per omgång. @param {string[]} meningar */
function falskIgenkanning(meningar) {
  const stoppa = vi.fn();
  for (const m of meningar) stoppa.mockResolvedValueOnce(m);
  stoppa.mockResolvedValue("");
  return { starta: vi.fn(), stoppa, kasta: vi.fn() };
}

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () => act(async () => {});
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const SAGT = ["Boka rep med bandet. Ta med noterna.", "torsdag klockan sju"];
const FORMULAR = { lage: "g1", handelse: { form: () => <form />, katalog: null }, arende: () => <form /> };
/** Valen som står, med sina synliga ord. */
const valen = () => [...document.querySelectorAll("[data-talk-valt]")].map((k) => /** @type {string} */ (k.textContent));

/**
 * @param {{ talk?: any, skapa?: any, sprak?: string }} [val]
 */
function Skal({ talk = {}, skapa, sprak } = {}) {
  const onTalk = vi.fn(async () => {});
  const t = { onTalk, inspelare: falskInspelare(), igenkanning: falskIgenkanning(SAGT), ...talk };
  const skal = (
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t} {...(skapa ? { skapa } : {})}>
      <p>innehåll</p>
    </OpsAppShell>
  );
  render(sprak ? <OpsSprakProvider sprak={sprak}>{skal}</OpsSprakProvider> : skal);
  return t;
}

/** Mikrofonen, sedan Klar. */
async function prata() {
  fireEvent.click(huvudMikrofon());
  await flush();
  fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
  await flush();
}

describe("talkUnderlag och talkForifyllt", () => {
  it("⛔ underlaget är det som sades, och utan något hört finns inget", () => {
    expect(talkUnderlag("  Boka rep  ")).toEqual({ text: "Boka rep" });
    expect(talkUnderlag(" ")).toBe(null);
    expect(talkUnderlag(/** @type {any} */ (undefined))).toBe(null);
  });

  it("rubriken är första meningen och beskrivningen resten", () => {
    expect(talkForifyllt("Boka rep med bandet. Ta med noterna.")).toEqual({ rubrik: "Boka rep med bandet", beskrivning: "Ta med noterna." });
    expect(talkForifyllt("ring revisorn!\nhan vill ha kvittona")).toEqual({ rubrik: "Ring revisorn!", beskrivning: "han vill ha kvittona" });
    expect(talkForifyllt("Möte kl. 19 med revisorn")).toEqual({ rubrik: "Möte kl. 19 med revisorn", beskrivning: "" });
  });

  it("⛔ en första mening över taket kapas vid ett mellanslag, och då är beskrivningen hela texten", () => {
    const lang = "boka ett rep med hela bandet på torsdag i nästa vecka och se till att alla har med sig noterna till den nya låten och kablarna";
    const f = talkForifyllt(lang);
    expect(f.rubrik.length).toBeLessThanOrEqual(TALK_RUBRIK_MAX);
    expect(f.rubrik.endsWith("…")).toBe(true);
    expect(f.beskrivning).toBe(lang);
  });
});

describe("läget hört i flödet", () => {
  it("⛔ hört lämnar ingenting självt: bara Agent går till appen, och Stäng kastar", () => {
    expect(talkNasta({ lage: "skickar" }, { typ: "hort" })).toEqual({ lage: "hort", gor: null });
    expect(talkNasta({ lage: "hort" }, { typ: "klar" })).toEqual({ lage: "hort", gor: null });
    expect(talkNasta({ lage: "hort" }, { typ: "skicka" })).toEqual({ lage: "hort", gor: null });
    expect(talkNasta({ lage: "hort" }, { typ: "agent" })).toEqual({ lage: "skickar", gor: "agent" });
    expect(talkNasta({ lage: "hort" }, { typ: "avbryt" })).toEqual({ lage: "vila", gor: "kasta" });
    expect(talkNasta({ lage: "skickar" }, { typ: "lamnat" })).toEqual({ lage: "vila", gor: "kasta" });
    // ⛔ Agenten nåddes inte: tillbaka till valen med felet, och ett nytt Agent rensar det.
    expect(talkNasta({ lage: "skickar" }, { typ: "agentFel", text: "Nej" })).toEqual({ lage: "hort", gor: null, fel: "Nej" });
    expect(talkNasta({ lage: "hort", fel: "Nej" }, { typ: "agent" })).toEqual({ lage: "skickar", gor: "agent" });
    // ⛔ Felet står kvar vid en händelse som inget val hanterar (#389). Raden `return bli("hort", null, nu.fel)` i talkNasta behövs: felet
    // läses av OpsTalk (`valFel`), och utan raden försvinner det vid första klar, skicka eller dolj medan personen läser det.
    for (const typ of /** @type {const} */ (["klar", "skicka", "dolj", "tak", "upp", "igen"])) {
      expect(talkNasta({ lage: "hort", fel: "Nej" }, { typ })).toEqual({ lage: "hort", gor: null, fel: "Nej" });
    }
  });
});

describe("valen efter talet", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, "", "/");
  });

  it("⛔ med agent: Klar lämnar inget till onTalk, texten står kvar och de fyra valen har ord i ordningen Meddelande, Händelse, Ärende, Agent", async () => {
    const onAgent = vi.fn();
    const t = Skal({ talk: { onAgent, onMeddelande: vi.fn() }, skapa: FORMULAR });
    await prata();
    expect(t.onTalk).not.toHaveBeenCalled();
    expect(onAgent).not.toHaveBeenCalled();
    const dialog = /** @type {HTMLElement} */ (falt());
    expect(dialog.getAttribute("data-lage")).toBe("hort");
    expect(within(dialog).getByText(SAGT[0])).toBeTruthy();
    expect(valen()).toEqual(["Meddelande", "Händelse", "Ärende", "Agent"]);
    const grupp = within(dialog).getByRole("group", { name: "Vad ska hända med det du sa?" });
    // ⛔ Knapparna har namn, och det synliga ordet är namnet (en röststyrning säger det man ser).
    for (const namn of ["Meddelande", "Händelse", "Ärende", "Agent"]) expect(within(grupp).getByRole("button", { name: namn })).toBeTruthy();
    // ⛔ Fokus till första valet när Klar försvinner, inte sidans topp.
    expect(document.activeElement).toBe(within(grupp).getByRole("button", { name: "Meddelande" }));
  });

  it("⛔ Agent lämnar det sagda till onAgent en gång och stänger fältet, och onTalk anropas aldrig", async () => {
    const onAgent = vi.fn(async () => {});
    const t = Skal({ talk: { onAgent } });
    await prata();
    const agent = screen.getByRole("button", { name: "Agent" });
    fireEvent.click(agent);
    fireEvent.click(agent);
    await flush();
    expect(onAgent).toHaveBeenCalledTimes(1);
    expect(onAgent).toHaveBeenCalledWith(SAGT[0]);
    expect(t.onTalk).not.toHaveBeenCalled();
    expect(falt()).toBeNull();
  });

  it("⛔ faller onAgent står felet vid valen, det sagda och de fyra valen står kvar, och Agent försöker igen (granskningen av PR 387)", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onAgent = vi.fn().mockRejectedValueOnce(new Error("Chatten gick inte att öppna.")).mockResolvedValue(undefined);
      const t = Skal({ talk: { onAgent, onMeddelande: vi.fn() }, skapa: FORMULAR });
      await prata();
      fireEvent.click(screen.getByRole("button", { name: "Agent" }));
      await flush();
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(dialog.getAttribute("data-lage")).toBe("hort");
      expect(within(dialog).getByRole("alert").textContent).toBe("Chatten gick inte att öppna.");
      expect(within(dialog).getByText(SAGT[0])).toBeTruthy();
      expect(valen()).toEqual(["Meddelande", "Händelse", "Ärende", "Agent"]);
      // ⛔ Agent är Försök igen: ingen egen knapp för det.
      expect(within(dialog).queryByRole("button", { name: "Försök igen" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Agent" }));
      await flush();
      expect(onAgent).toHaveBeenCalledTimes(2);
      expect(onAgent).toHaveBeenLastCalledWith(SAGT[0]);
      expect(t.onTalk).not.toHaveBeenCalled();
      expect(falt()).toBeNull();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ felraden vid valen finns från början, tom, och det är samma rad som får felet (granskningen av PR 387)", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      Skal({ talk: { onAgent: vi.fn(async () => { throw new Error("Chatten gick inte att öppna."); }) } });
      await prata();
      const rad = within(/** @type {HTMLElement} */ (falt())).getByRole("alert");
      expect(rad.textContent).toBe("");
      fireEvent.click(screen.getByRole("button", { name: "Agent" }));
      await flush();
      expect(rad.isConnected).toBe(true);
      expect(within(/** @type {HTMLElement} */ (falt())).getByRole("alert")).toBe(rad);
      expect(rad.textContent).toBe("Chatten gick inte att öppna.");
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ faller onAgent går det att välja Ärende i stället, ifyllt med det sagda", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onAgent = vi.fn(async () => {
        throw new Error("Chatten gick inte att öppna.");
      });
      const arende = ({ formId, forifyllt }) => (
        <form id={formId}>
          <input aria-label="Rubrik" defaultValue={forifyllt?.rubrik ?? ""} />
        </form>
      );
      Skal({ talk: { onAgent }, skapa: { lage: "g1", arende } });
      await prata();
      fireEvent.click(screen.getByRole("button", { name: "Agent" }));
      await flush();
      fireEvent.click(screen.getByRole("button", { name: "Ärende" }));
      await flush();
      expect(falt()).toBeNull();
      expect(/** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Rubrik" })).value).toBe("Boka rep med bandet");
      expect(onAgent).toHaveBeenCalledTimes(1);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ utan agent syns inga val, och Klar lämnar det sagda till onTalk som förut", async () => {
    const t = Skal({ talk: { onMeddelande: vi.fn() }, skapa: FORMULAR });
    await prata();
    expect(document.querySelector("[data-talk-val]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Agent" })).toBeNull();
    expect(t.onTalk).toHaveBeenCalledTimes(1);
    expect(/** @type {any} */ (t.onTalk.mock.calls[0])[1].text).toBe(SAGT[0]);
  });

  it("⛔ hördes inget med agent går ljudet till onTalk som förut, eftersom det inte finns något att välja med", async () => {
    const onAgent = vi.fn();
    const t = Skal({ talk: { onAgent, igenkanning: false } });
    await prata();
    expect(document.querySelector("[data-talk-val]")).toBeNull();
    expect(t.onTalk).toHaveBeenCalledTimes(1);
    expect(onAgent).not.toHaveBeenCalled();
  });

  it("⛔ med agent och flera mål står inget Skickas till medan man pratar, eftersom målet inte används (granskningen av PR 387)", async () => {
    const mal = [{ id: "agenten", etikett: "Agenten" }, { id: "anteckning", etikett: "Anteckning" }];
    // Golvet: utan agent står valet, så att provet mäter villkoret och inte ett fält utan mål.
    const utan = Skal({ talk: { mal } });
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(screen.getByRole("radiogroup", { name: "Skickas till" })).toBeTruthy();
    fireEvent.click(within(/** @type {HTMLElement} */ (falt())).getByRole("button", { name: /^Avbryt/ }));
    await flush();
    expect(utan.onTalk).not.toHaveBeenCalled();
    cleanup();

    Skal({ talk: { mal, onAgent: vi.fn() } });
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(falt()).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Skickas till" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Klar/ }));
    await flush();
    expect(valen()).toEqual(["Agent"]);
  });

  it("bara valen med en mottagare: Händelse och Agent när bara händelseformuläret och agenten finns", async () => {
    Skal({ talk: { onAgent: vi.fn() }, skapa: { lage: "g1", handelse: { form: () => <form />, katalog: null } } });
    await prata();
    expect(valen()).toEqual(["Händelse", "Agent"]);
  });

  it("⛔ färdiga noder kan inte fyllas i: Händelse och Ärende ritas inte när skapa är en färdig nod (ur talk-samtal, 0.103.0)", async () => {
    Skal({ talk: { onAgent: vi.fn() }, skapa: { lage: "g1", handelse: <p>h</p>, arende: <p>ä</p> } });
    await prata();
    expect(valen()).toEqual(["Agent"]);
  });

  it("⛔ Stäng kastar det sagda utan att något anropas", async () => {
    const onAgent = vi.fn();
    const onMeddelande = vi.fn();
    const t = Skal({ talk: { onAgent, onMeddelande } });
    await prata();
    fireEvent.click(within(/** @type {HTMLElement} */ (falt())).getByRole("button", { name: "Stäng" }));
    await flush();
    expect(falt()).toBeNull();
    expect(onAgent).not.toHaveBeenCalled();
    expect(onMeddelande).not.toHaveBeenCalled();
    expect(t.onTalk).not.toHaveBeenCalled();
  });

  it("⛔ Meddelande ger appen { text } och stänger fältet", async () => {
    const onMeddelande = vi.fn();
    Skal({ talk: { onAgent: vi.fn(), onMeddelande } });
    await prata();
    fireEvent.click(screen.getByRole("button", { name: "Meddelande" }));
    expect(onMeddelande).toHaveBeenCalledTimes(1);
    expect(onMeddelande.mock.calls[0][0]).toEqual({ text: SAGT[0] });
    expect(falt()).toBeNull();
  });

  it("⛔ Ärende öppnar skalets Nytt ärende ifyllt", async () => {
    const arende = vi.fn(({ formId, forifyllt }) => (
      <form id={formId}>
        <input aria-label="Rubrik" defaultValue={forifyllt?.rubrik ?? ""} />
        <textarea aria-label="Beskrivning" defaultValue={forifyllt?.beskrivning ?? ""} />
      </form>
    ));
    Skal({ talk: { onAgent: vi.fn() }, skapa: { lage: "g1", arende } });
    await prata();
    fireEvent.click(screen.getByRole("button", { name: "Ärende" }));
    await flush();
    expect(falt()).toBeNull();
    expect(/** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Rubrik" })).value).toBe("Boka rep med bandet");
    expect(/** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Beskrivning" })).value).toBe("Ta med noterna.");
    expect(new URL(window.location.href).searchParams.get("skapa")).toBe("arende");
  });

  it("⛔ det sagda står inte i adressen, bara att Nytt ärende är öppet (ur talk-samtal, 0.103.0)", async () => {
    const arende = ({ formId, forifyllt }) => (
      <form id={formId}>
        <textarea aria-label="Beskrivning" defaultValue={forifyllt?.beskrivning ?? ""} />
      </form>
    );
    Skal({ talk: { onAgent: vi.fn() }, skapa: { lage: "g1", arende } });
    await prata();
    fireEvent.click(screen.getByRole("button", { name: "Ärende" }));
    await flush();
    expect(/** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Beskrivning" })).value).toBe("Ta med noterna.");
    const u = new URL(window.location.href);
    expect(u.searchParams.get("skapa")).toBe("arende");
    // ⛔ Det man sade hade annars hamnat i webbläsarens historik.
    expect(window.location.href).not.toContain("noterna");
    expect(window.location.href).not.toContain("Boka");
  });

  it("⛔ en ny förifyllning ersätter ett ärende som redan stod öppet (ur talk-samtal, 0.103.0)", async () => {
    const arende = ({ formId, forifyllt }) => (
      <form id={formId}>
        <input aria-label="Rubrik" defaultValue={forifyllt?.rubrik ?? ""} />
      </form>
    );
    Skal({ talk: { onAgent: vi.fn() }, skapa: { lage: "g1", arende } });
    // Första gången ifyllt, sedan pratar man igen med panelen öppen och väljer Ärende en gång till.
    await prata();
    fireEvent.click(screen.getByRole("button", { name: "Ärende" }));
    await flush();
    expect(/** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Rubrik" })).value).toBe("Boka rep med bandet");
    await prata();
    fireEvent.click(screen.getByRole("button", { name: "Ärende" }));
    await flush();
    expect(/** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Rubrik" })).value).toBe("Torsdag klockan sju");
  });

  it("⛔ Händelse öppnar skalets Ny händelse med forifyllt", async () => {
    /** @type {any[]} */
    const sett = [];
    const Form = (/** @type {any} */ p) => {
      sett.push(p.forifyllt);
      return <form id={p.formId} />;
    };
    Skal({ talk: { onAgent: vi.fn() }, skapa: { lage: "g1", handelse: { form: Form, katalog: null } } });
    await prata();
    fireEvent.click(screen.getByRole("button", { name: "Händelse" }));
    await flush();
    expect(falt()).toBeNull();
    expect(sett.at(-1)).toEqual({ rubrik: "Boka rep med bandet", beskrivning: "Ta med noterna." });
  });

  it("⛔ kastar mottagaren står felet i fältet, och det sagda finns kvar", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      Skal({ talk: { onAgent: vi.fn(), onMeddelande: () => { throw new Error("Meddelanden är inte laddade."); } } });
      await prata();
      fireEvent.click(screen.getByRole("button", { name: "Meddelande" }));
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(within(dialog).getByRole("alert").textContent).toBe("Meddelanden är inte laddade.");
      expect(within(dialog).getByText(SAGT[0])).toBeTruthy();
    } finally {
      konsol.mockRestore();
    }
  });

  it("orden följer språket", async () => {
    Skal({ talk: { onAgent: vi.fn(), onMeddelande: vi.fn() }, skapa: FORMULAR, sprak: "en" });
    await prata();
    expect(valen()).toEqual(["Message", "Event", "Case", "Agent"]);
    expect(screen.getByRole("group", { name: "What should happen with what you said?" })).toBeTruthy();
  });
});

describe("stängt API", () => {
  it("⛔ skalet kastar på det 0.105.0 tog bort, och på en mottagare som inte är en funktion", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => Skal({ talk: { svaraText: "Svara" } })).toThrow(/talk.svaraText finns inte sedan 0.105.0/);
      expect(() => Skal({ talk: { onFortsatt: () => {} } })).toThrow(/talk.onFortsatt finns inte sedan 0.105.0/);
      expect(() => Skal({ talk: { fortsattEtikett: "Fortsätt i chatten" } })).toThrow(/fortsattEtikett finns inte/);
      expect(() => Skal({ talk: { onAgent: "chatten" } })).toThrow(/talk.onAgent ska vara en funktion/);
      expect(() => Skal({ talk: { onMeddelande: 1 } })).toThrow(/talk.onMeddelande ska vara en funktion/);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ OpsInspelning kastar på en okänd mottagare och på en onAgent som inte är en funktion", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    const bas = { lage: /** @type {const} */ ("hort"), niva: () => 0, sekunder: 0, tak: 120, framsteg: null, kanIgen: false, onKlar: () => {}, onAvbryt: () => {}, onIgen: () => {} };
    try {
      expect(() => render(<OpsInspelning {...bas} vidare={/** @type {any} */ ({ uppgift: () => {} })} />)).toThrow(/vidare/);
      expect(() => render(<OpsInspelning {...bas} onAgent={/** @type {any} */ ("ja")} />)).toThrow(/onAgent ska vara en funktion/);
      expect(() => render(<OpsInspelning {...bas} {.../** @type {any} */ ({ onSvara: () => {} })} />)).toThrow(/okända props onSvara/);
    } finally {
      konsol.mockRestore();
    }
  });
});
