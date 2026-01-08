// 棚割管理システム - ベースリポジトリ
// 抽象インターフェースでLocalStorageと将来のFirestore実装を切り替え可能に

export interface IRepository<T> {
    getAll(): Promise<T[]>;
    getById(id: string): Promise<T | null>;
    create(item: Omit<T, 'id'>): Promise<T>;
    update(id: string, item: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
    query(predicate: (item: T) => boolean): Promise<T[]>;
}

export interface IDataStore {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
}

// LocalStorage実装
export class LocalStorageDataStore implements IDataStore {
    async get<T>(key: string): Promise<T | null> {
        const item = localStorage.getItem(key);
        if (!item) return null;
        try {
            return JSON.parse(item) as T;
        } catch {
            return null;
        }
    }

    async set<T>(key: string, value: T): Promise<void> {
        localStorage.setItem(key, JSON.stringify(value));
    }

    async remove(key: string): Promise<void> {
        localStorage.removeItem(key);
    }

    async clear(): Promise<void> {
        localStorage.clear();
    }
}

// シングルトンのデータストアインスタンス
export const dataStore = new LocalStorageDataStore();
