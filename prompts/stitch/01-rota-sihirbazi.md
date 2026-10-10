# Stitch Prompt 1 — Rota Sihirbazı (4 ekran)

**Dışa aktarınca kaydet:** `design/stitch/wizard.html`

```text
Using the same Rota design system, design a 4-step route creation wizard. Each screen has a top progress bar (step X of 6), back arrow, big friendly question title, and a sticky bottom primary button "Devam". Turkish text.

Screen 1 "Ne yapmak istiyorsun?": three large selectable cards with illustrations: Yürüyüş, Koşu, Bisiklet. Below, a segmented control for route type: "Dönüşlü" (loop icon), "A → B", "Git-dön".

Screen 2 "Ne kadar süre?": toggle between "Süre" and "Mesafe". Large circular dial or big number picker showing "1 sa 00 dk", quick chips "30 dk", "45 dk", "1 sa", "1,5 sa". Helper text "≈ 4,8 km yürüyüş".

Screen 3 "Nasıl bir manzara?": multi-select image tiles: Sahil, Park & Yeşil, Tarihi Doku, Fark etmez. Then "Eğim tercihin" with three options showing tiny elevation icons: "Düz", "Biraz eğim olabilir", "Yokuş antrenmanı".

Screen 4 "Ekstra tercihler": list of toggle rows with icons and short descriptions: Trafikten uzak dur, Aydınlık ve kalabalık yollar, Mola noktaları (çeşme, tuvalet, kafe), Bitişte toplu taşıma öner, Köpekle yürüyüş, Bebek arabası uygun. Zemin selector chips: Asfalt, Toprak, Fark etmez. Bottom button "Rotaları Oluştur".
```

Not: Başlangıç noktası seçimi (adım 3) için ayrı ekran istersen:
`Add a screen "Nereden başlıyorsun?" with a map, a center pin, "Mevcut konumum" button, and for A → B mode a second field "Nereye?"`
