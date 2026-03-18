/**
 * 管理画面 - エンドポイントテスト
 * 認証が必要なため、beforeEach で login() を呼び出します。
 *
 * ACL関連 API仕様:
 *   GET /d/_group?f → VtecxApp.Entry[] (グループ一覧)
 *     管理者のみ取得可。非管理者は 403 を返す。
 *     entry.link[0].___href にグループパスが入る。
 *     e.g. [{ link: [{ ___href: '/_group/$content' }] }, ...]
 *
 *   PUT /d/ → エンドポイント登録・更新
 *     contributor に ACL 情報を含める。
 *     e.g. contributor: [{ uri: 'urn:vte.cx:acl:/_group/$admin,CRUD' }]
 *
 * data-testid 一覧（ACL関連）:
 *   ep-modal              モーダル本体
 *   ep-name-input         エンドポイント名入力欄
 *   ep-name-error         エンドポイント名バリデーションエラー
 *   ep-save-button        保存（新規作成 or 更新）ボタン
 *   ep-table              エンドポイント一覧テーブル
 *   ep-col-name           エンドポイント名カラムヘッダ
 *   ep-row-{name}         エンドポイント行 (name は先頭の'/'を除いた値)
 *   add-ep-button         追加ボタン
 *   edit-button           編集ボタン
 *   delete-button         削除ボタン
 *   delete-confirm-dialog 削除確認ダイアログ
 *   delete-confirm-ok     削除確認OK
 */
import { test, expect } from '@playwright/test'
import { ENV } from '../config/env'
import { login } from '../helpers/auth'

const EP_URL = `${ENV.BASE_URL}/admin.html#/endpoint`

// ─── モックデータ ────────────────────────────────────────────

const MOCK_ENDPOINTS: any[] = [
  {
    id: '/users,1',
    title: 'ユーザー管理',
    summary: 'ユーザー情報を管理するエンドポイント',
    contributor: [{ uri: 'urn:vte.cx:acl:/_group/$admin,CRUD' }, { uri: 'urn:vte.cx:acl:+,R' }]
  },
  {
    id: '/items,1',
    title: '商品管理',
    summary: '',
    contributor: [{ uri: 'urn:vte.cx:acl:/_group/$admin,CRUD' }]
  },
  {
    id: '/_settings,1',
    title: 'システム設定',
    summary: 'system',
    contributor: [{ uri: 'urn:vte.cx:acl:/_group/$admin,CRUDE' }]
  }
]

const MOCK_GROUPS: any[] = [
  { link: [{ ___href: '/_group/$admin', ___rel: 'self' }] },
  { link: [{ ___href: '/_group/$content', ___rel: 'self' }] },
  { link: [{ ___href: '/_group/$useradmin', ___rel: 'self' }] },
  { link: [{ ___href: '/_group/myteam', ___rel: 'self' }] }
]

// ─── モックヘルパー ──────────────────────────────────────────

async function mockEndpoints(page: any, endpoints = MOCK_ENDPOINTS) {
  await page.route('**/d/**f**l=*', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(endpoints)
    })
  )
}

async function mockGroups(page: any, groups = MOCK_GROUPS) {
  await page.route('**/d/_group?f**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(groups)
    })
  )
}

async function mockGroupsForbidden(page: any) {
  await page.route('**/d/_group?f**', (route: any) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ feed: { title: 'Forbidden' } })
    })
  )
}

async function mockDeleteEpSuccess(page: any) {
  await page.route('**/d/**_rf', (route: any) => {
    if (route.request().method() === 'DELETE')
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    else route.continue()
  })
}

// モーダルを開く共通ヘルパー
async function openCreateModal(page: any) {
  await page.locator('[data-testid="add-ep-button"]').last().click()
  await expect(page.locator('[data-testid="ep-modal"]')).toBeVisible()
}

async function openEditModal(page: any, rowTestId: string) {
  await page.click(`[data-testid="${rowTestId}"] [data-testid="edit-button"]`)
  await expect(page.locator('[data-testid="ep-modal"]')).toBeVisible()
}

// モーダル内のグループ検索フィールド
function groupSearchInput(page: any) {
  return page.locator('[data-testid="ep-modal"] input[placeholder="グループを検索して追加…"]')
}

// モーダル内ドロップダウンのリストアイテムをラベルで選択
async function selectGroupFromDropdown(page: any, label: string) {
  const modal = page.locator('[data-testid="ep-modal"]')
  await modal.locator('.MuiPaper-root .MuiListItemButton-root', { hasText: label }).click()
}

// ── E2E テスト（既存機能）──────────────────────────────────
test.describe('管理画面 - エンドポイント - E2E（既存機能）', () => {
  test.beforeEach(async ({ page }) => {
    await mockEndpoints(page)
    await mockGroups(page)
    await login(page, EP_URL)
  })

  // No.1
  test('エンドポイント一覧が表示される', async ({ page }) => {
    await expect(page.locator('[data-testid="ep-table"]')).toBeVisible()
    await expect(page.locator('[data-testid="ep-col-name"]')).toBeVisible()
  })

  // No.2
  test('/_始まりはグレー背景で編集削除ボタン非表示', async ({ page }) => {
    const sysRow = page.locator('[data-testid="ep-row-_settings"]')
    await expect(sysRow).toHaveCSS('background-color', 'rgb(245, 245, 245)')
    await expect(sysRow.locator('[data-testid="edit-button"]')).not.toBeVisible()
    await expect(sysRow.locator('[data-testid="delete-button"]')).not.toBeVisible()
  })

  // No.3
  test('「追加」ボタンでモーダルが開く', async ({ page }) => {
    await openCreateModal(page)
  })

  // No.4
  test('数字始まりでエラーメッセージ表示', async ({ page }) => {
    await openCreateModal(page)
    await page.fill('[data-testid="ep-name-input"]', '1endpoint')
    await expect(page.locator('[data-testid="ep-name-error"]')).toContainText(
      'エンドポイント名は半角英字から開始してください。'
    )
  })

  // No.5
  test('編集ボタンでモーダルが開き既存値が入力済み', async ({ page }) => {
    await openEditModal(page, 'ep-row-users')
    await expect(page.locator('[data-testid="ep-name-input"]')).toHaveValue('users')
    await expect(page.locator('[data-testid="ep-name-input"]')).toBeDisabled()
  })

  // No.6
  test('削除ボタンで確認ダイアログが開く', async ({ page }) => {
    await page.click('[data-testid="ep-row-users"] [data-testid="delete-button"]')
    await expect(page.locator('[data-testid="delete-confirm-dialog"]')).toBeVisible()
  })

  // No.7
  test('OKで削除が実行される', async ({ page }) => {
    await mockDeleteEpSuccess(page)
    await mockEndpoints(page, [
      {
        id: '/_settings,1',
        title: 'システム設定',
        summary: 'system',
        contributor: [{ uri: 'urn:vte.cx:acl:/_group/$admin,CRUDE' }]
      }
    ])
    await page.click('[data-testid="ep-row-users"] [data-testid="delete-button"]')
    await page.click('[data-testid="delete-confirm-ok"]')
    await expect(page.locator('[data-testid="ep-row-users"]')).not.toBeVisible()
  })
})

// ── E2E テスト（ACL機能）────────────────────────────────────
test.describe('管理画面 - エンドポイント - E2E（ACL）', () => {
  test.beforeEach(async ({ page }) => {
    await mockEndpoints(page)
    await mockGroups(page)
    await login(page, EP_URL)
  })

  // No.8
  test('新規作成モーダルにACL設定エリアが表示される', async ({ page }) => {
    await openCreateModal(page)
    const modal = page.locator('[data-testid="ep-modal"]')
    await expect(modal.locator('text=ACL設定（グループ権限）')).toBeVisible()
  })

  // No.9
  test('新規作成時にサービス管理者（$admin）がデフォルトで表示され変更不可バッジがある', async ({
    page
  }) => {
    await openCreateModal(page)
    const modal = page.locator('[data-testid="ep-modal"]')
    await expect(modal.locator('text=サービス管理者')).toBeVisible()
    await expect(modal.locator('text=変更不可')).toBeVisible()
  })

  // No.10
  test('$adminカードには削除ボタンが表示されない（readonly）', async ({ page }) => {
    await openCreateModal(page)
    const modal = page.locator('[data-testid="ep-modal"]')
    await expect(modal.locator('[aria-label="このグループを削除"]')).not.toBeVisible()
  })

  // No.11
  test('グループ検索でグループ一覧が表示される', async ({ page }) => {
    await openCreateModal(page)
    await groupSearchInput(page).fill('コンテンツ')
    const dropdown = page.locator('[data-testid="ep-modal"] .MuiPaper-root')
    await expect(dropdown.locator('text=コンテンツ管理者')).toBeVisible()
  })

  // No.12
  test('グループ検索でサービス管理者（$admin）がドロップダウンに表示されない', async ({ page }) => {
    await openCreateModal(page)
    await groupSearchInput(page).fill('admin')
    const dropdown = page.locator('[data-testid="ep-modal"] .MuiPaper-root')
    // ドロップダウン内にサービス管理者が表示されない
    await expect(dropdown.locator('text=サービス管理者')).not.toBeVisible()
  })

  // No.13
  test('グループを追加するとカードが表示される', async ({ page }) => {
    await openCreateModal(page)
    await groupSearchInput(page).fill('コンテンツ')
    await selectGroupFromDropdown(page, 'コンテンツ管理者')
    const modal = page.locator('[data-testid="ep-modal"]')
    // 削除ボタン付きのカードが追加される
    await expect(modal.locator('[aria-label="このグループを削除"]')).toBeVisible()
  })

  // No.14
  test('「共通」セクションに特殊グループが表示される', async ({ page }) => {
    await openCreateModal(page)
    await groupSearchInput(page).click()
    const dropdown = page.locator('[data-testid="ep-modal"] .MuiPaper-root')
    await expect(dropdown.locator('text=共通')).toBeVisible()
    await expect(dropdown.locator('text=ログイン可能な全ユーザ')).toBeVisible()
    await expect(dropdown.locator('text=全てのユーザ（未ログイン含む）')).toBeVisible()
  })

  // No.15
  test('「グループ」セクションにAPIで取得したグループが表示される', async ({ page }) => {
    await openCreateModal(page)
    await groupSearchInput(page).click()
    const dropdown = page.locator('[data-testid="ep-modal"] .MuiPaper-root')
    await expect(dropdown.locator('text=グループ').first()).toBeVisible()
    await expect(
      dropdown.locator('.MuiListItemButton-root', { hasText: 'myteam' }).first()
    ).toBeVisible()
  })

  // No.16
  test('追加したグループにCRUDを選択しないと保存ボタンが非活性', async ({ page }) => {
    await openCreateModal(page)
    await page.fill('[data-testid="ep-name-input"]', 'newep')
    await groupSearchInput(page).fill('コンテンツ')
    await selectGroupFromDropdown(page, 'コンテンツ管理者')
    await expect(page.locator('[data-testid="ep-save-button"]')).toBeDisabled()
  })

  // No.17
  test('追加したグループにCRUDを1つ選択すると保存ボタンが活性', async ({ page }) => {
    await openCreateModal(page)
    await page.fill('[data-testid="ep-name-input"]', 'newep')
    await groupSearchInput(page).fill('コンテンツ')
    await selectGroupFromDropdown(page, 'コンテンツ管理者')
    // ドロップダウンが閉じるのを待つ
    await expect(page.locator('[data-testid="ep-modal"] .MuiPaper-root')).not.toBeVisible()
    // 権限セルの data-testid: perm-cell-{group_escaped}-{key}
    // /_group/$content → __group__content (/ と $ が _ に変換)
    await page.locator('[data-testid="perm-cell-__group__content-R"]').click()
    await expect(page.locator('[data-testid="ep-save-button"]')).toBeEnabled()
  })

  // No.18
  test('Eのみ選択でも保存ボタンが非活性', async ({ page }) => {
    await openCreateModal(page)
    await page.fill('[data-testid="ep-name-input"]', 'newep')
    await groupSearchInput(page).fill('コンテンツ')
    await selectGroupFromDropdown(page, 'コンテンツ管理者')
    // ドロップダウンが閉じるのを待つ
    await expect(page.locator('[data-testid="ep-modal"] .MuiPaper-root')).not.toBeVisible()
    await page.locator('[data-testid="perm-cell-__group__content-E"]').click()
    await expect(page.locator('[data-testid="ep-save-button"]')).toBeDisabled()
  })

  // No.19
  test('グループ追加後に削除ボタンでカードが消える', async ({ page }) => {
    await openCreateModal(page)
    await groupSearchInput(page).fill('コンテンツ')
    await selectGroupFromDropdown(page, 'コンテンツ管理者')
    const modal = page.locator('[data-testid="ep-modal"]')
    await modal.locator('[aria-label="このグループを削除"]').click()
    await expect(modal.locator('[aria-label="このグループを削除"]')).not.toBeVisible()
  })

  // No.20
  test('グループ一覧取得中はインジケーターが表示される', async ({ page }) => {
    await page.route('**/d/_group?f**', async (route: any) => {
      await new Promise(r => setTimeout(r, 800))
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GROUPS)
      })
    })
    await openCreateModal(page)
    const modal = page.locator('[data-testid="ep-modal"]')
    await expect(modal.locator('text=グループ一覧を取得中…')).toBeVisible()
  })

  // No.21
  test('403エラー時にACL設定不可メッセージが表示される', async ({ page }) => {
    await page.unroute('**/d/_group?f**')
    await mockGroupsForbidden(page)
    await openCreateModal(page)
    const modal = page.locator('[data-testid="ep-modal"]')
    await expect(modal.locator('text=ACL設定は管理者のみ利用できます')).toBeVisible()
    await expect(modal.locator('input[placeholder="グループを検索して追加…"]')).not.toBeVisible()
  })

  // No.22
  test('エンドポイント一覧の権限列にバッジ（Chip）が表示される', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const usersRow = page.locator('[data-testid="ep-row-users"]')
    await expect(usersRow.locator('.MuiChip-root').first()).toBeVisible()
  })

  // No.23
  test('編集モーダルで既存のACL設定が復元される', async ({ page }) => {
    await openEditModal(page, 'ep-row-users')
    const modal = page.locator('[data-testid="ep-modal"]')
    // $admin カードのタイトル（noWrap付き）
    await expect(
      modal.locator('p.MuiTypography-noWrap', { hasText: 'サービス管理者' })
    ).toBeVisible()
    // + カード（ログイン可能な全ユーザ）のタイトル（noWrap付き）
    await expect(
      modal.locator('p.MuiTypography-noWrap', { hasText: 'ログイン可能な全ユーザ' })
    ).toBeVisible()
  })

  // No.24
  test('グループの並び順は*→+→$useradmin→$content→その他の順になる', async ({ page }) => {
    await openCreateModal(page)
    await groupSearchInput(page).click()
    const dropdown = page.locator('[data-testid="ep-modal"] .MuiPaper-root')
    const listItems = dropdown.locator('.MuiListItemButton-root')
    await expect(listItems.first()).toBeVisible()
    await expect(listItems.nth(0)).toContainText('全てのユーザ（未ログイン含む）')
    await expect(listItems.nth(1)).toContainText('ログイン可能な全ユーザ')
  })

  // No.25
  test('新規作成時にEP名が空の場合は保存ボタンが非活性', async ({ page }) => {
    await openCreateModal(page)
    await expect(page.locator('[data-testid="ep-save-button"]')).toBeDisabled()
  })
})

// ── 単体テスト（既存機能）──────────────────────────────────
test.describe('管理画面 - エンドポイント - 単体テスト', () => {
  test.beforeEach(async ({ page }) => {
    await mockEndpoints(page)
    await mockGroups(page)
    await login(page, EP_URL)
    await openCreateModal(page)
  })

  // No.26
  test('有効なEP名入力で保存ボタンが活性', async ({ page }) => {
    await page.fill('[data-testid="ep-name-input"]', 'validendpoint')
    await expect(page.locator('[data-testid="ep-save-button"]')).toBeEnabled()
  })

  // No.27
  test('不正なEP名で保存ボタンが非活性', async ({ page }) => {
    await page.fill('[data-testid="ep-name-input"]', '1endpoint')
    await expect(page.locator('[data-testid="ep-save-button"]')).toBeDisabled()
  })

  // No.28
  test('EP名：英小文字のみ → エラーなし', async ({ page }) => {
    await page.fill('[data-testid="ep-name-input"]', 'myendpoint')
    await expect(page.locator('[data-testid="ep-name-error"]')).not.toBeVisible()
  })

  // No.29
  test('EP名：数字始まり → エラー表示', async ({ page }) => {
    await page.fill('[data-testid="ep-name-input"]', '1endpoint')
    await expect(page.locator('[data-testid="ep-name-error"]')).toBeVisible()
  })

  // No.30
  test('EP名：空文字 → 保存ボタン非活性', async ({ page }) => {
    await expect(page.locator('[data-testid="ep-save-button"]')).toBeDisabled()
  })

  // No.31
  test('数字始まりエラーメッセージの文言が正確', async ({ page }) => {
    await page.fill('[data-testid="ep-name-input"]', '1endpoint')
    await expect(page.locator('[data-testid="ep-name-error"]')).toHaveText(
      'エンドポイント名は半角英字から開始してください。'
    )
  })

  // No.32
  test('/_始まりEPはグレー背景', async ({ page }) => {
    await page.locator('[data-testid="ep-modal"] button[aria-label="close"]').click()
    await expect(page.locator('[data-testid="ep-row-_settings"]')).toHaveCSS(
      'background-color',
      'rgb(245, 245, 245)'
    )
  })

  // No.33
  test('/_始まりEPには編集ボタンが表示されない', async ({ page }) => {
    await page.locator('[data-testid="ep-modal"] button[aria-label="close"]').click()
    await expect(
      page.locator('[data-testid="ep-row-_settings"] [data-testid="edit-button"]')
    ).not.toBeVisible()
  })
})

// ── 単体テスト（ACL機能）────────────────────────────────────
test.describe('管理画面 - エンドポイント - 単体テスト（ACL）', () => {
  test.beforeEach(async ({ page }) => {
    await mockEndpoints(page)
    await mockGroups(page)
    await login(page, EP_URL)
  })

  // No.34
  test('$adminは常に先頭に表示され「変更不可」バッジがある', async ({ page }) => {
    await openCreateModal(page)
    const modal = page.locator('[data-testid="ep-modal"]')
    await expect(modal.locator('text=変更不可').first()).toBeVisible()
  })

  // No.35
  test('グループ検索は名前でフィルタリングできる', async ({ page }) => {
    await openCreateModal(page)
    await groupSearchInput(page).fill('ユーザ管')
    const dropdown = page.locator('[data-testid="ep-modal"] .MuiPaper-root')
    await expect(dropdown.locator('text=ユーザ管理者')).toBeVisible()
    await expect(dropdown.locator('text=コンテンツ管理者')).not.toBeVisible()
  })

  // No.36
  test('グループ検索はグループパスでフィルタリングできる', async ({ page }) => {
    await openCreateModal(page)
    await groupSearchInput(page).fill('$content')
    const dropdown = page.locator('[data-testid="ep-modal"] .MuiPaper-root')
    await expect(dropdown.locator('text=コンテンツ管理者')).toBeVisible()
    await expect(dropdown.locator('text=ユーザ管理者')).not.toBeVisible()
  })

  // No.37
  test('追加済みのグループはドロップダウンで「追加済」と表示される', async ({ page }) => {
    await openCreateModal(page)
    await groupSearchInput(page).fill('コンテンツ')
    await selectGroupFromDropdown(page, 'コンテンツ管理者')
    await groupSearchInput(page).fill('コンテンツ')
    const dropdown = page.locator('[data-testid="ep-modal"] .MuiPaper-root')
    await expect(dropdown.locator('text=追加済')).toBeVisible()
  })

  // No.38
  test('すべてのグループが追加済みの場合に検索フィールドが無効化される', async ({ page }) => {
    await openCreateModal(page)
    const modal = page.locator('[data-testid="ep-modal"]')
    // 通常グループ（$admin除く）を追加
    for (const label of ['コンテンツ管理者', 'ユーザ管理者', 'myteam']) {
      await groupSearchInput(page).fill(label.slice(0, 3))
      await selectGroupFromDropdown(page, label)
    }
    // 特殊グループを追加（ドロップダウン内に絞ってクリック）
    for (const label of ['全てのユーザ（未ログイン含む）', 'ログイン可能な全ユーザ']) {
      await groupSearchInput(page).fill(label.slice(0, 3))
      await modal.locator('.MuiPaper-root .MuiListItemButton-root', { hasText: label }).click()
    }
    await expect(
      modal.locator('input[placeholder="すべてのグループが追加済みです"]')
    ).toBeDisabled()
  })

  // No.39
  test('エンドポイント一覧の権限Chipは同じ横幅で揃っている', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const chips = page.locator('[data-testid="ep-row-users"] .MuiChip-root')
    await expect(chips.first()).toBeVisible()
    const firstBox = await chips.nth(0).boundingBox()
    const secondBox = await chips.nth(1).boundingBox()
    if (firstBox && secondBox) {
      expect(Math.abs(firstBox.width - secondBox.width)).toBeLessThan(1)
    }
  })

  // No.40
  test('グループ追加後も並び順が維持される（$admin→+→$content順）', async ({ page }) => {
    await openCreateModal(page)
    const modal = page.locator('[data-testid="ep-modal"]')
    // コンテンツ管理者を先に追加
    await groupSearchInput(page).fill('コンテンツ')
    await selectGroupFromDropdown(page, 'コンテンツ管理者')
    // ログイン可能な全ユーザを後から追加（ドロップダウン内に絞ってクリック）
    await groupSearchInput(page).fill('ログイン')
    await modal
      .locator('.MuiPaper-root .MuiListItemButton-root', {
        hasText: 'ログイン可能な全ユーザ'
      })
      .click()
    // 削除ボタンが2つある（+カードと$contentカード）
    await expect(modal.locator('[aria-label="このグループを削除"]')).toHaveCount(2)
    // ACLカードエリア内のカードタイトル（MuiTypography-body2 noWrap）の順番を確認
    // noWrap付きの body2 がカードのグループ名ラベルに対応する
    const cardTitles = await modal.locator('p.MuiTypography-noWrap').allTextContents()
    const adminIdx = cardTitles.findIndex(t => t.includes('サービス管理者'))
    const plusIdx = cardTitles.findIndex(t => t.includes('ログイン可能な全ユーザ'))
    const contentIdx = cardTitles.findIndex(t => t.includes('コンテンツ管理者'))
    expect(adminIdx).toBeGreaterThanOrEqual(0)
    expect(plusIdx).toBeGreaterThanOrEqual(0)
    expect(contentIdx).toBeGreaterThanOrEqual(0)
    expect(adminIdx).toBeLessThan(plusIdx)
    expect(plusIdx).toBeLessThan(contentIdx)
  })
})
