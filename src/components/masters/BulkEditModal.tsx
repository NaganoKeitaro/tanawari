// 棚割管理システム - 一括編集モーダル
import { useState } from 'react';
import { Modal } from '../common/Modal';
import type { Product } from '../../data/types';

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedProducts: Product[];
    onSave: (updates: Partial<Product>) => Promise<void>;
}

export function BulkEditModal({
    isOpen,
    onClose,
    selectedProducts,
    onSave
}: BulkEditModalProps) {
    const [formData, setFormData] = useState<Partial<Product>>({});
    const [saving, setSaving] = useState(false);

    // 保存処理
    const handleSave = async () => {
        // 変更がない場合は何もしない
        if (Object.keys(formData).length === 0) {
            alert('変更する項目を入力してください');
            return;
        }

        setSaving(true);
        try {
            await onSave(formData);
            handleClose();
        } catch (error) {
            alert('保存に失敗しました: ' + (error as Error).message);
        } finally {
            setSaving(false);
        }
    };

    // モーダルを閉じる
    const handleClose = () => {
        setFormData({});
        onClose();
    };

    // フィールド更新
    const updateField = (field: keyof Product, value: string) => {
        if (value === '') {
            // 空文字の場合は削除
            const newData = { ...formData };
            delete newData[field];
            setFormData(newData);
        } else {
            setFormData({ ...formData, [field]: value });
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="一括編集"
            size="lg"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={handleClose} disabled={saving}>
                        キャンセル
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? '保存中...' : `${selectedProducts.length}件を更新`}
                    </button>
                </>
            }
        >
            <div>
                <div className="mb-md">
                    <div className="card" style={{ background: 'var(--bg-secondary)', padding: '1rem' }}>
                        <div className="text-sm">
                            <strong>{selectedProducts.length}件</strong>の商品を一括編集します
                        </div>
                        <div className="text-xs text-muted mt-sm">
                            入力した項目のみが更新されます。空欄の項目は変更されません。
                        </div>
                    </div>
                </div>

                {/* 選択商品一覧 */}
                <div className="mb-lg">
                    <h4 className="mb-sm">選択中の商品</h4>
                    <div
                        className="card"
                        style={{
                            background: 'var(--bg-secondary)',
                            padding: '0.5rem',
                            maxHeight: '120px',
                            overflow: 'auto'
                        }}
                    >
                        {selectedProducts.map((product, idx) => (
                            <div key={product.id} className="text-sm" style={{ padding: '0.25rem' }}>
                                {idx + 1}. {product.name} ({product.jan})
                            </div>
                        ))}
                    </div>
                </div>

                {/* 編集フォーム */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                    {/* 事業部情報 */}
                    <div className="form-group">
                        <label className="form-label">事業部CD</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.divisionCode || ''}
                            onChange={(e) => updateField('divisionCode', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">事業部</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.divisionName || ''}
                            onChange={(e) => updateField('divisionName', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    {/* ディビジョン情報 */}
                    <div className="form-group">
                        <label className="form-label">ディビジョンCD</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.divisionSubCode || ''}
                            onChange={(e) => updateField('divisionSubCode', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">ディビジョン名</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.divisionSubName || ''}
                            onChange={(e) => updateField('divisionSubName', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    {/* ライン情報 */}
                    <div className="form-group">
                        <label className="form-label">ラインCD</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.lineCode || ''}
                            onChange={(e) => updateField('lineCode', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">ライン名</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.lineName || ''}
                            onChange={(e) => updateField('lineName', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    {/* 部門情報 */}
                    <div className="form-group">
                        <label className="form-label">部門CD</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.departmentCode || ''}
                            onChange={(e) => updateField('departmentCode', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">部門名</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.departmentName || ''}
                            onChange={(e) => updateField('departmentName', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    {/* カテゴリー情報 */}
                    <div className="form-group">
                        <label className="form-label">カテゴリーCD</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.categoryCode || ''}
                            onChange={(e) => updateField('categoryCode', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">カテゴリ名</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.categoryName || ''}
                            onChange={(e) => updateField('categoryName', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    {/* サブカテゴリー情報 */}
                    <div className="form-group">
                        <label className="form-label">サブカテゴリーCD</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.subCategoryCode || ''}
                            onChange={(e) => updateField('subCategoryCode', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">サブカテゴリ名</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.subCategoryName || ''}
                            onChange={(e) => updateField('subCategoryName', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    {/* セグメント情報 */}
                    <div className="form-group">
                        <label className="form-label">セグメントCD</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.segmentCode || ''}
                            onChange={(e) => updateField('segmentCode', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">セグメント名</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.segmentName || ''}
                            onChange={(e) => updateField('segmentName', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    {/* サブセグメント情報 */}
                    <div className="form-group">
                        <label className="form-label">サブセグメントCD</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.subSegmentCode || ''}
                            onChange={(e) => updateField('subSegmentCode', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">サブセグメント名</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.subSegmentName || ''}
                            onChange={(e) => updateField('subSegmentName', e.target.value)}
                            placeholder="変更しない"
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
