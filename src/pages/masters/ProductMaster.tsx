// 棚割管理システム - 商品マスタ
import { useState, useEffect, useCallback } from 'react';
import type { Product } from '../../data/types';
// import { SHAKU_TO_CM } from '../../data/types';
import { productRepository } from '../../data/repositories/localStorageRepository';
import { Modal } from '../../components/common/Modal';
import { SizeInput } from '../../components/common/UnitInput';
import { DimensionDisplay } from '../../components/common/UnitDisplay';

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

interface ProductFormData {
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
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState<ProductFormData>(initialFormData);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('');

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
                salesRank: product.salesRank
            });
        } else {
            setEditingProduct(null);
            setFormData(initialFormData);
        }
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

    // フィルター適用
    const filteredProducts = products.filter(product => {
        const matchesSearch =
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.jan.includes(searchTerm);
        const matchesCategory = !filterCategory || product.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

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
                            placeholder="商品名またはJANで検索..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '250px' }}
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
                    </div>
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        ＋ 新規登録
                    </button>
                </div>
            </div>

            {/* 商品一覧 */}
            <div className="card">
                {loading ? (
                    <div className="text-center text-muted animate-pulse">読み込み中...</div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>ランク</th>
                                    <th>JAN</th>
                                    <th>商品名</th>
                                    <th>カテゴリ</th>
                                    <th>サイズ (W×H×D)</th>
                                    <th style={{ width: '120px' }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map(product => (
                                    <tr key={product.id}>
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
                )}
            </div>

            {/* 商品数表示 */}
            <div className="text-sm text-muted mt-md">
                {filteredProducts.length} / {products.length} 件表示
            </div>

            {/* 編集モーダル */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingProduct ? '商品編集' : '商品新規登録'}
                size="lg"
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
            </Modal>
        </div>
    );
}
