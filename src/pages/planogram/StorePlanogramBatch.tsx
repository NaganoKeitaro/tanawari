// 棚割管理システム - 個店棚割管理（一括生成・個店編集）
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type {
    Store,
    StandardPlanogram,
    StorePlanogram,
    FMT,
    Region,
    GenerationResult
} from '../../data/types';
import { FMTS, REGIONS } from '../../data/types';
import {
    storeRepository,
    standardPlanogramRepository,
    storePlanogramRepository
} from '../../data/repositories/localStorageRepository';
import { batchGenerateStorePlanograms } from '../../services/automationService';

type TabType = 'batch' | 'individual';

export function StorePlanogramBatch() {
    const [stores, setStores] = useState<Store[]>([]);
    const [planograms, setPlanograms] = useState<StandardPlanogram[]>([]);
    const [storePlanograms, setStorePlanograms] = useState<StorePlanogram[]>([]);
    const [loading, setLoading] = useState(true);

    // タブ状態
    const [activeTab, setActiveTab] = useState<TabType>('individual');

    // 一括生成用State
    const [selectedFmt, setSelectedFmt] = useState<FMT | ''>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState<GenerationResult[]>([]);

    // 個店編集用State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterFmt, setFilterFmt] = useState<FMT | ''>('');
    const [filterRegion, setFilterRegion] = useState<Region | ''>('');

    // データ読み込み
    const loadData = useCallback(async () => {
        setLoading(true);
        const [storesData, planogramsData, storePlanogramsData] = await Promise.all([
            storeRepository.getAll(),
            standardPlanogramRepository.getAll(),
            storePlanogramRepository.getAll()
        ]);
        setStores(storesData);
        setPlanograms(planogramsData);
        setStorePlanograms(storePlanogramsData);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // 一括生成実行
    const handleGenerate = async () => {
        if (!selectedFmt) {
            alert('FMTを選択してください');
            return;
        }

        const targetPlanograms = planograms.filter(p => p.fmt === selectedFmt);
        if (targetPlanograms.length === 0) {
            alert('このFMTの標準棚割がありません。先に標準棚割を作成してください。');
            return;
        }

        const targetStores = stores.filter(s => s.fmt === selectedFmt);
        if (targetStores.length === 0) {
            alert('このFMTに該当する店舗がありません');
            return;
        }

        if (!confirm(`${selectedFmt}の${targetStores.length}店舗に対して、${targetPlanograms.length}種類の棚割を一括で提案作成（更新）しますか？`)) {
            return;
        }

        setIsGenerating(true);
        // 総処理数は 店舗数 × 標準棚割数
        const totalOps = targetStores.length * targetPlanograms.length;
        setProgress({ current: 0, total: totalOps });
        setResults([]);

        let completedOps = 0;

        for (const std of targetPlanograms) {
            await batchGenerateStorePlanograms(std, (_c, _t, result) => {
                completedOps++;
                setProgress({ current: completedOps, total: totalOps });
                setResults(prev => [...prev, result]);
            });
        }

        setIsGenerating(false);
        // 生成後にデータを再読み込み
        await loadData();
    };

    // ステータスでグループ化
    const groupedResults = {
        generated: results.filter(r => r.status === 'generated'),
        warning: results.filter(r => r.status === 'warning'),
        error: results.filter(r => r.status === 'error')
    };

    // FMT別の店舗数と標準棚割有無
    const fmtStats = FMTS.map(fmt => ({
        fmt,
        storeCount: stores.filter(s => s.fmt === fmt).length,
        hasPlanogram: planograms.some(p => p.fmt === fmt)
    }));

    // 店舗と棚割ステータスの結合
    const storesWithStatus = useMemo(() => {
        return stores.map(store => {
            const storePlanogram = storePlanograms.find(sp => sp.storeId === store.id);
            return {
                ...store,
                planogramStatus: storePlanogram?.status || null,
                hasWarnings: (storePlanogram?.warnings?.length || 0) > 0,
                planogramId: storePlanogram?.id || null
            };
        });
    }, [stores, storePlanograms]);

    // フィルタリングされた店舗一覧
    const filteredStores = useMemo(() => {
        return storesWithStatus.filter(store => {
            // FMTフィルター
            if (filterFmt && store.fmt !== filterFmt) return false;
            // リージョンフィルター
            if (filterRegion && store.region !== filterRegion) return false;
            // 検索クエリ
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesCode = store.code.toLowerCase().includes(query);
                const matchesName = store.name.toLowerCase().includes(query);
                if (!matchesCode && !matchesName) return false;
            }
            return true;
        });
    }, [storesWithStatus, filterFmt, filterRegion, searchQuery]);

    // ステータス別の件数
    const statusCounts = useMemo(() => {
        return {
            total: storesWithStatus.length,
            generated: storesWithStatus.filter(s => s.planogramStatus === 'generated' || s.planogramStatus === 'synced').length,
            warning: storesWithStatus.filter(s => s.planogramStatus === 'warning' || s.hasWarnings).length,
            notGenerated: storesWithStatus.filter(s => !s.planogramStatus).length
        };
    }, [storesWithStatus]);

    if (loading) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header">
                    <h1 className="page-title">個店棚割管理</h1>
                </div>
                <div className="text-center text-muted animate-pulse">読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">個店棚割管理</h1>
                <p className="page-subtitle">自動棚割提案または個別店舗の棚割編集</p>
            </div>

            {/* タブ切り替え */}
            <div className="card mb-lg" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                    <button
                        className={`btn ${activeTab === 'batch' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                            flex: 1,
                            borderRadius: 0,
                            borderRight: '1px solid var(--border-color)',
                            padding: '1rem',
                            fontSize: '1rem'
                        }}
                        onClick={() => setActiveTab('batch')}
                    >
                        🚀 自動棚割提案
                    </button>
                    <button
                        className={`btn ${activeTab === 'individual' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                            flex: 1,
                            borderRadius: 0,
                            padding: '1rem',
                            fontSize: '1rem'
                        }}
                        onClick={() => setActiveTab('individual')}
                    >
                        ✏️ 個店編集
                    </button>
                </div>

                {/* ステータスサマリー */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', padding: '1rem', background: 'var(--bg-secondary)' }}>
                    <div className="text-center">
                        <div className="text-lg" style={{ fontWeight: 600 }}>{statusCounts.total}</div>
                        <div className="text-xs text-muted">全店舗</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg" style={{ fontWeight: 600, color: 'var(--color-success)' }}>{statusCounts.generated}</div>
                        <div className="text-xs text-muted">生成済み</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg" style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{statusCounts.warning}</div>
                        <div className="text-xs text-muted">警告あり</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{statusCounts.notGenerated}</div>
                        <div className="text-xs text-muted">未生成</div>
                    </div>
                </div>
            </div>

            {/* 一括自動生成タブ */}
            {activeTab === 'batch' && (
                <>
                    {/* FMT選択 */}
                    <div className="card mb-lg">
                        <div className="flex items-center gap-lg" style={{ flexWrap: 'wrap' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">処理対象FMT</label>
                                <select
                                    className="form-select"
                                    value={selectedFmt}
                                    onChange={(e) => setSelectedFmt(e.target.value as FMT | '')}
                                    disabled={isGenerating}
                                >
                                    <option value="">FMTを選択...</option>
                                    {FMTS.map(fmt => (
                                        <option key={fmt} value={fmt}>{fmt}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedFmt && (
                                <div>
                                    <div className="text-sm">
                                        対象店舗: <strong>{stores.filter(s => s.fmt === selectedFmt).length}</strong>店舗
                                    </div>
                                    <div className="text-xs text-muted">
                                        {planograms.find(p => p.fmt === selectedFmt)
                                            ? '✓ 標準棚割あり'
                                            : '⚠️ 標準棚割なし'}
                                    </div>
                                </div>
                            )}

                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleGenerate}
                                disabled={isGenerating || !selectedFmt}
                                style={{ marginLeft: 'auto' }}
                            >
                                {isGenerating ? '生成中...' : '🚀 自動棚割提案を作成'}
                            </button>
                        </div>
                    </div>

                    {/* FMT別サマリー */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {fmtStats.map(stat => (
                            <div
                                key={stat.fmt}
                                className="card"
                                style={{
                                    cursor: 'pointer',
                                    borderColor: selectedFmt === stat.fmt ? 'var(--color-primary)' : 'var(--border-color)'
                                }}
                                onClick={() => setSelectedFmt(stat.fmt)}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-lg" style={{ fontWeight: 600 }}>{stat.fmt}</div>
                                        <div className="text-sm text-muted">{stat.storeCount} 店舗</div>
                                    </div>
                                    <div>
                                        {stat.hasPlanogram ? (
                                            <span className="badge badge-success">標準棚割あり</span>
                                        ) : (
                                            <span className="badge badge-warning">未設定</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 生成進捗 */}
                    {isGenerating && (
                        <div className="card mb-lg">
                            <div className="flex items-center gap-md">
                                <div className="animate-pulse">生成中...</div>
                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            height: '8px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-full)',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${(progress.current / progress.total) * 100}%`,
                                                background: 'var(--color-primary)',
                                                transition: 'width 0.3s ease'
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="text-sm">
                                    {progress.current} / {progress.total}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 結果表示 */}
                    {results.length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">生成結果</h3>
                                <div className="flex gap-md">
                                    <span className="badge badge-success">完了: {groupedResults.generated.length}</span>
                                    <span className="badge badge-warning">警告: {groupedResults.warning.length}</span>
                                    <span className="badge badge-danger">エラー: {groupedResults.error.length}</span>
                                </div>
                            </div>

                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ステータス</th>
                                            <th>店舗名</th>
                                            <th>メッセージ</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((result, index) => (
                                            <tr key={index}>
                                                <td>
                                                    {result.status === 'generated' && (
                                                        <span className="badge badge-success">完了</span>
                                                    )}
                                                    {result.status === 'warning' && (
                                                        <span className="badge badge-warning">警告あり</span>
                                                    )}
                                                    {result.status === 'error' && (
                                                        <span className="badge badge-danger">エラー</span>
                                                    )}
                                                </td>
                                                <td>{result.storeName}</td>
                                                <td className="text-sm text-muted">{result.message}</td>
                                                <td>
                                                    {result.status !== 'error' && (
                                                        <Link
                                                            to={`/planogram/store/${result.storeId}`}
                                                            className="btn btn-sm btn-secondary"
                                                        >
                                                            詳細
                                                        </Link>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {results.length === 0 && !isGenerating && (
                        <div className="card">
                            <div className="text-center text-muted" style={{ padding: '3rem' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏭</div>
                                <div style={{ marginBottom: '0.5rem' }}>FMTを選択して「一括自動生成」を実行してください</div>
                                <div className="text-sm">
                                    標準棚割をベースに、各店舗の棚サイズに合わせて自動調整されます
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ルール説明 */}
                    <div className="card mt-lg" style={{ background: 'var(--bg-glass)' }}>
                        <h4 className="mb-md">🔧 自動調整ルール</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                            <div>
                                <div className="text-sm" style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                                    ルールA: カット
                                </div>
                                <div className="text-xs text-muted">
                                    店舗棚 &lt; 標準棚の場合<br />
                                    売上ランク下位から、フェイス削減→商品カット
                                </div>
                            </div>
                            <div>
                                <div className="text-sm" style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                    ルールB: 拡張
                                </div>
                                <div className="text-xs text-muted">
                                    店舗棚 &gt; 標準棚の場合<br />
                                    売上ランク上位10のフェイスを2倍→1.5倍→余白
                                </div>
                            </div>
                            <div>
                                <div className="text-sm" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                                    ルールC: 同期
                                </div>
                                <div className="text-xs text-muted">
                                    標準棚割の更新後<br />
                                    個店で「同期」ボタンで最新状態に更新
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* 個店編集タブ */}
            {activeTab === 'individual' && (
                <>
                    {/* 検索・フィルター */}
                    <div className="card mb-lg">
                        <div className="flex items-center gap-lg" style={{ flexWrap: 'wrap' }}>
                            <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
                                <label className="form-label">店舗検索</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="店舗コードまたは店舗名..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">FMT</label>
                                <select
                                    className="form-select"
                                    value={filterFmt}
                                    onChange={(e) => setFilterFmt(e.target.value as FMT | '')}
                                >
                                    <option value="">すべて</option>
                                    {FMTS.map(fmt => (
                                        <option key={fmt} value={fmt}>{fmt}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">リージョン</label>
                                <select
                                    className="form-select"
                                    value={filterRegion}
                                    onChange={(e) => setFilterRegion(e.target.value as Region | '')}
                                >
                                    <option value="">すべて</option>
                                    {REGIONS.map(region => (
                                        <option key={region} value={region}>{region}</option>
                                    ))}
                                </select>
                            </div>

                            {(searchQuery || filterFmt || filterRegion) && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setFilterFmt('');
                                        setFilterRegion('');
                                    }}
                                    style={{ alignSelf: 'flex-end' }}
                                >
                                    クリア
                                </button>
                            )}
                        </div>

                        <div className="text-sm text-muted mt-md">
                            表示中: {filteredStores.length} / {stores.length} 店舗
                        </div>
                    </div>

                    {/* 店舗一覧 */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">店舗一覧</h3>
                        </div>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>店舗コード</th>
                                        <th>店舗名</th>
                                        <th>FMT</th>
                                        <th>リージョン</th>
                                        <th>棚割ステータス</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStores.map(store => (
                                        <tr key={store.id}>
                                            <td className="text-sm">{store.code}</td>
                                            <td>{store.name}</td>
                                            <td>
                                                <span className="badge badge-primary">{store.fmt}</span>
                                            </td>
                                            <td className="text-sm text-muted">{store.region}</td>
                                            <td>
                                                {store.planogramStatus === 'generated' && (
                                                    <span className="badge badge-success">✓ 生成済み</span>
                                                )}
                                                {store.planogramStatus === 'synced' && (
                                                    <span className="badge badge-primary">🔄 同期済み</span>
                                                )}
                                                {store.planogramStatus === 'warning' && (
                                                    <span className="badge badge-warning">⚠️ 警告あり</span>
                                                )}
                                                {!store.planogramStatus && (
                                                    <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                                        − 未生成
                                                    </span>
                                                )}
                                                {store.hasWarnings && store.planogramStatus !== 'warning' && (
                                                    <span className="badge badge-warning" style={{ marginLeft: '0.25rem' }}>⚠️</span>
                                                )}
                                            </td>
                                            <td>
                                                <Link
                                                    to={`/planogram/store/${store.id}`}
                                                    className="btn btn-sm btn-secondary"
                                                >
                                                    編集
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filteredStores.length === 0 && (
                            <div className="text-center text-muted" style={{ padding: '2rem' }}>
                                条件に一致する店舗がありません
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
