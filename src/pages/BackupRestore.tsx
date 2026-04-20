// 棚割管理システム - バックアップ/復旧
// チェックポイントデータはIndexedDBに保存（localStorageの5MB制限を回避）
import { useState, useEffect, useCallback } from 'react';
import {
    productRepository,
    storeRepository,
    fixtureRepository,
    storeFixturePlacementRepository,
    shelfBlockRepository,
    standardPlanogramRepository,
    storePlanogramRepository,
    productHierarchyRepository,
    restoreAllData
} from '../data/repositories/repositoryFactory';

interface Checkpoint {
    id: string;
    createdAt: string;
    label: string;
    dataSizeBytes: number;
    counts: {
        products: number;
        stores: number;
        fixtures: number;
        storeFixtures: number;
        shelfBlocks: number;
        standardPlanograms: number;
        storePlanograms: number;
        hierarchy: number;
    };
}

interface CheckpointData {
    meta: Checkpoint;
    data: {
        products: unknown[];
        stores: unknown[];
        fixtures: unknown[];
        storeFixtures: unknown[];
        shelfBlocks: unknown[];
        standardPlanograms: unknown[];
        storePlanograms: unknown[];
        hierarchy: unknown[];
    };
}

// ========================================
// IndexedDB ストレージ
// ========================================

const DB_NAME = 'planogram_backups';
const DB_VERSION = 1;
const STORE_NAME = 'checkpoints';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbSave(id: string, data: CheckpointData): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ id, ...data });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

async function idbLoad(id: string): Promise<CheckpointData | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => {
            db.close();
            if (!req.result) return resolve(null);
            const { id: _id, ...rest } = req.result;
            resolve(rest as CheckpointData);
        };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}

async function idbDelete(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

// ========================================
// チェックポイントインデックス（メタ情報のみ、localStorage）
// ========================================

const CHECKPOINT_INDEX_KEY = 'planogram_backup_checkpoints';

function getCheckpointIndex(): Checkpoint[] {
    const raw = localStorage.getItem(CHECKPOINT_INDEX_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as Checkpoint[];
    } catch {
        return [];
    }
}

function saveCheckpointIndex(index: Checkpoint[]) {
    localStorage.setItem(CHECKPOINT_INDEX_KEY, JSON.stringify(index));
}

// ========================================
// ユーティリティ
// ========================================

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ========================================
// コンポーネント
// ========================================

export function BackupRestore() {
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [progressMessage, setProgressMessage] = useState('');
    const [label, setLabel] = useState('');

    const loadCheckpoints = useCallback(() => {
        setCheckpoints(getCheckpointIndex());
        setLoading(false);
    }, []);

    useEffect(() => { loadCheckpoints(); }, [loadCheckpoints]);

    const handleCreateCheckpoint = async () => {
        setProcessing(true);
        setProgressMessage('データを取得中...');
        try {
            const [products, stores, fixtures, storeFixtures, shelfBlocks, standardPlanograms, storePlanograms, hierarchy] =
                await Promise.all([
                    productRepository.getAll(),
                    storeRepository.getAll(),
                    fixtureRepository.getAll(),
                    storeFixturePlacementRepository.getAll(),
                    shelfBlockRepository.getAll(),
                    standardPlanogramRepository.getAll(),
                    storePlanogramRepository.getAll(),
                    productHierarchyRepository.getAll(),
                ]);

            const now = new Date().toISOString();
            const id = crypto.randomUUID();

            const dataPayload = { products, stores, fixtures, storeFixtures, shelfBlocks, standardPlanograms, storePlanograms, hierarchy };
            const dataSizeBytes = new Blob([JSON.stringify(dataPayload)]).size;

            const meta: Checkpoint = {
                id,
                createdAt: now,
                label: label.trim() || formatDateTime(now),
                dataSizeBytes,
                counts: {
                    products: products.length,
                    stores: stores.length,
                    fixtures: fixtures.length,
                    storeFixtures: storeFixtures.length,
                    shelfBlocks: shelfBlocks.length,
                    standardPlanograms: standardPlanograms.length,
                    storePlanograms: storePlanograms.length,
                    hierarchy: hierarchy.length,
                },
            };

            setProgressMessage(`IndexedDBに保存中... (${formatSize(dataSizeBytes)})`);

            await idbSave(id, { meta, data: dataPayload });

            const index = getCheckpointIndex();
            index.unshift(meta);
            saveCheckpointIndex(index);

            setLabel('');
            setProgressMessage('');
            loadCheckpoints();
            alert(`チェックポイントを作成しました (${formatSize(dataSizeBytes)})`);
        } catch (e) {
            console.error(e);
            alert(`チェックポイントの作成に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
        }
        setProcessing(false);
        setProgressMessage('');
    };

    const handleRestore = async (id: string) => {
        const cp = checkpoints.find(c => c.id === id);
        if (!cp) return;

        if (!confirm(`以下のチェックポイントに復旧します。現在のデータは上書きされます。\n\n${cp.label}\n(${formatSize(cp.dataSizeBytes || 0)})\n\n本当に実行しますか？`)) return;

        setProcessing(true);
        setProgressMessage('チェックポイントデータを読み込み中...');
        try {
            const checkpointData = await idbLoad(id);
            if (!checkpointData) {
                alert('チェックポイントデータが見つかりません');
                setProcessing(false);
                setProgressMessage('');
                return;
            }

            setProgressMessage('データを復元中...');
            await restoreAllData(checkpointData.data as any);

            alert('復旧が完了しました。ページを再読み込みします。');
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert(`復旧中にエラーが発生しました: ${e instanceof Error ? e.message : String(e)}`);
        }
        setProcessing(false);
        setProgressMessage('');
    };

    const handleDelete = async (id: string) => {
        const cp = checkpoints.find(c => c.id === id);
        if (!cp) return;
        if (!confirm(`チェックポイント「${cp.label}」を削除しますか？`)) return;

        await idbDelete(id);
        const index = getCheckpointIndex().filter(c => c.id !== id);
        saveCheckpointIndex(index);
        loadCheckpoints();
    };

    const handleExport = async (id: string) => {
        setProcessing(true);
        setProgressMessage('エクスポート準備中...');
        try {
            const data = await idbLoad(id);
            if (!data) {
                alert('チェックポイントデータが見つかりません');
                setProcessing(false);
                setProgressMessage('');
                return;
            }
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${data.meta.label.replace(/[/:\\]/g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert('エクスポートに失敗しました');
        }
        setProcessing(false);
        setProgressMessage('');
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            setProcessing(true);
            setProgressMessage(`ファイル読み込み中... (${formatSize(file.size)})`);
            try {
                const text = await file.text();
                const data = JSON.parse(text) as CheckpointData;
                if (!data.meta || !data.data) {
                    alert('無効なバックアップファイルです');
                    setProcessing(false);
                    setProgressMessage('');
                    return;
                }
                const newId = crypto.randomUUID();
                data.meta.id = newId;
                data.meta.label = `[インポート] ${data.meta.label}`;
                data.meta.dataSizeBytes = data.meta.dataSizeBytes || new Blob([text]).size;

                setProgressMessage('IndexedDBに保存中...');
                await idbSave(newId, data);

                const index = getCheckpointIndex();
                index.unshift(data.meta);
                saveCheckpointIndex(index);
                loadCheckpoints();
                alert('バックアップファイルをインポートしました');
            } catch {
                alert('ファイルの読み込みに失敗しました');
            }
            setProcessing(false);
            setProgressMessage('');
        };
        input.click();
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

    const DATA_LABELS = [
        { key: 'products', label: '商品', icon: '📦' },
        { key: 'stores', label: '店舗', icon: '🏪' },
        { key: 'fixtures', label: '棚', icon: '🗄️' },
        { key: 'storeFixtures', label: '店舗棚尺', icon: '📐' },
        { key: 'shelfBlocks', label: 'ブロック', icon: '🧱' },
        { key: 'standardPlanograms', label: '標準棚割', icon: '📋' },
        { key: 'storePlanograms', label: '個店棚割', icon: '🏬' },
        { key: 'hierarchy', label: '階層', icon: '🌳' },
    ] as const;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">バックアップ / 復旧</h1>
                <p className="page-subtitle">チェックポイントの作成と、データの復旧を行います</p>
            </div>

            {/* 進捗メッセージ */}
            {processing && progressMessage && (
                <div
                    className="card mb-lg"
                    style={{
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.1))',
                        borderColor: 'var(--color-primary)',
                    }}
                >
                    <div className="flex items-center gap-md">
                        <div className="animate-pulse" style={{ fontSize: '1.5rem' }}>⏳</div>
                        <div>
                            <div style={{ fontWeight: 600 }}>{progressMessage}</div>
                            <div className="text-sm text-muted">処理中です。しばらくお待ちください...</div>
                        </div>
                    </div>
                </div>
            )}

            {/* チェックポイント作成 */}
            <div className="card mb-lg">
                <h3 className="card-title mb-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>💾</span> チェックポイント作成
                </h3>
                <p className="text-sm text-muted" style={{ marginBottom: '1rem' }}>
                    現在の全データ（マスタ・棚割・階層）のスナップショットを保存します。
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="ラベル（任意：例「リリース前」）"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        style={{ flex: 1 }}
                        disabled={processing}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleCreateCheckpoint}
                        disabled={processing}
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        {processing ? '処理中...' : '💾 チェックポイント作成'}
                    </button>
                </div>
            </div>

            {/* インポートボタン */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button
                    className="btn btn-secondary"
                    onClick={handleImport}
                    disabled={processing}
                >
                    📥 ファイルからインポート
                </button>
            </div>

            {/* チェックポイント一覧 */}
            <div className="card">
                <h3 className="card-title mb-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🕐</span> チェックポイント一覧
                </h3>

                {checkpoints.length === 0 ? (
                    <div className="text-center text-muted" style={{ padding: '3rem' }}>
                        チェックポイントがありません。上のボタンから作成してください。
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {checkpoints.map((cp) => (
                            <div
                                key={cp.id}
                                style={{
                                    padding: '1rem 1.25rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
                                            {cp.label}
                                        </div>
                                        <div className="text-sm text-muted">
                                            {formatDateTime(cp.createdAt)}
                                            {cp.dataSizeBytes ? ` / ${formatSize(cp.dataSizeBytes)}` : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleRestore(cp.id)}
                                            disabled={processing}
                                            title="このチェックポイントに復旧"
                                        >
                                            🔄 復旧
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleExport(cp.id)}
                                            disabled={processing}
                                            title="JSONファイルとしてエクスポート"
                                        >
                                            📤
                                        </button>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleDelete(cp.id)}
                                            disabled={processing}
                                            title="チェックポイントを削除"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {DATA_LABELS.map(({ key, label: lbl, icon }) => (
                                        <span
                                            key={key}
                                            className="badge"
                                            style={{
                                                backgroundColor: (cp.counts[key] || 0) > 0 ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                                                color: (cp.counts[key] || 0) > 0 ? 'var(--color-primary)' : 'var(--text-muted)',
                                                fontSize: '0.75rem',
                                            }}
                                        >
                                            {icon} {lbl}: {cp.counts[key] || 0}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
