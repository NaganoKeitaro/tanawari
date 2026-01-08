// 棚割管理システム - 棚ブロック管理（Building Blocks）
import { useState, useEffect, useCallback } from 'react';
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
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { ShelfBlock, Product, ProductPlacement } from '../../data/types';
import {
    shelfBlockRepository,
    productRepository
} from '../../data/repositories/localStorageRepository';
import { Modal } from '../../components/common/Modal';
import { UnitInput } from '../../components/common/UnitInput';
import { UnitDisplay } from '../../components/common/UnitDisplay';

// 1cm = 3px表示
const SCALE = 3; // 1cm = 3px表示

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
            style={style}
            {...listeners}
            {...attributes}
            className="product-card"
        >
            <img
                src={product.imageUrl}
                alt={product.name}
                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
            />
            <div className="product-card-name">{product.name}</div>
            <div className="product-card-size">{product.width}×{product.height}cm</div>
            <div className="text-xs" style={{ color: 'var(--color-warning)' }}>
                Rank: {product.salesRank}
            </div>
        </div>
    );
}

// 棚段ドロップエリア
function ShelfRow({
    shelfIndex,
    width,
    height,
    placements,
    products,
    onRemove
}: {
    shelfIndex: number;
    width: number;
    height: number;
    placements: ProductPlacement[];
    products: Product[];
    onRemove: (placementId: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `shelf-${shelfIndex}`,
        data: { shelfIndex }
    });

    const rowHeight = Math.max(60, height * SCALE / 5);
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
                height: `${rowHeight}px`,
                borderColor: isOver ? 'var(--color-primary)' : 'var(--border-color)',
                borderWidth: isOver ? '2px' : '1px',
                borderStyle: 'solid',
                position: 'relative'
            }}
        >
            {/* 配置済み商品 */}
            {rowPlacements.map(placement => {
                const product = products.find(p => p.id === placement.productId);
                if (!product) return null;

                const productWidth = product.width * placement.faceCount * SCALE;
                return (
                    <div
                        key={placement.id}
                        style={{
                            position: 'absolute',
                            left: `${placement.positionX * SCALE}px`,
                            top: 0,
                            bottom: 0,
                            width: `${productWidth}px`,
                            background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px',
                            fontSize: '0.6rem',
                            overflow: 'hidden',
                            cursor: 'pointer'
                        }}
                        onClick={() => onRemove(placement.id)}
                        title="クリックで削除"
                    >
                        <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                            {product.name}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>×{placement.faceCount}</div>
                    </div>
                );
            })}

            {/* 空白スペース表示 */}
            {emptyWidth > 0 && (
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

// 棚ブロックカード
function BlockCard({
    block,
    onClick,
    onDelete
}: {
    block: ShelfBlock;
    onClick: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="card" style={{ cursor: 'pointer' }} onClick={onClick}>
            <div className="flex items-center justify-between mb-sm">
                <h4 style={{ margin: 0 }}>{block.name}</h4>
                <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    削除
                </button>
            </div>
            <div className="text-sm text-muted">
                <UnitDisplay valueCm={block.width} /> × <UnitDisplay valueCm={block.height} />
            </div>
            <div className="text-sm text-muted">{block.shelfCount}段 / {block.productPlacements.length}商品</div>
            {block.description && (
                <div className="text-xs text-muted mt-sm">{block.description}</div>
            )}
        </div>
    );
}

export function ShelfBlockEditor() {
    const [blocks, setBlocks] = useState<ShelfBlock[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBlock, setSelectedBlock] = useState<ShelfBlock | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeProduct, setActiveProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // 新規ブロックフォーム
    const [newBlock, setNewBlock] = useState({
        name: '',
        description: '',
        width: 90,
        height: 180,
        shelfCount: 5
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5
            }
        })
    );

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
            width: newBlock.width,
            height: newBlock.height,
            shelfCount: newBlock.shelfCount,
            productPlacements: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        setBlocks([...blocks, created]);
        setIsCreateModalOpen(false);
        setNewBlock({ name: '', description: '', width: 90, height: 180, shelfCount: 5 });
        setSelectedBlock(created);
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

    // ドラッグ開始
    const handleDragStart = (event: DragStartEvent) => {
        const product = event.active.data.current?.product as Product | undefined;
        setActiveProduct(product || null);
    };

    // ドラッグ終了（商品配置）
    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveProduct(null);
        if (!selectedBlock) return;

        const { active, over } = event;
        if (!over) return;

        const product = active.data.current?.product as Product | undefined;
        const overId = over.id as string;

        if (!product || !overId.startsWith('shelf-')) return;

        const shelfIndex = parseInt(overId.replace('shelf-', ''));

        // 既存配置の計算
        const existingPlacements = selectedBlock.productPlacements.filter(
            p => p.shelfIndex === shelfIndex
        );
        const usedWidth = existingPlacements.reduce((sum, p) => {
            const prod = products.find(pr => pr.id === p.productId);
            return sum + (prod ? prod.width * p.faceCount : 0);
        }, 0);

        // スペースチェック
        if (usedWidth + product.width > selectedBlock.width) {
            alert('この段にはスペースがありません');
            return;
        }

        // 配置を追加
        const newPlacement: ProductPlacement = {
            id: crypto.randomUUID(),
            productId: product.id,
            shelfIndex,
            positionX: usedWidth, // 左詰め
            faceCount: 1
        };

        const updatedBlock = {
            ...selectedBlock,
            productPlacements: [...selectedBlock.productPlacements, newPlacement],
            updatedAt: new Date().toISOString()
        };

        await shelfBlockRepository.update(selectedBlock.id, updatedBlock);
        setSelectedBlock(updatedBlock);
        setBlocks(blocks.map(b => b.id === selectedBlock.id ? updatedBlock : b));
    };

    // 配置削除
    const handleRemovePlacement = async (placementId: string) => {
        if (!selectedBlock) return;

        const updatedPlacements = selectedBlock.productPlacements.filter(p => p.id !== placementId);
        // 位置を再計算（左詰め）
        const recalculatedPlacements: ProductPlacement[] = [];

        for (let shelfIndex = 0; shelfIndex < selectedBlock.shelfCount; shelfIndex++) {
            const shelfPlacements = updatedPlacements.filter(p => p.shelfIndex === shelfIndex);
            let currentX = 0;
            for (const placement of shelfPlacements) {
                const product = products.find(p => p.id === placement.productId);
                recalculatedPlacements.push({
                    ...placement,
                    positionX: currentX
                });
                currentX += product ? product.width * placement.faceCount : 0;
            }
        }

        const updatedBlock = {
            ...selectedBlock,
            productPlacements: recalculatedPlacements,
            updatedAt: new Date().toISOString()
        };

        await shelfBlockRepository.update(selectedBlock.id, updatedBlock);
        setSelectedBlock(updatedBlock);
        setBlocks(blocks.map(b => b.id === selectedBlock.id ? updatedBlock : b));
    };

    // フィルター済み商品
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
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
                onDragEnd={handleDragEnd}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: '1.5rem' }}>
                    {/* ブロック一覧 */}
                    <div>
                        <div className="card mb-md">
                            <button
                                className="btn btn-primary w-full"
                                onClick={() => setIsCreateModalOpen(true)}
                            >
                                ＋ 新規ブロック
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {blocks.map(block => (
                                <BlockCard
                                    key={block.id}
                                    block={block}
                                    onClick={() => setSelectedBlock(block)}
                                    onDelete={() => handleDeleteBlock(block.id)}
                                />
                            ))}
                            {blocks.length === 0 && (
                                <div className="text-center text-muted" style={{ padding: '2rem' }}>
                                    ブロックがありません
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 編集エリア */}
                    <div>
                        {selectedBlock ? (
                            <div className="card">
                                <div className="card-header">
                                    <div>
                                        <h3 className="card-title">{selectedBlock.name}</h3>
                                        <div className="text-sm text-muted">
                                            <UnitDisplay valueCm={selectedBlock.width} /> × <UnitDisplay valueCm={selectedBlock.height} /> / {selectedBlock.shelfCount}段
                                        </div>
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
                                        overflow: 'auto'
                                    }}
                                >
                                    <div
                                        className="shelf-grid"
                                        style={{ width: `${selectedBlock.width * SCALE}px` }}
                                    >
                                        {Array.from({ length: selectedBlock.shelfCount }).map((_, i) => (
                                            <ShelfRow
                                                key={i}
                                                shelfIndex={i}
                                                width={selectedBlock.width}
                                                height={selectedBlock.height / selectedBlock.shelfCount}
                                                placements={selectedBlock.productPlacements}
                                                products={products}
                                                onRemove={handleRemovePlacement}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="text-sm text-muted mt-md">
                                    商品をドラッグして配置 / クリックで削除 / 空白は赤で表示
                                </div>
                            </div>
                        ) : (
                            <div className="card text-center text-muted" style={{ padding: '4rem' }}>
                                左のリストからブロックを選択するか、<br />
                                新規ブロックを作成してください
                            </div>
                        )}
                    </div>

                    {/* 商品パレット */}
                    <div>
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
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                    gap: '0.5rem',
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
                        <div
                            className="product-card"
                            style={{
                                background: 'var(--color-primary)',
                                color: 'white',
                                opacity: 0.9,
                                cursor: 'grabbing',
                                width: '80px'
                            }}
                        >
                            <div className="product-card-name">{activeProduct.name}</div>
                            <div className="product-card-size">{activeProduct.width}×{activeProduct.height}cm</div>
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
                        placeholder="焼肉セットブロック"
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
                        label="高さ"
                        value={newBlock.height}
                        onChange={(h) => setNewBlock({ ...newBlock, height: h })}
                        min={60}
                    />
                </div>

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
            </Modal>
        </div>
    );
}
