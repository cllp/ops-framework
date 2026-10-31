// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { HTML_LANKMEDDELANDE, HTML_LANKSKRIPT, HTML_SANDBOX, byggSrcdoc, externLankAdress } from "../lib/htmldokument.js";
import { HtmlRuta } from "../components/OpsHtmlDokument.jsx";

/**
 * Länkarna i ett HTML-dokument (0.165.0). Ett `srcdoc` ärver appens basadress, så `href="#avsnitt"` laddade appens sida i rutan i stället för att skrolla.
 * Skriptet körs här mot ett riktigt dokument (jsdom) med en egen `window` för lyssnaren och en egen `parent`.
 */
describe("länkar i HTML-dokument", () => {
  /** @type {Array<() => void>} */
  const stad = [];
  afterEach(() => {
    stad.splice(0).forEach((f) => f());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function kor() {
    const parent = { postMessage: vi.fn() };
    /** @type {any} */
    let lyssnare = null;
    const fonster = { addEventListener: (/** @type {string} */ typ, /** @type {any} */ f) => { if (typ === "click") lyssnare = f; }, scrollTo: vi.fn() };
    new Function("window", "parent", HTML_LANKSKRIPT)(fonster, parent);
    const ta = (/** @type {any} */ e) => document.removeEventListener("click", lyssnare);
    document.addEventListener("click", lyssnare);
    stad.push(ta);
    return { parent, fonster };
  }

  it("srcdoc bär länkskriptet", () => {
    expect(byggSrcdoc("<p>x</p>")).toContain(HTML_LANKSKRIPT);
  });

  it("⛔ #avsnitt skrollar i dokumentet och lämnar det inte", () => {
    document.body.innerHTML = '<nav><a id="l" href="#del-2"><span id="inne">Del 2</span></a><a id="topp" href="#">Upp</a><a id="namn" href="#gammal">Gammal</a></nav><h2 id="del-2">Del 2</h2><a name="gammal"></a>';
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { parent, fonster } = kor();
    const klick = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.getElementById("inne")?.dispatchEvent(klick);
    expect(klick.defaultPrevented).toBe(true);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(document.getElementById("del-2"));
    document.getElementById("namn")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(scroll.mock.contexts[1]).toBe(document.getElementsByName("gammal")[0]);
    document.getElementById("topp")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(fonster.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it("⛔ en extern länk skickas till fönstret, och relativa och javascript-adresser stoppas", () => {
    document.body.innerHTML = '<a id="ut" href="https://exempel.se/a">Ut</a><a id="rel" href="annan.html">Rel</a><a id="js" href="javascript:alert(1)">Js</a>';
    const { parent } = kor();
    for (const id of ["ut", "rel", "js"]) {
      const e = new MouseEvent("click", { bubbles: true, cancelable: true });
      document.getElementById(id)?.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
    }
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenCalledWith({ typ: HTML_LANKMEDDELANDE, href: "https://exempel.se/a" }, "*");
  });

  it("externLankAdress släpper bara http, https, mailto och tel", () => {
    expect(externLankAdress({ typ: HTML_LANKMEDDELANDE, href: "https://exempel.se/" })).toBe("https://exempel.se/");
    expect(externLankAdress({ typ: HTML_LANKMEDDELANDE, href: "mailto:a@b.se" })).toBe("mailto:a@b.se");
    for (const href of ["javascript:alert(1)", "data:text/html,x", "blob:https://x/y", "/bibliotek", "", 5]) expect(externLankAdress({ typ: HTML_LANKMEDDELANDE, href })).toBe("");
    expect(externLankAdress({ typ: "annat", href: "https://exempel.se/" })).toBe("");
  });

  it("⛔ rutan öppnar en extern länk i en ny flik bara för ett meddelande från sitt eget fönster, och sandlådan är oförändrad", () => {
    const oppna = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<HtmlRuta mark="data-x" title="t" srcDoc="<p>x</p>" className="" />);
    const ram = /** @type {HTMLIFrameElement} */ (document.querySelector("iframe"));
    expect(ram.getAttribute("sandbox")).toBe(HTML_SANDBOX);
    window.dispatchEvent(new MessageEvent("message", { source: window, data: { typ: HTML_LANKMEDDELANDE, href: "https://exempel.se/" } }));
    expect(oppna).not.toHaveBeenCalled();
    window.dispatchEvent(new MessageEvent("message", { source: ram.contentWindow, data: { typ: HTML_LANKMEDDELANDE, href: "javascript:alert(1)" } }));
    expect(oppna).not.toHaveBeenCalled();
    window.dispatchEvent(new MessageEvent("message", { source: ram.contentWindow, data: { typ: HTML_LANKMEDDELANDE, href: "https://exempel.se/" } }));
    expect(oppna).toHaveBeenCalledWith("https://exempel.se/", "_blank", "noopener,noreferrer");
  });
});
