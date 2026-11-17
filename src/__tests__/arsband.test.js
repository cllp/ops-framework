import { describe, expect, it } from "vitest";
import { MAX_ARSBAND, arsband } from "../lib/arsband.js";

/* cllp/lifehub.app#874: årsvyns band. Bara heldag och flera dagar blir band, ett per kalender och dag, i listans ordning. */

const kalendrar = [
  { id: "barn", namn: "Barnen hos CP", farg: 2 },
  { id: "lov", namn: "Skollov", farg: 4 },
  { id: "hyra", namn: "Uthyrning", farg: 6 },
];
const val = { kalendrar, forvaldId: "barn" };

describe("arsband (#874)", () => {
  it("⛔ en flerdagspost ger ett band på varje dag den täcker, en heldag ett band, ett möte inget", () => {
    const ut = arsband(
      [
        { id: "v1", date: "2027-07-05", endDate: "2027-07-07", title: "Barnvecka", kalender: kalendrar[0] },
        { id: "h1", date: "2027-07-10", allDay: true, title: "Midsommar", kalender: kalendrar[1] },
        { id: "m1", date: "2027-07-06", time: "14:00", title: "Möte", kalender: kalendrar[2] },
      ],
      val,
    );
    expect([...ut.keys()].sort()).toEqual(["2027-07-05", "2027-07-06", "2027-07-07", "2027-07-10"]);
    expect(ut.get("2027-07-06")).toEqual([{ id: "barn", namn: "Barnen hos CP", ton: 2 }]);
  });

  it("⛔ två kalendrar samma dag står i listans ordning, inte i postordning, och en kalender står en gång", () => {
    const ut = arsband(
      [
        { id: "u", date: "2027-07-01", endDate: "2027-07-03", title: "Hyrd", kalender: kalendrar[2] },
        { id: "b1", date: "2027-07-02", endDate: "2027-07-04", title: "Barn", kalender: kalendrar[0] },
        { id: "b2", date: "2027-07-02", allDay: true, title: "Barn igen", kalender: kalendrar[0] },
      ],
      val,
    );
    expect(ut.get("2027-07-02")?.map((k) => k.id)).toEqual(["barn", "hyra"]);
  });

  it("en post utan kalender hör till den förvalda, och taket är tre", () => {
    const ut = arsband([{ id: "x", date: "2027-01-01", allDay: true, title: "Nyår" }], val);
    expect(ut.get("2027-01-01")?.[0]?.id).toBe("barn");
    expect(MAX_ARSBAND).toBe(3);
  });

  it("tomt underlag ger en tom karta", () => {
    expect(arsband([], val).size).toBe(0);
  });
});
