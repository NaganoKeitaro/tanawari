// 棚割管理システム - 個店棚割詳細編集
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
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
    StorePlanogram,
    StandardPlanogram,
    Product,
    StorePlanogramProduct,
    FixtureType,
    ShelfBlock
} from '../../data/types';
import {
    storeRepository,
    storePlanogramRepository,
    standardPlanogramRepository,
    productRepository,
    storeFixturePlacementRepository,
    fixtureRepository,
    shelfBlockRepository
} from '../../data/repositories/localStorageRepository';
import { syncStorePlanogram, generateStorePlanogram } from '../../services/automationService';
import { UnitDisplay } from '../../components/common/UnitDisplay';
import { calculateHeatmapColor, formatMetricValue } from '../../utils/heatmapUtils';
import { StoreLayoutVisualizer } from '../../components/layout/StoreLayoutVisualizer';
import type { Fixture, StoreFixturePlacement } from '../../data/types';

const SCALE = 3;

// 什器グループ定義
type FixtureGroup = 'multi-tier' | 'flat';

const FIXTURE_GROUPS: Record<FixtureGroup, { label: string; types: FixtureType[] }> = {
    'multi-tier': {
        label: '多段棚',
        types: ['multi-tier', 'gondola']
    },
    'flat': {
        label: '平台',
        types: ['flat-refrigerated', 'flat-frozen', 'end-cap-refrigerated', 'end-cap-frozen']
    }
};

const TYPE_LABELS: Record<FixtureType, string> = {
    'multi-tier': '多段',
    'gondola': 'ゴンドラ',
    'flat-refrigerated': '平台冷蔵',
    'flat-frozen': '平台冷凍',
    'end-cap-refrigerated': '平台冷蔵エンド',
    'end-cap-frozen': '平台冷凍エンド'
};

// ドラッグ可能な商品（パレット用）
function DraggableProduct({ product }: { product: Product }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `palette-product-${product.id}`,
        data: { product, type: 'palette-product' }
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
            className="product-card mb-sm p-sm"
            title={`${product.name}\n${product.width}×${product.height}cm`}
        >
            <div className="flex items-center gap-sm">
                <img
                    src={product.imageUrl}
                    alt={product.name}
                    style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="product-card-name" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                    <div className="product-card-size" style={{ fontSize: '0.7rem' }}>{product.width}×{product.height}cm</div>
                </div>
            </div>
        </div>
    );
}

// 棚段ドロップエリア
function ShelfRowWithDrop({
    planogramId,
    shelfIndex,
    heightPx,
    children
}: {
    planogramId: string;
    shelfIndex: number;
    heightPx: number;
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `shelf-${planogramId}-${shelfIndex}`,
        data: { planogramId, shelfIndex }
    });

    return (
        <div
            ref={setNodeRef}
            className="shelf-row"
            style={{
                height: `${heightPx}px`,
                position: 'relative',
                borderColor: isOver ? 'var(--color-primary)' : 'var(--border-color)',
                borderWidth: isOver ? '2px' : '1px',
                borderStyle: isOver ? 'dashed' : 'solid',
                backgroundColor: isOver ? 'rgba(99, 102, 241, 0.05)' : 'transparent'
            }}
        >
            {children}
        </div>
    );
}

// 単一の棚割を表示・編集するコンポーネント
function SinglePlanogramView({
    store,
    planogram,
    standardPlanogram,
    fixtureType,
    products,
    blocks,
    maxMetricValue,
    analyticsMode,
    selectedMetric,
    onSync,
    onUpdate
}: {
    store: Store;
    planogram: StorePlanogram | null;
    standardPlanogram: StandardPlanogram | null;
    fixtureType: FixtureType;
    products: Product[];
    blocks: ShelfBlock[];
    maxMetricValue: number;
    analyticsMode: boolean;
    selectedMetric: 'sales' | 'grossProfit' | 'quantity' | 'traffic' | null;
    onSync: (planogramId: string) => Promise<void>;
    onUpdate: (updated: StorePlanogram) => Promise<void>;
}) {
    const [loading, setLoading] = useState(false);

    // フェイス数変更
    const handleFaceCountChange = async (productPlacementId: string, newFaceCount: number) => {
        if (!planogram || newFaceCount < 1) return;

        const current = await storePlanogramRepository.getById(planogram.id);
        if (!current) return;

        const updatedProducts = current.products.map(p =>
            p.id === productPlacementId
                ? { ...p, faceCount: newFaceCount, isAutoGenerated: false }
                : p
        );

        const recalculated = recalculatePositions(updatedProducts, products);

        const updated = {
            ...current,
            products: recalculated,
            updatedAt: new Date().toISOString()
        };

        await onUpdate(updated);
    };

    // 商品削除
    const handleRemoveProduct = async (productPlacementId: string) => {
        if (!planogram) return;

        const current = await storePlanogramRepository.getById(planogram.id);
        if (!current) return;

        const updatedProducts = current.products.filter(p => p.id !== productPlacementId);
        const recalculated = recalculatePositions(updatedProducts, products);

        const updated = {
            ...current,
            products: recalculated,
            updatedAt: new Date().toISOString()
        };

        await onUpdate(updated);
    };

    // 位置再計算（左詰め）
    const recalculatePositions = (placements: StorePlanogramProduct[], productMaster: Product[]) => {
        const result: StorePlanogramProduct[] = [];
        const shelfIndices = [...new Set(placements.map(p => p.shelfIndex))].sort();

        for (const shelfIndex of shelfIndices) {
            const shelfProducts = placements.filter(p => p.shelfIndex === shelfIndex);
            let posX = 0;

            for (const sp of shelfProducts) {
                const product = productMaster.find(p => p.id === sp.productId);
                result.push({
                    ...sp,
                    positionX: posX
                });
                posX += product ? product.width * sp.faceCount : 0;
            }
        }
        return result;
    };

    // 使用幅計算
    const usedWidthByShelf: Record<number, number> = {};
    if (planogram) {
        for (const pp of planogram.products) {
            const product = products.find(p => p.id === pp.productId);
            if (!product) continue;
            usedWidthByShelf[pp.shelfIndex] = (usedWidthByShelf[pp.shelfIndex] || 0) + product.width * pp.faceCount;
        }
    }

    if (!planogram) {
        return (
            <div className="card text-center text-muted mb-lg" style={{ padding: '2rem' }}>
                <h4 className="text-lg font-bold text-foreground mb-md">{TYPE_LABELS[fixtureType]}</h4>
                <div className="mb-md">この種類の棚割はまだ作成されていません</div>
                {standardPlanogram ? (
                    <div>
                        <div className="text-sm text-muted mb-md">
                            標準棚割: {standardPlanogram.name} (幅: <UnitDisplay valueCm={standardPlanogram.width} />)
                        </div>
                        <button
                            className="btn btn-primary"
                            disabled={loading}
                            onClick={async () => {
                                if (!confirm('標準棚割を基に、この種類の棚割を自動生成しますか？')) return;
                                setLoading(true);
                                try {
                                    const result = await generateStorePlanogram(store.id, standardPlanogram);
                                    if (result.status === 'error') {
                                        alert(`生成エラー: ${result.message}`);
                                    } else {
                                        // 親コンポーネントでリロードが必要だが、ここでは簡易的にリロードを促すか、コールバックで通知
                                        // 今回はwindow.location.reload()で簡易対応するか、親からrefreshを受け取る
                                        // 設計上、親からrefreshを受け取るのが正しいが、今回は簡便のため親のリロードを期待する
                                        // NOTE: 本来は親のloadDataを呼ぶべき
                                        window.location.reload();
                                    }
                                } catch (e) {
                                    alert('予期せぬエラーが発生しました');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        >
                            ✨ 自動棚割提案を作成
                        </button>
                    </div>
                ) : (
                    <div className="text-sm text-danger">対応する標準棚割が見つかりません</div>
                )}
            </div>
        );
    }

    return (
        <div className="card mb-lg animate-fadeIn">
            <div className="card-header">
                <div className="flex items-center justify-between w-full">
                    <div>
                        <h3 className="card-title">{TYPE_LABELS[fixtureType]}</h3>
                        <div className="text-sm text-muted">
                            幅: <UnitDisplay valueCm={planogram.width} /> / {planogram.shelfCount}段
                        </div>
                    </div>
                    <div className="flex gap-md items-center">
                        {planogram.status === 'warning' && <span className="badge badge-warning">警告あり</span>}
                        {planogram.status === 'generated' && <span className="badge badge-success">生成完了</span>}
                        {planogram.status === 'synced' && <span className="badge badge-primary">同期済み</span>}
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => onSync(planogram.id)}
                        >
                            🔄 同期
                        </button>
                    </div>
                </div>
            </div>

            {/* 警告表示 */}
            {planogram.warnings.length > 0 && (
                <div className="mb-md p-md rounded" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--color-warning)' }}>
                    <h4 style={{ color: 'var(--color-warning)', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>⚠️ 調整メッセージ</h4>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                        {planogram.warnings.map((warning, i) => (
                            <li key={i} className="text-sm">{warning}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div
                style={{
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    paddingLeft: '50px',
                    overflow: 'auto'
                }}
            >
                <div
                    className="shelf-grid"
                    style={{ width: `${planogram.width * SCALE}px`, position: 'relative' }}
                >
                    {/* 背景ブロック */}
                    {standardPlanogram && standardPlanogram.blocks.map(block => {
                        const masterBlock = blocks.find(b => b.id === block.blockId);
                        if (!masterBlock) return null;
                        return (
                            <div
                                key={block.id}
                                style={{
                                    position: 'absolute',
                                    left: `${block.positionX * SCALE}px`,
                                    top: 0,
                                    bottom: 0,
                                    width: `${masterBlock.width * SCALE}px`,
                                    border: '2px dashed rgba(203, 213, 225, 0.5)',
                                    borderTop: 'none',
                                    borderBottom: 'none',
                                    pointerEvents: 'none',
                                    zIndex: 0,
                                    display: 'flex',
                                    justifyContent: 'center'
                                }}
                            >
                                <div style={{
                                    marginTop: '-20px',
                                    background: 'rgba(255, 255, 255, 0.8)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {masterBlock.name}
                                </div>
                            </div>
                        );
                    })}

                    {Array.from({ length: planogram.shelfCount }).map((_, shelfIndex) => {
                        const shelfProducts = planogram.products.filter(p => p.shelfIndex === shelfIndex);
                        const usedWidth = usedWidthByShelf[shelfIndex] || 0;
                        const emptyWidth = planogram.width - usedWidth;

                        return (
                            <ShelfRowWithDrop
                                key={shelfIndex}
                                planogramId={planogram.id}
                                shelfIndex={shelfIndex}
                                heightPx={Math.max(70, (planogram.height / planogram.shelfCount) * SCALE)}
                            >
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
                                                background: analyticsMode && selectedMetric && selectedMetric !== 'sales' // sales以外
                                                    ? calculateHeatmapColor(product[selectedMetric] || 0, maxMetricValue)
                                                    : (analyticsMode && selectedMetric === 'sales'
                                                        ? calculateHeatmapColor(product.sales || 0, maxMetricValue)
                                                        : (sp.isAutoGenerated
                                                            ? 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))'
                                                            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(99, 102, 241, 0.2))')),
                                                border: analyticsMode && selectedMetric
                                                    ? '1px solid var(--border-color)'
                                                    : `1px solid ${sp.isAutoGenerated ? 'var(--border-color)' : 'var(--color-primary)'}`,
                                                borderRadius: 'var(--radius-sm)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '4px',
                                                fontSize: '0.65rem',
                                                overflow: 'hidden',
                                                cursor: 'pointer'
                                            }}
                                            title={`${product.name}\nクリックで編集`}
                                        >
                                            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                                {product.name}
                                            </div>
                                            <div className="flex gap-sm items-center mt-sm">
                                                <button
                                                    className="btn btn-sm"
                                                    style={{ padding: '0 4px', fontSize: '0.6rem', minWidth: '20px' }}
                                                    onClick={(e) => { e.stopPropagation(); handleFaceCountChange(sp.id, sp.faceCount - 1); }}
                                                >
                                                    -
                                                </button>
                                                <span>×{sp.faceCount}</span>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{ padding: '0 4px', fontSize: '0.6rem', minWidth: '20px' }}
                                                    onClick={(e) => { e.stopPropagation(); handleFaceCountChange(sp.id, sp.faceCount + 1); }}
                                                >
                                                    +
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    style={{ padding: '0 4px', fontSize: '0.6rem', minWidth: '20px' }}
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveProduct(sp.id); }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            {analyticsMode && selectedMetric && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        top: '2px',
                                                        right: '2px',
                                                        background: 'rgba(0,0,0,0.7)',
                                                        color: 'white',
                                                        padding: '1px 4px',
                                                        borderRadius: '3px',
                                                        fontSize: '0.55rem',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {formatMetricValue(product[selectedMetric] || 0)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {emptyWidth > 0 && (
                                    <div
                                        className="shelf-empty"
                                        style={{
                                            position: 'absolute',
                                            right: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: `${emptyWidth * SCALE}px`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.7rem',
                                            color: 'var(--color-danger)'
                                        }}
                                    >
                                        空白 {emptyWidth}cm
                                    </div>
                                )}

                                <div
                                    style={{
                                        position: 'absolute',
                                        left: '-45px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)'
                                    }}
                                >
                                    {shelfIndex + 1}段
                                </div>
                            </ShelfRowWithDrop>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function StorePlanogramEditor() {
    const { storeId } = useParams<{ storeId: string }>();
    const [store, setStore] = useState<Store | null>(null);
    const [allStorePlanograms, setAllStorePlanograms] = useState<StorePlanogram[]>([]);
    const [allStandardPlanograms, setAllStandardPlanograms] = useState<StandardPlanogram[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [blocks, setBlocks] = useState<ShelfBlock[]>([]);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [placements, setPlacements] = useState<StoreFixturePlacement[]>([]);

    // 選択されたグループ
    const [selectedGroup, setSelectedGroup] = useState<FixtureGroup>('multi-tier');

    // 集計幅
    const [multiTierTotalWidth, setMultiTierTotalWidth] = useState(0);
    const [flatTotalWidth, setFlatTotalWidth] = useState(0);

    const [loading, setLoading] = useState(true);

    // DND・商品パレット関連
    const [activeProduct, setActiveProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current?.type === 'palette-product') {
            setActiveProduct(active.data.current.product as Product);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveProduct(null);
        const { active, over } = event;
        if (!over) return;

        const product = active.data.current?.product as Product;
        const overId = String(over.id);

        if (!product || !overId.startsWith('shelf-')) return;

        const remaining = overId.slice('shelf-'.length);
        const lastDashIndex = remaining.lastIndexOf('-');
        const planogramId = remaining.slice(0, lastDashIndex);
        const shelfIndex = parseInt(remaining.slice(lastDashIndex + 1), 10);

        const targetPlanogram = await storePlanogramRepository.getById(planogramId);
        if (!targetPlanogram) return;

        const existingPlacements = targetPlanogram.products
            .filter(p => p.shelfIndex === shelfIndex)
            .sort((a, b) => a.positionX - b.positionX);

        const usedWidth = existingPlacements.reduce((sum, p) => {
            const prod = products.find(pr => pr.id === p.productId);
            return sum + (prod ? prod.width * p.faceCount : 0);
        }, 0);

        if (usedWidth + product.width > targetPlanogram.width) {
            alert(`この段にはスペースがありません (残り: ${targetPlanogram.width - usedWidth}cm, 商品: ${product.width}cm)`);
            return;
        }

        let updatedProducts = [...targetPlanogram.products];

        const lastPlacement = existingPlacements[existingPlacements.length - 1];
        if (lastPlacement && lastPlacement.productId === product.id) {
            // フェイス追加
            updatedProducts = updatedProducts.map(p =>
                p.id === lastPlacement.id ? { ...p, faceCount: p.faceCount + 1, isAutoGenerated: false } : p
            );
        } else {
            // 新規配置
            const newPlacement: StorePlanogramProduct = {
                id: crypto.randomUUID(),
                productId: product.id,
                shelfIndex,
                positionX: usedWidth, // 仮設定、後で再計算
                faceCount: 1,
                isAutoGenerated: false,
                isCut: false
            };
            updatedProducts.push(newPlacement);
        }

        // 位置再計算（左詰め）
        const recalculatePositions = (placements: StorePlanogramProduct[], productMaster: Product[]) => {
            const result: StorePlanogramProduct[] = [];
            const shelfIndices = [...new Set(placements.map(p => p.shelfIndex))].sort();

            for (const sIdx of shelfIndices) {
                const shelfProds = placements.filter(p => p.shelfIndex === sIdx).sort((a, b) => a.positionX - b.positionX);
                let posX = 0;
                for (const sp of shelfProds) {
                    const prod = productMaster.find(p => p.id === sp.productId);
                    result.push({
                        ...sp,
                        positionX: posX
                    });
                    posX += prod ? prod.width * sp.faceCount : 0;
                }
            }
            return result;
        };

        const recalculated = recalculatePositions(updatedProducts, products);

        const updated = {
            ...targetPlanogram,
            products: recalculated,
            updatedAt: new Date().toISOString()
        };

        await handleUpdatePlanogram(updated);
    };

    // フィルター済み商品
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 分析モード（共通）
    const [analyticsMode, setAnalyticsMode] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<'sales' | 'grossProfit' | 'quantity' | 'traffic'>('sales');

    // メトリクスの最大値を計算
    const maxMetricValue = analyticsMode && selectedMetric ? Math.max(
        ...products.map(p => p[selectedMetric] || 0),
        1
    ) : 1;

    const loadData = useCallback(async () => {
        if (!storeId) return;
        setLoading(true);

        const [storeData, planogramsData, productsData, standardsData, placementsData, fixturesData, blocksData] = await Promise.all([
            storeRepository.getById(storeId),
            storePlanogramRepository.query(p => p.storeId === storeId),
            productRepository.getAll(),
            standardPlanogramRepository.getAll(),
            storeFixturePlacementRepository.query(p => p.storeId === storeId),
            fixtureRepository.getAll(),
            shelfBlockRepository.getAll()
        ]);

        setStore(storeData);
        setAllStorePlanograms(planogramsData);
        setProducts(productsData);
        setAllStandardPlanograms(standardsData);
        setBlocks(blocksData);
        setFixtures(fixturesData);
        setPlacements(placementsData);

        // 幅集計
        let multiW = 0;
        let flatW = 0;

        for (const placement of placementsData) {
            const fixture = fixturesData.find(f => f.id === placement.fixtureId);
            if (!fixture || !fixture.fixtureType) continue;

            if (FIXTURE_GROUPS['multi-tier'].types.includes(fixture.fixtureType)) {
                multiW += fixture.width;
            } else if (FIXTURE_GROUPS['flat'].types.includes(fixture.fixtureType)) {
                flatW += fixture.width;
            }
        }

        setMultiTierTotalWidth(multiW);
        setFlatTotalWidth(flatW);
        setLoading(false);
    }, [storeId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSync = async (planogramId: string) => {
        if (!confirm('標準棚割から最新状態に同期しますか？現在の個店編集は上書きされます。')) return;
        try {
            await syncStorePlanogram(planogramId);
            await loadData();
        } catch {
            alert('同期中にエラーが発生しました');
        }
    };

    const handleUpdatePlanogram = async (updated: StorePlanogram) => {
        await storePlanogramRepository.update(updated.id, updated);
        // ローカルstate反映
        setAllStorePlanograms(prev => prev.map(p => p.id === updated.id ? updated : p));
    };

    if (loading) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header"><h1 className="page-title">個店棚割詳細</h1></div>
                <div className="text-center text-muted animate-pulse">読み込み中...</div>
            </div>
        );
    }

    if (!store) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header"><h1 className="page-title">個店棚割詳細</h1></div>
                <div className="card text-center text-muted">店舗が見つかりません</div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div className="flex items-center justify-between">
                    <div>
                        <Link to="/planogram/store" className="text-sm text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            ← 個店棚割管理に戻る
                        </Link>
                        <h1 className="page-title">{store.name}</h1>
                        <p className="page-subtitle">{store.code} / {store.fmt} / {store.region}</p>
                    </div>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 'var(--spacing-lg)', alignItems: 'start' }}>
                    {/* 左側：編集エリア */}
                    <div style={{ minWidth: 0 }}>
                        {/* グループ切り替え＆総幅表示 */}
                        <div className="flex border-b border-border mb-lg">
                            <button
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selectedGroup === 'multi-tier'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted hover:text-foreground'}`}
                                onClick={() => setSelectedGroup('multi-tier')}
                            >
                                {FIXTURE_GROUPS['multi-tier'].label} (幅: <UnitDisplay valueCm={multiTierTotalWidth} />)
                            </button>
                            <button
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selectedGroup === 'flat'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted hover:text-foreground'}`}
                                onClick={() => setSelectedGroup('flat')}
                            >
                                {FIXTURE_GROUPS['flat'].label} (幅: <UnitDisplay valueCm={flatTotalWidth} />)
                            </button>
                        </div>

                        {/* 分析モード設定 */}
                        <div className="card mb-lg">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
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
                            </div>
                        </div>

                        {/* 選択されたグループ内の什器タイプごとに棚割を表示 */}
                        {FIXTURE_GROUPS[selectedGroup].types.map(fixtureType => {
                            // このタイプに対応する個店棚割を探す
                            // 1. まず個店棚割の中に standardPlanogram -> fixtureType が一致するものがあるか
                            const planogram = allStorePlanograms.find(sp => {
                                const std = allStandardPlanograms.find(s => s.id === sp.standardPlanogramId);
                                return (std?.fixtureType || 'multi-tier') === fixtureType;
                            }) || null;

                            // 2. なければ、標準棚割の中に FMTとtype が一致するものがあるか（作成提案用）
                            const standardPlanogram = planogram
                                ? allStandardPlanograms.find(s => s.id === planogram.standardPlanogramId) || null
                                : allStandardPlanograms.find(s => s.fmt === store.fmt && (s.fixtureType || 'multi-tier') === fixtureType) || null;

                            // フラットモードなどで、標準棚割も個店棚割も存在しないタイプは表示しない（ノイズ削減）
                            // ただし、多段・平台の少なくとも1つは出したい、あるいは全てのタイプを出すべきか？
                            // 要件：多段と平台で分けて表示。
                            // データがないタイプを表示し続けると縦に長くなるが、
                            // 「平台」タブなら「平台冷蔵」「平台冷凍」などは全て出しておいた方が親切かもしれない。
                            // とりあえず全て表示する方針。

                            return (
                                <SinglePlanogramView
                                    key={fixtureType}
                                    store={store}
                                    planogram={planogram}
                                    standardPlanogram={standardPlanogram}
                                    fixtureType={fixtureType}
                                    products={products}
                                    blocks={blocks}
                                    maxMetricValue={maxMetricValue}
                                    analyticsMode={analyticsMode}
                                    selectedMetric={selectedMetric}
                                    onSync={handleSync}
                                    onUpdate={handleUpdatePlanogram}
                                />
                            );
                        })}

                        {/* 売り場レイアウト表示 */}
                        <div className="mt-lg">
                            <StoreLayoutVisualizer
                                store={store}
                                placements={placements}
                                fixtures={fixtures}
                                blocks={blocks}
                                planogramBlocks={
                                    allStorePlanograms
                                        .map(sp => {
                                            const std = allStandardPlanograms.find(s => s.id === sp.standardPlanogramId);
                                            const group = std?.fixtureType && FIXTURE_GROUPS['flat'].types.includes(std.fixtureType) ? 'flat' : 'multi-tier';
                                            if (group !== selectedGroup) return null;
                                            return std?.blocks || [];
                                        })
                                        .filter(Boolean)
                                        .flat() as any
                                }
                                scale={0.6}
                                products={products}
                            />
                        </div>
                    </div> {/* --- 左側 終了 --- */}

                    {/* 右側：商品パレット */}
                    <div className="card sticky-panel" style={{ position: 'sticky', top: '20px', height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
                        <h3 className="card-title mb-md" style={{ fontSize: '1.1rem' }}>📦 商品一覧</h3>
                        <div className="mb-md">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="商品名・カテゴリで検索..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', margin: '-0.5rem', padding: '0.5rem' }}>
                            {filteredProducts.map(product => (
                                <DraggableProduct key={product.id} product={product} />
                            ))}
                            {filteredProducts.length === 0 && (
                                <div className="text-sm text-muted text-center py-md">見つかりません</div>
                            )}
                        </div>
                    </div>
                </div> {/* layout grid end */}

                {/* ドラッグ中のオーバーレイ表示 */}
                <DragOverlay dropAnimation={null}>
                    {activeProduct ? (
                        <div style={{ opacity: 0.9, transform: 'scale(1.05)', pointerEvents: 'none' }}>
                            <DraggableProduct product={activeProduct} />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
