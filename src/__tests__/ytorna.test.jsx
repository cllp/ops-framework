import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { skapaKallregister } from "../lib/kallor.js";
import { defineModule } from "../lib/modul.js";
import { OpsSok } from "../components/OpsSok.jsx";
import { OpsNotiser, olasta } from "../components/OpsNotiser.jsx";
import { OpsOversikt, iOrdning } from "../components/OpsOversikt.jsx";

/**
 * Fas 3: de tre ytor som saknades (#140 Sök, #141 Notiser, #142 Översikt).
 */

const GRUPP = { groupId: "bolaget" };
const modul = (/** @type {Record<string, Function>} */ kallor, /** @type {string} */ id) =>
  defineModule({ id, namn: { sv: id }, nav: [], routes: [], samlingar: [], kallor, skapar: [] });

describe("Sök", () => {
  const tva = () =>
    skapaKallregister([
      modul({ sok: async ({ text }) => (text === "faktura" ? [{ id: "f1", titel: "Faktura 1", text: "1 200 kr", href: "/ekonomi/f1" }] : []) }, "ekonomi"),
      modul({ sok: async () => [{ id: "m1", titel: "Mätning" }] }, "liv"),
      // ⛔ En modul utan sökkälla ska varken synas eller fela.
      modul({ handelser: async () => [] }, "tyst"),
    ]);

  it("söker inte förrän något skrivits, och säger det", async () => {
    const register = tva();
    render(<OpsSok register={register} grupp={GRUPP} />);
    expect(screen.getByText("Skriv något för att söka.")).toBeTruthy();
  });

  /*
   * ⛔ DET HÄR PROVET SAKNADES, OCH SVEPET VISADE DET. Mutationen som sökte på
   * ett tomt fält överlevde, eftersom inget prov mätte att källan INTE
   * anropas. En modul som får en tom söksträng svarar rimligen med allt den
   * har, och då är "sökresultatet" en lista som ser ut som ett.
   */
  it("frågar inte källan förrän något skrivits", async () => {
    const sok = vi.fn(async () => []);
    render(<OpsSok register={skapaKallregister([modul({ sok }, "ekonomi")])} grupp={GRUPP} />);
    await waitFor(() => expect(screen.getByText("Skriv något för att söka.")).toBeTruthy());
    expect(sok).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Sök"), { target: { value: "x" } });
    await waitFor(() => expect(sok).toHaveBeenCalledTimes(1));
  });

  /* ⛔ Också ett saknat prov: ett trasigt kontrakt ska synas, inte bli noll träffar. */
  it("ritar felet i stället för att svälja det till noll träffar", async () => {
    const trasig = skapaKallregister([modul({ sok: async () => [{ titel: "Utan id" }] }, "ekonomi")]);
    render(<OpsSok register={trasig} grupp={GRUPP} />);
    fireEvent.change(screen.getByLabelText("Sök"), { target: { value: "x" } });
    await waitFor(() => expect(screen.getByText(/saknar id/)).toBeTruthy());
  });

  it("visar träffar grupperade per modul", async () => {
    render(<OpsSok register={tva()} grupp={GRUPP} modulnamn={{ ekonomi: "Ekonomi", liv: "Liv" }} />);
    fireEvent.change(screen.getByLabelText("Sök"), { target: { value: "faktura" } });
    await waitFor(() => expect(screen.getByText("Faktura 1")).toBeTruthy());
    expect(screen.getByRole("list", { name: "Ekonomi" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Liv" })).toBeTruthy();
  });

  it("en modul utan sökkälla syns inte och ger inget fel", async () => {
    render(<OpsSok register={tva()} grupp={GRUPP} modulnamn={{ tyst: "Tyst" }} />);
    fireEvent.change(screen.getByLabelText("Sök"), { target: { value: "faktura" } });
    await waitFor(() => expect(screen.getByText("Faktura 1")).toBeTruthy());
    expect(screen.queryByRole("list", { name: "Tyst" })).toBe(null);
  });

  /*
   * ⛔ TOMHETEN BÄR SIN FRÅGA. Utan sökordet undrar läsaren om fältet lästes,
   * och med det syns dessutom stavfelet, som är den vanligaste orsaken.
   */
  it("säger vad som inte gav träff", async () => {
    render(<OpsSok register={skapaKallregister([modul({ sok: async () => [] }, "ekonomi")])} grupp={GRUPP} />);
    fireEvent.change(screen.getByLabelText("Sök"), { target: { value: "fakura" } });
    await waitFor(() => expect(screen.getByText('Inga träffar för "fakura".')).toBeTruthy());
  });

  it("öppnar träffen på dess länk", async () => {
    const onOppna = vi.fn();
    render(<OpsSok register={tva()} grupp={GRUPP} onOppna={onOppna} />);
    fireEvent.change(screen.getByLabelText("Sök"), { target: { value: "faktura" } });
    await waitFor(() => expect(screen.getByText("Faktura 1")).toBeTruthy());
    fireEvent.click(screen.getByText("Faktura 1"));
    expect(onOppna).toHaveBeenCalledWith("/ekonomi/f1");
  });
});

describe("Notiser", () => {
  const poster = [
    { id: "n1", titel: "Kan vänta", prio: "lag" },
    { id: "n2", titel: "Brådskar", prio: "hog" },
    { id: "n3", titel: "Vanlig", prio: "normal" },
  ];
  const register = () => skapaKallregister([modul({ notiser: async () => poster }, "ekonomi")]);

  it("sorterar brådskande först", async () => {
    render(<OpsNotiser register={register()} fraga={GRUPP} />);
    await waitFor(() => expect(screen.getByText("Brådskar")).toBeTruthy());
    const rader = screen.getAllByRole("listitem").map((r) => r.textContent);
    expect(rader[0]).toContain("Brådskar");
    expect(rader[2]).toContain("Kan vänta");
  });

  /* ⛔ Färgen får aldrig bära betydelsen ensam. */
  it("skriver ut vad prickens färg betyder", async () => {
    render(<OpsNotiser register={register()} fraga={GRUPP} />);
    await waitFor(() => expect(screen.getByText("Brådskande")).toBeTruthy());
    expect(screen.getByText("Kan vänta", { selector: "span:not(.truncate)" })).toBeTruthy();
  });

  it("sätter läsmärket före navigeringen", async () => {
    const ordning = [];
    render(
      <OpsNotiser
        register={skapaKallregister([modul({ notiser: async () => [{ id: "n1", titel: "En", prio: "hog", href: "/dit" }] }, "e")])}
        fraga={GRUPP}
        onLast={() => ordning.push("last")}
        onOppna={() => ordning.push("oppna")}
      />,
    );
    await waitFor(() => expect(screen.getByText("En")).toBeTruthy());
    fireEvent.click(screen.getByText("En"));
    expect(ordning).toEqual(["last", "oppna"]);
  });

  it("säger ifrån när det inte finns något nytt", async () => {
    render(<OpsNotiser register={skapaKallregister([modul({ notiser: async () => [] }, "e")])} fraga={GRUPP} />);
    await waitFor(() => expect(screen.getByText("Inget nytt.")).toBeTruthy());
  });

  describe("olasta", () => {
    it("räknar bort det jag läst", () => {
      expect(olasta(poster, ["n2"]).map((p) => p.id)).toEqual(["n1", "n3"]);
    });

    /*
     * ⛔ RÄKNAREN KAN INTE NÅ EN GRUPP JAG INTE ÄR MED I, och det följer av
     * kontraktet: källan frågas per grupp, och en grupp jag inte är med i
     * frågas aldrig. Provet mäter just det: posterna som kommer in är bara
     * den frågade gruppens.
     */
    it("ser bara den frågade gruppens poster", async () => {
      const r = skapaKallregister([
        modul({ notiser: async ({ groupId }) => (groupId === "bolaget" ? [{ id: "b1", titel: "Min", prio: "hog" }] : [{ id: "x1", titel: "Inte min", prio: "hog" }]) }, "e"),
      ]);
      expect(olasta(await r.notiser(GRUPP), []).map((p) => p.id)).toEqual(["b1"]);
    });
  });
});

describe("Översikt", () => {
  const Kort = (/** @type {any} */ p) => <p>{`Kort ${p.id}`}</p>;
  const register = () =>
    skapaKallregister([
      modul({ widgets: async () => [{ id: "a", titel: { sv: "Kort A" }, vy: Kort }] }, "ekonomi"),
      modul({ widgets: async () => [{ id: "b", titel: { sv: "Kort B" }, vy: Kort }] }, "liv"),
    ]);

  it("ritar ett kort per widget, med ramverkets rubrik", async () => {
    render(<OpsOversikt register={register()} fraga={GRUPP} />);
    await waitFor(() => expect(screen.getByText("Kort A")).toBeTruthy());
    expect(screen.getByText("Kort B")).toBeTruthy();
  });

  /*
   * ⛔ OCKSÅ ETT SAKNAT PROV. `iOrdning` var provad för sig, men ingenting
   * mätte att vyn faktiskt ANVÄNDER den. En ren funktion som ingen anropar är
   * lika värdelös som ingen funktion alls.
   */
  it("ritar korten i gruppens ordning", async () => {
    render(<OpsOversikt register={register()} fraga={GRUPP} ordning={["liv:b", "ekonomi:a"]} />);
    await waitFor(() => expect(screen.getByText("Kort A")).toBeTruthy());
    const rubriker = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(rubriker).toEqual(["Översikt", "Kort B", "Kort A"]);
  });

  it("säger varför den är tom och pekar vidare, i stället för ett tomt rutnät", async () => {
    render(<OpsOversikt register={skapaKallregister([])} fraga={GRUPP} tomAtgard={<a href="/installningar">Till inställningarna</a>} />);
    await waitFor(() => expect(screen.getByText(/Inga moduler är påslagna/)).toBeTruthy());
    expect(screen.getByText("Till inställningarna")).toBeTruthy();
  });

  describe("iOrdning", () => {
    const w = [
      { id: "a", modulId: "ekonomi" },
      { id: "b", modulId: "liv" },
      { id: "c", modulId: "liv" },
    ];

    it("följer gruppens ordning", () => {
      expect(iOrdning(w, ["liv:c", "ekonomi:a"]).map((x) => x.id)).toEqual(["c", "a", "b"]);
    });

    /*
     * ⛔ EN NY MODUL SKA DYKA UPP, INTE FÖRSVINNA. Widgetar som saknas i
     * ordningen hamnar sist i stället för att filtreras bort, annars är en ny
     * modul osynlig tills någon redigerat en lista ingen visste fanns.
     */
    it("lägger det som saknas i ordningen sist, inte utanför", () => {
      expect(iOrdning(w, ["liv:b"]).map((x) => x.id)).toEqual(["b", "a", "c"]);
    });

    it("ignorerar id i ordningen som inte finns", () => {
      expect(iOrdning(w, ["borta:x", "liv:b"]).map((x) => x.id)).toEqual(["b", "a", "c"]);
    });

    it("utan ordning behålls källans", () => {
      expect(iOrdning(w).map((x) => x.id)).toEqual(["a", "b", "c"]);
    });
  });
});
