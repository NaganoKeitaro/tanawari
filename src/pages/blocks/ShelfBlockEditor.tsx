// 棚割管理システム - 棚ブロック管理（Building Blocks）
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragMoveEvent } from '@dnd-kit/core';
import type { ShelfBlock, Product, ProductPlacement, HierarchyPlacement } from '../../data/types';
import type { HierarchyEntry, HierarchyLevel } from '../../data/types/productHierarchy';
import {
    shelfBlockRepository,
    productRepository,
    productHierarchyRepository
} from '../../data/repositories/repositoryFactory';
import { Modal } from '../../components/common/Modal';
import { UnitInput } from '../../components/common/UnitInput';
import { UnitDisplay } from '../../components/common/UnitDisplay';
import { initProductColorMap } from '../../utils/productColorUtils';
import { ProductTooltip } from '../../components/common/ProductTooltip';

// 1mm = 0.3px表示
const SCALE = 0.3; // 1mm = 0.3px表示

const HIERARCHY_DEFAULT_WIDTH = 300; // mm（1尺）

const HIERARCHY_LEVEL_LABELS: Record<HierarchyLevel, string> = {
    division: '事業部',
    divisionSub: 'ディビジョン',
    line: 'ライン',
    department: '部門',
    category: 'カテゴリ',
    subCategory: 'サブカテゴリ',
    segment: 'セグメント',
    subSegment: 'サブセグメント',
};

const HIERARCHY_LEVELS: HierarchyLevel[] = [
    'division', 'divisionSub', 'line', 'department',
    'category', 'subCategory', 'segment', 'subSegment'
];

// 階層レベルに対応するコード/名前キーのマッピング
function getHierarchyCodeKey(level: HierarchyLevel): keyof HierarchyEntry {
    return `${level}Code` as keyof HierarchyEntry;
}
function getHierarchyNameKey(level: HierarchyLevel): keyof HierarchyEntry {
    return `${level}Name` as keyof HierarchyEntry;
}

// 部門以下の階層パス文字列を構築
function buildHierarchyPath(
    entries: HierarchyEntry[],
    level: HierarchyLevel,
    code: string,
    filters: Partial<Record<HierarchyLevel, string>>
): string {
    // department以降のレベルだけパスに含める
    const pathLevels: HierarchyLevel[] = ['department', 'category', 'subCategory', 'segment', 'subSegment'];
    const startIdx = pathLevels.indexOf('department');
    const endIdx = pathLevels.indexOf(level);
    if (endIdx < startIdx) {
        // department より上位の場合はそのレベル名だけ返す
        const nameKey = getHierarchyNameKey(level);
        const entry = entries.find(e => (e[getHierarchyCodeKey(level)] as string) === code);
        return entry ? (entry[nameKey] as string) : code;
    }

    // フィルターとcodeからエントリを特定
    let filtered = entries;
    for (const [lvl, filterCode] of Object.entries(filters)) {
        const key = getHierarchyCodeKey(lvl as HierarchyLevel);
        filtered = filtered.filter(e => e[key] === filterCode);
    }
    const codeKey = getHierarchyCodeKey(level);
    const entry = filtered.find(e => (e[codeKey] as string) === code);
    if (!entry) return code;

    const parts: string[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
        const nameKey = getHierarchyNameKey(pathLevels[i]);
        const val = entry[nameKey] as string;
        if (val) parts.push(val);
    }
    return parts.join(' > ');
}

// 階層エントリから指定レベルのユニークな選択肢を抽出
function getUniqueHierarchyOptions(
    entries: HierarchyEntry[],
    level: HierarchyLevel,
    filters: Partial<Record<HierarchyLevel, string>>
): { code: string; name: string }[] {
    let filtered = entries;
    for (const [lvl, code] of Object.entries(filters)) {
        const key = getHierarchyCodeKey(lvl as HierarchyLevel);
        filtered = filtered.filter(e => e[key] === code);
    }
    const codeKey = getHierarchyCodeKey(level);
    const nameKey = getHierarchyNameKey(level);
    const seen = new Set<string>();
    const result: { code: string; name: string }[] = [];
    for (const e of filtered) {
        const code = e[codeKey] as string;
        if (code && !seen.has(code)) {
            seen.add(code);
            result.push({ code, name: e[nameKey] as string });
        }
    }
    return result.sort((a, b) => a.code.localeCompare(b.code));
}

// ドラッグプレビュー状態の型
type DragPreviewState = {
    placementId: string;
    targetShelfIndex: number;
    insertIndex: number;
    itemWidthMm: number;
};

// ドラッグ可能な商品
function DraggableProduct({ product }: { product: Product }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `product-${product.id}`,
        data: { product, type: 'product' }
    });

    const style = {
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab'
    };

    return (
        <div
            ref={setNodeRef}
            style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'grab',
                userSelect: 'none'
            }}
            {...listeners}
            {...attributes}
        >
            <img
                src={product.imageUrl}
                alt={product.name}
                style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {product.jan || '-'}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {product.category}
                </div>
                <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    whiteSpace: 'normal',
                    wordBreak: 'break-all'
                }} title={product.name}>
                    {product.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {product.width}×{product.height}mm
                </div>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-warning)', flexShrink: 0 }}>
                R{product.salesRank}
            </div>
        </div>
    );
}

// 配置済み商品（ドラッグ可能）
function DraggablePlacedProduct({
    placement,
    product,
    onRemove,
    previewX
}: {
    placement: ProductPlacement;
    product: Product;
    onRemove: (placementId: string) => void;
    previewX?: number;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `placed-${placement.id}`,
        data: { placement, product, type: 'placed-product' }
    });

    // ドラッグ後のクリック誤発火を防止
    const wasDraggingRef = useRef(false);
    useEffect(() => {
        if (isDragging) {
            wasDraggingRef.current = true;
        }
    }, [isDragging]);

    const handleClick = () => {
        if (wasDraggingRef.current) {
            wasDraggingRef.current = false;
            return;
        }
        onRemove(placement.id);
    };

    const productWidth = product.width * placement.faceCount * SCALE;
    const displayX = previewX !== undefined ? previewX : placement.positionX;

    return (
        <ProductTooltip productName={product.name} jan={product.jan || '-'} faceCount={placement.faceCount} category={product.category}>
            <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                style={{
                    position: 'absolute',
                    left: `${displayX * SCALE}px`,
                    top: 0,
                    bottom: 0,
                    width: `${productWidth}px`,
                    background: 'white',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px',
                    fontSize: '0.6rem',
                    overflow: 'hidden',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    color: 'var(--text-primary)',
                    opacity: isDragging ? 0.3 : 1,
                    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
                    zIndex: isDragging ? 100 : undefined,
                    transition: !isDragging && previewX !== undefined ? 'left 0.15s ease' : undefined,
                }}
                onClick={handleClick}
            >
                <div style={{ fontWeight: 600, overflow: 'hidden', maxWidth: '100%', fontSize: '0.65rem', lineHeight: 1.3, wordBreak: 'break-all' }}>
                    {product.name}
                </div>
                <div style={{ opacity: 0.8, fontSize: '0.55rem', fontFamily: 'monospace', overflow: 'hidden', maxWidth: '100%', wordBreak: 'break-all' }}>
                    {product.jan || '-'}
                </div>
                <div style={{ opacity: 0.85, fontSize: '0.6rem' }}>×{placement.faceCount}</div>
            </div>
        </ProductTooltip>
    );
}

// 5cm刻み定数
const HIERARCHY_RESIZE_STEP = 50; // 50mm = 5cm

// 配置済み階層アイテム（DnD移動 + 5cm刻みリサイズ）
function DraggablePlacedHierarchy({
    placement,
    onRemove,
    onResize,
    previewX,
}: {
    placement: HierarchyPlacement;
    onRemove: (placementId: string) => void;
    onResize: (placementId: string, newWidth: number) => void;
    previewX?: number;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `placed-hierarchy-${placement.id}`,
        data: { placement, type: 'placed-hierarchy' }
    });

    const wasDraggingRef = useRef(false);
    useEffect(() => {
        if (isDragging) {
            wasDraggingRef.current = true;
        }
    }, [isDragging]);

    const handleClick = () => {
        if (wasDraggingRef.current) {
            wasDraggingRef.current = false;
            return;
        }
        onRemove(placement.id);
    };

    const totalWidth = placement.width * placement.faceCount;
    const displayWidth = totalWidth * SCALE;
    const displayX = previewX !== undefined ? previewX : placement.positionX;

    const handleShrink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newWidth = Math.max(HIERARCHY_RESIZE_STEP, placement.width - HIERARCHY_RESIZE_STEP);
        onResize(placement.id, newWidth);
    };

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        onResize(placement.id, placement.width + HIERARCHY_RESIZE_STEP);
    };

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={{
                position: 'absolute',
                left: `${displayX * SCALE}px`,
                top: 0,
                bottom: 0,
                width: `${displayWidth}px`,
                background: 'rgba(99, 102, 241, 0.15)',
                border: '2px solid rgba(99, 102, 241, 0.6)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                fontSize: '0.6rem',
                overflow: 'hidden',
                cursor: isDragging ? 'grabbing' : 'grab',
                color: 'var(--text-primary)',
                opacity: isDragging ? 0.3 : 1,
                transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
                zIndex: isDragging ? 100 : undefined,
                transition: !isDragging && previewX !== undefined ? 'left 0.15s ease' : undefined,
            }}
            onClick={handleClick}
            title={`${placement.hierarchyName}\nクリックでフェイス減少/削除`}
        >
            {/* 階層パス表示 */}
            <div style={{ fontWeight: 600, overflow: 'hidden', maxWidth: '100%', fontSize: '0.6rem', lineHeight: 1.3, wordBreak: 'break-all' }}>
                {placement.hierarchyName}
            </div>
            {/* 幅mm表示 */}
            <div style={{ fontSize: '0.55rem', color: 'rgba(99, 102, 241, 0.8)', fontWeight: 500 }}>
                {Math.round(totalWidth)}mm
            </div>
            <div style={{ opacity: 0.85, fontSize: '0.55rem' }}>×{placement.faceCount}</div>
            {/* 5cm刻みリサイズボタン */}
            <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }} onClick={(e) => e.stopPropagation()}>
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleShrink}
                    style={{
                        border: '1px solid rgba(99, 102, 241, 0.5)',
                        background: 'rgba(99, 102, 241, 0.1)',
                        borderRadius: '3px',
                        padding: '0 4px',
                        fontSize: '0.6rem',
                        cursor: 'pointer',
                        lineHeight: '1.4',
                        color: 'var(--text-primary)',
                    }}
                >
                    -5cm
                </button>
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleExpand}
                    style={{
                        border: '1px solid rgba(99, 102, 241, 0.5)',
                        background: 'rgba(99, 102, 241, 0.1)',
                        borderRadius: '3px',
                        padding: '0 4px',
                        fontSize: '0.6rem',
                        cursor: 'pointer',
                        lineHeight: '1.4',
                        color: 'var(--text-primary)',
                    }}
                >
                    +5cm
                </button>
            </div>
        </div>
    );
}

// 棚段ドロップエリア
function ShelfRow({
    shelfIndex,
    width,
    placements,
    hierarchyPlacements,
    products,
    onRemove,
    onRemoveHierarchy,
    onResizeHierarchy,
    previewPositions,
    draggedPlacementId
}: {
    shelfIndex: number;
    width: number;
    placements: ProductPlacement[];
    hierarchyPlacements: HierarchyPlacement[];
    products: Product[];
    onRemove: (placementId: string) => void;
    onRemoveHierarchy: (placementId: string) => void;
    onResizeHierarchy: (placementId: string, newWidth: number) => void;
    previewPositions: Record<string, number> | null;
    draggedPlacementId: string | null;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `shelf-${shelfIndex}`,
        data: { shelfIndex }
    });

    const FIXED_ROW_HEIGHT = 170; // 固定高さ: テキスト視認性優先（JAN表示対応）
    const rowPlacements = placements.filter(p => p.shelfIndex === shelfIndex);
    const rowHierarchyPlacements = hierarchyPlacements.filter(p => p.shelfIndex === shelfIndex);

    // 空きスペース計算（商品 + 階層アイテム）
    const usedWidthProducts = rowPlacements.reduce((sum, p) => {
        const product = products.find(pr => pr.id === p.productId);
        return sum + (product ? product.width * p.faceCount : 0);
    }, 0);
    const usedWidthHierarchy = rowHierarchyPlacements.reduce((sum, h) => sum + h.width * h.faceCount, 0);
    const usedWidth = usedWidthProducts + usedWidthHierarchy;
    const emptyWidth = width - usedWidth;

    return (
        <div
            ref={setNodeRef}
            className="shelf-row"
            style={{
                height: `${FIXED_ROW_HEIGHT}px`,
                borderColor: isOver ? 'var(--color-primary)' : 'var(--border-color)',
                borderWidth: isOver ? '2px' : '1px',
                borderStyle: isOver ? 'dashed' : 'solid',
                position: 'relative',
                backgroundColor: isOver ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
            }}
        >
            {/* 配置済み商品（ドラッグで移動可能） */}
            {rowPlacements.map(placement => {
                const product = products.find(p => p.id === placement.productId);
                if (!product) return null;
                return (
                    <DraggablePlacedProduct
                        key={placement.id}
                        placement={placement}
                        product={product}
                        onRemove={onRemove}
                        previewX={previewPositions?.[placement.id]}
                    />
                );
            })}

            {/* 配置済み階層アイテム（DnD移動可能） */}
            {rowHierarchyPlacements.map(hp => (
                <DraggablePlacedHierarchy
                    key={hp.id}
                    placement={hp}
                    onRemove={onRemoveHierarchy}
                    onResize={onResizeHierarchy}
                    previewX={previewPositions?.[hp.id]}
                />
            ))}

            {/* 空白スペース表示 */}
            {!draggedPlacementId && emptyWidth > 0 && (
                <div
                    className="shelf-empty"
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: `${emptyWidth * SCALE}px`
                    }}
                />
            )}

            {/* 段番号 */}
            <div
                style={{
                    position: 'absolute',
                    left: '-30px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                }}
            >
                {shelfIndex + 1}段
            </div>
        </div>
    );
}

// 棚ブロックカード（横並びコンパクト版）
function BlockCard({
    block,
    selected,
    onClick,
    onDelete
}: {
    block: ShelfBlock;
    selected?: boolean;
    onClick: () => void;
    onDelete: () => void;
}) {
    const isFlat = block.blockType === 'flat';
    return (
        <div
            onClick={onClick}
            style={{
                flexShrink: 0,
                width: '140px',
                padding: '0.5rem 0.6rem',
                background: selected ? 'var(--color-primary)' : 'var(--bg-secondary)',
                border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                position: 'relative'
            }}
            title={block.name}
        >
            <button
                className="btn btn-sm btn-danger"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    padding: '0 4px',
                    fontSize: '0.65rem',
                    lineHeight: '1.4'
                }}
            >
                削除
            </button>
            <div style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: selected ? 'white' : 'var(--text-primary)',
                paddingRight: '28px'
            }}>
                {block.name}
            </div>
            <div style={{ fontSize: '0.65rem', color: selected ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)', marginTop: '2px' }}>
                <UnitDisplay valueMm={block.width} />{isFlat ? '' : ` / ${block.shelfCount}段`}
            </div>
            <div style={{ fontSize: '0.65rem', color: selected ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>
                {block.productPlacements.length}商品{block.hierarchyPlacements?.length > 0 ? ` / ${block.hierarchyPlacements.length}階層` : ''}
            </div>
        </div>
    );
}

// 統合アイテム型（商品+階層）での挿入インデックス計算
type UnifiedShelfItem = { id: string; positionX: number; totalWidth: number };

function calcUnifiedInsertIndex(
    items: UnifiedShelfItem[],
    targetXmm: number
): number {
    let insertIdx = items.length;
    for (let i = 0; i < items.length; i++) {
        const centerX = items[i].positionX + items[i].totalWidth / 2;
        if (targetXmm < centerX) {
            insertIdx = i;
            break;
        }
    }
    return insertIdx;
}

// 指定段の全アイテム（商品+階層）を統合リストとして取得
function getUnifiedShelfItems(
    productPlacements: ProductPlacement[],
    hierarchyPlacements: HierarchyPlacement[],
    shelfIndex: number,
    productsList: Product[],
    excludeId?: string
): UnifiedShelfItem[] {
    const prodItems: UnifiedShelfItem[] = productPlacements
        .filter(p => p.shelfIndex === shelfIndex && p.id !== excludeId)
        .map(p => {
            const prod = productsList.find(pr => pr.id === p.productId);
            return { id: p.id, positionX: p.positionX, totalWidth: prod ? prod.width * p.faceCount : 0 };
        });
    const hierItems: UnifiedShelfItem[] = hierarchyPlacements
        .filter(h => h.shelfIndex === shelfIndex && h.id !== excludeId)
        .map(h => ({ id: h.id, positionX: h.positionX, totalWidth: h.width * h.faceCount }));
    return [...prodItems, ...hierItems].sort((a, b) => a.positionX - b.positionX);
}

export function ShelfBlockEditor() {
    const [blocks, setBlocks] = useState<ShelfBlock[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBlock, setSelectedBlock] = useState<ShelfBlock | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeProduct, setActiveProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'multi-tier' | 'flat'>('multi-tier');
    const [panelMode, setPanelMode] = useState<'products' | 'hierarchy'>('products');

    // 商品階層データ
    const [hierarchyEntries, setHierarchyEntries] = useState<HierarchyEntry[]>([]);
    const [selectedHierarchyLevel, setSelectedHierarchyLevel] = useState<HierarchyLevel>('division');
    const [hierarchyFilters, setHierarchyFilters] = useState<Partial<Record<HierarchyLevel, string>>>({});

    // 保存状態管理
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

    // ドラッグプレビュー
    const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);

    // キャンバスパネル幅のリサイズ
    const [canvasPanelWidth, setCanvasPanelWidth] = useState<number | null>(null);
    const resizingRef = useRef(false);
    const resizeStartRef = useRef<{ x: number; width: number }>({ x: 0, width: 0 });

    // 新規ブロックフォーム
    const [newBlock, setNewBlock] = useState<{
        name: string;
        description: string;
        blockType: 'multi-tier' | 'flat';
        width: number;
        height: number;
        shelfCount: number;
    }>({
        name: '',
        description: '',
        blockType: activeTab,
        width: 900,
        height: 1800,
        shelfCount: 5
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5
            }
        })
    );

    // リサイズハンドル
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        resizingRef.current = true;
        const currentWidth = canvasPanelWidth ?? (selectedBlock ? Math.min(selectedBlock.width * SCALE + 80, window.innerWidth * 0.6) : 500);
        resizeStartRef.current = { x: e.clientX, width: currentWidth };

        const onMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;
            const delta = e.clientX - resizeStartRef.current.x;
            const newWidth = Math.max(300, resizeStartRef.current.width + delta);
            setCanvasPanelWidth(newWidth);
        };
        const onMouseUp = () => {
            resizingRef.current = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [canvasPanelWidth, selectedBlock]);

    // プレビュー位置の計算
    const previewPositions: Record<string, number> | null = (() => {
        if (!dragPreview || !selectedBlock) return null;

        const positions: Record<string, number> = {};

        for (let si = 0; si < selectedBlock.shelfCount; si++) {
            // 統合アイテムリスト（ドラッグ中のアイテムは除外）
            const unifiedItems = getUnifiedShelfItems(
                selectedBlock.productPlacements, selectedBlock.hierarchyPlacements || [],
                si, products, dragPreview.placementId
            );

            let currentX = 0;

            for (let i = 0; i < unifiedItems.length; i++) {
                // 移動先の棚で、挿入位置にギャップを入れる
                if (si === dragPreview.targetShelfIndex && i === dragPreview.insertIndex) {
                    currentX += dragPreview.itemWidthMm;
                }
                positions[unifiedItems[i].id] = currentX;
                currentX += unifiedItems[i].totalWidth;
            }
        }

        return positions;
    })();

    // データ読み込み
    const loadData = useCallback(async () => {
        setLoading(true);
        const [blocksData, productsData, hierarchyData] = await Promise.all([
            shelfBlockRepository.getAll(),
            productRepository.getAll(),
            productHierarchyRepository.getAll()
        ]);
        // 売上ランク順にソート
        productsData.sort((a, b) => a.salesRank - b.salesRank);
        setBlocks(blocksData);
        setProducts(productsData);
        setHierarchyEntries(hierarchyData);
        initProductColorMap(productsData.map(p => p.departmentName || ''));
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // リサイズ操作後のデバウンス自動保存
    useEffect(() => {
        if (!isDirty || !selectedBlock) return;
        const timer = setTimeout(() => {
            if (isDirty && selectedBlock) {
                saveBlock(selectedBlock);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [isDirty, selectedBlock]);

    // ブロック作成
    const handleCreateBlock = async () => {
        if (!newBlock.name) {
            alert('ブロック名は必須です');
            return;
        }

        const created = await shelfBlockRepository.create({
            name: newBlock.name,
            description: newBlock.description,
            blockType: newBlock.blockType,
            width: newBlock.width,
            height: newBlock.height,
            shelfCount: newBlock.blockType === 'flat' ? 1 : newBlock.shelfCount,
            productPlacements: [],
            hierarchyPlacements: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        setBlocks([...blocks, created]);
        setIsCreateModalOpen(false);
        setNewBlock({ name: '', description: '', blockType: activeTab, width: 900, height: 1800, shelfCount: 5 });
        setSelectedBlock(created);
    };

    // ブロック保存（自動保存・手動保存共通）
    const saveBlock = async (updatedBlock: ShelfBlock): Promise<boolean> => {
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            await shelfBlockRepository.update(updatedBlock.id, updatedBlock);
            setIsDirty(false);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
            return true;
        } catch (e) {
            console.error('保存エラー:', e);
            setSaveStatus('error');
            setIsDirty(true);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    // 手動保存ボタン
    const handleManualSave = async () => {
        if (!selectedBlock) return;
        await saveBlock(selectedBlock);
    };

    // ブロック削除
    const handleDeleteBlock = async (blockId: string) => {
        if (confirm('このブロックを削除しますか？')) {
            await shelfBlockRepository.delete(blockId);
            setBlocks(blocks.filter(b => b && b.id !== blockId));
            if (selectedBlock?.id === blockId) {
                setSelectedBlock(null);
            }
        }
    };

    // 位置再計算（左詰め）ヘルパー — 商品と階層を統合して再計算
    type UnifiedItem =
        | { kind: 'product'; data: ProductPlacement }
        | { kind: 'hierarchy'; data: HierarchyPlacement };

    const recalculateAllPositions = (
        prodPlacements: ProductPlacement[],
        hierPlacements: HierarchyPlacement[],
        block: ShelfBlock
    ): { products: ProductPlacement[]; hierarchies: HierarchyPlacement[] } => {
        const resultProducts: ProductPlacement[] = [];
        const resultHierarchies: HierarchyPlacement[] = [];

        for (let si = 0; si < block.shelfCount; si++) {
            const items: UnifiedItem[] = [
                ...prodPlacements.filter(p => p.shelfIndex === si).map(p => ({ kind: 'product' as const, data: p })),
                ...hierPlacements.filter(h => h.shelfIndex === si).map(h => ({ kind: 'hierarchy' as const, data: h })),
            ].sort((a, b) => a.data.positionX - b.data.positionX);

            let currentX = 0;
            for (const item of items) {
                if (item.kind === 'product') {
                    const prod = products.find(p => p.id === item.data.productId);
                    resultProducts.push({ ...item.data, positionX: currentX });
                    currentX += prod ? prod.width * item.data.faceCount : 0;
                } else {
                    resultHierarchies.push({ ...item.data, positionX: currentX });
                    currentX += item.data.width * item.data.faceCount;
                }
            }
        }
        return { products: resultProducts, hierarchies: resultHierarchies };
    };

    // 後方互換: 商品のみ再計算（既存ロジックで使用）
    const recalculatePositions = (placements: ProductPlacement[], block: ShelfBlock): ProductPlacement[] => {
        const { products: result } = recalculateAllPositions(placements, block.hierarchyPlacements || [], block);
        return result;
    };

    // ドラッグ開始
    // ドラッグ中の階層アイテム
    const [activeHierarchy, setActiveHierarchy] = useState<HierarchyPlacement | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        const type = event.active.data.current?.type as string;
        if (type === 'placed-hierarchy') {
            setActiveHierarchy(event.active.data.current?.placement as HierarchyPlacement);
            setActiveProduct(null);
        } else {
            setActiveProduct(event.active.data.current?.product as Product || null);
            setActiveHierarchy(null);
        }
        setDragPreview(null);
    };

    // ドラッグ中（プレビュー更新）
    const handleDragMove = (event: DragMoveEvent) => {
        if (!selectedBlock) return;
        const { active, over } = event;

        const type = active.data.current?.type as string;
        if (type !== 'placed-product' && type !== 'placed-hierarchy') { setDragPreview(null); return; }
        if (!over) { setDragPreview(null); return; }

        const overId = over.id as string;
        if (!overId.startsWith('shelf-')) { setDragPreview(null); return; }

        const targetShelfIndex = parseInt(overId.replace('shelf-', ''));

        if (type === 'placed-product') {
            const placement = active.data.current?.placement as ProductPlacement;
            const product = active.data.current?.product as Product;
            const targetXmm = placement.positionX + event.delta.x / SCALE;
            const remaining = getUnifiedShelfItems(
                selectedBlock.productPlacements, selectedBlock.hierarchyPlacements || [],
                targetShelfIndex, products, placement.id
            );
            const insertIdx = calcUnifiedInsertIndex(remaining, targetXmm);
            setDragPreview({
                placementId: placement.id,
                targetShelfIndex,
                insertIndex: insertIdx,
                itemWidthMm: product.width * placement.faceCount
            });
        } else {
            const placement = active.data.current?.placement as HierarchyPlacement;
            const targetXmm = placement.positionX + event.delta.x / SCALE;
            const remaining = getUnifiedShelfItems(
                selectedBlock.productPlacements, selectedBlock.hierarchyPlacements || [],
                targetShelfIndex, products, placement.id
            );
            const insertIdx = calcUnifiedInsertIndex(remaining, targetXmm);
            setDragPreview({
                placementId: placement.id,
                targetShelfIndex,
                insertIndex: insertIdx,
                itemWidthMm: placement.width * placement.faceCount
            });
        }
    };

    // ドラッグ終了（商品配置 / 階層移動）
    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveProduct(null);
        setActiveHierarchy(null);
        setDragPreview(null);
        if (!selectedBlock) return;

        const { active, over } = event;
        if (!over) return;

        const type = active.data.current?.type as string;
        const overId = over.id as string;

        if (!overId.startsWith('shelf-')) return;

        const targetShelfIndex = parseInt(overId.replace('shelf-', ''));

        if (type === 'placed-product') {
            // === 配置済み商品の移動（ドロップ位置で並び順を決定）===
            const placement = active.data.current?.placement as ProductPlacement;
            const product = active.data.current?.product as Product;

            const targetXmm = placement.positionX + event.delta.x / SCALE;

            // 移動元を除いた全アイテムで挿入位置を計算
            const remainingItems = getUnifiedShelfItems(
                selectedBlock.productPlacements, selectedBlock.hierarchyPlacements || [],
                targetShelfIndex, products, placement.id
            );
            const usedWidth = remainingItems.reduce((sum, item) => sum + item.totalWidth, 0);

            if (usedWidth + product.width * placement.faceCount > selectedBlock.width) {
                alert('移動先の段にはスペースがありません');
                return;
            }

            // 移動先商品プレースメントの挿入位置を計算
            const movedPlacement = { ...placement, shelfIndex: targetShelfIndex, positionX: targetXmm };
            const remainingProd = selectedBlock.productPlacements.filter(p => p.id !== placement.id);
            const updatedProd = [...remainingProd, movedPlacement];

            // 全位置再計算（左詰め — 統合）
            const { products: recalcProducts, hierarchies: recalcHier } =
                recalculateAllPositions(updatedProd, selectedBlock.hierarchyPlacements || [], selectedBlock);

            const updatedBlock = {
                ...selectedBlock,
                productPlacements: recalcProducts,
                hierarchyPlacements: recalcHier,
                updatedAt: new Date().toISOString()
            };

            setSelectedBlock(updatedBlock);
            setBlocks(blocks.map(b => b.id === selectedBlock.id ? updatedBlock : b));
            setIsDirty(true);
            await saveBlock(updatedBlock);
        } else if (type === 'placed-hierarchy') {
            // === 配置済み階層アイテムの移動 ===
            const placement = active.data.current?.placement as HierarchyPlacement;

            const targetXmm = placement.positionX + event.delta.x / SCALE;

            const remainingItems = getUnifiedShelfItems(
                selectedBlock.productPlacements, selectedBlock.hierarchyPlacements || [],
                targetShelfIndex, products, placement.id
            );
            const usedWidth = remainingItems.reduce((sum, item) => sum + item.totalWidth, 0);

            if (usedWidth + placement.width * placement.faceCount > selectedBlock.width) {
                alert('移動先の段にはスペースがありません');
                return;
            }

            const movedPlacement = { ...placement, shelfIndex: targetShelfIndex, positionX: targetXmm };
            const remainingHier = (selectedBlock.hierarchyPlacements || []).filter(h => h.id !== placement.id);
            const updatedHier = [...remainingHier, movedPlacement];

            const { products: recalcProducts, hierarchies: recalcHier } =
                recalculateAllPositions(selectedBlock.productPlacements, updatedHier, selectedBlock);

            const updatedBlock = {
                ...selectedBlock,
                productPlacements: recalcProducts,
                hierarchyPlacements: recalcHier,
                updatedAt: new Date().toISOString()
            };

            setSelectedBlock(updatedBlock);
            setBlocks(blocks.map(b => b.id === selectedBlock.id ? updatedBlock : b));
            setIsDirty(true);
            await saveBlock(updatedBlock);
        } else {
            // === パレットからの新規配置 ===
            const product = active.data.current?.product as Product | undefined;
            if (!product) return;

            const existingPlacements = selectedBlock.productPlacements
                .filter(p => p.shelfIndex === targetShelfIndex)
                .sort((a, b) => a.positionX - b.positionX);

            const usedWidthProd = existingPlacements.reduce((sum, p) => {
                const prod = products.find(pr => pr.id === p.productId);
                return sum + (prod ? prod.width * p.faceCount : 0);
            }, 0);
            const usedWidthHier = (selectedBlock.hierarchyPlacements || [])
                .filter(h => h.shelfIndex === targetShelfIndex)
                .reduce((sum, h) => sum + h.width * h.faceCount, 0);
            const usedWidth = usedWidthProd + usedWidthHier;

            if (usedWidth + product.width > selectedBlock.width) {
                alert('この段にはスペースがありません');
                return;
            }

            let updatedPlacements = [...selectedBlock.productPlacements];

            const lastPlacement = existingPlacements[existingPlacements.length - 1];
            if (lastPlacement && lastPlacement.productId === product.id) {
                const updatedLast = { ...lastPlacement, faceCount: lastPlacement.faceCount + 1 };
                updatedPlacements = updatedPlacements.map(p =>
                    p.id === lastPlacement.id ? updatedLast : p
                );
            } else {
                const newPlacement: ProductPlacement = {
                    id: crypto.randomUUID(),
                    productId: product.id,
                    shelfIndex: targetShelfIndex,
                    positionX: usedWidth,
                    faceCount: 1
                };
                updatedPlacements.push(newPlacement);
            }

            const updatedBlock = {
                ...selectedBlock,
                productPlacements: updatedPlacements,
                updatedAt: new Date().toISOString()
            };

            setSelectedBlock(updatedBlock);
            setBlocks(blocks.map(b => b.id === selectedBlock.id ? updatedBlock : b));
            setIsDirty(true);
            await saveBlock(updatedBlock);
        }
    };

    // 配置削除（フェース減少）
    const handleRemovePlacement = async (placementId: string) => {
        if (!selectedBlock) return;

        const targetPlacement = selectedBlock.productPlacements.find(p => p.id === placementId);
        if (!targetPlacement) return;

        let updatedPlacements: ProductPlacement[];

        if (targetPlacement.faceCount > 1) {
            // フェース減少
            updatedPlacements = selectedBlock.productPlacements.map(p =>
                p.id === placementId
                    ? { ...p, faceCount: p.faceCount - 1 }
                    : p
            );
        } else {
            // 削除
            updatedPlacements = selectedBlock.productPlacements.filter(p => p.id !== placementId);
        }

        // 位置を再計算（左詰め）
        const recalculatedPlacements = recalculatePositions(updatedPlacements, selectedBlock);

        const updatedBlock = {
            ...selectedBlock,
            productPlacements: recalculatedPlacements,
            updatedAt: new Date().toISOString()
        };

        setSelectedBlock(updatedBlock);
        setBlocks(blocks.map(b => b.id === selectedBlock.id ? updatedBlock : b));
        setIsDirty(true);
        await saveBlock(updatedBlock);
    };

    // 階層アイテムを棚に追加
    const handleAddHierarchy = async (level: HierarchyLevel, code: string, _name: string, shelfIndex: number) => {
        if (!selectedBlock) return;

        const hierPlacements = selectedBlock.hierarchyPlacements || [];

        // 段内の使用幅を計算
        const shelfProductPlacements = selectedBlock.productPlacements.filter(p => p.shelfIndex === shelfIndex);
        const shelfHierPlacements = hierPlacements.filter(h => h.shelfIndex === shelfIndex);

        const usedWidth = shelfProductPlacements.reduce((sum, p) => {
            const prod = products.find(pr => pr.id === p.productId);
            return sum + (prod ? prod.width * p.faceCount : 0);
        }, 0) + shelfHierPlacements.reduce((sum, h) => sum + h.width * h.faceCount, 0);

        if (usedWidth + HIERARCHY_DEFAULT_WIDTH > selectedBlock.width) {
            alert('この段にはスペースがありません');
            return;
        }

        const hierarchyPath = buildHierarchyPath(hierarchyEntries, level, code, hierarchyFilters);

        const newPlacement: HierarchyPlacement = {
            id: crypto.randomUUID(),
            hierarchyLevel: level,
            hierarchyCode: code,
            hierarchyName: hierarchyPath,
            shelfIndex,
            positionX: usedWidth,
            width: HIERARCHY_DEFAULT_WIDTH,
            faceCount: 1,
        };

        const updatedBlock = {
            ...selectedBlock,
            hierarchyPlacements: [...hierPlacements, newPlacement],
            updatedAt: new Date().toISOString(),
        };

        setSelectedBlock(updatedBlock);
        setBlocks(blocks.map(b => b.id === selectedBlock.id ? updatedBlock : b));
        setIsDirty(true);
        await saveBlock(updatedBlock);
    };

    // 階層アイテム削除（フェース減少）
    const handleRemoveHierarchy = async (placementId: string) => {
        if (!selectedBlock) return;
        const hierPlacements = selectedBlock.hierarchyPlacements || [];
        const target = hierPlacements.find(h => h.id === placementId);
        if (!target) return;

        let updatedHier: HierarchyPlacement[];
        if (target.faceCount > 1) {
            updatedHier = hierPlacements.map(h =>
                h.id === placementId ? { ...h, faceCount: h.faceCount - 1 } : h
            );
        } else {
            updatedHier = hierPlacements.filter(h => h.id !== placementId);
        }

        const { products: recalcProducts, hierarchies: recalcHier } =
            recalculateAllPositions(selectedBlock.productPlacements, updatedHier, selectedBlock);

        const updatedBlock = {
            ...selectedBlock,
            productPlacements: recalcProducts,
            hierarchyPlacements: recalcHier,
            updatedAt: new Date().toISOString(),
        };

        setSelectedBlock(updatedBlock);
        setBlocks(blocks.map(b => b.id === selectedBlock.id ? updatedBlock : b));
        setIsDirty(true);
        await saveBlock(updatedBlock);
    };

    // 階層アイテムのリサイズ（隣接アイテムを右に押し出す）
    const handleResizeHierarchy = async (placementId: string, newWidth: number) => {
        if (!selectedBlock) return;
        const hierPlacements = selectedBlock.hierarchyPlacements || [];
        const updatedHier = hierPlacements.map(h =>
            h.id === placementId ? { ...h, width: Math.round(newWidth * 10) / 10 } : h
        );

        // 統合再計算で隣接アイテムを押し出す
        const { products: recalcProducts, hierarchies: recalcHier } =
            recalculateAllPositions(selectedBlock.productPlacements, updatedHier, selectedBlock);

        const updatedBlock = {
            ...selectedBlock,
            productPlacements: recalcProducts,
            hierarchyPlacements: recalcHier,
            updatedAt: new Date().toISOString(),
        };

        setSelectedBlock(updatedBlock);
        setBlocks(blocks.map(b => b.id === selectedBlock.id ? updatedBlock : b));
        setIsDirty(true);
        // リサイズ中は頻繁に呼ばれるので保存はしない（mouseup時にdirtyで保存）
    };

    // フィルター済み商品
    const lowerSearch = searchTerm.toLowerCase();
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(lowerSearch) ||
        (p.category ?? '').toLowerCase().includes(lowerSearch)
    );

    if (loading) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header">
                    <h1 className="page-title">棚ブロック管理</h1>
                </div>
                <div className="text-center text-muted animate-pulse">読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">棚ブロック管理</h1>
                <p className="page-subtitle">特定の商品群を構成する「棚のひとかたまり」を作成・編集</p>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onDragCancel={() => { setActiveProduct(null); setActiveHierarchy(null); setDragPreview(null); }}
            >
                {/* ブロック選択エリア（横並びスクロール） */}
                <div className="card mb-lg">
                    {/* タブ */}
                    <div className="flex border-b border-border mb-md">
                        <button
                            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'multi-tier'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted hover:text-foreground'
                                }`}
                            onClick={() => {
                                setActiveTab('multi-tier');
                                setNewBlock(prev => ({ ...prev, blockType: 'multi-tier' }));
                                setSelectedBlock(null);
                            }}
                        >
                            多段
                        </button>
                        <button
                            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'flat'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted hover:text-foreground'
                                }`}
                            onClick={() => {
                                setActiveTab('flat');
                                setNewBlock(prev => ({ ...prev, blockType: 'flat' }));
                                setSelectedBlock(null);
                            }}
                        >
                            平台
                        </button>
                    </div>

                    {/* 新規ボタン + 横スクロールブロック一覧 */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <button
                            className="btn btn-primary"
                            style={{ flexShrink: 0 }}
                            onClick={() => {
                                setNewBlock({ name: '', description: '', blockType: activeTab, width: 900, height: activeTab === 'flat' ? 900 : 1800, shelfCount: 5 });
                                setIsCreateModalOpen(true);
                            }}
                        >
                            ＋ 新規ブロック
                        </button>
                        <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            overflowX: 'auto',
                            flex: 1,
                            paddingBottom: '0.25rem'
                        }}>
                            {blocks.filter(b => b && (b.blockType || 'multi-tier') === activeTab).map(block => (
                                <BlockCard
                                    key={block.id}
                                    block={block}
                                    selected={selectedBlock?.id === block.id}
                                    onClick={() => { setSelectedBlock(block); setIsDirty(false); setSaveStatus('idle'); }}
                                    onDelete={() => handleDeleteBlock(block.id)}
                                />
                            ))}
                            {blocks.filter(b => b && (b.blockType || 'multi-tier') === activeTab).length === 0 && (
                                <div className="text-muted" style={{ padding: '0.5rem 0', fontSize: '0.85rem' }}>
                                    ブロックがありません
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* メインエリア：棚キャンバス（左詰め）＋ 商品一覧 */}
                <div style={{ display: 'flex', gap: '0', alignItems: 'flex-start' }}>
                    {/* 棚キャンバス（リサイズ可能） */}
                    <div style={{ flex: '0 0 auto', width: canvasPanelWidth ? `${canvasPanelWidth}px` : undefined, maxWidth: 'calc(100vw - 350px)' }}>
                        {selectedBlock ? (
                            <div className="card">
                                <div className="card-header">
                                    <div>
                                        <h3 className="card-title">{selectedBlock.name}</h3>
                                        <div className="text-sm text-muted">
                                            <UnitDisplay valueMm={selectedBlock.width} /> × <UnitDisplay valueMm={selectedBlock.height} /> {selectedBlock.blockType === 'flat' ? '（奥行）' : ` / ${selectedBlock.shelfCount}段`}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {isSaving && (
                                            <span className="text-sm text-muted">保存中...</span>
                                        )}
                                        {!isSaving && saveStatus === 'saved' && (
                                            <span className="text-sm" style={{ color: 'var(--color-success, #22c55e)' }}>✓ 保存済み</span>
                                        )}
                                        {!isSaving && saveStatus === 'error' && (
                                            <span className="text-sm" style={{ color: 'var(--color-danger, #ef4444)' }}>⚠ 保存失敗</span>
                                        )}
                                        {!isSaving && isDirty && saveStatus !== 'saved' && saveStatus !== 'error' && (
                                            <span className="text-sm" style={{ color: 'var(--color-warning, #f59e0b)' }}>未保存</span>
                                        )}
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleManualSave}
                                            disabled={isSaving}
                                            style={{ minWidth: '80px' }}
                                        >
                                            {isSaving ? '保存中...' : '保存'}
                                        </button>
                                    </div>
                                </div>

                                {/* 棚ビジュアル */}
                                <div
                                    style={{
                                        position: 'relative',
                                        paddingLeft: '40px',
                                        paddingTop: '10px',
                                        paddingBottom: '10px',
                                        background: 'var(--bg-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        overflow: 'auto',
                                        maxHeight: '500px'
                                    }}
                                >
                                    <div
                                        className="shelf-grid"
                                        style={{ width: `${selectedBlock.width * SCALE}px`, display: 'flex', flexDirection: 'column-reverse', gap: '2px' }}
                                    >
                                        {Array.from({ length: selectedBlock.shelfCount }).map((_, i) => (
                                            <ShelfRow
                                                key={i}
                                                shelfIndex={i}
                                                width={selectedBlock.width}
                                                placements={selectedBlock.productPlacements}
                                                hierarchyPlacements={selectedBlock.hierarchyPlacements || []}
                                                products={products}
                                                onRemove={handleRemovePlacement}
                                                onRemoveHierarchy={handleRemoveHierarchy}
                                                onResizeHierarchy={handleResizeHierarchy}
                                                previewPositions={previewPositions}
                                                draggedPlacementId={dragPreview?.placementId || null}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="text-sm text-muted mt-md">
                                    商品をドラッグして配置・移動 / クリックで削除 / 空白は赤で表示
                                </div>
                            </div>
                        ) : (
                            <div className="card text-center text-muted" style={{ padding: '4rem', minWidth: '300px' }}>
                                上のリストからブロックを選択するか、<br />
                                新規ブロックを作成してください
                            </div>
                        )}
                    </div>

                    {/* リサイズハンドル */}
                    <div
                        onMouseDown={handleResizeStart}
                        style={{
                            flex: '0 0 8px',
                            cursor: 'col-resize',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            alignSelf: 'stretch',
                            minHeight: '200px',
                        }}
                        title="ドラッグで幅を調整"
                    >
                        <div style={{
                            width: '4px',
                            height: '40px',
                            borderRadius: '2px',
                            background: 'var(--border-color)',
                            transition: 'background 0.15s',
                        }} />
                    </div>

                    {/* 商品一覧 / 商品階層パネル（残り幅すべて） */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <div className="card">
                            {/* タブ切替 */}
                            <div className="flex border-b border-border mb-md">
                                <button
                                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${panelMode === 'products'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted hover:text-foreground'
                                    }`}
                                    onClick={() => setPanelMode('products')}
                                >
                                    商品
                                </button>
                                <button
                                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${panelMode === 'hierarchy'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted hover:text-foreground'
                                    }`}
                                    onClick={() => setPanelMode('hierarchy')}
                                >
                                    商品階層
                                </button>
                            </div>

                            {panelMode === 'products' ? (
                                <>
                                    <input
                                        type="text"
                                        className="form-input mb-md"
                                        placeholder="商品名で検索..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.35rem',
                                            maxHeight: '500px',
                                            overflowY: 'auto'
                                        }}
                                    >
                                        {filteredProducts.slice(0, 30).map(product => (
                                            <DraggableProduct key={product.id} product={product} />
                                        ))}
                                    </div>
                                    <div className="text-xs text-muted mt-sm">
                                        {filteredProducts.length}件中 上位30件表示
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* 階層レベル選択 */}
                                    <div className="mb-md">
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>階層レベル</label>
                                        <select
                                            className="form-input"
                                            value={selectedHierarchyLevel}
                                            onChange={(e) => {
                                                const newLevel = e.target.value as HierarchyLevel;
                                                setSelectedHierarchyLevel(newLevel);
                                                // 下位フィルターをクリア
                                                const idx = HIERARCHY_LEVELS.indexOf(newLevel);
                                                const newFilters = { ...hierarchyFilters };
                                                for (let i = idx; i < HIERARCHY_LEVELS.length; i++) {
                                                    delete newFilters[HIERARCHY_LEVELS[i]];
                                                }
                                                setHierarchyFilters(newFilters);
                                            }}
                                        >
                                            {HIERARCHY_LEVELS.map(level => (
                                                <option key={level} value={level}>{HIERARCHY_LEVEL_LABELS[level]}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* 上位階層フィルター */}
                                    {HIERARCHY_LEVELS.slice(0, HIERARCHY_LEVELS.indexOf(selectedHierarchyLevel)).map(filterLevel => {
                                        const parentFilters: Partial<Record<HierarchyLevel, string>> = {};
                                        for (const l of HIERARCHY_LEVELS) {
                                            if (l === filterLevel) break;
                                            if (hierarchyFilters[l]) parentFilters[l] = hierarchyFilters[l];
                                        }
                                        const options = getUniqueHierarchyOptions(hierarchyEntries, filterLevel, parentFilters);
                                        return (
                                            <div key={filterLevel} className="mb-sm">
                                                <label className="form-label" style={{ fontSize: '0.7rem' }}>{HIERARCHY_LEVEL_LABELS[filterLevel]}</label>
                                                <select
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem' }}
                                                    value={hierarchyFilters[filterLevel] || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const newFilters = { ...hierarchyFilters };
                                                        if (val) {
                                                            newFilters[filterLevel] = val;
                                                        } else {
                                                            delete newFilters[filterLevel];
                                                        }
                                                        // 下位フィルターをクリア
                                                        const idx = HIERARCHY_LEVELS.indexOf(filterLevel);
                                                        for (let i = idx + 1; i < HIERARCHY_LEVELS.indexOf(selectedHierarchyLevel); i++) {
                                                            delete newFilters[HIERARCHY_LEVELS[i]];
                                                        }
                                                        setHierarchyFilters(newFilters);
                                                    }}
                                                >
                                                    <option value="">すべて</option>
                                                    {options.map(o => (
                                                        <option key={o.code} value={o.code}>{o.name} ({o.code})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}

                                    {/* 選択可能な階層アイテム一覧 */}
                                    <div className="mt-md" style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                        {HIERARCHY_LEVEL_LABELS[selectedHierarchyLevel]}一覧
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.35rem',
                                            maxHeight: '400px',
                                            overflowY: 'auto'
                                        }}
                                    >
                                        {(() => {
                                            const options = getUniqueHierarchyOptions(hierarchyEntries, selectedHierarchyLevel, hierarchyFilters);
                                            if (options.length === 0) {
                                                return <div className="text-muted text-sm">該当なし</div>;
                                            }
                                            return options.map(opt => (
                                                <div
                                                    key={opt.code}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.4rem 0.5rem',
                                                        background: 'var(--bg-secondary)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontSize: '0.75rem',
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>{opt.name}</div>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{opt.code}</div>
                                                    </div>
                                                    {selectedBlock && (
                                                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                                                            {Array.from({ length: selectedBlock.shelfCount }).map((_, si) => (
                                                                <button
                                                                    key={si}
                                                                    className="btn btn-sm"
                                                                    style={{ padding: '1px 6px', fontSize: '0.6rem', lineHeight: '1.4' }}
                                                                    onClick={() => handleAddHierarchy(selectedHierarchyLevel, opt.code, opt.name, si)}
                                                                    title={`${si + 1}段目に配置`}
                                                                >
                                                                    {si + 1}段
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                    {hierarchyEntries.length === 0 && (
                                        <div className="text-muted text-sm mt-md">
                                            商品階層マスタが未登録です。マスタ管理画面から初期データを投入してください。
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ドラッグオーバーレイ */}
                <DragOverlay>
                    {activeProduct ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.4rem 0.6rem',
                            background: 'var(--color-primary)',
                            color: 'white',
                            borderRadius: 'var(--radius-sm)',
                            opacity: 0.9,
                            cursor: 'grabbing',
                            width: '200px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {activeProduct.name}
                            </div>
                        </div>
                    ) : activeHierarchy ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.4rem 0.6rem',
                            background: 'rgba(99, 102, 241, 0.9)',
                            color: 'white',
                            borderRadius: 'var(--radius-sm)',
                            opacity: 0.9,
                            cursor: 'grabbing',
                            width: '200px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {activeHierarchy.hierarchyName}
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* 新規ブロック作成モーダル */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="新規棚ブロック作成"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                            キャンセル
                        </button>
                        <button className="btn btn-primary" onClick={handleCreateBlock}>
                            作成
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">ブロック名 *</label>
                    <input
                        type="text"
                        className="form-input"
                        value={newBlock.name}
                        onChange={(e) => setNewBlock({ ...newBlock, name: e.target.value })}
                        placeholder={newBlock.blockType === 'flat' ? "精肉平台ブロック" : "焼肉セットブロック"}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">説明</label>
                    <textarea
                        className="form-textarea"
                        value={newBlock.description}
                        onChange={(e) => setNewBlock({ ...newBlock, description: e.target.value })}
                        placeholder="このブロックの説明..."
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <UnitInput
                        label="幅"
                        value={newBlock.width}
                        onChange={(w) => setNewBlock({ ...newBlock, width: w })}
                        min={30}
                    />
                    <UnitInput
                        label={newBlock.blockType === 'flat' ? '奥行き' : '高さ'}
                        value={newBlock.height}
                        onChange={(h) => setNewBlock({ ...newBlock, height: h })}
                        min={30}
                    />
                </div>

                {newBlock.blockType === 'multi-tier' && (
                    <div className="form-group">
                        <label className="form-label">段数</label>
                        <input
                            type="number"
                            className="form-input"
                            value={newBlock.shelfCount}
                            onChange={(e) => setNewBlock({ ...newBlock, shelfCount: parseInt(e.target.value) || 1 })}
                            min={1}
                            max={10}
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
}
