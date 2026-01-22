import { useMemo } from 'react';
import type {
    Product,
    StandardPlanogram,
    StorePlanogram,
    ShelfBlock,
    StandardPlanogramBlock
} from '../../data/types';
import type {
    HeatmapLevel,
    HeatmapMetric
} from '../../utils/heatmapUtils';
import {
    calculateHeatmapColor,
    formatMetricValue,
    getJanLevelValue
} from '../../utils/heatmapUtils';

type PlanogramVisualizerProps = {
    planogram: StandardPlanogram | StorePlanogram;
    products: Product[];
    shelfBlocks?: ShelfBlock[];
    level: HeatmapLevel;
    metric: HeatmapMetric;
    hierarchyField?: keyof Product; // Optional hierarchy field to aggregate by
    totalMetric?: number; // Optional externally provided total
};

const SCALE = 3; // 1cm = 3px

export function PlanogramVisualizer({
    planogram,
    products,
    shelfBlocks = [],
    level,
    metric,
    hierarchyField = 'category',
    totalMetric: propTotalMetric
}: PlanogramVisualizerProps) {

    // 1. 集計とスコアリング
    const { scores, maxScore, totalMetric } = useMemo(() => {
        let computedScores: Record<string, number> = {};
        let max = 0;
        let total = 0;

        // 全体の合計を計算 (Propがなければ計算)
        if (typeof propTotalMetric === 'number') {
            total = propTotalMetric;
        } else {
            planogram.products.forEach(p => {
                const product = products.find(pr => pr.id === p.productId);
                if (product) {
                    total += ((product[metric] as number) || 0);
                }
            });
        }

        // JAN (Product) Level
        if (level === 'jan') {
            planogram.products.forEach(p => {
                const product = products.find(pr => pr.id === p.productId);
                if (product) {
                    const val = getJanLevelValue(product, metric);
                    computedScores[p.id] = val;
                    if (val > max) max = val;
                }
            });
        }

        // Hierarchy Level (Category etc.)
        // 商品レベルで塗るが、値はカテゴリ合計を使用
        else if (level === 'hierarchy') {
            const productsInPlanogram = planogram.products
                .map(p => products.find(pr => pr.id === p.productId))
                .filter((p): p is Product => !!p);

            // Use the dynamic hierarchy field for key
            const hierarchySums: Record<string, number> = {};
            productsInPlanogram.forEach(p => {
                const key = (p[hierarchyField || 'category'] as any) || 'Others';
                hierarchySums[key] = (hierarchySums[key] || 0) + ((p[metric] as number) || 0);
            });

            max = Math.max(...Object.values(hierarchySums));

            planogram.products.forEach(p => {
                const product = products.find(pr => pr.id === p.productId);
                if (product) {
                    const key = (product[hierarchyField || 'category'] as any) || 'Others';
                    computedScores[p.id] = hierarchySums[key] || 0;
                }
            });
        }

        return { scores: computedScores, maxScore: max, totalMetric: total };
    }, [planogram, products, level, metric, propTotalMetric, hierarchyField]);


    // 2. 階層ブロック配置の計算 (Spatial Grouping)
    const hierarchyLayouts = useMemo(() => {
        if (level !== 'hierarchy') return [];

        const layouts: {
            id: string;
            name: string;
            shelfIndex: number;
            x: number;
            width: number;
            score: number;
        }[] = [];

        // shelves loop
        for (let i = 0; i < planogram.shelfCount; i++) {
            const shelfProducts = planogram.products
                .filter(p => p.shelfIndex === i)
                .sort((a, b) => a.positionX - b.positionX);

            if (shelfProducts.length === 0) continue;

            let currentGroup: {
                name: string;
                startX: number;
                currentX: number; // To track continuity gap
                score: number;
                width: number;
            } | null = null;

            shelfProducts.forEach((sp, index) => {
                const product = products.find(p => p.id === sp.productId);
                if (!product) return;

                const groupName = (product[hierarchyField || 'category'] as any) || '未設定';
                const productWidth = product.width * sp.faceCount;
                const productVal = (product[metric] as number) || 0;

                // 新しいグループの開始条件: 
                // 1. グループがない
                // 2. 名前が変わった
                // 3. (Optional) 物理的に離れている (Gap check could be added here if needed)
                if (!currentGroup || currentGroup.name !== groupName) {
                    // Save previous group
                    if (currentGroup) {
                        layouts.push({
                            id: `${i}-${currentGroup.startX}-${currentGroup.name}`,
                            shelfIndex: i,
                            name: currentGroup.name,
                            x: currentGroup.startX,
                            width: currentGroup.width,
                            score: currentGroup.score
                        });
                    }

                    // Start new group
                    currentGroup = {
                        name: groupName,
                        startX: sp.positionX,
                        currentX: sp.positionX + productWidth,
                        score: productVal,
                        width: productWidth
                    };
                } else {
                    // Continue group
                    // 隙間がある場合は埋めるか、厳密にするか。ここでは「棚ブロック的」に埋めるアプローチをとる
                    // widthは (現在の商品のEnd - グループのStart) で計算し直す（隙間込み）
                    const currentEnd = sp.positionX + productWidth;
                    currentGroup.width = currentEnd - currentGroup.startX;
                    currentGroup.score += productVal;
                    currentGroup.currentX = currentEnd;
                }

                // Last item check
                if (index === shelfProducts.length - 1 && currentGroup) {
                    layouts.push({
                        id: `${i}-${currentGroup.startX}-${currentGroup.name}`,
                        shelfIndex: i,
                        name: currentGroup.name,
                        x: currentGroup.startX,
                        width: currentGroup.width,
                        score: currentGroup.score
                    });
                }
            });
        }

        return layouts;
    }, [planogram, products, level, metric, hierarchyField]);

    // Calculate max score for hierarchy blocks to color them
    const maxHierarchyBlockScore = useMemo(() => {
        if (hierarchyLayouts.length === 0) return 0;
        return Math.max(...hierarchyLayouts.map(l => l.score));
    }, [hierarchyLayouts]);


    // ブロック配置の計算 (Original ShelfBlock Logic)
    const blockLayouts = useMemo(() => {
        if (!('blocks' in planogram) || !shelfBlocks.length) return [];
        // StorePlanogramでもVisualizerにお膳立てされたblocksがあれば利用可能 (Analytics.tsx側で対応済み)

        // 型安全のためキャスト
        const blocksSource = (planogram as any).blocks as StandardPlanogramBlock[];
        if (!blocksSource) return [];

        const layouts: {
            id: string; // planogramBlockId
            name: string;
            x: number;
            width: number;
            score: number;
        }[] = [];

        blocksSource.forEach(pb => {
            const blockMaster = shelfBlocks.find(b => b.id === pb.blockId);
            if (!blockMaster) return;

            // ブロック内の商品の合計値を計算
            let blockTotal = 0;
            const startX = pb.positionX;
            const endX = pb.positionX + blockMaster.width;

            planogram.products.forEach(p => {
                const product = products.find(pr => pr.id === p.productId);
                if (!product) return;

                // 中心点がブロック内にあるか
                const productCenter = p.positionX + (product.width * p.faceCount / 2);
                if (productCenter >= startX && productCenter < endX) {
                    blockTotal += ((product[metric] as number) || 0);
                }
            });

            layouts.push({
                id: pb.id,
                name: blockMaster.name,
                x: pb.positionX,
                width: blockMaster.width,
                score: blockTotal
            });
        });

        return layouts;
    }, [planogram, shelfBlocks, products, metric]);

    const maxBlockScore = useMemo(() => {
        if (blockLayouts.length === 0) return 0;
        return Math.max(...blockLayouts.map(b => b.score));
    }, [blockLayouts]);


    return (
        <div
            style={{
                background: 'var(--bg-primary)',
                border: '2px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                overflow: 'auto',
                position: 'relative'
            }}
        >
            {/* Planogram Level Overlay */}
            {level === 'planogram' && (
                <div style={{ position: 'absolute', top: '1rem', left: '1rem', width: `${planogram.width * SCALE}px`, height: `${planogram.height * SCALE}px`, pointerEvents: 'none', zIndex: 10 }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(255, 255, 255, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.95)',
                            padding: '1.5rem',
                            borderRadius: '1rem',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            textAlign: 'center',
                            border: '2px solid var(--color-primary)'
                        }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>棚割全体</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                                {formatMetricValue(totalMetric)}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>100%</div>
                        </div>
                    </div>
                </div>
            )}


            {/* Block Overlay (Under products but above background) */}
            {level === 'block' && blockLayouts.length > 0 && (
                <div style={{ position: 'absolute', top: '1rem', left: '1rem', width: `${planogram.width * SCALE}px`, height: `${planogram.height * SCALE}px`, pointerEvents: 'none', zIndex: 5 }}>
                    {blockLayouts.map(block => (
                        <div
                            key={block.id}
                            style={{
                                position: 'absolute',
                                left: `${block.x * SCALE}px`,
                                top: 0,
                                bottom: 0,
                                width: `${block.width * SCALE}px`,
                                backgroundColor: calculateHeatmapColor(block.score, maxBlockScore),
                                border: '2px dashed rgba(0,0,0,0.3)',
                                display: 'flex',
                                alignItems: 'start',
                                justifyContent: 'center',
                                paddingTop: '10px'
                            }}
                        >
                            <div style={{
                                background: 'rgba(255,255,255,0.9)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                                <div>{block.name}</div>
                                <div style={{ fontSize: '14px', color: 'var(--color-primary)' }}>{formatMetricValue(block.score)}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    {totalMetric > 0 ? (block.score / totalMetric * 100).toFixed(1) + '%' : '-'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div
                className="shelf-grid"
                style={{
                    width: `${planogram.width * SCALE}px`,
                    minHeight: `${planogram.height * SCALE}px`,
                    position: 'relative',
                    zIndex: 1
                }}
            >
                {/* Rows */}
                {Array.from({ length: planogram.shelfCount }).map((_, shelfIndex) => {
                    const shelfProducts = planogram.products.filter(p => p.shelfIndex === shelfIndex);

                    // Render Hierarchy Overlay for this shelf (if applied)
                    const shelfHierarchyBlocks = hierarchyLayouts.filter(l => l.shelfIndex === shelfIndex);

                    return (
                        <div
                            key={shelfIndex}
                            className="shelf-row"
                            style={{
                                height: `${Math.max(60, (planogram.height / planogram.shelfCount) * SCALE)}px`,
                                position: 'relative',
                                borderBottom: '1px solid var(--border-color)'
                            }}
                        >
                            {/* Hierarchy Blocks Overlay (Inside the shelf) */}
                            {level === 'hierarchy' && shelfHierarchyBlocks.map(block => (
                                <div key={block.id}
                                    style={{
                                        position: 'absolute',
                                        left: `${block.x * SCALE}px`,
                                        top: 0,
                                        bottom: 0,
                                        width: `${block.width * SCALE}px`,
                                        backgroundColor: calculateHeatmapColor(block.score, maxHierarchyBlockScore),
                                        zIndex: 3, // Above products (which will be faded)
                                        border: '1px solid rgba(255,255,255,0.5)',
                                        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: 0.9
                                    }}
                                >
                                    <div style={{
                                        background: 'rgba(255,255,255,0.95)',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        textAlign: 'center',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                        minWidth: '60px'
                                    }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>{block.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 800 }}>
                                            {formatMetricValue(block.score)}
                                        </div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                            {totalMetric > 0 ? (block.score / totalMetric * 100).toFixed(1) + '%' : '-'}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Shelf Index Label */}
                            <div style={{
                                position: 'absolute',
                                left: '-30px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)'
                            }}>
                                {shelfIndex + 1}
                            </div>

                            {shelfProducts.map(sp => {
                                const product = products.find(p => p.id === sp.productId);
                                if (!product) return null;
                                const width = product.width * sp.faceCount * SCALE;

                                // Visuals
                                let bgColor = 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))';
                                let showBadge = false;
                                let badgeValue = '';

                                if (level === 'jan') {
                                    const score = scores[sp.id] || 0;
                                    bgColor = calculateHeatmapColor(score, maxScore);
                                    showBadge = true;
                                    badgeValue = formatMetricValue(score);
                                } else if (level === 'hierarchy') {
                                    // Faded out, just showing presence
                                    bgColor = 'rgba(200, 200, 200, 0.2)';
                                } else if (level === 'block') {
                                    bgColor = 'rgba(255, 255, 255, 0.4)'; // More transparent
                                }

                                return (
                                    <div
                                        key={sp.id}
                                        style={{
                                            position: 'absolute',
                                            left: `${sp.positionX * SCALE}px`,
                                            top: 0,
                                            bottom: 0,
                                            width: `${width}px`,
                                            background: bgColor,
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-sm)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '2px',
                                            fontSize: '0.6rem',
                                            overflow: 'hidden',
                                            // Fade out individual products when in aggregated modes
                                            opacity: (level === 'block' || level === 'planogram' || level === 'hierarchy') ? 0.3 : 1
                                        }}
                                        title={`${product.name}`}
                                    >
                                        <div style={{
                                            fontWeight: 500,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            width: '100%',
                                            textAlign: 'center',
                                            lineHeight: 1.2
                                        }}>
                                            {product.name}
                                        </div>

                                        {sp.faceCount > 1 && (
                                            <div style={{
                                                fontSize: '0.6rem', // Size up slightly
                                                fontWeight: 'bold',
                                                zIndex: 2,
                                                marginBottom: '1px',
                                                background: 'rgba(255,255,255,0.7)',
                                                borderRadius: '2px',
                                                padding: '0 2px'
                                            }}>
                                                x{sp.faceCount}
                                            </div>
                                        )}

                                        {showBadge && level === 'jan' && (
                                            <div style={{
                                                background: 'rgba(0,0,0,0.6)',
                                                color: 'white',
                                                padding: '1px 4px',
                                                borderRadius: '3px',
                                                fontSize: '0.55rem',
                                                marginTop: '2px'
                                            }}>
                                                {badgeValue}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
