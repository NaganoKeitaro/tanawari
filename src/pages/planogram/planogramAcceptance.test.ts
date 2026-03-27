// 棚割作成パターンの受け入れテスト（総合テスト）
// ブロック配置、再配置、入れ替え、商品展開の全パターン
import { describe, it, expect } from 'vitest';
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
} from './standardPlanogramRearrange';
import type { StandardPlanogramBlock, ProductPlacement } from '../../data/types';
import type { BlockMasterMap } from './standardPlanogramRearrange';

// ================================================================
// ヘルパー
// ================================================================

function block(id: string, blockId: string, posX: number, posY: number): StandardPlanogramBlock {
    return { id, blockId, positionX: posX, positionY: posY };
}

// ================================================================
// 1. ブロック挿入インデックス計算
// ================================================================

describe('calcBlockInsertIndex', () => {
    const masters: BlockMasterMap = [
        { id: 'A', width: 300, shelfCount: 3 },
        { id: 'B', width: 300, shelfCount: 3 },
        { id: 'C', width: 300, shelfCount: 3 },
    ];

    it('先頭に挿入', () => {
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 300, 0),
        ];
        // ターゲットX=0 → ブロックAの中央150より前 → index 0
        expect(calcBlockInsertIndex(blocks, 0, masters)).toBe(0);
    });

    it('中間に挿入', () => {
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 300, 0),
        ];
        // ターゲットX=200 → A中央150を超え、B中央450未満 → index 1
        expect(calcBlockInsertIndex(blocks, 200, masters)).toBe(1);
    });

    it('末尾に挿入', () => {
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 300, 0),
        ];
        expect(calcBlockInsertIndex(blocks, 600, masters)).toBe(2);
    });

    it('空リストには index 0', () => {
        expect(calcBlockInsertIndex([], 100, masters)).toBe(0);
    });
});

// ================================================================
// 2. 左詰めパッキング
// ================================================================

describe('packBlocksLeftAligned', () => {
    it('同一Y範囲のブロックが左詰めされる', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 300, shelfCount: 3 },
            { id: 'B', width: 200, shelfCount: 3 },
        ];
        const blocks = [
            block('pb1', 'A', 500, 0), // 元の位置は無関係
            block('pb2', 'B', 100, 0),
        ];
        const result = packBlocksLeftAligned(blocks, masters, 600);

        expect(result).not.toBeNull();
        expect(result![0].positionX).toBe(0);   // A → 左端
        expect(result![1].positionX).toBe(300);  // B → Aの右
    });

    it('Y範囲が重ならないブロックは同じX位置に配置可能', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 300, shelfCount: 2 },
            { id: 'B', width: 300, shelfCount: 2 },
        ];
        const blocks = [
            block('pb1', 'A', 0, 0), // Y: 0-1
            block('pb2', 'B', 0, 2), // Y: 2-3 → 重ならない
        ];
        const result = packBlocksLeftAligned(blocks, masters, 300);

        expect(result).not.toBeNull();
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(0); // 同じX位置に配置
    });

    it('幅超過でnull', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 500, shelfCount: 3 },
            { id: 'B', width: 500, shelfCount: 3 },
        ];
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 0, 0),
        ];
        const result = packBlocksLeftAligned(blocks, masters, 800); // 500+500=1000 > 800
        expect(result).toBeNull();
    });

    it('3ブロック連続配置', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 100, shelfCount: 3 },
            { id: 'B', width: 200, shelfCount: 3 },
            { id: 'C', width: 150, shelfCount: 3 },
        ];
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 0, 0),
            block('pb3', 'C', 0, 0),
        ];
        const result = packBlocksLeftAligned(blocks, masters, 500);
        expect(result).not.toBeNull();
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(100);
        expect(result![2].positionX).toBe(300);
    });
});

// ================================================================
// 3. tryPackWithPosY
// ================================================================

describe('tryPackWithPosY', () => {
    const masters: BlockMasterMap = [
        { id: 'A', width: 300, shelfCount: 3 },
        { id: 'B', width: 300, shelfCount: 3 },
    ];

    it('正常に配置できる', () => {
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 300, 0),
        ];
        const result = tryPackWithPosY(blocks, 'pb1', 'A', 0, 0, masters, 600);
        expect(result).not.toBeNull();
    });

    it('幅不足でnull', () => {
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 300, 0),
        ];
        const result = tryPackWithPosY(blocks, 'pb1', 'A', 0, 0, masters, 400);
        // 300+300=600 > 400
        expect(result).toBeNull();
    });
});

// ================================================================
// 4. tryPackWithNearbyY
// ================================================================

describe('tryPackWithNearbyY', () => {
    it('初期Yで配置できない場合、近傍Yで成功', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 500, shelfCount: 2 },
            { id: 'B', width: 500, shelfCount: 2 },
        ];
        // Y=0に両ブロック → 幅不足 → Y=2にずらせば重ならないのでOK
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 500, 0),
        ];
        const result = tryPackWithNearbyY(
            blocks, 'pb2', 'B', 0, 0, masters, 500, 5, 2
        );
        expect(result).not.toBeNull();
    });
});

// ================================================================
// 5. findInsertX
// ================================================================

describe('findInsertX', () => {
    const masters: BlockMasterMap = [
        { id: 'A', width: 300, shelfCount: 3 },
    ];

    it('空の棚に配置 → X=0', () => {
        expect(findInsertX([], masters, 300, 0, 3, 900)).toBe(0);
    });

    it('既存ブロックの右に配置', () => {
        const blocks = [block('pb1', 'A', 0, 0)];
        expect(findInsertX(blocks, masters, 300, 0, 3, 900)).toBe(300);
    });

    it('スペース不足で-1', () => {
        const blocks = [block('pb1', 'A', 0, 0)];
        // existingEnd=300, need 300 more → 300+300=600 > 500 → -1
        expect(findInsertX(blocks, masters, 300, 0, 3, 500)).toBe(-1);
        expect(findInsertX(blocks, masters, 300, 0, 3, 400)).toBe(-1);
    });

    it('間の隙間に配置', () => {
        const bigMasters: BlockMasterMap = [
            { id: 'A', width: 100, shelfCount: 3 },
            { id: 'B', width: 100, shelfCount: 3 },
        ];
        // A at 0, B at 300 → gap 100-300 (200mm) に 100mm ブロックが入る
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 300, 0),
        ];
        expect(findInsertX(blocks, bigMasters, 100, 0, 3, 500)).toBe(100);
    });
});

// ================================================================
// 6. findBestPlacement
// ================================================================

describe('findBestPlacement', () => {
    it('空の棚への配置', () => {
        const masters: BlockMasterMap = [];
        const result = findBestPlacement([], masters, 300, 3, 0, 900, 5);
        expect(result).not.toBeNull();
        expect(result!.posY).toBe(0);
        expect(result!.insertX).toBe(0);
    });

    it('既存ブロック横に配置', () => {
        const masters: BlockMasterMap = [{ id: 'A', width: 300, shelfCount: 3 }];
        const blocks = [block('pb1', 'A', 0, 0)];
        const result = findBestPlacement(blocks, masters, 300, 3, 0, 900, 5);
        expect(result).not.toBeNull();
        expect(result!.insertX).toBe(300);
    });

    it('同一Yで溢れた場合、別Yで配置', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 500, shelfCount: 2 },
        ];
        const blocks = [block('pb1', 'A', 0, 0)];
        // 幅500の棚にもう一つ500を追加 → Y=0では溢れるがY=2なら入る
        const result = findBestPlacement(blocks, masters, 500, 2, 0, 500, 5);
        expect(result).not.toBeNull();
        expect(result!.posY).not.toBe(0); // 別のYに配置
    });
});

// ================================================================
// 7. calcPreviewPositions
// ================================================================

describe('calcPreviewPositions', () => {
    it('ドラッグ中のブロック位置が正しく計算される', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 300, shelfCount: 3 },
            { id: 'B', width: 300, shelfCount: 3 },
        ];
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 300, 0),
        ];

        // pb1をindex 1に移動（pb2の後ろ）
        const positions = calcPreviewPositions(blocks, 'pb1', 1, 0, masters);

        expect(positions['pb2']).toBe(0);   // pb2が先
        expect(positions['pb1']).toBe(300); // pb1が後ろ
    });
});

// ================================================================
// 8. expandBlockProducts
// ================================================================

describe('expandBlockProducts', () => {
    it('ブロック内商品を絶対座標に展開', () => {
        const placements: ProductPlacement[] = [
            { productId: 'p1', shelfIndex: 0, positionX: 0, faceCount: 2 },
            { productId: 'p2', shelfIndex: 1, positionX: 100, faceCount: 1 },
        ];
        const productIds = new Set(['p1', 'p2', 'p3']);

        const result = expandBlockProducts(placements, productIds, 300, 2);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            productId: 'p1',
            shelfIndex: 2,    // 2 + 0
            positionX: 300,    // 300 + 0
            faceCount: 2,
        });
        expect(result[1]).toEqual({
            productId: 'p2',
            shelfIndex: 3,    // 2 + 1
            positionX: 400,    // 300 + 100
            faceCount: 1,
        });
    });

    it('存在しない商品IDはフィルタされる', () => {
        const placements: ProductPlacement[] = [
            { productId: 'p1', shelfIndex: 0, positionX: 0, faceCount: 1 },
            { productId: 'pX', shelfIndex: 0, positionX: 100, faceCount: 1 },
        ];
        const productIds = new Set(['p1']); // pXは含まない

        const result = expandBlockProducts(placements, productIds, 0, 0);
        expect(result).toHaveLength(1);
        expect(result[0].productId).toBe('p1');
    });

    it('空の配置リストからは空配列', () => {
        const result = expandBlockProducts([], new Set(['p1']), 0, 0);
        expect(result).toHaveLength(0);
    });
});

// ================================================================
// 9. calcPosYFromVisualRow
// ================================================================

describe('calcPosYFromVisualRow', () => {
    it('5段棚でvisualRow=0 → posY=最大', () => {
        // visualRow=0(最上段表示) → posY = 5-0-blockShelfCount
        expect(calcPosYFromVisualRow(0, 5, 2)).toBe(3); // 5-0-2=3
    });

    it('5段棚でvisualRow=4 → posY=0', () => {
        // visualRow=4(最下段表示) → posY = max(0, 5-4-1)=0
        expect(calcPosYFromVisualRow(4, 5, 1)).toBe(0);
    });

    it('ブロック段数が棚段数と同じ → posY=0', () => {
        expect(calcPosYFromVisualRow(0, 5, 5)).toBe(0);
    });

    it('負にならない', () => {
        expect(calcPosYFromVisualRow(4, 5, 3)).toBe(0);
    });
});

// ================================================================
// 10. swapBlock（ブロック入れ替え）
// ================================================================

describe('swapBlock', () => {
    describe('左右入れ替え', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 300, shelfCount: 3 },
            { id: 'B', width: 200, shelfCount: 3 },
            { id: 'C', width: 100, shelfCount: 3 },
        ];

        it('右に入れ替え', () => {
            const blocks = [
                block('pb1', 'A', 0, 0),
                block('pb2', 'B', 300, 0),
                block('pb3', 'C', 500, 0),
            ];
            const result = swapBlock(blocks, 'pb1', 'right', masters, 600, 3);
            expect(result).not.toBeNull();

            // pb2が左、pb1が右になる
            const pb1 = result!.find(b => b.id === 'pb1')!;
            const pb2 = result!.find(b => b.id === 'pb2')!;
            expect(pb2.positionX).toBeLessThan(pb1.positionX);
        });

        it('左に入れ替え', () => {
            const blocks = [
                block('pb1', 'A', 0, 0),
                block('pb2', 'B', 300, 0),
            ];
            const result = swapBlock(blocks, 'pb2', 'left', masters, 600, 3);
            expect(result).not.toBeNull();

            const pb1 = result!.find(b => b.id === 'pb1')!;
            const pb2 = result!.find(b => b.id === 'pb2')!;
            expect(pb2.positionX).toBeLessThan(pb1.positionX);
        });

        it('左端ブロックをさらに左 → null', () => {
            const blocks = [
                block('pb1', 'A', 0, 0),
                block('pb2', 'B', 300, 0),
            ];
            expect(swapBlock(blocks, 'pb1', 'left', masters, 600, 3)).toBeNull();
        });

        it('右端ブロックをさらに右 → null', () => {
            const blocks = [
                block('pb1', 'A', 0, 0),
                block('pb2', 'B', 300, 0),
            ];
            expect(swapBlock(blocks, 'pb2', 'right', masters, 600, 3)).toBeNull();
        });
    });

    describe('上下移動', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 300, shelfCount: 2 },
        ];

        it('上に移動', () => {
            const blocks = [block('pb1', 'A', 0, 0)]; // posY=0
            const result = swapBlock(blocks, 'pb1', 'up', masters, 300, 5);
            expect(result).not.toBeNull();
            expect(result![0].positionY).toBe(1);
        });

        it('下に移動', () => {
            const blocks = [block('pb1', 'A', 0, 2)]; // posY=2
            const result = swapBlock(blocks, 'pb1', 'down', masters, 300, 5);
            expect(result).not.toBeNull();
            expect(result![0].positionY).toBe(1);
        });

        it('最上段からさらに上 → null', () => {
            const blocks = [block('pb1', 'A', 0, 3)]; // maxPosY=3 for shelfCount=5, blockShelf=2
            expect(swapBlock(blocks, 'pb1', 'up', masters, 300, 5)).toBeNull();
        });

        it('最下段からさらに下 → null', () => {
            const blocks = [block('pb1', 'A', 0, 0)];
            expect(swapBlock(blocks, 'pb1', 'down', masters, 300, 5)).toBeNull();
        });
    });

    describe('Y範囲が異なるブロックは左右入れ替え対象外', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 300, shelfCount: 2 },
            { id: 'B', width: 300, shelfCount: 2 },
        ];

        it('Y範囲が重ならないブロック同士の左右入れ替えはnull', () => {
            const blocks = [
                block('pb1', 'A', 0, 0),  // Y: 0-1
                block('pb2', 'B', 0, 2),  // Y: 2-3 → 同じX位置だが重ならない
            ];
            // pb1の右に入れ替えようとしてもoverlapping内にpb2がいない
            expect(swapBlock(blocks, 'pb1', 'right', masters, 600, 5)).toBeNull();
        });
    });

    describe('入れ替え後の左詰め検証', () => {
        it('入れ替え後にブロック位置が正しく左詰めされる', () => {
            const masters: BlockMasterMap = [
                { id: 'A', width: 200, shelfCount: 3 },
                { id: 'B', width: 300, shelfCount: 3 },
            ];
            const blocks = [
                block('pb1', 'A', 0, 0),    // 200mm
                block('pb2', 'B', 200, 0),   // 300mm
            ];
            // pb1を右に入れ替え → Bが左、Aが右
            const result = swapBlock(blocks, 'pb1', 'right', masters, 600, 3);
            expect(result).not.toBeNull();

            const pb1 = result!.find(b => b.id === 'pb1')!;
            const pb2 = result!.find(b => b.id === 'pb2')!;
            expect(pb2.positionX).toBe(0);   // B(300mm)が左端
            expect(pb1.positionX).toBe(300);  // A(200mm)がBの右
        });
    });
});

// ================================================================
// 統合テスト: 実際のダミーデータ構成を再現
// ================================================================

describe('統合: 6部門ブロック構成の標準棚割', () => {
    // 6部門のブロック
    const masters: BlockMasterMap = [
        { id: 'beef-a', width: 3600, shelfCount: 5 },
        { id: 'beef-b', width: 2400, shelfCount: 5 },
        { id: 'pork-a', width: 3600, shelfCount: 5 },
        { id: 'chicken-a', width: 2400, shelfCount: 5 },
        { id: 'processed-a', width: 1800, shelfCount: 5 },
        { id: 'ms-a', width: 1200, shelfCount: 5 },
    ];

    it('ブロック6つが80尺(24000mm)に収まる', () => {
        const blocks = [
            block('pb1', 'beef-a', 0, 0),
            block('pb2', 'beef-b', 3600, 0),
            block('pb3', 'pork-a', 6000, 0),
            block('pb4', 'chicken-a', 9600, 0),
            block('pb5', 'processed-a', 12000, 0),
            block('pb6', 'ms-a', 13800, 0),
        ];
        // 合計: 3600+2400+3600+2400+1800+1200 = 15000mm
        const result = packBlocksLeftAligned(blocks, masters, 24000);
        expect(result).not.toBeNull();
    });

    it('ブロック入れ替え: beef-aとbeef-bの左右入れ替え', () => {
        const blocks = [
            block('pb1', 'beef-a', 0, 0),
            block('pb2', 'beef-b', 3600, 0),
            block('pb3', 'pork-a', 6000, 0),
        ];
        const result = swapBlock(blocks, 'pb1', 'right', masters, 24000, 5);
        expect(result).not.toBeNull();

        const pb1 = result!.find(b => b.id === 'pb1')!;
        const pb2 = result!.find(b => b.id === 'pb2')!;
        // beef-bが先、beef-aが後ろ
        expect(pb2.positionX).toBeLessThan(pb1.positionX);
    });

    it('新規ブロック追加 → 空き位置に配置', () => {
        const blocks = [
            block('pb1', 'beef-a', 0, 0),
            block('pb2', 'pork-a', 3600, 0),
        ];
        // 3600+3600=7200mm使用、24000mm中に新しいブロック(2400mm)を追加
        const result = findBestPlacement(blocks, masters, 2400, 5, 0, 24000, 5);
        expect(result).not.toBeNull();
        expect(result!.insertX).toBe(7200); // 既存ブロックの右
    });
});

describe('統合: 縦積みブロック構成', () => {
    const masters: BlockMasterMap = [
        { id: 'A', width: 900, shelfCount: 2 },
        { id: 'B', width: 900, shelfCount: 3 },
    ];

    it('同一列に縦積み配置', () => {
        const blocks = [
            block('pb1', 'A', 0, 0),  // Y: 0-1
            block('pb2', 'B', 0, 2),  // Y: 2-4
        ];
        const result = packBlocksLeftAligned(blocks, masters, 900);
        expect(result).not.toBeNull();
        // 重ならないので両方X=0
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(0);
    });

    it('Y範囲が重なる場合は横にずれる', () => {
        const blocks = [
            block('pb1', 'A', 0, 0),  // Y: 0-1
            block('pb2', 'B', 0, 1),  // Y: 1-3 → shelfIndex 1 が重なる
        ];
        const result = packBlocksLeftAligned(blocks, masters, 1800);
        expect(result).not.toBeNull();
        expect(result![0].positionX).toBe(0);
        expect(result![1].positionX).toBe(900); // 横にずれる
    });
});

describe('統合: 商品展開 + ブロック入れ替え後の商品位置', () => {
    it('ブロック入れ替え後に商品展開すると位置が正しい', () => {
        const masters: BlockMasterMap = [
            { id: 'A', width: 300, shelfCount: 2 },
            { id: 'B', width: 200, shelfCount: 2 },
        ];
        const blocks = [
            block('pb1', 'A', 0, 0),
            block('pb2', 'B', 300, 0),
        ];

        // 入れ替え: pb1を右へ
        const swapped = swapBlock(blocks, 'pb1', 'right', masters, 600, 2);
        expect(swapped).not.toBeNull();

        const pb2 = swapped!.find(b => b.id === 'pb2')!; // Bが先
        const pb1 = swapped!.find(b => b.id === 'pb1')!; // Aが後

        // ブロックBの商品を展開
        const placementsB: ProductPlacement[] = [
            { productId: 'p1', shelfIndex: 0, positionX: 0, faceCount: 1 },
        ];
        const expandedB = expandBlockProducts(placementsB, new Set(['p1']), pb2.positionX, pb2.positionY);
        expect(expandedB[0].positionX).toBe(0); // Bは左端

        // ブロックAの商品を展開
        const placementsA: ProductPlacement[] = [
            { productId: 'p2', shelfIndex: 0, positionX: 0, faceCount: 2 },
        ];
        const expandedA = expandBlockProducts(placementsA, new Set(['p2']), pb1.positionX, pb1.positionY);
        expect(expandedA[0].positionX).toBe(200); // AはBの右（B幅=200mm）
    });
});
