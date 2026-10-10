# BAŞLA — Bu klasörle ne yapacaksın?

Bu klasör "Rota" uygulamasının başlangıç paketidir. Claude Code bu dosyaları okuyarak ne yapacağını anlar.

## Klasör yapısı

```
rota/
├── BASLA.md                  ← şu an okuduğun dosya (senin için)
├── CLAUDE.md                 ← Claude Code her oturumda bunu otomatik okur
├── TASKS.md                  ← ilerleme listesi (Claude Code işaretler)
├── .env.example              ← API anahtarları şablonu
├── docs/                     ← Claude Code'un referans dokümanları
│   ├── 01-urun-ve-ozellikler.md
│   ├── 02-ekranlar-ve-akislar.md
│   ├── 03-teknik-mimari.md
│   ├── 04-veri-modeli.md
│   └── 05-yol-haritasi-ve-riskler.md
├── design/
│   └── stitch/               ← Stitch'ten dışa aktardığın HTML'leri buraya koy
└── prompts/
    ├── stitch/               ← Google Stitch'e yapıştıracağın promptlar (00–05)
    └── claude-code/          ← Claude Code'a sırayla vereceğin promptlar
```

## Adım adım

### 1. Kurulum (bir kez, ~45 dk)
`docs/05-yol-haritasi-ve-riskler.md` içindeki "Windows kurulumu" bölümünü takip et: Node.js, Git, Claude Code, Expo hesabı, Supabase, Mapbox, OpenRouteService.

### 2. Tasarım (Google Stitch)
1. stitch.withgoogle.com → **App** modu.
2. `prompts/stitch/00-tasarim-sistemi-ana-harita.md` içindeki promptu yapıştır. Beğenene kadar düzelt.
3. Aynı projede sırayla 01 → 05 promptlarını ver.
4. Ekranları HTML olarak dışa aktar, `design/stitch/` içine koy. Stitch'in `DESIGN.md` dosyasını da oraya kaydet.
   Dosya adları önerisi: `home-map.html`, `wizard.html`, `results-live-summary.html`, `explore-detail-review.html`, `feed-profile-courses.html`, `onboarding.html`.

### 3. Geliştirme (Claude Code)
1. `.env.example` dosyasını `.env` olarak kopyala ve anahtarlarını yaz.
2. Bu klasörde terminal aç, `claude` yaz.
3. `prompts/claude-code/` içindeki dosyaları **sırayla** aç, içindeki promptu Claude Code'a yapıştır:
   - `P0.1` → çalıştır, telefonda test et → commit
   - `P0.2` → ... ve devam
4. Her adımdan sonra `npx expo start` ile telefonda dene.
5. Takıldığında Claude Code'a şunu yaz: *"TASKS.md'ye bak, nerede kaldık, sıradaki adım ne?"*

### İpuçları
- Büyük adımlarda önce **plan modu** (Shift+Tab) kullan, planı onayla, sonra kod yazdır.
- Bir adım bozulursa: *"Son commit'e göre neyi değiştirdin, hatayı bul ve düzelt"* de.
- Her fazın sonunda `P1.8-kontrol.md` tipi gözden geçirme promptunu tekrar kullanabilirsin.
