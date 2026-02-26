import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { productHierarchyRepository } from '../../data/repositories/supabaseRepository';
import type { HierarchyEntry } from '../../data/types/productHierarchy';
import { HIERARCHY_HEADERS, HIERARCHY_KEYS } from '../../data/types/productHierarchy';
import { HierarchyImportModal } from '../../components/masters/HierarchyImportModal';
import { Modal } from '../../components/common/Modal';

// フィルター用の階層レベル定義
const FILTER_LEVELS = [
    { codeKey: 'divisionCode' as keyof HierarchyEntry, nameKey: 'divisionName' as keyof HierarchyEntry, label: '事業部' },
    { codeKey: 'divisionSubCode' as keyof HierarchyEntry, nameKey: 'divisionSubName' as keyof HierarchyEntry, label: 'ディビジョン' },
    { codeKey: 'lineCode' as keyof HierarchyEntry, nameKey: 'lineName' as keyof HierarchyEntry, label: 'ライン' },
    { codeKey: 'departmentCode' as keyof HierarchyEntry, nameKey: 'departmentName' as keyof HierarchyEntry, label: '部門' },
    { codeKey: 'categoryCode' as keyof HierarchyEntry, nameKey: 'categoryName' as keyof HierarchyEntry, label: 'カテゴリ' },
    { codeKey: 'subCategoryCode' as keyof HierarchyEntry, nameKey: 'subCategoryName' as keyof HierarchyEntry, label: 'サブカテゴリ' },
    { codeKey: 'segmentCode' as keyof HierarchyEntry, nameKey: 'segmentName' as keyof HierarchyEntry, label: 'セグメント' },
    { codeKey: 'subSegmentCode' as keyof HierarchyEntry, nameKey: 'subSegmentName' as keyof HierarchyEntry, label: 'サブセグメント' },
];

const PAGE_SIZE = 50;

export const ProductHierarchyMaster: React.FC = () => {
    const [hierarchies, setHierarchies] = useState<HierarchyEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<Partial<HierarchyEntry>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);

    // 各階層レベルのフィルター値
    const [filters, setFilters] = useState<Record<string, string>>({});

    const loadHierarchies = useCallback(async () => {
        setLoading(true);
        const data = await productHierarchyRepository.getAll();
        setHierarchies(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadHierarchies();
    }, [loadHierarchies]);

    // フィルター変更ハンドラ（下位レベルをリセット）
    const handleFilterChange = (levelIndex: number, value: string) => {
        const newFilters = { ...filters };
        const key = FILTER_LEVELS[levelIndex].codeKey;
        newFilters[key] = value;

        // 下位レベルをリセット
        for (let i = levelIndex + 1; i < FILTER_LEVELS.length; i++) {
            delete newFilters[FILTER_LEVELS[i].codeKey];
        }

        setFilters(newFilters);
        setCurrentPage(1);
    };

    // フィルター全クリア
    const clearFilters = () => {
        setFilters({});
        setSearchTerm('');
        setCurrentPage(1);
    };

    // フィルター適用後のデータ
    const filteredHierarchies = useMemo(() => {
        let result = hierarchies;

        // 各レベルのフィルター適用
        for (const level of FILTER_LEVELS) {
            const filterValue = filters[level.codeKey];
            if (filterValue) {
                result = result.filter(h => h[level.codeKey] === filterValue);
            }
        }

        // テキスト検索
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            result = result.filter(h =>
                Object.values(h).some(val =>
                    String(val).toLowerCase().includes(search)
                )
            );
        }

        return result;
    }, [hierarchies, filters, searchTerm]);

    // 各レベルのフィルター選択肢を生成（親フィルターで絞り込み済みのデータから）
    const getFilterOptions = (levelIndex: number) => {
        let data = hierarchies;

        // 上位レベルのフィルターを適用
        for (let i = 0; i < levelIndex; i++) {
            const filterValue = filters[FILTER_LEVELS[i].codeKey];
            if (filterValue) {
                data = data.filter(h => h[FILTER_LEVELS[i].codeKey] === filterValue);
            }
        }

        const level = FILTER_LEVELS[levelIndex];
        const uniqueMap = new Map<string, string>();
        data.forEach(h => {
            const code = String(h[level.codeKey]);
            const name = String(h[level.nameKey]);
            if (code && !uniqueMap.has(code)) {
                uniqueMap.set(code, name);
            }
        });

        return Array.from(uniqueMap.entries())
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.code.localeCompare(b.code));
    };

    // ページネーション
    const totalPages = Math.ceil(filteredHierarchies.length / PAGE_SIZE);
    const pagedData = filteredHierarchies.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleSave = async () => {
        if (!editingEntry.divisionCode || !editingEntry.divisionName) {
            alert('事業部CDと事業部名は必須です');
            return;
        }

        if (editingEntry.id) {
            await productHierarchyRepository.update(editingEntry.id, editingEntry);
        } else {
            await productHierarchyRepository.add(editingEntry as Omit<HierarchyEntry, 'id' | 'createdAt' | 'updatedAt'>);
        }
        setIsEditModalOpen(false);
        loadHierarchies();
    };

    const handleDelete = async (id: string) => {
        if (confirm('この階層データを削除しますか？')) {
            await productHierarchyRepository.delete(id);
            loadHierarchies();
        }
    };

    const openEditModal = (entry?: HierarchyEntry) => {
        if (entry) {
            setEditingEntry(entry);
        } else {
            setEditingEntry({});
        }
        setIsEditModalOpen(true);
    };

    // アクティブフィルター数
    const activeFilterCount = Object.keys(filters).filter(k => filters[k]).length + (searchTerm ? 1 : 0);

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">商品階層マスタ</h1>
                <p className="page-subtitle">商品分類階層（事業部〜サブセグメント）の管理 — {hierarchies.length}件登録済</p>
            </div>

            {/* ツールバー */}
            <div className="card mb-lg">
                <div className="flex items-center justify-between gap-md" style={{ flexWrap: 'wrap' }}>
                    <div className="flex gap-md items-center">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="フリーワード検索..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            style={{ width: '260px' }}
                        />
                        <button
                            className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            🔽 階層フィルター {activeFilterCount > 0 && `(${activeFilterCount})`}
                        </button>
                        {activeFilterCount > 0 && (
                            <button className="btn btn-sm btn-secondary" onClick={clearFilters}>
                                ✕ クリア
                            </button>
                        )}
                    </div>
                    <div className="flex gap-sm">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setIsImportModalOpen(true)}
                        >
                            📤 CSVインポート
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => openEditModal()}
                        >
                            ＋ 新規登録
                        </button>
                    </div>
                </div>

                {/* 階層フィルターパネル */}
                {showFilters && (
                    <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '8px'
                    }}>
                        {FILTER_LEVELS.map((level, index) => {
                            const options = getFilterOptions(index);
                            const parentSelected = index === 0 || filters[FILTER_LEVELS[index - 1].codeKey];
                            return (
                                <div key={level.codeKey} className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>
                                        {level.label}
                                    </label>
                                    <select
                                        className="form-select"
                                        value={filters[level.codeKey] || ''}
                                        onChange={(e) => handleFilterChange(index, e.target.value)}
                                        disabled={index > 0 && !parentSelected}
                                        style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                                    >
                                        <option value="">すべて</option>
                                        {options.map(opt => (
                                            <option key={opt.code} value={opt.code}>
                                                {opt.code}: {opt.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* データテーブル */}
            <div className="card">
                {loading ? (
                    <div className="text-center text-muted animate-pulse">読み込み中...</div>
                ) : (
                    <>
                        {/* 件数表示・ページネーション（上部） */}
                        <div className="flex items-center justify-between mb-md" style={{ fontSize: '0.85rem' }}>
                            <div className="text-muted">
                                {filteredHierarchies.length} 件中 {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredHierarchies.length)}〜{Math.min(currentPage * PAGE_SIZE, filteredHierarchies.length)} 件表示
                            </div>
                            {totalPages > 1 && (
                                <div className="flex gap-xs items-center">
                                    <button
                                        className="btn btn-xs btn-secondary"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(1)}
                                    >
                                        ≪
                                    </button>
                                    <button
                                        className="btn btn-xs btn-secondary"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    >
                                        ＜
                                    </button>
                                    <span className="text-sm">{currentPage} / {totalPages}</span>
                                    <button
                                        className="btn btn-xs btn-secondary"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    >
                                        ＞
                                    </button>
                                    <button
                                        className="btn btn-xs btn-secondary"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(totalPages)}
                                    >
                                        ≫
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="table-container" style={{ overflowX: 'auto' }}>
                            <table style={{ minWidth: '2000px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '80px', position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-secondary)' }}>操作</th>
                                        {HIERARCHY_HEADERS.map(header => (
                                            <th key={header} style={{ minWidth: '120px' }}>{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedData.map(entry => (
                                        <tr key={entry.id}>
                                            <td style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-primary)', borderRight: '1px solid var(--border-color)' }}>
                                                <div className="flex gap-xs justify-center">
                                                    <button
                                                        className="btn btn-xs btn-secondary"
                                                        onClick={() => openEditModal(entry)}
                                                    >
                                                        編集
                                                    </button>
                                                    <button
                                                        className="btn btn-xs btn-danger"
                                                        onClick={() => handleDelete(entry.id)}
                                                    >
                                                        削除
                                                    </button>
                                                </div>
                                            </td>
                                            {HIERARCHY_KEYS.map(key => (
                                                <td key={key}>{entry[key]}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredHierarchies.length === 0 && (
                                <div className="text-center text-muted" style={{ padding: '2rem' }}>
                                    データが見つかりません
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <HierarchyImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportComplete={loadHierarchies}
            />

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title={editingEntry.id ? "階層データ編集" : "階層データ新規登録"}
                size="xl"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                            キャンセル
                        </button>
                        <button className="btn btn-primary" onClick={handleSave}>
                            保存
                        </button>
                    </>
                }
            >
                <div className="grid grid-cols-2 gap-md">
                    {HIERARCHY_HEADERS.map((header, index) => {
                        const key = HIERARCHY_KEYS[index];
                        return (
                            <div key={key} className="form-group">
                                <label className="form-label">{header}</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={editingEntry[key] || ''}
                                    onChange={(e) => setEditingEntry({ ...editingEntry, [key]: e.target.value })}
                                />
                            </div>
                        );
                    })}
                </div>
            </Modal>
        </div>
    );
};
