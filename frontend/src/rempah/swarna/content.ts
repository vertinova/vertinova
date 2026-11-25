import { LANGS, type Lang } from './lang';

// Copy for the PT Swarnabhumi Global Nusantara landing page. Specs are typical export values: confirm with the client before launch.

/** Positional translations in LANGS order: en, id, zh, ar, es, fr, de, ja. */
const t8 = (...v: string[]) => Object.fromEntries(LANGS.map((l, i) => [l, v[i]])) as Record<Lang, string>;

export const LANG_NAMES: Record<Lang, string> = t8('English', 'Bahasa Indonesia', '中文', 'العربية', 'Español', 'Français', 'Deutsch', '日本語');

type Pair = [string, string];
export type Copy = {
  nav: { products: string; about: string; process: string; contact: string };
  kicker: string;
  title: string;
  lead: string;
  facts: [string, string, string, string];
  aboutKicker: string;
  aboutTitle: string;
  aboutText: string;
  points: [Pair, Pair, Pair];
  productsKicker: string;
  productsTitle: string;
  productsText: string;
  all: string;
  cats: Record<Category, string>;
  specNote: string;
  spec: { origin: string; forms: string; grade: string; moisture: string; hs: string };
  processKicker: string;
  processTitle: string;
  steps: [Pair, Pair, Pair, Pair];
  packingTitle: string;
  packingText: string;
  docsTitle: string;
  contactKicker: string;
  contactTitle: string;
  contactText: string;
  waCta: string;
  emailCta: string;
  waHello: string;
  office: string;
  footerTag: string;
  language: string;
};

export const FACT_VALUES = ['12', '8', 'FCL · LCL', 'FOB · CIF'];
export const DOCS = ['Commercial Invoice', 'Packing List', 'Bill of Lading', 'Certificate of Origin', 'Phytosanitary Certificate', 'Certificate of Analysis'];

export const COPY: Record<Lang, Copy> = {
  en: {
    nav: { products: 'Products', about: 'About', process: 'Process', contact: 'Contact' },
    kicker: 'Indonesian spice exporter',
    title: 'The spices that built empires, shipped to your port.',
    lead: 'PT Swarnabhumi Global Nusantara sources, grades and exports Indonesian spices for importers, traders and food manufacturers worldwide.',
    facts: ['Spice commodities', 'Origin regions', 'Container shipments', 'Incoterms'],
    aboutKicker: 'About us',
    aboutTitle: 'Rooted in the Spice Islands.',
    aboutText: "Indonesia has supplied the world's kitchens for centuries. We work with farmers and collectors in each growing region, then clean, grade and pack every lot to the buyer's specification.",
    points: [
      ['Direct sourcing', 'Bought at origin from farmer groups we know.'],
      ['Graded to spec', 'Cleaned, sorted and checked against your specification.'],
      ['Export ready', 'Packing, documents and shipping arranged by our team.'],
    ],
    productsKicker: 'Products',
    productsTitle: 'Twelve spices. One reliable source.',
    productsText: 'Whole and processed spices, graded to export standards.',
    all: 'All',
    cats: { seeds: 'Seeds & Nuts', aromatics: 'Flowers, Bark & Pods', roots: 'Roots & Rhizomes' },
    specNote: 'Specifications are indicative. Custom grades and packing on request.',
    spec: { origin: 'Origin', forms: 'Forms', grade: 'Grade', moisture: 'Moisture', hs: 'HS code' },
    processKicker: 'How we work',
    processTitle: 'From farm to container, nothing left to chance.',
    steps: [
      ['Sourcing', 'Purchased directly in each origin region.'],
      ['Processing', 'Dried, cleaned and sorted to remove foreign matter.'],
      ['Quality control', 'Moisture, grade and samples checked before shipment.'],
      ['Shipping', 'Export packing, documents and loading at Indonesian ports.'],
    ],
    packingTitle: 'Packaging',
    packingText: 'PP woven, jute or kraft bags of 25–50 kg, cartons, or custom packing.',
    docsTitle: 'Shipping documents',
    contactKicker: 'Contact',
    contactTitle: 'Bring Indonesian spices to your market.',
    contactText: 'Talk to our team on WhatsApp or email about specifications, samples and availability.',
    waCta: 'Chat on WhatsApp',
    emailCta: 'Email us',
    waHello: 'Hello PT Swarnabhumi Global Nusantara, I would like to ask about your spices.',
    office: 'Head office',
    footerTag: 'Indonesian spices for the world.',
    language: 'Language',
  },
  id: {
    nav: { products: 'Produk', about: 'Tentang', process: 'Proses', contact: 'Kontak' },
    kicker: 'Eksportir rempah Indonesia',
    title: 'Rempah yang dulu membangun kerajaan, kini dikirim ke pelabuhan Anda.',
    lead: 'PT Swarnabhumi Global Nusantara memasok, menyortir, dan mengekspor rempah Indonesia untuk importir, trader, dan produsen makanan di seluruh dunia.',
    facts: ['Komoditas rempah', 'Daerah asal', 'Pengiriman kontainer', 'Incoterms'],
    aboutKicker: 'Tentang kami',
    aboutTitle: 'Berakar di Kepulauan Rempah.',
    aboutText: 'Selama berabad-abad Indonesia memasok dapur dunia. Kami bekerja dengan petani dan pengepul di setiap daerah penghasil, lalu membersihkan, menyortir, dan mengemas setiap lot sesuai spesifikasi pembeli.',
    points: [
      ['Sumber langsung', 'Dibeli di daerah asal dari kelompok tani yang kami kenal.'],
      ['Sesuai spesifikasi', 'Dibersihkan, disortir, dan diperiksa sesuai spesifikasi Anda.'],
      ['Siap ekspor', 'Pengemasan, dokumen, dan pengiriman diurus tim kami.'],
    ],
    productsKicker: 'Produk',
    productsTitle: 'Dua belas rempah. Satu pemasok tepercaya.',
    productsText: 'Rempah utuh dan olahan, disortir sesuai standar ekspor.',
    all: 'Semua',
    cats: { seeds: 'Biji & Kacang', aromatics: 'Bunga, Kulit & Polong', roots: 'Akar & Rimpang' },
    specNote: 'Spesifikasi bersifat indikatif. Grade dan kemasan khusus dapat disesuaikan.',
    spec: { origin: 'Asal', forms: 'Bentuk', grade: 'Grade', moisture: 'Kadar air', hs: 'Kode HS' },
    processKicker: 'Cara kami bekerja',
    processTitle: 'Dari kebun ke kontainer, tanpa kompromi.',
    steps: [
      ['Pengadaan', 'Dibeli langsung di setiap daerah asal.'],
      ['Pengolahan', 'Dikeringkan, dibersihkan, dan disortir dari benda asing.'],
      ['Kontrol mutu', 'Kadar air, grade, dan sampel diperiksa sebelum pengiriman.'],
      ['Pengiriman', 'Kemasan ekspor, dokumen, dan muat di pelabuhan Indonesia.'],
    ],
    packingTitle: 'Kemasan',
    packingText: 'Karung PP, goni, atau kraft 25–50 kg, karton, atau kemasan khusus.',
    docsTitle: 'Dokumen pengiriman',
    contactKicker: 'Kontak',
    contactTitle: 'Bawa rempah Indonesia ke pasar Anda.',
    contactText: 'Bicarakan spesifikasi, sampel, dan ketersediaan dengan tim kami lewat WhatsApp atau email.',
    waCta: 'Chat via WhatsApp',
    emailCta: 'Kirim email',
    waHello: 'Halo PT Swarnabhumi Global Nusantara, saya ingin bertanya tentang produk rempah Anda.',
    office: 'Kantor pusat',
    footerTag: 'Rempah Indonesia untuk dunia.',
    language: 'Bahasa',
  },
  zh: {
    nav: { products: '产品', about: '关于我们', process: '流程', contact: '联系我们' },
    kicker: '印度尼西亚香料出口商',
    title: '曾缔造帝国的香料，如今直达您的港口。',
    lead: 'PT Swarnabhumi Global Nusantara 在印度尼西亚产地采购、分级并出口香料，服务全球进口商、贸易商和食品制造商。',
    facts: ['香料品类', '产区', '整柜 / 拼柜', '贸易术语'],
    aboutKicker: '关于我们',
    aboutTitle: '根植于香料群岛。',
    aboutText: '几个世纪以来，印度尼西亚一直为世界各地的厨房供应香料。我们与各产区的农户和收购商合作，按照买家的规格对每批货物进行清洁、分级和包装。',
    points: [
      ['产地直采', '从我们熟悉的农户合作社直接采购。'],
      ['按规格分级', '根据您的规格进行清洁、分选和检验。'],
      ['出口无忧', '包装、单证和运输由我们团队负责。'],
    ],
    productsKicker: '产品',
    productsTitle: '十二种香料，一个可靠来源。',
    productsText: '整粒及加工香料，按出口标准分级。',
    all: '全部',
    cats: { seeds: '种子与坚果', aromatics: '花、树皮与荚果', roots: '根茎类' },
    specNote: '规格仅供参考，可按需定制等级和包装。',
    spec: { origin: '产地', forms: '形态', grade: '等级', moisture: '水分', hs: 'HS编码' },
    processKicker: '工作流程',
    processTitle: '从农场到集装箱，每一步都不马虎。',
    steps: [
      ['采购', '在各产区直接收购。'],
      ['加工', '干燥、清洁并分选，去除杂质。'],
      ['质量控制', '发货前检测水分、等级并留样。'],
      ['运输', '出口包装、单证及印尼港口装运。'],
    ],
    packingTitle: '包装',
    packingText: '25–50 公斤 PP 编织袋、麻袋或牛皮纸袋、纸箱，或定制包装。',
    docsTitle: '出口单证',
    contactKicker: '联系我们',
    contactTitle: '把印尼香料带到您的市场。',
    contactText: '通过 WhatsApp 或电子邮件，与我们的团队沟通规格、样品和供货情况。',
    waCta: 'WhatsApp 咨询',
    emailCta: '发送邮件',
    waHello: '您好 PT Swarnabhumi Global Nusantara，我想咨询贵公司的香料产品。',
    office: '总部',
    footerTag: '印度尼西亚香料，供应全球。',
    language: '语言',
  },
  ar: {
    nav: { products: 'المنتجات', about: 'من نحن', process: 'آلية العمل', contact: 'اتصل بنا' },
    kicker: 'مُصدِّر توابل إندونيسي',
    title: 'توابل بنت إمبراطوريات، تُشحن الآن إلى ميناءكم.',
    lead: 'تقوم PT Swarnabhumi Global Nusantara بتوريد التوابل الإندونيسية وفرزها وتصديرها للمستوردين والتجار ومصنّعي الأغذية حول العالم.',
    facts: ['أصناف التوابل', 'مناطق المنشأ', 'شحن الحاويات', 'شروط التسليم'],
    aboutKicker: 'من نحن',
    aboutTitle: 'جذورنا في جزر التوابل.',
    aboutText: 'تزوّد إندونيسيا مطابخ العالم بالتوابل منذ قرون. نعمل مع المزارعين والمجمّعين في كل منطقة زراعة، ثم ننظّف كل شحنة ونفرزها ونعبّئها وفق مواصفات المشتري.',
    points: [
      ['توريد مباشر', 'نشتري من المنشأ عبر مجموعات مزارعين نعرفها.'],
      ['فرز حسب المواصفات', 'تنظيف وفرز وفحص وفق مواصفاتكم.'],
      ['جاهزة للتصدير', 'التعبئة والمستندات والشحن يتولاها فريقنا.'],
    ],
    productsKicker: 'المنتجات',
    productsTitle: 'اثنا عشر صنفًا من التوابل، ومصدر واحد موثوق.',
    productsText: 'توابل كاملة ومصنّعة، مفروزة وفق معايير التصدير.',
    all: 'الكل',
    cats: { seeds: 'بذور ومكسرات', aromatics: 'أزهار ولحاء وقرون', roots: 'جذور وريزومات' },
    specNote: 'المواصفات تقريبية، ويمكن تخصيص الدرجات والتعبئة عند الطلب.',
    spec: { origin: 'المنشأ', forms: 'الأشكال', grade: 'الدرجة', moisture: 'الرطوبة', hs: 'رمز HS' },
    processKicker: 'آلية العمل',
    processTitle: 'من المزرعة إلى الحاوية، دون ترك شيء للصدفة.',
    steps: [
      ['التوريد', 'الشراء المباشر في كل منطقة منشأ.'],
      ['المعالجة', 'التجفيف والتنظيف والفرز لإزالة الشوائب.'],
      ['مراقبة الجودة', 'فحص الرطوبة والدرجة والعينات قبل الشحن.'],
      ['الشحن', 'تعبئة تصديرية ومستندات وتحميل في الموانئ الإندونيسية.'],
    ],
    packingTitle: 'التعبئة',
    packingText: 'أكياس منسوجة أو جوت أو ورق كرافت بوزن 25–50 كغ، أو كراتين، أو تعبئة مخصّصة.',
    docsTitle: 'مستندات الشحن',
    contactKicker: 'اتصل بنا',
    contactTitle: 'أوصلوا التوابل الإندونيسية إلى أسواقكم.',
    contactText: 'تحدثوا مع فريقنا عبر واتساب أو البريد الإلكتروني حول المواصفات والعينات والتوافر.',
    waCta: 'تواصل عبر واتساب',
    emailCta: 'راسلنا بالبريد',
    waHello: 'مرحبًا PT Swarnabhumi Global Nusantara، أود الاستفسار عن منتجاتكم من التوابل.',
    office: 'المقر الرئيسي',
    footerTag: 'توابل إندونيسية للعالم.',
    language: 'اللغة',
  },
  es: {
    nav: { products: 'Productos', about: 'Nosotros', process: 'Proceso', contact: 'Contacto' },
    kicker: 'Exportador de especias de Indonesia',
    title: 'Las especias que construyeron imperios, ahora rumbo a su puerto.',
    lead: 'PT Swarnabhumi Global Nusantara compra, clasifica y exporta especias de Indonesia para importadores, comerciantes y fabricantes de alimentos de todo el mundo.',
    facts: ['Especias', 'Regiones de origen', 'Envíos en contenedor', 'Incoterms'],
    aboutKicker: 'Nosotros',
    aboutTitle: 'Con raíces en las Islas de las Especias.',
    aboutText: 'Indonesia abastece las cocinas del mundo desde hace siglos. Trabajamos con agricultores y acopiadores de cada región productora, y limpiamos, clasificamos y envasamos cada lote según la especificación del comprador.',
    points: [
      ['Compra directa', 'En origen, con grupos de agricultores que conocemos.'],
      ['Según especificación', 'Limpieza, selección y control según su especificación.'],
      ['Listo para exportar', 'Embalaje, documentos y envío a cargo de nuestro equipo.'],
    ],
    productsKicker: 'Productos',
    productsTitle: 'Doce especias. Un proveedor confiable.',
    productsText: 'Especias enteras y procesadas, clasificadas según estándares de exportación.',
    all: 'Todas',
    cats: { seeds: 'Semillas y nueces', aromatics: 'Flores, cortezas y vainas', roots: 'Raíces y rizomas' },
    specNote: 'Especificaciones orientativas. Calidades y envases a medida bajo pedido.',
    spec: { origin: 'Origen', forms: 'Presentación', grade: 'Calidad', moisture: 'Humedad', hs: 'Código HS' },
    processKicker: 'Cómo trabajamos',
    processTitle: 'Del campo al contenedor, sin dejar nada al azar.',
    steps: [
      ['Abastecimiento', 'Compra directa en cada región de origen.'],
      ['Procesamiento', 'Secado, limpieza y selección para eliminar materias extrañas.'],
      ['Control de calidad', 'Humedad, calidad y muestras verificadas antes del envío.'],
      ['Envío', 'Embalaje de exportación, documentos y carga en puertos de Indonesia.'],
    ],
    packingTitle: 'Embalaje',
    packingText: 'Sacos de PP, yute o kraft de 25–50 kg, cajas de cartón o envase a medida.',
    docsTitle: 'Documentos de envío',
    contactKicker: 'Contacto',
    contactTitle: 'Lleve las especias de Indonesia a su mercado.',
    contactText: 'Hable con nuestro equipo por WhatsApp o correo electrónico sobre especificaciones, muestras y disponibilidad.',
    waCta: 'Escribir por WhatsApp',
    emailCta: 'Enviar correo',
    waHello: 'Hola PT Swarnabhumi Global Nusantara, quisiera información sobre sus especias.',
    office: 'Sede',
    footerTag: 'Especias de Indonesia para el mundo.',
    language: 'Idioma',
  },
  fr: {
    nav: { products: 'Produits', about: 'À propos', process: 'Processus', contact: 'Contact' },
    kicker: "Exportateur d'épices indonésiennes",
    title: "Les épices qui ont bâti des empires, expédiées jusqu'à votre port.",
    lead: "PT Swarnabhumi Global Nusantara achète, calibre et exporte des épices indonésiennes pour les importateurs, négociants et industriels de l'agroalimentaire du monde entier.",
    facts: ['Épices', "Régions d'origine", 'Expéditions en conteneur', 'Incoterms'],
    aboutKicker: 'À propos',
    aboutTitle: 'Enracinés dans les îles aux épices.',
    aboutText: "Depuis des siècles, l'Indonésie approvisionne les cuisines du monde. Nous travaillons avec les producteurs et collecteurs de chaque région, puis nettoyons, calibrons et conditionnons chaque lot selon le cahier des charges de l'acheteur.",
    points: [
      ['Achat direct', "À l'origine, auprès de groupements de producteurs que nous connaissons."],
      ['Selon vos spécifications', 'Nettoyage, tri et contrôle selon votre cahier des charges.'],
      ["Prêt pour l'export", 'Emballage, documents et expédition gérés par notre équipe.'],
    ],
    productsKicker: 'Produits',
    productsTitle: 'Douze épices. Un fournisseur fiable.',
    productsText: "Épices entières et transformées, calibrées aux normes d'exportation.",
    all: 'Toutes',
    cats: { seeds: 'Graines et noix', aromatics: 'Fleurs, écorces et gousses', roots: 'Racines et rhizomes' },
    specNote: 'Spécifications indicatives. Qualités et emballages sur mesure sur demande.',
    spec: { origin: 'Origine', forms: 'Formes', grade: 'Qualité', moisture: 'Humidité', hs: 'Code SH' },
    processKicker: 'Notre méthode',
    processTitle: "Du champ au conteneur, rien n'est laissé au hasard.",
    steps: [
      ['Approvisionnement', "Achat direct dans chaque région d'origine."],
      ['Transformation', 'Séchage, nettoyage et tri pour éliminer les impuretés.'],
      ['Contrôle qualité', 'Humidité, qualité et échantillons vérifiés avant expédition.'],
      ['Expédition', 'Emballage export, documents et chargement dans les ports indonésiens.'],
    ],
    packingTitle: 'Emballage',
    packingText: 'Sacs PP tissés, jute ou kraft de 25 à 50 kg, cartons ou emballage sur mesure.',
    docsTitle: "Documents d'expédition",
    contactKicker: 'Contact',
    contactTitle: 'Apportez les épices indonésiennes sur votre marché.',
    contactText: 'Échangez avec notre équipe par WhatsApp ou e-mail sur les spécifications, les échantillons et la disponibilité.',
    waCta: 'Discuter sur WhatsApp',
    emailCta: 'Envoyer un e-mail',
    waHello: 'Bonjour PT Swarnabhumi Global Nusantara, je souhaite me renseigner sur vos épices.',
    office: 'Siège',
    footerTag: 'Des épices indonésiennes pour le monde.',
    language: 'Langue',
  },
  de: {
    nav: { products: 'Produkte', about: 'Über uns', process: 'Ablauf', contact: 'Kontakt' },
    kicker: 'Gewürzexporteur aus Indonesien',
    title: 'Die Gewürze, die Weltreiche formten – jetzt auf dem Weg in Ihren Hafen.',
    lead: 'PT Swarnabhumi Global Nusantara beschafft, sortiert und exportiert indonesische Gewürze für Importeure, Händler und Lebensmittelhersteller weltweit.',
    facts: ['Gewürze', 'Anbauregionen', 'Containerversand', 'Incoterms'],
    aboutKicker: 'Über uns',
    aboutTitle: 'Verwurzelt auf den Gewürzinseln.',
    aboutText: 'Seit Jahrhunderten beliefert Indonesien die Küchen der Welt. Wir arbeiten mit Bauern und Aufkäufern in jeder Anbauregion und reinigen, sortieren und verpacken jede Partie nach der Spezifikation des Käufers.',
    points: [
      ['Direkter Einkauf', 'Am Ursprung, von Bauerngruppen, die wir kennen.'],
      ['Nach Spezifikation', 'Gereinigt, sortiert und geprüft nach Ihren Vorgaben.'],
      ['Exportbereit', 'Verpackung, Dokumente und Versand übernimmt unser Team.'],
    ],
    productsKicker: 'Produkte',
    productsTitle: 'Zwölf Gewürze. Eine verlässliche Quelle.',
    productsText: 'Ganze und verarbeitete Gewürze, sortiert nach Exportstandards.',
    all: 'Alle',
    cats: { seeds: 'Samen & Nüsse', aromatics: 'Blüten, Rinden & Schoten', roots: 'Wurzeln & Rhizome' },
    specNote: 'Spezifikationen sind Richtwerte. Individuelle Qualitäten und Verpackungen auf Anfrage.',
    spec: { origin: 'Herkunft', forms: 'Formen', grade: 'Qualität', moisture: 'Feuchte', hs: 'HS-Code' },
    processKicker: 'So arbeiten wir',
    processTitle: 'Vom Feld in den Container – nichts bleibt dem Zufall überlassen.',
    steps: [
      ['Beschaffung', 'Direkter Einkauf in jeder Ursprungsregion.'],
      ['Aufbereitung', 'Getrocknet, gereinigt und von Fremdstoffen befreit.'],
      ['Qualitätskontrolle', 'Feuchte, Qualität und Muster vor dem Versand geprüft.'],
      ['Versand', 'Exportverpackung, Dokumente und Verladung in indonesischen Häfen.'],
    ],
    packingTitle: 'Verpackung',
    packingText: 'PP-Gewebe-, Jute- oder Kraftsäcke zu 25–50 kg, Kartons oder individuelle Verpackung.',
    docsTitle: 'Versanddokumente',
    contactKicker: 'Kontakt',
    contactTitle: 'Bringen Sie indonesische Gewürze in Ihren Markt.',
    contactText: 'Sprechen Sie mit unserem Team per WhatsApp oder E-Mail über Spezifikationen, Muster und Verfügbarkeit.',
    waCta: 'Per WhatsApp chatten',
    emailCta: 'E-Mail senden',
    waHello: 'Hallo PT Swarnabhumi Global Nusantara, ich möchte mich über Ihre Gewürze informieren.',
    office: 'Hauptsitz',
    footerTag: 'Indonesische Gewürze für die Welt.',
    language: 'Sprache',
  },
  ja: {
    nav: { products: '製品', about: '会社概要', process: '工程', contact: 'お問い合わせ' },
    kicker: 'インドネシアのスパイス輸出企業',
    title: '帝国を築いたスパイスを、あなたの港へ。',
    lead: 'PT Swarnabhumi Global Nusantara は、インドネシア産スパイスを産地で調達・選別し、世界中の輸入業者、商社、食品メーカーへ輸出しています。',
    facts: ['取扱スパイス', '産地', 'コンテナ輸送', '取引条件'],
    aboutKicker: '会社概要',
    aboutTitle: 'スパイス諸島に根ざして。',
    aboutText: 'インドネシアは何世紀にもわたり世界の食卓にスパイスを届けてきました。私たちは各産地の農家や集荷業者と協力し、すべてのロットを買い手の規格に合わせて洗浄・選別・梱包します。',
    points: [
      ['産地直接調達', '信頼できる農家グループから産地で買い付け。'],
      ['規格どおりの選別', 'ご指定の規格に沿って洗浄・選別・検査。'],
      ['輸出対応', '梱包・書類・輸送まで当社チームが対応。'],
    ],
    productsKicker: '製品',
    productsTitle: '12種のスパイスを、ひとつの信頼できる供給元から。',
    productsText: 'ホールおよび加工スパイスを輸出基準で選別。',
    all: 'すべて',
    cats: { seeds: '種子・ナッツ', aromatics: '花・樹皮・さや', roots: '根・根茎' },
    specNote: '規格は目安です。グレードや梱包はご要望に応じて対応します。',
    spec: { origin: '産地', forms: '形状', grade: 'グレード', moisture: '水分', hs: 'HSコード' },
    processKicker: '私たちの仕事',
    processTitle: '農園からコンテナまで、妥協はしません。',
    steps: [
      ['調達', '各産地で直接買い付け。'],
      ['加工', '乾燥・洗浄・選別で異物を除去。'],
      ['品質管理', '出荷前に水分・グレード・サンプルを確認。'],
      ['輸送', '輸出梱包、書類作成、インドネシアの港で積み込み。'],
    ],
    packingTitle: '梱包',
    packingText: '25〜50 kg の PP 織袋・ジュート袋・クラフト袋、段ボール、または指定梱包。',
    docsTitle: '船積書類',
    contactKicker: 'お問い合わせ',
    contactTitle: 'インドネシアのスパイスを、あなたの市場へ。',
    contactText: '規格、サンプル、在庫状況について、WhatsApp またはメールで当社チームにご相談ください。',
    waCta: 'WhatsAppで相談',
    emailCta: 'メールを送る',
    waHello: 'PT Swarnabhumi Global Nusantara 様、スパイス製品について問い合わせたいです。',
    office: '本社',
    footerTag: 'インドネシアのスパイスを世界へ。',
    language: '言語',
  },
};

export type Form = 'whole' | 'ground' | 'broken' | 'sticks' | 'cut' | 'fresh' | 'sliced';

export const FORMS: Record<Form, Record<Lang, string>> = {
  whole: t8('Whole', 'Utuh', '整粒', 'كامل', 'Entero', 'Entier', 'Ganz', 'ホール'),
  ground: t8('Ground', 'Bubuk', '粉', 'مطحون', 'Molido', 'Moulu', 'Gemahlen', 'パウダー'),
  broken: t8('Broken', 'Pecah', '碎', 'مكسور', 'Partido', 'Brisé', 'Gebrochen', 'ブロークン'),
  sticks: t8('Sticks', 'Batang', '条', 'أعواد', 'Rama', 'Bâtons', 'Stangen', 'スティック'),
  cut: t8('Cut', 'Potong', '切段', 'مقطّع', 'Cortado', 'Coupé', 'Geschnitten', 'カット'),
  fresh: t8('Fresh', 'Segar', '鲜', 'طازج', 'Fresco', 'Frais', 'Frisch', '生'),
  sliced: t8('Sliced', 'Iris', '切片', 'شرائح', 'Laminado', 'Tranché', 'Scheiben', 'スライス'),
};

export type Category = 'seeds' | 'aromatics' | 'roots';
export const CATEGORIES: Category[] = ['seeds', 'aromatics', 'roots'];

export type Product = {
  id: string;
  cat: Category;
  name: Record<Lang, string>;
  latin: string;
  origin: string;
  forms: Form[];
  grade: string;
  moisture: string;
  hs: string;
};

export const PRODUCTS: Product[] = [
  { id: 'cloves', cat: 'aromatics', name: t8('Cloves', 'Cengkeh', '丁香', 'القرنفل', 'Clavo de olor', 'Clous de girofle', 'Gewürznelken', 'クローブ'), latin: 'Syzygium aromaticum', origin: 'Maluku · Sulawesi', forms: ['whole', 'ground'], grade: 'Hand-picked · FAQ', moisture: '≤ 13%', hs: '0907.10' },
  { id: 'nutmeg', cat: 'seeds', name: t8('Nutmeg', 'Pala', '肉豆蔻', 'جوزة الطيب', 'Nuez moscada', 'Noix de muscade', 'Muskatnuss', 'ナツメグ'), latin: 'Myristica fragrans', origin: 'Banda · Maluku · Papua', forms: ['whole', 'ground'], grade: 'ABCD · BWP · SS', moisture: '≤ 10%', hs: '0908.11' },
  { id: 'mace', cat: 'aromatics', name: t8('Mace', 'Fuli (bunga pala)', '肉豆蔻衣', 'البسباسة', 'Macis', 'Macis', 'Macis', 'メース'), latin: 'Myristica fragrans (aril)', origin: 'Banda · Papua', forms: ['whole', 'broken', 'ground'], grade: 'Grade I · II', moisture: '≤ 12%', hs: '0908.21' },
  { id: 'black-pepper', cat: 'seeds', name: t8('Black Pepper', 'Lada Hitam', '黑胡椒', 'الفلفل الأسود', 'Pimienta negra', 'Poivre noir', 'Schwarzer Pfeffer', 'ブラックペッパー'), latin: 'Piper nigrum', origin: 'Lampung, Sumatra', forms: ['whole', 'ground'], grade: 'ASTA · 550 g/L', moisture: '≤ 12%', hs: '0904.11' },
  { id: 'white-pepper', cat: 'seeds', name: t8('White Pepper', 'Lada Putih', '白胡椒', 'الفلفل الأبيض', 'Pimienta blanca', 'Poivre blanc', 'Weißer Pfeffer', 'ホワイトペッパー'), latin: 'Piper nigrum', origin: 'Bangka (Muntok)', forms: ['whole', 'ground'], grade: 'Muntok · 600 g/L', moisture: '≤ 13%', hs: '0904.11' },
  { id: 'cassia', cat: 'aromatics', name: t8('Cassia Cinnamon', 'Kayu Manis', '肉桂', 'القرفة الصينية', 'Canela cassia', 'Cannelle casse', 'Kassia-Zimt', 'カシア'), latin: 'Cinnamomum burmannii', origin: 'Kerinci, Sumatra', forms: ['sticks', 'cut', 'ground'], grade: 'KA · KB · KC', moisture: '≤ 13%', hs: '0906.19' },
  { id: 'vanilla', cat: 'aromatics', name: t8('Vanilla', 'Vanili', '香草荚', 'الفانيليا', 'Vainilla', 'Vanille', 'Vanille', 'バニラ'), latin: 'Vanilla planifolia', origin: 'Papua · Bali · Flores', forms: ['whole', 'cut'], grade: 'Gourmet · Extraction', moisture: '25–35%', hs: '0905.10' },
  { id: 'ginger', cat: 'roots', name: t8('Ginger', 'Jahe', '生姜', 'الزنجبيل', 'Jengibre', 'Gingembre', 'Ingwer', 'ジンジャー'), latin: 'Zingiber officinale', origin: 'Java · Sumatra', forms: ['fresh', 'sliced', 'ground'], grade: '150 · 200 · 250 g+', moisture: '≤ 12%', hs: '0910.11' },
  { id: 'turmeric', cat: 'roots', name: t8('Turmeric', 'Kunyit', '姜黄', 'الكركم', 'Cúrcuma', 'Curcuma', 'Kurkuma', 'ターメリック'), latin: 'Curcuma longa', origin: 'Java', forms: ['fresh', 'sliced', 'ground'], grade: 'Curcumin 3–5%', moisture: '≤ 10%', hs: '0910.30' },
  { id: 'galangal', cat: 'roots', name: t8('Galangal', 'Lengkuas', '南姜', 'الخولنجان', 'Galanga', 'Galanga', 'Galgant', 'ガランガル'), latin: 'Alpinia galanga', origin: 'Java', forms: ['fresh', 'sliced', 'ground'], grade: 'Red · White', moisture: '≤ 12%', hs: '0910.99' },
  { id: 'cardamom', cat: 'seeds', name: t8('Cardamom', 'Kapulaga', '小豆蔻', 'الهيل', 'Cardamomo', 'Cardamome', 'Kardamom', 'カルダモン'), latin: 'Elettaria cardamomum', origin: 'Java · Sumatra', forms: ['whole', 'ground'], grade: '6–8 mm', moisture: '≤ 12%', hs: '0908.31' },
  { id: 'candlenut', cat: 'seeds', name: t8('Candlenut', 'Kemiri', '石栗', 'جوز الشمع', 'Nuez de la India', 'Noix de bancoul', 'Kerzennuss', 'ククイナッツ'), latin: 'Aleurites moluccanus', origin: 'Flores · Sulawesi · Sumatra', forms: ['whole', 'broken'], grade: 'Whole · Half · Broken', moisture: '≤ 7%', hs: '0802.99' },
];

// Hero is the client's own facility image; all other photos are CC0 / public domain from Wikimedia Commons, so no credit line is needed. Keep it that way, or add credits back.
