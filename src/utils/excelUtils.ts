// 棚割管理システム - Excel ユーティリティ
import * as XLSX from 'xlsx';
import type { Product } from '../data/types';
import { generateRandomMetrics, generateRandomSize } from './metricsGenerator';

// Excelから読み込んだ生データの型
export interface ExcelRow {
    [key: string]: any;
}

// バリデーション結果
export interface ValidationError {
    row: number;
    field: string;
    message: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

// インポート結果
export interface ImportResult {
    newProducts: Partial<Product>[];
    updateProducts: Partial<Product>[];
    errors: ValidationError[];
}

// Excelカラム名のマッピング
const COLUMN_MAPPING: Record<string, keyof Product> = {
    '事業部CD': 'divisionCode',
    '事業部': 'divisionName',
    'ディビジョンCD': 'divisionSubCode',
    'ディビジョン名': 'divisionSubName',
    'ラインCD': 'lineCode',
    'ライン名': 'lineName',
    '部門CD': 'departmentCode',
    '部門名': 'departmentName',
    'カテゴリーCD': 'categoryCode',
    'カテゴリ名': 'categoryName',
    'サブカテゴリーCD': 'subCategoryCode',
    'サブカテゴリ名': 'subCategoryName',
    'セグメントCD': 'segmentCode',
    'セグメント名': 'segmentName',
    'サブセグメントCD': 'subSegmentCode',
    'サブセグメント名': 'subSegmentName',
    'JAN': 'jan',
    '商品名': 'name',
    '売上数量': 'salesQuantity',
    '幅': 'width',
    '高さ': 'height',
    '奥行': 'depth',
};

/**
 * Excelファイルを読み込んで配列に変換
 */
export async function readExcelFile(file: File): Promise<ExcelRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });

                // 最初のシートを取得
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // JSONに変換
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    raw: false,  // 数値も文字列として取得
                    defval: ''   // 空セルは空文字列
                });

                resolve(jsonData as ExcelRow[]);
            } catch (error) {
                reject(new Error('Excelファイルの読み込みに失敗しました: ' + (error as Error).message));
            }
        };

        reader.onerror = () => {
            reject(new Error('ファイルの読み込みに失敗しました'));
        };

        reader.readAsBinaryString(file);
    });
}

/**
 * CSVファイルを読み込んで配列に変換
 */
export async function readCSVFile(file: File): Promise<ExcelRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;

                // CSVをパース（xlsxライブラリを使用）
                const workbook = XLSX.read(text, { type: 'string' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // JSONに変換
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    raw: false,
                    defval: ''
                });

                resolve(jsonData as ExcelRow[]);
            } catch (error) {
                reject(new Error('CSVファイルの読み込みに失敗しました: ' + (error as Error).message));
            }
        };

        reader.onerror = () => {
            reject(new Error('ファイルの読み込みに失敗しました'));
        };

        reader.readAsText(file, 'UTF-8');
    });
}

/**
 * ファイル形式を自動判定して読み込み
 */
export async function readFile(file: File): Promise<ExcelRow[]> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
        return readCSVFile(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
        return readExcelFile(file);
    } else {
        throw new Error('サポートされていないファイル形式です。Excel (.xlsx, .xls) またはCSV (.csv) ファイルを選択してください。');
    }
}

/**
 * Excel行データを商品データに変換
 */
export function mapExcelRowToProduct(row: ExcelRow): Partial<Product> {
    const product: Partial<Product> = {};

    // カラムマッピングに基づいて変換
    Object.entries(COLUMN_MAPPING).forEach(([excelCol, productKey]) => {
        const value = row[excelCol];
        if (value !== undefined && value !== null && value !== '') {
            // 数値フィールドの処理
            if (productKey === 'width' || productKey === 'height' || productKey === 'depth' || productKey === 'salesQuantity') {
                (product as any)[productKey] = parseFloat(String(value));
            } else {
                (product as any)[productKey] = String(value).trim();
            }
        }
    });

    // サイズが欠損している場合はランダム生成
    if (!product.width || !product.height || !product.depth) {
        const randomSize = generateRandomSize();
        product.width = product.width || randomSize.width;
        product.height = product.height || randomSize.height;
        product.depth = product.depth || randomSize.depth;
    }

    // 分析用メトリクスを自動生成
    const metrics = generateRandomMetrics();
    product.quantity = metrics.quantity;
    product.sales = metrics.sales;
    product.grossProfit = metrics.grossProfit;
    product.traffic = metrics.traffic;
    product.spendPerCustomer = metrics.spendPerCustomer;

    return product;
}

/**
 * 商品データのバリデーション
 */
export function validateProductData(
    data: Partial<Product>[],
    existingProducts: Product[]
): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    data.forEach((product, index) => {
        const rowNum = index + 2; // Excelの行番号（ヘッダー分+1）

        // 必須項目チェック
        if (!product.jan || product.jan.trim() === '') {
            errors.push({
                row: rowNum,
                field: 'JAN',
                message: 'JANコードは必須です'
            });
        }

        if (!product.name || product.name.trim() === '') {
            errors.push({
                row: rowNum,
                field: '商品名',
                message: '商品名は必須です'
            });
        }

        // JANコードの形式チェック（13桁または8桁）
        if (product.jan) {
            const jan = product.jan.trim();
            if (!/^\d{8}$|^\d{13}$/.test(jan)) {
                errors.push({
                    row: rowNum,
                    field: 'JAN',
                    message: 'JANコードは8桁または13桁の数字である必要があります'
                });
            }
        }

        // 重複チェック（既存データとの照合）
        if (product.jan) {
            const existing = existingProducts.find(p => p.jan === product.jan);
            if (existing) {
                warnings.push({
                    row: rowNum,
                    field: 'JAN',
                    message: `既存の商品「${existing.name}」が更新されます`
                });
            }
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * インポートデータを新規/更新に分類
 */
export function categorizeImportData(
    data: Partial<Product>[],
    existingProducts: Product[]
): ImportResult {
    const newProducts: Partial<Product>[] = [];
    const updateProducts: Partial<Product>[] = [];
    const errors: ValidationError[] = [];

    data.forEach((product, index) => {
        if (!product.jan) {
            errors.push({
                row: index + 2,
                field: 'JAN',
                message: 'JANコードがありません'
            });
            return;
        }

        const existing = existingProducts.find(p => p.jan === product.jan);

        if (existing) {
            // 既存商品の更新
            updateProducts.push({
                ...product,
                id: existing.id  // 既存のIDを保持
            });
        } else {
            // 新規商品
            newProducts.push(product);
        }
    });

    return {
        newProducts,
        updateProducts,
        errors
    };
}

/**
 * 売上数量から売上ランクを計算
 * @param products 全商品データ（売上数量を含む）
 * @returns ランクが設定された商品データ
 */
export function calculateSalesRank(products: Partial<Product>[]): Partial<Product>[] {
    // 売上数量でソート（降順）
    const sorted = [...products].sort((a, b) => {
        const qtyA = parseFloat(String(a.salesQuantity || 0));
        const qtyB = parseFloat(String(b.salesQuantity || 0));
        return qtyB - qtyA;
    });

    // ランクを計算（1-100の範囲に正規化）
    const totalProducts = sorted.length;

    return sorted.map((product, index) => {
        // 順位をパーセンタイルに変換（1が最高、100が最低）
        const rank = Math.ceil(((index + 1) / totalProducts) * 100);

        return {
            ...product,
            salesRank: Math.min(100, Math.max(1, rank))
        };
    });
}



/**
 * 商品データをCSVにエクスポート
 */
export function exportProductsToCSV(products: Product[]): Blob {
    // CSVカラム順序
    const headers = [
        '事業部CD', '事業部',
        'ディビジョンCD', 'ディビジョン名',
        'ラインCD', 'ライン名',
        '部門CD', '部門名',
        'カテゴリーCD', 'カテゴリ名',
        'サブカテゴリーCD', 'サブカテゴリ名',
        'セグメントCD', 'セグメント名',
        'サブセグメントCD', 'サブセグメント名',
        'JAN', '商品名', '売上数量', '幅', '高さ', '奥行'
    ];

    // データを配列形式に変換
    const rows = products.map(product => {
        return headers.map(header => {
            const key = COLUMN_MAPPING[header];
            return (product as any)[key] || '';
        });
    });

    // ヘッダーとデータを結合
    const wsData = [headers, ...rows];

    // ワークシートを作成
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // ワークブックを作成
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '商品マスタ');

    // CSVファイルを生成（UTF-8 BOM付き）
    const csvData = XLSX.write(wb, { bookType: 'csv', type: 'string' });

    // UTF-8 BOMを追加（Excelで正しく開けるように）
    const bom = '\uFEFF';

    return new Blob([bom + csvData], {
        type: 'text/csv;charset=utf-8;'
    });
}

/**
 * Excelテンプレートファイルを生成
 */
export function generateExcelTemplate(): Blob {
    const headers = [
        '事業部CD', '事業部',
        'ディビジョンCD', 'ディビジョン名',
        'ラインCD', 'ライン名',
        '部門CD', '部門名',
        'カテゴリーCD', 'カテゴリ名',
        'サブカテゴリーCD', 'サブカテゴリ名',
        'セグメントCD', 'セグメント名',
        'サブセグメントCD', 'サブセグメント名',
        'JAN', '商品名', '売上数量', '幅', '高さ', '奥行'
    ];

    // サンプル行を追加
    const sampleRow = [
        'D001', '食品事業部',
        'DV001', '生鮮ディビジョン',
        'L001', '精肉ライン',
        'DP001', '国産牛部門',
        'C001', '焼肉セット',
        'SC001', 'プレミアム',
        'S001', 'A5ランク',
        'SS001', '黒毛和牛',
        '4901234567890', 'サンプル商品名', '1000', '10', '15', '8'
    ];

    const wsData = [headers, sampleRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // カラム幅を設定
    ws['!cols'] = headers.map(() => ({ wch: 15 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '商品マスタ');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    return new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}
