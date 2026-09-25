import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsMarkdown } from "../components/OpsMarkdown.jsx";

describe("OpsMarkdown", () => {
  it("ritar rubriken som en rubrik och inte som text med brädgårdar", () => {
    const { container } = render(<OpsMarkdown text={"## Vad\n\nEn mening."} />);
    const title = container.querySelector("h4");
    expect(title?.textContent).toBe("Vad");
    // ⛔ Tecknen finns inte kvar någonstans. Det var hela felet CP såg.
    expect(container.textContent).not.toContain("##");
  });

  it("gör aldrig en h1 av en issue-rubrik", () => {
    /*
     * ⛔ En issue-text börjar på `#` eller `##` och vet ingenting om sidan den
     * hamnar i. Renderades `#` som `<h1>` skulle ett utfällt kort ha en rubrik
     * över sidans egen, och en skärmläsares dokumentöversikt blir obrukbar.
     */
    const { container } = render(<OpsMarkdown text={"# Ettan\n\n### Trean"} />);
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("h2")).toBeNull();
    expect(container.querySelector("h3")).toBeNull();
    expect(container.querySelector("h4")?.textContent).toBe("Ettan");
    expect(container.querySelector("h5")?.textContent).toBe("Trean");
  });

  it("öppnar länkar i en ny flik och skyddar den gamla", () => {
    // ⛔ `rel="noopener noreferrer"`: utan den får den öppnade sidan en
    // referens tillbaka till fönstret den kom ifrån.
    render(<OpsMarkdown text="se [PR 53](https://github.com/cllp/ops-framework/pull/53)" />);
    const lank = screen.getByText("PR 53");
    expect(lank.getAttribute("href")).toBe("https://github.com/cllp/ops-framework/pull/53");
    expect(lank.getAttribute("target")).toBe("_blank");
    expect(lank.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("kör aldrig något som ser ut som kod, och släpper inte in HTML", () => {
    /*
     * ⛔ INGEN HTML PASSERAR EN STRÄNG. `dangerouslySetInnerHTML` finns inte i
     * komponenten, och därför är en `<script>`-tagg i texten bara text. Provet
     * mäter utfallet i DOM:en och inte frånvaron av ett funktionsnamn i källan:
     * ett närvarogrep mäter inte beteende.
     */
    const { container } = render(<OpsMarkdown text={"<script>window.x = 1</script>\n\n[klick](javascript:alert(1))"} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelectorAll("a").length).toBe(0);
    expect(container.textContent).toContain("<script>window.x = 1</script>");
  });

  it("ritar kryssrutor med ord, inte bara med en bock", () => {
    // ⛔ En bock är osynlig för en skärmläsare, alltså läses en gjord och en
    // ogjord punkt likadant utan orden bredvid.
    render(<OpsMarkdown text={"- [x] Gjort det\n- [ ] Inte gjort"} />);
    expect(screen.getByText("Gjort:")).toBeTruthy();
    expect(screen.getByText("Ogjort:")).toBeTruthy();
  });

  it("ritar en tabell som en tabell", () => {
    const { container } = render(<OpsMarkdown text={"| Status | Färg |\n|---|---|\n| Öppet | gul |"} />);
    expect(container.querySelectorAll("th").length).toBe(2);
    expect(container.querySelectorAll("td").length).toBe(2);
  });

  it("tom text ritar ingenting alls", () => {
    // ⛔ En tom panel ser ut som ett laddningsfel. Tomhet är ett svar.
    const { container } = render(<OpsMarkdown text="" />);
    expect(container.firstChild).toBeNull();
  });
});
