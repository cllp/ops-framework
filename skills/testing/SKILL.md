---
name: testing
description: Vad vi testar och vad vi inte testar. Beteende framför klassnamn, golv mot tom indata, och gränsen mot vakterna. Ladda innan du skriver eller ändrar ett test.
---

# Tester

## ⛔ Testa beteende, aldrig klassnamn

Ett test som påstår att knappen har klassen `bg-accent` går sönder varje gång
någon byter en utility och säger **ingenting** om huruvida knappen fungerar. Det
ser ut som täckning och är underhållskostnad.

Att utseendet faktiskt blir CSS är byggvaktens jobb
(`scripts/check-css-build.mjs`), inte enhetstesternas. Håll isär de två
frågorna: *fungerar det* och *ser det rätt ut*.

Testa i stället:

```jsx
screen.getByRole("button", { name: "Spara" })   // finns knappen och heter den rätt
expect(lank).not.toHaveAttribute("href")        // är den spärrade länken verkligen spärrad
expect(falt).toHaveAttribute("aria-invalid")    // annonseras felet
```

Roller och tillgängliga namn testar dessutom tillgänglighet på köpet. En
`getByTestId` bevisar bara att du satte ett testid.

## Röktestet är inte trivialt

Ett test som bara renderar appen och letar efter rubriken ser meningslöst ut och
är det enda som fångar de två fel som gör en nyuppsatt app obrukbar, och vars
felmeddelanden pekar långt från sin orsak:

1. **Två kopior av React.** Varje hook kastar `invalid hook call`.
2. **Ramverkets bundle går inte att importera.**

Båda är uppsättningsfel, inte kodfel, och båda hittas billigast där.

## Golv, överallt

En svit som blir grön av att den inte hittade några filer är den vanligaste
falska grönheten vi har. Samma sak gäller en vakt som läste noll filer och ett
bygge som producerade noll tecken CSS.

Varje kontroll i ramverket har därför ett uttalat golv, och golvet är själv
prövat i `test-guards.mjs`.

## Pröva det som ska stoppas, inte bara det som ska fungera

`check-css-build.mjs` lägger **med flit** in `bg-red-500` i sitt underlag och
kräver att klassen inte hamnar i utdata. En vakt som bara matas med giltig indata
bevisar aldrig att något är stoppat.

Samma princip i enhetstester: testa att `OpsListRow interactive` utan handler
**kastar**, inte bara att den med handler fungerar.

## Förväntade kraschar ska inte dränka utskriften

React loggar varje kastad render till `console.error`, även den du väntar dig.
Utan en liten hjälpare som tystar just den dränks testutskriften i stackspår från
tester som gick bra, och **en oläslig utskrift är precis hur ett riktigt fel
slinker igenom**.

```js
function forvantaKrasch(kor, meddelande) {
  const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
  try { expect(kor).toThrow(meddelande); } finally { tyst.mockRestore(); }
}
```

## jsdom saknar det Radix behöver

Modaler och väljare kraschar i jsdom utan stubbar för `ResizeObserver` och
pointer capture. De ligger i `setupTests.js`. Kraschen säger ingenting om koden
du testar, så låt den inte finnas.

## Gränsen mot vakterna

| Fråga | Svaras av |
|---|---|
| Fungerar komponenten? | enhetstest |
| Genereras CSS:en? | `check-css-build.mjs` |
| Är API:et stängt? | `check-closed-api.mjs` |
| Följer appens stilrot kontraktet? | `check-token-overrides.mjs` |
| Går en nyskapad app att köra? | `check-scaffold.mjs` |
| Går vakterna att göra röda? | `test-guards.mjs` |

Skriv aldrig ett enhetstest för något en vakt redan svarar på. Då har du två
sanningar som ska underhållas, och den ena kommer att slås av.
