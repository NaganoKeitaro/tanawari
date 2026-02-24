// 棚割管理システム - 個店棚割指示書作成
import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
    Store,
    StorePlanogram,
    StandardPlanogram,
    Product,
    ShelfBlock,
    Fixture,
    StoreFixturePlacement,
    FixtureType
} from '../data/types';
import {
    storeRepository,
    storePlanogramRepository,
    standardPlanogramRepository,
    productRepository,
    fixtureRepository,
    storeFixturePlacementRepository,
    shelfBlockRepository
} from '../data/repositories/localStorageRepository';
import { UnitDisplay } from '../components/common/UnitDisplay';

import { StoreLayoutVisualizer } from '../components/layout/StoreLayoutVisualizer';

// ===== 定数 =====

const SCALE = 2.5;

const TYPE_LABELS: Record<FixtureType, string> = {
    'multi-tier': '多段',
    'gondola': 'ゴンドラ',
    'flat-refrigerated': '平台冷蔵',
    'flat-frozen': '平台冷凍',
    'end-cap-refrigerated': '平台冷蔵エンド',
    'end-cap-frozen': '平台冷凍エンド'
};

const BLOCK_COLORS = [
    '#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24',
    '#fb923c', '#f87171', '#4ade80', '#22d3ee', '#e879f9'
];

const ANNOTATION_CATEGORIES = [
    { value: 'change', label: '🔄 変更点', color: '#3b82f6' },
    { value: 'caution', label: '⚠️ 注意事項', color: '#f59e0b' },
    { value: 'note', label: '📝 補足', color: '#6b7280' }
] as const;

type AnnotationCategory = typeof ANNOTATION_CATEGORIES[number]['value'];

interface Annotation {
    id: string;
    category: AnnotationCategory;
    text: string;
}

// ===== 棚割ビジュアル（読み取り専用） =====
function PlanogramVisual({
    planogram, standardPlanogram, fixtureType, products, blocks
}: {
    planogram: StorePlanogram;
    standardPlanogram: StandardPlanogram | null;
    fixtureType: FixtureType;
    products: Product[];
    blocks: ShelfBlock[];
}) {
    return (
        <div className="instruction-planogram-section" style={{ marginBottom: '1.5rem', pageBreakInside: 'avoid' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {TYPE_LABELS[fixtureType]}
                <span className="text-sm text-muted" style={{ fontWeight: 400 }}>
                    (<UnitDisplay valueCm={planogram.width} /> / {planogram.shelfCount}段)
                </span>
            </h4>

            {/* 棚割グリッド */}
            <div style={{
                background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                padding: '0.75rem', paddingLeft: '40px', overflow: 'auto',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ width: `${planogram.width * SCALE}px`, position: 'relative' }}>
                    {/* ブロック背景 */}
                    {standardPlanogram?.blocks.map((block, idx) => {
                        const masterBlock = blocks.find(b => b.id === block.blockId);
                        if (!masterBlock) return null;
                        return (
                            <div
                                key={block.id}
                                style={{
                                    position: 'absolute', left: `${block.positionX * SCALE}px`,
                                    top: 0, bottom: 0, width: `${masterBlock.width * SCALE}px`,
                                    border: `2px dashed ${BLOCK_COLORS[idx % BLOCK_COLORS.length]}40`,
                                    borderTop: 'none', borderBottom: 'none',
                                    pointerEvents: 'none', zIndex: 0,
                                    display: 'flex', justifyContent: 'center'
                                }}
                            >
                                <div style={{
                                    marginTop: '-18px', background: 'rgba(255,255,255,0.9)',
                                    padding: '1px 6px', borderRadius: '3px', fontSize: '0.6rem',
                                    color: BLOCK_COLORS[idx % BLOCK_COLORS.length],
                                    whiteSpace: 'nowrap', border: `1px solid ${BLOCK_COLORS[idx % BLOCK_COLORS.length]}40`,
                                    fontWeight: 600
                                }}>
                                    {masterBlock.name}
                                </div>
                            </div>
                        );
                    })}

                    {/* 段ごとの商品配置 */}
                    {Array.from({ length: planogram.shelfCount }).map((_, shelfIndex) => {
                        const shelfProducts = planogram.products.filter(p => p.shelfIndex === shelfIndex);
                        const usedWidth = shelfProducts.reduce((sum, sp) => {
                            const product = products.find(p => p.id === sp.productId);
                            return sum + (product ? product.width * sp.faceCount : 0);
                        }, 0);
                        const emptyWidth = planogram.width - usedWidth;

                        return (
                            <div
                                key={shelfIndex}
                                style={{
                                    height: `${Math.max(50, (planogram.height / planogram.shelfCount) * SCALE)}px`,
                                    position: 'relative',
                                    borderBottom: '2px solid var(--border-color)',
                                    background: shelfIndex % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                                }}
                            >
                                {shelfProducts.map(sp => {
                                    const product = products.find(p => p.id === sp.productId);
                                    if (!product) return null;
                                    const width = product.width * sp.faceCount * SCALE;
                                    return (
                                        <div
                                            key={sp.id}
                                            style={{
                                                position: 'absolute', left: `${sp.positionX * SCALE}px`,
                                                top: 0, bottom: 0, width: `${width}px`,
                                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.08))',
                                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                                borderRadius: 'var(--radius-sm)',
                                                display: 'flex', flexDirection: 'column',
                                                alignItems: 'center', justifyContent: 'center',
                                                padding: '2px', fontSize: '0.55rem', overflow: 'hidden'
                                            }}
                                            title={`${product.name} ×${sp.faceCount}`}
                                        >
                                            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                                {product.name}
                                            </div>
                                            {sp.faceCount > 1 && (
                                                <div style={{ fontSize: '0.5rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                                                    ×{sp.faceCount}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {emptyWidth > 0 && (
                                    <div style={{
                                        position: 'absolute', right: 0, top: 0, bottom: 0,
                                        width: `${emptyWidth * SCALE}px`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.5
                                    }}>
                                        空白
                                    </div>
                                )}
                                <div style={{
                                    position: 'absolute', left: '-35px', top: '50%', transform: 'translateY(-50%)',
                                    fontSize: '0.65rem', color: 'var(--text-muted)'
                                }}>
                                    {shelfIndex + 1}段
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ===== ブロック詳細展開表示 =====
function BlockDetailSection({
    planograms, standardPlanograms, blocks, products
}: {
    planograms: StorePlanogram[];
    standardPlanograms: StandardPlanogram[];
    blocks: ShelfBlock[];
    products: Product[];
}) {
    // 関連ブロックを収集
    const relatedBlocks = useMemo(() => {
        const blockIds = new Set<string>();
        for (const sp of planograms) {
            const std = standardPlanograms.find(s => s.id === sp.standardPlanogramId);
            if (std) {
                for (const b of std.blocks) {
                    blockIds.add(b.blockId);
                }
            }
        }
        return blocks.filter(b => blockIds.has(b.id));
    }, [planograms, standardPlanograms, blocks]);

    if (relatedBlocks.length === 0) return null;

    return (
        <div style={{ pageBreakInside: 'avoid' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🧱 棚ブロック詳細
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {relatedBlocks.map((block, idx) => (
                    <div key={block.id} style={{
                        border: `2px solid ${BLOCK_COLORS[idx % BLOCK_COLORS.length]}40`,
                        borderRadius: 'var(--radius-md)', overflow: 'hidden',
                        background: 'var(--bg-primary)'
                    }}>
                        <div style={{
                            padding: '0.5rem 0.75rem',
                            background: `${BLOCK_COLORS[idx % BLOCK_COLORS.length]}15`,
                            borderBottom: `1px solid ${BLOCK_COLORS[idx % BLOCK_COLORS.length]}30`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: BLOCK_COLORS[idx % BLOCK_COLORS.length] }}>
                                {block.name}
                            </span>
                            <span className="text-xs text-muted">
                                <UnitDisplay valueCm={block.width} /> / {block.shelfCount}段
                            </span>
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {block.productPlacements.length === 0 ? (
                                <div className="text-center text-muted text-xs" style={{ padding: '0.75rem' }}>配置商品なし</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                                            <th className="text-left" style={{ padding: '0.3rem 0.5rem' }}>商品名</th>
                                            <th className="text-center" style={{ padding: '0.3rem', width: '45px' }}>フェイス</th>
                                            <th className="text-center" style={{ padding: '0.3rem', width: '40px' }}>段</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {block.productPlacements.map((pp, ppIdx) => {
                                            const product = products.find(p => p.id === pp.productId);
                                            return (
                                                <tr key={pp.id || ppIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '0.3rem 0.5rem' }}>{product?.name || '不明'}</td>
                                                    <td className="text-center" style={{ padding: '0.3rem' }}>{pp.faceCount}</td>
                                                    <td className="text-center" style={{ padding: '0.3rem' }}>{pp.shelfIndex + 1}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ===== メインコンポーネント =====
export function InstructionSheet() {
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [products, setProducts] = useState<Product[]>([]);
    const [blocks, setBlocks] = useState<ShelfBlock[]>([]);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [placements, setPlacements] = useState<StoreFixturePlacement[]>([]);
    const [storePlanograms, setStorePlanograms] = useState<StorePlanogram[]>([]);
    const [standardPlanograms, setStandardPlanograms] = useState<StandardPlanogram[]>([]);
    const [loading, setLoading] = useState(false);

    // 検索フィルタ
    const [searchQuery, setSearchQuery] = useState('');
    const [filterFmt, setFilterFmt] = useState('');

    // 指示書ヘッダー情報
    const [sheetTitle, setSheetTitle] = useState('棚割変更指示書');
    const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

    // 注釈
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [newAnnotationText, setNewAnnotationText] = useState('');
    const [newAnnotationCategory, setNewAnnotationCategory] = useState<AnnotationCategory>('change');

    // 初期読み込み
    useEffect(() => {
        (async () => {
            const [storesData, productsData, blocksData, fixturesData, standardsData] = await Promise.all([
                storeRepository.getAll(),
                productRepository.getAll(),
                shelfBlockRepository.getAll(),
                fixtureRepository.getAll(),
                standardPlanogramRepository.getAll()
            ]);
            setStores(storesData);
            setProducts(productsData);
            setBlocks(blocksData);
            setFixtures(fixturesData);
            setStandardPlanograms(standardsData);
        })();
    }, []);

    // 店舗選択時のデータ読み込み
    const loadStoreData = useCallback(async (storeId: string) => {
        if (!storeId) {
            setPlacements([]);
            setStorePlanograms([]);
            return;
        }
        setLoading(true);
        const [placementsData, planogramsData] = await Promise.all([
            storeFixturePlacementRepository.query(p => p.storeId === storeId),
            storePlanogramRepository.query(p => p.storeId === storeId)
        ]);
        setPlacements(placementsData);
        setStorePlanograms(planogramsData);
        setLoading(false);
    }, []);

    const handleStoreChange = (storeId: string) => {
        setSelectedStoreId(storeId);
        loadStoreData(storeId);
    };

    // フィルター適用
    const filteredStores = useMemo(() => {
        return stores.filter(store => {
            // FMTフィルター
            if (filterFmt && store.fmt !== filterFmt) {
                return false;
            }
            // テキスト検索フィルター (店舗名、店舗コード)
            if (searchQuery) {
                // 全角・半角・大文字・小文字を無視して比較するために正規化
                const normalizeStr = (str: string) => str.normalize('NFKC').toLowerCase();
                const lowerQuery = normalizeStr(searchQuery);
                const matchName = normalizeStr(store.name).includes(lowerQuery);
                const matchCode = normalizeStr(store.code).includes(lowerQuery);
                if (!matchName && !matchCode) {
                    return false;
                }
            }
            return true;
        });
    }, [stores, searchQuery, filterFmt]);

    // フィルタ結果が変わった際に、選択中の店舗がフィルタ結果に含まれなくなった場合は選択を解除する
    useEffect(() => {
        if (selectedStoreId && !filteredStores.some(s => s.id === selectedStoreId)) {
            // フィルタ結果が空でなければ先頭を選択、空なら未選択にする
            if (filteredStores.length > 0) {
                handleStoreChange(filteredStores[0].id);
            } else {
                handleStoreChange('');
            }
        }
    }, [filteredStores, selectedStoreId, loadStoreData]);

    const selectedStore = stores.find(s => s.id === selectedStoreId);

    // 棚割を什器タイプごとに整理
    const planogramsByType = useMemo(() => {
        const result: Array<{ fixtureType: FixtureType; planogram: StorePlanogram; standard: StandardPlanogram | null }> = [];
        for (const sp of storePlanograms) {
            const std = standardPlanograms.find(s => s.id === sp.standardPlanogramId);
            const ft: FixtureType = std?.fixtureType || 'multi-tier';
            result.push({ fixtureType: ft, planogram: sp, standard: std || null });
        }
        return result;
    }, [storePlanograms, standardPlanograms]);

    // StoreLayoutVisualizer用のブロック情報を収集
    const allPlanogramBlocks = useMemo(() => {
        const result: any[] = [];
        storePlanograms.forEach(sp => {
            const std = standardPlanograms.find(s => s.id === sp.standardPlanogramId);
            if (std) {
                result.push(...std.blocks);
            }
        });
        return result;
    }, [storePlanograms, standardPlanograms]);

    // 注釈操作
    const addAnnotation = () => {
        if (!newAnnotationText.trim()) return;
        setAnnotations(prev => [...prev, {
            id: crypto.randomUUID(),
            category: newAnnotationCategory,
            text: newAnnotationText.trim()
        }]);
        setNewAnnotationText('');
    };

    const removeAnnotation = (id: string) => {
        setAnnotations(prev => prev.filter(a => a.id !== id));
    };

    // PDF出力
    const handlePdfExport = () => {
        window.print();
    };

    return (
        <div className="animate-fadeIn instruction-sheet-page">
            {/* ヘッダー（印刷時非表示） */}
            <div className="page-header no-print">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="page-title">📄 棚割指示書作成</h1>
                        <p className="page-subtitle">個店棚割の指示書を作成・PDF出力</p>
                    </div>
                    <div className="flex gap-md">
                        <button
                            className="btn btn-primary"
                            onClick={handlePdfExport}
                            disabled={!selectedStoreId}
                        >
                            📥 PDF出力
                        </button>
                    </div>
                </div>
            </div>

            {/* ===== 設定セクション（印刷時非表示） ===== */}
            <div className="card mb-lg no-print">
                <h3 className="card-title mb-md">対象店舗の検索・選択</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) auto', gap: '1rem', alignItems: 'end', marginBottom: '1rem' }}>
                    <div>
                        <label className="form-label">店舗名・コード検索</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="form-label">FMT</label>
                        <div className="flex items-center gap-xs">
                            <button
                                className={`btn btn-sm ${!filterFmt ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFilterFmt('')}
                            >
                                全て
                            </button>
                            {['MEGA', 'SuC', 'SMART', 'GO'].map(fmt => (
                                <button
                                    key={fmt}
                                    className={`btn btn-sm ${filterFmt === fmt ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setFilterFmt(fmt)}
                                >
                                    {fmt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                    <div>
                        <label className="form-label">対象店舗</label>
                        <select
                            className="form-select"
                            value={selectedStoreId}
                            onChange={e => handleStoreChange(e.target.value)}
                        >
                            <option value="">-- 店舗を選択 --</option>
                            {filteredStores.map(s => (
                                <option key={s.id} value={s.id}>{s.code} - {s.name} ({s.fmt})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">指示書タイトル</label>
                        <input
                            type="text"
                            className="form-input"
                            value={sheetTitle}
                            onChange={e => setSheetTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="form-label">適用日</label>
                        <input
                            type="date"
                            className="form-input"
                            value={effectiveDate}
                            onChange={e => setEffectiveDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* ===== 注釈入力エリア（印刷時非表示） ===== */}
            {selectedStoreId && (
                <div className="card mb-lg no-print">
                    <h3 className="card-title mb-md">注釈・コメント</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'flex-end' }}>
                        <div style={{ width: '140px' }}>
                            <label className="form-label">カテゴリ</label>
                            <select
                                className="form-select"
                                value={newAnnotationCategory}
                                onChange={e => setNewAnnotationCategory(e.target.value as AnnotationCategory)}
                            >
                                {ANNOTATION_CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="form-label">内容</label>
                            <input
                                type="text"
                                className="form-input"
                                value={newAnnotationText}
                                onChange={e => setNewAnnotationText(e.target.value)}
                                placeholder="注釈を入力..."
                                onKeyDown={e => { if (e.key === 'Enter') addAnnotation(); }}
                            />
                        </div>
                        <button className="btn btn-secondary" onClick={addAnnotation} disabled={!newAnnotationText.trim()}>
                            ＋ 追加
                        </button>
                    </div>

                    {annotations.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {annotations.map(a => {
                                const cat = ANNOTATION_CATEGORIES.find(c => c.value === a.category)!;
                                return (
                                    <div key={a.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)',
                                        border: `1px solid ${cat.color}30`, background: `${cat.color}08`
                                    }}>
                                        <span style={{ fontSize: '0.8rem' }}>{cat.label}</span>
                                        <span style={{ flex: 1, fontSize: '0.85rem' }}>{a.text}</span>
                                        <button
                                            className="btn btn-sm"
                                            style={{ padding: '0 6px', fontSize: '0.7rem', color: 'var(--color-danger)' }}
                                            onClick={() => removeAnnotation(a.id)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ===== 指示書本体（印刷対象） ===== */}
            {selectedStoreId && selectedStore && (
                <div className="instruction-sheet-body">
                    {/* 指示書ヘッダー */}
                    <div className="card mb-lg" style={{ pageBreakAfter: 'auto' }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                            borderBottom: '2px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{sheetTitle}</h2>
                                <div className="text-sm text-muted" style={{ marginTop: '0.25rem' }}>
                                    作成日: {new Date().toLocaleDateString('ja-JP')}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                                    適用日: {new Date(effectiveDate).toLocaleDateString('ja-JP')}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                            <div>
                                <div className="text-xs text-muted">店舗コード</div>
                                <div style={{ fontWeight: 600 }}>{selectedStore.code}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted">店舗名</div>
                                <div style={{ fontWeight: 600 }}>{selectedStore.name}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted">FMT</div>
                                <div style={{ fontWeight: 600 }}>{selectedStore.fmt}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted">地域</div>
                                <div style={{ fontWeight: 600 }}>{selectedStore.region}</div>
                            </div>
                        </div>

                        {/* 注釈表示（印刷用） */}
                        {annotations.length > 0 && (
                            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>📝 注釈・コメント</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    {annotations.map(a => {
                                        const cat = ANNOTATION_CATEGORIES.find(c => c.value === a.category)!;
                                        return (
                                            <div key={a.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)',
                                                border: `1px solid ${cat.color}30`, background: `${cat.color}08`,
                                                fontSize: '0.8rem'
                                            }}>
                                                <span style={{ fontWeight: 600 }}>{cat.label}</span>
                                                <span>{a.text}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="card text-center text-muted animate-pulse" style={{ padding: '3rem' }}>
                            データを読み込み中...
                        </div>
                    ) : (
                        <>
                            {/* 売り場レイアウト */}
                            <div className="mb-lg" style={{ pageBreakAfter: 'auto' }}>
                                <StoreLayoutVisualizer
                                    store={selectedStore}
                                    placements={placements}
                                    fixtures={fixtures}
                                    scale={0.45}
                                    blocks={blocks}
                                    planogramBlocks={allPlanogramBlocks}
                                    products={products}
                                />
                            </div>

                            {/* 棚割ビジュアル */}
                            {planogramsByType.length > 0 && (
                                <div className="card mb-lg" style={{ pageBreakBefore: 'auto' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        📋 棚割詳細
                                    </h3>
                                    {planogramsByType.map(({ fixtureType, planogram, standard }) => (
                                        <PlanogramVisual
                                            key={planogram.id}
                                            planogram={planogram}
                                            standardPlanogram={standard}
                                            fixtureType={fixtureType}
                                            products={products}
                                            blocks={blocks}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* ブロック詳細 */}
                            <div className="card mb-lg" style={{ pageBreakBefore: 'auto' }}>
                                <BlockDetailSection
                                    planograms={storePlanograms}
                                    standardPlanograms={standardPlanograms}
                                    blocks={blocks}
                                    products={products}
                                />
                            </div>

                            {planogramsByType.length === 0 && (
                                <div className="card text-center text-muted" style={{ padding: '2rem' }}>
                                    この店舗の棚割データはまだ作成されていません
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {!selectedStoreId && (
                <div className="card text-center" style={{ padding: '4rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>店舗を選択してください</div>
                    <div className="text-muted">上のドロップダウンから対象店舗を選択すると、棚割指示書のプレビューが表示されます</div>
                </div>
            )}

            {/* 印刷用CSS */}
            <style>{`
                @media print {
                    .sidebar, .no-print { display: none !important; }
                    .main-content { margin: 0 !important; padding: 0 !important; }
                    .app-layout { display: block !important; }
                    .instruction-sheet-body .card {
                        border: 1px solid #ddd !important;
                        box-shadow: none !important;
                        break-inside: avoid;
                    }
                    body { background: white !important; font-size: 11px !important; }
                    .instruction-sheet-page { padding: 0 !important; }
                    .page-header { margin-bottom: 0.5rem !important; }
                }
            `}</style>
        </div>
    );
}
