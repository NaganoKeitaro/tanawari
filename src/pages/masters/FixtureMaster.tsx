// 棚割管理システム - 棚マスタ（什器マスタ）
import { useState, useEffect, useCallback } from 'react';
import type { Fixture } from '../../data/types';
import { fixtureRepository } from '../../data/repositories/localStorageRepository';
import { Modal } from '../../components/common/Modal';
import { UnitInput } from '../../components/common/UnitInput';
import { UnitDisplay } from '../../components/common/UnitDisplay';

interface FixtureFormData {
    name: string;
    width: number;
    height: number;
    shelfCount: number;
    manufacturer: string;
    modelNumber: string;
    installDate: string;
    warrantyEndDate: string;
}

const initialFormData: FixtureFormData = {
    name: '',
    width: 90,
    height: 180,
    shelfCount: 5,
    manufacturer: '',
    modelNumber: '',
    installDate: '',
    warrantyEndDate: ''
};

export function FixtureMaster() {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFixture, setEditingFixture] = useState<Fixture | null>(null);
    const [formData, setFormData] = useState<FixtureFormData>(initialFormData);

    // データ読み込み
    const loadFixtures = useCallback(async () => {
        setLoading(true);
        const data = await fixtureRepository.getAll();
        setFixtures(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadFixtures();
    }, [loadFixtures]);

    // モーダルを開く
    const openModal = (fixture?: Fixture) => {
        if (fixture) {
            setEditingFixture(fixture);
            setFormData({
                name: fixture.name,
                width: fixture.width,
                height: fixture.height,
                shelfCount: fixture.shelfCount,
                manufacturer: fixture.manufacturer || '',
                modelNumber: fixture.modelNumber || '',
                installDate: fixture.installDate || '',
                warrantyEndDate: fixture.warrantyEndDate || ''
            });
        } else {
            setEditingFixture(null);
            setFormData(initialFormData);
        }
        setIsModalOpen(true);
    };

    // 保存処理
    const handleSave = async () => {
        if (!formData.name) {
            alert('什器名は必須です');
            return;
        }

        if (editingFixture) {
            await fixtureRepository.update(editingFixture.id, formData);
        } else {
            await fixtureRepository.create(formData);
        }

        setIsModalOpen(false);
        loadFixtures();
    };

    // 削除処理
    const handleDelete = async (id: string) => {
        if (confirm('この什器を削除しますか？')) {
            await fixtureRepository.delete(id);
            loadFixtures();
        }
    };

    // 保証期限チェック
    const getWarrantyStatus = (warrantyEndDate?: string) => {
        if (!warrantyEndDate) return null;
        const today = new Date();
        const warranty = new Date(warrantyEndDate);
        const daysRemaining = Math.ceil((warranty.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
            return { status: 'expired', label: '期限切れ', color: 'var(--color-danger)' };
        } else if (daysRemaining < 90) {
            return { status: 'warning', label: `残り${daysRemaining}日`, color: 'var(--color-warning)' };
        } else {
            return { status: 'ok', label: '有効', color: 'var(--color-success)' };
        }
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <h1 className="page-title">棚マスタ（什器マスタ）</h1>
                <p className="page-subtitle">棚什器のサイズ・段数・メーカー情報を管理</p>
            </div>

            {/* ツールバー */}
            <div className="card mb-lg">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted">
                        登録什器数: {fixtures.length} 件
                    </div>
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        ＋ 新規登録
                    </button>
                </div>
            </div>

            {/* 什器一覧 */}
            <div className="card">
                {loading ? (
                    <div className="text-center text-muted animate-pulse">読み込み中...</div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>什器名</th>
                                    <th>幅</th>
                                    <th>高さ</th>
                                    <th>段数</th>
                                    <th>メーカー / 型番</th>
                                    <th>設置日</th>
                                    <th>保証期限</th>
                                    <th style={{ width: '120px' }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fixtures.map(fixture => {
                                    const warrantyStatus = getWarrantyStatus(fixture.warrantyEndDate);
                                    return (
                                        <tr key={fixture.id}>
                                            <td>
                                                <div className="flex items-center gap-sm">
                                                    <span style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '32px',
                                                        height: '32px',
                                                        background: 'var(--bg-tertiary)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontSize: '1rem'
                                                    }}>
                                                        🗄️
                                                    </span>
                                                    <span>{fixture.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <UnitDisplay valueCm={fixture.width} className="text-sm" />
                                            </td>
                                            <td>
                                                <UnitDisplay valueCm={fixture.height} className="text-sm" />
                                            </td>
                                            <td>
                                                <span className="badge badge-primary">{fixture.shelfCount}段</span>
                                            </td>
                                            <td className="text-sm text-muted">
                                                {fixture.manufacturer && fixture.modelNumber
                                                    ? `${fixture.manufacturer} / ${fixture.modelNumber}`
                                                    : fixture.manufacturer || fixture.modelNumber || '-'}
                                            </td>
                                            <td className="text-sm text-muted">
                                                {fixture.installDate || '-'}
                                            </td>
                                            <td>
                                                {warrantyStatus ? (
                                                    <span
                                                        className="badge"
                                                        style={{
                                                            backgroundColor: `${warrantyStatus.color}20`,
                                                            color: warrantyStatus.color
                                                        }}
                                                    >
                                                        {warrantyStatus.label}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td>
                                                <div className="flex gap-sm">
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => openModal(fixture)}
                                                    >
                                                        編集
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDelete(fixture.id)}
                                                    >
                                                        削除
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {fixtures.length === 0 && (
                            <div className="text-center text-muted" style={{ padding: '2rem' }}>
                                什器が登録されていません
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 編集モーダル */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingFixture ? '什器編集' : '什器新規登録'}
                size="lg"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                            キャンセル
                        </button>
                        <button className="btn btn-primary" onClick={handleSave}>
                            保存
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">什器名 *</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="標準棚A"
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <UnitInput
                        label="幅 (W)"
                        value={formData.width}
                        onChange={(w) => setFormData({ ...formData, width: w })}
                        min={30}
                        max={300}
                    />
                    <UnitInput
                        label="高さ (H)"
                        value={formData.height}
                        onChange={(h) => setFormData({ ...formData, height: h })}
                        min={60}
                        max={300}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">段数</label>
                    <input
                        type="number"
                        className="form-input"
                        value={formData.shelfCount}
                        onChange={(e) => setFormData({ ...formData, shelfCount: parseInt(e.target.value) || 1 })}
                        min={1}
                        max={10}
                    />
                    <div className="form-hint">
                        1台の什器内の棚段数（1〜10）
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">メーカー</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.manufacturer}
                            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                            placeholder="メーカーA"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">型番</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.modelNumber}
                            onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                            placeholder="MODEL-001"
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">設置日</label>
                        <input
                            type="date"
                            className="form-input"
                            value={formData.installDate}
                            onChange={(e) => setFormData({ ...formData, installDate: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">保証期限</label>
                        <input
                            type="date"
                            className="form-input"
                            value={formData.warrantyEndDate}
                            onChange={(e) => setFormData({ ...formData, warrantyEndDate: e.target.value })}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
