import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsDelad } from "../components/OpsDelad.jsx";
import { byggPost } from "../lib/bibliotek.js";
import { DELNINGSFEL } from "../lib/delning.js";

/**
 * Den publika vyn (`OpsDelad`) och menyvalet "Dela länk" i `OpsBibliotek` (0.119.0, lifehub.app#356).
 * Servern provas i `delning.test.js`. Här provas det som syns, och att det som inte ska synas inte gör det.
 */

afterEach(() => vi.restoreAllMocks());

const delning = (extra = {}) => ({ rubrik: "Demo", typ: "ljud", mime: "audio/mpeg", storlek: 4_000_000, langd: 240000, peaks: null, nedladdning: false, url: "https://lagring.test/a.mp3?d=inline", visaUrl: null, ...extra });

describe("OpsDelad: lägen och feltexter", () => {
  it("⛔ kastar om ingen eller flera av delning, orsak och laddar ges", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsDelad />)).toThrow(/precis en av/);
    expect(() => render(<OpsDelad delning={delning()} orsak="utgangen" />)).toThrow(/precis en av/);
    expect(() => render(<OpsDelad laddar orsak="stangd" />)).toThrow(/precis en av/);
    expect(() => render(<OpsDelad delning={delning()} onNyUrl="x" />)).toThrow(/onNyUrl/);
  });

  it("de tre orsakerna har sina texter, och en okänd får det utgångnas", () => {
    for (const [orsak, text] of Object.entries(DELNINGSFEL)) {
      const { unmount } = render(<OpsDelad orsak={orsak} />);
      expect(screen.getByText(text), orsak).toBeInTheDocument();
      expect(document.querySelector("[data-delad-orsak]")?.getAttribute("data-delad-orsak")).toBe(orsak);
      unmount();
    }
    render(<OpsDelad orsak="okand" />);
    expect(screen.getByText("Länken har gått ut")).toBeInTheDocument();
  });

  it("medan länken hämtas står det, och ingen feltext", () => {
    render(<OpsDelad laddar />);
    expect(screen.getByText("Hämtar filen")).toBeInTheDocument();
    expect(screen.queryByText(/gått ut|stängd|finns inte/)).toBeNull();
  });
});

describe("OpsDelad: ljud", () => {
  it("visar rubriken, typen, storleken och längden, och spelaren med adressen", () => {
    render(<OpsDelad delning={delning()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Demo" })).toBeInTheDocument();
    expect(document.querySelector("[data-delad-meta]")?.textContent).toBe("Ljud · 3,8 MB · 4:00");
    expect(document.querySelector("[data-ljudspelare]")).not.toBeNull();
    expect(document.querySelector("audio")?.getAttribute("src")).toBe("https://lagring.test/a.mp3?d=inline");
  });

  it("⛔ nedladdning AV: varken 'Ladda ner' eller spelarens 'Ladda ned' finns", () => {
    render(<OpsDelad delning={delning({ nedladdning: false })} />);
    expect(screen.queryByText(/Ladda ne[rd]/)).toBeNull();
    expect(document.querySelector("a[download]")).toBeNull();
    expect(document.querySelector("audio")?.getAttribute("controlslist")).toBe("nodownload");
  });

  it("⛔ nedladdning PÅ: knappen 'Ladda ner' finns och pekar på adressen", () => {
    render(<OpsDelad delning={delning({ nedladdning: true, url: "https://lagring.test/a.mp3?d=attachment" })} />);
    const knapp = screen.getByRole("link", { name: "Ladda ner Demo" });
    expect(knapp.getAttribute("href")).toBe("https://lagring.test/a.mp3?d=attachment");
  });
});

describe("OpsDelad: bild, PDF, video och övrigt", () => {
  it("en bild fyller bredden", () => {
    render(<OpsDelad delning={delning({ typ: "bild", mime: "image/png", langd: null, url: "https://lagring.test/b.png" })} />);
    const bild = screen.getByRole("img", { name: "Demo" });
    expect(bild.getAttribute("src")).toBe("https://lagring.test/b.png");
    expect(bild.className).toContain("w-full");
    expect(document.querySelector("[data-delad]")?.getAttribute("data-delad")).toBe("bild");
  });

  it("en PDF är inbäddad och har en länk att öppna. Med nedladdning visas den från visaUrl, inte från attachment-adressen", () => {
    render(<OpsDelad delning={delning({ typ: "pdf", mime: "application/pdf", langd: null, nedladdning: true, url: "https://lagring.test/a.pdf?d=attachment", visaUrl: "https://lagring.test/a.pdf?d=inline" })} />);
    const objekt = document.querySelector("object");
    expect(objekt?.getAttribute("type")).toBe("application/pdf");
    expect(objekt?.getAttribute("data")).toBe("https://lagring.test/a.pdf?d=inline");
    expect(screen.getByRole("link", { name: "Öppna PDF" }).getAttribute("href")).toBe("https://lagring.test/a.pdf?d=inline");
    expect(screen.getByRole("link", { name: "Ladda ner Demo" }).getAttribute("href")).toBe("https://lagring.test/a.pdf?d=attachment");
  });

  it("⛔ en video har ramverkets kontroller och ingen `controls` från webbläsaren", () => {
    render(<OpsDelad delning={delning({ typ: "video", mime: "video/mp4", langd: null, url: "https://lagring.test/v.mp4" })} />);
    const video = document.querySelector("video");
    expect(video?.getAttribute("src")).toBe("https://lagring.test/v.mp4");
    expect(video?.hasAttribute("controls")).toBe(false);
    expect(screen.getByRole("button", { name: "Spela Demo" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Spola" }).className).toContain("ops-reglage");
  });

  it("spelknappen startar videon och byter namn när den spelar", async () => {
    const play = vi.fn(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
    render(<OpsDelad delning={delning({ typ: "video", mime: "video/mp4", langd: null, url: "https://lagring.test/v.mp4" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Spela Demo" }));
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.play(/** @type {Element} */ (document.querySelector("video")));
    expect(await screen.findByRole("button", { name: "Pausa Demo" })).toBeInTheDocument();
  });

  it("en fil som inte går att visa säger det", () => {
    render(<OpsDelad delning={delning({ typ: "dokument", mime: "text/plain", langd: null })} />);
    expect(screen.getByText(/Filen går inte att visa här/)).toBeInTheDocument();
  });
});

describe("OpsDelad: adressen gick ut", () => {
  it("⛔ ber om en ny adress EN gång per adress, och visar felet i stället för att be igen", async () => {
    const onNyUrl = vi.fn(() => Promise.resolve());
    const bas = { typ: "bild", mime: "image/png", langd: null };
    const { rerender } = render(<OpsDelad delning={delning({ ...bas, url: "https://lagring.test/1.png" })} onNyUrl={onNyUrl} />);
    fireEvent.error(screen.getByRole("img", { name: "Demo" }));
    fireEvent.error(screen.getByRole("img", { name: "Demo" }));
    expect(onNyUrl).toHaveBeenCalledTimes(1);
    // Samma adress igen: nu är det ett fel att visa.
    expect(await screen.findByRole("alert")).toHaveTextContent("Filen gick inte att visa just nu.");
    // En ny adress får sin egen chans.
    rerender(<OpsDelad delning={delning({ ...bas, url: "https://lagring.test/2.png" })} onNyUrl={onNyUrl} />);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.error(screen.getByRole("img", { name: "Demo" }));
    expect(onNyUrl).toHaveBeenCalledTimes(2);
  });

  it("faller den nya hämtningen visas felet", async () => {
    const onNyUrl = vi.fn(() => Promise.reject(new Error("nätet föll")));
    render(<OpsDelad delning={delning({ typ: "bild", mime: "image/png", langd: null })} onNyUrl={onNyUrl} />);
    fireEvent.error(screen.getByRole("img", { name: "Demo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Filen gick inte att visa just nu.");
  });
});

/* ───────────────────────────── OpsBibliotek: Dela länk ───────────────────────────── */

const KIM = "uidKim";
const ANNAN = "uidAnnan";
const tid = 1_700_000_000_000;
const skapare = (uid) => ({ uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" });
const pdf = (id, uid, extra = {}) => ({
  ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: `Avtal ${id}`, fil: { sokvag: `grupper/cps-ab/bibliotek/${id}/a.pdf`, namn: "a.pdf", mime: "application/pdf", byte: 2048, ...extra }, skapadAv: skapare(uid), skapad: tid, andrad: tid }),
  id,
});
const anteckning = { ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "x", skapadAv: skapare(KIM), skapad: tid, andrad: tid }), id: "a" };

function Vy({ poster, jag = { uid: KIM, roll: "medlem" }, delningar = [], onDelaLank, onAndraNedladdning = vi.fn(async () => {}), onAterkalla = vi.fn(async () => {}) }) {
  const [vald, setVald] = useState(null);
  return (
    <OpsBibliotek
      poster={poster}
      jag={jag}
      vald={vald}
      onOppna={setVald}
      onStang={() => setVald(null)}
      onSkapa={() => {}}
      onSpara={() => {}}
      delningar={delningar}
      onDelaLank={onDelaLank}
      onAndraNedladdning={onAndraNedladdning}
      onAterkalla={onAterkalla}
      hubHref="/hub"
    />
  );
}

const oppnaMeny = (rubrik) => fireEvent.click(screen.getByRole("button", { name: `Åtgärder för ${rubrik}` }));

describe("OpsBibliotek: 'Dela länk' i menyn", () => {
  it("syns för författarens färdiga fil, men inte utan onDelaLank", () => {
    const { unmount } = render(<Vy poster={[pdf("p1", KIM)]} onDelaLank={vi.fn()} />);
    oppnaMeny("Avtal p1");
    expect(screen.getByRole("menuitem", { name: "Dela länk" })).toBeInTheDocument();
    unmount();
    render(<Vy poster={[pdf("p1", KIM)]} />);
    oppnaMeny("Avtal p1");
    expect(screen.queryByRole("menuitem", { name: "Dela länk" })).toBeNull();
  });

  it("⛔ syns inte för en anteckning, en fil som inte blev klar eller någon annans fil", () => {
    render(<Vy poster={[anteckning, pdf("halv", KIM, { klar: false }), pdf("annans", ANNAN)]} onDelaLank={vi.fn()} />);
    for (const rubrik of ["Protokoll", "Avtal halv", "Avtal annans"]) {
      // En post utan en enda åtgärd har ingen ⋯ alls. Finns knappen ska "Dela länk" i alla fall inte stå i menyn.
      const knapp = screen.queryByRole("button", { name: `Åtgärder för ${rubrik}` });
      if (knapp) fireEvent.click(knapp);
      expect(screen.queryByRole("menuitem", { name: "Dela länk" }), rubrik).toBeNull();
      if (knapp) fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    }
  });

  it("en admin får dela någon annans fil", () => {
    render(<Vy poster={[pdf("annans", ANNAN)]} jag={{ uid: KIM, roll: "admin", groupId: "cps-ab" }} onDelaLank={vi.fn()} />);
    oppnaMeny("Avtal annans");
    expect(screen.getByRole("menuitem", { name: "Dela länk" })).toBeInTheDocument();
  });

  it("⛔ onDelaLank utan onAterkalla eller onAndraNedladdning kastas: en länk som inte går att stänga får inte kunna skapas", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsBibliotek poster={[]} jag={null} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/h" onDelaLank={vi.fn()} />)).toThrow(/onAterkalla/);
  });
});

describe("OpsBibliotek: dialogen", () => {
  it("förvalen är 7 dagar och nedladdning AV, och skapa skickar dem", async () => {
    const onDelaLank = vi.fn(async () => ({ id: "d1", url: "https://my.test/d/tok", giltigTill: tid + 7 * 86400000 }));
    render(<Vy poster={[pdf("p1", KIM)]} onDelaLank={onDelaLank} />);
    oppnaMeny("Avtal p1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Dela länk" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela länk" });
    expect(within(dialog).getByRole("tab", { name: "7 dagar" })).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getAllByRole("tab").map((t) => t.textContent)).toEqual(["1 dag", "7 dagar", "30 dagar"]);
    expect(within(dialog).getByRole("switch", { name: "Tillåt nedladdning" })).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(onDelaLank).toHaveBeenCalledWith({ postId: "p1", dagar: 7, nedladdning: false }));
    expect(await within(dialog).findByText("https://my.test/d/tok")).toBeInTheDocument();
  });

  it("utgångstiden och nedladdningen som väljs är de som skickas", async () => {
    const onDelaLank = vi.fn(async () => ({ id: "d1", url: "https://my.test/d/tok" }));
    render(<Vy poster={[pdf("p1", KIM)]} onDelaLank={onDelaLank} />);
    oppnaMeny("Avtal p1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Dela länk" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela länk" });
    fireEvent.click(within(dialog).getByRole("tab", { name: "30 dagar" }));
    fireEvent.click(within(dialog).getByRole("switch", { name: "Tillåt nedladdning" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(onDelaLank).toHaveBeenCalledWith({ postId: "p1", dagar: 30, nedladdning: true }));
  });

  it("Kopiera lägger hela adressen i urklipp, och Stäng länken återkallar och stänger dialogen med ett besked", async () => {
    const skriv = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText: skriv }, configurable: true });
    const onDelaLank = vi.fn(async () => ({ id: "d1", url: "https://my.test/d/tok" }));
    const onAterkalla = vi.fn(async () => {});
    render(<Vy poster={[pdf("p1", KIM)]} onDelaLank={onDelaLank} onAterkalla={onAterkalla} />);
    oppnaMeny("Avtal p1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Dela länk" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela länk" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Kopiera" }));
    await waitFor(() => expect(skriv).toHaveBeenCalledWith("https://my.test/d/tok"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Stäng länken" }));
    await waitFor(() => expect(onAterkalla).toHaveBeenCalledWith({ id: "d1" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Dela länk" })).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent("Länken är stängd.");
  });

  it("nedladdningen går att ändra efteråt, och ett fel visas med reglaget kvar", async () => {
    const onDelaLank = vi.fn(async () => ({ id: "d1", url: "https://my.test/d/tok" }));
    const onAndraNedladdning = vi.fn().mockRejectedValueOnce(new Error("Servern nekade")).mockResolvedValue(undefined);
    render(<Vy poster={[pdf("p1", KIM)]} onDelaLank={onDelaLank} onAndraNedladdning={onAndraNedladdning} />);
    oppnaMeny("Avtal p1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Dela länk" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela länk" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    const reglage = await within(dialog).findByRole("switch", { name: "Tillåt nedladdning" });
    fireEvent.click(reglage);
    await waitFor(() => expect(onAndraNedladdning).toHaveBeenCalledWith({ id: "d1", nedladdning: true }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Servern nekade");
    expect(within(dialog).getByRole("switch", { name: "Tillåt nedladdning" })).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole("switch", { name: "Tillåt nedladdning" }));
    await waitFor(() => expect(within(dialog).getByRole("switch", { name: "Tillåt nedladdning" })).toBeChecked());
  });

  it("⛔ ett fel vid skapandet visas, och ingen adress påstås finnas", async () => {
    const onDelaLank = vi.fn(async () => {
      throw new Error("Du får inte dela den här filen.");
    });
    render(<Vy poster={[pdf("p1", KIM)]} onDelaLank={onDelaLank} />);
    oppnaMeny("Avtal p1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Dela länk" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela länk" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Du får inte dela den här filen.");
    expect(within(dialog).queryByRole("button", { name: "Kopiera" })).toBeNull();
  });

  it("⛔ ett svar utan adress räknas som ett fel", async () => {
    render(<Vy poster={[pdf("p1", KIM)]} onDelaLank={vi.fn(async () => ({ id: "d1" }))} />);
    oppnaMeny("Avtal p1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Dela länk" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela länk" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/saknade adressen/);
  });

  it("en länk som redan lever visar läget utan Kopiera, och kan stängas", async () => {
    const onAterkalla = vi.fn(async () => {});
    const delningar = [{ id: "d9", postId: "p1", giltigTill: tid + 86400000, nedladdning: true }];
    render(<Vy poster={[pdf("p1", KIM)]} delningar={delningar} onDelaLank={vi.fn()} onAterkalla={onAterkalla} />);
    oppnaMeny("Avtal p1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Dela länk" }));
    const dialog = await screen.findByRole("dialog", { name: "Dela länk" });
    expect(within(dialog).getByText(/visas bara när den skapas/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Kopiera" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Skapa länk" })).toBeNull();
    expect(within(dialog).getByRole("switch", { name: "Tillåt nedladdning" })).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "Stäng länken" }));
    await waitFor(() => expect(onAterkalla).toHaveBeenCalledWith({ id: "d9" }));
  });
});

describe("OpsBibliotek: markeringen i listan", () => {
  it("⛔ en post med en länk som lever är markerad 'Delad', och bara den", () => {
    render(<Vy poster={[pdf("p1", KIM), pdf("p2", KIM)]} delningar={[{ id: "d1", postId: "p1", giltigTill: tid + 1, nedladdning: false }]} onDelaLank={vi.fn()} />);
    const markeringar = [...document.querySelectorAll("[data-bibliotek-delad]")];
    expect(markeringar).toHaveLength(1);
    expect(markeringar[0].textContent).toBe("Delad");
    expect(markeringar[0].closest("[data-bibliotek-kort]")?.textContent).toContain("Avtal p1");
  });

  it("utan delningar finns ingen markering", () => {
    render(<Vy poster={[pdf("p1", KIM)]} onDelaLank={vi.fn()} />);
    expect(document.querySelector("[data-bibliotek-delad]")).toBeNull();
  });
});
