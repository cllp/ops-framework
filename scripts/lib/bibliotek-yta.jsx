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

// Författaren till alla tre posterna, och en annan medlem som ser länken i läsläge.
const FORFATTARE = { uid: "uid-1", roll: "medlem" };
const ANNAN = { uid: "uid-2", roll: "medlem" };

function Yta() {
  const [vald, setVald] = useState(null);
  const [skapar, setSkapar] = useState(null);
  const start = window.__bibliotek || "lista";
  const valdPost = start === "detalj" ? poster[0] : start === "lank" ? poster[1] : vald;
  const skaparTyp = start === "ny" ? "lank" : skapar;
  return (
    <Ops.OpsBibliotek
      poster={poster}
      jag={start === "lank" ? ANNAN : FORFATTARE}
      vald={valdPost}
      skapar={skaparTyp}
      onOppna={(p) => { setSkapar(null); setVald(p); }}
      onStang={() => { setVald(null); setSkapar(null); }}
      onSkapa={(typ) => { setVald(null); setSkapar(typ); }}
      onSpara={() => {}}
    />
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
