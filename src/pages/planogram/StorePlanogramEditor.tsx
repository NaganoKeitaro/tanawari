// 棚割管理システム - 個店棚割詳細編集
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
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

const SCALE = 3;

const PLANOGRAM_TYPES: { id: FixtureType; label: string }[] = [
    { id: 'multi-tier', label: '多段' },
    { id: 'flat-refrigerated', label: '平台冷蔵' },
    { id: 'end-cap-refrigerated', label: '平台冷蔵エンド' },
    { id: 'flat-frozen', label: '平台冷凍' },
    { id: 'end-cap-frozen', label: '平台冷凍エンド' },
];

export function StorePlanogramEditor() {
    const { storeId } = useParams<{ storeId: string }>();
    const [store, setStore] = useState<Store | null>(null);
    const [planogram, setPlanogram] = useState<StorePlanogram | null>(null);
    const [standardPlanogram, setStandardPlanogram] = useState<StandardPlanogram | null>(null);
    const [products, setProducts] = useState<Product[]>([]);

    const [allStorePlanograms, setAllStorePlanograms] = useState<StorePlanogram[]>([]);
    const [allStandardPlanograms, setAllStandardPlanograms] = useState<StandardPlanogram[]>([]);



    const [selectedFixtureType, setSelectedFixtureType] = useState<FixtureType>('multi-tier');
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    // 分析モード
    const [analyticsMode, setAnalyticsMode] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<'sales' | 'grossProfit' | 'quantity' | 'traffic'>('sales');

    // メトリクスの最大値を計算(ヒートマップ用)
    const maxMetricValue = analyticsMode && selectedMetric ? Math.max(
        ...products.map(p => p[selectedMetric] || 0),
        1
    ) : 1;

    // メトリクス値をフォーマット (Deprecated: Using shared util)
    // const formatMetricValue ...

    const [blocks, setBlocks] = useState<ShelfBlock[]>([]);
    const [storeTotalWidth, setStoreTotalWidth] = useState(0);
    const [maxShelfCount, setMaxShelfCount] = useState(0);

    // データ読み込み
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
        setProducts(productsData);
        setAllStorePlanograms(planogramsData);
        setAllStandardPlanograms(standardsData);
        setBlocks(blocksData);

        // 店舗の総棚幅と最大段数を計算
        let totalWidth = 0;
        let currentMaxShelf = 0;

        for (const placement of placementsData) {
            const fixture = fixturesData.find(f => f.id === placement.fixtureId);
            // 選択中の什器タイプに合致するもののみ計算
            if (fixture && fixture.fixtureType === selectedFixtureType) {
                totalWidth += fixture.width;
                currentMaxShelf = Math.max(currentMaxShelf, fixture.shelfCount);
            }
        }

        setStoreTotalWidth(totalWidth);
        setMaxShelfCount(currentMaxShelf || 0);

        // placements/fixturesもstateに保持しておく（今回は使用しないため削除）
        // setStorePlacements(placementsData);
        // setFixtures(fixturesData);

        setLoading(false);
    }, [storeId, selectedFixtureType]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // 選択された什器タイプに基づいて表示する棚割を切り替え
    useEffect(() => {
        if (allStorePlanograms.length === 0 || allStandardPlanograms.length === 0) {
            setPlanogram(null);
            setStandardPlanogram(null);
            return;
        }

        // 現在のタブに対応する標準棚割を探す
        // StorePlanogram -> StandardPlanogram -> fixtureType
        const targetPlanogram = allStorePlanograms.find(sp => {
            const std = allStandardPlanograms.find(s => s.id === sp.standardPlanogramId);
            // 標準棚割のfixtureTypeがない場合は、multi-tierとみなすなど互換性対応
            const type = std?.fixtureType || 'multi-tier';
            return type === selectedFixtureType;
        });

        if (targetPlanogram) {
            setPlanogram(targetPlanogram);
            const std = allStandardPlanograms.find(s => s.id === targetPlanogram.standardPlanogramId);
            setStandardPlanogram(std || null);
        } else {
            setPlanogram(null);
            // 個店棚割がない場合でも、該当する標準棚割を探してセットする（提案用）
            if (store) {
                const std = allStandardPlanograms.find(s =>
                    s.fmt === store.fmt &&
                    s.fixtureType === selectedFixtureType
                );
                setStandardPlanogram(std || null);
            } else {
                setStandardPlanogram(null);
            }
        }
    }, [selectedFixtureType, allStorePlanograms, allStandardPlanograms]);

    // 同期処理（ルールC）
    const handleSync = async () => {
        if (!planogram) return;

        if (!confirm('標準棚割から最新状態に同期しますか？現在の個店編集は上書きされます。')) {
            return;
        }

        setSyncing(true);

        try {
            await syncStorePlanogram(planogram.id);
            await loadData();
        } catch {
            alert('同期中にエラーが発生しました');
        }

        setSyncing(false);
    };

    // フェイス数変更
    const handleFaceCountChange = async (productPlacementId: string, newFaceCount: number) => {
        if (!planogram || newFaceCount < 1) return;

        const updatedProducts = planogram.products.map(p =>
            p.id === productPlacementId
                ? { ...p, faceCount: newFaceCount, isAutoGenerated: false }
                : p
        );

        // 位置を再計算
        const recalculated = recalculatePositions(updatedProducts, products);

        const updated = {
            ...planogram,
            products: recalculated,
            updatedAt: new Date().toISOString()
        };

        await storePlanogramRepository.update(planogram.id, updated);
        setPlanogram(updated);
    };

    // 商品削除
    const handleRemoveProduct = async (productPlacementId: string) => {
        if (!planogram) return;

        const updatedProducts = planogram.products.filter(p => p.id !== productPlacementId);
        const recalculated = recalculatePositions(updatedProducts, products);

        const updated = {
            ...planogram,
            products: recalculated,
            updatedAt: new Date().toISOString()
        };

        await storePlanogramRepository.update(planogram.id, updated);
        setPlanogram(updated);
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

    if (loading) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header">
                    <h1 className="page-title">個店棚割詳細</h1>
                </div>
                <div className="text-center text-muted animate-pulse">読み込み中...</div>
            </div>
        );
    }

    if (!store) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header">
                    <h1 className="page-title">個店棚割詳細</h1>
                </div>
                <div className="card text-center text-muted">
                    店舗が見つかりません
                    <div className="mt-md">
                        <Link to="/planogram/store" className="btn btn-primary">
                            一覧に戻る
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // 使用幅計算
    const usedWidthByShelf: Record<number, number> = {};
    if (planogram) {
        for (const pp of planogram.products) {
            const product = products.find(p => p.id === pp.productId);
            if (!product) continue;
            usedWidthByShelf[pp.shelfIndex] = (usedWidthByShelf[pp.shelfIndex] || 0) + product.width * pp.faceCount;
        }
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
                    {planogram && (
                        <div className="flex gap-md items-center">
                            {planogram.status === 'warning' && (
                                <span className="badge badge-warning">警告あり</span>
                            )}
                            {planogram.status === 'generated' && (
                                <span className="badge badge-success">生成完了</span>
                            )}
                            {planogram.status === 'synced' && (
                                <span className="badge badge-primary">同期済み</span>
                            )}
                            <button
                                className="btn btn-primary"
                                onClick={handleSync}
                                disabled={syncing}
                            >
                                {syncing ? '同期中...' : '🔄 標準棚割と同期'}
                            </button>
                        </div>
                    )}
                </div>
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
                        onClick={() => setSelectedFixtureType(type.id)}
                    >
                        {type.label}
                    </button>
                ))}
            </div>

            {!planogram && (
                <div className="card text-center text-muted" style={{ padding: '3rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                    <h3 className="text-xl font-bold text-foreground mb-md">この店舗の棚割はまだ作成されていません</h3>

                    {standardPlanogram ? (
                        <div className="max-w-md mx-auto">
                            <p className="mb-lg">
                                以下の標準棚割を基に、店舗の棚幅に合わせて最適化された棚割を提案します。
                            </p>

                            <div className="bg-secondary p-md rounded text-left mb-lg border border-border">
                                <div className="mb-sm">
                                    <span className="text-muted text-sm block">基準 (標準棚割)</span>
                                    <div className="font-bold">{standardPlanogram.name}</div>
                                    <div className="text-sm">FMT: {standardPlanogram.fmt} / 幅: <UnitDisplay valueCm={standardPlanogram.width} /></div>
                                </div>
                                <div className="border-t border-border my-sm"></div>
                                <div>
                                    <span className="text-muted text-sm block">適用先 (この店舗)</span>
                                    <div className="font-bold">{store.name}</div>
                                    <div className="text-sm">幅: <UnitDisplay valueCm={storeTotalWidth} /> / {store.region}</div>
                                </div>
                            </div>

                            <button
                                className="btn btn-primary btn-lg w-full shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                                onClick={async () => {
                                    if (!confirm('標準棚割を基に、この店舗用の棚割を自動生成しますか？\n（店舗の棚サイズに合わせて自動的にカット・拡張が行われます）')) return;

                                    setLoading(true);
                                    try {
                                        const result = await generateStorePlanogram(store.id, standardPlanogram);
                                        if (result.status === 'error') {
                                            alert(`生成エラー: ${result.message}`);
                                        } else {
                                            // 成功したらリロード
                                            await loadData();
                                            if (result.message) {
                                                // 警告等あれば表示（リロード後なのでalertで簡易表示、本来は通知トーストなどが良い）
                                                console.log(result.message);
                                            }
                                        }
                                    } catch (e) {
                                        alert('予期せぬエラーが発生しました');
                                        console.error(e);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            >
                                ✨ 自動棚割提案を作成
                            </button>
                            <p className="text-xs text-muted mt-sm">
                                店舗の棚サイズに合わせて自動的にカット・拡張を行います
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-danger mb-md">
                                このFMT・什器タイプに対応する標準棚割が見つかりませんでした。
                            </p>
                            <Link to="/planogram/store" className="btn btn-secondary">
                                一覧に戻る
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {planogram && (
                <>
                    {/* 棚割情報 */}
                    <div className="card mb-lg">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                            <div>
                                <div className="text-sm text-muted">棚幅</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                    <UnitDisplay valueCm={planogram.width} />
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted">棚高さ</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                    <UnitDisplay valueCm={planogram.height} />
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted">段数</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                    {planogram.shelfCount}段
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted">配置商品数</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                    {planogram.products.length}
                                </div>
                            </div>
                        </div>

                        {standardPlanogram && (
                            <div className="text-sm text-muted mt-md">
                                親: {standardPlanogram.name} (幅 <UnitDisplay valueCm={standardPlanogram.width} />)
                                {planogram.width < standardPlanogram.width && (
                                    <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>カット適用</span>
                                )}
                                {planogram.width > standardPlanogram.width && (
                                    <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>拡張適用</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 警告表示 */}
                    {planogram.warnings.length > 0 && (
                        <div className="card mb-lg" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
                            <h4 style={{ color: 'var(--color-warning)' }}>⚠️ 調整メッセージ</h4>
                            <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                                {planogram.warnings.map((warning, i) => (
                                    <li key={i} className="text-sm">{warning}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* 棚ビジュアル */}
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">棚割ビジュアル</h3>
                                <div className="text-sm text-muted">
                                    商品をクリックして編集 / 空白は赤で表示
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
                            </div>
                        </div>

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
                                {/* 背景：標準棚割のブロック表示 */}
                                {standardPlanogram && standardPlanogram.blocks.map(block => {
                                    const masterBlock = blocks.find(b => b.id === block.blockId);
                                    if (!masterBlock) return null;

                                    // 標準棚割上の位置を表示（現在の棚幅に合わせてクリップ等はしていないが、目安として表示）
                                    // ただし、個店棚割の幅を超えている場合ははみ出す可能性があるため、overflow: hiddenは親側で効いているはず

                                    return (
                                        <div
                                            key={block.id}
                                            style={{
                                                position: 'absolute',
                                                left: `${block.positionX * SCALE}px`,
                                                top: 0,
                                                bottom: 0,
                                                width: `${masterBlock.width * SCALE}px`,
                                                border: '2px dashed rgba(203, 213, 225, 0.5)', // 薄い破線
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

                                {Array.from({ length: Math.max(planogram.shelfCount, maxShelfCount || 0) }).map((_, shelfIndex) => {
                                    const shelfProducts = planogram.products.filter(p => p.shelfIndex === shelfIndex);
                                    const usedWidth = usedWidthByShelf[shelfIndex] || 0;
                                    const emptyWidth = planogram.width - usedWidth;

                                    return (
                                        <div
                                            key={shelfIndex}
                                            className="shelf-row"
                                            style={{
                                                height: `${Math.max(70, (planogram.height / planogram.shelfCount) * SCALE)}px`,
                                                position: 'relative'
                                            }}
                                        >
                                            {/* 配置商品 */}
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
                                                            background: analyticsMode && selectedMetric
                                                                ? calculateHeatmapColor(product[selectedMetric] || 0, maxMetricValue)
                                                                : (sp.isAutoGenerated
                                                                    ? 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))'
                                                                    : 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(99, 102, 241, 0.2))'),
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
                                                        title={`${product.name} (Rank: ${product.salesRank})\nクリックで編集`}
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
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.55rem' }}>
                                                            {analyticsMode && selectedMetric ? (
                                                                <span style={{ fontWeight: 600 }}>{selectedMetric}: {formatMetricValue(product[selectedMetric] || 0)}</span>
                                                            ) : (
                                                                <span>Rank: {product.salesRank}</span>
                                                            )}
                                                        </div>

                                                        {/* 分析モード: メトリクスバッジ */}
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

                                            {/* 空白スペース */}
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

                                            {/* 段番号 */}
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
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* 商品一覧 */}
                    <div className="card mt-lg">
                        <div className="card-header">
                            <h3 className="card-title">配置商品一覧</h3>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>段</th>
                                        <th>商品名</th>
                                        <th>売上ランク</th>
                                        <th>サイズ</th>
                                        <th>フェイス</th>
                                        <th>使用幅</th>
                                        <th>自動生成</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {planogram.products.map(sp => {
                                        const product = products.find(p => p.id === sp.productId);
                                        if (!product) return null;
                                        return (
                                            <tr key={sp.id}>
                                                <td>{sp.shelfIndex + 1}段</td>
                                                <td>{product.name}</td>
                                                <td>
                                                    <span
                                                        className="badge"
                                                        style={{
                                                            backgroundColor: product.salesRank <= 10 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                            color: product.salesRank <= 10 ? 'var(--color-success)' : 'var(--color-warning)'
                                                        }}
                                                    >
                                                        {product.salesRank}
                                                    </span>
                                                </td>
                                                <td className="text-sm text-muted">
                                                    {product.width} × {product.height}cm
                                                </td>
                                                <td>×{sp.faceCount}</td>
                                                <td className="text-sm">
                                                    <UnitDisplay valueCm={product.width * sp.faceCount} />
                                                </td>
                                                <td>
                                                    {sp.isAutoGenerated ? (
                                                        <span className="badge badge-primary">自動</span>
                                                    ) : (
                                                        <span className="badge badge-success">手動編集</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 最終更新 */}
                    <div className="text-sm text-muted mt-md text-right">
                        最終更新: {new Date(planogram.updatedAt).toLocaleString('ja-JP')}
                        {planogram.syncedAt && (
                            <span> / 最終同期: {new Date(planogram.syncedAt).toLocaleString('ja-JP')}</span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
