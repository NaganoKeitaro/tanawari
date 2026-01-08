// 棚割管理システム - 個店棚割一括生成
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type {
    Store,
    StandardPlanogram,
    FMT,
    GenerationResult
} from '../../data/types';
import { FMTS } from '../../data/types';
import {
    storeRepository,
    standardPlanogramRepository
} from '../../data/repositories/localStorageRepository';
import { batchGenerateStorePlanograms } from '../../services/automationService';

export function StorePlanogramBatch() {
    const [stores, setStores] = useState<Store[]>([]);
    const [planograms, setPlanograms] = useState<StandardPlanogram[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedFmt, setSelectedFmt] = useState<FMT | ''>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState<GenerationResult[]>([]);

    // データ読み込み
    const loadData = useCallback(async () => {
        setLoading(true);
        const [storesData, planogramsData] = await Promise.all([
            storeRepository.getAll(),
            standardPlanogramRepository.getAll()
        ]);
        setStores(storesData);
        setPlanograms(planogramsData);
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

        const standardPlanogram = planograms.find(p => p.fmt === selectedFmt);
        if (!standardPlanogram) {
            alert('このFMTの標準棚割がありません。先に標準棚割を作成してください。');
            return;
        }

        const targetStores = stores.filter(s => s.fmt === selectedFmt);
        if (targetStores.length === 0) {
            alert('このFMTに該当する店舗がありません');
            return;
        }

        if (!confirm(`${selectedFmt}の${targetStores.length}店舗に対して棚割を一括生成しますか？`)) {
            return;
        }

        setIsGenerating(true);
        setProgress({ current: 0, total: targetStores.length });
        setResults([]);

        await batchGenerateStorePlanograms(
            standardPlanogram,
            (current, total, result) => {
                setProgress({ current, total });
                setResults(prev => [...prev, result]);
            }
        );

        setIsGenerating(false);
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
                <p className="page-subtitle">FMT標準棚割から個店棚割を一括自動生成</p>
            </div>

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
                        {isGenerating ? '生成中...' : '🚀 一括自動生成'}
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
        </div>
    );
}
