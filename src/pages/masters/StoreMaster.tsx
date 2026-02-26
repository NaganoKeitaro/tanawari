// 棚割管理システム - 店舗マスタ
import { useState, useEffect, useCallback } from 'react';
import type { Store, FMT, Region } from '../../data/types';
import { REGIONS, FMTS } from '../../data/types';
import { storeRepository } from '../../data/repositories/supabaseRepository';
import { Modal } from '../../components/common/Modal';

interface StoreFormData {
    code: string;
    name: string;
    fmt: FMT;
    region: Region;
}

const initialFormData: StoreFormData = {
    code: '',
    name: '',
    fmt: FMTS[0],
    region: REGIONS[0]
};

export function StoreMaster() {
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<Store | null>(null);
    const [formData, setFormData] = useState<StoreFormData>(initialFormData);
    const [filterFmt, setFilterFmt] = useState<string>('');
    const [filterRegion, setFilterRegion] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // データ読み込み
    const loadStores = useCallback(async () => {
        setLoading(true);
        const data = await storeRepository.getAll();
        // 店舗コード順にソート
        data.sort((a, b) => a.code.localeCompare(b.code));
        setStores(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadStores();
    }, [loadStores]);

    // モーダルを開く
    const openModal = (store?: Store) => {
        if (store) {
            setEditingStore(store);
            setFormData({
                code: store.code,
                name: store.name,
                fmt: store.fmt,
                region: store.region
            });
        } else {
            setEditingStore(null);
            setFormData(initialFormData);
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.code || !formData.name) {
            alert('店舗コードと店舗名は必須です');
            return;
        }

        const optimisticStore: Store = {
            id: editingStore ? editingStore.id : crypto.randomUUID(),
            ...formData
        };

        setIsModalOpen(false);
        setStores(prev => {
            let nextNodes;
            if (editingStore) {
                nextNodes = prev.map(s => s.id === optimisticStore.id ? optimisticStore : s);
            } else {
                nextNodes = [...prev, optimisticStore];
            }
            return nextNodes.sort((a, b) => a.code.localeCompare(b.code));
        });

        try {
            if (editingStore) {
                await storeRepository.update(editingStore.id, formData);
            } else {
                await storeRepository.create(formData);
            }
        } catch (error) {
            console.error('Save failed', error);
            alert('保存に失敗しました。画面をリロードしてください。');
            loadStores();
        }
    };

    // 削除処理
    const handleDelete = async (id: string) => {
        if (confirm('この店舗を削除しますか？')) {
            await storeRepository.delete(id);
            loadStores();
        }
    };

    // フィルター適用
    const filteredStores = stores.filter(store => {
        const matchesSearch =
            store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            store.code.includes(searchTerm);
        const matchesFmt = !filterFmt || store.fmt === filterFmt;
        const matchesRegion = !filterRegion || store.region === filterRegion;
        return matchesSearch && matchesFmt && matchesRegion;
    });

    // FMTごとの店舗数
    const fmtCounts = FMTS.reduce((acc, fmt) => {
        acc[fmt] = stores.filter(s => s.fmt === fmt).length;
        return acc;
    }, {} as Record<string, number>);

    // FMTのカラー
    const getFmtColor = (fmt: FMT) => {
        const colors: Record<FMT, string> = {
            'MEGA': 'var(--color-primary)',
            'SuC': 'var(--color-success)',
            'SMART': 'var(--color-warning)',
            'GO': 'var(--color-secondary)',
            'FC': 'var(--color-info)'
        };
        return colors[fmt];
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">店舗マスタ</h1>
                <p className="page-subtitle">店舗の地域・FMT情報を管理</p>
            </div>

            {/* FMT別サマリー */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {FMTS.map(fmt => (
                    <div
                        key={fmt}
                        className="card"
                        style={{
                            cursor: 'pointer',
                            borderColor: filterFmt === fmt ? getFmtColor(fmt) : 'var(--border-color)',
                            transition: 'all var(--transition-fast)'
                        }}
                        onClick={() => setFilterFmt(filterFmt === fmt ? '' : fmt)}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm text-muted">FMT</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: getFmtColor(fmt) }}>
                                    {fmt}
                                </div>
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                {fmtCounts[fmt]}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ツールバー */}
            <div className="card mb-lg">
                <div className="flex items-center justify-between gap-md" style={{ flexWrap: 'wrap' }}>
                    <div className="flex gap-md items-center">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="店舗名またはコードで検索..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '220px' }}
                        />
                        <select
                            className="form-select"
                            value={filterRegion}
                            onChange={(e) => setFilterRegion(e.target.value)}
                        >
                            <option value="">全地域</option>
                            {REGIONS.filter(r => r !== '全地域').map(region => (
                                <option key={region} value={region}>{region}</option>
                            ))}
                        </select>
                        {(filterFmt || filterRegion) && (
                            <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => { setFilterFmt(''); setFilterRegion(''); }}
                            >
                                フィルタークリア
                            </button>
                        )}
                    </div>
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        ＋ 新規登録
                    </button>
                </div>
            </div>

            {/* 店舗一覧 */}
            <div className="card">
                {loading ? (
                    <div className="text-center text-muted animate-pulse">読み込み中...</div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>店舗コード</th>
                                    <th>店舗名</th>
                                    <th>FMT</th>
                                    <th>地域</th>
                                    <th style={{ width: '120px' }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStores.map(store => (
                                    <tr key={store.id}>
                                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                                            {store.code}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-sm">
                                                <span style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '28px',
                                                    height: '28px',
                                                    background: `${getFmtColor(store.fmt)}20`,
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '0.875rem'
                                                }}>
                                                    🏪
                                                </span>
                                                <span>{store.name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className="badge"
                                                style={{
                                                    backgroundColor: `${getFmtColor(store.fmt)}20`,
                                                    color: getFmtColor(store.fmt)
                                                }}
                                            >
                                                {store.fmt}
                                            </span>
                                        </td>
                                        <td className="text-sm">{store.region}</td>
                                        <td>
                                            <div className="flex gap-sm">
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => openModal(store)}
                                                >
                                                    編集
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDelete(store.id)}
                                                >
                                                    削除
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredStores.length === 0 && (
                            <div className="text-center text-muted" style={{ padding: '2rem' }}>
                                店舗が見つかりません
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 店舗数表示 */}
            <div className="text-sm text-muted mt-md">
                {filteredStores.length} / {stores.length} 件表示
            </div>

            {/* 編集モーダル */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingStore ? '店舗編集' : '店舗新規登録'}
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
                    <label className="form-label">店舗コード *</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="ME0001"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">店舗名 *</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="渋谷MEGA店"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">FMT</label>
                    <select
                        className="form-select"
                        value={formData.fmt}
                        onChange={(e) => setFormData({ ...formData, fmt: e.target.value as FMT })}
                    >
                        {FMTS.map(fmt => (
                            <option key={fmt} value={fmt}>{fmt}</option>
                        ))}
                    </select>
                    <div className="form-hint">
                        MEGA: 大型店 / SuC: スーパーセンター / SMART: 中型店 / GO: 小型店
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">地域</label>
                    <select
                        className="form-select"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value as Region })}
                    >
                        {REGIONS.filter(r => r !== '全地域').map(region => (
                            <option key={region} value={region}>{region}</option>
                        ))}
                    </select>
                </div>
            </Modal>
        </div>
    );
}
