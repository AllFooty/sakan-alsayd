import type { UserRole } from './providers';

export const ALL_ROLES: readonly UserRole[] = [
  'super_admin',
  'deputy_general_manager',
  'branch_manager',
  'maintenance_manager',
  'transportation_manager',
  'finance_manager',
  'maintenance_staff',
  'transportation_staff',
  'supervision_staff',
  'finance_staff',
] as const;

export type Access = 'full' | 'scoped' | 'none';

export type ScopeKey =
  | 'assignedBuilding'
  | 'ownTasks'
  | 'assignedResidents';

export type NoteKey = 'apiOnlyDbBlocks' | 'noApiYet';

export interface PermissionRow {
  key: string;
  scopeNoteKey?: ScopeKey;
  // Row-level annotation, separate from scope. Use for cross-layer divergences
  // (e.g. API allows but RLS blocks) or unbuilt-yet endpoints.
  noteKey?: NoteKey;
  access: Partial<Record<UserRole, Access>>;
  source: string[];
}

export interface PermissionGroup {
  key: string;
  rows: PermissionRow[];
}

const ADMIN_TIER: Pick<Record<UserRole, Access>, 'super_admin' | 'deputy_general_manager'> = {
  super_admin: 'full',
  deputy_general_manager: 'full',
};

export const PERMISSIONS_MATRIX: PermissionGroup[] = [
  {
    key: 'bookings',
    rows: [
      {
        key: 'bookings.list',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          supervision_staff: 'full',
          finance_staff: 'full',
          finance_manager: 'full',
        },
        source: [
          'supabase/migrations/012_role_expansion_rls.sql:144-150',
          'src/app/api/booking-requests/route.ts:25-30',
        ],
      },
      {
        key: 'bookings.update',
        // The API gate at booking-requests/[id]/route.ts allows finance_staff /
        // finance_manager, but RLS bookings_staff_update (002:215-220) blocks
        // them. They are marked `scoped` with the apiOnlyDbBlocks note so the
        // matrix surfaces this divergence instead of pretending it's clean.
        noteKey: 'apiOnlyDbBlocks',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          supervision_staff: 'full',
          finance_staff: 'scoped',
          finance_manager: 'scoped',
        },
        source: [
          'supabase/migrations/002_rls.sql:215-220',
          'src/app/api/booking-requests/[id]/route.ts:45-50',
        ],
      },
      {
        key: 'bookings.delete',
        access: { ...ADMIN_TIER },
        source: ['src/app/api/booking-requests/[id]/route.ts:130'],
      },
      {
        key: 'bookings.export',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          finance_manager: 'full',
        },
        source: ['src/app/api/booking-requests/route.ts:46-53'],
      },
      {
        key: 'bookings.skipTransition',
        access: { ...ADMIN_TIER },
        source: ['src/app/api/booking-requests/[id]/route.ts:76-77'],
      },
      {
        key: 'bookings.notesRead',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          supervision_staff: 'full',
          finance_staff: 'full',
          finance_manager: 'full',
        },
        source: ['supabase/migrations/012_role_expansion_rls.sql:155-161'],
      },
      {
        key: 'bookings.notesWrite',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          supervision_staff: 'full',
          finance_staff: 'full',
          finance_manager: 'full',
        },
        source: ['supabase/migrations/012_role_expansion_rls.sql:163-169'],
      },
    ],
  },
  {
    key: 'maintenance',
    rows: [
      {
        key: 'maintenance.list',
        scopeNoteKey: 'assignedBuilding',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          supervision_staff: 'scoped',
          maintenance_manager: 'scoped',
          maintenance_staff: 'scoped',
        },
        source: [
          'supabase/migrations/002_rls.sql:254-256',
          'supabase/migrations/012_role_expansion_rls.sql:172-179',
          'src/app/api/maintenance-requests/route.ts:24-30',
        ],
      },
      {
        key: 'maintenance.update',
        scopeNoteKey: 'assignedBuilding',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          supervision_staff: 'scoped',
          maintenance_manager: 'scoped',
          maintenance_staff: 'scoped',
        },
        source: [
          'supabase/migrations/002_rls.sql:262-264',
          'supabase/migrations/012_role_expansion_rls.sql:181-188',
          'src/app/api/maintenance-requests/[id]/route.ts:47-53',
        ],
      },
      {
        key: 'maintenance.delete',
        access: { ...ADMIN_TIER },
        source: ['src/app/api/maintenance-requests/[id]/route.ts:142'],
      },
      {
        key: 'maintenance.export',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          maintenance_manager: 'full',
        },
        source: ['src/app/api/maintenance-requests/route.ts:47-54'],
      },
      {
        key: 'maintenance.skipTransition',
        access: { ...ADMIN_TIER },
        source: ['src/app/api/maintenance-requests/[id]/route.ts:78-79'],
      },
      {
        key: 'maintenance.notesRead',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          supervision_staff: 'full',
          maintenance_manager: 'full',
          maintenance_staff: 'full',
        },
        source: ['supabase/migrations/012_role_expansion_rls.sql:191-197'],
      },
      {
        key: 'maintenance.notesWrite',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          supervision_staff: 'full',
          maintenance_manager: 'full',
          maintenance_staff: 'full',
        },
        source: ['supabase/migrations/012_role_expansion_rls.sql:199-205'],
      },
      {
        key: 'maintenance.photosDelete',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          maintenance_manager: 'full',
          maintenance_staff: 'full',
        },
        source: ['supabase/migrations/012_role_expansion_rls.sql:211-225'],
      },
    ],
  },
  {
    key: 'buildings',
    rows: [
      {
        key: 'buildings.list',
        // Admin tier: full read. Other roles: read scoped to assigned
        // buildings via the admin list API. RLS itself permits all auth
        // users to SELECT all buildings (used by the public-facing API),
        // but the admin surface narrows non-admin-tier to their assignments.
        scopeNoteKey: 'assignedBuilding',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          maintenance_manager: 'scoped',
          transportation_manager: 'scoped',
          finance_manager: 'scoped',
          maintenance_staff: 'scoped',
          transportation_staff: 'scoped',
          supervision_staff: 'scoped',
          finance_staff: 'scoped',
        },
        source: [
          'supabase/migrations/002_rls.sql:90-91',
          'src/app/api/buildings/route.ts:6-13',
          'src/app/api/admin/buildings/route.ts:51-86',
          'src/app/api/admin/buildings/[id]/route.ts:31-62',
        ],
      },
      {
        key: 'buildings.update',
        // Admin tier: full. branch_manager: scoped to assigned buildings via
        // PATCH gate (auth allows branch_manager, then `getAssignedBuildingIds`
        // narrows). RLS at 002_rls.sql:101-104 still permits other staff
        // roles to update assigned buildings, but the admin API does not
        // expose that path — so the matrix reflects API reality.
        scopeNoteKey: 'assignedBuilding',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
        },
        source: [
          'supabase/migrations/002_rls.sql:101-104',
          'src/app/api/admin/buildings/[id]/route.ts:174-193',
        ],
      },
      {
        key: 'buildings.create',
        access: { ...ADMIN_TIER },
        source: [
          'supabase/migrations/002_rls.sql:96-99',
          'supabase/migrations/012_role_expansion_rls.sql:42-47',
          'src/app/api/admin/buildings/route.ts:233-237',
        ],
      },
      {
        key: 'buildings.delete',
        // Soft-delete via `is_active=false`; no hard-delete API exists.
        // Admin tier only.
        access: { ...ADMIN_TIER },
        source: [
          'supabase/migrations/002_rls.sql:96-99',
          'supabase/migrations/012_role_expansion_rls.sql:42-47',
          'src/app/api/admin/buildings/[id]/route.ts:388-402',
        ],
      },
      {
        key: 'buildings.photosUpload',
        scopeNoteKey: 'assignedBuilding',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
        },
        source: [
          'supabase/migrations/016_buildings_photos_bucket.sql',
          'src/app/api/uploads/building-photo/route.ts:20-56',
        ],
      },
      {
        key: 'buildings.photosDelete',
        scopeNoteKey: 'assignedBuilding',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
        },
        source: [
          'supabase/migrations/016_buildings_photos_bucket.sql',
          'src/app/api/uploads/building-photo/route.ts:110-132',
        ],
      },
    ],
  },
  {
    key: 'rooms',
    rows: [
      {
        key: 'rooms.list',
        // Mirrors buildings.list — RLS lets all auth users SELECT rooms (the
        // public site uses this), but the admin API narrows non-admin-tier
        // to their assigned buildings.
        scopeNoteKey: 'assignedBuilding',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          maintenance_manager: 'scoped',
          transportation_manager: 'scoped',
          finance_manager: 'scoped',
          maintenance_staff: 'scoped',
          transportation_staff: 'scoped',
          supervision_staff: 'scoped',
          finance_staff: 'scoped',
        },
        source: [
          'supabase/migrations/002_rls.sql:110-111',
          'src/app/api/admin/rooms/route.ts:69-96',
          'src/app/api/admin/rooms/[id]/route.ts:52-98',
        ],
      },
      {
        key: 'rooms.create',
        // POST is admin-tier only (mirror of POST /api/admin/buildings).
        // RLS at 002_rls.sql:122-124 still permits other roles to insert
        // into assigned buildings, but no API exposes that path.
        access: { ...ADMIN_TIER },
        source: [
          'supabase/migrations/002_rls.sql:122-124',
          'src/app/api/admin/rooms/route.ts:182-189',
        ],
      },
      {
        key: 'rooms.update',
        // PATCH allows admin tier + branch_manager scoped to the room's
        // building (looked up via rooms.building_id then
        // getAssignedBuildingIds). Other roles have no admin-API path.
        scopeNoteKey: 'assignedBuilding',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
        },
        source: [
          'supabase/migrations/002_rls.sql:126-129',
          'src/app/api/admin/rooms/[id]/route.ts:196-234',
        ],
      },
      {
        key: 'rooms.delete',
        // Hard-delete; admin tier only. Postgres FK
        // `room_assignments.room_id ON DELETE RESTRICT` blocks delete for
        // any room with assignment history (surfaced to the UI as
        // `roomHasAssignments`). Use `room_status='maintenance'` to take a
        // room offline instead.
        access: { ...ADMIN_TIER },
        source: [
          'supabase/migrations/002_rls.sql:131-133',
          'src/app/api/admin/rooms/[id]/route.ts:355-370',
        ],
      },
    ],
  },
  {
    key: 'residents',
    rows: [
      {
        key: 'residents.list',
        scopeNoteKey: 'assignedResidents',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          maintenance_manager: 'scoped',
          transportation_manager: 'scoped',
          finance_manager: 'scoped',
          maintenance_staff: 'scoped',
          transportation_staff: 'scoped',
          supervision_staff: 'scoped',
          finance_staff: 'scoped',
        },
        source: ['supabase/migrations/002_rls.sql:144-152'],
      },
      {
        key: 'residents.create',
        noteKey: 'noApiYet',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          supervision_staff: 'full',
        },
        source: ['supabase/migrations/002_rls.sql:154-158'],
      },
      {
        key: 'residents.update',
        scopeNoteKey: 'assignedResidents',
        noteKey: 'noApiYet',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          maintenance_manager: 'scoped',
          transportation_manager: 'scoped',
          finance_manager: 'scoped',
          maintenance_staff: 'scoped',
          transportation_staff: 'scoped',
          supervision_staff: 'scoped',
          finance_staff: 'scoped',
        },
        source: ['supabase/migrations/002_rls.sql:160-168'],
      },
      {
        key: 'residents.delete',
        access: { ...ADMIN_TIER },
        source: [
          'supabase/migrations/002_rls.sql:139-142',
          'supabase/migrations/012_role_expansion_rls.sql:56-61',
        ],
      },
    ],
  },
  {
    key: 'users',
    rows: [
      {
        key: 'users.list',
        access: { super_admin: 'full' },
        source: ['src/app/api/admin/users/route.ts:67-73'],
      },
      {
        key: 'users.invite',
        access: { super_admin: 'full' },
        source: ['src/app/api/admin/users/route.ts:200-206'],
      },
      {
        key: 'users.update',
        access: { super_admin: 'full' },
        source: ['src/app/api/admin/users/[id]/route.ts:108-112'],
      },
      {
        key: 'users.deactivate',
        access: { super_admin: 'full' },
        source: ['src/app/api/admin/users/[id]/route.ts:108-112'],
      },
      {
        key: 'users.resetPassword',
        access: { super_admin: 'full' },
        source: ['src/app/api/admin/users/[id]/reset-password/route.ts:10-13'],
      },
    ],
  },
  {
    key: 'content',
    rows: [
      {
        key: 'content.read',
        access: Object.fromEntries(ALL_ROLES.map((r) => [r, 'full'])) as Partial<
          Record<UserRole, Access>
        >,
        source: ['supabase/migrations/002_rls.sql:303-345'],
      },
      {
        key: 'content.write',
        access: { ...ADMIN_TIER },
        source: [
          'supabase/migrations/002_rls.sql:303-345',
          'supabase/migrations/012_role_expansion_rls.sql:98-131',
        ],
      },
    ],
  },
  {
    key: 'finance',
    rows: [
      {
        key: 'finance.notImplemented',
        access: {},
        source: ['supabase/migrations/001_schema.sql'],
      },
    ],
  },
  {
    key: 'audit',
    rows: [
      {
        key: 'audit.read',
        access: { ...ADMIN_TIER },
        source: [
          'supabase/migrations/002_rls.sql:351-353',
          'supabase/migrations/012_role_expansion_rls.sql:134-137',
        ],
      },
    ],
  },
];

export function getAccess(row: PermissionRow, role: UserRole): Access {
  return row.access[role] ?? 'none';
}
