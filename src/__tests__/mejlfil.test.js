import { describe, expect, it } from "vitest";
import { avkodaRubrik, htmlSomText, tolkaEml, MEJLFIL_MIME } from "../lib/mejlfil.js";
import { BILAGAMIME, FILMIME, arMejlfil, filInmatningsfel, lagringsContentDisposition, mimeForFil, mimeUrFilnamn } from "../lib/bibliotek.js";

/*
 * Ett sparat mejl tolkat (0.270.0, cllp/lifehub.app#884 punkt 4). Röda före 0.270.0: modulen fanns inte, och en .eml nekades vid uppladdningen.
 * ⛔ SYNTETISKA MEJL, INGA RIKTIGA PERSONER.
 */
const enc = (/** @type {string} */ s) => new TextEncoder().encode(s);
const b64 = (/** @type {string} */ s) => btoa(String.fromCharCode(...enc(s)));

const MEJL = [
  "From: =?utf-8?B?" + b64("Åsa Öberg") + "?= <asa@example.com>",
  "To: Bo <bo@example.com>,",
  " Kim <kim@example.com>",
  "Cc: =?iso-8859-1?Q?J=F6rgen?= <j@example.com>",
  "Subject: =?utf-8?Q?Bokningsbekr=C3=A4ftelse?= =?utf-8?Q?_lokalen?=",
  "Date: Fri, 27 Nov 2026 14:05:00 +0100",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="yttre"',
  "",
  "--yttre",
  'Content-Type: multipart/alternative; boundary="inre"',
  "",
  "--inre",
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Hej! Lokalen =C3=A4r bokad p=C3=A5 l=C3=B6rdag.=",
  "",
  "Mvh",
  "--inre",
  "Content-Type: text/html; charset=utf-8",
  "",
  '<p>Hej! <img src="https://spar.example/pixel.gif"> Lokalen</p>',
  "--inre--",
  "--yttre",
  'Content-Type: application/pdf; name="faktura.pdf"',
  'Content-Disposition: attachment; filename="faktura.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  b64("%PDF-1.4 provfil"),
  "--yttre--",
].join("\r\n");

describe("rubrikerna", () => {
  it("⛔ kodade ord i base64 och quoted-printable, i olika teckenkodningar, och mellanrummet mellan två kodade ord tas bort", () => {
    expect(avkodaRubrik("=?utf-8?B?" + b64("Åsa") + "?= <a@x>")).toBe("Åsa <a@x>");
    expect(avkodaRubrik("=?iso-8859-1?Q?J=F6rgen?=")).toBe("Jörgen");
    expect(avkodaRubrik("=?utf-8?Q?Bokningsbekr=C3=A4ftelse?= =?utf-8?Q?_lokalen?=")).toBe("Bokningsbekräftelse lokalen");
    expect(avkodaRubrik("Vanlig text")).toBe("Vanlig text");
  });
});

describe("hela mejlet", () => {
  const ut = tolkaEml(enc(MEJL));
  if (!ut.ok) throw new Error(ut.skal);
  const { mejl } = ut;
  it("avsändaren, mottagarna utvecklade, kopian, ämnet och datumet", () => {
    expect([mejl.fran, mejl.till, mejl.kopia, mejl.amne]).toEqual(["Åsa Öberg <asa@example.com>", "Bo <bo@example.com>, Kim <kim@example.com>", "Jörgen <j@example.com>", "Bokningsbekräftelse lokalen"]);
    expect(mejl.datum).toBe("2026-11-27T13:05:00.000Z");
  });
  it("⛔ textdelen före HTML-delen, avkodad som UTF-8 ur quoted-printable", () => {
    expect(mejl.text).toBe("Hej! Lokalen är bokad på lördag.\nMvh");
    expect(mejl.franHtml).toBe(false);
  });
  it("bilagan listas med namn, typ och storlek, och blir inte text", () => {
    expect(mejl.bilagor).toEqual([{ namn: "faktura.pdf", typ: "application/pdf", byte: 16 }]);
  });
});

describe("bara HTML", () => {
  it("⛔ blir text, utan bilder, skript eller stilar", () => {
    const html = ["From: a@example.com", "Subject: Nyhetsbrev", "Content-Type: text/html; charset=utf-8", "", '<html><head><style>p{}</style></head><body><p>Första&nbsp;stycket &amp; mer</p><script>alert(1)</script><img src="https://x/y.png"><div>Andra</div></body></html>'].join("\n");
    const ut = tolkaEml(enc(html));
    if (!ut.ok) throw new Error(ut.skal);
    expect(ut.mejl.text).toBe("Första stycket & mer\nAndra");
    expect(ut.mejl.franHtml).toBe(true);
    expect(htmlSomText("<b>a</b><br>b &#228;")).toBe("a\nb ä");
  });
  it("en fil som inte är ett mejl säger det", () => {
    expect(tolkaEml(enc("Bara text."))).toEqual({ ok: false, skal: "Filen är inte ett mejl: den saknar From och Subject." });
  });
});

describe("Biblioteket tar emot .eml", () => {
  it("⛔ ändelsen ger typen, typen tas emot, och arMejlfil avgör", () => {
    expect(mimeUrFilnamn("brev.EML")).toBe(MEJLFIL_MIME);
    expect(mimeForFil("brev.eml", "")).toBe(MEJLFIL_MIME);
    expect(FILMIME).toContain(MEJLFIL_MIME);
    expect(filInmatningsfel({ namn: "brev.eml", mime: MEJLFIL_MIME, byte: 100 })).toBeNull();
    expect(arMejlfil({ fil: { namn: "brev.eml", mime: "application/octet-stream" } })).toBe(true);
    expect(arMejlfil({ fil: { namn: "brev.msg", mime: "application/vnd.ms-outlook" } })).toBe(false);
  });
  it("⛔ ett mejl sparas alltid som bilaga, så att en direktlänk laddar ned det och webbläsaren aldrig ritar dess HTML", () => {
    expect(BILAGAMIME).toContain(MEJLFIL_MIME);
    expect(lagringsContentDisposition(MEJLFIL_MIME, "brev.eml")).toBe("attachment; filename=\"brev.eml\"; filename*=UTF-8''brev.eml");
    expect(lagringsContentDisposition(MEJLFIL_MIME, "")).toMatch(/^attachment; filename="mejl\.eml"/);
  });
});
