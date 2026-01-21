// 棚割管理システム - メトリクスチャートコンポーネント
import type { CategoryMetrics } from '../../utils/aggregationUtils';

export interface MetricsChartProps {
    data: CategoryMetrics[];
    metric: 'sales' | 'grossProfit' | 'quantity' | 'traffic';
    title: string;
    type?: 'bar' | 'pie';
}

export function MetricsChart({
    data,
    metric,
    title,
    type = 'bar'
}: MetricsChartProps) {
    const getMetricValue = (item: CategoryMetrics): number => {
        return item.metrics[metric];
    };

    const maxValue = Math.max(...data.map(getMetricValue));
    const total = data.reduce((sum, item) => sum + getMetricValue(item), 0);

    // カラーパレット
    const colors = [
        '#3b82f6', // blue
        '#10b981', // green
        '#f59e0b', // amber
        '#ef4444', // red
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#14b8a6', // teal
        '#f97316', // orange
    ];

    if (type === 'bar') {
        return (
            <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
                <h3 className="text-lg mb-md" style={{ margin: 0 }}>{title}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {data.slice(0, 8).map((item, index) => {
                        const value = getMetricValue(item);
                        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
                        const share = total > 0 ? (value / total) * 100 : 0;

                        return (
                            <div key={item.category}>
                                <div className="flex items-center justify-between mb-xs">
                                    <span className="text-sm">{item.category}</span>
                                    <span className="text-sm text-muted">
                                        {value.toLocaleString('ja-JP')} ({share.toFixed(1)}%)
                                    </span>
                                </div>
                                <div
                                    style={{
                                        width: '100%',
                                        height: '8px',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${percentage}%`,
                                            height: '100%',
                                            backgroundColor: colors[index % colors.length],
                                            transition: 'width 0.3s ease'
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // 円グラフ(簡易版)
    return (
        <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
            <h3 className="text-lg mb-md" style={{ margin: 0 }}>{title}</h3>
            <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                {/* 円グラフ部分 */}
                <div style={{ flex: '0 0 200px', position: 'relative' }}>
                    <svg viewBox="0 0 200 200" style={{ width: '200px', height: '200px' }}>
                        {(() => {
                            let currentAngle = 0;
                            return data.slice(0, 8).map((item, index) => {
                                const value = getMetricValue(item);
                                const percentage = total > 0 ? value / total : 0;
                                const angle = percentage * 360;

                                const startAngle = currentAngle;
                                const endAngle = currentAngle + angle;
                                currentAngle = endAngle;

                                const startRad = (startAngle - 90) * (Math.PI / 180);
                                const endRad = (endAngle - 90) * (Math.PI / 180);

                                const x1 = 100 + 80 * Math.cos(startRad);
                                const y1 = 100 + 80 * Math.sin(startRad);
                                const x2 = 100 + 80 * Math.cos(endRad);
                                const y2 = 100 + 80 * Math.sin(endRad);

                                const largeArc = angle > 180 ? 1 : 0;

                                return (
                                    <path
                                        key={item.category}
                                        d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                        fill={colors[index % colors.length]}
                                        stroke="white"
                                        strokeWidth="2"
                                    />
                                );
                            });
                        })()}
                    </svg>
                </div>

                {/* 凡例 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    {data.slice(0, 8).map((item, index) => {
                        const value = getMetricValue(item);
                        const share = total > 0 ? (value / total) * 100 : 0;

                        return (
                            <div key={item.category} className="flex items-center gap-sm">
                                <div
                                    style={{
                                        width: '12px',
                                        height: '12px',
                                        backgroundColor: colors[index % colors.length],
                                        borderRadius: '2px'
                                    }}
                                />
                                <span className="text-sm flex-1">{item.category}</span>
                                <span className="text-sm text-muted">
                                    {share.toFixed(1)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
