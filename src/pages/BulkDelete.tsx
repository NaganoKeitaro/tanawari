// 棚割管理システム - データ一括削除
import { useState, useEffect, useCallback } from 'react';
import {
    productRepository,
    storeRepository,
    fixtureRepository,
    storeFixturePlacementRepository,
    standardPlanogramRepository,
    storePlanogramRepository
} from '../data/repositories/repositoryFactory';

interface DataCount {
    stores: number;
    products: number;
    storeFixtures: number;
    fixtures: number;
    standardPlanograms: number;
    storePlanograms: number;
}

type MasterKey = 'stores' | 'products' | 'storeFixtures' | 'fixtures';
type PlanogramKey = 'standardPlanograms' | 'storePlanograms';

const MASTER_ITEMS: { key: MasterKey; label: string; icon: string }[] = [
    { key: 'stores', label: '店舗マスタ', icon: '🏪' },
    { key: 'products', label: '商品マスタ', icon: '📦' },
    { key: 'storeFixtures', label: '棚尺マスタ', icon: '📐' },
    { key: 'fixtures', label: '棚マスタ', icon: '🗄️' },
];

const PLANOGRAM_ITEMS: { key: PlanogramKey; label: string; icon: string }[] = [
    { key: 'standardPlanograms', label: '標準棚割', icon: '📋' },
    { key: 'storePlanograms', label: '個店棚割', icon: '🏬' },
];

export function BulkDelete() {
    const [counts, setCounts] = useState<DataCount>({
        stores: 0, products: 0, storeFixtures: 0, fixtures: 0,
        standardPlanograms: 0, storePlanograms: 0
    });
    const [selectedMasters, setSelectedMasters] = useState<Set<MasterKey>>(new Set());
    const [selectedPlanograms, setSelectedPlanograms] = useState<Set<PlanogramKey>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadCounts = useCallback(async () => {
        setLoading(true);
        const [stores, products, storeFixtures, fixtures, standards, storePlans] = await Promise.all([
            storeRepository.getAll(),
            productRepository.getAll(),
            storeFixturePlacementRepository.getAll(),
            fixtureRepository.getAll(),
            standardPlanogramRepository.getAll(),
            storePlanogramRepository.getAll(),
        ]);
        setCounts({
            stores: stores.length,
            products: products.length,
            storeFixtures: storeFixtures.length,
            fixtures: fixtures.length,
            standardPlanograms: standards.length,
            storePlanograms: storePlans.length,
        });
        setLoading(false);
    }, []);

    useEffect(() => { loadCounts(); }, [loadCounts]);

    const toggleMaster = (key: MasterKey) => {
        setSelectedMasters(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const togglePlanogram = (key: PlanogramKey) => {
        setSelectedPlanograms(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const handleDeleteMasters = async () => {
        if (selectedMasters.size === 0) {
            alert('削除するマスタを選択してください');
            return;
        }
        const labels = MASTER_ITEMS.filter(m => selectedMasters.has(m.key)).map(m => m.label).join('、');
        if (!confirm(`以下のマスタを全件削除します。この操作は取り消せません。\n\n${labels}\n\n本当に実行しますか？`)) return;

        setDeleting(true);
        try {
            const repoMap: Record<MasterKey, { clear: () => Promise<void> }> = {
                stores: storeRepository,
                products: productRepository,
                storeFixtures: storeFixturePlacementRepository,
                fixtures: fixtureRepository,
            };
            for (const key of selectedMasters) {
                await repoMap[key].clear();
            }
            alert('削除が完了しました');
            setSelectedMasters(new Set());
            await loadCounts();
        } catch (e) {
            console.error(e);
            alert('削除中にエラーが発生しました');
        }
        setDeleting(false);
    };

    const handleDeletePlanograms = async () => {
        if (selectedPlanograms.size === 0) {
            alert('削除する棚割を選択してください');
            return;
        }
        const labels = PLANOGRAM_ITEMS.filter(p => selectedPlanograms.has(p.key)).map(p => p.label).join('、');
        if (!confirm(`以下の棚割を全件削除します。この操作は取り消せません。\n\n${labels}\n\n本当に実行しますか？`)) return;

        setDeleting(true);
        try {
            const repoMap: Record<PlanogramKey, { clear: () => Promise<void> }> = {
                standardPlanograms: standardPlanogramRepository,
                storePlanograms: storePlanogramRepository,
            };
            for (const key of selectedPlanograms) {
                await repoMap[key].clear();
            }
            alert('削除が完了しました');
            setSelectedPlanograms(new Set());
            await loadCounts();
        } catch (e) {
            console.error(e);
            alert('削除中にエラーが発生しました');
        }
        setDeleting(false);
    };

    if (loading) {
        return (
            <div className="animate-fadeIn">
                <div className="text-center text-muted animate-pulse" style={{ padding: '4rem' }}>
                    読み込み中...
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">データ一括削除</h1>
                <p className="page-subtitle">マスタデータおよび棚割データの一括削除</p>
            </div>

            {/* 注意書き */}
            <div
                className="card mb-lg"
                style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.1))',
                    borderColor: 'var(--color-danger)'
                }}
            >
                <div className="flex items-center gap-md">
                    <div style={{ fontSize: '2rem' }}>⚠️</div>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: '0.25rem' }}>
                            ご注意ください
                        </div>
                        <div className="text-sm text-muted">
                            一括削除を実行すると、選択したデータがすべて削除されます。<br />
                            この操作は取り消すことができません。削除前に必要なデータはエクスポートしてください。
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* マスタ関連削除 */}
                <div className="card">
                    <h3 className="card-title mb-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🗂️</span> マスタ関連削除
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        {MASTER_ITEMS.map(item => (
                            <label
                                key={item.key}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid',
                                    borderColor: selectedMasters.has(item.key) ? 'var(--color-danger)' : 'var(--border-color)',
                                    background: selectedMasters.has(item.key)
                                        ? 'rgba(239, 68, 68, 0.08)'
                                        : 'var(--bg-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    userSelect: 'none'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedMasters.has(item.key)}
                                    onChange={() => toggleMaster(item.key)}
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--color-danger)' }}
                                />
                                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                                <span style={{ flex: 1, fontWeight: 500 }}>{item.label}</span>
                                <span
                                    className="badge"
                                    style={{
                                        backgroundColor: counts[item.key] > 0 ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                                        color: counts[item.key] > 0 ? 'var(--color-primary)' : 'var(--text-muted)'
                                    }}
                                >
                                    {counts[item.key]}件
                                </span>
                            </label>
                        ))}
                    </div>
                    <button
                        className="btn btn-danger"
                        style={{ width: '100%' }}
                        onClick={handleDeleteMasters}
                        disabled={deleting || selectedMasters.size === 0}
                    >
                        {deleting ? '削除中...' : `🗑️ 選択したマスタを削除${selectedMasters.size > 0 ? ` (${selectedMasters.size}件選択中)` : ''}`}
                    </button>
                </div>

                {/* 棚割削除 */}
                <div className="card">
                    <h3 className="card-title mb-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📐</span> 棚割削除
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        {PLANOGRAM_ITEMS.map(item => (
                            <label
                                key={item.key}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid',
                                    borderColor: selectedPlanograms.has(item.key) ? 'var(--color-danger)' : 'var(--border-color)',
                                    background: selectedPlanograms.has(item.key)
                                        ? 'rgba(239, 68, 68, 0.08)'
                                        : 'var(--bg-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    userSelect: 'none'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedPlanograms.has(item.key)}
                                    onChange={() => togglePlanogram(item.key)}
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--color-danger)' }}
                                />
                                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                                <span style={{ flex: 1, fontWeight: 500 }}>{item.label}</span>
                                <span
                                    className="badge"
                                    style={{
                                        backgroundColor: counts[item.key] > 0 ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                                        color: counts[item.key] > 0 ? 'var(--color-primary)' : 'var(--text-muted)'
                                    }}
                                >
                                    {counts[item.key]}件
                                </span>
                            </label>
                        ))}
                    </div>
                    <button
                        className="btn btn-danger"
                        style={{ width: '100%' }}
                        onClick={handleDeletePlanograms}
                        disabled={deleting || selectedPlanograms.size === 0}
                    >
                        {deleting ? '削除中...' : `🗑️ 選択した棚割を削除${selectedPlanograms.size > 0 ? ` (${selectedPlanograms.size}件選択中)` : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
