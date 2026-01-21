// 棚割管理システム - 商品マスタ
import { useState, useEffect, useCallback } from 'react';
import type { Product } from '../../data/types';
import { productRepository } from '../../data/repositories/localStorageRepository';
import { Modal } from '../../components/common/Modal';
import { SizeInput } from '../../components/common/UnitInput';
import { DimensionDisplay } from '../../components/common/UnitDisplay';
import { ExcelImportModal } from '../../components/masters/ExcelImportModal';
import { BulkEditModal } from '../../components/masters/BulkEditModal';
import { exportProductsToCSV, calculateSalesRank } from '../../utils/excelUtils';
import { renderHierarchyLevel } from '../../utils/hierarchyHelpers';

// カテゴリ一覧
const CATEGORIES = [
    '焼肉セット',
    '精肉',
    '鮮魚',
    '野菜',
    '果物',
    '惣菜',
    '乳製品',
    '飲料',
    'パン',
    '菓子',
    '調味料',
    '冷凍食品'
];

interface ProductFormData extends Partial<Product> {
    jan: string;
    name: string;
    width: number;
    height: number;
    depth: number;
    category: string;
    imageUrl: string;
    salesRank: number;
}

const initialFormData: ProductFormData = {
    jan: '',
    name: '',
    width: 10,
    height: 15,
    depth: 8,
    category: CATEGORIES[0],
    imageUrl: '',
    salesRank: 50
};

export function ProductMaster() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState<ProductFormData>(initialFormData);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentTab, setCurrentTab] = useState<'basic' | 'hierarchy'>('basic');
    const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // データ読み込み
    const loadProducts = useCallback(async () => {
        setLoading(true);
        const data = await productRepository.getAll();
        // 売上ランク順にソート
        data.sort((a, b) => a.salesRank - b.salesRank);
        setProducts(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    // モーダルを開く（新規/編集）
    const openModal = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                jan: product.jan,
                name: product.name,
                width: product.width,
                height: product.height,
                depth: product.depth,
                category: product.category,
                imageUrl: product.imageUrl,
                salesRank: product.salesRank,
                divisionCode: product.divisionCode,
                divisionName: product.divisionName,
                divisionSubCode: product.divisionSubCode,
                divisionSubName: product.divisionSubName,
                lineCode: product.lineCode,
                lineName: product.lineName,
                departmentCode: product.departmentCode,
                departmentName: product.departmentName,
                categoryCode: product.categoryCode,
                categoryName: product.categoryName,
                subCategoryCode: product.subCategoryCode,
                subCategoryName: product.subCategoryName,
                segmentCode: product.segmentCode,
                segmentName: product.segmentName,
                subSegmentCode: product.subSegmentCode,
                subSegmentName: product.subSegmentName,
            });
        } else {
            setEditingProduct(null);
            setFormData(initialFormData);
        }
        setCurrentTab('basic');
        setIsModalOpen(true);
    };

    // 保存処理
    const handleSave = async () => {
        if (!formData.name || !formData.jan) {
            alert('商品名とJANコードは必須です');
            return;
        }

        if (editingProduct) {
            await productRepository.update(editingProduct.id, formData);
        } else {
            await productRepository.create(formData);
        }

        setIsModalOpen(false);
        loadProducts();
    };

    // 削除処理
    const handleDelete = async (id: string) => {
        if (confirm('この商品を削除しますか？')) {
            await productRepository.delete(id);
            loadProducts();
        }
    };

    // Excelインポート
    const handleImport = async (newProducts: Partial<Product>[], updateProducts: Partial<Product>[]) => {
        // 売上数量がある場合はランクを計算
        const allImportProducts = [...newProducts, ...updateProducts];
        const hasSalesQuantity = allImportProducts.some(p => p.salesQuantity !== undefined && p.salesQuantity !== null && String(p.salesQuantity).trim() !== '');

        let productsWithRank = allImportProducts;
        if (hasSalesQuantity) {
            // 売上数量からランクを計算
            productsWithRank = calculateSalesRank(allImportProducts);
        }

        // バッチサイズを設定（一度に処理する件数）
        const BATCH_SIZE = 100;
        const totalCount = productsWithRank.length;
        let processedCount = 0;

        // 新規商品と更新商品を分離（ランク計算後）
        const newProductsWithRank: Partial<Product>[] = [];
        const updateProductsWithRank: Partial<Product>[] = [];

        for (const product of productsWithRank) {
            const existingProduct = products.find(p => p.jan === product.jan);
            if (existingProduct) {
                updateProductsWithRank.push({ ...product, id: existingProduct.id });
            } else {
                newProductsWithRank.push(product);
            }
        }

        // バッチ処理で新規商品を作成
        for (let i = 0; i < newProductsWithRank.length; i += BATCH_SIZE) {
            const batch = newProductsWithRank.slice(i, i + BATCH_SIZE);

            // バッチ内の商品を並列処理
            await Promise.all(batch.map(async (product) => {
                const existingProduct = products.find(p => p.jan === product.jan);

                if (existingProduct) {
                    // 既に存在する場合は更新
                    await productRepository.update(existingProduct.id, {
                        ...product,
                        width: product.width || existingProduct.width,
                        height: product.height || existingProduct.height,
                        depth: product.depth || existingProduct.depth,
                        category: product.categoryName || product.category || existingProduct.category,
                        imageUrl: product.imageUrl || existingProduct.imageUrl,
                        salesRank: product.salesRank || existingProduct.salesRank,
                    });
                } else {
                    // 新規作成
                    await productRepository.create({
                        ...product,
                        width: product.width || 10,
                        height: product.height || 15,
                        depth: product.depth || 8,
                        category: product.categoryName || product.category || CATEGORIES[0],
                        imageUrl: product.imageUrl || '',
                        salesRank: product.salesRank || 50,
                    } as Omit<Product, 'id'>);
                }
            }));

            processedCount += batch.length;

            // 進捗をコンソールに表示（大量データの場合）
            if (totalCount > 500) {
                console.log(`インポート進捗: ${processedCount}/${totalCount} (${Math.round(processedCount / totalCount * 100)}%)`);
            }

            // UIの応答性を保つため、バッチ間で少し待機
            if (i + BATCH_SIZE < newProductsWithRank.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // バッチ処理で既存商品を更新
        for (let i = 0; i < updateProductsWithRank.length; i += BATCH_SIZE) {
            const batch = updateProductsWithRank.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (product) => {
                if (product.id) {
                    await productRepository.update(product.id, product);
                }
            }));

            processedCount += batch.length;

            if (totalCount > 500) {
                console.log(`インポート進捗: ${processedCount}/${totalCount} (${Math.round(processedCount / totalCount * 100)}%)`);
            }

            if (i + BATCH_SIZE < updateProductsWithRank.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        loadProducts();
    };

    // 一括編集
    const handleBulkEdit = async (updates: Partial<Product>) => {
        for (const id of selectedIds) {
            await productRepository.update(id, updates);
        }
        setSelectedIds(new Set());
        loadProducts();
    };

    // 全件データダウンロード(CSV)
    const handleDownloadAll = () => {
        const blob = exportProductsToCSV(products);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `商品マスタ_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 全件データ削除
    const handleDeleteAll = async () => {
        if (confirm('全ての商品データを削除します。この操作は取り消せません。本当に実行しますか?')) {
            if (confirm('最終確認: 本当に全商品データを削除しますか?')) {
                for (const product of products) {
                    await productRepository.delete(product.id);
                }
                loadProducts();
            }
        }
    };

    // 全選択/全解除
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredProducts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)));
        }
    };

    // 個別選択
    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    // フィルター適用
    const filteredProducts = products.filter(product => {
        const matchesSearch =
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.jan.includes(searchTerm) ||
            (product.divisionName && product.divisionName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (product.categoryName && product.categoryName.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = !filterCategory || product.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    // 階層グループの切り替え
    const toggleGroup = (groupKey: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupKey)) {
            newExpanded.delete(groupKey);
        } else {
            newExpanded.add(groupKey);
        }
        setExpandedGroups(newExpanded);
    };

    // 商品を階層的にグループ化（8階層）
    const groupProductsByHierarchy = (products: Product[]) => {
        type HierarchyLevel8 = Record<string, Product[]>;
        type HierarchyLevel7 = Record<string, HierarchyLevel8>;
        type HierarchyLevel6 = Record<string, HierarchyLevel7>;
        type HierarchyLevel5 = Record<string, HierarchyLevel6>;
        type HierarchyLevel4 = Record<string, HierarchyLevel5>;
        type HierarchyLevel3 = Record<string, HierarchyLevel4>;
        type HierarchyLevel2 = Record<string, HierarchyLevel3>;
        type HierarchyLevel1 = Record<string, HierarchyLevel2>;

        const grouped: HierarchyLevel1 = {};

        products.forEach(product => {
            const division = product.divisionName || '未分類';
            const divisionSub = product.divisionSubName || '未分類';
            const line = product.lineName || '未分類';
            const department = product.departmentName || '未分類';
            const category = product.categoryName || '未分類';
            const subCategory = product.subCategoryName || '未分類';
            const segment = product.segmentName || '未分類';
            const subSegment = product.subSegmentName || '未分類';

            if (!grouped[division]) grouped[division] = {};
            if (!grouped[division][divisionSub]) grouped[division][divisionSub] = {};
            if (!grouped[division][divisionSub][line]) grouped[division][divisionSub][line] = {};
            if (!grouped[division][divisionSub][line][department]) grouped[division][divisionSub][line][department] = {};
            if (!grouped[division][divisionSub][line][department][category]) grouped[division][divisionSub][line][department][category] = {};
            if (!grouped[division][divisionSub][line][department][category][subCategory]) grouped[division][divisionSub][line][department][category][subCategory] = {};
            if (!grouped[division][divisionSub][line][department][category][subCategory][segment]) grouped[division][divisionSub][line][department][category][subCategory][segment] = {};
            if (!grouped[division][divisionSub][line][department][category][subCategory][segment][subSegment]) grouped[division][divisionSub][line][department][category][subCategory][segment][subSegment] = [];

            grouped[division][divisionSub][line][department][category][subCategory][segment][subSegment].push(product);
        });

        return grouped;
    };

    // ランク表示用カラー
    const getRankColor = (rank: number) => {
        if (rank <= 10) return 'var(--color-success)';
        if (rank <= 30) return 'var(--color-primary)';
        if (rank <= 60) return 'var(--color-warning)';
        return 'var(--color-danger)';
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">商品マスタ</h1>
                <p className="page-subtitle">商品の登録・編集・売上ランク管理</p>
            </div>

            {/* ツールバー */}
            <div className="card mb-lg">
                <div className="flex items-center justify-between gap-md" style={{ flexWrap: 'wrap' }}>
                    <div className="flex gap-md items-center">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="商品名、JAN、事業部、カテゴリで検索..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '300px' }}
                        />
                        <select
                            className="form-select"
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                        >
                            <option value="">全カテゴリ</option>
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <div className="btn-group">
                            <button
                                className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setViewMode('table')}
                            >
                                📋 テーブル
                            </button>
                            <button
                                className={`btn btn-sm ${viewMode === 'hierarchy' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setViewMode('hierarchy')}
                            >
                                🌳 階層
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-sm">
                        {selectedIds.size > 0 && (
                            <button
                                className="btn btn-secondary"
                                onClick={() => setIsBulkEditModalOpen(true)}
                            >
                                ✏️ 一括編集 ({selectedIds.size})
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={handleDownloadAll}>
                            📥 全件データDL
                        </button>
                        <button className="btn btn-danger" onClick={handleDeleteAll}>
                            🗑️ 全件データ削除
                        </button>

                        <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}>
                            📤 CSVインポート
                        </button>
                        <button className="btn btn-primary" onClick={() => openModal()}>
                            ＋ 新規登録
                        </button>
                    </div>
                </div>
            </div>

            {/* 商品一覧 */}
            <div className="card">
                {loading ? (
                    <div className="text-center text-muted animate-pulse">読み込み中...</div>
                ) : viewMode === 'table' ? (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th style={{ width: '60px' }}>ランク</th>
                                    <th>JAN</th>
                                    <th>商品名</th>
                                    <th>カテゴリ</th>
                                    <th>事業部</th>
                                    <th>カテゴリ名</th>
                                    <th>セグメント名</th>
                                    <th>サイズ (W×H×D)</th>
                                    <th style={{ width: '120px' }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map(product => (
                                    <tr key={product.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(product.id)}
                                                onChange={() => toggleSelect(product.id)}
                                            />
                                        </td>
                                        <td>
                                            <span
                                                className="badge"
                                                style={{
                                                    backgroundColor: `${getRankColor(product.salesRank)}20`,
                                                    color: getRankColor(product.salesRank)
                                                }}
                                            >
                                                {product.salesRank}
                                            </span>
                                        </td>
                                        <td className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                                            {product.jan}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-sm">
                                                <img
                                                    src={product.imageUrl}
                                                    alt={product.name}
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        objectFit: 'cover',
                                                        borderRadius: 'var(--radius-sm)',
                                                        background: 'var(--bg-tertiary)'
                                                    }}
                                                />
                                                <span>{product.name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge badge-primary">{product.category}</span>
                                        </td>
                                        <td className="text-sm">{product.divisionName || '-'}</td>
                                        <td className="text-sm">{product.categoryName || '-'}</td>
                                        <td className="text-sm">{product.segmentName || '-'}</td>
                                        <td className="text-sm text-muted">
                                            <DimensionDisplay
                                                width={product.width}
                                                height={product.height}
                                                depth={product.depth}
                                            />
                                        </td>
                                        <td>
                                            <div className="flex gap-sm">
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => openModal(product)}
                                                >
                                                    編集
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDelete(product.id)}
                                                >
                                                    削除
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredProducts.length === 0 && (
                            <div className="text-center text-muted" style={{ padding: '2rem' }}>
                                商品が見つかりません
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ padding: '1rem' }}>
                        {renderHierarchyLevel(
                            groupProductsByHierarchy(filteredProducts),
                            0,
                            'root',
                            expandedGroups,
                            toggleGroup,
                            selectedIds,
                            toggleSelect,
                            getRankColor,
                            openModal
                        )}
                        <div className="text-sm text-muted mt-md">
                            {filteredProducts.length}件の商品
                        </div>
                    </div>
                )}
            </div>

            {/* 商品数表示 */}
            <div className="text-sm text-muted mt-md">
                {filteredProducts.length} / {products.length} 件表示
                {selectedIds.size > 0 && ` （${selectedIds.size}件選択中）`}
            </div>

            {/* 編集モーダル */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingProduct ? '商品編集' : '商品新規登録'}
                size="xl"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                            キャンセル
                        </button>
                        <button className="btn btn-primary" onClick={handleSave}>
                            保存
                        </button>
                    </>
                }
            >
                {/* タブ */}
                <div className="flex gap-sm mb-md" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <button
                        className={`btn btn-sm ${currentTab === 'basic' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCurrentTab('basic')}
                        style={{ borderRadius: '0', borderBottom: currentTab === 'basic' ? '2px solid var(--color-primary)' : 'none' }}
                    >
                        基本情報
                    </button>
                    <button
                        className={`btn btn-sm ${currentTab === 'hierarchy' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCurrentTab('hierarchy')}
                        style={{ borderRadius: '0', borderBottom: currentTab === 'hierarchy' ? '2px solid var(--color-primary)' : 'none' }}
                    >
                        組織階層情報
                    </button>
                </div>

                {currentTab === 'basic' ? (
                    <>
                        <div className="form-group">
                            <label className="form-label">JANコード *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.jan}
                                onChange={(e) => setFormData({ ...formData, jan: e.target.value })}
                                placeholder="4901234567890"
                                maxLength={13}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">商品名 *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="商品名を入力"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">カテゴリ</label>
                            <select
                                className="form-select"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <SizeInput
                            width={formData.width}
                            height={formData.height}
                            depth={formData.depth}
                            onChange={(size) => setFormData({
                                ...formData,
                                width: size.width,
                                height: size.height,
                                depth: size.depth || formData.depth
                            })}
                        />

                        <div className="form-group">
                            <label className="form-label">売上ランク (1-100, 1が最高)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.salesRank}
                                onChange={(e) => setFormData({ ...formData, salesRank: parseInt(e.target.value) || 50 })}
                                min={1}
                                max={100}
                            />
                            <div className="form-hint">
                                ランクが低いほど売上が高い商品です。自動化処理で優先度に影響します。
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">画像URL</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.imageUrl}
                                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                placeholder="https://example.com/image.jpg"
                            />
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                        {/* 事業部 */}
                        <div className="form-group">
                            <label className="form-label">事業部CD</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.divisionCode || ''}
                                onChange={(e) => setFormData({ ...formData, divisionCode: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">事業部</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.divisionName || ''}
                                onChange={(e) => setFormData({ ...formData, divisionName: e.target.value })}
                            />
                        </div>

                        {/* ディビジョン */}
                        <div className="form-group">
                            <label className="form-label">ディビジョンCD</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.divisionSubCode || ''}
                                onChange={(e) => setFormData({ ...formData, divisionSubCode: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ディビジョン名</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.divisionSubName || ''}
                                onChange={(e) => setFormData({ ...formData, divisionSubName: e.target.value })}
                            />
                        </div>

                        {/* ライン */}
                        <div className="form-group">
                            <label className="form-label">ラインCD</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.lineCode || ''}
                                onChange={(e) => setFormData({ ...formData, lineCode: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ライン名</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.lineName || ''}
                                onChange={(e) => setFormData({ ...formData, lineName: e.target.value })}
                            />
                        </div>

                        {/* 部門 */}
                        <div className="form-group">
                            <label className="form-label">部門CD</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.departmentCode || ''}
                                onChange={(e) => setFormData({ ...formData, departmentCode: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">部門名</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.departmentName || ''}
                                onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
                            />
                        </div>

                        {/* カテゴリー */}
                        <div className="form-group">
                            <label className="form-label">カテゴリーCD</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.categoryCode || ''}
                                onChange={(e) => setFormData({ ...formData, categoryCode: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">カテゴリ名</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.categoryName || ''}
                                onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                            />
                        </div>

                        {/* サブカテゴリー */}
                        <div className="form-group">
                            <label className="form-label">サブカテゴリーCD</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.subCategoryCode || ''}
                                onChange={(e) => setFormData({ ...formData, subCategoryCode: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">サブカテゴリ名</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.subCategoryName || ''}
                                onChange={(e) => setFormData({ ...formData, subCategoryName: e.target.value })}
                            />
                        </div>

                        {/* セグメント */}
                        <div className="form-group">
                            <label className="form-label">セグメントCD</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.segmentCode || ''}
                                onChange={(e) => setFormData({ ...formData, segmentCode: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">セグメント名</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.segmentName || ''}
                                onChange={(e) => setFormData({ ...formData, segmentName: e.target.value })}
                            />
                        </div>

                        {/* サブセグメント */}
                        <div className="form-group">
                            <label className="form-label">サブセグメントCD</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.subSegmentCode || ''}
                                onChange={(e) => setFormData({ ...formData, subSegmentCode: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">サブセグメント名</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.subSegmentName || ''}
                                onChange={(e) => setFormData({ ...formData, subSegmentName: e.target.value })}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* Excelインポートモーダル */}
            <ExcelImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
                existingProducts={products}
            />

            {/* 一括編集モーダル */}
            <BulkEditModal
                isOpen={isBulkEditModalOpen}
                onClose={() => setIsBulkEditModalOpen(false)}
                selectedProducts={products.filter(p => selectedIds.has(p.id))}
                onSave={handleBulkEdit}
            />
        </div>
    );
}
