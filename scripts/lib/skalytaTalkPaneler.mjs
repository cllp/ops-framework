import path from "node:path";

/**
 * Avsnitt 67 i check-skalyta: TALK OVANPÅ PANELERNA (0.231.0, cllp/ops-framework#602).
 *
 * CP 2026-11-15: "TAlk finns ju inte när man skall skriva text i ärenden mm." Sedan 0.230.0 skriver TALK i fältet där markören står, men panelerna
 * täckte knappen: `OpsSkapaPanel` (Ny händelse, Nytt ärende) låg över bottenraden på telefonen, och `OpsRadPanel` (ärendet i detalj) är en modal
 * Radix-dialog vars slöja låg över huvudet på datorn och över bottenraden på telefonen. Skissen CP godkände ("Snyggt kör på skissen"): mikrofonen
 * står kvar på sin plats, panelerna slutar där den börjar, och de andra flikarna är dämpade.
 *
 * jsdom kör ingen CSS (regel 12), så var panelen slutar och vad ett tryck träffar mäts här, med `elementFromPoint`, vid 390 och 1280 px:
 *
 *   SKAPA-PANELEN (`talk-skapapanel`):
 *     (1) 390: panelen slutar ovanför bottenraden och mikrofonens lyft, och knappraden (Avbryt, Skapa) ligger ovanför raden och är det som träffas.
 *     (2) TALK-knappen (390 i bottenraden, 1280 i huvudet) är det som träffas mitt på den, och den är inte `aria-hidden`.
 *     (3) 390: flikarna går inte att trycka på: ett tryck mitt på Kalender navigerar inte och panelen står kvar, och fliken tar inte fokus.
 *     (4) Markören i Beskrivning, tryck på TALK: raden säger "Till fältet Beskrivning", Klar skriver in det sagda där markören stod, panelen står kvar
 *         och ingenting går till appen.
 *     (4b) (0.232.0) DET SENASTE FÄLTET: markören i Beskrivning, fokus lämnar fältet (tangentbordet fälls ned), tryck på TALK: raden säger ändå
 *         "Till fältet Beskrivning", och Klar skriver in där markören stod. CP 2026-11-16 från iPhone: med tangentbordet uppe syns ingen TALK,
 *         så den som fäller ned det och trycker på bottenradens TALK har inte längre fokus i fältet.
 *   ÄRENDET I DETALJ (`talk-radpanel`, en modal Radix-dialog):
 *     (5) 390: panelen och slöjan slutar ovanför bottenraden. 1280: slöjan och panelen börjar under huvudet.
 *     (6) TALK-knappen är det som träffas och är inte `aria-hidden`; ett tryck på den STÄNGER INTE panelen, och TALK:s yta öppnas ovanpå.
 *     (7) TALK:s yta går att använda med fokus och tangentbord ovanpå panelens fokusfälla: Klar tar fokus och står kvar med det, och Enter på
 *         Klar ger valen, med panelen kvar.
 *     (8) 390: flikarna går inte att trycka på, som i (3).
 *
 * ⛔ GOLV: fältet, minst tre flikar i raden och panelens knappar måste finnas, annars rött. Skärmbilderna (`--bilder`) visar varje panel med TALK synlig.
 *
 * Kör ensamt: `node scripts/check-skalyta.mjs --bara-talkpaneler`. Hela körningen kör det också.
 */

/** @typedef {import("./skalyta0106.mjs").Verktyg} Verktyg */

const MENING = "kolla kabeln innan torsdag";
const BREDDER = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];

/**
 * Det som träffas mitt på ett element, och om det är elementet självt (eller något i det).
 * @param {import("playwright").Page} page @param {string} valjare
 */
function traff(page, valjare) {
  return page.evaluate((v) => {
    const el = /** @type {HTMLElement | null} */ (document.querySelector(v));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      top: r.top,
      bottom: r.bottom,
      mitt: r.y + r.height / 2,
      sjalv: !!t && (t === el || el.contains(t)),
      traff: t ? `${t.tagName.toLowerCase()}${t.getAttribute("data-radpanel") !== null ? "[data-radpanel]" : ""}${t.getAttribute("data-skapa-panel") !== null ? "[data-skapa-panel]" : ""}.${String(t.className).slice(0, 50)}` : null,
      dold: el.closest('[aria-hidden="true"]') !== null,
    };
  }, valjare);
}

/** Bottenradens överkant och flikarna i den, med vad som träffas mitt på varje. @param {import("playwright").Page} page */
function raden(page) {
  return page.evaluate(() => {
    const nav = /** @type {HTMLElement | null} */ (document.querySelector("nav[data-ops-bottenrad]"));
    if (!nav) return null;
    const flikar = [...nav.querySelectorAll("a, button")].filter((k) => !k.hasAttribute("data-talk-knapp")).map((k) => {
      const r = k.getBoundingClientRect();
      const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      /** @type {HTMLElement} */ (k).focus();
      const fokus = document.activeElement === k;
      return { namn: (k.textContent || "").trim(), traffad: !!t && (t === k || k.contains(t)), fokus, inert: k.closest("[inert]") !== null, opacitet: Number(getComputedStyle(/** @type {Element} */ (k.closest("[data-dampad] > *") ?? k)).opacity) };
    });
    /** @type {HTMLElement | null} */ (document.activeElement)?.blur?.();
    return { topp: nav.getBoundingClientRect().top, flikar };
  });
}

/**
 * Skapa-panelen med TALK, (1) till (4).
 * @param {Verktyg} v
 */
async function skapapanelen(v) {
  for (const vp of BREDDER) {
    const namn = `TALK ovanpå skapa-panelen ${vp.width} px`;
    const telefon = vp.width < 768;
    /** @type {import("playwright").BrowserContext | null} */
    let context = null;
    try {
      const o = await v.oppna("talk-skapapanel", vp, undefined, 1, "g3");
      context = o.context;
      const page = o.page;
      await page.waitForSelector("section[data-skapa-panel] [data-panelformular] textarea", { timeout: 4000 });
      await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
      const mic = telefon ? "nav[data-ops-bottenrad] [data-talk-knapp]" : "header [data-talk-huvud]";
      const geo = await page.evaluate(() => {
        const panel = /** @type {HTMLElement} */ (document.querySelector("section[data-skapa-panel]")).getBoundingClientRect();
        const knappar = /** @type {HTMLElement} */ (document.querySelector("[data-skapa-knappar]")).getBoundingClientRect();
        const lyft = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bottom-nav-overhang")) * 16 || 0;
        return { panelBotten: panel.bottom, knapparBotten: knappar.bottom, lyft };
      });
      const skapa = await traff(page, "[data-skapa-knappar] button[type=submit]");
      const avbryt = await page.evaluate(() => {
        const b = [...document.querySelectorAll("[data-skapa-knappar] button")].find((k) => (k.textContent || "").trim() === "Avbryt");
        if (!b) return null;
        const r = b.getBoundingClientRect();
        const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { sjalv: !!t && (t === b || b.contains(t)), bottom: r.bottom };
      });
      const knapp = await traff(page, mic);
      const rad = telefon ? await raden(page) : null;
      v.matt.push(`${namn}: panelen slutar ${geo.panelBotten.toFixed(0)}, knappraden ${geo.knapparBotten.toFixed(0)}, raden börjar ${rad ? rad.topp.toFixed(0) : "-"} (lyft ${geo.lyft}), Skapa ${JSON.stringify(skapa)}, Avbryt ${JSON.stringify(avbryt)}, TALK ${JSON.stringify(knapp)}, flikar ${rad ? JSON.stringify(rad.flikar) : "-"}`);
      v.krav(knapp !== null && skapa !== null && avbryt !== null, `${namn}: TALK-knappen, Skapa eller Avbryt saknas (golv).`);
      if (!knapp || !skapa || !avbryt) continue;
      v.krav(knapp.sjalv, `${namn}: mitt på TALK-knappen träffas ${knapp.traff}, väntat knappen. Panelen ligger över den.`);
      v.krav(!knapp.dold, `${namn}: TALK-knappen är aria-hidden medan panelen är öppen.`);
      v.krav(skapa.sjalv && avbryt.sjalv, `${namn}: Skapa (${skapa.traff}) eller Avbryt träffas inte mitt på, något ligger över panelens knapprad.`);
      if (telefon && rad) {
        v.krav(geo.panelBotten <= rad.topp - geo.lyft + 0.5 && geo.knapparBotten <= rad.topp - geo.lyft + 0.5, `${namn}: panelen slutar ${geo.panelBotten.toFixed(0)} och knappraden ${geo.knapparBotten.toFixed(0)}, väntat ovanför bottenraden och mikrofonens lyft (${(rad.topp - geo.lyft).toFixed(0)}).`);
        v.krav(rad.flikar.length >= 3, `${namn}: ${rad.flikar.length} flikar i bottenraden, väntat minst 3 (golv).`);
        for (const f of rad.flikar) v.krav(!f.traffad && !f.fokus && f.inert && f.opacitet < 0.75, `${namn}: fliken ${JSON.stringify(f.namn)} går att trycka på eller fokusera, eller är inte dämpad (${JSON.stringify(f)}).`);
        const kalender = await page.evaluate(() => {
          const a = [...document.querySelectorAll("nav[data-ops-bottenrad] a")].find((x) => (x.textContent || "").trim() === "Kalender");
          if (!a) return null;
          const r = a.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        v.krav(kalender !== null, `${namn}: fliken Kalender finns inte i bottenraden (golv).`);
        if (kalender) {
          await page.mouse.click(kalender.x, kalender.y);
          await page.waitForTimeout(200);
          const efter = await page.evaluate(() => ({ gick: /** @type {any} */ (window).__gick.slice(), panel: !!document.querySelector("section[data-skapa-panel]") }));
          v.krav(efter.gick.length === 0 && efter.panel, `${namn}: ett tryck på Kalender gav ${JSON.stringify(efter)}, väntat ingen navigering och panelen kvar.`);
        }
      }
      if (v.bildmapp) await page.screenshot({ path: path.join(v.bildmapp, `talk-skapapanel-${vp.width}-oppen.png`) });

      // (4) Markören efter "Mixern", tryck på TALK.
      const fore = await page.evaluate(() => /** @type {any} */ (window).__panelfalt);
      const plats = "Mixern".length;
      await page.locator("[data-panelformular] textarea").click();
      await page.evaluate((p) => /** @type {HTMLTextAreaElement} */ (document.querySelector("[data-panelformular] textarea")).setSelectionRange(p, p), plats);
      const r = await page.locator(mic).boundingBox();
      if (!r) throw new Error("TALK-knappen har ingen ruta");
      // Ett riktigt tryck på punkten där knappen ritas, inte ett klick på elementet: det som ligger överst där är det som får trycket.
      await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      await page.locator("[data-talk-samtalet]").waitFor({ timeout: 4000 });
      await page.waitForFunction((m) => (document.querySelector("[data-talk-text]")?.textContent || "").endsWith(m.split(" ").pop() || ""), MENING, { timeout: 4000 });
      const pratar = await page.evaluate(() => ({ rad: document.querySelector("[data-talk-samtalet]")?.textContent ?? "", panel: !!document.querySelector("section[data-skapa-panel]") }));
      v.matt.push(`${namn}, pratar: ${JSON.stringify(pratar)}`);
      v.krav(pratar.rad.includes("Till fältet Beskrivning") && pratar.panel, `${namn}: raden ska säga Till fältet Beskrivning med panelen kvar (${JSON.stringify(pratar)}).`);
      const klar = await traff(page, "[data-ops-talk] [data-talk-skicka]");
      v.krav(!!klar && klar.sjalv && !klar.dold, `${namn}: Klar i TALK:s yta träffas inte eller är aria-hidden (${JSON.stringify(klar)}).`);
      if (v.bildmapp) await page.screenshot({ path: path.join(v.bildmapp, `talk-skapapanel-${vp.width}-pratar.png`) });
      await page.locator("[data-talk-skicka]").click();
      await page.waitForFunction((f) => /** @type {any} */ (window).__panelfalt !== f, fore, { timeout: 4000 });
      await page.waitForTimeout(150);
      const efter = await page.evaluate(() => ({ varde: /** @type {any} */ (window).__panelfalt, appen: /** @type {any} */ (window).__panelTalk.slice(), meny: !!document.querySelector("[data-talk-val]"), panel: !!document.querySelector("section[data-skapa-panel]") }));
      const vantat = `${String(fore).slice(0, plats)} ${MENING}${String(fore).slice(plats)}`;
      v.matt.push(`${namn}, efter Klar: ${JSON.stringify(efter)}`);
      v.krav(efter.varde === vantat && efter.panel, `${namn}: efter Klar står ${JSON.stringify(efter.varde)} (panelen ${efter.panel ? "kvar" : "borta"}), väntat ${JSON.stringify(vantat)} med panelen kvar.`);
      v.krav(efter.appen.length === 0 && !efter.meny, `${namn}: ingenting får gå till appen och ingen meny ritas (${JSON.stringify(efter)}).`);
      if (v.bildmapp) await page.screenshot({ path: path.join(v.bildmapp, `talk-skapapanel-${vp.width}-efter-klar.png`) });

      // (4b) Det senaste fältet i panelen, utan fokus (0.232.0).
      await page.waitForFunction(() => !document.querySelector("[data-ops-talk]"), null, { timeout: 4000 });
      const fore2 = String(await page.evaluate(() => /** @type {any} */ (window).__panelfalt));
      await page.locator("[data-panelformular] textarea").click();
      await page.evaluate(() => {
        const ta = /** @type {HTMLTextAreaElement} */ (document.querySelector("[data-panelformular] textarea"));
        ta.setSelectionRange(0, 0);
        ta.blur();
      });
      const utanFokus = await page.evaluate(() => document.activeElement === document.querySelector("[data-panelformular] textarea"));
      v.krav(!utanFokus, `${namn} (4b): fältet har fortfarande fokus, provet mäter inte det senaste fältet.`);
      await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      await page.locator("[data-talk-samtalet]").waitFor({ timeout: 4000 });
      await page.waitForFunction((m) => (document.querySelector("[data-talk-text]")?.textContent || "").endsWith(m.split(" ").pop() || ""), MENING, { timeout: 4000 });
      const rad2 = await page.evaluate(() => document.querySelector("[data-talk-samtalet]")?.textContent ?? "");
      v.matt.push(`${namn} (4b), det senaste fältet: ${JSON.stringify(rad2)}`);
      v.krav(rad2.includes("Till fältet Beskrivning"), `${namn} (4b): raden säger ${JSON.stringify(rad2)}, väntat Till fältet Beskrivning.`);
      await page.locator("[data-talk-skicka]").click();
      await page.waitForFunction((f) => /** @type {any} */ (window).__panelfalt !== f, fore2, { timeout: 4000 });
      const varde2 = String(await page.evaluate(() => /** @type {any} */ (window).__panelfalt));
      v.krav(varde2 === `${MENING} ${fore2}`, `${namn} (4b): efter Klar står ${JSON.stringify(varde2)}, väntat ${JSON.stringify(`${MENING} ${fore2}`)}.`);
    } catch (e) {
      v.krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    await context?.close();
  }
}

/**
 * Ärendet i detalj (`OpsRadPanel`, modal) med TALK, (5) till (8).
 * @param {Verktyg} v
 */
async function radpanelen(v) {
  for (const vp of BREDDER) {
    const namn = `TALK ovanpå ärendet i detalj ${vp.width} px`;
    const telefon = vp.width < 768;
    /** @type {import("playwright").BrowserContext | null} */
    let context = null;
    try {
      const o = await v.oppna("talk-radpanel", vp, undefined, 1, "g3");
      context = o.context;
      const page = o.page;
      await page.getByRole("button", { name: /Ljudkoll inför spelningen/ }).first().click();
      await page.waitForSelector("[data-radpanel]", { timeout: 4000 });
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      const mic = telefon ? "nav[data-ops-bottenrad] [data-talk-knapp]" : "header [data-talk-huvud]";
      const geo = await page.evaluate(() => {
        const panel = /** @type {HTMLElement} */ (document.querySelector("[data-radpanel]")).getBoundingClientRect();
        const slojan = /** @type {HTMLElement | null} */ (document.querySelector('div.bg-scrim[data-state="open"]'));
        const s = slojan ? slojan.getBoundingClientRect() : null;
        const huvud = /** @type {HTMLElement} */ (document.querySelector("header")).getBoundingClientRect();
        const knapprad = /** @type {HTMLElement | null} */ (document.querySelector('[data-radpanel] [role="group"]'));
        const k = knapprad ? knapprad.getBoundingClientRect() : null;
        const lyft = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bottom-nav-overhang")) * 16 || 0;
        return { panelTopp: panel.top, panelBotten: panel.bottom, slojaTopp: s ? s.top : null, slojaBotten: s ? s.bottom : null, huvudBotten: huvud.bottom, knappradBotten: k ? k.bottom : null, lyft };
      });
      const knapp = await traff(page, mic);
      const rad = telefon ? await raden(page) : null;
      v.matt.push(`${namn}: ${JSON.stringify(geo)}, TALK ${JSON.stringify(knapp)}, raden ${rad ? rad.topp.toFixed(0) : "-"}, flikar ${rad ? JSON.stringify(rad.flikar) : "-"}`);
      v.krav(knapp !== null && geo.knappradBotten !== null && geo.slojaTopp !== null, `${namn}: TALK-knappen, panelens knapprad eller slöjan saknas (golv).`);
      if (!knapp) continue;
      if (telefon && rad) {
        v.krav(geo.panelBotten <= rad.topp - geo.lyft + 0.5 && geo.slojaBotten !== null && geo.slojaBotten <= rad.topp + 0.5, `${namn}: panelen slutar ${geo.panelBotten.toFixed(0)} och slöjan ${geo.slojaBotten}, väntat ovanför bottenraden (${rad.topp.toFixed(0)}, panelen också ovanför lyftet).`);
        v.krav(geo.knappradBotten !== null && geo.knappradBotten <= rad.topp - geo.lyft + 0.5, `${namn}: panelens knapprad slutar ${geo.knappradBotten}, väntat ovanför bottenraden och lyftet.`);
        v.krav(rad.flikar.length >= 3, `${namn}: ${rad.flikar.length} flikar i bottenraden, väntat minst 3 (golv).`);
        for (const f of rad.flikar) v.krav(!f.traffad && !f.fokus && f.inert && f.opacitet < 0.75, `${namn}: fliken ${JSON.stringify(f.namn)} går att trycka på eller fokusera, eller är inte dämpad (${JSON.stringify(f)}).`);
      } else {
        v.krav(geo.slojaTopp !== null && geo.slojaTopp >= geo.huvudBotten - 1.5 && geo.panelTopp >= geo.huvudBotten - 0.5, `${namn}: slöjan börjar ${geo.slojaTopp} och panelen ${geo.panelTopp.toFixed(0)}, väntat under huvudet (${geo.huvudBotten.toFixed(0)}).`);
      }
      v.krav(knapp.sjalv, `${namn}: mitt på TALK-knappen träffas ${knapp.traff}, väntat knappen. Panelen eller slöjan ligger över den.`);
      v.krav(!knapp.dold, `${namn}: TALK-knappen är aria-hidden medan panelen är öppen.`);
      if (v.bildmapp) await page.screenshot({ path: path.join(v.bildmapp, `talk-radpanel-${vp.width}-oppen.png`) });

      // Något i panelen har fokus, som när man Tabbat in i den: utan det har fokusfällan inget att dra tillbaka fokus till, och (7) mäter ingen fälla.
      await page.locator("[data-radpanel] button").first().focus();
      // (6) Ett tryck där knappen ritas.
      const r = await page.locator(mic).boundingBox();
      if (!r) throw new Error("TALK-knappen har ingen ruta");
      await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      await page.waitForTimeout(300);
      const efterTryck = await page.evaluate(() => ({ panel: !!document.querySelector("[data-radpanel]"), yta: !!document.querySelector("[data-ops-talk]"), gick: /** @type {any} */ (window).__gick.slice() }));
      v.matt.push(`${namn}, efter trycket på TALK: ${JSON.stringify(efterTryck)}`);
      v.krav(efterTryck.panel && efterTryck.yta, `${namn}: efter trycket på TALK är panelen ${efterTryck.panel ? "kvar" : "STÄNGD"} och TALK:s yta ${efterTryck.yta ? "öppen" : "INTE ÖPPEN"}.`);
      if (!efterTryck.yta) continue;
      await page.waitForFunction((m) => (document.querySelector("[data-talk-text]")?.textContent || "").endsWith(m.split(" ").pop() || ""), MENING, { timeout: 4000 });
      const yta = await traff(page, "[data-ops-talk] [data-talk-skicka]");
      v.krav(!!yta && yta.sjalv && !yta.dold, `${namn}: Klar i TALK:s yta träffas inte eller är aria-hidden (${JSON.stringify(yta)}).`);
      if (v.bildmapp) await page.screenshot({ path: path.join(v.bildmapp, `talk-radpanel-${vp.width}-pratar.png`) });

      // (7) Fokus och tangentbord: Klar tar fokus och behåller det (panelens fokusfälla vilar), och Enter på Klar ger valen.
      const fokus = await page.evaluate(async () => {
        const k = /** @type {HTMLElement} */ (document.querySelector("[data-ops-talk] [data-talk-skicka]"));
        k.focus();
        await new Promise((res) => setTimeout(res, 100));
        return { klar: document.activeElement === k, aktiv: document.activeElement ? `${document.activeElement.tagName.toLowerCase()} ${(document.activeElement.textContent || "").trim().slice(0, 30)}` : null };
      });
      v.krav(fokus.klar, `${namn}: Klar tar inte fokus ovanpå panelen, fokus står på ${fokus.aktiv}. Panelens fokusfälla drog tillbaka det.`);
      await page.keyboard.press("Enter");
      await page.locator("[data-talk-val]").waitFor({ timeout: 4000 }).catch(() => {});
      const val = await page.evaluate(() => ({ val: !!document.querySelector("[data-talk-val]"), panel: !!document.querySelector("[data-radpanel]"), fokusIYtan: !!document.activeElement?.closest("[data-ops-talk]") }));
      v.matt.push(`${namn}, Enter på Klar: ${JSON.stringify(val)}`);
      v.krav(val.val && val.panel && val.fokusIYtan, `${namn}: Enter på Klar gav ${JSON.stringify(val)}, väntat valen med fokus i TALK:s yta och panelen kvar.`);
      if (v.bildmapp) await page.screenshot({ path: path.join(v.bildmapp, `talk-radpanel-${vp.width}-valen.png`) });
    } catch (e) {
      v.krav(false, `${namn}: provet avbröts (${String(/** @type {Error} */ (e).message).split("\n")[0]}).`);
    }
    await context?.close();
  }
}

/**
 * Avsnitt 67, hela.
 * @param {Verktyg} v
 */
export async function talkPaneler(v) {
  await skapapanelen(v);
  await radpanelen(v);
}
