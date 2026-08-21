import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Same Supabase project the Fitness Dashboard reads from. Publishable/anon
// key -- safe to expose client-side, every table is protected by RLS, and
// writes additionally require being signed in (see auth.js/sync.js).
const SUPABASE_URL = "https://geayvolcgdhenlrkmofn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYXl2b2xjZ2RoZW5scmttb2ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyODA0MDksImV4cCI6MjEwMjg1NjQwOX0.1m2uuECuSGqZcST77jJTjnVn1bDv0FiWJdnc1pcNq8M";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
