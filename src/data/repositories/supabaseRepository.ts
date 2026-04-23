import { supabase } from '../supabaseClient';
import type { IRepository } from './baseRepository';
import type {
    Product, Store, Fixture, StoreFixturePlacement, ShelfBlock,
    StandardPlanogram, StorePlanogram
} from '../types';
import type { HierarchyEntry } from '../types/productHierarchy';

const toCamel = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(toCamel);
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
        const newObj: any = {};
        for (const key in obj) {
            // handle specific jsonb fields that shouldn't be deep-converted if they are arrays of strings etc
            if (key === 'warnings') {
                newObj[key] = obj[key];
                continue;
            }
            const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
            newObj[camelKey] = toCamel(obj[key]);
        }
        return newObj;
    }
    return obj;
};

const toSnake = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(toSnake);
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
        const newObj: any = {};
        for (const key in obj) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            // Convert empty string to null to prevent constraint violations in Supabase (especially for dates)
            newObj[snakeKey] = obj[key] === '' ? null : toSnake(obj[key]);
        }
        return newObj;
    }
    return obj;
};

// --- Generic Repository for simple tables ---
class SupabaseSimpleRepository<T extends { id: string }> implements IRepository<T> {
    tableName: string;
    constructor(tableName: string) {
        this.tableName = tableName;
    }

    async getAll(): Promise<T[]> {
        // ページネーションで全件取得（Supabaseのデフォルト1000行制限を回避）
        const allData: any[] = [];
        const PAGE_SIZE = 1000;
        let offset = 0;
        while (true) {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .range(offset, offset + PAGE_SIZE - 1);
            if (error) {
                console.error(`Error fetching ${this.tableName}:`, error);
                return toCamel(allData) as T[];
            }
            if (!data || data.length === 0) break;
            allData.push(...data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
        return toCamel(allData) as T[];
    }

    async getById(id: string): Promise<T | null> {
        const { data, error } = await supabase.from(this.tableName).select('*').eq('id', id).single();
        if (error || !data) return null;
        return toCamel(data) as T;
    }

    async create(item: Omit<T, 'id'>): Promise<T> {
        const id = crypto.randomUUID();
        const payload = toSnake({ id, ...item });

        // Remove nested arrays from payload if any (fallback for safety)
        for (const key in payload) {
            if (Array.isArray(payload[key]) && key !== 'warnings') {
                delete payload[key];
            }
        }

        const { data, error } = await supabase.from(this.tableName).insert(payload).select().single();
        if (error) throw error;
        return toCamel(data) as T;
    }

    async update(id: string, item: Partial<T>): Promise<T | null> {
        const payload = toSnake(item);

        for (const key in payload) {
            if (Array.isArray(payload[key]) && key !== 'warnings') {
                delete payload[key];
            }
        }

        // Remove undefined values to avoid sending them to Supabase
        for (const key in payload) {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        }

        const { data, error } = await supabase.from(this.tableName).update(payload).eq('id', id).select().single();
        if (error) throw error;
        return toCamel(data) as T;
    }

    async delete(id: string): Promise<boolean> {
        const { error } = await supabase.from(this.tableName).delete().eq('id', id);
        return !error;
    }

    async query(predicate: (item: T) => boolean): Promise<T[]> {
        const all = await this.getAll();
        return all.filter(predicate);
    }

    async createBulk(newItems: Omit<T, 'id'>[]): Promise<T[]> {
        const itemsToInsert = newItems.map(item => toSnake({ id: crypto.randomUUID(), ...item }));
        const { data, error } = await supabase.from(this.tableName).insert(itemsToInsert).select();
        if (error) throw error;
        return toCamel(data) as T[];
    }

    async updateBulk(updates: { id: string; data: Partial<T> }[]): Promise<void> {
        // Supabase bulk update is tricky without explicit functions. We'll do a simple iteration.
        for (const update of updates) {
            await this.update(update.id, update.data);
        }
    }

    async clear(): Promise<void> {
        // Supabaseのdelete上限を回避するためループで全件削除
        while (true) {
            const { data } = await supabase.from(this.tableName).select('id').limit(500);
            if (!data || data.length === 0) break;
            const ids = data.map((d: { id: string }) => d.id);
            const { error } = await supabase.from(this.tableName).delete().in('id', ids);
            if (error) throw error;
        }
    }
}

// --- Specialized Repositories ---

class ShelfBlockRepository implements IRepository<ShelfBlock> {
    private mapBlock(d: Record<string, unknown>): ShelfBlock {
        const block = toCamel(d);
        block.productPlacements = block.shelfBlockProducts || [];
        block.hierarchyPlacements = block.shelfBlockHierarchyPlacements || [];
        delete block.shelfBlockProducts;
        delete block.shelfBlockHierarchyPlacements;
        return block as ShelfBlock;
    }

    async getAll(): Promise<ShelfBlock[]> {
        const allData: any[] = [];
        const PAGE_SIZE = 1000;
        let offset = 0;
        while (true) {
            const { data, error } = await supabase.from('shelf_blocks').select(`
                *,
                shelf_block_products (*),
                shelf_block_hierarchy_placements (*)
            `).range(offset, offset + PAGE_SIZE - 1);
            if (error || !data || data.length === 0) break;
            allData.push(...data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
        return allData.map((d: Record<string, unknown>) => this.mapBlock(d));
    }

    async getById(id: string): Promise<ShelfBlock | null> {
        const { data, error } = await supabase.from('shelf_blocks').select(`
            *,
            shelf_block_products (*),
            shelf_block_hierarchy_placements (*)
        `).eq('id', id).single();
        if (error || !data) return null;
        return this.mapBlock(data);
    }

    async create(item: Omit<ShelfBlock, 'id'>): Promise<ShelfBlock> {
        const id = crypto.randomUUID();
        const blockPayload = toSnake({ ...item, id });
        delete blockPayload.product_placements;
        delete blockPayload.hierarchy_placements;

        const { error: blockErr } = await supabase.from('shelf_blocks').insert(blockPayload);
        if (blockErr) throw blockErr;

        if (item.productPlacements && item.productPlacements.length > 0) {
            const prodPayloads = item.productPlacements.map(p => toSnake({
                ...p,
                id: crypto.randomUUID(),
                blockId: id
            }));
            const { error: prodErr } = await supabase.from('shelf_block_products').insert(prodPayloads);
            if (prodErr) throw prodErr;
        }

        if (item.hierarchyPlacements && item.hierarchyPlacements.length > 0) {
            const hPayloads = item.hierarchyPlacements.map(h => toSnake({
                ...h,
                id: crypto.randomUUID(),
                blockId: id
            }));
            const { error: hErr } = await supabase.from('shelf_block_hierarchy_placements').insert(hPayloads);
            if (hErr) throw hErr;
        }
        const result = await this.getById(id);
        return result ?? { id, ...item, productPlacements: item.productPlacements || [], hierarchyPlacements: item.hierarchyPlacements || [] } as ShelfBlock;
    }

    async update(id: string, item: Partial<ShelfBlock>): Promise<ShelfBlock | null> {
        const blockPayload = toSnake(item);
        delete blockPayload.product_placements;
        delete blockPayload.hierarchy_placements;
        delete blockPayload.id;

        if (Object.keys(blockPayload).length > 0) {
            const { error: blockErr } = await supabase.from('shelf_blocks').update(blockPayload).eq('id', id);
            if (blockErr) throw blockErr;
        }

        if (item.productPlacements) {
            const { error: deleteErr } = await supabase.from('shelf_block_products').delete().eq('block_id', id);
            if (deleteErr) throw deleteErr;

            if (item.productPlacements.length > 0) {
                const prodPayloads = item.productPlacements.map(p => toSnake({
                    ...p,
                    id: crypto.randomUUID(),
                    blockId: id
                }));
                const { error: insertErr } = await supabase.from('shelf_block_products').insert(prodPayloads);
                if (insertErr) throw insertErr;
            }
        }

        if (item.hierarchyPlacements) {
            const { error: deleteErr } = await supabase.from('shelf_block_hierarchy_placements').delete().eq('block_id', id);
            if (deleteErr) throw deleteErr;

            if (item.hierarchyPlacements.length > 0) {
                const hPayloads = item.hierarchyPlacements.map(h => toSnake({
                    ...h,
                    id: crypto.randomUUID(),
                    blockId: id
                }));
                const { error: insertErr } = await supabase.from('shelf_block_hierarchy_placements').insert(hPayloads);
                if (insertErr) throw insertErr;
            }
        }
        return this.getById(id);
    }

    async delete(id: string): Promise<boolean> {
        const { error } = await supabase.from('shelf_blocks').delete().eq('id', id);
        return !error;
    }

    async query(predicate: (item: ShelfBlock) => boolean): Promise<ShelfBlock[]> {
        const all = await this.getAll();
        return all.filter(predicate);
    }

    async clear(): Promise<void> {
        while (true) {
            const { data } = await supabase.from('shelf_blocks').select('id').limit(500);
            if (!data || data.length === 0) break;
            const { error } = await supabase.from('shelf_blocks').delete().in('id', data.map((d: { id: string }) => d.id));
            if (error) throw error;
        }
    }
}

class StandardPlanogramRepository implements IRepository<StandardPlanogram> {
    private mapPlanogram(d: Record<string, unknown>): StandardPlanogram {
        const plan = toCamel(d);
        plan.blocks = plan.standardPlanogramBlocks || [];
        plan.products = plan.standardPlanogramProducts || [];
        plan.hierarchyPlacements = plan.standardPlanogramHierarchyPlacements || [];
        delete plan.standardPlanogramBlocks;
        delete plan.standardPlanogramProducts;
        delete plan.standardPlanogramHierarchyPlacements;
        return plan as StandardPlanogram;
    }

    async getAll(): Promise<StandardPlanogram[]> {
        const allData: any[] = [];
        const PAGE_SIZE = 1000;
        let offset = 0;
        while (true) {
            const { data, error } = await supabase.from('standard_planograms').select(`
                *,
                standard_planogram_blocks (*),
                standard_planogram_products (*),
                standard_planogram_hierarchy_placements (*)
            `).range(offset, offset + PAGE_SIZE - 1);
            if (error || !data || data.length === 0) break;
            allData.push(...data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
        return allData.map((d: Record<string, unknown>) => this.mapPlanogram(d));
    }

    async getById(id: string): Promise<StandardPlanogram | null> {
        const { data, error } = await supabase.from('standard_planograms').select(`
            *,
            standard_planogram_blocks (*),
            standard_planogram_products (*),
            standard_planogram_hierarchy_placements (*)
        `).eq('id', id).single();
        if (error || !data) return null;
        return this.mapPlanogram(data);
    }

    async create(item: Omit<StandardPlanogram, 'id'>): Promise<StandardPlanogram> {
        const id = crypto.randomUUID();
        const payload = toSnake({ ...item, id });
        delete payload.blocks;
        delete payload.products;
        delete payload.hierarchy_placements;

        const { error } = await supabase.from('standard_planograms').insert(payload);
        if (error) throw error;

        if (item.blocks && item.blocks.length > 0) {
            await supabase.from('standard_planogram_blocks').insert(
                item.blocks.map(b => toSnake({ ...b, id: crypto.randomUUID(), standardPlanogramId: id }))
            );
        }
        if (item.products && item.products.length > 0) {
            await supabase.from('standard_planogram_products').insert(
                item.products.map(p => toSnake({ ...p, id: crypto.randomUUID(), standardPlanogramId: id }))
            );
        }
        if (item.hierarchyPlacements && item.hierarchyPlacements.length > 0) {
            await supabase.from('standard_planogram_hierarchy_placements').insert(
                item.hierarchyPlacements.map(h => toSnake({ ...h, id: crypto.randomUUID(), standardPlanogramId: id }))
            );
        }
        const result = await this.getById(id);
        return result ?? { id, ...item, blocks: item.blocks || [], products: item.products || [], hierarchyPlacements: item.hierarchyPlacements || [] } as StandardPlanogram;
    }

    async update(id: string, item: Partial<StandardPlanogram>): Promise<StandardPlanogram | null> {
        const payload = toSnake(item);
        delete payload.blocks;
        delete payload.products;
        delete payload.hierarchy_placements;
        delete payload.id;

        if (Object.keys(payload).length > 0) {
            await supabase.from('standard_planograms').update(payload).eq('id', id);
        }

        if (item.blocks) {
            await supabase.from('standard_planogram_blocks').delete().eq('standard_planogram_id', id);
            if (item.blocks.length > 0) {
                await supabase.from('standard_planogram_blocks').insert(
                    item.blocks.map(b => toSnake({ ...b, id: crypto.randomUUID(), standardPlanogramId: id }))
                );
            }
        }

        if (item.products) {
            await supabase.from('standard_planogram_products').delete().eq('standard_planogram_id', id);
            if (item.products.length > 0) {
                await supabase.from('standard_planogram_products').insert(
                    item.products.map(p => toSnake({ ...p, id: crypto.randomUUID(), standardPlanogramId: id }))
                );
            }
        }

        if (item.hierarchyPlacements) {
            await supabase.from('standard_planogram_hierarchy_placements').delete().eq('standard_planogram_id', id);
            if (item.hierarchyPlacements.length > 0) {
                await supabase.from('standard_planogram_hierarchy_placements').insert(
                    item.hierarchyPlacements.map(h => toSnake({ ...h, id: crypto.randomUUID(), standardPlanogramId: id }))
                );
            }
        }
        return this.getById(id);
    }

    async delete(id: string): Promise<boolean> {
        const { error } = await supabase.from('standard_planograms').delete().eq('id', id);
        return !error;
    }

    async query(predicate: (item: StandardPlanogram) => boolean): Promise<StandardPlanogram[]> {
        const all = await this.getAll();
        return all.filter(predicate);
    }

    async clear(): Promise<void> {
        while (true) {
            const { data } = await supabase.from('standard_planograms').select('id').limit(500);
            if (!data || data.length === 0) break;
            const { error } = await supabase.from('standard_planograms').delete().in('id', data.map((d: { id: string }) => d.id));
            if (error) throw error;
        }
    }
}

class StorePlanogramRepository implements IRepository<StorePlanogram> {
    private mapPlanogram(d: Record<string, unknown>): StorePlanogram {
        const plan = toCamel(d);
        plan.products = plan.storePlanogramProducts || [];
        plan.hierarchyPlacements = plan.storePlanogramHierarchyPlacements || [];
        delete plan.storePlanogramProducts;
        delete plan.storePlanogramHierarchyPlacements;
        return plan as StorePlanogram;
    }

    async getAll(): Promise<StorePlanogram[]> {
        const allData: any[] = [];
        const PAGE_SIZE = 1000;
        let offset = 0;
        while (true) {
            const { data, error } = await supabase.from('store_planograms').select(`
                *,
                store_planogram_products (*),
                store_planogram_hierarchy_placements (*)
            `).range(offset, offset + PAGE_SIZE - 1);
            if (error || !data || data.length === 0) break;
            allData.push(...data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
        return allData.map((d: Record<string, unknown>) => this.mapPlanogram(d));
    }

    async getById(id: string): Promise<StorePlanogram | null> {
        const { data, error } = await supabase.from('store_planograms').select(`
            *,
            store_planogram_products (*),
            store_planogram_hierarchy_placements (*)
        `).eq('id', id).single();
        if (error || !data) return null;
        return this.mapPlanogram(data);
    }

    async create(item: Omit<StorePlanogram, 'id'>): Promise<StorePlanogram> {
        const id = crypto.randomUUID();
        const payload = toSnake({ ...item, id });
        delete payload.products;
        delete payload.hierarchy_placements;

        const { error } = await supabase.from('store_planograms').insert(payload);
        if (error) throw error;

        if (item.products && item.products.length > 0) {
            await supabase.from('store_planogram_products').insert(
                item.products.map(p => toSnake({ ...p, id: crypto.randomUUID(), storePlanogramId: id }))
            );
        }
        if (item.hierarchyPlacements && item.hierarchyPlacements.length > 0) {
            await supabase.from('store_planogram_hierarchy_placements').insert(
                item.hierarchyPlacements.map(h => toSnake({ ...h, id: crypto.randomUUID(), storePlanogramId: id }))
            );
        }
        const result = await this.getById(id);
        return result ?? { id, ...item, products: item.products || [], hierarchyPlacements: item.hierarchyPlacements || [] } as StorePlanogram;
    }

    async update(id: string, item: Partial<StorePlanogram>): Promise<StorePlanogram | null> {
        const payload = toSnake(item);
        delete payload.products;
        delete payload.hierarchy_placements;
        delete payload.id;

        if (Object.keys(payload).length > 0) {
            await supabase.from('store_planograms').update(payload).eq('id', id);
        }

        if (item.products) {
            await supabase.from('store_planogram_products').delete().eq('store_planogram_id', id);
            if (item.products.length > 0) {
                await supabase.from('store_planogram_products').insert(
                    item.products.map(p => toSnake({ ...p, id: crypto.randomUUID(), storePlanogramId: id }))
                );
            }
        }

        if (item.hierarchyPlacements) {
            await supabase.from('store_planogram_hierarchy_placements').delete().eq('store_planogram_id', id);
            if (item.hierarchyPlacements.length > 0) {
                await supabase.from('store_planogram_hierarchy_placements').insert(
                    item.hierarchyPlacements.map(h => toSnake({ ...h, id: crypto.randomUUID(), storePlanogramId: id }))
                );
            }
        }
        return this.getById(id);
    }

    async delete(id: string): Promise<boolean> {
        const { error } = await supabase.from('store_planograms').delete().eq('id', id);
        return !error;
    }

    async query(predicate: (item: StorePlanogram) => boolean): Promise<StorePlanogram[]> {
        const all = await this.getAll();
        return all.filter(predicate);
    }

    async saveBulk(planograms: StorePlanogram[]): Promise<void> {
        for (const p of planograms) {
            const existing = await this.getById(p.id);
            if (existing) {
                await this.update(p.id, p);
            } else {
                await this.create(p);
            }
        }
    }

    async clear(): Promise<void> {
        while (true) {
            const { data } = await supabase.from('store_planograms').select('id').limit(500);
            if (!data || data.length === 0) break;
            const { error } = await supabase.from('store_planograms').delete().in('id', data.map((d: { id: string }) => d.id));
            if (error) throw error;
        }
    }
}

// Export specialized repositories
export const productRepository = new SupabaseSimpleRepository<Product>('products');
export const storeRepository = new SupabaseSimpleRepository<Store>('stores');
export const fixtureRepository = new SupabaseSimpleRepository<Fixture>('fixtures');
export const storeFixturePlacementRepository = new SupabaseSimpleRepository<StoreFixturePlacement>('store_fixture_placements');

export const shelfBlockRepository = new ShelfBlockRepository();
export const standardPlanogramRepository = new StandardPlanogramRepository();
export const storePlanogramRepository = new StorePlanogramRepository();

class ProductHierarchySupabaseRepository {
    async getAll(): Promise<HierarchyEntry[]> {
        // Supabase PostgRESTはデフォルト1000行制限のためページネーションで全件取得
        const allData: any[] = [];
        const PAGE_SIZE = 1000;
        let offset = 0;
        while (true) {
            const { data, error } = await supabase
                .from('product_hierarchy')
                .select('*')
                .range(offset, offset + PAGE_SIZE - 1);
            if (error || !data || data.length === 0) break;
            allData.push(...data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
        return toCamel(allData) as HierarchyEntry[];
    }

    async saveAll(entries: HierarchyEntry[]): Promise<void> {
        // 1. 全件削除（1000行制限を回避するためループ）
        await this.deleteAll();
        if (entries.length === 0) return;

        // 2. チャンク分割でinsert
        const payload = entries.map(e => toSnake({ ...e, id: e.id || crypto.randomUUID() }));
        const CHUNK_SIZE = 500;
        for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
            const chunk = payload.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase.from('product_hierarchy').insert(chunk);
            if (error) throw error;
        }
    }

    async add(entry: Omit<HierarchyEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<HierarchyEntry> {
        const id = crypto.randomUUID();
        const payload = toSnake({ ...entry, id });
        const { data, error } = await supabase.from('product_hierarchy').insert(payload).select().single();
        if (error) throw error;
        return toCamel(data) as HierarchyEntry;
    }

    async update(id: string, updates: Partial<HierarchyEntry>): Promise<void> {
        const payload = toSnake(updates);
        delete payload.id;
        delete payload.created_at;
        await supabase.from('product_hierarchy').update(payload).eq('id', id);
    }

    async delete(id: string): Promise<void> {
        await supabase.from('product_hierarchy').delete().eq('id', id);
    }

    async deleteAll(): Promise<void> {
        // Supabaseのdelete/selectもデフォルト1000行制限のためループで全件削除
        while (true) {
            const { data } = await supabase
                .from('product_hierarchy')
                .select('id')
                .limit(500);
            if (!data || data.length === 0) break;
            // 少数のIDでin句を構築（URL長制限回避）
            const ids = data.map((d: { id: string }) => d.id);
            const { error } = await supabase.from('product_hierarchy').delete().in('id', ids);
            if (error) throw error;
        }
    }
}

export const productHierarchyRepository = new ProductHierarchySupabaseRepository();

// System flags for initialization
export async function isInitialized(): Promise<boolean> {
    // If we have at least one store or product, consider initialized
    const [{ count: storesCount }, { count: productsCount }] = await Promise.all([
        supabase.from('stores').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true })
    ]);
    return (storesCount || 0) > 0 || (productsCount || 0) > 0;
}

export async function setInitialized(_value: boolean): Promise<void> {
    // No-op for DB, it's inferred from content
}

// テーブルの全件を1000行制限を回避して削除
async function deleteAllFromTable(table: string): Promise<void> {
    while (true) {
        const { data } = await supabase.from(table).select('id').limit(500);
        if (!data || data.length === 0) break;
        const { error } = await supabase.from(table).delete().in('id', data.map((d: { id: string }) => d.id));
        if (error) throw error;
    }
}

export async function clearAllData(): Promise<void> {
    await deleteAllFromTable('products');
    await deleteAllFromTable('stores');
    await deleteAllFromTable('fixtures');
    await deleteAllFromTable('shelf_blocks');
}

// バックアップ復元用: IDを保持したまま全データを一括復元
export async function restoreAllData(data: {
    products: any[];
    stores: any[];
    fixtures: any[];
    storeFixtures: any[];
    shelfBlocks: any[];
    standardPlanograms: any[];
    storePlanograms: any[];
    hierarchy: any[];
}): Promise<void> {
    const CHUNK_SIZE = 500;

    // テーブルごとの許可カラム（未知カラムをSupabaseに送らないため）
    const TABLE_COLUMNS: Record<string, string[]> = {
        products: ['id','jan','name','width','height','depth','category','image_url','sales_rank','sales_quantity','quantity','sales','gross_profit','traffic','spend_per_customer','division_code','division_name','division_sub_code','division_sub_name','line_code','line_name','department_code','department_name','category_code','category_name','sub_category_code','sub_category_name','segment_code','segment_name','sub_segment_code','sub_segment_name','created_at','updated_at'],
        stores: ['id','code','name','fmt','region','created_at','updated_at'],
        fixtures: ['id','name','width','height','depth','shelf_count','manufacturer','model_number','install_date','warranty_end_date','fixture_type','created_at'],
        store_fixture_placements: ['id','store_id','fixture_id','position_x','position_y','order','direction','zone','label','created_at'],
        shelf_blocks: ['id','name','description','block_type','width','height','shelf_count','created_at','updated_at'],
        shelf_block_products: ['id','block_id','product_id','shelf_index','position_x','face_count'],
        shelf_block_hierarchy_placements: ['id','block_id','hierarchy_level','hierarchy_code','hierarchy_name','shelf_index','position_x','width','face_count'],
        standard_planograms: ['id','name','fmt','base_store_id','fixture_type','width','height','shelf_count','start_date','end_date','description','created_at','updated_at'],
        standard_planogram_blocks: ['id','standard_planogram_id','block_id','position_x','position_y'],
        standard_planogram_products: ['id','standard_planogram_id','product_id','shelf_index','position_x','face_count'],
        standard_planogram_hierarchy_placements: ['id','standard_planogram_id','hierarchy_level','hierarchy_code','hierarchy_name','shelf_index','position_x','width','face_count','placed_block_id'],
        store_planograms: ['id','store_id','standard_planogram_id','status','width','height','shelf_count','warnings','blocks','created_at','updated_at','synced_at'],
        store_planogram_products: ['id','store_planogram_id','product_id','shelf_index','position_x','face_count','is_auto_generated','is_cut'],
        store_planogram_hierarchy_placements: ['id','store_planogram_id','hierarchy_level','hierarchy_code','hierarchy_name','shelf_index','position_x','width','face_count','is_auto_generated'],
    };

    function filterColumns(table: string, row: any): any {
        const allowed = TABLE_COLUMNS[table];
        if (!allowed) return row;
        const filtered: any = {};
        for (const col of allowed) {
            if (col in row) filtered[col] = row[col];
        }
        return filtered;
    }

    async function insertChunked(table: string, items: any[]) {
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE).map(item => filterColumns(table, item));
            const { error } = await supabase.from(table).insert(chunk);
            if (error) throw error;
        }
    }

    // 全データ削除（依存関係の順序: 子テーブルから）
    await storePlanogramRepository.clear();
    await standardPlanogramRepository.clear();
    await shelfBlockRepository.clear();
    await deleteAllFromTable('store_fixture_placements');
    await deleteAllFromTable('fixtures');
    await deleteAllFromTable('stores');
    await deleteAllFromTable('products');
    await productHierarchyRepository.deleteAll();

    // 復元（親テーブルから、IDを保持したままinsert）
    // シンプルテーブル
    if (data.products.length > 0) {
        await insertChunked('products', data.products.map(toSnake));
    }
    if (data.stores.length > 0) {
        await insertChunked('stores', data.stores.map(toSnake));
    }
    if (data.fixtures.length > 0) {
        await insertChunked('fixtures', data.fixtures.map(toSnake));
    }
    if (data.storeFixtures.length > 0) {
        await insertChunked('store_fixture_placements', data.storeFixtures.map(toSnake));
    }

    // 棚ブロック（親 + 子テーブル）: 親をバルクinsertし、子をまとめてinsert
    {
        const blockParents: any[] = [];
        const blockProducts: any[] = [];
        const blockHierarchies: any[] = [];
        for (const block of data.shelfBlocks) {
            const { productPlacements, hierarchyPlacements, ...blockData } = block;
            blockParents.push(toSnake(blockData));
            if (productPlacements) blockProducts.push(...productPlacements.map((p: any) => toSnake(p)));
            if (hierarchyPlacements) blockHierarchies.push(...hierarchyPlacements.map((h: any) => toSnake(h)));
        }
        if (blockParents.length > 0) await insertChunked('shelf_blocks', blockParents);
        if (blockProducts.length > 0) await insertChunked('shelf_block_products', blockProducts);
        if (blockHierarchies.length > 0) await insertChunked('shelf_block_hierarchy_placements', blockHierarchies);
    }

    // 標準棚割（親 + 子テーブル）: バルクinsert
    {
        const planParents: any[] = [];
        const planBlocks: any[] = [];
        const planProducts: any[] = [];
        const planHierarchies: any[] = [];
        for (const plan of data.standardPlanograms) {
            const { blocks, products, hierarchyPlacements, ...planData } = plan;
            planParents.push(toSnake(planData));
            if (blocks) planBlocks.push(...blocks.map((b: any) => toSnake(b)));
            if (products) planProducts.push(...products.map((p: any) => toSnake(p)));
            if (hierarchyPlacements) planHierarchies.push(...hierarchyPlacements.map((h: any) => toSnake(h)));
        }
        if (planParents.length > 0) await insertChunked('standard_planograms', planParents);
        if (planBlocks.length > 0) await insertChunked('standard_planogram_blocks', planBlocks);
        if (planProducts.length > 0) await insertChunked('standard_planogram_products', planProducts);
        if (planHierarchies.length > 0) await insertChunked('standard_planogram_hierarchy_placements', planHierarchies);
    }

    // 個店棚割（親 + 子テーブル）: バルクinsert
    {
        const planParents: any[] = [];
        const planProducts: any[] = [];
        const planHierarchies: any[] = [];
        for (const plan of data.storePlanograms) {
            const { products, hierarchyPlacements, ...planData } = plan;
            planParents.push(toSnake(planData));
            if (products) planProducts.push(...products.map((p: any) => toSnake(p)));
            if (hierarchyPlacements) planHierarchies.push(...hierarchyPlacements.map((h: any) => toSnake(h)));
        }
        if (planParents.length > 0) await insertChunked('store_planograms', planParents);
        if (planProducts.length > 0) await insertChunked('store_planogram_products', planProducts);
        if (planHierarchies.length > 0) await insertChunked('store_planogram_hierarchy_placements', planHierarchies);
    }

    // 階層データ
    if (data.hierarchy.length > 0) {
        await productHierarchyRepository.saveAll(data.hierarchy);
    }
}
