import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { ROST_TYSTNAD_MS, MENING_MINST, helaMeningar, lasIOrdning, samtalssvar } from "../lib/talkrost.js";
import { AGENTUTKAST_MAX, agentutkast, byggAgentstatus } from "../lib/samtal.js";

/*
 * TALK börjar tidigare (0.244.0, cllp/lifehub.app#896). CP 2026-11-19: "Får samma långsamma upplevelse med soniox? Tar massa tid för agenten
 * att vakna upp. Sedan samma gamla robot som läser sakta." Sedan: "Kör steg 1 och 2 för Soniox."
 *
 * Fyra saker provas här, alla genom skalet eller den rena funktionen:
 *   1. agentens utkast i statusdokumentet (`byggAgentstatus`, `agentutkast`) och att `samtalssvar` följer det;
 *   2. hela meningar ur en växande text (`helaMeningar`) och en kö som läser en i taget (`lasIOrdning`);
 *   3. fältet läser första meningen innan svaret är färdigt, och bara resten när det kommer;
 *   4. appens igenkänning förbereds (`forbered`), och dess `onSlut` skickar det sagda i ett röstsamtal utan att vänta på tystnaden.
 */

describe("agentens utkast i statusdokumentet", () => {
  it("bär ett utkast bara när agenten skriver, som text, och högst AGENTUTKAST_MAX tecken", () => {
    expect(byggAgentstatus({ lage: "skriver", sedan: 1, utkast: "Hej." })).toEqual({ lage: "skriver", sedan: 1, utkast: "Hej." });
    expect(byggAgentstatus({ lage: "tanker", sedan: 1 })).toEqual({ lage: "tanker", sedan: 1 });
    expect(() => byggAgentstatus({ lage: "tanker", sedan: 1, utkast: "Hej." })).toThrow("bara när agenten skriver");
    expect(() => byggAgentstatus({ lage: "skriver", sedan: 1, utkast: /** @type {any} */ (3) })).toThrow("utkast är en text");
    expect(() => byggAgentstatus({ lage: "skriver", sedan: 1, utkast: "x".repeat(AGENTUTKAST_MAX + 1) })).toThrow(`högst ${AGENTUTKAST_MAX}`);
  });

  it("agentutkast läser utkastet, och ger tom text för allt annat", () => {
    expect(agentutkast({ lage: "skriver", sedan: 1, utkast: "Hej." })).toBe("Hej.");
    expect(agentutkast({ lage: "tanker", sedan: 1, utkast: "Hej." })).toBe("");
    expect(agentutkast({ lage: "skriver", sedan: 1 })).toBe("");
    expect(agentutkast(null)).toBe("");
  });
});

describe("helaMeningar", () => {
  it("ger bara meningar som följs av ett mellanslag eller en radbrytning, och var nästa läsning börjar", () => {
    const t = "Hej där, jag har tittat. Du har tre möten i morgon! Det första är 3.";
    const a = helaMeningar(t);
    expect(a.meningar).toEqual(["Hej där, jag har tittat.", "Du har tre möten i morgon!"]);
    // ⛔ Punkten sist räknas inte: "3." kan bli "3.5".
    expect(t.slice(a.till)).toBe("Det första är 3.");
    const b = helaMeningar(`${t}5 timmar. Sen`, a.till);
    expect(b.meningar).toEqual(["Det första är 3.5 timmar."]);
  });

  it(`en kort bit (under ${MENING_MINST} tecken) följer med nästa mening, så att rösten inte hackar`, () => {
    expect(helaMeningar("Ja. Jag bokar det åt dig nu. Klart").meningar).toEqual(["Ja. Jag bokar det åt dig nu."]);
  });

  it("en radbrytning är en gräns", () => {
    expect(helaMeningar("Här är dagens lista\n- Möte klockan nio").meningar).toEqual(["Här är dagens lista"]);
  });
});

describe("lasIOrdning", () => {
  it("läser en i taget i ordning, slutar läsa när den inte längre är aktuell, och sparar första felet till slut", async () => {
    /** @type {string[]} */
    const lasta = [];
    let aktuell = true;
    const k = lasIOrdning(async (t) => {
      lasta.push(t);
    }, () => aktuell);
    k.lagg("Ett.");
    k.lagg("  ");
    k.lagg("Två.");
    await k.slut();
    expect(lasta).toEqual(["Ett.", "Två."]);
    expect(k.antal()).toBe(2);
    aktuell = false;
    k.lagg("Tre.");
    await k.slut();
    expect(lasta).toEqual(["Ett.", "Två."]);

    const fel = new Error("ingen röst");
    /** @type {string[]} */
    const andra = [];
    const k2 = lasIOrdning(async (t) => {
      andra.push(t);
      if (t === "A.") throw fel;
    }, () => true);
    k2.lagg("A.");
    k2.lagg("B.");
    await expect(k2.slut()).rejects.toBe(fel);
    expect(andra).toEqual(["A."]);
  });
});

describe("samtalssvar följer utkastet", () => {
  it("⛔ onUtkast får utkastet när det växer, en gång per ny text, och lyssnaren stängs med svaret", async () => {
    /** @type {any} */
    let status;
    /** @type {any} */
    let meddelanden;
    const stangStatus = vi.fn();
    const kalla = {
      prenumerera: (/** @type {string} */ _sid, /** @type {any} */ l) => {
        meddelanden = l;
        return () => {};
      },
      prenumereraStatus: (/** @type {string} */ _sid, /** @type {any} */ l) => {
        status = l;
        return stangStatus;
      },
    };
    const onUtkast = vi.fn();
    const svar = samtalssvar({ kalla, sid: "s", uid: "a", efter: { id: "m1" }, onUtkast });
    status.onData({ lage: "tanker", sedan: 1 });
    status.onData({ lage: "skriver", sedan: 1, utkast: "Hej." });
    status.onData({ lage: "skriver", sedan: 1, utkast: "Hej." });
    status.onData({ lage: "skriver", sedan: 1, utkast: "Hej. Klockan är nio." });
    expect(onUtkast.mock.calls.map((c) => c[0])).toEqual(["Hej.", "Hej. Klockan är nio."]);
    meddelanden.onData([{ id: "m1", av: "a", text: "Vad är klockan?" }, { id: "m2", av: "agent", text: "Hej. Klockan är nio." }]);
    await expect(svar).resolves.toBe("Hej. Klockan är nio.");
    expect(stangStatus).toHaveBeenCalledTimes(1);
    status.onData({ lage: "skriver", sedan: 1, utkast: "Sent." });
    expect(onUtkast).toHaveBeenCalledTimes(2);
  });

  it("utan prenumereraStatus väntas svaret in som förut", async () => {
    /** @type {any} */
    let meddelanden;
    const svar = samtalssvar({
      kalla: {
        prenumerera: (/** @type {string} */ _s, /** @type {any} */ l) => {
          meddelanden = l;
          return () => {};
        },
      },
      sid: "s",
      uid: "a",
      efter: { id: "m1" },
      onUtkast: vi.fn(),
    });
    meddelanden.onData([{ id: "m1", av: "a", text: "Fråga" }, { id: "m2", av: "agent", text: "Svar." }]);
    await expect(svar).resolves.toBe("Svar.");
  });
});

/* ══ Genom skalet ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

/** @param {{ toppNiva?: number | null, tom?: boolean }} [val] `toppNiva` hamnar i diagnosen som inspelarens högsta nivå, `tom` ger 0 byte. */
function falskInspelare({ toppNiva, tom = false } = {}) {
  return {
    starta: vi.fn(() => Promise.resolve()),
    stoppa: vi.fn(() =>
      Promise.resolve({ blob: new Blob(tom ? [] : ["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 2, ...(toppNiva !== undefined ? { diagnos: { toppNiva, logg: "" } } : {}) }),
    ),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

/** En igenkänning med `forbered` och `onSlut`, som provet styr. @param {string} forsta */
function falskIgenkanning(forsta) {
  /** @type {any} */
  let val = null;
  let senast = forsta;
  return {
    forbered: vi.fn(),
    starta: vi.fn((/** @type {any} */ o) => {
      val = o;
    }),
    stoppa: vi.fn(() => {
      const t = senast;
      senast = "";
      return Promise.resolve(t);
    }),
    kasta: vi.fn(),
    /** @param {string} t */
    saga: (t) => {
      senast = t;
      val?.onText(t);
    },
    slut: () => val?.onSlut?.(),
  };
}

function falskUpplasning() {
  /** @type {{ losa: () => void, text: string } | null} */
  let pagar = null;
  return {
    las: vi.fn((/** @type {string} */ text) => new Promise((losa) => {
      pagar = { losa: () => losa(undefined), text };
    })),
    stoppa: vi.fn(),
    forbered: vi.fn(),
    pagar: () => pagar,
  };
}

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const flush = () => act(async () => {});
const tick = (/** @type {number} */ ms) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});
const falt = () => screen.queryByRole("dialog", { name: "TALK" });
const lage = () => falt()?.getAttribute("data-lage") ?? "vila";
const huvudMikrofon = () => /** @type {HTMLElement} */ (document.querySelector("[data-talk-huvud]"));

/** @param {{ talk?: any, igenkanning?: any, upplasning?: any }} [val] */
function Skal({ talk = {}, igenkanning, upplasning } = {}) {
  const t = { onTalk: vi.fn(async () => {}), onMeddelande: vi.fn(), inspelare: falskInspelare(), igenkanning, upplasning, ...talk };
  render(
    <OpsAppShell brand="Ops" fasta={fasta} moduler={[]} activeHref="/" talk={t}>
      <p>innehåll</p>
    </OpsAppShell>,
  );
  return t;
}

async function tillAgenten() {
  fireEvent.click(huvudMikrofon());
  await flush();
  fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Agent" }));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TALK läser medan agenten skriver", () => {
  it("⛔ första meningen läses innan svaret är färdigt, sedan nästa, och bara resten när svaret kommer", async () => {
    const u = falskUpplasning();
    /** @type {(t: string) => void} */
    let utkast = () => {};
    /** @type {(t: string) => void} */
    let losSvar = () => {};
    const svar = vi.fn((/** @type {any} */ opt) => {
      utkast = opt.onUtkast;
      return new Promise((losa) => {
        losSvar = losa;
      });
    });
    Skal({ talk: { onAgent: async () => ({ svar, vidare: vi.fn() }) }, igenkanning: falskIgenkanning("Vad händer i morgon?"), upplasning: u });
    await tillAgenten();
    expect(u.las).not.toHaveBeenCalled();
    act(() => utkast("Du har tre möten i morgon. Det fö"));
    await flush();
    expect(u.las).toHaveBeenCalledTimes(1);
    expect(u.las).toHaveBeenLastCalledWith("Du har tre möten i morgon.", { sprak: "sv-SE" });
    // Texten i fältet växer med utkastet.
    expect(screen.getByText("Du har tre möten i morgon. Det fö")).toBeTruthy();
    act(() => utkast("Du har tre möten i morgon. Det första är klockan nio. Sedan"));
    await flush();
    // ⛔ En i taget: nästa mening väntar tills den första är uppläst.
    expect(u.las).toHaveBeenCalledTimes(1);
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(u.las).toHaveBeenLastCalledWith("Det första är klockan nio.", { sprak: "sv-SE" });
    await act(async () => losSvar("Du har tre möten i morgon. Det första är klockan nio. Sedan lunch med Lars."));
    await flush();
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(u.las).toHaveBeenLastCalledWith("Sedan lunch med Lars.", { sprak: "sv-SE" });
    expect(u.las).toHaveBeenCalledTimes(3);
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(lage()).toBe("lyssnar");
  });

  it("utan utkast läses hela svaret som förut", async () => {
    const u = falskUpplasning();
    const svar = vi.fn(async () => "Det är 200 kilometer.");
    Skal({ talk: { onAgent: async () => ({ svar, vidare: vi.fn() }) }, igenkanning: falskIgenkanning("Hur långt?"), upplasning: u });
    await tillAgenten();
    expect(u.las).toHaveBeenCalledTimes(1);
    expect(u.las).toHaveBeenCalledWith("Det är 200 kilometer.", { sprak: "sv-SE" });
  });

  it("⛔ ett färdigt svar som inte börjar som utkastet läses helt: det som lästs var en inledning", async () => {
    const u = falskUpplasning();
    /** @type {(t: string) => void} */
    let utkast = () => {};
    /** @type {(t: string) => void} */
    let losSvar = () => {};
    const svar = vi.fn((/** @type {any} */ opt) => {
      utkast = opt.onUtkast;
      return new Promise((losa) => {
        losSvar = losa;
      });
    });
    Skal({ talk: { onAgent: async () => ({ svar, vidare: vi.fn() }) }, igenkanning: falskIgenkanning("Boka"), upplasning: u });
    await tillAgenten();
    act(() => utkast("Jag tittar på kalendern nu. "));
    await flush();
    expect(u.las).toHaveBeenLastCalledWith("Jag tittar på kalendern nu.", { sprak: "sv-SE" });
    await act(async () => losSvar("Bokat: möte med Lars klockan nio."));
    await flush();
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(u.las).toHaveBeenLastCalledWith("Bokat: möte med Lars klockan nio.", { sprak: "sv-SE" });
    expect(u.las).toHaveBeenCalledTimes(2);
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(lage()).toBe("lyssnar");
  });

  it("⛔ ett utkast som börjar om (nästa varv) läses från början, utan att upprepa inledningen", async () => {
    const u = falskUpplasning();
    /** @type {(t: string) => void} */
    let utkast = () => {};
    /** @type {(t: string) => void} */
    let losSvar = () => {};
    const svar = vi.fn((/** @type {any} */ opt) => {
      utkast = opt.onUtkast;
      return new Promise((losa) => {
        losSvar = losa;
      });
    });
    Skal({ talk: { onAgent: async () => ({ svar, vidare: vi.fn() }) }, igenkanning: falskIgenkanning("Vad händer?"), upplasning: u });
    await tillAgenten();
    act(() => utkast("Jag kollar kalendern nu. "));
    await flush();
    await act(async () => u.pagar()?.losa());
    await flush();
    act(() => utkast("Du har två möten i morgon. Det"));
    await flush();
    expect(u.las).toHaveBeenLastCalledWith("Du har två möten i morgon.", { sprak: "sv-SE" });
    await act(async () => losSvar("Du har två möten i morgon. Det första är nio."));
    await flush();
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(u.las).toHaveBeenLastCalledWith("Det första är nio.", { sprak: "sv-SE" });
    expect(u.las).toHaveBeenCalledTimes(3);
  });
});

describe("appens igenkänning förbereds, och säger själv när personen är klar", () => {
  it("⛔ forbered anropas när fältet monteras, i trycket och efter omgången", async () => {
    const igk = falskIgenkanning("Fråga");
    Skal({ talk: { onAgent: async () => ({ svar: async () => "Svar.", vidare: vi.fn() }) }, igenkanning: igk, upplasning: falskUpplasning() });
    await flush();
    expect(igk.forbered).toHaveBeenCalledTimes(1);
    // Ett tryck som startar en omgång förbereder först.
    fireEvent.click(huvudMikrofon());
    await flush();
    expect(igk.forbered).toHaveBeenCalledTimes(2);
    // Efter omgången (Klar) förbereds nästa.
    fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
    await flush();
    expect(igk.forbered.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("⛔ onSlut i ett röstsamtal skickar det sagda direkt, utan att vänta ROST_TYSTNAD_MS", async () => {
    const igk = falskIgenkanning("Hur långt är det till Visby?");
    const u = falskUpplasning();
    const vidare = vi.fn(async () => ({ svar: async () => "Nio.", vidare }));
    Skal({ talk: { onAgent: async () => ({ svar: async () => "200 kilometer.", vidare }) }, igenkanning: igk, upplasning: u });
    await tillAgenten();
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(lage()).toBe("lyssnar");
    act(() => igk.saga("Och färjan?"));
    act(() => igk.slut());
    await tick(10);
    await flush();
    expect(vidare).toHaveBeenCalledWith("Och färjan?");
  });

  it("onSlut utan text i ett röstsamtal skickar ingenting, och tystnaden avgör som förut", async () => {
    const igk = falskIgenkanning("Fråga");
    const u = falskUpplasning();
    const vidare = vi.fn();
    Skal({ talk: { onAgent: async () => ({ svar: async () => "Svar.", vidare }) }, igenkanning: igk, upplasning: u });
    await tillAgenten();
    await act(async () => u.pagar()?.losa());
    await flush();
    act(() => igk.slut());
    await tick(ROST_TYSTNAD_MS + 100);
    expect(vidare).not.toHaveBeenCalled();
  });
});

describe("tystnad efter ett svar avslutar röstsamtalet, utan fel (CP:s video 2026-11-19 22.08)", () => {
  /**
   * Ett följdvarv i röstsamtalet där personen trycker Klar utan att igenkänningen gett text. @param {any} inspelare @param {any} [igk]
   * @returns {Promise<{ vidare: import("vitest").Mock }>}
   */
  async function klarUtanText(inspelare, igk = falskIgenkanning("Fråga")) {
    const u = falskUpplasning();
    const vidare = vi.fn();
    Skal({ talk: { inspelare, onAgent: async () => ({ svar: async () => "Svar.", vidare }) }, igenkanning: igk, upplasning: u });
    await tillAgenten();
    await act(async () => u.pagar()?.losa());
    await flush();
    expect(lage()).toBe("lyssnar");
    fireEvent.click(screen.getByRole("button", { name: /^(Klar|Done)/ }));
    await flush();
    await flush();
    return { vidare };
  }
  const avslutat = () => screen.queryByText(/Inget mer hördes, så samtalet är avslutat/);

  it("⛔ belagd tystnad (nivån aldrig över tystnadsgränsen): samtalet slutar med beskedet, utan felrad och utan menyn", async () => {
    const { vidare } = await klarUtanText(falskInspelare({ toppNiva: 0.01 }));
    expect(vidare).not.toHaveBeenCalled();
    expect(screen.queryByText(/Inget tal hördes/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Agent" })).toBeNull();
    expect(avslutat()).toBeTruthy();
  });

  it("⛔ en tom inspelning är också belagd tystnad", async () => {
    await klarUtanText(falskInspelare({ tom: true }));
    expect(avslutat()).toBeTruthy();
  });

  // ⛔ GRANSKNINGEN AV 0.244.1 (P2): tom text med tal i ljudet är inte tystnad. Ljudet bevaras och går den vanliga vägen, och samtalet avslutas inte.
  it("⛔ tom text men tal i ljudet: samtalet avslutas inte, ljudet går den vanliga vägen", async () => {
    await klarUtanText(falskInspelare({ toppNiva: 0.5 }));
    expect(avslutat()).toBeNull();
  });

  it("⛔ utan nivåmätare (WebKit) och med ljud är tystnaden inte belagd", async () => {
    await klarUtanText(falskInspelare({ toppNiva: null }));
    expect(avslutat()).toBeNull();
  });

  it("⛔ en igenkänning som faller när den stoppas är ett fel och inte tystnad, också med tomt ljud", async () => {
    const igk = falskIgenkanning("Fråga");
    const forsta = igk.stoppa;
    let varv = 0;
    igk.stoppa = vi.fn(() => (++varv === 1 ? forsta() : Promise.reject(new Error("igenkänningen föll"))));
    await klarUtanText(falskInspelare({ tom: true }), igk);
    expect(avslutat()).toBeNull();
  });
});

