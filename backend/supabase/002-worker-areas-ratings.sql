ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS service_region TEXT NOT NULL DEFAULT '';
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS service_city TEXT NOT NULL DEFAULT '';
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS service_district TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.worker_ratings (
  worker_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_telegram_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (worker_id, customer_telegram_id)
);
CREATE INDEX IF NOT EXISTS worker_ratings_worker_idx ON public.worker_ratings(worker_id);
ALTER TABLE public.worker_ratings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public.worker_ratings FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public.worker_ratings FROM authenticated; END IF;
END $$;