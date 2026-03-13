import { useState, useCallback, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';

interface ProductTooltipProps {
    productName: string;
    jan: string;
    faceCount: number;
    category?: string;
    children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}

// ツールチップの推定高さ（4行分: 商品名 + JAN + フェース数 + 品種）
const TOOLTIP_HEIGHT = 90;

export function ProductTooltip({ productName, jan, faceCount, category, children }: ProductTooltipProps) {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0, showBelow: false });

    const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        // 上に十分なスペースがない場合は下に表示
        const showBelow = rect.top < TOOLTIP_HEIGHT + 16;
        setPosition({
            x: centerX,
            y: showBelow ? rect.bottom : rect.top,
            showBelow
        });
        setVisible(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setVisible(false);
    }, []);

    if (!isValidElement(children)) return children;

    const child = cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            handleMouseEnter(e);
            children.props.onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
            handleMouseLeave();
            children.props.onMouseLeave?.(e);
        },
    });

    return (
        <>
            {child}
            {visible && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        transform: position.showBelow
                            ? 'translate(-50%, 8px)'
                            : 'translate(-50%, -100%) translateY(-8px)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        color: '#fff',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        lineHeight: 1.6,
                        whiteSpace: 'nowrap',
                        zIndex: 9999,
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: '1px' }}>{productName}</div>
                    <div style={{ fontFamily: 'monospace', opacity: 0.9, fontSize: '0.7rem' }}>JAN: {jan || '-'}</div>
                    <div style={{ opacity: 0.9 }}>フェース数: ×{faceCount}</div>
                    {category && <div style={{ opacity: 0.7, fontSize: '0.65rem', marginTop: '2px' }}>品種: {category}</div>}
                    {/* 三角矢印 */}
                    <div
                        style={{
                            position: 'absolute',
                            [position.showBelow ? 'top' : 'bottom']: '-4px',
                            left: '50%',
                            transform: 'translateX(-50%) rotate(45deg)',
                            width: '8px',
                            height: '8px',
                            background: 'rgba(15, 23, 42, 0.95)',
                        }}
                    />
                </div>,
                document.body
            )}
        </>
    );
}
