/**
 * Avsnitt 63 i check-skalyta: chatten rullar aldrig i sidled (cllp/lifehub.app#734).
 *
 * CP 2026-11-09 22:18, från sin iPhone: "Den bussar och scrollar i sidled. Man vill inte scrolla chatten i sidled." Skärmbilden
 * finns inte hos oss, så vakten fyller chatten med det innehåll som kan göra en rad bredare än skärmen och MÄTER, i en riktig
 * webbläsare, vid 390 och 375 px:
 *
 *   - att sidan inte rullar i sidled (`document.scrollingElement`: scrollWidth mot clientWidth, och ett försök att rulla den),
 *   - att ingen rullande behållare i chatten rullar i sidled (varje element med `overflow-x` som inte är hidden eller clip och
 *     scrollWidth större än clientWidth plus 1), och särskilt inte loggen (`role="log"`), som med `overflow-y: auto` också får
 *     `overflow-x: auto` (CSS räknar om `visible` till `auto` när den andra axeln rullar),
 *   - att inget element i loggen sticker ut utanför loggens högra eller vänstra kant.
 *
 * Ett brott skriver ut VILKET element som sticker ut, med sin väg i trädet och sin bredd, så att ett rött utfall pekar på orsaken.
 *
 * ⛔ GOLV: varje fientligt slag ska ha ritats minst så många gånger som scenen sår det (`GOLV`). En tom eller halv sida, eller en
 * äldre dist som saknar omröstningar, blir röd på golvet och inte grön av att inget fanns att mäta.
 *
 * Kör ensamt: `node scripts/check-skalyta.mjs --bara-sidled`. Hela körningen kör det också.
 */

import path from "node:path";

/** @typedef {import("./skalyta0106.mjs").Verktyg} Verktyg */

export const BREDDER_SIDLED = [
  { width: 390, height: 844 },
  { width: 375, height: 812 },
];

/**
 * Vyerna och hur många av varje fientligt slag som ska ha ritats i var och en. Slaget står i texten som `[sidled:<slag>]`
 * (skalyta-entry.jsx, `ChattSidledScen`). Gruppchatten och det privata samtalet sår samma uppsättning; tråden sår roten och fyra svar.
 */
const SAMTALSGOLV = {
  url: 1, "url-eget": 1, ord: 1, "ord-eget": 1, tabell: 1, kod: 1, inlinekod: 1, omnamnande: 1, citat: 1, omrostning: 1,
  bildbilaga: 2, filbilaga: 1, reaktioner: 2, citatrad: 1, nyttSedanSist: 1, langtNamn: 2,
};
const GOLV = {
  grupp: { ...SAMTALSGOLV, tradrad: 1 },
  // I ett privat samtal ritas ingen namnrad (`visaNamn` bara i gruppen), och avdelaren mäts i gruppchatten: läsmärket når inte det privata
  // samtalet i scenen innan det öppnas. Resten av uppsättningen är densamma.
  privat: Object.fromEntries(Object.entries(SAMTALSGOLV).filter(([k]) => k !== "langtNamn" && k !== "nyttSedanSist")),
  trad: { tradrot: 1, url: 1, kod: 1, "ord-eget": 1, tabell: 1, langtNamn: 1 },
};

/**
 * Mäter i sidan: räknar de fientliga slagen och letar efter allt som rullar eller sticker ut i sidled.
 * @param {import("playwright").Page} page
 */
function matSidled(page) {
  return page.evaluate(() => {
    /** @param {Element} el @returns {string} en kort väg i trädet, med data-attributen som pekar ut delen */
    const vag = (el) => {
      const delar = [];
      for (let e = /** @type {Element | null} */ (el); e && e !== document.body && delar.length < 7; e = e.parentElement) {
        const data = [...e.attributes].filter((a) => a.name.startsWith("data-") || a.name === "role").map((a) => (a.value ? `[${a.name}=${a.value.slice(0, 24)}]` : `[${a.name}]`)).join("");
        const klass = typeof e.className === "string" && e.className ? `.${e.className.trim().split(/\s+/).slice(0, 4).join(".")}` : "";
        delar.unshift(`${e.tagName.toLowerCase()}${data}${data ? "" : klass}`);
      }
      return delar.join(" > ");
    };
    const logg = /** @type {HTMLElement | null} */ (document.querySelector('[role="log"]'));
    const doc = /** @type {HTMLElement} */ (document.scrollingElement);
    const text = (/** @type {Element} */ el) => el.textContent || "";
    const bubblor = [...document.querySelectorAll("[data-bubbla]")];
    const raknaSlag = (/** @type {string} */ slag) => bubblor.filter((b) => text(b).includes(`[sidled:${slag}]`)).length;
    const slag = {
      url: raknaSlag("url"), "url-eget": raknaSlag("url-eget"), ord: raknaSlag("ord"), "ord-eget": raknaSlag("ord-eget"), tabell: raknaSlag("tabell"),
      kod: raknaSlag("kod"), inlinekod: raknaSlag("inlinekod"), omnamnande: raknaSlag("omnamnande"), citat: raknaSlag("citat"), tradrot: raknaSlag("tradrot"),
      omrostning: [...document.querySelectorAll("[data-omrostning]")].filter((o) => text(o).includes("[sidled:omrostning]")).length,
      bildbilaga: document.querySelectorAll('[data-meddelande-bilaga="bild"] img').length,
      filbilaga: [...document.querySelectorAll('[data-meddelande-bilaga="fil"]')].filter((f) => text(f).includes("sidled-fil-")).length,
      reaktioner: document.querySelectorAll("[data-reaktioner] [data-reaktion]").length,
      citatrad: document.querySelectorAll("[data-citat]").length,
      nyttSedanSist: document.querySelectorAll("[data-nytt-sedan-sist]").length,
      tradrad: document.querySelectorAll('[data-tradmarke="finns"]').length,
      langtNamn: [...document.querySelectorAll("[data-avsandare]")].filter((n) => /Bartholomeus|Maximiliana/.test(text(n))).length,
    };
    // Rullande behållare som rullar i sidled. `overflow-x: visible` blir `auto` när `overflow-y` rullar, så den räknade stilen räcker.
    const rullar = [];
    for (const el of document.querySelectorAll("body *")) {
      const he = /** @type {HTMLElement} */ (el);
      const ox = getComputedStyle(he).overflowX;
      if (ox === "hidden" || ox === "clip" || ox === "visible") continue;
      if (he.scrollWidth > he.clientWidth + 1) rullar.push({ vem: vag(he), scrollWidth: he.scrollWidth, clientWidth: he.clientWidth, overflowX: ox, touchAction: getComputedStyle(he).touchAction, logg: he === logg });
    }
    // Det som sticker ut ur loggen: de djupaste elementen vars ruta går utanför loggens. Det yttersta visar var, det innersta varför.
    const utanfor = [];
    if (logg) {
      const lr = logg.getBoundingClientRect();
      const hoger = lr.left + logg.clientWidth;
      for (const el of logg.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (getComputedStyle(el).position === "fixed") continue;
        if (r.right > hoger + 1 || r.left < lr.left - 1) utanfor.push({ el, vem: vag(el), bredd: Math.round(r.width), hoger: Math.round(r.right), vanster: Math.round(r.left) });
      }
    }
    // De innersta: inget annat utanför-element ligger inuti dem.
    const innersta = utanfor.filter((u) => !utanfor.some((a) => a !== u && u.el.contains(a.el))).map(({ el, ...rest }) => rest);
    // Ett försök att faktiskt rulla, som ett finger hade gjort: sidan och loggen.
    window.scrollTo(200, window.scrollY);
    const sidaRullade = window.scrollX;
    window.scrollTo(0, window.scrollY);
    let loggRullade = 0;
    if (logg) {
      logg.scrollLeft = 200;
      loggRullade = logg.scrollLeft;
      logg.scrollLeft = 0;
    }
    return {
      slag,
      finnsLogg: Boolean(logg),
      loggBredd: logg ? logg.clientWidth : 0,
      loggScrollWidth: logg ? logg.scrollWidth : 0,
      loggOverflowX: logg ? getComputedStyle(logg).overflowX : "",
      loggTouchAction: logg ? getComputedStyle(logg).touchAction : "",
      sida: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth },
      sidaRullade,
      loggRullade,
      rullar,
      antalUtanfor: utanfor.length,
      innersta: innersta.slice(0, 8),
      ytterst: utanfor.slice(0, 3).map(({ el, ...rest }) => rest),
    };
  });
}

/**
 * Avsnitt 63: chatten i sidled, gruppchatten, ett privat samtal och en tråd, vid 390 och 375 px.
 * @param {Verktyg} v
 */
export async function chattISidled(v) {
  for (const vp of BREDDER_SIDLED) {
    for (const vy of /** @type {const} */ (["grupp", "privat", "trad"])) {
      const namn = `63 chatten i sidled, ${vy}, ${vp.width} px`;
      /** @type {import("playwright").BrowserContext | null} */
      let context = null;
      try {
        const o = await v.oppna("chattsidled", vp, "light", 1, vy);
        context = o.context;
        const page = o.page;
        // Bilderna, omröstningen och trådens märke kommer efter första ritningen: vänta in det sista som sås i vyn.
        await page.waitForSelector('[data-bubbla], [data-saknas]', { timeout: 4000 });
        await page.waitForFunction(
          (vy) => {
            const t = document.body.textContent || "";
            if (vy === "trad") return t.includes("[sidled:tabell]") && t.includes("[sidled:tradrot]");
            return t.includes("[sidled:omrostning]") && document.querySelectorAll('[data-meddelande-bilaga="bild"] img').length >= 2;
          },
          vy,
          { timeout: 5000 },
        ).catch(() => {});
        await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; })))));
        await page.waitForTimeout(250);
        const m = await matSidled(page);
        v.matt.push(`${namn}: sida ${m.sida.scrollWidth}/${m.sida.clientWidth} (rullade ${m.sidaRullade}), logg ${m.loggScrollWidth}/${m.loggBredd} overflow-x ${m.loggOverflowX} touch-action ${m.loggTouchAction} (rullade ${m.loggRullade}), utanför loggen ${m.antalUtanfor}, slag ${JSON.stringify(m.slag)}`);
        // Golvet: varje slag ritades.
        v.krav(m.finnsLogg, `${namn}: loggen (role="log") saknas. Golv.`);
        for (const [slag, minst] of Object.entries(GOLV[vy])) {
          const fick = /** @type {Record<string, number>} */ (m.slag)[slag] ?? 0;
          v.krav(fick >= minst, `${namn}: ${fick} av slaget "${slag}" ritades, väntat minst ${minst}. Golv: utan det fientliga innehållet mäter vakten ingenting.`);
        }
        // Sidan.
        v.krav(m.sida.scrollWidth <= m.sida.clientWidth && m.sidaRullade === 0, `${namn}: sidan rullar i sidled, scrollWidth ${m.sida.scrollWidth} mot clientWidth ${m.sida.clientWidth}, ett försök att rulla 200 px gav ${m.sidaRullade}.`);
        // Loggen.
        v.krav(m.loggScrollWidth <= m.loggBredd + 1 && m.loggRullade === 0, `${namn}: loggen rullar i sidled, scrollWidth ${m.loggScrollWidth} mot clientWidth ${m.loggBredd} (overflow-x ${m.loggOverflowX}, touch-action ${m.loggTouchAction}), ett försök att rulla 200 px gav ${m.loggRullade}. Innerst: ${m.innersta.map((u) => `${u.vem} (bredd ${u.bredd}, x ${u.vanster} till ${u.hoger})`).join(" | ") || "(inget element utanför)"}.`);
        // Alla andra rullande behållare.
        const andra = m.rullar.filter((r) => !r.logg);
        v.krav(andra.length === 0, `${namn}: ${andra.length} behållare rullar i sidled: ${andra.map((r) => `${r.vem} (${r.scrollWidth}/${r.clientWidth}, overflow-x ${r.overflowX})`).join(" | ")}.`);
        // Inget element utanför loggens kanter.
        v.krav(m.antalUtanfor === 0, `${namn}: ${m.antalUtanfor} element sticker ut ur loggen. Innerst: ${m.innersta.map((u) => `${u.vem} (bredd ${u.bredd}, x ${u.vanster} till ${u.hoger})`).join(" | ")}.`);
        if (v.bildmapp) await page.screenshot({ path: path.join(v.bildmapp, `chatt-sidled-${vy}-${vp.width}.png`) });
      } catch (e) {
        v.krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
      }
      await context?.close();
    }
  }
}
