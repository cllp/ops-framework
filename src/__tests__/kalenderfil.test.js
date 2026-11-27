import { describe, expect, it } from "vitest";
import { kalenderRader, kalenderText, kalenderTid, tolkaIcs, tolkaVcf, KALENDERFIL_MIME, KONTAKTFIL_MIME } from "../lib/kalenderfil.js";
import { FILMIME, filInmatningsfel, kalenderfilSort, mimeForFil, mimeUrFilnamn, normaliseraMime } from "../lib/bibliotek.js";
import { formateraJson } from "../components/TextForhandsvisning.jsx";

/*
 * Kalender- och kontaktfiler tolkade (0.269.0, cllp/lifehub.app#884 punkt 5, CP 2026-11-18: "Kör alla i ett svep"). Röda före 0.269.0: modulen fanns inte,
 * och en .ics eller .vcf nekades vid uppladdningen. ⛔ SYNTETISKA FILER, INGA RIKTIGA PERSONER.
 */

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "X-WR-CALNAME:Föreningen",
  "BEGIN:VEVENT",
  "SUMMARY:Årsmöte\\, med fika",
  "DTSTART;TZID=Europe/Stockholm:20260315T180000",
  "DTEND;TZID=Europe/Stockholm:20260315T200000",
  "LOCATION:Lokalen\; övervåningen",
  "DESCRIPTION:Rad ett\\nRad två som är så lång att den vecklas",
  "  ut på nästa rad",
  "BEGIN:VALARM",
  "DESCRIPTION:Larmets egen text",
  "END:VALARM",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Möte i New York",
  "DTSTART;TZID=America/New_York:20260110T090000",
  "RRULE:FREQ=WEEKLY",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Midsommar",
  "DTSTART;VALUE=DATE:20260619",
  "STATUS:CANCELLED",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:I UTC",
  "DTSTART:20260701T100000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("kalenderfilen", () => {
  it("raderna vecklas ut, och \\, \; \\n och \\\\ blir tecknen", () => {
    expect(kalenderRader("A:b\r\n c\r\nX;P=\"x:y\":v")).toEqual([
      { namn: "A", param: {}, varde: "bc" },
      { namn: "X", param: { P: "x:y" }, varde: "v" },
    ]);
    expect(kalenderText("a\\,b\;c\\nd\\\\e")).toBe("a,b;c\nd\\e");
  });

  it("⛔ tider: heldag, svensk tid som den står, en annan zon bär zonen, och UTC räknas om till svensk tid", () => {
    expect(kalenderTid("20260619")).toEqual({ datum: "2026-06-19", tid: null, zon: null });
    expect(kalenderTid("20260315T180000", { TZID: "Europe/Stockholm" })).toEqual({ datum: "2026-03-15", tid: "18:00", zon: null });
    expect(kalenderTid("20260110T090000", { TZID: "America/New_York" })).toEqual({ datum: "2026-01-10", tid: "09:00", zon: "America/New_York" });
    expect(kalenderTid("20260701T100000Z")).toEqual({ datum: "2026-07-01", tid: "12:00", zon: null });
    expect(kalenderTid("20260110T233000Z")).toEqual({ datum: "2026-01-11", tid: "00:30", zon: null });
    expect(kalenderTid("igår")).toBeNull();
  });

  it("⛔ händelserna, de tidigaste först, utan larmets text, med återkommande och inställd", () => {
    const ut = tolkaIcs(ICS);
    if (!ut.ok) throw new Error(ut.skal);
    expect(ut.namn).toBe("Föreningen");
    expect(ut.handelser.map((h) => [h.rubrik, h.start?.datum, h.start?.tid, h.aterkommer, h.installd])).toEqual([
      ["Möte i New York", "2026-01-10", "09:00", true, false],
      ["Årsmöte, med fika", "2026-03-15", "18:00", false, false],
      ["Midsommar", "2026-06-19", null, false, true],
      ["I UTC", "2026-07-01", "12:00", false, false],
    ]);
    const arsmote = ut.handelser[1];
    expect([arsmote.plats, arsmote.beskrivning, arsmote.slut?.tid]).toEqual(["Lokalen; övervåningen", "Rad ett\nRad två som är så lång att den vecklas ut på nästa rad", "20:00"]);
  });

  it("en fil som inte är en kalender säger det", () => {
    expect(tolkaIcs("Hej")).toEqual({ ok: false, skal: "Filen är inte en kalenderfil: den saknar BEGIN:VCALENDAR." });
  });
});

describe("kontaktfilen", () => {
  const VCF = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Anna Andersson",
    "N:Andersson;Anna;;;",
    "ORG:Provbolaget AB;Ekonomi",
    "TITLE:Ekonom",
    "item1.TEL;TYPE=CELL:+46 70 000 00 00",
    "TEL;TYPE=WORK:tel:+46 8 000 00 00",
    "EMAIL;TYPE=INTERNET:anna@example.com",
    "PHOTO;ENCODING=b;TYPE=JPEG:QUFBQUFB",
    "NOTE:Ring efter lunch\\, gärna",
    "END:VCARD",
    "BEGIN:VCARD",
    "VERSION:2.1",
    "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=C3=96berg;=C3=85sa;;;",
    "TEL:070-111",
    "END:VCARD",
  ].join("\r\n");

  it("⛔ namnen, organisationen, alla nummer och adresser, utan foto, och quoted-printable som UTF-8", () => {
    const ut = tolkaVcf(VCF);
    if (!ut.ok) throw new Error(ut.skal);
    expect(ut.kontakter).toEqual([
      { namn: "Anna Andersson", organisation: "Provbolaget AB, Ekonomi", titel: "Ekonom", telefon: ["+46 70 000 00 00", "+46 8 000 00 00"], epost: ["anna@example.com"], anteckning: "Ring efter lunch, gärna" },
      { namn: "Åsa Öberg", organisation: "", titel: "", telefon: ["070-111"], epost: [], anteckning: "" },
    ]);
  });

  it("en fil som inte är kontakter säger det", () => {
    expect(tolkaVcf("BEGIN:VCALENDAR")).toEqual({ ok: false, skal: "Filen är inte en kontaktfil: den saknar BEGIN:VCARD." });
  });
});

describe("Biblioteket tar emot kalender och kontakter", () => {
  it("⛔ ändelserna ger typerna, de äldre typerna blir de nya, och typerna tas emot", () => {
    expect([mimeUrFilnamn("inbjudan.ics"), mimeUrFilnamn("a.ICAL"), mimeUrFilnamn("anna.vcf"), mimeUrFilnamn("a.vcard")]).toEqual([KALENDERFIL_MIME, KALENDERFIL_MIME, KONTAKTFIL_MIME, KONTAKTFIL_MIME]);
    expect([normaliseraMime("text/x-vcard"), normaliseraMime("text/directory"), normaliseraMime("text/x-vcalendar")]).toEqual([KONTAKTFIL_MIME, KONTAKTFIL_MIME, KALENDERFIL_MIME]);
    expect(mimeForFil("inbjudan.ics", "application/octet-stream")).toBe(KALENDERFIL_MIME);
    expect(FILMIME).toEqual(expect.arrayContaining([KALENDERFIL_MIME, KONTAKTFIL_MIME]));
    expect(filInmatningsfel({ namn: "anna.vcf", mime: KONTAKTFIL_MIME, byte: 10 })).toBeNull();
  });
  it("kalenderfilSort: typen, eller ändelsen", () => {
    expect(kalenderfilSort({ fil: { namn: "x", mime: KALENDERFIL_MIME } })).toBe("ics");
    expect(kalenderfilSort({ fil: { namn: "anna.vcf", mime: "text/plain" } })).toBe("vcf");
    expect(kalenderfilSort({ fil: { namn: "brev.txt", mime: "text/plain" } })).toBeNull();
  });
});

describe("JSON formaterad (#884 punkt 6)", () => {
  it("giltig JSON får indrag, annan text står kvar", () => {
    expect(formateraJson('{"a":1,"b":[true,null]}')).toBe('{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}');
    expect(formateraJson("{inte json")).toBe("{inte json");
  });
});
