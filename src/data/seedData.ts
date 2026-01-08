// 棚割管理システム - 初期データ生成
import {
    REGIONS,
    FMTS
} from './types';
import type {
    Product,
    Store,
    Fixture,
    FMT,
    Region
} from './types';
import {
    productRepository,
    storeRepository,
    fixtureRepository,
    setInitialized,
    clearAllData
} from './repositories/localStorageRepository';

// ダミー画像URL
const NO_IMAGE_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2UwZTBlMCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

// カテゴリ一覧（精肉部門のみ）
const CATEGORIES = [
    '焼肉セット',
    '牛肉',
    '豚肉',
    '鶏肉',
    '挽肉',
    '加工肉',
    'ホルモン',
    '味付肉'
];

// 商品名サンプル
const PRODUCT_NAMES: Record<string, string[]> = {
    '焼肉セット': ['特選カルビセット', '和牛ロースセット', 'ファミリー焼肉セット', 'プレミアム焼肉盛り', 'お手軽BBQセット', '希少部位3種盛り', 'ホルモンMIXセット'],
    '牛肉': ['黒毛和牛サーロイン', '牛バラ切り落とし', '牛タン焼肉用', '牛モモブロック', '牛スネシチュー用', 'サイコロステーキ', '牛ハラミ焼肉用'],
    '豚肉': ['国産豚ロース', '豚バラブロック', '豚こま切れ', '豚ヒレブロック', '生姜焼き用ロース', '豚トントロ', '豚肩ロースしゃぶしゃぶ用'],
    '鶏肉': ['鶏もも肉', '鶏むね肉', '鶏ささみ', '手羽先', '手羽元', '鶏皮', 'ぼんじり'],
    '挽肉': ['牛豚合い挽き肉', '豚ひき肉', '鶏ひき肉', '赤身ひき肉'],
    '加工肉': ['あらびきウインナー', 'ロースハム', 'ベーコンスライス', '生ハム', 'サライ', '厚切りベーコン'],
    'ホルモン': ['牛シマチョウ', '牛マルチョウ', '豚白モツ', '牛レバー', 'センマイ刺し'],
    '味付肉': ['プルコギビーフ', '豚ロース味噌漬け', '鶏肉のバジルソテー', '砂肝のネギ塩だれ']
};

// JANコード生成
function generateJAN(): string {
    const prefix = '49';
    const random = Math.floor(Math.random() * 10000000000).toString().padStart(11, '0');
    return prefix + random;
}

// ランダムな商品サイズ生成
function generateProductSize(): { width: number; height: number; depth: number } {
    const sizes = [
        { width: 5, height: 10, depth: 5 },
        { width: 8, height: 12, depth: 6 },
        { width: 10, height: 15, depth: 8 },
        { width: 12, height: 18, depth: 10 },
        { width: 15, height: 20, depth: 12 },
        { width: 20, height: 25, depth: 15 },
        { width: 6, height: 20, depth: 6 },
        { width: 10, height: 10, depth: 10 },
    ];
    return sizes[Math.floor(Math.random() * sizes.length)];
}

// 商品データ生成
function generateProducts(): Omit<Product, 'id'>[] {
    const products: Omit<Product, 'id'>[] = [];

    for (const category of CATEGORIES) {
        const names = PRODUCT_NAMES[category] || ['商品'];
        for (const name of names) {
            const size = generateProductSize();
            products.push({
                jan: generateJAN(),
                name,
                width: size.width,
                height: size.height,
                depth: size.depth,
                category,
                imageUrl: NO_IMAGE_URL,
                salesRank: Math.floor(Math.random() * 100) + 1 // 1-100のランダム
            });
        }
    }

    return products;
}

// 店舗コード生成
function generateStoreCode(fmt: FMT, index: number): string {
    const fmtCode = fmt.slice(0, 2).toUpperCase();
    return `${fmtCode}${(index + 1).toString().padStart(4, '0')} `;
}

// 店舗名生成
function generateStoreName(region: Region, fmt: FMT, index: number): string {
    const areas: Record<Region, string[]> = {
        '北海道': ['札幌中央', '旭川', '函館', '帯広'],
        '東北': ['仙台', '盛岡', '青森', '秋田'],
        '関東': ['渋谷', '新宿', '池袋', '横浜', '大宮', '千葉'],
        '中部': ['名古屋', '静岡', '新潟', '金沢'],
        '近畿': ['梅田', '難波', '京都', '神戸', '奈良'],
        '中国・四国': ['広島', '岡山', '高松', '松山'],
        '九州': ['福岡', '熊本', '鹿児島', '長崎'],
        '全地域': ['本部']
    };
    const areaList = areas[region];
    const area = areaList[index % areaList.length];
    return `${area}${fmt} 店`;
}

// 店舗データ生成
function generateStores(): Omit<Store, 'id'>[] {
    const stores: Omit<Store, 'id'>[] = [];
    const regionsToUse = REGIONS.filter(r => r !== '全地域');

    let storeIndex = 0;
    for (const fmt of FMTS) {
        for (const region of regionsToUse) {
            // 各FMT×地域で2-3店舗生成
            const storeCount = Math.floor(Math.random() * 2) + 2;
            for (let i = 0; i < storeCount; i++) {
                stores.push({
                    code: generateStoreCode(fmt, storeIndex),
                    name: generateStoreName(region, fmt, i),
                    fmt,
                    region
                });
                storeIndex++;
            }
        }
    }

    return stores;
}

// 什器データ生成
function generateFixtures(): Omit<Fixture, 'id'>[] {
    const fixtures: Omit<Fixture, 'id'>[] = [];

    // 標準的な棚什器サイズ
    const fixtureTemplates = [
        { name: '標準棚A', width: 90, height: 180, shelfCount: 5 },
        { name: '標準棚B', width: 120, height: 180, shelfCount: 5 },
        { name: '大型棚', width: 150, height: 200, shelfCount: 6 },
        { name: 'コンパクト棚', width: 60, height: 150, shelfCount: 4 },
        { name: 'ワイド棚', width: 180, height: 180, shelfCount: 5 },
        { name: '冷蔵ケース', width: 120, height: 200, shelfCount: 4 },
        { name: 'エンド什器', width: 90, height: 150, shelfCount: 4 },
        { name: 'ゴンドラ什器', width: 100, height: 180, shelfCount: 5 }
    ];

    const manufacturers = ['メーカーA', 'メーカーB', 'メーカーC'];

    for (const template of fixtureTemplates) {
        const today = new Date();
        const installDate = new Date(today);
        installDate.setMonth(installDate.getMonth() - Math.floor(Math.random() * 24)); // 過去2年以内

        const warrantyEnd = new Date(installDate);
        warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 3); // 3年保証

        fixtures.push({
            ...template,
            manufacturer: manufacturers[Math.floor(Math.random() * manufacturers.length)],
            modelNumber: `MODEL - ${Math.floor(Math.random() * 1000).toString().padStart(4, '0')} `,
            installDate: installDate.toISOString().split('T')[0],
            warrantyEndDate: warrantyEnd.toISOString().split('T')[0]
        });
    }

    return fixtures;
}

// 初期データ投入のメイン関数
export async function seedData(): Promise<{
    products: number;
    stores: number;
    fixtures: number;
}> {
    // 既存データをクリア
    await clearAllData();

    // 商品データ生成・保存
    const productsData = generateProducts();
    for (const product of productsData) {
        await productRepository.create(product);
    }

    // 店舗データ生成・保存
    const storesData = generateStores();
    for (const store of storesData) {
        await storeRepository.create(store);
    }

    // 什器データ生成・保存
    const fixturesData = generateFixtures();
    for (const fixture of fixturesData) {
        await fixtureRepository.create(fixture);
    }

    // 初期化完了フラグをセット
    await setInitialized(true);

    return {
        products: productsData.length,
        stores: storesData.length,
        fixtures: fixturesData.length
    };
}

// 初期化チェック用エクスポート（再エクスポート）
export { isInitialized } from './repositories/localStorageRepository';
