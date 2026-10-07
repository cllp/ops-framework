import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { byggUppgift, uppgiftFel, visaUppgifter } from "../lib/uppgift.js";
import { OpsEventList } from "../components/OpsEventList.jsx";
import { OpsCalendar } from "../components/OpsCalendar.jsx";

const IDAG = new Date(2026, 9, 7, 12, 0, 0);
const snarast = "snarast";

/** @param {Record<string, unknown>} extra */
const post = (extra) => /** @type {any} */ ({ id: "u1", rubrik: "Ring revisorn", ...extra });

describe("uppgiftens form", () => {
  it("deadline eller utförs, aldrig båda, och vem och prioritet följer med", () => {
    expect(byggUppgift(post({ deadline: "2026-10-07", vem: "bo", prio: snarast }))).toEqual({
      id: "u1",
      rubrik: "Ring revisorn",
      status: "ny",
      deadline: "2026-10-07",
      vem: "bo",
      prio: snarast,
    });
    expect(byggUppgift(post({ utfors: "2026-10-08T14:30" })).utfors).toBe("2026-10-08T14:30");
    expect(uppgiftFel(post({ deadline: "2026-10-07", utfors: "2026-10-08T14:30" })).join(" ")).toMatch(/aldrig båda/);
    expect(() => byggUppgift(post({ deadline: "2026-10-07", utfors: "2026-10-08T14:30" }))).toThrow(/aldrig båda/);
  });
});

describe("vyerna läser inkorgen och skriver ingen kopia", () => {
  const config = { idag: IDAG, snarast };

  it("en deadline i dag syns på Idag och på dagen, en framåt på Kommande", () => {
    const poster = [
      post({ deadline: "2026-10-07" }),
      post({ id: "u2", rubrik: "Nästa vecka", deadline: "2026-10-14" }),
    ];
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
