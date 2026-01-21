// 棚割管理システム - ダッシュボード
import { useState, useEffect } from 'react';
import type { Product, Store } from '../data/types';
import { productRepository, storeRepository } from '../data/repositories/localStorageRepository';
import { KPICard } from '../components/dashboard/KPICard';
import { MetricsChart } from '../components/dashboard/MetricsChart';
import {
    aggregateMetrics,
    aggregateByCategory,
    aggregateByHierarchy,
    calculateProfitMargin
} from '../utils/aggregationUtils';

export function Dashboard() {
    const [products, setProducts] = useState<Product[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState<'all' | 'store'>('all');
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [metricType, setMetricType] = useState<'sales' | 'grossProfit' | 'quantity' | 'traffic'>('sales');

    // データ読み込み
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const [productsData, storesData] = await Promise.all([
                productRepository.getAll(),
                storeRepository.getAll()
            ]);
            setProducts(productsData);
            setStores(storesData);
            setLoading(false);
        };
        loadData();
    }, []);

    // スコープに応じた商品フィルタリング
    const filteredProducts = scope === 'all'
        ? products
        : products; // TODO: 個店別フィルタリングは棚割データと連携が必要

    // 集計データ
    const totalMetrics = aggregateMetrics(filteredProducts);
    const categoryMetrics = aggregateByCategory(filteredProducts);
    const hierarchyMetrics = aggregateByHierarchy(filteredProducts, 'category');
    const profitMargin = calculateProfitMargin(totalMetrics);

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">分析ダッシュボード</h1>
                <p className="page-subtitle">売上・粗利・客数などの主要指標を可視化</p>
            </div>

            {/* スコープ選択 */}
            <div className="card mb-lg">
                <div className="flex items-center gap-lg">
                    <div className="flex items-center gap-md">
                        <label className="flex items-center gap-sm">
                            <input
                                type="radio"
                                name="scope"
                                value="all"
                                checked={scope === 'all'}
                                onChange={(e) => setScope(e.target.value as 'all' | 'store')}
                            />
                            <span>全社</span>
                        </label>
                        <label className="flex items-center gap-sm">
                            <input
                                type="radio"
                                name="scope"
                                value="store"
                                checked={scope === 'store'}
                                onChange={(e) => setScope(e.target.value as 'all' | 'store')}
                            />
                            <span>個店</span>
                        </label>
                    </div>

                    {scope === 'store' && (
                        <select
                            className="form-select"
                            value={selectedStoreId}
                            onChange={(e) => setSelectedStoreId(e.target.value)}
                            style={{ width: '300px' }}
                        >
                            <option value="">店舗を選択...</option>
                            {stores.map(store => (
                                <option key={store.id} value={store.id}>
                                    {store.name} ({store.fmt})
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="text-center text-muted animate-pulse">読み込み中...</div>
            ) : (
                <>
                    {/* KPIカード */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: 'var(--spacing-lg)',
                        marginBottom: 'var(--spacing-lg)'
                    }}>
                        <KPICard
                            title="売上金額"
                            value={totalMetrics.sales}
                            unit="円"
                            icon="💰"
                            color="primary"
                            subtitle={`${totalMetrics.productCount}商品`}
                        />
                        <KPICard
                            title="粗利"
                            value={totalMetrics.grossProfit}
                            unit="円"
                            icon="📈"
                            color="success"
                            subtitle={`粗利率: ${profitMargin.toFixed(1)}%`}
                        />
                        <KPICard
                            title="客数"
                            value={totalMetrics.traffic}
                            unit="人"
                            icon="👥"
                            color="warning"
                        />
                        <KPICard
                            title="客単価"
                            value={totalMetrics.spendPerCustomer}
                            unit="円"
                            icon="🛒"
                            color="danger"
                        />
                    </div>

                    {/* メトリクス選択 */}
                    <div className="card mb-lg">
                        <div className="flex items-center gap-md">
                            <span className="text-sm text-muted">表示指標:</span>
                            <div className="btn-group">
                                <button
                                    className={`btn btn-sm ${metricType === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setMetricType('sales')}
                                >
                                    売上金額
                                </button>
                                <button
                                    className={`btn btn-sm ${metricType === 'grossProfit' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setMetricType('grossProfit')}
                                >
                                    粗利
                                </button>
                                <button
                                    className={`btn btn-sm ${metricType === 'quantity' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setMetricType('quantity')}
                                >
                                    売上数量
                                </button>
                                <button
                                    className={`btn btn-sm ${metricType === 'traffic' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setMetricType('traffic')}
                                >
                                    客数
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* チャート */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                        gap: 'var(--spacing-lg)',
                        marginBottom: 'var(--spacing-lg)'
                    }}>
                        <MetricsChart
                            data={categoryMetrics}
                            metric={metricType}
                            title={`カテゴリ別${metricType === 'sales' ? '売上' : metricType === 'grossProfit' ? '粗利' : metricType === 'quantity' ? '数量' : '客数'}`}
                            type="bar"
                        />
                        <MetricsChart
                            data={hierarchyMetrics}
                            metric={metricType}
                            title={`構成比(${metricType === 'sales' ? '売上' : metricType === 'grossProfit' ? '粗利' : metricType === 'quantity' ? '数量' : '客数'})`}
                            type="pie"
                        />
                    </div>

                    {/* 商品数表示 */}
                    <div className="text-sm text-muted">
                        対象商品数: {filteredProducts.length}件
                    </div>
                </>
            )}
        </div>
    );
}
