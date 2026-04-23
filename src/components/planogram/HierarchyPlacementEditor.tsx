// 階層プレースメント編集コンポーネント
// - 幅ドラッグ調整（境界線ドラッグ）
// - 並び替え（ブロックドラッグ）
// - 追加/削除

import { useState, useCallback } from 'react';
import type { StorePlanogramHierarchyPlacement } from '../../data/types';
import type { HierarchyLevel } from '../../data/types/productHierarchy';
import { SHAKU_TO_MM } from '../../data/types';

const SCALE = 0.3; // 1mm = 0.3px

const HIERARCHY_LEVEL_LABELS: Record<HierarchyLevel, string> = {
    division: '事業部',
    divisionSub: 'ディビジョン',
    line: 'ライン',
    department: '部門',
    category: 'カテゴリー',
    subCategory: 'サブカテゴリー',
    segment: 'セグメント',
    subSegment: 'サブセグメント',
};

interface HierarchyPlacementEditorProps {
    placements: StorePlanogramHierarchyPlacement[];
    shelfIndex: number;
    planogramWidth: number; // mm
    scale?: number;
    onUpdate: (updatedPlacements: StorePlanogramHierarchyPlacement[]) => void;
}

export function HierarchyPlacementEditor({
    placements,
    shelfIndex,
    planogramWidth,
    scale = SCALE,
    onUpdate,
}: HierarchyPlacementEditorProps) {
    const shelfPlacements = placements
        .filter(hp => hp.shelfIndex === shelfIndex)
        .sort((a, b) => a.positionX - b.positionX);

    const [isDragging, setIsDragging] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);

    // 10% はみ出し許容
    const maxTotalWidth = planogramWidth * 1.1;

    // リサイズ開始（右端境界線ドラッグ）
    const handleResizeStart = useCallback((e: React.MouseEvent, placementId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);

        const startX = e.clientX;
        const originals = shelfPlacements.map(p => ({ ...p }));
        const idx = originals.findIndex(p => p.id === placementId);
        if (idx < 0) return;

        const current = originals[idx];
        const currentTotalWidth = current.width * current.faceCount;
        const nextPlacement = originals[idx + 1];
        const maxWidth = nextPlacement
            ? nextPlacement.positionX - current.positionX
            : maxTotalWidth - current.positionX;

        const onMove = (ev: MouseEvent) => {
            const deltaMm = (ev.clientX - startX) / scale;
            const newTotalWidth = Math.max(SHAKU_TO_MM, currentTotalWidth + deltaMm);
            const clampedWidth = Math.min(newTotalWidth, maxWidth);
            const newWidth = clampedWidth / current.faceCount;

            const updated = placements.map(p =>
                p.id === placementId ? { ...p, width: Math.round(newWidth) } : p
            );
            onUpdate(updated);
        };

        const onUp = () => {
            setIsDragging(false);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [shelfPlacements, placements, scale, onUpdate, maxTotalWidth]);

    // ブロック移動（並び替え）開始
    const handleMoveStart = useCallback((e: React.MouseEvent, placementId: string) => {
        e.preventDefault();
        setIsDragging(true);

        const startX = e.clientX;
        const originals = shelfPlacements.map(p => ({ ...p }));
        const idx = originals.findIndex(p => p.id === placementId);
        if (idx < 0) return;
        const current = originals[idx];

        const onMove = (ev: MouseEvent) => {
            const deltaMm = (ev.clientX - startX) / scale;
            const newPosX = current.positionX + deltaMm;

            const others = originals.filter(p => p.id !== placementId);
            let insertIdx = others.length;
            for (let i = 0; i < others.length; i++) {
                const centerX = others[i].positionX + (others[i].width * others[i].faceCount) / 2;
                if (newPosX < centerX) {
                    insertIdx = i;
                    break;
                }
            }

            const reordered = [
                ...others.slice(0, insertIdx),
                { ...current },
                ...others.slice(insertIdx),
            ];

            let posX = 0;
            const repositioned = reordered.map(p => {
                const updated = { ...p, positionX: Math.round(posX) };
                posX += p.width * p.faceCount;
                return updated;
            });

            const otherShelfPlacements = placements.filter(p => p.shelfIndex !== shelfIndex);
            onUpdate([...otherShelfPlacements, ...repositioned]);
        };

        const onUp = () => {
            setIsDragging(false);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [shelfPlacements, placements, shelfIndex, scale, onUpdate]);

    // 削除
    const handleDelete = useCallback((placementId: string) => {
        const target = placements.find(p => p.id === placementId);
        if (!target) return;
        if (!confirm(`「${target.hierarchyName}」を削除しますか？`)) return;

        const remaining = placements.filter(p => p.id !== placementId);

        const shelfRemaining = remaining
            .filter(p => p.shelfIndex === shelfIndex)
            .sort((a, b) => a.positionX - b.positionX);

        let posX = 0;
        const repositioned = shelfRemaining.map(p => {
            const updated = { ...p, positionX: Math.round(posX) };
            posX += p.width * p.faceCount;
            return updated;
        });

        const otherShelfPlacements = remaining.filter(p => p.shelfIndex !== shelfIndex);
        onUpdate([...otherShelfPlacements, ...repositioned]);
        setSelectedId(null);
    }, [placements, shelfIndex, onUpdate]);

    // 追加
    const handleAdd = useCallback((level: HierarchyLevel, code: string, name: string) => {
        const lastPlacement = shelfPlacements[shelfPlacements.length - 1];
        const startX = lastPlacement
            ? lastPlacement.positionX + lastPlacement.width * lastPlacement.faceCount
            : 0;

        const defaultWidth = SHAKU_TO_MM * 4; // 4尺

        const newPlacement: StorePlanogramHierarchyPlacement = {
            id: crypto.randomUUID(),
            hierarchyLevel: level,
            hierarchyCode: code,
            hierarchyName: name,
            shelfIndex,
            positionX: Math.round(startX),
            width: defaultWidth,
            faceCount: 1,
            isAutoGenerated: false,
        };

        onUpdate([...placements, newPlacement]);
        setShowAddModal(false);
    }, [placements, shelfPlacements, shelfIndex, onUpdate]);

    const totalUsedWidth = shelfPlacements.reduce((sum, p) => sum + p.width * p.faceCount, 0);

    return (
        <>
            {shelfPlacements.map((hp) => {
                const totalWidth = hp.width * hp.faceCount;
                const widthPx = totalWidth * scale;
                const isSelected = selectedId === hp.id;

                return (
                    <div
                        key={hp.id}
                        style={{
                            position: 'absolute',
                            left: `${hp.positionX * scale}px`,
                            top: 0,
                            bottom: 0,
                            width: `${widthPx}px`,
                            background: isSelected
                                ? 'rgba(99, 102, 241, 0.25)'
                                : 'rgba(99, 102, 241, 0.15)',
                            border: isSelected
                                ? '2px solid rgba(99, 102, 241, 0.8)'
                                : '2px solid rgba(99, 102, 241, 0.5)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px 8px',
                            fontSize: '1rem',
                            overflow: 'hidden',
                            zIndex: 2,
                            cursor: isDragging ? 'grabbing' : 'grab',
                            transition: isDragging ? 'none' : 'left 0.15s ease, width 0.1s ease',
                            userSelect: 'none',
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(prev => prev === hp.id ? null : hp.id);
                        }}
                        onMouseDown={(e) => {
                            if (e.button === 0) handleMoveStart(e, hp.id);
                        }}
                        title={`${hp.hierarchyName} (${hp.hierarchyCode})\n${Math.round(totalWidth / SHAKU_TO_MM * 10) / 10}尺 = ${totalWidth}mm`}
                    >
                        <div style={{ fontSize: '0.8rem', color: 'rgba(99, 102, 241, 0.8)', fontWeight: 600 }}>
                            {HIERARCHY_LEVEL_LABELS[hp.hierarchyLevel] || hp.hierarchyLevel}
                        </div>
                        <div style={{
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                            fontSize: '1rem',
                        }}>
                            {hp.hierarchyName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {Math.round(totalWidth / SHAKU_TO_MM * 10) / 10}尺
                        </div>

                        {/* 削除ボタン（選択時のみ表示） */}
                        {isSelected && (
                            <button
                                style={{
                                    position: 'absolute',
                                    top: '2px',
                                    right: '2px',
                                    background: 'rgba(239, 68, 68, 0.9)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    width: '16px',
                                    height: '16px',
                                    fontSize: '0.6rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1,
                                    zIndex: 20,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(hp.id);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                title="削除"
                            >
                                x
                            </button>
                        )}

                        {/* 右端リサイズハンドル */}
                        <div
                            style={{
                                position: 'absolute',
                                right: '-3px',
                                top: 0,
                                bottom: 0,
                                width: '6px',
                                cursor: 'col-resize',
                                zIndex: 15,
                            }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                handleResizeStart(e, hp.id);
                            }}
                            title="ドラッグで幅を変更"
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    right: '2px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '2px',
                                    height: '20px',
                                    background: 'rgba(99, 102, 241, 0.6)',
                                    borderRadius: '1px',
                                }}
                            />
                        </div>
                    </div>
                );
            })}

            {/* 追加ボタン */}
            {totalUsedWidth < maxTotalWidth && (
                <div
                    style={{
                        position: 'absolute',
                        left: `${totalUsedWidth * scale}px`,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 5,
                    }}
                >
                    <button
                        style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px dashed rgba(99, 102, 241, 0.5)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.6rem',
                            color: 'rgba(99, 102, 241, 0.8)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowAddModal(true);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="階層を追加"
                    >
                        + 追加
                    </button>
                </div>
            )}

            {/* 追加モーダル */}
            {showAddModal && (
                <AddHierarchyModal
                    onAdd={handleAdd}
                    onClose={() => setShowAddModal(false)}
                />
            )}
        </>
    );
}

// 階層追加モーダル
function AddHierarchyModal({
    onAdd,
    onClose,
}: {
    onAdd: (level: HierarchyLevel, code: string, name: string) => void;
    onClose: () => void;
}) {
    const [level, setLevel] = useState<HierarchyLevel>('category');
    const [code, setCode] = useState('');
    const [name, setName] = useState('');

    return (
        <div
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.4)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            onClick={onClose}
        >
            <div
                className="card"
                style={{ minWidth: '320px', maxWidth: '400px', padding: '1.5rem' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>階層プレースメントを追加</h3>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">階層レベル</label>
                    <select
                        className="form-select"
                        value={level}
                        onChange={(e) => setLevel(e.target.value as HierarchyLevel)}
                    >
                        {Object.entries(HIERARCHY_LEVEL_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">コード</label>
                    <input
                        className="form-input"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="例: 0001"
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">名称</label>
                    <input
                        className="form-input"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="例: 馬肉"
                    />
                </div>

                <div className="flex gap-md justify-end">
                    <button className="btn btn-sm" onClick={onClose}>
                        キャンセル
                    </button>
                    <button
                        className="btn btn-sm btn-primary"
                        disabled={!code || !name}
                        onClick={() => onAdd(level, code, name)}
                    >
                        追加
                    </button>
                </div>
            </div>
        </div>
    );
}
