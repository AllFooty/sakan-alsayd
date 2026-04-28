import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// Cache wiring for the Cloudflare Workers deployment.
//
// `unstable_cache` results (e.g. getPublicBuildings) and ISR-prerendered page
// payloads are persisted to R2; revalidateTag writes land in D1. Without
// these, the previous "dummy" overrides made every cold isolate hit re-fetch
// from Supabase and silently dropped revalidateTag calls — the Phase 5
// regression that broke the "no slower than fully-static" guardrail.
//
// Bindings live in wrangler.jsonc:
//   - R2 bucket binding NEXT_INC_CACHE_R2_BUCKET (sakan-alsayd-next-cache)
//   - D1 database binding NEXT_TAG_CACHE_D1     (sakan-alsayd-next-tags)
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: d1NextTagCache,
});
