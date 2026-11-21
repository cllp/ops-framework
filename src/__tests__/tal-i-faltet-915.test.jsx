import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsMeddelanden, Skrivfalt, texterPa } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { TALK_MAL } from "../lib/talkfalt.js";

/*
 * Det sagda i fältet (0.252.0, cllp/lifehub.app#915).
 *
 * CP 2026-11-20 i telefonen, i samtalet med agenten: "Via Fråga agenten gick det inte att prata in, ingen ljudvåg syntes i textfältet." Mätt i
 * en byggd app 2026-11-21: mikrofonen i fältet fanns och startade skalets TALK, men TALK:s yta lade sig över skrivfältet, så ljudvågen och texten
 * stod i ytan och fältet syntes inte förrän Klar. Beslutet (CP 2026-11-21 00.05, "Ja kör. Fullt ut"): i samtalet med agenten står det sagda i
 * fältet med ljudvåg medan man pratar, och personen trycker Skicka själv.
 *
 * ⛔ PROVEN GÅR GENOM SKALET med en falsk igenkänning, så att det är skalets omgång som visas i fältet: samma `useTalk` och samma igenkänning
 * som TALK, ingen andra röst (0.230.0:s skäl). De som säger att något INTE finns (ingen yta, inget skickat) står bredvid ett prov som ser
 * motsatsen, så att de inte är gröna för att ingenting ritades.
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

/**
 * En igenkänning som ger texten medan man pratar (`onText`) och den slutliga vid stopp. `prata(text)` låter som att personen sagt det.
 * @param {string} slutlig @param {{ fel?: string }} [val]
 */
function falskIgenkanning(slutlig, val = {}) {
  /** @type {((t: string) => void) | null} */
  let onText = null;
  const g = {
    starta: vi.fn((/** @type {{ onText: (t: string) => void, onFel?: (k: string) => void }} */ a) => {
      onText = a.onText;
      if (val.fel) a.onFel?.(val.fel);
    }),
    stoppa: vi.fn(() => Promise.resolve(slutlig)),
    kasta: vi.fn(),
    prata: (/** @type {string} */ t) => act(() => onText?.(t)),
  };
  return g;
}

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () => act(async () => {});
const yta = () => document.querySelector("[data-ops-talk]");
const faltMik = () => /** @type {HTMLElement | null} */ (document.querySelector("[data-falt-talk]"));
const diktering = () => document.querySelector("[data-diktering]");
const skicka = () => screen.queryByRole("button", { name: "Skicka" });

/** @param {any} [extra] */
function skapaTalk(extra = {}) {
  return { onTalk: vi.fn(async () => {}), onAgent: vi.fn(async () => {}), onMeddelande: vi.fn(), inspelare: falskInspelare(), igenkanning: falskIgenkanning("Ring Anna i morgon"), ...extra };
}

/** @param {{ talk: any, barn: import("react").ReactNode }} p */
function Tradet({ talk, barn }) {
  return (
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={talk}>
      {barn}
    </OpsAppShell>
  );
}

/** @param {{ talIFaltet?: boolean, onSkicka?: () => void }} p */
function Chatt({ talIFaltet = false, onSkicka = () => {} }) {
  const [text, setText] = useState("");
  return <Skrivfalt text={text} setText={setText} skickar={false} onSkicka={onSkicka} texter={texterPa("sv", {})} platstext="Fråga agenten" talIFaltet={talIFaltet} />;
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("skrivfältet med talIFaltet (0.252.0)", () => {
  it("⛔ mikrofonen visar omgången i fältet: ljudvågen och texten medan man pratar, ingen TALK-yta, och Klar står där Skicka stod", async () => {
    const talk = skapaTalk();
    render(<Tradet talk={talk} barn={<Chatt talIFaltet />} />);
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    expect(yta()).toBeNull();
    expect(diktering()?.getAttribute("data-diktering")).toBe("lyssnar");
    expect(document.querySelector("[data-diktering-vag] [data-talk-prickar]")).not.toBeNull();
    expect(skicka()).toBeNull();
    expect(faltMik()).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Lyssnar");
    expect(diktering()?.textContent).toContain("Prata, så syns texten här");
    await talk.igenkanning.prata("Ring Anna");
    expect(document.querySelector("[data-diktering-text]")?.textContent).toBe("Ring Anna");
    // Samma omgång som TALK: skalets igenkänning lyssnar, och fältet är omgångens mål.
    expect(talk.igenkanning.starta).toHaveBeenCalledTimes(1);
    expect(/** @type {HTMLTextAreaElement} */ (document.querySelector("[data-skrivfalt] textarea")).hasAttribute(TALK_MAL)).toBe(true);
  });

  it("⛔ Klar skriver in det sagda i fältet, och ingenting skickas: personen trycker Skicka själv", async () => {
    const talk = skapaTalk();
    const onSkicka = vi.fn();
    render(<Tradet talk={talk} barn={<Chatt talIFaltet onSkicka={onSkicka} />} />);
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    await talk.igenkanning.prata("Ring Anna");
    fireEvent.click(screen.getByRole("button", { name: "Klar, skriv in i fältet" }));
    await flush();
    await flush();
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox"));
    expect(ta.value).toBe("Ring Anna i morgon");
    expect(diktering()).toBeNull();
    expect(yta()).toBeNull();
    expect(onSkicka).not.toHaveBeenCalled();
    expect(talk.onAgent).not.toHaveBeenCalled();
    expect(skicka()).not.toBeNull();
    expect(/** @type {HTMLButtonElement} */ (skicka()).disabled).toBe(false);
    expect(faltMik()).not.toBeNull();
  });

  it("⛔ Avbryt slänger det sagda: fältet är tomt, och ingen yta öppnas", async () => {
    const talk = skapaTalk();
    render(<Tradet talk={talk} barn={<Chatt talIFaltet />} />);
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    await talk.igenkanning.prata("Ring Anna");
    fireEvent.click(screen.getByRole("button", { name: "Avbryt talet" }));
    await flush();
    expect(diktering()).toBeNull();
    expect(yta()).toBeNull();
    expect(/** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox")).value).toBe("");
  });

  it("⛔ utan talIFaltet öppnar mikrofonen TALK:s yta som förut, och fältet visar ingenting", async () => {
    render(<Tradet talk={skapaTalk()} barn={<Chatt />} />);
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    expect(yta()).not.toBeNull();
    expect(diktering()).toBeNull();
  });

  it("⛔ igenkänningens fel sägs i fältet, aldrig tyst", async () => {
    const talk = skapaTalk({ igenkanning: falskIgenkanning("", { fel: "network" }) });
    render(<Tradet talk={talk} barn={<Chatt talIFaltet />} />);
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    const fel = document.querySelector("[data-diktering-fel]");
    expect(fel?.getAttribute("role")).toBe("alert");
    expect((fel?.textContent ?? "").trim()).not.toBe("");
  });

  it("⛔ avmonteras fältet mitt i omgången tar TALK:s yta över med det som sagts, så att inget lyssnar osynligt", async () => {
    const talk = skapaTalk();
    function Vaxlar() {
      const [visa, setVisa] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setVisa(false)}>
            Göm
          </button>
          {visa ? <Chatt talIFaltet /> : null}
        </>
      );
    }
    render(<Tradet talk={talk} barn={<Vaxlar />} />);
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    await talk.igenkanning.prata("Ring Anna");
    expect(yta()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Göm" }));
    await flush();
    expect(yta()).not.toBeNull();
    expect(yta()?.textContent).toContain("Ring Anna");
  });

  it("⛔ utan text medan man pratar (ingen igenkänning) öppnas ytan, som har vägen för utskriften", async () => {
    const talk = skapaTalk({ igenkanning: false });
    render(<Tradet talk={talk} barn={<Chatt talIFaltet />} />);
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    expect(yta()).not.toBeNull();
    expect(diktering()).toBeNull();
  });
});

describe("OpsMeddelanden talIFaltet (0.252.0)", () => {
  const MEDLEMMAR = [
    { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
    { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
    { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
  ];

  async function underlag() {
    let t = Date.now() - 60000;
    const samtal = createSamtalskalla({ kalla: createMemorySource({}), klocka: () => (t += 1000) });
    const agent = await samtal.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
    const privat = await samtal.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
    return { samtal, agent, privat };
  }

  /** @param {{ samtal: any, valt: string, talIFaltet?: any }} p */
  function Vy({ samtal, valt, talIFaltet }) {
    return (
      <Tradet
        talk={skapaTalk()}
        barn={<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={valt} onValj={() => {}} talIFaltet={talIFaltet} />}
      />
    );
  }

  it("⛔ i ett samtal med agenten visas det sagda i fältet", async () => {
    const { samtal, agent } = await underlag();
    render(<Vy samtal={samtal} valt={agent.id} talIFaltet={["agent"]} />);
    await waitFor(() => expect(faltMik()).not.toBeNull());
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    expect(diktering()).not.toBeNull();
    expect(yta()).toBeNull();
  });

  it("⛔ i ett samtal med en människa öppnar mikrofonen ytan, när bara agenten står i listan", async () => {
    const { samtal, privat } = await underlag();
    render(<Vy samtal={samtal} valt={privat.id} talIFaltet={["agent"]} />);
    await waitFor(() => expect(faltMik()).not.toBeNull());
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    expect(diktering()).toBeNull();
    expect(yta()).not.toBeNull();
  });

  it("⛔ ett okänt slag eller fel typ kastar, i stället för att mikrofonen tyst öppnar ytan", async () => {
    const { samtal, agent } = await underlag();
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" medlemmar={MEDLEMMAR} valt={agent.id} talIFaltet={["agen"]} />)).toThrow(/talIFaltet känner inte igen "agen"/);
    expect(() => render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" medlemmar={MEDLEMMAR} valt={agent.id} talIFaltet={"agent"} />)).toThrow(/talIFaltet ska vara en lista/);
    fel.mockRestore();
  });
});
