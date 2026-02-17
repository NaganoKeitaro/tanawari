import type { HierarchyEntry } from '../types/productHierarchy';

const STORAGE_KEY = 'tanawari_product_hierarchy';

class ProductHierarchyRepository {
    async getAll(): Promise<HierarchyEntry[]> {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }

    async saveAll(entries: HierarchyEntry[]): Promise<void> {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    async add(entry: Omit<HierarchyEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<HierarchyEntry> {
        const entries = await this.getAll();
        const newEntry: HierarchyEntry = {
            ...entry,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        entries.push(newEntry);
        await this.saveAll(entries);
        return newEntry;
    }

    async update(id: string, updates: Partial<HierarchyEntry>): Promise<void> {
        const entries = await this.getAll();
        const index = entries.findIndex(e => e.id === id);
        if (index !== -1) {
            entries[index] = {
                ...entries[index],
                ...updates,
                updatedAt: new Date().toISOString(),
            };
            await this.saveAll(entries);
        }
    }

    async delete(id: string): Promise<void> {
        const entries = await this.getAll();
        const filtered = entries.filter(e => e.id !== id);
        await this.saveAll(filtered);
    }

    async deleteAll(): Promise<void> {
        localStorage.removeItem(STORAGE_KEY);
    }
}

export const productHierarchyRepository = new ProductHierarchyRepository();
