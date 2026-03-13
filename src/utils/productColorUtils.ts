// 商品カテゴリ（品種）別カラーパレット
// 30種類以上の品種に対応する、視認性の高いカラーパレット

export interface ProductColor {
    bg: string;      // 背景色
    border: string;  // ボーダー色
    text: string;    // テキスト色（白 or 暗色）
}

// 鮮やかで区別しやすい30色パレット
const COLOR_PALETTE: ProductColor[] = [
    { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },  // Blue
    { bg: '#10b981', border: '#059669', text: '#ffffff' },  // Emerald
    { bg: '#ef4444', border: '#dc2626', text: '#ffffff' },  // Red
    { bg: '#f59e0b', border: '#d97706', text: '#ffffff' },  // Amber
    { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' },  // Violet
    { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' },  // Cyan
    { bg: '#ec4899', border: '#db2777', text: '#ffffff' },  // Pink
    { bg: '#14b8a6', border: '#0d9488', text: '#ffffff' },  // Teal
    { bg: '#f97316', border: '#ea580c', text: '#ffffff' },  // Orange
    { bg: '#6366f1', border: '#4f46e5', text: '#ffffff' },  // Indigo
    { bg: '#84cc16', border: '#65a30d', text: '#ffffff' },  // Lime
    { bg: '#e11d48', border: '#be123c', text: '#ffffff' },  // Rose
    { bg: '#0ea5e9', border: '#0284c7', text: '#ffffff' },  // Sky
    { bg: '#a855f7', border: '#9333ea', text: '#ffffff' },  // Purple
    { bg: '#22c55e', border: '#16a34a', text: '#ffffff' },  // Green
    { bg: '#d946ef', border: '#c026d3', text: '#ffffff' },  // Fuchsia
    { bg: '#eab308', border: '#ca8a04', text: '#ffffff' },  // Yellow
    { bg: '#64748b', border: '#475569', text: '#ffffff' },  // Slate
    { bg: '#2dd4bf', border: '#14b8a6', text: '#ffffff' },  // Teal Light
    { bg: '#fb923c', border: '#f97316', text: '#ffffff' },  // Orange Light
    { bg: '#818cf8', border: '#6366f1', text: '#ffffff' },  // Indigo Light
    { bg: '#4ade80', border: '#22c55e', text: '#ffffff' },  // Green Light
    { bg: '#f472b6', border: '#ec4899', text: '#ffffff' },  // Pink Light
    { bg: '#38bdf8', border: '#0ea5e9', text: '#ffffff' },  // Sky Light
    { bg: '#c084fc', border: '#a855f7', text: '#ffffff' },  // Purple Light
    { bg: '#fb7185', border: '#f43f5e', text: '#ffffff' },  // Rose Light
    { bg: '#a3e635', border: '#84cc16', text: '#374151' },  // Lime Light
    { bg: '#fbbf24', border: '#f59e0b', text: '#374151' },  // Amber Light
    { bg: '#34d399', border: '#10b981', text: '#ffffff' },  // Emerald Light
    { bg: '#67e8f9', border: '#22d3ee', text: '#374151' },  // Cyan Light
];

// カテゴリ名 → カラーインデックスのキャッシュ
const categoryColorMap = new Map<string, number>();
let nextColorIndex = 0;

/**
 * カテゴリ名に基づいて一貫した色を返す
 * 同じカテゴリは常に同じ色になる
 */
export function getProductColor(category: string | undefined | null): ProductColor {
    const key = category || '未分類';

    if (!categoryColorMap.has(key)) {
        categoryColorMap.set(key, nextColorIndex);
        nextColorIndex = (nextColorIndex + 1) % COLOR_PALETTE.length;
    }

    const index = categoryColorMap.get(key)!;
    return COLOR_PALETTE[index];
}

/**
 * カラーマップをリセット（画面遷移時などに使用）
 */
export function resetProductColorMap(): void {
    categoryColorMap.clear();
    nextColorIndex = 0;
}

/**
 * 商品リストから事前にカラーマップを構築
 * 一貫性を保つために、棚割に含まれる全商品のカテゴリを先に登録する
 */
export function initProductColorMap(categories: string[]): void {
    resetProductColorMap();
    const unique = [...new Set(categories)];
    unique.sort(); // アルファベット順でソートして安定した色割り当て
    for (const cat of unique) {
        getProductColor(cat);
    }
}
