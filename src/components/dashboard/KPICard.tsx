// 棚割管理システム - KPIカードコンポーネント

export interface KPICardProps {
    title: string;
    value: number | string;
    unit?: string;
    icon?: string;
    color?: 'primary' | 'success' | 'warning' | 'danger';
    trend?: number; // 前期比(%)
    subtitle?: string;
}

export function KPICard({
    title,
    value,
    unit = '',
    icon = '📊',
    color = 'primary',
    trend,
    subtitle
}: KPICardProps) {
    const formatValue = (val: number | string): string => {
        if (typeof val === 'number') {
            // 大きな数値はカンマ区切りで表示
            return val.toLocaleString('ja-JP');
        }
        return val;
    };

    const getTrendColor = (trendValue: number): string => {
        if (trendValue > 0) return 'var(--color-success)';
        if (trendValue < 0) return 'var(--color-danger)';
        return 'var(--text-muted)';
    };

    const getColorVar = (colorName: string): string => {
        return `var(--color-${colorName})`;
    };

    return (
        <div
            className="card"
            style={{
                padding: 'var(--spacing-lg)',
                borderLeft: `4px solid ${getColorVar(color)}`,
                transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <div className="flex items-center justify-between mb-sm">
                <h3 className="text-sm text-muted" style={{ margin: 0, fontWeight: 500 }}>
                    {title}
                </h3>
                <span style={{ fontSize: '1.5rem' }}>{icon}</span>
            </div>

            <div className="flex items-baseline gap-xs mb-xs">
                <span
                    className="text-2xl"
                    style={{
                        fontWeight: 700,
                        color: getColorVar(color)
                    }}
                >
                    {formatValue(value)}
                </span>
                {unit && (
                    <span className="text-sm text-muted">{unit}</span>
                )}
            </div>

            {subtitle && (
                <div className="text-xs text-muted mb-xs">
                    {subtitle}
                </div>
            )}

            {trend !== undefined && (
                <div
                    className="text-sm flex items-center gap-xs"
                    style={{ color: getTrendColor(trend) }}
                >
                    <span>{trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}</span>
                    <span>{Math.abs(trend).toFixed(1)}%</span>
                    <span className="text-xs text-muted">前期比</span>
                </div>
            )}
        </div>
    );
}
