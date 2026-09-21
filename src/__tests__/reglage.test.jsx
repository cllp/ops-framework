import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { OpsSlider } from "../components/OpsSlider.jsx";
import { OpsKnob } from "../components/OpsKnob.jsx";
import { OpsLaboreraPopover } from "../components/OpsLaboreraPopover.jsx";

/**
 * ⛔ PROVEN LÄSER NAMN, VÄRDEN OCH UTFALL, ALDRIG GEOMETRI.
 *
 * jsdom kör ingen CSS och har ingen pekare, så inget prov här kan se att tummen
 * går att ta tag i med en tumme. Det som GÅR att mäta är också det som gör
 * reglaget användbart: att nolläget går att träffa exakt, att uppläsningen säger
 * vad talet betyder, och att kontrollen vägrar rita ett läge den inte kan visa.
 *
 * Träffytan (44px) och tummens färg är CSS, och de bevisas med ögat i en riktig
 * webbläsare enligt bolag-ops#141. Ett prov som låtsas mäta dem vore sämre än
 * inget prov.
 */

const grund = {
  label: "Hyra",
  min: -50,
  max: 50,
  noll: 0,
  formateraVarde: (v) => (v === 0 ? "som idag" : `${v > 0 ? "+" : ""}${v} procent`),
};

describe("OpsSlider", () => {
  it("är ett reglage med spann och läge, inte ett fält med en siffra i", () => {
    render(<OpsSlider {...grund} value={0} onChange={() => {}} />);

    const reglaget = screen.getByRole("slider", { name: "Hyra" });
    expect(reglaget).toHaveAttribute("min", "-50");
    expect(reglaget).toHaveAttribute("max", "50");
    expect(reglaget).toHaveValue("0");
  });

  it("säger vad läget betyder i ord, inte bara talet", () => {
    // ⛔ Utan `aria-valuetext` läses reglaget upp som "minus femton", och minus
    // femton vadå. Det är hela skillnaden mellan ett reglage man kan använda utan
    // att se skärmen och ett som bara råkar vara fokuserbart.
    render(<OpsSlider {...grund} value={-15} onChange={() => {}} />);
    expect(screen.getByRole("slider", { name: "Hyra" })).toHaveAttribute("aria-valuetext", "-15 procent");
  });

  it("visar samma text på skärmen som den läser upp", () => {
    // En skärmtext och en uppläsningstext som räknas fram var för sig glider isär
    // första gången någon ändrar den ena.
    render(<OpsSlider {...grund} value={20} onChange={() => {}} />);
    const reglaget = screen.getByRole("slider", { name: "Hyra" });
    expect(screen.getByText("+20 procent")).toBeInTheDocument();
    expect(reglaget.getAttribute("aria-valuetext")).toBe("+20 procent");
  });

  it("skickar ett tal och inte en sträng när man drar", () => {
    // ⛔ `e.target.value` på ett range-element är en STRÄNG. Släpps den igenom blir
    // en simulering "5" + 100 = "5100" hos anroparen, och felet ser ut som ett
    // räknefel någon annanstans i appen.
    const onChange = vi.fn();
    render(<OpsSlider {...grund} value={0} onChange={onChange} />);

    fireEvent.change(screen.getByRole("slider", { name: "Hyra" }), { target: { value: "25" } });
    expect(onChange).toHaveBeenCalledWith(25);
    expect(typeof onChange.mock.calls[0][0]).toBe("number");
  });

  it("återställer till exakt nolläget, inte till något i närheten", () => {
    // ⛔ Det här är kravets kärna. Har man dragit och vill tillbaka till
    // verkligheten måste man komma PRECIS dit, annars ljuger jämförelsen mot
    // nuläget. På en touchskärm är det omöjligt att sikta sig fram.
    const onChange = vi.fn();
    render(<OpsSlider {...grund} value={-35} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Återställ" }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("gör återställningsknappen inaktiv i stället för att ta bort den", () => {
    // ⛔ En knapp som försvinner flyttar allt bredvid sig, och med ett reglage per
    // rad blir det ett hopp varje gång någon drar tillbaka till mitten. Det är
    // samma felklass som bolag-ops#143 och #152.
    const { rerender } = render(<OpsSlider {...grund} value={0} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Återställ" })).toBeDisabled();

    rerender(<OpsSlider {...grund} value={10} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Återställ" })).toBeEnabled();
  });

  it("kastar hellre än att rita ett reglage vars nolläge ligger utanför skenan", () => {
    // ⛔ Tyst felform: inget kraschar, återställningsknappen sätter bara ett värde
    // reglaget inte kan visa, och då säger tumme och siffra olika saker.
    expect(() => render(<OpsSlider {...grund} noll={80} value={0} onChange={() => {}} />)).toThrow(/utanför/);
  });

  it("kastar hellre än att läsa upp ett naket tal", () => {
    expect(() =>
      render(<OpsSlider {...grund} formateraVarde={undefined} value={0} onChange={() => {}} />),
    ).toThrow(/formateraVarde/);
  });

  it("låter nolläget ligga var som helst i spannet, inte bara i mitten", () => {
    // Mitten är det vanliga fallet (nuläget som utgångspunkt), men ett reglage som
    // bara klarar symmetriska spann är ett reglage som inte går att använda till
    // något som bara kan minska.
    const onChange = vi.fn();
    render(<OpsSlider label="Avgift" min={0} max={100} noll={100} formateraVarde={(v) => `${v} kr`} value={40} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Återställ" }));
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it("knyter etiketten till kontrollen, så att ett tryck på texten hamnar rätt", () => {
    render(<OpsSlider {...grund} value={0} onChange={() => {}} />);
    // getByLabelText skulle hitta reglaget även via aria-label. Här mäts att det
    // är den SYNLIGA etiketten som är namnet, alltså att texten går att trycka på.
    const etikett = screen.getByText("Hyra");
    expect(etikett.tagName).toBe("LABEL");
    expect(etikett.getAttribute("for")).toBe(screen.getByRole("slider", { name: "Hyra" }).id);
  });

  it("ger varje reglage ett eget id, så två i samma lista inte delar etikett", () => {
    // ⛔ Ett hårdkodat id hade gjort att ett tryck på den andra radens etikett
    // flyttade fokus till den första. Det är exakt vad #141 ber om: ett reglage
    // PER POST.
    render(
      <>
        <OpsSlider {...grund} label="Hyra" value={0} onChange={() => {}} />
        <OpsSlider {...grund} label="Ström" value={0} onChange={() => {}} />
      </>,
    );
    const a = screen.getByRole("slider", { name: "Hyra" });
    const b = screen.getByRole("slider", { name: "Ström" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("OpsSlider med dold etikett", () => {
  it("döljer ordet men behåller kopplingen mellan etikett och fält", () => {
    /*
     * ⛔ FÖR ATT REGLAGET SKA KUNNA SITTA I EN RAD SOM REDAN SÄGER SITT NAMN.
     * Utan den står "Mat" två gånger på samma rad, och den andra gången lär
     * ingen läsa.
     *
     * ⛔ ETT `aria-label` HADE INTE DUGT som ersättning. Etiketten står kvar som
     * `<label htmlFor>`, bara omålad, så den som ser skärmen med förstoring har
     * kvar kopplingen mellan ordet och fältet. Provet mäter därför BÅDE att
     * namnet finns kvar och att ordet inte målas.
     */
    render(
      <OpsSlider label="Mat" value={0} onChange={() => {}} min={-50} max={100} noll={0} formateraVarde={(v) => `${v} %`} doldEtikett />,
    );

    // Namnet finns kvar för den som lyssnar.
    expect(screen.getByRole("slider", { name: "Mat" })).toBeInTheDocument();
    // Men ordet målas inte.
    expect(String(screen.getByText("Mat").className).split(/\s+/)).toContain("sr-only");
    // Och läget i ord står kvar, det är det man läser medan man drar.
    expect(screen.getByText("0 %")).toBeInTheDocument();
  });

  it("målar etiketten som vanligt utan flaggan", () => {
    // ⛔ Golvet under provet ovan: utan flaggan ska ingenting ha ändrats.
    render(
      <OpsSlider label="Mat" value={0} onChange={() => {}} min={-50} max={100} noll={0} formateraVarde={(v) => `${v} %`} />,
    );
    expect(String(screen.getByText("Mat").className).split(/\s+/)).not.toContain("sr-only");
  });
});


describe("OpsKnob", () => {
  const grund = {
    label: "Hyra",
    min: -50,
    max: 50,
    noll: 0,
    formateraVarde: (v) => (v === 0 ? "0 %" : `${v > 0 ? "+" : ""}${v} %`),
  };

  it("är ett reglage med spann och läge", () => {
    render(<OpsKnob {...grund} value={0} onChange={() => {}} />);
    const ratt = screen.getByRole("slider", { name: "Hyra" });
    expect(ratt).toHaveAttribute("min", "-50");
    expect(ratt).toHaveAttribute("max", "50");
    expect(ratt).toHaveValue("0");
  });

  it("säger vad läget betyder i ord, inte bara talet", () => {
    render(<OpsKnob {...grund} value={-15} onChange={() => {}} />);
    expect(screen.getByRole("slider", { name: "Hyra" })).toHaveAttribute("aria-valuetext", "-15 %");
  });

  it("visar samma text under ratten som den läser upp", () => {
    render(<OpsKnob {...grund} value={20} onChange={() => {}} />);
    const ratt = screen.getByRole("slider", { name: "Hyra" });
    expect(screen.getByText("+20 %")).toBeInTheDocument();
    expect(ratt.getAttribute("aria-valuetext")).toBe("+20 %");
  });

  it("skickar ett tal och inte en sträng när man drar", () => {
    const onChange = vi.fn();
    render(<OpsKnob {...grund} value={0} onChange={onChange} />);
    fireEvent.change(screen.getByRole("slider", { name: "Hyra" }), { target: { value: "25" } });
    expect(onChange).toHaveBeenCalledWith(25);
    expect(typeof onChange.mock.calls[0][0]).toBe("number");
  });

  it("återställer till exakt nolläget vid dubbelklick", () => {
    const onChange = vi.fn();
    render(<OpsKnob {...grund} value={-35} onChange={onChange} />);
    fireEvent.doubleClick(screen.getByRole("slider", { name: "Hyra" }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("kastar hellre än att rita en ratt vars nolläge ligger utanför spannet", () => {
    expect(() => render(<OpsKnob {...grund} noll={80} value={0} onChange={() => {}} />)).toThrow(/utanför/);
  });

  it("kastar hellre än att läsa upp ett naket tal", () => {
    expect(() =>
      render(<OpsKnob {...grund} formateraVarde={undefined} value={0} onChange={() => {}} />),
    ).toThrow(/formateraVarde/);
  });

  it("döljer etiketten visuellt med doldEtikett men behåller namnet", () => {
    render(
      <OpsKnob label="Mat" value={0} onChange={() => {}} min={-50} max={100} noll={0} formateraVarde={(v) => `${v} %`} doldEtikett />,
    );
    expect(screen.getByRole("slider", { name: "Mat" })).toBeInTheDocument();
    expect(String(screen.getByText("Mat").className).split(/\s+/)).toContain("sr-only");
    expect(screen.getByText("0 %")).toBeInTheDocument();
  });

  it("berättar i title att dubbelklick återställer", () => {
    const { container } = render(<OpsKnob {...grund} value={10} onChange={() => {}} />);
    expect(container.querySelector("[title='Dubbelklick = återställ']")).not.toBeNull();
  });
});

describe("OpsLaboreraPopover", () => {
  const grund = {
    label: "Hyra",
    min: -50,
    max: 50,
    noll: 0,
    formateraVarde: (v) => (v === 0 ? "0 %" : `${v > 0 ? "+" : ""}${v} %`),
  };

  it("visar en dial-ikon, inte ett reglage, tills man öppnar", () => {
    render(<OpsLaboreraPopover {...grund} value={0} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Justera Hyra: 0 %" })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("öppnar OpsSlider i popovern", () => {
    render(<OpsLaboreraPopover {...grund} value={0} onChange={() => {}} />);
    // ⛔ fireEvent och inte userEvent: Radix Popover i jsdom, se issue #17.
    fireEvent.click(screen.getByRole("button", { name: "Justera Hyra: 0 %" }));
    const slider = screen.getByRole("slider", { name: "Hyra" });
    expect(slider).toHaveAttribute("min", "-50");
    expect(slider).toHaveAttribute("max", "50");
    expect(slider).toHaveValue("0");
    expect(screen.getByRole("button", { name: "Återställ" })).toBeInTheDocument();
  });

  it("skickar ett tal när man drar i popovern", () => {
    const onChange = vi.fn();
    render(<OpsLaboreraPopover {...grund} value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Justera Hyra: 0 %" }));
    fireEvent.change(screen.getByRole("slider", { name: "Hyra" }), { target: { value: "25" } });
    expect(onChange).toHaveBeenCalledWith(25);
  });

  it("återställer till noll via knappen i popovern", () => {
    const onChange = vi.fn();
    render(<OpsLaboreraPopover {...grund} value={-35} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Justera Hyra: -35 %" }));
    fireEvent.click(screen.getByRole("button", { name: "Återställ" }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("visar %-bricka på triggern när justerad", () => {
    render(<OpsLaboreraPopover {...grund} value={20} onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: "Justera Hyra: +20 %" });
    expect(within(trigger).getByText("+20 %")).toBeInTheDocument();
    expect(trigger.className).toMatch(/ops-laborera-trigger--justerad/);
  });

  it("döljer %-brickan vid noll, så raden är lugn", () => {
    render(<OpsLaboreraPopover {...grund} value={0} onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: "Justera Hyra: 0 %" });
    expect(within(trigger).queryByText("0 %")).toBeNull();
    expect(trigger.className).not.toMatch(/ops-laborera-trigger--justerad/);
  });

  it("kastar hellre än att rita ett reglage vars nolläge ligger utanför spannet", () => {
    expect(() => render(<OpsLaboreraPopover {...grund} noll={80} value={0} onChange={() => {}} />)).toThrow(/utanför/);
  });

  it("markerar triggern som dialog-öppnare", () => {
    render(<OpsLaboreraPopover {...grund} value={0} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Justera Hyra: 0 %" })).toHaveAttribute("aria-haspopup", "dialog");
  });
});
