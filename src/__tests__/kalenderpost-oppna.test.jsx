import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { byggKalenderpost, postIdUrHandelseId, postTillHandelse, postTillRad } from "../lib/kalendrar.js";

/**
 * 0.120.0 (cllp/lifehub.app#367): en post i en av mina kalendrar går att öppna i detaljvyn.
 *
 * ⛔ Händelsen: CP:s händelse hamnade i Barnveckor, alltså som en post i `kalenderposter`. Raden hade inget `handelseId`, så titeln var
 * vanlig text och kortet såg ut som en ingång utan att vara en: "Ingen text, ingen detaljvy, navigation". Provet gör det en person gör:
 * väljer dagen, trycker på kortet, ser detaljvyn, trycker Tillbaka och står kvar på dagen. Röd mot 0.119.0: raden bar ingen länk.
 *
 * Panelen ritas av en app-lik `rita` som slår upp posten med `postIdUrHandelseId` och ritar `postTillHandelse`: det är exakt det
 * appen gör, och ramverket äger båda halvorna av id:t.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const KALENDRAR = [{ id: "barnveckor", namn: "Barnveckor", farg: 2 }];
const POSTER = [
  byggKalenderpost({ id: "p1", kalenderId: "barnveckor", titel: "Barnvecka", beskrivning: "Hämta på fredag", plats: "Visby", start: "2026-10-12", slut: "2026-10-14", heldag: true, blockerar: false }),
  byggKalenderpost({ id: "p2", kalenderId: "barnveckor", titel: "Tandläkaren", beskrivning: "", plats: "", start: "2026-10-12T09:00", slut: "2026-10-12T10:00", heldag: false, blockerar: false }),
];

function App() {
  return (
    <OpsAppShell
      brand="Ops"
      nav={[{ href: "/", label: "Kalender" }]}
      activeHref="/"
      handelsepanel={{
        rita: ({ id, onTillbaka }) => {
          const postId = postIdUrHandelseId(id);
          const post = POSTER.find((p) => p.id === postId);
          return <OpsHandelsePanel handelse={post ? postTillHandelse(post, KALENDRAR) : null} onTillbaka={onTillbaka} />;
        },
      }}
    >
      <OpsCalendar ariaLabel="Kalender" today={new Date(2026, 9, 12, 12)} entries={POSTER.map((p) => postTillRad(p, KALENDRAR))} />
    </OpsAppShell>
  );
}

const idParam = () => new URL(window.location.href).searchParams.get("handelse");

describe("⛔ #367: en post i en egen kalender öppnas i detaljvyn", () => {
  it("kortet i dagpanelen är en länk, öppnar vyn med titel, dag, kalender och plats, och Tillbaka lämnar dagen vald", async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]')));
    const dagpanel = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
    const lank = within(dagpanel).getByRole("link", { name: /Barnvecka/ });
    expect(lank.getAttribute("href")).toBe("?handelse=post~p1");
    await user.click(lank);
    expect(idParam()).toBe("post~p1");
    expect(screen.getByRole("heading", { level: 1, name: "Barnvecka" })).toBeInTheDocument();
    const vy = /** @type {HTMLElement} */ (document.querySelector("[data-handelsepanel]"));
    expect(vy.textContent).toContain("Barnveckor");
    expect(vy.textContent).toContain("Visby");
    expect(vy.textContent).toContain("Hämta på fredag");
    expect(vy.textContent).toContain("måndag 12 oktober 2026");
    expect(vy.textContent).toContain("onsdag 14 oktober 2026");
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(document.querySelector("[data-handelsepanel]")).toBeNull());
    expect(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]')).getAttribute("aria-pressed")).toBe("true");
  });

  it("en tidsatt post utan plats och beskrivning visar klockslaget och ingenting påhittat", async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]')));
    await user.click(within(/** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"))).getByRole("link", { name: /Tandläkaren/ }));
    expect(idParam()).toBe("post~p2");
    const vy = /** @type {HTMLElement} */ (document.querySelector("[data-handelsepanel]"));
    expect(vy.querySelector("[data-handelsetid]")?.textContent).toBe("09:00 - 10:00");
    for (const d of ["handelseplats", "handelsebeskrivning", "handelsesvar", "handelsestatus"]) expect(vy.querySelector(`[data-${d}]`), d).toBeNull();
  });

  it("snabbtitten öppnar också posten", async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.contextMenu(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]')));
    await user.click(within(/** @type {HTMLElement} */ (document.querySelector("[data-snabbtitt]"))).getByRole("link", { name: /Barnvecka/ }));
    expect(idParam()).toBe("post~p1");
  });
});
