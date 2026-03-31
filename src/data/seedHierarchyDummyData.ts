// 商品階層のみでの棚ブロック → 標準棚割 → 個店棚割 ダミーデータ投入
// JANを一切使わず、商品階層アイテムだけで棚割を構成するデモデータ

import type {
    ShelfBlock,
    HierarchyPlacement,
    StandardPlanogramBlock,
    StandardPlanogramHierarchyPlacement,
    Fixture,
    StoreFixturePlacement,
} from './types';
import { SHAKU_TO_MM } from './types';
import {
    storeRepository,
    fixtureRepository,
    storeFixturePlacementRepository,
    shelfBlockRepository,
    standardPlanogramRepository,
    storePlanogramRepository,
} from './repositories/repositoryFactory';

// ========================================
// 階層ブロック定義
// ========================================

interface HierarchyBlockDef {
    name: string;
    shaku: number;
    shelfCount: number;
    blockType: 'multi-tier' | 'flat';
    shelves: {
        shelfIndex: number;
        items: {
            level: 'department' | 'category' | 'subCategory' | 'segment' | 'subSegment';
            code: string;
            name: string; // 部門以下のパス表示
            widthMm: number;
            faceCount: number;
        }[];
    }[];
}

// 多段ブロック定義（合計24尺 = 7200mm）
// コード・名称は商品階層マスタ（畜産_精肉_商品階層_8階層.xlsx）に準拠
const MULTI_TIER_BLOCK_DEFS: HierarchyBlockDef[] = [
    {
        name: '牛肉ブロック',
        shaku: 8,
        shelfCount: 5,
        blockType: 'multi-tier',
        shelves: [
            {
                shelfIndex: 0, // 最下段: こま切れ・切落し
                items: [
                    { level: 'category', code: '0001', name: '牛肉 > こま切れ', widthMm: 600, faceCount: 2 },
                    { level: 'category', code: '0002', name: '牛肉 > 切落し', widthMm: 600, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 1, // 焼肉・ステーキ
                items: [
                    { level: 'category', code: '0020', name: '牛肉 > 焼肉', widthMm: 400, faceCount: 2 },
                    { level: 'category', code: '0021', name: '牛肉 > ステーキ', widthMm: 400, faceCount: 2 },
                    { level: 'category', code: '0031', name: '牛肉 > すき焼・しゃぶしゃぶ', widthMm: 400, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 2, // 煮込み・ブロック
                items: [
                    { level: 'category', code: '0032', name: '牛肉 > 煮込み・カレー', widthMm: 400, faceCount: 2 },
                    { level: 'category', code: '0033', name: '牛肉 > ブロック', widthMm: 400, faceCount: 2 },
                    { level: 'category', code: '0040', name: '牛肉 > ホルモン', widthMm: 400, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 3, // サブカテ: 和牛・交雑牛（こま切れ内）
                items: [
                    { level: 'subCategory', code: '0002', name: '牛肉 > こま切れ > 和牛', widthMm: 600, faceCount: 2 },
                    { level: 'subCategory', code: '0003', name: '牛肉 > こま切れ > 交雑牛', widthMm: 600, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 4, // サブカテ: 国産牛・輸入牛（こま切れ内）
                items: [
                    { level: 'subCategory', code: '0004', name: '牛肉 > こま切れ > 国産牛・経産和牛', widthMm: 600, faceCount: 2 },
                    { level: 'subCategory', code: '0005', name: '牛肉 > こま切れ > 輸入牛', widthMm: 600, faceCount: 2 },
                ],
            },
        ],
    },
    {
        name: '豚肉ブロック',
        shaku: 8,
        shelfCount: 5,
        blockType: 'multi-tier',
        shelves: [
            {
                shelfIndex: 0,
                items: [
                    { level: 'category', code: '0001', name: '豚肉 > こま切れ', widthMm: 600, faceCount: 2 },
                    { level: 'category', code: '0006', name: '豚肉 > うすぎり', widthMm: 600, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 1,
                items: [
                    { level: 'category', code: '0020', name: '豚肉 > 焼肉', widthMm: 400, faceCount: 2 },
                    { level: 'category', code: '0034', name: '豚肉 > 生姜焼き・豚丼', widthMm: 400, faceCount: 2 },
                    { level: 'category', code: '0035', name: '豚肉 > とんかつ・ソテー', widthMm: 400, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 2,
                items: [
                    { level: 'category', code: '0005', name: '豚肉 > しゃぶしゃぶ', widthMm: 600, faceCount: 2 },
                    { level: 'category', code: '0036', name: '豚肉 > ブロック・煮込み・カレー', widthMm: 600, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 3,
                items: [
                    { level: 'category', code: '0040', name: '豚肉 > ホルモン', widthMm: 600, faceCount: 2 },
                    { level: 'category', code: '0099', name: '豚肉 > 原材料', widthMm: 600, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 4,
                items: [
                    { level: 'subCategory', code: '0001', name: '豚肉 > こま切れ > 銘柄豚', widthMm: 400, faceCount: 2 },
                    { level: 'subCategory', code: '0002', name: '豚肉 > こま切れ > 国産豚', widthMm: 400, faceCount: 2 },
                    { level: 'subCategory', code: '0003', name: '豚肉 > こま切れ > 輸入豚', widthMm: 400, faceCount: 2 },
                ],
            },
        ],
    },
    {
        name: '鶏肉ブロック',
        shaku: 8,
        shelfCount: 5,
        blockType: 'multi-tier',
        shelves: [
            {
                shelfIndex: 0,
                items: [
                    { level: 'category', code: '0003', name: '鶏肉 > 正肉', widthMm: 600, faceCount: 2 },
                    { level: 'category', code: '0007', name: '鶏肉 > 切身', widthMm: 600, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 1,
                items: [
                    { level: 'category', code: '0008', name: '鶏肉 > 骨物', widthMm: 600, faceCount: 2 },
                    { level: 'category', code: '0020', name: '鶏肉 > 焼肉', widthMm: 600, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 2,
                items: [
                    { level: 'category', code: '0038', name: '鶏肉 > 副産物(鶏肉)', widthMm: 800, faceCount: 2 },
                    { level: 'category', code: '0039', name: '鶏肉 > 合鴨', widthMm: 400, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 3,
                items: [
                    { level: 'category', code: '0099', name: '鶏肉 > 原材料', widthMm: 400, faceCount: 2 },
                    { level: 'subCategory', code: '0003', name: '鶏肉 > 正肉 > 国産鶏', widthMm: 400, faceCount: 2 },
                    { level: 'subCategory', code: '0004', name: '鶏肉 > 正肉 > 輸入鶏', widthMm: 400, faceCount: 2 },
                ],
            },
            {
                shelfIndex: 4,
                items: [
                    { level: 'subCategory', code: '0001', name: '鶏肉 > 正肉 > 銘柄鶏', widthMm: 400, faceCount: 2 },
                    { level: 'subCategory', code: '0002', name: '鶏肉 > 正肉 > 地鶏', widthMm: 400, faceCount: 2 },
                    { level: 'subCategory', code: '0003', name: '鶏肉 > 切身 > 国産鶏', widthMm: 400, faceCount: 2 },
                ],
            },
        ],
    },
];

// 平台ブロック定義（合計12尺 = 3600mm）
// コード・名称は商品階層マスタに準拠
const FLAT_BLOCK_DEFS: HierarchyBlockDef[] = [
    {
        name: '平台-牛肉特選',
        shaku: 4,
        shelfCount: 1,
        blockType: 'flat',
        shelves: [
            {
                shelfIndex: 0,
                items: [
                    { level: 'subCategory', code: '0002', name: '牛肉 > ステーキ > 和牛', widthMm: 400, faceCount: 3 },
                ],
            },
        ],
    },
    {
        name: '平台-豚肉特選',
        shaku: 4,
        shelfCount: 1,
        blockType: 'flat',
        shelves: [
            {
                shelfIndex: 0,
                items: [
                    { level: 'subCategory', code: '0001', name: '豚肉 > とんかつ・ソテー > 銘柄豚', widthMm: 300, faceCount: 2 },
                    { level: 'subCategory', code: '0002', name: '豚肉 > とんかつ・ソテー > 国産豚', widthMm: 300, faceCount: 2 },
                ],
            },
        ],
    },
    {
        name: '平台-加工品',
        shaku: 4,
        shelfCount: 1,
        blockType: 'flat',
        shelves: [
            {
                shelfIndex: 0,
                items: [
                    { level: 'category', code: '0010', name: '加工 > 挽肉', widthMm: 600, faceCount: 2 },
                ],
            },
        ],
    },
];

// 店舗パターン
const HIERARCHY_STORE_PATTERNS = [
    { code: 'HIER-L01', name: '階層テスト大型店', size: '大', multiTierShaku: 24, flatShaku: 12, shelfCount: 5 },
    { code: 'HIER-M01', name: '階層テスト中型店', size: '中', multiTierShaku: 20, flatShaku: 8, shelfCount: 5 },
    { code: 'HIER-S01', name: '階層テスト小型店', size: '小', multiTierShaku: 16, flatShaku: 4, shelfCount: 4 },
];

// ========================================
// ヘルパー
// ========================================

function buildHierarchyPlacements(def: HierarchyBlockDef): HierarchyPlacement[] {
    const placements: HierarchyPlacement[] = [];
    for (const shelf of def.shelves) {
        let posX = 0;
        for (const item of shelf.items) {
            placements.push({
                id: crypto.randomUUID(),
                hierarchyLevel: item.level,
                hierarchyCode: item.code,
                hierarchyName: item.name,
                shelfIndex: shelf.shelfIndex,
                positionX: posX,
                width: item.widthMm,
                faceCount: item.faceCount,
            });
            posX += item.widthMm * item.faceCount;
        }
    }
    return placements;
}

function buildStandardPlanogramFromHierarchyBlocks(blocks: ShelfBlock[]) {
    const stdBlocks: StandardPlanogramBlock[] = [];
    const hierarchyPlacements: StandardPlanogramHierarchyPlacement[] = [];
    let posX = 0;

    for (const block of blocks) {
        const placedBlockId = crypto.randomUUID();
        stdBlocks.push({
            id: placedBlockId,
            blockId: block.id,
            positionX: posX,
            positionY: 0,
        });

        for (const hp of block.hierarchyPlacements) {
            hierarchyPlacements.push({
                id: crypto.randomUUID(),
                hierarchyLevel: hp.hierarchyLevel,
                hierarchyCode: hp.hierarchyCode,
                hierarchyName: hp.hierarchyName,
                shelfIndex: hp.shelfIndex,
                positionX: posX + hp.positionX,
                width: hp.width,
                faceCount: hp.faceCount,
                placedBlockId,
            });
        }

        posX += block.width;
    }

    return { blocks: stdBlocks, hierarchyPlacements, totalWidth: posX };
}

// ========================================
// メイン
// ========================================

export async function seedHierarchyDummyData(): Promise<{
    shelfBlocks: number;
    standardPlanograms: number;
    stores: number;
    storePlanograms: number;
}> {
    const now = new Date().toISOString();

    // ── 1. 棚ブロック作成（階層のみ、商品なし）──
    console.log('[seedHierarchyDummyData] 階層棚ブロック作成中...');
    const multiBlocks: ShelfBlock[] = [];
    for (const def of MULTI_TIER_BLOCK_DEFS) {
        const hierarchyPlacements = buildHierarchyPlacements(def);
        const block = await shelfBlockRepository.create({
            name: def.name,
            description: `${def.name} ${def.shaku}尺（階層のみ）`,
            blockType: def.blockType,
            width: def.shaku * SHAKU_TO_MM,
            height: 1800,
            shelfCount: def.shelfCount,
            productPlacements: [],
            hierarchyPlacements,
            createdAt: now,
            updatedAt: now,
        } as Omit<ShelfBlock, 'id'>);
        multiBlocks.push(block);
    }

    const flatBlocks: ShelfBlock[] = [];
    for (const def of FLAT_BLOCK_DEFS) {
        const hierarchyPlacements = buildHierarchyPlacements(def);
        const block = await shelfBlockRepository.create({
            name: def.name,
            description: `${def.name} ${def.shaku}尺（階層のみ）`,
            blockType: def.blockType,
            width: def.shaku * SHAKU_TO_MM,
            height: 900,
            shelfCount: def.shelfCount,
            productPlacements: [],
            hierarchyPlacements,
            createdAt: now,
            updatedAt: now,
        } as Omit<ShelfBlock, 'id'>);
        flatBlocks.push(block);
    }

    // ── 2. FMT標準棚割作成 ──
    console.log('[seedHierarchyDummyData] 標準棚割作成中...');
    const multiStdData = buildStandardPlanogramFromHierarchyBlocks(multiBlocks);
    const flatStdData = buildStandardPlanogramFromHierarchyBlocks(flatBlocks);

    const baseStoreId = 'hierarchy-base';

    const stdMultiTier = await standardPlanogramRepository.create({
        fmt: 'SuC',
        name: 'SuC精肉 多段標準棚割（階層版）',
        baseStoreId,
        fixtureType: 'multi-tier',
        width: multiStdData.totalWidth,
        height: 1800,
        shelfCount: 5,
        blocks: multiStdData.blocks,
        products: [],
        hierarchyPlacements: multiStdData.hierarchyPlacements,
        createdAt: now,
        updatedAt: now,
    } as any);

    const stdFlat = await standardPlanogramRepository.create({
        fmt: 'SuC',
        name: 'SuC精肉 平台標準棚割（階層版）',
        baseStoreId,
        fixtureType: 'flat-refrigerated',
        width: flatStdData.totalWidth,
        height: 900,
        shelfCount: 1,
        blocks: flatStdData.blocks,
        products: [],
        hierarchyPlacements: flatStdData.hierarchyPlacements,
        createdAt: now,
        updatedAt: now,
    } as any);

    // ── 3. 店舗 + 什器 + 個店棚割 ──
    console.log('[seedHierarchyDummyData] 店舗・什器・個店棚割作成中...');
    let storePlanogramCount = 0;

    for (const pattern of HIERARCHY_STORE_PATTERNS) {
        const store = await storeRepository.create({
            code: pattern.code,
            name: `${pattern.name}（${pattern.size}型 多段${pattern.multiTierShaku}尺+平台${pattern.flatShaku}尺）`,
            fmt: 'SuC' as const,
            region: '九州' as const,
        });

        // 什器配置
        const mtFixtureShaku = 4;
        const mtCount = Math.round(pattern.multiTierShaku / mtFixtureShaku);
        const flatFixtureShaku = 4;
        const flatCount = Math.round(pattern.flatShaku / flatFixtureShaku);

        let order = 1;
        for (let i = 0; i < mtCount; i++) {
            const fixture = await fixtureRepository.create({
                name: `多段冷蔵棚（${mtFixtureShaku}尺）`,
                width: mtFixtureShaku * SHAKU_TO_MM,
                height: 1800,
                shelfCount: pattern.shelfCount,
                fixtureType: 'multi-tier',
            } as Omit<Fixture, 'id'>);
            await storeFixturePlacementRepository.create({
                storeId: store.id,
                fixtureId: fixture.id,
                positionX: i * 120,
                positionY: 0,
                order: order++,
                direction: 0,
                zone: '多段' as any,
                label: `多段${i + 1}`,
            } as Omit<StoreFixturePlacement, 'id'>);
        }
        for (let i = 0; i < flatCount; i++) {
            const fixture = await fixtureRepository.create({
                name: `平台冷蔵（${flatFixtureShaku}尺）`,
                width: flatFixtureShaku * SHAKU_TO_MM,
                height: 900,
                depth: 600,
                shelfCount: 1,
                fixtureType: 'flat-refrigerated',
            } as Omit<Fixture, 'id'>);
            await storeFixturePlacementRepository.create({
                storeId: store.id,
                fixtureId: fixture.id,
                positionX: i * 120,
                positionY: 300,
                order: order++,
                direction: 0,
                zone: '平台冷蔵' as any,
                label: `平台${i + 1}`,
            } as Omit<StoreFixturePlacement, 'id'>);
        }

        // 個店棚割生成（階層はautomationServiceでそのまま引き継ぎ）
        // 商品がないのでルールA/Bは空振りし、階層だけが引き継がれる
        const multiStoreHierarchies = (stdMultiTier.hierarchyPlacements || []).map((hp: any) => ({
            id: crypto.randomUUID(),
            hierarchyLevel: hp.hierarchyLevel,
            hierarchyCode: hp.hierarchyCode,
            hierarchyName: hp.hierarchyName,
            shelfIndex: hp.shelfIndex,
            positionX: hp.positionX,
            width: hp.width,
            faceCount: hp.faceCount,
            isAutoGenerated: true,
        }));

        const flatStoreHierarchies = (stdFlat.hierarchyPlacements || []).map((hp: any) => ({
            id: crypto.randomUUID(),
            hierarchyLevel: hp.hierarchyLevel,
            hierarchyCode: hp.hierarchyCode,
            hierarchyName: hp.hierarchyName,
            shelfIndex: hp.shelfIndex,
            positionX: hp.positionX,
            width: hp.width,
            faceCount: hp.faceCount,
            isAutoGenerated: true,
        }));

        await storePlanogramRepository.create({
            storeId: store.id,
            standardPlanogramId: stdMultiTier.id,
            width: pattern.multiTierShaku * SHAKU_TO_MM,
            height: 1800,
            shelfCount: pattern.shelfCount,
            products: [],
            hierarchyPlacements: multiStoreHierarchies,
            status: 'generated',
            warnings: [],
            createdAt: now,
            updatedAt: now,
            syncedAt: now,
        } as any);
        storePlanogramCount++;

        await storePlanogramRepository.create({
            storeId: store.id,
            standardPlanogramId: stdFlat.id,
            width: pattern.flatShaku * SHAKU_TO_MM,
            height: 900,
            shelfCount: 1,
            products: [],
            hierarchyPlacements: flatStoreHierarchies,
            status: 'generated',
            warnings: [],
            createdAt: now,
            updatedAt: now,
            syncedAt: now,
        } as any);
        storePlanogramCount++;

        console.log(`[seedHierarchyDummyData] ${pattern.name}: 多段+平台 個店棚割作成完了`);
    }

    console.log('[seedHierarchyDummyData] 完了!');

    return {
        shelfBlocks: multiBlocks.length + flatBlocks.length,
        standardPlanograms: 2,
        stores: HIERARCHY_STORE_PATTERNS.length,
        storePlanograms: storePlanogramCount,
    };
}
