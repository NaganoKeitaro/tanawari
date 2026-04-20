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

// IndexedDB実装（localStorageの5MB制限を回避）
const IDB_NAME = 'planogram_data';
const IDB_VERSION = 1;
const IDB_STORE = 'kv';

function openDataDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// localStorageからIndexedDBへの自動マイグレーション
const MIGRATION_FLAG = 'planogram_migrated_to_idb';
const PLANOGRAM_KEYS = [
    'planogram_products',
    'planogram_stores',
    'planogram_fixtures',
    'planogram_store_fixture_placements',
    'planogram_shelf_blocks',
    'planogram_standard_planograms',
    'planogram_store_planograms',
    'planogram_product_hierarchy',
    'planogram_initialized',
];

async function migrateFromLocalStorage(): Promise<void> {
    if (localStorage.getItem(MIGRATION_FLAG)) return;

    const hasData = PLANOGRAM_KEYS.some(key => localStorage.getItem(key) !== null);
    if (!hasData) {
        localStorage.setItem(MIGRATION_FLAG, '1');
        return;
    }

    console.log('[DataStore] localStorageからIndexedDBへマイグレーション中...');
    const db = await openDataDB();

    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);

        for (const key of PLANOGRAM_KEYS) {
            const raw = localStorage.getItem(key);
            if (raw !== null) {
                try {
                    store.put(JSON.parse(raw), key);
                } catch {
                    // パース失敗はスキップ
                }
            }
        }

        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });

    // マイグレーション完了フラグを立て、旧データを削除
    localStorage.setItem(MIGRATION_FLAG, '1');
    for (const key of PLANOGRAM_KEYS) {
        localStorage.removeItem(key);
    }
    console.log('[DataStore] マイグレーション完了');
}

// 初期化時にマイグレーションを実行
const migrationPromise = migrateFromLocalStorage().catch(e => {
    console.error('[DataStore] マイグレーションエラー:', e);
});

export class IndexedDBDataStore implements IDataStore {
    async get<T>(key: string): Promise<T | null> {
        await migrationPromise;
        const db = await openDataDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
            req.onerror = () => { db.close(); reject(req.error); };
        });
    }

    async set<T>(key: string, value: T): Promise<void> {
        await migrationPromise;
        const db = await openDataDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(value, key);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    async remove(key: string): Promise<void> {
        await migrationPromise;
        const db = await openDataDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).delete(key);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    async clear(): Promise<void> {
        await migrationPromise;
        const db = await openDataDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).clear();
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }
}

// シングルトンのデータストアインスタンス
export const dataStore = new IndexedDBDataStore();
