// 棚割管理システム - メインアプリケーション
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { ProductMaster } from './pages/masters/ProductMaster';
import { FixtureMaster } from './pages/masters/FixtureMaster';
import { StoreMaster } from './pages/masters/StoreMaster';
import { StoreFixtureMaster } from './pages/masters/StoreFixtureMaster';
import { ShelfBlockEditor } from './pages/blocks/ShelfBlockEditor';
import { StandardPlanogramEditor } from './pages/planogram/StandardPlanogramEditor';
import { StorePlanogramBatch } from './pages/planogram/StorePlanogramBatch';
import { StorePlanogramEditor } from './pages/planogram/StorePlanogramEditor';

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          {/* ホーム */}
          <Route path="/" element={<HomePage />} />

          {/* マスタ管理 */}
          <Route path="/masters/products" element={<ProductMaster />} />
          <Route path="/masters/fixtures" element={<FixtureMaster />} />
          <Route path="/masters/stores" element={<StoreMaster />} />
          <Route path="/masters/store-fixtures" element={<StoreFixtureMaster />} />

          {/* 棚ブロック管理 */}
          <Route path="/blocks" element={<ShelfBlockEditor />} />

          {/* 棚割管理 */}
          <Route path="/planogram/standard" element={<StandardPlanogramEditor />} />
          <Route path="/planogram/store" element={<StorePlanogramBatch />} />
          <Route path="/planogram/store/:storeId" element={<StorePlanogramEditor />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
