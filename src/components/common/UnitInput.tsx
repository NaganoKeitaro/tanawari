// 棚割管理システム - 単位入力コンポーネント
import { useState, useEffect, useCallback } from 'react';
import { cmToShaku } from '../../utils/unitConverter';

interface UnitInputProps {
    value: number;
    onChange: (valueCm: number) => void;
    label?: string;
    placeholder?: string;
    className?: string;
    required?: boolean;
    min?: number;
    max?: number;
}

/**
 * cm/尺 どちらでも入力可能なコンポーネント
 * 内部では常にcmで値を管理
 */
export function UnitInput({
    value,
    onChange,
    label,
    placeholder = "120cm または 4尺",
    className,
    required,
    min,
    max
}: UnitInputProps) {
    const [inputValue, setInputValue] = useState('');
    const [unit, setUnit] = useState<'cm' | 'shaku'>('cm');
    const [error, setError] = useState('');

    // 外部値の変更を反映
    useEffect(() => {
        if (unit === 'cm') {
            setInputValue(value.toString());
        } else {
            setInputValue(cmToShaku(value).toFixed(2));
        }
    }, [value, unit]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        setInputValue(rawValue);
        setError('');

        if (!rawValue.trim()) {
            return;
        }

        // 数値のみの入力の場合、現在の単位に基づいて変換
        const numValue = parseFloat(rawValue);
        if (!isNaN(numValue)) {
            let cmValue = unit === 'cm' ? numValue : numValue * 30;

            // バリデーション
            if (min !== undefined && cmValue < min) {
                setError(`最小値は ${min}cm です`);
                return;
            }
            if (max !== undefined && cmValue > max) {
                setError(`最大値は ${max}cm です`);
                return;
            }

            onChange(cmValue);
        }
    }, [unit, onChange, min, max]);

    const handleUnitChange = useCallback((newUnit: 'cm' | 'shaku') => {
        setUnit(newUnit);
        if (newUnit === 'cm') {
            setInputValue(value.toString());
        } else {
            setInputValue(cmToShaku(value).toFixed(2));
        }
    }, [value]);

    const shaku = cmToShaku(value);

    return (
        <div className={`form-group ${className || ''}`}>
            {label && <label className="form-label">{label}</label>}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                    type="text"
                    className="form-input"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    required={required}
                    style={{ flex: 1 }}
                />
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                        type="button"
                        className={`btn btn-sm ${unit === 'cm' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleUnitChange('cm')}
                    >
                        cm
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm ${unit === 'shaku' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleUnitChange('shaku')}
                    >
                        尺
                    </button>
                </div>
            </div>
            <div className="form-hint" style={{ marginTop: '0.25rem' }}>
                {value}cm ({shaku.toFixed(1)}尺)
            </div>
            {error && (
                <div className="text-danger text-xs" style={{ marginTop: '0.25rem' }}>
                    {error}
                </div>
            )}
        </div>
    );
}

interface SizeInputProps {
    width: number;
    height: number;
    depth?: number;
    onChange: (size: { width: number; height: number; depth?: number }) => void;
    showDepth?: boolean;
    className?: string;
}

/**
 * サイズ（W x H x D）入力コンポーネント
 */
export function SizeInput({
    width,
    height,
    depth,
    onChange,
    showDepth = true,
    className
}: SizeInputProps) {
    return (
        <div className={className}>
            <div style={{ display: 'grid', gridTemplateColumns: showDepth ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <UnitInput
                    label="幅 (W)"
                    value={width}
                    onChange={(w) => onChange({ width: w, height, depth })}
                    min={1}
                />
                <UnitInput
                    label="高さ (H)"
                    value={height}
                    onChange={(h) => onChange({ width, height: h, depth })}
                    min={1}
                />
                {showDepth && (
                    <UnitInput
                        label="奥行 (D)"
                        value={depth || 0}
                        onChange={(d) => onChange({ width, height, depth: d })}
                        min={1}
                    />
                )}
            </div>
        </div>
    );
}
