# Så skickar en app in sin navigering (v0.2.0)

Från v0.2.0 renderar `OpsAppShell` en **bottennavigering** under `md` och en
topprad på `md+`, båda ur samma `nav`-data. Appen skickar in listan; ramverket
vet aldrig vilka destinationer en plattform har.

## Kontraktet

```js
nav: {
  href: string,
  label: string,
  icon?: ReactNode,   // krävs i praktiken för bottenraden — utan ikon blir platsen bara text
  badge?: number,     // oläst, att göra, vad appen nu räknar
  children?: { href, label }[],   // EN nivå, aldrig fler (kastar annars vid render)
}[]
```

`{ href, label }` ensamt fungerar oförändrat (bakåtkompatibelt). `icon`, `badge`
och `children` är valfria tillägg.

## Vad appen bestämmer, och vad ramverket gör

- **Ordningen är appens beslut.** De **fyra första** posterna hamnar i
  bottenraden, resten i Meny-sheeten. Ingen "smart" prioritering, ingen historik.
- **Meny** ligger alltid sist i raden och öppnar resten i en sheet. Sheeten visar
  hela navet: avsnitt med `children` som rubrik plus sina undersidor.
- **Aktiv markering** härleds ur `activeHref`. En post markeras även när en av dess
  `children` är aktiv, så att ett avsnitt markeras på sina undersidor.
- **`onNavigate(href, event)`** anropas i stället för webbläsarens navigering, precis
  som för toppraden. Länkarna är riktiga `<a href>` så delning och ny flik fungerar.

## Exempel

```jsx
import { HemIkon, PengarIkon } from "./ikoner";   // appen väljer sin ikonuppsättning (t.ex. Lucide)

const SIDOR = [
  { href: "/", label: "Översikt", icon: <HemIkon /> },
  { href: "/inkomster", label: "Inkomster", icon: <PengarIkon />, badge: antalOlästa },
  {
    href: "/kostnader",
    label: "Kostnader",
    icon: <KortIkon />,
    children: [
      { href: "/kostnader?flik=foretag", label: "Företag" },
      { href: "/kostnader?flik=privat", label: "Privat" },
    ],
  },
  { href: "/tillgangar", label: "Tillgångar", icon: <BankIkon /> },
  { href: "/pension", label: "Pension", icon: <PensionIkon /> },
];

<OpsAppShell brand="Operations Hub" nav={SIDOR} activeHref={pathname} onNavigate={navigera} actions={<OpsThemeToggle />}>
  {vyer}
</OpsAppShell>
```

## Ikoner

Ramverket tar inget ikonberoende. Appen skickar in sina egna ikon-noder i `icon`.
Utan ikon får bottenraden bara text, vilket är sämre men inte trasigt.

## Badge och skärmläsare

`badge` är ett tal. Det renderas synligt och med skärmläsartext. Ordet efter
siffran (`nya` som standard) sätts med `badgeText` på `OpsBottomNav` när appen
räknar något annat, t.ex. `badgeText="olästa"` eller `badgeText="att göra"`.

## Det som inte behöver göras längre

Appens egen mobilmeny runt skalet kan tas bort. Två mobila menyer parallellt är
två sanningar. Skalets bottenrad + sheet ersätter den helt.
