import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsInspelning, useTalk } from "../components/OpsTalk.jsx";
import { TALK_RUBRIK_MAX, talkForifyllt, talkUnderlag } from "../lib/talk.js";

/*
 * Samtalet i TALK-fältet och de tre ikonerna som gör det till ett meddelande, en händelse eller ett ärende (0.103.0).
 *
 * CP 2026-10-14: "vi kanske vill kunna att skapa ett ärende manuellt på det som sägs genom att klicka på skapa ärende, händelse
 * eller meddelande själv med den man pratar in? Inte så dumt med 3 knappar/ikoner när man pratat in som option, där historiken
 * finns med om man pratat med agenten olika omgångar. Så bubblans storlek med texten får en fixed size men texten scrollar där i,
 * och överst finns en headerbar med ikonerna för chatt, händelse, kalender där man för in all text från konversationen direkt. Och
 * om det är i en chatt så är flödet 'fortsätt i chatten'."
 *
 * ⛔ PROVEN GÅR GENOM SKALET där det går, så att vägen från appens `talk` och `skapa` till fältet och tillbaka till formuläret
 * provas, och inte bara komponenten. Kroken provas direkt för historiken, där ett knapptryck inte kan visa vad som hölls.
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
const samtalsyta = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-samtal]"));
const KVITTON = ["Vilken dag?", "Inlagt: Rep, torsdag 19:00"];
const SAGT = ["Boka rep med bandet. Ta med noterna.", "torsdag klockan sju"];

/**
 * @param {{ talk?: any, skapa?: any }} [val]
 */
function Skal({ talk = {}, skapa } = {}) {
  let n = 0;
  const onTalk = vi.fn(async () => ({ kvitto: KVITTON[Math.min(n++, KVITTON.length - 1)] }));
  const t = { onTalk, inspelare: falskInspelare(), igenkanning: falskIgenkanning(SAGT), ...talk };
  render(
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t} {...(skapa ? { skapa } : {})}>
      <p>innehåll</p>
    </OpsAppShell>,
  );
  return t;
}

/** En omgång: mikrofonen (eller Svara), sedan Klar, och vänta tills kvittot står. @param {"forsta" | "svara"} hur */
async function omgang(hur) {
  if (hur === "forsta") fireEvent.click(huvudMikrofon());
  else fireEvent.click(screen.getByRole("button", { name: "Svara" }));
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
  await flush();
}

describe("talkUnderlag och talkForifyllt", () => {
  it("⛔ underlaget bär det personen sade, hela samtalet per rad och raderna som kopior", () => {
    const rader = [
      { hord: "Boka rep", kvitto: "Vilken dag?", angrat: false },
      { hord: "", kvitto: "Jag hörde inget", angrat: false },
      { hord: "torsdag", kvitto: "Inlagt: Rep", angrat: true },
    ];
    const u = /** @type {NonNullable<ReturnType<typeof talkUnderlag>>} */ (talkUnderlag(rader));
    expect(u.text).toBe("Boka rep\n\ntorsdag");
    expect(u.samtal).toBe("Du: Boka rep\nAgenten: Vilken dag?\nAgenten: Jag hörde inget\nDu: torsdag\nAgenten: Inlagt: Rep (ångrat)");
    expect(u.rader).toEqual(rader);
    expect(u.rader[0]).not.toBe(rader[0]);
  });

  it("⛔ utan något hört finns inget underlag", () => {
    expect(talkUnderlag([])).toBe(null);
    expect(talkUnderlag([{ hord: " ", kvitto: "Sparat", angrat: false }])).toBe(null);
  });

  it("rubriken är första meningen och beskrivningen resten", () => {
    expect(talkForifyllt("Boka rep med bandet. Ta med noterna.")).toEqual({ rubrik: "Boka rep med bandet", beskrivning: "Ta med noterna." });
    expect(talkForifyllt("ring revisorn!\nhan vill ha kvittona")).toEqual({ rubrik: "Ring revisorn!", beskrivning: "han vill ha kvittona" });
    // "kl. 19" är ingen meningsgräns: det som följer är inte en stor bokstav.
    expect(talkForifyllt("Möte kl. 19 med revisorn")).toEqual({ rubrik: "Möte kl. 19 med revisorn", beskrivning: "" });
  });

  it("⛔ en första mening över taket kapas vid ett mellanslag, och då är beskrivningen hela texten", () => {
    const lang = "boka ett rep med hela bandet på torsdag i nästa vecka och se till att alla har med sig noterna till den nya låten och kablarna";
    const f = talkForifyllt(lang);
    expect(f.rubrik.length).toBeLessThanOrEqual(TALK_RUBRIK_MAX);
    expect(f.rubrik.endsWith("…")).toBe(true);
    expect(f.rubrik.startsWith("Boka ett rep")).toBe(true);
    expect(f.rubrik).not.toMatch(/\s…$/);
    expect(f.beskrivning).toBe(lang);
  });
});

describe("historiken i kroken", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("⛔ växer med varje omgång som nådde kvittot, överlever Svara och töms när fältet stängs", async () => {
    let n = 0;
    const igk = falskIgenkanning(SAGT);
    const hook = renderHook(() => useTalk({ onTalk: async () => ({ kvitto: KVITTON[n++] }), onKlick: () => {}, inspelare: falskInspelare(), igenkanning: igk }));
    act(() => hook.result.current.direkt());
    await flush();
    act(() => hook.result.current.skickaIn());
    await flush();
    expect(hook.result.current.historik).toEqual([{ hord: SAGT[0], kvitto: KVITTON[0], angrat: false }]);
    // Svara: en ny omgång, samma samtal.
    act(() => hook.result.current.direkt());
    await flush();
    expect(hook.result.current.historik).toHaveLength(1);
    act(() => hook.result.current.skickaIn());
    await flush();
    expect(hook.result.current.historik).toEqual([
      { hord: SAGT[0], kvitto: KVITTON[0], angrat: false },
      { hord: SAGT[1], kvitto: KVITTON[1], angrat: false },
    ]);
    // Stäng: tillbaka till vila, och samtalet är slut.
    act(() => hook.result.current.avbryt());
    expect(hook.result.current.lage).toBe("vila");
    expect(hook.result.current.historik).toEqual([]);
  });

  it("⛔ Ångrat syns på omgången kvittot hör till", async () => {
    const hook = renderHook(() => useTalk({ onTalk: async () => ({ kvitto: "Inlagt: Rep", angra: async () => {} }), onKlick: () => {}, inspelare: falskInspelare(), igenkanning: falskIgenkanning(["boka rep"]) }));
    act(() => hook.result.current.direkt());
    await flush();
    act(() => hook.result.current.skickaIn());
    await flush();
    act(() => hook.result.current.angra());
    await flush();
    expect(hook.result.current.historik).toEqual([{ hord: "boka rep", kvitto: "Inlagt: Rep", angrat: true }]);
  });
});

describe("samtalsytan i fältet", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("⛔ efter två omgångar står båda i en rullande yta med fast höjd, och knapparna står utanför den", async () => {
    Skal({ talk: { onFortsatt: () => {} } });
    await omgang("forsta");
    await omgang("svara");
    const yta = samtalsyta();
    expect(yta).not.toBeNull();
    expect(yta.getAttribute("role")).toBe("region");
    expect(yta.getAttribute("aria-label")).toBe("Samtalet");
    expect(yta.className).toContain("h-[min(15rem,34dvh)]");
    expect(yta.className).toContain("overflow-y-auto");
    expect(yta.tabIndex).toBe(0);
    for (const t of [...SAGT, ...KVITTON]) expect(within(yta).getByText(t, { exact: false })).toBeTruthy();
    // Den aktuella omgången är statusregionen, och den finns i ytan.
    expect(within(yta).getByRole("status").textContent).toBe(KVITTON[1]);
    for (const namn of ["Stäng", "Svara"]) {
      const knapp = screen.getByRole("button", { name: namn });
      expect(yta.contains(knapp)).toBe(false);
    }
    const rubrikrad = /** @type {HTMLElement} */ (document.querySelector("[data-talk-rubrikrad]"));
    expect(yta.contains(rubrikrad)).toBe(false);
    // Rubrikraden står överst i fältet.
    expect(rubrikrad.compareDocumentPosition(yta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("⛔ ytan rullar till sista raden när ett nytt kvitto kommer", async () => {
    const forut = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get() { return this.hasAttribute("data-talk-samtal") ? 900 : 0; } });
    try {
      Skal();
      await omgang("forsta");
      // Personen har rullat upp och läser.
      samtalsyta().scrollTop = 0;
      await omgang("svara");
      expect(samtalsyta().scrollTop).toBe(900);
    } finally {
      if (forut) Object.defineProperty(HTMLElement.prototype, "scrollHeight", forut);
      else delete (/** @type {any} */ (HTMLElement.prototype)).scrollHeight;
    }
  });

  it("⛔ med tangentbordet: bakåt från Svara når Stäng, ytan och ikonerna, och Enter på en ikon öppnar formuläret", async () => {
    // Riktiga timers: user-event väntar på sina egna, och Radix tooltip öppnas vid fokus.
    vi.useRealTimers();
    const anv = userEvent.setup();
    const arende = vi.fn(({ formId }) => <form id={formId} />);
    Skal({ skapa: { lage: "g1", arende } });
    await omgang("forsta");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Svara" }));
    await anv.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Stäng" }));
    await anv.tab({ shift: true });
    expect(document.activeElement).toBe(samtalsyta());
    await anv.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Skapa ett ärende av samtalet" }));
    await anv.keyboard("{Enter}");
    await flush();
    expect(arende).toHaveBeenCalled();
    expect(falt()).toBeNull();
  });

  it("⛔ fokus går fortsatt till Svara när kvittot kommer, också med rubrikradens ikoner före den", async () => {
    Skal({ talk: { onFortsatt: () => {} }, skapa: { lage: "g1", arende: () => <form /> } });
    await omgang("forsta");
    expect(document.querySelectorAll("[data-talk-vidare]")).toHaveLength(2);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Svara" }));
    await omgang("svara");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Svara" }));
  });
});

describe("ikonerna ritas bara med en mottagare", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** @returns {string[]} */
  const ikoner = () => [...document.querySelectorAll("[data-talk-vidare]")].map((k) => /** @type {string} */ (k.getAttribute("aria-label")));

  it("⛔ utan mottagare: ingen rubrikrad alls", async () => {
    Skal();
    await omgang("forsta");
    expect(document.querySelector("[data-talk-rubrikrad]")).toBeNull();
  });

  it("⛔ färdiga noder kan inte fyllas i, och får ingen ikon", async () => {
    Skal({ skapa: { lage: "g1", handelse: <p>h</p>, arende: <p>ä</p> } });
    await omgang("forsta");
    expect(ikoner()).toEqual([]);
  });

  it("varje mottagare sin ikon, i ordningen Meddelande, Händelse, Ärende", async () => {
    Skal({ talk: { onFortsatt: () => {} }, skapa: { lage: "g1", handelse: { form: () => <form />, katalog: null }, arende: () => <form /> } });
    await omgang("forsta");
    expect(ikoner()).toEqual(["Skapa ett meddelande av samtalet", "Skapa en händelse av samtalet", "Skapa ett ärende av samtalet"]);
    for (const k of document.querySelectorAll("[data-talk-vidare]")) {
      expect(k.className).toContain("size-11");
      expect(k.querySelector("svg")).not.toBeNull();
    }
  });

  it("bara Händelse när bara händelseformuläret finns", async () => {
    Skal({ skapa: { lage: "g1", handelse: { form: () => <form />, katalog: null } } });
    await omgang("forsta");
    expect(ikoner()).toEqual(["Skapa en händelse av samtalet"]);
  });

  it("⛔ i en chatt heter Meddelande Fortsätt i chatten", async () => {
    Skal({ talk: { onFortsatt: () => {}, fortsattEtikett: "Fortsätt i chatten" } });
    await omgang("forsta");
    expect(ikoner()).toEqual(["Fortsätt i chatten"]);
  });

  it("⛔ utan något hört finns inget att lämna, och inga ikoner", async () => {
    Skal({ talk: { onFortsatt: () => {}, igenkanning: false }, skapa: { lage: "g1", arende: () => <form /> } });
    await omgang("forsta");
    expect(screen.getByRole("status").textContent).toBe(KVITTON[0]);
    expect(ikoner()).toEqual([]);
  });

  it("⛔ skalet kastar vid uppstart på en etikett utan mottagare och på en mottagare som inte är en funktion", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => Skal({ talk: { fortsattEtikett: "Fortsätt i chatten" } })).toThrow(/fortsattEtikett utan talk.onFortsatt/);
      expect(() => Skal({ talk: { onFortsatt: "chatten" } })).toThrow(/onFortsatt ska vara en funktion/);
      expect(() => Skal({ talk: { onFortsatt: () => {}, fortsattEtikett: " " } })).toThrow(/fortsattEtikett ska vara en sträng/);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ OpsInspelning kastar på en okänd mottagare", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsInspelning lage="sparat" niva={() => 0} sekunder={0} tak={120} framsteg={null} kanIgen={false} onKlar={() => {}} onAvbryt={() => {}} onIgen={() => {}} vidare={/** @type {any} */ ({ uppgift: () => {} })} />)).toThrow(/vidare/);
    } finally {
      konsol.mockRestore();
    }
  });
});

describe("ett tryck lämnar samtalet och stänger fältet", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, "", "/");
  });

  it("⛔ Meddelande ger appen { text, samtal, rader }", async () => {
    const onFortsatt = vi.fn();
    Skal({ talk: { onFortsatt, fortsattEtikett: "Fortsätt i chatten" } });
    await omgang("forsta");
    await omgang("svara");
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt i chatten" }));
    expect(onFortsatt).toHaveBeenCalledTimes(1);
    expect(onFortsatt.mock.calls[0][0]).toEqual({
      text: `${SAGT[0]}\n\n${SAGT[1]}`,
      samtal: `Du: ${SAGT[0]}\nAgenten: ${KVITTON[0]}\nDu: ${SAGT[1]}\nAgenten: ${KVITTON[1]}`,
      rader: [
        { hord: SAGT[0], kvitto: KVITTON[0], angrat: false },
        { hord: SAGT[1], kvitto: KVITTON[1], angrat: false },
      ],
    });
    expect(falt()).toBeNull();
  });

  it("⛔ Ärende öppnar skalets Nytt ärende ifyllt, och samtalet står inte i adressen", async () => {
    const arende = vi.fn(({ formId, forifyllt }) => (
      <form id={formId}>
        <input aria-label="Rubrik" defaultValue={forifyllt?.rubrik ?? ""} />
        <textarea aria-label="Beskrivning" defaultValue={forifyllt?.beskrivning ?? ""} />
      </form>
    ));
    Skal({ skapa: { lage: "g1", arende } });
    await omgang("forsta");
    await omgang("svara");
    fireEvent.click(screen.getByRole("button", { name: "Skapa ett ärende av samtalet" }));
    await flush();
    expect(falt()).toBeNull();
    expect(/** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Rubrik" })).value).toBe("Boka rep med bandet");
    expect(/** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Beskrivning" })).value).toBe(`Ta med noterna.\n\n${SAGT[1]}`);
    const u = new URL(window.location.href);
    expect(u.searchParams.get("skapa")).toBe("arende");
    expect(window.location.href).not.toContain("noterna");
  });

  it("⛔ Händelse öppnar skalets Ny händelse med forifyllt till formuläret", async () => {
    /** @type {any[]} */
    const sett = [];
    const Form = (/** @type {any} */ p) => {
      sett.push(p.forifyllt);
      return <form id={p.formId}><input aria-label="Rubrik" defaultValue={p.forifyllt?.rubrik ?? ""} /></form>;
    };
    Skal({ skapa: { lage: "g1", handelse: { form: Form, katalog: null } } });
    await omgang("forsta");
    fireEvent.click(screen.getByRole("button", { name: "Skapa en händelse av samtalet" }));
    await flush();
    expect(falt()).toBeNull();
    expect(sett.at(-1)).toEqual({ rubrik: "Boka rep med bandet", beskrivning: "Ta med noterna." });
    expect(/** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Rubrik" })).value).toBe("Boka rep med bandet");
    expect(new URL(window.location.href).searchParams.get("skapa")).toBe("handelse");
  });

  it("⛔ en ny förifyllning ersätter ett ärende som redan stod öppet", async () => {
    const arende = ({ formId, forifyllt }) => (
      <form id={formId}>
        <input aria-label="Rubrik" defaultValue={forifyllt?.rubrik ?? ""} />
      </form>
    );
    Skal({ skapa: { lage: "g1", arende } });
    // Första gången ifyllt, sedan pratar man igen med panelen öppen och väljer Ärende en gång till.
    await omgang("forsta");
    fireEvent.click(screen.getByRole("button", { name: "Skapa ett ärende av samtalet" }));
    await flush();
    expect(/** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Rubrik" })).value).toBe("Boka rep med bandet");
    await omgang("forsta");
    fireEvent.click(screen.getByRole("button", { name: "Skapa ett ärende av samtalet" }));
    await flush();
    expect(/** @type {HTMLInputElement} */ (screen.getByRole("textbox", { name: "Rubrik" })).value).toBe("Torsdag klockan sju");
  });

  it("⛔ kastar mottagaren står felet i fältet, och samtalet finns kvar", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      Skal({ talk: { onFortsatt: () => { throw new Error("Chatten är inte laddad."); } } });
      await omgang("forsta");
      fireEvent.click(screen.getByRole("button", { name: "Skapa ett meddelande av samtalet" }));
      expect(falt()).not.toBeNull();
      expect(screen.getByRole("alert").textContent).toBe("Chatten är inte laddad.");
      expect(within(samtalsyta()).getByText(SAGT[0], { exact: false })).toBeTruthy();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ ikonerna spärras medan Ångra pågår", async () => {
    /** @type {() => void} */
    let klar = () => {};
    const onFortsatt = vi.fn();
    Skal({ talk: { onFortsatt, onTalk: async () => ({ kvitto: "Inlagt", angra: () => new Promise((a) => { klar = () => a(undefined); }) }) } });
    await omgang("forsta");
    fireEvent.click(screen.getByRole("button", { name: "Ångra" }));
    await flush();
    const ikon = screen.getByRole("button", { name: "Skapa ett meddelande av samtalet" });
    expect(ikon).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(ikon);
    expect(onFortsatt).not.toHaveBeenCalled();
    klar();
    await flush();
  });
});
