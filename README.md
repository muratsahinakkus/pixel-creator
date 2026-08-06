# Pixel Creator

Crayon Club'ın çocuklar için pixel boyama özelliğinin **ilk taslaklarını** hızlıca çıkarmak
için yapılmış, tarayıcıda çalışan bir pixel art editörü.

Build adımı yok, bağımlılık yok, backend yok — sadece statik dosyalar.

---

## Çalıştırma

ES modülleri kullandığı için dosyayı doğrudan çift tıklayarak (`file://`) açmak yerine
küçük bir yerel sunucu üzerinden açmak gerekiyor:

```bash
python3 -m http.server 4173
```

Sonra tarayıcıda `http://localhost:4173` adresine git.

## Takımla paylaşma (GitHub Pages)

```bash
git init && git add . && git commit -m "Pixel Creator"
gh repo create otsimo/pixel-creator --private --source=. --push
```

Ardından repo ayarlarından **Settings → Pages → Branch: main / root** seç.
Birkaç dakika içinde `https://<org>.github.io/pixel-creator/` adresi hazır olur;
takım arkadaşların linke girer, kurulum yapmaz.

> Netlify / Vercel / iç sunucu da aynı şekilde çalışır: klasörü olduğu gibi yayınlaman yeterli.

---

## Kullanım

### Tuval
Açılışta **12×12, 16×16, 20×20, 21×21** arasından seçim yaparsın. 21×21 gibi tek sayılı
boyutlarda tam ortada bir piksel bulunur, simetri modu buna göre çalışır.

### Araçlar

| Araç | Kısayol | Not |
|---|---|---|
| Kalem | `B` | |
| Silgi | `E` | |
| Kova (flood fill) | `G` | Simetri açıkken ayna tarafını da doldurur |
| Pipet | `I` | Çizerken `Alt` basılı tutmak da pipete geçirir |
| Çizgi | `L` | `Shift`: 45° kilit |
| Dikdörtgen | `R` | `Shift`: kare · `Alt`: dolu |
| Elips | `O` | `Shift`: daire · `Alt`: dolu |
| Seçim & taşı | `M` | Seçip içinden sürükle · `Delete`: sil · `Enter`: seçili renkle doldur |
| Kaydır | `H` | `Space` basılı tutmak veya orta tık da çalışır |
| Tuvali temizle | `Shift+Delete` | Araç çubuğunun en altında, ayrı duran çöp kutusu · `Ctrl+Z` ile geri alınır |

Diğer kısayollar: `Ctrl+Z` / `Ctrl+Shift+Z` geri–ileri · `Ctrl+S` proje kaydet ·
`Ctrl+N` yeni · `Ctrl+G` ızgara · `Shift+H` / `Shift+V` simetri ·
`0` ekrana sığdır · `+` / `−` zoom · tekerlek ile zoom.

### Renk seçimi

Üç yol var, üçü de aynı "aktif renge" bağlı:

1. **Sağ tık → halka menü.** Tuvalde sağ tıkla, imlecin etrafında son kullandığın ve
   paletteki renklerden bir halka açılır. İki türlü kullanılır:
   sağ tuşu basılı tutup rengin üstüne gelip bırakmak, ya da kısa basıp halka
   açık kalınca renge tıklamak.
2. **HSV çarkı.** Dış halka ton, iç kare doygunluk/parlaklık.
3. **HEX kutusu.** `#RRGGBB` veya `#RGB` yazıp Enter.

Palette tıklamak rengi seçer, sağ tıklamak paletten çıkarır. "Palete ekle" ile aktif
rengi kalıcı hale getirirsin; palet tarayıcıda saklanır.

### Renk sayacı

Sağ üstteki rozet, tasarımda kaç **farklı** renk olduğunu gösterir. Sağ paneldeki
"Bu tasarımda" listesi her rengi kullanım oranıyla sıralar.

Limiti (varsayılan 12) aşınca rozet kırmızıya döner ve bir uyarı çıkar. Sebebi:
boyama sayfasında her renk, çocuğun ekranda seçmesi gereken ayrı bir kalem demek.
Paleti dar tutmak 2–7 yaş için doğrudan kullanılabilirlik meselesi.

**Renk birleştirme:** listede bir rengin üstüne tıklarsan o rengin tüm pikselleri
aktif renge dönüşür. Bir tasarımı 14 renkten 9 renge indirmenin en hızlı yolu bu.
Beğenmezsen `Ctrl+Z`.

### Görselden başlama

Üstteki **Görselden** düğmesi ya da bir PNG/JPG'yi pencereye sürükle-bırak.
Açılan önizlemede:

- **Renk sayısı** — kaç renge indirgensin (2–16).
- **Düz renkleri koru** — açık: her hücrenin baskın rengi alınır, kenar yumuşatmasından
  gelen ara tonlar elenir. Çizim/illüstrasyon kaynakları için bunu açık bırak.
  Kapalı: hücre ortalaması alınır, fotoğraflarda daha iyi sonuç verir.
- **Kırparak doldur** — kapalıyken görselin tamamı sığdırılır, açıkken tuval doldurulur.
- **Beyaz/açık arka planı şeffaf yap** — beyaz zeminli referansları temizler.

### Kaydetme ve dışa aktarma

- **Otomatik kayıt.** Çalışman tarayıcının yerel deposuna yazılır; sekmeyi kazara
  kapatırsan bir sonraki açılışta kaldığın yerden devam eder. Bu bir arşiv değil,
  kaza korumasıdır — bilgisayar/tarayıcı değişince gitmez, gelmez.
- **Kaydet / Aç.** `.json` proje dosyası (pikseller + palet). Paylaşmak, versiyonlamak
  ve repoya koymak için bunu kullan. Sürükle-bırak ile de açılır.
- **SVG indir.** Her piksel ayrı bir `<rect>` olarak çıkar, `viewBox` piksel birimindedir.
  Figma'ya sürüklediğinde her kare ayrı obje olur ve her ölçekte keskin kalır.
- **PNG.** Aynı tasarımın 32× büyütülmüş, nearest-neighbor PNG'si — Slack/sunum için.

---

## Dosya yapısı

```
index.html
css/styles.css
js/
  main.js         başlangıç ve modüllerin bağlanması
  store.js        belge modeli, palet, geri/ileri al
  render.js       tuval çizimi, zoom/pan, koordinat dönüşümü
  tools.js        araçlar ve fare/kalem etkileşimi
  radial.js       sağ tık renk halkası
  colorpanel.js   HSV çarkı, hex girişi, palet, renk sayacı
  importer.js     görselden pikselize + renk indirgeme
  exporters.js    SVG / PNG / .json
  storage.js      localStorage otomatik kayıt
  color.js        renk dönüşümleri
  modal.js        modal ve bildirimler
```

Durum tek yerde (`store.js`) tutulur, değişiklikler basit bir olay veriyoluyla
yayılır. Yeni bir araç eklemek için `tools.js` içindeki `onDown`/`onMove`'a bir dal,
`index.html`'e bir düğme ve `ui.js`'teki `TOOL_KEYS`'e bir kısayol eklemek yeterli.

## Bilinçli olarak yapılmayanlar

Bunlar v1 kapsamı dışında bırakıldı; ihtiyaç olursa eklenebilir:
katmanlar, animasyon/frame'ler, ortak (takım) depo, sprite sheet export,
sabit marka paleti zorunluluğu.
