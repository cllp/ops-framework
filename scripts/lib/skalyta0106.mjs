/**
 * Avsnitt 47 i check-skalyta: chattepiken 0.106.0 (#386), en del per skiva, vid 390 och 1280 px.
 *
 * ⛔ EN EGEN FIL OCH INTE ETT BLOCK TILL I check-skalyta.mjs. Skriptet är över 6800 rader, och skivorna läggs till en i taget.
 * Funktionerna får vaktens egna verktyg (`oppna`, `krav`, `matt`) som argument, så att mätningen räknas, skrivs ut och blir röd
 * på samma sätt som resten av vakten. Kör ensamt: `node scripts/check-skalyta.mjs --bara-0106`.
 *
 * ⛔ GOLV: varje del kräver att det den mäter fanns (rader, knappar, meddelanden), annars är den röd.
 */

import path from "node:path";

/** @typedef {{ oppna: (scen: string, vp: { width: number, height: number }, tema?: string, skala?: number, aktiv?: string | null, manga?: number, extra?: { kontext?: object, init?: string }) => Promise<{ page: import("playwright").Page, context: import("playwright").BrowserContext }>, krav: (ok: boolean, text: string) => void, matt: string[], bildmapp: string | null }} Verktyg */

export const BREDDER = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];

/** @param {import("playwright").Page} page */
const over = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/**
 * Kör en del i en egen sida, och gör ett avbrott till ett brott i stället för ett kast.
 * @param {Verktyg} v @param {string} namn @param {string} scen @param {{ width: number, height: number }} vp @param {string | null} aktiv
 * @param {(page: import("playwright").Page) => Promise<void>} fn
 * @param {{ kontext?: object, init?: string }} [extra]
 */
async function del(v, namn, scen, vp, aktiv, fn, extra = {}) {
  /** @type {import("playwright").BrowserContext | null} */
  let context = null;
  try {
    const o = await v.oppna(scen, vp, "light", 1, aktiv, 0, extra);
    context = o.context;
    await fn(o.page);
    // ⛔ En kommentar som hamnat som text i JSX (hänt i arbetet med skiva 3: ett `/* ... */` efter en ny omslutande tagg ritades som
    // ett stycke text överst i chatten, och varje jsdom-prov var grönt).
    const kommentar = await o.page.evaluate(() => (document.body.innerText || "").includes("/* ⛔"));
    v.krav(!kommentar, `${namn}: en kodkommentar står som text på sidan.`);
    const o2 = await over(o.page);
    v.krav(o2 <= 0, `${namn}: sidan rullar ${o2} px i sidled.`);
  } catch (e) {
    v.krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
  }
  await context?.close();
}

/** @param {Verktyg} v @param {import("playwright").Page} page @param {string} fil */
async function bild(v, page, fil) {
  if (v.bildmapp) await page.screenshot({ path: path.join(v.bildmapp, fil) });
}

/**
 * (1) MEDDELANDEN ÄR KÄRNA (skiva 1). Gruppen är sparad UTAN Meddelanden. Hubben ritar ändå kortet, och listan över appar att
 * installera har inte Meddelanden. På telefonen visar Appar-arket Meddelanden. Golv: hubben har minst tre kort och listan att
 * installera minst en rad (Kontakter).
 * @param {Verktyg} v
 */
export async function karnan(v) {
  for (const vp of BREDDER) {
    const namn = `47 (1) kärnan ${vp.width} px`;
    await del(v, namn, "karna", vp, null, async (page) => {
      await page.locator("[data-grupphubb]").waitFor({ timeout: 4000 });
      const m = await page.evaluate(() => ({
        kort: [...document.querySelectorAll("[data-grupphubb] a[href]")].map((a) => a.getAttribute("href")).filter((h) => h && h !== "/installera" && /^\/[a-z]+$/.test(h)),
        valbara: [...document.querySelectorAll("[data-hubb-valbar]")].map((el) => el.getAttribute("data-hubb-valbar")),
      }));
      v.matt.push(`${namn}: kort ${JSON.stringify(m.kort)}, att installera ${JSON.stringify(m.valbara)}`);
      v.krav(m.kort.length >= 3, `${namn}: ${m.kort.length} kort i hubben, väntat minst 3. Golv.`);
      v.krav(m.kort.includes("/meddelanden") && m.kort.includes("/inkorg"), `${namn}: hubben ritar inte båda kärnmodulerna, Meddelanden och Inkorgen (${JSON.stringify(m.kort)}).`);
      v.krav(m.valbara.length >= 1 && !m.valbara.includes("meddelanden") && !m.valbara.includes("inkorg"), `${namn}: listan att installera är ${JSON.stringify(m.valbara)}, väntat Kontakter och ingen kärnmodul.`);
      await bild(v, page, `karna-hubb-${vp.width}.png`);
      if (vp.width < 768) {
        await page.locator("[data-ops-bottenrad]").getByRole("button", { name: "Appar" }).click();
        await page.waitForSelector("[data-appar-ark]");
        const ark = await page.evaluate(() => [...document.querySelectorAll("[data-appar-ark] [data-ark-id]")].map((el) => el.getAttribute("data-ark-id")));
        v.matt.push(`${namn}: arket ${JSON.stringify(ark)}`);
        v.krav(ark.length >= 4 && ark.includes("meddelanden") && ark.includes("inkorg"), `${namn}: arket är ${JSON.stringify(ark)}, väntat minst fyra appar med Meddelanden och Inkorgen.`);
        await bild(v, page, `karna-ark-${vp.width}.png`);
      }
    });
  }
}

/**
 * Träffytan för ett element: bredd och höjd i den ritade rutan.
 * @param {import("playwright").Page} page @param {string} valjare
 */
async function ruta(page, valjare) {
  return page.evaluate((v) => {
    const el = document.querySelector(v);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, l: r.left, r: r.right, t: r.top, b: r.bottom, text: (el.textContent || "").trim() };
  }, valjare);
}

/**
 * (2) SAMTAL PER ÄMNE MED AGENTEN (skiva 2). Inkorgen har gruppen överst, sedan agenten som en rad med "gruppens agent" och antalet
 * samtal, sedan personerna. Agentens rad öppnar agentens samtal: Nytt samtal överst (44 px hög), och ett ämne per rad med rubriken.
 * Ett ämne visar rubriken i huvudet och en rad tillbaka till agenten (44 px). Golv: minst tre ämnen i listan.
 * @param {Verktyg} v
 */
export async function amnen(v) {
  for (const vp of BREDDER) {
    const namn = `47 (2) ämnen ${vp.width} px`;
    await del(v, namn, "amnen", vp, null, async (page) => {
      await page.locator("[data-agentrad='ops']").waitFor({ timeout: 4000 });
      const ordning = await page.evaluate(() => [...document.querySelectorAll("[data-samtalslista] [data-samtalsrad], [data-samtalslista] [data-agentrad]")].map((el) => el.getAttribute("data-samtalsrad") ?? "agent"));
      const rad = await ruta(page, "[data-agentrad='ops']");
      v.matt.push(`${namn}: inkorgen ${JSON.stringify(ordning)}, agentens rad ${JSON.stringify(rad?.text)} ${rad?.h.toFixed(0)} px`);
      v.krav(JSON.stringify(ordning) === JSON.stringify(["grupp", "agent", "personer"]), `${namn}: inkorgen är ${JSON.stringify(ordning)}, väntat gruppen, agenten, personen.`);
      v.krav(Boolean(rad && rad.text.includes("Hugo, gruppens agent") && /3 samtal, senast/.test(rad.text) && rad.h >= 43.5), `${namn}: agentens rad är ${JSON.stringify(rad)}, väntat "Hugo, gruppens agent" och "3 samtal, senast", minst 44 px.`);
      await bild(v, page, `amnen-inkorg-${vp.width}.png`);
      await page.locator("[data-agentrad='ops']").click();
      await page.locator("[data-agentens-samtal]").waitFor({ timeout: 4000 });
      const nytt = await ruta(page, "[data-nytt-amne]");
      const rader = await page.evaluate(() => [...document.querySelectorAll("[data-amnesrad]")].map((el) => { const r = el.getBoundingClientRect(); return { h: r.height, r: r.right, text: (el.textContent || "").trim().slice(0, 40) }; }));
      v.matt.push(`${namn}: Nytt samtal ${nytt?.w.toFixed(0)}x${nytt?.h.toFixed(0)}, ämnen ${JSON.stringify(rader.map((r) => r.text))}`);
      v.krav(Boolean(nytt && nytt.h >= 43.5 && nytt.r <= vp.width + 0.5), `${namn}: Nytt samtal är ${JSON.stringify(nytt)}, väntat minst 44 px hög och inom fönstret.`);
      v.krav(rader.length >= 3, `${namn}: ${rader.length} ämnen i listan, väntat minst 3. Golv.`);
      v.krav(rader.every((r) => r.h >= 43.5 && r.r <= vp.width + 0.5), `${namn}: en ämnesrad är lägre än 44 px eller sticker ut (${JSON.stringify(rader)}).`);
      v.krav(rader.some((r) => r.text.startsWith("Resan till Stockholm")), `${namn}: rubriken agenten satt syns inte i listan (${JSON.stringify(rader)}).`);
      await bild(v, page, `amnen-lista-${vp.width}.png`);
      await page.locator("[data-amnesrad]").first().click();
      await page.locator("[data-amnesrubrik]").waitFor({ timeout: 4000 });
      const huvud = await ruta(page, "[data-amnesrubrik]");
      const tillbaka = await ruta(page, "[data-tillbaka-agent]");
      v.matt.push(`${namn}: ämnets huvud ${JSON.stringify(huvud?.text)}, tillbaka ${tillbaka?.h.toFixed(0)} px`);
      v.krav(Boolean(huvud && huvud.text.length > 0 && huvud.r <= vp.width + 0.5), `${namn}: ämnets rubrik saknas i huvudet (${JSON.stringify(huvud)}).`);
      v.krav(Boolean(tillbaka && tillbaka.h >= 43.5 && tillbaka.text === "Hugo"), `${namn}: raden tillbaka till agenten är ${JSON.stringify(tillbaka)}, väntat "Hugo" och minst 44 px.`);
      await bild(v, page, `amnen-samtal-${vp.width}.png`);
    });
  }
}

/** Svenska förval som inte får stå i en engelsk chatt. Ett urval: det fullständiga provet är jsdom-provet `chatt-sprak.test.jsx`. */
const SVENSKA = ["Skicka", "Skriv till gruppen", "Sök i samtalet", "Chattinfo", "Reagera", "Svara i tråd", "Fäst", "Olästa", "Nytt meddelande", "Meddelanden", "Tysta notiser", "Nytt samtal", "gruppens agent", "Visa arkiverade", "Prata in", "Alla i gruppen ser det här"];

/**
 * (3) CHATTEN PÅ ENGELSKA (skiva 3, #385). Gruppchatten och agentens samtal med `sprak="en"`: inga svenska förval i texter, namn
 * och platstexter, platstexten "Write to the group" syns hel i fältet, och inget rullar i sidled. Golv: minst 8 engelska ord hittas.
 * @param {Verktyg} v
 */
export async function engelska(v) {
  for (const vp of BREDDER) {
    for (const aktiv of ["grupp", "agent"]) {
      const namn = `47 (3) engelska ${aktiv} ${vp.width} px`;
      await del(v, namn, "chatt0106-en", vp, aktiv, async (page) => {
        await page.locator(aktiv === "grupp" ? "[data-ops-samtal] [data-meddelande]" : "[data-agentens-samtal]").first().waitFor({ timeout: 4000 });
        const m = await page.evaluate((svenska) => {
          const texter = [...document.querySelectorAll("[data-ops-meddelanden] *")].flatMap((el) => [
            ...[...el.childNodes].filter((n) => n.nodeType === 3).map((n) => (n.textContent || "").trim()),
            el.getAttribute("aria-label") ?? "",
            el.getAttribute("placeholder") ?? "",
          ]).filter(Boolean);
          const hel = (/** @type {string} */ ord) => new RegExp(`(?<![\\p{L}])${ord}(?![\\p{L}])`, "u");
          const ruta = document.querySelector("[data-skrivfalt] textarea");
          return {
            svenska: svenska.filter((o) => texter.some((t) => hel(o).test(t))),
            engelska: ["Messages", "New message", "All", "Unread", "Search messages", "Send", "Write to the group", "Search the conversation", "Chat info", "React", "Reply in thread", "Pin", "New conversation", "the group's agent", "Show archived"].filter((o) => texter.some((t) => hel(o).test(t))),
            platstext: ruta ? { text: ruta.getAttribute("placeholder"), ryms: ruta.scrollWidth <= ruta.clientWidth + 1 } : null,
          };
        }, SVENSKA);
        v.matt.push(`${namn}: svenska ${JSON.stringify(m.svenska)}, engelska ${m.engelska.length}, platstext ${JSON.stringify(m.platstext)}`);
        v.krav(m.svenska.length === 0, `${namn}: svenska förval i en engelsk chatt: ${JSON.stringify(m.svenska)}.`);
        v.krav(m.engelska.length >= (aktiv === "grupp" ? 8 : 4), `${namn}: ${m.engelska.length} engelska ord hittades (${JSON.stringify(m.engelska)}). Golv.`);
        if (aktiv === "grupp") v.krav(Boolean(m.platstext && m.platstext.text === "Write to the group" && m.platstext.ryms), `${namn}: platstexten är ${JSON.stringify(m.platstext)}.`);
        await bild(v, page, `engelska-${aktiv}-${vp.width}.png`);
      });
    }
  }
}

/**
 * Var en rad står mot loggens synliga del och skrivfältet. `inne` när hela raden är inom loggens fönster och ovanför skrivfältet.
 * @param {import("playwright").Page} page @param {string} valjare
 */
async function iSikte(page, valjare) {
  return page.evaluate((v) => {
    const el = [...document.querySelectorAll(v)].pop();
    const logg = document.querySelector("[data-ops-samtal] [role=log]");
    const falt = document.querySelector("[data-skrivfalt]");
    if (!el || !logg) return null;
    const r = el.getBoundingClientRect();
    const l = logg.getBoundingClientRect();
    const f = falt ? falt.getBoundingClientRect().top : Infinity;
    return { topp: r.top, botten: r.bottom, loggTopp: l.top, loggBotten: l.bottom, falt: f, inne: r.top >= l.top - 0.5 && r.bottom <= l.bottom + 0.5 && r.bottom <= f + 0.5 };
  }, valjare);
}

/**
 * (4) LÄSA BAKÅT OCH AGENTENS STATUS (skiva 4, och CP:s skärmbild 2026-10-14: "Agenten tänker" hamnade under skrivfältet).
 *   (a) Står man vid slutet och agentens status kommer, står raden helt inom loggen, ovanför skrivfältet.
 *   (b) Ett förslagskort som kommer med agentens svar syns också helt.
 *   (c) Har man rullat upp och ett svar kommer, står loggen kvar (högst 2 px), och "Till senaste" visar "1 nya" och att agenten
 *       arbetar, minst 44 px hög och inom fönstret. Ett tryck tar en till slutet.
 * Golv: loggen måste kunna rulla (minst 200 px mer innehåll än fönster), annars mäter (c) ingenting.
 * @param {Verktyg} v
 */
export async function lasaBakat(v) {
  for (const vp of BREDDER) {
    const namn = `47 (4) läsa bakåt ${vp.width} px`;
    await del(v, namn, "chatt0106-las", vp, null, async (page) => {
      await page.locator("[data-ops-samtal] [data-meddelande]").first().waitFor({ timeout: 4000 });
      await page.waitForTimeout(150);
      const rullbar = await page.evaluate(() => { const l = /** @type {HTMLElement} */ (document.querySelector("[data-ops-samtal] [role=log]")); return l.scrollHeight - l.clientHeight; });
      v.krav(rullbar >= 200, `${namn}: loggen rullar ${rullbar} px, väntat minst 200. Golv.`);
      // (a)
      await page.evaluate(() => { const x = /** @type {any} */ (window).__las; return x.kalla.create(`samtal/${x.sid}/status`, { id: "agent", lage: "tanker", sedan: Date.now() }); });
      await page.locator("[data-agentstatus='tanker']").waitFor({ timeout: 4000 });
      await page.waitForTimeout(150);
      const a = await iSikte(page, "[data-agentstatus]");
      v.matt.push(`${namn}: (a) "Agenten tänker" ${JSON.stringify(a)}`);
      v.krav(Boolean(a?.inne), `${namn}: (a) raden "Agenten tänker" står inte helt inom loggen ovanför skrivfältet (${JSON.stringify(a)}).`);
      await bild(v, page, `lasa-status-${vp.width}.png`);
      // (b)
      await page.evaluate(() => {
        const x = /** @type {any} */ (window).__las;
        return Promise.all([
          x.kalla.remove(`samtal/${x.sid}/status`, "agent"),
          x.kalla.create(`samtal/${x.sid}/meddelanden`, { text: "Jag kan boka mötet med banken på fredag klockan tio.", av: "ops", tid: x.tid(), forslag: [{ id: "f1", etikett: "Boka mötet", ikon: "kalender", text: "Fredag 10.00, banken" }, { id: "f2", etikett: "Välj en annan tid" }] }),
        ]);
      });
      await page.locator("[data-ops-forslag]").waitFor({ timeout: 4000 });
      await page.waitForTimeout(150);
      const b = await iSikte(page, "[data-ops-forslag]");
      v.matt.push(`${namn}: (b) förslagen ${JSON.stringify(b)}`);
      v.krav(Boolean(b?.inne), `${namn}: (b) förslagskortet står inte helt inom loggen ovanför skrivfältet (${JSON.stringify(b)}).`);
      // (c)
      await page.evaluate(() => { const l = /** @type {HTMLElement} */ (document.querySelector("[data-ops-samtal] [role=log]")); l.scrollTop = 0; });
      await page.waitForTimeout(150);
      const fore = await page.evaluate(() => /** @type {HTMLElement} */ (document.querySelector("[data-ops-samtal] [role=log]")).scrollTop);
      await page.evaluate(() => {
        const x = /** @type {any} */ (window).__las;
        return Promise.all([
          x.kalla.create(`samtal/${x.sid}/meddelanden`, { text: "En sak till om banken.", av: "ops", tid: x.tid() }),
          x.kalla.create(`samtal/${x.sid}/status`, { id: "agent", lage: "skriver", sedan: Date.now() }),
        ]);
      });
      await page.locator("[data-agentstatus='skriver']").waitFor({ timeout: 4000, state: "attached" });
      await page.waitForTimeout(200);
      const efter = await page.evaluate(() => /** @type {HTMLElement} */ (document.querySelector("[data-ops-samtal] [role=log]")).scrollTop);
      const knapp = await ruta(page, "[data-till-senaste]");
      const etikett = await page.locator("[data-till-senaste]").getAttribute("aria-label").catch(() => null);
      v.matt.push(`${namn}: (c) rullning ${fore} till ${efter}, knappen ${JSON.stringify(knapp)} "${etikett}"`);
      v.krav(Math.abs(efter - fore) <= 2, `${namn}: (c) loggen rycktes från ${fore} till ${efter} när ett svar kom.`);
      v.krav(Boolean(knapp && knapp.h >= 43.5 && knapp.r <= vp.width + 0.5 && knapp.b <= vp.height + 0.5), `${namn}: (c) Till senaste saknas, är lägre än 44 px eller står utanför fönstret (${JSON.stringify(knapp)}).`);
      v.krav(etikett === "Till senaste, 1 nya, Agenten skriver", `${namn}: (c) Till senaste heter ${JSON.stringify(etikett)}, väntat "Till senaste, 1 nya, Agenten skriver".`);
      await bild(v, page, `lasa-till-senaste-${vp.width}.png`);
      if (knapp) {
        await page.locator("[data-till-senaste]").click();
        await page.waitForTimeout(150);
        const sist = await iSikte(page, "[data-agentstatus]");
        v.krav(Boolean(sist?.inne), `${namn}: (c) efter Till senaste står agentens rad inte i sikte (${JSON.stringify(sist)}).`);
      }
    });
  }
}

/** En iPhone i Chromium: användaragenten, pekskärmen och mobilens vyport. ⛔ Inte Safari: WebKit finns inte på maskinen. */
const IPHONE = { isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" };

/**
 * Ett `visualViewport` vi styr, så att ett tangentbord går att låtsas. Chromium har inget virtuellt tangentbord. Skriptet körs före sidan.
 */
const FALSKT_VV = `(() => {
  const vv = new EventTarget();
  let h = window.innerHeight;
  Object.defineProperty(vv, "height", { get: () => h });
  Object.defineProperty(vv, "width", { get: () => window.innerWidth });
  Object.defineProperty(vv, "offsetTop", { get: () => 0 });
  Object.defineProperty(vv, "offsetLeft", { get: () => 0 });
  Object.defineProperty(vv, "scale", { get: () => 1 });
  Object.defineProperty(window, "visualViewport", { configurable: true, get: () => vv });
  // \`android\`: innerHeight krymper med tangentbordet, som i Android Chrome, medan layoutfönstret (clientHeight) står kvar (granskningen av PR 462). Annars (iOS) står innerHeight kvar.
  const inner0 = Object.getOwnPropertyDescriptor(window, "innerHeight");
  window.__tangentbord = (px, android) => {
    const layout = document.documentElement.clientHeight;
    h = layout - px;
    if (android && px) Object.defineProperty(window, "innerHeight", { configurable: true, get: () => layout - px });
    else if (inner0) Object.defineProperty(window, "innerHeight", inner0);
    vv.dispatchEvent(new Event("resize"));
  };
})();`;

/**
 * Bottenradens läge (0.152.0, #461): syns den, hur hög är den, hur stor är mikrofonknappen, träffas den där den satt, hur mycket reserverar `main` för den.
 * @param {import("playwright").Page} page
 */
function bottenrad(page) {
  return page.evaluate(() => {
    const nav = /** @type {HTMLElement} */ (document.querySelector("nav[data-ops-bottenrad]"));
    const stil = getComputedStyle(nav);
    const r = nav.getBoundingClientRect();
    const mik = nav.querySelector("button.size-14");
    const m = mik ? mik.getBoundingClientRect() : { width: 0, height: 0, left: 0, top: 0 };
    // Där mikrofonens mitt satt med raden uppe: 390 px bred skärm, mitt i raden, 40 px över underkanten.
    const traffas = nav.contains(document.elementFromPoint(window.innerWidth / 2, document.documentElement.clientHeight - 40)) ? "ja" : "";
    const main = /** @type {HTMLElement} */ (document.querySelector("main"));
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:1px;height:var(--bottom-nav-h)";
    document.body.appendChild(probe);
    const navH = probe.getBoundingClientRect().height;
    probe.remove();
    return {
      syns: stil.display !== "none" && r.height > 0,
      display: stil.display,
      hojd: r.height,
      mikrofon: stil.display === "none" ? 0 : Math.min(m.width, m.height),
      traffas,
      mainPadding: parseFloat(getComputedStyle(main).paddingBottom) || 0,
      navH,
      fokusIFalt: document.activeElement?.tagName === "TEXTAREA",
      aktivt: document.activeElement ? document.activeElement.tagName : "ingen",
    };
  });
}

/**
 * (5) SKRIVFÄLTET PÅ TELEFON (skiva 5). Vid 390 px med iPhonens användaragent och pekskärm (i Chromium, inte Safari):
 *   (a) fältets text är minst 16 px (iOS zoomar in under det); vid 1280 px 14 px, som bubblorna;
 *   (b) fältet växer med fem rader, och agentens statusrad står kvar i sikte ovanför fältet medan det växer;
 *   (c) med 30 rader stannar höjden vid taket (160 px plus ramen) och fältet rullar inuti sig;
 *   (d) nära taket syns räknaren inom fönstret, och över taket står hela texten kvar, raden säger det och Skicka är avstängd;
 *   (e) ett tangentbord på 300 px (ett `visualViewport` som krymper) lägger fältets underkant ovanför tangentbordet;
 *   (f) 0.152.0 (#461, punkt 1): BOTTENRADEN OCH MIKROFONKNAPPEN GÖMS medan fältet har fokus OCH viewporten har krympt. Mätt i fyra lägen:
 *       fokus utan krympning (en extern tangentbordsenhet): raden syns; fokus och tangentbord 300: raden och mikrofonen syns inte
 *       (`display: none`, ingen träffyta kvar där den satt), `main` har ingen padding för raden och inget tomt glapp finns mellan
 *       skrivfältet och viewportens underkant; fokus lämnas: raden är tillbaka; tangentbordet fälls med fokus kvar: raden är tillbaka.
 *       Golv: raden syns innan tangentbordet (minst 60 px hög, mikrofonen minst 44 px). Hela (e) och (f) körs i TVÅ lägen (granskningen av PR 462): iOS, där `innerHeight` står kvar
 *       när tangentbordet kommer, och Android, där `innerHeight` krymper med det medan layoutfönstret (`clientHeight`) står kvar. Mäts raden mot `innerHeight` göms den aldrig i det
 *       andra, och provet hade inte sett det om det bara kört det första.
 * ⛔ En riktig iPhone är inte mätt: zoomen och tangentbordet är Safaris beteende, och här mäts det ramverket gör åt dem.
 * @param {Verktyg} v
 */
export async function skrivfaltet(v) {
  for (const vp of BREDDER) {
    const namn = `47 (5) skrivfältet ${vp.width} px`;
    const telefon = vp.width < 768;
    await del(v, namn, "chatt0106-las", vp, null, async (page) => {
      await page.locator("[data-ops-samtal] [data-meddelande]").first().waitFor({ timeout: 4000 });
      const falt = page.locator("[data-skrivfalt] textarea");
      const stil = await falt.evaluate((el) => ({ px: parseFloat(getComputedStyle(el).fontSize), h: el.getBoundingClientRect().height }));
      v.matt.push(`${namn}: (a) ${stil.px} px, höjd ${stil.h.toFixed(0)}`);
      v.krav(telefon ? stil.px >= 16 : stil.px >= 14, `${namn}: (a) fältets text är ${stil.px} px, väntat ${telefon ? "minst 16" : "minst 14"}.`);
      // (b)
      await page.evaluate(() => { const x = /** @type {any} */ (window).__las; return x.kalla.create(`samtal/${x.sid}/status`, { id: "agent", lage: "tanker", sedan: Date.now() }); });
      await page.locator("[data-agentstatus='tanker']").waitFor({ timeout: 4000 });
      await falt.fill("Första raden\nandra\ntredje\nfjärde\nfemte");
      await page.waitForTimeout(200);
      const fem = await falt.evaluate((el) => el.getBoundingClientRect().height);
      const status = await iSikte(page, "[data-agentstatus]");
      v.matt.push(`${namn}: (b) fem rader ${fem.toFixed(0)} px, statusraden ${JSON.stringify(status)}`);
      v.krav(fem > stil.h + 40, `${namn}: (b) fältet växte från ${stil.h.toFixed(0)} till ${fem.toFixed(0)} px med fem rader, väntat minst 40 px till.`);
      v.krav(Boolean(status?.inne), `${namn}: (b) agentens statusrad hamnade utom sikte när fältet växte (${JSON.stringify(status)}).`);
      await bild(v, page, `skrivfalt-fem-rader-${vp.width}.png`);
      // (c)
      await falt.fill(Array.from({ length: 30 }, (_, i) => `Rad ${i + 1}`).join("\n"));
      await page.waitForTimeout(150);
      const tak = await falt.evaluate((el) => ({ h: el.getBoundingClientRect().height, rullar: el.scrollHeight > el.clientHeight + 1 }));
      v.matt.push(`${namn}: (c) 30 rader ${JSON.stringify(tak)}`);
      v.krav(tak.h <= 162.5 && tak.h >= 150 && tak.rullar, `${namn}: (c) med 30 rader är fältet ${tak.h.toFixed(0)} px och rullar ${tak.rullar}, väntat taket (160 px) och rullning inuti.`);
      // (d)
      await falt.fill("a".repeat(3700));
      const nara = await ruta(page, "[data-langdraknare='nara']");
      await falt.fill("a".repeat(4100));
      const over = await ruta(page, "[data-langdraknare='over']");
      const varde = await falt.inputValue();
      const avstangd = await page.locator("[data-skrivfalt] button[type=submit]").isDisabled();
      v.matt.push(`${namn}: (d) nära ${JSON.stringify(nara?.text)}, över ${JSON.stringify(over?.text)}, ${varde.length} tecken kvar, Skicka avstängd ${avstangd}`);
      v.krav(Boolean(nara && nara.text === "3700 av 4000 tecken" && nara.b <= vp.height + 0.5), `${namn}: (d) räknaren nära taket är ${JSON.stringify(nara)}.`);
      v.krav(Boolean(over && over.text.startsWith("Texten är 100 tecken för lång") && over.b <= vp.height + 0.5) && varde.length === 4100 && avstangd, `${namn}: (d) över taket: ${JSON.stringify(over)}, ${varde.length} tecken, Skicka avstängd ${avstangd}.`);
      await bild(v, page, `skrivfalt-over-taket-${vp.width}.png`);
      // (e), och (f) i två lägen: iOS (innerHeight står kvar) och Android (innerHeight krymper med tangentbordet, layoutfönstret inte).
      if (telefon) for (const android of [false, true]) {
        const lage = android ? "Android" : "iOS";
        await falt.fill("Hej");
        // (f) FÖRE tangentbordet: raden och mikrofonen syns, med fokus i fältet (en extern tangentbordsenhet krymper ingenting).
        const rad0 = await bottenrad(page);
        v.matt.push(`${namn} ${lage}: (f) fokus utan tangentbord: ${JSON.stringify(rad0)}`);
        v.krav(rad0.hojd >= 60 && rad0.mikrofon >= 44, `${namn} ${lage}: (f) golv: bottenraden är ${rad0.hojd.toFixed(0)} px hög och mikrofonen ${rad0.mikrofon.toFixed(0)} px före tangentbordet, väntat minst 60 och 44.`);
        v.krav(rad0.fokusIFalt, `${namn} ${lage}: (f) golv: skrivfältet har inte fokus (${rad0.aktivt}), så provet mäter inte fokus och krympning ihop.`);
        await bild(v, page, `skrivfalt-fore-tangentbord-${lage}-${vp.width}.png`);
        await page.evaluate((a) => /** @type {any} */ (window).__tangentbord(300, a), android);
        await page.waitForTimeout(200);
        const kant = await page.evaluate(() => ({ botten: /** @type {HTMLElement} */ (document.querySelector("[data-skrivfalt]")).getBoundingClientRect().bottom, synligt: /** @type {VisualViewport} */ (window.visualViewport).height }));
        v.matt.push(`${namn} ${lage}: (e) tangentbord 300 px: fältets underkant ${kant.botten.toFixed(0)}, synligt till ${kant.synligt}`);
        v.krav(kant.botten <= kant.synligt + 1, `${namn} ${lage}: (e) skrivfältet slutar vid ${kant.botten.toFixed(0)} px, under tangentbordet som börjar vid ${kant.synligt}.`);
        // ⛔ Och vyn följer med: personen stod vid slutet och har inte rört skärmen. Mätt utan följ-fixen: Till senaste kom fram och
        // loggen stod 98 px från slutet, beroende på om webbläsarens scroll-event hann köras före tangentbordet (därför också jsdom-provet).
        const slut = await page.evaluate(() => { const l = /** @type {HTMLElement} */ (document.querySelector("[data-ops-samtal] [role=log]")); return { kvar: Math.round(l.scrollHeight - l.scrollTop - l.clientHeight), knapp: Boolean(document.querySelector("[data-till-senaste]")) }; });
        const statusrad = await iSikte(page, "[data-agentstatus]");
        v.matt.push(`${namn} ${lage}: (e) efter tangentbordet ${JSON.stringify(slut)}, statusraden ${JSON.stringify(statusrad)}`);
        v.krav(slut.kvar <= 2 && !slut.knapp && Boolean(statusrad?.inne), `${namn} ${lage}: (e) vyn följde inte med när tangentbordet öppnades: ${JSON.stringify(slut)}, statusraden ${JSON.stringify(statusrad)}.`);
        // (f) MED tangentbordet: raden och mikrofonen är borta, platsen med dem, och skrivfältet står direkt ovanför tangentbordet.
        const rad1 = await bottenrad(page);
        const glapp = kant.synligt - kant.botten;
        v.matt.push(`${namn} ${lage}: (f) fokus och tangentbord 300: ${JSON.stringify(rad1)}, glapp mellan skrivfältet och tangentbordet ${glapp.toFixed(0)} px`);
        v.krav(!rad1.syns && rad1.display === "none" && rad1.hojd === 0, `${namn} ${lage}: (f) bottenraden syns medan tangentbordet är uppe (display ${rad1.display}, höjd ${rad1.hojd.toFixed(0)}).`);
        v.krav(rad1.mikrofon === 0, `${namn} ${lage}: (f) mikrofonknappen syns medan tangentbordet är uppe (${rad1.mikrofon.toFixed(0)} px).`);
        v.krav(!rad1.traffas, `${namn} ${lage}: (f) bottenraden träffas fortfarande där den satt (${rad1.traffas}).`);
        v.krav(rad1.mainPadding <= 1, `${namn} ${lage}: (f) main reserverar ${rad1.mainPadding.toFixed(0)} px för en rad som inte finns, ett tomt glapp.`);
        v.krav(rad1.navH === 0, `${namn} ${lage}: (f) --bottom-nav-h är ${rad1.navH} px, väntat 0 medan raden är gömd.`);
        v.krav(glapp >= -1 && glapp <= 24, `${namn} ${lage}: (f) skrivfältet slutar ${glapp.toFixed(0)} px ovanför tangentbordet, väntat 0 till 24 (fältets egen luft).`);
        await bild(v, page, `skrivfalt-tangentbord-${lage}-${vp.width}.png`);
        // (f) Fokus lämnas: raden är tillbaka.
        await falt.blur();
        await page.waitForTimeout(150);
        const rad2 = await bottenrad(page);
        v.matt.push(`${namn} ${lage}: (f) fokus lämnat, tangentbordet kvar: ${JSON.stringify(rad2)}`);
        v.krav(rad2.syns && rad2.hojd >= 60 && rad2.mikrofon >= 44 && rad2.navH > 0, `${namn} ${lage}: (f) raden kom inte tillbaka när fokus lämnade fältet (${JSON.stringify(rad2)}).`);
        // (f) Tangentbordet fälls med fokus kvar: raden är tillbaka.
        await falt.focus();
        await page.waitForTimeout(150);
        const rad3 = await bottenrad(page);
        v.krav(!rad3.syns, `${namn} ${lage}: (f) golv: fokus och tangentbord 300 igen ska gömma raden (${JSON.stringify(rad3)}).`);
        await page.evaluate((a) => /** @type {any} */ (window).__tangentbord(0, a), android);
        await page.waitForTimeout(150);
        const rad4 = await bottenrad(page);
        v.matt.push(`${namn} ${lage}: (f) tangentbordet fällt, fokus kvar: ${JSON.stringify(rad4)}`);
        v.krav(rad4.syns && rad4.fokusIFalt && rad4.hojd >= 60 && rad4.navH > 0, `${namn} ${lage}: (f) raden kom inte tillbaka när tangentbordet fälldes med fokus kvar (${JSON.stringify(rad4)}).`);
        // (f) Krympning utan fokus (verktygsfältet, en dialog): ingenting göms.
        await falt.blur();
        await page.evaluate((a) => /** @type {any} */ (window).__tangentbord(300, a), android);
        await page.waitForTimeout(150);
        const rad5 = await bottenrad(page);
        v.krav(rad5.syns, `${namn} ${lage}: (f) raden göms av en krympt viewport utan fokus i något fält (${JSON.stringify(rad5)}).`);
        await page.evaluate((a) => /** @type {any} */ (window).__tangentbord(0, a), android);
      }
    }, telefon ? { kontext: IPHONE, init: FALSKT_VV } : { init: FALSKT_VV });
  }
}

/**
 * Element per meddelande i scenen `chatt0106-mer`, mätt med 0.105.0 (`--dist`): 26 vid både 390 och 1280 px. 0.106.0 mätt: 23,8 och 26.
 * ⛔ Med Mer-knappen och de lösa knapparna i DOM:en samtidigt (före `useBredd`) var det fler, och chatten ritades nästan dubbelt så långsamt
 * i jsdom. Taket får bara sjunka, och det följer det mätta (granskningen av PR 390): telefonen mätt 23,8 har taket 24. Ett tak på 26
 * hade släppt in två element till per meddelande utan att vakten blev röd. Datorn är oförändrad mot 0.105.0 och har kvar 26.
 */
const TAK_ELEMENT_PER_MEDDELANDE = { telefon: 24, dator: 26 };

/**
 * (6) EN MER-KNAPP PER MEDDELANDE PÅ TELEFON (skiva 6). Gruppchatten med trådar, reaktioner och fästa, fem meddelanden.
 *   390 px, iPhonens användaragent och pekskärm (Chromium):
 *   (a) under varje bubbla syns ingen lös åtgärd (Reagera, Fäst, Svara med citat, Svara i tråd), bara innehåll: tiden, en reaktion,
 *       nålen på ett fäst meddelande; och exakt en ⋮ per meddelande, med träffyta minst 44 x 44;
 *   (b) ⋮ på det sista meddelandet, närmast skrivfältet, öppnar en meny som ryms i fönstret, med sex reaktioner överst och posterna
 *       Svara i tråd, Fäst och Kopiera;
 *   (c) Kopiera lägger meddelandets text i urklippet (läst tillbaka ur webbläsaren) och raden säger Kopierat.
 *   1280 px: ingen ⋮, och Reagera syns när pekaren står på meddelandet, som förut.
 * Golv: minst fem meddelanden.
 * @param {Verktyg} v
 */
export async function merKnappen(v) {
  for (const vp of BREDDER) {
    const namn = `47 (6) Mer-knappen ${vp.width} px`;
    const telefon = vp.width < 768;
    await del(v, namn, "chatt0106-mer", vp, null, async (page) => {
      await page.locator("[data-ops-samtal] [data-meddelande]").nth(4).waitFor({ timeout: 4000 });
      await page.waitForFunction(() => !document.querySelector("[data-tradmarke='okand']"), null, { timeout: 4000 });
      const rader = await page.evaluate(() =>
        [...document.querySelectorAll("[data-ops-samtal] [data-meddelande]")].map((rad) => {
          const syns = (/** @type {Element} */ el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
          };
          const losa = [...rad.querySelectorAll("[data-reagera], [data-citera], [data-fast][aria-pressed='false'], [data-tradmarke='ny'], [data-lyft-minne]")].filter(syns);
          const mer = [...rad.querySelectorAll("[data-mer] button")].filter(syns).map((b) => {
            const r = b.getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height) };
          });
          return { losa: losa.map((el) => [...el.attributes].map((a) => a.name).find((n) => n.startsWith("data-"))), mer };
        }),
      );
      v.matt.push(`${namn}: ${rader.length} meddelanden, ${JSON.stringify(rader)}`);
      v.krav(rader.length >= 5, `${namn}: ${rader.length} meddelanden, väntat minst 5. Golv.`);
      // ⛔ REGEL 13: inte tyngre. Element per meddelande, mätt mot 0.105.0 i samma scen (TAK, får bara sjunka).
      const element = await page.evaluate(() => {
        const rader = [...document.querySelectorAll("[data-ops-samtal] [data-meddelande]")];
        return rader.length ? Math.round((rader.reduce((n, r) => n + r.querySelectorAll("*").length, 0) / rader.length) * 10) / 10 : 0;
      });
      const tak = telefon ? TAK_ELEMENT_PER_MEDDELANDE.telefon : TAK_ELEMENT_PER_MEDDELANDE.dator;
      v.matt.push(`${namn}: ${element} element per meddelande (tak ${tak}, 0.105.0 hade 26)`);
      v.krav(element > 0 && element <= tak, `${namn}: ${element} element per meddelande, över taket ${tak} (0.105.0 hade 26).`);
      if (telefon) {
        // (a)
        const losa = rader.flatMap((r) => r.losa);
        v.krav(losa.length === 0, `${namn}: (a) lösa åtgärder syns under bubblorna: ${JSON.stringify(losa)}.`);
        v.krav(rader.every((r) => r.mer.length === 1 && r.mer[0].w >= 44 && r.mer[0].h >= 44), `${namn}: (a) inte exakt en ⋮ om minst 44 x 44 per meddelande: ${JSON.stringify(rader.map((r) => r.mer))}.`);
        await bild(v, page, `mer-rader-${vp.width}.png`);
        // (b)
        const sista = page.locator("[data-ops-samtal] [data-meddelande]").last();
        await sista.locator("[data-mer] button").click();
        const meny = page.locator("[role=menu]");
        await meny.waitFor({ timeout: 4000 });
        const m = await page.evaluate(() => {
          const ruta = /** @type {HTMLElement} */ (document.querySelector("[role=menu]")).parentElement;
          const r = /** @type {HTMLElement} */ (ruta).getBoundingClientRect();
          return {
            ruta: { l: r.left, t: r.top, r: r.right, b: r.bottom },
            fonster: { w: window.innerWidth, h: window.innerHeight },
            reaktioner: document.querySelectorAll("[data-mer-reaktioner] button").length,
            minst: Math.min(...[...document.querySelectorAll("[data-mer-reaktioner] button")].map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))),
            poster: [...document.querySelectorAll("[role=menu] [role=menuitem]")].map((el) => (el.textContent || "").trim()),
          };
        });
        v.matt.push(`${namn}: (b) menyn ${JSON.stringify(m)}`);
        const ryms = m.ruta.l >= 0 && m.ruta.t >= 0 && m.ruta.r <= m.fonster.w && m.ruta.b <= m.fonster.h;
        v.krav(ryms, `${namn}: (b) menyn ryms inte i fönstret: ${JSON.stringify(m.ruta)}.`);
        v.krav(m.reaktioner === 6 && ["Svara i tråd", "Fäst", "Kopiera"].every((p) => m.poster.includes(p)), `${namn}: (b) menyn har ${m.reaktioner} reaktioner och ${JSON.stringify(m.poster)}.`);
        v.krav(m.minst >= 43.5, `${namn}: (b) en reaktion i menyn är ${m.minst} px, väntat 44.`);
        await bild(v, page, `mer-meny-${vp.width}.png`);
        // (c)
        await page.locator("[role=menu] [role=menuitem]", { hasText: "Kopiera" }).click();
        await page.locator("[data-kopierat]").waitFor({ timeout: 4000 });
        const k = await page.evaluate(async () => ({ rad: document.querySelector("[data-kopierat]")?.textContent, urklipp: await navigator.clipboard.readText().catch((e) => `fel: ${e.message}`) }));
        v.matt.push(`${namn}: (c) ${JSON.stringify(k)}`);
        v.krav(k.rad === "Kopierat" && k.urklipp === "Tack. Säg till om underlaget saknas.", `${namn}: (c) Kopiera gav ${JSON.stringify(k)}.`);
      } else {
        v.krav(rader.every((r) => r.mer.length === 0), `${namn}: en ⋮ syns på dator: ${JSON.stringify(rader.map((r) => r.mer))}.`);
        const forsta = page.locator("[data-ops-samtal] [data-meddelande]").first();
        await forsta.locator("[data-bubbla]").hover();
        await page.waitForTimeout(250);
        const reagera = await forsta.locator("[data-reagera]").evaluate((el) => ({ opacitet: getComputedStyle(el).opacity, b: Math.round(el.getBoundingClientRect().width) }));
        v.matt.push(`${namn}: Reagera vid hover ${JSON.stringify(reagera)}`);
        v.krav(reagera.opacitet === "1" && reagera.b >= 44, `${namn}: Reagera syns inte vid hover: ${JSON.stringify(reagera)}.`);
        await bild(v, page, `mer-dator-hover-${vp.width}.png`);
      }
    }, telefon ? { kontext: { ...IPHONE, permissions: ["clipboard-read", "clipboard-write"] }, sakert: true } : {});
  }
}

/**
 * (7) EN INKORG SOM LEVER (skiva 7). Ingen `focus` skickas. Vid 390 px står inkorgen ensam, vid 1280 px står samtalet med Cia öppet
 * bredvid listan. Bo skriver i sitt samtal, och inom två sekunder står hans rad med texten och en räknare på 1, och Olästa-filtret
 * räknar 1. Golv: tre rader i inkorgen.
 * @param {Verktyg} v
 */
export async function inkorgenLever(v) {
  for (const vp of BREDDER) {
    const namn = `47 (7) inkorgen lever ${vp.width} px`;
    const telefon = vp.width < 768;
    await del(v, namn, "chatt0106-inkorg", vp, telefon ? null : "samtal", async (page) => {
      const bo = page.locator("[data-ops-meddelanden] button", { hasText: "Bo Lind" }).first();
      await bo.waitFor({ timeout: 4000 });
      await page.locator("[data-ops-meddelanden] button", { hasText: "Hej Bo, har du underlaget?" }).first().waitFor({ timeout: 4000 });
      const antal = await page.evaluate(() => [...document.querySelectorAll("[data-ops-meddelanden] button")].filter((b) => /Bo Lind|Cia Berg|Claes Philip Staiger AB/.test(b.textContent || "") && (b.textContent || "").length < 200).length);
      v.krav(antal >= 3, `${namn}: ${antal} rader i inkorgen, väntat minst 3. Golv.`);
      const fokus = await page.evaluate(() => {
        /** @type {any} */ (window).__fokus = 0;
        window.addEventListener("focus", () => (/** @type {any} */ (window).__fokus += 1));
        const x = /** @type {any} */ (window).__inkorg;
        return x.s.skicka(x.bo, { text: "Ja, jag skickar det i eftermiddag.", av: "bo" }).then(() => 0);
      });
      const kom = await page.locator("[data-ops-meddelanden] button", { hasText: "Ja, jag skickar det i eftermiddag." }).first().waitFor({ timeout: 2000 }).then(() => true, () => false);
      const rad = kom ? await page.locator("[data-ops-meddelanden] button", { hasText: "Ja, jag skickar det i eftermiddag." }).first().evaluate((el) => (el.textContent || "").replace(/\s+/g, " ").trim()) : null;
      const fokuser = await page.evaluate(() => /** @type {any} */ (window).__fokus);
      v.matt.push(`${namn}: raden efter Bos meddelande ${JSON.stringify(rad)}, fokus-händelser ${fokuser + fokus}`);
      v.krav(kom && fokuser === 0, `${namn}: Bos meddelande nådde inte inkorgen inom två sekunder utan fokus (${JSON.stringify(rad)}, fokus ${fokuser}).`);
      v.krav(Boolean(rad && /\b1\b/.test(rad)), `${namn}: Bos rad bär ingen räknare på 1: ${JSON.stringify(rad)}.`);
      await bild(v, page, `inkorg-lever-${vp.width}.png`);
    }, telefon ? { kontext: IPHONE } : {});
  }
}

/** En `webkitSpeechRecognition` som finns men aldrig startas här: förvalet syns som i Chrome och Safari. */
const FALSK_IGENKANNING = `window.webkitSpeechRecognition = class { start() {} stop() {} abort() {} };`;

/**
 * (8) TAL I ALLA TEXTFÄLT (skiva 8). Ett formulär med ett fält på en rad och ett på flera rader, båda med lång text, och lösenord,
 * e-post, sök och nummer. Vid 390 och 1280 px:
 *   (a) text och långtext har var sin ljudvåg, utan att appen bett om den, med träffyta minst 44 x 44 och samma ikon som chatten
 *       (`LjudvagIkon`, lucide-ikonen "audio-lines");
 *   (b) ljudvågen ligger inte över texten: fältets textyta slutar före knappens vänsterkant;
 *   (c) lösenord, e-post, sök och nummer har ingen ljudvåg.
 * Golv: sex fält. ⛔ #264 (CP 2026-10-16): vid 390 körs sidan som iPhone, där WebKit saknar igenkänning; mikrofonen finns ändå,
 * eftersom sidan har en utskrift (`OpsTranskriberingProvider`) och fältet då spelar in och låter servern skriva ut.
 * @param {Verktyg} v
 */
export async function talIAllaFalt(v) {
  for (const vp of BREDDER) {
    const namn = `47 (8) tal i alla textfält ${vp.width} px`;
    await del(v, namn, "tal-alla-falt", vp, null, async (page) => {
      await page.locator("[data-tal-falt]").nth(5).waitFor({ timeout: 4000 });
      const m = await page.evaluate(() =>
        [...document.querySelectorAll("[data-tal-falt]")].map((rad) => {
          const falt = /** @type {HTMLElement} */ (rad.querySelector("input, textarea"));
          const knappar = [...rad.querySelectorAll("[data-mikrofon]")];
          const k = knappar[0];
          const r = falt.getBoundingClientRect();
          const cs = getComputedStyle(falt);
          const textSlut = r.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
          const kr = k ? k.getBoundingClientRect() : null;
          return {
            slag: rad.getAttribute("data-tal-falt"),
            knappar: knappar.length,
            ikon: k ? (k.querySelector("svg")?.getAttribute("class") || "").includes("audio-lines") : false,
            traff: kr ? { w: Math.round(kr.width), h: Math.round(kr.height) } : null,
            textSlut: Math.round(textSlut),
            knappVanster: kr ? Math.round(kr.left) : null,
            inneIFaltet: kr ? kr.top >= r.top - 0.5 && kr.bottom <= r.bottom + 0.5 && kr.right <= r.right + 0.5 : null,
          };
        }),
      );
      v.matt.push(`${namn}: ${JSON.stringify(m)}`);
      v.krav(m.length >= 6, `${namn}: ${m.length} fält, väntat minst 6. Golv.`);
      for (const f of m.filter((x) => x.slag === "text" || x.slag === "langtext")) {
        v.krav(f.knappar === 1 && f.ikon && Boolean(f.traff && f.traff.w >= 44 && f.traff.h >= 44), `${namn}: (a) ${f.slag} har ${f.knappar} ljudvågor, ikon ${f.ikon}, träffyta ${JSON.stringify(f.traff)}.`);
        v.krav(f.knappVanster !== null && f.textSlut <= f.knappVanster && f.inneIFaltet === true, `${namn}: (b) i ${f.slag} slutar texten vid ${f.textSlut} och knappen börjar vid ${f.knappVanster} (inne i fältet ${f.inneIFaltet}).`);
      }
      const utan = m.filter((x) => ["password", "email", "search", "number"].includes(String(x.slag)));
      v.krav(utan.length === 4 && utan.every((x) => x.knappar === 0), `${namn}: (c) ljudvåg i ${JSON.stringify(utan.filter((x) => x.knappar > 0).map((x) => x.slag))}.`);
      await bild(v, page, `tal-falt-${vp.width}.png`);
    }, { init: FALSK_IGENKANNING, ...(vp.width < 768 ? { kontext: IPHONE } : {}) });
  }
}

/** En PNG på 2 x 2 bildpunkter, för filväljaren. */
const LITEN_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");

/**
 * (9) BILD I KOMMENTARER (skiva 9). En tråd med Bos skärmbild och skrivrutan med bilagor. Vid 390 och 1280 px:
 *   (a) knappen för att bifoga (0.132.0: en gem i skrivrutan som heter Bifoga, bredvid mikrofonen, inte en stor knapp "Välj fil" under rutan) är minst 44 px hög och ligger inne i skrivrutan;
 *   (b) miniatyren är en knapp, och ett tryck visar bilden i en dialog, större än miniatyren och inom fönstret, med Ladda ned;
 *       stängd är dialogen borta;
 *   (c) en vald bild visas före sändning, och ingenting skickas förrän Skicka; efter Skicka står bilden i den nya kommentaren.
 * @param {Verktyg} v
 */
export async function bildIKommentarer(v) {
  for (const vp of BREDDER) {
    const namn = `47 (9) bild i kommentarer ${vp.width} px`;
    await del(v, namn, "kommentar-bild", vp, null, async (page) => {
      await page.locator("[data-ops-kommentarer] [data-bilaga-forstora]").first().waitFor({ timeout: 4000 });
      // (a)
      const valj = page.getByRole("button", { name: "Bifoga", exact: true });
      const vb = await valj.boundingBox();
      v.krav(Boolean(vb && vb.height >= 43.5 && vb.width >= 43.5), `${namn}: (a) knappen Bifoga är ${vb?.width} x ${vb?.height} px, väntat minst 44 x 44.`);
      const fb = await page.locator("[data-ops-kommentarer] textarea").boundingBox();
      v.krav(Boolean(vb && fb && vb.x >= fb.x && vb.x + vb.width <= fb.x + fb.width + 0.5 && vb.y >= fb.y && vb.y + vb.height <= fb.y + fb.height + 0.5), `${namn}: (a) knappen Bifoga ligger inte inne i skrivrutan (knapp ${JSON.stringify(vb)}, ruta ${JSON.stringify(fb)}).`);
      v.krav((await page.getByRole("button", { name: "Välj fil" }).count()) === 0, `${namn}: (a) det finns en knapp "Välj fil" i kommentarerna, väntat ingen.`);
      // (b)
      const mini = page.locator("[data-ops-kommentarer] [data-bilaga-forstora]").first();
      const mb = await mini.boundingBox();
      await bild(v, page, `kommentar-bild-${vp.width}.png`);
      await mini.click();
      const dialog = page.locator("[role=dialog]");
      await dialog.waitFor({ timeout: 4000 });
      await page.locator("[data-bilaga-stor]").evaluate((el) => /** @type {HTMLImageElement} */ (el).decode?.().catch(() => {}));
      const stor = await page.evaluate(() => {
        const img = /** @type {HTMLImageElement} */ (document.querySelector("[data-bilaga-stor]"));
        const r = img.getBoundingClientRect();
        const d = /** @type {HTMLElement} */ (document.querySelector("[role=dialog]")).getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), inne: d.left >= -0.5 && d.right <= window.innerWidth + 0.5 && d.top >= -0.5 && d.bottom <= window.innerHeight + 0.5, ned: Boolean(document.querySelector("[role=dialog] [data-bilaga-ladda-ned][download]")) };
      });
      v.matt.push(`${namn}: (b) miniatyren ${JSON.stringify(mb && { w: Math.round(mb.width), h: Math.round(mb.height) })}, den stora ${JSON.stringify(stor)}`);
      v.krav(Boolean(mb && stor.w > mb.width && stor.inne && stor.ned), `${namn}: (b) den stora bilden ${JSON.stringify(stor)} är inte större än miniatyren (${mb?.width}) inom fönstret med Ladda ned.`);
      await bild(v, page, `kommentar-bild-stor-${vp.width}.png`);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached", timeout: 4000 });
      // (c)
      await page.locator("[data-kommentar-bilaga] input[type=file]").setInputFiles({ name: "skiss.png", mimeType: "image/png", buffer: LITEN_PNG });
      await page.locator("[data-kommentar-bilaga] img").waitFor({ timeout: 4000 });
      const fore = await page.evaluate(() => /** @type {any} */ (window).__skrivna.length);
      await bild(v, page, `kommentar-forhand-${vp.width}.png`);
      await page.locator("[data-ops-kommentarer] button", { hasText: "Skicka" }).click();
      await page.locator("[data-ops-kommentarer] [data-bilaga-forstora]").nth(1).waitFor({ timeout: 4000 });
      const efter = await page.evaluate(() => /** @type {any} */ (window).__skrivna);
      v.matt.push(`${namn}: (c) skickat före Skicka ${fore}, efter ${JSON.stringify(efter)}`);
      v.krav(fore === 0 && efter.length === 1 && efter[0].bilaga === true, `${namn}: (c) före Skicka ${fore} skickade, efter ${JSON.stringify(efter)}.`);
    }, vp.width < 768 ? { kontext: IPHONE } : {});
  }
}

/**
 * Alla delar i ordning. Varje skiva lägger till sin rad här.
 * @param {Verktyg} v
 */
export async function chattepiken0106(v) {
  await karnan(v);
  await amnen(v);
  await engelska(v);
  await lasaBakat(v);
  await skrivfaltet(v);
  await merKnappen(v);
  await inkorgenLever(v);
  await talIAllaFalt(v);
  await bildIKommentarer(v);
}
