import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { OpsEventList } from "../components/OpsEventList.jsx";

/**
 * 0.147.0 (cllp/ops-framework#451): två fel i panelen för en rad som visade sig när lifehub.app kopplade Klar till en påminnelse.
 *
 * 1. En panel öppnas av ett tryck och av inget annat. `OpsEventList` och `OpsCalendar` höll kvar id:t på raden som tryckts på, så när raden försvann
 *    ur listan (avbockad) och kom tillbaka under Avklarat öppnades panelen av sig själv, med Ångra, utan att någon rört raden.
 * 2. Knappraden hade ingen plats för ett fel och inget väntläge i sin egen rad: en `onClick` som avslogs gav en knapp som blev tryckbar igen och inget mer.
 *
 * ⛔ Provet gör det en person gör, med appens form: Klar bockar av (raden går ur `events`), fliken byts, raden finns igen. Varje "som förut" har sitt motsatta
 * fall i samma prov, så att ett prov inte blir grönt av att inget öppnas alls.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const NU = new Date(2026, 9, 26, 12);
const radpanel = () => /** @type {HTMLElement | null} */ (document.querySelector("[data-radpanel]"));

/** @returns {{ lofte: Promise<void>, klar: () => void, fall: (e: Error) => void }} */
function uppskjutet() {
  /** @type {() => void} */ let klar = () => {};
  /** @type {(e: Error) => void} */ let fall = () => {};
  const lofte = new Promise((res, rej) => {
    klar = () => res(undefined);
    fall = rej;
  });
  return { lofte: /** @type {Promise<void>} */ (lofte), klar, fall };
}

/**
 * Appens form: en källa med Klar. `utfall(id)` är det Klar gör; `bocka` är appens avbockning (raden byter lista).
 * @param {(id: string) => unknown} utfall
 */
const kallor = (utfall) => ({
  paminnelse: {
    etikett: "Påminnelse",
    atgarder: (/** @type {any} */ r) => [{ id: "klar", etikett: "Klar", pagarEtikett: "Bockar av…", onClick: () => utfall(r.id) }],
    dela: () => ({ skal: "Påminnelser delas inte ännu." }),
  },
});

const RADER = [{ id: "paminnelse:attest", title: "Attest större leverantörsfakturor", daysLeft: 1 }];

/**
 * Idag med flikarna Idag och Avklarat. Klar bockar av: raden ligger då under Avklarat i stället för under Idag, som i lifehub.app.
 * @param {{ ihop?: (id: string) => unknown }} props
 */
function Idag({ ihop }) {
  const [avbockade, setAvbockade] = useState(/** @type {string[]} */ ([]));
  const [flik, setFlik] = useState("idag");
  const synliga = RADER.filter((r) => (flik === "idag" ? !avbockade.includes(r.id) : avbockade.includes(r.id)));
  const klar = (/** @type {string} */ id) => {
    setAvbockade((a) => [...a, id]);
    return ihop ? ihop(id) : Promise.resolve();
  };
  return (
    <>
      <button type="button" onClick={() => setFlik("avklarat")}>Avklarat</button>
      <button type="button" onClick={() => setFlik("idag")}>Idag</button>
      <OpsEventList events={synliga} radkallor={kallor(klar)} />
    </>
  );
}

describe("⛔ #451: en panel öppnas bara av ett tryck (OpsEventList)", () => {
  it("Klar stänger panelen, och raden under Avklarat öppnar ingen panel av sig själv", async () => {
    const user = userEvent.setup();
    render(<Idag />);
    await user.click(screen.getByRole("button", { name: "Attest större leverantörsfakturor" }));
    expect(radpanel()).not.toBeNull();

    await user.click(within(/** @type {HTMLElement} */ (radpanel())).getByRole("button", { name: "Klar" }));
    await waitFor(() => expect(radpanel()).toBeNull());

    await user.click(screen.getByRole("button", { name: "Avklarat" }));
    // Raden finns nu i listan igen. Ingen har tryckt på den, så ingen panel.
    expect(screen.getByText("Attest större leverantörsfakturor")).toBeInTheDocument();
    await act(async () => {});
    expect(radpanel()).toBeNull();
    // Motsatsen i samma prov: ett tryck på raden öppnar den, så provet är inte grönt av att inget är tryckbart.
    await user.click(screen.getByRole("button", { name: "Attest större leverantörsfakturor" }));
    expect(radpanel()).not.toBeNull();
  });

  it("ett id som försvinner ur listan och kommer tillbaka öppnar ingen panel", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OpsEventList events={RADER} radkallor={kallor(() => {})} />);
    await user.click(screen.getByRole("button", { name: "Attest större leverantörsfakturor" }));
    expect(radpanel()).not.toBeNull();
    rerender(<OpsEventList events={[]} radkallor={kallor(() => {})} />);
    await waitFor(() => expect(radpanel()).toBeNull());
    rerender(<OpsEventList events={RADER} radkallor={kallor(() => {})} />);
    await act(async () => {});
    expect(radpanel()).toBeNull();
  });
});

describe("⛔ #451: knappraden, löftet i en åtgärd (OpsEventList)", () => {
  it("en åtgärd vars löfte lyckas stänger panelen, också när raden står kvar", async () => {
    const user = userEvent.setup();
    const klar = vi.fn(() => Promise.resolve());
    render(<OpsEventList events={RADER} radkallor={kallor(klar)} />);
    await user.click(screen.getByRole("button", { name: "Attest större leverantörsfakturor" }));
    await user.click(within(/** @type {HTMLElement} */ (radpanel())).getByRole("button", { name: "Klar" }));
    expect(klar).toHaveBeenCalledWith("paminnelse:attest");
    await waitFor(() => expect(radpanel()).toBeNull());
  });

  it("en åtgärd som inte ger ett löfte stänger inte panelen: den gör det direkt och källan avgör själv", async () => {
    const user = userEvent.setup();
    const klar = vi.fn();
    render(<OpsEventList events={RADER} radkallor={kallor(klar)} />);
    await user.click(screen.getByRole("button", { name: "Attest större leverantörsfakturor" }));
    await user.click(within(/** @type {HTMLElement} */ (radpanel())).getByRole("button", { name: "Klar" }));
    expect(klar).toHaveBeenCalledTimes(1);
    await act(async () => {});
    expect(radpanel()).not.toBeNull();
    expect(radpanel()?.querySelector("[data-knapprad-fel]")).toBeNull();
  });

  it("ett löfte som avslås visar felet i knappraden, panelen står kvar och knappen går att trycka på igen", async () => {
    const user = userEvent.setup();
    const klar = vi.fn(() => Promise.reject(new Error("Nätet föll, försök igen.")));
    const oklarat = vi.fn();
    window.addEventListener("unhandledrejection", oklarat);
    render(<OpsEventList events={RADER} radkallor={kallor(klar)} />);
    await user.click(screen.getByRole("button", { name: "Attest större leverantörsfakturor" }));
    const panel = /** @type {HTMLElement} */ (radpanel());
    await user.click(within(panel).getByRole("button", { name: "Klar" }));

    const fel = await within(panel).findByRole("alert");
    expect(fel.textContent).toContain("Nätet föll, försök igen.");
    // Samma ställe som skälet till att Dela saknas: ovanför knapparna, i knappraden.
    const rad = /** @type {HTMLElement} */ (panel.querySelector("[data-knapprad]"));
    expect(rad.contains(fel)).toBe(true);
    const knappar = /** @type {HTMLElement} */ (rad.querySelector("[data-knapprad-knappar]"));
    expect(fel.compareDocumentPosition(knappar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(radpanel()).not.toBeNull();
    expect(within(panel).getByRole("button", { name: "Klar" })).not.toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Klar" })).not.toHaveAttribute("aria-busy");
    // Avslagningen är tillvaratagen: den släpps inte vidare som ett okänt fel.
    await act(async () => {});
    expect(oklarat).not.toHaveBeenCalled();
    window.removeEventListener("unhandledrejection", oklarat);

    // Ett nytt försök tar bort det gamla felet medan det väntar.
    const nasta = uppskjutet();
    klar.mockImplementationOnce(() => nasta.lofte);
    await user.click(within(panel).getByRole("button", { name: "Klar" }));
    expect(within(panel).queryByRole("alert")).toBeNull();
    await act(async () => nasta.klar());
    await waitFor(() => expect(radpanel()).toBeNull());
  });

  it("ett avslag utan text får ett eget ord i stället för en tom ruta", async () => {
    const user = userEvent.setup();
    render(<OpsEventList events={RADER} radkallor={kallor(() => Promise.reject(undefined))} />);
    await user.click(screen.getByRole("button", { name: "Attest större leverantörsfakturor" }));
    const panel = /** @type {HTMLElement} */ (radpanel());
    await user.click(within(panel).getByRole("button", { name: "Klar" }));
    expect((await within(panel).findByRole("alert")).textContent).toBe("Det gick inte.");
  });

  it("knappen väntar synligt medan löftet pågår, med appens verb, och ett andra tryck gör ingenting", async () => {
    const user = userEvent.setup();
    const vantan = uppskjutet();
    const klar = vi.fn(() => vantan.lofte);
    render(<OpsEventList events={RADER} radkallor={kallor(klar)} />);
    await user.click(screen.getByRole("button", { name: "Attest större leverantörsfakturor" }));
    const panel = /** @type {HTMLElement} */ (radpanel());
    await user.click(within(panel).getByRole("button", { name: "Klar" }));
    const knapp = within(panel).getByRole("button", { name: /Bockar av/ });
    expect(knapp).toHaveAttribute("aria-busy", "true");
    fireEvent.click(knapp);
    expect(klar).toHaveBeenCalledTimes(1);
    expect(radpanel()).not.toBeNull();
    await act(async () => vantan.klar());
    await waitFor(() => expect(radpanel()).toBeNull());
  });

  it("en åtgärd med en adress har inget löfte att vänta på: panelen står kvar", async () => {
    const user = userEvent.setup();
    const kalla = { paminnelse: { etikett: "Påminnelse", atgarder: () => [{ id: "rutin", etikett: "Öppna rutinen", href: "/rutiner/attest" }] } };
    render(<OpsEventList events={RADER} radkallor={kalla} />);
    await user.click(screen.getByRole("button", { name: "Attest större leverantörsfakturor" }));
    expect(within(/** @type {HTMLElement} */ (radpanel())).getByRole("link", { name: "Öppna rutinen" })).toBeInTheDocument();
    expect(radpanel()?.querySelector("[data-knapprad-fel]")).toBeNull();
  });
});

const POSTER = [{ id: "paminnelse:attest", date: "2026-10-28", title: "Attest större leverantörsfakturor", not: "Påminnelse" }];
const oppnaDag = () => fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-28"]')));
const dagpanel = () => /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));

/**
 * Kalendern med en post som Klar tar bort ur `entries` och en knapp som lägger tillbaka den (Avklarat, i appens form).
 * @param {{ ihop?: (id: string) => unknown }} props
 */
function Kalender({ ihop }) {
  const [borta, setBorta] = useState(false);
  const klar = (/** @type {string} */ id) => {
    setBorta(true);
    return ihop ? ihop(id) : Promise.resolve();
  };
  return (
    <>
      <button type="button" onClick={() => setBorta(false)}>Lägg tillbaka</button>
      <OpsCalendar ariaLabel="Kalender" today={NU} entries={borta ? [] : POSTER} radkallor={kallor(klar)} />
    </>
  );
}

describe("⛔ #451: samma form i OpsCalendar", () => {
  it("Klar stänger panelen, och posten som kommer tillbaka öppnar ingen panel av sig själv", async () => {
    const user = userEvent.setup();
    render(<Kalender />);
    oppnaDag();
    await user.click(within(dagpanel()).getByRole("button", { name: "Attest större leverantörsfakturor" }));
    expect(radpanel()).not.toBeNull();
    await user.click(within(/** @type {HTMLElement} */ (radpanel())).getByRole("button", { name: "Klar" }));
    await waitFor(() => expect(radpanel()).toBeNull());

    await user.click(screen.getByRole("button", { name: "Lägg tillbaka" }));
    expect(within(dagpanel()).getByRole("button", { name: "Attest större leverantörsfakturor" })).toBeInTheDocument();
    await act(async () => {});
    expect(radpanel()).toBeNull();
    // Motsatsen: ett tryck öppnar den.
    await user.click(within(dagpanel()).getByRole("button", { name: "Attest större leverantörsfakturor" }));
    expect(radpanel()).not.toBeNull();
  });

  it("en åtgärd vars löfte lyckas stänger panelen, också när posten står kvar", async () => {
    const user = userEvent.setup();
    render(<OpsCalendar ariaLabel="Kalender" today={NU} entries={POSTER} radkallor={kallor(() => Promise.resolve())} />);
    oppnaDag();
    await user.click(within(dagpanel()).getByRole("button", { name: "Attest större leverantörsfakturor" }));
    await user.click(within(/** @type {HTMLElement} */ (radpanel())).getByRole("button", { name: "Klar" }));
    await waitFor(() => expect(radpanel()).toBeNull());
  });

  it("ett löfte som avslås visar felet i knappraden och panelen står kvar", async () => {
    const user = userEvent.setup();
    render(<OpsCalendar ariaLabel="Kalender" today={NU} entries={POSTER} radkallor={kallor(() => Promise.reject(new Error("Banken svarade inte.")))} />);
    oppnaDag();
    await user.click(within(dagpanel()).getByRole("button", { name: "Attest större leverantörsfakturor" }));
    const panel = /** @type {HTMLElement} */ (radpanel());
    await user.click(within(panel).getByRole("button", { name: "Klar" }));
    const fel = await within(panel).findByRole("alert");
    expect(fel.textContent).toContain("Banken svarade inte.");
    expect(/** @type {HTMLElement} */ (panel.querySelector("[data-knapprad]")).contains(fel)).toBe(true);
    expect(radpanel()).not.toBeNull();
  });
});

describe("⛔ #451: Dela får samma fel och väntläge, men stänger inte", () => {
  const delaKalla = (/** @type {() => unknown} */ dela) => ({ paminnelse: { etikett: "Påminnelse", dela: () => ({ onClick: dela }) } });

  it("ett Dela som avslås visar felet, och ett som lyckas lämnar panelen öppen", async () => {
    const user = userEvent.setup();
    const dela = vi.fn(() => Promise.reject(new Error("Länken kunde inte skapas.")));
    render(<OpsEventList events={RADER} radkallor={delaKalla(dela)} />);
    await user.click(screen.getByRole("button", { name: "Attest större leverantörsfakturor" }));
    const panel = /** @type {HTMLElement} */ (radpanel());
    await user.click(within(panel).getByRole("button", { name: "Dela" }));
    expect((await within(panel).findByRole("alert")).textContent).toContain("Länken kunde inte skapas.");

    dela.mockImplementationOnce(() => Promise.resolve());
    await user.click(within(panel).getByRole("button", { name: "Dela" }));
    await waitFor(() => expect(within(panel).queryByRole("alert")).toBeNull());
    await act(async () => {});
    expect(radpanel()).not.toBeNull();
  });
});

describe("⛔ #451: läspanelen för en extern post glömmer också sitt id", () => {
  const APPLE = [{ id: "ical:a1", date: "2026-10-28", title: "Tandläkare", extern: { kalla: "Från Apple, ändras i Apple" } }];

  it("en post som försvinner och kommer tillbaka öppnar ingen läspanel av sig själv", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OpsCalendar ariaLabel="Kalender" today={NU} entries={APPLE} />);
    oppnaDag();
    await user.click(within(dagpanel()).getByRole("button", { name: "Tandläkare" }));
    expect(document.querySelector("[data-externpanel]")).not.toBeNull();
    rerender(<OpsCalendar ariaLabel="Kalender" today={NU} entries={[]} />);
    await waitFor(() => expect(document.querySelector("[data-externpanel]")).toBeNull());
    rerender(<OpsCalendar ariaLabel="Kalender" today={NU} entries={APPLE} />);
    await act(async () => {});
    expect(document.querySelector("[data-externpanel]")).toBeNull();
    // Motsatsen: ett tryck öppnar den.
    await user.click(within(dagpanel()).getByRole("button", { name: "Tandläkare" }));
    expect(document.querySelector("[data-externpanel]")).not.toBeNull();
  });
});
