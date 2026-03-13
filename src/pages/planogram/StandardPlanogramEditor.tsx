// 棚割管理システム - FMT標準棚割管理
import { useState, useEffect, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    pointerWithin,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
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
import { UnitDisplay } from '../../components/common/UnitDisplay';
import { calculateHeatmapColor, formatMetricValue } from '../../utils/heatmapUtils';
import { StoreLayoutVisualizer } from '../../components/layout/StoreLayoutVisualizer';

const SCALE = 0.3; // 1mm = 0.3px

const PLANOGRAM_TYPES: { id: FixtureType; label: string }[] = [
    { id: 'multi-tier', label: '多段' },
    { id: 'flat-refrigerated', label: '平台冷蔵' },
    { id: 'end-cap-refrigerated', label: '平台冷蔵エンド' },
    { id: 'flat-frozen', label: '平台冷凍' },
    { id: 'end-cap-frozen', label: '平台冷凍エンド' },
];

// ドラッグ可能な棚ブロック
function DraggableBlock({ block }: { block: ShelfBlock }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `block-${block.id}`,
        data: { block, type: 'block' }
    });

    const style = {
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab'
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="card"
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

// 標準棚割キャンバス（ブロック単位で固定表示）
function PlanogramCanvas({
    planogram,
    products,
    blockMasters,
    analyticsMode,
    selectedMetric,
    onDeleteBlock,
    actualWidth,
    hoveredVisualRow,
    activeBlockShelfCount
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
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'planogram-canvas',
        data: { type: 'canvas' }
    });

    const canvasWidth = (actualWidth || planogram.width) * SCALE;
    const shelfHeight = Math.max(80, (planogram.height / planogram.shelfCount) * SCALE);
    const canvasHeight = shelfHeight * planogram.shelfCount;

    // 位置順にソート済みブロック
    const sortedBlocks = [...planogram.blocks].sort((a, b) => a.positionX - b.positionX);

    // ブロックが使用している最大X（空きスペース計算用）
    const usedWidth = sortedBlocks.reduce((max, pb) => {
        const master = blockMasters.find(b => b.id === pb.blockId);
        return Math.max(max, pb.positionX + (master?.width || 0));
    }, 0);

    // 分析モード用：各ブロックの商品メトリクス合計
    const blockMetrics = analyticsMode && selectedMetric
        ? planogram.blocks.reduce((acc, pb) => {
            const blockProds = planogram.products.filter(sp => {
                const master = blockMasters.find(b => b.id === pb.blockId);
                if (!master) return false;
                return sp.positionX >= pb.positionX - 0.1 &&
                    sp.positionX < pb.positionX + master.width + 0.1;
            });
            acc[pb.id] = blockProds.reduce((sum, sp) => {
                const p = products.find(pr => pr.id === sp.productId);
                return sum + (p?.[selectedMetric!] || 0);
            }, 0);
            return acc;
        }, {} as Record<string, number>)
        : {};

    const maxBlockMetric = Math.max(...Object.values(blockMetrics), 1);

    return (
        <div
            ref={setNodeRef}
            style={{
                background: 'var(--bg-primary)',
                border: isOver ? '2px solid var(--color-primary)' : '2px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                minHeight: '200px',
                overflow: 'auto',
                position: 'relative'
            }}
        >
            <div
                style={{
                    width: `${canvasWidth}px`,
                    height: `${canvasHeight}px`,
                    position: 'relative'
                }}
            >
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

                {/* 棚段の区切り線・段番号 */}
                {Array.from({ length: planogram.shelfCount }).map((_, i) => {
                    const shelfNum = planogram.shelfCount - i;
                    return (
                        <div key={i}>
                            {/* 段番号ラベル */}
                            <div style={{
                                position: 'absolute',
                                left: '-35px',
                                top: `${i * shelfHeight + shelfHeight / 2}px`,
                                transform: 'translateY(-50%)',
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap'
                            }}>
                                {shelfNum}段
                            </div>
                            {/* 棚板区切り線（最下段を除く） */}
                            {i < planogram.shelfCount - 1 && (
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    top: `${(i + 1) * shelfHeight}px`,
                                    height: '1px',
                                    background: 'var(--border-color)',
                                    zIndex: 0,
                                    pointerEvents: 'none'
                                }} />
                            )}
                        </div>
                    );
                })}

                {/* 空きスペース */}
                {usedWidth < (actualWidth || planogram.width) && (
                    <div style={{
                        position: 'absolute',
                        left: `${usedWidth * SCALE}px`,
                        top: 0,
                        width: `${((actualWidth || planogram.width) - usedWidth) * SCALE}px`,
                        height: `${canvasHeight}px`,
                        background: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(100,100,100,0.05) 6px, rgba(100,100,100,0.05) 12px)',
                        border: '1px dashed var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 0,
                        boxSizing: 'border-box'
                    }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>空き</span>
                    </div>
                )}

                {/* 配置済みブロック */}
                {sortedBlocks.map(pb => {
                    const master = blockMasters.find(b => b.id === pb.blockId);
                    if (!master) return null;

                    const blockW = master.width * SCALE;
                    // positionY: 下から何段目か (0=最下段)
                    const blockShelfSpan = Math.min(master.shelfCount, planogram.shelfCount - pb.positionY);
                    const blockH = blockShelfSpan * shelfHeight;
                    // 下段基準: canvasHeight の底から positionY 段 + blockH の高さ
                    const blockTop = canvasHeight - (pb.positionY + blockShelfSpan) * shelfHeight;

                    const blockColor = analyticsMode && selectedMetric
                        ? calculateHeatmapColor(blockMetrics[pb.id] || 0, maxBlockMetric)
                        : 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))';

                    const shakuLabel = Math.round(master.width / 300 * 10) / 10;

                    return (
                        <div
                            key={pb.id}
                            style={{
                                position: 'absolute',
                                left: `${pb.positionX * SCALE}px`,
                                top: `${blockTop}px`,
                                width: `${blockW}px`,
                                height: `${blockH}px`,
                                background: blockColor,
                                border: '2px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                zIndex: 1,
                                boxSizing: 'border-box'
                            }}
                            title={`${master.name}\n${shakuLabel}尺 / ${master.shelfCount}段 / ${master.productPlacements.length}商品`}
                        >
                            {/* 上部バー：ブロック名 + 削除ボタン */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '3px 5px',
                                background: 'rgba(0,0,0,0.18)',
                                borderBottom: '1px solid var(--border-color)',
                                minHeight: '22px'
                            }}>
                                <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1
                                }}>
                                    {master.name}
                                </span>
                                {onDeleteBlock && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteBlock(pb.id); }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#ef4444',
                                            padding: '0 2px',
                                            fontSize: '0.9rem',
                                            lineHeight: 1,
                                            flexShrink: 0,
                                            marginLeft: '2px'
                                        }}
                                        title="このブロックを削除"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            {/* 中央情報 */}
                            <div style={{
                                fontSize: '0.68rem',
                                color: 'var(--text-muted)',
                                textAlign: 'center',
                                lineHeight: 1.6,
                                marginTop: '22px'
                            }}>
                                <div>{shakuLabel}尺</div>
                                <div>{master.shelfCount}段</div>
                                <div>{master.productPlacements.length}商品</div>
                                {analyticsMode && selectedMetric && (
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                                        {formatMetricValue(blockMetrics[pb.id] || 0)}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {planogram.blocks.length === 0 && (
                <div className="text-center text-muted" style={{ padding: '3rem' }}>
                    左のブロックをドラッグして配置してください
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
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [planogramName, setPlanogramName] = useState('');
    const [newStartDate, setNewStartDate] = useState('');
    const [newEndDate, setNewEndDate] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [copySource, setCopySource] = useState<StandardPlanogram | null>(null);

    // 分析モード
    const [analyticsMode, setAnalyticsMode] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<'sales' | 'grossProfit' | 'quantity' | 'traffic'>('sales');

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
            const isMatch = (selectedFixtureType === 'multi-tier' && ['multi-tier', 'gondola'].includes(fType as any)) ||
                (selectedFixtureType === fType);

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
        const block = event.active.data.current?.block as ShelfBlock | undefined;
        setActiveBlock(block || null);
        setHoveredShelfRow(null);
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

    // ドラッグ終了（ブロック配置）
    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveBlock(null);
        setHoveredShelfRow(null);
        if (!currentPlanogram) return;

        const { active, over } = event;
        if (!over) return;
        // キャンバスまたは棚段ドロップゾーンのみ受け付ける
        const overId = String(over.id);
        const isShelfRow = overId.startsWith('shelf-row-');
        if (!isShelfRow && overId !== 'planogram-canvas') return;

        const block = active.data.current?.block as ShelfBlock | undefined;
        if (!block) return;

        // --- Y方向: 棚段ドロップゾーンIDから配置段を決定（下基準: 0=最下段）---
        const shelfHeight = Math.max(80, (currentPlanogram.height / currentPlanogram.shelfCount) * SCALE);
        const canvasHeight = shelfHeight * currentPlanogram.shelfCount;
        const maxPosY = Math.max(0, currentPlanogram.shelfCount - block.shelfCount);
        let newPosY = 0;

        if (isShelfRow) {
            // shelf-row-N は視覚的上からN番目 → 下段基準に変換
            const visualRow = parseInt(overId.replace('shelf-row-', ''), 10);
            // positionY = shelfCount - visualRow - blockShelfCount
            newPosY = Math.max(0, Math.min(currentPlanogram.shelfCount - visualRow - block.shelfCount, maxPosY));
        } else {
            // フォールバック: ポインタ位置から計算
            const translatedRect = active.rect.current.translated;
            if (translatedRect && over.rect) {
                const relativeY = Math.max(0, Math.min(translatedRect.top - over.rect.top, canvasHeight - 1));
                const rawFromBottom = Math.floor((canvasHeight - relativeY) / shelfHeight);
                newPosY = Math.max(0, Math.min(rawFromBottom, maxPosY));
            }
        }

        const newBlockShelfEnd = newPosY + block.shelfCount;

        // --- X方向: 同一Y範囲に重なるブロックのみを考慮して空き位置を探す ---
        const overlappingBlocks = currentPlanogram.blocks
            .filter(pb => {
                const master = blocks.find(b => b.id === pb.blockId);
                if (!master) return false;
                const pbEnd = pb.positionY + master.shelfCount;
                // Y範囲が重なるか
                return pb.positionY < newBlockShelfEnd && pbEnd > newPosY;
            })
            .sort((a, b) => a.positionX - b.positionX);

        const newBlockWidth = block.width;
        let insertX = -1;
        let currentScanX = 0;

        // 隙間を探す
        for (const placedBlock of overlappingBlocks) {
            const gap = placedBlock.positionX - currentScanX;
            if (gap >= newBlockWidth - 0.1) {
                insertX = currentScanX;
                break;
            }
            const master = blocks.find(b => b.id === placedBlock.blockId);
            currentScanX = placedBlock.positionX + (master?.width || 0);
        }

        // 途中に隙間がなければ最後尾をチェック
        if (insertX === -1) {
            const { totalShaku } = generateFixtureCompositionText();
            const actualWidth = totalShaku > 0 ? totalShaku * 300 : currentPlanogram.width;
            const gap = actualWidth - currentScanX;
            if (gap >= newBlockWidth - 0.1) {
                insertX = currentScanX;
            }
        }

        if (insertX === -1) {
            alert('スペースが足りません。先に既存のブロックを調整してください。');
            return;
        }

        const placementX = insertX;

        // 商品展開: shelfIndex を positionY 基準の絶対段番号に変換
        const newProducts: StandardPlanogramProduct[] = [];
        for (const placement of block.productPlacements) {
            const product = products.find(p => p.id === placement.productId);
            if (!product) continue;

            newProducts.push({
                id: crypto.randomUUID(),
                productId: placement.productId,
                // 下段基準の絶対段番号 = ブロックの開始段 + ブロック内相対段
                shelfIndex: newPosY + placement.shelfIndex,
                positionX: placementX + placement.positionX,
                faceCount: placement.faceCount
            });
        }

        // ブロック配置記録
        const newBlock: StandardPlanogramBlock = {
            id: crypto.randomUUID(),
            blockId: block.id,
            positionX: placementX,
            positionY: newPosY  // 下段基準の段インデックス
        };

        const updatedPlanogram = {
            ...currentPlanogram,
            blocks: [...currentPlanogram.blocks, newBlock],
            products: [...currentPlanogram.products, ...newProducts],
            updatedAt: new Date().toISOString()
        };

        await standardPlanogramRepository.update(currentPlanogram.id, updatedPlanogram);
        setCurrentPlanogram(updatedPlanogram);
        setPlanograms(planograms.map(p => p.id === currentPlanogram.id ? updatedPlanogram : p));
    };

    // ブロック削除
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

        const updatedPlanogram = {
            ...currentPlanogram,
            blocks: updatedBlocks,
            products: updatedProducts,
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
            const isMatch = (selectedFixtureType === 'multi-tier' && ['multi-tier', 'gondola'].includes(fType as any)) ||
                (selectedFixtureType === fType);

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
                        onDragEnd={handleDragEnd}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0, 1fr)', gap: '1.5rem' }}>
                            {/* ブロックパレット */}
                            <div>
                                <div className="card">
                                    <h3 className="card-title mb-md">棚ブロック</h3>
                                    <div className="text-sm text-muted mb-md">
                                        ブロックをドラッグして配置
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {blocks.filter(b => {
                                            const isFlat = b.blockType === 'flat';
                                            const isMultiTierFixture = selectedFixtureType === 'multi-tier' || selectedFixtureType === 'gondola';
                                            return isMultiTierFixture ? !isFlat : isFlat;
                                        }).map(block => (
                                            <DraggableBlock key={block.id} block={block} />
                                        ))}
                                    </div>
                                    {blocks.filter(b => {
                                        const isFlat = b.blockType === 'flat';
                                        const isMultiTierFixture = selectedFixtureType === 'multi-tier' || selectedFixtureType === 'gondola';
                                        return isMultiTierFixture ? !isFlat : isFlat;
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

                                    <div style={{ paddingLeft: '40px' }}>
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
                    {selectedStoreId && (
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
