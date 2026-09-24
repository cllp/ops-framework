import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ACTIVITY_RESULTS, createActivityLog, groupByDay, isUnread, unreadCount } from "../lib/aktivitet.js";
import { createActivityWriter } from "../node/aktivitet.js";
import { OpsActivityButton, OpsActivityList } from "../components/OpsActivity.jsx";

const SLAG = [
  { value: "import", label: "Import" },
  { value: "bank", label: "Banksynk" },
];

const modell = createActivityLog({ kinds: SLAG });

describe("createActivityLog", () => {
  it("kräver slag, eftersom taxonomin är appens och inte ramverkets", () => {
    expect(() => createActivityLog({ kinds: [] })).toThrow(/minst ett slag/);
    expect(() => createActivityLog({})).toThrow(/minst ett slag/);
  });

  it("kräver ett ord till varje slag", () => {
    // ⛔ Ett slag utan ord blir en rad som ritas tom, och det felet syns först
    // när någon läser listan en vecka senare.
    expect(() => createActivityLog({ kinds: [{ value: "import" }] })).toThrow(/label/);
  });

  it("vägrar två slag med samma värde", () => {
    /*
     * ⛔ Vilket av dem `find` hittar beror på ordningen, alltså på en slump. Ett
     * slag som ibland heter fel är svårare att upptäcka än ett som alltid gör det.
     */
    expect(() => createActivityLog({ kinds: [...SLAG, { value: "import", label: "Annat" }] })).toThrow(/står två gånger/);
  });

  it("bygger raden med tiden från skrivaren, inte från läsaren", () => {
    const rad = modell.buildEntry({ slag: "import", rubrik: "13 underlag skrevs" }, { nu: () => "2026-09-24T10:00:00.000Z" });
    expect(rad).toEqual({
      nar: "2026-09-24T10:00:00.000Z",
      slag: "import",
      rubrik: "13 underlag skrevs",
      resultat: "ok",
    });
  });

  it("standardar till ok, eftersom motsatsen gör varje glömd flagga till ett falskt larm", () => {
    expect(modell.buildEntry({ slag: "import", rubrik: "Kört" }).resultat).toBe("ok");
    expect(ACTIVITY_RESULTS).toEqual(["ok", "fel"]);
  });

  it("skriver frivilliga fält bara när de finns, aldrig som null", () => {
    // ⛔ Ett tomt fält i listan ser ut som en uppgift som saknas just för den
    // raden, när sanningen är att raden aldrig hade någon.
    const rad = modell.buildEntry({ slag: "import", rubrik: "Kört", detalj: "   ", kalla: "" });
    expect("detalj" in rad).toBe(false);
    expect("kalla" in rad).toBe(false);
  });

  it("vägrar ett fel utan skäl", () => {
    // ⛔ En rad som säger att något gick sönder utan att säga vad går inte att
    // åtgärda, och den ser ändå ut som att loggen fungerar.
    expect(() => modell.buildEntry({ slag: "import", rubrik: "Kört", resultat: "fel" })).toThrow(/kräver `fel`/);
  });

  it("kastar på ett okänt slag i stället för att skriva en rad som ritas tom", () => {
    expect(() => modell.buildEntry({ slag: "nagot-nytt", rubrik: "Kört" })).toThrow(/finns inte i konfigurationen/);
  });

  it("kastar på en rad utan rubrik", () => {
    expect(() => modell.buildEntry({ slag: "import", rubrik: "   " })).toThrow(/Rubriken saknas/);
  });

  it("svarar med SKÄL till en yta som kan visa dem, och kastar för den som inte kan", () => {
    /*
     * ⛔ DET ÄR SAMMA KONTROLL MED TVÅ UTGÅNGAR, med flit. `missing` finns för
     * ett formulär som kan skriva ut meningarna; `buildEntry` anropas oftast av
     * ett skript som inte har någon att visa dem för.
     */
    expect(modell.missing({ slag: "import", rubrik: "Kört" })).toEqual([]);
    expect(modell.missing({ rubrik: "Kört" })).toEqual(["Slaget saknas."]);
    expect(modell.missing({ slag: "import", rubrik: "a".repeat(121) })[0]).toMatch(/121 tecken/);
  });

  it("ger slagets ord, och tom sträng för ett okänt", () => {
    expect(modell.kindLabel("bank")).toBe("Banksynk");
    expect(modell.kindLabel("nagot-nytt")).toBe("");
  });
});

describe("unreadCount", () => {
  const rader = [
    { nar: "2026-09-24T12:00:00.000Z", slag: "import", rubrik: "C", resultat: "ok" },
    { nar: "2026-09-24T11:00:00.000Z", slag: "import", rubrik: "B", resultat: "ok" },
    { nar: "2026-09-24T10:00:00.000Z", slag: "import", rubrik: "A", resultat: "ok" },
  ];

  it("räknar allt som nytt när läsaren aldrig sett något", () => {
    expect(unreadCount(rader, null)).toBe(3);
  });

  it("räknar det som är nyare än tidpunkten", () => {
    expect(unreadCount(rader, "2026-09-24T11:00:00.000Z")).toBe(1);
    expect(unreadCount(rader, "2026-09-24T12:00:00.000Z")).toBe(0);
  });

  it("jämför på tid och inte på antal", () => {
    /*
     * ⛔ Ett antal glider så fort en gammal rad städas bort: listan blir kortare
     * och plötsligt är allt läst. Provet tar bort den äldsta och kräver att
     * svaret är oförändrat.
     */
    expect(unreadCount(rader.slice(0, 2), "2026-09-24T11:00:00.000Z")).toBe(1);
  });
});

describe("createActivityWriter", () => {
  it("kräver modell och skrivning, och säger varför", () => {
    expect(() => createActivityWriter({ append: async () => {} })).toThrow(/model krävs/);
    expect(() => createActivityWriter({ model: modell })).toThrow(/append krävs/);
  });

  it("skriver raden genom den injicerade skrivningen", async () => {
    const skrivna = [];
    const logg = createActivityWriter({
      model: modell,
      append: async (rad) => skrivna.push(rad),
      kalla: "import-to-firestore.mjs",
      nu: () => "2026-09-24T10:00:00.000Z",
    });

    const utfall = await logg.skriv({ slag: "import", rubrik: "13 underlag skrevs", detalj: "42 poster" });

    expect(utfall.ok).toBe(true);
    expect(skrivna).toEqual([
      {
        nar: "2026-09-24T10:00:00.000Z",
        slag: "import",
        rubrik: "13 underlag skrevs",
        detalj: "42 poster",
        resultat: "ok",
        kalla: "import-to-firestore.mjs",
      },
    ]);
  });

  it("⛔ KASTAR ALDRIG när skrivningen faller, för loggen får inte sänka jobbet", async () => {
    /*
     * ⛔ DET HÄR ÄR HELA SKÄLET TILL ATT SKRIVAREN FINNS. Alternativet är att
     * varje anropsställe lindar sitt anrop i try, vilket fungerar tills någon
     * glömmer en gång. Då faller en lyckad import på att anteckningen om den
     * inte gick att spara, och en importerad siffra rullas tillbaka för att
     * loggen krånglade.
     */
    const logg = createActivityWriter({
      model: modell,
      append: async () => {
        throw new Error("Firestore: permission denied");
      },
    });

    const utfall = await logg.skriv({ slag: "import", rubrik: "Kört" });

    expect(utfall.ok).toBe(false);
    expect(utfall.orsak).toBe("skrivning");
    expect(utfall.fel).toMatch(/permission denied/);
  });

  it("kastar inte heller på ett trasigt utkast, men skiljer det från ett driftfel", async () => {
    // ⛔ Ett trasigt utkast är ett PROGRAMFEL och åtgärdas i koden; en misslyckad
    // skrivning är DRIFT och åtgärdas någon annanstans. Samma svar för båda hade
    // gjort dem omöjliga att skilja i en utskrift.
    const logg = createActivityWriter({ model: modell, append: async () => {} });
    const utfall = await logg.skriv({ slag: "finns-inte", rubrik: "Kört" });

    expect(utfall.ok).toBe(false);
    expect(utfall.orsak).toBe("utkast");
    expect(utfall.fel).toMatch(/finns inte i konfigurationen/);
  });

  it("skriver inte raden när utkastet är trasigt", async () => {
    const append = vi.fn();
    const logg = createActivityWriter({ model: modell, append });
    await logg.skriv({ slag: "import" });
    expect(append).not.toHaveBeenCalled();
  });

  it("gör ett fångat undantag till en felrad utan att man minns en flagga", async () => {
    /*
     * ⛔ Glöms `resultat: "fel"` hamnar ett misslyckande i listan som ett lyckat
     * jobb, och det är den sortens fel som gör hela loggen värdelös.
     */
    const skrivna = [];
    const logg = createActivityWriter({ model: modell, append: async (r) => skrivna.push(r) });

    await logg.misslyckades({ slag: "bank", rubrik: "Synk mot banken" }, new Error("401 Unauthorized"));

    expect(skrivna[0].resultat).toBe("fel");
    expect(skrivna[0].fel).toBe("401 Unauthorized");
  });
});

describe("OpsActivityList", () => {
  const rader = [
    { nar: "2026-09-24T10:00:00.000Z", slag: "bank", rubrik: "Hämtade transaktioner", detalj: "42 poster", resultat: "ok", kalla: "sync.py" },
    { nar: "2026-09-23T10:00:00.000Z", slag: "import", rubrik: "Skrev underlagen", resultat: "fel", fel: "permission denied" },
  ];

  it("visar vad som hände, när, och vilket jobb som gjorde det", () => {
    render(<OpsActivityList entries={rader} kindLabel={modell.kindLabel} now={new Date("2026-09-24T12:00:00.000Z")} />);

    expect(screen.getByText("Hämtade transaktioner")).toBeInTheDocument();
    expect(screen.getByText("42 poster")).toBeInTheDocument();
    expect(screen.getByText("sync.py")).toBeInTheDocument();
    expect(screen.getByText("Banksynk")).toBeInTheDocument();
  });

  it("säger med ORD att något gick fel, inte bara med en färg", () => {
    // ⛔ En röd ton går inte att läsa upp och är osynlig för var tjugonde man.
    render(<OpsActivityList entries={rader} kindLabel={modell.kindLabel} />);
    expect(screen.getByText("Gick fel")).toBeInTheDocument();
    expect(screen.getByText("permission denied")).toBeInTheDocument();
  });

  it("bär både relativ och exakt tid, eftersom den ena inte går att jämföra", () => {
    render(<OpsActivityList entries={rader} now={new Date("2026-09-24T12:00:00.000Z")} />);
    const tid = screen.getAllByRole("time")[0];
    expect(tid).toHaveAttribute("datetime", "2026-09-24T10:00:00.000Z");
  });

  it("säger ifrån när loggen är tom i stället för att rita ingenting", () => {
    render(<OpsActivityList entries={[]} />);
    expect(screen.getByText("Inget har hänt än")).toBeInTheDocument();
  });

  it("delar listan i dagsavsnitt med riktiga rubriker", () => {
    /*
     * ⛔ Ett nattligt jobb skriver en rad om dagen. Efter en månad är en platt
     * lista trettio likadana rader, och frågan "kördes det i dag" kräver då att
     * man läser tidsstämplar. Rubriken är en riktig rubrik så den som hoppar
     * mellan dem i en skärmläsare kan gå till "Idag" direkt.
     */
    render(<OpsActivityList entries={rader} kindLabel={modell.kindLabel} now={new Date("2026-09-24T12:00:00.000Z")} />);

    const rubriker = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(rubriker).toEqual(["Idag", "I går"]);
  });

  it("märker med ORDET Ny bara det som är nyare än det lästa", () => {
    render(
      <OpsActivityList
        entries={rader}
        kindLabel={modell.kindLabel}
        unreadSince="2026-09-23T12:00:00.000Z"
        now={new Date("2026-09-24T12:00:00.000Z")}
      />,
    );

    expect(screen.getAllByText("Ny")).toHaveLength(1);
    // ⛔ Och det är den NYA raden som bär märket, inte bara någon rad.
    const ny = screen.getByText("Hämtade transaktioner").closest("li");
    expect(within(/** @type {HTMLElement} */ (ny)).getByText("Ny")).toBeInTheDocument();
  });

  it("märker ingenting när ingen läsning skickats in", () => {
    // ⛔ Listan på en egen sida har ingen som öppnade den. Ett märke där hade
    // påstått något om en läsning som aldrig skett.
    render(<OpsActivityList entries={rader} now={new Date("2026-09-24T12:00:00.000Z")} />);
    expect(screen.queryByText("Ny")).not.toBeInTheDocument();
  });
});

describe("OpsActivityButton", () => {
  const rader = [
    { nar: "2026-09-24T12:00:00.000Z", slag: "import", rubrik: "Nyast", resultat: "ok" },
    { nar: "2026-09-24T10:00:00.000Z", slag: "import", rubrik: "Äldre", resultat: "ok" },
  ];

  it("räknar det olästa i knappens NAMN, inte bara som en prick", () => {
    // ⛔ En prick är dekor och läses inte upp. Utan namnet vet den som lyssnar
    // inte att det finns något nytt alls.
    render(<OpsActivityButton entries={rader} />);
    expect(screen.getByRole("button", { name: "Aktivitet, 2 nya" })).toBeInTheDocument();
  });

  it("öppnar listan och markerar den som sedd", () => {
    /*
     * ⛔ SETT NÄR DEN ÖPPNAS, inte när den stängs. Den som öppnat och läst en rad
     * har sett den, även om fliken sedan dör. Vid stängning hade ett tappat
     * fönster gett samma märke igen nästa dag.
     */
    render(<OpsActivityButton entries={rader} storageKey="prov:aktivitet" />);
    fireEvent.click(screen.getByRole("button", { name: /Aktivitet/ }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Nyast")).toBeInTheDocument();
    expect(globalThis.localStorage.getItem("prov:aktivitet")).toBe("2026-09-24T12:00:00.000Z");

    /*
     * ⛔ MÄRKET KONTROLLERAS EFTER ATT RUTAN STÄNGTS, och det är inte städnit.
     * `OpsModal` döljer bakgrunden för skärmläsare medan den är öppen, så knappen
     * finns inte som roll så länge listan syns. Ett prov som frågade efter den
     * mitt i hade varit rött för att modalen fungerar.
     */
    fireEvent.click(within(dialog).getByRole("button", { name: "Stäng" }));
    expect(screen.getByRole("button", { name: "Aktivitet" })).toBeInTheDocument();
  });

  it("överlever en webbläsare som vägrar lagra", () => {
    /*
     * ⛔ `localStorage` kastar i privat läge och när webbplatsdata är blockerad.
     * Att märket inte minns är en olägenhet; att sidan vitnar för att en ikon
     * ville spara ett datum är ett fel.
     */
    const riktig = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blockerad");
      },
    });

    try {
      render(<OpsActivityButton entries={rader} storageKey="prov:blockerad" />);
      fireEvent.click(screen.getByRole("button", { name: /Aktivitet/ }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    } finally {
      if (riktig) Object.defineProperty(globalThis, "localStorage", riktig);
    }
  });

  it("⛔ MÄRKNINGEN ÖVERLEVER ATT LÄSNINGEN FLYTTAS FRAM VID ÖPPNING", () => {
    /*
     * Det här är hela skälet till att den frusna tidpunkten finns.
     *
     * Märket på knappen räknar OLÄSTA, listan visar ALLA rader, och "senast
     * sedd" flyttas fram i samma ögonblick som panelen öppnas. Utan frysningen
     * är därför allt redan läst vid första renderingen: knappen sa ett, och
     * listan märker noll. Siffran ser då ut att ljuga, och en siffra man inte
     * tror på är värre än ingen siffra alls.
     */
    globalThis.localStorage.setItem("prov:fryst", "2026-09-24T10:00:00.000Z");
    render(<OpsActivityButton entries={rader} storageKey="prov:fryst" now={new Date("2026-09-24T14:00:00.000Z")} />);

    expect(screen.getByRole("button", { name: "Aktivitet, 1 nya" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Aktivitet/ }));

    const dialog = screen.getByRole("dialog");
    // Lika många märken som knappen räknade, och på RÄTT rad.
    expect(within(dialog).getAllByText("Ny")).toHaveLength(1);
    expect(within(/** @type {HTMLElement} */ (within(dialog).getByText("Nyast").closest("li"))).getByText("Ny")).toBeInTheDocument();

    // Och läsningen är ändå framflyttad, så märket är borta nästa gång.
    expect(globalThis.localStorage.getItem("prov:fryst")).toBe("2026-09-24T12:00:00.000Z");
  });

  it("visar inget märke när allt är sett", () => {
    globalThis.localStorage.setItem("prov:sett", "2026-09-24T12:00:00.000Z");
    render(<OpsActivityButton entries={rader} storageKey="prov:sett" />);
    expect(screen.getByRole("button", { name: "Aktivitet" })).toBeInTheDocument();
  });

  it("kortar ett stort tal i stället för att skjuta ut ikonen", () => {
    const manga = Array.from({ length: 120 }, (_, i) => ({
      nar: `2026-09-24T10:00:${String(i).padStart(2, "0")}.000Z`,
      slag: "import",
      rubrik: `Rad ${i}`,
      resultat: "ok",
    }));
    render(<OpsActivityButton entries={manga} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
    // ⛔ Och namnet bär det RIKTIGA talet. "99+" är en bredd, inte ett faktum.
    expect(screen.getByRole("button", { name: "Aktivitet, 120 nya" })).toBeInTheDocument();
  });
});

describe("groupByDay", () => {
  /** Byggs ur LOKAL tid, så provet säger samma sak i varje tidszon. */
  const vid = (/** @type {number[]} */ ...delar) => new Date(...delar).toISOString();
  const rad = (/** @type {string} */ nar, /** @type {string} */ rubrik) => ({ nar, slag: "import", rubrik, resultat: "ok" });

  const NU = new Date(2026, 8, 24, 12, 0);

  it("delar raderna i Idag, I går, Senaste veckan och Äldre", () => {
    const avsnitt = groupByDay(
      [
        rad(vid(2026, 8, 24, 9, 0), "idag"),
        rad(vid(2026, 8, 23, 9, 0), "igår"),
        rad(vid(2026, 8, 20, 9, 0), "i veckan"),
        rad(vid(2026, 8, 1, 9, 0), "gammalt"),
      ],
      { nu: NU },
    );

    expect(avsnitt.map((a) => a.value)).toEqual(["idag", "igar", "veckan", "aldre"]);
    expect(avsnitt.map((a) => a.rader.map((r) => r.rubrik))).toEqual([["idag"], ["igår"], ["i veckan"], ["gammalt"]]);
  });

  it("⛔ räknar KALENDERDAGAR och inte dygn om 24 timmar", () => {
    /*
     * Något som kördes 23:50 i går ligger under "I går" klockan 00:10, inte
     * under "Idag". Tjugo minuter har gått, men det är inte vad läsaren kallar
     * det, och radens egen text säger redan "i går". Räknades det i timmar hade
     * rubriken och raden sagt emot varandra, och då tror man på ingendera.
     */
    const avsnitt = groupByDay([rad(vid(2026, 8, 23, 23, 50), "sent i går")], { nu: new Date(2026, 8, 24, 0, 10) });
    expect(avsnitt.map((a) => a.value)).toEqual(["igar"]);
  });

  it("utelämnar tomma avsnitt i stället för att påstå att något saknas där", () => {
    const avsnitt = groupByDay([rad(vid(2026, 8, 24, 9, 0), "bara idag")], { nu: NU });
    expect(avsnitt).toHaveLength(1);
    expect(avsnitt[0].label).toBe("Idag");
  });

  it("⛔ KASTAR ALDRIG en rad med trasig tid, den faller till Äldre", () => {
    /*
     * Att sortera bort det man inte förstår är hur en logg tyst blir
     * ofullständig: den som letar efter raden ser en lista utan den och drar
     * slutsatsen att jobbet aldrig kördes.
     */
    const avsnitt = groupByDay([{ nar: "inte en tid", slag: "import", rubrik: "trasig", resultat: "ok" }], { nu: NU });
    expect(avsnitt.map((a) => a.value)).toEqual(["aldre"]);
    expect(avsnitt[0].rader[0].rubrik).toBe("trasig");
  });

  it("lägger en rad från framtiden under Idag, där den syns", () => {
    // ⛔ Den betyder att en klocka går fel, och det är värt att se. Under
    // "Äldre" hade den hamnat längst ned i en lista ingen rullar till.
    const avsnitt = groupByDay([rad(vid(2026, 8, 26, 9, 0), "framtiden")], { nu: NU });
    expect(avsnitt.map((a) => a.value)).toEqual(["idag"]);
  });

  it("svarar med en tom lista när det inte finns något att dela", () => {
    expect(groupByDay([], { nu: NU })).toEqual([]);
    expect(groupByDay(null, { nu: NU })).toEqual([]);
  });
});

describe("isUnread", () => {
  it("⛔ ger samma svar som unreadCount räknar", () => {
    /*
     * Knappens siffra och radens märke måste stämma överens: säger knappen tre
     * och tre rader inte är märkta blir siffran något man slutar tro på. Därför
     * EN jämförelse, inte två som glider isär vid första ändringen.
     */
    const rader = [
      { nar: "2026-09-24T12:00:00.000Z", slag: "import", rubrik: "a", resultat: "ok" },
      { nar: "2026-09-24T10:00:00.000Z", slag: "import", rubrik: "b", resultat: "ok" },
      { nar: "2026-09-23T10:00:00.000Z", slag: "import", rubrik: "c", resultat: "ok" },
    ];
    for (const sedd of [null, "2026-09-24T11:00:00.000Z", "2026-09-24T12:00:00.000Z"]) {
      expect(rader.filter((r) => isUnread(r, sedd))).toHaveLength(unreadCount(rader, sedd));
    }
  });

  it("räknar allt som nytt när läsaren aldrig sett något", () => {
    expect(isUnread({ nar: "2020-01-01T00:00:00.000Z" }, null)).toBe(true);
  });
});
