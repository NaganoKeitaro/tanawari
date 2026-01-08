// 棚割管理システム - 単位表示コンポーネント
import { formatWithBothUnits } from '../../utils/unitConverter';

interface UnitDisplayProps {
    valueCm: number;
    className?: string;
}

/**
 * cm と 尺 を併記表示するコンポーネント
 * 例: "120cm (4.0尺)"
 */
export function UnitDisplay({ valueCm, className }: UnitDisplayProps) {
    return (
        <span className={className}>
            {formatWithBothUnits(valueCm)}
        </span>
    );
}

interface DimensionDisplayProps {
    width: number;
    height: number;
    depth?: number;
    className?: string;
}

/**
 * サイズ（W x H x D）を表示するコンポーネント
 */
export function DimensionDisplay({ width, height, depth, className }: DimensionDisplayProps) {
    const dimensions = depth
        ? `${width} × ${height} × ${depth}cm`
        : `${width} × ${height}cm`;

    return (
        <span className={className}>
            {dimensions}
        </span>
    );
}
