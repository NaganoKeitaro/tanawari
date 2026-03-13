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
} from '../../data/repositories/repositoryFactory';
import { syncStorePlanogram, generateStorePlanogram } from '../../services/automationService';
import { UnitDisplay } from '../../components/common/UnitDisplay';
import { calculateHeatmapColor, formatMetricValue } from '../../utils/heatmapUtils';
import { getProductColor, initProductColorMap } from '../../utils/productColorUtils';
import { ProductTooltip } from '../../components/common/ProductTooltip';
import type { Fixture, StoreFixturePlacement } from '../../data/types';

const SCALE = 0.3;

// ブロックオーバーレイ用カラーパレット
const BLOCK_OVERLAY_COLORS = [
    { bg: 'rgba(59, 130, 246, 0.35)', border: 'rgba(59, 130, 246, 0.7)', text: '#1e40af' },   // Blue
    { bg: 'rgba(16, 185, 129, 0.35)', border: 'rgba(16, 185, 129, 0.7)', text: '#065f46' },   // Emerald
    { bg: 'rgba(245, 158, 11, 0.35)', border: 'rgba(245, 158, 11, 0.7)', text: '#92400e' },   // Amber
    { bg: 'rgba(239, 68, 68, 0.35)', border: 'rgba(239, 68, 68, 0.7)', text: '#991b1b' },   // Red
    { bg: 'rgba(6, 182, 212, 0.35)', border: 'rgba(6, 182, 212, 0.7)', text: '#155e75' },   // Cyan
    { bg: 'rgba(168, 85, 247, 0.35)', border: 'rgba(168, 85, 247, 0.7)', text: '#6b21a8' },   // Purple
    { bg: 'rgba(236, 72, 153, 0.35)', border: 'rgba(236, 72, 153, 0.7)', text: '#9d174d' },   // Pink
    { bg: 'rgba(20, 184, 166, 0.35)', border: 'rgba(20, 184, 166, 0.7)', text: '#115e59' },   // Teal
];

function getBlockOverlayColor(index: number) {
    return BLOCK_OVERLAY_COLORS[index % BLOCK_OVERLAY_COLORS.length];
}

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
            title={`${product.name}\n${product.width}×${product.height}mm`}
        >
            <div className="flex items-center gap-sm">
                <img
                    src={product.imageUrl}
                    alt={product.name}
                    style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="product-card-name" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                    <div className="product-card-size" style={{ fontSize: '0.7rem' }}>{product.width}×{product.height}mm</div>
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
                backgroundColor: isOver ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
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
    allStandardPlanograms,
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
    allStandardPlanograms: StandardPlanogram[];
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
    const [selectedStdId, setSelectedStdId] = useState<string>(standardPlanogram?.id || '');

    // フェイス数変更
    const handleFaceCountChange = async (productPlacementId: string, newFaceCount: number) => {
        if (!planogram || newFaceCount < 1) return;

        const current = await storePlanogramRepository.getById(planogram.id);
        if (!current) return;

        // 幅オーバーフローチェック
        const targetPlacement = current.products.find(p => p.id === productPlacementId);
        if (targetPlacement && newFaceCount > targetPlacement.faceCount) {
            const product = products.find(p => p.id === targetPlacement.productId);
            if (product) {
                const shelfProducts = current.products.filter(p => p.shelfIndex === targetPlacement.shelfIndex);
                const currentShelfWidth = shelfProducts.reduce((sum, p) => {
                    const prod = products.find(pr => pr.id === p.productId);
                    return sum + (prod ? prod.width * p.faceCount : 0);
                }, 0);
                const additionalWidth = product.width * (newFaceCount - targetPlacement.faceCount);
                if (currentShelfWidth + additionalWidth > planogram.width) {
                    alert(`スペースが不足しています（残り: ${planogram.width - currentShelfWidth}mm）`);
                    return;
                }
            }
        }

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
        // 同FMT・同什器タイプの標準棚割一覧
        const matchingStandards = allStandardPlanograms.filter(
            s => s.fmt === store.fmt && (s.fixtureType || 'multi-tier') === fixtureType
        );
        const chosenStd = matchingStandards.find(s => s.id === selectedStdId) || matchingStandards[0] || null;

        return (
            <div className="card text-center text-muted mb-lg" style={{ padding: '2rem' }}>
                <h4 className="text-lg font-bold text-foreground mb-md">{TYPE_LABELS[fixtureType]}</h4>
                <div className="mb-md">この種類の棚割はまだ作成されていません</div>
                {matchingStandards.length > 1 ? (
                    <div>
                        <div className="form-group" style={{ margin: '0 auto 1rem', maxWidth: '400px' }}>
                            <label className="form-label">標準棚割を選択</label>
                            <select
                                className="form-select"
                                value={selectedStdId}
                                onChange={(e) => setSelectedStdId(e.target.value)}
                            >
                                {matchingStandards.map(s => {
                                    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '';
                                    const period = s.startDate || s.endDate ? ` (${formatDate(s.startDate)}〜${formatDate(s.endDate)})` : '';
                                    return (
                                        <option key={s.id} value={s.id}>
                                            {s.name}{period}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        {chosenStd && (
                            <div>
                                <div className="text-sm text-muted mb-md">
                                    標準棚割: {chosenStd.name} (幅: <UnitDisplay valueMm={chosenStd.width} />)
                                </div>
                                <button
                                    className="btn btn-primary"
                                    disabled={loading}
                                    onClick={async () => {
                                        if (!confirm('標準棚割を基に、この種類の棚割を自動生成しますか？')) return;
                                        setLoading(true);
                                        try {
                                            const result = await generateStorePlanogram(store.id, chosenStd);
                                            if (result.status === 'error') {
                                                alert(`生成エラー: ${result.message}`);
                                            } else {
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
                        )}
                    </div>
                ) : chosenStd ? (
                    <div>
                        <div className="text-sm text-muted mb-md">
                            標準棚割: {chosenStd.name} (幅: <UnitDisplay valueMm={chosenStd.width} />)
                        </div>
                        <button
                            className="btn btn-primary"
                            disabled={loading}
                            onClick={async () => {
                                if (!confirm('標準棚割を基に、この種類の棚割を自動生成しますか？')) return;
                                setLoading(true);
                                try {
                                    const result = await generateStorePlanogram(store.id, chosenStd);
                                    if (result.status === 'error') {
                                        alert(`生成エラー: ${result.message}`);
                                    } else {
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
                            幅: <UnitDisplay valueMm={planogram.width} /> / {planogram.shelfCount}段
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

                    {Array.from({ length: planogram.shelfCount }).map((_, i) => i).reverse().map((shelfIndex) => {
                        const shelfProducts = planogram.products.filter(p => p.shelfIndex === shelfIndex);
                        const usedWidth = usedWidthByShelf[shelfIndex] || 0;
                        const emptyWidth = planogram.width - usedWidth;

                        return (
                            <ShelfRowWithDrop
                                key={shelfIndex}
                                planogramId={planogram.id}
                                shelfIndex={shelfIndex}
                                heightPx={Math.max(90, (planogram.height / planogram.shelfCount) * SCALE)}
                            >
                                {shelfProducts.map(sp => {
                                    const product = products.find(p => p.id === sp.productId);
                                    if (!product) return null;
                                    const width = product.width * sp.faceCount * SCALE;

                                    return (
                                        <ProductTooltip key={sp.id} productName={product.name} jan={product.jan || '-'} faceCount={sp.faceCount} category={product.category}>
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    left: `${sp.positionX * SCALE}px`,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: `${width}px`,
                                                    background: analyticsMode && selectedMetric
                                                        ? calculateHeatmapColor(product[selectedMetric] || 0, maxMetricValue)
                                                        : getProductColor(product.category).bg,
                                                    border: analyticsMode && selectedMetric
                                                        ? '1px solid var(--border-color)'
                                                        : `1px solid ${getProductColor(product.category).border}`,
                                                    color: analyticsMode && selectedMetric
                                                        ? 'var(--text-primary)'
                                                        : getProductColor(product.category).text,
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
                                            >
                                                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', fontSize: '0.65rem' }}>
                                                    {product.name}
                                                </div>
                                                <div style={{ opacity: 0.8, fontSize: '0.5rem', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                                    {product.jan || '-'}
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
                                        </ProductTooltip>
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
                                        空白 {emptyWidth}mm
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
            alert(`この段にはスペースがありません (残り: ${targetPlanogram.width - usedWidth}mm, 商品: ${product.width}mm)`);
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
    const lowerSearch = searchTerm.toLowerCase();
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(lowerSearch) ||
        (p.category ?? '').toLowerCase().includes(lowerSearch)
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
        initProductColorMap(productsData.map(p => p.category));
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
                                {FIXTURE_GROUPS['multi-tier'].label} (幅: <UnitDisplay valueMm={multiTierTotalWidth} />)
                            </button>
                            <button
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selectedGroup === 'flat'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted hover:text-foreground'}`}
                                onClick={() => setSelectedGroup('flat')}
                            >
                                {FIXTURE_GROUPS['flat'].label} (幅: <UnitDisplay valueMm={flatTotalWidth} />)
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
                                    allStandardPlanograms={allStandardPlanograms}
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

                        {/* 売り場レイアウト表示（2Dグリッド） */}
                        <div className="mt-lg card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">{store.name} レイアウト</h3>
                                    <div className="text-sm text-muted">
                                        什器数: {placements.length}台 / 総幅: <UnitDisplay valueMm={placements.reduce((sum, p) => {
                                            const f = fixtures.find(fix => fix.id === p.fixtureId);
                                            return sum + (f?.width || 0);
                                        }, 0)} />
                                    </div>
                                </div>
                            </div>
                            <div style={{ overflow: 'auto', padding: '1rem', background: '#f8fafc', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
                                {(() => {
                                    const LAYOUT_SCALE = 0.15;
                                    const FIXTURE_BG: Record<string, string> = {
                                        'multi-tier': '#f0f0f0',
                                        'flat-refrigerated': '#e0f7fa',
                                        'flat-frozen': '#e3f2fd',
                                        'end-cap-refrigerated': '#b2ebf2',
                                        'end-cap-frozen': '#bbdefb',
                                        'gondola': '#fff8e1',
                                        'default': '#f1f5f9'
                                    };

                                    // 什器の寸法計算（StoreLayoutEditorと同じロジック）
                                    const getFixDims = (fixture: Fixture, direction: number = 0) => {
                                        const depth = fixture.fixtureType?.includes('end-cap') ? 600 : 900;
                                        const isRotated = direction === 90 || direction === 270;
                                        return {
                                            width: isRotated ? depth : fixture.width,
                                            height: isRotated ? fixture.width : depth,
                                        };
                                    };

                                    // ブロック→什器マッピング計算
                                    // 什器種別ごとに、配置順に並べた什器の累積幅と、標準棚割のブロック位置を対応させる
                                    type FixtureBlockOverlay = {
                                        blockName: string;
                                        colorIndex: number;
                                        relativeStartX: number; // 什器内の開始位置 (mm)
                                        relativeEndX: number;   // 什器内の終了位置 (mm)
                                        fixtureWidth: number;   // 什器幅 (mm)
                                        isOverflow: boolean;    // はみ出し
                                    };
                                    const fixtureBlockOverlays = new Map<string, FixtureBlockOverlay[]>();

                                    // 各什器タイプグループごとにブロックマッピングを生成
                                    for (const groupKey of Object.keys(FIXTURE_GROUPS) as FixtureGroup[]) {
                                        const groupTypes = FIXTURE_GROUPS[groupKey].types;

                                        // このグループに対応する標準棚割を探す
                                        for (const fType of groupTypes) {
                                            const storePlan = allStorePlanograms.find(sp => {
                                                const std = allStandardPlanograms.find(s => s.id === sp.standardPlanogramId);
                                                return (std?.fixtureType || 'multi-tier') === fType;
                                            });
                                            const stdPlan = storePlan
                                                ? allStandardPlanograms.find(s => s.id === storePlan.standardPlanogramId)
                                                : null;
                                            if (!stdPlan || !stdPlan.blocks.length) continue;

                                            // このタイプの什器配置を取得（order順）
                                            const typePlacements = placements
                                                .filter(p => {
                                                    const f = fixtures.find(fix => fix.id === p.fixtureId);
                                                    return f && (f.fixtureType || 'multi-tier') === fType;
                                                })
                                                .sort((a, b) => a.order - b.order);

                                            // 累積幅マップ
                                            const ranges: { placementId: string; startX: number; endX: number; width: number }[] = [];
                                            let cumX = 0;
                                            for (const tp of typePlacements) {
                                                const f = fixtures.find(fix => fix.id === tp.fixtureId);
                                                if (!f) continue;
                                                ranges.push({ placementId: tp.id, startX: cumX, endX: cumX + f.width, width: f.width });
                                                cumX += f.width;
                                            }

                                            // 各ブロックをどの什器に重なるか計算
                                            stdPlan.blocks.forEach((pb, blockIdx) => {
                                                const master = blocks.find(b => b.id === pb.blockId);
                                                if (!master) return;

                                                const blockStart = pb.positionX;
                                                const blockEnd = pb.positionX + master.width;

                                                for (const range of ranges) {
                                                    const overlapStart = Math.max(blockStart, range.startX);
                                                    const overlapEnd = Math.min(blockEnd, range.endX);

                                                    if (overlapStart < overlapEnd) {
                                                        const overlay: FixtureBlockOverlay = {
                                                            blockName: master.name,
                                                            colorIndex: blockIdx,
                                                            relativeStartX: overlapStart - range.startX,
                                                            relativeEndX: overlapEnd - range.startX,
                                                            fixtureWidth: range.width,
                                                            isOverflow: blockEnd > cumX
                                                        };
                                                        const existing = fixtureBlockOverlays.get(range.placementId) || [];
                                                        existing.push(overlay);
                                                        fixtureBlockOverlays.set(range.placementId, existing);
                                                    }
                                                }
                                            });
                                        }
                                    }

                                    // レイアウト範囲を計算
                                    let maxX = 0;
                                    let maxY = 0;
                                    for (const p of placements) {
                                        const f = fixtures.find(fix => fix.id === p.fixtureId);
                                        if (!f) continue;
                                        const { width, height } = getFixDims(f, p.direction || 0);
                                        maxX = Math.max(maxX, p.positionX + width);
                                        maxY = Math.max(maxY, p.positionY + height);
                                    }

                                    // 余白を追加
                                    maxX += 30;
                                    maxY += 30;

                                    if (placements.length === 0) {
                                        return (
                                            <div className="text-center text-muted" style={{ padding: '2rem' }}>
                                                什器が配置されていません
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            style={{
                                                width: `${maxX * LAYOUT_SCALE}px`,
                                                height: `${maxY * LAYOUT_SCALE}px`,
                                                position: 'relative',
                                                backgroundImage: `
                                                    linear-gradient(to right, rgba(148, 163, 184, 0.15) 1px, transparent 1px),
                                                    linear-gradient(to bottom, rgba(148, 163, 184, 0.15) 1px, transparent 1px)
                                                `,
                                                backgroundSize: `${5 * LAYOUT_SCALE}px ${5 * LAYOUT_SCALE}px`,
                                            }}
                                        >
                                            {placements.map(p => {
                                                const fixture = fixtures.find(f => f.id === p.fixtureId);
                                                if (!fixture) return null;

                                                const direction = p.direction || 0;
                                                const isRotated = direction === 90 || direction === 270;
                                                const { width: vw, height: vh } = getFixDims(fixture, direction);
                                                const bgColor = fixture.fixtureType
                                                    ? (FIXTURE_BG[fixture.fixtureType] || FIXTURE_BG['default'])
                                                    : FIXTURE_BG['default'];

                                                return (
                                                    <div
                                                        key={p.id}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${p.positionX * LAYOUT_SCALE}px`,
                                                            top: `${p.positionY * LAYOUT_SCALE}px`,
                                                            width: `${vw * LAYOUT_SCALE}px`,
                                                            height: `${vh * LAYOUT_SCALE}px`,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                background: bgColor,
                                                                border: '2px solid rgba(148, 163, 184, 0.6)',
                                                                borderRadius: '6px',
                                                                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexDirection: 'column',
                                                                overflow: 'hidden',
                                                                writingMode: isRotated ? 'vertical-rl' : 'horizontal-tb',
                                                                color: '#334155',
                                                                fontSize: `${Math.max(9, 10 * LAYOUT_SCALE)}px`,
                                                            }}
                                                        >
                                                            <span style={{ fontWeight: 600, pointerEvents: 'none', position: 'relative', zIndex: 2 }}>
                                                                {fixture.name.replace('（4尺）', '').replace('平台', '')}
                                                            </span>
                                                            <span style={{
                                                                fontSize: `${Math.max(7, 8 * LAYOUT_SCALE)}px`,
                                                                opacity: 0.8,
                                                                pointerEvents: 'none',
                                                                position: 'relative',
                                                                zIndex: 2
                                                            }}>
                                                                {Math.round(fixture.width / 300)}尺 / {fixture.shelfCount}段
                                                            </span>

                                                            {/* 段のストライプ表示 */}
                                                            {fixture.shelfCount > 1 && (
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: 0, left: 0,
                                                                    width: '100%', height: '100%',
                                                                    display: 'flex',
                                                                    flexDirection: isRotated ? 'row' : 'column',
                                                                    pointerEvents: 'none',
                                                                    zIndex: 1
                                                                }}>
                                                                    {Array.from({ length: fixture.shelfCount }).map((_, i) => (
                                                                        <div key={i} style={{
                                                                            flex: 1,
                                                                            borderBottom: !isRotated && i < fixture.shelfCount - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                                                                            borderRight: isRotated && i < fixture.shelfCount - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none'
                                                                        }} />
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* 棚ブロックオーバーレイ */}
                                                            {fixtureBlockOverlays.get(p.id)?.map((overlay, overlayIdx) => {
                                                                const color = getBlockOverlayColor(overlay.colorIndex);
                                                                const overlayWidthMm = overlay.relativeEndX - overlay.relativeStartX;
                                                                return (
                                                                    <div
                                                                        key={`block-${overlayIdx}`}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            left: `${overlay.relativeStartX * LAYOUT_SCALE}px`,
                                                                            top: 0,
                                                                            width: `${overlayWidthMm * LAYOUT_SCALE}px`,
                                                                            height: '100%',
                                                                            background: color.bg,
                                                                            border: `1.5px dashed ${color.border}`,
                                                                            borderRadius: '3px',
                                                                            pointerEvents: 'none',
                                                                            zIndex: 3,
                                                                            display: 'flex',
                                                                            alignItems: 'flex-end',
                                                                            justifyContent: 'center',
                                                                            overflow: 'hidden'
                                                                        }}
                                                                    >
                                                                        {/* ブロック名ラベル */}
                                                                        <div style={{
                                                                            fontSize: `${Math.max(7, 8 * LAYOUT_SCALE)}px`,
                                                                            fontWeight: 600,
                                                                            color: color.text,
                                                                            background: 'rgba(255,255,255,0.8)',
                                                                            padding: '1px 4px',
                                                                            borderRadius: '2px',
                                                                            whiteSpace: 'nowrap',
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis',
                                                                            maxWidth: '100%',
                                                                            marginBottom: '2px',
                                                                            lineHeight: 1.2
                                                                        }}>
                                                                            {overlay.blockName}
                                                                        </div>
                                                                        {/* はみ出し警告 */}
                                                                        {overlay.isOverflow && (
                                                                            <div style={{
                                                                                position: 'absolute',
                                                                                top: '2px',
                                                                                right: '2px',
                                                                                fontSize: `${Math.max(6, 7 * LAYOUT_SCALE)}px`,
                                                                                fontWeight: 700,
                                                                                color: '#dc2626',
                                                                                background: 'rgba(255,255,255,0.9)',
                                                                                padding: '0px 3px',
                                                                                borderRadius: '2px'
                                                                            }}>
                                                                                ⚠
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
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
