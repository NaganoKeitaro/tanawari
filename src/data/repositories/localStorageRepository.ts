// 棚割管理システム - LocalStorageリポジトリ実装
import type { IRepository } from './baseRepository';
import { dataStore } from './baseRepository';
import type {
    Product,
    Store,
    Fixture,
    StoreFixturePlacement,
    ShelfBlock,
    StandardPlanogram,
    StorePlanogram
} from '../types';

// ストレージキー定数
const STORAGE_KEYS = {
    PRODUCTS: 'planogram_products',
    STORES: 'planogram_stores',
    FIXTURES: 'planogram_fixtures',
    STORE_FIXTURE_PLACEMENTS: 'planogram_store_fixture_placements',
    SHELF_BLOCKS: 'planogram_shelf_blocks',
    STANDARD_PLANOGRAMS: 'planogram_standard_planograms',
    STORE_PLANOGRAMS: 'planogram_store_planograms',
    INITIALIZED: 'planogram_initialized'
} as const;

// UUID生成ヘルパー
function generateId(): string {
    return crypto.randomUUID();
}

// ジェネリックLocalStorageリポジトリ
class LocalStorageRepository<T extends { id: string }> implements IRepository<T> {
    private storageKey: string;

    constructor(storageKey: string) {
        this.storageKey = storageKey;
    }

    async getAll(): Promise<T[]> {
        const items = await dataStore.get<T[]>(this.storageKey);
        return items || [];
    }

    async getById(id: string): Promise<T | null> {
        const items = await this.getAll();
        return items.find(item => item.id === id) || null;
    }

    async create(item: Omit<T, 'id'>): Promise<T> {
        const items = await this.getAll();
        const newItem = { ...item, id: generateId() } as T;
        items.push(newItem);
        await dataStore.set(this.storageKey, items);
        return newItem;
    }

    async update(id: string, updates: Partial<T>): Promise<T | null> {
        const items = await this.getAll();
        const index = items.findIndex(item => item.id === id);
        if (index === -1) return null;

        items[index] = { ...items[index], ...updates };
        await dataStore.set(this.storageKey, items);
        return items[index];
    }

    async delete(id: string): Promise<boolean> {
        const items = await this.getAll();
        const filteredItems = items.filter(item => item.id !== id);
        if (filteredItems.length === items.length) return false;

        await dataStore.set(this.storageKey, filteredItems);
        return true;
    }

    async query(predicate: (item: T) => boolean): Promise<T[]> {
        const items = await this.getAll();
        return items.filter(predicate);
    }

    // バルク操作
    async setAll(items: T[]): Promise<void> {
        await dataStore.set(this.storageKey, items);
    }

    async clear(): Promise<void> {
        await dataStore.remove(this.storageKey);
    }
}

// 各エンティティ用リポジトリのエクスポート
export const productRepository = new LocalStorageRepository<Product>(STORAGE_KEYS.PRODUCTS);
export const storeRepository = new LocalStorageRepository<Store>(STORAGE_KEYS.STORES);
export const fixtureRepository = new LocalStorageRepository<Fixture>(STORAGE_KEYS.FIXTURES);
export const storeFixturePlacementRepository = new LocalStorageRepository<StoreFixturePlacement>(STORAGE_KEYS.STORE_FIXTURE_PLACEMENTS);
export const shelfBlockRepository = new LocalStorageRepository<ShelfBlock>(STORAGE_KEYS.SHELF_BLOCKS);
export const standardPlanogramRepository = new LocalStorageRepository<StandardPlanogram>(STORAGE_KEYS.STANDARD_PLANOGRAMS);
export const storePlanogramRepository = new LocalStorageRepository<StorePlanogram>(STORAGE_KEYS.STORE_PLANOGRAMS);

// 初期化状態チェック
export async function isInitialized(): Promise<boolean> {
    const initialized = await dataStore.get<boolean>(STORAGE_KEYS.INITIALIZED);
    return initialized === true;
}

export async function setInitialized(value: boolean): Promise<void> {
    await dataStore.set(STORAGE_KEYS.INITIALIZED, value);
}

// すべてのデータをクリア
export async function clearAllData(): Promise<void> {
    await dataStore.clear();
}
