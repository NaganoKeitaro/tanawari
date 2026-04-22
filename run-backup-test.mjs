// バックアップ/復旧 E2Eテスト実行スクリプト
// Usage: node run-backup-test.mjs
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5175';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // コンソール出力をキャプチャ
    const logs = [];
    page.on('console', msg => {
        const text = msg.text();
        logs.push(text);
        console.log(text);
    });
    page.on('pageerror', err => {
        console.error('PAGE ERROR:', err.message);
    });

    console.log('ページを開いています...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    console.log('ページ読み込み完了。テストを実行中...\n');

    // テストモジュールをインポートして実行
    await page.evaluate(async () => {
        const mod = await import('/src/tests/backupRestoreTest.ts');
        await mod.runAllTests();
    });

    // テスト完了を待機
    await page.waitForTimeout(2000);

    await browser.close();

    // 結果判定
    const hasFailure = logs.some(l => l.includes('❌'));
    process.exit(hasFailure ? 1 : 0);
}

run().catch(e => {
    console.error('テスト実行エラー:', e);
    process.exit(1);
});
