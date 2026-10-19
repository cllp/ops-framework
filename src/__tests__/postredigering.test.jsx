import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell, useOppnaSkapa } from "../components/OpsAppShell.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { postHandelseId, postIdUrHandelseId, postTillHandelse } from "../lib/kalendrar.js";

/**
 * 0.123.0 (cllp/lifehub.app#371): att ändra en post i en egen kalender, i samma formulär som en händelse.
 *
 * ⛔ Händelsen: CP 2026-10-19: "Det går dock inte att ändra en händelse." Efter 0.120.0 öppnades en post i panelen men bara för läsning. Pennan är
 * panelens `onRedigera` (den fanns redan), och det som saknades var skalets redigeringsläge för en post: id:t `post~<id>`, väljaren med bara mina
 * kalendrar, ingen typ och "Blockerar tillgänglighet" ifylld. Provet gör det en person gör: trycker på pennan, ser formuläret med postens värden,
 * ändrar och sparar, och läser sedan den ändrade posten i panelen.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const nav = [{ href: "/", label: "Idag" }];
const kalendrar = {
  gruppens: [
    { id: "styrelse", namn: { sv: "Styrelse" }, farg: 1, ikon: "kalender", forvald: true, ordning: 0, arkiverad: false },
    { id: "resor", namn: { sv: "Resor" }, farg: 2, ikon: "kalender", forvald: false, ordning: 10, arkiverad: false },
  ],
  mina: [
    { id: "privat", namn: "Privat", farg: 5, ikon: "hjarta", ordning: 0, forvald: true, iFlodet: false, arkiverad: false },
    { id: "jobb", namn: "Jobb", farg: 3, ikon: "portfolj", ordning: 10, forvald: false, iFlodet: false, arkiverad: false },
  ],
};
const POST = { id: "tandlakare", kalenderId: "privat", titel: "Tandläkaren", beskrivning: "", plats: "", start: "2026-10-27T09:00", slut: "2026-10-27T10:00", heldag: false, blockerar: true };

/** @param {{ tillat?: boolean, handelse?: boolean }} [p] */
function App({ tillat = true, handelse = false } = {}) {
  const [poster, setPoster] = useState([POST]);
  const [handelser, setHandelser] = useState(handelse ? [{ id: "h1", rubrik: "Styrelsemöte", datum: "2026-10-12", typ: "mote", kalenderId: "resor", kravSvar: true }] : []);
  /** @type {(id: string) => any} */
  const hook = (id) => {
    const pid = postIdUrHandelseId(id);
    if (pid !== null) {
      const p = poster.find((x) => x.id === pid);
      return p ? { laddar: false, finns: true, kalenderId: p.kalenderId, blockerar: p.blockerar } : { laddar: false, finns: false };
    }
    const h = handelser.find((x) => x.id === id);
    return h ? { laddar: false, finns: true, typ: h.typ, kalenderId: h.kalenderId, kravSvar: h.kravSvar } : { laddar: false, finns: false };
  };
  function Form(/** @type {any} */ p) {
    const pid = postIdUrHandelseId(p.redigera ?? "");
    const post = poster.find((x) => x.id === pid);
    const [titel, setTitel] = useState(post?.titel ?? "");
    return (
      <form
        id={p.formId}
        aria-label="Formulär"
        onSubmit={(e) => {
          e.preventDefault();
          if (pid !== null) setPoster((rs) => rs.map((x) => (x.id === pid ? { ...x, titel, kalenderId: p.kalender.id, blockerar: p.blockerar } : x)));
          else setHandelser((rs) => rs.map((x) => (x.id === p.redigera ? { ...x, rubrik: titel, kalenderId: p.kalender.id } : x)));
          p.onKlar();
        }}
      >
        <label>
          Titel
          <input value={titel} onChange={(e) => setTitel(e.target.value)} />
        </label>
        <p data-vals="">{`${p.typ}|${p.kalender?.id}|${p.kalender?.slag}|${p.blockerar}|${p.kravSvar}|${p.redigera}`}</p>
      </form>
    );
  }
  function Panel({ id, onTillbaka }) {
    const oppna = useOppnaSkapa();
    const pid = postIdUrHandelseId(id);
    const post = pid === null ? null : poster.find((x) => x.id === pid);
    const h = handelser.find((x) => x.id === id);
    const vy = post ? postTillHandelse(post, kalendrar.mina) : h ? { id, titel: h.rubrik, datum: h.datum } : null;
    return <OpsHandelsePanel handelse={vy} onTillbaka={onTillbaka} onRedigera={tillat ? () => oppna("handelse", { id }) : undefined} />;
  }
  return (
    <OpsAppShell
      brand="Ops"
      nav={nav}
      activeHref="/"
      grupper={{ lista: [{ id: "g1", namn: "CPS AB", roll: "agare" }], aktiv: "g1", onValj: () => {} }}
      handelsepanel={{ rita: ({ id, onTillbaka }) => <Panel id={id} onTillbaka={onTillbaka} /> }}
      skapa={{
        sparaEtikett: "Spara",
        lage: "g1",
        handelse: { form: Form, katalog: "handelsetyper", kalendrar, redigera: hook },
        kataloger: [{ id: "handelsetyper", kategorier: [{ id: "mote", namn: { sv: "Möte" }, ordning: 0 }] }],
      }}
    >
      <p>appens vy</p>
    </OpsAppShell>
  );
}

const param = (/** @type {string} */ n) => new URL(window.location.href).searchParams.get(n);
const POSTID = postHandelseId("tandlakare");

async function oppnaPennan() {
  const user = userEvent.setup();
  window.history.replaceState(null, "", `/?handelse=${encodeURIComponent(POSTID)}`);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Redigera" }));
  const p = await screen.findByRole("region", { name: "Redigera händelse" });
  return { user, p };
}

describe("en post i en egen kalender: pennan öppnar samma formulär som för en händelse", () => {
  it("formuläret får postens kalender som en av MINA, ingen typ, och Blockerar ifylld ur posten", async () => {
    const { p } = await oppnaPennan();
    // typ, kalender, slag, blockerar, kravSvar, id
    await waitFor(() => expect(within(p).getByText(`null|privat|mina|true|false|${POSTID}`)).toBeInTheDocument());
    expect(within(p).getByRole("textbox", { name: "Titel" })).toHaveValue("Tandläkaren");
    expect(within(p).getByRole("button", { name: "Kalender: Privat" })).toBeInTheDocument();
    expect(within(p).getByRole("switch", { name: /Blockerar tillgänglighet/ })).toBeChecked();
    expect(within(p).queryByRole("switch", { name: /Kräv svar/ })).toBeNull();
    // Ingen typväljare: en post har ingen typ.
    expect(within(p).queryByText("Typ")).toBeNull();
    expect([param("skapa"), param("redigera")]).toEqual(["handelse", POSTID]);
  });

  it("⛔ väljaren har bara mina kalendrar: att byta till en grupp är 'Flytta till kalender', med bekräftelse", async () => {
    const { user, p } = await oppnaPennan();
    await user.click(await within(p).findByRole("button", { name: "Kalender: Privat" }));
    const v = await screen.findByRole("dialog", { name: "Kalender" });
    expect(within(v).getByRole("region", { name: "Mina kalendrar" })).toBeInTheDocument();
    expect(within(v).queryByRole("region", { name: "CPS AB: kalendrar" })).toBeNull();
    expect(within(v).queryByRole("button", { name: "Styrelse" })).toBeNull();
    expect(within(v).queryByRole("button", { name: "Resor" })).toBeNull();
    await user.click(within(v).getByRole("button", { name: "Jobb" }));
    await waitFor(() => expect(within(p).getByText(`null|jobb|mina|true|false|${POSTID}`)).toBeInTheDocument());
  });

  it("Spara skriver ändringen (titel och kalender) via appens formulär, och panelen visar den ändrade posten", async () => {
    const { user, p } = await oppnaPennan();
    await waitFor(() => expect(within(p).getByRole("textbox", { name: "Titel" })).toHaveValue("Tandläkaren"));
    await user.clear(within(p).getByRole("textbox", { name: "Titel" }));
    await user.type(within(p).getByRole("textbox", { name: "Titel" }), "Läkaren");
    await user.click(within(p).getByRole("switch", { name: /Blockerar tillgänglighet/ }));
    await user.click(await within(p).findByRole("button", { name: "Kalender: Privat" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Kalender" })).getByRole("button", { name: "Jobb" }));
    await user.click(within(p).getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Läkaren" })).toBeInTheDocument());
    expect(document.querySelector("[data-handelsekalender]")?.textContent).toBe("Jobb");
    expect([param("skapa"), param("redigera")]).toEqual([null, null]);
    // Och det som sparades var skalets val: den nya kalendern, och Blockerar avslaget.
    await user.click(screen.getByRole("button", { name: "Redigera" }));
    const igen = await screen.findByRole("region", { name: "Redigera händelse" });
    await waitFor(() => expect(within(igen).getByText(`null|jobb|mina|false|false|${POSTID}`)).toBeInTheDocument());
  });

  it("en omladdning på adressen öppnar samma redigeringspanel för posten", async () => {
    window.history.replaceState(null, "", `/?handelse=${encodeURIComponent(POSTID)}&skapa=handelse&redigera=${encodeURIComponent(POSTID)}`);
    render(<App />);
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    await waitFor(() => expect(within(p).getByText(`null|privat|mina|true|false|${POSTID}`)).toBeInTheDocument());
  });

  it("⛔ en post som inte finns ger 'Händelsen finns inte' och inget formulär som sparar en ny rad", async () => {
    window.history.replaceState(null, "", `/?skapa=handelse&redigera=${encodeURIComponent(postHandelseId("saknas"))}`);
    render(<App />);
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    expect(within(p).getByText("Händelsen finns inte")).toBeInTheDocument();
    expect(within(p).queryByRole("form")).toBeNull();
  });

  it("⛔ utan penna (appen ger ingen onRedigera: den som inte äger posten) finns ingen väg in", async () => {
    window.history.replaceState(null, "", `/?handelse=${encodeURIComponent(POSTID)}`);
    render(<App tillat={false} />);
    await screen.findByRole("heading", { level: 1, name: "Tandläkaren" });
    expect(screen.queryByRole("button", { name: "Redigera" })).toBeNull();
  });
});

describe("en händelse i en gruppkalender är oförändrad av det här", () => {
  it("väljaren har fortfarande gruppens kalendrar och inte Mina kalendrar, och formuläret får slaget grupp", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?skapa=handelse&redigera=h1");
    render(<App handelse />);
    const p = await screen.findByRole("region", { name: "Redigera händelse" });
    await waitFor(() => expect(within(p).getByText("mote|resor|grupp|false|true|h1")).toBeInTheDocument());
    expect(within(p).getByRole("switch", { name: /Kräv svar/ })).toBeChecked();
    expect(within(p).queryByRole("switch", { name: /Blockerar tillgänglighet/ })).toBeNull();
    await user.click(await within(p).findByRole("button", { name: "Kalender: Resor" }));
    const v = await screen.findByRole("dialog", { name: "Kalender" });
    expect(within(v).getByRole("region", { name: "CPS AB: kalendrar" })).toBeInTheDocument();
    expect(within(v).queryByRole("region", { name: "Mina kalendrar" })).toBeNull();
  });
});
