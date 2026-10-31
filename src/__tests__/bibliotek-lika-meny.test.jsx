import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsAtgardsblad } from "../components/OpsAtgardsblad.jsx";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { arDelbar, byggPost } from "../lib/bibliotek.js";
import { LISTA_FLYTT_TEXT, LISTA_I_LISTA_TEXT } from "../lib/biblioteklista.js";

/**
 * EN MENY FÖR ALLA FYRA TYPER (0.133.0, lifehub.app#356, CP 2026-10-20). Mätt före: "Dela länk" fanns bara på en färdig fil, en lista fick bara Byt namn och Radera, och
 * en anteckning och en fil hade olika menyer. CP såg tre typer med tre olika menyer och bad om en.
 *
 * Ordningen är den CP bad om: Redigera (i detalj), Byt namn, Dela länk, Visa detaljer, Lägg i lista, Kopiera länk, Flytta eller kopiera, Radera. Två rader gäller inte en lista och
 * ska synas som avstängda med skäl, inte saknas.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const GRUPPER = [{ id: "cps-ab", namn: "Grupp" }, { id: "miranda-ab", namn: "Miranda" }];

const med = (extra) => ({ groupId: "cps-ab", skapadAv: skapare, skapad: tid, andrad: tid, ...extra });
const FIL = { ...byggPost(med({ typ: "fil", rubrik: "Avtal", fil: { sokvag: "grupper/cps-ab/bibliotek/f1/a.pdf", namn: "a.pdf", mime: "application/pdf", byte: 2048 } })), id: "f1" };
const ANTECKNING = { ...byggPost(med({ typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade" })), id: "a1" };
const LANK = { ...byggPost(med({ typ: "lank", rubrik: "Kartan", url: "https://exempel.se/karta" })), id: "k1" };
const LISTA = { ...byggPost(med({ typ: "lista", rubrik: "Spellista", poster: ["f1", "a1"] })), id: "l1" };
const ALLA = [FIL, ANTECKNING, LANK, LISTA];

/** Ordningen CP bad om, med varje rad som kan finnas. En meny är en delföljd av den här, i den här ordningen. */
const ORDNING = ["Redigera", "Byt namn", "Lägg till tagg", "Dela länk", "Visa detaljer", "Lägg i lista", "Kopiera länk", "Flytta till Mitt bibliotek", "Kopiera till Mitt bibliotek", "Flytta eller kopiera", "Arkivera", "Radera"];

function Vy({ poster = ALLA, vald: startVald = null, onSpara = vi.fn(), grupper = GRUPPER, onDelaLank = vi.fn() }) {
  const [vald, setVald] = useState(startVald);
  return (
    <OpsBibliotek
      poster={poster}
      jag={JAG}
      grupper={grupper}
      vald={vald && poster.find((p) => p.id === vald.id)}
      onOppna={setVald}
      onStang={() => setVald(null)}
      onSkapa={() => {}}
      onSpara={onSpara}
      onRadera={() => {}}
      onDela={() => {}}
      onDelaLank={onDelaLank}
      onAndraNedladdning={async () => {}}
      onAterkalla={async () => {}}
      hubHref="/hub"
    />
  );
}

const rader = (namn) => within(screen.getByRole("menu", { name: namn })).getAllByRole("menuitem");
/** Radens etikett, utan förklaringen som en avstängd rad bär under den. */
const etiketter = (namn) => rader(namn).map((r) => r.querySelector(".truncate")?.textContent ?? "");

describe("⛔ samma meny för fil, anteckning, länk och lista", () => {
  it("varje typ har exakt raderna och ordningen: Byt namn, Dela länk, Lägg i lista, Flytta eller kopiera, Radera", async () => {
    const user = userEvent.setup();
    for (const post of ALLA) {
      const { unmount } = render(<Vy />);
      await user.click(screen.getByRole("button", { name: `Åtgärder för ${post.rubrik}` }));
      const ut = etiketter(post.rubrik);
      // Länken har dessutom Kopiera länk (den har en adress att kopiera), på sin plats i ordningen. Annars är menyn densamma.
      const vantat = post.typ === "lank"
        ? ["Byt namn", "Lägg till tagg", "Dela länk", "Lägg i lista", "Kopiera länk", "Flytta eller kopiera", "Arkivera", "Radera"]
        : ["Byt namn", "Lägg till tagg", "Dela länk", "Lägg i lista", "Flytta eller kopiera", "Arkivera", "Radera"];
      // 0.165.0: "Lägg till tagg" står i menyn när posten saknar taggar (kortet visar inte längre taggraden då).
      expect(ut, post.typ).toEqual(vantat);
      // Och alla är en delföljd av CP:s ordning.
      let i = -1;
      for (const e of ut) {
        const j = ORDNING.indexOf(e);
        expect(j, `${post.typ}: ${e}`).toBeGreaterThan(i);
        i = j;
      }
      unmount();
    }
  });

  it("⛔ Dela länk finns på alla fyra typer, men inte på en fil som inte blev klar", async () => {
    const user = userEvent.setup();
    const halv = { ...byggPost(med({ typ: "fil", rubrik: "Halv", fil: { sokvag: "grupper/cps-ab/bibliotek/h/a.pdf", namn: "a.pdf", mime: "application/pdf", byte: 2048, klar: false } })), id: "h" };
    render(<Vy poster={[...ALLA, halv]} />);
    for (const post of ALLA) {
      await user.click(screen.getByRole("button", { name: `Åtgärder för ${post.rubrik}` }));
      expect(etiketter(post.rubrik), post.typ).toContain("Dela länk");
      await user.keyboard("{Escape}");
    }
    await user.click(screen.getByRole("button", { name: "Åtgärder för Halv" }));
    expect(etiketter("Halv")).not.toContain("Dela länk");
    expect(arDelbar(halv)).toBe(false);
    expect(ALLA.every(arDelbar)).toBe(true);
  });

  it("⛔ en lista har Lägg i lista och Flytta eller kopiera som AVSTÄNGDA rader med skäl, och en vanlig post har dem påslagna", async () => {
    const user = userEvent.setup();
    render(<Vy />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Spellista" }));
    const lagg = rader("Spellista").find((r) => r.querySelector(".truncate")?.textContent === "Lägg i lista");
    const flytt = rader("Spellista").find((r) => r.querySelector(".truncate")?.textContent === "Flytta eller kopiera");
    expect(lagg).toHaveAttribute("aria-disabled", "true");
    expect(flytt).toHaveAttribute("aria-disabled", "true");
    expect(lagg).toHaveAccessibleName("Lägg i lista");
    expect(lagg).toHaveAccessibleDescription(LISTA_I_LISTA_TEXT);
    expect(flytt).toHaveAccessibleDescription(LISTA_FLYTT_TEXT);
    expect(LISTA_I_LISTA_TEXT).toBe("En lista kan inte ligga i en lista.");
    expect(LISTA_FLYTT_TEXT).toBe("En lista pekar på poster i den här gruppen och flyttas inte.");
    // Skälet läses upp med raden.
    for (const r of [lagg, flytt]) {
      const id = r?.getAttribute("aria-describedby");
      expect(id && document.getElementById(id)?.textContent).toBeTruthy();
    }
    // Ett tryck gör ingenting och lämnar menyn öppen.
    await user.click(/** @type {HTMLElement} */ (lagg));
    expect(screen.getByRole("menu", { name: "Spellista" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Lägg i lista" })).toBeNull();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    for (const r of rader("Protokoll")) expect(r, r.textContent ?? "").not.toHaveAttribute("aria-disabled");
  });

  it("de avstängda raderna går att nå med piltangenterna", async () => {
    const user = userEvent.setup();
    render(<Vy />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Spellista" }));
    const menyn = screen.getByRole("menu", { name: "Spellista" });
    const lagg = rader("Spellista").find((r) => r.querySelector(".truncate")?.textContent === "Lägg i lista");
    rader("Spellista")[0].focus();
    fireEvent.keyDown(menyn, { key: "ArrowDown" });
    fireEvent.keyDown(menyn, { key: "ArrowDown" });
    fireEvent.keyDown(menyn, { key: "ArrowDown" });
    expect(document.activeElement).toBe(lagg);
  });

  it("i detaljen börjar menyn med Redigera och Byt namn för alla fyra typer, och Dela länk finns där också", async () => {
    const user = userEvent.setup();
    for (const post of ALLA) {
      const { unmount } = render(<Vy vald={post} />);
      await user.click(screen.getByRole("button", { name: new RegExp(`^Åtgärder för ${post.rubrik}`) }));
      const ut = etiketter(post.rubrik);
      expect(ut.slice(0, 3), post.typ).toEqual(["Redigera", "Byt namn", "Dela länk"]);
      expect(ut.at(-1), post.typ).toBe("Radera");
      unmount();
    }
  });

  it("utan onSpara finns varken Lägg i lista eller dess avstängda form (inget att förklara när raden aldrig kunnat gälla)", async () => {
    const user = userEvent.setup();
    render(<OpsBibliotek poster={ALLA} jag={JAG} grupper={GRUPPER} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onRadera={() => {}} onDelaLank={vi.fn()} onAndraNedladdning={async () => {}} onAterkalla={async () => {}} hubHref="/h" />);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Spellista" }));
    expect(etiketter("Spellista")).not.toContain("Lägg i lista");
  });
});

describe("OpsAtgardsblad: avstängda rader", () => {
  const rendera = (poster) =>
    render(
      <OpsAtgardsblad namn="Post" poster={poster}>
        <button type="button">Post</button>
      </OpsAtgardsblad>,
    );
  it("en avstängd rad kräver en förklaring, och en förklaring kräver en avstängd rad", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => rendera([{ id: "a", etikett: "A", avstangd: true, onValj: () => {} }])).toThrow(/utan forklaring/);
    expect(() => rendera([{ id: "a", etikett: "A", avstangd: true, forklaring: "  ", onValj: () => {} }])).toThrow(/utan forklaring/);
    expect(() => rendera([{ id: "a", etikett: "A", forklaring: "Därför", onValj: () => {} }])).toThrow(/inte avstängd/);
  });
  it("en avstängd rad är aria-disabled, bär sin förklaring och anropar aldrig onValj; en vanlig rad gör det", async () => {
    const user = userEvent.setup();
    const avstangd = vi.fn();
    const vanlig = vi.fn();
    rendera([{ id: "a", etikett: "Gör det", avstangd: true, forklaring: "Det går inte just nu.", onValj: avstangd }, { id: "b", etikett: "Gör något annat", onValj: vanlig }]);
    await user.click(screen.getByRole("button", { name: "Åtgärder för Post" }));
    const a = screen.getByRole("menuitem", { name: /Gör det/ });
    expect(a).toHaveAttribute("aria-disabled", "true");
    expect(a).toHaveAccessibleDescription("Det går inte just nu.");
    expect(screen.getByText("Det går inte just nu.")).toBeVisible();
    await user.click(a);
    expect(avstangd).not.toHaveBeenCalled();
    expect(screen.getByRole("menu", { name: "Post" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Gör något annat" }));
    expect(vanlig).toHaveBeenCalledTimes(1);
    expect(avstangd).not.toHaveBeenCalled();
  });
});
