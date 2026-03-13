// 棚割管理システム - 店舗レイアウトビジュアライザー
import { useMemo, useState } from 'react';
import type { Store, Fixture, StoreFixturePlacement, ZoneType, ShelfBlock, StandardPlanogramBlock, FixtureType, Product } from '../../data/types';
import { ZONE_TYPES } from '../../data/types';
import { UnitDisplay } from '../common/UnitDisplay';
import { Modal } from '../common/Modal';

// ゾーンごとの色定義
const ZONE_COLORS: Record<ZoneType, { bg: string; border: string; text: string }> = {
    '多段': { bg: 'rgba(59, 130, 246, 0.3)', border: '#3B82F6', text: '#1E40AF' },
    '平台冷蔵': { bg: 'rgba(34, 197, 94, 0.3)', border: '#22C55E', text: '#166534' },
    '平台冷蔵エンド': { bg: 'rgba(34, 197, 94, 0.5)', border: '#16A34A', text: '#166534' },
    '平台冷凍': { bg: 'rgba(249, 115, 22, 0.3)', border: '#F97316', text: '#C2410C' },
    '平台冷凍エンド': { bg: 'rgba(249, 115, 22, 0.5)', border: '#EA580C', text: '#C2410C' }
};

// ブロック色パレット（視認性の高い色）
const BLOCK_COLORS = [
    '#f472b6', // Pink
    '#a78bfa', // Violet
    '#60a5fa', // Blue
    '#34d399', // Emerald
    '#fbbf24', // Amber
    '#fb923c', // Orange
    '#f87171', // Red
    '#4ade80', // Green
    '#22d3ee', // Cyan
    '#e879f9', // Fuchsia
];

// ブロックマッピング型定義
interface BlockMapping {
    blockId: string;
    blockName: string;
    placementId: string;
    fixtureId: string;
    relativeStartX: number;
    relativeEndX: number;
    originalWidth: number;
    colorIndex: number;
}

// 什器タイプからゾーンを推測
function inferZoneFromFixture(fixture: Fixture): ZoneType {
    if (fixture.fixtureType === 'multi-tier' || fixture.name.includes('多段')) return '多段';
    if (fixture.fixtureType === 'flat-frozen' || fixture.name.includes('冷凍')) {
        if (fixture.fixtureType === 'end-cap-frozen' || fixture.name.includes('エンド')) return '平台冷凍エンド';
        return '平台冷凍';
    }
    if (fixture.fixtureType === 'flat-refrigerated' || fixture.name.includes('冷蔵') || fixture.name.includes('平台')) {
        if (fixture.fixtureType === 'end-cap-refrigerated' || fixture.name.includes('エンド')) return '平台冷蔵エンド';
        return '平台冷蔵';
    }
    return '多段'; // デフォルト
}

interface StoreLayoutVisualizerProps {
    store: Store;
    placements: StoreFixturePlacement[];
    fixtures: Fixture[];
    onPlacementClick?: (placement: StoreFixturePlacement, fixture: Fixture) => void;
    onRemovePlacement?: (placementId: string) => void;
    selectedPlacementId?: string | null;
    scale?: number;
    // 棚割ブロック表示用（オプション）
    blocks?: ShelfBlock[];
    planogramBlocks?: StandardPlanogramBlock[];
    fixtureTypeFilter?: FixtureType;
    onBlockClick?: (block: ShelfBlock) => void;
    products?: Product[];
}

export function StoreLayoutVisualizer({
    store,
    placements,
    fixtures,
    onPlacementClick,
    onRemovePlacement,
    selectedPlacementId,
    scale = 0.5,
    blocks = [],
    planogramBlocks = [],
    fixtureTypeFilter,
    onBlockClick,
    products = []
}: StoreLayoutVisualizerProps) {
    const [selectedBlock, setSelectedBlock] = useState<ShelfBlock | null>(null);
    // ゾーン別に什器をグループ化
    const groupedPlacements = useMemo(() => {
        const groups: Record<ZoneType, Array<{ placement: StoreFixturePlacement; fixture: Fixture }>> = {
            '多段': [],
            '平台冷蔵': [],
            '平台冷蔵エンド': [],
            '平台冷凍': [],
            '平台冷凍エンド': []
        };

        for (const placement of placements) {
            const fixture = fixtures.find(f => f.id === placement.fixtureId);
            if (!fixture) continue;

            const zone = placement.zone || inferZoneFromFixture(fixture);
            groups[zone].push({ placement, fixture });
        }

        // 各ゾーン内でorder順にソート
        for (const zone of ZONE_TYPES) {
            groups[zone].sort((a, b) => a.placement.order - b.placement.order);
        }

        return groups;
    }, [placements, fixtures]);

    // ゾーン別の統計
    const zoneStats = useMemo(() => {
        const stats: Record<ZoneType, { count: number; totalWidth: number }> = {} as any;
        for (const zone of ZONE_TYPES) {
            const items = groupedPlacements[zone];
            stats[zone] = {
                count: items.length,
                totalWidth: items.reduce((sum, item) => sum + item.fixture.width, 0)
            };
        }
        return stats;
    }, [groupedPlacements]);

    // 結合されたプラットフォーム（平台）グループを作成
    const combinedPlatforms = useMemo(() => {
        // 冷蔵系
        const refrigerated = [
            ...groupedPlacements['平台冷蔵'],
            ...groupedPlacements['平台冷蔵エンド']
        ].sort((a, b) => a.placement.order - b.placement.order);

        // 冷凍系
        const frozen = [
            ...groupedPlacements['平台冷凍'],
            ...groupedPlacements['平台冷凍エンド']
        ].sort((a, b) => a.placement.order - b.placement.order);

        return { refrigerated, frozen };
    }, [groupedPlacements]);

    // レイアウト幅の計算（最大幅を取得）
    const maxWidth = Math.max(
        zoneStats['多段'].totalWidth,
        // 平台は結合して計算（エンドの扱いによるが、簡易的に合計）
        combinedPlatforms.refrigerated.reduce((sum, item) => {
            // エンドの場合は幅ではなく奥行きを使用するように視覚的にはなるが、
            // 総幅としては単純合計で一旦計算
            return sum + item.fixture.width;
        }, 0),
        combinedPlatforms.frozen.reduce((sum, item) => sum + item.fixture.width, 0),
        1560 // 最小幅
    );

    // ブロック→什器マッピング計算
    const blockMappings = useMemo(() => {
        if (!planogramBlocks.length || !blocks.length) return new Map<string, BlockMapping[]>();

        const mappings = new Map<string, BlockMapping[]>();

        // fixtureTypeFilterでフィルタリング
        let filteredPlacements = [...placements];
        if (fixtureTypeFilter) {
            filteredPlacements = placements.filter(p => {
                const fixture = fixtures.find(f => f.id === p.fixtureId);
                return fixture?.fixtureType === fixtureTypeFilter;
            });
        }

        // order順にソート
        filteredPlacements.sort((a, b) => a.order - b.order);

        // 累積幅マップを構築
        const fixtureRanges: Map<string, { startX: number; endX: number }> = new Map();
        let cumulativeX = 0;
        for (const placement of filteredPlacements) {
            const fixture = fixtures.find(f => f.id === placement.fixtureId);
            if (!fixture) continue;
            fixtureRanges.set(placement.id, { startX: cumulativeX, endX: cumulativeX + fixture.width });
            cumulativeX += fixture.width;
        }

        // 各ブロックをどの什器に割り当てるか計算
        planogramBlocks.forEach((pb, index) => {
            const master = blocks.find(b => b.id === pb.blockId);
            if (!master) return;

            const blockStartX = pb.positionX;
            const blockEndX = pb.positionX + master.width;

            for (const placement of filteredPlacements) {
                const range = fixtureRanges.get(placement.id);
                if (!range) continue;

                const overlapStart = Math.max(blockStartX, range.startX);
                const overlapEnd = Math.min(blockEndX, range.endX);

                if (overlapStart < overlapEnd) {
                    const mapping: BlockMapping = {
                        blockId: master.id,
                        blockName: master.name,
                        placementId: pb.id,
                        fixtureId: placement.id,
                        relativeStartX: overlapStart - range.startX,
                        relativeEndX: overlapEnd - range.startX,
                        originalWidth: master.width,
                        colorIndex: index % BLOCK_COLORS.length
                    };

                    const existing = mappings.get(placement.id) || [];
                    existing.push(mapping);
                    mappings.set(placement.id, existing);
                }
            }
        });

        return mappings;
    }, [placements, fixtures, blocks, planogramBlocks, fixtureTypeFilter]);

    // 什器レンダリング
    const renderFixture = (
        placement: StoreFixturePlacement,
        fixture: Fixture,
        zone: ZoneType
    ) => {
        const colors = ZONE_COLORS[zone];
        const isSelected = selectedPlacementId === placement.id;

        // エンド判定
        const isEndCap = zone.includes('エンド') || (fixture.fixtureType || '').includes('end-cap');

        // 寸法計算
        // 通常: 幅=fixture.width, 奥行(高さ)=固定(例:90cm)
        // エンド(横置き): 幅=奥行(例:60cm), 高さ=fixture.width
        const DEPTH_VISUAL_MM = 900; // メイン什器の奥行き（仮定）
        const END_CAP_DEPTH_MM = 600; // エンド什器の奥行き（仮定）

        const depth = fixture.fixtureType?.includes('end-cap') ? END_CAP_DEPTH_MM : DEPTH_VISUAL_MM;

        let visualWidth = fixture.width;
        let visualHeight = depth / 10; // Convert mm to cm for visual height

        if (isEndCap) {
            visualWidth = END_CAP_DEPTH_MM / 10; // Convert mm to cm
            visualHeight = fixture.width; // 横置きにするので、什器の幅が視覚的な高さになる
        } else if (zone === '多段') {
            visualHeight = fixture.height * 0.8; // 多段は高さをある程度反映
        }

        return (
            <div
                key={placement.id}
                style={{
                    width: `${visualWidth * scale}px`,
                    height: `${visualHeight * scale}px`,
                    background: colors.bg,
                    border: `2px solid ${isSelected ? 'var(--color-primary)' : colors.border}`,
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: isEndCap ? 'row' : 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    fontSize: `${Math.max(9, 11 * scale)}px`,
                    color: colors.text,
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 0 0 3px rgba(16, 185, 129, 0.3)' : 'none',
                    writingMode: isEndCap ? 'vertical-rl' : 'horizontal-tb'
                }}
                onClick={() => onPlacementClick?.(placement, fixture)}
                title={`${fixture.name}\n${fixture.width}mm × ${fixture.shelfCount}段`}
            >
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90%' }}>
                    {fixture.name.replace('（4尺）', '').replace('平台', '')}
                </div>
                {!isEndCap && (
                    <div style={{ fontSize: `${Math.max(8, 9 * scale)}px`, opacity: 0.8 }}>
                        {Math.round(fixture.width / 300)}尺
                    </div>
                )}
                {onRemovePlacement && isSelected && (
                    <button
                        style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'var(--color-danger)',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            writingMode: 'horizontal-tb'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemovePlacement(placement.id);
                        }}
                    >
                        ×
                    </button>
                )}

                {/* ブロック表示レイヤー */}
                {blockMappings.get(placement.id)?.map((mapping, idx) => (
                    <div
                        key={`${mapping.placementId}-${idx}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            const master = blocks.find(b => b.id === mapping.blockId);
                            if (master) {
                                setSelectedBlock(master);
                                onBlockClick?.(master);
                            }
                        }}
                        style={{
                            position: 'absolute',
                            left: `${mapping.relativeStartX * scale}px`,
                            top: '15%',
                            width: `${(mapping.relativeEndX - mapping.relativeStartX) * scale}px`,
                            height: '70%',
                            border: `3px solid ${BLOCK_COLORS[mapping.colorIndex]}`,
                            borderRadius: '4px',
                            background: `${BLOCK_COLORS[mapping.colorIndex]}20`,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: `${Math.max(7, 8 * scale)}px`,
                            fontWeight: 600,
                            color: '#1e293b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            zIndex: 5,
                            writingMode: 'horizontal-tb'
                        }}
                        title={`${mapping.blockName}\n幅: ${mapping.originalWidth}mm\nクリックで詳細表示`}
                    >
                        {mapping.blockName}
                    </div>
                ))}
            </div>
        );
    };

    // ゾーン行レンダリング
    const renderZoneRow = (items: Array<{ placement: StoreFixturePlacement; fixture: Fixture }>, label: string) => {
        if (items.length === 0) return null;

        const totalWidth = items.reduce((sum, item) => sum + item.fixture.width, 0);

        return (
            <div style={{ marginBottom: '1rem' }}>
                <div
                    className="flex items-center gap-sm mb-sm"
                    style={{ fontSize: '0.75rem' }}
                >
                    <div
                        style={{
                            width: '12px',
                            height: '12px',
                            background: 'var(--color-primary)', // 簡易色
                            borderRadius: '2px'
                        }}
                    />
                    <span style={{ fontWeight: 600 }}>{label}</span>
                    <span className="text-muted">
                        ({items.length}台 / <UnitDisplay valueMm={totalWidth} />)
                    </span>
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'nowrap',
                        alignItems: 'flex-start',
                        gap: '0',
                        padding: '1rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        minHeight: '120px',
                        overflowX: 'auto',
                        maxWidth: '100%'
                    }}
                >
                    {items.map(({ placement, fixture }) => {
                        const zone = placement.zone || inferZoneFromFixture(fixture);
                        return renderFixture(placement, fixture, zone);
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="card">
            <div className="card-header">
                <div>
                    <h3 className="card-title">{store.name} レイアウト</h3>
                    <div className="text-sm text-muted">
                        {store.code} / {store.fmt} / {store.region}
                    </div>
                </div>
                <div className="text-right text-sm">
                    <div>総幅: <strong><UnitDisplay valueMm={maxWidth} /></strong></div>
                    <div className="text-muted">什器数: {placements.length}台</div>
                </div>
            </div>

            {/* レイアウト表示 */}
            <div style={{ overflowX: 'auto', padding: '1rem' }}>
                {/* 多段ゾーン */}
                {renderZoneRow(groupedPlacements['多段'], '多段ゾーン')}

                {/* 平台ゾーン */}
                <div
                    style={{
                        padding: '1rem',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        marginTop: '1rem'
                    }}
                >
                    <div className="text-sm" style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                        📦 平台ゾーン
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        {/* 冷蔵側（エンド含む） */}
                        {renderZoneRow(combinedPlatforms.refrigerated, '冷蔵エリア（エンド含む）')}

                        {/* 冷凍側（エンド含む） */}
                        {renderZoneRow(combinedPlatforms.frozen, '冷凍エリア（エンド含む）')}
                    </div>
                </div>
            </div>

            {/* 凡例 */}
            <div
                style={{
                    display: 'flex',
                    gap: '1.5rem',
                    justifyContent: 'center',
                    padding: '1rem',
                    borderTop: '1px solid var(--border-color)',
                    flexWrap: 'wrap'
                }}
            >
                {ZONE_TYPES.map(zone => {
                    const colors = ZONE_COLORS[zone];
                    const stats = zoneStats[zone];
                    if (stats.count === 0) return null;
                    return (
                        <div key={zone} className="flex items-center gap-sm text-xs">
                            <div
                                style={{
                                    width: '16px',
                                    height: '16px',
                                    background: colors.bg,
                                    border: `2px solid ${colors.border}`,
                                    borderRadius: '3px'
                                }}
                            />
                            <span>{zone}</span>
                            <span className="text-muted">
                                ({Math.round(stats.totalWidth / 300)}尺)
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* ブロック凡例（ブロックが指定されている場合） */}
            {planogramBlocks.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        gap: '1rem',
                        justifyContent: 'center',
                        padding: '0.75rem',
                        borderTop: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        flexWrap: 'wrap'
                    }}
                >
                    <span className="text-xs text-muted" style={{ marginRight: '0.5rem' }}>棚ブロック:</span>
                    {planogramBlocks.map((pb, index) => {
                        const master = blocks.find(b => b.id === pb.blockId);
                        if (!master) return null;
                        return (
                            <div
                                key={pb.id}
                                className="flex items-center gap-sm text-xs"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedBlock(master)}
                            >
                                <div
                                    style={{
                                        width: '12px',
                                        height: '12px',
                                        border: `2px solid ${BLOCK_COLORS[index % BLOCK_COLORS.length]}`,
                                        borderRadius: '2px',
                                        background: `${BLOCK_COLORS[index % BLOCK_COLORS.length]}30`
                                    }}
                                />
                                <span>{master.name}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ブロック詳細モーダル */}
            <Modal
                isOpen={!!selectedBlock}
                onClose={() => setSelectedBlock(null)}
                title={`棚ブロック: ${selectedBlock?.name}`}
            >
                {selectedBlock && (
                    <div>
                        <div className="mb-md">
                            <div className="text-sm text-muted">サイズ</div>
                            <div><UnitDisplay valueMm={selectedBlock.width * 10} /> / {selectedBlock.shelfCount}段</div>
                        </div>
                        {selectedBlock.description && (
                            <div className="mb-md">
                                <div className="text-sm text-muted">説明</div>
                                <div>{selectedBlock.description}</div>
                            </div>
                        )}
                        <div className="mb-md">
                            <div className="text-sm text-muted">配置商品 ({selectedBlock.productPlacements.length}商品)</div>
                        </div>
                        <div style={{
                            maxHeight: '300px',
                            overflowY: 'auto',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-secondary)'
                        }}>
                            {selectedBlock.productPlacements.length === 0 ? (
                                <div className="text-center text-muted" style={{ padding: '1rem' }}>
                                    商品が配置されていません
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                                            <th className="text-left text-xs" style={{ padding: '0.5rem' }}>商品名</th>
                                            <th className="text-center text-xs" style={{ padding: '0.5rem', width: '60px' }}>フェイス</th>
                                            <th className="text-center text-xs" style={{ padding: '0.5rem', width: '60px' }}>段</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedBlock.productPlacements.map((pp, idx) => {
                                            const product = products.find(p => p.id === pp.productId);
                                            return (
                                                <tr key={pp.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td className="text-sm" style={{ padding: '0.5rem' }}>
                                                        {product?.name || '不明な商品'}
                                                    </td>
                                                    <td className="text-center text-sm" style={{ padding: '0.5rem' }}>
                                                        {pp.faceCount}
                                                    </td>
                                                    <td className="text-center text-sm" style={{ padding: '0.5rem' }}>
                                                        {pp.shelfIndex + 1}段目
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
