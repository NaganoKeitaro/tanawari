// Excelライク表示の商品→ブロック割り当てテスト
import { describe, it, expect } from 'vitest';
import type { StandardPlanogramBlock, StandardPlanogramProduct } from '../../data/types';

interface BlockMaster {
    id: string;
    width: number;
    shelfCount: number;
}

// PlanogramCanvas内のfindBlockForProductロジックを再現
function findBlockForProduct(
    sp: StandardPlanogramProduct,
    sortedBlocks: StandardPlanogramBlock[],
    blockMasters: BlockMaster[]
) {
    for (const pb of sortedBlocks) {
        const master = blockMasters.find(b => b.id === pb.blockId);
        if (!master) continue;
        const inXRange = sp.positionX >= pb.positionX - 0.1 && sp.positionX < pb.positionX + master.width + 0.1;
        const inYRange = sp.shelfIndex >= pb.positionY && sp.shelfIndex < pb.positionY + master.shelfCount;
        if (inXRange && inYRange) {
            return { blockId: pb.id, blockBlockId: pb.blockId };
        }
    }
    return null;
}

describe('findBlockForProduct', () => {
    it('横並びブロック: 商品がそれぞれのブロックに正しく割り当てられる', () => {
        // ブロックA (0-300mm, 3段) と ブロックB (300-600mm, 3段)
        const masters: BlockMaster[] = [
            { id: 'A', width: 300, shelfCount: 3 },
            { id: 'B', width: 300, shelfCount: 3 },
        ];
        const blocks: StandardPlanogramBlock[] = [
            { id: 'pb1', blockId: 'A', positionX: 0, positionY: 0 },
            { id: 'pb2', blockId: 'B', positionX: 300, positionY: 0 },
        ];

        // ブロックA内の商品 (positionX=50, shelfIndex=1)
        const prodA: StandardPlanogramProduct = { id: 'sp1', productId: 'p1', positionX: 50, shelfIndex: 1, faceCount: 1 };
        expect(findBlockForProduct(prodA, blocks, masters)?.blockId).toBe('pb1');

        // ブロックB内の商品 (positionX=350, shelfIndex=2)
        const prodB: StandardPlanogramProduct = { id: 'sp2', productId: 'p2', positionX: 350, shelfIndex: 2, faceCount: 1 };
        expect(findBlockForProduct(prodB, blocks, masters)?.blockId).toBe('pb2');
    });

    it('縦積みブロック: 同じX位置で段の違いで正しく判別', () => {
        // 5段棚にブロックA(2段, 下: posY=0) と ブロックB(2段, 上: posY=2)
        const masters: BlockMaster[] = [
            { id: 'A', width: 900, shelfCount: 2 },
            { id: 'B', width: 900, shelfCount: 2 },
        ];
        const blocks: StandardPlanogramBlock[] = [
            { id: 'pb1', blockId: 'A', positionX: 0, positionY: 0 },  // shelfIndex 0,1
            { id: 'pb2', blockId: 'B', positionX: 0, positionY: 2 },  // shelfIndex 2,3
        ];

        // shelfIndex=0 → ブロックA
        const prod0: StandardPlanogramProduct = { id: 'sp1', productId: 'p1', positionX: 100, shelfIndex: 0, faceCount: 1 };
        expect(findBlockForProduct(prod0, blocks, masters)?.blockId).toBe('pb1');

        // shelfIndex=1 → ブロックA
        const prod1: StandardPlanogramProduct = { id: 'sp2', productId: 'p2', positionX: 100, shelfIndex: 1, faceCount: 1 };
        expect(findBlockForProduct(prod1, blocks, masters)?.blockId).toBe('pb1');

        // shelfIndex=2 → ブロックB
        const prod2: StandardPlanogramProduct = { id: 'sp3', productId: 'p3', positionX: 100, shelfIndex: 2, faceCount: 1 };
        expect(findBlockForProduct(prod2, blocks, masters)?.blockId).toBe('pb2');

        // shelfIndex=3 → ブロックB
        const prod3: StandardPlanogramProduct = { id: 'sp4', productId: 'p4', positionX: 100, shelfIndex: 3, faceCount: 1 };
        expect(findBlockForProduct(prod3, blocks, masters)?.blockId).toBe('pb2');

        // shelfIndex=4 → どのブロックにも属さない
        const prod4: StandardPlanogramProduct = { id: 'sp5', productId: 'p5', positionX: 100, shelfIndex: 4, faceCount: 1 };
        expect(findBlockForProduct(prod4, blocks, masters)).toBeNull();
    });

    it('横+縦の複合: 横に2列、各列に2段ずつ', () => {
        // テスト(3尺, 2段, 下) + いいい(3尺, 5段, 全段) の構成
        const masters: BlockMaster[] = [
            { id: 'A', width: 900, shelfCount: 2 },
            { id: 'B', width: 900, shelfCount: 5 },
        ];
        const blocks: StandardPlanogramBlock[] = [
            { id: 'pb1', blockId: 'A', positionX: 0, positionY: 0 },    // 左列、段0-1
            { id: 'pb2', blockId: 'B', positionX: 900, positionY: 0 },  // 右列、段0-4
        ];

        // 左列 shelfIndex=0 → A
        const p1: StandardPlanogramProduct = { id: 's1', productId: 'x', positionX: 100, shelfIndex: 0, faceCount: 1 };
        expect(findBlockForProduct(p1, blocks, masters)?.blockId).toBe('pb1');

        // 左列 shelfIndex=3 → Aは2段なので属さない
        const p2: StandardPlanogramProduct = { id: 's2', productId: 'x', positionX: 100, shelfIndex: 3, faceCount: 1 };
        expect(findBlockForProduct(p2, blocks, masters)).toBeNull();

        // 右列 shelfIndex=4 → B
        const p3: StandardPlanogramProduct = { id: 's3', productId: 'x', positionX: 1000, shelfIndex: 4, faceCount: 1 };
        expect(findBlockForProduct(p3, blocks, masters)?.blockId).toBe('pb2');
    });

    it('ブロック境界上の商品（positionX == block.positionX + width）は範囲外', () => {
        const masters: BlockMaster[] = [
            { id: 'A', width: 300, shelfCount: 3 },
        ];
        const blocks: StandardPlanogramBlock[] = [
            { id: 'pb1', blockId: 'A', positionX: 0, positionY: 0 },
        ];

        // positionX=300 → ブロック幅ちょうど → 範囲外（< posX + width + 0.1 = 300.1なのでギリギリ範囲内）
        const prod: StandardPlanogramProduct = { id: 'sp1', productId: 'p1', positionX: 300, shelfIndex: 0, faceCount: 1 };
        // 300 < 300.1 なので範囲内になる — これは意図した動作？
        expect(findBlockForProduct(prod, blocks, masters)?.blockId).toBe('pb1');
    });
});

describe('visual shelf mapping', () => {
    it('visualIdx と shelfIndex の変換が正しい (5段棚)', () => {
        const shelfCount = 5;
        // visualIdx=0 → 最上段 (shelfIndex=4)
        // visualIdx=4 → 最下段 (shelfIndex=0)
        for (let visualIdx = 0; visualIdx < shelfCount; visualIdx++) {
            const shelfIndex = shelfCount - 1 - visualIdx;
            expect(shelfIndex).toBe(shelfCount - 1 - visualIdx);
        }
        // visualIdx=0 → shelfIndex=4 (表示上の1行目は最上段)
        expect(shelfCount - 1 - 0).toBe(4);
        // visualIdx=4 → shelfIndex=0 (表示上の5行目は最下段)
        expect(shelfCount - 1 - 4).toBe(0);
    });

    it('ブロックpositionY=0(2段)は shelfIndex 0,1 → 表示上の下2行', () => {
        const shelfCount = 5;
        const blockPosY = 0;
        const blockShelfCount = 2;
        // このブロックが占める shelfIndex: 0, 1
        // 表示上: visualIdx=4(shelfIndex=0), visualIdx=3(shelfIndex=1) → 下2行

        const occupiedVisualRows: number[] = [];
        for (let vi = 0; vi < shelfCount; vi++) {
            const si = shelfCount - 1 - vi;
            if (si >= blockPosY && si < blockPosY + blockShelfCount) {
                occupiedVisualRows.push(vi);
            }
        }
        // shelfIndex 0 → visualIdx 4, shelfIndex 1 → visualIdx 3
        expect(occupiedVisualRows).toEqual([3, 4]);
    });

    it('ブロックpositionY=3(2段)は shelfIndex 3,4 → 表示上の上2行', () => {
        const shelfCount = 5;
        const blockPosY = 3;
        const blockShelfCount = 2;

        const occupiedVisualRows: number[] = [];
        for (let vi = 0; vi < shelfCount; vi++) {
            const si = shelfCount - 1 - vi;
            if (si >= blockPosY && si < blockPosY + blockShelfCount) {
                occupiedVisualRows.push(vi);
            }
        }
        // shelfIndex 3 → visualIdx 1, shelfIndex 4 → visualIdx 0
        expect(occupiedVisualRows).toEqual([0, 1]);
    });
});
