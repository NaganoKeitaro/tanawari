// 棚ブロック 商品階層配置のテスト
import { describe, it, expect } from 'vitest';
import type {
    Product,
    ProductPlacement,
    HierarchyPlacement,
    ShelfBlock,
    StandardPlanogramHierarchyPlacement,
} from '../../data/types';
import { expandBlockHierarchyPlacements } from '../planogram/standardPlanogramRearrange';

// =========================================================================
// テストヘルパー
// =========================================================================

function makeProduct(id: string, width: number, salesRank: number = 1): Product {
    return {
        id,
        name: `商品${id}`,
        jan: `490000000${id}`,
        width,
        height: 200,
        depth: 100,
        salesRank,
        category: '',
        imageUrl: '',
    } as Product;
}

function makeProductPlacement(
    id: string,
    productId: string,
    shelfIndex: number,
    positionX: number,
    faceCount: number = 1
): ProductPlacement {
    return { id, productId, shelfIndex, positionX, faceCount };
}

function makeHierarchyPlacement(
    id: string,
    shelfIndex: number,
    positionX: number,
    width: number = 300,
    faceCount: number = 1,
    overrides: Partial<HierarchyPlacement> = {}
): HierarchyPlacement {
    return {
        id,
        hierarchyLevel: 'category',
        hierarchyCode: 'C001',
        hierarchyName: 'テストカテゴリ',
        shelfIndex,
        positionX,
        width,
        faceCount,
        ...overrides,
    };
}

// 統合位置再計算（ShelfBlockEditor内のrecalculateAllPositionsと同等ロジック）
function recalculateAllPositions(
    prodPlacements: ProductPlacement[],
    hierPlacements: HierarchyPlacement[],
    shelfCount: number,
    products: Product[]
): { products: ProductPlacement[]; hierarchies: HierarchyPlacement[] } {
    type UnifiedItem =
        | { kind: 'product'; data: ProductPlacement }
        | { kind: 'hierarchy'; data: HierarchyPlacement };

    const resultProducts: ProductPlacement[] = [];
    const resultHierarchies: HierarchyPlacement[] = [];

    for (let si = 0; si < shelfCount; si++) {
        const items: UnifiedItem[] = [
            ...prodPlacements.filter(p => p.shelfIndex === si).map(p => ({ kind: 'product' as const, data: p })),
            ...hierPlacements.filter(h => h.shelfIndex === si).map(h => ({ kind: 'hierarchy' as const, data: h })),
        ].sort((a, b) => a.data.positionX - b.data.positionX);

        let currentX = 0;
        for (const item of items) {
            if (item.kind === 'product') {
                const prod = products.find(p => p.id === item.data.productId);
                resultProducts.push({ ...item.data, positionX: currentX });
                currentX += prod ? prod.width * item.data.faceCount : 0;
            } else {
                resultHierarchies.push({ ...item.data, positionX: currentX });
                currentX += item.data.width * item.data.faceCount;
            }
        }
    }
    return { products: resultProducts, hierarchies: resultHierarchies };
}

// =========================================================================
// テスト
// =========================================================================

describe('商品階層配置: 基本', () => {
    it('階層アイテムを空の棚に配置できる', () => {
        const hp = makeHierarchyPlacement('h1', 0, 0, 300);
        expect(hp.positionX).toBe(0);
        expect(hp.width).toBe(300);
        expect(hp.faceCount).toBe(1);
        expect(hp.hierarchyLevel).toBe('category');
    });

    it('階層アイテムのフェイス数が表示幅に反映される', () => {
        const hp = makeHierarchyPlacement('h1', 0, 0, 300, 3);
        const totalWidth = hp.width * hp.faceCount;
        expect(totalWidth).toBe(900);
    });

    it('全8階層レベルを設定できる', () => {
        const levels = [
            'division', 'divisionSub', 'line', 'department',
            'category', 'subCategory', 'segment', 'subSegment'
        ] as const;
        for (const level of levels) {
            const hp = makeHierarchyPlacement('h1', 0, 0, 300, 1, { hierarchyLevel: level });
            expect(hp.hierarchyLevel).toBe(level);
        }
    });
});

describe('商品階層配置: 統合位置再計算', () => {
    const products = [
        makeProduct('p1', 100),
        makeProduct('p2', 150),
    ];

    it('商品のみの場合は従来通り左詰め', () => {
        const prods = [
            makeProductPlacement('pp1', 'p1', 0, 0, 2),
            makeProductPlacement('pp2', 'p2', 0, 200, 1),
        ];
        const { products: result } = recalculateAllPositions(prods, [], 1, products);
        expect(result[0].positionX).toBe(0);
        expect(result[1].positionX).toBe(200); // p1: 100mm * 2face = 200mm
    });

    it('階層のみの場合も左詰め', () => {
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 300),
            makeHierarchyPlacement('h2', 0, 300, 200),
        ];
        const { hierarchies: result } = recalculateAllPositions([], hiers, 1, products);
        expect(result[0].positionX).toBe(0);
        expect(result[1].positionX).toBe(300);
    });

    it('商品と階層が混在する場合、positionX順で左詰め', () => {
        const prods = [
            makeProductPlacement('pp1', 'p1', 0, 0, 1), // 100mm
        ];
        const hiers = [
            makeHierarchyPlacement('h1', 0, 100, 300), // 300mm
        ];
        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, hiers, 1, products);
        expect(rp[0].positionX).toBe(0);       // 商品: 0mm開始
        expect(rh[0].positionX).toBe(100);      // 階層: 100mm開始（商品の後）
    });

    it('階層→商品の順でも正しく再計算', () => {
        const prods = [
            makeProductPlacement('pp1', 'p1', 0, 500, 1), // 後ろに配置(positionX=500)
        ];
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 300), // 先頭(positionX=0)
        ];
        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, hiers, 1, products);
        expect(rh[0].positionX).toBe(0);
        expect(rp[0].positionX).toBe(300);  // 階層300mm + 商品100mm開始
    });

    it('複数段で独立に再計算', () => {
        const prods = [
            makeProductPlacement('pp1', 'p1', 0, 0, 1),
            makeProductPlacement('pp2', 'p2', 1, 0, 1),
        ];
        const hiers = [
            makeHierarchyPlacement('h1', 0, 100, 200),
            makeHierarchyPlacement('h2', 1, 150, 250),
        ];
        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, hiers, 2, products);
        // 段0: p1(100mm) → h1(200mm)
        expect(rp[0].positionX).toBe(0);
        expect(rh[0].positionX).toBe(100);
        // 段1: p2(150mm) → h2(250mm)
        expect(rp[1].positionX).toBe(0);
        expect(rh[1].positionX).toBe(150);
    });
});

describe('商品階層配置: リサイズと押し出し', () => {
    const products = [
        makeProduct('p1', 100),
        makeProduct('p2', 150),
    ];

    it('階層アイテムの幅を広げると隣の商品が右に押し出される', () => {
        const prods = [
            makeProductPlacement('pp1', 'p1', 0, 400, 1), // 元は400mm位置
        ];
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 300), // 元は300mm幅
        ];

        // 階層を500mmにリサイズ
        const resizedHiers = hiers.map(h => ({ ...h, width: 500 }));

        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, resizedHiers, 1, products);
        expect(rh[0].positionX).toBe(0);
        expect(rh[0].width).toBe(500);
        expect(rp[0].positionX).toBe(500); // 500mmの後ろに押し出される
    });

    it('階層アイテムのフェイス数増加で隣が押し出される', () => {
        const prods = [
            makeProductPlacement('pp1', 'p1', 0, 300, 1),
        ];
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 300, 1), // 300mm * 1face
        ];

        // フェイス数を2に増加（表示幅600mm）
        const updatedHiers = hiers.map(h => ({ ...h, faceCount: 2 }));

        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, updatedHiers, 1, products);
        expect(rh[0].width * rh[0].faceCount).toBe(600);
        expect(rp[0].positionX).toBe(600);
    });

    it('複数の階層アイテム間でも押し出しが連鎖する', () => {
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 200),
            makeHierarchyPlacement('h2', 0, 200, 200),
            makeHierarchyPlacement('h3', 0, 400, 200),
        ];

        // h1を400mmに拡大
        const resized = hiers.map(h => h.id === 'h1' ? { ...h, width: 400 } : h);

        const { hierarchies: rh } = recalculateAllPositions([], resized, 1, []);
        expect(rh[0].positionX).toBe(0);    // h1: 0
        expect(rh[1].positionX).toBe(400);  // h2: h1の後
        expect(rh[2].positionX).toBe(600);  // h3: h2の後
    });
});

describe('商品階層配置: フェイス数管理', () => {
    it('フェイス数1で削除するとアイテムが消える', () => {
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 300, 1),
            makeHierarchyPlacement('h2', 0, 300, 200, 1),
        ];

        // h1を削除（faceCount=1なので完全削除）
        const after = hiers.filter(h => h.id !== 'h1');
        const { hierarchies: rh } = recalculateAllPositions([], after, 1, []);
        expect(rh.length).toBe(1);
        expect(rh[0].positionX).toBe(0); // h2が左詰めされる
    });

    it('フェイス数2以上で減少すると幅が縮む', () => {
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 300, 3), // 900mm
            makeHierarchyPlacement('h2', 0, 900, 200, 1),
        ];

        // h1のフェイスを2に減少
        const reduced = hiers.map(h => h.id === 'h1' ? { ...h, faceCount: 2 } : h);
        const { hierarchies: rh } = recalculateAllPositions([], reduced, 1, []);
        expect(rh[0].width * rh[0].faceCount).toBe(600);
        expect(rh[1].positionX).toBe(600); // 左詰めで詰まる
    });
});

describe('商品階層配置: 標準棚割への展開', () => {
    it('ブロック内の階層配置が絶対座標に展開される', () => {
        const blockHierarchies: HierarchyPlacement[] = [
            makeHierarchyPlacement('h1', 0, 0, 300),
            makeHierarchyPlacement('h2', 1, 100, 200),
        ];

        const expanded = expandBlockHierarchyPlacements(blockHierarchies, 500, 2);

        expect(expanded.length).toBe(2);
        // h1: shelfIndex=0+2=2, positionX=0+500=500
        expect(expanded[0].shelfIndex).toBe(2);
        expect(expanded[0].positionX).toBe(500);
        expect(expanded[0].width).toBe(300);
        expect(expanded[0].hierarchyLevel).toBe('category');
        expect(expanded[0].hierarchyName).toBe('テストカテゴリ');
        // h2: shelfIndex=1+2=3, positionX=100+500=600
        expect(expanded[1].shelfIndex).toBe(3);
        expect(expanded[1].positionX).toBe(600);
        expect(expanded[1].width).toBe(200);
    });

    it('空の階層配置は空配列を返す', () => {
        const expanded = expandBlockHierarchyPlacements([], 100, 0);
        expect(expanded).toEqual([]);
    });

    it('フェイス数が保持される', () => {
        const blockHierarchies: HierarchyPlacement[] = [
            makeHierarchyPlacement('h1', 0, 0, 300, 3),
        ];
        const expanded = expandBlockHierarchyPlacements(blockHierarchies, 0, 0);
        expect(expanded[0].faceCount).toBe(3);
    });
});

describe('商品階層配置: 重なり不許容', () => {
    const products = [
        makeProduct('p1', 100),
        makeProduct('p2', 150),
    ];

    it('同一段で商品と階層が重ならないことを検証', () => {
        const prods = [
            makeProductPlacement('pp1', 'p1', 0, 0, 2),    // 200mm
            makeProductPlacement('pp2', 'p2', 0, 200, 1),  // 150mm
        ];
        const hiers = [
            makeHierarchyPlacement('h1', 0, 350, 300),     // 300mm
        ];
        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, hiers, 1, products);

        // p1: 0-200, p2: 200-350, h1: 350-650 — 重なりなし
        expect(rp[0].positionX).toBe(0);
        expect(rp[1].positionX).toBe(200);
        expect(rh[0].positionX).toBe(350);

        // 各アイテムの右端が次のアイテムの左端以下であることを確認
        const p1End = rp[0].positionX + 100 * 2;
        const p2End = rp[1].positionX + 150;
        expect(p1End).toBeLessThanOrEqual(rp[1].positionX);
        expect(p2End).toBeLessThanOrEqual(rh[0].positionX);
    });

    it('リサイズ後も重なりが発生しない', () => {
        const prods = [
            makeProductPlacement('pp1', 'p1', 0, 300, 1), // 100mm, 位置300
        ];
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 200), // 200mm
        ];

        // h1を350mmにリサイズ（商品と重なるはず）
        const resized = hiers.map(h => ({ ...h, width: 350 }));
        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, resized, 1, products);

        // h1は0-350、p1は350から開始（押し出し）
        expect(rh[0].positionX).toBe(0);
        expect(rp[0].positionX).toBe(350);
        expect(rh[0].positionX + rh[0].width).toBeLessThanOrEqual(rp[0].positionX);
    });
});

describe('商品階層配置: ShelfBlock型の互換性', () => {
    it('hierarchyPlacementsが空配列の場合も正常動作', () => {
        const block: ShelfBlock = {
            id: 'b1',
            name: 'テストブロック',
            width: 900,
            height: 1800,
            shelfCount: 3,
            productPlacements: [],
            hierarchyPlacements: [],
            createdAt: '',
            updatedAt: '',
        };
        expect(block.hierarchyPlacements).toEqual([]);
    });

    it('ShelfBlockに商品と階層を混在配置できる', () => {
        const block: ShelfBlock = {
            id: 'b1',
            name: 'テストブロック',
            width: 900,
            height: 1800,
            shelfCount: 3,
            productPlacements: [
                makeProductPlacement('pp1', 'p1', 0, 0, 1),
            ],
            hierarchyPlacements: [
                makeHierarchyPlacement('h1', 0, 100, 300),
                makeHierarchyPlacement('h2', 1, 0, 450),
            ],
            createdAt: '',
            updatedAt: '',
        };
        expect(block.productPlacements.length).toBe(1);
        expect(block.hierarchyPlacements.length).toBe(2);
    });

    it('1つの棚ブロックに複数の階層を設定できる', () => {
        const block: ShelfBlock = {
            id: 'b1',
            name: 'テストブロック',
            width: 900,
            height: 1800,
            shelfCount: 1,
            productPlacements: [],
            hierarchyPlacements: [
                makeHierarchyPlacement('h1', 0, 0, 300, 1, { hierarchyName: '牛肉>こま切れ', hierarchyCode: 'C001' }),
                makeHierarchyPlacement('h2', 0, 300, 300, 1, { hierarchyName: '牛肉>スライス', hierarchyCode: 'C002' }),
                makeHierarchyPlacement('h3', 0, 600, 300, 1, { hierarchyName: '豚肉>こま切れ', hierarchyCode: 'C003' }),
            ],
            createdAt: '',
            updatedAt: '',
        };
        expect(block.hierarchyPlacements.length).toBe(3);
        // 全て段0に配置、重なりなし
        const names = block.hierarchyPlacements.map(h => h.hierarchyName);
        expect(names).toEqual(['牛肉>こま切れ', '牛肉>スライス', '豚肉>こま切れ']);
    });
});

describe('商品階層配置: 5cm刻みリサイズ', () => {
    const products = [makeProduct('p1', 100)];

    it('5cm(50mm)刻みで幅を拡大', () => {
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 300), // 初期300mm
        ];
        // +50mm
        const expanded = hiers.map(h => ({ ...h, width: h.width + 50 }));
        expect(expanded[0].width).toBe(350);
    });

    it('5cm(50mm)刻みで幅を縮小', () => {
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 300),
        ];
        // -50mm
        const shrunk = hiers.map(h => ({ ...h, width: Math.max(50, h.width - 50) }));
        expect(shrunk[0].width).toBe(250);
    });

    it('最小幅50mm未満にはならない', () => {
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 50), // 既に最小
        ];
        const shrunk = hiers.map(h => ({ ...h, width: Math.max(50, h.width - 50) }));
        expect(shrunk[0].width).toBe(50);
    });

    it('リサイズ後の幅mm表示値が正しい', () => {
        const hp = makeHierarchyPlacement('h1', 0, 0, 300, 2);
        const totalWidthMm = hp.width * hp.faceCount; // 300 * 2 = 600mm
        expect(totalWidthMm).toBe(600);
        expect(Math.round(totalWidthMm)).toBe(600); // 表示用
    });

    it('リサイズで隣接アイテムが押し出される（50mm刻み）', () => {
        const prods = [makeProductPlacement('pp1', 'p1', 0, 300, 1)]; // 100mm商品
        const hiers = [makeHierarchyPlacement('h1', 0, 0, 300)]; // 300mm

        // +50mmリサイズ → 350mm
        const resized = hiers.map(h => ({ ...h, width: 350 }));
        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, resized, 1, products);
        expect(rh[0].width).toBe(350);
        expect(rp[0].positionX).toBe(350); // 押し出される
    });
});

describe('商品階層配置: DnD移動', () => {
    const products = [
        makeProduct('p1', 100),
        makeProduct('p2', 150),
    ];

    it('階層アイテムを同一段内で移動（位置変更後の再計算）', () => {
        const prods = [makeProductPlacement('pp1', 'p1', 0, 0, 1)]; // 100mm
        const hiers = [
            makeHierarchyPlacement('h1', 0, 100, 200), // 200mm
            makeHierarchyPlacement('h2', 0, 300, 150), // 150mm
        ];

        // h2を先頭に移動（positionX=-10で先頭挿入をシミュレート）
        const movedH2 = { ...hiers[1], positionX: -10 };
        const updatedHiers = [hiers[0], movedH2];

        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, updatedHiers, 1, products);
        // 再計算後: positionXでソートされるので h2(-10) → p1(0) → h1(100)
        // h2: 0, p1: 150, h1: 250
        expect(rh.find(h => h.id === 'h2')!.positionX).toBe(0);
        expect(rp[0].positionX).toBe(150);
        expect(rh.find(h => h.id === 'h1')!.positionX).toBe(250);
    });

    it('階層アイテムを別段に移動', () => {
        const hiers = [
            makeHierarchyPlacement('h1', 0, 0, 300),
            makeHierarchyPlacement('h2', 0, 300, 200),
        ];

        // h2を段1に移動
        const movedH2 = { ...hiers[1], shelfIndex: 1, positionX: 0 };
        const updatedHiers = [hiers[0], movedH2];

        const { hierarchies: rh } = recalculateAllPositions([], updatedHiers, 2, []);
        const h1 = rh.find(h => h.id === 'h1')!;
        const h2 = rh.find(h => h.id === 'h2')!;
        expect(h1.shelfIndex).toBe(0);
        expect(h1.positionX).toBe(0);
        expect(h2.shelfIndex).toBe(1);
        expect(h2.positionX).toBe(0);
    });

    it('階層と商品の混在段内で階層を移動しても重ならない', () => {
        const prods = [
            makeProductPlacement('pp1', 'p1', 0, 0, 1),   // 100mm
            makeProductPlacement('pp2', 'p2', 0, 100, 1),  // 150mm
        ];
        const hiers = [
            makeHierarchyPlacement('h1', 0, 250, 200), // 200mm（末尾）
        ];

        // h1を先頭に移動
        const movedH1 = { ...hiers[0], positionX: -5 };
        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, [movedH1], 1, products);

        // h1(200mm) → pp1(100mm) → pp2(150mm) = 計450mm
        expect(rh[0].positionX).toBe(0);
        expect(rp[0].positionX).toBe(200);
        expect(rp[1].positionX).toBe(300);
        // 重なりチェック
        expect(rh[0].positionX + rh[0].width * rh[0].faceCount).toBeLessThanOrEqual(rp[0].positionX);
        expect(rp[0].positionX + 100).toBeLessThanOrEqual(rp[1].positionX);
    });

    it('スペース不足で移動できない場合の使用幅計算が正しい', () => {
        // 幅500mmのブロックで、商品300mm + 階層200mm = ちょうど500mm
        const prods = [makeProductPlacement('pp1', 'p1', 0, 0, 3)]; // 100*3 = 300mm
        const hiers = [makeHierarchyPlacement('h1', 0, 300, 200)]; // 200mm

        const { products: rp, hierarchies: rh } = recalculateAllPositions(prods, hiers, 1, products);
        const totalUsed = (rp[0].positionX + 100 * 3) + 0; // 商品端
        const hierEnd = rh[0].positionX + rh[0].width;
        expect(Math.max(totalUsed, hierEnd)).toBe(500);
    });
});

describe('商品階層配置: 階層パス表示', () => {
    it('hierarchyNameに部門以下のパスが格納される想定', () => {
        // buildHierarchyPathはUI内関数だがロジックを検証
        // パス文字列の形式: "部門 > カテゴリ > サブカテゴリ > セグメント > サブセグメント"
        const hp = makeHierarchyPlacement('h1', 0, 0, 300, 1, {
            hierarchyName: '牛肉 > ステーキ > 和牛 > 牛サガリ > 中(2枚)',
            hierarchyLevel: 'subSegment',
        });
        expect(hp.hierarchyName).toBe('牛肉 > ステーキ > 和牛 > 牛サガリ > 中(2枚)');
        expect(hp.hierarchyName.split(' > ').length).toBe(5); // 部門→サブセグメント = 5段階
    });

    it('部門レベルの場合はパスが1要素のみ', () => {
        const hp = makeHierarchyPlacement('h1', 0, 0, 300, 1, {
            hierarchyName: '牛肉',
            hierarchyLevel: 'department',
        });
        expect(hp.hierarchyName).toBe('牛肉');
        expect(hp.hierarchyName.split(' > ').length).toBe(1);
    });

    it('カテゴリレベルの場合はパスが2要素', () => {
        const hp = makeHierarchyPlacement('h1', 0, 0, 300, 1, {
            hierarchyName: '牛肉 > ステーキ',
            hierarchyLevel: 'category',
        });
        expect(hp.hierarchyName.split(' > ').length).toBe(2);
    });
});
