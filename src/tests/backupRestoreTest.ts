// バックアップ/復旧 大量データテスト
// ブラウザコンソールから実行: import('/src/tests/backupRestoreTest.ts').then(m => m.runAllTests())

import {
    productRepository,
    storeRepository,
    fixtureRepository,
    storeFixturePlacementRepository,
    shelfBlockRepository,
    standardPlanogramRepository,
    storePlanogramRepository,
    productHierarchyRepository,
    restoreAllData,
} from '../data/repositories/repositoryFactory';
import type { Product, Store, Fixture, StoreFixturePlacement, ShelfBlock, StandardPlanogram, StorePlanogram } from '../data/types';
import type { HierarchyEntry } from '../data/types/productHierarchy';

// ========================================
// テストデータ生成
// ========================================

function genId(): string { return crypto.randomUUID(); }

function generateProducts(count: number): Product[] {
    return Array.from({ length: count }, (_, i) => ({
        id: genId(),
        jan: `490${String(i).padStart(10, '0')}`,
        name: `テスト商品${i + 1}`,
        width: 80 + (i % 5) * 20,
        height: 40,
        depth: 150,
        category: `カテゴリ${i % 10}`,
        departmentName: `部門${i % 6}`,
        imageUrl: '',
        salesRank: (i % 100) + 1,
        sales: 100000 + i * 1000,
        quantity: 500 + i * 10,
    }));
}

function generateStores(count: number): Store[] {
    const fmts = ['MEGA', 'SuC', 'SMART', 'GO', 'FC'] as const;
    const regions = ['北海道', '東北', '関東', '中部', '近畿', '中国・四国', '九州'] as const;
    return Array.from({ length: count }, (_, i) => ({
        id: genId(),
        code: `STORE-${String(i + 1).padStart(4, '0')}`,
        name: `テスト店舗${i + 1}`,
        fmt: fmts[i % fmts.length],
        region: regions[i % regions.length],
    }));
}

function generateFixtures(stores: Store[], perStore: number): { fixtures: Fixture[]; placements: StoreFixturePlacement[] } {
    const fixtures: Fixture[] = [];
    const placements: StoreFixturePlacement[] = [];
    for (const store of stores) {
        for (let j = 0; j < perStore; j++) {
            const fId = genId();
            fixtures.push({
                id: fId,
                name: `什器${j + 1}`,
                width: 1200,
                height: 1800,
                shelfCount: 5,
                fixtureType: j % 2 === 0 ? 'multi-tier' : 'flat-refrigerated',
            });
            placements.push({
                id: genId(),
                storeId: store.id,
                fixtureId: fId,
                positionX: j * 120,
                positionY: 0,
                order: j + 1,
                direction: 0,
                zone: '多段',
                label: `什器${j + 1}`,
            });
        }
    }
    return { fixtures, placements };
}

function generateShelfBlocks(products: Product[], count: number): ShelfBlock[] {
    const now = new Date().toISOString();
    return Array.from({ length: count }, (_, i) => ({
        id: genId(),
        name: `ブロック${i + 1}`,
        description: `テストブロック`,
        blockType: 'multi-tier' as const,
        width: 3600,
        height: 1800,
        shelfCount: 5,
        productPlacements: Array.from({ length: 20 }, (_, j) => ({
            id: genId(),
            productId: products[(i * 20 + j) % products.length].id,
            shelfIndex: j % 5,
            positionX: Math.floor(j / 5) * 120,
            faceCount: 2,
        })),
        hierarchyPlacements: [],
        createdAt: now,
        updatedAt: now,
    }));
}

function generateStandardPlanograms(blocks: ShelfBlock[], count: number): StandardPlanogram[] {
    const fmts = ['MEGA', 'SuC', 'SMART', 'GO'] as const;
    const now = new Date().toISOString();
    return Array.from({ length: count }, (_, i) => {
        const usedBlocks = blocks.slice(0, 3);
        let posX = 0;
        const stdBlocks = usedBlocks.map(b => {
            const sb = { id: genId(), blockId: b.id, positionX: posX, positionY: 0 };
            posX += b.width;
            return sb;
        });
        const stdProducts = usedBlocks.flatMap(b =>
            b.productPlacements.map(p => ({
                id: genId(),
                productId: p.productId,
                shelfIndex: p.shelfIndex,
                positionX: p.positionX,
                faceCount: p.faceCount,
                placedBlockId: stdBlocks[0].id,
            }))
        );
        return {
            id: genId(),
            fmt: fmts[i % fmts.length],
            name: `標準棚割${i + 1}`,
            baseStoreId: 'dummy',
            fixtureType: 'multi-tier' as const,
            width: posX,
            height: 1800,
            shelfCount: 5,
            startDate: i % 2 === 0 ? '2026-01-01' : '2026-05-01',
            endDate: i % 2 === 0 ? '2026-04-30' : '2026-08-31',
            description: i % 2 === 0 ? '平常用' : 'GW用',
            blocks: stdBlocks,
            products: stdProducts,
            hierarchyPlacements: [],
            createdAt: now,
            updatedAt: now,
        };
    });
}

function generateStorePlanograms(stores: Store[], standardPlanograms: StandardPlanogram[]): StorePlanogram[] {
    const now = new Date().toISOString();
    const results: StorePlanogram[] = [];
    for (const store of stores) {
        // 各店舗に2つの個店棚割（多段+平台）
        for (let k = 0; k < 2; k++) {
            const sp = standardPlanograms[k % standardPlanograms.length];
            results.push({
                id: genId(),
                storeId: store.id,
                standardPlanogramId: sp.id,
                width: sp.width,
                height: sp.height,
                shelfCount: sp.shelfCount,
                products: sp.products.slice(0, 30).map(p => ({
                    id: genId(),
                    productId: p.productId,
                    shelfIndex: p.shelfIndex,
                    positionX: p.positionX,
                    faceCount: p.faceCount,
                    isAutoGenerated: true,
                    isCut: false,
                })),
                hierarchyPlacements: [],
                status: 'generated',
                warnings: [],
                createdAt: now,
                updatedAt: now,
            });
        }
    }
    return results;
}

function generateHierarchy(count: number): HierarchyEntry[] {
    const now = new Date().toISOString();
    return Array.from({ length: count }, (_, i) => ({
        id: genId(),
        divisionCode: `D${Math.floor(i / 100)}`,
        divisionName: `事業部${Math.floor(i / 100)}`,
        divisionSubCode: `DS${Math.floor(i / 50)}`,
        divisionSubName: `ディビジョン${Math.floor(i / 50)}`,
        lineCode: `L${Math.floor(i / 20)}`,
        lineName: `ライン${Math.floor(i / 20)}`,
        departmentCode: `DP${Math.floor(i / 10)}`,
        departmentName: `部門${Math.floor(i / 10)}`,
        categoryCode: `C${i}`,
        categoryName: `カテゴリ${i}`,
        subCategoryCode: '',
        subCategoryName: '',
        segmentCode: '',
        segmentName: '',
        subSegmentCode: '',
        subSegmentName: '',
        createdAt: now,
        updatedAt: now,
    }));
}

// ========================================
// テスト本体
// ========================================

interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL';
    duration: number;
    detail: string;
}

async function runTest(name: string, fn: () => Promise<string>): Promise<TestResult> {
    const start = performance.now();
    try {
        const detail = await fn();
        return { name, status: 'PASS', duration: performance.now() - start, detail };
    } catch (e) {
        return { name, status: 'FAIL', duration: performance.now() - start, detail: String(e) };
    }
}

export async function runAllTests(): Promise<void> {
    console.log('========================================');
    console.log('バックアップ/復旧 大量データテスト開始');
    console.log('========================================');

    const results: TestResult[] = [];

    // --- テスト1: 大量テストデータ生成 ---
    let products: Product[] = [];
    let stores: Store[] = [];
    let fixtures: Fixture[] = [];
    let placements: StoreFixturePlacement[] = [];
    let blocks: ShelfBlock[] = [];
    let stdPlans: StandardPlanogram[] = [];
    let storePlans: StorePlanogram[] = [];
    let hierarchy: HierarchyEntry[] = [];

    results.push(await runTest('1. テストデータ生成 (350店舗/64標準棚割)', async () => {
        products = generateProducts(90);
        stores = generateStores(350);
        const fixtureData = generateFixtures(stores, 25); // 350×25=8,750什器
        fixtures = fixtureData.fixtures;
        placements = fixtureData.placements;
        blocks = generateShelfBlocks(products, 12);
        stdPlans = generateStandardPlanograms(blocks, 64);
        storePlans = generateStorePlanograms(stores, stdPlans); // 350×2=700個店棚割
        hierarchy = generateHierarchy(200);

        const summary = [
            `商品: ${products.length}`,
            `店舗: ${stores.length}`,
            `什器: ${fixtures.length}`,
            `配置: ${placements.length}`,
            `ブロック: ${blocks.length}`,
            `標準棚割: ${stdPlans.length}`,
            `個店棚割: ${storePlans.length}`,
            `階層: ${hierarchy.length}`,
        ];
        return summary.join(', ');
    }));

    // --- テスト2: データサイズ計測 ---
    results.push(await runTest('2. データサイズ計測', async () => {
        const data = { products, stores, fixtures, storeFixtures: placements, shelfBlocks: blocks, standardPlanograms: stdPlans, storePlanograms: storePlans, hierarchy };
        const json = JSON.stringify(data);
        const sizeBytes = new Blob([json]).size;
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
        if (sizeBytes > 5 * 1024 * 1024) {
            return `${sizeMB} MB (localStorageの5MB超えるがIndexedDBなのでOK)`;
        }
        return `${sizeMB} MB`;
    }));

    // --- テスト3: IndexedDB保存テスト ---
    results.push(await runTest('3. IndexedDB保存テスト (チェックポイント保存)', async () => {
        const data = { products, stores, fixtures, storeFixtures: placements, shelfBlocks: blocks, standardPlanograms: stdPlans, storePlanograms: storePlans, hierarchy };
        const checkpointId = genId();
        const checkpointData = {
            meta: {
                id: checkpointId,
                createdAt: new Date().toISOString(),
                label: 'テスト用チェックポイント',
                dataSizeBytes: new Blob([JSON.stringify(data)]).size,
                counts: {
                    products: products.length,
                    stores: stores.length,
                    fixtures: fixtures.length,
                    storeFixtures: placements.length,
                    shelfBlocks: blocks.length,
                    standardPlanograms: stdPlans.length,
                    storePlanograms: storePlans.length,
                    hierarchy: hierarchy.length,
                },
            },
            data,
        };

        // IndexedDB保存
        const dbReq = indexedDB.open('planogram_backups', 1);
        await new Promise<void>((resolve, reject) => {
            dbReq.onupgradeneeded = () => {
                const db = dbReq.result;
                if (!db.objectStoreNames.contains('checkpoints')) {
                    db.createObjectStore('checkpoints', { keyPath: 'id' });
                }
            };
            dbReq.onsuccess = () => {
                const db = dbReq.result;
                const tx = db.transaction('checkpoints', 'readwrite');
                tx.objectStore('checkpoints').put({ id: checkpointId, ...checkpointData });
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => { db.close(); reject(tx.error); };
            };
            dbReq.onerror = () => reject(dbReq.error);
        });

        // 読み戻し検証
        const db2Req = indexedDB.open('planogram_backups', 1);
        const loaded = await new Promise<any>((resolve, reject) => {
            db2Req.onsuccess = () => {
                const db = db2Req.result;
                const tx = db.transaction('checkpoints', 'readonly');
                const req = tx.objectStore('checkpoints').get(checkpointId);
                req.onsuccess = () => { db.close(); resolve(req.result); };
                req.onerror = () => { db.close(); reject(req.error); };
            };
        });

        if (!loaded) throw new Error('IndexedDBから読み戻し失敗');
        if (loaded.data.products.length !== products.length) throw new Error(`products件数不一致: ${loaded.data.products.length} !== ${products.length}`);
        if (loaded.data.storePlanograms.length !== storePlans.length) throw new Error(`storePlanograms件数不一致`);

        // クリーンアップ
        const db3Req = indexedDB.open('planogram_backups', 1);
        await new Promise<void>((resolve, reject) => {
            db3Req.onsuccess = () => {
                const db = db3Req.result;
                const tx = db.transaction('checkpoints', 'readwrite');
                tx.objectStore('checkpoints').delete(checkpointId);
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => { db.close(); reject(tx.error); };
            };
        });

        return `保存→読み戻しOK (全${Object.values(loaded.data).reduce((s: number, a: any) => s + a.length, 0)}件)`;
    }));

    // --- テスト4: restoreAllData テスト (localStorageモード) ---
    results.push(await runTest('4. restoreAllData テスト', async () => {
        const data = {
            products,
            stores,
            fixtures,
            storeFixtures: placements,
            shelfBlocks: blocks,
            standardPlanograms: stdPlans,
            storePlanograms: storePlans,
            hierarchy,
        };

        await restoreAllData(data);

        // 検証: 件数チェック
        const [rProducts, rStores, rFixtures, rPlacements, rBlocks, rStdPlans, rStorePlans, rHierarchy] =
            await Promise.all([
                productRepository.getAll(),
                storeRepository.getAll(),
                fixtureRepository.getAll(),
                storeFixturePlacementRepository.getAll(),
                shelfBlockRepository.getAll(),
                standardPlanogramRepository.getAll(),
                storePlanogramRepository.getAll(),
                productHierarchyRepository.getAll(),
            ]);

        const checks = [
            { name: '商品', expected: products.length, actual: rProducts.length },
            { name: '店舗', expected: stores.length, actual: rStores.length },
            { name: '什器', expected: fixtures.length, actual: rFixtures.length },
            { name: '配置', expected: placements.length, actual: rPlacements.length },
            { name: 'ブロック', expected: blocks.length, actual: rBlocks.length },
            { name: '標準棚割', expected: stdPlans.length, actual: rStdPlans.length },
            { name: '個店棚割', expected: storePlans.length, actual: rStorePlans.length },
            { name: '階層', expected: hierarchy.length, actual: rHierarchy.length },
        ];

        const failures = checks.filter(c => c.expected !== c.actual);
        if (failures.length > 0) {
            throw new Error('件数不一致: ' + failures.map(f => `${f.name}(${f.actual}/${f.expected})`).join(', '));
        }

        return checks.map(c => `${c.name}: ${c.actual}件`).join(', ');
    }));

    // --- テスト5: ID参照整合性テスト ---
    results.push(await runTest('5. ID参照整合性テスト', async () => {
        const rStores = await storeRepository.getAll();
        const rStorePlans = await storePlanogramRepository.getAll();
        const rStdPlans = await standardPlanogramRepository.getAll();
        const rPlacements = await storeFixturePlacementRepository.getAll();

        const storeIds = new Set(rStores.map(s => s.id));
        const stdPlanIds = new Set(rStdPlans.map(s => s.id));

        // 個店棚割 → 店舗ID参照
        const brokenStoreRefs = rStorePlans.filter(sp => !storeIds.has(sp.storeId));
        if (brokenStoreRefs.length > 0) {
            throw new Error(`個店棚割の店舗ID参照切れ: ${brokenStoreRefs.length}件`);
        }

        // 個店棚割 → 標準棚割ID参照
        const brokenStdRefs = rStorePlans.filter(sp => !stdPlanIds.has(sp.standardPlanogramId));
        if (brokenStdRefs.length > 0) {
            throw new Error(`個店棚割の標準棚割ID参照切れ: ${brokenStdRefs.length}件`);
        }

        // 配置 → 店舗ID参照
        const brokenPlacementRefs = rPlacements.filter(p => !storeIds.has(p.storeId));
        if (brokenPlacementRefs.length > 0) {
            throw new Error(`配置の店舗ID参照切れ: ${brokenPlacementRefs.length}件`);
        }

        return `個店棚割→店舗: OK(${rStorePlans.length}件), 個店棚割→標準: OK(${rStorePlans.length}件), 配置→店舗: OK(${rPlacements.length}件)`;
    }));

    // --- テスト6: バックアップ→復元の往復テスト ---
    results.push(await runTest('6. バックアップ→削除→復元 往復テスト', async () => {
        // 現在のデータを取得（テスト4で投入済み）
        const [origProducts, origStores, origStorePlans] = await Promise.all([
            productRepository.getAll(),
            storeRepository.getAll(),
            storePlanogramRepository.getAll(),
        ]);

        // バックアップデータ取得
        const backupData = {
            products: origProducts,
            stores: origStores,
            fixtures: await fixtureRepository.getAll(),
            storeFixtures: await storeFixturePlacementRepository.getAll(),
            shelfBlocks: await shelfBlockRepository.getAll(),
            standardPlanograms: await standardPlanogramRepository.getAll(),
            storePlanograms: origStorePlans,
            hierarchy: await productHierarchyRepository.getAll(),
        };

        // 全削除して復元
        await restoreAllData(backupData);

        // 件数検証
        const [restoredProducts, restoredStores, restoredStorePlans] = await Promise.all([
            productRepository.getAll(),
            storeRepository.getAll(),
            storePlanogramRepository.getAll(),
        ]);

        if (restoredProducts.length !== origProducts.length) throw new Error(`商品件数不一致: ${restoredProducts.length}/${origProducts.length}`);
        if (restoredStores.length !== origStores.length) throw new Error(`店舗件数不一致: ${restoredStores.length}/${origStores.length}`);
        if (restoredStorePlans.length !== origStorePlans.length) throw new Error(`個店棚割件数不一致: ${restoredStorePlans.length}/${origStorePlans.length}`);

        // ID一致検証（サンプル）
        const origProductIds = new Set(origProducts.map(p => p.id));
        const restoredProductIds = new Set(restoredProducts.map(p => p.id));
        const missingIds = origProducts.filter(p => !restoredProductIds.has(p.id));
        if (missingIds.length > 0) throw new Error(`ID喪失: ${missingIds.length}件`);

        return `往復後 商品ID一致: ${restoredProductIds.size}/${origProductIds.size}, 店舗: ${restoredStores.length}, 個店棚割: ${restoredStorePlans.length}`;
    }));

    // --- テスト7: エクスポート/インポート形式テスト ---
    results.push(await runTest('7. JSON エクスポート形式テスト', async () => {
        const data = {
            products: await productRepository.getAll(),
            stores: await storeRepository.getAll(),
            fixtures: await fixtureRepository.getAll(),
            storeFixtures: await storeFixturePlacementRepository.getAll(),
            shelfBlocks: await shelfBlockRepository.getAll(),
            standardPlanograms: await standardPlanogramRepository.getAll(),
            storePlanograms: await storePlanogramRepository.getAll(),
            hierarchy: await productHierarchyRepository.getAll(),
        };
        const meta = {
            id: genId(),
            createdAt: new Date().toISOString(),
            label: 'エクスポートテスト',
            dataSizeBytes: 0,
            counts: {
                products: data.products.length,
                stores: data.stores.length,
                fixtures: data.fixtures.length,
                storeFixtures: data.storeFixtures.length,
                shelfBlocks: data.shelfBlocks.length,
                standardPlanograms: data.standardPlanograms.length,
                storePlanograms: data.storePlanograms.length,
                hierarchy: data.hierarchy.length,
            },
        };
        const exportData = { meta, data };
        const json = JSON.stringify(exportData);
        const parsed = JSON.parse(json);

        if (!parsed.meta || !parsed.data) throw new Error('エクスポート形式不正');
        if (parsed.data.products.length !== data.products.length) throw new Error('パース後件数不一致');

        const sizeMB = (new Blob([json]).size / (1024 * 1024)).toFixed(2);
        return `JSON生成+パースOK (${sizeMB} MB)`;
    }));

    // --- テスト8: クリーンアップ ---
    results.push(await runTest('8. テストデータクリーンアップ', async () => {
        await restoreAllData({
            products: [], stores: [], fixtures: [], storeFixtures: [],
            shelfBlocks: [], standardPlanograms: [], storePlanograms: [], hierarchy: [],
        });
        const remaining = await productRepository.getAll();
        if (remaining.length !== 0) throw new Error(`クリーンアップ後にデータ残存: ${remaining.length}件`);
        return '全データ削除完了';
    }));

    // --- 結果出力 ---
    console.log('\n========================================');
    console.log('テスト結果');
    console.log('========================================');
    for (const r of results) {
        const icon = r.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${r.name} (${(r.duration / 1000).toFixed(2)}s)`);
        console.log(`   ${r.detail}`);
    }
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`\n合計: ${passed} PASS / ${failed} FAIL`);
    console.log('========================================');
}
