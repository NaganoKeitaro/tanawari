import type {
    Store,
    FMT,
    Region
} from './types';
import {
    storeRepository,
    setInitialized
} from './repositories/repositoryFactory';

// 提供された店舗データ
const RAW_STORE_DATA = [
    { zone: '筑豊', name: '上三緒', fmt: 'SuC' },
    { zone: '筑豊', name: '上津役店', fmt: 'SuC' },
    { zone: '筑豊', name: '直方店', fmt: 'SuC' },
    { zone: '筑豊', name: '飯塚店', fmt: 'SuC' },
    { zone: '筑豊', name: '上三緒店', fmt: 'SuC' },
    { zone: '筑豊', name: '田川店', fmt: 'SuC' },
    { zone: '筑豊', name: '水巻店', fmt: 'SuC' },
    { zone: '筑豊', name: '遠賀店', fmt: 'SuC' },
    { zone: '筑豊', name: '宗像店', fmt: 'SuC' },
    { zone: '筑豊', name: '小竹店', fmt: 'SuC' },
    { zone: '筑豊', name: '田川後藤寺店', fmt: 'SuC' },
    { zone: '筑豊', name: '福智店', fmt: 'SuC' },
    { zone: '筑豊', name: '桂川店', fmt: 'SuC' },
    { zone: '筑豊', name: '東水巻店', fmt: 'SuC' },
    { zone: '筑豊', name: '宮田店', fmt: 'SuC' },
    { zone: '筑豊', name: '飯塚庄内', fmt: 'SuC' },
    { zone: '福岡', name: '古賀花見店', fmt: 'SuC' },
    { zone: '福岡', name: 'アイランド店', fmt: 'SuC' }
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

// 店舗マスタ初期データ投入
export async function seedStoreData(): Promise<{ stores: number }> {
    const storesData = generateStores();
    const savedStores: Store[] = [];
    for (const store of storesData) {
        const saved = await storeRepository.create(store);
        savedStores.push(saved);
    }

    // 初期化完了フラグをセット
    await setInitialized(true);

    return {
        stores: savedStores.length
    };
}

// 初期化チェック用エクスポート（再エクスポート）
export { isInitialized } from './repositories/repositoryFactory';
