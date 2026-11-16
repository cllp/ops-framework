import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { OpsField, OpsInput, OpsTextarea } from "../components/OpsField.jsx";
import { Skrivfalt, texterPa } from "../components/OpsMeddelanden.jsx";
import { fangaTalkfalt, lyssnaPaTryck, tagFangst } from "../lib/talkfalt.js";

/*
 * TALK till fältet där markören står (0.230.0, cllp/ops-framework#602).
 *
 * CP 2026-11-15, Sentry JAVASCRIPT-REACT-2Y: chattens mikrofon föll med "Den här webbläsaren kan inte spela in ljud." medan TALK-knappen på
 * samma enhet fungerade. Beslutet: en röstknapp, och den är TALK. Står markören i ett textfält när man trycker på TALK går talet dit,
 * utan meny, och ingenting skickas av sig självt.
 *
 * ⛔ PROVEN GÅR GENOM SKALET (`OpsAppShell`), som talk-samtalet: båda TALK-knapparna i skalet startar med ett klick, och fångsten av fältet
 * sker vid trycket (`pointerdown`), före fokusbytet. `tryck` gör det en riktig webbläsare gör: pointerdown, fokus flyttas till knappen,
 * sedan klick. Ett prov som bara klickar hade aldrig sett markören, för den är borta när klicket kommer.
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
const SAGT = ["Hur långt är det till Visby?", "Och färjan i morgon?"];
const meny = () => document.querySelector("[data-talk-val]");

/** Ett tryck som i en webbläsare: pointerdown, fokus till knappen, klick. @param {HTMLElement} knapp */
async function tryck(knapp) {
  fireEvent.pointerDown(knapp);
  knapp.focus();
  fireEvent.click(knapp);
  await flush();
}

async function klar() {
  fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
  await flush();
}

/** @param {{ talk?: any, sprak?: string, barn: import("react").ReactNode }} p */
function Tradet({ talk, sprak, barn }) {
  const skal = (
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={talk}>
      {barn}
    </OpsAppShell>
  );
  return sprak ? <OpsSprakProvider sprak={sprak}>{skal}</OpsSprakProvider> : skal;
}

/** @param {any} [extra] */
function skapaTalk(extra = {}) {
  return { onTalk: vi.fn(async () => {}), onAgent: vi.fn(async () => {}), onMeddelande: vi.fn(), inspelare: falskInspelare(), igenkanning: falskIgenkanning(SAGT), ...extra };
}

/** @param {{ typ?: any, readOnly?: boolean, mangrad?: boolean, start?: string, etikett?: string, maxLength?: number }} p */
function Falt({ typ, readOnly, mangrad = true, start = "Hej världen", etikett = "Beskrivning", maxLength }) {
  const [v, setV] = useState(start);
  return (
    <OpsField label={etikett}>
      {mangrad ? <OpsTextarea value={v} onChange={setV} maxLength={maxLength} /> : <OpsInput value={v} onChange={setV} type={typ} readOnly={readOnly} maxLength={maxLength} />}
    </OpsField>
  );
}

/** Fältet med markören mitt i, som en person som tryckt där. @param {HTMLTextAreaElement | HTMLInputElement} el @param {number} start @param {number} [slut] */
function stall(el, start, slut = start) {
  el.focus();
  try {
    el.setSelectionRange(start, slut);
  } catch {
    // email, number och liknande typer bär ingen markör i webbläsaren, och jsdom kastar: fältet har fokus, och det är det som provas.
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("TALK till fältet där markören står", () => {
  it("⛔ markören i ett textfält: raden säger vilket, Klar skriver in det sagda där markören stod, utan meny, och ingenting skickas", async () => {
    const talk = skapaTalk();
    render(<Tradet talk={talk} barn={<Falt />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning"));
    stall(ta, 4);
    await tryck(huvudMikrofon());
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-talk-samtalet]"));
    expect(rad.textContent).toContain("Till fältet Beskrivning");
    expect(within(rad).getByRole("button", { name: "Något annat" })).toBeTruthy();
    await klar();
    expect(ta.value).toBe("Hej Hur långt är det till Visby? världen");
    // Ingenting lämnade fältet av sig självt, och ingen meny ritades.
    expect(talk.onAgent).not.toHaveBeenCalled();
    expect(talk.onMeddelande).not.toHaveBeenCalled();
    expect(talk.onTalk).not.toHaveBeenCalled();
    expect(meny()).toBeNull();
    expect(screen.queryByRole("dialog", { name: "TALK" })).toBeNull();
  });

  it("markeringen ersätts, och ett fält på en rad får det sagda på en rad", async () => {
    render(<Tradet talk={skapaTalk({ igenkanning: falskIgenkanning(["första raden\nandra raden"]) })} barn={<Falt mangrad={false} etikett="Rubrik" start="En gammal rubrik" />} />);
    const inp = /** @type {HTMLInputElement} */ (screen.getByLabelText("Rubrik"));
    stall(inp, 3, 9);
    await tryck(huvudMikrofon());
    expect(/** @type {HTMLElement} */ (document.querySelector("[data-talk-samtalet]")).textContent).toContain("Till fältet Rubrik");
    await klar();
    expect(inp.value).toBe("En första raden andra raden rubrik");
  });

  it("⛔ en etikett som inte är text ger fältets ariaLabel, aldrig [object Object] (granskningen av 0.230.0)", async () => {
    function JsxFalt() {
      const [v, setV] = useState("");
      return (
        <OpsField label={<span>Rubrik i fetstil</span>}>
          <OpsTextarea value={v} onChange={setV} ariaLabel="Anteckningen" />
        </OpsField>
      );
    }
    render(<Tradet talk={skapaTalk()} barn={<JsxFalt />} />);
    stall(/** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Anteckningen")), 0);
    await tryck(huvudMikrofon());
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-talk-samtalet]")).textContent ?? "";
    expect(rad).toContain("Till fältet Anteckningen");
    expect(rad).not.toContain("object");
  });

  it("raden och namnet följer språket", async () => {
    render(<Tradet sprak="en" talk={skapaTalk()} barn={<Falt etikett="Description" />} />);
    stall(/** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Description")), 0);
    await tryck(huvudMikrofon());
    expect(/** @type {HTMLElement} */ (document.querySelector("[data-talk-samtalet]")).textContent).toContain("To the field Description");
  });

  it("⛔ utan fält som markören står i kommer menyn som förut: fokus utanför fälten, och tangentbordsaktivering (inget tryck) ger inget fält", async () => {
    const talk = skapaTalk();
    render(<Tradet talk={talk} barn={<Falt />} />);
    // Fokus på sidan, inte i ett fält: ett tryck på knappen.
    await tryck(huvudMikrofon());
    expect(document.querySelector("[data-talk-samtalet]")).toBeNull();
    await klar();
    expect(meny()).not.toBeNull();
    expect(talk.onAgent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
    await flush();
    // Markören i fältet, men knappen aktiveras med tangenten: Enter på knappen har fokus på knappen och ger inget fält.
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning"));
    stall(ta, 2);
    fireEvent.pointerDown(ta);
    fireEvent.keyDown(huvudMikrofon(), { key: "Enter" });
    huvudMikrofon().focus();
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(document.querySelector("[data-talk-samtalet]")).toBeNull();
    await klar();
    expect(meny()).not.toBeNull();
    expect(ta.value).toBe("Hej världen");
  });

  it("⛔ fältet gäller bara omgången som trycket startade: nästa omgång utan fält ger menyn", async () => {
    render(<Tradet talk={skapaTalk()} barn={<Falt />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning"));
    stall(ta, 11);
    await tryck(huvudMikrofon());
    await klar();
    expect(ta.value).toBe("Hej världen Hur långt är det till Visby?");
    ta.blur();
    await tryck(huvudMikrofon());
    expect(document.querySelector("[data-talk-samtalet]")).toBeNull();
    await klar();
    expect(meny()).not.toBeNull();
    expect(ta.value).toBe("Hej världen Hur långt är det till Visby?");
  });

  it("⛔ fältet går före appens samtalet: det man står i vinner, och utan fält gäller samtalet som förut", async () => {
    const onText = vi.fn(async () => {});
    const talk = skapaTalk({ samtalet: { namn: "Hugo", direkt: true, onText } });
    render(<Tradet talk={talk} barn={<Falt />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning"));
    stall(ta, 0);
    await tryck(huvudMikrofon());
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-talk-samtalet]"));
    expect(rad.textContent).toContain("Till fältet Beskrivning");
    expect(rad.textContent).not.toContain("Till Hugo");
    await klar();
    expect(onText).not.toHaveBeenCalled();
    expect(ta.value).toBe("Hur långt är det till Visby? Hej världen");
    // Nästa omgång står ingen i ett fält: appens samtal.
    ta.blur();
    await tryck(huvudMikrofon());
    expect(/** @type {HTMLElement} */ (document.querySelector("[data-talk-samtalet]")).textContent).toContain("Till Hugo");
    await klar();
    expect(onText).toHaveBeenCalledWith(SAGT[1]);
  });

  it("⛔ Något annat ger menyn som idag, med appens samtal först, och ingenting skrivs i fältet", async () => {
    const onText = vi.fn(async () => {});
    const talk = skapaTalk({ samtalet: { namn: "Hugo", direkt: true, onText } });
    render(<Tradet talk={talk} barn={<Falt />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning"));
    stall(ta, 0);
    await tryck(huvudMikrofon());
    fireEvent.click(screen.getByRole("button", { name: "Något annat" }));
    await klar();
    expect(meny()).not.toBeNull();
    expect(ta.value).toBe("Hej världen");
    const nycklar = [...document.querySelectorAll("[data-talk-valt]")].map((k) => k.getAttribute("data-talk-valt"));
    expect(nycklar[0]).toBe("samtalet");
    expect(document.querySelector('[data-talk-valt="samtalet"]')?.textContent).toBe("Fortsätt med Hugo");
  });

  it("⛔ ett fält utan valen (appen gav ingen onAgent) får ingen fångst: TALK är som förut", async () => {
    const talk = { onTalk: vi.fn(async () => {}), inspelare: falskInspelare(), igenkanning: falskIgenkanning(SAGT) };
    render(<Tradet talk={talk} barn={<Falt />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning"));
    stall(ta, 0);
    await tryck(huvudMikrofon());
    expect(document.querySelector("[data-talk-samtalet]")).toBeNull();
    await klar();
    expect(ta.value).toBe("Hej världen");
  });

  it("⛔ e-post och lösenord fångas inte: TALK ger menyn", async () => {
    for (const typ of /** @type {const} */ (["email", "password", "number", "search", "tel", "url"])) {
      const { unmount } = render(<Tradet talk={skapaTalk()} barn={<Falt mangrad={false} typ={typ} start="" etikett="Adress" />} />);
      const inp = /** @type {HTMLInputElement} */ (screen.getByLabelText("Adress"));
      stall(inp, 0);
      await tryck(huvudMikrofon());
      expect(document.querySelector("[data-talk-samtalet]"), typ).toBeNull();
      await klar();
      expect(meny(), typ).not.toBeNull();
      expect(inp.value).toBe("");
      unmount();
      cleanup();
    }
  });

  it("⛔ ett skrivskyddat fält fångas inte", async () => {
    render(<Tradet talk={skapaTalk()} barn={<Falt mangrad={false} readOnly etikett="Namn" />} />);
    const inp = /** @type {HTMLInputElement} */ (screen.getByLabelText("Namn"));
    stall(inp, 0);
    await tryck(huvudMikrofon());
    expect(document.querySelector("[data-talk-samtalet]")).toBeNull();
    await klar();
    expect(meny()).not.toBeNull();
    expect(inp.value).toBe("Hej världen");
  });

  it("⛔ fältet försvann medan man pratade: felet står med svensk text, menyn står kvar med texten, och ingenting skrevs", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const talk = skapaTalk();
      const r = render(<Tradet talk={talk} barn={<Falt />} />);
      stall(/** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning")), 0);
      await tryck(huvudMikrofon());
      // Sidan byter vy medan man pratar: fältet avmonteras.
      r.rerender(<Tradet talk={talk} barn={<p>Annan vy</p>} />);
      await flush();
      await klar();
      const dialog = /** @type {HTMLElement} */ (screen.getByRole("dialog", { name: "TALK" }));
      expect(dialog.getAttribute("data-lage")).toBe("hort");
      expect(/** @type {HTMLElement} */ (dialog.querySelector("[data-talk-valfel]")).textContent).toBe("Fältet finns inte längre, eller går inte att skriva i. Det du sa finns kvar här.");
      expect(within(dialog).getByText(SAGT[0])).toBeTruthy();
      expect(dialog.querySelector("[data-talk-val]")).not.toBeNull();
      expect(talk.onAgent).not.toHaveBeenCalled();
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ fältet blev skrivskyddat medan man pratade: samma fel, och texten står kvar i menyn", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const talk = skapaTalk();
      /** @param {{ las: boolean }} p */
      const Sida = ({ las }) => <Falt mangrad={false} readOnly={las} etikett="Titel" />;
      const r = render(<Tradet talk={talk} barn={<Sida las={false} />} />);
      stall(/** @type {HTMLInputElement} */ (screen.getByLabelText("Titel")), 0);
      await tryck(huvudMikrofon());
      r.rerender(<Tradet talk={talk} barn={<Sida las />} />);
      await flush();
      await klar();
      const dialog = /** @type {HTMLElement} */ (screen.getByRole("dialog", { name: "TALK" }));
      expect(/** @type {HTMLElement} */ (dialog.querySelector("[data-talk-valfel]")).textContent).toContain("Fältet finns inte längre");
      expect(within(dialog).getByText(SAGT[0])).toBeTruthy();
      expect(/** @type {HTMLInputElement} */ (screen.getByLabelText("Titel")).value).toBe("Hej världen");
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ rymmer fältet inte det sagda (maxLength) skrivs inget in, och menyn står kvar med texten: ingenting kapas tyst", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<Tradet talk={skapaTalk()} barn={<Falt maxLength={15} />} />);
      const ta = /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Beskrivning"));
      stall(ta, 11);
      await tryck(huvudMikrofon());
      await klar();
      expect(ta.value).toBe("Hej världen");
      const dialog = /** @type {HTMLElement} */ (screen.getByRole("dialog", { name: "TALK" }));
      expect(/** @type {HTMLElement} */ (dialog.querySelector("[data-talk-valfel]")).textContent).toContain("Fältet har inte plats för det du sa");
      expect(within(dialog).getByText(SAGT[0])).toBeTruthy();
    } finally {
      konsol.mockRestore();
    }
  });
});

describe("chattens skrivfält tar emot TALK", () => {
  /** @param {{ onSkicka: any }} p */
  function Chatt({ onSkicka }) {
    const [text, setText] = useState("");
    return <Skrivfalt text={text} setText={setText} skickar={false} onSkicka={onSkicka} texter={texterPa("sv", {})} />;
  }

  it("⛔ markören i skrivfältet: TALK skriver in det sagda där, utan meny, och ingenting skickas", async () => {
    const onSkicka = vi.fn();
    render(<Tradet talk={skapaTalk()} barn={<Chatt onSkicka={onSkicka} />} />);
    const ta = /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox"));
    fireEvent.change(ta, { target: { value: "Hej" } });
    stall(ta, 3);
    await tryck(huvudMikrofon());
    expect(/** @type {HTMLElement} */ (document.querySelector("[data-talk-samtalet]")).textContent).toContain("Till fältet");
    await klar();
    expect(ta.value).toBe("Hej Hur långt är det till Visby?");
    expect(onSkicka).not.toHaveBeenCalled();
    expect(meny()).toBeNull();
  });

  it("⛔ ingen mikrofon i skrivfältet: Skicka står där mikrofonen stod, med och utan taligenkänning i webbläsaren", () => {
    vi.stubGlobal("webkitSpeechRecognition", class { start() {} stop() {} abort() {} });
    try {
      const { container } = render(<Chatt onSkicka={vi.fn()} />);
      expect(container.querySelector("[data-mikrofon]")).toBeNull();
      expect(screen.queryByRole("button", { name: /Prata in|Dictate/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Skicka" })).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("textfälten har ingen egen röstknapp", () => {
  it("⛔ ingen ljudvåg i OpsTextarea eller OpsInput, inte heller när webbläsaren har taligenkänning", () => {
    vi.stubGlobal("webkitSpeechRecognition", class { start() {} stop() {} abort() {} });
    try {
      const { container } = render(<><Falt /><Falt mangrad={false} etikett="Rad" /></>);
      expect(container.querySelector("[data-mikrofon]")).toBeNull();
      expect(container.querySelector("[data-textfalt-tal]")).toBeNull();
      expect(screen.queryByRole("button", { name: /Prata in|Dictate/ })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ tal={true} och tal som objekt kastar med ett tydligt fel, men tal={false} accepteras tyst", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsTextarea value="" onChange={() => {}} tal={/** @type {any} */ (true)} />)).toThrow(/tal finns inte längre/);
      expect(() => render(<OpsInput value="" onChange={() => {}} tal={/** @type {any} */ (true)} />)).toThrow(/tal finns inte längre/);
      expect(() => render(<OpsTextarea value="" onChange={() => {}} tal={/** @type {any} */ ({ igenkanning: true })} />)).toThrow(/tal finns inte längre/);
      expect(() => render(<OpsInput value="" onChange={() => {}} tal={/** @type {any} */ ({ onTranscribe: async () => "x" })} />)).toThrow(/TALK är den enda röstknappen/);
    } finally {
      fel.mockRestore();
    }
    const { container } = render(<><OpsTextarea value="" onChange={() => {}} tal={false} /><OpsInput value="" onChange={() => {}} tal={false} /></>);
    expect(container.querySelectorAll("textarea, input")).toHaveLength(2);
  });
});

describe("registret och fångsten (talkfalt.js)", () => {
  it("fångar bara registrerade fält, med namn ur etikett, annars ariaLabel, annars placeholder", () => {
    render(
      <>
        <OpsField label="Med etikett"><OpsInput value="" onChange={() => {}} /></OpsField>
        <OpsInput value="" onChange={() => {}} ariaLabel="Med aria" />
        <OpsInput value="" onChange={() => {}} placeholder="Med platstext" />
        <OpsInput value="" />
        <OpsInput value="" onChange={() => {}} disabled />
        <OpsInput value="" onChange={() => {}} type="password" ariaLabel="Lösen" />
      </>,
    );
    const [a, b, c, utan, av, losen] = /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll("input")]);
    expect(fangaTalkfalt(a)?.namn).toBe("Med etikett");
    expect(fangaTalkfalt(b)?.namn).toBe("Med aria");
    expect(fangaTalkfalt(c)?.namn).toBe("Med platstext");
    expect(fangaTalkfalt(utan)).toBeNull();
    expect(fangaTalkfalt(av)).toBeNull();
    expect(fangaTalkfalt(losen)).toBeNull();
    expect(fangaTalkfalt(document.body)).toBeNull();
  });

  it("⛔ (0.233.0) ett fält som aldrig haft fokus får det sagda sist, ett fält som haft fokus får det där markören stod", () => {
    function Tva() {
      const [a, setA] = useState("Hej världen");
      const [b, setB] = useState("Hej världen");
      return (
        <>
          <OpsField label="Orört"><OpsInput value={a} onChange={setA} /></OpsField>
          <OpsField label="Använt"><OpsInput value={b} onChange={setB} /></OpsField>
        </>
      );
    }
    render(<Tva />);
    const [orort, anvant] = /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll("input")]);
    // Ett orört fält kan ha `selectionStart` 0, och det får inte läsas som en markör personen satt.
    orort.setSelectionRange(0, 0);
    act(() => {
      fangaTalkfalt(orort)?.skriv("tal");
    });
    expect(orort.value).toBe("Hej världen tal");
    act(() => {
      anvant.focus();
      anvant.setSelectionRange(4, 4);
      anvant.blur();
    });
    act(() => {
      fangaTalkfalt(anvant)?.skriv("tal");
    });
    expect(anvant.value).toBe("Hej tal världen");
  });

  it("fångsten förbrukas, och en gammal fångst gäller inte", () => {
    render(<OpsField label="Fält"><OpsInput value="" onChange={() => {}} /></OpsField>);
    const inp = /** @type {HTMLInputElement} */ (document.querySelector("input"));
    const sluta = lyssnaPaTryck();
    try {
      inp.focus();
      fireEvent.pointerDown(document.body);
      const f = tagFangst();
      expect(f?.namn).toBe("Fält");
      expect(tagFangst()).toBeNull();
      fireEvent.pointerDown(document.body);
      vi.advanceTimersByTime(3500);
      expect(tagFangst()).toBeNull();
    } finally {
      sluta();
    }
  });
});
