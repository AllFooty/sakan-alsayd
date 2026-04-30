-- ============================================================================
-- 029_theme_preference: cross-device dark mode sync for admin staff
-- ============================================================================
-- Adds an optional theme preference to staff_profiles so a staff member's
-- choice (light / dark / system) follows them between devices. NULL means
-- "fall back to client default" (system).

ALTER TABLE staff_profiles
  ADD COLUMN theme_preference TEXT
    CHECK (theme_preference IN ('light', 'dark', 'system'));
