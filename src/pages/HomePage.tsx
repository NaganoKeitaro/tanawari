// 棚割管理システム - ホームページ
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    productRepository,
    storeRepository,
    fixtureRepository,
    shelfBlockRepository,
    standardPlanogramRepository,
    storePlanogramRepository,
    isInitialized
} from '../data/repositories/localStorageRepository';
import { seedData } from '../data/seedData';

interface Stats {
    products: number;
    stores: number;
    fixtures: number;
    blocks: number;
    standardPlanograms: number;
    storePlanograms: number;
}

export function HomePage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [initialized, setInitialized] = useState(false);

    const loadStats = useCallback(async () => {
        const [products, stores, fixtures, blocks, standards, storePlans, init] = await Promise.all([
            productRepository.getAll(),
            storeRepository.getAll(),
            fixtureRepository.getAll(),
            shelfBlockRepository.getAll(),
            standardPlanogramRepository.getAll(),
            storePlanogramRepository.getAll(),
            isInitialized()
        ]);

        setStats({
            products: products.length,
            stores: stores.length,
            fixtures: fixtures.length,
            blocks: blocks.length,
            standardPlanograms: standards.length,
            storePlanograms: storePlans.length
        });
        setInitialized(init);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleSeedData = async () => {
        if (!confirm('ダミーデータを生成しますか？既存のデータはすべて削除されます。')) {
            return;
        }

        setSeeding(true);

        try {
            const result = await seedData();
            alert(`データ生成完了！
- 商品: ${result.products}件
- 店舗: ${result.stores}件
- 什器: ${result.fixtures}件`);
            await loadStats();
        } catch (error) {
            alert('データ生成中にエラーが発生しました');
            console.error(error);
        }

        setSeeding(false);
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
                <h1 className="page-title">棚割管理システム</h1>
                <p className="page-subtitle">Planogram Management System MVP</p>
            </div>

            {/* 初期化案内 */}
            {!initialized && (
                <div
                    className="card mb-lg"
                    style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(16, 185, 129, 0.2))',
                        borderColor: 'var(--color-primary)'
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 style={{ marginBottom: '0.5rem' }}>🚀 はじめに</h3>
                            <p className="text-sm text-muted">
                                システムを使用するには、まずダミーデータを生成してください。<br />
                                商品・店舗・什器のサンプルデータが自動生成されます。
                            </p>
                        </div>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleSeedData}
                            disabled={seeding}
                        >
                            {seeding ? '生成中...' : '📦 ダミーデータ生成'}
                        </button>
                    </div>
                </div>
            )}

            {/* 統計カード */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <Link to="/masters/products" className="card" style={{ textDecoration: 'none' }}>
                    <div className="flex items-center gap-md">
                        <div style={{ fontSize: '2rem' }}>📦</div>
                        <div>
                            <div className="text-sm text-muted">商品マスタ</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats?.products || 0}</div>
                        </div>
                    </div>
                </Link>

                <Link to="/masters/stores" className="card" style={{ textDecoration: 'none' }}>
                    <div className="flex items-center gap-md">
                        <div style={{ fontSize: '2rem' }}>🏪</div>
                        <div>
                            <div className="text-sm text-muted">店舗マスタ</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats?.stores || 0}</div>
                        </div>
                    </div>
                </Link>

                <Link to="/masters/fixtures" className="card" style={{ textDecoration: 'none' }}>
                    <div className="flex items-center gap-md">
                        <div style={{ fontSize: '2rem' }}>🗄️</div>
                        <div>
                            <div className="text-sm text-muted">棚マスタ</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats?.fixtures || 0}</div>
                        </div>
                    </div>
                </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <Link to="/blocks" className="card" style={{ textDecoration: 'none' }}>
                    <div className="flex items-center gap-md">
                        <div style={{ fontSize: '2rem' }}>🧱</div>
                        <div>
                            <div className="text-sm text-muted">棚ブロック</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats?.blocks || 0}</div>
                        </div>
                    </div>
                </Link>

                <Link to="/planogram/standard" className="card" style={{ textDecoration: 'none' }}>
                    <div className="flex items-center gap-md">
                        <div style={{ fontSize: '2rem' }}>📋</div>
                        <div>
                            <div className="text-sm text-muted">FMT標準棚割</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats?.standardPlanograms || 0}</div>
                        </div>
                    </div>
                </Link>

                <Link to="/planogram/store" className="card" style={{ textDecoration: 'none' }}>
                    <div className="flex items-center gap-md">
                        <div style={{ fontSize: '2rem' }}>🏬</div>
                        <div>
                            <div className="text-sm text-muted">個店棚割</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats?.storePlanograms || 0}</div>
                        </div>
                    </div>
                </Link>
            </div>

            {/* クイックアクション */}
            <div className="card">
                <h3 className="card-title mb-lg">🎯 ワークフロー</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                    <div>
                        <h4 style={{ marginBottom: '0.75rem', color: 'var(--color-primary)' }}>
                            Step 1: マスタ設定
                        </h4>
                        <ol style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                            <li>商品マスタを登録（売上ランク付与）</li>
                            <li>棚マスタで什器を登録</li>
                            <li>店舗マスタで店舗情報を登録</li>
                            <li>店舗棚尺マスタで什器を配置</li>
                        </ol>
                    </div>
                    <div>
                        <h4 style={{ marginBottom: '0.75rem', color: 'var(--color-secondary)' }}>
                            Step 2: 棚割作成
                        </h4>
                        <ol style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                            <li>棚ブロックで商品グループを作成</li>
                            <li>FMT標準棚割でブロックを配置</li>
                            <li>個店棚割で一括自動生成</li>
                            <li>必要に応じて個店を手動調整</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* ルール説明 */}
            <div className="card mt-lg" style={{ background: 'var(--bg-glass)' }}>
                <h3 className="card-title mb-md">📐 自動調整ルール</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                    <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="text-sm" style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: '0.5rem' }}>
                            ルールA: カット
                        </div>
                        <div className="text-xs text-muted">
                            店舗棚 &lt; 標準棚の場合、売上ランクが低い商品から<br />
                            フェイス数削減 → 最小1 → 商品カット
                        </div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="text-sm" style={{ fontWeight: 600, color: 'var(--color-success)', marginBottom: '0.5rem' }}>
                            ルールB: 拡張
                        </div>
                        <div className="text-xs text-muted">
                            店舗棚 &gt; 標準棚の場合、売上ランク上位10商品の<br />
                            フェイスを2倍 → 1.5倍 → 余白として残す
                        </div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="text-sm" style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                            ルールC: 同期
                        </div>
                        <div className="text-xs text-muted">
                            標準棚割が更新された場合、個店で「同期」ボタンを<br />
                            押すと最新の親の状態でルールA/Bを再適用
                        </div>
                    </div>
                </div>
            </div>

            {/* ダミーデータ再生成（初期化済みの場合） */}
            {initialized && (
                <div className="text-right mt-lg">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleSeedData}
                        disabled={seeding}
                    >
                        {seeding ? '生成中...' : '🔄 データ再生成'}
                    </button>
                </div>
            )}

            {/* 単位説明 */}
            <div className="card mt-lg" style={{ background: 'var(--bg-glass)' }}>
                <div className="flex items-center gap-lg">
                    <div>
                        <span style={{ fontWeight: 600 }}>📏 単位</span>
                        <span className="text-sm text-muted" style={{ marginLeft: '0.5rem' }}>
                            1尺 = 30cm
                        </span>
                    </div>
                    <div className="text-sm text-muted">
                        すべてのサイズはcm/尺を併記表示。入力時はどちらの単位でも対応。
                    </div>
                </div>
            </div>
        </div>
    );
}
