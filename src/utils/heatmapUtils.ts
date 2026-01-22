import type { Product } from '../data/types';

export type HeatmapMetric = 'sales' | 'grossProfit' | 'quantity' | 'traffic' | 'spendPerCustomer';
export type HeatmapLevel = 'jan' | 'hierarchy' | 'block' | 'planogram';

// カラーパレット定義
const COLORS = {
    high: 'rgba(239, 68, 68, 0.4)',   // Red
    midHigh: 'rgba(245, 158, 11, 0.4)', // Orange
    mid: 'rgba(234, 179, 8, 0.4)',    // Yellow
    midLow: 'rgba(34, 197, 94, 0.4)',   // Green
    low: 'rgba(59, 130, 246, 0.4)',   // Blue
    none: 'transparent'
};

// メトリクス値をフォーマット
export const formatMetricValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
};

// ヒートマップの色を計算
export const calculateHeatmapColor = (
    value: number,
    maxValue: number,
    minValue: number = 0
): string => {
    if (maxValue === 0) return COLORS.none;

    // 最小値を考慮して正規化するか、単純に最大値に対する割合にするか
    // ここでは単純に最大値に対する割合とする
    const ratio = value / maxValue;

    if (ratio > 0.8) return COLORS.high;
    if (ratio > 0.6) return COLORS.midHigh;
    if (ratio > 0.4) return COLORS.mid;
    if (ratio > 0.2) return COLORS.midLow;
    return COLORS.low;
};

// JANレベルの集計（個々の商品の値をそのまま返す）
export const getJanLevelValue = (product: Product, metric: HeatmapMetric): number => {
    return product[metric] || 0;
};

// 階層レベルの集計（カテゴリごとの平均値などを計算）
// 事前に集計マップを作成してから使用することを想定
export const aggregateByHierarchy = (
    products: Product[],
    metric: HeatmapMetric,
    hierarchyField: keyof Product = 'category'
): Record<string, number> => {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};

    products.forEach(p => {
        const key = String(p[hierarchyField] || 'Uncategorized');
        sums[key] = (sums[key] || 0) + (p[metric] || 0);
        counts[key] = (counts[key] || 0) + 1;
    });

    return sums; // 分析画面では「構成比」や「合計金額」を見るため、平均ではなく合計を返す
};
