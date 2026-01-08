// 棚割管理システム - 単位変換ユーティリティ
import { SHAKU_TO_CM } from '../data/types';

/**
 * cmを尺に変換
 */
export function cmToShaku(cm: number): number {
    return cm / SHAKU_TO_CM;
}

/**
 * 尺をcmに変換
 */
export function shakuToCm(shaku: number): number {
    return shaku * SHAKU_TO_CM;
}

/**
 * 表示用フォーマット: "120cm (4.0尺)"
 */
export function formatWithBothUnits(cm: number): string {
    const shaku = cmToShaku(cm);
    return `${cm}cm (${shaku.toFixed(1)}尺)`;
}

/**
 * 入力値をパースしてcmに変換
 * "120cm", "4尺", "120" (デフォルトcm) に対応
 */
export function parseInputToCm(input: string): number | null {
    const trimmed = input.trim();

    if (!trimmed) return null;

    // 尺の入力
    if (trimmed.endsWith('尺')) {
        const value = parseFloat(trimmed.slice(0, -1));
        if (isNaN(value)) return null;
        return shakuToCm(value);
    }

    // cmの入力
    if (trimmed.endsWith('cm')) {
        const value = parseFloat(trimmed.slice(0, -2));
        if (isNaN(value)) return null;
        return value;
    }

    // 数値のみ（デフォルトでcmとして扱う）
    const value = parseFloat(trimmed);
    if (isNaN(value)) return null;
    return value;
}

/**
 * 入力値をパースして尺に変換
 */
export function parseInputToShaku(input: string): number | null {
    const cm = parseInputToCm(input);
    if (cm === null) return null;
    return cmToShaku(cm);
}
