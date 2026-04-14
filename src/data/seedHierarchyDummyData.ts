// デモ用ダミーデータ投入（商品階層ベース）
// 精肉部門の棚割を階層単位で構成し、5店舗に自動展開するデモ
// 本番環境（Supabase）には影響しない

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
    clearAllData,
    setInitialized,
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
            name: string;
            widthMm: number;
            faceCount: number;
        }[];
    }[];
}

// ────────────────────────────────────────
// 多段ブロック定義（合計80尺 = 24,000mm）
// ────────────────────────────────────────

const MULTI_TIER_BLOCK_DEFS: HierarchyBlockDef[] = [
    // ── 牛肉ブロック（16尺 = 4,800mm）──
    {
        name: '牛肉ブロック',
        shaku: 16,
        shelfCount: 5,
        blockType: 'multi-tier',
        shelves: [
            {
                shelfIndex: 0, // 最下段: こま切れ・切落し（売れ筋・回転率高）
                items: [
                    { level: 'category', code: '0001', name: '牛肉 > こま切れ', widthMm: 600, faceCount: 4 },
                    { level: 'category', code: '0002', name: '牛肉 > 切落し', widthMm: 600, faceCount: 4 },
                ],
            },
            {
                shelfIndex: 1, // うすぎり・しゃぶしゃぶ
                items: [
                    { level: 'category', code: '0006', name: '牛肉 > うすぎり', widthMm: 400, faceCount: 4 },
                    { level: 'category', code: '0031', name: '牛肉 > すき焼・しゃぶしゃぶ', widthMm: 400, faceCount: 4 },
                    { level: 'category', code: '0032', name: '牛肉 > 煮込み・カレー', widthMm: 400, faceCount: 4 },
                ],
            },
            {
                shelfIndex: 2, // 焼肉・ステーキ
                items: [
                    { level: 'category', code: '0020', name: '牛肉 > 焼肉', widthMm: 400, faceCount: 4 },
                    { level: 'category', code: '0021', name: '牛肉 > ステーキ', widthMm: 400, faceCount: 4 },
                    { level: 'category', code: '0033', name: '牛肉 > ブロック', widthMm: 400, faceCount: 4 },
                ],
            },
            {
                shelfIndex: 3, // ホルモン・内臓
                items: [
                    { level: 'category', code: '0040', name: '牛肉 > ホルモン', widthMm: 600, faceCount: 4 },
                    { level: 'subCategory', code: '0002', name: '牛肉 > こま切れ > 和牛', widthMm: 600, faceCount: 4 },
                ],
            },
            {
                shelfIndex: 4, // 産地別サブカテゴリ
                items: [
                    { level: 'subCategory', code: '0003', name: '牛肉 > こま切れ > 交雑牛', widthMm: 400, faceCount: 4 },
                    { level: 'subCategory', code: '0004', name: '牛肉 > こま切れ > 国産牛・経産和牛', widthMm: 400, faceCount: 4 },
                    { level: 'subCategory', code: '0005', name: '牛肉 > こま切れ > 輸入牛', widthMm: 400, faceCount: 4 },
                ],
            },
        ],
    },
    // ── 豚肉ブロック（16尺 = 4,800mm）──
    {
        name: '豚肉ブロック',
        shaku: 16,
        shelfCount: 5,
        blockType: 'multi-tier',
        shelves: [
            {
                shelfIndex: 0, // こま切れ・うすぎり（売れ筋）
                items: [
                    { level: 'category', code: '0001', name: '豚肉 > こま切れ', widthMm: 600, faceCount: 4 },
                    { level: 'category', code: '0006', name: '豚肉 > うすぎり', widthMm: 600, faceCount: 4 },
                ],
            },
            {
                shelfIndex: 1, // 焼肉・生姜焼き・とんかつ
                items: [
                    { level: 'category', code: '0020', name: '豚肉 > 焼肉', widthMm: 400, faceCount: 4 },
                    { level: 'category', code: '0034', name: '豚肉 > 生姜焼き・豚丼', widthMm: 400, faceCount: 4 },
                    { level: 'category', code: '0035', name: '豚肉 > とんかつ・ソテー', widthMm: 400, faceCount: 4 },
                ],
            },
            {
                shelfIndex: 2, // しゃぶしゃぶ・ブロック
                items: [
                    { level: 'category', code: '0005', name: '豚肉 > しゃぶしゃぶ', widthMm: 600, faceCount: 4 },
                    { level: 'category', code: '0036', name: '豚肉 > ブロック・煮込み・カレー', widthMm: 600, faceCount: 4 },
                ],
            },
            {
                shelfIndex: 3, // ホルモン・原材料
                items: [
                    { level: 'category', code: '0040', name: '豚肉 > ホルモン', widthMm: 600, faceCount: 4 },
                    { level: 'category', code: '0099', name: '豚肉 > 原材料', widthMm: 600, faceCount: 4 },
                ],
            },
            {
                shelfIndex: 4, // 産地別
                items: [
                    { level: 'subCategory', code: '0001', name: '豚肉 > こま切れ > 銘柄豚', widthMm: 400, faceCount: 4 },
                    { level: 'subCategory', code: '0002', name: '豚肉 > こま切れ > 国産豚', widthMm: 400, faceCount: 4 },
                    { level: 'subCategory', code: '0003', name: '豚肉 > こま切れ > 輸入豚', widthMm: 400, faceCount: 4 },
                ],
            },
        ],
    },
    // ── 鶏肉ブロック（12尺 = 3,600mm）──
    {
        name: '鶏肉ブロック',
        shaku: 12,
        shelfCount: 5,
        blockType: 'multi-tier',
        shelves: [
            {
                shelfIndex: 0, // 正肉・切身（売れ筋）
                items: [
                    { level: 'category', code: '0003', name: '鶏肉 > 正肉', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0007', name: '鶏肉 > 切身', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 1, // 骨物・焼肉
                items: [
                    { level: 'category', code: '0008', name: '鶏肉 > 骨物', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0020', name: '鶏肉 > 焼肉', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 2, // 副産物・合鴨
                items: [
                    { level: 'category', code: '0038', name: '鶏肉 > 副産物(鶏肉)', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0039', name: '鶏肉 > 合鴨', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 3, // 産地別（正肉）
                items: [
                    { level: 'subCategory', code: '0001', name: '鶏肉 > 正肉 > 銘柄鶏', widthMm: 400, faceCount: 3 },
                    { level: 'subCategory', code: '0002', name: '鶏肉 > 正肉 > 地鶏', widthMm: 400, faceCount: 3 },
                    { level: 'subCategory', code: '0003', name: '鶏肉 > 正肉 > 国産鶏', widthMm: 400, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 4, // 産地別（切身）+ 原材料
                items: [
                    { level: 'subCategory', code: '0004', name: '鶏肉 > 正肉 > 輸入鶏', widthMm: 400, faceCount: 3 },
                    { level: 'subCategory', code: '0003', name: '鶏肉 > 切身 > 国産鶏', widthMm: 400, faceCount: 3 },
                    { level: 'category', code: '0099', name: '鶏肉 > 原材料', widthMm: 400, faceCount: 3 },
                ],
            },
        ],
    },
    // ── 加工品ブロック（12尺 = 3,600mm）──
    {
        name: '加工品ブロック',
        shaku: 12,
        shelfCount: 5,
        blockType: 'multi-tier',
        shelves: [
            {
                shelfIndex: 0, // ウインナー・ソーセージ（売れ筋）
                items: [
                    { level: 'category', code: '0050', name: '加工 > ウインナー', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0051', name: '加工 > ソーセージ', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 1, // ハム・ベーコン
                items: [
                    { level: 'category', code: '0052', name: '加工 > ハム', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0053', name: '加工 > ベーコン', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 2, // 生ハム・サラダチキン
                items: [
                    { level: 'category', code: '0054', name: '加工 > 生ハム', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0055', name: '加工 > サラダチキン', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 3, // 挽肉・ハンバーグ
                items: [
                    { level: 'category', code: '0010', name: '加工 > 挽肉', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0056', name: '加工 > ハンバーグ', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 4, // ミートボール・焼豚
                items: [
                    { level: 'category', code: '0057', name: '加工 > ミートボール', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0058', name: '加工 > 焼豚・パストラミ', widthMm: 600, faceCount: 3 },
                ],
            },
        ],
    },
    // ── MS・味付ブロック（12尺 = 3,600mm）──
    {
        name: 'MS・味付ブロック',
        shaku: 12,
        shelfCount: 5,
        blockType: 'multi-tier',
        shelves: [
            {
                shelfIndex: 0, // MS牛・MS豚（売れ筋）
                items: [
                    { level: 'category', code: '0060', name: 'MS > 味付牛肉', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0061', name: 'MS > 味付豚肉', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 1, // MS鶏・MSラム
                items: [
                    { level: 'category', code: '0062', name: 'MS > 味付鶏肉', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0063', name: 'MS > 味付ラム', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 2, // MSホルモン
                items: [
                    { level: 'category', code: '0064', name: 'MS > 味付ホルモン', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0065', name: 'MS > プルコギ・韓国風', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 3, // 味噌漬け・塩麹系
                items: [
                    { level: 'subCategory', code: '0010', name: 'MS > 味付牛肉 > タレ漬け', widthMm: 600, faceCount: 3 },
                    { level: 'subCategory', code: '0011', name: 'MS > 味付牛肉 > 味噌漬け', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 4, // 塩麹・ハーブ系
                items: [
                    { level: 'subCategory', code: '0012', name: 'MS > 味付豚肉 > 塩麹', widthMm: 600, faceCount: 3 },
                    { level: 'subCategory', code: '0013', name: 'MS > 味付鶏肉 > ハーブ', widthMm: 600, faceCount: 3 },
                ],
            },
        ],
    },
    // ── 焼肉セット・その他ブロック（12尺 = 3,600mm）──
    {
        name: '焼肉セット・他ブロック',
        shaku: 12,
        shelfCount: 5,
        blockType: 'multi-tier',
        shelves: [
            {
                shelfIndex: 0, // 焼肉セット
                items: [
                    { level: 'category', code: '0070', name: 'セット > 焼肉セット', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0071', name: 'セット > BBQセット', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 1, // すき焼き・しゃぶしゃぶセット
                items: [
                    { level: 'category', code: '0072', name: 'セット > すき焼きセット', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0073', name: 'セット > しゃぶしゃぶセット', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 2, // 馬刺し・ラム
                items: [
                    { level: 'category', code: '0074', name: 'その他 > 馬刺し', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0075', name: 'その他 > ラム', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 3, // ジビエ・合鴨
                items: [
                    { level: 'category', code: '0076', name: 'その他 > ジビエ', widthMm: 600, faceCount: 3 },
                    { level: 'category', code: '0077', name: 'その他 > 合鴨', widthMm: 600, faceCount: 3 },
                ],
            },
            {
                shelfIndex: 4, // ジンギスカン
                items: [
                    { level: 'category', code: '0078', name: 'その他 > ジンギスカン', widthMm: 600, faceCount: 3 },
                    { level: 'subCategory', code: '0020', name: 'セット > 焼肉セット > ファミリー', widthMm: 600, faceCount: 3 },
                ],
            },
        ],
    },
];
// 合計: 16+16+12+12+12+12 = 80尺

// ────────────────────────────────────────
// 平台ブロック定義（合計40尺 = 12,000mm）
// ────────────────────────────────────────

const FLAT_BLOCK_DEFS: HierarchyBlockDef[] = [
    {
        name: '平台-牛肉特選',
        shaku: 12,
        shelfCount: 1,
        blockType: 'flat',
        shelves: [
            {
                shelfIndex: 0,
                items: [
                    { level: 'subCategory', code: '0002', name: '牛肉 > ステーキ > 和牛', widthMm: 400, faceCount: 3 },
                    { level: 'subCategory', code: '0003', name: '牛肉 > ステーキ > 交雑牛', widthMm: 400, faceCount: 3 },
                    { level: 'subCategory', code: '0004', name: '牛肉 > すき焼 > 和牛', widthMm: 400, faceCount: 3 },
                ],
            },
        ],
    },
    {
        name: '平台-豚肉・鶏肉おすすめ',
        shaku: 12,
        shelfCount: 1,
        blockType: 'flat',
        shelves: [
            {
                shelfIndex: 0,
                items: [
                    { level: 'subCategory', code: '0001', name: '豚肉 > とんかつ・ソテー > 銘柄豚', widthMm: 400, faceCount: 3 },
                    { level: 'subCategory', code: '0002', name: '豚肉 > とんかつ・ソテー > 国産豚', widthMm: 400, faceCount: 3 },
                    { level: 'subCategory', code: '0001', name: '鶏肉 > 正肉 > 銘柄鶏', widthMm: 400, faceCount: 3 },
                ],
            },
        ],
    },
    {
        name: '平台-MSセット',
        shaku: 8,
        shelfCount: 1,
        blockType: 'flat',
        shelves: [
            {
                shelfIndex: 0,
                items: [
                    { level: 'category', code: '0060', name: 'MS > 味付牛肉', widthMm: 400, faceCount: 3 },
                    { level: 'category', code: '0061', name: 'MS > 味付豚肉', widthMm: 400, faceCount: 3 },
                ],
            },
        ],
    },
    {
        name: '平台-焼肉セット',
        shaku: 8,
        shelfCount: 1,
        blockType: 'flat',
        shelves: [
            {
                shelfIndex: 0,
                items: [
                    { level: 'category', code: '0070', name: 'セット > 焼肉セット', widthMm: 400, faceCount: 3 },
                    { level: 'category', code: '0071', name: 'セット > BBQセット', widthMm: 400, faceCount: 3 },
                ],
            },
        ],
    },
];
// 合計: 12+12+8+8 = 40尺

// ────────────────────────────────────────
// 店舗パターン（九州エリア5店舗）
// ────────────────────────────────────────

const STORE_PATTERNS = [
    { code: 'SuC-1001', name: 'SuC博多店',   size: '基準', multiTierShaku: 80, flatShaku: 40, shelfCount: 5 },
    { code: 'SuC-1002', name: 'SuC天神店',   size: '大',   multiTierShaku: 72, flatShaku: 36, shelfCount: 5 },
    { code: 'SuC-1003', name: 'SuC小倉店',   size: '中',   multiTierShaku: 60, flatShaku: 24, shelfCount: 5 },
    { code: 'SuC-1004', name: 'SuC久留米店', size: '小',   multiTierShaku: 48, flatShaku: 20, shelfCount: 4 },
    { code: 'SuC-1005', name: 'SuC大分店',   size: '最小', multiTierShaku: 40, flatShaku: 16, shelfCount: 4 },
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
    // ── 0. 既存データ全削除 ──
    console.log('[seedHierarchyDummyData] 既存データを削除中...');
    await clearAllData();

    const now = new Date().toISOString();

    // ── 1. 棚ブロック作成（階層のみ、商品なし）──
    console.log('[seedHierarchyDummyData] 階層棚ブロック作成中...');
    const multiBlocks: ShelfBlock[] = [];
    for (const def of MULTI_TIER_BLOCK_DEFS) {
        const hierarchyPlacements = buildHierarchyPlacements(def);
        const block = await shelfBlockRepository.create({
            name: def.name,
            description: `${def.name} ${def.shaku}尺（階層）`,
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
            description: `${def.name} ${def.shaku}尺（階層）`,
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

    // ── 2. FMT標準棚割作成（SuC 基準=80尺多段+40尺平台）──
    console.log('[seedHierarchyDummyData] 標準棚割作成中...');
    const multiStdData = buildStandardPlanogramFromHierarchyBlocks(multiBlocks);
    const flatStdData = buildStandardPlanogramFromHierarchyBlocks(flatBlocks);

    const baseStoreId = 'hierarchy-base';

    const stdMultiTier = await standardPlanogramRepository.create({
        fmt: 'SuC',
        name: 'SuC精肉 多段標準棚割',
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
        name: 'SuC精肉 平台標準棚割',
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

    for (const pattern of STORE_PATTERNS) {
        const store = await storeRepository.create({
            code: pattern.code,
            name: `${pattern.name}`,
            fmt: 'SuC' as const,
            region: '九州' as const,
        });

        // 什器配置: 4尺什器を必要本数
        const mtFixtureShaku = 4;
        const mtCount = Math.round(pattern.multiTierShaku / mtFixtureShaku);
        const flatFixtureShaku = 4;
        const flatCount = Math.round(pattern.flatShaku / flatFixtureShaku);

        const fixtureWidthMm = mtFixtureShaku * SHAKU_TO_MM; // 4尺 = 1200mm
        const flatWidthMm = flatFixtureShaku * SHAKU_TO_MM;

        let order = 1;
        for (let i = 0; i < mtCount; i++) {
            const fixture = await fixtureRepository.create({
                name: `多段冷蔵棚（${mtFixtureShaku}尺）`,
                width: fixtureWidthMm,
                height: 1800,
                shelfCount: pattern.shelfCount,
                fixtureType: 'multi-tier',
            } as Omit<Fixture, 'id'>);
            await storeFixturePlacementRepository.create({
                storeId: store.id,
                fixtureId: fixture.id,
                positionX: i * fixtureWidthMm,
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
                width: flatWidthMm,
                height: 900,
                depth: 600,
                shelfCount: 1,
                fixtureType: 'flat-refrigerated',
            } as Omit<Fixture, 'id'>);
            await storeFixturePlacementRepository.create({
                storeId: store.id,
                fixtureId: fixture.id,
                positionX: i * flatWidthMm,
                positionY: 2500,
                order: order++,
                direction: 0,
                zone: '平台冷蔵' as any,
                label: `平台${i + 1}`,
            } as Omit<StoreFixturePlacement, 'id'>);
        }

        // 個店棚割生成（階層をそのまま引き継ぎ、幅は店舗サイズに合わせる）
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
            warnings: pattern.multiTierShaku < 80
                ? [`標準${80}尺 → 店舗${pattern.multiTierShaku}尺に自動調整`]
                : [],
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
            warnings: pattern.flatShaku < 40
                ? [`標準${40}尺 → 店舗${pattern.flatShaku}尺に自動調整`]
                : [],
            createdAt: now,
            updatedAt: now,
            syncedAt: now,
        } as any);
        storePlanogramCount++;

        console.log(`[seedHierarchyDummyData] ${pattern.name}（${pattern.size}）: 多段${pattern.multiTierShaku}尺+平台${pattern.flatShaku}尺 作成完了`);
    }

    await setInitialized(true);
    console.log('[seedHierarchyDummyData] 完了!');

    return {
        shelfBlocks: multiBlocks.length + flatBlocks.length,
        standardPlanograms: 2,
        stores: STORE_PATTERNS.length,
        storePlanograms: storePlanogramCount,
    };
}
