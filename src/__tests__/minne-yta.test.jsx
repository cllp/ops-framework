import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { OpsMinne } from "../components/OpsMinne.jsx";
import { OpsTrad } from "../components/OpsMeddelanden.jsx";

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];
const namnFor = (uid) => MEDLEMMAR.find((m) => m.userId === uid)?.namn ?? uid;

async function trad() {
  let t = 1_700_000_000_000;
  const s = createSamtalskalla({
    kalla: createMemorySource({}),
    tradar: "tradar",
    klocka: () => (t += 1000),
  });
  const g = await s.oppnaGrupp({ groupId: "cps-ab", uid: "anna" });
  const rot = await s.skicka(g.id, { text: "Budgeten är klar", av: "bo" });
  const svar = await s.skickaITrad(g.id, rot.id, { text: "Vi tar den på fredag", av: "anna" });
  return { s, g, rot, svar };
}

describe("Lyft till minnet", () => {
  it("utan återanrop finns ingen knapp", async () => {
    const { s, g, rot } = await trad();
    render(<OpsTrad kalla={s} uid="anna" samtal={g} tid={rot.id} gruppNamn="Gruppen" namnFor={namnFor} medlemmar={MEDLEMMAR} onStang={() => {}} />);
    expect(await screen.findByText("Vi tar den på fredag")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lyft till minnet" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Minnet" })).toBeNull();
  });

  it("knappen lyfter roten och svaret, och ett nej syns", async () => {
    const { s, g, rot, svar } = await trad();
    const lyft = vi.fn(async (rad) => {
      if (rad.meddelande === svar.id) throw new Error("nekad");
    });
    render(
      <OpsTrad
        kalla={s}
        uid="anna"
        samtal={g}
        tid={rot.id}
        gruppNamn="Gruppen"
        namnFor={namnFor}
        medlemmar={MEDLEMMAR}
        onStang={() => {}}
        onLyftTillMinnet={lyft}
        minneHref="/minne"
      />,
    );
    expect(await screen.findByRole("link", { name: "Minnet" })).toHaveAttribute("href", "/minne");
    const knappar = await screen.findAllByRole("button", { name: "Lyft till minnet" });
    expect(knappar).toHaveLength(2);
    fireEvent.click(knappar[0]);
    await waitFor(() => expect(lyft).toHaveBeenCalledWith({
      samtal: g.id,
      trad: rot.id,
      meddelande: rot.id,
      text: "Budgeten är klar",
      av: "bo",
    }));
    fireEvent.click(knappar[1]);
    expect(await screen.findByRole("alert")).toHaveTextContent(/nekad/);
  });
});

const rad = (id, extra = {}) => ({
  id,
  groupId: "cps-ab",
  text: "Budgeten är klar.",
  kalla: { slag: "trad", samtal: "cps-ab|grupp", trad: "rot", meddelande: "svar" },
  lyftAv: { uid: "kim", namn: "Kim", typ: "manniska", kalla: "minne" },
  lyft: 1_700_000_000_000,
  andrad: 1_700_000_000_000,
  ...extra,
});

describe("OpsMinne", () => {
  const bas = { onAndra: async () => {}, onTaBort: async () => {}, hubHref: "/hub" };

  it("tomt minne är ett svar, och ett fel är ett annat", () => {
    const { rerender } = render(<OpsMinne rader={[]} uid="kim" arAgare={false} {...bas} />);
    expect(screen.getByText("Minnet är tomt.")).toBeInTheDocument();
    rerender(<OpsMinne rader={[]} fel="Databasen svarade inte." uid="kim" arAgare={false} {...bas} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Databasen svarade inte.");
    expect(screen.queryByText("Minnet är tomt.")).toBeNull();
  });

  it("den som lyfte och ägaren ser Ändra, en annan medlem gör det inte", () => {
    const { rerender } = render(<OpsMinne rader={[rad("a")]} uid="kim" arAgare={false} {...bas} />);
    expect(screen.getByRole("button", { name: "Ändra" })).toBeInTheDocument();
    expect(screen.getByText(/Tråd · Kim/)).toBeInTheDocument();
    rerender(<OpsMinne rader={[rad("a")]} uid="bo" arAgare={false} {...bas} />);
    expect(screen.queryByRole("button", { name: "Ändra" })).toBeNull();
    rerender(<OpsMinne rader={[rad("a")]} uid="aga" arAgare {...bas} />);
    expect(screen.getByRole("button", { name: "Ta bort" })).toBeInTheDocument();
  });

  it("ett nej från källan syns", async () => {
    render(<OpsMinne rader={[rad("a")]} uid="kim" arAgare={false} {...bas} onTaBort={async () => { throw new Error("regeln sade nej"); }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ta bort" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("regeln sade nej");
  });
});
