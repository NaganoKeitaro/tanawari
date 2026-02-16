// 棚割管理システム - アプリレイアウト
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

interface AppLayoutProps {
    children: ReactNode;
}

interface NavItem {
    path: string;
    label: string;
    icon: string;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

const navSections: NavSection[] = [
    {
        title: 'ダッシュボード',
        items: [
            { path: '/', label: 'ホーム', icon: '🏠' },
            { path: '/dashboard', label: '分析ダッシュボード', icon: '📊' },
            { path: '/analytics', label: '詳細分析', icon: '📈' }
        ]
    },
    {
        title: 'マスタ管理',
        items: [
            { path: '/masters/products', label: '商品マスタ', icon: '📦' },
            { path: '/masters/fixtures', label: '棚マスタ', icon: '🗄️' },
            { path: '/masters/stores', label: '店舗マスタ', icon: '🏪' },
            { path: '/masters/store-fixtures', label: '店舗棚尺マスタ', icon: '📐' }
        ]
    },
    {
        title: '棚割管理',
        items: [
            { path: '/blocks', label: '棚ブロック管理', icon: '🧱' },
            { path: '/planogram/standard', label: 'FMT標準棚割', icon: '📋' },
            { path: '/planogram/store', label: '個店棚割管理', icon: '🏬' },
            { path: '/instruction-sheet', label: '棚割指示書', icon: '📄' }
        ]
    },
    {
        title: 'データ管理',
        items: [
            { path: '/bulk-delete', label: 'データ一括削除', icon: '🗑️' }
        ]
    }
];

export function AppLayout({ children }: AppLayoutProps) {
    // const location = useLocation();

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">棚割管理システム</div>
                    <div className="text-xs text-muted mt-sm">Planogram System MVP</div>
                </div>
                <nav className="sidebar-nav">
                    {navSections.map((section) => (
                        <div key={section.title} className="nav-section">
                            <div className="nav-section-title">{section.title}</div>
                            {section.items.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `nav-link ${isActive ? 'active' : ''}`
                                    }
                                >
                                    <span>{item.icon}</span>
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
