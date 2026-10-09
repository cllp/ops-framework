import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

const tid = 1700000000000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };

const poster = [
  { ...Ops.byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade om bokslutet.", skapadAv: skapare, skapad: tid, andrad: tid + 2 }), id: "a" },
  { ...Ops.byggPost({ groupId: "cps-ab", typ: "lank", rubrik: "Bolagsverket", url: "https://bolagsverket.se", skapadAv: skapare, skapad: tid, andrad: tid + 1 }), id: "b" },
  { ...Ops.byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Mötesanteckning", text: "Nästa möte är på torsdag.", skapadAv: skapare, skapad: tid, andrad: tid }), id: "c" },
];

const BILD = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#c4a574"/><text x="16" y="68" font-size="20" fill="#1c1915">Kvitto</text></svg>')}`;

function filPost(id, rubrik, filfalt, extra = {}) {
  return { ...Ops.byggPost({ groupId: "cps-ab", typ: "fil", rubrik, fil: filfalt, skapadAv: skapare, skapad: tid, andrad: tid, ...extra }), id };
}

const bildPost = filPost("bild", "Kvitto", { sokvag: "grupper/cps-ab/bibliotek/bild/kvitto.jpg", namn: "kvitto.jpg", mime: "image/jpeg", byte: 2411724 });
const bild2 = filPost("bild2", "Hylla", { sokvag: "grupper/cps-ab/bibliotek/bild/hylla.png", namn: "hylla.png", mime: "image/png", byte: 6501171 });
const ljudPost = filPost("ljud", "Idé 2026-10-08 21:05", { sokvag: "grupper/my/bibliotek/ljud/ide.webm", namn: "ide.webm", mime: "audio/webm", byte: 882688 }, { utskrift: "Vi tar upp hyllan i nästa möte." });
const ljud2 = filPost("ljud2", "R jazz", { sokvag: "grupper/my/bibliotek/ljud/rjazz.webm", namn: "rjazz.webm", mime: "audio/webm", byte: 862 * 1024 });
const pdfPost = filPost("pdf", "Inbetalningskort", { sokvag: "grupper/cps-ab/bibliotek/pdf/kort.pdf", namn: "inbetalningskort.pdf", mime: "application/pdf", byte: 244 * 1024 });
const pdf2 = filPost("pdf2", "Presskit", { sokvag: "grupper/cps-ab/bibliotek/pdf/press.pdf", namn: "presskit.pdf", mime: "application/pdf", byte: 1005 * 1024 });

const SKIVPOSTER = {
  alla: [poster[0], poster[1], ljudPost, bildPost, pdfPost],
  inspelningar: [ljudPost, ljud2],
  bilder: [bildPost, bild2],
  dokument: [pdfPost, pdf2],
  bild: [bildPost],
  utskrift: [ljudPost],
};

function filUrl(post) {
  if (String(post.fil?.mime || "").startsWith("image/")) return BILD;
  return `https://exempel.se/${post.fil?.sokvag || "fil"}`;
}

// Författaren till alla tre posterna, och en annan medlem som ser länken i läsläge.
const FORFATTARE = { uid: "uid-1", roll: "medlem" };
const ANNAN = { uid: "uid-2", roll: "medlem" };

function Yta() {
  const [vald, setVald] = useState(null);
  const [skapar, setSkapar] = useState(null);
  const start = window.__bibliotek || "lista";
  if (start === "plus") {
    return (
      <Ops.OpsAppShell brand="LifeHub" nav={[{ href: "/", label: "Start" }]} activeHref="/" skapa={{ spelaIn: () => {} }}>
        <p>Bibliotek</p>
      </Ops.OpsAppShell>
    );
  }
  const skiva = Object.hasOwn(SKIVPOSTER, start);
  const lasPost = { ...poster[0], text: "Vi **beslutade** om bokslutet.\n\nNästa steg står i [protokollet](https://bolagsverket.se)." };
  const valdPost = start === "las" ? lasPost : start === "detalj" ? poster[0] : start === "lank" ? poster[1] : start === "bild" ? bildPost : start === "utskrift" ? ljudPost : vald;
  const skaparTyp = start === "ny" ? "lank" : skapar;
  return (
    <Ops.OpsBibliotek
      poster={skiva ? SKIVPOSTER[start] : poster}
      jag={start === "lank" ? ANNAN : FORFATTARE}
      vald={valdPost}
      skapar={skaparTyp}
      onOppna={(p) => { setSkapar(null); setVald(p); }}
      onStang={() => { setVald(null); setSkapar(null); }}
      onSkapa={(typ) => { setVald(null); setSkapar(typ); }}
      onSpara={() => {}}
      onRadera={() => {}}
      filUrl={skiva ? filUrl : undefined}
      grupper={start === "utskrift" ? [{ id: "miranda-ab", namn: "Miranda" }] : []}
      onDela={() => {}}
      onSkrivUt={start === "utskrift" ? async () => ({ text: "Vi tar upp hyllan i nästa möte.", forslag: "anteckning" }) : undefined}
      onGorForslag={() => {}}
      hubHref="/hub"
      onNavigate={(_href, e) => e.preventDefault()}
    />
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
