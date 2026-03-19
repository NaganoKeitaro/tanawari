// 標準棚割 棚ブロック再配置ロジック — 受け入れテスト
import { describe, it, expect } from 'vitest';
import type { StandardPlanogramBlock, ProductPlacement } from '../../data/types';
import {
    calcBlockInsertIndex,
    packBlocksLeftAligned,
    tryPackWithPosY,
    tryPackWithNearbyY,
    findInsertX,
    findBestPlacement,
    calcPreviewPositions,
    expandBlockProducts,
    calcPosYFromVisualRow,
    swapBlock,
    type BlockMasterMap
} from './standardPlanogramRearrange';

// =========================================================================
// テストヘルパー
// =========================================================================

/** テスト用ブロック生成 */
function pb(id: string, blockId: string, posX: number, posY: number): StandardPlanogramBlock {
    return { id, blockId, positionX: posX, positionY: posY };
}

/** テスト用マスタ生成 */
function master(id: string, width: number, shelfCount: number): BlockMasterMap[number] {
    return { id, width, shelfCount };
}

// =========================================================================
// 1. calcBlockInsertIndex — 挿入インデックス計算
// =========================================================================

describe('calcBlockInsertIndex', () => {
    const masters: BlockMasterMap = [
        master('A', 300, 3),
        master('B', 300, 3),
        master('C', 300, 3),
    ];

    it('ブロックが空の場合は0を返す', () => {
        expect(calcBlockInsertIndex([], 100, masters)).toBe(0);
    });

    it('全ブロックの左側（先頭）に挿入', () => {
        const remaining = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
        // targetX=0 → A(center=150)より左 → index 0
        expect(calcBlockInsertIndex(remaining, 0, masters)).toBe(0);
    });

    it('全ブロックの右側（末尾）に挿入', () => {
        const remaining = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
        // targetX=600 → B(center=450)より右 → index 2
        expect(calcBlockInsertIndex(remaining, 600, masters)).toBe(2);
    });

    it('2つのブロックの間に挿入', () => {
        const remaining = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
        // targetX=200 → A(center=150)より右、B(center=450)より左 → index 1
        expect(calcBlockInsertIndex(remaining, 200, masters)).toBe(1);
    });

    it('ブロック中央ちょうどの位置では右側に挿入', () => {
        const remaining = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
        // targetX=150 → A(center=150) — not < → 次のブロックへ → B(center=450) → index 1
        expect(calcBlockInsertIndex(remaining, 150, masters)).toBe(1);
    });

    it('3ブロックの中央に挿入', () => {
        const remaining = [
            pb('1', 'A', 0, 0),
            pb('2', 'B', 300, 0),
            pb('3', 'C', 600, 0),
        ];
        // targetX=400 → A(150)右、B(450)左 → index 1
        expect(calcBlockInsertIndex(remaining, 400, masters)).toBe(1);
        // targetX=500 → A(150)右、B(450)右、C(750)左 → index 2
        expect(calcBlockInsertIndex(remaining, 500, masters)).toBe(2);
    });

    it('マスタが見つからないブロックはスキップされる', () => {
        const unknownMasters: BlockMasterMap = [master('A', 300, 3)];
        const remaining = [pb('1', 'A', 0, 0), pb('2', 'UNKNOWN', 300, 0)];
        // UNKNOWN のマスタが無いのでスキップ → A(center=150) のみ比較
        expect(calcBlockInsertIndex(remaining, 200, unknownMasters)).toBe(2);
    });
});

// =========================================================================
// 2. packBlocksLeftAligned — 左詰めパッキング
// =========================================================================

describe('packBlocksLeftAligned', () => {
    const masters: BlockMasterMap = [
        master('A', 300, 3),
        master('B', 300, 3),
        master('C', 300, 3),
    ];

    it('同じY範囲のブロックが左詰めされる', () => {
        const ordered = [pb('1', 'A', 999, 0), pb('2', 'B', 999, 0)];
        const result = packBlocksLeftAligned(ordered, masters, 900);
        expect(result).not.toBeNull();
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(300);
    });

    it('Y範囲が重ならないブロックは同一X位置に配置可能', () => {
        const mastersVary: BlockMasterMap = [
            master('A', 300, 2), // shelfCount=2
            master('B', 300, 2), // shelfCount=2
        ];
        // A: Y=0-2, B: Y=3-5 → 重ならないので両方 X=0
        const ordered = [pb('1', 'A', 0, 0), pb('2', 'B', 0, 3)];
        const result = packBlocksLeftAligned(ordered, mastersVary, 900);
        expect(result).not.toBeNull();
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(0);
    });

    it('Y範囲が重なるブロックは横にずれる', () => {
        const mastersVary: BlockMasterMap = [
            master('A', 300, 3),
            master('B', 300, 3),
        ];
        // A: Y=0-3, B: Y=1-4 → 重なる → B は A の右(300)
        const ordered = [pb('1', 'A', 0, 0), pb('2', 'B', 0, 1)];
        const result = packBlocksLeftAligned(ordered, mastersVary, 900);
        expect(result).not.toBeNull();
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(300);
    });

    it('actualWidthを超える場合はnullを返す', () => {
        const ordered = [
            pb('1', 'A', 0, 0),
            pb('2', 'B', 0, 0),
            pb('3', 'C', 0, 0),
        ];
        // 3 × 300 = 900、actualWidth=800 → overflow
        const result = packBlocksLeftAligned(ordered, masters, 800);
        expect(result).toBeNull();
    });

    it('ちょうど収まる場合は成功する', () => {
        const ordered = [
            pb('1', 'A', 0, 0),
            pb('2', 'B', 0, 0),
            pb('3', 'C', 0, 0),
        ];
        const result = packBlocksLeftAligned(ordered, masters, 900);
        expect(result).not.toBeNull();
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(300);
        expect(result![2].positionX).toBe(600);
    });

    it('空のリストは空を返す', () => {
        const result = packBlocksLeftAligned([], masters, 900);
        expect(result).toEqual([]);
    });

    it('マスタが無いブロックはそのまま通過する', () => {
        const ordered = [pb('1', 'UNKNOWN', 50, 0)];
        const result = packBlocksLeftAligned(ordered, masters, 900);
        expect(result).not.toBeNull();
        expect(result![0].positionX).toBe(50); // 変更されない
    });
});

// =========================================================================
// 3. tryPackWithPosY — 配置済みブロック移動
// =========================================================================

describe('tryPackWithPosY', () => {
    const masters: BlockMasterMap = [
        master('A', 300, 3),
        master('B', 300, 3),
        master('C', 300, 3),
    ];

    it('ブロックを右端から左端に移動（順序入替）', () => {
        // 初期: A(x=0), B(x=300), C(x=600) — 移動: C を targetX=-50（先頭へ）
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0), pb('3', 'C', 600, 0)];
        const result = tryPackWithPosY(blocks, '3', 'C', 0, -50, masters, 900);
        expect(result).not.toBeNull();
        // 新順序: C(0), A(300), B(600)
        expect(result!.map(b => b.id)).toEqual(['3', '1', '2']);
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(300);
        expect(result![2].positionX).toBe(600);
    });

    it('ブロックを左端から右端に移動', () => {
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0), pb('3', 'C', 600, 0)];
        const result = tryPackWithPosY(blocks, '1', 'A', 0, 1000, masters, 900);
        expect(result).not.toBeNull();
        // 新順序: B(0), C(300), A(600)
        expect(result!.map(b => b.id)).toEqual(['2', '3', '1']);
    });

    it('同じ位置に移動（順序変化なし）', () => {
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
        // targetX=50 → B(center=150)より左 → index 0 → A が先頭のまま
        // 移動元 = '1' (A)。remaining = [B(300)]。targetX=50 < B(center=150+300/2=300)なので、insertIdx=0。
        // ordered = [movedA, B] → パック: A(0), B(300)
        const result = tryPackWithPosY(blocks, '1', 'A', 0, 50, masters, 600);
        expect(result).not.toBeNull();
        expect(result!.map(b => b.id)).toEqual(['1', '2']);
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(300);
    });

    it('スペース不足でnullを返す', () => {
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0), pb('3', 'C', 600, 0)];
        // actualWidth=800 → 3個×300=900 → overflow
        const result = tryPackWithPosY(blocks, '1', 'A', 0, 500, masters, 800);
        expect(result).toBeNull();
    });

    it('異なるY位置への移動', () => {
        const mastersVary: BlockMasterMap = [
            master('A', 300, 2),
            master('B', 300, 2),
        ];
        // A(Y=0), B(Y=0) → B を Y=3 に、targetX=0 → Aの中央(150)より左 → Bが先頭挿入
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
        const result = tryPackWithPosY(blocks, '2', 'B', 3, 0, mastersVary, 600);
        expect(result).not.toBeNull();
        // B(Y=3..5) と A(Y=0..2) は重ならない → 両方 X=0
        const aBlock = result!.find(b => b.id === '1')!;
        const bBlock = result!.find(b => b.id === '2')!;
        expect(aBlock.positionX).toBe(0);
        expect(bBlock.positionX).toBe(0);
        expect(bBlock.positionY).toBe(3);
    });
});

// =========================================================================
// 4. tryPackWithNearbyY — 近傍Y探索付き移動
// =========================================================================

describe('tryPackWithNearbyY', () => {
    it('初期Yで配置可能ならそのまま返す', () => {
        const masters: BlockMasterMap = [
            master('A', 300, 2),
            master('B', 300, 2),
        ];
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
        const result = tryPackWithNearbyY(
            blocks, '2', 'B', 0, 0, masters, 600, 5, 2
        );
        expect(result).not.toBeNull();
    });

    it('初期Yで配置不可→近傍Yで配置可能', () => {
        const masters: BlockMasterMap = [
            master('A', 600, 2), // 幅600で全幅を占める
            master('B', 600, 2),
        ];
        // A(Y=0, 幅600), B(Y=0, 幅600) → 同一Y では B が溢れる
        // B を Y=2 に移動すれば A と重ならないので X=0 に配置可能
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 600, 0)];
        const result = tryPackWithNearbyY(
            blocks, '2', 'B', 0, 0, masters, 600, 5, 2
        );
        expect(result).not.toBeNull();
        // B は近傍Y（Y=0不可→Y=-1不可→Y=1不可→...→Y=2可能）に移動
        const bBlock = result!.find(b => b.id === '2');
        expect(bBlock).toBeDefined();
        // B は A と Y 重なりがない位置に配置されている
        expect(bBlock!.positionX).toBe(0);
    });

    it('どのYでも配置不可→nullを返す', () => {
        const masters: BlockMasterMap = [
            master('A', 600, 5), // 全段占める
            master('B', 600, 5), // 全段占める
        ];
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 600, 0)];
        // actualWidth=600、全段が A で埋まっている → B を配置する場所なし
        const result = tryPackWithNearbyY(
            blocks, '2', 'B', 0, 0, masters, 600, 5, 5
        );
        expect(result).toBeNull();
    });
});

// =========================================================================
// 5. findInsertX — 新規配置X位置検索
// =========================================================================

describe('findInsertX', () => {
    const masters: BlockMasterMap = [
        master('A', 300, 3),
        master('B', 300, 3),
    ];

    it('空のプラノグラムで先頭（0）に配置', () => {
        const result = findInsertX([], masters, 300, 0, 3, 900);
        expect(result).toBe(0);
    });

    it('既存ブロックの右側に配置', () => {
        const blocks = [pb('1', 'A', 0, 0)];
        const result = findInsertX(blocks, masters, 300, 0, 3, 900);
        expect(result).toBe(300);
    });

    it('ギャップに配置（2ブロック間のスペース）', () => {
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 600, 0)];
        // A(0..300), gap(300..600), B(600..900)
        const result = findInsertX(blocks, masters, 300, 0, 3, 900);
        expect(result).toBe(300);
    });

    it('スペース不足で-1を返す', () => {
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
        // A(0..300), B(300..600), 残り0 — 300mm幅ブロック配置不可（actualWidth=600）
        const result = findInsertX(blocks, masters, 300, 0, 3, 600);
        expect(result).toBe(-1);
    });

    it('Y範囲が異なるブロックは干渉しない', () => {
        const mastersVary: BlockMasterMap = [
            master('A', 600, 2), // Y=0..2
        ];
        const blocks = [pb('1', 'A', 0, 0)];
        // Y=3..5 の範囲で探す → A(Y=0..2) と重ならない → X=0
        const result = findInsertX(blocks, mastersVary, 300, 3, 5, 600);
        expect(result).toBe(0);
    });

    it('excludeBlockIdが指定されたブロックは無視される', () => {
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
        // B を除外 → A のみ → A(0..300) の右に配置
        const result = findInsertX(blocks, masters, 300, 0, 3, 900, '2');
        expect(result).toBe(300);
    });

    it('先頭にギャップがある場合はX=0に配置', () => {
        const blocks = [pb('1', 'A', 300, 0)]; // A が 300 から始まる
        const result = findInsertX(blocks, masters, 300, 0, 3, 900);
        expect(result).toBe(0);
    });
});

// =========================================================================
// 6. findBestPlacement — 最適配置位置検索
// =========================================================================

describe('findBestPlacement', () => {
    it('空のプラノグラムで初期Yに配置', () => {
        const masters: BlockMasterMap = [master('A', 300, 3)];
        const result = findBestPlacement([], masters, 300, 3, 0, 900, 5);
        expect(result).toEqual({ posY: 0, insertX: 0 });
    });

    it('初期Yで配置不可→近傍Yに配置', () => {
        const masters: BlockMasterMap = [
            master('A', 900, 3), // 全幅占める
        ];
        const blocks = [pb('1', 'A', 0, 0)]; // Y=0..3 を幅900で占める
        // initialPosY=0 → X 空きなし → Y=1 → A(0..3)と重なるので空きなし → Y=2 → A(0..3)と重なる → Y=3 → A(0..3)と重ならない
        const result = findBestPlacement(blocks, masters, 300, 2, 0, 900, 5);
        expect(result).not.toBeNull();
        expect(result!.posY).toBe(3);
        expect(result!.insertX).toBe(0);
    });

    it('配置不可ならnull', () => {
        const masters: BlockMasterMap = [
            master('A', 900, 5),
        ];
        const blocks = [pb('1', 'A', 0, 0)]; // 5段×全幅
        const result = findBestPlacement(blocks, masters, 300, 3, 0, 900, 5);
        expect(result).toBeNull();
    });

    it('excludeBlockIdで指定ブロックを無視して配置可能', () => {
        const masters: BlockMasterMap = [
            master('A', 900, 5),
        ];
        const blocks = [pb('1', 'A', 0, 0)];
        // ブロック1を除外 → 空 → X=0 に配置可能
        const result = findBestPlacement(blocks, masters, 300, 3, 0, 900, 5, '1');
        expect(result).toEqual({ posY: 0, insertX: 0 });
    });
});

// =========================================================================
// 7. calcPreviewPositions — プレビュー位置計算
// =========================================================================

describe('calcPreviewPositions', () => {
    const masters: BlockMasterMap = [
        master('A', 300, 3),
        master('B', 300, 3),
        master('C', 300, 3),
    ];

    it('ドラッグ中ブロックの挿入位置でプレビューを計算', () => {
        const blocks = [
            pb('1', 'A', 0, 0),
            pb('2', 'B', 300, 0),
            pb('3', 'C', 600, 0),
        ];
        // C を先頭に挿入（insertIndex=0, posY=0）
        const positions = calcPreviewPositions(blocks, '3', 0, 0, masters);
        // 順序: C(0), A(300), B(600)
        expect(positions['3']).toBe(0);
        expect(positions['1']).toBe(300);
        expect(positions['2']).toBe(600);
    });

    it('中間に挿入するプレビュー', () => {
        const blocks = [
            pb('1', 'A', 0, 0),
            pb('2', 'B', 300, 0),
            pb('3', 'C', 600, 0),
        ];
        // A を B と C の間に挿入（insertIndex=1, posY=0）
        const positions = calcPreviewPositions(blocks, '1', 1, 0, masters);
        // remaining = [B(300), C(600)] → ordered = [B, A, C]
        expect(positions['2']).toBe(0);   // B → 先頭
        expect(positions['1']).toBe(300); // A → 中央
        expect(positions['3']).toBe(600); // C → 末尾
    });

    it('末尾に挿入するプレビュー', () => {
        const blocks = [
            pb('1', 'A', 0, 0),
            pb('2', 'B', 300, 0),
            pb('3', 'C', 600, 0),
        ];
        // A を末尾に（insertIndex=2, posY=0）
        const positions = calcPreviewPositions(blocks, '1', 2, 0, masters);
        // remaining = [B(300), C(600)] → ordered = [B, C, A]
        expect(positions['2']).toBe(0);
        expect(positions['3']).toBe(300);
        expect(positions['1']).toBe(600);
    });

    it('異なるY位置への移動プレビュー（重ならない場合）', () => {
        const mastersVary: BlockMasterMap = [
            master('A', 300, 2),
            master('B', 300, 2),
        ];
        const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
        // B を Y=3 に移動（insertIndex=0, posY=3）
        // remaining = [A(0)] → ordered = [B(Y=3), A(Y=0)]
        // B(Y=3..5) と A(Y=0..2) は重ならない → 両方 X=0
        const positions = calcPreviewPositions(blocks, '2', 0, 3, mastersVary);
        expect(positions['2']).toBe(0);
        expect(positions['1']).toBe(0);
    });

    it('存在しないブロックIDの場合は空を返す', () => {
        const blocks = [pb('1', 'A', 0, 0)];
        const positions = calcPreviewPositions(blocks, 'nonexistent', 0, 0, masters);
        expect(positions).toEqual({});
    });

    it('ブロックが1つだけの場合', () => {
        const blocks = [pb('1', 'A', 0, 0)];
        const positions = calcPreviewPositions(blocks, '1', 0, 0, masters);
        expect(positions['1']).toBe(0);
    });
});

// =========================================================================
// 8. expandBlockProducts — ブロック商品展開
// =========================================================================

describe('expandBlockProducts', () => {
    it('商品配置を絶対座標に展開する', () => {
        const placements: ProductPlacement[] = [
            { id: 'p1', productId: 'prod-1', shelfIndex: 0, positionX: 0, faceCount: 2 },
            { id: 'p2', productId: 'prod-2', shelfIndex: 1, positionX: 100, faceCount: 1 },
        ];
        const productIds = new Set(['prod-1', 'prod-2']);
        const result = expandBlockProducts(placements, productIds, 500, 2);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            productId: 'prod-1',
            shelfIndex: 2,    // 0 + positionY(2)
            positionX: 500,   // 0 + positionX(500)
            faceCount: 2
        });
        expect(result[1]).toEqual({
            productId: 'prod-2',
            shelfIndex: 3,    // 1 + 2
            positionX: 600,   // 100 + 500
            faceCount: 1
        });
    });

    it('存在しない商品IDはフィルターされる', () => {
        const placements: ProductPlacement[] = [
            { id: 'p1', productId: 'prod-1', shelfIndex: 0, positionX: 0, faceCount: 1 },
            { id: 'p2', productId: 'missing', shelfIndex: 0, positionX: 100, faceCount: 1 },
        ];
        const productIds = new Set(['prod-1']);
        const result = expandBlockProducts(placements, productIds, 0, 0);
        expect(result).toHaveLength(1);
        expect(result[0].productId).toBe('prod-1');
    });

    it('空の配置リストは空を返す', () => {
        const result = expandBlockProducts([], new Set(['prod-1']), 0, 0);
        expect(result).toEqual([]);
    });
});

// =========================================================================
// 9. calcPosYFromVisualRow — Y位置計算
// =========================================================================

describe('calcPosYFromVisualRow', () => {
    it('最上段（visualRow=0）→ posY = shelfCount - blockShelfCount', () => {
        // 5段棚に3段ブロック → posY = 5 - 0 - 3 = 2
        expect(calcPosYFromVisualRow(0, 5, 3)).toBe(2);
    });

    it('最下段（visualRow=4）→ posY = 0', () => {
        // 5段棚に3段ブロック、visualRow=4 → 5 - 4 - 3 = -2 → clamp to 0
        expect(calcPosYFromVisualRow(4, 5, 3)).toBe(0);
    });

    it('中間段', () => {
        // 5段棚に2段ブロック、visualRow=2 → 5 - 2 - 2 = 1
        expect(calcPosYFromVisualRow(2, 5, 2)).toBe(1);
    });

    it('ブロックが棚と同じ段数の場合は常に0', () => {
        expect(calcPosYFromVisualRow(0, 5, 5)).toBe(0);
        expect(calcPosYFromVisualRow(3, 5, 5)).toBe(0);
    });

    it('1段ブロックの場合', () => {
        // 5段棚に1段ブロック、visualRow=0 → 5 - 0 - 1 = 4
        expect(calcPosYFromVisualRow(0, 5, 1)).toBe(4);
        // visualRow=4 → 5 - 4 - 1 = 0
        expect(calcPosYFromVisualRow(4, 5, 1)).toBe(0);
    });
});

// =========================================================================
// 10. 統合テスト — 実際の再配置シナリオ
// =========================================================================

describe('統合テスト: ブロック再配置シナリオ', () => {
    // 共通セットアップ: 3尺(900mm) × 5段の棚に、300mmブロック3つ
    const masters: BlockMasterMap = [
        master('A', 300, 3),
        master('B', 300, 3),
        master('C', 300, 3),
    ];

    describe('水平移動（同一Y）', () => {
        it('[A][B][C] → [B][A][C]: Aを中央に移動', () => {
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0), pb('3', 'C', 600, 0)];
            // A を targetX=350 に → B(center=150)右、C(center=450)左 → insertIdx=1 → [B, A, C]
            // remaining(without A) = [B(300), C(600)]。
            // B center = 300 + 150 = 450。targetX=350 < 450 → insertIdx=0
            // → ordered = [A, B, C] → pack: A(0), B(300), C(600) — 変化なし!
            // もう少し右に: targetX=500 → B(450)右, C(750)左 → insertIdx=1 → [B, A, C]
            const result = tryPackWithPosY(blocks, '1', 'A', 0, 500, masters, 900);
            expect(result).not.toBeNull();
            expect(result!.map(b => b.id)).toEqual(['2', '1', '3']);
            expect(result![0].positionX).toBe(0);
            expect(result![1].positionX).toBe(300);
            expect(result![2].positionX).toBe(600);
        });

        it('[A][B][C] → [C][B][A]: 完全逆順', () => {
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0), pb('3', 'C', 600, 0)];
            // Step 1: C を先頭に移動（targetX=-50）
            const step1 = tryPackWithPosY(blocks, '3', 'C', 0, -50, masters, 900);
            expect(step1).not.toBeNull();
            expect(step1!.map(b => b.id)).toEqual(['3', '1', '2']);

            // Step 2: A(現在x=300)を末尾に移動（targetX=1000）
            const step2 = tryPackWithPosY(step1!, '1', 'A', 0, 1000, masters, 900);
            expect(step2).not.toBeNull();
            expect(step2!.map(b => b.id)).toEqual(['3', '2', '1']);
        });

        it('ブロック1つだけの場合は位置が変わらない', () => {
            const blocks = [pb('1', 'A', 0, 0)];
            const result = tryPackWithPosY(blocks, '1', 'A', 0, 500, masters, 900);
            expect(result).not.toBeNull();
            expect(result![0].positionX).toBe(0);
        });
    });

    describe('垂直移動（Y変更）', () => {
        it('ブロックを異なる段に移動（Y重なりなし→同一X可能）', () => {
            const mastersVary: BlockMasterMap = [
                master('A', 300, 2),
                master('B', 300, 2),
            ];
            // A(Y=0), B(Y=0) → B を Y=3 に移動
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
            const result = tryPackWithPosY(blocks, '2', 'B', 3, 0, mastersVary, 300);
            expect(result).not.toBeNull();
            // A(Y=0..2) と B(Y=3..5) は重ならない → 両方 X=0
            expect(result!.find(b => b.id === '1')!.positionX).toBe(0);
            expect(result!.find(b => b.id === '2')!.positionX).toBe(0);
        });

        it('ブロックを部分的にY重なる位置に移動', () => {
            const mastersVary: BlockMasterMap = [
                master('A', 300, 3),
                master('B', 300, 3),
            ];
            // A(Y=0..3), B(Y=0..3) → B を Y=1, targetX=0 → Aの中央(150)より左 → Bが先頭挿入
            // ordered = [B(Y=1), A(Y=0)] → B(x=0), A と B は Y 重なり(0..3 vs 1..4) → A(x=300)
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
            const result = tryPackWithPosY(blocks, '2', 'B', 1, 0, mastersVary, 600);
            expect(result).not.toBeNull();
            expect(result!.find(b => b.id === '2')!.positionX).toBe(0);   // B が先頭
            expect(result!.find(b => b.id === '1')!.positionX).toBe(300); // A が右にずれる
        });
    });

    describe('近傍Y探索', () => {
        it('初期Yで配置不可→上下のYを探索', () => {
            const mastersVary: BlockMasterMap = [
                master('A', 600, 2),
                master('B', 600, 2),
            ];
            // A(Y=0, 幅600)が全幅占める → B を Y=0 に配置不可
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 600, 0)];
            const result = tryPackWithNearbyY(
                blocks, '2', 'B', 0, 0, mastersVary, 600, 6, 2
            );
            expect(result).not.toBeNull();
            // B は Y=2 以上に移動（Aと重ならない位置）
            const bBlock = result!.find(b => b.id === '2')!;
            expect(bBlock.positionY).toBeGreaterThanOrEqual(2);
            expect(bBlock.positionX).toBe(0);
        });
    });

    describe('パレットからの新規配置', () => {
        it('空の棚に新規ブロックを配置', () => {
            const masters: BlockMasterMap = [master('A', 300, 3)];
            const result = findBestPlacement([], masters, 300, 3, 0, 900, 5);
            expect(result).toEqual({ posY: 0, insertX: 0 });
        });

        it('既存ブロックの隣に新規配置', () => {
            const masters: BlockMasterMap = [master('A', 300, 3)];
            const blocks = [pb('1', 'A', 0, 0)];
            const result = findBestPlacement(blocks, masters, 300, 3, 0, 900, 5);
            expect(result).toEqual({ posY: 0, insertX: 300 });
        });

        it('同一Y段が満杯→異なるY段に配置', () => {
            const masters: BlockMasterMap = [
                master('A', 300, 3),
                master('B', 300, 3),
                master('C', 300, 3),
            ];
            const blocks = [
                pb('1', 'A', 0, 0),
                pb('2', 'B', 300, 0),
                pb('3', 'C', 600, 0),
            ];
            // Y=0..3 が全幅(900)埋まっている → Y=3以上で探す
            const result = findBestPlacement(blocks, masters, 300, 2, 0, 900, 5);
            expect(result).not.toBeNull();
            expect(result!.posY).toBeGreaterThanOrEqual(1); // 近傍Y
            expect(result!.insertX).toBe(0);
        });
    });

    describe('エッジケース', () => {
        it('幅0.1mm以内の誤差は許容される（0.1mm tolerance）', () => {
            const masters: BlockMasterMap = [master('A', 300, 3)];
            // actualWidth=300.05 で 300mm ブロック → 収まる（0.1誤差内）
            const result = findInsertX([], masters, 300, 0, 3, 300.05);
            expect(result).toBe(0);
        });

        it('棚段数1のプラノグラムでも動作する', () => {
            const masters: BlockMasterMap = [master('A', 300, 1)];
            const result = findBestPlacement([], masters, 300, 1, 0, 900, 1);
            expect(result).toEqual({ posY: 0, insertX: 0 });
        });

        it('幅の異なるブロックの混在', () => {
            const mastersVary: BlockMasterMap = [
                master('A', 300, 3),
                master('B', 600, 3),
            ];
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
            // A(300) + B(600) = 900 → ちょうど収まる
            const result = packBlocksLeftAligned(
                [pb('1', 'A', 0, 0), pb('2', 'B', 0, 0)],
                mastersVary,
                900
            );
            expect(result).not.toBeNull();
            expect(result![0].positionX).toBe(0);
            expect(result![1].positionX).toBe(300);
        });

        it('多数のブロックの再配置', () => {
            const manyMasters: BlockMasterMap = Array.from({ length: 10 }, (_, i) =>
                master(`M${i}`, 90, 1)
            );
            const manyBlocks = Array.from({ length: 10 }, (_, i) =>
                pb(`${i}`, `M${i}`, i * 90, 0)
            );
            // 先頭ブロック(id=0)を末尾に移動
            const result = tryPackWithPosY(manyBlocks, '0', 'M0', 0, 1000, manyMasters, 900);
            expect(result).not.toBeNull();
            expect(result!.map(b => b.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
            // 全て左詰め
            for (let i = 0; i < 10; i++) {
                expect(result![i].positionX).toBe(i * 90);
            }
        });

        it('2ブロック間の隙間に新規配置（ギャップフィル）', () => {
            const masters: BlockMasterMap = [
                master('A', 200, 3),
                master('B', 200, 3),
            ];
            // A(0..200), gap(200..400), B(400..600)
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 400, 0)];
            const result = findInsertX(blocks, masters, 200, 0, 3, 600);
            expect(result).toBe(200); // ギャップに入る
        });

        it('ブロック幅がギャップより大きい場合はスキップ', () => {
            const masters: BlockMasterMap = [
                master('A', 200, 3),
                master('B', 200, 3),
            ];
            // A(0..200), gap(200..350), B(350..550)
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 350, 0)];
            // 200mmブロックを挿入 → gap=150mm → 入らない → B の右(550)
            const result = findInsertX(blocks, masters, 200, 0, 3, 900);
            expect(result).toBe(550);
        });
    });
});

// =========================================================================
// 11. 棚ブロック管理画面との挙動一致テスト
// =========================================================================

describe('棚ブロック管理画面の商品再配置と同じ挙動', () => {
    const masters: BlockMasterMap = [
        master('A', 300, 3),
        master('B', 300, 3),
        master('C', 300, 3),
    ];

    it('中央より左にドロップ→左側に挿入（棚ブロック管理と同じ判定）', () => {
        const remaining = [pb('1', 'A', 0, 0)];
        // A の中央(150)より左(100)→ index 0（前に挿入）
        expect(calcBlockInsertIndex(remaining, 100, masters)).toBe(0);
    });

    it('中央より右にドロップ→右側に挿入（棚ブロック管理と同じ判定）', () => {
        const remaining = [pb('1', 'A', 0, 0)];
        // A の中央(150)より右(200)→ index 1（後に挿入）
        expect(calcBlockInsertIndex(remaining, 200, masters)).toBe(1);
    });

    it('移動後は全ブロックが左詰めされる（棚ブロック管理の recalculatePositions と同じ）', () => {
        const blocks = [
            pb('1', 'A', 0, 0),
            pb('2', 'B', 300, 0),
            pb('3', 'C', 600, 0),
        ];
        // C を先頭に移動
        const result = tryPackWithPosY(blocks, '3', 'C', 0, -100, masters, 900);
        expect(result).not.toBeNull();
        // 隙間なく左詰め
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(300);
        expect(result![2].positionX).toBe(600);
    });

    it('プレビュー位置が最終位置と一致する（棚ブロック管理と同じ）', () => {
        const blocks = [
            pb('1', 'A', 0, 0),
            pb('2', 'B', 300, 0),
            pb('3', 'C', 600, 0),
        ];

        // C を先頭にドラッグ中のプレビュー
        const preview = calcPreviewPositions(blocks, '3', 0, 0, masters);
        // 実際にドロップ後の結果
        const packed = tryPackWithPosY(blocks, '3', 'C', 0, -100, masters, 900);

        expect(packed).not.toBeNull();
        // プレビュー位置と最終位置が一致
        for (const b of packed!) {
            expect(preview[b.id]).toBe(b.positionX);
        }
    });

    it('オーバーフロー時はnull（棚ブロック管理の「スペースがありません」と同じ）', () => {
        const blocks = [
            pb('1', 'A', 0, 0),
            pb('2', 'B', 300, 0),
            pb('3', 'C', 600, 0),
        ];
        // actualWidth=800 → 3×300=900 → overflow
        const result = tryPackWithPosY(blocks, '1', 'A', 0, 500, masters, 800);
        expect(result).toBeNull();
    });
});

// =========================================================================
// 12. swapBlock — 矢印ボタンによるブロック入れ替え
// =========================================================================

describe('swapBlock', () => {
    const masters: BlockMasterMap = [
        master('A', 300, 3),
        master('B', 300, 3),
        master('C', 300, 3),
    ];

    describe('左右入れ替え', () => {
        it('[A][B][C] → 左クリックで B を左に移動 → [B][A][C]', () => {
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0), pb('3', 'C', 600, 0)];
            const result = swapBlock(blocks, '2', 'left', masters, 900, 5);
            expect(result).not.toBeNull();
            expect(result!.map(b => b.id)).toEqual(['2', '1', '3']);
            expect(result![0].positionX).toBe(0);
            expect(result![1].positionX).toBe(300);
            expect(result![2].positionX).toBe(600);
        });

        it('[A][B][C] → 右クリックで B を右に移動 → [A][C][B]', () => {
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0), pb('3', 'C', 600, 0)];
            const result = swapBlock(blocks, '2', 'right', masters, 900, 5);
            expect(result).not.toBeNull();
            expect(result!.map(b => b.id)).toEqual(['1', '3', '2']);
            expect(result![0].positionX).toBe(0);
            expect(result![1].positionX).toBe(300);
            expect(result![2].positionX).toBe(600);
        });

        it('左端ブロックをさらに左 → null（移動不可）', () => {
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
            const result = swapBlock(blocks, '1', 'left', masters, 600, 5);
            expect(result).toBeNull();
        });

        it('右端ブロックをさらに右 → null（移動不可）', () => {
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
            const result = swapBlock(blocks, '2', 'right', masters, 600, 5);
            expect(result).toBeNull();
        });

        it('ブロック1つだけ → 左右どちらもnull', () => {
            const blocks = [pb('1', 'A', 0, 0)];
            expect(swapBlock(blocks, '1', 'left', masters, 900, 5)).toBeNull();
            expect(swapBlock(blocks, '1', 'right', masters, 900, 5)).toBeNull();
        });

        it('Y範囲が重ならないブロックは入れ替え対象外', () => {
            const mastersVary: BlockMasterMap = [
                master('A', 300, 2), // Y=0..2
                master('B', 300, 2), // Y=3..5
            ];
            // A(Y=0, X=0), B(Y=3, X=0) → Y重なりなし → 左右入れ替え不可
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 0, 3)];
            expect(swapBlock(blocks, '1', 'right', mastersVary, 600, 5)).toBeNull();
        });

        it('幅が異なるブロックの入れ替え後も左詰めされる', () => {
            const mastersVary: BlockMasterMap = [
                master('A', 200, 3),
                master('B', 400, 3),
            ];
            // [A(200)][B(400)] → B を左に → [B(0)][A(400)]
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 200, 0)];
            const result = swapBlock(blocks, '2', 'left', mastersVary, 600, 5);
            expect(result).not.toBeNull();
            expect(result![0].id).toBe('2'); // B が先頭
            expect(result![0].positionX).toBe(0);
            expect(result![1].id).toBe('1'); // A が次
            expect(result![1].positionX).toBe(400); // B(400幅)の右
        });
    });

    describe('上下移動', () => {
        it('ブロックを1段上に移動', () => {
            const blocks = [pb('1', 'A', 0, 0)];
            const result = swapBlock(blocks, '1', 'up', masters, 900, 5);
            expect(result).not.toBeNull();
            expect(result![0].positionY).toBe(1);
        });

        it('ブロックを1段下に移動', () => {
            const blocks = [pb('1', 'A', 0, 2)];
            const result = swapBlock(blocks, '1', 'down', masters, 900, 5);
            expect(result).not.toBeNull();
            expect(result![0].positionY).toBe(1);
        });

        it('最上段でさらに上 → null（移動不可）', () => {
            // 5段棚に3段ブロック → maxPosY = 2。Y=2 が最上
            const blocks = [pb('1', 'A', 0, 2)];
            const result = swapBlock(blocks, '1', 'up', masters, 900, 5);
            expect(result).toBeNull();
        });

        it('最下段でさらに下 → null（移動不可）', () => {
            const blocks = [pb('1', 'A', 0, 0)];
            const result = swapBlock(blocks, '1', 'down', masters, 900, 5);
            expect(result).toBeNull();
        });

        it('上下移動後も左詰めパッキングされる', () => {
            const mastersVary: BlockMasterMap = [
                master('A', 300, 2),
                master('B', 300, 2),
            ];
            // A(Y=0, X=0), B(Y=0, X=300) → A を up(Y=1) → A(Y=1..3), B(Y=0..2) → Y重なり → 左詰め
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0)];
            const result = swapBlock(blocks, '1', 'up', mastersVary, 600, 4);
            expect(result).not.toBeNull();
            // A は Y=1 に移動、B は Y=0 のまま → Y 重なりあり → 横に並ぶ
            const aBlock = result!.find(b => b.id === '1')!;
            const bBlock = result!.find(b => b.id === '2')!;
            expect(aBlock.positionY).toBe(1);
            expect(bBlock.positionY).toBe(0);
        });

        it('上下移動でオーバーフローする場合はnull', () => {
            const mastersVary: BlockMasterMap = [
                master('A', 600, 2),
                master('B', 600, 2),
            ];
            // A(Y=0, X=0), B(Y=2, X=0) → A を up(Y=1) → A(Y=1..3)とB(Y=2..4)が重なり→横並び→1200>600 overflow
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 0, 2)];
            const result = swapBlock(blocks, '1', 'up', mastersVary, 600, 4);
            expect(result).toBeNull();
        });
    });

    describe('存在しないブロック', () => {
        it('存在しないIDを指定 → null', () => {
            const blocks = [pb('1', 'A', 0, 0)];
            expect(swapBlock(blocks, 'nonexistent', 'left', masters, 900, 5)).toBeNull();
        });
    });

    describe('連続入れ替え', () => {
        it('[A][B][C] → Aを右に2回 → [B][C][A]', () => {
            const blocks = [pb('1', 'A', 0, 0), pb('2', 'B', 300, 0), pb('3', 'C', 600, 0)];

            // 1回目: A を右に → [B][A][C]
            const step1 = swapBlock(blocks, '1', 'right', masters, 900, 5);
            expect(step1).not.toBeNull();
            expect(step1!.map(b => b.id)).toEqual(['2', '1', '3']);

            // 2回目: A を右に → [B][C][A]
            const step2 = swapBlock(step1!, '1', 'right', masters, 900, 5);
            expect(step2).not.toBeNull();
            expect(step2!.map(b => b.id)).toEqual(['2', '3', '1']);
            expect(step2![0].positionX).toBe(0);
            expect(step2![1].positionX).toBe(300);
            expect(step2![2].positionX).toBe(600);
        });
    });
});
