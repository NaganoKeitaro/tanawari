import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    DndContext,
    useDraggable,
    useDroppable,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import type { Store, Fixture, StoreFixturePlacement } from '../../data/types';
import { UnitDisplay } from '../common/UnitDisplay';

const GRID_SIZE = 50; // 50mm snap grid (for drag snapping)
const BASE_SCALE = 0.1; // 1mm = 0.1px at 100% zoom

// ズームプリセット (%)
const ZOOM_LEVELS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 400];

// Adaptive visual grid: returns grid size in mm based on current pixel scale
function getVisualGridSize(pixelScale: number): number {
    const minGridPx = 20; // minimum grid cell size in pixels for readability
    const candidates = [50, 100, 250, 500, 1000, 2500, 5000];
    for (const g of candidates) {
        if (g * pixelScale >= minGridPx) return g;
    }
    return candidates[candidates.length - 1];
}

// Grid opacity decreases at lower zoom levels
function getGridOpacity(zoom: number): number {
    if (zoom >= 50) return 0.3;
    if (zoom >= 25) return 0.2;
    return 0.15;
}

// AABB衝突判定: 2つの矩形が重なるかどうかを判定（ぴったり隣接はOK、1pxでも重なったらNG）
function isOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

// 指定した配置が他の既存配置と衝突するかチェック
// excludeId: 自分自身を除外するためのID（移動・回転時に使用）
function checkCollision(
    targetRect: { x: number; y: number; width: number; height: number },
    excludeId: string | null,
    placements: StoreFixturePlacement[],
    fixtures: Fixture[]
): boolean {
    for (const p of placements) {
        if (p.id === excludeId) continue;
        const f = fixtures.find(fix => fix.id === p.fixtureId);
        if (!f) continue;
        const { width, height } = getFixtureDimensions(f, p.direction || 0);
        const existingRect = { x: p.positionX, y: p.positionY, width, height };
        if (isOverlap(targetRect, existingRect)) {
            return true; // 衝突あり
        }
    }
    return false; // 衝突なし
}

interface StoreLayoutEditorProps {
    store: Store;
    placements: StoreFixturePlacement[];
    fixtures: Fixture[];
    onPlacementChange: (id: string, updates: Partial<StoreFixturePlacement>) => void;
    onPlacementAdd: (fixtureId: string, x: number, y: number) => void;
    onPlacementRemove: (id: string) => void;
}

const FIXTURE_COLORS: Record<string, string> = {
    'multi-tier': '#f0f0f0',           // 多段: ソフトグレー
    'flat-refrigerated': '#e0f7fa',    // 平台冷蔵: ペールシアン
    'flat-frozen': '#e3f2fd',          // 平台冷凍: ペールブルー
    'end-cap-refrigerated': '#b2ebf2', // エンド冷蔵: ソフトシアン
    'end-cap-frozen': '#bbdefb',       // エンド冷凍: ソフトブルー
    'gondola': '#fff8e1',              // ゴンドラ: ペールアンバー
    'default': 'var(--bg-secondary)'
};

// Fixture dimensions helper
function getFixtureDimensions(fixture: Fixture, direction: number = 0) {
    const depth = fixture.fixtureType?.includes('end-cap') ? 600 : 900;
    const isRotated = direction === 90 || direction === 270;
    return {
        width: isRotated ? depth : fixture.width,
        height: isRotated ? fixture.width : depth,
        depth
    };
}

// Draggable Item on the Grid
function DraggablePlacement({
    placement,
    fixture,
    isSelected,
    onClick,
    scale
}: {
    placement: StoreFixturePlacement;
    fixture: Fixture;
    isSelected: boolean;
    onClick: () => void;
    scale: number;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `placement-${placement.id}`,
        data: { placement, fixture, type: 'placement' }
    });

    const direction = placement.direction || 0;
    const { width: visualWidth, height: visualHeight } = getFixtureDimensions(fixture, direction);
    const isRotated = direction === 90 || direction === 270;

    const bgColor = fixture.fixtureType ? (FIXTURE_COLORS[fixture.fixtureType] || FIXTURE_COLORS['default']) : FIXTURE_COLORS['default'];
    // 背景色が明るいパステルカラーなので、テキストは濃い色にする (default以外の時)
    const textColor = fixture.fixtureType ? '#334155' : 'var(--text-primary)';

    const style = {
        position: 'absolute' as const,
        left: `${placement.positionX * scale}px`,
        top: `${placement.positionY * scale}px`,
        width: `${visualWidth * scale}px`,
        height: `${visualHeight * scale}px`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 100 : (isSelected ? 10 : 1),
        opacity: isDragging ? 0.8 : 1,
        touchAction: 'none',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
        >
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    background: isSelected
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))'
                        : bgColor,
                    border: `2px solid ${isSelected ? 'var(--color-primary)' : 'rgba(148, 163, 184, 0.6)'}`,
                    borderRadius: '6px',
                    boxShadow: isDragging
                        ? '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)'
                        : isSelected
                            ? '0 0 0 3px rgba(16, 185, 129, 0.2), 0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: `${Math.max(9, 10 * scale)}px`,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    flexDirection: 'column',
                    writingMode: isRotated ? 'vertical-rl' : 'horizontal-tb',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                    color: textColor
                }}
            >
                <span style={{ fontWeight: 600, pointerEvents: 'none', userSelect: 'none', position: 'relative', zIndex: 2 }}>
                    {fixture.name.replace('（4尺）', '').replace('平台', '')}
                </span>
                <span style={{ fontSize: `${Math.max(7, 8 * scale)}px`, opacity: 0.8, pointerEvents: 'none', userSelect: 'none', position: 'relative', zIndex: 2 }}>
                    {Math.round(fixture.width / 300)}尺 / {fixture.shelfCount}段
                </span>

                {/* Visual Tiers Overlay */}
                {fixture.shelfCount > 1 && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: isRotated ? 'row' : 'column',
                        pointerEvents: 'none',
                        zIndex: 1
                    }}>
                        {Array.from({ length: fixture.shelfCount }).map((_, i) => (
                            <div key={i} style={{
                                flex: 1,
                                borderBottom: !isRotated && i < fixture.shelfCount - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                                borderRight: isRotated && i < fixture.shelfCount - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none'
                            }} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Draggable Fixture in Palette
function PaletteFixture({ fixture }: { fixture: Fixture }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `palette-${fixture.id}`,
        data: { fixture, type: 'new-fixture' }
    });

    const bgColor = fixture.fixtureType ? (FIXTURE_COLORS[fixture.fixtureType] || FIXTURE_COLORS['default']) : FIXTURE_COLORS['default'];
    const textColor = fixture.fixtureType ? '#334155' : 'var(--text-primary)';

    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="card"
            role="button"
            tabIndex={0}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                background: bgColor,
                color: textColor,
                borderRadius: 'var(--radius-sm)',
                cursor: isDragging ? 'grabbing' : 'grab',
            }}>
                <span style={{ fontSize: '1.25rem' }}>🗄️</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fixture.name}
                    </div>
                    <div className="text-xs" style={{ opacity: 0.8 }}>
                        <UnitDisplay valueMm={fixture.width} /> / {fixture.shelfCount}段
                    </div>
                </div>
            </div>
        </div>
    );
}

// Grid Drop Zone
function GridDropZone({
    children,
    scale,
    bounds
}: {
    children: React.ReactNode;
    scale: number;
    bounds: { width: number; height: number };
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'grid-drop-zone',
        data: { type: 'grid' }
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                width: `${bounds.width * scale}px`,
                height: `${bounds.height * scale}px`,
                position: 'relative',
                background: isOver ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                transition: 'background 0.2s',
            }}
        >
            {children}
        </div>
    );
}

// Drag Overlay Component
function DragOverlayContent({ fixture, scale }: { fixture: Fixture; scale: number }) {
    const { width, height } = getFixtureDimensions(fixture, 0);
    const bgColor = fixture.fixtureType ? (FIXTURE_COLORS[fixture.fixtureType] || FIXTURE_COLORS['default']) : FIXTURE_COLORS['default'];
    // Drag overlay should be a bit translucent or specific style, but matching color is good
    // However, original code had a gradient. Let's keep the user request "color coded" priority.
    // The previous overlay was purple linear gradient. Now we match the fixture type.

    const textColor = fixture.fixtureType ? '#334155' : 'var(--text-primary)';

    return (
        <div
            style={{
                width: `${width * scale}px`,
                height: `${height * scale}px`,
                background: bgColor,
                border: '2px solid var(--color-primary)',
                borderRadius: '6px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: textColor,
                fontSize: `${Math.max(10, 12 * scale)}px`,
                fontWeight: 600,
                opacity: 0.9
            }}
        >
            {fixture.name.replace('（4尺）', '').replace('平台', '')}
        </div>
    );
}

export function StoreLayoutEditor({
    placements,
    fixtures,
    onPlacementChange,
    onPlacementAdd,
    onPlacementRemove
}: StoreLayoutEditorProps) {
    const [zoomPercent, setZoomPercent] = useState(100);
    const scale = BASE_SCALE * zoomPercent / 100;
    const visualGridMm = getVisualGridSize(scale);
    const visualGridPx = visualGridMm * scale;
    const gridOpacity = getGridOpacity(zoomPercent);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeFixture, setActiveFixture] = useState<Fixture | null>(null);
    const [dragType, setDragType] = useState<'placement' | 'new-fixture' | null>(null);
    const [collisionToast, setCollisionToast] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    // 衝突トーストの自動消去
    useEffect(() => {
        if (collisionToast) {
            const timer = setTimeout(() => setCollisionToast(null), 2500);
            return () => clearTimeout(timer);
        }
    }, [collisionToast]);

    // Sensors configuration
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(MouseSensor),
        useSensor(TouchSensor)
    );

    // Calculate bounds
    const bounds = useMemo(() => {
        let maxX = 12000;
        let maxY = 9000;
        placements.forEach(p => {
            const f = fixtures.find(fix => fix.id === p.fixtureId);
            if (f) {
                const { width, height } = getFixtureDimensions(f, p.direction || 0);
                maxX = Math.max(maxX, p.positionX + width + 3000);
                maxY = Math.max(maxY, p.positionY + height + 3000);
            }
        });
        return { width: maxX, height: maxY };
    }, [placements, fixtures]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'r' || e.key === 'R') {
                handleRotate();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedId && document.activeElement?.tagName !== 'INPUT') {
                    e.preventDefault();
                    handleDelete();
                }
            } else if (e.key === 'Escape') {
                setSelectedId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId, placements]);

    const handleDragStart = (event: DragStartEvent) => {
        const data = event.active.data.current;
        if (data?.type === 'new-fixture') {
            setActiveFixture(data.fixture);
            setDragType('new-fixture');
        } else if (data?.type === 'placement') {
            setActiveFixture(data.fixture);
            setDragType('placement');
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over, delta } = event;
        const data = active.data.current;

        if (data?.type === 'placement') {
            const placement = data.placement as StoreFixturePlacement;
            const fixture = data.fixture as Fixture;

            // Calculate new position with grid snap
            let newX = placement.positionX + Math.round(delta.x / scale);
            let newY = placement.positionY + Math.round(delta.y / scale);
            newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
            newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            newX = Math.max(0, newX);
            newY = Math.max(0, newY);

            if (newX !== placement.positionX || newY !== placement.positionY) {
                // 衝突判定
                const { width, height } = getFixtureDimensions(fixture, placement.direction || 0);
                const targetRect = { x: newX, y: newY, width, height };
                if (checkCollision(targetRect, placement.id, placements, fixtures)) {
                    // 衝突あり → 元の位置に戻す（変更しない）
                    setCollisionToast('⚠️ 他の什器と重なるため、配置できません');
                } else {
                    onPlacementChange(placement.id, { positionX: newX, positionY: newY });
                }
            }
        } else if (data?.type === 'new-fixture' && over?.id === 'grid-drop-zone') {
            // Add new fixture at drop position
            const fixture = data.fixture as Fixture;
            const gridRect = gridRef.current?.getBoundingClientRect();

            if (gridRect && event.activatorEvent instanceof MouseEvent) {
                // Get the initial mouse position relative to grid
                const scrollLeft = containerRef.current?.scrollLeft || 0;
                const scrollTop = containerRef.current?.scrollTop || 0;

                let dropX = ((event.activatorEvent.clientX - gridRect.left + scrollLeft) + delta.x) / scale;
                let dropY = ((event.activatorEvent.clientY - gridRect.top + scrollTop) + delta.y) / scale;

                // Snap to grid
                dropX = Math.round(dropX / GRID_SIZE) * GRID_SIZE;
                dropY = Math.round(dropY / GRID_SIZE) * GRID_SIZE;
                dropX = Math.max(0, dropX);
                dropY = Math.max(0, dropY);

                // 衝突判定（新規配置）
                const { width, height } = getFixtureDimensions(fixture, 0);
                const targetRect = { x: dropX, y: dropY, width, height };
                if (checkCollision(targetRect, null, placements, fixtures)) {
                    setCollisionToast('⚠️ 他の什器と重なるため、配置できません');
                } else {
                    onPlacementAdd(fixture.id, dropX, dropY);
                }
            }
        }

        setActiveFixture(null);
        setDragType(null);
    };

    const handleBackgroundClick = () => {
        setSelectedId(null);
    };

    const handleRotate = useCallback(() => {
        if (!selectedId) return;
        const placement = placements.find(p => p.id === selectedId);
        if (!placement) return;
        const fixture = fixtures.find(f => f.id === placement.fixtureId);
        if (!fixture) return;

        const currentDir = placement.direction || 0;
        const newDir = (currentDir + 90) % 360;

        // 回転後の衝突判定
        const { width, height } = getFixtureDimensions(fixture, newDir);
        const targetRect = { x: placement.positionX, y: placement.positionY, width, height };
        if (checkCollision(targetRect, placement.id, placements, fixtures)) {
            setCollisionToast('⚠️ 回転すると他の什器と重なるため、回転できません');
            return;
        }

        onPlacementChange(selectedId, { direction: newDir });
    }, [selectedId, placements, fixtures, onPlacementChange]);

    const handleDelete = useCallback(() => {
        if (selectedId) {
            onPlacementRemove(selectedId);
            setSelectedId(null);
        }
    }, [selectedId, onPlacementRemove]);

    // Total width of placed fixtures
    const totalWidth = useMemo(() => {
        return placements.reduce((sum, p) => {
            const f = fixtures.find(fix => fix.id === p.fixtureId);
            return sum + (f?.width || 0);
        }, 0);
    }, [placements, fixtures]);

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1rem', height: '700px' }}>
                {/* Fixture Palette */}
                <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '0.75rem 1rem' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>🗄️ 什器パレット</h3>
                        <p className="text-xs text-muted" style={{ margin: '0.25rem 0 0' }}>
                            什器をグリッドにドラッグ
                        </p>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {fixtures.map(fixture => (
                                <PaletteFixture key={fixture.id} fixture={fixture} />
                            ))}
                        </div>
                        {fixtures.length === 0 && (
                            <div className="text-center text-muted" style={{ padding: '2rem 1rem' }}>
                                什器が登録されていません
                            </div>
                        )}
                    </div>
                </div>

                {/* Editor Canvas */}
                <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Toolbar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        borderBottom: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)'
                    }}>
                        <span className="text-xs text-muted">ズーム:</span>
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                                const idx = ZOOM_LEVELS.slice().reverse().findIndex(z => z < zoomPercent);
                                if (idx !== -1) setZoomPercent(ZOOM_LEVELS[ZOOM_LEVELS.length - 1 - idx]);
                            }}
                            disabled={zoomPercent <= ZOOM_LEVELS[0]}
                            style={{ padding: '0.25rem 0.5rem', minWidth: '32px' }}
                        >
                            −
                        </button>
                        <span className="text-xs" style={{ width: '3.5rem', textAlign: 'center', fontWeight: 500 }}>
                            {zoomPercent}%
                        </span>
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                                const idx = ZOOM_LEVELS.findIndex(z => z > zoomPercent);
                                if (idx !== -1) setZoomPercent(ZOOM_LEVELS[idx]);
                            }}
                            disabled={zoomPercent >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                            style={{ padding: '0.25rem 0.5rem', minWidth: '32px' }}
                        >
                            +
                        </button>

                        <div style={{ width: '1px', height: '1.5rem', background: 'var(--border-color)', margin: '0 0.5rem' }} />

                        <button
                            className="btn btn-sm btn-secondary"
                            disabled={!selectedId}
                            onClick={handleRotate}
                            title="回転 (R)"
                            style={{ opacity: selectedId ? 1 : 0.5 }}
                        >
                            ↻ 回転
                        </button>
                        <button
                            className="btn btn-sm btn-danger"
                            disabled={!selectedId}
                            onClick={handleDelete}
                            title="削除 (Delete)"
                            style={{ opacity: selectedId ? 1 : 0.5 }}
                        >
                            🗑️ 削除
                        </button>

                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span className="text-xs text-muted">
                                配置: <strong>{placements.length}</strong>台
                            </span>
                            <span className="text-xs text-muted">
                                総幅: <strong><UnitDisplay valueMm={totalWidth} /></strong>
                            </span>
                            <span className="text-xs text-muted" style={{
                                background: 'var(--bg-tertiary)',
                                padding: '0.25rem 0.5rem',
                                borderRadius: 'var(--radius-sm)'
                            }}>
                                グリッド: {visualGridMm}mm
                            </span>
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div
                        ref={containerRef}
                        onClick={handleBackgroundClick}
                        style={{
                            flex: 1,
                            overflow: 'auto',
                            position: 'relative',
                            backgroundImage: `
                                linear-gradient(to right, rgba(148, 163, 184, ${gridOpacity}) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(148, 163, 184, ${gridOpacity}) 1px, transparent 1px)
                            `,
                            backgroundSize: `${visualGridPx}px ${visualGridPx}px`,
                            backgroundColor: '#f8fafc',
                        }}
                    >
                        <div ref={gridRef}>
                            <GridDropZone scale={scale} bounds={bounds}>
                                {placements.map(p => {
                                    const fixture = fixtures.find(f => f.id === p.fixtureId);
                                    if (!fixture) return null;
                                    return (
                                        <DraggablePlacement
                                            key={p.id}
                                            placement={p}
                                            fixture={fixture}
                                            isSelected={selectedId === p.id}
                                            onClick={() => setSelectedId(p.id)}
                                            scale={scale}
                                        />
                                    );
                                })}
                            </GridDropZone>
                        </div>

                        {/* Help overlay when empty */}
                        {placements.length === 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                pointerEvents: 'none',
                            }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📐</div>
                                <div style={{ fontSize: '1rem', fontWeight: 500 }}>什器をここにドラッグして配置</div>
                                <div className="text-xs" style={{ marginTop: '0.5rem' }}>
                                    左側のパレットから什器をドラッグ＆ドロップ
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 衝突トースト通知 */}
                    {collisionToast && (
                        <div style={{
                            position: 'absolute',
                            top: '1rem',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(239, 68, 68, 0.95)',
                            color: 'white',
                            padding: '0.5rem 1.25rem',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            zIndex: 1000,
                            animation: 'fadeIn 0.2s ease-out',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap'
                        }}>
                            {collisionToast}
                        </div>
                    )}

                    {/* Keyboard shortcuts hint */}
                    <div style={{
                        padding: '0.5rem 1rem',
                        borderTop: '1px solid var(--border-color)',
                        background: 'var(--bg-tertiary)',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        gap: '1.5rem',
                    }}>
                        <span><kbd style={{ background: 'var(--bg-secondary)', padding: '0.1rem 0.3rem', borderRadius: '3px', border: '1px solid var(--border-color)' }}>R</kbd> 回転</span>
                        <span><kbd style={{ background: 'var(--bg-secondary)', padding: '0.1rem 0.3rem', borderRadius: '3px', border: '1px solid var(--border-color)' }}>Delete</kbd> 削除</span>
                        <span><kbd style={{ background: 'var(--bg-secondary)', padding: '0.1rem 0.3rem', borderRadius: '3px', border: '1px solid var(--border-color)' }}>Esc</kbd> 選択解除</span>
                    </div>
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
                {activeFixture && dragType === 'new-fixture' && (
                    <DragOverlayContent fixture={activeFixture} scale={scale} />
                )}
            </DragOverlay>
        </DndContext>
    );
}
