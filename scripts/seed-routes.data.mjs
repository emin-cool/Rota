// 30 İstanbul başlangıç rotası: yalnızca geçiş noktaları (lng, lat). Geometri, yükseklik ve skor
// scripts/seed-routes.mjs içinde ORS + osm_features ile üretilir.
//
// Bir nokta [lng, lat] ya da { q: 'Yer adı', dLng?, dLat? } olabilir (q: OSM Nominatim ile İstanbul kutusunda
// aranır; dLng/dLat bulunan noktayı derece cinsinden kaydırır — park çevresinde döngü kurmak için).
// type: a_b (A→B), loop (başlangıçta biter: son nokta = ilk nokta), out_back (git-dön: [A, B, A]).
// profile (isteğe bağlı): ORS profilini zorlar (Büyükada'da bisiklet ağı bağlantı kuramadığı için yaya ağı).
// radius (isteğe bağlı): noktanın yola oturtulacağı en büyük uzaklık (m); varsayılan 500.
// `node scripts/seed-routes.mjs --check` hangi noktanın nereye düştüğünü ve rotaya ne kadar uzak
// kaldığını yazdırır; emin olmadığın noktaları o çıktıyla doğrula.

/** @typedef {[number, number] | { q: string }} Waypoint */

export const ROUTES = [
  // ---------------------------------------------------------------- Yürüyüş (14)
  {
    title: 'Emirgan - İstinye Yürüyüşü',
    activity: 'walk',
    type: 'a_b',
    district: 'Sarıyer',
    description: "Emirgan'dan İstinye yönüne Boğaz çevresinde yürüyüş.",
    wp: [
      [29.0556, 41.1052],
      [29.064, 41.1138],
    ],
  },
  {
    title: 'Bebek - Arnavutköy Sahil Yürüyüşü',
    activity: 'walk',
    type: 'a_b',
    district: 'Beşiktaş',
    description: "Bebek'ten Arnavutköy'e Boğaz'ın Avrupa yakasında sahil yolu.",
    wp: [
      [29.0435, 41.0775],
      [29.043, 41.063],
    ],
  },
  {
    title: 'Ortaköy - Bebek Sahil Yürüyüşü',
    activity: 'walk',
    type: 'a_b',
    district: 'Beşiktaş',
    description: "Ortaköy Meydanı'ndan Bebek'e Boğaz boyunca sahil yürüyüşü.",
    wp: [
      [29.027, 41.0475],
      [29.0435, 41.0775],
    ],
  },
  {
    title: 'Taksim - Kabataş Yürüyüşü',
    activity: 'walk',
    type: 'a_b',
    district: 'Beyoğlu',
    description: "Taksim Meydanı'ndan Kabataş iskelesine kısa şehir yürüyüşü.",
    wp: [
      [28.985, 41.037],
      [28.994152, 41.032935],
    ],
  },
  {
    title: 'Galata - Karaköy Turu',
    activity: 'walk',
    type: 'loop',
    district: 'Beyoğlu',
    description: 'Galata Kulesi, Karaköy ve Galata Köprüsü çevresinde kısa bir tur.',
    wp: [
      [28.9741, 41.0256],
      [28.979, 41.0225],
      [28.9732, 41.0195],
      [28.9741, 41.0256],
    ],
  },
  {
    title: 'Sultanahmet Tarihi Tur',
    activity: 'walk',
    type: 'loop',
    district: 'Fatih',
    description:
      'Sultanahmet Meydanı, Ayasofya, Gülhane ve Kapalıçarşı çevresinde tarihi yarımada turu.',
    wp: [
      [28.9769, 41.0054],
      [28.9801, 41.0086],
      [28.9808, 41.0132],
      [28.977, 41.0165],
      [28.968, 41.0106],
      [28.9769, 41.0054],
    ],
  },
  {
    title: 'Moda Sahili Yürüyüşü',
    activity: 'walk',
    type: 'a_b',
    district: 'Kadıköy',
    description: "Moda İskelesi'nden Moda Burnu üzerinden Kalamış'a sahil yürüyüşü.",
    wp: [
      [29.0268, 40.9856],
      [29.0235, 40.98],
      [29.037, 40.9745],
    ],
  },
  {
    title: 'Kadıköy - Moda Turu',
    activity: 'walk',
    type: 'loop',
    district: 'Kadıköy',
    description: 'Kadıköy çarşısından Bahariye ve Moda Caddesi üzerinden Moda sahiline dönüş turu.',
    wp: [
      [29.0262, 40.9902],
      [29.03, 40.9885],
      [29.031, 40.984],
      [29.0262, 40.985],
      [29.0262, 40.9902],
    ],
  },
  {
    title: 'Yıldız Parkı Turu',
    activity: 'walk',
    type: 'loop',
    district: 'Beşiktaş',
    description: 'Yıldız Parkı içinde köşkler ve ormanlık yollar boyunca daire tur.',
    wp: [
      [29.0128, 41.0463],
      [29.015, 41.0502],
      [29.0165, 41.051],
      [29.0128, 41.0463],
    ],
  },
  {
    title: 'Maçka Parkı Turu',
    activity: 'walk',
    type: 'loop',
    district: 'Şişli',
    description: 'Maçka Demokrasi Parkı içinde kısa ve rahat bir tur.',
    wp: [
      [28.9968, 41.0455],
      [28.9948, 41.0475],
      [28.9985, 41.0485],
      [28.9968, 41.0455],
    ],
  },
  {
    title: 'Fenerbahçe Parkı Turu',
    activity: 'walk',
    type: 'loop',
    district: 'Kadıköy',
    description: 'Fenerbahçe Parkı ve Kalamış Marina çevresinde sahil turu.',
    wp: [
      [29.0365, 40.969],
      [29.032003, 40.968139],
      [29.0395, 40.9717],
      [29.0365, 40.969],
    ],
  },
  {
    title: 'Üsküdar - Kuzguncuk Sahil Yürüyüşü',
    activity: 'walk',
    type: 'a_b',
    district: 'Üsküdar',
    description: "Üsküdar İskelesi'nden Kuzguncuk'a Boğaz'ın Anadolu yakasında sahil yürüyüşü.",
    wp: [
      [29.0153, 41.0262],
      [29.0299, 41.0355],
    ],
  },
  {
    title: 'Belgrad Ormanı Göl Turu',
    activity: 'walk',
    type: 'loop',
    district: 'Sarıyer',
    description: 'Belgrad Ormanı içinde bentler ve göller çevresinde orman yürüyüşü.',
    wp: [
      { q: 'Neşet Suyu Belgrad Ormanı' },
      { q: 'Büyükbent Belgrad Ormanı' },
      { q: 'Atatürk Arboretumu' },
      { q: 'Neşet Suyu Belgrad Ormanı' },
    ],
  },
  {
    title: 'Validebağ Korusu Turu',
    activity: 'walk',
    type: 'loop',
    district: 'Üsküdar',
    description: 'Validebağ Korusu çevresinde yeşil alan turu.',
    wp: [
      { q: 'Validebağ Korusu' },
      { q: 'Validebağ Korusu', dLng: 0.004, dLat: 0.003 },
      { q: 'Validebağ Korusu', dLng: 0.005, dLat: -0.001 },
      { q: 'Validebağ Korusu' },
    ],
  },

  // ---------------------------------------------------------------- Koşu (7)
  {
    title: 'Caddebostan Sahil Koşusu',
    activity: 'run',
    type: 'out_back',
    district: 'Kadıköy',
    description: "Caddebostan sahilinden Suadiye'ye gidiş-dönüş düz koşu parkuru.",
    wp: [
      [29.062, 40.9655],
      [29.075, 40.9608],
      [29.062, 40.9655],
    ],
  },
  {
    title: 'Bebek Sahil Koşusu',
    activity: 'run',
    type: 'out_back',
    district: 'Beşiktaş',
    description: "Bebek'ten Rumeli Hisarı'na Boğaz kıyısında gidiş-dönüş koşu.",
    wp: [
      [29.0435, 41.0775],
      [29.0565, 41.0845],
      [29.0435, 41.0775],
    ],
  },
  {
    title: 'Belgrad Ormanı 6 km Parkuru',
    activity: 'run',
    type: 'out_back',
    district: 'Sarıyer',
    description:
      "Atatürk Arboretumu'ndan Kirazlı Bent'e gidiş-dönüş yaklaşık 6 km'lik orman koşu parkuru.",
    wp: [{ q: 'Atatürk Arboretumu' }, { q: 'Kirazlı Bent' }, { q: 'Atatürk Arboretumu' }],
  },
  {
    title: 'Kadıköy - Bostancı Sahil Koşusu',
    activity: 'run',
    type: 'a_b',
    district: 'Kadıköy',
    description:
      "Kadıköy'den Bostancı'ya Moda, Kalamış ve Caddebostan sahilleri boyunca uzun koşu.",
    wp: [
      [29.0236, 40.9925],
      [29.0235, 40.9785],
      [29.0386, 40.9728],
      [29.062, 40.9655],
      [29.076, 40.961],
      [29.095, 40.956],
    ],
  },
  {
    title: 'Florya Sahil Koşusu',
    activity: 'run',
    type: 'a_b',
    district: 'Bakırköy',
    description: 'Florya sahil yolundan Yeşilköy yönüne düz koşu parkuru.',
    wp: [
      [28.7855, 40.9735],
      [28.819, 40.96],
    ],
  },
  {
    title: 'Maçka - Nişantaşı Koşusu',
    activity: 'run',
    type: 'loop',
    district: 'Şişli',
    description: "Maçka Parkı'ndan Teşvikiye ve Nişantaşı sokaklarına şehir içi koşu turu.",
    wp: [
      [28.9965, 41.0455],
      [28.9945, 41.048],
      [28.994, 41.0515],
      [28.991, 41.0505],
      [28.9965, 41.0455],
    ],
  },
  {
    title: 'Sarıyer - Rumeli Kavağı Koşusu',
    activity: 'run',
    type: 'a_b',
    district: 'Sarıyer',
    description: "Sarıyer'den Rumeli Kavağı'na Boğaz'ın kuzey kıyısında koşu.",
    wp: [
      [29.0586, 41.1664],
      [29.0718, 41.177],
    ],
  },

  // ---------------------------------------------------------------- Bisiklet (9)
  {
    title: 'Caddebostan - Bostancı Sahil Bisiklet Yolu',
    activity: 'bike',
    type: 'a_b',
    district: 'Kadıköy',
    description: "Caddebostan'dan Bostancı'ya düz sahil bisiklet yolu.",
    wp: [
      [29.0627, 40.9655],
      [29.095, 40.9553],
    ],
  },
  {
    title: 'Kadıköy - Pendik Sahil Bisiklet Turu',
    activity: 'bike',
    type: 'a_b',
    district: 'Kadıköy',
    description: "Kadıköy'den Bostancı, Maltepe ve Kartal sahilleri üzerinden Pendik'e uzun tur.",
    wp: [
      [29.0236, 40.9925],
      [29.095, 40.9553],
      [29.13, 40.923],
      [29.183, 40.904],
      [29.233, 40.877],
    ],
  },
  {
    title: 'Florya - Yeşilköy Bisiklet Yolu',
    activity: 'bike',
    type: 'a_b',
    district: 'Bakırköy',
    description: "Florya'dan Yeşilköy'e Marmara kıyısında bisiklet yolu.",
    wp: [
      [28.7845, 40.9752],
      [28.818, 40.959],
    ],
  },
  {
    title: 'Göktürk - Kemerburgaz Bisiklet Turu',
    activity: 'bike',
    type: 'a_b',
    district: 'Eyüpsultan',
    description: "Göktürk'ten Kemerburgaz'a orman kenarında bisiklet turu.",
    wp: [{ q: 'Göktürk Eyüpsultan' }, { q: 'Kemerburgaz Eyüpsultan' }],
  },
  {
    title: 'Eyüp - Haliç Sahili Bisiklet Turu',
    activity: 'bike',
    type: 'a_b',
    district: 'Eyüpsultan',
    description: "Eyüp'ten Balat ve Fener üzerinden Galata Köprüsü'ne Haliç kıyısı turu.",
    wp: [
      [28.934, 41.048],
      [28.949, 41.0295],
      [28.9605, 41.022],
      [28.9733, 41.0195],
    ],
  },
  {
    title: 'Sarıyer - Kilyos Bisiklet Turu',
    activity: 'bike',
    type: 'a_b',
    district: 'Sarıyer',
    description: "Sarıyer'den Kilyos'a Karadeniz yönünde yokuşlu bisiklet rotası.",
    wp: [[29.0586, 41.1664], { q: 'Kilyos Sarıyer' }],
  },
  {
    title: 'Ataköy Sahil Bisiklet Turu',
    activity: 'bike',
    type: 'out_back',
    district: 'Bakırköy',
    description: "Ataköy Marina'dan Yeşilköy yönüne sahil boyunca gidiş-dönüş.",
    wp: [
      [28.8737, 40.9708],
      [28.82, 40.959],
      [28.8737, 40.9708],
    ],
  },
  {
    title: 'Beylerbeyi - Çengelköy Bisiklet Turu',
    activity: 'bike',
    type: 'a_b',
    district: 'Üsküdar',
    description: "Beylerbeyi Sarayı'ndan Çengelköy'e Boğaz'ın Anadolu yakasında sahil yolu.",
    wp: [
      [29.0412, 41.043],
      [29.051, 41.0525],
    ],
  },
  {
    title: 'Büyükada Turu',
    activity: 'bike',
    type: 'loop',
    district: 'Adalar',
    description: 'Büyükada çevresinde ada yolundan bisiklet turu.',
    profile: 'foot-walking',
    radius: 1000,
    wp: [
      [29.128303, 40.874941],
      [29.145, 40.866],
      [29.123, 40.859],
      [29.128303, 40.874941],
    ],
  },
];
