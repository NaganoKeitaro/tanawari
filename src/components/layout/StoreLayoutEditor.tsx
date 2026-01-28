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

const GRID_SIZE = 5; // 5cm grid
const DEFAULT_SCALE = 2; // 1cm = 2px (Adjustable)

interface StoreLayoutEditorProps {
    store: Store;
    placements: StoreFixturePlacement[];
    fixtures: Fixture[];
    onPlacementChange: (id: string, updates: Partial<StoreFixturePlacement>) => void;
    onPlacementAdd: (fixtureId: string, x: number, y: number) => void;
    onPlacementRemove: (id: string) => void;
}

// Fixture dimensions helper
function getFixtureDimensions(fixture: Fixture, direction: number = 0) {
    const depth = fixture.fixtureType?.includes('end-cap') ? 60 : 90;
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
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.2))'
                        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(241, 245, 249, 0.9))',
                    border: `2px solid ${isSelected ? 'var(--color-primary)' : 'rgba(148, 163, 184, 0.6)'}`,
                    borderRadius: '6px',
                    boxShadow: isDragging
                        ? '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)'
                        : isSelected
                            ? '0 0 0 3px rgba(99, 102, 241, 0.2), 0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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
                }}
            >
                <span style={{ fontWeight: 600, color: 'var(--text-color)', pointerEvents: 'none', userSelect: 'none' }}>
                    {fixture.name.replace('（4尺）', '').replace('平台', '')}
                </span>
                <span style={{ fontSize: `${Math.max(7, 8 * scale)}px`, opacity: 0.6, pointerEvents: 'none', userSelect: 'none' }}>
                    {Math.round(fixture.width / 30)}尺
                </span>
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
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                cursor: isDragging ? 'grabbing' : 'grab',
            }}>
                <span style={{ fontSize: '1.25rem' }}>🗄️</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fixture.name}
                    </div>
                    <div className="text-xs text-muted">
                        <UnitDisplay valueCm={fixture.width} /> / {fixture.shelfCount}段
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
                background: isOver ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
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

    return (
        <div
            style={{
                width: `${width * scale}px`,
                height: `${height * scale}px`,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(139, 92, 246, 0.8))',
                border: '2px solid var(--color-primary)',
                borderRadius: '6px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: `${Math.max(10, 12 * scale)}px`,
                fontWeight: 600,
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
    const [scale, setScale] = useState(DEFAULT_SCALE);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeFixture, setActiveFixture] = useState<Fixture | null>(null);
    const [dragType, setDragType] = useState<'placement' | 'new-fixture' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);

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
        let maxX = 1200;
        let maxY = 900;
        placements.forEach(p => {
            const f = fixtures.find(fix => fix.id === p.fixtureId);
            if (f) {
                const { width, height } = getFixtureDimensions(f, p.direction || 0);
                maxX = Math.max(maxX, p.positionX + width + 300);
                maxY = Math.max(maxY, p.positionY + height + 300);
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

            // Calculate new position with grid snap
            let newX = placement.positionX + Math.round(delta.x / scale);
            let newY = placement.positionY + Math.round(delta.y / scale);
            newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
            newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            newX = Math.max(0, newX);
            newY = Math.max(0, newY);

            if (newX !== placement.positionX || newY !== placement.positionY) {
                onPlacementChange(placement.id, { positionX: newX, positionY: newY });
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

                onPlacementAdd(fixture.id, dropX, dropY);
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

        const currentDir = placement.direction || 0;
        const newDir = (currentDir + 90) % 360;
        onPlacementChange(selectedId, { direction: newDir });
    }, [selectedId, placements, onPlacementChange]);

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
                            onClick={() => setScale(s => Math.max(0.5, s - 0.5))}
                            style={{ padding: '0.25rem 0.5rem', minWidth: '32px' }}
                        >
                            −
                        </button>
                        <span className="text-xs" style={{ width: '3rem', textAlign: 'center', fontWeight: 500 }}>
                            {Math.round(scale * 50)}%
                        </span>
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setScale(s => Math.min(4, s + 0.5))}
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
                                総幅: <strong><UnitDisplay valueCm={totalWidth} /></strong>
                            </span>
                            <span className="text-xs text-muted" style={{
                                background: 'var(--bg-tertiary)',
                                padding: '0.25rem 0.5rem',
                                borderRadius: 'var(--radius-sm)'
                            }}>
                                グリッド: 5cm
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
                                linear-gradient(to right, rgba(148, 163, 184, 0.3) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(148, 163, 184, 0.3) 1px, transparent 1px)
                            `,
                            backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
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
