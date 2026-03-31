// 商品部門名（departmentName）別カラーパレット
// Excelライクな棚割表示用の固定色マッピング

export interface ProductColor {
    bg: string;      // 背景色
    border: string;  // ボーダー色
    text: string;    // テキスト色（白 or 暗色）
}

// 部門名→固定色マッピング（Excelの棚割表と同じ配色）
const DEPARTMENT_COLOR_MAP: Record<string, ProductColor> = {
    '牛肉':     { bg: '#f87171', border: '#ef4444', text: '#7f1d1d' },  // 赤
    '豚肉':     { bg: '#fb923c', border: '#f97316', text: '#7c2d12' },  // 橙
    '鶏肉':     { bg: '#fde047', border: '#facc15', text: '#713f12' },  // 黄
    '加工':     { bg: '#60a5fa', border: '#3b82f6', text: '#1e3a8a' },  // 青
    'MS':       { bg: '#4ade80', border: '#22c55e', text: '#14532d' },  // 緑（旧名称互換）
    'MS(ミールソリューション)': { bg: '#4ade80', border: '#22c55e', text: '#14532d' },  // 緑（マスタ正式名称）
    '焼肉/他':  { bg: '#d1d5db', border: '#9ca3af', text: '#374151' },  // 灰
};

// 部門名に一致しない場合のフォールバックパレット
const FALLBACK_PALETTE: ProductColor[] = [
    { bg: '#a78bfa', border: '#8b5cf6', text: '#ffffff' },  // Violet
    { bg: '#f472b6', border: '#ec4899', text: '#ffffff' },  // Pink
    { bg: '#22d3ee', border: '#06b6d4', text: '#ffffff' },  // Cyan
    { bg: '#2dd4bf', border: '#14b8a6', text: '#ffffff' },  // Teal
    { bg: '#818cf8', border: '#6366f1', text: '#ffffff' },  // Indigo
    { bg: '#fb7185', border: '#f43f5e', text: '#ffffff' },  // Rose
];

// フォールバック用キャッシュ
const fallbackColorMap = new Map<string, number>();
let nextFallbackIndex = 0;

/**
 * 部門名に基づいて固定色を返す
 * 定義済み部門名はExcel棚割表と同じ色、それ以外はフォールバックパレットから割り当て
 */
export function getProductColor(departmentName: string | undefined | null): ProductColor {
    const key = departmentName || '未分類';

    // 固定マッピングに一致すれば即返却
    if (DEPARTMENT_COLOR_MAP[key]) {
        return DEPARTMENT_COLOR_MAP[key];
    }

    // フォールバック
    if (!fallbackColorMap.has(key)) {
        fallbackColorMap.set(key, nextFallbackIndex);
        nextFallbackIndex = (nextFallbackIndex + 1) % FALLBACK_PALETTE.length;
    }
    return FALLBACK_PALETTE[fallbackColorMap.get(key)!];
}

/**
 * カラーマップをリセット（画面遷移時などに使用）
 */
export function resetProductColorMap(): void {
    fallbackColorMap.clear();
    nextFallbackIndex = 0;
}

/**
 * 商品リストから事前にカラーマップを構築
 * 固定マッピング以外の部門名に対してフォールバック色を安定的に割り当てる
 */
export function initProductColorMap(departmentNames: string[]): void {
    resetProductColorMap();
    const unique = [...new Set(departmentNames)].filter(d => !DEPARTMENT_COLOR_MAP[d]);
    unique.sort();
    for (const dept of unique) {
        getProductColor(dept);
    }
}

/**
 * 部門色の凡例データを取得（Excelライクヘッダーの凡例表示用）
 */
export function getDepartmentColorLegend(): { name: string; color: ProductColor }[] {
    return Object.entries(DEPARTMENT_COLOR_MAP).map(([name, color]) => ({ name, color }));
}
