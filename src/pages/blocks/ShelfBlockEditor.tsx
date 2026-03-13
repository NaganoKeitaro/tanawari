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
import type { ShelfBlock, Product, ProductPlacement } from '../../data/types';
import {
    shelfBlockRepository,
    productRepository
} from '../../data/repositories/repositoryFactory';
import { Modal } from '../../components/common/Modal';
import { UnitInput } from '../../components/common/UnitInput';
import { UnitDisplay } from '../../components/common/UnitDisplay';
import { getProductColor, initProductColorMap } from '../../utils/productColorUtils';
import { ProductTooltip } from '../../components/common/ProductTooltip';

// 1mm = 0.3px表示
const SCALE = 0.3; // 1mm = 0.3px表示

// ドラッグプレビュー状態の型
type DragPreviewState = {
    placementId: string;
    targetShelfIndex: number;
    insertIndex: number;
    productWidthMm: number;
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
                    background: getProductColor(product.category).bg,
                    border: `1px solid ${getProductColor(product.category).border}`,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px',
                    fontSize: '0.6rem',
                    overflow: 'hidden',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    color: getProductColor(product.category).text,
                    opacity: isDragging ? 0.3 : 1,
                    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
                    zIndex: isDragging ? 100 : undefined,
                    transition: !isDragging && previewX !== undefined ? 'left 0.15s ease' : undefined,
                }}
                onClick={handleClick}
            >
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', fontSize: '0.65rem' }}>
                    {product.name}
                </div>
                <div style={{ opacity: 0.8, fontSize: '0.55rem', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {product.jan || '-'}
                </div>
                <div style={{ opacity: 0.85, fontSize: '0.6rem' }}>×{placement.faceCount}</div>
            </div>
        </ProductTooltip>
    );
}

// 棚段ドロップエリア
function ShelfRow({
    shelfIndex,
    width,
    placements,
    products,
    onRemove,
    previewPositions,
    draggedPlacementId
}: {
    shelfIndex: number;
    width: number;
    placements: ProductPlacement[];
    products: Product[];
    onRemove: (placementId: string) => void;
    previewPositions: Record<string, number> | null;
    draggedPlacementId: string | null;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `shelf-${shelfIndex}`,
        data: { shelfIndex }
    });

    const FIXED_ROW_HEIGHT = 170; // 固定高さ: テキスト視認性優先（JAN表示対応）
    const rowPlacements = placements.filter(p => p.shelfIndex === shelfIndex);

    // 空きスペース計算
    const usedWidth = rowPlacements.reduce((sum, p) => {
        const product = products.find(pr => pr.id === p.productId);
        return sum + (product ? product.width * p.faceCount : 0);
    }, 0);
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
                {block.productPlacements.length}商品
            </div>
        </div>
    );
}

// ドラッグ中の挿入インデックスを計算するヘルパー
function calcInsertIndex(
    targetShelfPlacements: ProductPlacement[],
    targetXmm: number,
    products: Product[]
): number {
    let insertIdx = targetShelfPlacements.length;
    for (let i = 0; i < targetShelfPlacements.length; i++) {
        const p = targetShelfPlacements[i];
        const prod = products.find(pr => pr.id === p.productId);
        if (!prod) continue;
        const centerX = p.positionX + (prod.width * p.faceCount) / 2;
        if (targetXmm < centerX) {
            insertIdx = i;
            break;
        }
    }
    return insertIdx;
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
            const shelfProducts = selectedBlock.productPlacements
                .filter(p => p.id !== dragPreview.placementId && p.shelfIndex === si)
                .sort((a, b) => a.positionX - b.positionX);

            let currentX = 0;

            for (let i = 0; i < shelfProducts.length; i++) {
                // 移動先の棚で、挿入位置にギャップを入れる
                if (si === dragPreview.targetShelfIndex && i === dragPreview.insertIndex) {
                    currentX += dragPreview.productWidthMm;
                }
                positions[shelfProducts[i].id] = currentX;
                const prod = products.find(p => p.id === shelfProducts[i].productId);
                currentX += prod ? prod.width * shelfProducts[i].faceCount : 0;
            }
            // 末尾に挿入する場合
            if (si === dragPreview.targetShelfIndex && dragPreview.insertIndex >= shelfProducts.length) {
                // ギャップは末尾なのでシフト不要
            }
        }

        return positions;
    })();

    // データ読み込み
    const loadData = useCallback(async () => {
        setLoading(true);
        const [blocksData, productsData] = await Promise.all([
            shelfBlockRepository.getAll(),
            productRepository.getAll()
        ]);
        // 売上ランク順にソート
        productsData.sort((a, b) => a.salesRank - b.salesRank);
        setBlocks(blocksData);
        setProducts(productsData);
        initProductColorMap(productsData.map(p => p.category));
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
            setBlocks(blocks.filter(b => b.id !== blockId));
            if (selectedBlock?.id === blockId) {
                setSelectedBlock(null);
            }
        }
    };

    // 位置再計算（左詰め）ヘルパー
    const recalculatePositions = (placements: ProductPlacement[], block: ShelfBlock): ProductPlacement[] => {
        const result: ProductPlacement[] = [];
        for (let si = 0; si < block.shelfCount; si++) {
            const shelfPlacements = placements
                .filter(p => p.shelfIndex === si)
                .sort((a, b) => a.positionX - b.positionX);
            let currentX = 0;
            for (const placement of shelfPlacements) {
                const prod = products.find(p => p.id === placement.productId);
                result.push({ ...placement, positionX: currentX });
                currentX += prod ? prod.width * placement.faceCount : 0;
            }
        }
        return result;
    };

    // ドラッグ開始
    const handleDragStart = (event: DragStartEvent) => {
        const product = event.active.data.current?.product as Product | undefined;
        setActiveProduct(product || null);
        setDragPreview(null);
    };

    // ドラッグ中（プレビュー更新）
    const handleDragMove = (event: DragMoveEvent) => {
        if (!selectedBlock) return;
        const { active, over } = event;

        const type = active.data.current?.type as string;
        if (type !== 'placed-product') { setDragPreview(null); return; }
        if (!over) { setDragPreview(null); return; }

        const overId = over.id as string;
        if (!overId.startsWith('shelf-')) { setDragPreview(null); return; }

        const targetShelfIndex = parseInt(overId.replace('shelf-', ''));
        const placement = active.data.current?.placement as ProductPlacement;
        const product = active.data.current?.product as Product;

        const targetXmm = placement.positionX + event.delta.x / SCALE;

        // 移動元を除いた移動先棚の商品
        const remainingOnTarget = selectedBlock.productPlacements
            .filter(p => p.id !== placement.id && p.shelfIndex === targetShelfIndex)
            .sort((a, b) => a.positionX - b.positionX);

        const insertIdx = calcInsertIndex(remainingOnTarget, targetXmm, products);

        setDragPreview({
            placementId: placement.id,
            targetShelfIndex,
            insertIndex: insertIdx,
            productWidthMm: product.width * placement.faceCount
        });
    };

    // ドラッグ終了（商品配置 / 移動）
    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveProduct(null);
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

            // 元の位置から除外した配置リスト
            const remainingPlacements = selectedBlock.productPlacements.filter(p => p.id !== placement.id);

            // 移動先の段の既存商品（移動元を除く）
            const targetShelfPlacements = remainingPlacements
                .filter(p => p.shelfIndex === targetShelfIndex)
                .sort((a, b) => a.positionX - b.positionX);

            const usedWidth = targetShelfPlacements.reduce((sum, p) => {
                const prod = products.find(pr => pr.id === p.productId);
                return sum + (prod ? prod.width * p.faceCount : 0);
            }, 0);

            if (usedWidth + product.width * placement.faceCount > selectedBlock.width) {
                alert('移動先の段にはスペースがありません');
                return;
            }

            // ドロップ位置のX座標（mm）を計算
            const targetXmm = placement.positionX + event.delta.x / SCALE;

            // ドロップX位置を基に挿入インデックスを決定
            const insertIdx = calcInsertIndex(targetShelfPlacements, targetXmm, products);

            // 新しい並び順で配置リストを構築（positionXを連番にして順序を保持）
            const movedPlacement = { ...placement, shelfIndex: targetShelfIndex };
            const reorderedShelf = [
                ...targetShelfPlacements.slice(0, insertIdx),
                movedPlacement,
                ...targetShelfPlacements.slice(insertIdx)
            ].map((p, idx) => ({ ...p, positionX: idx }));

            // 他の段のプレースメントと結合
            const otherPlacements = remainingPlacements.filter(p => p.shelfIndex !== targetShelfIndex);
            const updatedPlacements = [...otherPlacements, ...reorderedShelf];

            // 全位置再計算（左詰め）
            const recalculated = recalculatePositions(updatedPlacements, selectedBlock);

            const updatedBlock = {
                ...selectedBlock,
                productPlacements: recalculated,
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

            const usedWidth = existingPlacements.reduce((sum, p) => {
                const prod = products.find(pr => pr.id === p.productId);
                return sum + (prod ? prod.width * p.faceCount : 0);
            }, 0);

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
                onDragCancel={() => { setActiveProduct(null); setDragPreview(null); }}
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
                            {blocks.filter(b => (b.blockType || 'multi-tier') === activeTab).map(block => (
                                <BlockCard
                                    key={block.id}
                                    block={block}
                                    selected={selectedBlock?.id === block.id}
                                    onClick={() => { setSelectedBlock(block); setIsDirty(false); setSaveStatus('idle'); }}
                                    onDelete={() => handleDeleteBlock(block.id)}
                                />
                            ))}
                            {blocks.filter(b => (b.blockType || 'multi-tier') === activeTab).length === 0 && (
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
                                                products={products}
                                                onRemove={handleRemovePlacement}
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

                    {/* 商品一覧（残り幅すべて） */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <div className="card">
                            <h3 className="card-title mb-md">商品一覧</h3>
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
