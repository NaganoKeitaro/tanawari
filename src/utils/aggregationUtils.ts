// 棚割管理システム - 集計ユーティリティ
// Aggregation utilities for analytics dashboard

import type { Product } from '../data/types';

/**
 * 集計メトリクス
 */
export interface AggregatedMetrics {
    quantity: number;
    sales: number;
    grossProfit: number;
    traffic: number;
    spendPerCustomer: number;
    productCount: number;
}

/**
 * カテゴリ別集計結果
 */
export interface CategoryMetrics {
    category: string;
    metrics: AggregatedMetrics;
}

/**
 * 商品リストから基本メトリクスを集計
 */
export function aggregateMetrics(products: Product[]): AggregatedMetrics {
    if (products.length === 0) {
        return {
            quantity: 0,
            sales: 0,
            grossProfit: 0,
            traffic: 0,
            spendPerCustomer: 0,
            productCount: 0
        };
    }

    const totals = products.reduce((acc, product) => {
        return {
            quantity: acc.quantity + (product.quantity || 0),
            sales: acc.sales + (product.sales || 0),
            grossProfit: acc.grossProfit + (product.grossProfit || 0),
            traffic: acc.traffic + (product.traffic || 0),
            spendPerCustomer: acc.spendPerCustomer + (product.spendPerCustomer || 0),
        };
    }, {
        quantity: 0,
        sales: 0,
        grossProfit: 0,
        traffic: 0,
        spendPerCustomer: 0,
    });

    return {
        ...totals,
        // 客単価は平均値を計算
        spendPerCustomer: totals.traffic > 0 ? Math.floor(totals.sales / totals.traffic) : 0,
        productCount: products.length
    };
}

/**
 * カテゴリ別に集計
 */
export function aggregateByCategory(products: Product[]): CategoryMetrics[] {
    const grouped = products.reduce((acc, product) => {
        const category = product.categoryName || product.category || '未分類';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(product);
        return acc;
    }, {} as Record<string, Product[]>);

    return Object.entries(grouped).map(([category, prods]) => ({
        category,
        metrics: aggregateMetrics(prods)
    }));
}

/**
 * 階層レベル別に集計
 */
export function aggregateByHierarchy(
    products: Product[],
    level: 'division' | 'department' | 'category' | 'segment'
): CategoryMetrics[] {
    const grouped = products.reduce((acc, product) => {
        let key: string;
        switch (level) {
            case 'division':
                key = product.divisionName || '未分類';
                break;
            case 'department':
                key = product.departmentName || '未分類';
                break;
            case 'category':
                key = product.categoryName || '未分類';
                break;
            case 'segment':
                key = product.segmentName || '未分類';
                break;
            default:
                key = '未分類';
        }

        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(product);
        return acc;
    }, {} as Record<string, Product[]>);

    return Object.entries(grouped)
        .map(([category, prods]) => ({
            category,
            metrics: aggregateMetrics(prods)
        }))
        .sort((a, b) => b.metrics.sales - a.metrics.sales); // 売上降順
}

/**
 * 売上ランク別に集計
 */
export function aggregateBySalesRank(products: Product[]): {
    topRank: AggregatedMetrics;    // ランク1-20
    midRank: AggregatedMetrics;    // ランク21-60
    lowRank: AggregatedMetrics;    // ランク61-100
} {
    const topRank = products.filter(p => p.salesRank <= 20);
    const midRank = products.filter(p => p.salesRank > 20 && p.salesRank <= 60);
    const lowRank = products.filter(p => p.salesRank > 60);

    return {
        topRank: aggregateMetrics(topRank),
        midRank: aggregateMetrics(midRank),
        lowRank: aggregateMetrics(lowRank)
    };
}

/**
 * 粗利率を計算
 */
export function calculateProfitMargin(metrics: AggregatedMetrics): number {
    if (metrics.sales === 0) return 0;
    return (metrics.grossProfit / metrics.sales) * 100;
}

/**
 * 前期比計算用のヘルパー
 */
export function calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
}
