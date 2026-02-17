import * as XLSX from 'xlsx';
import type { HierarchyEntry } from '../data/types/productHierarchy';
import { HIERARCHY_HEADERS, HIERARCHY_KEYS } from '../data/types/productHierarchy';

export function generateHierarchyTemplate(): Blob {
    const headers = HIERARCHY_HEADERS;
    const sampleRow = [
        'D001', '食品事業部',
        'DV001', '生鮮ディビジョン',
        'L001', '精肉ライン',
        'DP001', '国産牛部門',
        'C001', '焼肉セット',
        'SC001', 'プレミアム',
        'S001', 'A5ランク',
        'SS001', '黒毛和牛'
    ];

    const wsData = [headers, sampleRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = headers.map(() => ({ wch: 15 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '商品階層');

    const csvData = XLSX.write(wb, { bookType: 'csv', type: 'string' });
    const bom = '\uFEFF';

    return new Blob([bom + csvData], {
        type: 'text/csv;charset=utf-8;'
    });
}

export function mapRowToHierarchyEntry(row: any): Omit<HierarchyEntry, 'id' | 'createdAt' | 'updatedAt'> {
    const entry: any = {};

    HIERARCHY_HEADERS.forEach((header, index) => {
        const key = HIERARCHY_KEYS[index];
        entry[key] = row[header] ? String(row[header]).trim() : '';
    });

    return entry as Omit<HierarchyEntry, 'id' | 'createdAt' | 'updatedAt'>;
}

export function validateHierarchyEntry(entry: Omit<HierarchyEntry, 'id' | 'createdAt' | 'updatedAt'>, rowIndex: number): string[] {
    const errors: string[] = [];

    // Check required fields (at least Division Code and Name should be present)
    if (!entry.divisionCode) errors.push(`Row ${rowIndex + 1}: 事業部CD is required`);
    if (!entry.divisionName) errors.push(`Row ${rowIndex + 1}: 事業部名 is required`);

    return errors;
}
