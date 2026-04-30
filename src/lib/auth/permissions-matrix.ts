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
          maintenance_manager: 'full',
        },
        source: [
          'supabase/migrations/022_booking_select_for_maintenance_manager.sql:12-18',
          'src/app/api/booking-requests/route.ts:25-31',
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
          'src/app/api/booking-requests/[id]/route.ts:46-51',
        ],
      },
      {
        key: 'bookings.delete',
        access: { ...ADMIN_TIER },
        source: ['src/app/api/booking-requests/[id]/route.ts:131'],
      },
      {
        key: 'bookings.export',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          finance_manager: 'full',
        },
        source: ['src/app/api/booking-requests/route.ts:47-54'],
      },
      {
        key: 'bookings.skipTransition',
        access: { ...ADMIN_TIER },
        source: ['src/app/api/booking-requests/[id]/route.ts:77-78'],
      },
      {
        key: 'bookings.notesRead',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          supervision_staff: 'full',
          finance_staff: 'full',
          finance_manager: 'full',
          maintenance_manager: 'full',
        },
        source: ['supabase/migrations/022_booking_select_for_maintenance_manager.sql:21-27'],
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
          'supabase/migrations/025_maintenance_manager_full_update.sql:39-45',
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
      {
        key: 'buildings.occupancyRead',
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
        source: ['src/app/api/admin/occupancy/route.ts:49-68'],
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
          'src/app/api/admin/rooms/route.ts:75-102',
          'src/app/api/admin/rooms/[id]/route.ts:55-101',
        ],
      },
      {
        key: 'rooms.create',
        // POST is admin-tier only (mirror of POST /api/admin/buildings).
        // RLS at 002_rls.sql:122-124 still permits other roles to insert
        // into assigned buildings, but no API exposes that path. POST also
        // accepts `capacity` and `occupancy_mode` (migration 021).
        access: { ...ADMIN_TIER },
        source: [
          'supabase/migrations/002_rls.sql:122-124',
          'supabase/migrations/021_rooms_capacity_and_mode.sql',
          'src/app/api/admin/rooms/route.ts:200-207',
        ],
      },
      {
        key: 'rooms.update',
        // PATCH allows admin tier + branch_manager scoped to the room's
        // building (looked up via rooms.building_id then
        // getAssignedBuildingIds). Other roles have no admin-API path.
        // Editable fields include capacity and occupancy_mode (migration
        // 021); the joint constraint "shared requires capacity > 1" is
        // enforced at the API boundary.
        scopeNoteKey: 'assignedBuilding',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
        },
        source: [
          'supabase/migrations/002_rls.sql:126-129',
          'supabase/migrations/021_rooms_capacity_and_mode.sql',
          'src/app/api/admin/rooms/[id]/route.ts:202-251',
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
          'src/app/api/admin/rooms/[id]/route.ts:409-424',
        ],
      },
    ],
  },
  {
    key: 'apartments',
    rows: [
      {
        key: 'apartments.list',
        // GET list (per building) and detail. Mirrors rooms.list — admin tier
        // sees everything, other roles see only their assigned buildings.
        // RLS at 028_apartments.sql:178-181 lets all auth users SELECT, but
        // the admin API narrows to assigned buildings via getAssignedBuildingIds.
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
          'supabase/migrations/028_apartments.sql:236-238',
          'src/app/api/admin/buildings/[id]/apartments/route.ts:30-49',
          'src/app/api/admin/apartments/[id]/route.ts:60-92',
        ],
      },
      {
        key: 'apartments.create',
        // POST is admin-tier only (mirror of POST /api/admin/rooms). RLS at
        // 028_apartments.sql:257-260 still permits manager-tier inserts into
        // assigned buildings, but no admin API exposes that path today.
        access: { ...ADMIN_TIER },
        source: [
          'supabase/migrations/028_apartments.sql:257-260',
          'src/app/api/admin/buildings/[id]/apartments/route.ts:157-170',
        ],
      },
      {
        key: 'apartments.update',
        // PATCH allows admin tier + branch_manager scoped to the apartment's
        // building. is_active toggles are gated to admin-tier only. The
        // editable fields cover apartment_number, floor, descriptions,
        // shared-facility flags, bathroom counts, sort_order, and notes.
        scopeNoteKey: 'assignedBuilding',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
        },
        source: [
          'supabase/migrations/028_apartments.sql:262-266',
          'src/app/api/admin/apartments/[id]/route.ts:189-200',
        ],
      },
      {
        key: 'apartments.delete',
        // Hard-delete; admin tier only. Postgres FK
        // `rooms.apartment_id ON DELETE RESTRICT` blocks delete for any
        // apartment with rooms in it (surfaced to the UI as
        // `apartmentHasRooms`). Move the rooms or mark the apartment
        // inactive instead.
        access: { ...ADMIN_TIER },
        source: [
          'supabase/migrations/028_apartments.sql:268-271',
          'src/app/api/admin/apartments/[id]/route.ts:328-340',
        ],
      },
    ],
  },
  {
    key: 'residents',
    rows: [
      {
        key: 'residents.list',
        // GET list and detail both gate on `branch_manager` + `supervision_staff`
        // (admin-tier passes automatically via authenticateApiRequest).
        // residents_manager_select (last set in 027) covers both roles with
        // the same building-scope JOIN.
        scopeNoteKey: 'assignedResidents',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          supervision_staff: 'scoped',
        },
        source: [
          'supabase/migrations/027_residents_supervision_staff_and_capacity.sql:41-51',
          'src/app/api/admin/residents/route.ts:53-65',
          'src/app/api/admin/residents/[id]/route.ts:48-65',
        ],
      },
      {
        key: 'residents.create',
        // POST accepts `from_booking_id` to link a converted booking to the
        // newly-created resident (Slice 5e of Phase 5).
        access: {
          ...ADMIN_TIER,
          branch_manager: 'full',
          supervision_staff: 'full',
        },
        source: [
          'supabase/migrations/002_rls.sql:154-158',
          'src/app/api/admin/residents/route.ts:256-265',
        ],
      },
      {
        key: 'residents.update',
        // PATCH allows partial updates of every editable resident field. The
        // API gate is admin-tier + branch_manager + supervision_staff.
        // residents_manager_update (last set in 027) covers both roles via
        // building-scope JOIN.
        scopeNoteKey: 'assignedResidents',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          supervision_staff: 'scoped',
        },
        source: [
          'supabase/migrations/027_residents_supervision_staff_and_capacity.sql:54-64',
          'src/app/api/admin/residents/[id]/route.ts:247-260',
        ],
      },
      {
        key: 'residents.archive',
        // Soft-delete via DELETE handler — sets resident.status='checked_out'
        // (no hard delete because room_assignments has ON DELETE RESTRICT
        // on resident_id). Returns 409 if any active assignment exists; the
        // user must check the resident out first. Same residents_manager_update
        // policy gates the underlying UPDATE.
        scopeNoteKey: 'assignedResidents',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          supervision_staff: 'scoped',
        },
        source: [
          'supabase/migrations/027_residents_supervision_staff_and_capacity.sql:54-64',
          'src/app/api/admin/residents/[id]/route.ts:483-500',
        ],
      },
      {
        key: 'residents.moveIn',
        // POST .../residents/[id]/assignments. Inserts an active
        // room_assignment and flips room.status to 'occupied' if the new
        // assignment fills the room (private: any active; shared: active
        // ≥ capacity). Scoped to the destination room's building.
        // assignments_manager_insert (last set in 027) covers both roles.
        // Migration 027 also adds DB-level over-assignment guards
        // (uniq_active_assignment_per_resident + enforce_room_capacity trigger).
        scopeNoteKey: 'assignedResidents',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          supervision_staff: 'scoped',
        },
        source: [
          'supabase/migrations/027_residents_supervision_staff_and_capacity.sql:80-85',
          'src/app/api/admin/residents/[id]/assignments/route.ts:40-55',
        ],
      },
      {
        key: 'residents.checkOut',
        // PATCH .../assignments/[id]/check-out. Ends an active assignment,
        // sets check_out_date, and recomputes room.status (preserving any
        // admin-overridden 'maintenance' or 'reserved' state).
        // assignments_manager_update (last set in 027) covers both roles.
        scopeNoteKey: 'assignedResidents',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          supervision_staff: 'scoped',
        },
        source: [
          'supabase/migrations/027_residents_supervision_staff_and_capacity.sql:88-93',
          'src/app/api/admin/assignments/[id]/check-out/route.ts:44-60',
        ],
      },
      {
        key: 'residents.documentsUpload',
        // Private contracts bucket (migration 026). Storage RLS scopes
        // INSERT to staff who share a building with the resident's
        // room_assignments via can_access_resident_contracts(uuid).
        scopeNoteKey: 'assignedResidents',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          supervision_staff: 'scoped',
        },
        source: [
          'supabase/migrations/026_contracts_bucket.sql',
          'src/app/api/uploads/contract/route.ts:39-55',
        ],
      },
      {
        key: 'residents.documentsDownload',
        // Generates a 5-minute signed URL via supabase.storage.createSignedUrl.
        // Same RLS scope as upload.
        scopeNoteKey: 'assignedResidents',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          supervision_staff: 'scoped',
        },
        source: [
          'supabase/migrations/026_contracts_bucket.sql',
          'src/app/api/admin/residents/[id]/documents/sign/route.ts:14-30',
        ],
      },
      {
        key: 'residents.documentsDelete',
        // Removes the storage object and strips the path from
        // residents.documents. Same RLS scope as upload.
        scopeNoteKey: 'assignedResidents',
        access: {
          ...ADMIN_TIER,
          branch_manager: 'scoped',
          supervision_staff: 'scoped',
        },
        source: [
          'supabase/migrations/026_contracts_bucket.sql',
          'src/app/api/admin/residents/[id]/documents/route.ts:13-30',
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
