// 棚割管理システム - 単位表示コンポーネント
import { formatWithBothUnits } from '../../utils/unitConverter';

interface UnitDisplayProps {
    valueMm: number;
    className?: string;
}

/**
 * mm と 尺 を併記表示するコンポーネント
 * 例: "1200mm (4.0尺)"
 */
export function UnitDisplay({ valueMm, className }: UnitDisplayProps) {
    return (
        <span className={className}>
            {formatWithBothUnits(valueMm)}
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
        ? `${width} × ${height} × ${depth}mm`
        : `${width} × ${height}mm`;

    return (
        <span className={className}>
            {dimensions}
        </span>
    );
}
