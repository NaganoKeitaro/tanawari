import { supabase } from '../supabaseClient';
import type { IRepository } from './baseRepository';
import type {
    Product, Store, Fixture, StoreFixturePlacement, ShelfBlock,
    StandardPlanogram, StorePlanogram
} from '../types';

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
            newObj[snakeKey] = toSnake(obj[key]);
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
        const { data, error } = await supabase.from(this.tableName).select('*');
        if (error) {
            console.error(`Error fetching ${this.tableName}:`, error);
            return [];
        }
        return toCamel(data) as T[];
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

        const { data, error } = await supabase.from(this.tableName).update(payload).eq('id', id).select().single();
        if (error) return null;
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
        await supabase.from(this.tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
}

// --- Specialized Repositories ---

class ShelfBlockRepository implements IRepository<ShelfBlock> {
    async getAll(): Promise<ShelfBlock[]> {
        const { data, error } = await supabase.from('shelf_blocks').select(`
            *,
            shelf_block_products (*)
        `);
        if (error) return [];
        return data.map(d => {
            const block = toCamel(d);
            block.productPlacements = block.shelfBlockProducts || [];
            delete block.shelfBlockProducts;
            return block as ShelfBlock;
        });
    }

    async getById(id: string): Promise<ShelfBlock | null> {
        const { data, error } = await supabase.from('shelf_blocks').select(`*, shelf_block_products (*)`).eq('id', id).single();
        if (error || !data) return null;
        const block = toCamel(data);
        block.productPlacements = block.shelfBlockProducts || [];
        delete block.shelfBlockProducts;
        return block as ShelfBlock;
    }

    async create(item: Omit<ShelfBlock, 'id'>): Promise<ShelfBlock> {
        const id = crypto.randomUUID();
        const blockPayload = toSnake({ ...item, id });
        delete blockPayload.product_placements;

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
        return this.getById(id) as Promise<ShelfBlock>;
    }

    async update(id: string, item: Partial<ShelfBlock>): Promise<ShelfBlock | null> {
        const blockPayload = toSnake(item);
        delete blockPayload.product_placements;
        delete blockPayload.id;

        if (Object.keys(blockPayload).length > 0) {
            await supabase.from('shelf_blocks').update(blockPayload).eq('id', id);
        }

        if (item.productPlacements) {
            await supabase.from('shelf_block_products').delete().eq('block_id', id);
            if (item.productPlacements.length > 0) {
                const prodPayloads = item.productPlacements.map(p => toSnake({
                    ...p,
                    id: crypto.randomUUID(),
                    blockId: id
                }));
                await supabase.from('shelf_block_products').insert(prodPayloads);
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
        await supabase.from('shelf_blocks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
}

class StandardPlanogramRepository implements IRepository<StandardPlanogram> {
    async getAll(): Promise<StandardPlanogram[]> {
        const { data, error } = await supabase.from('standard_planograms').select(`
            *,
            standard_planogram_blocks (*),
            standard_planogram_products (*)
        `);
        if (error) return [];
        return data.map(d => {
            const plan = toCamel(d);
            plan.blocks = plan.standardPlanogramBlocks || [];
            plan.products = plan.standardPlanogramProducts || [];
            delete plan.standardPlanogramBlocks;
            delete plan.standardPlanogramProducts;
            return plan as StandardPlanogram;
        });
    }

    async getById(id: string): Promise<StandardPlanogram | null> {
        const { data, error } = await supabase.from('standard_planograms').select(`
            *,
            standard_planogram_blocks (*),
            standard_planogram_products (*)
        `).eq('id', id).single();
        if (error || !data) return null;
        const plan = toCamel(data);
        plan.blocks = plan.standardPlanogramBlocks || [];
        plan.products = plan.standardPlanogramProducts || [];
        delete plan.standardPlanogramBlocks;
        delete plan.standardPlanogramProducts;
        return plan as StandardPlanogram;
    }

    async create(item: Omit<StandardPlanogram, 'id'>): Promise<StandardPlanogram> {
        const id = crypto.randomUUID();
        const payload = toSnake({ ...item, id });
        delete payload.blocks;
        delete payload.products;

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
        return this.getById(id) as Promise<StandardPlanogram>;
    }

    async update(id: string, item: Partial<StandardPlanogram>): Promise<StandardPlanogram | null> {
        const payload = toSnake(item);
        delete payload.blocks;
        delete payload.products;
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
        await supabase.from('standard_planograms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
}

class StorePlanogramRepository implements IRepository<StorePlanogram> {
    async getAll(): Promise<StorePlanogram[]> {
        const { data, error } = await supabase.from('store_planograms').select(`
            *,
            store_planogram_products (*)
        `);
        if (error) return [];
        return data.map(d => {
            const plan = toCamel(d);
            plan.products = plan.storePlanogramProducts || [];
            delete plan.storePlanogramProducts;
            return plan as StorePlanogram;
        });
    }

    async getById(id: string): Promise<StorePlanogram | null> {
        const { data, error } = await supabase.from('store_planograms').select(`
            *,
            store_planogram_products (*)
        `).eq('id', id).single();
        if (error || !data) return null;
        const plan = toCamel(data);
        plan.products = plan.storePlanogramProducts || [];
        delete plan.storePlanogramProducts;
        return plan as StorePlanogram;
    }

    async create(item: Omit<StorePlanogram, 'id'>): Promise<StorePlanogram> {
        const id = crypto.randomUUID();
        const payload = toSnake({ ...item, id });
        delete payload.products;

        const { error } = await supabase.from('store_planograms').insert(payload);
        if (error) throw error;

        if (item.products && item.products.length > 0) {
            await supabase.from('store_planogram_products').insert(
                item.products.map(p => toSnake({ ...p, id: crypto.randomUUID(), storePlanogramId: id }))
            );
        }
        return this.getById(id) as Promise<StorePlanogram>;
    }

    async update(id: string, item: Partial<StorePlanogram>): Promise<StorePlanogram | null> {
        const payload = toSnake(item);
        delete payload.products;
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
        await supabase.from('store_planograms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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

export async function clearAllData(): Promise<void> {
    // Note: Due to FK constraints, order matters, but cascade handles it largely.
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('stores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('fixtures').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('shelf_blocks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
