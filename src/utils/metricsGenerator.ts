// 棚割管理システム - メトリクス生成ユーティリティ
// Utility functions for generating random analytics metrics

/**
 * 分析用メトリクスデータ
 */
export interface ProductMetrics {
    quantity: number;          // 売上数量
    sales: number;             // 売上金額
    grossProfit: number;       // 粗利
    traffic: number;           // 客数
    spendPerCustomer: number;  // 客単価
}

/**
 * ランダムな分析メトリクスを生成
 * メトリクス間の整合性を保つ(粗利 < 売上金額、客単価 = 売上金額 / 客数)
 */
export function generateRandomMetrics(): ProductMetrics {
    // 売上数量: 10-1000の範囲
    const quantity = Math.floor(Math.random() * 990) + 10;

    // 単価: 100-5000円の範囲
    const unitPrice = Math.floor(Math.random() * 4900) + 100;

    // 売上金額 = 数量 × 単価
    const sales = quantity * unitPrice;

    // 粗利率: 10-40%の範囲
    const profitMargin = (Math.random() * 0.3) + 0.1;
    const grossProfit = Math.floor(sales * profitMargin);

    // 客数: 売上数量の30-80%の範囲(1商品を複数個買う客もいる想定)
    const customerRatio = (Math.random() * 0.5) + 0.3;
    const traffic = Math.floor(quantity * customerRatio);

    // 客単価 = 売上金額 / 客数
    const spendPerCustomer = traffic > 0 ? Math.floor(sales / traffic) : 0;

    return {
        quantity,
        sales,
        grossProfit,
        traffic,
        spendPerCustomer
    };
}

/**
 * ランダムな商品サイズを生成
 */
export function generateRandomSize(): { width: number; height: number; depth: number } {
    const sizes = [
        { width: 5, height: 10, depth: 5 },
        { width: 8, height: 12, depth: 6 },
        { width: 10, height: 15, depth: 8 },
        { width: 12, height: 18, depth: 10 },
        { width: 15, height: 20, depth: 12 },
        { width: 20, height: 25, depth: 15 },
        { width: 6, height: 20, depth: 6 },
        { width: 10, height: 10, depth: 10 },
        { width: 7, height: 14, depth: 7 },
        { width: 9, height: 16, depth: 9 },
    ];
    return sizes[Math.floor(Math.random() * sizes.length)];
}

/**
 * 既存の売上数量から他のメトリクスを計算
 * (既存のsalesQuantityフィールドとの互換性のため)
 */
export function calculateMetricsFromQuantity(salesQuantity: number): ProductMetrics {
    const quantity = salesQuantity;

    // 単価: 100-5000円の範囲
    const unitPrice = Math.floor(Math.random() * 4900) + 100;
    const sales = quantity * unitPrice;

    // 粗利率: 10-40%の範囲
    const profitMargin = (Math.random() * 0.3) + 0.1;
    const grossProfit = Math.floor(sales * profitMargin);

    // 客数: 売上数量の30-80%の範囲
    const customerRatio = (Math.random() * 0.5) + 0.3;
    const traffic = Math.floor(quantity * customerRatio);

    // 客単価
    const spendPerCustomer = traffic > 0 ? Math.floor(sales / traffic) : 0;

    return {
        quantity,
        sales,
        grossProfit,
        traffic,
        spendPerCustomer
    };
}
