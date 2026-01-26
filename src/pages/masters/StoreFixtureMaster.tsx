// 棚割管理システム - 店舗棚尺マスタ（店舗への什器配置）
import { useState, useEffect, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    closestCenter
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Store, Fixture, StoreFixturePlacement } from '../../data/types';
import {
    storeRepository,
    fixtureRepository,
    storeFixturePlacementRepository
} from '../../data/repositories/localStorageRepository';
import { UnitDisplay } from '../../components/common/UnitDisplay';
import { StoreLayoutVisualizer } from '../../components/layout/StoreLayoutVisualizer';

type ViewMode = 'list' | 'layout';

// ドラッグ可能な什器アイテム
function DraggableFixture({ fixture }: { fixture: Fixture }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `fixture-${fixture.id}`,
        data: { fixture }
    });

    const style = {
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="card"
            role="button"
            tabIndex={0}
        >
            <div className="flex items-center gap-sm">
                <span style={{ fontSize: '1.5rem' }}>🗄️</span>
                <div>
                    <div style={{ fontWeight: 500 }}>{fixture.name}</div>
                    <div className="text-xs text-muted">
                        <UnitDisplay valueCm={fixture.width} /> × <UnitDisplay valueCm={fixture.height} />
                    </div>
                    <div className="text-xs text-muted">{fixture.shelfCount}段</div>
                </div>
            </div>
        </div>
    );
}

// 配置済み什器表示
function PlacedFixture({
    fixture,
    onRemove
}: {
    placement: StoreFixturePlacement;
    fixture: Fixture;
    onRemove: () => void;
}) {
    return (
        <div
            className="card"
            style={{
                background: 'var(--bg-tertiary)',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem'
            }}
        >
            <div className="flex items-center gap-sm">
                <span style={{ fontSize: '1.25rem' }}>🗄️</span>
                <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{fixture.name}</div>
                    <div className="text-xs text-muted">
                        <UnitDisplay valueCm={fixture.width} /> / {fixture.shelfCount}段
                    </div>
                </div>
            </div>
            <button
                className="btn btn-sm btn-danger"
                onClick={onRemove}
                style={{ padding: '0.25rem 0.5rem' }}
            >
                ×
            </button>
        </div>
    );
}

// ドロップエリア
function StoreDropArea({
    store,
    placements,
    fixtures,
    onRemove
}: {
    store: Store;
    placements: StoreFixturePlacement[];
    fixtures: Fixture[];
    onRemove: (placementId: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `store-${store.id}`,
        data: { store }
    });

    const storePlacements = placements.filter(p => p.storeId === store.id);
    const totalWidth = storePlacements.reduce((sum, p) => {
        const fixture = fixtures.find(f => f.id === p.fixtureId);
        return sum + (fixture?.width || 0);
    }, 0);

    return (
        <div
            ref={setNodeRef}
            className="card"
            style={{
                borderColor: isOver ? 'var(--color-primary)' : 'var(--border-color)',
                borderWidth: isOver ? '2px' : '1px',
                transition: 'all var(--transition-fast)',
                minHeight: '120px'
            }}
        >
            <div className="flex items-center justify-between mb-md">
                <div>
                    <div style={{ fontWeight: 600 }}>{store.name}</div>
                    <div className="text-xs text-muted">{store.code} / {store.fmt} / {store.region}</div>
                </div>
                <div className="text-right">
                    <div className="text-sm">
                        配置什器: <strong>{storePlacements.length}</strong> 台
                    </div>
                    <div className="text-xs text-muted">
                        総幅: <UnitDisplay valueCm={totalWidth} />
                    </div>
                </div>
            </div>

            {storePlacements.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {storePlacements.map(placement => {
                        const fixture = fixtures.find(f => f.id === placement.fixtureId);
                        if (!fixture) return null;
                        return (
                            <PlacedFixture
                                key={placement.id}
                                placement={placement}
                                fixture={fixture}
                                onRemove={() => onRemove(placement.id)}
                            />
                        );
                    })}
                </div>
            ) : (
                <div
                    className="text-center text-muted"
                    style={{
                        padding: '1.5rem',
                        border: '2px dashed var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        background: isOver ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
                    }}
                >
                    什器をここにドロップして配置
                </div>
            )}
        </div>
    );
}

export function StoreFixtureMaster() {
    const [stores, setStores] = useState<Store[]>([]);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [placements, setPlacements] = useState<StoreFixturePlacement[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFixture, setActiveFixture] = useState<Fixture | null>(null);
    const [filterFmt, setFilterFmt] = useState<string>('');

    // 表示モード
    const [viewMode, setViewMode] = useState<ViewMode>('layout');
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);

    // データ読み込み
    const loadData = useCallback(async () => {
        setLoading(true);
        const [storesData, fixturesData, placementsData] = await Promise.all([
            storeRepository.getAll(),
            fixtureRepository.getAll(),
            storeFixturePlacementRepository.getAll()
        ]);
        setStores(storesData);
        setFixtures(fixturesData);
        setPlacements(placementsData);

        // テスト店舗を初期選択
        const testStore = storesData.find(s => s.code === 'TEST001');
        if (testStore) {
            setSelectedStoreId(testStore.id);
        } else if (storesData.length > 0) {
            setSelectedStoreId(storesData[0].id);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ドラッグ開始
    const handleDragStart = (event: DragStartEvent) => {
        const fixture = event.active.data.current?.fixture as Fixture | undefined;
        setActiveFixture(fixture || null);
    };

    // ドラッグ終了
    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveFixture(null);

        const { active, over } = event;
        if (!over) return;

        const fixture = active.data.current?.fixture as Fixture | undefined;
        const overId = over.id as string;

        if (!fixture || !overId.startsWith('store-')) return;

        const storeId = overId.replace('store-', '');

        // 配置を追加
        const existingPlacements = placements.filter(p => p.storeId === storeId);
        const newPlacement = await storeFixturePlacementRepository.create({
            storeId,
            fixtureId: fixture.id,
            positionX: 0,
            positionY: 0,
            order: existingPlacements.length
        });

        setPlacements([...placements, newPlacement]);
    };

    // 配置削除
    const handleRemovePlacement = async (placementId: string) => {
        await storeFixturePlacementRepository.delete(placementId);
        setPlacements(placements.filter(p => p.id !== placementId));
        setSelectedPlacementId(null);
    };

    // フィルター適用
    const filteredStores = filterFmt
        ? stores.filter(s => s.fmt === filterFmt)
        : stores;

    // 選択された店舗
    const selectedStore = stores.find(s => s.id === selectedStoreId);
    const selectedStorePlacements = placements.filter(p => p.storeId === selectedStoreId);

    if (loading) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header">
                    <h1 className="page-title">店舗棚尺マスタ</h1>
                </div>
                <div className="text-center text-muted animate-pulse">読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">店舗棚尺マスタ</h1>
                <p className="page-subtitle">店舗に対して棚什器をドラッグ＆ドロップで配置</p>
            </div>

            {/* 表示モード切り替え */}
            <div className="card mb-lg" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                    <button
                        className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                            flex: 1,
                            borderRadius: 0,
                            borderRight: '1px solid var(--border-color)',
                            padding: '0.75rem'
                        }}
                        onClick={() => setViewMode('list')}
                    >
                        📋 リスト表示
                    </button>
                    <button
                        className={`btn ${viewMode === 'layout' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                            flex: 1,
                            borderRadius: 0,
                            padding: '0.75rem'
                        }}
                        onClick={() => setViewMode('layout')}
                    >
                        📐 レイアウト表示
                    </button>
                </div>

                {/* 店舗選択（レイアウトモード用） */}
                {viewMode === 'layout' && (
                    <div style={{ padding: '1rem', background: 'var(--bg-secondary)' }}>
                        <div className="flex items-center gap-md">
                            <span className="text-sm">対象店舗:</span>
                            <select
                                className="form-select"
                                value={selectedStoreId || ''}
                                onChange={(e) => {
                                    setSelectedStoreId(e.target.value);
                                    setSelectedPlacementId(null);
                                }}
                                style={{ minWidth: '200px' }}
                            >
                                <option value="">店舗を選択...</option>
                                {stores.map(store => (
                                    <option key={store.id} value={store.id}>
                                        {store.name} ({store.code}) - {store.fmt}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* レイアウト表示モード */}
            {viewMode === 'layout' && selectedStore && (
                <StoreLayoutVisualizer
                    store={selectedStore}
                    placements={selectedStorePlacements}
                    fixtures={fixtures}
                    selectedPlacementId={selectedPlacementId}
                    onPlacementClick={(placement) => {
                        setSelectedPlacementId(
                            selectedPlacementId === placement.id ? null : placement.id
                        );
                    }}
                    onRemovePlacement={handleRemovePlacement}
                />
            )}

            {viewMode === 'layout' && !selectedStore && (
                <div className="card text-center text-muted" style={{ padding: '3rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📐</div>
                    <div>店舗を選択してレイアウトを表示</div>
                </div>
            )}

            {/* リスト表示モード */}
            {viewMode === 'list' && (
                <DndContext
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
                        {/* 什器パレット */}
                        <div>
                            <div className="card">
                                <h3 className="card-title mb-md">什器一覧</h3>
                                <div className="text-sm text-muted mb-md">
                                    什器を右側の店舗にドラッグして配置
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {fixtures.map(fixture => (
                                        <DraggableFixture key={fixture.id} fixture={fixture} />
                                    ))}
                                </div>
                                {fixtures.length === 0 && (
                                    <div className="text-center text-muted" style={{ padding: '1rem' }}>
                                        什器が登録されていません
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 店舗エリア */}
                        <div>
                            {/* FMTフィルター */}
                            <div className="card mb-md">
                                <div className="flex items-center gap-md">
                                    <span className="text-sm">FMTフィルター:</span>
                                    <button
                                        className={`btn btn-sm ${!filterFmt ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setFilterFmt('')}
                                    >
                                        全て
                                    </button>
                                    {['MEGA', 'SuC', 'SMART', 'GO'].map(fmt => (
                                        <button
                                            key={fmt}
                                            className={`btn btn-sm ${filterFmt === fmt ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setFilterFmt(fmt)}
                                        >
                                            {fmt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 店舗一覧 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {filteredStores.map(store => (
                                    <StoreDropArea
                                        key={store.id}
                                        store={store}
                                        placements={placements}
                                        fixtures={fixtures}
                                        onRemove={handleRemovePlacement}
                                    />
                                ))}
                            </div>

                            {filteredStores.length === 0 && (
                                <div className="card text-center text-muted">
                                    店舗が見つかりません
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ドラッグオーバーレイ */}
                    <DragOverlay>
                        {activeFixture ? (
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
                                <div className="flex items-center gap-sm">
                                    <span style={{ fontSize: '1.25rem' }}>🗄️</span>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{activeFixture.name}</div>
                                        <div className="text-xs" style={{ opacity: 0.8 }}>
                                            {activeFixture.width}cm × {activeFixture.height}cm
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}
        </div>
    );
}
