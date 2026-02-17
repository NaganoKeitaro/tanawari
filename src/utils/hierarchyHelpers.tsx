// 階層表示用のヘルパー関数
import type { JSX } from 'react';

export function countProductsInHierarchy(obj: any): number {
    if (Array.isArray(obj)) {
        return obj.length;
    }
    let count = 0;
    for (const key in obj) {
        count += countProductsInHierarchy(obj[key]);
    }
    return count;
}

export function renderHierarchyLevel(
    data: any,
    level: number,
    parentKey: string,
    expandedGroups: Set<string>,
    toggleGroup: (key: string) => void,
    selectedIds: Set<string>,
    toggleSelect: (id: string) => void,
    getRankColor: (rank: number) => string,
    openModal: (product: any) => void
): JSX.Element[] {
    const levelIcons = ['📁', '📂', '📋', '📊', '📈', '📉', '📄', '📌'];

    return Object.entries(data).map(([key, value]) => {
        const nodeKey = `${parentKey}-${level}-${key}`;
        const isExpanded = expandedGroups.has(nodeKey);
        const isProductArray = Array.isArray(value);
        const count = countProductsInHierarchy(value);
        const icon = levelIcons[level] || '📄';

        if (isProductArray) {
            // 最下層：商品リスト
            const products = value as any[];

            return (
                <div key={nodeKey} style={{ marginBottom: '0.5rem' }}>
                    <div
                        onClick={() => toggleGroup(nodeKey)}
                        style={{
                            padding: '0.5rem',
                            background: 'var(--bg-primary)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem',
                            paddingLeft: `${level * 1.5 + 0.5}rem`
                        }}
                    >
                        <span>{isExpanded ? '▼' : '▶'}</span>
                        <span>{icon} {key}</span>
                        <span className="badge badge-secondary" style={{ marginLeft: 'auto' }}>{count}件</span>
                    </div>

                    {isExpanded && (
                        <div style={{ paddingLeft: `${level * 1.5 + 2}rem`, marginTop: '0.5rem' }}>
                            <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '0.25rem', textAlign: 'left', width: '40px' }}>
                                            <input type="checkbox" />
                                        </th>
                                        <th style={{ padding: '0.25rem', textAlign: 'left', width: '50px' }}>ランク</th>
                                        <th style={{ padding: '0.25rem', textAlign: 'left' }}>JAN</th>
                                        <th style={{ padding: '0.25rem', textAlign: 'left' }}>商品名</th>
                                        <th style={{ padding: '0.25rem', textAlign: 'right' }}>売上数量</th>
                                        <th style={{ padding: '0.25rem', textAlign: 'left' }}>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map(product => (
                                        <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.25rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(product.id)}
                                                    onChange={() => toggleSelect(product.id)}
                                                />
                                            </td>
                                            <td style={{ padding: '0.25rem' }}>
                                                <span
                                                    className="badge"
                                                    style={{
                                                        background: getRankColor(product.salesRank),
                                                        color: 'white',
                                                        fontSize: '0.75rem'
                                                    }}
                                                >
                                                    {product.salesRank}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                                                {product.jan ? product.jan : (
                                                    <span className="badge" style={{ background: 'var(--color-warning)', color: 'white', fontSize: '0.7rem' }}>JANなし</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.25rem' }}>{product.name}</td>
                                            <td style={{ padding: '0.25rem', textAlign: 'right' }}>
                                                {product.salesQuantity?.toLocaleString() || '-'}
                                            </td>
                                            <td style={{ padding: '0.25rem' }}>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => openModal(product)}
                                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                                >
                                                    編集
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            );
        } else {
            // 中間階層
            return (
                <div key={nodeKey} style={{ marginBottom: '0.75rem' }}>
                    <div
                        onClick={() => toggleGroup(nodeKey)}
                        style={{
                            padding: '0.5rem',
                            background: level === 0 ? 'var(--bg-secondary)' : 'var(--bg-hover)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: level === 0 ? 'bold' : 'normal',
                            paddingLeft: `${level * 1.5 + 0.5}rem`
                        }}
                    >
                        <span>{isExpanded ? '▼' : '▶'}</span>
                        <span>{icon} {key}</span>
                        <span className="badge" style={{ marginLeft: 'auto' }}>{count}件</span>
                    </div>

                    {isExpanded && (
                        <div style={{ marginTop: '0.5rem' }}>
                            {renderHierarchyLevel(
                                value,
                                level + 1,
                                nodeKey,
                                expandedGroups,
                                toggleGroup,
                                selectedIds,
                                toggleSelect,
                                getRankColor,
                                openModal
                            )}
                        </div>
                    )}
                </div>
            );
        }
    });
}
