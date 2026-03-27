// ダミーデータ投入スクリプト（ローカル環境専用）
// 店舗3パターン: 大(多段80尺+平台40尺) / 中(多段60尺+平台24尺) / 小(多段40尺+平台16尺)
// 本番環境（Supabase）には影響しない

import type {
    Product,
    Fixture,
    StoreFixturePlacement,
    ShelfBlock,
    ProductPlacement,
    StandardPlanogramBlock,
    StandardPlanogramProduct,
} from './types';
import { SHAKU_TO_MM } from './types';
import {
    productRepository,
    storeRepository,
    fixtureRepository,
    storeFixturePlacementRepository,
    shelfBlockRepository,
    standardPlanogramRepository,
    clearAllData,
    setInitialized,
} from './repositories/repositoryFactory';
import { generateStorePlanogram } from '../services/automationService';

// ========================================
// 商品マスタ定義
// ========================================

interface ProductDef {
    name: string;
    jan: string;
    width: number;
    height: number;
    depth: number;
    departmentName: string;
    category: string;
    salesRank: number;
    sales?: number;
    quantity?: number;
    grossProfit?: number;
}

const PRODUCT_DEFS: ProductDef[] = [
    // ── 牛肉（20商品） ──
    { name: '国産牛切り落とし', jan: '4901001000001', width: 120, height: 40, depth: 180, departmentName: '牛肉', category: '牛切り落とし', salesRank: 1, sales: 980000, quantity: 1200, grossProfit: 294000 },
    { name: '国産牛こま切れ', jan: '4901001000002', width: 120, height: 40, depth: 180, departmentName: '牛肉', category: '牛こま切れ', salesRank: 3, sales: 850000, quantity: 1050, grossProfit: 255000 },
    { name: '和牛サーロインステーキ', jan: '4901001000003', width: 150, height: 40, depth: 200, departmentName: '牛肉', category: '牛ステーキ', salesRank: 8, sales: 720000, quantity: 380, grossProfit: 252000 },
    { name: '国産牛カルビ焼肉用', jan: '4901001000004', width: 140, height: 40, depth: 190, departmentName: '牛肉', category: '牛焼肉', salesRank: 5, sales: 800000, quantity: 620, grossProfit: 240000 },
    { name: '国産牛もも薄切り', jan: '4901001000005', width: 120, height: 40, depth: 180, departmentName: '牛肉', category: '牛薄切り', salesRank: 10, sales: 650000, quantity: 880, grossProfit: 195000 },
    { name: '黒毛和牛ロースしゃぶしゃぶ', jan: '4901001000006', width: 150, height: 40, depth: 200, departmentName: '牛肉', category: '牛しゃぶ', salesRank: 12, sales: 580000, quantity: 320, grossProfit: 203000 },
    { name: '国産牛すじ', jan: '4901001000007', width: 100, height: 40, depth: 150, departmentName: '牛肉', category: '牛すじ', salesRank: 18, sales: 420000, quantity: 680, grossProfit: 126000 },
    { name: '国産牛バラ薄切り', jan: '4901001000008', width: 120, height: 40, depth: 180, departmentName: '牛肉', category: '牛バラ', salesRank: 7, sales: 750000, quantity: 920, grossProfit: 225000 },
    { name: '和牛ヒレステーキ', jan: '4901001000009', width: 130, height: 40, depth: 180, departmentName: '牛肉', category: '牛ステーキ', salesRank: 15, sales: 520000, quantity: 180, grossProfit: 208000 },
    { name: '国産牛ミンチ', jan: '4901001000010', width: 100, height: 40, depth: 150, departmentName: '牛肉', category: '牛ミンチ', salesRank: 6, sales: 780000, quantity: 1100, grossProfit: 234000 },
    { name: '国産牛ロースすき焼き用', jan: '4901001000011', width: 150, height: 40, depth: 200, departmentName: '牛肉', category: '牛すき焼き', salesRank: 9, sales: 680000, quantity: 450, grossProfit: 238000 },
    { name: '国産牛タン塩', jan: '4901001000012', width: 120, height: 40, depth: 180, departmentName: '牛肉', category: '牛タン', salesRank: 4, sales: 820000, quantity: 550, grossProfit: 287000 },
    { name: '交雑牛肩ロース', jan: '4901001000013', width: 140, height: 40, depth: 190, departmentName: '牛肉', category: '牛肩ロース', salesRank: 14, sales: 540000, quantity: 380, grossProfit: 162000 },
    { name: 'USビーフ肩ロース', jan: '4901001000014', width: 130, height: 40, depth: 180, departmentName: '牛肉', category: '輸入牛', salesRank: 2, sales: 920000, quantity: 1400, grossProfit: 184000 },
    { name: '豪州産牛モモステーキ', jan: '4901001000015', width: 130, height: 40, depth: 180, departmentName: '牛肉', category: '輸入牛', salesRank: 11, sales: 600000, quantity: 700, grossProfit: 120000 },
    { name: '国産牛ハラミ', jan: '4901001000016', width: 120, height: 40, depth: 180, departmentName: '牛肉', category: '牛ハラミ', salesRank: 13, sales: 560000, quantity: 420, grossProfit: 196000 },
    { name: '和牛カタ焼肉用', jan: '4901001000017', width: 140, height: 40, depth: 190, departmentName: '牛肉', category: '牛焼肉', salesRank: 16, sales: 500000, quantity: 350, grossProfit: 175000 },
    { name: '国産牛レバー', jan: '4901001000018', width: 100, height: 40, depth: 150, departmentName: '牛肉', category: '牛内臓', salesRank: 25, sales: 300000, quantity: 400, grossProfit: 105000 },
    { name: '和牛リブロースしゃぶ', jan: '4901001000019', width: 150, height: 40, depth: 200, departmentName: '牛肉', category: '牛しゃぶ', salesRank: 20, sales: 400000, quantity: 220, grossProfit: 160000 },
    { name: '国産牛テール', jan: '4901001000020', width: 100, height: 40, depth: 150, departmentName: '牛肉', category: '牛テール', salesRank: 30, sales: 200000, quantity: 150, grossProfit: 80000 },
    // ── 豚肉（20商品） ──
    { name: '国産豚こま切れ', jan: '4902001000001', width: 120, height: 40, depth: 180, departmentName: '豚肉', category: '豚こま', salesRank: 1, sales: 1200000, quantity: 2500, grossProfit: 360000 },
    { name: '国産豚バラ薄切り', jan: '4902001000002', width: 120, height: 40, depth: 180, departmentName: '豚肉', category: '豚バラ', salesRank: 2, sales: 1100000, quantity: 2200, grossProfit: 330000 },
    { name: '国産豚ロース薄切り', jan: '4902001000003', width: 120, height: 40, depth: 180, departmentName: '豚肉', category: '豚ロース', salesRank: 4, sales: 900000, quantity: 1800, grossProfit: 270000 },
    { name: '国産豚モモ薄切り', jan: '4902001000004', width: 120, height: 40, depth: 180, departmentName: '豚肉', category: '豚モモ', salesRank: 6, sales: 750000, quantity: 1500, grossProfit: 225000 },
    { name: '国産豚ミンチ', jan: '4902001000005', width: 100, height: 40, depth: 150, departmentName: '豚肉', category: '豚ミンチ', salesRank: 3, sales: 950000, quantity: 2000, grossProfit: 285000 },
    { name: '国産豚ロースとんかつ用', jan: '4902001000006', width: 130, height: 40, depth: 180, departmentName: '豚肉', category: '豚とんかつ', salesRank: 5, sales: 800000, quantity: 1200, grossProfit: 280000 },
    { name: '国産豚肩ロース', jan: '4902001000007', width: 130, height: 40, depth: 180, departmentName: '豚肉', category: '豚肩ロース', salesRank: 7, sales: 700000, quantity: 1000, grossProfit: 210000 },
    { name: '国産豚バラブロック', jan: '4902001000008', width: 140, height: 40, depth: 190, departmentName: '豚肉', category: '豚ブロック', salesRank: 10, sales: 550000, quantity: 650, grossProfit: 165000 },
    { name: '国産豚ヒレ', jan: '4902001000009', width: 110, height: 40, depth: 160, departmentName: '豚肉', category: '豚ヒレ', salesRank: 12, sales: 480000, quantity: 500, grossProfit: 168000 },
    { name: '国産豚スペアリブ', jan: '4902001000010', width: 150, height: 40, depth: 200, departmentName: '豚肉', category: '豚スペアリブ', salesRank: 15, sales: 380000, quantity: 300, grossProfit: 133000 },
    { name: '国産豚しゃぶしゃぶ用', jan: '4902001000011', width: 120, height: 40, depth: 180, departmentName: '豚肉', category: '豚しゃぶ', salesRank: 8, sales: 650000, quantity: 900, grossProfit: 227500 },
    { name: '国産豚生姜焼き用', jan: '4902001000012', width: 130, height: 40, depth: 180, departmentName: '豚肉', category: '豚生姜焼き', salesRank: 9, sales: 600000, quantity: 850, grossProfit: 210000 },
    { name: '国産豚レバー', jan: '4902001000013', width: 100, height: 40, depth: 150, departmentName: '豚肉', category: '豚内臓', salesRank: 22, sales: 250000, quantity: 350, grossProfit: 87500 },
    { name: '国産豚タン', jan: '4902001000014', width: 100, height: 40, depth: 150, departmentName: '豚肉', category: '豚タン', salesRank: 20, sales: 280000, quantity: 300, grossProfit: 98000 },
    { name: '国産豚モモブロック', jan: '4902001000015', width: 140, height: 40, depth: 190, departmentName: '豚肉', category: '豚ブロック', salesRank: 14, sales: 400000, quantity: 450, grossProfit: 120000 },
    { name: '国産豚カタ切り落とし', jan: '4902001000016', width: 120, height: 40, depth: 180, departmentName: '豚肉', category: '豚切り落とし', salesRank: 11, sales: 500000, quantity: 750, grossProfit: 150000 },
    { name: '国産豚ロースブロック', jan: '4902001000017', width: 140, height: 40, depth: 190, departmentName: '豚肉', category: '豚ブロック', salesRank: 17, sales: 330000, quantity: 350, grossProfit: 115500 },
    { name: '国産豚ハツ', jan: '4902001000018', width: 100, height: 40, depth: 150, departmentName: '豚肉', category: '豚内臓', salesRank: 28, sales: 180000, quantity: 200, grossProfit: 63000 },
    { name: '国産豚トロ', jan: '4902001000019', width: 110, height: 40, depth: 160, departmentName: '豚肉', category: '豚トロ', salesRank: 13, sales: 450000, quantity: 500, grossProfit: 157500 },
    { name: '国産豚骨付き', jan: '4902001000020', width: 150, height: 40, depth: 200, departmentName: '豚肉', category: '豚骨付き', salesRank: 24, sales: 220000, quantity: 180, grossProfit: 77000 },
    // ── 鶏肉（15商品） ──
    { name: '国産鶏もも肉', jan: '4903001000001', width: 130, height: 40, depth: 180, departmentName: '鶏肉', category: '鶏もも', salesRank: 1, sales: 1300000, quantity: 3000, grossProfit: 390000 },
    { name: '国産鶏むね肉', jan: '4903001000002', width: 130, height: 40, depth: 180, departmentName: '鶏肉', category: '鶏むね', salesRank: 2, sales: 1100000, quantity: 2800, grossProfit: 330000 },
    { name: '国産鶏ささみ', jan: '4903001000003', width: 110, height: 40, depth: 160, departmentName: '鶏肉', category: '鶏ささみ', salesRank: 3, sales: 800000, quantity: 2000, grossProfit: 240000 },
    { name: '国産鶏手羽先', jan: '4903001000004', width: 120, height: 40, depth: 170, departmentName: '鶏肉', category: '鶏手羽', salesRank: 5, sales: 600000, quantity: 1200, grossProfit: 180000 },
    { name: '国産鶏手羽元', jan: '4903001000005', width: 120, height: 40, depth: 170, departmentName: '鶏肉', category: '鶏手羽', salesRank: 6, sales: 550000, quantity: 1100, grossProfit: 165000 },
    { name: '国産鶏ミンチ', jan: '4903001000006', width: 100, height: 40, depth: 150, departmentName: '鶏肉', category: '鶏ミンチ', salesRank: 4, sales: 700000, quantity: 1500, grossProfit: 210000 },
    { name: '国産鶏もも唐揚げ用', jan: '4903001000007', width: 120, height: 40, depth: 170, departmentName: '鶏肉', category: '鶏唐揚げ', salesRank: 7, sales: 500000, quantity: 900, grossProfit: 175000 },
    { name: '国産鶏レバー', jan: '4903001000008', width: 100, height: 40, depth: 150, departmentName: '鶏肉', category: '鶏内臓', salesRank: 14, sales: 250000, quantity: 400, grossProfit: 87500 },
    { name: '国産鶏砂肝', jan: '4903001000009', width: 100, height: 40, depth: 150, departmentName: '鶏肉', category: '鶏内臓', salesRank: 12, sales: 300000, quantity: 500, grossProfit: 105000 },
    { name: '国産鶏皮', jan: '4903001000010', width: 100, height: 40, depth: 150, departmentName: '鶏肉', category: '鶏皮', salesRank: 15, sales: 200000, quantity: 350, grossProfit: 70000 },
    { name: '国産鶏モモ切身', jan: '4903001000011', width: 120, height: 40, depth: 170, departmentName: '鶏肉', category: '鶏もも', salesRank: 8, sales: 480000, quantity: 800, grossProfit: 168000 },
    { name: '国産鶏ムネ切身', jan: '4903001000012', width: 120, height: 40, depth: 170, departmentName: '鶏肉', category: '鶏むね', salesRank: 9, sales: 450000, quantity: 750, grossProfit: 157500 },
    { name: '国産若鶏丸', jan: '4903001000013', width: 180, height: 60, depth: 250, departmentName: '鶏肉', category: '鶏丸', salesRank: 20, sales: 150000, quantity: 100, grossProfit: 52500 },
    { name: '国産鶏ぼんじり', jan: '4903001000014', width: 100, height: 40, depth: 150, departmentName: '鶏肉', category: '鶏ぼんじり', salesRank: 18, sales: 180000, quantity: 250, grossProfit: 63000 },
    { name: '国産鶏せせり', jan: '4903001000015', width: 100, height: 40, depth: 150, departmentName: '鶏肉', category: '鶏せせり', salesRank: 10, sales: 380000, quantity: 550, grossProfit: 133000 },
    // ── 加工（15商品） ──
    { name: 'あらびきウインナー', jan: '4904001000001', width: 80, height: 40, depth: 150, departmentName: '加工', category: 'ウインナー', salesRank: 1, sales: 900000, quantity: 3500, grossProfit: 315000 },
    { name: 'ポークウインナー', jan: '4904001000002', width: 80, height: 40, depth: 150, departmentName: '加工', category: 'ウインナー', salesRank: 3, sales: 700000, quantity: 2800, grossProfit: 245000 },
    { name: 'ロースハム', jan: '4904001000003', width: 90, height: 30, depth: 140, departmentName: '加工', category: 'ハム', salesRank: 4, sales: 650000, quantity: 2200, grossProfit: 227500 },
    { name: 'ベーコン', jan: '4904001000004', width: 90, height: 30, depth: 140, departmentName: '加工', category: 'ベーコン', salesRank: 2, sales: 800000, quantity: 3000, grossProfit: 280000 },
    { name: '合挽ミンチ', jan: '4904001000005', width: 110, height: 40, depth: 160, departmentName: '加工', category: '合挽', salesRank: 5, sales: 600000, quantity: 1500, grossProfit: 180000 },
    { name: 'ロースハムスライス', jan: '4904001000006', width: 80, height: 25, depth: 130, departmentName: '加工', category: 'ハム', salesRank: 7, sales: 500000, quantity: 1800, grossProfit: 175000 },
    { name: 'ボロニアソーセージ', jan: '4904001000007', width: 90, height: 40, depth: 150, departmentName: '加工', category: 'ソーセージ', salesRank: 10, sales: 380000, quantity: 1200, grossProfit: 133000 },
    { name: '生ハム', jan: '4904001000008', width: 80, height: 25, depth: 130, departmentName: '加工', category: '生ハム', salesRank: 8, sales: 450000, quantity: 1000, grossProfit: 180000 },
    { name: 'チョリソー', jan: '4904001000009', width: 80, height: 40, depth: 150, departmentName: '加工', category: 'ソーセージ', salesRank: 12, sales: 320000, quantity: 800, grossProfit: 112000 },
    { name: 'ミートボール', jan: '4904001000010', width: 90, height: 40, depth: 150, departmentName: '加工', category: 'ミートボール', salesRank: 6, sales: 550000, quantity: 1600, grossProfit: 192500 },
    { name: 'シャウエッセン', jan: '4904001000011', width: 80, height: 40, depth: 150, departmentName: '加工', category: 'ウインナー', salesRank: 9, sales: 420000, quantity: 1400, grossProfit: 147000 },
    { name: 'ハンバーグ', jan: '4904001000012', width: 120, height: 30, depth: 170, departmentName: '加工', category: 'ハンバーグ', salesRank: 11, sales: 350000, quantity: 700, grossProfit: 122500 },
    { name: 'パストラミ', jan: '4904001000013', width: 80, height: 25, depth: 130, departmentName: '加工', category: 'パストラミ', salesRank: 18, sales: 200000, quantity: 400, grossProfit: 80000 },
    { name: '焼豚', jan: '4904001000014', width: 100, height: 40, depth: 160, departmentName: '加工', category: '焼豚', salesRank: 14, sales: 280000, quantity: 500, grossProfit: 98000 },
    { name: 'サラダチキン', jan: '4904001000015', width: 70, height: 30, depth: 140, departmentName: '加工', category: 'サラダチキン', salesRank: 13, sales: 300000, quantity: 900, grossProfit: 120000 },
    // ── MS（10商品） ──
    { name: '味付け牛カルビ', jan: '4905001000001', width: 130, height: 40, depth: 180, departmentName: 'MS', category: 'MS牛', salesRank: 2, sales: 700000, quantity: 800, grossProfit: 280000 },
    { name: '味付け豚ロース', jan: '4905001000002', width: 130, height: 40, depth: 180, departmentName: 'MS', category: 'MS豚', salesRank: 1, sales: 750000, quantity: 900, grossProfit: 300000 },
    { name: '味付け鶏もも', jan: '4905001000003', width: 120, height: 40, depth: 170, departmentName: 'MS', category: 'MS鶏', salesRank: 3, sales: 600000, quantity: 750, grossProfit: 240000 },
    { name: '味噌漬け豚ロース', jan: '4905001000004', width: 130, height: 40, depth: 180, departmentName: 'MS', category: 'MS豚', salesRank: 5, sales: 450000, quantity: 550, grossProfit: 180000 },
    { name: '塩麹チキン', jan: '4905001000005', width: 120, height: 40, depth: 170, departmentName: 'MS', category: 'MS鶏', salesRank: 4, sales: 500000, quantity: 650, grossProfit: 200000 },
    { name: '味付けホルモン', jan: '4905001000006', width: 120, height: 40, depth: 170, departmentName: 'MS', category: 'MSホルモン', salesRank: 7, sales: 350000, quantity: 450, grossProfit: 140000 },
    { name: 'プルコギ', jan: '4905001000007', width: 140, height: 40, depth: 190, departmentName: 'MS', category: 'MS牛', salesRank: 6, sales: 400000, quantity: 500, grossProfit: 160000 },
    { name: '味付けラム', jan: '4905001000008', width: 130, height: 40, depth: 180, departmentName: 'MS', category: 'MSラム', salesRank: 10, sales: 250000, quantity: 300, grossProfit: 100000 },
    { name: '味付け手羽先', jan: '4905001000009', width: 120, height: 40, depth: 170, departmentName: 'MS', category: 'MS鶏', salesRank: 8, sales: 320000, quantity: 400, grossProfit: 128000 },
    { name: '味付け豚ハラミ', jan: '4905001000010', width: 130, height: 40, depth: 180, departmentName: 'MS', category: 'MS豚', salesRank: 9, sales: 280000, quantity: 350, grossProfit: 112000 },
    // ── 焼肉/他（10商品） ──
    { name: '焼肉セット3種', jan: '4906001000001', width: 180, height: 40, depth: 220, departmentName: '焼肉/他', category: '焼肉セット', salesRank: 1, sales: 600000, quantity: 400, grossProfit: 240000 },
    { name: '焼肉セット5種', jan: '4906001000002', width: 200, height: 40, depth: 250, departmentName: '焼肉/他', category: '焼肉セット', salesRank: 3, sales: 450000, quantity: 250, grossProfit: 180000 },
    { name: 'BBQセット', jan: '4906001000003', width: 200, height: 40, depth: 250, departmentName: '焼肉/他', category: 'BBQ', salesRank: 5, sales: 350000, quantity: 200, grossProfit: 140000 },
    { name: 'すき焼きセット', jan: '4906001000004', width: 180, height: 40, depth: 220, departmentName: '焼肉/他', category: 'すき焼き', salesRank: 4, sales: 400000, quantity: 280, grossProfit: 160000 },
    { name: 'しゃぶしゃぶセット', jan: '4906001000005', width: 180, height: 40, depth: 220, departmentName: '焼肉/他', category: 'しゃぶしゃぶ', salesRank: 6, sales: 320000, quantity: 220, grossProfit: 128000 },
    { name: 'ジンギスカンセット', jan: '4906001000006', width: 160, height: 40, depth: 200, departmentName: '焼肉/他', category: 'ジンギスカン', salesRank: 8, sales: 220000, quantity: 150, grossProfit: 88000 },
    { name: '馬刺し', jan: '4906001000007', width: 100, height: 30, depth: 140, departmentName: '焼肉/他', category: '馬刺し', salesRank: 2, sales: 500000, quantity: 300, grossProfit: 250000 },
    { name: 'ラム肩ロース', jan: '4906001000008', width: 130, height: 40, depth: 180, departmentName: '焼肉/他', category: 'ラム', salesRank: 7, sales: 280000, quantity: 200, grossProfit: 112000 },
    { name: '鹿肉ステーキ', jan: '4906001000009', width: 120, height: 40, depth: 170, departmentName: '焼肉/他', category: 'ジビエ', salesRank: 12, sales: 150000, quantity: 80, grossProfit: 75000 },
    { name: '合鴨ロース', jan: '4906001000010', width: 110, height: 30, depth: 160, departmentName: '焼肉/他', category: '合鴨', salesRank: 10, sales: 180000, quantity: 120, grossProfit: 90000 },
];

// ========================================
// 店舗パターン定義
// ========================================

interface StorePattern {
    code: string;
    name: string;
    size: string;        // 表示用ラベル
    multiTierShaku: number;  // 多段の総尺数
    flatShaku: number;       // 平台の総尺数
    shelfCount: number;      // 多段の段数
}

const STORE_PATTERNS: StorePattern[] = [
    { code: 'TEST-L01', name: '大型テスト店舗A', size: '大', multiTierShaku: 80, flatShaku: 40, shelfCount: 5 },
    { code: 'TEST-L02', name: '大型テスト店舗B', size: '大', multiTierShaku: 72, flatShaku: 36, shelfCount: 5 },
    { code: 'TEST-M01', name: '中型テスト店舗A', size: '中', multiTierShaku: 60, flatShaku: 24, shelfCount: 5 },
    { code: 'TEST-M02', name: '中型テスト店舗B', size: '中', multiTierShaku: 48, flatShaku: 20, shelfCount: 4 },
    { code: 'TEST-S01', name: '小型テスト店舗A', size: '小', multiTierShaku: 40, flatShaku: 16, shelfCount: 4 },
    { code: 'TEST-S02', name: '小型テスト店舗B', size: '小', multiTierShaku: 32, flatShaku: 12, shelfCount: 3 },
];

// ========================================
// 標準棚割のブロック構成定義（基準=大型80尺）
// ========================================

interface BlockDef {
    name: string;
    dept: string;
    shaku: number;
    shelfCount: number;
}

// 多段ブロック（合計80尺 = 基準）
const BASE_MULTI_BLOCK_DEFS: BlockDef[] = [
    { name: '牛肉A', dept: '牛肉', shaku: 12, shelfCount: 5 },
    { name: '牛肉B', dept: '牛肉', shaku: 8, shelfCount: 5 },
    { name: '豚肉A', dept: '豚肉', shaku: 12, shelfCount: 5 },
    { name: '豚肉B', dept: '豚肉', shaku: 8, shelfCount: 5 },
    { name: '鶏肉', dept: '鶏肉', shaku: 12, shelfCount: 5 },
    { name: '加工A', dept: '加工', shaku: 8, shelfCount: 5 },
    { name: '加工B', dept: '加工', shaku: 4, shelfCount: 5 },
    { name: 'MS', dept: 'MS', shaku: 8, shelfCount: 5 },
    { name: '焼肉/他', dept: '焼肉/他', shaku: 8, shelfCount: 5 },
];
// 合計: 12+8+12+8+12+8+4+8+8 = 80尺

// 平台ブロック（合計40尺 = 基準）
const BASE_FLAT_BLOCK_DEFS: BlockDef[] = [
    { name: '平台-MS', dept: 'MS', shaku: 12, shelfCount: 1 },
    { name: '平台-加工', dept: '加工', shaku: 12, shelfCount: 1 },
    { name: '平台-焼肉セット', dept: '焼肉/他', shaku: 16, shelfCount: 1 },
];
// 合計: 12+12+16 = 40尺

// ========================================
// ヘルパー関数
// ========================================

/** ブロック定義を商品で埋めて ShelfBlock を作成 */
async function createFilledBlock(
    bDef: BlockDef,
    deptProducts: Product[],
    blockType: 'multi-tier' | 'flat',
    now: string,
): Promise<ShelfBlock> {
    const targetWidthMm = bDef.shaku * SHAKU_TO_MM;
    const placements: ProductPlacement[] = [];
    let globalIdx = 0;
    let actualMaxWidth = 0;

    for (let shelf = 0; shelf < bDef.shelfCount; shelf++) {
        let posX = 0;
        while (posX < targetWidthMm) {
            const prod = deptProducts[globalIdx % deptProducts.length];
            const remaining = targetWidthMm - posX;
            let faceCount = 1;
            if (blockType === 'flat') {
                if (remaining >= prod.width * 4) faceCount = 4;
                else if (remaining >= prod.width * 3) faceCount = 3;
                else if (remaining >= prod.width * 2) faceCount = 2;
                else if (remaining >= prod.width) faceCount = 1;
                else break;
            } else {
                if (remaining >= prod.width * 3) faceCount = 3;
                else if (remaining >= prod.width * 2) faceCount = 2;
                else if (remaining >= prod.width) faceCount = 1;
                else break;
            }
            placements.push({
                id: crypto.randomUUID(),
                productId: prod.id,
                shelfIndex: shelf,
                positionX: posX,
                faceCount,
            });
            posX += prod.width * faceCount;
            globalIdx++;
        }
        if (posX > actualMaxWidth) actualMaxWidth = posX;
    }

    const finalWidth = Math.max(targetWidthMm, actualMaxWidth);

    return shelfBlockRepository.create({
        name: bDef.name,
        description: `${bDef.dept}部門 ${bDef.shaku}尺`,
        blockType,
        width: finalWidth,
        height: blockType === 'multi-tier' ? 1800 : 900,
        shelfCount: bDef.shelfCount,
        productPlacements: placements,
        createdAt: now,
        updatedAt: now,
    } as Omit<ShelfBlock, 'id'>);
}

/** ブロック配列から標準棚割を構築 */
function buildStandardPlanogramData(blocks: ShelfBlock[]) {
    const stdBlocks: StandardPlanogramBlock[] = [];
    const stdProducts: StandardPlanogramProduct[] = [];
    let posX = 0;

    for (const block of blocks) {
        const placedBlockId = crypto.randomUUID();
        stdBlocks.push({
            id: placedBlockId,
            blockId: block.id,
            positionX: posX,
            positionY: 0,
        });
        for (const pl of block.productPlacements) {
            stdProducts.push({
                id: crypto.randomUUID(),
                productId: pl.productId,
                shelfIndex: pl.shelfIndex,
                positionX: posX + pl.positionX,
                faceCount: pl.faceCount,
                placedBlockId,
            });
        }
        posX += block.width;
    }

    return { blocks: stdBlocks, products: stdProducts, totalWidth: posX };
}

// ========================================
// メイン
// ========================================

export async function seedDummyData(): Promise<{
    products: number;
    stores: number;
    standardPlanograms: number;
    storePlanograms: number;
}> {
    // ── 0. 既存データ全削除 ──
    console.log('[seedDummyData] 既存データを削除中...');
    await clearAllData();

    const now = new Date().toISOString();

    // ── 1. 商品マスタ ──
    console.log('[seedDummyData] 商品マスタ作成中...');
    const savedProducts: Product[] = [];
    for (const def of PRODUCT_DEFS) {
        const product = await productRepository.create({
            jan: def.jan,
            name: def.name,
            width: def.width,
            height: def.height,
            depth: def.depth,
            category: def.category,
            departmentName: def.departmentName,
            imageUrl: '',
            salesRank: def.salesRank,
            sales: def.sales,
            quantity: def.quantity,
            grossProfit: def.grossProfit,
        } as Omit<Product, 'id'>);
        savedProducts.push(product);
    }

    const byDept = new Map<string, Product[]>();
    for (const p of savedProducts) {
        const dept = p.departmentName || '他';
        if (!byDept.has(dept)) byDept.set(dept, []);
        byDept.get(dept)!.push(p);
    }

    // ── 2. 棚ブロック作成（基準サイズ = 大型用） ──
    console.log('[seedDummyData] 棚ブロック作成中...');
    const multiBlocks: ShelfBlock[] = [];
    for (const bDef of BASE_MULTI_BLOCK_DEFS) {
        const deptProds = byDept.get(bDef.dept) || [];
        if (deptProds.length === 0) continue;
        const block = await createFilledBlock(bDef, deptProds, 'multi-tier', now);
        multiBlocks.push(block);
    }

    const flatBlocks: ShelfBlock[] = [];
    for (const bDef of BASE_FLAT_BLOCK_DEFS) {
        const deptProds = byDept.get(bDef.dept) || [];
        if (deptProds.length === 0) continue;
        const block = await createFilledBlock(bDef, deptProds, 'flat', now);
        flatBlocks.push(block);
    }

    // ── 3. FMT標準棚割（大型基準） ──
    console.log('[seedDummyData] 標準棚割作成中...');
    const multiStdData = buildStandardPlanogramData(multiBlocks);
    const flatStdData = buildStandardPlanogramData(flatBlocks);

    const baseStoreId = 'dummy-base'; // 仮の基準店舗ID（後で最初の店舗に差し替え）

    const stdMultiTier = await standardPlanogramRepository.create({
        fmt: 'SuC',
        name: 'SuC精肉 多段標準棚割',
        baseStoreId,
        fixtureType: 'multi-tier',
        width: multiStdData.totalWidth,
        height: 1800,
        shelfCount: 5,
        blocks: multiStdData.blocks,
        products: multiStdData.products,
        createdAt: now,
        updatedAt: now,
    } as any);

    const stdFlat = await standardPlanogramRepository.create({
        fmt: 'SuC',
        name: 'SuC精肉 平台標準棚割',
        baseStoreId,
        fixtureType: 'flat-refrigerated',
        width: flatStdData.totalWidth,
        height: 900,
        shelfCount: 1,
        blocks: flatStdData.blocks,
        products: flatStdData.products,
        createdAt: now,
        updatedAt: now,
    } as any);

    // ── 4. 店舗作成 + 什器配置 + 個店棚割自動生成 ──
    console.log('[seedDummyData] 店舗・什器・個店棚割作成中...');
    let storePlanogramCount = 0;

    for (const pattern of STORE_PATTERNS) {
        // 店舗作成
        const store = await storeRepository.create({
            code: pattern.code,
            name: `${pattern.name}（${pattern.size}型 多段${pattern.multiTierShaku}尺+平台${pattern.flatShaku}尺）`,
            fmt: 'SuC' as const,
            region: '九州' as const,
        });

        // 什器配置: 4尺什器を必要本数作成
        const mtFixtureShaku = 4; // 1本あたり4尺
        const mtCount = Math.round(pattern.multiTierShaku / mtFixtureShaku);
        const flatFixtureShaku = 4;
        const flatCount = Math.round(pattern.flatShaku / flatFixtureShaku);

        let order = 1;
        // 多段什器
        for (let i = 0; i < mtCount; i++) {
            const fixture = await fixtureRepository.create({
                name: `多段冷蔵棚（${mtFixtureShaku}尺）`,
                width: mtFixtureShaku * SHAKU_TO_MM,
                height: 1800,
                shelfCount: pattern.shelfCount,
                fixtureType: 'multi-tier',
            } as Omit<Fixture, 'id'>);
            await storeFixturePlacementRepository.create({
                storeId: store.id,
                fixtureId: fixture.id,
                positionX: i * 120,
                positionY: 0,
                order: order++,
                direction: 0,
                zone: '多段' as any,
                label: `多段${i + 1}`,
            } as Omit<StoreFixturePlacement, 'id'>);
        }
        // 平台什器
        for (let i = 0; i < flatCount; i++) {
            const fixture = await fixtureRepository.create({
                name: `平台冷蔵（${flatFixtureShaku}尺）`,
                width: flatFixtureShaku * SHAKU_TO_MM,
                height: 900,
                depth: 600,
                shelfCount: 1,
                fixtureType: 'flat-refrigerated',
            } as Omit<Fixture, 'id'>);
            await storeFixturePlacementRepository.create({
                storeId: store.id,
                fixtureId: fixture.id,
                positionX: i * 120,
                positionY: 300,
                order: order++,
                direction: 0,
                zone: '平台冷蔵' as any,
                label: `平台${i + 1}`,
            } as Omit<StoreFixturePlacement, 'id'>);
        }

        // 個店棚割を自動生成
        const r1 = await generateStorePlanogram(store.id, stdMultiTier);
        if (r1.status !== 'error') storePlanogramCount++;
        console.log(`[seedDummyData] ${pattern.name} 多段: ${r1.status} - ${r1.message}`);

        const r2 = await generateStorePlanogram(store.id, stdFlat);
        if (r2.status !== 'error') storePlanogramCount++;
        console.log(`[seedDummyData] ${pattern.name} 平台: ${r2.status} - ${r2.message}`);
    }

    // 初期化フラグをセット
    await setInitialized(true);

    console.log('[seedDummyData] 完了!');

    return {
        products: savedProducts.length,
        stores: STORE_PATTERNS.length,
        standardPlanograms: 2,
        storePlanograms: storePlanogramCount,
    };
}
