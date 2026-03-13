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
} from '../data/repositories/repositoryFactory';
import { UnitDisplay } from '../components/common/UnitDisplay';
import { getProductColor, initProductColorMap } from '../utils/productColorUtils';

// ===== 定数 =====

const SCALE = 0.25;

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

// 什器グループ定義
type FixtureGroup = 'multi-tier' | 'flat';
const FIXTURE_GROUPS: Record<FixtureGroup, { label: string; types: FixtureType[] }> = {
    'multi-tier': { label: '多段棚', types: ['multi-tier', 'gondola'] },
    'flat': { label: '平台', types: ['flat-refrigerated', 'flat-frozen', 'end-cap-refrigerated', 'end-cap-frozen'] }
};

// ブロックオーバーレイ用カラーパレット
const BLOCK_OVERLAY_COLORS = [
    { bg: 'rgba(59, 130, 246, 0.35)', border: 'rgba(59, 130, 246, 0.7)', text: '#1e40af' },
    { bg: 'rgba(16, 185, 129, 0.35)', border: 'rgba(16, 185, 129, 0.7)', text: '#065f46' },
    { bg: 'rgba(245, 158, 11, 0.35)', border: 'rgba(245, 158, 11, 0.7)', text: '#92400e' },
    { bg: 'rgba(239, 68, 68, 0.35)', border: 'rgba(239, 68, 68, 0.7)', text: '#991b1b' },
    { bg: 'rgba(6, 182, 212, 0.35)', border: 'rgba(6, 182, 212, 0.7)', text: '#155e75' },
    { bg: 'rgba(168, 85, 247, 0.35)', border: 'rgba(168, 85, 247, 0.7)', text: '#6b21a8' },
    { bg: 'rgba(236, 72, 153, 0.35)', border: 'rgba(236, 72, 153, 0.7)', text: '#9d174d' },
    { bg: 'rgba(20, 184, 166, 0.35)', border: 'rgba(20, 184, 166, 0.7)', text: '#115e59' },
];

function getBlockOverlayColor(index: number) {
    return BLOCK_OVERLAY_COLORS[index % BLOCK_OVERLAY_COLORS.length];
}

const FIXTURE_BG: Record<string, string> = {
    'multi-tier': '#f0f0f0',
    'flat-refrigerated': '#e0f7fa',
    'flat-frozen': '#e3f2fd',
    'end-cap-refrigerated': '#b2ebf2',
    'end-cap-frozen': '#bbdefb',
    'gondola': '#fff8e1',
    'default': '#f1f5f9'
};

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
                    (<UnitDisplay valueMm={planogram.width} /> / {planogram.shelfCount}段)
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
                    {Array.from({ length: planogram.shelfCount }).map((_, i) => i).reverse().map((shelfIndex) => {
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
                                    height: `${Math.max(65, (planogram.shelfCount > 0 ? planogram.height / planogram.shelfCount : planogram.height) * SCALE)}px`,
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
                                                background: getProductColor(product.category).bg,
                                                border: `1px solid ${getProductColor(product.category).border}`,
                                                color: getProductColor(product.category).text,
                                                borderRadius: 'var(--radius-sm)',
                                                display: 'flex', flexDirection: 'column',
                                                alignItems: 'center', justifyContent: 'center',
                                                padding: '2px', fontSize: '0.55rem', overflow: 'hidden'
                                            }}
                                            title={`${product.name} (${product.category || '未分類'}) ×${sp.faceCount}`}
                                        >
                                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', fontSize: '0.55rem' }}>
                                                {product.name}
                                            </div>
                                            <div style={{ opacity: 0.8, fontSize: '0.45rem', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                                {product.jan}
                                            </div>
                                            {sp.faceCount > 1 && (
                                                <div style={{ fontSize: '0.45rem', opacity: 0.85, fontWeight: 600 }}>
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
                                <UnitDisplay valueMm={block.width} /> / {block.shelfCount}段
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
            initProductColorMap(productsData.map(p => p.category));
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

    // ブロック→什器マッピング計算
    const fixtureBlockOverlays = useMemo(() => {
        const overlays = new Map<string, Array<{
            blockName: string;
            colorIndex: number;
            relativeStartX: number;
            relativeEndX: number;
            fixtureWidth: number;
            isOverflow: boolean;
        }>>();

        for (const groupKey of Object.keys(FIXTURE_GROUPS) as FixtureGroup[]) {
            const groupTypes = FIXTURE_GROUPS[groupKey].types;
            for (const fType of groupTypes) {
                const storePlan = storePlanograms.find(sp => {
                    const std = standardPlanograms.find(s => s.id === sp.standardPlanogramId);
                    return (std?.fixtureType || 'multi-tier') === fType;
                });
                const stdPlan = storePlan
                    ? standardPlanograms.find(s => s.id === storePlan.standardPlanogramId)
                    : null;
                if (!stdPlan || !stdPlan.blocks.length) continue;

                const typePlacements = placements
                    .filter(p => {
                        const f = fixtures.find(fix => fix.id === p.fixtureId);
                        return f && (f.fixtureType || 'multi-tier') === fType;
                    })
                    .sort((a, b) => a.order - b.order);

                const ranges: { placementId: string; startX: number; endX: number; width: number }[] = [];
                let cumX = 0;
                for (const tp of typePlacements) {
                    const f = fixtures.find(fix => fix.id === tp.fixtureId);
                    if (!f) continue;
                    ranges.push({ placementId: tp.id, startX: cumX, endX: cumX + f.width, width: f.width });
                    cumX += f.width;
                }

                stdPlan.blocks.forEach((pb, blockIdx) => {
                    const master = blocks.find(b => b.id === pb.blockId);
                    if (!master) return;
                    const blockStart = pb.positionX;
                    const blockEnd = pb.positionX + master.width;
                    for (const range of ranges) {
                        const overlapStart = Math.max(blockStart, range.startX);
                        const overlapEnd = Math.min(blockEnd, range.endX);
                        if (overlapStart < overlapEnd) {
                            const existing = overlays.get(range.placementId) || [];
                            existing.push({
                                blockName: master.name,
                                colorIndex: blockIdx,
                                relativeStartX: overlapStart - range.startX,
                                relativeEndX: overlapEnd - range.startX,
                                fixtureWidth: range.width,
                                isOverflow: blockEnd > cumX
                            });
                            overlays.set(range.placementId, existing);
                        }
                    }
                });
            }
        }
        return overlays;
    }, [storePlanograms, standardPlanograms, placements, fixtures, blocks]);

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
                            {/* 売り場レイアウト（2Dグリッド） */}
                            <div className="card mb-lg" style={{ pageBreakAfter: 'auto' }}>
                                <div className="card-header">
                                    <div>
                                        <h3 className="card-title">{selectedStore.name} レイアウト</h3>
                                        <div className="text-sm text-muted">
                                            什器数: {placements.length}台 / 総幅: <UnitDisplay valueMm={placements.reduce((sum, p) => {
                                                const f = fixtures.find(fix => fix.id === p.fixtureId);
                                                return sum + (f?.width || 0);
                                            }, 0)} />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ overflow: 'auto', padding: '1rem', background: '#f8fafc', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
                                    {(() => {
                                        const LAYOUT_SCALE = 0.12;

                                        const getFixDims = (fixture: Fixture, direction: number = 0) => {
                                            const depth = fixture.fixtureType?.includes('end-cap') ? 600 : 900;
                                            const isRotated = direction === 90 || direction === 270;
                                            return {
                                                width: isRotated ? depth : fixture.width,
                                                height: isRotated ? fixture.width : depth,
                                            };
                                        };

                                        let maxX = 0;
                                        let maxY = 0;
                                        for (const p of placements) {
                                            const f = fixtures.find(fix => fix.id === p.fixtureId);
                                            if (!f) continue;
                                            const { width, height } = getFixDims(f, p.direction || 0);
                                            maxX = Math.max(maxX, p.positionX + width);
                                            maxY = Math.max(maxY, p.positionY + height);
                                        }
                                        maxX += 30;
                                        maxY += 30;

                                        if (placements.length === 0) {
                                            return (
                                                <div className="text-center text-muted" style={{ padding: '2rem' }}>
                                                    什器が配置されていません
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                style={{
                                                    width: `${maxX * LAYOUT_SCALE}px`,
                                                    height: `${maxY * LAYOUT_SCALE}px`,
                                                    position: 'relative',
                                                    backgroundImage: `
                                                        linear-gradient(to right, rgba(148, 163, 184, 0.15) 1px, transparent 1px),
                                                        linear-gradient(to bottom, rgba(148, 163, 184, 0.15) 1px, transparent 1px)
                                                    `,
                                                    backgroundSize: `${5 * LAYOUT_SCALE}px ${5 * LAYOUT_SCALE}px`,
                                                }}
                                            >
                                                {placements.map(p => {
                                                    const fixture = fixtures.find(f => f.id === p.fixtureId);
                                                    if (!fixture) return null;

                                                    const direction = p.direction || 0;
                                                    const isRotated = direction === 90 || direction === 270;
                                                    const { width: vw, height: vh } = getFixDims(fixture, direction);
                                                    const bgColor = fixture.fixtureType
                                                        ? (FIXTURE_BG[fixture.fixtureType] || FIXTURE_BG['default'])
                                                        : FIXTURE_BG['default'];

                                                    return (
                                                        <div
                                                            key={p.id}
                                                            style={{
                                                                position: 'absolute',
                                                                left: `${p.positionX * LAYOUT_SCALE}px`,
                                                                top: `${p.positionY * LAYOUT_SCALE}px`,
                                                                width: `${vw * LAYOUT_SCALE}px`,
                                                                height: `${vh * LAYOUT_SCALE}px`,
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    background: bgColor,
                                                                    border: '2px solid rgba(148, 163, 184, 0.6)',
                                                                    borderRadius: '6px',
                                                                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    flexDirection: 'column',
                                                                    overflow: 'hidden',
                                                                    writingMode: isRotated ? 'vertical-rl' : 'horizontal-tb',
                                                                    color: '#334155',
                                                                    fontSize: `${Math.max(9, 10 * LAYOUT_SCALE)}px`,
                                                                }}
                                                            >
                                                                <span style={{ fontWeight: 600, pointerEvents: 'none', position: 'relative', zIndex: 2 }}>
                                                                    {fixture.name.replace('（4尺）', '').replace('平台', '')}
                                                                </span>
                                                                <span style={{
                                                                    fontSize: `${Math.max(7, 8 * LAYOUT_SCALE)}px`,
                                                                    opacity: 0.8,
                                                                    pointerEvents: 'none',
                                                                    position: 'relative',
                                                                    zIndex: 2
                                                                }}>
                                                                    {Math.round(fixture.width / 300)}尺 / {fixture.shelfCount}段
                                                                </span>

                                                                {/* 段のストライプ表示 */}
                                                                {fixture.shelfCount > 1 && (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: 0, left: 0,
                                                                        width: '100%', height: '100%',
                                                                        display: 'flex',
                                                                        flexDirection: isRotated ? 'row' : 'column',
                                                                        pointerEvents: 'none',
                                                                        zIndex: 1
                                                                    }}>
                                                                        {Array.from({ length: fixture.shelfCount }).map((_, i) => (
                                                                            <div key={i} style={{
                                                                                flex: 1,
                                                                                borderBottom: !isRotated && i < fixture.shelfCount - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                                                                                borderRight: isRotated && i < fixture.shelfCount - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none'
                                                                            }} />
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* 棚ブロックオーバーレイ */}
                                                                {fixtureBlockOverlays.get(p.id)?.map((overlay, overlayIdx) => {
                                                                    const color = getBlockOverlayColor(overlay.colorIndex);
                                                                    const overlayWidthMm = overlay.relativeEndX - overlay.relativeStartX;
                                                                    return (
                                                                        <div
                                                                            key={`block-${overlayIdx}`}
                                                                            style={{
                                                                                position: 'absolute',
                                                                                left: `${overlay.relativeStartX * LAYOUT_SCALE}px`,
                                                                                top: 0,
                                                                                width: `${overlayWidthMm * LAYOUT_SCALE}px`,
                                                                                height: '100%',
                                                                                background: color.bg,
                                                                                border: `1.5px dashed ${color.border}`,
                                                                                borderRadius: '3px',
                                                                                pointerEvents: 'none',
                                                                                zIndex: 3,
                                                                                display: 'flex',
                                                                                alignItems: 'flex-end',
                                                                                justifyContent: 'center',
                                                                                overflow: 'hidden'
                                                                            }}
                                                                        >
                                                                            <div style={{
                                                                                fontSize: `${Math.max(7, 8 * LAYOUT_SCALE)}px`,
                                                                                fontWeight: 600,
                                                                                color: color.text,
                                                                                background: 'rgba(255,255,255,0.8)',
                                                                                padding: '1px 4px',
                                                                                borderRadius: '2px',
                                                                                whiteSpace: 'nowrap',
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                                maxWidth: '100%',
                                                                                marginBottom: '2px',
                                                                                lineHeight: 1.2
                                                                            }}>
                                                                                {overlay.blockName}
                                                                            </div>
                                                                            {overlay.isOverflow && (
                                                                                <div style={{
                                                                                    position: 'absolute',
                                                                                    top: '2px',
                                                                                    right: '2px',
                                                                                    fontSize: `${Math.max(6, 7 * LAYOUT_SCALE)}px`,
                                                                                    fontWeight: 700,
                                                                                    color: '#dc2626',
                                                                                    background: 'rgba(255,255,255,0.9)',
                                                                                    padding: '0px 3px',
                                                                                    borderRadius: '2px'
                                                                                }}>
                                                                                    ⚠
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
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
                    /* 非表示要素 */
                    .sidebar, .no-print { display: none !important; }

                    /* 全コンテナのoverflow・高さ制限を解除 */
                    html, body, #root, .app-layout, .main-content, .instruction-sheet-page {
                        overflow: visible !important;
                        height: auto !important;
                        min-height: 0 !important;
                        max-height: none !important;
                    }

                    /* レイアウトリセット */
                    .app-layout { display: block !important; }
                    .main-content {
                        margin: 0 !important;
                        padding: 0.5rem !important;
                        position: static !important;
                    }

                    /* 印刷用カラー：白背景・黒文字 */
                    body {
                        background: white !important;
                        color: #1a1a1a !important;
                        font-size: 11px !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* カードスタイル（印刷用） */
                    .instruction-sheet-body .card {
                        background: white !important;
                        border: 1px solid #ccc !important;
                        box-shadow: none !important;
                        backdrop-filter: none !important;
                        color: #1a1a1a !important;
                        break-inside: auto;
                    }
                    .instruction-sheet-body .card-header {
                        background: #f5f5f5 !important;
                        color: #1a1a1a !important;
                    }
                    .instruction-sheet-body .card-title {
                        color: #1a1a1a !important;
                    }
                    .instruction-sheet-body .text-muted {
                        color: #666 !important;
                    }

                    /* overflow・高さ制限を全子要素で解除 */
                    .instruction-sheet-body,
                    .instruction-sheet-body * {
                        overflow: visible !important;
                        max-height: none !important;
                    }

                    .instruction-sheet-page { padding: 0 !important; }
                    .page-header { margin-bottom: 0.5rem !important; }

                    /* ページ分割の制御 */
                    .instruction-planogram-section {
                        page-break-inside: avoid;
                    }
                }
            `}</style>
        </div>
    );
}
