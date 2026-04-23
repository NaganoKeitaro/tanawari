// 棚割管理システム - FMT標準棚割管理
import { useState, useEffect, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    useDroppable,
    pointerWithin,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent, DragMoveEvent } from '@dnd-kit/core';
import type {
    Store,
    Fixture,
    ShelfBlock,
    StandardPlanogram,
    StandardPlanogramBlock,
    StandardPlanogramProduct,
    Product,
    FMT,
    StoreFixturePlacement,
    FixtureType
} from '../../data/types';
import { FMTS } from '../../data/types';
import {
    storeRepository,
    fixtureRepository,
    shelfBlockRepository,
    standardPlanogramRepository,
    productRepository,
    storeFixturePlacementRepository
} from '../../data/repositories/repositoryFactory';
import { Modal } from '../../components/common/Modal';
import { PlanogramExcelHeader } from '../../components/planogram/PlanogramExcelHeader';
import type { BlockInfo } from '../../components/planogram/PlanogramExcelHeader';
import { UnitDisplay } from '../../components/common/UnitDisplay';
import { calculateHeatmapColor } from '../../utils/heatmapUtils';
import { StoreLayoutVisualizer } from '../../components/layout/StoreLayoutVisualizer';
import {
    calcBlockInsertIndex,
    tryPackWithNearbyY,
    findBestPlacement as findBestPlacementPure,
    expandBlockProducts as expandBlockProductsPure,
    expandBlockHierarchyPlacements,
    calcPreviewPositions,
    calcPosYFromVisualRow,
    swapBlock
} from './standardPlanogramRearrange';
import type { SwapDirection } from './standardPlanogramRearrange';

const SCALE = 0.3; // 1mm = 0.3px

const PLANOGRAM_TYPES: { id: FixtureType; label: string }[] = [
    { id: 'multi-tier', label: '多段' },
    { id: 'flat-refrigerated', label: '平台冷蔵' },
    { id: 'flat-frozen', label: '平台冷凍' },
    { id: 'wall-flat-refrigerated', label: '壁面平台冷蔵' },
    { id: 'end-cap-refrigerated', label: 'エンド平台冷蔵' },
    { id: 'end-cap-frozen', label: 'エンド平台冷凍' },
];

// 選択可能な棚ブロック（クリックで選択→キャンバスクリックで配置）
function SelectableBlock({ block, isSelected, onSelect }: {
    block: ShelfBlock;
    isSelected: boolean;
    onSelect: (block: ShelfBlock) => void;
}) {
    return (
        <div
            onClick={() => onSelect(block)}
            className="card"
            style={{
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--color-primary)' : undefined,
                background: isSelected ? 'rgba(16, 185, 129, 0.08)' : undefined,
                transition: 'border-color 0.15s, background 0.15s',
            }}
        >
            <div style={{ fontWeight: 500 }}>{block.name}</div>
            <div className="text-xs text-muted">
                <UnitDisplay valueMm={block.width} /> × <UnitDisplay valueMm={block.blockType === 'flat' ? (block as any).depth || 0 : block.height} />
                {block.blockType !== 'flat' && ` / ${block.shelfCount}段`}
            </div>
            <div className="text-xs text-muted">
                {block.productPlacements.length} 商品
            </div>
        </div>
    );
}

// 棚段ごとのドロップゾーン
function DroppableShelfRow({ visualIndex, shelfHeight, canvasWidth }: {
    visualIndex: number;
    shelfHeight: number;
    canvasWidth: number;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `shelf-row-${visualIndex}`,
        data: { type: 'shelf-row', visualIndex }
    });
    return (
        <div
            ref={setNodeRef}
            style={{
                position: 'absolute',
                top: `${visualIndex * shelfHeight}px`,
                left: 0,
                width: `${canvasWidth}px`,
                height: `${shelfHeight}px`,
                zIndex: 3,
                pointerEvents: 'none',
                background: isOver ? 'rgba(16,185,129,0.12)' : 'transparent',
                borderTop: isOver ? '2px dashed var(--color-primary)' : 'none',
                boxSizing: 'border-box',
                transition: 'background 0.1s'
            }}
        />
    );
}

// 標準棚割キャンバス（Excelライク商品グリッド表示）
function PlanogramCanvas({
    planogram,
    products,
    blockMasters,
    analyticsMode,
    selectedMetric,
    onDeleteBlock,
    actualWidth,
    hoveredVisualRow,
    activeBlockShelfCount,
    previewPositions,
    selectedBlockId,
    onSelectBlock,
    onSwapBlock
}: {
    planogram: StandardPlanogram;
    products: Product[];
    blockMasters: ShelfBlock[];
    analyticsMode?: boolean;
    selectedMetric?: 'sales' | 'grossProfit' | 'quantity' | 'traffic';
    onDeleteBlock?: (blockId: string) => void;
    actualWidth?: number;
    hoveredVisualRow?: number | null;
    activeBlockShelfCount?: number;
    previewPositions?: Record<string, number> | null;
    selectedBlockId?: string | null;
    onSelectBlock?: (blockId: string) => void;
    onSwapBlock?: (blockId: string, direction: SwapDirection) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'planogram-canvas',
        data: { type: 'canvas' }
    });

    const totalWidthMm = actualWidth || planogram.width;
    const canvasWidth = totalWidthMm * SCALE;
    const shelfHeight = Math.max(60, (planogram.height / planogram.shelfCount) * SCALE);
    const canvasHeight = shelfHeight * planogram.shelfCount;

    // 位置順にソート済みブロック
    const sortedBlocks = [...planogram.blocks].sort((a, b) => a.positionX - b.positionX);

    // ブロックが使用している最大X
    const usedWidth = sortedBlocks.reduce((max, pb) => {
        const master = blockMasters.find(b => b.id === pb.blockId);
        return Math.max(max, pb.positionX + (master?.width || 0));
    }, 0);

    // 棚ブロックマスタIDから安定した色を割り当て（位置やソート順に依存しない）
    // planogram.blocks の ID をソートして、追加・入れ替えに関係なく同じ色を保つ
    const blockColorMap = new Map<string, number>();
    const uniqueBlockIds = [...new Set(planogram.blocks.map(pb => pb.blockId))].sort();
    uniqueBlockIds.forEach((blockId, i) => {
        blockColorMap.set(blockId, i);
    });

    // Excelライクヘッダー用ブロック情報
    const blockInfos: BlockInfo[] = sortedBlocks
        .map(pb => {
            const master = blockMasters.find(b => b.id === pb.blockId);
            if (!master) return null;
            const posX = previewPositions?.[pb.id] !== undefined ? previewPositions[pb.id] : pb.positionX;
            return {
                id: pb.id,
                name: master.name,
                widthMm: master.width,
                positionXMm: posX,
                positionY: pb.positionY,
                shelfCount: master.shelfCount,
                colorIndex: blockColorMap.get(pb.blockId) ?? 0
            };
        })
        .filter((b): b is BlockInfo => b !== null);

    // 商品のブロック所属を特定（placedBlockId優先、なければ位置ベース）
    const findBlockForProduct = (sp: StandardPlanogramProduct) => {
        // placedBlockId がある場合はそれで直接マッチ
        if (sp.placedBlockId) {
            const pb = sortedBlocks.find(b => b.id === sp.placedBlockId);
            if (pb) {
                const master = blockMasters.find(b => b.id === pb.blockId);
                if (master) {
                    const posX = previewPositions?.[pb.id] !== undefined ? previewPositions[pb.id] : pb.positionX;
                    return { pb, master, blockPosX: posX, colorIndex: blockColorMap.get(pb.blockId) ?? 0 };
                }
            }
        }
        // フォールバック: 位置ベースでマッチ
        for (const pb of sortedBlocks) {
            const master = blockMasters.find(b => b.id === pb.blockId);
            if (!master) continue;
            const posX = previewPositions?.[pb.id] !== undefined ? previewPositions[pb.id] : pb.positionX;
            const inXRange = sp.positionX >= posX - 0.1 && sp.positionX < posX + master.width + 0.1;
            const inYRange = sp.shelfIndex >= pb.positionY && sp.shelfIndex < pb.positionY + master.shelfCount;
            if (inXRange && inYRange) {
                return { pb, master, blockPosX: posX, colorIndex: blockColorMap.get(pb.blockId) ?? 0 };
            }
        }
        return null;
    };

    // 分析モード用最大メトリクス
    const maxMetricValue = analyticsMode && selectedMetric
        ? Math.max(...products.map(p => p[selectedMetric!] || 0), 1)
        : 1;

    return (
        <div
            ref={setNodeRef}
            onClick={(e) => {
                // クリックでブロック選択解除
                if (e.target === e.currentTarget && selectedBlockId && onSelectBlock) {
                    onSelectBlock(selectedBlockId);
                }
            }}
            style={{
                background: 'var(--bg-primary)',
                border: isOver ? '2px solid var(--color-primary)' : '2px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                paddingLeft: '50px',
                minHeight: '200px',
                overflow: 'auto',
                position: 'relative'
            }}
        >
            {/* Excelライクヘッダー（ブロック名帯 + 尺 + 5cmグリッド + ブロック操作） */}
            {blockInfos.length > 0 && (
                <PlanogramExcelHeader
                    blocks={blockInfos}
                    totalWidthMm={totalWidthMm}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={onSelectBlock}
                    onDeleteBlock={onDeleteBlock}
                    onSwapBlock={onSwapBlock}
                />
            )}

            {/* 棚グリッド */}
            <div style={{ width: `${canvasWidth}px`, position: 'relative' }}>
                {/* 棚段ごとのドロップゾーン */}
                {Array.from({ length: planogram.shelfCount }).map((_, i) => (
                    <DroppableShelfRow
                        key={`drop-row-${i}`}
                        visualIndex={i}
                        shelfHeight={shelfHeight}
                        canvasWidth={canvasWidth}
                    />
                ))}

                {/* ドラッグ中のプレビューハイライト */}
                {hoveredVisualRow != null && activeBlockShelfCount != null && activeBlockShelfCount > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            top: `${hoveredVisualRow * shelfHeight}px`,
                            left: 0,
                            width: `${canvasWidth}px`,
                            height: `${Math.min(activeBlockShelfCount, planogram.shelfCount - hoveredVisualRow) * shelfHeight}px`,
                            background: 'rgba(16,185,129,0.18)',
                            border: '2px dashed var(--color-primary)',
                            borderRadius: 'var(--radius-sm)',
                            zIndex: 4,
                            pointerEvents: 'none',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <span style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-primary)',
                            fontWeight: 600,
                            background: 'rgba(255,255,255,0.8)',
                            padding: '2px 8px',
                            borderRadius: '4px'
                        }}>
                            {planogram.shelfCount - hoveredVisualRow}段目に配置
                        </span>
                    </div>
                )}

                {/* 段ごとの行 + 商品セル */}
                {Array.from({ length: planogram.shelfCount }).map((_, visualIdx) => {
                    const shelfIndex = planogram.shelfCount - 1 - visualIdx;
                    const shelfProducts = planogram.products
                        .filter(sp => sp.shelfIndex === shelfIndex)
                        .sort((a, b) => a.positionX - b.positionX);

                    return (
                        <div
                            key={visualIdx}
                            style={{
                                position: 'relative',
                                height: `${shelfHeight}px`,
                                borderBottom: '1px solid var(--border-color)',
                                boxSizing: 'border-box'
                            }}
                        >
                            {/* 段ラベル（横スクロール時に固定） */}
                            <div style={{
                                position: 'sticky',
                                left: '-50px',
                                width: '46px',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                background: 'var(--bg-primary)',
                                zIndex: 5,
                                marginLeft: '-50px',
                                float: 'left',
                                borderRight: '1px solid var(--border-color)'
                            }}>
                                {shelfIndex + 1}段
                            </div>
                            {/* 階層プレースメント */}
                            {(planogram.hierarchyPlacements || [])
                                .filter(hp => hp.shelfIndex === shelfIndex)
                                .map(hp => {
                                    const width = hp.width * hp.faceCount * SCALE;
                                    // ブロック移動プレビュー時の位置調整
                                    let displayX = hp.positionX;
                                    if (hp.placedBlockId && previewPositions?.[hp.placedBlockId] !== undefined) {
                                        const pb = planogram.blocks.find(b => b.id === hp.placedBlockId);
                                        if (pb) {
                                            const offset = previewPositions[hp.placedBlockId] - pb.positionX;
                                            displayX = hp.positionX + offset;
                                        }
                                    }
                                    const belongsToSelected = selectedBlockId && hp.placedBlockId === selectedBlockId;
                                    const isDimmed = selectedBlockId && !belongsToSelected;

                                    return (
                                        <div
                                            key={hp.id}
                                            onClick={() => {
                                                if (hp.placedBlockId && onSelectBlock) {
                                                    onSelectBlock(hp.placedBlockId);
                                                }
                                            }}
                                            style={{
                                                position: 'absolute',
                                                left: `${displayX * SCALE}px`,
                                                top: '1px',
                                                bottom: '1px',
                                                width: `${width}px`,
                                                background: 'rgba(99, 102, 241, 0.12)',
                                                border: '1.5px solid rgba(99, 102, 241, 0.4)',
                                                borderRadius: '2px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '4px 8px',
                                                fontSize: '1rem',
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                zIndex: 3,
                                                boxSizing: 'border-box',
                                                opacity: isDimmed ? 0.25 : 1,
                                                transition: previewPositions ? 'left 0.15s ease, opacity 0.2s ease' : 'opacity 0.2s ease',
                                            }}
                                            title={`${hp.hierarchyName} (${hp.hierarchyCode})\n階層: ${hp.hierarchyLevel}\nフェイス: ${hp.faceCount}`}
                                        >
                                            <div style={{
                                                fontSize: '0.9rem',
                                                color: 'rgba(99, 102, 241, 0.7)',
                                                fontWeight: 600,
                                            }}>
                                                {hp.hierarchyLevel}
                                            </div>
                                            <div style={{
                                                fontWeight: 600,
                                                overflow: 'hidden',
                                                maxWidth: '100%',
                                                fontSize: '1.1rem',
                                                lineHeight: 1.2,
                                                textAlign: 'center',
                                                wordBreak: 'break-all',
                                                color: 'rgba(99, 102, 241, 0.9)',
                                            }}>
                                                {hp.hierarchyName}
                                            </div>
                                            {hp.faceCount > 1 && width > 20 && (
                                                <div style={{ fontSize: '0.85rem', color: 'rgba(99, 102, 241, 0.6)' }}>
                                                    x{hp.faceCount}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            {/* 商品セル */}
                            {shelfProducts.map(sp => {
                                const product = products.find(p => p.id === sp.productId);
                                if (!product) return null;
                                const blockInfo = findBlockForProduct(sp);

                                const cellBg = analyticsMode && selectedMetric
                                    ? calculateHeatmapColor(product[selectedMetric!] || 0, maxMetricValue)
                                    : 'white';

                                const width = product.width * sp.faceCount * SCALE;

                                // ブロック移動プレビュー時の位置調整
                                let displayX = sp.positionX;
                                if (blockInfo && previewPositions?.[blockInfo.pb.id] !== undefined) {
                                    const offset = previewPositions[blockInfo.pb.id] - blockInfo.pb.positionX;
                                    displayX = sp.positionX + offset;
                                }

                                // ブロック選択時: 所属商品は通常、それ以外は薄く
                                const belongsToSelected = selectedBlockId && blockInfo?.pb.id === selectedBlockId;
                                const isDimmed = selectedBlockId && !belongsToSelected;

                                return (
                                    <div
                                        key={sp.id}
                                        onClick={() => {
                                            if (blockInfo && onSelectBlock) {
                                                onSelectBlock(blockInfo.pb.id);
                                            }
                                        }}
                                        style={{
                                            position: 'absolute',
                                            left: `${displayX * SCALE}px`,
                                            top: '1px',
                                            bottom: '1px',
                                            width: `${width}px`,
                                            background: cellBg,
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-primary)',
                                            borderRadius: '1px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '2px',
                                            fontSize: '0.75rem',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            zIndex: 3,
                                            boxSizing: 'border-box',
                                            opacity: isDimmed ? 0.25 : 1,
                                            transition: previewPositions ? 'left 0.15s ease, opacity 0.2s ease' : 'opacity 0.2s ease',
                                        }}
                                        title={`${product.name}\n${product.jan || '-'}\n${product.departmentName || ''}\n${sp.faceCount}フェース`}
                                    >
                                        <div style={{
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            maxWidth: '100%',
                                            fontSize: '0.75rem'
                                        }}>
                                            {product.name}
                                        </div>
                                        {width > 30 && (
                                            <div style={{
                                                opacity: 0.5,
                                                fontSize: '0.6rem',
                                                fontFamily: 'monospace',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: '100%'
                                            }}>
                                                {product.jan || '-'}
                                            </div>
                                        )}
                                        {sp.faceCount > 1 && width > 20 && (
                                            <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>
                                                x{sp.faceCount}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}

                {/* 空きスペース表示 */}
                {usedWidth < totalWidthMm && (
                    <div style={{
                        position: 'absolute',
                        left: `${usedWidth * SCALE}px`,
                        top: 0,
                        width: `${(totalWidthMm - usedWidth) * SCALE}px`,
                        height: `${canvasHeight}px`,
                        background: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(100,100,100,0.05) 6px, rgba(100,100,100,0.05) 12px)',
                        border: '1px dashed var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 0,
                        boxSizing: 'border-box',
                        pointerEvents: 'none'
                    }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>空き</span>
                    </div>
                )}
            </div>

            {planogram.blocks.length === 0 && (
                <div className="text-center text-muted" style={{ padding: '3rem' }}>
                    左のブロックを選択して配置
                </div>
            )}
        </div>
    );
}

export function StandardPlanogramEditor() {
    const [stores, setStores] = useState<Store[]>([]);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [blocks, setBlocks] = useState<ShelfBlock[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [placements, setPlacements] = useState<StoreFixturePlacement[]>([]);
    const [planograms, setPlanograms] = useState<StandardPlanogram[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedFmt, setSelectedFmt] = useState<FMT | ''>('');
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [selectedFixtureType, setSelectedFixtureType] = useState<FixtureType>('multi-tier');
    const [currentPlanogram, setCurrentPlanogram] = useState<StandardPlanogram | null>(null);
    const [activeBlock, setActiveBlock] = useState<ShelfBlock | null>(null);
    const [hoveredShelfRow, setHoveredShelfRow] = useState<number | null>(null);
    const [dragPreview, setDragPreview] = useState<{
        blockId: string;
        insertIndex: number;
        blockWidthMm: number;
    } | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [planogramName, setPlanogramName] = useState('');
    const [newStartDate, setNewStartDate] = useState('');
    const [newEndDate, setNewEndDate] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [copySource, setCopySource] = useState<StandardPlanogram | null>(null);

    // 分析モード
    const [analyticsMode, setAnalyticsMode] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<'sales' | 'grossProfit' | 'quantity' | 'traffic'>('sales');

    // ブロック選択（矢印移動用）
    const [selectedPlacedBlockId, setSelectedPlacedBlockId] = useState<string | null>(null);
    // パレットから選択中のブロック（クリックで配置）
    const [selectedPaletteBlockId, setSelectedPaletteBlockId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 }
        })
    );

    // データ読み込み
    const loadData = useCallback(async () => {
        setLoading(true);
        const [storesData, fixturesData, blocksData, productsData, placementsData, planogramsData] = await Promise.all([
            storeRepository.getAll(),
            fixtureRepository.getAll(),
            shelfBlockRepository.getAll(),
            productRepository.getAll(),
            storeFixturePlacementRepository.getAll(),
            standardPlanogramRepository.getAll()
        ]);
        setStores(storesData);
        setFixtures(fixturesData);
        setBlocks(blocksData);
        setProducts(productsData);
        setPlacements(placementsData);
        setPlanograms(planogramsData);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // 期間重複チェックヘルパー
    const hasDateOverlap = (a: StandardPlanogram, b: StandardPlanogram): boolean => {
        if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) return false;
        return a.startDate <= b.endDate && a.endDate >= b.startDate;
    };

    // FMT+什器タイプでフィルターされた棚割一覧
    const filteredPlanograms = planograms.filter(p =>
        p.fmt === selectedFmt && p.fixtureType === selectedFixtureType
    );

    // FMT選択時
    const handleFmtChange = (fmt: FMT | '') => {
        setSelectedFmt(fmt);
        setSelectedStoreId('');
        setCurrentPlanogram(null);
    };

    // 什器タイプ変更時
    const handleFixtureTypeChange = (type: FixtureType) => {
        setSelectedFixtureType(type);
        setCurrentPlanogram(null);
    };

    // 基準店舗選択時（一覧モードなので即座にエディタには遷移しない）
    const handleStoreSelect = (storeId: string) => {
        setSelectedStoreId(storeId);
        setCurrentPlanogram(null);
    };

    // 新規作成用モーダルを開く
    const openCreateModal = (source?: StandardPlanogram) => {
        setCopySource(source || null);
        const typeLabel = PLANOGRAM_TYPES.find(t => t.id === selectedFixtureType)?.label || '';
        setPlanogramName(source ? `${source.name} (コピー)` : `${selectedFmt}標準棚割（${typeLabel}）`);
        setNewStartDate(source?.startDate || '');
        setNewEndDate(source?.endDate || '');
        setNewDescription(source?.description || '');
        if (!selectedStoreId && source) {
            setSelectedStoreId(source.baseStoreId);
        }
        setIsCreateModalOpen(true);
    };

    // 標準棚割作成
    const handleCreatePlanogram = async () => {
        if (!selectedFmt || !selectedStoreId || !planogramName) return;

        const storePlacements = placements.filter(p => p.storeId === selectedStoreId);
        let totalWidth = 0;
        let maxHeight = 0;
        let maxShelfCount = 0;

        for (const placement of storePlacements) {
            const fixture = fixtures.find(f => f.id === placement.fixtureId);
            if (!fixture) continue;

            const fType = fixture.fixtureType || '';
            const isMatch = selectedFixtureType === fType;

            if (isMatch) {
                totalWidth += fixture.width;
                const isFlatOrEnd = String(fixture.fixtureType).includes('flat') || String(fixture.fixtureType).includes('end-cap');
                maxHeight = Math.max(maxHeight, isFlatOrEnd ? ((fixture as any).depth || fixture.height) : fixture.height);
                maxShelfCount = Math.max(maxShelfCount, isFlatOrEnd ? 1 : fixture.shelfCount);
            }
        }

        // 複製元がある場合はblocks/productsをコピー（IDは新規生成）
        let initialBlocks = copySource ? copySource.blocks.map(b => ({ ...b, id: crypto.randomUUID() })) : [];
        let initialProducts = copySource ? copySource.products.map(p => ({ ...p, id: crypto.randomUUID() })) : [];

        const newPlanogram = await standardPlanogramRepository.create({
            fmt: selectedFmt,
            name: planogramName,
            baseStoreId: selectedStoreId,
            fixtureType: selectedFixtureType,
            width: copySource ? copySource.width : totalWidth,
            height: copySource ? copySource.height : (maxHeight || 180),
            shelfCount: copySource ? copySource.shelfCount : (maxShelfCount || 5),
            startDate: newStartDate || undefined,
            endDate: newEndDate || undefined,
            description: newDescription || undefined,
            blocks: initialBlocks,
            products: initialProducts,
            hierarchyPlacements: copySource ? (copySource.hierarchyPlacements || []).map(h => ({ ...h, id: crypto.randomUUID() })) : [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        setPlanograms([...planograms, newPlanogram]);
        setCurrentPlanogram(newPlanogram);
        setIsCreateModalOpen(false);
        setCopySource(null);
    };

    // 棚割削除
    const handleDeletePlanogram = async (planogramId: string) => {
        if (!confirm('この標準棚割を削除しますか？')) return;
        await standardPlanogramRepository.delete(planogramId);
        const updated = planograms.filter(p => p.id !== planogramId);
        setPlanograms(updated);
        if (currentPlanogram?.id === planogramId) {
            setCurrentPlanogram(null);
        }
    };

    // ドラッグ開始
    const handleDragStart = (event: DragStartEvent) => {
        const type = event.active.data.current?.type as string;
        if (type === 'placed-block') {
            const masterBlock = event.active.data.current?.masterBlock as ShelfBlock;
            setActiveBlock(masterBlock || null);
        } else {
            const block = event.active.data.current?.block as ShelfBlock | undefined;
            setActiveBlock(block || null);
        }
        setHoveredShelfRow(null);
        setSelectedPlacedBlockId(null); // ドラッグ開始時は選択解除
    };

    // ドラッグ中（棚段ハイライト更新）
    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        if (over && typeof over.id === 'string' && over.id.startsWith('shelf-row-')) {
            const visualIndex = parseInt(over.id.replace('shelf-row-', ''), 10);
            setHoveredShelfRow(visualIndex);
        } else {
            setHoveredShelfRow(null);
        }
    };

    // ドラッグ中（プレビュー位置更新）— 棚ブロック管理画面の商品再配置と同じ挙動
    const handleDragMove = (event: DragMoveEvent) => {
        const { active, over } = event;
        const type = active.data.current?.type as string;

        if (type !== 'placed-block' || !currentPlanogram) {
            setDragPreview(null);
            return;
        }

        // ドロップ対象が無い場合はプレビューをクリア（棚ブロック管理と同じ）
        if (!over) {
            setDragPreview(null);
            return;
        }

        const overId = String(over.id);
        if (!overId.startsWith('shelf-row-') && overId !== 'planogram-canvas') {
            setDragPreview(null);
            return;
        }

        const planogramBlock = active.data.current?.planogramBlock as StandardPlanogramBlock;
        const masterBlock = active.data.current?.masterBlock as ShelfBlock;

        const targetXmm = planogramBlock.positionX + event.delta.x / SCALE;

        // 移動元を除いた残りブロック（positionX順）
        const remainingBlocks = currentPlanogram.blocks
            .filter(b => b.id !== planogramBlock.id)
            .sort((a, b) => a.positionX - b.positionX);

        const insertIdx = calcBlockInsertIndex(remainingBlocks, targetXmm, blocks);

        setDragPreview({
            blockId: planogramBlock.id,
            insertIndex: insertIdx,
            blockWidthMm: masterBlock.width,
        });
    };

    // Y位置計算ヘルパー（DragEndEvent依存部分はコンポーネントに残す）
    const calculatePosY = (
        event: DragEndEvent,
        planogram: StandardPlanogram,
        blockShelfCount: number
    ): number => {
        const overId = String(event.over!.id);
        const isShelfRow = overId.startsWith('shelf-row-');

        if (isShelfRow) {
            const visualRow = parseInt(overId.replace('shelf-row-', ''), 10);
            return calcPosYFromVisualRow(visualRow, planogram.shelfCount, blockShelfCount);
        } else {
            const shelfHeight = Math.max(80, (planogram.height / planogram.shelfCount) * SCALE);
            const canvasHeight = shelfHeight * planogram.shelfCount;
            const maxPosY = Math.max(0, planogram.shelfCount - blockShelfCount);
            const translatedRect = event.active.rect.current.translated;
            if (translatedRect && event.over!.rect) {
                const relativeY = Math.max(0, Math.min(translatedRect.top - event.over!.rect.top, canvasHeight - 1));
                const rawFromBottom = Math.floor((canvasHeight - relativeY) / shelfHeight);
                return Math.max(0, Math.min(rawFromBottom, maxPosY));
            }
            return 0;
        }
    };

    // actualWidth 取得ヘルパー
    const getActualWidth = (): number => {
        if (!currentPlanogram) return 0;
        const { totalShaku } = generateFixtureCompositionText();
        return totalShaku > 0 ? totalShaku * 300 : currentPlanogram.width;
    };

    // ドラッグ終了（ブロック配置 / 移動）
    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveBlock(null);
        setHoveredShelfRow(null);
        setDragPreview(null);
        if (!currentPlanogram) return;

        const { active, over } = event;
        if (!over) return;

        const overId = String(over.id);
        const isShelfRow = overId.startsWith('shelf-row-');
        if (!isShelfRow && overId !== 'planogram-canvas') return;

        const type = active.data.current?.type as string;
        const productIdSet = new Set(products.map(p => p.id));

        if (type === 'placed-block') {
            // === 配置済みブロックの移動（ドロップ位置で並び順を決定）===
            const planogramBlock = active.data.current?.planogramBlock as StandardPlanogramBlock;
            const masterBlock = active.data.current?.masterBlock as ShelfBlock;

            const initialPosY = calculatePosY(event, currentPlanogram, masterBlock.shelfCount);
            const targetXmm = planogramBlock.positionX + event.delta.x / SCALE;
            const actualWidth = getActualWidth();

            // 近傍Y探索付きパッキング
            const packedBlocks = tryPackWithNearbyY(
                currentPlanogram.blocks,
                planogramBlock.id,
                planogramBlock.blockId,
                initialPosY,
                targetXmm,
                blocks,
                actualWidth,
                currentPlanogram.shelfCount,
                masterBlock.shelfCount
            );

            if (!packedBlocks) {
                alert('移動先にスペースがありません。');
                return;
            }

            // 全商品を除去して再展開
            const allOldProducts = new Set<string>();
            for (const pb of currentPlanogram.blocks) {
                const m = blocks.find(b => b.id === pb.blockId);
                if (!m) continue;
                const startX = pb.positionX;
                const endX = startX + m.width;
                const startY = pb.positionY;
                const endY = startY + m.shelfCount;
                const margin = 0.1;
                for (const p of currentPlanogram.products) {
                    const prod = products.find(pr => pr.id === p.productId);
                    if (!prod) continue;
                    const pCenter = p.positionX + (prod.width * p.faceCount / 2);
                    if (pCenter >= startX - margin && pCenter <= endX + margin &&
                        p.shelfIndex >= startY && p.shelfIndex < endY) {
                        allOldProducts.add(p.id);
                    }
                }
            }
            const productsWithoutBlocks = currentPlanogram.products.filter(p => !allOldProducts.has(p.id));

            // 再配置後のブロックから商品・階層を展開
            const newProducts: StandardPlanogramProduct[] = [];
            const newHierarchyPlacements: typeof currentPlanogram.hierarchyPlacements = [];
            for (const pb of packedBlocks) {
                const m = blocks.find(b => b.id === pb.blockId);
                if (!m) continue;
                const expanded = expandBlockProductsPure(m.productPlacements, productIdSet, pb.positionX, pb.positionY);
                newProducts.push(...expanded.map(ep => ({ ...ep, id: crypto.randomUUID(), placedBlockId: pb.id })));
                const expandedH = expandBlockHierarchyPlacements(m.hierarchyPlacements || [], pb.positionX, pb.positionY);
                newHierarchyPlacements.push(...expandedH.map(eh => ({ ...eh, id: crypto.randomUUID(), placedBlockId: pb.id })));
            }

            const updatedPlanogram = {
                ...currentPlanogram,
                blocks: packedBlocks,
                products: [...productsWithoutBlocks, ...newProducts],
                hierarchyPlacements: newHierarchyPlacements,
                updatedAt: new Date().toISOString()
            };

            await standardPlanogramRepository.update(currentPlanogram.id, updatedPlanogram);
            setCurrentPlanogram(updatedPlanogram);
            setPlanograms(planograms.map(p => p.id === currentPlanogram.id ? updatedPlanogram : p));

        } else {
            // === パレットからの新規配置 ===
            const block = active.data.current?.block as ShelfBlock | undefined;
            if (!block) return;

            const initialPosY = calculatePosY(event, currentPlanogram, block.shelfCount);
            const actualWidth = getActualWidth();

            const placement = findBestPlacementPure(
                currentPlanogram.blocks,
                blocks,
                block.width,
                block.shelfCount,
                initialPosY,
                actualWidth,
                currentPlanogram.shelfCount
            );

            if (!placement) {
                alert('スペースが足りません。先に既存のブロックを調整してください。');
                return;
            }

            const { posY, insertX } = placement;
            const expanded = expandBlockProductsPure(block.productPlacements, productIdSet, insertX, posY);
            const expandedH = expandBlockHierarchyPlacements(block.hierarchyPlacements || [], insertX, posY);

            const newBlock: StandardPlanogramBlock = {
                id: crypto.randomUUID(),
                blockId: block.id,
                positionX: insertX,
                positionY: posY
            };

            const newProducts: StandardPlanogramProduct[] = expanded.map(ep => ({ ...ep, id: crypto.randomUUID(), placedBlockId: newBlock.id }));
            const newHier = expandedH.map(eh => ({ ...eh, id: crypto.randomUUID(), placedBlockId: newBlock.id }));

            const updatedPlanogram = {
                ...currentPlanogram,
                blocks: [...currentPlanogram.blocks, newBlock],
                products: [...currentPlanogram.products, ...newProducts],
                hierarchyPlacements: [...(currentPlanogram.hierarchyPlacements || []), ...newHier],
                updatedAt: new Date().toISOString()
            };

            await standardPlanogramRepository.update(currentPlanogram.id, updatedPlanogram);
            setCurrentPlanogram(updatedPlanogram);
            setPlanograms(planograms.map(p => p.id === currentPlanogram.id ? updatedPlanogram : p));
        }
    };

    // パレットからブロック選択
    const handleSelectPaletteBlock = (block: ShelfBlock) => {
        setSelectedPaletteBlockId(prev => prev === block.id ? null : block.id);
    };

    // キャンバスクリックで選択中ブロックを配置
    const handleCanvasClickToPlace = async (e: React.MouseEvent<HTMLDivElement>) => {
        if (!selectedPaletteBlockId || !currentPlanogram) return;
        const block = blocks.find(b => b.id === selectedPaletteBlockId);
        if (!block) return;

        const actualWidth = getActualWidth();
        const productIdSet = new Set(products.map(p => p.id));

        // クリック位置からY段を推定
        const rect = e.currentTarget.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const shelfHeight = Math.max(80, (currentPlanogram.height / currentPlanogram.shelfCount) * SCALE);
        const visualRow = Math.floor(clickY / shelfHeight);
        const posY = calcPosYFromVisualRow(visualRow, currentPlanogram.shelfCount, block.shelfCount);

        const placement = findBestPlacementPure(
            currentPlanogram.blocks, blocks, block.width, block.shelfCount,
            posY, actualWidth, currentPlanogram.shelfCount
        );

        if (!placement) {
            alert('スペースが足りません。先に既存のブロックを調整してください。');
            return;
        }

        const { posY: finalPosY, insertX } = placement;
        const expanded = expandBlockProductsPure(block.productPlacements, productIdSet, insertX, finalPosY);
        const expandedH = expandBlockHierarchyPlacements(block.hierarchyPlacements || [], insertX, finalPosY);

        const newBlock: StandardPlanogramBlock = {
            id: crypto.randomUUID(),
            blockId: block.id,
            positionX: insertX,
            positionY: finalPosY
        };

        const newProducts: StandardPlanogramProduct[] = expanded.map(ep => ({ ...ep, id: crypto.randomUUID(), placedBlockId: newBlock.id }));
        const newHier = expandedH.map(eh => ({ ...eh, id: crypto.randomUUID(), placedBlockId: newBlock.id }));

        const updatedPlanogram = {
            ...currentPlanogram,
            blocks: [...currentPlanogram.blocks, newBlock],
            products: [...currentPlanogram.products, ...newProducts],
            hierarchyPlacements: [...(currentPlanogram.hierarchyPlacements || []), ...newHier],
            updatedAt: new Date().toISOString()
        };

        await standardPlanogramRepository.update(currentPlanogram.id, updatedPlanogram);
        setCurrentPlanogram(updatedPlanogram);
        setPlanograms(planograms.map(p => p.id === currentPlanogram.id ? updatedPlanogram : p));
        setSelectedPaletteBlockId(null);
    };

    // ブロック削除
    // ブロック選択（矢印移動用）
    const handleSelectBlock = (blockId: string) => {
        setSelectedPlacedBlockId(prev => prev === blockId ? null : blockId);
    };

    // 矢印ボタンによるブロック入れ替え
    const handleSwapBlock = (blockId: string, direction: SwapDirection) => {
        if (!currentPlanogram) return;
        const actualWidth = getActualWidth();
        const productIdSet = new Set(products.map(p => p.id));

        const packedBlocks = swapBlock(
            currentPlanogram.blocks,
            blockId,
            direction,
            blocks,
            actualWidth,
            currentPlanogram.shelfCount
        );

        if (!packedBlocks) return; // 移動不可（端に到達など）

        // 全商品を除去して再展開
        const allOldProducts = new Set<string>();
        for (const pb of currentPlanogram.blocks) {
            const m = blocks.find(b => b.id === pb.blockId);
            if (!m) continue;
            const startX = pb.positionX;
            const endX = startX + m.width;
            const startY = pb.positionY;
            const endY = startY + m.shelfCount;
            const margin = 0.1;
            for (const p of currentPlanogram.products) {
                const prod = products.find(pr => pr.id === p.productId);
                if (!prod) continue;
                const pCenter = p.positionX + (prod.width * p.faceCount / 2);
                if (pCenter >= startX - margin && pCenter <= endX + margin &&
                    p.shelfIndex >= startY && p.shelfIndex < endY) {
                    allOldProducts.add(p.id);
                }
            }
        }
        const productsWithoutBlocks = currentPlanogram.products.filter(p => !allOldProducts.has(p.id));

        const newProducts: StandardPlanogramProduct[] = [];
        const newHierarchyPlacements: typeof currentPlanogram.hierarchyPlacements = [];
        for (const pb of packedBlocks) {
            const m = blocks.find(b => b.id === pb.blockId);
            if (!m) continue;
            const expanded = expandBlockProductsPure(m.productPlacements, productIdSet, pb.positionX, pb.positionY);
            newProducts.push(...expanded.map(ep => ({ ...ep, id: crypto.randomUUID(), placedBlockId: pb.id })));
            const expandedH = expandBlockHierarchyPlacements(m.hierarchyPlacements || [], pb.positionX, pb.positionY);
            newHierarchyPlacements.push(...expandedH.map(eh => ({ ...eh, id: crypto.randomUUID(), placedBlockId: pb.id })));
        }

        const updatedPlanogram = {
            ...currentPlanogram,
            blocks: packedBlocks,
            products: [...productsWithoutBlocks, ...newProducts],
            hierarchyPlacements: newHierarchyPlacements,
            updatedAt: new Date().toISOString()
        };

        // UI即時更新 → DB保存はバックグラウンド
        setCurrentPlanogram(updatedPlanogram);
        setPlanograms(planograms.map(p => p.id === currentPlanogram.id ? updatedPlanogram : p));
        standardPlanogramRepository.update(currentPlanogram.id, updatedPlanogram);
    };

    const handleDeleteBlock = async (planogramBlockId: string) => {
        if (!currentPlanogram) return;
        if (!confirm('このブロックを削除してもよろしいですか？')) return;

        const targetBlock = currentPlanogram.blocks.find(b => b.id === planogramBlockId);
        if (!targetBlock) return;

        const masterBlock = blocks.find(b => b.id === targetBlock.blockId);
        const blockWidth = masterBlock ? masterBlock.width : 0;
        const startX = targetBlock.positionX;
        const endX = startX + blockWidth;

        // ブロックと、その範囲内の商品を削除
        const updatedBlocks = currentPlanogram.blocks.filter(b => b.id !== planogramBlockId);

        // 範囲内の商品を削除
        // 厳密には、ブロックに属していた商品を削除すべきだが、ここでは位置ベースで削除
        // ブロック配置時に商品を展開しているので、位置が一致するものを削除する
        // ※ 0.1mmの誤差許容
        const margin = 0.1;
        const updatedProducts = currentPlanogram.products.filter(p => {
            const product = products.find(pr => pr.id === p.productId);
            if (!product) return true; // 商品見つからない場合は残す（安全策）

            const pCenter = p.positionX + (product.width * p.faceCount / 2);
            // 中心がブロック範囲内にあるか
            return !(pCenter >= startX - margin && pCenter <= endX + margin);
        });

        // 削除後に位置を詰める機能は実装しない（要望になかったため）
        // そのまま隙間があく仕様（「間違えた際に...」とあるので、即座に修正する用途と思われる）

        // 階層アイテムもブロック範囲内のものを削除
        const updatedHierarchyPlacements = (currentPlanogram.hierarchyPlacements || []).filter(h => {
            const hCenter = h.positionX + (h.width * h.faceCount / 2);
            return !(hCenter >= startX - margin && hCenter <= endX + margin);
        });

        const updatedPlanogram = {
            ...currentPlanogram,
            blocks: updatedBlocks,
            products: updatedProducts,
            hierarchyPlacements: updatedHierarchyPlacements,
            updatedAt: new Date().toISOString()
        };

        await standardPlanogramRepository.update(currentPlanogram.id, updatedPlanogram);
        setCurrentPlanogram(updatedPlanogram);
        setPlanograms(planograms.map(p => p.id === currentPlanogram.id ? updatedPlanogram : p));
    };

    // 棚割クリア
    const handleClearPlanogram = async () => {
        if (!currentPlanogram) return;
        if (!confirm('この標準棚割をクリアしますか？配置された商品がすべて削除されます。')) return;

        const updated = {
            ...currentPlanogram,
            blocks: [],
            products: [],
            hierarchyPlacements: [],
            updatedAt: new Date().toISOString()
        };

        await standardPlanogramRepository.update(currentPlanogram.id, updated);
        setCurrentPlanogram(updated);
        setPlanograms(planograms.map(p => p.id === currentPlanogram.id ? updated : p));
    };

    // 什器構成テキストの生成
    const generateFixtureCompositionText = useCallback(() => {
        if (!currentPlanogram || !selectedStoreId) return { compositionText: '', totalShaku: 0 };

        const storePlacements = placements.filter(p => p.storeId === selectedStoreId);
        const composition: { [key: string]: number } = {};

        for (const placement of storePlacements) {
            const fixture = fixtures.find(f => f.id === placement.fixtureId);
            if (!fixture) continue;

            const fType = fixture.fixtureType || '';
            const isMatch = selectedFixtureType === fType;

            if (isMatch) {
                const isFlatOrEnd = String(fixture.fixtureType).includes('flat') || String(fixture.fixtureType).includes('end-cap');
                const shaku = Math.round(fixture.width / 300);

                let key = '';
                if (isFlatOrEnd) {
                    key = `${shaku}尺平台`;
                } else {
                    key = `${shaku}尺${fixture.shelfCount}段棚`;
                }

                composition[key] = (composition[key] || 0) + 1;
            }
        }

        let totalShaku = 0;
        const parts = Object.entries(composition).map(([key, count]) => {
            // "3尺平台" や "4尺4段棚" から最初の数字（尺数）を抽出
            const match = key.match(/^(\d+)尺/);
            if (match) {
                totalShaku += parseInt(match[1], 10) * count;
            }
            return `${key}×${count}`;
        });

        const compositionText = parts.length > 0 ? parts.join('、') : '什器なし';
        return { compositionText, totalShaku };
    }, [currentPlanogram, selectedStoreId, placements, fixtures, selectedFixtureType]);

    // FMTでフィルターした店舗（什器配置済みのみ）
    const availableStores = stores.filter(s => {
        if (selectedFmt && s.fmt !== selectedFmt) return false;
        // 什器配置済みの店舗のみ
        return placements.some(p => p.storeId === s.id);
    });

    if (loading) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header">
                    <h1 className="page-title">FMT標準棚割管理</h1>
                </div>
                <div className="text-center text-muted animate-pulse">読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">FMT標準棚割管理</h1>
                <p className="page-subtitle">FMT別の標準棚割を作成・編集</p>
            </div>

            {/* FMT・店舗選択 */}
            <div className="card mb-lg">
                <div className="flex items-center gap-lg" style={{ flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">FMT選択</label>
                        <select
                            className="form-select"
                            value={selectedFmt}
                            onChange={(e) => handleFmtChange(e.target.value as FMT | '')}
                        >
                            <option value="">FMTを選択...</option>
                            {FMTS.map(fmt => (
                                <option key={fmt} value={fmt}>{fmt}</option>
                            ))}
                        </select>
                    </div>

                    {selectedFmt && (
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">基準店舗（什器配置済み）</label>
                            <select
                                className="form-select"
                                value={selectedStoreId}
                                onChange={(e) => handleStoreSelect(e.target.value)}
                            >
                                <option value="">店舗を選択...</option>
                                {availableStores.map(store => (
                                    <option key={store.id} value={store.id}>
                                        {store.name} ({store.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {currentPlanogram && (
                        <div style={{ marginLeft: 'auto' }}>
                            <button className="btn btn-secondary text-danger" onClick={handleClearPlanogram}>
                                全てクリア
                            </button>
                        </div>
                    )}
                </div>

                {availableStores.length === 0 && selectedFmt && (
                    <div className="text-warning text-sm mt-md">
                        ⚠️ このFMTで什器配置済みの店舗がありません。先に「店舗棚尺マスタ」で什器を配置してください。
                    </div>
                )}
            </div>

            {/* 什器タイプタブ */}
            <div className="flex border-b border-border mb-lg">
                {PLANOGRAM_TYPES.map(type => (
                    <button
                        key={type.id}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selectedFixtureType === type.id
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted hover:text-foreground'
                            }`}
                        onClick={() => handleFixtureTypeChange(type.id)}
                    >
                        {type.label}
                    </button>
                ))}
            </div>

            {currentPlanogram && (
                <>
                    <div className="mb-md">
                        <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.85rem' }}
                            onClick={() => setCurrentPlanogram(null)}
                        >
                            ← 一覧に戻る
                        </button>
                    </div>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={pointerWithin}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                        onDragCancel={() => { setActiveBlock(null); setHoveredShelfRow(null); setDragPreview(null); }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0, 1fr)', gap: '1.5rem' }}>
                            {/* ブロックパレット */}
                            <div>
                                <div className="card">
                                    <h3 className="card-title mb-md">棚ブロック</h3>
                                    <div className="text-sm text-muted mb-md">
                                        {selectedPaletteBlockId
                                            ? 'キャンバスをクリックして配置'
                                            : 'ブロックを選択して配置'}
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.35rem',
                                        maxHeight: '500px',
                                        overflowY: 'auto',
                                    }}>
                                        {blocks.filter(b => {
                                            const isFlat = b.blockType === 'flat';
                                            const isMultiTierFixture = selectedFixtureType === 'multi-tier';
                                            const isWallFlat = selectedFixtureType === 'wall-flat-refrigerated';
                                            return isMultiTierFixture ? !isFlat && b.blockType !== 'wall-flat' : isWallFlat ? b.blockType === 'wall-flat' : isFlat;
                                        }).map(block => (
                                            <SelectableBlock
                                                key={block.id}
                                                block={block}
                                                isSelected={selectedPaletteBlockId === block.id}
                                                onSelect={handleSelectPaletteBlock}
                                            />
                                        ))}
                                    </div>
                                    {blocks.filter(b => {
                                        const isFlat = b.blockType === 'flat';
                                        const isMultiTierFixture = selectedFixtureType === 'multi-tier';
                                            const isWallFlat = selectedFixtureType === 'wall-flat-refrigerated';
                                        return isMultiTierFixture ? !isFlat && b.blockType !== 'wall-flat' : isWallFlat ? b.blockType === 'wall-flat' : isFlat;
                                    }).length === 0 && (
                                            <div className="text-center text-muted" style={{ padding: '1rem' }}>
                                                棚ブロックがありません
                                            </div>
                                        )}
                                </div>
                            </div>

                            {/* キャンバス */}
                            <div style={{ minWidth: 0 }}>
                                <div className="card" style={{ overflow: 'hidden' }}>
                                    <div className="card-header">
                                        <div>
                                            <h3 className="card-title">{currentPlanogram.name}</h3>
                                            <div className="text-sm text-muted">
                                                {(() => {
                                                    const { compositionText, totalShaku } = generateFixtureCompositionText();
                                                    return (
                                                        <>
                                                            {compositionText}
                                                            （総幅: {totalShaku * 300}mm ({totalShaku > 0 ? `${totalShaku}尺` : ''})）
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                            {/* 分析モードトグル */}
                                            <label className="flex items-center gap-sm" style={{ cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={analyticsMode}
                                                    onChange={(e) => setAnalyticsMode(e.target.checked)}
                                                />
                                                <span className="text-sm">📊 分析モード</span>
                                            </label>

                                            {analyticsMode && (
                                                <select
                                                    className="form-select"
                                                    value={selectedMetric}
                                                    onChange={(e) => setSelectedMetric(e.target.value as any)}
                                                    style={{ width: '150px' }}
                                                >
                                                    <option value="sales">売上金額</option>
                                                    <option value="grossProfit">粗利</option>
                                                    <option value="quantity">売上数量</option>
                                                    <option value="traffic">客数</option>
                                                </select>
                                            )}

                                            <div className="text-sm">
                                                配置商品: <strong>{currentPlanogram.products.length}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        onClick={handleCanvasClickToPlace}
                                        style={{
                                            paddingLeft: '40px',
                                            cursor: selectedPaletteBlockId ? 'crosshair' : undefined,
                                        }}
                                    >
                                        <PlanogramCanvas
                                            planogram={currentPlanogram}
                                            products={products}
                                            blockMasters={blocks}
                                            analyticsMode={analyticsMode}
                                            selectedMetric={selectedMetric}
                                            onDeleteBlock={handleDeleteBlock}
                                            actualWidth={(() => {
                                                const { totalShaku } = generateFixtureCompositionText();
                                                return totalShaku > 0 ? totalShaku * 300 : currentPlanogram.width;
                                            })()}
                                            hoveredVisualRow={hoveredShelfRow}
                                            activeBlockShelfCount={activeBlock?.shelfCount}
                                            previewPositions={(() => {
                                                if (!dragPreview || !currentPlanogram) return null;
                                                const draggedBlock = currentPlanogram.blocks.find(b => b.id === dragPreview.blockId);
                                                if (!draggedBlock) return null;

                                                const draggedMaster = blocks.find(b => b.id === draggedBlock.blockId);
                                                const previewPosY = hoveredShelfRow != null && draggedMaster
                                                    ? calcPosYFromVisualRow(hoveredShelfRow, currentPlanogram.shelfCount, draggedMaster.shelfCount)
                                                    : draggedBlock.positionY;

                                                return calcPreviewPositions(
                                                    currentPlanogram.blocks,
                                                    dragPreview.blockId,
                                                    dragPreview.insertIndex,
                                                    previewPosY,
                                                    blocks
                                                );
                                            })()}
                                            selectedBlockId={selectedPlacedBlockId}
                                            onSelectBlock={handleSelectBlock}
                                            onSwapBlock={handleSwapBlock}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DragOverlay>
                            {activeBlock ? (
                                <div
                                    className="card"
                                    style={{
                                        padding: '0.75rem',
                                        background: 'var(--color-primary)',
                                        color: 'white',
                                        opacity: 0.9,
                                        cursor: 'grabbing'
                                    }}
                                >
                                    <div style={{ fontWeight: 500 }}>{activeBlock.name}</div>
                                    <div className="text-xs" style={{ opacity: 0.8 }}>
                                        {activeBlock.productPlacements.length} 商品
                                    </div>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>

                    {/* 売り場レイアウト表示 */}
                    {selectedStoreId && stores.find(s => s.id === selectedStoreId) && (
                        <div className="mt-lg">
                            <StoreLayoutVisualizer
                                store={stores.find(s => s.id === selectedStoreId)!}
                                placements={placements.filter(p => p.storeId === selectedStoreId)}
                                fixtures={fixtures}
                                blocks={blocks}
                                planogramBlocks={currentPlanogram?.blocks || []}
                                fixtureTypeFilter={selectedFixtureType}
                                scale={0.6}
                                products={products}
                            />
                        </div>
                    )}
                </>
            )}

            {/* 棚割一覧テーブル（FMT選択済み & エディタ未選択時） */}
            {!currentPlanogram && selectedFmt && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">標準棚割一覧</h3>
                        <button className="btn btn-primary" onClick={() => openCreateModal()}>
                            ＋ 新規作成
                        </button>
                    </div>

                    {filteredPlanograms.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)' }}>棚割名</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)' }}>適用期間</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)' }}>基準店舗</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>商品数</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)' }}>更新日</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)' }}>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPlanograms.map(pg => {
                                        const baseStore = stores.find(s => s.id === pg.baseStoreId);
                                        const hasOverlap = filteredPlanograms.some(other =>
                                            other.id !== pg.id && hasDateOverlap(pg, other)
                                        );
                                        const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '';
                                        const periodText = pg.startDate || pg.endDate
                                            ? `${formatDate(pg.startDate)}〜${formatDate(pg.endDate)}`
                                            : '未設定';

                                        return (
                                            <tr key={pg.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <div style={{ fontWeight: 500 }}>{pg.name}</div>
                                                    {pg.description && (
                                                        <div className="text-xs text-muted" style={{ marginTop: '2px' }}>{pg.description}</div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <span>{periodText}</span>
                                                    {hasOverlap && (
                                                        <span title="他の棚割と期間が重複しています" style={{
                                                            display: 'inline-block',
                                                            marginLeft: '0.5rem',
                                                            background: '#f59e0b',
                                                            color: 'white',
                                                            padding: '1px 6px',
                                                            borderRadius: '999px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 600
                                                        }}>⚠️ 重複</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    {baseStore ? baseStore.name : '—'}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                    {pg.products.length}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                    {new Date(pg.updatedAt).toLocaleDateString('ja-JP')}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            className="btn btn-secondary"
                                                            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                                            onClick={() => {
                                                                setSelectedStoreId(pg.baseStoreId);
                                                                setCurrentPlanogram(pg);
                                                            }}
                                                        >
                                                            編集
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary"
                                                            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                                            onClick={() => openCreateModal(pg)}
                                                        >
                                                            複製
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary text-danger"
                                                            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                                            onClick={() => handleDeletePlanogram(pg.id)}
                                                        >
                                                            削除
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center text-muted" style={{ padding: '3rem' }}>
                            この FMT・什器タイプの標準棚割はまだありません。<br />
                            「＋新規作成」ボタンから作成してください。
                        </div>
                    )}
                </div>
            )}

            {!selectedFmt && (
                <div className="card text-center text-muted" style={{ padding: '4rem' }}>
                    FMTを選択してください
                </div>
            )}

            {/* 新規作成モーダル */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title={copySource ? '標準棚割を複製' : '標準棚割を作成'}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                            キャンセル
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleCreatePlanogram}
                            disabled={!selectedFmt || !selectedStoreId || !planogramName}
                        >
                            {copySource ? '複製して作成' : '作成'}
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">棚割名</label>
                    <input
                        type="text"
                        className="form-input"
                        value={planogramName}
                        onChange={(e) => setPlanogramName(e.target.value)}
                        placeholder="MEGA標準棚割"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">基準店舗</label>
                    <select
                        className="form-select"
                        value={selectedStoreId}
                        onChange={(e) => setSelectedStoreId(e.target.value)}
                    >
                        <option value="">店舗を選択...</option>
                        {availableStores.map(store => (
                            <option key={store.id} value={store.id}>
                                {store.name} ({store.code})
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">適用開始日</label>
                        <input
                            type="date"
                            className="form-input"
                            value={newStartDate}
                            onChange={(e) => setNewStartDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">適用終了日</label>
                        <input
                            type="date"
                            className="form-input"
                            value={newEndDate}
                            onChange={(e) => setNewEndDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">メモ・用途</label>
                    <input
                        type="text"
                        className="form-input"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="例: 2024年末年始用"
                    />
                </div>
                {copySource && (
                    <div className="text-sm" style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        📋 「{copySource.name}」のブロック・商品配置をコピーします（{copySource.products.length}商品）
                    </div>
                )}
                {!copySource && (
                    <div className="text-sm text-muted">
                        選択した店舗の什器配置をベースに標準棚割を作成します。
                    </div>
                )}
            </Modal>
        </div>
    );
}
