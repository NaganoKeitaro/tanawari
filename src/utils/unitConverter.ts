// 棚割管理システム - 単位変換ユーティリティ
import { SHAKU_TO_MM } from '../data/types';

/**
 * mmを尺に変換
 */
export function mmToShaku(mm: number): number {
    return mm / SHAKU_TO_MM;
}

/**
 * 尺をmmに変換
 */
export function shakuToMm(shaku: number): number {
    return shaku * SHAKU_TO_MM;
}

/**
 * 表示用フォーマット: "1200mm (4.0尺)"
 */
export function formatWithBothUnits(mm: number): string {
    const shaku = mmToShaku(mm);
    return `${mm}mm (${shaku.toFixed(1)}尺)`;
}

/**
 * 入力値をパースしてmmに変換
 * "1200mm", "4尺", "1200" (デフォルトmm) に対応
 */
export function parseInputToMm(input: string): number | null {
    const trimmed = input.trim();

    if (!trimmed) return null;

    // 尺の入力
    if (trimmed.endsWith('尺')) {
        const value = parseFloat(trimmed.slice(0, -1));
        if (isNaN(value)) return null;
        return shakuToMm(value);
    }

    // mmの入力
    if (trimmed.endsWith('mm')) {
        const value = parseFloat(trimmed.slice(0, -2));
        if (isNaN(value)) return null;
        return value;
    }

    // 数値のみ（デフォルトでmmとして扱う）
    const value = parseFloat(trimmed);
    if (isNaN(value)) return null;
    return value;
}

/**
 * 入力値をパースして尺に変換
 */
export function parseInputToShaku(input: string): number | null {
    const mm = parseInputToMm(input);
    if (mm === null) return null;
    return mmToShaku(mm);
}
