// Excelライクな棚割ヘッダー
// 棚ブロック名帯（縦積み対応） + 尺インジケーター + 5cmグリッド + 部門色凡例
import { SHAKU_TO_MM } from '../../data/types';
import { getDepartmentColorLegend } from '../../utils/productColorUtils';

const SCALE = 0.3; // 1mm = 0.3px (エディタと共通)
const GRID_CELL_MM = 50; // 5cm = 50mm

// ブロック帯の色パレット
export const BLOCK_BAND_COLORS = [
    { bg: '#fee2e2', border: '#fca5a5', selected: '#fecaca' }, // red-100
    { bg: '#fef3c7', border: '#fcd34d', selected: '#fde68a' }, // amber-100
    { bg: '#dbeafe', border: '#93c5fd', selected: '#bfdbfe' }, // blue-100
    { bg: '#d1fae5', border: '#6ee7b7', selected: '#a7f3d0' }, // emerald-100
    { bg: '#f3e8ff', border: '#c4b5fd', selected: '#ddd6fe' }, // violet-100
    { bg: '#fce7f3', border: '#f9a8d4', selected: '#fbcfe8' }, // pink-100
    { bg: '#ccfbf1', border: '#5eead4', selected: '#99f6e4' }, // teal-100
    { bg: '#fff7ed', border: '#fdba74', selected: '#fed7aa' }, // orange-100
];

export interface BlockInfo {
    id: string;
    name: string;
    widthMm: number;
    positionXMm: number;
    positionY: number;    // 段方向の位置（0-indexed, 下から）
    shelfCount: number;   // このブロックの段数
    colorIndex: number;   // BLOCK_BAND_COLORS のインデックス
}

/** 同じX位置のブロックをグループ化 */
interface BlockColumn {
    positionXMm: number;
    widthMm: number;
    blocks: BlockInfo[]; // positionY降順（上段が先）
}

function groupBlocksByColumn(blocks: BlockInfo[]): BlockColumn[] {
    const map = new Map<string, BlockColumn>();
    for (const b of blocks) {
        // X位置+幅でキーを作り、同じ列のブロックをグループ化
        const key = `${Math.round(b.positionXMm)}_${Math.round(b.widthMm)}`;
        if (!map.has(key)) {
            map.set(key, { positionXMm: b.positionXMm, widthMm: b.widthMm, blocks: [] });
        }
        map.get(key)!.blocks.push(b);
    }
    const columns = [...map.values()];
    columns.sort((a, b) => a.positionXMm - b.positionXMm);
    // 各列内で positionY 降順（上段が先）
    for (const col of columns) {
        col.blocks.sort((a, b) => b.positionY - a.positionY);
    }
    return columns;
}

interface PlanogramExcelHeaderProps {
    blocks: BlockInfo[];
    totalWidthMm: number;
    selectedBlockId?: string | null;
    onSelectBlock?: (blockId: string) => void;
    onDeleteBlock?: (blockId: string) => void;
    onSwapBlock?: (blockId: string, direction: 'left' | 'right' | 'up' | 'down') => void;
}

export function PlanogramExcelHeader({
    blocks,
    totalWidthMm,
    selectedBlockId,
    onSelectBlock,
    onDeleteBlock,
    onSwapBlock
}: PlanogramExcelHeaderProps) {
    const totalWidthPx = totalWidthMm * SCALE;
    const gridCellPx = GRID_CELL_MM * SCALE;
    const columns = groupBlocksByColumn(blocks);

    return (
        <div style={{ marginBottom: '0px' }}>
            {/* 部門色凡例（横スクロール時に固定） */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '8px',
                flexWrap: 'wrap',
                alignItems: 'center',
                position: 'sticky',
                left: '-50px',
                marginLeft: '-50px',
                zIndex: 10,
                background: 'var(--bg-primary)',
                paddingBottom: '4px',
                paddingLeft: '4px',
                width: 'fit-content',
                maxWidth: 'calc(100vw - 120px)'
            }}>
                {getDepartmentColorLegend().map(({ name, color }) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            width: '14px',
                            height: '14px',
                            background: color.bg,
                            border: `1px solid ${color.border}`,
                            borderRadius: '2px'
                        }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{name}</span>
                    </div>
                ))}
            </div>

            {/* ブロック名帯（縦積み対応・分割色表示） */}
            <div style={{ position: 'relative', width: `${totalWidthPx}px`, height: '28px' }}>
                {columns.map((col) => {
                    const widthPx = col.widthMm * SCALE;
                    const leftPx = col.positionXMm * SCALE;
                    const isAnySelected = col.blocks.some(b => b.id === selectedBlockId);

                    if (col.blocks.length === 1) {
                        // 単一ブロック
                        const block = col.blocks[0];
                        const color = BLOCK_BAND_COLORS[block.colorIndex % BLOCK_BAND_COLORS.length];
                        const isSelected = selectedBlockId === block.id;
                        return (
                            <div
                                key={block.id}
                                onClick={() => onSelectBlock?.(block.id)}
                                style={{
                                    position: 'absolute',
                                    left: `${leftPx}px`,
                                    top: 0,
                                    width: `${widthPx}px`,
                                    height: '28px',
                                    background: isSelected ? color.selected : color.bg,
                                    border: isSelected ? '2px solid var(--color-primary)' : `1px solid ${color.border}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    boxSizing: 'border-box',
                                    cursor: onSelectBlock ? 'pointer' : 'default',
                                    transition: 'left 0.15s ease'
                                }}
                            >
                                {renderBlockControls(block, isSelected, onSwapBlock, onDeleteBlock)}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.name}</span>
                                {renderBlockControlsRight(block, isSelected, onSwapBlock, onDeleteBlock)}
                            </div>
                        );
                    }

                    // 複数ブロック（縦積み） - 分割色背景
                    const segmentCount = col.blocks.length;
                    return (
                        <div
                            key={`col-${col.positionXMm}`}
                            style={{
                                position: 'absolute',
                                left: `${leftPx}px`,
                                top: 0,
                                width: `${widthPx}px`,
                                height: '28px',
                                display: 'flex',
                                overflow: 'hidden',
                                boxSizing: 'border-box',
                                border: isAnySelected ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                                borderRadius: '0px',
                                transition: 'left 0.15s ease'
                            }}
                        >
                            {col.blocks.map((block, segIdx) => {
                                const color = BLOCK_BAND_COLORS[block.colorIndex % BLOCK_BAND_COLORS.length];
                                const isSelected = selectedBlockId === block.id;
                                return (
                                    <div
                                        key={block.id}
                                        onClick={(e) => { e.stopPropagation(); onSelectBlock?.(block.id); }}
                                        style={{
                                            flex: 1,
                                            background: isSelected ? color.selected : color.bg,
                                            borderRight: segIdx < segmentCount - 1 ? `2px solid var(--text-muted)` : 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.65rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            cursor: onSelectBlock ? 'pointer' : 'default',
                                            gap: '2px',
                                            padding: '0 2px',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        {isSelected && renderBlockControls(block, true, onSwapBlock, onDeleteBlock)}
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.name}</span>
                                        {isSelected && renderBlockControlsRight(block, true, onSwapBlock, onDeleteBlock)}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* 尺インジケーター（列単位 - 重複回避） */}
            <div style={{ position: 'relative', width: `${totalWidthPx}px`, height: '18px' }}>
                {columns.map((col) => {
                    const shakuValue = Math.round(col.widthMm / SHAKU_TO_MM * 10) / 10;
                    // 列の代表色 = 最初のブロックの色
                    const color = BLOCK_BAND_COLORS[col.blocks[0].colorIndex % BLOCK_BAND_COLORS.length];
                    return (
                        <div
                            key={`shaku-${col.positionXMm}`}
                            style={{
                                position: 'absolute',
                                left: `${col.positionXMm * SCALE}px`,
                                top: 0,
                                width: `${col.widthMm * SCALE}px`,
                                height: '18px',
                                background: col.blocks.length === 1 ? color.bg : `linear-gradient(to right, ${col.blocks.map(b => BLOCK_BAND_COLORS[b.colorIndex % BLOCK_BAND_COLORS.length].bg).join(', ')})`,
                                borderLeft: `1px solid ${color.border}`,
                                borderRight: `1px solid ${color.border}`,
                                borderBottom: `1px solid ${color.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                color: 'var(--text-muted)',
                                boxSizing: 'border-box',
                                transition: 'left 0.15s ease'
                            }}
                        >
                            {shakuValue}
                        </div>
                    );
                })}
            </div>

            {/* 5cmグリッド */}
            <div style={{
                position: 'relative',
                width: `${totalWidthPx}px`,
                height: '16px',
                borderBottom: '1px solid var(--border-color)'
            }}>
                {columns.map((col) => {
                    const cellCount = Math.floor(col.widthMm / GRID_CELL_MM);
                    return Array.from({ length: cellCount }).map((_, cellIdx) => {
                        const leftMm = col.positionXMm + cellIdx * GRID_CELL_MM;
                        return (
                            <div
                                key={`${col.positionXMm}-${cellIdx}`}
                                style={{
                                    position: 'absolute',
                                    left: `${leftMm * SCALE}px`,
                                    top: 0,
                                    width: `${gridCellPx}px`,
                                    height: '16px',
                                    borderLeft: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.5rem',
                                    color: 'var(--text-muted)',
                                    boxSizing: 'border-box',
                                    transition: 'left 0.15s ease'
                                }}
                            >
                                {cellIdx + 1}
                            </div>
                        );
                    });
                })}
            </div>
        </div>
    );
}

// ヘルパー: ブロック操作ボタン（左側）
function renderBlockControls(
    block: BlockInfo,
    isSelected: boolean,
    onSwapBlock?: (id: string, dir: 'left' | 'right' | 'up' | 'down') => void,
    _onDeleteBlock?: (id: string) => void
) {
    if (!isSelected || !onSwapBlock) return null;
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onSwapBlock(block.id, 'left'); }}
            style={miniButtonStyle}
            title="左に移動"
        >←</button>
    );
}

// ヘルパー: ブロック操作ボタン（右側）
function renderBlockControlsRight(
    block: BlockInfo,
    isSelected: boolean,
    onSwapBlock?: (id: string, dir: 'left' | 'right' | 'up' | 'down') => void,
    onDeleteBlock?: (id: string) => void
) {
    if (!isSelected) return null;
    return (
        <>
            {onSwapBlock && (
                <button
                    onClick={(e) => { e.stopPropagation(); onSwapBlock(block.id, 'right'); }}
                    style={miniButtonStyle}
                    title="右に移動"
                >→</button>
            )}
            {onDeleteBlock && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDeleteBlock(block.id); }}
                    style={{ ...miniButtonStyle, background: '#ef4444' }}
                    title="ブロックを削除"
                >x</button>
            )}
        </>
    );
}

const miniButtonStyle: React.CSSProperties = {
    background: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '16px',
    height: '16px',
    fontSize: '0.55rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0
};
