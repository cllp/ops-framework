import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { OpsKalendrar } from "../components/OpsKalendrar.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { byggKalenderdelning, deladKalenderTillVal, deladPostTillHandelse, deladPostTillRad, deladeKalendrar, panelForDeladPost } from "../lib/kalenderdelning.js";
import { byggKalenderpost, byggMinKalender } from "../lib/kalendrar.js";

/*
 * 0.154.0 (cllp/lifehub.app#485): Dela i Hantera kalendrar, och den delade kalendern i mottagarens lista Kalendrar.
 * jsdom kör ingen CSS: hur det SER UT mäts i Chromium (`check-skalyta`, avsnittet om kalenderdelning, 390 och 1280 px).
 */

const A = "uid-anna";
const B = "uid-bo";
const MINA = [byggMinKalender({ id: "barnveckor", namn: "Barnveckor", farg: 3, ikon: "hus" }), byggMinKalender({ id: "privat", namn: "Privat", farg: 2, ikon: "hjarta" })];
const PERSONER = [
  { uid: B, namn: "Bo" },
  { uid: "uid-cecilia", namn: "Cecilia" },
];

/** Hantera kalendrar med delning, där appens onDela och onSlutaDela skriver i en lista som ritas om. */
function Vy({ start = /** @type {any[]} */ ([]), onDela = vi.fn(), onSlutaDela = vi.fn(), mina = MINA, sprak = /** @type {string | undefined} */ (undefined) }) {
  const [delningar, setDelningar] = useState(start);
  return (
    <OpsKalendrar
      gruppens={[]}
      mina={mina}
      sprak={sprak}
      groupId="familjen"
      kanAndraGruppens={false}
      onSparaGruppens={() => {}}
      onSparaMina={() => {}}
      delning={{
        delningar,
        grupp: { id: "familjen", namn: "Familjen" },
        personer: PERSONER,
        onDela: async (kalenderId, m) => {
          await onDela(kalenderId, m);
          const d = byggKalenderdelning({ agare: A, kalenderId, ...("person" in m ? { person: m.person } : { groupId: m.grupp }) });
          setDelningar((l) => [...l.filter((x) => x.id !== d.id), d]);
        },
        onSlutaDela: async (d) => {
          await onSlutaDela(d);
          setDelningar((l) => l.filter((x) => x.id !== d.id));
        },
      }}
    />
  );
}

const oppnaDela = async (/** @type {string} */ namn) => {
  fireEvent.click(screen.getByRole("button", { name: `Dela ${namn}` }));
  return /** @type {HTMLElement} */ (await screen.findByRole("dialog", { name: `Dela ${namn}` }));
};

describe("Dela i Hantera kalendrar", () => {
  it("utan delning finns ingen Dela-knapp och texten säger att kalendrarna är dina", () => {
    render(<OpsKalendrar gruppens={[]} mina={MINA} groupId="g" kanAndraGruppens={false} onSparaGruppens={() => {}} onSparaMina={() => {}} />);
    expect(screen.queryByRole("button", { name: /^Dela / })).toBeNull();
    expect(screen.getByText("Dina egna kalendrar syns bara för dig. Poster i dem kan blockera din tillgänglighet.")).toBeTruthy();
  });

  it("varje egen kalender får Dela, och dialogen säger först att den inte delas med någon och hur en delning fungerar", async () => {
    render(<Vy />);
    expect(screen.getAllByRole("button", { name: /^Dela / })).toHaveLength(2);
    const dialog = await oppnaDela("Barnveckor");
    expect(within(dialog).getByText("Delas inte med någon.")).toBeTruthy();
    expect(within(dialog).getByText("Den du delar med ser händelserna men kan inte ändra dem.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Dela med Familjen" })).toBeTruthy();
  });

  it("dela med gruppen och en person: raderna syns i listan, och raden i Hantera kalendrar säger Delas med 2", async () => {
    const onDela = vi.fn(async () => {});
    render(<Vy onDela={onDela} />);
    const dialog = await oppnaDela("Barnveckor");
    fireEvent.click(within(dialog).getByRole("button", { name: "Dela med Familjen" }));
    await waitFor(() => expect(onDela).toHaveBeenCalledWith("barnveckor", { grupp: "familjen" }));
    expect(await within(dialog).findByText("Hela gruppen, bara läsning")).toBeTruthy();
    // Delas den redan med gruppen finns ingen knapp för att dela med den igen.
    expect(within(dialog).queryByRole("button", { name: "Dela med Familjen" })).toBeNull();

    const dela = within(dialog).getByRole("button", { name: "Dela" });
    expect(dela).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Bo" }));
    await waitFor(() => expect(dela).not.toBeDisabled());
    fireEvent.click(dela);
    await waitFor(() => expect(onDela).toHaveBeenCalledWith("barnveckor", { person: B }));
    await waitFor(() => expect(dialog.querySelectorAll("[data-kalenderdelning-rad]")).toHaveLength(2));
    expect(within(dialog).getByText("Bo")).toBeTruthy();
    expect(document.querySelector('[data-kalenderrad="barnveckor"] [data-kalenderrad-marke]')?.textContent).toBe("Förvald · Delas med 2");
    expect(document.querySelector('[data-kalenderrad="privat"] [data-kalenderrad-marke]')).toBeNull();
  });

  it("Sluta dela tar bort raden, och ett fel står i dialogen utan att raden försvinner", async () => {
    const start = [byggKalenderdelning({ agare: A, kalenderId: "barnveckor", person: B })];
    let gang = 0;
    const onSlutaDela = vi.fn(async () => {
      gang += 1;
      if (gang === 1) throw new Error("Nätet svarade inte.");
    });
    render(<Vy start={start} onSlutaDela={onSlutaDela} />);
    const dialog = await oppnaDela("Barnveckor");
    fireEvent.click(within(dialog).getByRole("button", { name: "Sluta dela med Bo" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nätet svarade inte.");
    expect(dialog.querySelectorAll("[data-kalenderdelning-rad]")).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Sluta dela med Bo" }));
    await waitFor(() => expect(dialog.querySelectorAll("[data-kalenderdelning-rad]")).toHaveLength(0));
    expect(within(dialog).getByText("Delas inte med någon.")).toBeTruthy();
    expect(within(dialog).queryByRole("alert")).toBeNull();
  });

  it("delas kalendern med en annan grupp säger knappen i stället, och raden säger att det är en grupp i taget", async () => {
    render(<Vy start={[byggKalenderdelning({ agare: A, kalenderId: "barnveckor", groupId: "bolaget" })]} />);
    const dialog = await oppnaDela("Barnveckor");
    expect(within(dialog).getByRole("button", { name: "Dela med Familjen i stället" })).toBeTruthy();
    expect(within(dialog).getByText(/En kalender delas med en grupp i taget\./)).toBeTruthy();
  });
});

describe("den delade kalendern hos mottagaren: en rad bland de andra, som går att dölja", () => {
  it("Barnveckor står under Delade med mig med ägarens namn, posten ritas, och växeln döljer den", async () => {
    const delningar = [byggKalenderdelning({ agare: A, kalenderId: "barnveckor", person: B })];
    const [delad] = deladeKalendrar(delningar, { uid: B, groupId: "familjen" });
    const rad = deladKalenderTillVal(MINA[0], delad, { agarnamn: "Anna" });
    const post = byggKalenderpost({ id: "v45", kalenderId: "barnveckor", titel: "Barnen hos Anna", start: "2026-10-12", slut: "2026-10-12", heldag: true });
    const varden = new Map();
    render(
      <OpsCalendar
        ariaLabel="Kalender"
        today={new Date(2026, 9, 5, 12)}
        monthsBack={0}
        monthsForward={0}
        entries={[deladPostTillRad(post, rad, A)]}
        kalendrar={[{ id: "mina:privat", namn: "Privat", farg: 2 }, rad]}
        kalenderMinne="bo:familjen"
        onOppnaHandelse={vi.fn()}
        lagring={{ getItem: (n) => varden.get(n) ?? null, setItem: (n, v) => void varden.set(n, v) }}
      />,
    );
    const dagen = () => /** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]')).getAttribute("aria-label");
    expect(dagen()).toMatch(/Barnen hos Anna|1 post|1 händelse/);
    fireEvent.click(screen.getByRole("button", { name: /^Kalendrar: / }));
    const lista = await screen.findByRole("dialog", { name: "Kalendrar" });
    const sektion = /** @type {HTMLElement} */ (lista.querySelector('[data-kalendersektion="Delade med mig"]'));
    expect(within(sektion).getByText("Delad av Anna. Bara läsning")).toBeTruthy();
    const vaxel = within(sektion).getByRole("switch", { name: "Barnveckor" });
    expect(vaxel).toBeChecked();
    const fore = dagen();
    fireEvent.click(vaxel);
    await waitFor(() => expect(within(sektion).getByRole("switch", { name: "Barnveckor" })).not.toBeChecked());
    expect(dagen()).not.toBe(fore);
    expect([...varden.values()].join("")).toContain(rad.id);
  });
});

describe("granskningen av PR 468: arkiverade rader, språket, felen och panelen", () => {
  it("⛔ en arkiverad kalender med delningar säger det, och dialogen har bara Sluta dela", async () => {
    const mina = [MINA[0], byggMinKalender({ id: "gammal", namn: "Gammal", farg: 1, ikon: "bok", arkiverad: true })];
    render(<Vy mina={mina} start={[byggKalenderdelning({ agare: A, kalenderId: "gammal", person: B })]} />);
    const rad = /** @type {HTMLElement} */ (document.querySelector('[data-arkiverad-rad="gammal"]'));
    expect(within(rad).getByText("Delas med 1")).toBeTruthy();
    fireEvent.click(within(rad).getByRole("button", { name: "Dela Gammal" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela Gammal" });
    expect(within(dialog).getByText("Kalendern är arkiverad och delas inte längre. Sluta dela tar bort raderna.")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /^Dela med / })).toBeNull();
    expect(within(dialog).queryByRole("combobox")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sluta dela med Bo" }));
    await waitFor(() => expect(dialog.querySelectorAll("[data-kalenderdelning-rad]")).toHaveLength(0));
    expect(rad.querySelector("[data-kalenderrad-marke]")).toBeNull();
  });

  it("på engelska: Share, Shared with, hjälptexten och dialogen", async () => {
    render(<Vy sprak="en" start={[byggKalenderdelning({ agare: A, kalenderId: "barnveckor", person: B })]} />);
    expect(screen.getByText("Your own calendars are visible to you and to those you share them with. Entries in them can block your availability.")).toBeTruthy();
    expect(document.querySelector('[data-kalenderrad="barnveckor"] [data-kalenderrad-marke]')?.textContent).toBe("Default · Shared with 1");
    fireEvent.click(screen.getByRole("button", { name: "Share Barnveckor" }));
    expect(await screen.findByRole("dialog", { name: "Share Barnveckor" })).toBeTruthy();
  });

  it("⛔ ett nej från reglerna står som en begriplig mening i dialogen", async () => {
    const onDela = vi.fn(async () => {
      throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
    });
    render(<Vy onDela={onDela} />);
    const dialog = await oppnaDela("Barnveckor");
    fireEvent.click(within(dialog).getByRole("button", { name: "Dela med Familjen" }));
    const fel = await within(dialog).findByRole("alert");
    expect(fel).toHaveTextContent("Det gick inte. Kalendern kan vara arkiverad, eller så är du inte längre med i gruppen.");
    expect(fel.textContent).not.toMatch(/permissions/);
  });

  it("⛔ en delad post öppnas i panelen utan Redigera, Flytta och appens egna knappar; en egen post har dem", () => {
    const post = byggKalenderpost({ id: "v45", kalenderId: "barnveckor", titel: "Barnen hos Anna", start: "2026-10-12", slut: "2026-10-12", heldag: true });
    const rad = { id: `delad:${A}:barnveckor`, namn: "Barnveckor", farg: 3 };
    const handelse = deladPostTillHandelse(post, rad, A);
    const props = {
      onTillbaka: () => {},
      onRedigera: () => {},
      flyttmal: [{ id: "privat", namn: "Privat", farg: 2, ikon: "kalender", atgard: "byt" }],
      onFlytta: () => {},
      atgarder: <button type="button">Ta bort</button>,
    };
    const { unmount } = render(<OpsHandelsePanel handelse={handelse} {...props} />);
    // Grundläget: utan hjälpfunktionen ritas knapparna (provet ser att de finns innan det ser att de saknas).
    expect(screen.getByRole("button", { name: "Redigera" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Flytta till kalender/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ta bort" })).toBeTruthy();
    unmount();
    render(<OpsHandelsePanel handelse={handelse} {...panelForDeladPost(handelse.id, props)} />);
    expect(screen.getByText("Barnen hos Anna")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Flytta till kalender/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ta bort" })).toBeNull();
  });
});
