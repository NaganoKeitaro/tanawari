import { useState, useEffect, useMemo } from 'react';
import type {
    StandardPlanogram,
    StorePlanogram,
    Store,
    ShelfBlock,
    Product
} from '../data/types';
import {
    standardPlanogramRepository,
    storePlanogramRepository,
    storeRepository,
    shelfBlockRepository,
    productRepository
} from '../data/repositories/localStorageRepository';
import { PlanogramVisualizer } from '../components/planogram/PlanogramVisualizer';
import type { HeatmapLevel, HeatmapMetric } from '../utils/heatmapUtils';
import { UnitDisplay } from '../components/common/UnitDisplay';

export function Analytics() {
    const [loading, setLoading] = useState(true);

    // Data State
    const [products, setProducts] = useState<Product[]>([]);
    const [standardPlanograms, setStandardPlanograms] = useState<StandardPlanogram[]>([]);
    const [storePlanograms, setStorePlanograms] = useState<StorePlanogram[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [shelfBlocks, setShelfBlocks] = useState<ShelfBlock[]>([]);

    // Selection State
    const [scope, setScope] = useState<'standard' | 'store' | 'block'>('standard');
    const [selectedId, setSelectedId] = useState<string>('');

    // Analysis State
    const [metric, setMetric] = useState<HeatmapMetric>('sales');
    const [level, setLevel] = useState<HeatmapLevel>('jan');
    const [hierarchyField, setHierarchyField] = useState<keyof Product>('categoryName');

    // Load Initial Data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const [p, sp, stp, s, sb] = await Promise.all([
                productRepository.getAll(),
                standardPlanogramRepository.getAll(),
                storePlanogramRepository.getAll(),
                storeRepository.getAll(),
                shelfBlockRepository.getAll()
            ]);
            setProducts(p);
            setStandardPlanograms(sp);
            setStorePlanograms(stp);
            setStores(s);
            setShelfBlocks(sb);

            // Default selection
            if (sp.length > 0) {
                setSelectedId(sp[0].id);
            }
            setLoading(false);
        };
        loadData();
    }, []);

    // Helper: Convert ShelfBlock to StandardPlanogram-like object
    const blockToPlanogram = (block: ShelfBlock): StandardPlanogram => {
        return {
            id: block.id,
            fmt: 'BLOCK' as any, // Mock
            name: block.name,
            baseStoreId: '',
            width: block.width,
            height: block.height,
            shelfCount: block.shelfCount || 0,
            blocks: [], // No nested blocks in a block
            products: (block.productPlacements || []).map(pp => ({
                id: pp.id,
                productId: pp.productId,
                shelfIndex: pp.shelfIndex,
                positionX: pp.positionX,
                faceCount: pp.faceCount
            })),
            createdAt: block.createdAt,
            updatedAt: block.updatedAt
        };
    };

    // Selected Planogram Resolution
    const targetPlanogram = useMemo(() => {
        if (scope === 'standard') {
            return standardPlanograms.find(p => p.id === selectedId);
        } else if (scope === 'store') {
            return storePlanograms.find(p => p.id === selectedId);
        } else {
            const block = shelfBlocks.find(b => b.id === selectedId);
            return block ? blockToPlanogram(block) : undefined;
        }
    }, [scope, selectedId, standardPlanograms, storePlanograms, shelfBlocks]);

    // For Store Planogram: Resolve Parent Blocks for Visualization


    // Helper for Planogram Level Stats
    const planogramStats = useMemo(() => {
        if (!targetPlanogram) return null;

        let totalMetric = 0;
        targetPlanogram.products.forEach(pp => {
            const product = products.find(p => p.id === pp.productId);
            if (product) {
                totalMetric += (product[metric] || 0);
            }
        });

        return { totalMetric };
    }, [targetPlanogram, products, metric]);


    // Handle Store Block Overlay Hack
    // If scope is store, we fetch the parent planogram to inject 'blocks' into the visualizer props if needed?
    // Visualizer checks `if ('blocks' in planogram)`.
    // To support Block Level for Store, we can construct a "Hybrid" object for the visualizer.
    const visualizerPlanogram = useMemo(() => {
        if (scope === 'standard' || !targetPlanogram) return targetPlanogram;

        // If Store, try to attach parent blocks
        const storeP = targetPlanogram as StorePlanogram;
        const parent = standardPlanograms.find(sp => sp.id === storeP.standardPlanogramId);

        if (parent) {
            // Cast to any to inject blocks for visualization purposes
            return {
                ...storeP,
                blocks: parent.blocks // Borrow blocks from parent!
            } as any as StandardPlanogram;
        }
        return targetPlanogram;
    }, [targetPlanogram, scope, standardPlanograms]);


    if (loading) return <div className="p-lg text-center">読み込み中...</div>;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">詳細分析</h1>
                <p className="page-subtitle">棚割および棚ブロックのパフォーマンスを多角的に分析・評価します</p>
            </div>

            {/* Control Panel */}
            <div className="card mb-lg">
                <div className="flex flex-col gap-md">

                    {/* Row 1: Target Selection */}
                    <div className="flex gap-lg items-end flex-wrap">
                        <div className="form-group mb-0">
                            <label className="form-label">分析対象</label>
                            <div className="flex bg-secondary rounded p-1">
                                <button
                                    className={`btn btn-sm ${scope === 'standard' ? 'btn-white shadow-sm' : 'text-muted'}`}
                                    onClick={() => { setScope('standard'); setSelectedId(standardPlanograms[0]?.id || ''); }}
                                >
                                    標準棚割
                                </button>
                                <button
                                    className={`btn btn-sm ${scope === 'store' ? 'btn-white shadow-sm' : 'text-muted'}`}
                                    onClick={() => { setScope('store'); setSelectedId(storePlanograms[0]?.id || ''); }}
                                >
                                    個店棚割
                                </button>
                                <button
                                    className={`btn btn-sm ${scope === 'block' ? 'btn-white shadow-sm' : 'text-muted'}`}
                                    onClick={() => { setScope('block'); setSelectedId(shelfBlocks[0]?.id || ''); }}
                                >
                                    棚ブロック
                                </button>
                            </div>
                        </div>

                        <div className="form-group mb-0 flex-grow" style={{ maxWidth: '400px' }}>
                            <label className="form-label">棚割選択</label>
                            <select
                                className="form-select"
                                value={selectedId}
                                onChange={(e) => setSelectedId(e.target.value)}
                            >
                                {scope === 'standard' ? (
                                    standardPlanograms.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.fmt})</option>
                                    ))
                                ) : scope === 'store' ? (
                                    storePlanograms.map(p => {
                                        const store = stores.find(s => s.id === p.storeId);
                                        return (
                                            <option key={p.id} value={p.id}>{store?.name || 'Unknown'} - {store?.fmt}</option>
                                        );
                                    })
                                ) : (
                                    shelfBlocks.map(b => (
                                        <option key={b.id} value={b.id}>{b.name} (W:{b.width}cm)</option>
                                    ))
                                )}
                            </select>
                        </div>
                    </div>

                    <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

                    {/* Row 2: Analysis Settings */}
                    <div className="flex gap-lg items-end flex-wrap">
                        <div className="form-group mb-0">
                            <label className="form-label">ヒートマップ階層</label>
                            <div className="flex gap-sm">
                                {(['jan', 'hierarchy', 'block', 'planogram'] as const).map(l => (
                                    <button
                                        key={l}
                                        className={`btn ${level === l ? 'btn-primary' : 'btn-white border'}`}
                                        onClick={() => setLevel(l)}
                                    >
                                        {{
                                            jan: '単品 (JAN)',
                                            hierarchy: '商品カテゴリ',
                                            block: '棚ブロック',
                                            planogram: '棚割全体'
                                        }[l]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {level === 'hierarchy' && (
                            <div className="form-group mb-0 animate-fadeIn">
                                <label className="form-label">集計キー</label>
                                <select
                                    className="form-select"
                                    value={hierarchyField}
                                    onChange={(e) => setHierarchyField(e.target.value as keyof Product)}
                                    style={{ minWidth: '150px' }}
                                >
                                    <option value="divisionName">事業部</option>
                                    <option value="divisionSubName">ディビジョン</option>
                                    <option value="lineName">ライン</option>
                                    <option value="departmentName">部門</option>
                                    <option value="categoryName">カテゴリ</option>
                                    <option value="subCategoryName">サブカテゴリ</option>
                                    <option value="segmentName">セグメント</option>
                                    <option value="subSegmentName">サブセグメント</option>
                                    <option value="category">旧カテゴリ(互換用)</option>
                                </select>
                            </div>
                        )}

                        <div className="form-group mb-0">
                            <label className="form-label">評価指標</label>
                            <select
                                className="form-select"
                                value={metric}
                                onChange={(e) => setMetric(e.target.value as HeatmapMetric)}
                                style={{ minWidth: '150px' }}
                            >
                                <option value="sales">売上金額</option>
                                <option value="grossProfit">粗利</option>
                                <option value="quantity">売上数量</option>
                                <option value="traffic">客数</option>
                                <option value="spendPerCustomer">客単価</option>
                            </select>
                        </div>
                    </div>

                </div>
            </div>

            {/* Main Content */}
            {targetPlanogram ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-lg">

                    {/* Visualizer (Left/Center) */}
                    <div className="lg:col-span-3">
                        <div className="card h-full">
                            <div className="card-header flex justify-between items-center">
                                <h3 className="card-title">{targetPlanogram instanceof Object && 'name' in targetPlanogram ? (targetPlanogram as any).name : '棚割詳細'}</h3>
                                <div className="text-sm text-muted">
                                    <UnitDisplay valueCm={targetPlanogram.width} /> × <UnitDisplay valueCm={targetPlanogram.height} />
                                </div>
                            </div>

                            <div className="overflow-auto bg-secondary p-md rounded" style={{ minHeight: '500px' }}>
                                {/* Planogram Level Overlay is handled inside PlanogramVisualizer */}

                                <PlanogramVisualizer
                                    planogram={visualizerPlanogram as StandardPlanogram}
                                    products={products}
                                    shelfBlocks={shelfBlocks}
                                    level={level}
                                    metric={metric}
                                    hierarchyField={hierarchyField}
                                    totalMetric={planogramStats?.totalMetric || 0}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Stats (Right) */}
                    <div className="lg:col-span-1 flex flex-col gap-md">
                        <div className="card">
                            <h3 className="card-title mb-md">分析サマリー</h3>

                            <div className="mb-md">
                                <div className="text-xs text-muted">選択中の指標</div>
                                <div className="text-lg font-bold capitalize">{metric}</div>
                            </div>

                            <div className="mb-md">
                                <div className="text-xs text-muted">商品数</div>
                                <div className="font-medium">{targetPlanogram.products.length} SKU</div>
                            </div>

                            {planogramStats && (
                                <div>
                                    <div className="text-xs text-muted">合計値</div>
                                    <div className="text-xl font-bold">{planogramStats.totalMetric.toLocaleString()}</div>
                                </div>
                            )}
                        </div>

                        <div className="card bg-tertiary">
                            <h4 className="card-title text-sm mb-sm">✨ ヒント</h4>
                            <p className="text-xs text-muted leading-relaxed">
                                <strong>カテゴリ分析:</strong> カテゴリごとの強弱を面で捉えます。<br /><br />
                                <strong>棚ブロック:</strong> 視線のゴールデンゾーンにあるブロックが高いパフォーマンスを出しているか確認しましょう。<br /><br />
                                <strong>個店分析:</strong> 標準棚割から乖離している店舗を発見できます。
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card p-xl text-center text-muted">
                    データがありません。棚割を選択してください。
                </div>
            )}
        </div>
    );
}
