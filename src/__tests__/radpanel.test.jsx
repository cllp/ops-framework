import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { OpsEventList } from "../components/OpsEventList.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";

/**
 * 0.145.0 (cllp/ops-framework#446): en rad, en panel. CP 2026-10-25 08:22, med en skärmbild av kalenderns dagruta (28 oktober, "Attest större
 * leverantörsfakturor" och "Kolla omatchade bankrader", båda Påminnelse): "Varför kan man inte dela alla händelser? Och alla kalenderhändelser eller
 * idag-listor kan man inte trycka på."
 *
 * ⛔ Provet gör det en person gör: trycker på raden i dagpanelen och i Idag-listan och läser panelen. jsdom kör ingen CSS, så var knappraden SITTER
 * mäts inte här utan i skärmbilden (`scripts/radpanel-montage.mjs`, regel 12); här mäts att den är panelens sista element, att Dela är dess sista knapp och
 * att samma ordning gäller för två olika källor.
 *
 * ⛔ Varje "beter sig som förut" har ett motsatt fall i samma prov, så att ett prov inte blir grönt av att inget alls öppnas.
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const NU = new Date(2026, 9, 25, 12);

const klar = vi.fn();
const delaEkonomi = vi.fn();
const KALLOR = {
  paminnelse: {
    etikett: "Påminnelse",
    atgarder: (/** @type {any} */ r) => [
      { id: "klar", etikett: "Klar", onClick: () => klar(r.id) },
      { id: "rutin", etikett: "Öppna rutinen", href: "/rutiner/attest" },
    ],
    dela: () => ({ skal: "Påminnelser delas inte ännu.", istallet: "Skriv en händelse om andra ska se den." }),
  },
  ekonomi: {
    etikett: "Ekonomi",
    atgarder: () => [{ id: "oppna", etikett: "Öppna i Ekonomi", href: "/ekonomi/f1" }],
    dela: () => ({ onClick: delaEkonomi }),
  },
  inkorg: { etikett: "Inkorgen" },
};

const POSTER = [
  { id: "paminnelse:attest", date: "2026-10-28", title: "Attest större leverantörsfakturor", not: "Påminnelse" },
  { id: "ekonomi:f1", date: "2026-10-28", title: "Faktura Hosting", not: "Faktura", details: <p>Förfaller 28 okt, 1 200 kr</p> },
  { id: "vanlig-post", date: "2026-10-28", title: "Vanlig post utan källa", not: "Övrigt" },
  { id: "okand:z", date: "2026-10-28", title: "Rad från en källa manifestet inte känner" },
];

/** @param {Partial<import("react").ComponentProps<typeof OpsCalendar>>} extra */
function Kalender(extra = {}) {
  return <OpsCalendar ariaLabel="Kalender" today={NU} entries={POSTER} {...extra} />;
}

/** React:s useId ger nya id:n för varje montering: de är inte en skillnad i vad som ritas. */
const utanId = (/** @type {string} */ html) => html.replace(/:r[0-9a-z]+:/g, ":id:");

const oppnaDag = () => fireEvent.click(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-28"]')));
const dagpanel = () => /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
const radpanel = () => document.querySelector("[data-radpanel]");

describe("⛔ #446: kalenderns dagruta, en rad med en källa öppnas i panelen", () => {
  it("en påminnelse öppnas med rubrik, 'Från Påminnelse' och källans knappar, och Tillbaka lämnar dagen vald", async () => {
    const user = userEvent.setup();
    render(<Kalender radkallor={KALLOR} />);
    oppnaDag();
    await user.click(within(dagpanel()).getByRole("button", { name: "Attest större leverantörsfakturor" }));

    const panel = /** @type {HTMLElement} */ (radpanel());
    expect(panel).not.toBeNull();
    expect(within(panel).getByRole("heading", { level: 1, name: "Attest större leverantörsfakturor" })).toBeInTheDocument();
    expect(panel.querySelector("[data-handelsekalla]")?.textContent).toBe("Från Påminnelse");
    expect(panel.querySelector("[data-handelsedatum]")?.textContent).toContain("onsdag 28 oktober 2026");
    expect(panel.querySelector("[data-handelsemeta]")?.textContent).toContain("Påminnelse");

    const knappar = within(panel).getByRole("group", { name: "Åtgärder" });
    expect(within(knappar).getByRole("button", { name: "Klar" })).toBeInTheDocument();
    expect(within(knappar).getByRole("link", { name: "Öppna rutinen" }).getAttribute("href")).toBe("/rutiner/attest");
    await user.click(within(knappar).getByRole("button", { name: "Klar" }));
    expect(klar).toHaveBeenCalledWith("paminnelse:attest");

    await user.click(within(panel).getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(radpanel()).toBeNull());
    expect(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-28"]')).getAttribute("aria-pressed")).toBe("true");
  });

  it("rader utan källa i manifestet beter sig som förut: ingen knapp, ingen panel", async () => {
    const user = userEvent.setup();
    render(<Kalender radkallor={KALLOR} />);
    oppnaDag();
    for (const titel of ["Vanlig post utan källa", "Rad från en källa manifestet inte känner"]) {
      expect(within(dagpanel()).queryByRole("button", { name: titel }), titel).toBeNull();
      await user.click(within(dagpanel()).getByText(titel));
    }
    expect(radpanel()).toBeNull();
    // Motsatsen i samma prov: raden MED källa är en knapp, så provet kan inte vara grönt av att inget är tryckbart.
    expect(within(dagpanel()).getByRole("button", { name: "Attest större leverantörsfakturor" })).toBeInTheDocument();
  });

  it("utan manifest ser dagpanelen exakt ut som förut, rad för rad", () => {
    const ren = render(<Kalender />);
    oppnaDag();
    const utan = utanId(dagpanel().innerHTML);
    ren.unmount();
    render(<Kalender radkallor={{ helt: { etikett: "Annan källa" } }} />);
    oppnaDag();
    expect(utanId(dagpanel().innerHTML)).toBe(utan);
    expect(dagpanel().querySelector("[data-radlank], [data-externlank]")).toBeNull();
  });

  it("snabbtitten (långtryck) öppnar också raden", async () => {
    const user = userEvent.setup();
    render(<Kalender radkallor={KALLOR} />);
    fireEvent.contextMenu(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-28"]')));
    const titt = /** @type {HTMLElement} */ (document.querySelector("[data-snabbtitt]"));
    expect(within(titt).queryByRole("button", { name: "Vanlig post utan källa" })).toBeNull();
    await user.click(within(titt).getByRole("button", { name: "Faktura Hosting" }));
    const panel = /** @type {HTMLElement} */ (radpanel());
    expect(panel.querySelector("[data-handelsekalla]")?.textContent).toBe("Från Ekonomi");
    // Postens utfällning (details) är panelens text: panelen visar minst det raden visade.
    expect(panel.querySelector("[data-handelsebeskrivning]")?.textContent).toContain("Förfaller 28 okt, 1 200 kr");
  });

  it("en post med handelseId eller extern går aldrig hit, också när id:t börjar med en känd källa", async () => {
    const user = userEvent.setup();
    const oppnaHandelse = vi.fn();
    const poster = [
      { id: "paminnelse:h", handelseId: "h1", date: "2026-10-28", title: "Händelse med prefix" },
      { id: "paminnelse:e", date: "2026-10-28", title: "Extern med prefix", extern: { kalla: "Från Apple, ändras i Apple" } },
    ];
    render(<Kalender entries={poster} radkallor={KALLOR} onOppnaHandelse={oppnaHandelse} />);
    oppnaDag();
    await user.click(within(dagpanel()).getByRole("link", { name: "Händelse med prefix" }));
    expect(oppnaHandelse).toHaveBeenCalledWith("h1");
    await user.click(within(dagpanel()).getByRole("button", { name: "Extern med prefix" }));
    expect(radpanel()).toBeNull();
    expect(document.querySelector("[data-externpanel]")).not.toBeNull();
  });
});

describe("⛔ #446: Idag, en rad med en källa öppnas i samma panel", () => {
  const HANDELSER = [
    { id: "ekonomi:f1", title: "Faktura Hosting", daysLeft: 3, when: "Om 3 dagar", deadline: "Senast 28 okt", kind: "Faktura", details: <p>1 200 kr</p> },
    { id: "paminnelse:attest", title: "Attest större leverantörsfakturor", daysLeft: 3, when: "Om 3 dagar" },
    { id: "uppgift-utan-kalla", title: "Rad utan källa", daysLeft: 1 },
  ];

  it("raden får en knapp som täcker kortet, panelen säger 'Från Ekonomi' och 'När', och knappen är källans", async () => {
    const user = userEvent.setup();
    render(<OpsEventList events={HANDELSER} radkallor={KALLOR} />);
    await user.click(screen.getByRole("button", { name: "Faktura Hosting" }));
    const panel = /** @type {HTMLElement} */ (radpanel());
    expect(panel.querySelector("[data-handelsekalla]")?.textContent).toBe("Från Ekonomi");
    expect(panel.querySelector("[data-handelsedatum]")?.textContent).toBe("Om 3 dagar · Senast 28 okt");
    expect(panel.querySelector("[data-handelsemeta]")?.textContent).toContain("Faktura");
    expect(panel.querySelector("[data-handelsebeskrivning]")?.textContent).toBe("1 200 kr");
    expect(within(panel).getByRole("link", { name: "Öppna i Ekonomi" }).getAttribute("href")).toBe("/ekonomi/f1");
    // Dela går att trycka på när källan säger det.
    await user.click(within(panel).getByRole("button", { name: "Dela" }));
    expect(delaEkonomi).toHaveBeenCalledTimes(1);
    await user.click(within(panel).getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(radpanel()).toBeNull());
  });

  it("en källa kan namnges av raden: Apple och Google under samma källa säger 'Från Apple' och 'Från Google'", async () => {
    const user = userEvent.setup();
    const ical = { ical: { etikett: (/** @type {any} */ r) => r.kalenderNamn } };
    const rader = [
      { id: "ical:a1", title: "Tandläkare", daysLeft: 2, kalenderNamn: "Apple" },
      { id: "ical:g1", title: "Föräldramöte", daysLeft: 3, kalenderNamn: "Google" },
    ];
    render(<OpsEventList events={rader} radkallor={ical} />);
    await user.click(screen.getByRole("button", { name: "Tandläkare" }));
    expect(radpanel()?.querySelector("[data-handelsekalla]")?.textContent).toBe("Från Apple");
    await user.click(within(/** @type {HTMLElement} */ (radpanel())).getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(radpanel()).toBeNull());
    await user.click(screen.getByRole("button", { name: "Föräldramöte" }));
    expect(radpanel()?.querySelector("[data-handelsekalla]")?.textContent).toBe("Från Google");
  });

  it("en rad utan källa är text som förut, och listan utan manifest är identisk", () => {
    const utan = render(<OpsEventList events={HANDELSER} />);
    const html = utanId(utan.container.innerHTML);
    utan.unmount();
    const med = render(<OpsEventList events={HANDELSER} radkallor={{ annan: { etikett: "Annan" } }} />);
    expect(utanId(med.container.innerHTML)).toBe(html);
    expect(screen.queryByRole("button", { name: "Rad utan källa" })).toBeNull();
    expect(screen.getByText("Rad utan källa")).toBeInTheDocument();
  });

  it("raden behåller sin utfällning: panelen ersätter ingen väg att läsa den", () => {
    render(<OpsEventList events={HANDELSER} radkallor={KALLOR} />);
    expect(screen.getByRole("button", { name: /Visa detaljer för Faktura Hosting/ })).toBeInTheDocument();
  });

  it("en rad som tas bort ur listan medan panelen är öppen stänger panelen", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OpsEventList events={HANDELSER} radkallor={KALLOR} />);
    await user.click(screen.getByRole("button", { name: "Faktura Hosting" }));
    expect(radpanel()).not.toBeNull();
    rerender(<OpsEventList events={HANDELSER.slice(1)} radkallor={KALLOR} />);
    await waitFor(() => expect(radpanel()).toBeNull());
  });
});

describe("⛔ #446: Dela står på alla rader, också de som inte går att dela", () => {
  it("med ett skäl står skälet och vad man gör i stället i klartext, och ingen Dela-knapp ritas", async () => {
    const user = userEvent.setup();
    render(<OpsEventList events={[{ id: "paminnelse:attest", title: "Attest", daysLeft: 1 }]} radkallor={KALLOR} />);
    await user.click(screen.getByRole("button", { name: "Attest" }));
    const panel = /** @type {HTMLElement} */ (radpanel());
    const skal = /** @type {HTMLElement} */ (panel.querySelector("[data-knapprad-skal]"));
    expect(skal.textContent).toBe("Går inte att dela: Påminnelser delas inte ännu. Gör så här i stället: Skriv en händelse om andra ska se den.");
    expect(within(panel).queryByRole("button", { name: "Dela" })).toBeNull();
    // Källans egna knappar står kvar bredvid.
    expect(within(panel).getByRole("button", { name: "Klar" })).toBeInTheDocument();
  });

  it("en källa som inte svarat på dela får ramverkets skäl, inte tystnad", async () => {
    const user = userEvent.setup();
    render(<OpsEventList events={[{ id: "inkorg:i1", title: "Inkorgspost", daysLeft: 1 }]} radkallor={KALLOR} />);
    await user.click(screen.getByRole("button", { name: "Inkorgspost" }));
    const panel = /** @type {HTMLElement} */ (radpanel());
    expect(panel.querySelector("[data-knapprad-skal]")?.textContent).toBe("Går inte att dela: Den här raden går inte att dela härifrån ännu.");
    expect(within(panel).queryByRole("button", { name: "Dela" })).toBeNull();
  });

  it("knappraden är panelens sista element och Dela dess sista knapp, för två olika källor", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OpsEventList events={[{ id: "ekonomi:f1", title: "Faktura Hosting", daysLeft: 1, details: <p>mycket text</p> }]} radkallor={KALLOR} />);
    await user.click(screen.getByRole("button", { name: "Faktura Hosting" }));
    const ekonomi = /** @type {HTMLElement} */ (document.querySelector("[data-handelsepanel]"));
    expect(ekonomi.lastElementChild?.querySelector("[data-knapprad]")).not.toBeNull();
    const knappar = within(ekonomi).getByRole("group", { name: "Åtgärder" });
    expect(Array.from(knappar.children).at(-1)?.textContent).toBe("Dela");

    await user.click(within(ekonomi).getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(radpanel()).toBeNull());
    rerender(<OpsEventList events={[{ id: "paminnelse:attest", title: "Attest", daysLeft: 1 }]} radkallor={{ paminnelse: { etikett: "Påminnelse", atgarder: () => [{ id: "a", etikett: "A", href: "/a" }, { id: "b", etikett: "B", href: "/b" }], dela: () => ({ href: "/dela" }) } }} />);
    await user.click(screen.getByRole("button", { name: "Attest" }));
    const pam = /** @type {HTMLElement} */ (document.querySelector("[data-handelsepanel]"));
    expect(pam.lastElementChild?.querySelector("[data-knapprad]")).not.toBeNull();
    expect(Array.from(within(pam).getByRole("group", { name: "Åtgärder" }).children).map((x) => x.textContent)).toEqual(["A", "B", "Dela"]);
  });
});

describe("⛔ #446: skalet delar manifestet med ytorna, en yta kan ta ett eget", () => {
  const Skal = (/** @type {{ radkallor?: any, children: import("react").ReactNode }} */ { radkallor, children }) => (
    <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Idag" }]} activeHref="/" radkallor={radkallor}>
      {children}
    </OpsAppShell>
  );

  it("radkallor på OpsAppShell räcker för både listan och kalendern", async () => {
    const user = userEvent.setup();
    render(
      <Skal radkallor={KALLOR}>
        <OpsEventList events={[{ id: "paminnelse:attest", title: "Attest i listan", daysLeft: 1 }]} />
        <Kalender />
      </Skal>,
    );
    await user.click(screen.getByRole("button", { name: "Attest i listan" }));
    expect(radpanel()?.querySelector("[data-handelsekalla]")?.textContent).toBe("Från Påminnelse");
    await user.click(within(/** @type {HTMLElement} */ (radpanel())).getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(radpanel()).toBeNull());
    oppnaDag();
    expect(within(dagpanel()).getByRole("button", { name: "Faktura Hosting" })).toBeInTheDocument();
  });

  it("utan manifest i skalet och utan prop är raderna som förut", () => {
    render(
      <Skal>
        <OpsEventList events={[{ id: "paminnelse:attest", title: "Attest i listan", daysLeft: 1 }]} />
      </Skal>,
    );
    expect(screen.queryByRole("button", { name: "Attest i listan" })).toBeNull();
  });

  it("ytans egen radkallor går före skalets", async () => {
    const user = userEvent.setup();
    render(
      <Skal radkallor={KALLOR}>
        <OpsEventList events={[{ id: "paminnelse:attest", title: "Attest i listan", daysLeft: 1 }]} radkallor={{ paminnelse: { etikett: "Egen källa" } }} />
      </Skal>,
    );
    await user.click(screen.getByRole("button", { name: "Attest i listan" }));
    expect(radpanel()?.querySelector("[data-handelsekalla]")?.textContent).toBe("Från Egen källa");
  });

  it("ett trasigt manifest kastar där det tas emot", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Skal radkallor={{ ekonomi: {} }}>x</Skal>)).toThrow(/saknar etikett/);
    expect(() => render(<OpsEventList events={[{ id: "a", title: "a", daysLeft: 1 }]} radkallor={/** @type {any} */ ([])} />)).toThrow(/karta/);
    tyst.mockRestore();
  });
});

describe("⛔ #446: händelsepanelen är oförändrad", () => {
  it("utan knapprad ritas ingen knapprad, och datumraden är datumet", () => {
    render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Möte", datum: "2026-10-28", nar: "Ska inte synas" }} onTillbaka={() => {}} />);
    expect(document.querySelector("[data-knapprad]")).toBeNull();
    expect(document.querySelector("[data-handelsedatum]")?.textContent).toBe("onsdag 28 oktober 2026");
  });

  it("'Datum ej satt' står kvar för en händelse utan datum och utan 'nar'", () => {
    render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Möte" }} onTillbaka={() => {}} />);
    expect(document.querySelector("[data-handelsedatum]")?.textContent).toBe("Datum ej satt");
  });

  it("knapprad kräver sin form", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsHandelsePanel handelse={{ id: "h1", titel: "Möte" }} onTillbaka={() => {}} knapprad={/** @type {any} */ ({})} />)).toThrow(/knapprad har formen/);
    tyst.mockRestore();
  });
});
