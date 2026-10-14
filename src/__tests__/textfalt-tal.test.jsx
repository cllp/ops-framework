import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { OpsField, OpsTextarea, skrivInTal } from "../components/OpsField.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";

/*
 * Tal i ett vanligt textfält (0.104.0). CP 2026-10-14, med en skärmbild av Skapa app i lifehub.app (ett `OpsTextarea` med "Beskriv
 * appen du vill ha"): "Jag vill gärna ha TALK funktionen även här på skapa app."
 *
 * Här mäts beteende med en fejkad webbläsare (samma `SpeechRecognition` och inspelare som chattens prov, chatt-live-text.test.jsx):
 * att Klar skriver in det sagda där markören stod, att Avbryt inte ändrar något, att `maxLength` gäller även det sagda och att fältet
 * säger det, att appens `onTranscribe` är reserven när igenkänning saknas, och att inget tomt lämnas tyst.
 */

function provinspelare() {
  const blob = new Blob(["ljud"], { type: "audio/webm" });
  return {
    blob,
    starta: vi.fn(async () => {}),
    stoppa: vi.fn(async () => ({ blob, mimeType: "audio/webm", sekunder: 2 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

function fejkadIgenkanning() {
  /** @type {any[]} */
  const instanser = [];
  class SR {
    constructor() {
      /** @type {any} */ this.onresult = null;
      /** @type {any} */ this.onerror = null;
      /** @type {any} */ this.onend = null;
      this.startad = false;
      instanser.push(this);
    }
    start() {
      this.startad = true;
    }
    stop() {
      queueMicrotask(() => this.onend?.());
    }
    abort() {}
  }
  /** @param {any} rec @param {Array<[string, boolean]>} rader */
  const resultat = (rec, rader) => act(() => rec.onresult({ resultIndex: 0, results: rader.map(([t, slut]) => Object.assign([{ transcript: t }], { isFinal: slut })) }));
  return { SR, instanser, resultat };
}

/**
 * Ett styrt fält i en `OpsField`, som Skapa app.
 * @param {{ start?: string, maxLength?: number, tal: any, onAndra: (v: string) => void }} p
 */
function Formular({ start = "", maxLength, tal, onAndra }) {
  const [v, setV] = useState(start);
  return (
    <OpsField label="Beskriv appen">
      <OpsTextarea
        value={v}
        onChange={(n) => {
          onAndra(n);
          setV(n);
        }}
        maxLength={maxLength}
        rows={5}
        tal={tal}
      />
    </OpsField>
  );
}

const falt = () => /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Beskriv appen" }));
const yta = () => /** @type {HTMLElement} */ (document.querySelector("[data-rostyta]"));
const klar = () => within(yta()).getByRole("button", { name: "Klar, skriv in det du sagt" });

/**
 * Renderar fältet och trycker på mikrofonen.
 * @param {{ start?: string, maxLength?: number, igenkanning?: boolean, onTranscribe?: any, markor?: [number, number], sprak?: string }} [val]
 */
async function borjaPrata(val = {}) {
  const insp = provinspelare();
  const f = fejkadIgenkanning();
  if (val.igenkanning !== false) vi.stubGlobal("webkitSpeechRecognition", f.SR);
  const onAndra = vi.fn();
  const tal = { ...(val.igenkanning !== false ? { igenkanning: true } : {}), ...(val.onTranscribe ? { onTranscribe: val.onTranscribe } : {}), inspelare: insp };
  render(
    <OpsSprakProvider sprak={val.sprak ?? "sv"}>
      <Formular start={val.start} maxLength={val.maxLength} tal={tal} onAndra={onAndra} />
    </OpsSprakProvider>,
  );
  if (val.markor) {
    falt().focus();
    falt().setSelectionRange(val.markor[0], val.markor[1]);
    fireEvent.select(falt());
  }
  fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
  if (val.igenkanning !== false) await waitFor(() => expect(f.instanser[0]?.startad).toBe(true));
  else await waitFor(() => expect(insp.starta).toHaveBeenCalled());
  return { insp, f, rec: f.instanser[0], onAndra };
}

describe("tal i OpsTextarea", () => {
  it("⛔ Klar skriver in det sagda där markören stod, utan att något skickas, och fokus går tillbaka med markören efter det inskrivna", async () => {
    try {
      const { f, rec, onAndra, insp } = await borjaPrata({ start: "En app för rep.", markor: [10, 10] });
      // Ytan står i fältets plats och texten syns medan den sägs.
      expect(yta()?.getAttribute("data-rostlage")).toBe("spelar");
      expect(screen.queryByRole("textbox", { name: "Beskriv appen" })).toBeNull();
      f.resultat(rec, [["och spelningar", true]]);
      expect(yta().querySelector("[data-talk-text]")?.textContent).toBe("och spelningar");
      expect(document.activeElement).toBe(klar());
      fireEvent.click(klar());
      await waitFor(() => expect(yta()).toBeNull());
      expect(onAndra).toHaveBeenCalledTimes(1);
      expect(falt().value).toBe("En app för och spelningar rep.");
      expect(document.activeElement).toBe(falt());
      await waitFor(() => expect(falt().selectionStart).toBe("En app för och spelningar".length));
      // ⛔ Mikrofonen släpps: inspelaren stoppades.
      expect(insp.stoppa).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ utan markör hamnar det sagda sist, och den preliminära texten räknas vid stopp", async () => {
    try {
      const { f, rec } = await borjaPrata({ start: "En app" });
      f.resultat(rec, [["för rep", false]]);
      fireEvent.click(klar());
      await waitFor(() => expect(falt().value).toBe("En app för rep"));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  /*
   * ⛔ 0.104.0, granskningen av PR 384 (KAN 4). Markören lades efter det inskrivna också när appen avvisade det (`onChange` utan att
   * värdet ändrades), så att den hoppade fram i en text som aldrig ändrats. Den står nu kvar där den stod.
   */
  it("⛔ avvisar appen det inskrivna står markören kvar där den stod", async () => {
    try {
      const f = fejkadIgenkanning();
      vi.stubGlobal("webkitSpeechRecognition", f.SR);
      const onAndra = vi.fn();
      render(
        <OpsField label="Beskriv appen">
          <OpsTextarea value="Abcdefghij" onChange={onAndra} rows={5} tal={{ igenkanning: true, inspelare: provinspelare() }} />
        </OpsField>,
      );
      falt().focus();
      falt().setSelectionRange(2, 2);
      fireEvent.select(falt());
      fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
      await waitFor(() => expect(f.instanser[0]?.startad).toBe(true));
      f.resultat(f.instanser[0], [["hej", true]]);
      fireEvent.click(klar());
      await waitFor(() => expect(yta()).toBeNull());
      expect(onAndra).toHaveBeenCalledWith("Ab hej cdefghij");
      expect(falt().value).toBe("Abcdefghij");
      expect(document.activeElement).toBe(falt());
      await act(async () => {});
      expect(falt().selectionStart).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  /*
   * ⛔ 0.104.0, granskningen av PR 384 (KAN 7). Ytan står i fältets plats medan man pratar, men hade inget namn: den som lyssnar hörde
   * "Klar" och "Avbryt" utan att veta vilket fält de gällde. Ytan är nu en grupp med fältets namn, ur etiketten eller `ariaLabel`.
   */
  it("⛔ ytan bär fältets namn, ur etiketten i OpsField", async () => {
    try {
      await borjaPrata({ start: "En app" });
      const grupp = screen.getByRole("group", { name: "Beskriv appen" });
      expect(grupp.contains(klar())).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ ytan bär fältets namn, ur ariaLabel utan OpsField", async () => {
    try {
      const f = fejkadIgenkanning();
      vi.stubGlobal("webkitSpeechRecognition", f.SR);
      render(<OpsTextarea value="" onChange={() => {}} ariaLabel="Anteckning" tal={{ igenkanning: true, inspelare: provinspelare() }} />);
      fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
      await waitFor(() => expect(f.instanser[0]?.startad).toBe(true));
      expect(screen.getByRole("group", { name: "Anteckning" }).contains(klar())).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ Avbryt ändrar ingenting, och fokus går tillbaka till fältet", async () => {
    try {
      const { f, rec, onAndra, insp } = await borjaPrata({ start: "Orört", markor: [2, 2] });
      f.resultat(rec, [["det här ska inte in", true]]);
      fireEvent.click(within(yta()).getByRole("button", { name: "Avbryt" }));
      await waitFor(() => expect(yta()).toBeNull());
      expect(onAndra).not.toHaveBeenCalled();
      expect(falt().value).toBe("Orört");
      expect(document.activeElement).toBe(falt());
      expect(falt().selectionStart).toBe(2);
      expect(insp.kasta).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ maxLength gäller även det sagda: det kapas, och fältet säger det", async () => {
    try {
      const { f, rec } = await borjaPrata({ start: "Abc", maxLength: 12 });
      f.resultat(rec, [["en lång mening som inte ryms", true]]);
      fireEvent.click(klar());
      await waitFor(() => expect(yta()).toBeNull());
      // ⛔ ÄNDRAT 0.104.0 (granskningen av PR 384, KAN 6): här stod "Abc en lång " med ett mellanslag sist. Kapningen klipper nu vid
      // ordslutet och lämnar inget blanksteg efter sig. Ändringen av provet behöver en annan granskare (regel 9).
      expect(falt().value).toBe("Abc en lång");
      expect(falt().value.length).toBeLessThanOrEqual(12);
      const status = /** @type {HTMLElement} */ (document.querySelector("[data-tal-kapat]"));
      expect(status.getAttribute("data-tal-kapat")).toBe("kapat");
      expect(status.textContent).toBe("Det du sa kortades: fältet rymmer 12 tecken.");
      expect(status.getAttribute("role")).toBe("status");
      expect(falt().getAttribute("aria-describedby")).toContain(status.id);
      // Nästa ändring av fältet tar bort beskedet.
      fireEvent.change(falt(), { target: { value: "Abc" } });
      expect(document.querySelector("[data-tal-kapat]")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ reserven: utan igenkänning skriver appens onTranscribe ut ljudet, och resultatet skrivs in", async () => {
    let svara = (/** @type {string} */ _t) => {};
    const onTranscribe = vi.fn(() => new Promise((r) => (svara = r)));
    const { insp } = await borjaPrata({ igenkanning: false, onTranscribe });
    expect(yta()?.hasAttribute("data-live")).toBe(false);
    fireEvent.click(klar());
    await waitFor(() => expect(onTranscribe).toHaveBeenCalledTimes(1));
    expect(onTranscribe).toHaveBeenCalledWith(insp.blob);
    await waitFor(() => expect(yta()?.getAttribute("data-rostlage")).toBe("skriver"));
    await act(async () => svara("en app för läxor"));
    await waitFor(() => expect(yta()).toBeNull());
    expect(falt().value).toBe("en app för läxor");
  });

  it("⛔ inget tomt lämnas tyst: en tom utskrift står som fel i ytan med Försök igen, och fältet rörs inte", async () => {
    const onTranscribe = vi.fn(async () => "  ");
    const { onAndra } = await borjaPrata({ igenkanning: false, onTranscribe, start: "Kvar" });
    fireEvent.click(klar());
    await waitFor(() => expect(yta()?.getAttribute("data-rostlage")).toBe("fel"));
    expect(within(yta()).getByRole("alert").textContent).toBe("Det inspelade kunde inte skrivas ut. Inget hördes i det inspelade.");
    expect(within(yta()).getByRole("button", { name: "Försök igen" })).toBeTruthy();
    expect(onAndra).not.toHaveBeenCalled();
    // Krysset tar bort ytan, och fältet är som förut.
    fireEvent.click(within(yta()).getByRole("button", { name: "Avbryt" }));
    await waitFor(() => expect(yta()).toBeNull());
    expect(falt().value).toBe("Kvar");
  });

  it("⛔ inget hördes och ingen reserv finns: felet står i ytan, och inget skrivs in", async () => {
    try {
      const { onAndra } = await borjaPrata({ start: "Kvar" });
      fireEvent.click(klar());
      await waitFor(() => expect(yta()?.getAttribute("data-rostlage")).toBe("fel"));
      expect(within(yta()).getByRole("alert").textContent).toBe("Det inspelade kunde inte skrivas ut. Ingen utskrift finns.");
      expect(onAndra).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("⛔ mikrofonen finns bara när den kan ge text, och knappen har ett namn på båda språken", () => {
    const { unmount } = render(<Formular tal={true} onAndra={() => {}} />);
    // jsdom saknar taligenkänning och ingen reserv finns: ingen knapp som bara kan ge ett fel.
    expect(screen.queryByRole("button", { name: "Prata in" })).toBeNull();
    unmount();
    render(
      <OpsSprakProvider sprak="en">
        <Formular tal={{ onTranscribe: async () => "x" }} onAndra={() => {}} />
      </OpsSprakProvider>,
    );
    expect(screen.getByRole("button", { name: "Dictate" })).toBeTruthy();
  });

  it("⛔ utan tal är fältet som förut: ingen mikrofon och ingen extra ruta", () => {
    render(<Formular tal={undefined} onAndra={() => {}} />);
    expect(screen.queryByRole("button", { name: "Prata in" })).toBeNull();
    expect(document.querySelector("[data-textfalt-tal]")).toBeNull();
  });

  it("⛔ ett tal utan något som kan ge text, eller utan onChange, kastar", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsTextarea value="" onChange={() => {}} tal={{}} />)).toThrow(/igenkanning eller onTranscribe/);
      expect(() => render(<OpsTextarea value="" tal={true} />)).toThrow(/kräver onChange/);
      expect(() => render(<OpsTextarea value="" onChange={() => {}} tal={/** @type {any} */ ({ onTranskribe: async () => "" })} />)).toThrow(/okända nycklar/);
    } finally {
      fel.mockRestore();
    }
  });
});

describe("tal med fel form", () => {
  // ⛔ 0.104.0, granskningen av PR 384 (KAN 8): `tal={null}` gav "fick object", eftersom `typeof null` är "object".
  it("⛔ tal={null} och en lista säger vad de är, inte object", () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsTextarea value="" onChange={() => {}} tal={/** @type {any} */ (null)} />)).toThrow(/fick null\. Utelämna tal/);
      expect(() => render(<OpsTextarea value="" onChange={() => {}} tal={/** @type {any} */ ([])} />)).toThrow(/fick en lista/);
      expect(() => render(<OpsTextarea value="" onChange={() => {}} tal={/** @type {any} */ ("ja")} />)).toThrow(/fick "ja"/);
    } finally {
      fel.mockRestore();
    }
  });
});

describe("skrivInTal", () => {
  it("skriver in vid markören, ersätter en markering och lägger mellanslag där orden annars suttit ihop", () => {
    expect(skrivInTal("Beskriv", null, "en app", undefined)).toEqual({ varde: "Beskriv en app", markor: 14, kapat: "nej" });
    expect(skrivInTal("ab", { start: 1, slut: 1 }, "X", undefined).varde).toBe("a X b");
    expect(skrivInTal("En gammal app", { start: 3, slut: 9 }, "ny", undefined).varde).toBe("En ny app");
    expect(skrivInTal("", null, "hej", undefined)).toEqual({ varde: "hej", markor: 3, kapat: "nej" });
  });

  it("håller maxLength: kapar och säger det, och säger när inget fick plats", () => {
    expect(skrivInTal("abc", null, "defgh", 6)).toEqual({ varde: "abc de", markor: 6, kapat: "kapat" });
    expect(skrivInTal("abcdef", null, "x", 6)).toEqual({ varde: "abcdef", markor: 6, kapat: "fullt" });
  });

  /*
   * ⛔ ÄNDRAT 0.104.0 (granskningen av PR 384, KAN 6). Här stod att `skrivInTal("abcde", null, "x", 6)` ger "fullt". Fältet var inte
   * fullt: "x" fick plats, det var mellanslaget framför som inte gjorde det, och fältet sade "inget av det du sa fick plats". Nu
   * släpps mellanslaget i stället för det sagda. Ändringen av provet behöver en annan granskare (regel 9).
   */
  it("⛔ får det sagda plats utan mellanslaget framför skrivs det in, och fältet säger inte att det är fullt", () => {
    expect(skrivInTal("abcde", null, "x", 6)).toEqual({ varde: "abcdex", markor: 6, kapat: "nej" });
  });

  it("⛔ kapningen klipper vid ett ordslut och lämnar inget mellanslag sist", () => {
    expect(skrivInTal("", null, "hej världen", 7)).toEqual({ varde: "hej", markor: 3, kapat: "kapat" });
    expect(skrivInTal("Notera", null, "köp mjölk i dag", 17)).toEqual({ varde: "Notera köp mjölk", markor: 16, kapat: "kapat" });
    // Ett snitt som råkar falla på ett mellanslag lämnar det inte heller kvar.
    expect(skrivInTal("", null, "en två tre", 7)).toEqual({ varde: "en två", markor: 6, kapat: "kapat" });
  });
});
