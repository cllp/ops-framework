import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsField, OpsInput, OpsTextarea } from "../components/OpsField.jsx";
import { Skrivfalt, texterPa } from "../components/OpsMeddelanden.jsx";
import { PANEL } from "../lib/panellager.js";
import { TALK_MAL } from "../lib/talkfalt.js";

/*
 * Mikrofonen i fältet öppnar skalets TALK (0.232.0, cllp/ops-framework#602).
 *
 * CP 2026-11-16, med en skärmbild från iPhone (en rad i Inkorgen, fältet Not med markören i, tangentbordet uppe): "TALK KOmmer inte upp alls."
 * Bottenraden göms medan tangentbordet är uppe (0.152.0), och telefonens huvud har ingen TALK. CP samma morgon: "När man tryckte på ikonen
 * tidigare i textfältet så visste man iallafall vilket fält som talk hanterade." Beslutet ("Ja kör."): mikrofonen tillbaka i fältet, men den
 * öppnar skalets TALK med fältet som mål, fältet får en ram medan TALK skriver dit, ytan hamnar aldrig under tangentbordet, och det senaste
 * fältet i en öppen panel är målet när bottenradens TALK trycks efter att tangentbordet fällts ned.
 */

function falskInspelare() {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** @param {string[]} meningar */
function falskIgenkanning(meningar) {
  const stoppa = vi.fn();
  for (const m of meningar) stoppa.mockResolvedValueOnce(m);
  stoppa.mockResolvedValue("");
  return { starta: vi.fn(), stoppa, kasta: vi.fn() };
}

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () => act(async () => {});
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));
const faltMik = () => /** @type {HTMLElement | null} */ (document.querySelector("[data-falt-talk]"));
const samtalsrad = () => /** @type {HTMLElement | null} */ (document.querySelector("[data-talk-samtalet]"));

/** @param {any} [extra] */
function skapaTalk(extra = {}) {
  return { onTalk: vi.fn(async () => {}), onAgent: vi.fn(async () => {}), onMeddelande: vi.fn(), inspelare: falskInspelare(), igenkanning: falskIgenkanning(["Ring Anna i morgon"]), ...extra };
}

/** @param {{ talk?: any, barn: import("react").ReactNode }} p */
function Tradet({ talk, barn }) {
  return (
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={talk}>
      {barn}
    </OpsAppShell>
  );
}

/** @param {{ etikett?: string, mangrad?: boolean, typ?: any, start?: string }} p */
function Falt({ etikett = "Not", mangrad = true, typ, start = "Hej världen" }) {
  const [v, setV] = useState(start);
  return (
    <OpsField label={etikett}>
      {mangrad ? <OpsTextarea value={v} onChange={setV} /> : <OpsInput value={v} onChange={setV} type={typ} />}
    </OpsField>
  );
}

/** @param {HTMLTextAreaElement | HTMLInputElement} el @param {number} pos */
function stall(el, pos) {
  el.focus();
  el.setSelectionRange(pos, pos);
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

describe("mikrofonen i fältet (0.232.0)", () => {
  it("⛔ syns medan fältet har fokus, och bara i ett skal med TALK och valen", () => {
    render(<Tradet talk={skapaTalk()} barn={<Falt />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Not"));
    expect(faltMik()).toBeNull();
    act(() => ta.focus());
    expect(faltMik()).not.toBeNull();
    expect(faltMik()?.getAttribute("aria-label")).toBe("Tala in i fältet Not");
    act(() => ta.blur());
    expect(faltMik()).toBeNull();
  });

  it("⛔ utanför ett skal, i ett skal utan valen och i ett e-postfält finns ingen mikrofon", () => {
    const { unmount } = render(<Falt />);
    act(() => /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Not")).focus());
    expect(faltMik()).toBeNull();
    // Utanför ett skal är fältet exakt som förut: inget omslag.
    expect(document.querySelector("[data-falt-omslag]")).toBeNull();
    unmount();

    const { unmount: bort } = render(<Tradet talk={skapaTalk({ onAgent: undefined })} barn={<Falt />} />);
    act(() => /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Not")).focus());
    expect(faltMik()).toBeNull();
    bort();

    render(<Tradet talk={skapaTalk()} barn={<Falt mangrad={false} typ="email" etikett="E-post" start="" />} />);
    act(() => /** @type {HTMLInputElement} */ (screen.getByLabelText("E-post")).focus());
    expect(faltMik()).toBeNull();
  });

  it("⛔ trycket flyttar inte fokus, och klicket startar skalets TALK med fältet som mål, släpper fokus och ramar in fältet", async () => {
    const talk = skapaTalk();
    render(<Tradet talk={talk} barn={<Falt />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Not"));
    act(() => stall(ta, 4));
    const mik = /** @type {HTMLElement} */ (faltMik());
    // `false`: händelsen fick `preventDefault`, så webbläsaren flyttar inte fokus från fältet.
    expect(fireEvent.pointerDown(mik)).toBe(false);
    expect(fireEvent.mouseDown(mik)).toBe(false);
    expect(document.activeElement).toBe(ta);
    fireEvent.click(mik);
    await flush();
    expect(document.activeElement).not.toBe(ta);
    expect(samtalsrad()?.textContent).toContain("Till fältet Not");
    expect(ta.hasAttribute(TALK_MAL)).toBe(true);
    await klar();
    expect(ta.value).toBe("Hej Ring Anna i morgon världen");
    expect(ta.hasAttribute(TALK_MAL)).toBe(false);
    expect(talk.onAgent).not.toHaveBeenCalled();
  });

  it("⛔ fångsten är uttrycklig: ett klick utan tryck före (tangentbordet) når också fältet", async () => {
    render(<Tradet talk={skapaTalk()} barn={<Falt mangrad={false} etikett="Rubrik" start="" />} />);
    const inp = /** @type {HTMLInputElement} */ (screen.getByLabelText("Rubrik"));
    act(() => stall(inp, 0));
    // Tab till knappen: fokus på knappen, ingen `pointerdown`. Den globala fångsten vid trycket ser inget fält här.
    const mik = /** @type {HTMLElement} */ (faltMik());
    fireEvent.keyDown(mik, { key: "Enter" });
    act(() => mik.focus());
    fireEvent.click(mik);
    await flush();
    expect(samtalsrad()?.textContent).toContain("Till fältet Rubrik");
    await klar();
    expect(inp.value).toBe("Ring Anna i morgon");
  });

  it("⛔ Något annat tar bort ramen, och fältet får inget", async () => {
    render(<Tradet talk={skapaTalk()} barn={<Falt />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Not"));
    act(() => stall(ta, 0));
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    expect(ta.hasAttribute(TALK_MAL)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Något annat" }));
    await flush();
    expect(ta.hasAttribute(TALK_MAL)).toBe(false);
  });

  it("⛔ medan en omgång pågår gör mikrofonen ingenting: fältet behåller fokus och får ingen ram", async () => {
    render(<Tradet talk={skapaTalk()} barn={<Falt />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Not"));
    // En omgång utan fält (inget fält har fokus när huvudets TALK trycks).
    fireEvent.pointerDown(huvudMikrofon());
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(document.querySelector("[data-ops-talk]")).not.toBeNull();
    act(() => stall(ta, 0));
    fireEvent.click(/** @type {HTMLElement} */ (faltMik()));
    await flush();
    expect(document.activeElement).toBe(ta);
    expect(ta.hasAttribute(TALK_MAL)).toBe(false);
  });
});

describe("det senaste fältet i en öppen panel (0.232.0)", () => {
  /** @param {{ iPanel: boolean }} p */
  function Yta({ iPanel }) {
    return iPanel ? (
      <div {...{ [PANEL]: "" }}>
        <Falt />
      </div>
    ) : (
      <Falt />
    );
  }

  it("⛔ i en panel: fokus har lämnat fältet, och huvudets TALK skriver ändå där markören stod", async () => {
    render(<Tradet talk={skapaTalk()} barn={<Yta iPanel />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Not"));
    act(() => stall(ta, 4));
    act(() => ta.blur());
    expect(document.activeElement).not.toBe(ta);
    fireEvent.pointerDown(huvudMikrofon());
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(samtalsrad()?.textContent).toContain("Till fältet Not");
    await klar();
    expect(ta.value).toBe("Hej Ring Anna i morgon världen");
  });

  it("⛔ utanför en panel finns ingen reserv: TALK ger menyn, och fältet får inget", async () => {
    render(<Tradet talk={skapaTalk()} barn={<Yta iPanel={false} />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Not"));
    act(() => stall(ta, 4));
    act(() => ta.blur());
    fireEvent.pointerDown(huvudMikrofon());
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(samtalsrad()).toBeNull();
    await klar();
    expect(ta.value).toBe("Hej världen");
  });
});

describe("TALK:s yta under tangentbordet (0.232.0)", () => {
  /** @type {any} */
  let forut;
  beforeEach(() => {
    forut = Object.getOwnPropertyDescriptor(window, "visualViewport");
  });
  afterEach(() => {
    if (forut) Object.defineProperty(window, "visualViewport", forut);
    else delete (/** @type {any} */ (window)).visualViewport;
  });

  it("⛔ ytan lyfts med det som tangentbordet täcker, och står kvar utan tangentbord", async () => {
    const hojd = window.innerHeight;
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { height: hojd - 300, offsetTop: 0, scale: 1, addEventListener() {}, removeEventListener() {} },
    });
    render(<Tradet talk={skapaTalk()} barn={<Falt />} />);
    fireEvent.pointerDown(huvudMikrofon());
    fireEvent.click(huvudMikrofon());
    await flush();
    const yta = /** @type {HTMLElement} */ (document.querySelector("[data-ops-talk]"));
    expect(yta.style.getPropertyValue("--talk-tangentbord")).toBe("300px");
    expect(yta.className).toContain("var(--talk-tangentbord,0px)");
  });

  it("utan tangentbord är talet noll", async () => {
    render(<Tradet talk={skapaTalk()} barn={<Falt />} />);
    fireEvent.pointerDown(huvudMikrofon());
    fireEvent.click(huvudMikrofon());
    await flush();
    const yta = /** @type {HTMLElement} */ (document.querySelector("[data-ops-talk]"));
    expect(yta.style.getPropertyValue("--talk-tangentbord")).toBe("0px");
  });
});

describe("chattens skrivfält (0.232.0)", () => {
  function Chatt() {
    const [text, setText] = useState("");
    return <Skrivfalt text={text} setText={setText} skickar={false} onSkicka={() => {}} texter={texterPa("sv", {})} />;
  }

  it("⛔ i skalet står mikrofonen i pillret medan det har fokus, och skriver in där", async () => {
    render(<Tradet talk={skapaTalk()} barn={<Chatt />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox"));
    expect(faltMik()).toBeNull();
    act(() => ta.focus());
    const mik = /** @type {HTMLElement} */ (faltMik());
    expect(mik.closest("[data-skrivruta]")).not.toBeNull();
    fireEvent.click(mik);
    await flush();
    expect(ta.hasAttribute(TALK_MAL)).toBe(true);
    await klar();
    expect(ta.value).toBe("Ring Anna i morgon");
  });

  it("⛔ utan skal (gästens chatt) finns ingen mikrofon", () => {
    render(<Chatt />);
    act(() => /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox")).focus());
    expect(faltMik()).toBeNull();
  });
});
