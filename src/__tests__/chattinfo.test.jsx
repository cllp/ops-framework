import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BilagaVisning } from "../components/BilagaVisning.jsx";
import { OpsChattinfo } from "../components/OpsChattinfo.jsx";
import { CHATTINFO_TEXTER } from "../components/OpsChattinfo.jsx";
import { OpsSamtal } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, samtalsnotiser } from "../data/samtalskalla.js";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const PDF = "data:application/pdf;base64,JVBERi0=";
const bild = (extra = {}) => ({ dataUrl: PNG, namn: "kvitto.png", typ: "image/png", tecken: PNG.length, ...extra });
const pdf = () => ({ dataUrl: PDF, namn: "avtal.pdf", typ: "application/pdf", tecken: PDF.length });
const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];
const namnFor = (uid) => MEDLEMMAR.find((m) => m.userId === uid)?.namn ?? uid;
const t = { ...CHATTINFO_TEXTER, bilagaText: "Bilaga från", bilagaTrasig: "Bilagan går inte att visa.", sokISamtalet: "Sök i samtalet", du: "Du" };

async function kalla(extra = {}) {
  let tid = 1_700_000_000_000;
  const s = createSamtalskalla({
    kalla: createMemorySource({}),
    klocka: () => (tid += 1000),
    bilagor: true,
    bilagaSamling: "bilagor",
    tyst: "tyst",
    ...extra,
  });
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  return { s, p };
}

describe("bilagor utanför meddelandet", () => {
  it("översikten bär märket och inte filen, och notisen bär filnamnet", async () => {
    const { s, p } = await kalla();
    await s.skicka(p.id, { text: "", av: "anna", bilaga: bild() });
    const over = await s.oversikt({ groupId: "g", uid: "bo" });
    const json = JSON.stringify(over);
    expect(json).not.toContain("dataUrl");
    expect(json).not.toContain("data:");
    expect(over[0].senaste?.bilaga).toEqual({ namn: "kvitto.png", typ: "image/png" });
    const n = await samtalsnotiser({ samtal: s, uid: "bo", namnFor: () => "Anna" })({ groupId: "g" });
    expect(n).toHaveLength(1);
    expect(n[0].text).toBe("kvitto.png");
  });

  it("⛔ ett tystat samtal ger ingen notis", async () => {
    const { s, p } = await kalla();
    await s.skicka(p.id, { text: "Hej", av: "anna" });
    await s.sattTyst(p.id, "bo", true);
    const n = await samtalsnotiser({ samtal: s, uid: "bo", namnFor: () => "Anna" })({ groupId: "g" });
    expect(n).toEqual([]);
    expect((await s.oversikt({ groupId: "g", uid: "bo" }))[0].tyst).toBe(true);
  });

  it("en ogiltig dataUrl blir ingen länk och ingen bild", () => {
    const { container } = render(
      <BilagaVisning bilaga={{ dataUrl: "javascript:alert(1)", namn: "x.txt", typ: "text/plain", tecken: 18 }} alt="bilaga" />,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("[href]")).toBeNull();
    expect(container.querySelector("[src]")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("x.txt");
  });
});

describe("Chattinfo", () => {
  it("flikarna räknar, Bilder visar bara bilder, och panelen öppnas och stängs", async () => {
    const { s, p } = await kalla();
    await s.skicka(p.id, { text: "Se https://example.com/karta", av: "anna", bilaga: bild() });
    await s.skicka(p.id, { text: "", av: "anna", bilaga: pdf() });
    render(<OpsSamtal kalla={s} uid="bo" samtal={p} rubrik="Anna" namnFor={namnFor} medlemmar={MEDLEMMAR} mejl="anna@example.com" />);
    expect(screen.getByRole("link", { name: "Mejl" })).toHaveAttribute("href", "mailto:anna@example.com");
    expect(screen.getByRole("button", { name: "Tysta notiser" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sök i samtalet" })).toHaveAttribute("data-sok-samtal", "");
    expect(screen.queryByRole("heading", { name: "Chattinfo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chattinfo" }));
    expect(await screen.findByRole("heading", { name: "Chattinfo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Medlemmar 2" })).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "Bilder 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Dokument 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Länkar 1" })).toBeInTheDocument();
    // ⛔ `fireEvent.click` räcker inte mot Radix, som lyssnar på pointer-events (samma skäl som i data-primitives).
    await userEvent.click(screen.getByRole("tab", { name: "Bilder 1" }));
    const bilder = await screen.findByRole("tabpanel", { name: "Bilder 1" });
    expect(within(bilder).getByRole("img", { name: "kvitto.png" })).toBeInTheDocument();
    expect(within(bilder).queryByText("avtal.pdf")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Dokument 1" }));
    const dokument = await screen.findByRole("tabpanel", { name: "Dokument 1" });
    expect(within(dokument).getByText("avtal.pdf")).toBeInTheDocument();
    expect(within(dokument).queryByRole("img", { name: "kvitto.png" })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Länkar 1" }));
    const lankar = await screen.findByRole("tabpanel", { name: "Länkar 1" });
    expect(within(lankar).getByRole("link", { name: "https://example.com/karta" })).toHaveAttribute("href", "https://example.com/karta");
    fireEvent.click(screen.getByRole("button", { name: "Stäng chattinfo" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Chattinfo" })).toBeNull());
  });

  it("en tom panel säger att flikarna är tomma, också med noll", async () => {
    render(
      <OpsChattinfo
        medlemmar={[]}
        bilagor={[]}
        meddelanden={[{ text: "ingen adress här" }]}
        namnFor={() => "Namn saknas"}
        onStang={() => {}}
        texter={t}
      />,
    );
    expect(screen.getByRole("tab", { name: "Medlemmar 0" })).toBeInTheDocument();
    expect(screen.getByText("Inga medlemmar.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Bilder 0" }));
    expect(screen.getByText("Inga bilder.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Dokument 0" }));
    expect(screen.getByText("Inga dokument.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Länkar 0" }));
    expect(screen.getByText("Inga länkar.")).toBeInTheDocument();
  });
});
