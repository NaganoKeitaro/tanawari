// 棚割管理システム - 店舗レイアウトビジュアライザー
import { useMemo } from 'react';
import type { Store, Fixture, StoreFixturePlacement, ZoneType } from '../../data/types';
import { ZONE_TYPES } from '../../data/types';
import { UnitDisplay } from '../common/UnitDisplay';

// ゾーンごとの色定義
const ZONE_COLORS: Record<ZoneType, { bg: string; border: string; text: string }> = {
    '多段': { bg: 'rgba(59, 130, 246, 0.3)', border: '#3B82F6', text: '#1E40AF' },
    '平台冷蔵': { bg: 'rgba(34, 197, 94, 0.3)', border: '#22C55E', text: '#166534' },
    '平台冷蔵エンド': { bg: 'rgba(34, 197, 94, 0.5)', border: '#16A34A', text: '#166534' },
    '平台冷凍': { bg: 'rgba(249, 115, 22, 0.3)', border: '#F97316', text: '#C2410C' },
    '平台冷凍エンド': { bg: 'rgba(249, 115, 22, 0.5)', border: '#EA580C', text: '#C2410C' }
};

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
}

export function StoreLayoutVisualizer({
    store,
    placements,
    fixtures,
    onPlacementClick,
    onRemovePlacement,
    selectedPlacementId,
    scale = 0.5
}: StoreLayoutVisualizerProps) {
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

    // レイアウト幅の計算（最大幅を取得）
    const maxWidth = Math.max(
        zoneStats['多段'].totalWidth,
        zoneStats['平台冷蔵'].totalWidth + zoneStats['平台冷蔵エンド'].totalWidth,
        zoneStats['平台冷凍'].totalWidth + zoneStats['平台冷凍エンド'].totalWidth,
        1560 // 最小幅
    );

    // 什器レンダリング
    const renderFixture = (
        placement: StoreFixturePlacement,
        fixture: Fixture,
        zone: ZoneType
    ) => {
        const colors = ZONE_COLORS[zone];
        const isSelected = selectedPlacementId === placement.id;

        return (
            <div
                key={placement.id}
                style={{
                    width: `${fixture.width * scale}px`,
                    height: zone === '多段' ? `${fixture.height * scale * 0.8}px` : `${60 * scale}px`,
                    background: colors.bg,
                    border: `2px solid ${isSelected ? 'var(--color-primary)' : colors.border}`,
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    fontSize: `${Math.max(9, 11 * scale)}px`,
                    color: colors.text,
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 0 0 3px rgba(99, 102, 241, 0.3)' : 'none'
                }}
                onClick={() => onPlacementClick?.(placement, fixture)}
                title={`${fixture.name}\n${fixture.width}cm × ${fixture.shelfCount}段`}
            >
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90%' }}>
                    {fixture.name.replace('（4尺）', '').replace('平台', '')}
                </div>
                <div style={{ fontSize: `${Math.max(8, 9 * scale)}px`, opacity: 0.8 }}>
                    {Math.round(fixture.width / 30)}尺
                </div>
                {zone === '多段' && (
                    <div style={{ fontSize: `${Math.max(7, 8 * scale)}px`, opacity: 0.7 }}>
                        {fixture.shelfCount}段
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
                            justifyContent: 'center'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemovePlacement(placement.id);
                        }}
                    >
                        ×
                    </button>
                )}
            </div>
        );
    };

    // ゾーン行レンダリング
    const renderZoneRow = (zone: ZoneType, label: string) => {
        const items = groupedPlacements[zone];
        const stats = zoneStats[zone];
        const colors = ZONE_COLORS[zone];

        if (items.length === 0) return null;

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
                            background: colors.bg,
                            border: `2px solid ${colors.border}`,
                            borderRadius: '2px'
                        }}
                    />
                    <span style={{ fontWeight: 600, color: colors.text }}>{label}</span>
                    <span className="text-muted">
                        ({stats.count}台 / <UnitDisplay valueCm={stats.totalWidth} />)
                    </span>
                </div>
                <div
                    style={{
                        display: 'flex',
                        gap: '2px',
                        flexWrap: 'wrap',
                        padding: '0.5rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${colors.border}`,
                        minHeight: zone === '多段' ? '100px' : '50px'
                    }}
                >
                    {items.map(({ placement, fixture }) =>
                        renderFixture(placement, fixture, zone)
                    )}
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
                    <div>総幅: <strong><UnitDisplay valueCm={maxWidth} /></strong></div>
                    <div className="text-muted">什器数: {placements.length}台</div>
                </div>
            </div>

            {/* レイアウト表示 */}
            <div style={{ overflowX: 'auto', padding: '1rem' }}>
                {/* 多段ゾーン */}
                {renderZoneRow('多段', '多段ゾーン')}

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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* 冷蔵側 */}
                        <div>
                            <div className="text-xs text-muted mb-sm">🧊 冷蔵エリア</div>
                            {renderZoneRow('平台冷蔵', '冷蔵')}
                            {renderZoneRow('平台冷蔵エンド', '冷蔵エンド')}
                        </div>

                        {/* 冷凍側 */}
                        <div>
                            <div className="text-xs text-muted mb-sm">❄️ 冷凍エリア</div>
                            {renderZoneRow('平台冷凍', '冷凍')}
                            {renderZoneRow('平台冷凍エンド', '冷凍エンド')}
                        </div>
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
                                ({Math.round(stats.totalWidth / 30)}尺)
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
