import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { byggUppgift, uppgiftFel, visaUppgifter } from "../lib/uppgift.js";
import { collectEvents } from "../lib/events.js";
import { OpsEventList } from "../components/OpsEventList.jsx";
import { OpsCalendar } from "../components/OpsCalendar.jsx";

const IDAG = new Date(2026, 9, 7, 12, 0, 0);
const snarast = "snarast";

/** @param {Record<string, unknown>} extra */
const post = (extra) => /** @type {any} */ ({ id: "u1", rubrik: "Ring revisorn", typ: "uppgift", ...extra });

describe("uppgiftens form", () => {
  it("deadline eller utförs, aldrig båda, och vem och prioritet följer med", () => {
    expect(byggUppgift(post({ deadline: "2026-10-07", vem: "bo", prio: snarast }))).toEqual({
      id: "u1",
      rubrik: "Ring revisorn",
      status: "ny",
      deadline: "2026-10-07",
      vem: "bo",
      prio: snarast,
      typ: "uppgift",
    });
    expect(byggUppgift(post({ utfors: "2026-10-08T14:30" })).utfors).toBe("2026-10-08T14:30");
    expect(uppgiftFel(post({ deadline: "2026-10-07", utfors: "2026-10-08T14:30" })).join(" ")).toMatch(/aldrig båda/);
    expect(() => byggUppgift(post({ deadline: "2026-10-07", utfors: "2026-10-08T14:30" }))).toThrow(/aldrig båda/);
  });
});

describe("vyerna läser inkorgen och skriver ingen kopia", () => {
  const config = { idag: "2026-10-07", snarast, oppna: ["ny"], klara: ["hanterad", "avskriven"], typ: "uppgift" };

  it("en deadline i dag syns på Idag och på dagen, en framåt på Kommande", () => {
    const poster = [
      post({ deadline: "2026-10-07" }),
      post({ id: "u2", rubrik: "Nästa vecka", deadline: "2026-10-14" }),
    ];
    // ⛔ DET HÄR SER BARA ATT ARGUMENTET ÄR ORÖRT. Funktionen är ren, så en kopia
    // i händelsesamlingen kan inte göra provet rött. Den vakten hör till lane 19 i appen.
    const fore = poster.map((p) => ({ ...p }));
    const vy = visaUppgifter(poster, config);
    expect(vy.idag.map((r) => r.id)).toEqual(["u1"]);
    expect(vy.kommande.map((r) => r.id)).toEqual(["u2"]);
    expect(vy.kalender.map((r) => ({ id: r.id, date: r.date, handelseId: r.handelseId }))).toEqual([
      { id: "u1", date: "2026-10-07", handelseId: undefined },
      { id: "u2", date: "2026-10-14", handelseId: undefined },
    ]);
    expect(poster).toEqual(fore);
  });

  it("⛔ så snart som möjligt utan datum syns på Idag och inte i kalendern, och blir aldrig ett datum", () => {
    const vy = visaUppgifter([post({ prio: snarast }), post({ id: "u2", rubrik: "Senare", prio: "lag" })], config);
    expect(vy.idag.map((r) => r.id)).toEqual(["u1"]);
    expect(vy.idag[0].deadline).toBeUndefined();
    expect(vy.kalender).toEqual([]);
    expect(vy.inkorg.map((r) => r.id)).toEqual(["u2"]);
    expect(vy.kommande).toEqual([]);
  });

  it("⛔ en klar uppgift syns inte på Idag", () => {
    const vy = visaUppgifter([post({ deadline: "2026-10-07", status: "hanterad" })], config);
    expect(vy.idag).toEqual([]);
    expect(vy.kalender).toEqual([]);
    expect(vy.hanterade).toHaveLength(1);
  });

  it("en försenad ligger före en i dag, och en odaterad snarast efter dem", () => {
    const vy = visaUppgifter(
      [
        post({ id: "nu", rubrik: "I dag", deadline: "2026-10-07" }),
        post({ id: "snart", rubrik: "Snarast", prio: snarast }),
        post({ id: "sent", rubrik: "Igår", deadline: "2026-10-06" }),
      ],
      config,
    );
    expect(vy.idag.map((r) => r.id)).toEqual(["sent", "nu", "snart"]);
  });

  it("bocken anropar onKlar med inkorgens id, i listan och i kalendern", () => {
    const onKlar = vi.fn();
    const vy = visaUppgifter([post({ deadline: "2026-10-07", vem: "bo" })], { ...config, onKlar, namnFor: () => "Bo Lind" });
    expect(vy.idag[0].role).toBe("Bo Lind");
    render(<OpsEventList ariaLabel="Idag" events={vy.idag} />);
    fireEvent.click(screen.getByRole("button", { name: "Markera klar" }));
    expect(onKlar).toHaveBeenCalledWith("u1");

    render(<OpsCalendar ariaLabel="Kalender" entries={vy.kalender} today={IDAG} monthsBack={0} monthsForward={0} />);
    fireEvent.click(screen.getByRole("button", { name: /7, 1 post/ }));
    const panel = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
    fireEvent.click(panel.querySelector("[data-uppgift-klar]") ?? panel);
    expect(onKlar).toHaveBeenCalledTimes(2);
  });
});

const OPPNA = ["ny", "i-github"];
const KLARA = ["hanterad", "avskriven", "avvisad"];
const bas = { idag: "2026-10-07", snarast, oppna: OPPNA, klara: KLARA, typ: "uppgift" };

describe("0.78.1: status, dag, typ och ordning (#302)", () => {
  it("i-github med deadline i dag syns på Idag när appen säger att statusen är öppen", () => {
    const vy = visaUppgifter([post({ status: "i-github", deadline: "2026-10-07", typ: "uppgift" })], bas);
    expect(vy.avvisade).toEqual([]);
    expect(vy.idag.map((r) => r.id)).toEqual(["u1"]);
    expect(vy.kalender.map((r) => r.id)).toEqual(["u1"]);
  });

  it("en status appen kallat klar lämnar Idag, och en som inte står i någon lista avvisas", () => {
    const vy = visaUppgifter(
      [
        post({ status: "avvisad", deadline: "2026-10-07", typ: "uppgift" }),
        post({ id: "u2", rubrik: "Okänd", status: "pausad", deadline: "2026-10-07", typ: "uppgift" }),
      ],
      bas,
    );
    expect(vy.idag).toEqual([]);
    expect(vy.hanterade.map((r) => r.id)).toEqual(["u1"]);
    expect(vy.avvisade.map((r) => r.id)).toEqual(["u2"]);
  });

  it("idag är ÅÅÅÅ-MM-DD i gruppens zon, och ett Date avvisas", () => {
    const vy = visaUppgifter([post({ deadline: "2026-10-06", typ: "uppgift" })], bas);
    expect(vy.idag.map((r) => r.id)).toEqual(["u1"]);
    expect(vy.idag[0].daysLeft).toBe(-1);
    expect(() => visaUppgifter([post({ typ: "uppgift" })], { ...bas, idag: IDAG })).toThrow(/ÅÅÅÅ-MM-DD/);
  });

  it("ett ärende med snarast hamnar inte på Idag", () => {
    const vy = visaUppgifter(
      [
        post({ id: "arende", rubrik: "Ärende", prio: snarast, typ: "arende" }),
        post({ prio: snarast, typ: "uppgift" }),
      ],
      bas,
    );
    expect(vy.idag.map((r) => r.id)).toEqual(["u1"]);
    expect(vy.ovriga).toBe(1);
    expect(vy.kalender).toEqual([]);
  });

  it("försenat, i dag och snarast står kvar när raderna slås ihop med en händelse", () => {
    const vy = visaUppgifter(
      [
        post({ id: "nu", rubrik: "I dag", deadline: "2026-10-07", typ: "uppgift" }),
        post({ id: "snart", rubrik: "Snarast", prio: snarast, typ: "uppgift" }),
        post({ id: "sent", rubrik: "Igår", deadline: "2026-10-06", typ: "uppgift" }),
      ],
      bas,
    );
    const mote = { id: "mote", title: "Möte", daysLeft: 0 };
    const ihop = collectEvents({
      sources: [[vy.idag.find((r) => r.id === "snart"), mote, vy.idag.find((r) => r.id === "sent"), vy.idag.find((r) => r.id === "nu")]],
    });
    expect(ihop.map((r) => r.id)).toEqual(["sent", "mote", "nu", "snart"]);
  });

  it("bocken i snabbtitten anropar onKlar", () => {
    const onKlar = vi.fn();
    const vy = visaUppgifter([post({ deadline: "2026-10-07", typ: "uppgift" })], { ...bas, onKlar });
    render(<OpsCalendar ariaLabel="Kalender" entries={vy.kalender} today={IDAG} monthsBack={0} monthsForward={0} />);
    fireEvent.contextMenu(screen.getByRole("button", { name: /7, 1 post/ }));
    const titt = /** @type {HTMLElement} */ (document.querySelector("[data-snabbtitt]"));
    expect(titt).not.toBeNull();
    fireEvent.click(/** @type {Element} */ (titt.querySelector("[data-uppgift-klar]")));
    expect(onKlar).toHaveBeenCalledWith("u1");
  });

  it("loggen för 0.78.0 påstår inte att 0.77.0 och 0.76.3 är omergade", () => {
    const logg = fs.readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
    const avsnitt = logg.split(/^## /m).find((s) => s.startsWith("0.78.0\n"));
    expect(avsnitt).toBeTruthy();
    expect(avsnitt).not.toMatch(/Ingen av dem är mergad/);
    expect(avsnitt).toMatch(/0\.77\.0/);
    expect(avsnitt).toMatch(/0\.76\.3/);
  });
});
