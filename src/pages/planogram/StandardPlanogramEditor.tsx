// 棚割管理システム - FMT標準棚割管理
import { useState, useEffect, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type {
    Store,
    Fixture,
    ShelfBlock,
    StandardPlanogram,
    StandardPlanogramBlock,
    StandardPlanogramProduct,
    Product,
    FMT,
    StoreFixturePlacement
} from '../../data/types';
import { FMTS } from '../../data/types';
import {
    storeRepository,
    fixtureRepository,
    shelfBlockRepository,
    standardPlanogramRepository,
    productRepository,
    storeFixturePlacementRepository
} from '../../data/repositories/localStorageRepository';
import { Modal } from '../../components/common/Modal';
import { UnitDisplay } from '../../components/common/UnitDisplay';

const SCALE = 3; // 1cm = 3px

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
                <UnitDisplay valueCm={block.width} /> × {block.shelfCount}段
            </div>
            <div className="text-xs text-muted">
                {block.productPlacements.length} 商品
            </div>
        </div>
    );
}

// 標準棚割キャンバス
function PlanogramCanvas({
    planogram,
    products
}: {
    planogram: StandardPlanogram;
    products: Product[];
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'planogram-canvas',
        data: { type: 'canvas' }
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                background: 'var(--bg-primary)',
                border: isOver ? '2px solid var(--color-primary)' : '2px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                minHeight: '400px',
                overflow: 'auto'
            }}
        >
            <div
                className="shelf-grid"
                style={{
                    width: `${planogram.width * SCALE}px`,
                    minHeight: `${planogram.height * SCALE}px`
                }}
            >
                {/* 段ごとに表示 */}
                {Array.from({ length: planogram.shelfCount }).map((_, shelfIndex) => {
                    const shelfProducts = planogram.products.filter(p => p.shelfIndex === shelfIndex);
                    const usedWidth = shelfProducts.reduce((sum, sp) => {
                        const product = products.find(p => p.id === sp.productId);
                        return sum + (product ? product.width * sp.faceCount : 0);
                    }, 0);
                    const emptyWidth = planogram.width - usedWidth;

                    return (
                        <div
                            key={shelfIndex}
                            className="shelf-row"
                            style={{
                                height: `${Math.max(60, (planogram.height / planogram.shelfCount) * SCALE)}px`,
                                position: 'relative'
                            }}
                        >
                            {/* 配置済み商品 */}
                            {shelfProducts.map(sp => {
                                const product = products.find(p => p.id === sp.productId);
                                if (!product) return null;
                                const width = product.width * sp.faceCount * SCALE;

                                return (
                                    <div
                                        key={sp.id}
                                        style={{
                                            position: 'absolute',
                                            left: `${sp.positionX * SCALE}px`,
                                            top: 0,
                                            bottom: 0,
                                            width: `${width}px`,
                                            background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-sm)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '2px',
                                            fontSize: '0.6rem',
                                            overflow: 'hidden'
                                        }}
                                        title={`${product.name} ×${sp.faceCount}`}
                                    >
                                        <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                            {product.name}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)' }}>×{sp.faceCount}</div>
                                    </div>
                                );
                            })}

                            {/* 空白スペース */}
                            {emptyWidth > 0 && (
                                <div
                                    className="shelf-empty"
                                    style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: `${emptyWidth * SCALE}px`
                                    }}
                                />
                            )}

                            {/* 段番号 */}
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '-35px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)'
                                }}
                            >
                                {shelfIndex + 1}段
                            </div>
                        </div>
                    );
                })}
            </div>

            {planogram.products.length === 0 && (
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
    const [currentPlanogram, setCurrentPlanogram] = useState<StandardPlanogram | null>(null);
    const [activeBlock, setActiveBlock] = useState<ShelfBlock | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [planogramName, setPlanogramName] = useState('');

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

    // FMT選択時
    const handleFmtChange = (fmt: FMT | '') => {
        setSelectedFmt(fmt);
        setSelectedStoreId('');
        setCurrentPlanogram(null);

        if (fmt) {
            // 既存の標準棚割を検索
            const existing = planograms.find(p => p.fmt === fmt);
            if (existing) {
                setCurrentPlanogram(existing);
            }
        }
    };

    // 店舗選択時（基準店舗としてキャンバス初期化）
    const handleStoreSelect = async (storeId: string) => {
        setSelectedStoreId(storeId);

        if (!selectedFmt) return;

        // 店舗の什器配置から棚サイズを計算
        const storePlacements = placements.filter(p => p.storeId === storeId);
        let totalWidth = 0;

        for (const placement of storePlacements) {
            const fixture = fixtures.find(f => f.id === placement.fixtureId);
            if (fixture) {
                totalWidth += fixture.width;
            }
        }

        if (totalWidth === 0) {
            alert('この店舗には什器が配置されていません');
            return;
        }

        // 既存の標準棚割を検索または新規作成準備
        const existing = planograms.find(p => p.fmt === selectedFmt);
        if (existing) {
            setCurrentPlanogram(existing);
        } else {
            setPlanogramName(`${selectedFmt}標準棚割`);
            setIsCreateModalOpen(true);
        }
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
            if (fixture) {
                totalWidth += fixture.width;
                maxHeight = Math.max(maxHeight, fixture.height);
                maxShelfCount = Math.max(maxShelfCount, fixture.shelfCount);
            }
        }

        const newPlanogram = await standardPlanogramRepository.create({
            fmt: selectedFmt,
            name: planogramName,
            baseStoreId: selectedStoreId,
            width: totalWidth,
            height: maxHeight || 180,
            shelfCount: maxShelfCount || 5,
            blocks: [],
            products: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        setPlanograms([...planograms, newPlanogram]);
        setCurrentPlanogram(newPlanogram);
        setIsCreateModalOpen(false);
    };

    // ドラッグ開始
    const handleDragStart = (event: DragStartEvent) => {
        const block = event.active.data.current?.block as ShelfBlock | undefined;
        setActiveBlock(block || null);
    };

    // ドラッグ終了（ブロック配置）
    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveBlock(null);
        if (!currentPlanogram) return;

        const { active, over } = event;
        if (!over || over.id !== 'planogram-canvas') return;

        const block = active.data.current?.block as ShelfBlock | undefined;
        if (!block) return;

        // ブロック内の商品を展開
        const newProducts: StandardPlanogramProduct[] = [];
        let currentX = currentPlanogram.products.reduce((max, p) => {
            const product = products.find(pr => pr.id === p.productId);
            if (!product) return max;
            return Math.max(max, p.positionX + product.width * p.faceCount);
        }, 0);

        // スペースチェック
        const blockWidth = block.productPlacements.reduce((sum, pp) => {
            const product = products.find(p => p.id === pp.productId);
            return sum + (product ? product.width * pp.faceCount : 0);
        }, 0);

        if (currentX + blockWidth > currentPlanogram.width) {
            alert('スペースが足りません。先に既存の商品を調整してください。');
            return;
        }

        for (const placement of block.productPlacements) {
            const product = products.find(p => p.id === placement.productId);
            if (!product) continue;

            newProducts.push({
                id: crypto.randomUUID(),
                productId: placement.productId,
                shelfIndex: placement.shelfIndex,
                positionX: currentX + placement.positionX,
                faceCount: placement.faceCount
            });
        }

        // ブロック配置記録
        const newBlock: StandardPlanogramBlock = {
            id: crypto.randomUUID(),
            blockId: block.id,
            positionX: currentX,
            positionY: 0
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
                            <button className="btn btn-danger" onClick={handleClearPlanogram}>
                                棚割をクリア
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

            {currentPlanogram && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '1.5rem' }}>
                        {/* ブロックパレット */}
                        <div>
                            <div className="card">
                                <h3 className="card-title mb-md">棚ブロック</h3>
                                <div className="text-sm text-muted mb-md">
                                    ブロックをドラッグして配置
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {blocks.map(block => (
                                        <DraggableBlock key={block.id} block={block} />
                                    ))}
                                </div>
                                {blocks.length === 0 && (
                                    <div className="text-center text-muted" style={{ padding: '1rem' }}>
                                        棚ブロックがありません
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* キャンバス */}
                        <div>
                            <div className="card">
                                <div className="card-header">
                                    <div>
                                        <h3 className="card-title">{currentPlanogram.name}</h3>
                                        <div className="text-sm text-muted">
                                            <UnitDisplay valueCm={currentPlanogram.width} /> × <UnitDisplay valueCm={currentPlanogram.height} /> / {currentPlanogram.shelfCount}段
                                        </div>
                                    </div>
                                    <div className="text-sm">
                                        配置商品: <strong>{currentPlanogram.products.length}</strong>
                                    </div>
                                </div>

                                <div style={{ paddingLeft: '40px' }}>
                                    <PlanogramCanvas
                                        planogram={currentPlanogram}
                                        products={products}
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
            )}

            {!currentPlanogram && selectedFmt && (
                <div className="card text-center text-muted" style={{ padding: '4rem' }}>
                    基準店舗を選択すると標準棚割を作成できます
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
                title="標準棚割を作成"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                            キャンセル
                        </button>
                        <button className="btn btn-primary" onClick={handleCreatePlanogram}>
                            作成
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
                <div className="text-sm text-muted">
                    選択した店舗の什器配置をベースに標準棚割を作成します。
                </div>
            </Modal>
        </div>
    );
}
