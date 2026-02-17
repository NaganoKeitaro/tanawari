// Product Hierarchy Data Types

export interface HierarchyEntry {
  id: string;
  divisionCode: string;
  divisionName: string;
  divisionSubCode: string;
  divisionSubName: string;
  lineCode: string;
  lineName: string;
  departmentCode: string;
  departmentName: string;
  categoryCode: string;
  categoryName: string;
  subCategoryCode: string;
  subCategoryName: string;
  segmentCode: string;
  segmentName: string;
  subSegmentCode: string;
  subSegmentName: string;
  createdAt: string;
  updatedAt: string;
}

export type HierarchyLevel = 
  | 'division' 
  | 'divisionSub' 
  | 'line' 
  | 'department' 
  | 'category' 
  | 'subCategory' 
  | 'segment' 
  | 'subSegment';

export const HIERARCHY_HEADERS = [
  '事業部CD', '事業部名',
  'ディビジョンCD', 'ディビジョン名',
  'ラインCD', 'ライン名',
  '部門CD', '部門名',
  'カテゴリーCD', 'カテゴリー名',
  'サブカテゴリーCD', 'サブカテゴリー名',
  'セグメントCD', 'セグメント名',
  'サブセグメントCD', 'サブセグメント名'
];

export const HIERARCHY_KEYS: (keyof HierarchyEntry)[] = [
  'divisionCode', 'divisionName',
  'divisionSubCode', 'divisionSubName',
  'lineCode', 'lineName',
  'departmentCode', 'departmentName',
  'categoryCode', 'categoryName',
  'subCategoryCode', 'subCategoryName',
  'segmentCode', 'segmentName',
  'subSegmentCode', 'subSegmentName'
];
