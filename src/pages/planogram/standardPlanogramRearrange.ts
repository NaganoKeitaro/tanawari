// 標準棚割 棚ブロック再配置ロジック（純粋関数として抽出）
import type {
    StandardPlanogramBlock,
    StandardPlanogramProduct,
    StandardPlanogramHierarchyPlacement,
    ProductPlacement,
    HierarchyPlacement
} from '../../data/types';

/** ブロックマスタ参照用の最小型 */
export type BlockMasterMap = { id: string; width: number; shelfCount: number }[];

// ---------------------------------------------------------------------------
// 1. 挿入インデックス計算
// ---------------------------------------------------------------------------

/**
 * ドラッグ中のX座標から、残りブロック列への挿入インデックスを返す。
 * 各ブロック中央との比較で判定（棚ブロック管理画面の商品再配置と同じロジック）。
 */
export function calcBlockInsertIndex(
    remainingBlocks: StandardPlanogramBlock[],
    targetXmm: number,
    blockMasters: BlockMasterMap
): number {
    let insertIdx = remainingBlocks.length;
    for (let i = 0; i < remainingBlocks.length; i++) {
        const rb = remainingBlocks[i];
        const rbMaster = blockMasters.find(b => b.id === rb.blockId);
        if (!rbMaster) continue;
        const rbCenter = rb.positionX + rbMaster.width / 2;
        if (targetXmm < rbCenter) {
            insertIdx = i;
            break;
        }
    }
    return insertIdx;
}

// ---------------------------------------------------------------------------
// 2. 左詰めパッキング（Y範囲重なり考慮）
// ---------------------------------------------------------------------------

/**
 * ブロックリストを指定順序で左詰め配置する。
 * Y範囲が重なるブロック同士のみ横方向で干渉し合う。
 * actualWidth を超える場合は null を返す。
 */
export function packBlocksLeftAligned(
    orderedBlocks: StandardPlanogramBlock[],
    blockMasters: BlockMasterMap,
    actualWidth: number
): StandardPlanogramBlock[] | null {
    const packedBlocks: StandardPlanogramBlock[] = [];

    for (const ob of orderedBlocks) {
        const obMaster = blockMasters.find(b => b.id === ob.blockId);
        if (!obMaster) {
            packedBlocks.push(ob);
            continue;
        }

        const obShelfEnd = ob.positionY + obMaster.shelfCount;

        // Y範囲が重なる既配置ブロックの最大右端を算出
        let leftmostX = 0;
        for (const placed of packedBlocks) {
            const pMaster = blockMasters.find(b => b.id === placed.blockId);
            if (!pMaster) continue;
            const pEnd = placed.positionY + pMaster.shelfCount;
            if (placed.positionY < obShelfEnd && pEnd > ob.positionY) {
                leftmostX = Math.max(leftmostX, placed.positionX + pMaster.width);
            }
        }

        if (leftmostX + obMaster.width > actualWidth + 0.1) {
            return null; // overflow
        }
        packedBlocks.push({ ...ob, positionX: leftmostX });
    }

    return packedBlocks;
}

// ---------------------------------------------------------------------------
// 3. 配置済みブロック移動（tryPackWithPosY）
// ---------------------------------------------------------------------------

/**
 * 指定Y位置で、ドラッグ中ブロックを挿入位置に配置し左詰めパッキングを試行する。
 * 成功時は再配置済みブロック配列を、失敗（はみ出し）時は null を返す。
 */
export function tryPackWithPosY(
    planogramBlocks: StandardPlanogramBlock[],
    movedBlockId: string,
    movedBlockBlockId: string,
    newPosY: number,
    targetXmm: number,
    blockMasters: BlockMasterMap,
    actualWidth: number
): StandardPlanogramBlock[] | null {
    // 移動元以外のブロックをpositionX順にソート
    const remainingBlocks = planogramBlocks
        .filter(b => b.id !== movedBlockId)
        .sort((a, b) => a.positionX - b.positionX);

    // 挿入インデックスを決定
    const insertIdx = calcBlockInsertIndex(remainingBlocks, targetXmm, blockMasters);

    // 移動するブロック（Y位置更新）
    const movedBlock: StandardPlanogramBlock = {
        id: movedBlockId,
        blockId: movedBlockBlockId,
        positionX: 0, // packBlocksLeftAligned が再計算
        positionY: newPosY
    };

    // 新しい並び順でブロックリストを構築
    const orderedBlocks = [
        ...remainingBlocks.slice(0, insertIdx),
        movedBlock,
        ...remainingBlocks.slice(insertIdx)
    ];

    return packBlocksLeftAligned(orderedBlocks, blockMasters, actualWidth);
}

// ---------------------------------------------------------------------------
// 4. 近傍Y探索付き移動
// ---------------------------------------------------------------------------

/**
 * initialPosY で tryPackWithPosY を試行し、失敗時は近傍のY位置を自動探索する。
 */
export function tryPackWithNearbyY(
    planogramBlocks: StandardPlanogramBlock[],
    movedBlockId: string,
    movedBlockBlockId: string,
    initialPosY: number,
    targetXmm: number,
    blockMasters: BlockMasterMap,
    actualWidth: number,
    planogramShelfCount: number,
    blockShelfCount: number
): StandardPlanogramBlock[] | null {
    const maxPosY = Math.max(0, planogramShelfCount - blockShelfCount);

    // まず初期Yで試行
    let result = tryPackWithPosY(
        planogramBlocks, movedBlockId, movedBlockBlockId,
        initialPosY, targetXmm, blockMasters, actualWidth
    );
    if (result) return result;

    // 近傍Y位置を探索
    for (let delta = 1; delta <= maxPosY; delta++) {
        const candidates = [initialPosY - delta, initialPosY + delta];
        for (const tryY of candidates) {
            if (tryY < 0 || tryY > maxPosY) continue;
            result = tryPackWithPosY(
                planogramBlocks, movedBlockId, movedBlockBlockId,
                tryY, targetXmm, blockMasters, actualWidth
            );
            if (result) return result;
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// 5. 新規ブロック配置用の空き位置検索
// ---------------------------------------------------------------------------

/**
 * 指定Y範囲でブロックを配置できるX位置を探す。
 * 見つからなければ -1 を返す。
 */
export function findInsertX(
    planogramBlocks: StandardPlanogramBlock[],
    blockMasters: BlockMasterMap,
    blockWidth: number,
    newPosY: number,
    newBlockShelfEnd: number,
    actualWidth: number,
    excludeBlockId?: string
): number {
    const overlappingBlocks = planogramBlocks
        .filter(pb => {
            if (excludeBlockId && pb.id === excludeBlockId) return false;
            const master = blockMasters.find(b => b.id === pb.blockId);
            if (!master) return false;
            const pbEnd = pb.positionY + master.shelfCount;
            return pb.positionY < newBlockShelfEnd && pbEnd > newPosY;
        })
        .sort((a, b) => a.positionX - b.positionX);

    let insertX = -1;
    let currentScanX = 0;

    for (const placedBlock of overlappingBlocks) {
        const gap = placedBlock.positionX - currentScanX;
        if (gap >= blockWidth - 0.1) {
            insertX = currentScanX;
            break;
        }
        const master = blockMasters.find(b => b.id === placedBlock.blockId);
        currentScanX = placedBlock.positionX + (master?.width || 0);
    }

    if (insertX === -1) {
        const gap = actualWidth - currentScanX;
        if (gap >= blockWidth - 0.1) {
            insertX = currentScanX;
        }
    }

    return insertX;
}

// ---------------------------------------------------------------------------
// 6. 最適配置位置検索（近傍Y探索付き）
// ---------------------------------------------------------------------------

/**
 * 指定Y位置で配置を試み、失敗時は近傍Yを探索する。
 */
export function findBestPlacement(
    planogramBlocks: StandardPlanogramBlock[],
    blockMasters: BlockMasterMap,
    blockWidth: number,
    blockShelfCount: number,
    initialPosY: number,
    actualWidth: number,
    planogramShelfCount: number,
    excludeBlockId?: string
): { posY: number; insertX: number } | null {
    const maxPosY = Math.max(0, planogramShelfCount - blockShelfCount);

    // まず初期Yで試行
    const initialX = findInsertX(
        planogramBlocks, blockMasters, blockWidth,
        initialPosY, initialPosY + blockShelfCount, actualWidth, excludeBlockId
    );
    if (initialX !== -1) {
        return { posY: initialPosY, insertX: initialX };
    }

    // 近傍Y位置を探索
    for (let delta = 1; delta <= maxPosY; delta++) {
        const candidates = [initialPosY - delta, initialPosY + delta];
        for (const tryY of candidates) {
            if (tryY < 0 || tryY > maxPosY) continue;
            const x = findInsertX(
                planogramBlocks, blockMasters, blockWidth,
                tryY, tryY + blockShelfCount, actualWidth, excludeBlockId
            );
            if (x !== -1) {
                return { posY: tryY, insertX: x };
            }
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// 7. プレビュー位置計算
// ---------------------------------------------------------------------------

/**
 * ドラッグ中のブロックプレビュー位置を計算する。
 * 棚ブロック管理画面の previewPositions と同じパターン。
 */
export function calcPreviewPositions(
    planogramBlocks: StandardPlanogramBlock[],
    draggedBlockId: string,
    insertIndex: number,
    draggedPosY: number,
    blockMasters: BlockMasterMap
): Record<string, number> {
    const remaining = planogramBlocks
        .filter(b => b.id !== draggedBlockId)
        .sort((a, b) => a.positionX - b.positionX);

    const draggedBlock = planogramBlocks.find(b => b.id === draggedBlockId);
    if (!draggedBlock) return {};

    const draggedWithY = { ...draggedBlock, positionY: draggedPosY };

    const orderedBlocks = [
        ...remaining.slice(0, insertIndex),
        draggedWithY,
        ...remaining.slice(insertIndex)
    ];

    // Left-pack with Y-overlap awareness
    const positions: Record<string, number> = {};
    const packed: { id: string; positionX: number; positionY: number; width: number; shelfCount: number }[] = [];

    for (const ob of orderedBlocks) {
        const obMaster = blockMasters.find(b => b.id === ob.blockId);
        if (!obMaster) continue;
        const obShelfEnd = ob.positionY + obMaster.shelfCount;

        let leftmostX = 0;
        for (const placed of packed) {
            const pEnd = placed.positionY + placed.shelfCount;
            if (placed.positionY < obShelfEnd && pEnd > ob.positionY) {
                leftmostX = Math.max(leftmostX, placed.positionX + placed.width);
            }
        }

        positions[ob.id] = leftmostX;
        packed.push({
            id: ob.id,
            positionX: leftmostX,
            positionY: ob.positionY,
            width: obMaster.width,
            shelfCount: obMaster.shelfCount
        });
    }

    return positions;
}

// ---------------------------------------------------------------------------
// 8. ブロック商品展開
// ---------------------------------------------------------------------------

/**
 * ブロック内の商品配置を絶対座標に展開する。
 */
export function expandBlockProducts(
    blockPlacements: ProductPlacement[],
    productIds: Set<string>,
    positionX: number,
    positionY: number
): Omit<StandardPlanogramProduct, 'id'>[] {
    return blockPlacements
        .filter(pl => productIds.has(pl.productId))
        .map(pl => ({
            productId: pl.productId,
            shelfIndex: positionY + pl.shelfIndex,
            positionX: positionX + pl.positionX,
            faceCount: pl.faceCount
        }));
}

/**
 * ブロック内の階層配置を絶対座標に展開する。
 */
export function expandBlockHierarchyPlacements(
    hierarchyPlacements: HierarchyPlacement[],
    positionX: number,
    positionY: number
): Omit<StandardPlanogramHierarchyPlacement, 'id'>[] {
    return hierarchyPlacements.map(hp => ({
        hierarchyLevel: hp.hierarchyLevel,
        hierarchyCode: hp.hierarchyCode,
        hierarchyName: hp.hierarchyName,
        shelfIndex: positionY + hp.shelfIndex,
        positionX: positionX + hp.positionX,
        width: hp.width,
        faceCount: hp.faceCount,
    }));
}

// ---------------------------------------------------------------------------
// 9. Y位置計算（shelf-row-N から positionY を算出）
// ---------------------------------------------------------------------------

/**
 * ドロップ先のvisualRowインデックスから、ブロックのpositionYを計算する。
 */
export function calcPosYFromVisualRow(
    visualRow: number,
    planogramShelfCount: number,
    blockShelfCount: number
): number {
    const maxPosY = Math.max(0, planogramShelfCount - blockShelfCount);
    return Math.max(0, Math.min(planogramShelfCount - visualRow - blockShelfCount, maxPosY));
}

// ---------------------------------------------------------------------------
// 10. ブロック入れ替え（矢印ボタン用）
// ---------------------------------------------------------------------------

export type SwapDirection = 'left' | 'right' | 'up' | 'down';

/**
 * 指定ブロックを隣のブロックと入れ替え、左詰め再配置したブロック配列を返す。
 * - left/right: 同一Y範囲で重なるブロックのうち左右隣と順序を入れ替え
 * - up/down: ブロックのpositionYを1段移動
 * 移動不可の場合は null を返す。
 */
export function swapBlock(
    planogramBlocks: StandardPlanogramBlock[],
    targetBlockId: string,
    direction: SwapDirection,
    blockMasters: BlockMasterMap,
    actualWidth: number,
    planogramShelfCount: number
): StandardPlanogramBlock[] | null {
    const target = planogramBlocks.find(b => b.id === targetBlockId);
    if (!target) return null;

    const targetMaster = blockMasters.find(b => b.id === target.blockId);
    if (!targetMaster) return null;

    if (direction === 'up' || direction === 'down') {
        // Y位置を1段移動
        const delta = direction === 'up' ? 1 : -1;
        const newPosY = target.positionY + delta;
        const maxPosY = Math.max(0, planogramShelfCount - targetMaster.shelfCount);
        if (newPosY < 0 || newPosY > maxPosY) return null;

        // Y変更後にパッキング（既存の並び順を維持）
        const updatedBlocks = planogramBlocks.map(b =>
            b.id === targetBlockId ? { ...b, positionY: newPosY } : b
        );
        // positionX順序を維持してパッキング
        const sorted = [...updatedBlocks].sort((a, b) => a.positionX - b.positionX);
        return packBlocksLeftAligned(sorted, blockMasters, actualWidth);
    }

    // left / right: 同一Y範囲で重なる隣接ブロックと順序を入れ替え
    const targetYEnd = target.positionY + targetMaster.shelfCount;

    // Y範囲が重なるブロックをpositionX順に取得
    const overlapping = planogramBlocks
        .filter(b => {
            const m = blockMasters.find(bm => bm.id === b.blockId);
            if (!m) return false;
            const bEnd = b.positionY + m.shelfCount;
            return b.positionY < targetYEnd && bEnd > target.positionY;
        })
        .sort((a, b) => a.positionX - b.positionX);

    const targetIdx = overlapping.findIndex(b => b.id === targetBlockId);
    if (targetIdx === -1) return null;

    const swapIdx = direction === 'left' ? targetIdx - 1 : targetIdx + 1;
    if (swapIdx < 0 || swapIdx >= overlapping.length) return null;

    const swapTarget = overlapping[swapIdx];

    // 全ブロックリストの positionX を入れ替えた値にして、順序を入れ替える
    // positionX の値自体を入れ替える（後で left-pack するので仮の値でOK）
    const updatedBlocks = planogramBlocks.map(b => {
        if (b.id === targetBlockId) return { ...b, positionX: swapTarget.positionX };
        if (b.id === swapTarget.id) return { ...b, positionX: target.positionX };
        return b;
    });

    const sorted = [...updatedBlocks].sort((a, b) => a.positionX - b.positionX);
    return packBlocksLeftAligned(sorted, blockMasters, actualWidth);
}
