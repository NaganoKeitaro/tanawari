// 棚割管理システム - Excelインポートモーダル
import { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import type { Product } from '../../data/types';
import {
    readFile,
    mapExcelRowToProduct,
    validateProductData,
    categorizeImportData,
    generateExcelTemplate,
    type ValidationError
} from '../../utils/excelUtils';

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (newProducts: Partial<Product>[], updateProducts: Partial<Product>[]) => Promise<void>;
    existingProducts: Product[];
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export function ExcelImportModal({
    isOpen,
    onClose,
    onImport,
    existingProducts
}: ExcelImportModalProps) {
    const [step, setStep] = useState<ImportStep>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<Partial<Product>[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [validationWarnings, setValidationWarnings] = useState<ValidationError[]>([]);
    const [importSummary, setImportSummary] = useState({ new: 0, update: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ファイル選択
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // ファイル形式チェック
        if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
            alert('Excel（.xlsx, .xls）またはCSV（.csv）ファイルを選択してください');
            return;
        }

        setFile(selectedFile);

        try {
            // ファイルを読み込み（形式自動判定）
            const rows = await readFile(selectedFile);

            // 商品データに変換
            const products = rows.map(row => mapExcelRowToProduct(row));

            // バリデーション
            const validation = validateProductData(products, existingProducts);

            setPreviewData(products);
            setValidationErrors(validation.errors);
            setValidationWarnings(validation.warnings);

            // エラーがなければプレビューステップへ
            if (validation.isValid) {
                setStep('preview');
            } else {
                alert(`${validation.errors.length}件のエラーがあります。修正してください。`);
            }
        } catch (error) {
            alert('ファイルの読み込みに失敗しました: ' + (error as Error).message);
            setFile(null);
        }
    };

    // インポート実行
    const handleImport = async () => {
        setStep('importing');

        try {
            const { newProducts, updateProducts } = categorizeImportData(
                previewData,
                existingProducts
            );

            await onImport(newProducts, updateProducts);

            setImportSummary({
                new: newProducts.length,
                update: updateProducts.length
            });

            setStep('complete');
        } catch (error) {
            alert('インポートに失敗しました: ' + (error as Error).message);
            setStep('preview');
        }
    };

    // モーダルを閉じる
    const handleClose = () => {
        setStep('upload');
        setFile(null);
        setPreviewData([]);
        setValidationErrors([]);
        setValidationWarnings([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClose();
    };

    // テンプレートダウンロード
    const handleDownloadTemplate = () => {
        const blob = generateExcelTemplate();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '商品マスタ_テンプレート.xlsx';
        a.click();
        URL.revokeObjectURL(url);
    };

    // ステップごとのコンテンツ
    const renderContent = () => {
        switch (step) {
            case 'upload':
                return (
                    <div className="text-center" style={{ padding: '2rem' }}>
                        <div className="mb-lg">
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                            <h3 style={{ marginBottom: '0.5rem' }}>Excel/CSVファイルをインポート</h3>
                            <p className="text-muted">
                                商品マスタのExcelまたはCSVファイルを選択してください
                            </p>
                        </div>

                        <div className="mb-lg">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                📁 ファイルを選択
                            </button>
                        </div>

                        <div className="card" style={{ background: 'var(--bg-secondary)', padding: '1rem' }}>
                            <div className="text-sm text-muted mb-sm">
                                <strong>対応形式:</strong> Excel (.xlsx, .xls), CSV (.csv)
                            </div>
                            <div className="text-sm text-muted mb-sm">
                                <strong>必須カラム:</strong> JAN, 商品名
                            </div>
                            <div className="text-sm text-muted mb-sm">
                                <strong>任意カラム:</strong> 事業部CD, 事業部, ディビジョンCD, ディビジョン名,
                                ラインCD, ライン名, 部門CD, 部門名, カテゴリーCD, カテゴリ名,
                                サブカテゴリーCD, サブカテゴリ名, セグメントCD, セグメント名,
                                サブセグメントCD, サブセグメント名
                            </div>
                            <button
                                className="btn btn-sm btn-secondary mt-sm"
                                onClick={handleDownloadTemplate}
                            >
                                📥 テンプレートをダウンロード
                            </button>
                        </div>
                    </div>
                );

            case 'preview':
                return (
                    <div>
                        <div className="mb-md">
                            <h3>インポートプレビュー</h3>
                            <p className="text-muted text-sm">
                                {previewData.length}件のデータが見つかりました
                            </p>
                        </div>

                        {/* バリデーション結果 */}
                        {validationErrors.length > 0 && (
                            <div className="card mb-md" style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)' }}>
                                <h4 style={{ color: 'var(--color-danger)', marginBottom: '0.5rem' }}>
                                    ❌ エラー ({validationErrors.length}件)
                                </h4>
                                <div style={{ maxHeight: '150px', overflow: 'auto' }}>
                                    {validationErrors.map((error, idx) => (
                                        <div key={idx} className="text-sm" style={{ marginBottom: '0.25rem' }}>
                                            行{error.row}: {error.field} - {error.message}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {validationWarnings.length > 0 && (
                            <div className="card mb-md" style={{ background: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)' }}>
                                <h4 style={{ color: 'var(--color-warning)', marginBottom: '0.5rem' }}>
                                    ⚠️ 警告 ({validationWarnings.length}件)
                                </h4>
                                <div style={{ maxHeight: '150px', overflow: 'auto' }}>
                                    {validationWarnings.map((warning, idx) => (
                                        <div key={idx} className="text-sm" style={{ marginBottom: '0.25rem' }}>
                                            行{warning.row}: {warning.field} - {warning.message}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* データプレビュー */}
                        <div className="table-container" style={{ maxHeight: '400px', overflow: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '50px' }}>行</th>
                                        <th>JAN</th>
                                        <th>商品名</th>
                                        <th>事業部</th>
                                        <th>カテゴリ名</th>
                                        <th>セグメント名</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.slice(0, 20).map((product, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 2}</td>
                                            <td className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                                                {product.jan || '-'}
                                            </td>
                                            <td>{product.name || '-'}</td>
                                            <td>{product.divisionName || '-'}</td>
                                            <td>{product.categoryName || '-'}</td>
                                            <td>{product.segmentName || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {previewData.length > 20 && (
                                <div className="text-center text-muted text-sm" style={{ padding: '1rem' }}>
                                    他 {previewData.length - 20}件...
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'importing':
                return (
                    <div className="text-center" style={{ padding: '3rem' }}>
                        <div className="animate-pulse" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                            ⏳
                        </div>
                        <h3>インポート中...</h3>
                        <p className="text-muted">しばらくお待ちください</p>
                    </div>
                );

            case 'complete':
                return (
                    <div className="text-center" style={{ padding: '2rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <h3 style={{ marginBottom: '1rem' }}>インポート完了</h3>
                        <div className="card" style={{ background: 'var(--bg-secondary)', padding: '1rem' }}>
                            <div className="text-lg mb-sm">
                                <strong>新規登録:</strong> {importSummary.new}件
                            </div>
                            <div className="text-lg">
                                <strong>更新:</strong> {importSummary.update}件
                            </div>
                        </div>
                    </div>
                );
        }
    };

    // フッターボタン
    const renderFooter = () => {
        switch (step) {
            case 'upload':
                return (
                    <button className="btn btn-secondary" onClick={handleClose}>
                        キャンセル
                    </button>
                );

            case 'preview':
                return (
                    <>
                        <button className="btn btn-secondary" onClick={() => setStep('upload')}>
                            戻る
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleImport}
                            disabled={validationErrors.length > 0}
                        >
                            インポート実行
                        </button>
                    </>
                );

            case 'importing':
                return null;

            case 'complete':
                return (
                    <button className="btn btn-primary" onClick={handleClose}>
                        閉じる
                    </button>
                );
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Excel/CSVインポート"
            size="xl"
            footer={renderFooter()}
        >
            {renderContent()}
        </Modal>
    );
}
