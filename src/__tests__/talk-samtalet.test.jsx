import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";

/*
 * TALK i ett pågående samtal (0.226.0, cllp/ops-framework#592).
 *
 * CP 2026-11-14 08.37: "Om jag väljer Agent kommer jag till chatten. Om jag trycker på TALK igen kommer samma meny upp. Jag funderar
 * på om man ska komma ihåg att jag har ett pågående samtal, så att det finns en Fortsätt-knapp." Beslutet samma morgon: "Jag går på
 * Fables rekommendation." I en öppen tråd ingen meny: fältet säger vart det går, Klar lämnar det dit, och Något annat ger menyn. Efter
 * att man lämnat tråden står "Fortsätt med {namn}" först i menyn.
 *
 * ⛔ PROVEN GÅR GENOM SKALET, så att vägen från appens `talk.samtalet` till fältet och tillbaka till `onText` provas, som i `talk-val`.
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
const SAGT = ["Hur långt är det till Visby?", "Och färjan i morgon?"];
/** Valen som står, med sina nycklar. */
const valnycklar = () => [...document.querySelectorAll("[data-talk-valt]")].map((k) => k.getAttribute("data-talk-valt"));

/**
 * ⛔ MENYN SÅGS ALDRIG: en vakt över hela dokumentet som minns om valen (`data-talk-val`) någon gång ritades, också en ritning som
 * en effekt strax tog bort. Ett prov som bara tittar efter Klar hade varit grönt genom en meny som blinkade förbi.
 */
function menyvakt() {
  let sedd = false;
  // ⛔ POSTERNA LÄSES, INTE DOKUMENTET: en meny som ritas och tas bort i samma flush är borta när återanropet körs (mätt: första versionen
  // läste `document` och var grön genom en meny som ritades i varje omgång).
  const mo = new MutationObserver((poster) => {
    for (const p of poster) {
      for (const n of p.addedNodes) {
        if (n instanceof Element && (n.matches("[data-talk-val]") || n.querySelector("[data-talk-val]"))) sedd = true;
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  return {
    sedd: () => sedd || Boolean(document.querySelector("[data-talk-val]")),
    sluta: () => mo.disconnect(),
  };
}

/** @param {{ talk?: any, sprak?: string, igenkanning?: any }} [val] */
function Skal({ talk = {}, sprak, igenkanning } = {}) {
  const onTalk = vi.fn(async () => {});
  const t = { onTalk, inspelare: falskInspelare(), igenkanning: igenkanning ?? falskIgenkanning(SAGT), ...talk };
  const skal = (
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t}>
      <p>innehåll</p>
    </OpsAppShell>
  );
  render(sprak ? <OpsSprakProvider sprak={sprak}>{skal}</OpsSprakProvider> : skal);
  return t;
}

async function borjaPrata() {
  fireEvent.click(huvudMikrofon());
  await flush();
}

async function klar() {
  fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
  await flush();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("TALK i en öppen tråd (samtalet.direkt)", () => {
  it("⛔ fältet säger vart det går medan man pratar, Klar lämnar texten till onText, och menyn ritas aldrig", async () => {
    const onAgent = vi.fn(async () => {});
    const onText = vi.fn(async () => {});
    const vakt = menyvakt();
    try {
      const t = Skal({ talk: { onAgent, onMeddelande: vi.fn(), samtalet: { namn: "Hugo", direkt: true, onText } } });
      await borjaPrata();
      const rad = /** @type {HTMLElement} */ (document.querySelector("[data-talk-samtalet]"));
      expect(rad).not.toBeNull();
      expect(rad.textContent).toContain("Till Hugo");
      expect(within(rad).getByRole("button", { name: "Något annat" }).hasAttribute("data-talk-nagot-annat")).toBe(true);
      await klar();
      expect(onText).toHaveBeenCalledTimes(1);
      expect(onText).toHaveBeenCalledWith(SAGT[0]);
      expect(onAgent).not.toHaveBeenCalled();
      expect(t.onTalk).not.toHaveBeenCalled();
      expect(vakt.sedd()).toBe(false);
      // Appen tog emot det i tråden: fältet har inget mer att visa.
      expect(falt()).toBeNull();
    } finally {
      vakt.sluta();
    }
  });

  it("appens etikett står i stället för Till {namn}, och orden följer språket", async () => {
    Skal({ sprak: "en", talk: { onAgent: vi.fn(), samtalet: { namn: "Hugo", direkt: true, etikett: "To Hugo, travel", onText: vi.fn() } } });
    await borjaPrata();
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-talk-samtalet]"));
    expect(rad.textContent).toContain("To Hugo, travel");
    expect(within(rad).getByRole("button", { name: "Something else" })).toBeTruthy();
  });

  it("⛔ Något annat: Klar ger menyn med samtalet först och fokus där, och onText anropas först när man trycker det", async () => {
    const onText = vi.fn(async () => {});
    Skal({ talk: { onAgent: vi.fn(), onMeddelande: vi.fn(), samtalet: { namn: "Hugo", direkt: true, onText } } });
    await borjaPrata();
    fireEvent.click(screen.getByRole("button", { name: "Något annat" }));
    await flush();
    // Raden säger inte längre att det går till Hugo: det gör det inte. Fokus går till Klar, inte till sidans topp.
    expect(document.querySelector("[data-talk-samtalet]")).toBeNull();
    expect(document.activeElement).toBe(document.querySelector("[data-talk-skicka]"));
    await klar();
    expect(onText).not.toHaveBeenCalled();
    expect(/** @type {HTMLElement} */ (falt()).getAttribute("data-lage")).toBe("hort");
    expect(valnycklar()).toEqual(["samtalet", "meddelande", "agent"]);
    const fortsatt = /** @type {HTMLElement} */ (document.querySelector('[data-talk-valt="samtalet"]'));
    expect(fortsatt.textContent).toBe("Fortsätt med Hugo");
    expect(document.activeElement).toBe(fortsatt);
    fireEvent.click(fortsatt);
    await flush();
    expect(onText).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledWith(SAGT[0]);
    expect(falt()).toBeNull();
  });

  it("⛔ Något annat gäller en omgång: nästa omgång börjar i direktläget igen", async () => {
    const onText = vi.fn(async () => {});
    Skal({ talk: { onAgent: vi.fn(), samtalet: { namn: "Hugo", direkt: true, onText } } });
    await borjaPrata();
    fireEvent.click(screen.getByRole("button", { name: "Något annat" }));
    await klar();
    fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
    await flush();
    expect(falt()).toBeNull();
    await borjaPrata();
    expect(document.querySelector("[data-talk-samtalet]")).not.toBeNull();
    await klar();
    expect(onText).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledWith(SAGT[1]);
  });

  it("⛔ avvisar onText står menyn med felet och texten, ingenting skickas igen av sig självt, och samtalet försöker igen", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onText = vi.fn().mockRejectedValueOnce(new Error("Tråden gick inte att nå.")).mockResolvedValue(undefined);
      Skal({ talk: { onAgent: vi.fn(), samtalet: { namn: "Hugo", direkt: true, onText } } });
      await borjaPrata();
      await klar();
      const dialog = /** @type {HTMLElement} */ (falt());
      expect(dialog.getAttribute("data-lage")).toBe("hort");
      expect(/** @type {HTMLElement} */ (dialog.querySelector("[data-talk-valfel]")).textContent).toBe("Tråden gick inte att nå.");
      expect(within(dialog).getByText(SAGT[0])).toBeTruthy();
      expect(dialog.querySelector("[data-talk-val]")).not.toBeNull();
      expect(valnycklar()[0]).toBe("samtalet");
      await flush();
      expect(onText).toHaveBeenCalledTimes(1);
      fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('[data-talk-valt="samtalet"]')));
      await flush();
      expect(onText).toHaveBeenCalledTimes(2);
      expect(onText).toHaveBeenLastCalledWith(SAGT[0]);
      expect(falt()).toBeNull();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ utan text väntar samtalet på utskriften och lämnar den, utan att menyn ritas", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    const vakt = menyvakt();
    try {
      /** @type {(t: string) => void} */
      let svara = () => {};
      const tillText = vi.fn(() => new Promise((res) => { svara = res; }));
      const onText = vi.fn(async () => {});
      Skal({ igenkanning: falskIgenkanning([""]), talk: { onAgent: vi.fn(), tillText, samtalet: { namn: "Hugo", direkt: true, onText } } });
      await borjaPrata();
      await klar();
      expect(tillText).toHaveBeenCalledTimes(1);
      expect(onText).not.toHaveBeenCalled();
      expect(/** @type {HTMLElement} */ (document.querySelector("[data-talk-status]")).getAttribute("data-talk-status")).toBe("utskrift");
      await act(async () => svara("Utskrivet ur ljudet"));
      await flush();
      expect(onText).toHaveBeenCalledWith("Utskrivet ur ljudet");
      expect(vakt.sedd()).toBe(false);
    } finally {
      vakt.sluta();
      konsol.mockRestore();
    }
  });
});

describe("Fortsätt med samtalet efter att man lämnat tråden (samtalet.direkt false)", () => {
  it("⛔ menyn har Fortsätt med {namn} först, primärt och med fokus, och ett tryck lämnar texten till onText", async () => {
    const onAgent = vi.fn();
    const onText = vi.fn(async () => {});
    Skal({ talk: { onAgent, onMeddelande: vi.fn(), samtalet: { namn: "Hugo", direkt: false, onText } } });
    await borjaPrata();
    // Ingen rad medan man pratar: det sagda går ingenstans förrän personen väljer.
    expect(document.querySelector("[data-talk-samtalet]")).toBeNull();
    await klar();
    expect(onText).not.toHaveBeenCalled();
    expect(valnycklar()).toEqual(["samtalet", "meddelande", "agent"]);
    const fortsatt = /** @type {HTMLElement} */ (document.querySelector('[data-talk-valt="samtalet"]'));
    expect(fortsatt.textContent).toBe("Fortsätt med Hugo");
    expect(fortsatt.className).toContain("col-span-2");
    expect(fortsatt.className).toContain("bg-accent");
    expect(document.activeElement).toBe(fortsatt);
    fireEvent.click(fortsatt);
    await flush();
    expect(onText).toHaveBeenCalledWith(SAGT[0]);
    expect(onAgent).not.toHaveBeenCalled();
    expect(falt()).toBeNull();
  });

  it("utan samtalet finns valet inte, och fokus står på första valet som förut", async () => {
    Skal({ talk: { onAgent: vi.fn(), onMeddelande: vi.fn() } });
    await borjaPrata();
    await klar();
    expect(valnycklar()).toEqual(["meddelande", "agent"]);
    expect(document.activeElement).toBe(document.querySelector('[data-talk-valt="meddelande"]'));
  });

  it("på engelska heter valet Continue with {namn}", async () => {
    Skal({ sprak: "en", talk: { onAgent: vi.fn(), samtalet: { namn: "Hugo", direkt: false, onText: vi.fn() } } });
    await borjaPrata();
    await klar();
    expect(/** @type {HTMLElement} */ (document.querySelector('[data-talk-valt="samtalet"]')).textContent).toBe("Continue with Hugo");
  });
});

describe("samtalet utan valen, och fel form", () => {
  it("⛔ utan onAgent påverkar samtalet ingenting: ljudet går till onTalk och onText anropas aldrig", async () => {
    const onText = vi.fn();
    const t = Skal({ talk: { samtalet: { namn: "Hugo", direkt: true, onText } } });
    await borjaPrata();
    expect(document.querySelector("[data-talk-samtalet]")).toBeNull();
    await klar();
    expect(t.onTalk).toHaveBeenCalledTimes(1);
    expect(onText).not.toHaveBeenCalled();
    expect(document.querySelector("[data-talk-val]")).toBeNull();
  });

  it("⛔ en felformad samtalet kastar vid uppstart, på svenska", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => Skal({ talk: { onAgent: vi.fn(), samtalet: { namn: "", direkt: "ja", onText: "nej" } } })).toThrow(/samtalet.*namn ska vara en sträng som inte är tom, direkt ska vara true eller false, fick string, onText ska vara en funktion/);
    } finally {
      konsol.mockRestore();
    }
  });
});
