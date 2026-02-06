// import {
//     REGIONS,
//     FMTS
// } from './types';
import type {
    Product,
    Store,
    Fixture,
    FMT,
    Region,
    ShelfBlock,
    StandardPlanogram,
    StorePlanogram,
    StoreFixturePlacement,
    FixtureType
} from './types';
import {
    productRepository,
    storeRepository,
    fixtureRepository,
    shelfBlockRepository,
    standardPlanogramRepository,
    storePlanogramRepository,
    storeFixturePlacementRepository,
    setInitialized,
    clearAllData
} from './repositories/localStorageRepository';
import { generateRandomMetrics } from '../utils/metricsGenerator';

// ダミー画像URL
const NO_IMAGE_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2UwZTBlMCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

// カテゴリ一覧(精肉部門のみ)
const CATEGORIES = [
    '焼肉セット',
    '牛肉',
    '豚肉',
    '鶏肉',
    '挽肉',
    '加工肉',
    'ホルモン',
    '味付肉',
    '骨付き肉',
    'おつまみ'
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
    '味付肉': ['プルコギビーフ', '豚ロース味噌漬け', '鶏肉のバジルソテー', '砂肝のネギ塩だれ'],
    '骨付き肉': ['スペアリブ', '骨付きラム肉', '豚足', 'テール', '鶏ガラ'],
    'おつまみ': ['ビーフジャーキー', 'サラミソーセージ', 'ミミガー', '酢モツ', '焼き豚足', 'スモークタン', '砂肝黒胡椒焼き']
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
            const metrics = generateRandomMetrics();

            products.push({
                jan: generateJAN(),
                name,
                width: size.width,
                height: size.height,
                depth: size.depth,
                category,
                imageUrl: NO_IMAGE_URL,
                salesRank: Math.floor(Math.random() * 100) + 1, // 1-100のランダム
                // 分析用メトリクスを追加
                quantity: metrics.quantity,
                sales: metrics.sales,
                grossProfit: metrics.grossProfit,
                traffic: metrics.traffic,
                spendPerCustomer: metrics.spendPerCustomer,

                // 階層データ設定 - カテゴリから推論してダミー設定
                divisionName: category === '生花' ? '住居余暇事業部' : '食品事業部',
                divisionSubName: category === '生花' ? 'ライフスタイル' : 'グロサリー',
                lineName: category === '生花' ? '園芸' : '一般食品',
                departmentName: ['牛肉', '豚肉', '鶏肉'].includes(category) ? '精肉部' :
                    ['スナック', 'チョコ', 'キャンディ'].includes(category) ? '菓子部' :
                        category === '生花' ? '花卉部' : '一般食品部',
                categoryName: category,
                subCategoryName: category === '牛肉' ? (Math.random() > 0.5 ? '国産牛' : '輸入牛') :
                    category === 'スナック' ? (Math.random() > 0.5 ? 'ポテト' : 'コーン') :
                        category + 'その他',
                segmentName: 'セグメント-' + category,
                subSegmentName: 'サブセグメント-' + category
            });
        }
    }

    return products;
}

// 提供された店舗データ
const RAW_STORE_DATA = [
    { zone: '筑豊', name: '上三緒', fmt: 'SuC' },
    { zone: '東関東', name: '北茨城', fmt: 'SuC' },
    { zone: '北北海道', name: '小樽塩谷', fmt: 'SuC' },
    { zone: '中部', name: '四日市富田', fmt: 'SuC' },
    { zone: '北九州', name: '石田', fmt: 'SuC' },
    { zone: '南九州', name: '大牟田', fmt: 'SuC' },
    { zone: '山陰', name: '境港', fmt: 'SuC' },
    { zone: '福岡', name: '日田', fmt: 'SuC' },
    { zone: '北九州', name: '西港', fmt: 'SuC' },
    { zone: '東関東', name: '小見川', fmt: 'SuC' },
    { zone: '西関東', name: '笠懸', fmt: 'SuC' },
    { zone: '西九州', name: '時津', fmt: 'SuC' },
    { zone: '山陰', name: '叶', fmt: 'SuC' },
    { zone: '東九州', name: '西都', fmt: 'SuC' },
    { zone: '山口', name: '大竹', fmt: 'SuC' },
    { zone: '南九州', name: '山鹿', fmt: 'SuC' },
    { zone: '福岡', name: '柳川西蒲池', fmt: 'SuC' },
    { zone: '南北海道', name: '上磯', fmt: 'SuC' },
    { zone: '筑豊', name: '宗像', fmt: 'SuC' },
    { zone: '中部', name: '岐南八剣', fmt: 'SuC' },
    { zone: '中部', name: '久保', fmt: 'SuC' },
    { zone: '西関西', name: '養父', fmt: 'SuC' },
    { zone: '山口', name: '柳井', fmt: 'SuC' },
    { zone: '東関西', name: '桜井粟殿', fmt: 'SuC' },
    { zone: '中部', name: '幸田', fmt: 'SuC' },
    { zone: '山口', name: '宇部', fmt: 'SuC' },
    { zone: '中部', name: '伊勢', fmt: 'SuC' },
    { zone: '山陰', name: '益田', fmt: 'SuC' },
    { zone: '西九州', name: '嬉野', fmt: 'SuC' },
    { zone: '東九州', name: '日南', fmt: 'SuC' },
    { zone: '東関西', name: '草津矢橋', fmt: 'SuC' },
    { zone: '山陰', name: '雲南', fmt: 'SuC' },
    { zone: '南九州', name: '隼人', fmt: 'SuC' },
    { zone: '北北海道', name: '小樽朝里', fmt: 'SuC' },
    { zone: '東関西', name: '宝来', fmt: 'SuC' },
    { zone: '東九州', name: '都農', fmt: 'SuC' },
    { zone: '西九州', name: '唐津', fmt: 'SuC' },
    { zone: '東関西', name: '湖南', fmt: 'SuC' },
    { zone: '山陰', name: '琴浦', fmt: 'SuC' },
    { zone: '西関東', name: '間々田', fmt: 'SuC' },
    { zone: '西九州', name: '大町', fmt: 'SuC' },
    { zone: '山口', name: '宇部中央', fmt: 'SuC' },
    { zone: '南九州', name: '八代', fmt: 'SuC' },
    { zone: '西九州', name: '千代田', fmt: 'SuC' },
    { zone: '西九州', name: '上峰', fmt: 'SuC' },
    { zone: '西関東', name: '板倉', fmt: 'SuC' },
    { zone: '中部', name: '浜松若林', fmt: 'SuC' },
    { zone: '南九州', name: '鹿屋', fmt: 'SuC' },
    { zone: '北九州', name: '行橋上津熊', fmt: 'SuC' },
    { zone: '南九州', name: '出水黄金', fmt: 'SuC' },
    { zone: '東九州', name: '新富', fmt: 'SuC' },
    { zone: '西関西', name: '箕面森町', fmt: 'SuC' },
    { zone: '東北', name: '滝沢', fmt: 'SuC' },
    { zone: '東北', name: 'おいらせ', fmt: 'SuC' },
    { zone: '中部', name: '半田亀崎', fmt: 'SuC' },
    { zone: '北北海道', name: '北見中ノ島', fmt: 'SuC' },
    { zone: '西関東', name: '藤沢羽鳥', fmt: 'SuC' },
    { zone: '東関西', name: '天理', fmt: 'SuC' },
    { zone: '南九州', name: '新八代駅前', fmt: 'SuC' },
    { zone: '東九州', name: '日向日知屋', fmt: 'SuC' },
    { zone: '東九州', name: '敷戸', fmt: 'SuC' },
    { zone: '西関西', name: '三田', fmt: 'SuC' },
    { zone: '西九州', name: 'みやき', fmt: 'SuC' },
    { zone: '東関西', name: '滋賀大津', fmt: 'SuC' },
    { zone: '南北海道', name: '苫小牧西', fmt: 'SuC' },
    { zone: '東北', name: '十和田', fmt: 'SuC' },
    { zone: '北北海道', name: '岩見沢', fmt: 'SuC' },
    { zone: '筑豊', name: '直方', fmt: 'SuC' },
    { zone: '北北海道', name: '厚別', fmt: 'SuC' },
    { zone: '東北', name: '花巻', fmt: 'SuC' },
    { zone: '西関西', name: '摂津南', fmt: 'SuC' },
    { zone: '南九州', name: '宇城', fmt: 'SuC' },
    { zone: '南北海道', name: '登別栄町', fmt: 'SuC' },
    { zone: '東関西', name: '大和小泉', fmt: 'SuC' },
    { zone: '山口', name: '際波', fmt: 'SuC' },
    { zone: '北北海道', name: '北見並木', fmt: 'SuC' },
    { zone: '東関東', name: '八幡宿', fmt: 'SuC' },
    { zone: '東北', name: '水沢上姉体', fmt: 'SuC' },
    { zone: '筑豊', name: '田川後藤寺', fmt: 'SuC' },
    { zone: '東北', name: '北上', fmt: 'SuC' },
    { zone: '東関西', name: '橿原', fmt: 'SuC' },
    { zone: '筑豊', name: '遠賀', fmt: 'SuC' },
    { zone: '北九州', name: '二島', fmt: 'SuC' },
    { zone: '北九州', name: '玉津', fmt: 'SuC' },
    { zone: '西関東', name: '甲府昭和', fmt: 'SuC' },
    { zone: '西関西', name: '和泉', fmt: 'SuC' },
    { zone: '東関東', name: '那須塩原', fmt: 'SuC' },
    { zone: '山口', name: '長府', fmt: 'SuC' },
    { zone: '筑豊', name: '飯塚庄内', fmt: 'SuC' },
    { zone: '南北海道', name: 'グランディールイチイ', fmt: 'SuC' },
    { zone: '南九州', name: '益城台', fmt: 'SuC' },
    { zone: '東北', name: '大和まほろば', fmt: 'SuC' },
    { zone: '東北', name: '塩釜', fmt: 'SuC' },
    { zone: '西関西', name: '富田林', fmt: 'SuC' },
    { zone: '北北海道', name: '砂川', fmt: 'SuC' },
    { zone: '山陰', name: '出雲白枝', fmt: 'SuC' },
    { zone: '南北海道', name: '千歳清流', fmt: 'SuC' },
    { zone: '山口', name: '下松', fmt: 'SuC' },
    { zone: '東関西', name: '近江八幡', fmt: 'SuC' },
    { zone: '東九州', name: '宮崎恒久', fmt: 'SuC' },
    { zone: '四国', name: '三豊', fmt: 'SuC' },
    { zone: '西九州', name: '大村', fmt: 'SuC' },
    { zone: '南九州', name: '宇土', fmt: 'SuC' },
    { zone: '西関西', name: '明石西インター', fmt: 'SuC' },
    { zone: '福岡', name: 'アイランドシティ', fmt: 'SuC' },
    { zone: '中部', name: '四日市南', fmt: 'SuC' },
    { zone: '中部', name: 'みえ朝日', fmt: 'SuC' },
    { zone: '山陰', name: '松江', fmt: 'SuC' },
    { zone: '南北海道', name: '苫小牧東', fmt: 'SuC' },
    { zone: '山陰', name: '米子大谷', fmt: 'SuC' },
    { zone: '東北', name: '錦ケ丘', fmt: 'SuC' },
    { zone: '西関西', name: '二色浜', fmt: 'SuC' },
    { zone: '南九州', name: '鹿屋上野町', fmt: 'SuC' },
    { zone: '南九州', name: '尾ノ上', fmt: 'SuC' },
    { zone: '東関東', name: '大田原', fmt: 'SuC' },
    { zone: '山陰', name: '出雲斐川', fmt: 'SuC' },
    { zone: '西九州', name: '三日月', fmt: 'SuC' },
    { zone: '四国', name: '三木', fmt: 'SuC' },
    { zone: '中部', name: '玉垣', fmt: 'SuC' },
    { zone: '福岡', name: '八女', fmt: 'SuC' },
    { zone: '南北海道', name: '別保', fmt: 'SuC' },
    { zone: '西関西', name: '岩出', fmt: 'SuC' },
    { zone: '山口', name: '周南', fmt: 'SuC' },
    { zone: '東関東', name: 'かすみがうら', fmt: 'SuC' },
    { zone: '中部', name: '安八', fmt: 'SuC' },
    { zone: '東北', name: '名取', fmt: 'SuC' },
    { zone: '東北', name: '亘理', fmt: 'SuC' },
    { zone: '東関東', name: '笠間', fmt: 'SuC' },
    { zone: '東九州', name: '加納', fmt: 'SuC' },
    { zone: '西関西', name: '守口ジャガータウン', fmt: 'SuC' },
    { zone: '南北海道', name: '幕別', fmt: 'SuC' },
    { zone: '西九州', name: '佐賀大和', fmt: 'SuC' },
    { zone: '南北海道', name: '釧路川端', fmt: 'SuC' },
    { zone: '福岡', name: '甘木', fmt: 'SuC' },
    { zone: '北九州', name: '豊前', fmt: 'SuC' },
    { zone: '南北海道', name: '恵庭島松', fmt: 'SuC' },
    { zone: '北北海道', name: '手稲', fmt: 'SuC' },
    { zone: '東北', name: '利府', fmt: 'SuC' },
    { zone: '東九州', name: '三重', fmt: 'SuC' },
    { zone: '南北海道', name: '帯広東', fmt: 'SuC' },
    { zone: '東関東', name: '八街', fmt: 'SuC' },
    { zone: '福岡', name: '久留米', fmt: 'SuC' },
    { zone: '山陰', name: '大田', fmt: 'SuC' },
    { zone: '北九州', name: '門司', fmt: 'SuC' },
    { zone: '南北海道', name: '益浦', fmt: 'SuC' },
    { zone: '福岡', name: '久留米上津', fmt: 'SuC' },
    { zone: '北九州', name: '上毛', fmt: 'SuC' },
    { zone: '北北海道', name: '手稲星置', fmt: 'SuC' },
    { zone: '福岡', name: '大刀洗', fmt: 'SuC' },
    { zone: '東関東', name: '旭川口', fmt: 'SuC' },
    { zone: '中部', name: '関', fmt: 'SuC' },
    { zone: '南北海道', name: '室蘭東', fmt: 'SuC' },
    { zone: '南北海道', name: '室蘭本輪西', fmt: 'SuC' },
    { zone: '東関西', name: '野々市', fmt: 'SuC' },
    { zone: '筑豊', name: '東水巻', fmt: 'SuC' },
    { zone: '山口', name: '東岐波', fmt: 'SuC' },
    { zone: '中部', name: '名古屋茶屋', fmt: 'SuC' },
    { zone: '西関西', name: '姫路', fmt: 'SuC' },
    { zone: '東九州', name: '大道', fmt: 'SuC' },
    { zone: '北九州', name: '東篠崎', fmt: 'SuC' },
    { zone: '北九州', name: '北空', fmt: 'SuC' },
    { zone: '北九州', name: '中津', fmt: 'SuC' },
    { zone: '筑豊', name: '水巻', fmt: 'SuC' },
    { zone: '東九州', name: '小林', fmt: 'SuC' },
    { zone: '西九州', name: '佐世保大和', fmt: 'SuC' },
    { zone: '北九州', name: '苅田', fmt: 'SuC' },
    { zone: '西九州', name: '武雄富岡', fmt: 'SuC' },
    { zone: '東九州', name: '別府', fmt: 'SuC' },
    { zone: '山陰', name: '鳥取大杙', fmt: 'SuC' },
    { zone: '筑豊', name: '田川', fmt: 'SuC' },
    { zone: '西九州', name: '鹿島', fmt: 'SuC' },
    { zone: '筑豊', name: '桂川', fmt: 'SuC' },
    { zone: '筑豊', name: '古賀花見', fmt: 'SuC' },
    { zone: '北九州', name: '行橋', fmt: 'SuC' },
    { zone: '東九州', name: '下郡', fmt: 'SuC' },
    { zone: '東関東', name: '長沼', fmt: 'SuC' },
    { zone: '東九州', name: '皆春', fmt: 'SuC' },
    { zone: '中部', name: '津藤方', fmt: 'SuC' },
    { zone: '山口', name: '防府', fmt: 'SuC' },
    { zone: '東九州', name: '坂ノ市', fmt: 'SuC' },
    { zone: '中部', name: '松阪', fmt: 'SuC' },
    { zone: '西関西', name: '赤穂', fmt: 'SuC' },
    { zone: '北九州', name: '八幡東田', fmt: 'SuC' },
    { zone: '南九州', name: '加治木', fmt: 'SuC' },
    { zone: '筑豊', name: '宮田', fmt: 'SuC' },
    { zone: '東九州', name: '都城都北', fmt: 'SuC' },
    { zone: '東関西', name: '富山マイプラザ', fmt: 'SuC' },
    { zone: '四国', name: '丸亀', fmt: 'SuC' },
    { zone: '西関東', name: '小山', fmt: 'SuC' },
    { zone: '四国', name: '東岡山', fmt: 'SuC' },
    { zone: '西関東', name: '足利', fmt: 'SuC' },
    { zone: '西関西', name: '阪南', fmt: 'SuC' },
    { zone: '筑豊', name: '福智', fmt: 'SuC' },
    { zone: '山陰', name: '鳥取千代水', fmt: 'SuC' },
    { zone: '西九州', name: '島原', fmt: 'SuC' },
    { zone: '南九州', name: '東開', fmt: 'SuC' },
    { zone: '西九州', name: '諫早', fmt: 'SuC' },
    { zone: '東九州', name: '三股', fmt: 'SuC' },
    { zone: '福岡', name: '須恵', fmt: 'SuC' },
    { zone: '筑豊', name: '鞍手', fmt: 'SuC' },
    { zone: '東関東', name: 'つくば', fmt: 'SuC' },
    { zone: '西関西', name: '寝屋川大成', fmt: 'SuC' },
    { zone: '筑豊', name: '飯塚', fmt: 'SuC' },
    { zone: '北九州', name: '門司片上', fmt: 'SuC' },
    { zone: '東北', name: '伊達保原', fmt: 'SuC' },
    { zone: '筑豊', name: '小竹', fmt: 'SuC' },
    { zone: '筑豊', name: '上津役', fmt: 'SuC' },
    { zone: '東関西', name: '御所', fmt: 'SuC' },
    { zone: '西九州', name: '唐津中原', fmt: 'SuC' },
    { zone: '中部', name: '掛川', fmt: 'SuC' },
    { zone: '西九州', name: '東長崎店', fmt: 'SMART' },
    { zone: '東関西', name: '彦根', fmt: 'MEGA' },
    { zone: '東関東', name: '宇都宮', fmt: 'MEGA' },
    { zone: '筑豊', name: '新宮', fmt: 'MEGA' },
    { zone: '東関西', name: '善通寺店', fmt: 'MEGA' },
    { zone: '南九州', name: '上熊本', fmt: 'MEGA' },
    { zone: '筑豊', name: '浜田', fmt: 'MEGA' },
    { zone: '東関東', name: '郡山八山田', fmt: 'MEGA' },
    { zone: '南九州', name: '大津', fmt: 'MEGA' },
    { zone: '南九州', name: '荒尾店', fmt: 'MEGA' },
    { zone: '東関東', name: '桜の郷店', fmt: 'MEGA' },
    { zone: '北北海道', name: '伏古', fmt: 'MEGA' },
    { zone: '福岡', name: '糸島荻浦店', fmt: 'SMART' },
    { zone: '南九州', name: 'わさだ', fmt: 'MEGA' },
    { zone: '天草', name: '本渡', fmt: 'FC' },
    { zone: '西関西', name: '武庫川', fmt: 'SMART' },
    { zone: '筑豊', name: '中間', fmt: 'MEGA' },
    { zone: '山口', name: '新下関', fmt: 'SMART' },
    { zone: '北北海道', name: '月寒', fmt: 'SMART' },
    { zone: '福岡', name: '那珂川', fmt: 'SMART' },
    { zone: '天草', name: 'R太陽', fmt: 'FC' },
    { zone: '福岡', name: '田村', fmt: 'SMART' },
    { zone: '北北海道', name: '屯田', fmt: 'SMART' },
    { zone: '東北', name: '八戸', fmt: 'SMART' },
    { zone: '福岡', name: '今宿', fmt: 'SMART' },
    { zone: '東関西', name: 'りんくう', fmt: 'MEGA' },
    { zone: '北北海道', name: '新発寒', fmt: 'SMART' },
    { zone: '東関西', name: '東九条', fmt: 'SMART' },
    { zone: '東関東', name: '盛岡西ＢＰ', fmt: 'MEGA' },
    { zone: '福岡', name: '粕屋', fmt: 'SMART' },
    { zone: '西関東', name: '南ア', fmt: 'MEGA' },
    { zone: '福岡', name: '宇美', fmt: 'SMART' },
    { zone: '西関東', name: '伊勢崎中央', fmt: 'MEGA' },
    { zone: '筑豊', name: '福岡空港', fmt: 'MEGA' },
    { zone: '西九州', name: '伊万里', fmt: 'SMART' },
    { zone: '福岡', name: 'アクロスプラザ篠栗店', fmt: 'SMART' },
    { zone: '北北海道', name: '野幌', fmt: 'SMART' },
    { zone: '筑豊', name: '筑後', fmt: 'MEGA' },
    { zone: '北北海道', name: '旭川', fmt: 'MEGA' },
    { zone: '西関東', name: '酒々井', fmt: 'MEGA' },
    { zone: '北北海道', name: '神楽', fmt: 'SMART' },
    { zone: '福岡', name: '筑紫野', fmt: 'SMART' },
    { zone: '西関東', name: '八千代', fmt: 'MEGA' },
    { zone: '首都圏', name: '成田', fmt: 'SMART' },
    { zone: '中部', name: 'オーキッドパーク', fmt: 'SMART' },
    { zone: '東関東', name: '筑西', fmt: 'MEGA' },
    { zone: '南九州', name: '日向', fmt: 'MEGA' },
    { zone: '東関東', name: '石下', fmt: 'MEGA' },
    { zone: '西関東', name: '上里', fmt: 'MEGA' },
    { zone: '南北海道', name: '北美原', fmt: 'SMART' },
    { zone: '筑豊', name: '福津店', fmt: 'SMART' },
    { zone: '東関西', name: '大府', fmt: 'MEGA' },
    { zone: '西九州', name: '佐世保大塔店', fmt: 'SMART' },
    { zone: '北北海道', name: '琴似', fmt: 'SMART' },
    { zone: '首都圏', name: '上尾小泉店', fmt: 'SMART' },
    { zone: '山口', name: '小月', fmt: 'SMART' },
    { zone: '弘前', name: 'むつ新町', fmt: 'SMART' },
    { zone: '首都圏', name: '騎西', fmt: 'SMART' },
    { zone: '西関東', name: '西花輪', fmt: 'SMART' },
    { zone: '西関東', name: '藤岡宮本店', fmt: 'SMART' },
    { zone: '福岡', name: '和白', fmt: 'SMART' },
    { zone: '弘前', name: '五所川原新宮', fmt: 'SMART' },
    { zone: '西関東', name: '富岡バイパス店', fmt: 'SMART' },
    { zone: '弘前', name: '平賀', fmt: 'SMART' },
    { zone: '弘前', name: '岩木', fmt: 'SMART' },
    { zone: '西関東', name: '安中', fmt: 'SMART' },
    { zone: '弘前', name: '浜の町', fmt: 'SMART' },
    { zone: '弘前', name: '城東', fmt: 'SMART' },
    { zone: '弘前', name: '常盤', fmt: 'SMART' },
    { zone: '弘前', name: '相馬', fmt: 'SMART' },
    { zone: '東関東', name: '菅谷', fmt: 'SMART' },
    { zone: '弘前', name: '広田', fmt: 'SMART' },
    { zone: '西関東', name: '江南', fmt: 'SMART' },
    { zone: '東関東', name: '西那須野', fmt: 'SMART' },
    { zone: '弘前', name: '大原', fmt: 'SMART' },
    { zone: '南九州', name: '清水', fmt: 'SMART' },
    { zone: '東関東', name: '牛久', fmt: 'SMART' },
    { zone: '北北海道', name: '江別大麻', fmt: 'SMART' },
    { zone: '弘前', name: '平川尾上', fmt: 'SMART' },
    { zone: '東北', name: '安積', fmt: 'SMART' },
    { zone: '弘前', name: '木造', fmt: 'SMART' },
    { zone: '弘前', name: '板柳', fmt: 'SMART' },
    { zone: '福岡', name: '池尻', fmt: 'GO' },
    { zone: '弘前', name: '金木', fmt: 'SMART' },
    { zone: '弘前', name: '下町', fmt: 'SMART' },
    { zone: '福岡', name: '春日公園', fmt: 'SMART' },
    { zone: '南北海道', name: '大成', fmt: 'SMART' },
    { zone: '首都圏', name: '佐知川', fmt: 'SMART' },
    { zone: '弘前', name: '森田', fmt: 'SMART' },
    { zone: '福岡', name: 'GO芦屋山鹿', fmt: 'SMART' },
    { zone: '弘前', name: '浪岡', fmt: 'SMART' },
    { zone: '福岡', name: 'GO志免南里', fmt: 'SMART' },
    { zone: '弘前', name: '高杉', fmt: 'SMART' },
    { zone: '東関東', name: 'ひたちなか', fmt: 'SMART' },
    { zone: '福岡', name: '稲築', fmt: 'SMART' },
    { zone: '福岡', name: 'GO宮若福丸', fmt: 'SMART' },
    { zone: '西関東', name: '太田由良', fmt: 'SMART' },
    { zone: '福岡', name: 'GO脇田', fmt: 'SMART' },
    { zone: '西関西', name: '寝屋川', fmt: 'SMART' },
    { zone: '首都圏', name: '上尾', fmt: 'SMART' },
    { zone: '西関東', name: '深谷', fmt: 'SMART' },
    { zone: '山口', name: 'GO下関生野', fmt: 'GO' },
    { zone: '首都圏', name: '東金求名', fmt: 'GO' },
    { zone: '西関東', name: '館林', fmt: 'SMART' },
    { zone: '首都圏', name: '北越谷', fmt: 'SMART' },
    { zone: '福岡', name: '目尾', fmt: 'GO' },
    { zone: '首都圏', name: '江戸川台', fmt: 'SMART' },
    { zone: '西関東', name: '高崎中泉', fmt: 'SMART' },
    { zone: '首都圏', name: '桜川', fmt: 'SMART' },
    { zone: '東関東', name: 'あすみが丘', fmt: 'SMART' },
    { zone: '首都圏', name: '大子', fmt: 'SMART' },
    { zone: '福岡', name: 'GO今泉２丁目', fmt: 'GO' },
    { zone: '福岡', name: '戸畑浅生店', fmt: 'GO' },
    { zone: '西関東', name: '韮崎', fmt: 'SMART' },
    { zone: '福岡', name: '曰佐', fmt: 'GO' },
    { zone: '福岡', name: '別府3丁目店', fmt: 'GO' },
    { zone: '東関東', name: '水戸南', fmt: 'SMART' },
    { zone: '福岡', name: 'GO原田１丁目', fmt: 'GO' },
    { zone: '福岡', name: 'GO下曽根駅南', fmt: 'GO' },
    { zone: '首都圏', name: '矢板', fmt: 'SMART' },
    { zone: '福岡', name: 'GO戸畑小芝', fmt: 'GO' },
    { zone: '福岡', name: 'グロッサリア大野城まどかぴあ前', fmt: 'GO' },
    { zone: '福岡', name: 'GO塩原3丁目', fmt: 'GO' },
    { zone: '首都圏', name: '鉾田', fmt: 'SMART' },
    { zone: '福岡', name: 'GO多の津', fmt: 'GO' },
    { zone: '首都圏', name: 'トライアルドラッグ茂木', fmt: 'SMART' },
    { zone: '首都圏', name: 'ドラッグ益子', fmt: 'SMART' },
    { zone: '福岡', name: 'GO片縄9丁目', fmt: 'GO' },
    { zone: '首都圏', name: '八街北', fmt: 'GO' },
    { zone: '福岡', name: 'GO比恵町', fmt: 'GO' },
    { zone: '首都圏', name: '馬頭', fmt: 'SMART' },
    { zone: '福岡', name: '今川2丁目店', fmt: 'GO' },
    { zone: '福岡', name: '高宮1丁目店', fmt: 'GO' },
    { zone: '首都圏', name: 'NEXMART01GO', fmt: 'GO' },
    { zone: '福岡', name: 'GO篠栗尾仲', fmt: 'GO' },
    { zone: '福岡', name: 'GO藤崎駅前', fmt: 'GO' },
    { zone: '福岡', name: 'GO麦野5丁目', fmt: 'GO' },
    { zone: '福岡', name: 'GO飯塚幸袋', fmt: 'GO' },
    { zone: '首都圏', name: '石岡東光台', fmt: 'SMART' },
    { zone: '福岡', name: 'GO戸畑一枝', fmt: 'GO' },
    { zone: '首都圏', name: '野田', fmt: 'SMART' },
    { zone: '首都圏', name: '那珂', fmt: 'SMART' },
    { zone: '東北', name: '喜久田', fmt: 'SMART' }
];

// ゾーンを地域に変換
function mapZoneToRegion(zone: string): Region {
    switch (zone) {
        case '北北海道':
        case '南北海道':
            return '北海道';
        case '東北':
        case '弘前':
            return '東北';
        case '東関東':
        case '西関東':
        case '首都圏':
            return '関東';
        case '中部':
            return '中部';
        case '東関西':
        case '西関西':
            return '近畿';
        case '山陰':
        case '山口':
        case '四国':
            return '中国・四国';
        case '北九州':
        case '南九州':
        case '西九州':
        case '東九州':
        case '福岡':
        case '筑豊':
        case '天草':
            return '九州';
        default:
            return '全地域';
    }
}

// 店舗コード生成
function generateStoreCode(fmt: FMT, index: number): string {
    const fmtCode = fmt.substring(0, 2).toUpperCase();
    return `${fmtCode}${(index + 1).toString().padStart(4, '0')}`;
}

// 店舗データ生成
function generateStores(): Omit<Store, 'id'>[] {
    return RAW_STORE_DATA.map((data, index) => {
        // FMTの型アサーション（実際にはバリデーション推奨）
        const fmt = data.fmt as FMT;
        const region = mapZoneToRegion(data.zone);

        return {
            code: generateStoreCode(fmt, index),
            name: `${data.name}店`,
            fmt,
            region
        };
    });
}

// 什器データ生成
function generateFixtures(): Omit<Fixture, 'id'>[] {
    const fixtures: Omit<Fixture, 'id'>[] = [];

    // 標準的な棚什器サイズ
    const fixtureTemplates = [
        { name: '標準棚A', width: 90, height: 180, shelfCount: 5, fixtureType: 'gondola' as const },
        { name: '標準棚B', width: 120, height: 180, shelfCount: 5, fixtureType: 'gondola' as const },
        { name: '大型棚', width: 150, height: 200, shelfCount: 6, fixtureType: 'gondola' as const },
        { name: 'コンパクト棚', width: 60, height: 150, shelfCount: 4, fixtureType: 'gondola' as const },
        { name: 'ワイド棚', width: 180, height: 180, shelfCount: 5, fixtureType: 'gondola' as const },
        { name: '冷蔵ケース', width: 120, height: 200, shelfCount: 4, fixtureType: 'flat-refrigerated' as const },
        { name: 'エンド什器', width: 90, height: 150, shelfCount: 4, fixtureType: 'end-cap-refrigerated' as const },
        { name: 'ゴンドラ什器', width: 100, height: 180, shelfCount: 5, fixtureType: 'gondola' as const },
        // 精肉部門用什器
        { name: '多段棚（4尺）', width: 120, height: 180, shelfCount: 4, fixtureType: 'multi-tier' as const },
        { name: '平台冷蔵', width: 120, height: 100, shelfCount: 1, fixtureType: 'flat-refrigerated' as const },
        { name: '平台冷蔵エンド', width: 90, height: 100, shelfCount: 1, fixtureType: 'end-cap-refrigerated' as const },
        { name: '平台冷凍', width: 120, height: 100, shelfCount: 1, fixtureType: 'flat-frozen' as const },
        { name: '平台冷凍エンド', width: 150, height: 100, shelfCount: 1, fixtureType: 'end-cap-frozen' as const }
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

// テスト用棚ブロック生成
// テスト用棚ブロック生成
function generateSeedShelfBlocks(products: Product[], shelfCount: number = 5, suffix: string = ''): Omit<ShelfBlock, 'id'>[] {
    const blockTypes = [
        { name: `テスト棚ブロック（牛肉）${suffix}`, category: '牛肉' },
        { name: `テスト棚ブロック（豚肉）${suffix}`, category: '豚肉' },
        { name: `テスト棚ブロック（鶏肉）${suffix}`, category: '鶏肉' },
    ];

    return blockTypes.map(type => {
        const categoryProducts = products.filter(p => p.category === type.category);
        const sourceProducts = categoryProducts.length > 0 ? categoryProducts : products.slice(0, 10);

        const placements: any[] = [];
        const BLOCK_WIDTH = 120;
        let pIdx = 0;
        console.log(`Generating blocks for ${type.name} with shelfCount: ${shelfCount}`);

        for (let i = 0; i < shelfCount; i++) {
            let currentX = 0;

            while (currentX < BLOCK_WIDTH) {
                const product = sourceProducts[pIdx % sourceProducts.length];
                const width = product.width || 10;

                const remainingWidth = BLOCK_WIDTH - currentX;
                const maxFaces = Math.floor(remainingWidth / width);

                if (maxFaces === 0) break;

                let faces = 1;
                if (maxFaces >= 2) {
                    const targetFaces = Math.floor(Math.random() * 5) + 4;
                    faces = Math.min(targetFaces, maxFaces);
                }

                placements.push({
                    id: crypto.randomUUID(),
                    productId: product.id,
                    shelfIndex: i,
                    positionX: currentX,
                    faceCount: faces
                });

                currentX += width * faces;
                pIdx++;
            }
        }

        return {
            name: type.name,
            width: BLOCK_WIDTH,
            height: shelfCount * 35 + 10, // 簡易計算
            shelfCount: shelfCount,
            productPlacements: placements,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    });
}

// テスト店舗用什器配置生成
// 配置イメージ（添付画像に基づく）:
// - 多段: 52尺（4尺棚 x 13本 = 120cm x 13 = 1560cm）
// - 平台冷蔵: 48尺（120cm x 12 = 1440cm）
// - 平台冷蔵エンド: 15尺（90cm x 5 = 450cm、または 150cm + 90cm x 2 + 120cm）
// - 平台冷凍: 16尺（120cm x 4 = 480cm）
// - 平台冷凍エンド: 5尺（150cm x 1 = 150cm）
function generateSeedStoreFixtures(storeId: string, fixtures: Fixture[]): Omit<StoreFixturePlacement, 'id'>[] {
    const placements: Omit<StoreFixturePlacement, 'id'>[] = [];

    // 各什器タイプを取得
    const multiTierFixture = fixtures.find(f => f.name === '多段棚（4尺）') || fixtures.find(f => f.name === '標準棚B') || fixtures[0];
    const refrigeratedFlat = fixtures.find(f => f.name === '平台冷蔵') || fixtures.find(f => f.name === '冷蔵ケース') || fixtures[1];
    const refrigeratedFlatEnd = fixtures.find(f => f.name === '平台冷蔵エンド') || fixtures.find(f => f.name === 'エンド什器') || fixtures[2];
    const frozenFlat = fixtures.find(f => f.name === '平台冷凍') || fixtures.find(f => f.name === '冷蔵ケース') || fixtures[1];
    const frozenFlatEnd = fixtures.find(f => f.name === '平台冷凍エンド') || fixtures.find(f => f.name === 'エンド什器') || fixtures[2];

    let order = 0;

    // 多段: 52尺（4尺棚 x 13本 = 1560cm）
    // 上部に配置（positionY = 0）
    for (let i = 0; i < 13; i++) {
        placements.push({
            storeId,
            fixtureId: multiTierFixture.id,
            positionX: i * 120, // 4尺 = 120cm
            positionY: 0,
            order: order++
        });
    }

    // ===== 平台ゾーン（positionY = 200以降）=====
    // 画像から：左側が冷蔵、右側が冷凍

    // 平台冷蔵: 48尺（120cm x 12 = 1440cm）
    // 活力ゾーン (1-20の範囲)
    for (let i = 0; i < 12; i++) {
        placements.push({
            storeId,
            fixtureId: refrigeratedFlat.id,
            positionX: i * 120,
            positionY: 200,
            order: order++
        });
    }

    // 平台冷蔵エンド: 15尺（90cm x 5 = 450cm or 混合配置）
    // 冷蔵の端っこ部分
    for (let i = 0; i < 5; i++) {
        placements.push({
            storeId,
            fixtureId: refrigeratedFlatEnd.id,
            positionX: 1440 + i * 90, // 冷蔵の後ろに配置
            positionY: 200,
            order: order++
        });
    }

    // 平台冷凍: 16尺（120cm x 4 = 480cm）
    // 時短ゾーン（右側）
    for (let i = 0; i < 4; i++) {
        placements.push({
            storeId,
            fixtureId: frozenFlat.id,
            positionX: i * 120,
            positionY: 400, // 冷蔵の下に配置
            order: order++
        });
    }

    // 平台冷凍エンド: 5尺（150cm x 1 = 150cm）
    placements.push({
        storeId,
        fixtureId: frozenFlatEnd.id,
        positionX: 480, // 冷凍の後ろに配置
        positionY: 400,
        order: order++
    });

    return placements;
}

// テスト用個店棚割生成
function generateSeedStorePlanograms(storeId: string, standardPlanogram: StandardPlanogram): Omit<StorePlanogram, 'id'>[] {
    return [{
        storeId,
        standardPlanogramId: standardPlanogram.id, // Correct property name
        width: standardPlanogram.width,
        height: standardPlanogram.height,
        shelfCount: standardPlanogram.shelfCount,
        products: [], // 初期状態は空（または標準からコピー）
        warnings: [],
        status: 'generated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }];
}

// 初期データ投入のメイン関数
export async function seedData(): Promise<{
    products: number;
    stores: number;
    fixtures: number;
    shelfBlocks: number;
    standardPlanograms: number;
    storePlanograms: number;
}> {
    // 既存データをクリア
    await clearAllData();

    // 商品データ生成・保存
    const productsData = generateProducts();
    const savedProducts: Product[] = [];
    for (const product of productsData) {
        const saved = await productRepository.create(product);
        savedProducts.push(saved);
    }

    // 店舗データ生成・保存（テスト店舗を追加）
    const storesData = generateStores();
    storesData.unshift({
        code: 'TEST001',
        name: 'テスト店舗',
        fmt: 'MEGA',
        region: '関東'
    });

    const savedStores: Store[] = [];
    for (const store of storesData) {
        const saved = await storeRepository.create(store);
        savedStores.push(saved);
    }

    // 什器データ生成・保存
    const fixturesData = generateFixtures();
    const savedFixtures: Fixture[] = [];
    for (const fixture of fixturesData) {
        const saved = await fixtureRepository.create(fixture);
        savedFixtures.push(saved);
    }

    // テスト棚ブロック生成・保存（スキップし、以下で都度生成）
    const savedBlocks: ShelfBlock[] = [];

    // テスト標準棚割生成・保存
    // const standardPlanogramsData = generateSeedStandardPlanograms(savedBlocks, savedProducts);
    // 代わりにここでループ処理してブロックごと生成
    const savedStandardPlanograms: StandardPlanogram[] = [];

    const typeSettings: Partial<Record<FixtureType, { name: string; height: number; shelfCount: number; width: number }>> = {
        'multi-tier': { name: '多段', height: 180, shelfCount: 4, width: 120 },
        'flat-refrigerated': { name: '平台冷蔵', height: 90, shelfCount: 1, width: 120 },
        'end-cap-refrigerated': { name: '平台冷蔵エンド', height: 90, shelfCount: 1, width: 90 },
        'flat-frozen': { name: '平台冷凍', height: 90, shelfCount: 1, width: 120 },
        'end-cap-frozen': { name: '平台冷凍エンド', height: 90, shelfCount: 1, width: 90 }
    };

    const types = Object.entries(typeSettings).map(([type, setting]) => ({
        type: type as FixtureType,
        ...setting
    }));

    for (const { type, name, height, shelfCount, width } of types) {
        console.log(`Generating Planogram: ${name}, Height: ${height}, ShelfCount: ${shelfCount}`);
        // このタイプ専用のブロックを生成
        const blocksData = generateSeedShelfBlocks(savedProducts, shelfCount, `（${name}）`);
        const typeBlocks: ShelfBlock[] = [];

        for (const block of blocksData) {
            const saved = await shelfBlockRepository.create(block);
            savedBlocks.push(saved);
            typeBlocks.push(saved);
        }

        // Planogram作成
        const selectedBlocks = typeBlocks.slice(0, 3);
        const blockMappings = selectedBlocks.map((b, i) => ({
            id: crypto.randomUUID(),
            blockId: b.id,
            positionX: i * width,
            positionY: 0
        }));

        const allProductsInPlanogram: any[] = [];
        selectedBlocks.forEach((block, index) => {
            const xOffset = index * width;
            if (block.productPlacements) {
                block.productPlacements.forEach(pp => {
                    allProductsInPlanogram.push({
                        id: crypto.randomUUID(),
                        productId: pp.productId,
                        shelfIndex: pp.shelfIndex,
                        positionX: pp.positionX + xOffset,
                        faceCount: pp.faceCount
                    });
                });
            }
        });

        const sp = {
            fmt: 'MEGA' as FMT,
            name: `テスト標準棚割（${name}）v3`,
            baseStoreId: '',
            fixtureType: type,
            width: width * selectedBlocks.length,
            height: height,
            shelfCount: shelfCount,
            blocks: blockMappings,
            products: allProductsInPlanogram,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const saved = await standardPlanogramRepository.create(sp);
        savedStandardPlanograms.push(saved);
    }

    // テスト店舗用什器配置生成・保存
    const testStore = savedStores.find(s => s.code === 'TEST001');
    if (testStore) {
        const fixturePlacements = generateSeedStoreFixtures(testStore.id, savedFixtures);
        for (const fp of fixturePlacements) {
            await storeFixturePlacementRepository.create(fp);
        }

        // テスト個店棚割生成・保存
        if (savedStandardPlanograms.length > 0) {
            for (const std of savedStandardPlanograms) {
                const storePlanogramsData = generateSeedStorePlanograms(testStore.id, std);
                for (const sp of storePlanogramsData) {
                    await storePlanogramRepository.create(sp);
                }
            }
        }
    }

    // 初期化完了フラグをセット
    await setInitialized(true);

    return {
        products: savedProducts.length,
        stores: savedStores.length,
        fixtures: savedFixtures.length,
        shelfBlocks: savedBlocks.length,
        standardPlanograms: savedStandardPlanograms.length,
        storePlanograms: savedStandardPlanograms.length // 標準棚割と同数生成
    };
}

// 初期化チェック用エクスポート（再エクスポート）
export { isInitialized } from './repositories/localStorageRepository';
