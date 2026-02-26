// 棚割管理システム - リポジトリファクトリ（環境に応じた自動切り替え）
// Supabase環境変数が設定されていればSupabase、なければlocalStorageを使用

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const useSupabase = !!(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    supabaseAnonKey !== 'placeholder-anon-key'
);

// ログ出力で現在のモードを明示
console.log(
    `[RepositoryFactory] モード: ${useSupabase ? 'Supabase (本番)' : 'localStorage (ローカル)'}`,
    useSupabase
        ? { url: supabaseUrl }
        : { reason: 'Supabase環境変数が未設定のためlocalStorageを使用します' }
);

// 動的インポートで必要なモジュールだけロード
const repo = useSupabase
    ? await import('./supabaseRepository')
    : await import('./localStorageRepository');

// 各リポジトリをre-export
export const productRepository = repo.productRepository;
export const storeRepository = repo.storeRepository;
export const fixtureRepository = repo.fixtureRepository;
export const storeFixturePlacementRepository = repo.storeFixturePlacementRepository;
export const shelfBlockRepository = repo.shelfBlockRepository;
export const standardPlanogramRepository = repo.standardPlanogramRepository;
export const storePlanogramRepository = repo.storePlanogramRepository;
export const productHierarchyRepository = repo.productHierarchyRepository;

// ユーティリティ関数のre-export
export const isInitialized = repo.isInitialized;
export const setInitialized = repo.setInitialized;
export const clearAllData = repo.clearAllData;
