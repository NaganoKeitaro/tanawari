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
} from '../../data/repositories/repositoryFactory';
import { generateStorePlanogram } from '../../services/automationService';

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
    const [selectedStandardPlanogramId, setSelectedStandardPlanogramId] = useState<string>('');
    const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
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

    // FMT変更時にサブ選択をリセット
    const handleFmtChange = (fmt: FMT | '') => {
        setSelectedFmt(fmt);
        setSelectedStandardPlanogramId('');
        setSelectedStoreIds([]);
        setResults([]);
    };

    // FMTに紐づく標準棚割一覧
    const fmtPlanograms = planograms.filter(p => p.fmt === selectedFmt);

    // FMTに紐づく店舗一覧
    const fmtStores = stores.filter(s => s.fmt === selectedFmt);

    // 選択済み標準棚割オブジェクト
    const selectedStandardPlanogram = planograms.find(p => p.id === selectedStandardPlanogramId) || null;

    // 店舗の全選択/全解除
    const handleSelectAllStores = () => setSelectedStoreIds(fmtStores.map(s => s.id));
    const handleDeselectAllStores = () => setSelectedStoreIds([]);
    const toggleStoreSelection = (storeId: string) => {
        setSelectedStoreIds(prev =>
            prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
        );
    };

    // 一括生成実行
    const handleGenerate = async () => {
        if (!selectedStandardPlanogram || selectedStoreIds.length === 0) return;

        if (!confirm(`「${selectedStandardPlanogram.name}」を ${selectedStoreIds.length} 店舗に対して一括生成しますか？`)) {
            return;
        }

        setIsGenerating(true);
        const totalOps = selectedStoreIds.length;
        setProgress({ current: 0, total: totalOps });
        setResults([]);

        for (let i = 0; i < selectedStoreIds.length; i++) {
            try {
                const result = await generateStorePlanogram(selectedStoreIds[i], selectedStandardPlanogram);
                setProgress({ current: i + 1, total: totalOps });
                setResults(prev => [...prev, result]);
            } catch (error) {
                setProgress({ current: i + 1, total: totalOps });
                setResults(prev => [...prev, {
                    storeId: selectedStoreIds[i],
                    storeName: '',
                    status: 'error' as const,
                    message: `生成エラー: ${(error as Error).message}`
                }]);
            }
        }

        setIsGenerating(false);
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
                    {/* ステップ1: FMT選択 */}
                    <div className="card mb-lg">
                        <div className="flex items-center gap-lg" style={{ flexWrap: 'wrap' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">① 処理対象FMT</label>
                                <select
                                    className="form-select"
                                    value={selectedFmt}
                                    onChange={(e) => handleFmtChange(e.target.value as FMT | '')}
                                    disabled={isGenerating}
                                >
                                    <option value="">FMTを選択...</option>
                                    {FMTS.map(fmt => (
                                        <option key={fmt} value={fmt}>{fmt}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedFmt && (
                                <div className="text-sm text-muted">
                                    標準棚割: <strong>{fmtPlanograms.length}</strong>件 / 店舗: <strong>{fmtStores.length}</strong>店舗
                                </div>
                            )}
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
                                onClick={() => handleFmtChange(stat.fmt)}
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

                    {/* ステップ2: 標準棚割選択 */}
                    {selectedFmt && (
                        <div className="card mb-lg">
                            <div className="card-header">
                                <h3 className="card-title">② 標準棚割を選択</h3>
                            </div>
                            {fmtPlanograms.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {fmtPlanograms.map(pg => {
                                        const isSelected = selectedStandardPlanogramId === pg.id;
                                        const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '';
                                        const periodText = pg.startDate || pg.endDate
                                            ? `${formatDate(pg.startDate)}〜${formatDate(pg.endDate)}`
                                            : null;
                                        return (
                                            <div
                                                key={pg.id}
                                                onClick={() => !isGenerating && setSelectedStandardPlanogramId(pg.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    padding: '0.75rem 1rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: isGenerating ? 'default' : 'pointer',
                                                    border: isSelected ? '2px solid var(--color-primary)' : '2px solid var(--border-color)',
                                                    background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="standardPlanogram"
                                                    checked={isSelected}
                                                    onChange={() => setSelectedStandardPlanogramId(pg.id)}
                                                    disabled={isGenerating}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 500 }}>{pg.name}</div>
                                                    <div className="text-xs text-muted" style={{ display: 'flex', gap: '1rem', marginTop: '2px' }}>
                                                        {periodText && <span>📅 {periodText}</span>}
                                                        {pg.description && <span>💬 {pg.description}</span>}
                                                        <span>商品: {pg.products.length}件</span>
                                                        <span>什器: {pg.fixtureType || '多段'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center text-muted" style={{ padding: '2rem' }}>
                                    このFMTの標準棚割がありません。先に「FMT標準棚割管理」で作成してください。
                                </div>
                            )}
                        </div>
                    )}

                    {/* ステップ3: 店舗選択 */}
                    {selectedFmt && selectedStandardPlanogramId && (
                        <div className="card mb-lg">
                            <div className="card-header">
                                <h3 className="card-title">③ 対象店舗を選択</h3>
                                <div className="flex gap-md items-center">
                                    <span className="text-sm text-muted">
                                        {selectedStoreIds.length} / {fmtStores.length} 店舗選択中
                                    </span>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                        onClick={handleSelectAllStores}
                                        disabled={isGenerating}
                                    >
                                        全選択
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                        onClick={handleDeselectAllStores}
                                        disabled={isGenerating}
                                    >
                                        選択解除
                                    </button>
                                </div>
                            </div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedStoreIds.length === fmtStores.length && fmtStores.length > 0}
                                                    onChange={(e) => e.target.checked ? handleSelectAllStores() : handleDeselectAllStores()}
                                                    disabled={isGenerating}
                                                />
                                            </th>
                                            <th>店舗コード</th>
                                            <th>店舗名</th>
                                            <th>リージョン</th>
                                            <th>棚割ステータス</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fmtStores.map(store => {
                                            const sp = storePlanograms.find(p => p.storeId === store.id);
                                            return (
                                                <tr key={store.id} style={{ cursor: 'pointer' }} onClick={() => !isGenerating && toggleStoreSelection(store.id)}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedStoreIds.includes(store.id)}
                                                            onChange={() => toggleStoreSelection(store.id)}
                                                            disabled={isGenerating}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </td>
                                                    <td className="text-sm">{store.code}</td>
                                                    <td>{store.name}</td>
                                                    <td className="text-sm text-muted">{store.region}</td>
                                                    <td>
                                                        {sp?.status === 'generated' && <span className="badge badge-success">✓ 生成済み</span>}
                                                        {sp?.status === 'synced' && <span className="badge badge-primary">🔄 同期済み</span>}
                                                        {sp?.status === 'warning' && <span className="badge badge-warning">⚠️ 警告</span>}
                                                        {!sp?.status && <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>− 未生成</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 実行ボタン */}
                    {selectedFmt && (
                        <div className="card mb-lg">
                            <div className="flex items-center justify-between">
                                <div className="text-sm">
                                    {selectedStandardPlanogram && selectedStoreIds.length > 0 ? (
                                        <span>
                                            「<strong>{selectedStandardPlanogram.name}</strong>」を <strong>{selectedStoreIds.length}</strong> 店舗に適用します
                                        </span>
                                    ) : (
                                        <span className="text-muted">
                                            標準棚割と対象店舗を選択してください
                                        </span>
                                    )}
                                </div>
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !selectedStandardPlanogramId || selectedStoreIds.length === 0}
                                >
                                    {isGenerating ? '生成中...' : '🚀 自動棚割提案を作成'}
                                </button>
                            </div>
                        </div>
                    )}

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

                    {results.length === 0 && !isGenerating && !selectedFmt && (
                        <div className="card">
                            <div className="text-center text-muted" style={{ padding: '3rem' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏭</div>
                                <div style={{ marginBottom: '0.5rem' }}>FMTを選択して標準棚割と対象店舗を指定してください</div>
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
