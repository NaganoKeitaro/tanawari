import React, { useRef, useState } from 'react';
import { Modal } from '../common/Modal';
import { readCSVFile } from '../../utils/excelUtils';
import { generateHierarchyTemplate, mapRowToHierarchyEntry, validateHierarchyEntry } from '../../utils/hierarchyUtils';
import { productHierarchyRepository } from '../../data/repositories/repositoryFactory';
import type { HierarchyEntry } from '../../data/types/productHierarchy';

interface HierarchyImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: () => void;
}

export const HierarchyImportModal: React.FC<HierarchyImportModalProps> = ({ isOpen, onClose, onImportComplete }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<Omit<HierarchyEntry, 'id' | 'createdAt' | 'updatedAt'>[]>([]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);

            try {
                setIsLoading(true);
                const rows = await readCSVFile(selectedFile);
                const mappedData = rows.map(row => mapRowToHierarchyEntry(row));
                setPreviewData(mappedData);
            } catch (err) {
                setError((err as Error).message);
                setFile(null);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDownloadTemplate = () => {
        const blob = generateHierarchyTemplate();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '商品階層インポート用テンプレート.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = async () => {
        if (!previewData.length) return;

        setIsLoading(true);
        try {
            // Validate
            const allErrors: string[] = [];
            previewData.forEach((entry, index) => {
                const rowErrors = validateHierarchyEntry(entry, index + 1); // +1 because header is row 1
                allErrors.push(...rowErrors);
            });

            if (allErrors.length > 0) {
                setError(allErrors.slice(0, 10).join('\n') + (allErrors.length > 10 ? '...' : ''));
                setIsLoading(false);
                return;
            }

            // Import - batch save to avoid race condition with individual add() calls
            const existingEntries = await productHierarchyRepository.getAll();
            const now = new Date().toISOString();
            const newEntries = previewData.map(entry => ({
                ...entry,
                id: crypto.randomUUID(),
                createdAt: now,
                updatedAt: now,
            }));
            await productHierarchyRepository.saveAll([...existingEntries, ...newEntries]);

            onImportComplete();
            onClose();
            setFile(null);
            setPreviewData([]);
        } catch (err) {
            setError('インポート中にエラーが発生しました: ' + (err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="商品階層CSVインポート"
            footer={
                <div className="flex justify-between w-full">
                    <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
                        テンプレートDL
                    </button>
                    <div className="flex gap-sm">
                        <button className="btn btn-secondary" onClick={onClose}>
                            キャンセル
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleImport}
                            disabled={!file || isLoading || previewData.length === 0}
                        >
                            {isLoading ? 'インポート中...' : 'インポート実行'}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="space-y-md">
                <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv"
                        className="hidden"
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        ファイルを選択
                    </button>
                    {file && <div className="mt-2 text-sm">{file.name}</div>}
                </div>

                {error && (
                    <div className="p-3 bg-red-100 text-red-700 rounded text-sm whitespace-pre-wrap">
                        {error}
                    </div>
                )}

                {previewData.length > 0 && (
                    <div className="mt-4">
                        <h4 className="text-sm font-bold mb-2">プレビュー ({previewData.length}件)</h4>
                        <div className="overflow-auto max-h-60 border rounded">
                            <table className="min-w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-2 border">事業部</th>
                                        <th className="p-2 border">ディビジョン</th>
                                        <th className="p-2 border">ライン</th>
                                        <th className="p-2 border">部門</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.slice(0, 5).map((row, i) => (
                                        <tr key={i} className="border-b">
                                            <td className="p-2 border">{row.divisionName}</td>
                                            <td className="p-2 border">{row.divisionSubName}</td>
                                            <td className="p-2 border">{row.lineName}</td>
                                            <td className="p-2 border">{row.departmentName}</td>
                                        </tr>
                                    ))}
                                    {previewData.length > 5 && (
                                        <tr>
                                            <td colSpan={4} className="p-2 text-center text-gray-500">
                                                他 {previewData.length - 5} 件...
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
