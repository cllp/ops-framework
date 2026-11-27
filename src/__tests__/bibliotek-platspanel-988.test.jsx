import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost, mittBibliotek, platsBibliotek } from "../lib/bibliotek.js";
import { skapaNyttKlass } from "../lib/radKlass.js";
import { OpsGruppanel } from "../components/OpsGruppanel.jsx";

/**
 * Panelen med platserna, dra och släpp, och ägaren på raden (0.266.0, cllp/lifehub.app#988).
 *
 * CP 2026-11-26: "en panel till höger som man kan fälla ut med de olika platserna ... precis som i chatt, där man fäller ut chattinfo", "Man drar släpper sedan körs
 * serverfunktionerna utan att man behöver vänta i klienten. Man skall kanske också se vem som är ägare för filen." Och: "Kör, väljaren försvinner om det framgår att
 * man navigerar platser via panelen? och flytta inom gruppen."
 *
 * jsdom har ingen `matchMedia`: provet ger en, så att skärmen är bred (från 1024 px) och pekaren en mus. Utan den är skärmen smal, och då finns ingen panel.
 */

const tid = 1_700_000_000_000;
const JAG = { uid: "uid-kim", roll: "medlem" };
const KIM = { uid: "uid-kim", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const SAM = { uid: "uid-sam", namn: "Sam Svensson", typ: "manniska", kalla: "bibliotek" };
const GRUPP = "cps-ab";
const BARN = platsBibliotek(GRUPP, "barnplan");
const MITT = mittBibliotek("uid-kim");
const ANNAN = "miranda-ab";
const PLATSER = [{ id: GRUPP, namn: "CPS" }, { id: MITT, namn: "Mitt bibliotek" }, { id: BARN, namn: "Barnplan" }, { id: ANNAN, namn: "Miranda" }];

const post = (id, rubrik, skapadAv, extra = {}) => ({ ...byggPost({ groupId: GRUPP, typ: "anteckning", rubrik, text: "x", skapadAv, skapad: tid, andrad: tid, ...extra }), id });
const MIN = post("p1", "Min anteckning", KIM);
const SAMS = post("p2", "Sams anteckning", SAM);

let bred = true;
beforeEach(() => {
  bred = true;
  try {
    localStorage.removeItem("ops-bibliotek-platspanel");
  } catch {
    /* ingen lagring i provet */
  }
  window.matchMedia = /** @type {any} */ ((q) => ({
    matches: bred && (q.includes("min-width: 1024px") || q.includes("pointer: fine")),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});
afterEach(() => {
  delete (/** @type {any} */ (window)).matchMedia;
});

function Vy({ poster = [MIN, SAMS], startPlats = GRUPP, onDela = vi.fn(async () => {}), onPlats: spion = vi.fn(), egnaPlatser }) {
  const [plats, setPlats] = useState(startPlats);
  return (
    <OpsBibliotek
      poster={poster.filter((p) => p.groupId === plats)}
      jag={JAG}
      grupper={PLATSER}
      platser={PLATSER}
      plats={plats}
      onPlats={(p) => {
        spion(p);
        setPlats(p);
      }}
      onOppna={() => {}}
      onStang={() => {}}
      onSkapa={() => {}}
      onSpara={() => {}}
      onRadera={() => {}}
      onDela={onDela}
      egnaPlatser={egnaPlatser}
      hubHref="/hub"
    />
  );
}

const panel = () => /** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-platspanel]"));
const platsKnapp = (id) => /** @type {HTMLElement} */ (document.querySelector(`[data-platspanel-plats="${id}"]`));
const rad = (namn) => /** @type {HTMLElement} */ (screen.getByText(namn).closest("[data-bibliotek-kort]"));
/** En dataöverföring som jsdom saknar. */
const overforing = () => {
  const d = new Map();
  return { setData: (k, v) => d.set(k, v), getData: (k) => d.get(k) ?? "", effectAllowed: "", dropEffect: "" };
};

describe("⛔ panelen med platserna (#988)", () => {
  it("på en bred skärm står platserna i panelen, den man står i är markerad, och väljaren är borta", () => {
    render(<Vy />);
    expect(panel()).not.toBeNull();
    expect(within(panel()).getAllByRole("button").map((b) => b.textContent)).toEqual(expect.arrayContaining(["CPS", "Mitt bibliotek", "Barnplan", "Miranda"]));
    expect(platsKnapp(GRUPP).getAttribute("aria-current")).toBe("true");
    expect(screen.queryByRole("button", { name: /Vilket bibliotek/ })).toBeNull();
  });

  it("⛔ Ny plats i panelen är samma streckade ruta som Skapa grupp, och ett tryck öppnar formuläret (CP 2026-11-27: \"för igenkänning\")", () => {
    render(<Vy egnaPlatser={{ platser: [{ id: BARN, namn: "Barnplan" }], onNy: vi.fn(async () => ({ plats: platsBibliotek(GRUPP, "nytt"), namn: "Nytt" })) }} />);
    const ny = /** @type {HTMLElement} */ (panel().querySelector("[data-bibliotek-ny-plats-rad]"));
    expect(ny).not.toBeNull();
    expect(ny.getAttribute("role")).toBeNull();
    expect(ny.className).toBe(skapaNyttKlass());
    const { container } = render(<OpsGruppanel grupper={[{ id: "g", namn: "G" }]} aktiv="g" onValj={() => {}} onSkapa={() => {}} skapaEtikett="Skapa grupp" />);
    const skapaGrupp = within(container).getByRole("button", { name: "Skapa grupp" });
    expect(skapaGrupp.className).toBe(ny.className);
    fireEvent.click(ny);
    expect(within(panel()).getByRole("textbox")).toBeInTheDocument();
  });

  it("ett klick på en plats byter plats", () => {
    const spion = vi.fn();
    render(<Vy onPlats={spion} />);
    fireEvent.click(platsKnapp(BARN));
    expect(spion).toHaveBeenCalledWith(BARN);
    expect(platsKnapp(BARN).getAttribute("aria-current")).toBe("true");
  });

  it("Dölj platserna fäller ihop panelen, väljaren kommer tillbaka, och valet minns", () => {
    const { unmount } = render(<Vy />);
    fireEvent.click(screen.getByRole("button", { name: "Dölj platserna", pressed: true }));
    expect(panel()).toBeNull();
    expect(screen.getByRole("button", { name: /Vilket bibliotek/ })).toBeTruthy();
    unmount();
    render(<Vy />);
    expect(panel()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Visa platserna" }));
    expect(panel()).not.toBeNull();
  });

  it("⛔ på en smal skärm finns varken panelen eller knappen, och väljaren är som förut", () => {
    bred = false;
    render(<Vy />);
    expect(panel()).toBeNull();
    expect(screen.queryByRole("button", { name: /platserna/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Vilket bibliotek/ })).toBeTruthy();
    expect(document.querySelector("[data-bibliotek-dragbar]")).toBeNull();
  });
});

describe("⛔ dra och släpp flyttar inom gruppen (#988)", () => {
  it("medan en rad dras lyser bara gruppens platser upp; Mitt bibliotek och en annan grupp är dämpade med skälet", () => {
    render(<Vy />);
    fireEvent.dragStart(rad("Min anteckning"), { dataTransfer: overforing() });
    expect(platsKnapp(BARN).dataset.slapp).toBe("ja");
    expect(platsKnapp(MITT).dataset.slapp).toBe("nej");
    expect(platsKnapp(MITT).title).toBe("Dra och släpp flyttar bara inom gruppen.");
    expect(platsKnapp(ANNAN).dataset.slapp).toBe("nej");
    // Platsen raden redan ligger på är varken eller.
    expect(platsKnapp(GRUPP).dataset.slapp).toBeUndefined();
  });

  it("⛔ en vanlig medlem som inte skrev posten får inte flytta den, och platsen säger varför", () => {
    render(<Vy />);
    fireEvent.dragStart(rad("Sams anteckning"), { dataTransfer: overforing() });
    expect(platsKnapp(BARN).dataset.slapp).toBe("nej");
    expect(platsKnapp(BARN).title).toBe("Du får inte flytta den här posten hit.");
  });

  it("släppt på en plats är raden borta direkt, servern flyttar i bakgrunden, och Ångra flyttar tillbaka", async () => {
    const onDela = vi.fn(async () => {});
    render(<Vy onDela={onDela} />);
    const d = overforing();
    fireEvent.dragStart(rad("Min anteckning"), { dataTransfer: d });
    fireEvent.dragOver(platsKnapp(BARN), { dataTransfer: d });
    fireEvent.drop(platsKnapp(BARN), { dataTransfer: d });
    // Raden är borta i samma varv som släppet, innan servern svarat.
    expect(screen.queryByText("Min anteckning")).toBeNull();
    await waitFor(() => expect(onDela).toHaveBeenCalledWith({ id: "p1", groupId: BARN, satt: "flytta" }));
    const besked = /** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-flyttad]"));
    expect(besked.textContent).toContain("Flyttad till Barnplan.");
    await act(async () => {
      fireEvent.click(within(besked).getByRole("button", { name: "Ångra" }));
    });
    await waitFor(() => expect(onDela).toHaveBeenLastCalledWith({ id: "p1", groupId: GRUPP, satt: "flytta" }));
    expect(screen.getByText("Min anteckning")).toBeTruthy();
  });

  it("⛔ ett nej från servern: raden kommer tillbaka och skälet står", async () => {
    const onDela = vi.fn(async () => {
      throw new Error("Platsen är arkiverad. Ingenting flyttades.");
    });
    render(<Vy onDela={onDela} />);
    const d = overforing();
    fireEvent.dragStart(rad("Min anteckning"), { dataTransfer: d });
    fireEvent.drop(platsKnapp(BARN), { dataTransfer: d });
    expect(await screen.findByText("Platsen är arkiverad. Ingenting flyttades.")).toBeTruthy();
    expect(screen.getByText("Min anteckning")).toBeTruthy();
  });

  it("⛔ en plats som inte tar emot raden gör ingenting när den släpps där", () => {
    const onDela = vi.fn(async () => {});
    render(<Vy onDela={onDela} />);
    const d = overforing();
    fireEvent.dragStart(rad("Min anteckning"), { dataTransfer: d });
    fireEvent.drop(platsKnapp(ANNAN), { dataTransfer: d });
    expect(onDela).not.toHaveBeenCalled();
    expect(screen.getByText("Min anteckning")).toBeTruthy();
  });
});

describe("⛔ ägaren på raden (#988)", () => {
  it("på gruppens plats: jag för ens egen och namnet för någon annans; i Mitt bibliotek ingen ägare", () => {
    const { unmount } = render(<Vy />);
    expect(within(rad("Min anteckning")).getByText("jag")).toBeTruthy();
    expect(within(rad("Sams anteckning")).getByText("Sam Svensson")).toBeTruthy();
    unmount();
    render(<Vy startPlats={MITT} poster={[post("m1", "Privat", KIM, { groupId: MITT })]} />);
    expect(within(rad("Privat")).queryByText("jag")).toBeNull();
  });
});
