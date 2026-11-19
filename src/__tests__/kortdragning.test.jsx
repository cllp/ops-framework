import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { flyttaIOrdning, ordnaEfter, slappIndex } from "../lib/kortdragning.js";
import { useKortdragning } from "../components/useKortdragning.js";

/*
 * Dra och släpp på ärendetavlan, mellan kolumner och inom en kolumn, med finger eller mus (0.241.0, cllp/lifehub.app#894). CP 2026-11-18: "Vi har inte
 * dra och släpp heller, det måste gå horisontellt och vertikalt."
 *
 * jsdom har ingen layout och ingen `PointerEvent`. Korten får sina mått från en `getBoundingClientRect` som provet sätter, och `elementFromPoint` svarar med
 * det element provet pekar ut. Hur greppet SER UT och att fingret inte rullar sidan mäts i webbläsaren, inte här.
 */

beforeAll(() => {
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      /** @param {string} type @param {PointerEventInit} [init] */
      constructor(type, init = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    // @ts-ignore jsdom saknar den
    window.PointerEvent = PointerEventPolyfill;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-ignore jsdom har ingen, provet sätter den
  delete document.elementFromPoint;
});

describe("slappIndex", () => {
  const kort = [
    { id: "a", top: 0, height: 40 },
    { id: "b", top: 50, height: 40 },
    { id: "c", top: 100, height: 40 },
  ];
  it("räknar korten vars mittlinje ligger ovanför pekaren", () => {
    expect(slappIndex(kort, 5)).toBe(0);
    expect(slappIndex(kort, 21)).toBe(1);
    expect(slappIndex(kort, 75)).toBe(2);
    expect(slappIndex(kort, 500)).toBe(3);
  });
  it("⛔ kortet som dras räknas inte, så ett kort som släpps på sin egen plats står kvar", () => {
    // b dras och släpps mitt på sig själv: platsen är 1, efter a.
    expect(slappIndex(kort, 70, "b")).toBe(1);
    // a dras ned förbi b:s mitt: platsen är 1 bland de två andra.
    expect(slappIndex(kort, 80, "a")).toBe(1);
  });
});

describe("flyttaIOrdning", () => {
  it("lägger kortet på platsen bland kolumnens kort, och kolumnens ordning står först", () => {
    expect(flyttaIOrdning(["x", "a", "b"], ["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b", "x"]);
  });
  it("flyttar inom en kolumn utan att kortet står två gånger", () => {
    expect(flyttaIOrdning(["a", "b", "c"], ["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
  });
  it("ett kort från en annan kolumn läggs in, och platsen kapas till kolumnens längd", () => {
    expect(flyttaIOrdning([], ["a", "b"], "z", 99)).toEqual(["a", "b", "z"]);
    expect(flyttaIOrdning([], ["a", "b"], "z", -3)).toEqual(["z", "a", "b"]);
  });
  it("⛔ taket kapar de äldsta, inte det nya", () => {
    const gammal = Array.from({ length: 10 }, (_, i) => `g${i}`);
    const ny = flyttaIOrdning(gammal, ["k"], "nytt", 0, 5);
    expect(ny).toHaveLength(5);
    expect(ny.slice(0, 2)).toEqual(["nytt", "k"]);
  });
});

describe("ordnaEfter", () => {
  it("korten med en plats först i den ordningen, sedan resten i den ordning de kom", () => {
    const kort = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    expect(ordnaEfter(kort, ["c", "a"], (k) => k.id).map((k) => k.id)).toEqual(["c", "a", "b", "d"]);
    expect(ordnaEfter(kort, [], (k) => k.id).map((k) => k.id)).toEqual(["a", "b", "c", "d"]);
  });
});

/* ---- kroken ---- */

/** @param {{ onSlapp: any, tillat?: any, onKort?: any }} p */
function Tavla({ onSlapp, tillat, onKort }) {
  const { greppProps, drar, mal } = useKortdragning({ onSlapp, tillat });
  const kolumner = { ny: ["a", "b"], pagar: ["c"] };
  return (
    <div data-drar={drar ?? ""} data-mal={mal ? `${mal.kolumn}:${mal.index}` : ""}>
      {Object.entries(kolumner).map(([kol, ids]) => (
        <section key={kol} data-drag-kolumn={kol}>
          {ids.map((id) => (
            <article key={id} data-drag-kort={id} onPointerDown={onKort}>
              <span {...greppProps(id, kol)} />
              <a href={`#${id}`}>{id}</a>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

/** Sätter korten i två kolumner, 40 px höga med 10 px mellan, och låter `elementFromPoint` svara med den kolumn x pekar på. */
function layout() {
  const top = { a: 0, b: 50, c: 0 };
  for (const el of document.querySelectorAll("[data-drag-kort]")) {
    const id = /** @type {"a"|"b"|"c"} */ (el.getAttribute("data-drag-kort"));
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue(/** @type {DOMRect} */ ({ top: top[id], height: 40, bottom: top[id] + 40, left: 0, right: 100, width: 100, x: 0, y: top[id], toJSON: () => ({}) }));
  }
  const kol = (/** @type {string} */ k) => /** @type {Element} */ (document.querySelector(`[data-drag-kolumn="${k}"]`));
  // @ts-ignore jsdom saknar den
  document.elementFromPoint = (/** @type {number} */ x) => (x < 200 ? kol("ny") : x < 400 ? kol("pagar") : document.body);
}

const grepp = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.querySelector(`[data-drag-grepp="${id}"]`));
const pek = (/** @type {string} */ typ, /** @type {EventTarget} */ mal, x = 0, y = 0, pointerId = 1) =>
  act(() => {
    mal.dispatchEvent(new window.PointerEvent(typ, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId, button: 0, pointerType: "touch" }));
  });

describe("useKortdragning", () => {
  it("⛔ i sidled: kortet dras från greppet till en annan kolumn och släpps där", async () => {
    const onSlapp = vi.fn();
    const { container } = render(<Tavla onSlapp={onSlapp} />);
    layout();
    await pek("pointerdown", grepp("a"), 50, 10);
    expect(container.firstElementChild?.getAttribute("data-drar")).toBe("a");
    await pek("pointermove", window, 300, 30);
    expect(container.firstElementChild?.getAttribute("data-mal")).toBe("pagar:1");
    await pek("pointerup", window, 300, 30);
    expect(onSlapp).toHaveBeenCalledTimes(1);
    expect(onSlapp).toHaveBeenCalledWith({ id: "a", fran: "ny", till: "pagar", index: 1 });
    expect(container.firstElementChild?.getAttribute("data-drar")).toBe("");
  });

  it("⛔ i höjdled: kortet dras ned förbi nästa kort i samma kolumn", async () => {
    const onSlapp = vi.fn();
    render(<Tavla onSlapp={onSlapp} />);
    layout();
    await pek("pointerdown", grepp("a"), 50, 10);
    await pek("pointermove", window, 50, 80);
    await pek("pointerup", window, 50, 80);
    expect(onSlapp).toHaveBeenCalledTimes(1);
    expect(onSlapp).toHaveBeenCalledWith({ id: "a", fran: "ny", till: "ny", index: 1 });
  });

  it("ett släpp utanför en kolumn gör ingenting, och Escape avbryter", async () => {
    const onSlapp = vi.fn();
    const { container } = render(<Tavla onSlapp={onSlapp} />);
    layout();
    await pek("pointerdown", grepp("b"), 50, 60);
    await pek("pointerup", window, 900, 60);
    expect(onSlapp).not.toHaveBeenCalled();
    await pek("pointerdown", grepp("b"), 50, 60);
    await pek("pointermove", window, 300, 10);
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(container.firstElementChild?.getAttribute("data-drar")).toBe("");
    await pek("pointerup", window, 300, 10);
    expect(onSlapp).not.toHaveBeenCalled();
  });

  it("en kolumn som `tillat` säger nej till blir inget mål", async () => {
    const onSlapp = vi.fn();
    render(<Tavla onSlapp={onSlapp} tillat={(/** @type {string} */ _id, /** @type {string} */ kol) => kol !== "pagar"} />);
    layout();
    await pek("pointerdown", grepp("a"), 50, 10);
    await pek("pointerup", window, 300, 10);
    expect(onSlapp).not.toHaveBeenCalled();
  });

  it("⛔ trycket i greppet når inte kortets länk, så dragningen öppnar inte kortet", async () => {
    const onKort = vi.fn();
    // Kortets långtryck (`useLangtryck`) lyssnar med Reacts händelser på kortet, så det är dem trycket i greppet inte får nå.
    render(<Tavla onSlapp={vi.fn()} onKort={onKort} />);
    layout();
    await pek("pointerdown", grepp("a"), 50, 10);
    expect(onKort).not.toHaveBeenCalled();
    expect(grepp("a").style.touchAction).toBe("none");
    await pek("pointerup", window, 50, 10);
  });

  it("en annan pekare (ett andra finger) styr inte dragningen", async () => {
    const onSlapp = vi.fn();
    render(<Tavla onSlapp={onSlapp} />);
    layout();
    await pek("pointerdown", grepp("a"), 50, 10, 1);
    await pek("pointerup", window, 300, 10, 2);
    expect(onSlapp).not.toHaveBeenCalled();
    await pek("pointerup", window, 300, 10, 1);
    expect(onSlapp).toHaveBeenCalledOnce();
  });

  it("⛔ 0.243.0: en kopia av kortet följer pekaren under dragningen, och försvinner vid släppet", async () => {
    const onSlapp = vi.fn();
    render(<Tavla onSlapp={onSlapp} />);
    layout();
    expect(document.querySelector("[data-drag-skugga]")).toBeNull();
    // Greppet tas 10 px in i kortet (a ligger på y 0), så kopian ska ligga 10 px ovanför pekaren hela vägen.
    await pek("pointerdown", grepp("a"), 50, 10);
    const skugga = /** @type {HTMLElement} */ (document.querySelector("[data-drag-skugga]"));
    expect(skugga).not.toBeNull();
    expect(skugga.getAttribute("data-drag-skugga")).toBe("a");
    expect(skugga.getAttribute("aria-hidden")).toBe("true");
    expect(skugga.style.pointerEvents).toBe("none");
    // Kopian är inget kort och inget grepp: den får inte bli ett mål eller en ny dragning.
    expect(skugga.hasAttribute("data-drag-kort")).toBe(false);
    expect(skugga.querySelector("[data-drag-grepp]")).toBeNull();
    expect(document.querySelector('[data-drag-kort="a"]')?.hasAttribute("data-drag-kalla")).toBe(true);
    await pek("pointermove", window, 300, 130);
    expect(skugga.style.transform).toContain("translate3d(250px, 120px, 0)");
    await pek("pointerup", window, 300, 130);
    expect(document.querySelector("[data-drag-skugga]")).toBeNull();
    expect(document.querySelector('[data-drag-kort="a"]')?.hasAttribute("data-drag-kalla")).toBe(false);
  });

  it("⛔ 0.243.0: Escape tar också bort kopian", async () => {
    render(<Tavla onSlapp={vi.fn()} />);
    layout();
    await pek("pointerdown", grepp("b"), 50, 60);
    expect(document.querySelector("[data-drag-skugga]")).not.toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(document.querySelector("[data-drag-skugga]")).toBeNull();
  });

  it("⛔ 0.243.0: kroken ger kortets höjd, så att platsen kan ritas lika stor som kortet", async () => {
    /** @type {number[]} */
    const hojder = [];
    function MedHojd() {
      const { greppProps, hojd } = useKortdragning({ onSlapp: vi.fn() });
      hojder.push(hojd);
      return (
        <section data-drag-kolumn="ny">
          <article data-drag-kort="a">
            <span {...greppProps("a", "ny")} />
          </article>
        </section>
      );
    }
    render(<MedHojd />);
    layout();
    await pek("pointerdown", grepp("a"), 50, 10);
    expect(hojder.at(-1)).toBe(40);
    await pek("pointerup", window, 50, 10);
    expect(hojder.at(-1)).toBe(0);
  });

  it("⛔ 0.243.0: tavlan ritas inte om när pekaren rör sig inom samma mål", async () => {
    let ritningar = 0;
    function Raknad() {
      ritningar += 1;
      const { greppProps, mal } = useKortdragning({ onSlapp: vi.fn() });
      return (
        <div data-mal={mal ? `${mal.kolumn}:${mal.index}` : ""}>
          <section data-drag-kolumn="ny">
            <article data-drag-kort="a">
              <span {...greppProps("a", "ny")} />
            </article>
            <article data-drag-kort="b">
              <span {...greppProps("b", "ny")} />
            </article>
          </section>
          <section data-drag-kolumn="pagar">
            <article data-drag-kort="c">
              <span {...greppProps("c", "pagar")} />
            </article>
          </section>
        </div>
      );
    }
    const { container } = render(<Raknad />);
    layout();
    await pek("pointerdown", grepp("a"), 50, 10);
    await pek("pointermove", window, 300, 30);
    expect(container.firstElementChild?.getAttribute("data-mal")).toBe("pagar:1");
    const efterForstaMalet = ritningar;
    // Tio rörelser inom samma kolumn och plats: målet är detsamma, och ingen ny ritning ska ske.
    for (let i = 0; i < 10; i += 1) await pek("pointermove", window, 300 + i, 31 + i);
    expect(ritningar).toBe(efterForstaMalet);
    // Ett nytt mål ritas.
    await pek("pointermove", window, 50, 80);
    expect(container.firstElementChild?.getAttribute("data-mal")).toBe("ny:1");
    expect(ritningar).toBeGreaterThan(efterForstaMalet);
    await pek("pointerup", window, 50, 80);
  });
});
