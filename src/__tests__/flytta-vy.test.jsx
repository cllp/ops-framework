import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createFlyttaService } from "../node/flytta.js";
import { flyttmal } from "../lib/flytta.js";
import { medlemskapsId } from "../lib/grupp.js";
import { byggGruppkalender, byggKalenderpost, byggMinKalender, gruppkalendernyckel, postHandelseId, postTillHandelse } from "../lib/kalendrar.js";

/**
 * 0.123.0 (cllp/lifehub.app#371): "Flytta till kalender" i händelsepanelen.
 *
 * ⛔ Händelsen: CP 2026-10-19: "Vidare borde det gå att flytta en händelse till en annan kalender." Provet gör det en person gör: trycker på
 * Flytta, väljer en kalender, bekräftar när posten ska bli en gruppens händelse, och läser sedan DATAN som tjänsten lämnade (posten, händelsen),
 * inte bara att en funktion anropades. Tjänsten är den riktiga (`createFlyttaService` över ett minne), så provet mäter hela kedjan panel, lista,
 * anrop och prövning. Utseendet mäts i webbläsaren (check-skalyta).
 */

const mk = (/** @type {string} */ id, extra = {}) => byggMinKalender({ id, namn: id === "privat" ? "Privat" : "Jobb", farg: 3, ikon: "hjarta", ...extra });
const gk = (/** @type {string} */ groupId, /** @type {string} */ id, namn, extra = {}) => ({ ...byggGruppkalender({ id, namn: { sv: namn }, farg: 2, ikon: "kalender", groupId, ...extra }), id: gruppkalendernyckel(groupId, id) });
const raden = (/** @type {any} */ g) => ({ ...g, id: g.id.split("|")[1] });

const ANNA = "uid-anna";

/** @param {{ medlem?: boolean, handelser?: any[] }} [d] */
function databas(d = {}) {
  const gruppRader = [gk("bolaget", "kalender", "Kalender", { forvald: true }), gk("bolaget", "barnveckor", "Barnveckor", { ordning: 10 })];
  const minne = createMemorySource({
    handelser: d.handelser ?? [],
    memberships: d.medlem === false ? [] : [{ id: medlemskapsId(ANNA, "bolaget"), userId: ANNA, groupId: "bolaget", roll: "medlem", typ: "person", status: "aktiv" }],
    gruppkalendrar: gruppRader,
    [`users/${ANNA}/kalenderposter`]: [{ id: "tandlakare", ...byggKalenderpost({ id: "tandlakare", kalenderId: "privat", titel: "Tandläkaren", start: "2026-10-27T09:00", slut: "2026-10-27T10:00" }) }],
    [`users/${ANNA}/minaKalendrar`]: [mk("privat", { forvald: true }), mk("jobb", { ordning: 10 })],
  });
  const tjanst = createFlyttaService({
    kalla: minne,
    samlingar: { handelser: "handelser" },
    byggHandelse: ({ post, uid, nu }) => ({ typ: "annat", rubrik: post.titel, skapadAv: { uid }, skapad: nu.toISOString(), arkiverad: false }),
  });
  const grupp = { id: "bolaget", namn: "Bolaget", kalendrar: gruppRader.map(raden) };
  return { minne, tjanst, grupp, mina: [mk("privat", { forvald: true }), mk("jobb", { ordning: 10 })] };
}

/** Panelen för Annas post, kopplad som en app kopplar den: listan ur `flyttmal`, och `onFlytta` som anropar rätt serveranrop efter `atgard`. */
function PostPanel({ db, onKlar }) {
  const [post, setPost] = useState(/** @type {any} */ (null));
  const [, ladda] = useState(0);
  // Posten läses ur databasen vid varje rendering efter en flytt, som en levande läsning.
  db.minne.read(`users/${ANNA}/kalenderposter`, "tandlakare").then((p) => { if (JSON.stringify(p) !== JSON.stringify(post)) setPost(p); });
  const handelse = post ? postTillHandelse(post, db.mina) : null;
  const mal = post ? flyttmal({ fran: { slag: "post", kalenderId: post.kalenderId }, mina: db.mina, grupper: [db.grupp] }) : [];
  return (
    <OpsHandelsePanel
      handelse={handelse}
      onTillbaka={() => {}}
      flyttmal={mal}
      onFlytta={async (m) => {
        const r =
          m.atgard === "byt"
            ? await db.tjanst.flyttaPost({ uid: ANNA, postId: "tandlakare", tillKalenderId: m.id })
            : await db.tjanst.goraPostTillHandelse({ uid: ANNA, postId: "tandlakare", groupId: /** @type {string} */ (m.groupId), tillKalenderId: m.id });
        ladda((n) => n + 1);
        onKlar?.(r);
      }}
    />
  );
}

describe("OpsHandelsePanel: Flytta till kalender, hela kedjan över en riktig tjänst", () => {
  it("byte mellan egna kalendrar sker direkt, utan bekräftelse, och posten ligger i den nya kalendern", async () => {
    const user = userEvent.setup();
    const db = databas();
    render(<PostPanel db={db} />);
    await user.click(await screen.findByRole("button", { name: "Flytta till kalender" }));
    const ruta = await screen.findByRole("dialog", { name: "Flytta till kalender" });
    await user.click(within(ruta).getByRole("button", { name: "Jobb" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((await db.minne.read(`users/${ANNA}/kalenderposter`, "tandlakare")).kalenderId).toBe("jobb");
    // Inget bekräftelsesteg för ett byte: ingen fråga om gruppen.
    expect(await db.minne.list("handelser")).toEqual([]);
    await waitFor(() => expect(document.querySelector("[data-handelsekalender]")?.textContent).toBe("Jobb"));
  });

  it("listan har mina andra kalendrar under 'Mina kalendrar' och gruppens kalendrar under gruppens namn", async () => {
    const user = userEvent.setup();
    render(<PostPanel db={databas()} />);
    await user.click(await screen.findByRole("button", { name: "Flytta till kalender" }));
    const ruta = await screen.findByRole("dialog", { name: "Flytta till kalender" });
    expect(within(within(ruta).getByRole("region", { name: "Mina kalendrar" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["Jobb"]);
    expect(within(within(ruta).getByRole("region", { name: "Bolaget" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["Kalender", "Barnveckor"]);
    // Kalendern posten ligger i erbjuds inte.
    expect(within(ruta).queryByRole("button", { name: "Privat" })).toBeNull();
  });

  it("⛔ en post till en gruppkalender frågar först, med gruppens namn och att medlemmarna ser den, och ändrar inget före bekräftelsen", async () => {
    const user = userEvent.setup();
    const db = databas();
    render(<PostPanel db={db} />);
    await user.click(await screen.findByRole("button", { name: "Flytta till kalender" }));
    const ruta = await screen.findByRole("dialog", { name: "Flytta till kalender" });
    await user.click(within(within(ruta).getByRole("region", { name: "Bolaget" })).getByRole("button", { name: "Barnveckor" }));
    const fraga = await screen.findByRole("dialog", { name: "Flytta till gruppens kalender?" });
    expect(within(fraga).getByText(/Tandläkaren blir en händelse i Bolaget, i kalendern Barnveckor\. Gruppens medlemmar ser den då\. Den tas bort från din egen kalender\./)).toBeInTheDocument();
    // Ingenting har hänt än: posten finns, ingen händelse.
    expect(await db.minne.read(`users/${ANNA}/kalenderposter`, "tandlakare")).not.toBeNull();
    expect(await db.minne.list("handelser")).toEqual([]);
    // Avbryt går tillbaka till listan och ändrar fortfarande inget.
    await user.click(within(fraga).getByRole("button", { name: "Avbryt" }));
    expect(await screen.findByRole("dialog", { name: "Flytta till kalender" })).toBeInTheDocument();
    expect(await db.minne.list("handelser")).toEqual([]);
    expect(await db.minne.read(`users/${ANNA}/kalenderposter`, "tandlakare")).not.toBeNull();
  });

  it("⛔ bekräftelsen gör posten till en gruppens händelse och tar bort posten, i ett svep", async () => {
    const user = userEvent.setup();
    const db = databas();
    const klar = vi.fn();
    render(<PostPanel db={db} onKlar={klar} />);
    await user.click(await screen.findByRole("button", { name: "Flytta till kalender" }));
    const ruta = await screen.findByRole("dialog", { name: "Flytta till kalender" });
    await user.click(within(within(ruta).getByRole("region", { name: "Bolaget" })).getByRole("button", { name: "Barnveckor" }));
    const fraga = await screen.findByRole("dialog", { name: "Flytta till gruppens kalender?" });
    await user.click(within(fraga).getByRole("button", { name: "Flytta" }));
    await waitFor(() => expect(klar).toHaveBeenCalledTimes(1));
    expect(klar).toHaveBeenCalledWith({ atgard: "konvertera", handelseId: "tandlakare", groupId: "bolaget", kalenderId: "barnveckor" });
    const h = await db.minne.read("handelser", "tandlakare");
    expect(h).toMatchObject({ rubrik: "Tandläkaren", groupId: "bolaget", kalenderId: "barnveckor", datum: "2026-10-27", tid: "09:00", slutTid: "10:00" });
    expect(await db.minne.read(`users/${ANNA}/kalenderposter`, "tandlakare")).toBeNull();
  });

  it("⛔ nekas flytten visas orsaken, rutan står kvar och inget ändrades (inte längre medlem i gruppen)", async () => {
    const user = userEvent.setup();
    const db = databas({ medlem: false });
    render(<PostPanel db={db} />);
    await user.click(await screen.findByRole("button", { name: "Flytta till kalender" }));
    const ruta = await screen.findByRole("dialog", { name: "Flytta till kalender" });
    await user.click(within(within(ruta).getByRole("region", { name: "Bolaget" })).getByRole("button", { name: "Kalender" }));
    const fraga = await screen.findByRole("dialog", { name: "Flytta till gruppens kalender?" });
    await user.click(within(fraga).getByRole("button", { name: "Flytta" }));
    const larm = await within(fraga).findByRole("alert");
    expect(larm.textContent).toMatch(/Det gick inte att flytta: .*du är inte aktiv medlem i gruppen "bolaget"/);
    expect(screen.getByRole("dialog", { name: "Flytta till gruppens kalender?" })).toBeInTheDocument();
    expect(await db.minne.list("handelser")).toEqual([]);
    expect(await db.minne.read(`users/${ANNA}/kalenderposter`, "tandlakare")).not.toBeNull();
  });
});

const HANDELSE = { id: "h1", titel: "GSEMS", datum: "2026-10-30", grupp: "Bolaget", kalender: { namn: "Kalender", farg: /** @type {const} */ (2) } };
const gruppen = { id: "bolaget", namn: "Bolaget", kalendrar: [gk("bolaget", "kalender", "Kalender", { forvald: true }), gk("bolaget", "barnveckor", "Barnveckor", { ordning: 10 })].map(raden) };
const egna = [mk("privat", { forvald: true }), mk("jobb", { ordning: 10 })];

describe("OpsHandelsePanel: en händelse i en gruppkalender", () => {
  it("den som får redigera den kan flytta den till gruppens andra kalendrar, direkt", async () => {
    const user = userEvent.setup();
    const onFlytta = vi.fn();
    const mal = flyttmal({ fran: { slag: "handelse", groupId: "bolaget", kalenderId: "kalender" }, mina: egna, grupper: [gruppen], farRedigera: true });
    render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal={mal} onFlytta={onFlytta} />);
    await user.click(screen.getByRole("button", { name: "Flytta till kalender" }));
    const ruta = await screen.findByRole("dialog", { name: "Flytta till kalender" });
    await user.click(within(ruta).getByRole("button", { name: "Barnveckor" }));
    expect(onFlytta).toHaveBeenCalledTimes(1);
    expect(onFlytta.mock.calls[0][0]).toMatchObject({ id: "barnveckor", atgard: "byt", groupId: "bolaget" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("⛔ GRUPPKALENDER TILL EGEN KALENDER ERBJUDS INTE: i rutan finns ingen rubrik 'Mina kalendrar' och ingen av mina kalendrar", async () => {
    const user = userEvent.setup();
    const mal = flyttmal({ fran: { slag: "handelse", groupId: "bolaget", kalenderId: "kalender" }, mina: egna, grupper: [gruppen], farRedigera: true });
    render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal={mal} onFlytta={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Flytta till kalender" }));
    const ruta = await screen.findByRole("dialog", { name: "Flytta till kalender" });
    expect(within(ruta).queryByRole("region", { name: "Mina kalendrar" })).toBeNull();
    expect(within(ruta).queryByRole("button", { name: "Privat" })).toBeNull();
    expect(within(ruta).queryByRole("button", { name: "Jobb" })).toBeNull();
    expect(within(ruta).getAllByRole("button").map((b) => b.textContent).filter((t) => t && t !== "Stäng")).toEqual(["Barnveckor"]);
  });

  it("⛔ den som inte får redigera den ser ingen Flytta-knapp", () => {
    const mal = flyttmal({ fran: { slag: "handelse", groupId: "bolaget", kalenderId: "kalender" }, mina: egna, grupper: [gruppen], farRedigera: false });
    render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal={mal} onFlytta={() => {}} />);
    expect(screen.queryByRole("button", { name: "Flytta till kalender" })).toBeNull();
  });
});

describe("OpsHandelsePanel: Flytta, små fall", () => {
  const post = [{ id: "jobb", namn: "Jobb", farg: /** @type {const} */ (3), ikon: "hjarta", atgard: /** @type {const} */ ("byt") }];

  it("utan flyttmal, med en tom lista eller utan val ritas ingen knapp", () => {
    const { rerender } = render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} />);
    expect(screen.queryByRole("button", { name: "Flytta till kalender" })).toBeNull();
    rerender(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal={[]} onFlytta={() => {}} />);
    expect(screen.queryByRole("button", { name: "Flytta till kalender" })).toBeNull();
  });

  it("val utan onFlytta är en död knapp, och panelen kastar", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal={post} />)).toThrow(/onFlytta saknas/);
    expect(() => render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal={post} onFlytta="ja" />)).toThrow(/onFlytta måste vara en funktion/);
    expect(() => render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal="x" />)).toThrow(/flyttmal måste vara en lista/);
    expect(() => render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal={[{ id: "x", namn: "X", atgard: "konvertera" }]} onFlytta={() => {}} />)).toThrow(/gruppnamn/);
    expect(() => render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal={[{ id: "x" }]} onFlytta={() => {}} />)).toThrow(/ett flyttmal har formen/);
    spy.mockRestore();
  });

  it("⛔ ett dubbeltryck skickar EN flytt, och orsaken skrivs ut när den faller", async () => {
    const user = userEvent.setup();
    /** @type {(v?: unknown) => void} */
    let slapp = () => {};
    const onFlytta = vi.fn(() => new Promise((_, avvisa) => { slapp = () => avvisa(new Error("Servern svarade nej")); }));
    render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal={post} onFlytta={onFlytta} />);
    await user.click(screen.getByRole("button", { name: "Flytta till kalender" }));
    const ruta = await screen.findByRole("dialog", { name: "Flytta till kalender" });
    const jobb = within(ruta).getByRole("button", { name: "Jobb" });
    await user.dblClick(jobb);
    expect(onFlytta).toHaveBeenCalledTimes(1);
    slapp();
    const larm = await within(ruta).findByRole("alert");
    expect(larm.textContent).toBe("Det gick inte att flytta: Servern svarade nej");
    expect(screen.getByRole("dialog", { name: "Flytta till kalender" })).toBeInTheDocument();
  });

  it("orden följer språket, och appens egna etiketter vinner", async () => {
    const user = userEvent.setup();
    render(<OpsHandelsePanel handelse={HANDELSE} onTillbaka={() => {}} flyttmal={[{ id: "kalender", namn: "Main", farg: 2, ikon: "kalender", atgard: "konvertera", groupId: "g", gruppnamn: "Company" }]} onFlytta={() => {}} sprak="en" flyttaEtikett="Relocate" />);
    await user.click(screen.getByRole("button", { name: "Relocate" }));
    const ruta = await screen.findByRole("dialog", { name: "Relocate" });
    expect(within(ruta).getByRole("region", { name: "Company" })).toBeInTheDocument();
    await user.click(within(ruta).getByRole("button", { name: "Main" }));
    const fraga = await screen.findByRole("dialog", { name: "Move to the group's calendar?" });
    expect(within(fraga).getByText(/GSEMS becomes an event in Company, in the calendar Main\. The group's members will then see it\./)).toBeInTheDocument();
    expect(within(fraga).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
