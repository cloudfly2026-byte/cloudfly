# CLOUD-338: Architecture & Implementation Blueprint
# Verificación de compilación y smoke test del módulo de Catálogo en Línea

## 1. System Context (from docker-compose-local.yml)

The `frontend-react` service is the Next.js frontend application:
- **Container**: `frontend-react`
- **Build context**: `./frontend_new`
- **Port**: `3000:3000`
- **Environment**: `NODE_ENV=development`, `ENVIRONMENT=development`
- **Networks**: `app-net`
- **Key env vars**: `NEXT_PUBLIC_API_URL=http://localhost:8080`, `NEXTAUTH_URL=http://localhost:3000`

The frontend depends on `backend-api` (port 8080) for API calls. The Catalog module
is a purely frontend feature using Next.js App Router with React Server Components,
`@tanstack/react-query` for data fetching, and `recharts` for metrics visualization.

## 2. Current State Analysis

### Files that EXIST (5 of 18):
1. ✅ `frontend_new/src/types/catalog.ts` (1103 bytes)
2. ✅ `frontend_new/src/services/catalog/websiteService.ts` (2714 bytes)
3. ✅ `frontend_new/src/data/demoMetrics.ts`
4. ✅ `frontend_new/src/hooks/catalog/useWebsiteStatus.ts` (1674 bytes)
5. ✅ `frontend_new/src/hooks/catalog/useSubdomainValidation.ts` (2121 bytes)

### Files that are MISSING (13 of 18):
1. ❌ `frontend_new/src/app/(dashboard)/tienda/page.tsx`
2. ❌ `frontend_new/src/app/(dashboard)/tienda/layout.tsx`
3. ❌ `frontend_new/src/app/(dashboard)/tienda/principal/page.tsx`
4. ❌ `frontend_new/src/components/catalog/WelcomeCard.tsx`
5. ❌ `frontend_new/src/components/catalog/SubdomainForm.tsx`
6. ❌ `frontend_new/src/components/catalog/ConstructionView.tsx`
7. ❌ `frontend_new/src/components/catalog/WebsiteDashboard.tsx`
8. ❌ `frontend_new/src/components/catalog/StatusToggle.tsx`
9. ❌ `frontend_new/src/components/catalog/DeleteStoreButton.tsx`
10. ❌ `frontend_new/src/components/catalog/metrics/VisitsChart.tsx`
11. ❌ `frontend_new/src/components/catalog/metrics/OriginsChart.tsx`
12. ❌ `frontend_new/src/components/catalog/metrics/TopPagesTable.tsx`
13. ❌ `frontend_new/src/components/catalog/metrics/BounceRateCard.tsx`

### Root Cause:
The directories `frontend_new/src/app/(dashboard)/tienda/` and
`frontend_new/src/components/catalog/` do not exist. The tickets CLOUD-334
through CLOUD-337 were documented as "complete" in Jira comments but the
actual files were never written to disk.

## 3. Implementation Plan

### Phase 1: Create Missing Files (CLOUD-343 - unblock)

#### 1a. Create `tienda` page and layout files:
```bash
mkdir -p "frontend_new/src/app/(dashboard)/tienda/principal"
mkdir -p "frontend_new/src/components/catalog/metrics"
```

#### 1b. Files to create (with dependencies):

**Tier 1 - No dependencies on other catalog files:**
- `frontend_new/src/app/(dashboard)/tienda/layout.tsx`
  - Simple layout wrapper using the existing dashboard layout pattern
  - Can reference `frontend_new/src/app/(dashboard)/layout.tsx` as template

- `frontend_new/src/components/catalog/WelcomeCard.tsx`
  - Standalone component with gradient purple design
  - Uses only MUI components already in the project

- `frontend_new/src/components/catalog/ConstructionView.tsx`
  - Simple placeholder component

- `frontend_new/src/components/catalog/StatusToggle.tsx`
  - Toggle switch component, depends on `types/catalog.ts` ✅

- `frontend_new/src/components/catalog/DeleteStoreButton.tsx`
  - Button with confirmation dialog

**Tier 2 - Depend on Tier 1 components:**
- `frontend_new/src/components/catalog/SubdomainForm.tsx`
  - Uses `useSubdomainValidation` hook ✅
  - Form with validation

- `frontend_new/src/components/catalog/WebsiteDashboard.tsx`
  - Composes WelcomeCard, StatusToggle, DeleteStoreButton
  - Uses `useWebsiteStatus` hook ✅

**Tier 3 - Metrics components (depend on `data/demoMetrics.ts` ✅):**
- `frontend_new/src/components/catalog/metrics/VisitsChart.tsx` (recharts)
- `frontend_new/src/components/catalog/metrics/OriginsChart.tsx` (recharts)
- `frontend_new/src/components/catalog/metrics/TopPagesTable.tsx`
- `frontend_new/src/components/catalog/metrics/BounceRateCard.tsx`

**Tier 4 - Page files (depend on all components):**
- `frontend_new/src/app/(dashboard)/tienda/page.tsx`
  - Main page composing WebsiteDashboard + metrics
- `frontend_new/src/app/(dashboard)/tienda/principal/page.tsx`
  - Redirect to `/dashboard/tienda`

### Phase 2: Install Dependencies (CLOUD-344 - prerequisite)
```bash
cd frontend_new
npm install @tanstack/react-query recharts framer-motion @mui/icons-material
```

### Phase 3: Build Verification (CLOUD-344)
```bash
cd frontend_new
npm run build
```
Expected: Clean build with no TypeScript errors.

### Phase 4: Smoke Test (CLOUD-345)
```bash
cd frontend_new
npm run dev
```
Then navigate to `http://localhost:3000/dashboard/tienda` and verify:
- Page loads without 404/500 errors
- WelcomeCard renders with purple gradient
- No browser console errors
- `/dashboard/tienda/principal` redirects to `/dashboard/tienda`

### Phase 5: Documentation & Close (CLOUD-346)
- Update Jira with results
- Mark acceptance criteria

## 4. Architecture Notes

### Component Hierarchy:
```
tienda/page.tsx
├── WebsiteDashboard.tsx
│   ├── WelcomeCard.tsx
│   ├── SubdomainForm.tsx (uses useSubdomainValidation hook)
│   ├── ConstructionView.tsx
│   ├── StatusToggle.tsx
│   └── DeleteStoreButton.tsx
└── Metrics Section
    ├── VisitsChart.tsx (recharts)
    ├── OriginsChart.tsx (recharts)
    ├── TopPagesTable.tsx
    └── BounceRateCard.tsx
```

### Data Flow:
- `websiteService.ts` → API calls to backend
- `useWebsiteStatus` hook → manages website state
- `useSubdomainValidation` hook → validates subdomain input
- `demoMetrics.ts` → static demo data for metrics
- `catalog.ts` → TypeScript type definitions

### Dependencies Required:
- `@tanstack/react-query` - data fetching/caching
- `recharts` - charts for metrics
- `framer-motion` - animations
- `@mui/icons-material` - icons

## 5. Risk Assessment

- **HIGH**: 13 of 18 files are missing. The previous tickets (CLOUD-334 through CLOUD-337)
  documented the code in Jira comments but never wrote the files to disk.
- **MEDIUM**: The `npm run build` may reveal additional import/dependency issues
  once files are created.
- **LOW**: The existing 5 files (types, services, hooks, data) provide a solid
  foundation - the remaining files follow standard Next.js patterns.

## 6. Recommended Next Steps

1. **Immediate**: Create all 13 missing files following the patterns established
   by the 5 existing files and the existing dashboard pages as reference.
2. **Then**: Run `npm install` for the required dependencies.
3. **Then**: Run `npm run build` to verify compilation.
4. **Then**: Run `npm run dev` and perform smoke test.
5. **Finally**: Document results and close CLOUD-338.
