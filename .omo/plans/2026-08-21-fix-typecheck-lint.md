# Fix Typecheck Errors + Lint Warning

## Goal
Fix 5 pre-existing TS errors in `desktop-pet-page.js` and 1 ESLint warning in `desktop-pet.test.js`.

## Commits
1. `fix: 补 globals.d.ts 类型声明（DesktopPetCore/_container/_dpUnsub）+ 修 lint warning`

## Steps

### Step 1: globals.d.ts — 补 Window 接口声明

`js/globals.d.ts` line 464-488 (Window interface), add after `__desktopPetFamily`:

```ts
DesktopPetCore: any;
```

This fixes errors on `desktop-pet-page.js:132` and `:163` (`Property 'DesktopPetCore' does not exist on type 'Window'`).

### Step 2: globals.d.ts — 补 SonderCtx 接口声明

`js/globals.d.ts` line 186-192 (SonderCtx interface), add:

```ts
_container?: HTMLElement;
_dpUnsub?: () => void;
```

This fixes errors on `desktop-pet-page.js:209`, `:220`, `:223` (`Property '_container'/'_dpUnsub' does not exist on type 'SonderCtx'`).

### Step 3: desktop-pet.test.js — 修 lint warning

`tests/desktop-pet.test.js:681` — change:

```js
const { window, store } = boot();
```

to:

```js
const { store } = boot();
```

`window` is destructured but never used in this test (only `store` is used on lines 683-689).

### Step 4: Verify

- `npm test` — 622 项全绿
- `npm run typecheck` — 0 errors
- `npm run lint` — 0 warnings

### Step 5: Commit + Push

- `git commit -m "fix: 补 globals.d.ts 类型声明 + 修 lint warning"`
- `git push origin main`

## Files Changed
- `js/globals.d.ts` — +3 lines (2 interface members + 1 Window member)
- `tests/desktop-pet.test.js` — 1 line edit (remove unused `window` destructure)
