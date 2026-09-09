# Pixel Creator

**Aç ve kullan → https://muratsahinakkus.github.io/pixel-creator/**

Tarayıcıda çalışan bir pixel art editörü. Crayon Club'ın çocuklar için pixel boyama
özelliğinin ilk taslaklarını hızlıca çıkarmak için yapıldı.

Kurulum yok, hesap yok, indirilecek bir şey yok. Linke girersin, çizersin, indirirsin.

---

## İlk iki dakika

1. Linke gir. Açılışta tuval boyutunu sorar → **16 × 16** ile başla.
2. Sağ paneldeki paletten bir renk seç.
3. Tuvale tıklayarak boya. Basılı tutup sürükleyerek çizgi çekebilirsin.
4. Yanlış yaptıysan **Ctrl+Z**.
5. Bitince üstteki **SVG indir**'e bas, dosya adını yaz, indir.

Hepsi bu. Aşağısı detay.

---

## Tuval

Açılışta **12×12, 16×16, 20×20, 21×21** arasından seçersin. 21×21 gibi tek sayılı
boyutlarda tam ortada bir piksel bulunur; simetri modu buna göre çalışır.

Sonradan boyut değiştirmek için üstteki **Yeni**'ye bas. Açık olan çalışman kapanır,
o yüzden saklamak istiyorsan önce **Kaydet** de.

Tuvalin arka planındaki dama deseni "burada piksel yok" demektir, gerçek bir renk değil.

---

## Araçlar

Sol taraftaki dikey çubukta. Parantez içindeki harf klavye kısayolu.

| Araç | Kısayol | Ne yapar |
|---|---|---|
| Kalem | `B` | Boyar. Sürükleyerek çizgi çeker. |
| Silgi | `E` | Pikseli boşaltır. |
| Kova | `G` | Aynı renkteki **bitişik** alanı doldurur. |
| Pipet | `I` | Tuvaldeki bir rengi seçili renk yapar. Hücre boşsa arkadaki referans görselden alır. |
| Çizgi | `L` | `Shift`: 45° kilitli. |
| Dikdörtgen | `R` | `Shift`: kare · `Alt`: içi dolu. |
| Elips | `O` | `Shift`: daire · `Alt`: içi dolu. |
| Seçim & taşı | `M` | Dikdörtgen seç, içinden sürükleyerek taşı. |
| Aynı rengi seç | `W` | Bir piksele tıkla → tuvaldeki **tüm** aynı renkli pikseller seçilir. |
| Kaydır | `H` | Tuvali sürükler. |
| Referans taşı | `K` | Arkadaki referans görseli taşır/ölçekler. |
| **Temizle** | `Shift+Delete` | Çubuğun en altındaki çöp kutusu. Tuvali boşaltır. |

Kısa yollar:

- Çizerken **`Alt`** basılı tutmak geçici olarak pipete çevirir — araç değiştirmeye gerek yok.
- **`Space`** basılı tutmak (veya orta tık) her araçta tuvali kaydırır.
- **Fare tekerleği** yakınlaştırır.

### Seçimle ne yapılır

Bir şey seçtiğinde alt çubukta `N piksel seçili · Boya · Sil · ✕` çıkar.

- **Boya** (`Enter`) — seçili pikselleri o anki renge çevirir
- **Sil** (`Delete`) — seçili pikselleri boşaltır
- **✕** (`Esc`) — seçimi bırakır

---

## Renk seçme

Üç yol var, üçü de aynı "seçili renge" bağlı:

**1. Sağ tık → renk halkası.** Tuvalde sağ tıkla; imlecin etrafında son kullandığın
ve paletteki renklerden bir halka açılır. İki türlü kullanılır: sağ tuşu basılı tutup
rengin üstüne gelip bırakmak, ya da kısa basıp halka açık kalınca renge tıklamak.
Çizerken elini tuvaldan ayırmadığın için en hızlısı bu.

**2. Renk çarkı.** Sağ panelde. Dış halka ton, iç kare doygunluk/parlaklık.

**3. HEX kutusu.** `#FF6B4A` yazıp Enter. `#F64` gibi kısa hâli de kabul eder.

**Palet:** Bir renge tıkla → seçilir. Sağ tıkla → paletten çıkar. **Palete ekle** ile
o anki rengi kalıcı hâle getirirsin. **sıfırla** varsayılan palete döner. Palet
tarayıcında saklanır, sonraki açılışta yerinde durur.

---

## Renk sayısı (önemli)

Sağ üstteki rozet, tasarımda kaç **farklı** renk olduğunu gösterir. Sağ panelde
"Bu tasarımda" listesi her rengi kullanım oranıyla sıralar.

Limiti (varsayılan **12**) aşarsan rozet kırmızıya döner. Sebebi şu: boyama
sayfasında her renk, çocuğun ekranda ayrıca seçmesi gereken bir kalem demek.
Paleti dar tutmak 2–7 yaş için doğrudan kullanılabilirlik meselesi.

**Renk birleştirmenin en hızlı yolu:** listede bir rengin üstüne tıkla → o rengin
bütün pikselleri seçili renge dönüşür. 14 renkten 9 renge inmek birkaç tık.
Beğenmezsen `Ctrl+Z`.

---

## Simetri ve ızgara

Araç çubuğunun altındaki üç mavi düğme:

- **Yatay simetri** (`Shift+H`) — bir tarafı çizersin, öteki taraf kendiliğinden oluşur
- **Dikey simetri** (`Shift+V`)
- **Izgara** (`Ctrl+G`) — ızgara çizgilerini gösterir/gizler

Simetri açıkken tuvalde kesikli mavi bir eksen görürsün. Kova aracı da simetriye uyar.

---

## Arkaya referans görsel

Üzerinden çizmek için tuvalin arkasına bir görsel koyabilirsin.

Sağ panelde **Referans** bölümü → **Görsel seç**. Sonra:

- **Saydamlık** — ne kadar belirgin görünsün
- **Ölçek % / X / Y** — rakamla ince ayar
- **Gizle / Göster** — çizdiğinle karşılaştırmak için
- **Sığdır** — tuvale ortalayıp sığdırır
- **kaldır** — referansı siler

Kabaca konumlandırmak için araç çubuğundan **referans aracına** (`K`) geç: tuvalde
sürükleyerek taşı, tekerlekle büyüt/küçült.

Görsel piksellerin **altında** durur; boyadıkça altında kalır. Dışa aktardığın
dosyalara karışmaz. Proje dosyasına (`.json`) gömülür, yani projeyi birine
yollarsan referans da gider.

**Pipetle referanstan renk alma.** Pipet (`I`) boş bir hücreye tıkladığında
arkadaki referans görselin o noktadaki rengini alır. Renk **her zaman orijinal,
%100 opak hâliyle** gelir — saydamlığı %10'a düşürmüş olsan bile aldığın renk
tam güçtedir. Hücre boyalıysa kendi pikselinin rengi gelir; referansı yeniden
örneklemek için o hücreyi silmen gerekir. Görsel gizliyken pipet ondan renk almaz.

---

## Görselden başlama

Bir görseli pikselleştirip başlangıç noktası yapmak için: üstteki **Görselden**
düğmesi, ya da görseli doğrudan pencereye sürükle-bırak.

Açılan pencerede kaynağı ve sonucu yan yana görürsün. Ayarlar:

| Ayar | Ne işe yarar |
|---|---|
| **Renk sayısı** | Kaç renge indirgensin (2–16) |
| **Düz renkleri koru** | Açık: her hücrenin baskın rengi alınır, kenar yumuşatmasından gelen ara tonlar elenir. Çizim ve illüstrasyonlarda açık bırak. Kapalı: hücre ortalaması alınır, fotoğraflarda daha iyi. |
| **Kırparak doldur** | Açık: görsel tuvali dolduracak şekilde kırpılır. Kapalı: görselin tamamı sığdırılır, kenarlarda boşluk kalabilir. |
| **Beyaz/açık arka planı şeffaf yap** | Beyaz zeminli referansları temizler. |

> **Zaten piksel olan bir görselden başlıyorsan** tuval boyutunu o görselin kendi
> ızgarasıyla aynı seç. Örneğin 19×20'lik bir tasarımı 21×21 tuvale alırsan hücreler
> sınırlara biner ve ince ayrıntılar kayar — bu kaçınılmazdır, ölçekten gelir.
> Izgara uyuşuyorsa sonuç birebir çıkar.

---

## Mevcut dosyaları açma

Üstteki **Aç** düğmesi iki tür dosya kabul eder (sürükle-bırak da çalışır):

- **`.json`** — Pixel Creator proje dosyası
- **`.svg`** — daha önce indirilmiş bir SVG, ya da Figma'da düzenlenip yeniden
  export edilmiş hâli

SVG açarken ızgara dosyadan otomatik çıkarılır; kare boyutunu veya tuvali önceden
ayarlamana gerek yok. Dosya düzgün bir ızgaraya oturmuyorsa tool sessizce yaklaşık
bir şey üretmez, sebebini söyler.

> **Elinizdeki pixel art kütüphanesinden çalışıyorsan PNG değil SVG'yi aç.**
> PNG dosyalarında `Display P3` renk profili var; tarayıcı bunu sRGB'ye çevirdiği
> için renkler 10–20 birim kayıyor (`#CC5458` → `#DD4954` gibi). SVG hem ızgarayı
> hem hex değerlerini tam verir.

Bir SVG açtıktan sonra **SVG indir**'e bastığında indirme kutusu aynı dosya adıyla
açılır — versiyon üstüne çalışmak kolay olsun diye.

---

## Kaydetme

**Otomatik kayıt.** Çalışman tarayıcının yerel deposuna yazılır. Sekmeyi kazara
kapatırsan bir sonraki açılışta kaldığın yerden devam edersin.

Bu bir **arşiv değil, kaza korumasıdır**: sadece o tarayıcıda, o bilgisayarda durur.
Başka birine gitmez, başka makineden erişilmez, tarayıcı verisini temizlersen gider.

**Saklamak istediğin her şeyi `Kaydet` ile indir.** `Ctrl+S` de aynı işi yapar.
Çıkan `.json` dosyası pikselleri, paleti ve referans görseli içerir — paylaşmak,
versiyonlamak ve arşivlemek için bunu kullan.

---

## Dışa aktarma

Üstte dört düğme var. Hepsi önce dosya adını sorar.

| Düğme | Ne verir |
|---|---|
| **SVG indir** | Her piksel ayrı bir kare. Ana çıktı budur. |
| **PNG** | 32× büyütülmüş görsel. Slack, sunum, hızlı önizleme için. |
| **Aralıklı SVG** | Kareler arasında 4px boşluk. |
| **Aralıklı PNG** | Aynısının PNG'si. |

**SVG hakkında bilmen gerekenler:**

- Her hücre ayrı bir `<rect>`. Figma'ya sürüklediğinde her kare ayrı obje olur.
- Boyanmamış hücreler **`#E6E6E6` gri** olarak çıkar; Figma'da üstüne tıklayıp
  boyayabilirsin.
- `viewBox` piksel birimindedir, yani her ölçekte keskin kalır.

> ⚠️ **`#E6E6E6` grisini tasarımda gerçek bir renk olarak kullanma.** Bu ton "boş
> hücre" anlamına ayrılmıştır. Bir SVG'yi Pixel Creator'a geri açarken o renkteki
> hücreler boş kabul edilir, yani o pikselleri kaybedersin.

> Figma'da gri boş kareleri **silmeyin, üstüne boyayın.** Silinirse dosya ızgaranın
> gerçek boyutunu taşımaz ve geri açıldığında tasarım kırpılmış görünür.

---

## Kısayol listesi

| | |
|---|---|
| `B` `E` `G` `I` | kalem · silgi · kova · pipet |
| `L` `R` `O` | çizgi · dikdörtgen · elips |
| `M` `W` | seçim & taşı · aynı rengi seç |
| `H` `K` | kaydır · referans taşı |
| `Alt` (basılı) | geçici pipet |
| `Space` (basılı) | geçici kaydırma |
| `Ctrl+Z` / `Ctrl+Shift+Z` | geri al / ileri al |
| `Ctrl+S` | proje kaydet |
| `Ctrl+N` | yeni tasarım |
| `Ctrl+G` | ızgara |
| `Shift+H` / `Shift+V` | yatay / dikey simetri |
| `Delete` | seçili pikselleri sil |
| `Enter` | seçili pikselleri boya |
| `Esc` | seçimi bırak |
| `Shift+Delete` | tuvali temizle |
| `0` | ekrana sığdır |
| `+` / `-` / tekerlek | yakınlaştır / uzaklaştır |

---

## Bilinen sınırlar

- Katman yok, animasyon/frame yok, ortak (takım) depo yok. Herkes kendi tarayıcısında
  çalışır, dosyalarla paylaşır.
- Tuval boyutu dört hazır seçenekle sınırlı. Farklı ızgaralı bir SVG **açılabilir**
  ama sıfırdan o boyutta tuval **oluşturulamaz**.
- Döndürülmüş ya da düzgün ızgaraya oturmayan SVG'ler açılamaz.
- Ağır bulanık (yüksek antialiasing) görsellerden birebir sonuç çıkmaz; bilgi
  kaynağın kendisinde kaybolmuştur.

---

## Geliştirici notları

Build adımı yok, bağımlılık yok, backend yok — sadece statik dosyalar.

Yerelde çalıştırmak için (ES modülleri kullandığı için dosyayı çift tıklamak yetmez,
küçük bir sunucu gerekir):

```bash
python3 -m http.server 4173
```

Sonra `http://localhost:4173`.

`master`'a her push otomatik olarak GitHub Pages'e gider.

```
index.html
css/styles.css
js/
  main.js         başlangıç, modüllerin bağlanması
  store.js        belge modeli, palet, seçim, geri/ileri al
  render.js       tuval çizimi, zoom/pan, koordinat dönüşümü
  tools.js        araçlar ve fare/kalem etkileşimi
  ui.js           üst bar, araç çubuğu, durum çubuğu, kısayollar, dosya işlemleri
  radial.js       sağ tık renk halkası
  colorpanel.js   renk çarkı, hex girişi, palet, renk sayacı
  reference.js    arkadaki referans görsel
  importer.js     görselden pikselize + renk indirgeme
  svgimport.js    SVG okuma (kendi çıktımız ve Figma çıktısı)
  exporters.js    SVG / PNG / .json üretimi
  storage.js      otomatik kayıt (localStorage)
  color.js        renk dönüşümleri
  modal.js        pencereler ve bildirimler
```

Durum tek yerde (`store.js`) tutulur, değişiklikler basit bir olay veriyoluyla
yayılır. Yeni bir araç eklemek için: `tools.js` içindeki `onDown`/`onMove`'a bir dal,
`index.html`'e bir düğme, `ui.js`'teki `TOOL_KEYS`'e bir kısayol.
