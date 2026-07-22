-- ============================================================
-- Migration 095 — Per-location business and ordering schedules
--
-- Physical opening hours and ecommerce order hours are deliberately
-- separate. A location may accept orders all day, reuse its physical
-- schedule, or define a dedicated ordering schedule.
-- ============================================================

ALTER TABLE public.store_locations
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Bogota',
  ADD COLUMN IF NOT EXISTS order_schedule_mode text NOT NULL DEFAULT 'always_open',
  ADD COLUMN IF NOT EXISTS orders_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS orders_paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS orders_pause_reason text;

ALTER TABLE public.store_locations
  DROP CONSTRAINT IF EXISTS store_locations_order_schedule_mode_valid,
  ADD CONSTRAINT store_locations_order_schedule_mode_valid
    CHECK (order_schedule_mode IN ('always_open', 'same_as_business', 'custom')),
  DROP CONSTRAINT IF EXISTS store_locations_pause_reason_length,
  ADD CONSTRAINT store_locations_pause_reason_length
    CHECK (orders_pause_reason IS NULL OR char_length(orders_pause_reason) <= 180),
  ADD CONSTRAINT store_locations_id_store_unique UNIQUE (id, store_id);

CREATE OR REPLACE FUNCTION public.validate_store_location_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'INVALID_TIMEZONE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_locations_validate_timezone ON public.store_locations;
CREATE TRIGGER store_locations_validate_timezone
  BEFORE INSERT OR UPDATE OF timezone ON public.store_locations
  FOR EACH ROW EXECUTE FUNCTION public.validate_store_location_timezone();

CREATE TABLE public.location_schedule_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  location_id uuid NOT NULL,
  schedule_kind text NOT NULL,
  day_of_week integer NOT NULL,
  starts_at time,
  ends_at time,
  ends_next_day boolean NOT NULL DEFAULT false,
  is_all_day boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT location_schedule_intervals_location_store_fk
    FOREIGN KEY (location_id, store_id)
    REFERENCES public.store_locations(id, store_id) ON DELETE CASCADE,
  CONSTRAINT location_schedule_intervals_kind_valid
    CHECK (schedule_kind IN ('business', 'ordering')),
  CONSTRAINT location_schedule_intervals_day_valid
    CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT location_schedule_intervals_times_valid
    CHECK (
      (is_all_day AND starts_at IS NULL AND ends_at IS NULL AND NOT ends_next_day)
      OR
      (NOT is_all_day AND starts_at IS NOT NULL AND ends_at IS NOT NULL
        AND ((NOT ends_next_day AND starts_at < ends_at)
          OR (ends_next_day AND starts_at >= ends_at)))
    ),
  CONSTRAINT location_schedule_intervals_unique_sort
    UNIQUE (location_id, schedule_kind, day_of_week, sort_order)
);

CREATE INDEX idx_location_schedule_intervals_lookup
  ON public.location_schedule_intervals(location_id, schedule_kind, day_of_week);

CREATE TRIGGER location_schedule_intervals_updated_at
  BEFORE UPDATE ON public.location_schedule_intervals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.validate_location_schedule_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_start integer;
  v_end integer;
BEGIN
  v_start := CASE WHEN NEW.is_all_day THEN 0
    ELSE extract(epoch FROM NEW.starts_at)::integer / 60 END;
  v_end := CASE WHEN NEW.is_all_day THEN 1440
    ELSE extract(epoch FROM NEW.ends_at)::integer / 60
      + CASE WHEN NEW.ends_next_day THEN 1440 ELSE 0 END END;

  -- Intervals anchored to the same weekday may not overlap.
  IF EXISTS (
    SELECT 1
    FROM public.location_schedule_intervals i
    WHERE i.location_id = NEW.location_id
      AND i.schedule_kind = NEW.schedule_kind
      AND i.day_of_week = NEW.day_of_week
      AND i.id <> NEW.id
      AND v_start < CASE WHEN i.is_all_day THEN 1440
        ELSE extract(epoch FROM i.ends_at)::integer / 60
          + CASE WHEN i.ends_next_day THEN 1440 ELSE 0 END END
      AND CASE WHEN i.is_all_day THEN 0
        ELSE extract(epoch FROM i.starts_at)::integer / 60 END < v_end
  ) THEN
    RAISE EXCEPTION 'SCHEDULE_INTERVAL_OVERLAP';
  END IF;

  -- Previous-day overnight hours must not collide with today's start.
  IF EXISTS (
    SELECT 1
    FROM public.location_schedule_intervals i
    WHERE i.location_id = NEW.location_id
      AND i.schedule_kind = NEW.schedule_kind
      AND i.day_of_week = (NEW.day_of_week + 6) % 7
      AND i.ends_next_day = true
      AND i.id <> NEW.id
      AND v_start < extract(epoch FROM i.ends_at)::integer / 60
  ) THEN
    RAISE EXCEPTION 'SCHEDULE_INTERVAL_OVERLAP';
  END IF;

  -- If this interval crosses midnight, compare its continuation with the
  -- next day's intervals (important when those rows already exist).
  IF NEW.ends_next_day AND EXISTS (
    SELECT 1
    FROM public.location_schedule_intervals i
    WHERE i.location_id = NEW.location_id
      AND i.schedule_kind = NEW.schedule_kind
      AND i.day_of_week = (NEW.day_of_week + 1) % 7
      AND i.id <> NEW.id
      AND CASE WHEN i.is_all_day THEN 0
        ELSE extract(epoch FROM i.starts_at)::integer / 60 END
        < extract(epoch FROM NEW.ends_at)::integer / 60
  ) THEN
    RAISE EXCEPTION 'SCHEDULE_INTERVAL_OVERLAP';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER location_schedule_intervals_no_overlap
  BEFORE INSERT OR UPDATE ON public.location_schedule_intervals
  FOR EACH ROW EXECUTE FUNCTION public.validate_location_schedule_overlap();

CREATE TABLE public.location_schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  location_id uuid NOT NULL,
  schedule_kind text NOT NULL,
  exception_date date NOT NULL,
  is_closed boolean NOT NULL DEFAULT true,
  intervals jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT location_schedule_exceptions_location_store_fk
    FOREIGN KEY (location_id, store_id)
    REFERENCES public.store_locations(id, store_id) ON DELETE CASCADE,
  CONSTRAINT location_schedule_exceptions_kind_valid
    CHECK (schedule_kind IN ('business', 'ordering')),
  CONSTRAINT location_schedule_exceptions_intervals_array
    CHECK (jsonb_typeof(intervals) = 'array'),
  CONSTRAINT location_schedule_exceptions_note_length
    CHECK (note IS NULL OR char_length(note) <= 180),
  CONSTRAINT location_schedule_exceptions_unique
    UNIQUE (location_id, schedule_kind, exception_date)
);

CREATE INDEX idx_location_schedule_exceptions_lookup
  ON public.location_schedule_exceptions(location_id, schedule_kind, exception_date);

CREATE OR REPLACE FUNCTION public.validate_location_schedule_exception()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_start integer;
  v_end integer;
  v_all_day boolean;
  v_next_day boolean;
  v_starts integer[] := ARRAY[]::integer[];
  v_ends integer[] := ARRAY[]::integer[];
  v_index integer;
BEGIN
  IF NEW.is_closed THEN
    IF jsonb_array_length(NEW.intervals) <> 0 THEN
      RAISE EXCEPTION 'CLOSED_EXCEPTION_MUST_NOT_HAVE_INTERVALS';
    END IF;
    RETURN NEW;
  END IF;

  IF jsonb_array_length(NEW.intervals) = 0 THEN
    RAISE EXCEPTION 'OPEN_EXCEPTION_REQUIRES_INTERVALS';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.intervals)
  LOOP
    v_all_day := COALESCE((v_item->>'is_all_day')::boolean, false);
    v_next_day := COALESCE((v_item->>'ends_next_day')::boolean, false);

    IF v_all_day THEN
      IF jsonb_array_length(NEW.intervals) <> 1 OR v_next_day THEN
        RAISE EXCEPTION 'INVALID_ALL_DAY_EXCEPTION';
      END IF;
      v_start := 0;
      v_end := 1440;
    ELSE
      IF NULLIF(v_item->>'starts_at', '') IS NULL
         OR NULLIF(v_item->>'ends_at', '') IS NULL THEN
        RAISE EXCEPTION 'INVALID_EXCEPTION_INTERVAL';
      END IF;
      v_start := extract(epoch FROM (v_item->>'starts_at')::time)::integer / 60;
      v_end := extract(epoch FROM (v_item->>'ends_at')::time)::integer / 60;
      IF (NOT v_next_day AND v_start >= v_end)
         OR (v_next_day AND v_start < v_end) THEN
        RAISE EXCEPTION 'INVALID_EXCEPTION_INTERVAL';
      END IF;
      IF v_next_day THEN v_end := v_end + 1440; END IF;
    END IF;

    IF array_length(v_starts, 1) IS NOT NULL THEN
      FOR v_index IN 1..array_length(v_starts, 1)
      LOOP
        IF v_start < v_ends[v_index] AND v_starts[v_index] < v_end THEN
          RAISE EXCEPTION 'SCHEDULE_INTERVAL_OVERLAP';
        END IF;
      END LOOP;
    END IF;

    v_starts := array_append(v_starts, v_start);
    v_ends := array_append(v_ends, v_end);
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN invalid_datetime_format THEN
    RAISE EXCEPTION 'INVALID_EXCEPTION_INTERVAL';
END;
$$;

CREATE TRIGGER location_schedule_exceptions_validate
  BEFORE INSERT OR UPDATE ON public.location_schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_location_schedule_exception();

CREATE TRIGGER location_schedule_exceptions_updated_at
  BEFORE UPDATE ON public.location_schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.location_schedule_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location_intervals_select_public" ON public.location_schedule_intervals
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "location_intervals_insert_owner_admin" ON public.location_schedule_intervals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']));
CREATE POLICY "location_intervals_update_owner_admin" ON public.location_schedule_intervals
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
  WITH CHECK (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']));
CREATE POLICY "location_intervals_delete_owner_admin" ON public.location_schedule_intervals
  FOR DELETE TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']));

CREATE POLICY "location_exceptions_select_public" ON public.location_schedule_exceptions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "location_exceptions_insert_owner_admin" ON public.location_schedule_exceptions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']));
CREATE POLICY "location_exceptions_update_owner_admin" ON public.location_schedule_exceptions
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']))
  WITH CHECK (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']));
CREATE POLICY "location_exceptions_delete_owner_admin" ON public.location_schedule_exceptions
  FOR DELETE TO authenticated
  USING (public.is_platform_admin() OR public.has_store_role(store_id, array['owner', 'admin']));

GRANT SELECT ON public.location_schedule_intervals, public.location_schedule_exceptions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.location_schedule_intervals, public.location_schedule_exceptions TO authenticated;
GRANT ALL ON public.location_schedule_intervals, public.location_schedule_exceptions TO service_role;

-- Migrate the legacy store-wide physical schedule to every existing active
-- location so no branch unexpectedly becomes closed after deployment. Each
-- branch can then be customized independently. A legacy break becomes two
-- independent intervals.
WITH legacy AS (
  SELECT h.*, l.id AS location_id
  FROM public.store_business_hours h
  JOIN public.store_locations l
    ON l.store_id = h.store_id AND l.is_active = true
  WHERE h.is_open = true AND h.opens_at IS NOT NULL AND h.closes_at IS NOT NULL
), expanded AS (
  SELECT store_id, location_id, day_of_week, opens_at AS starts_at,
         CASE
           WHEN break_starts_at > opens_at AND break_ends_at < closes_at
             AND break_starts_at < break_ends_at THEN break_starts_at
           ELSE closes_at
         END AS ends_at,
         0 AS sort_order
  FROM legacy
  UNION ALL
  SELECT store_id, location_id, day_of_week, break_ends_at, closes_at, 1
  FROM legacy
  WHERE break_starts_at > opens_at AND break_ends_at < closes_at
    AND break_starts_at < break_ends_at
)
INSERT INTO public.location_schedule_intervals (
  store_id, location_id, schedule_kind, day_of_week,
  starts_at, ends_at, ends_next_day, is_all_day, sort_order
)
SELECT store_id, location_id, 'business', day_of_week,
       starts_at, ends_at, false, false, sort_order
FROM expanded
WHERE starts_at < ends_at
ON CONFLICT (location_id, schedule_kind, day_of_week, sort_order) DO NOTHING;

-- Restaurants default to accepting orders during physical opening hours.
-- Other verticals keep the explicit 24/7 ecommerce default.
UPDATE public.store_locations l
SET order_schedule_mode = 'same_as_business'
FROM public.stores s
WHERE s.id = l.store_id
  AND (s.business_vertical = 'food_restaurant' OR s.business_type = 'restaurante');

-- Save the settings and both weekly schedules atomically. If any interval is
-- invalid, PostgreSQL rolls the complete operation back, so an existing
-- schedule can never be erased by a half-finished client request.
CREATE OR REPLACE FUNCTION public.save_location_schedule_configuration(
  p_location_id uuid,
  p_timezone text,
  p_order_schedule_mode text,
  p_orders_paused boolean,
  p_orders_paused_until timestamptz,
  p_orders_pause_reason text,
  p_business_intervals jsonb,
  p_ordering_intervals jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_item jsonb;
BEGIN
  SELECT store_id INTO v_store_id
  FROM public.store_locations
  WHERE id = p_location_id;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'LOCATION_NOT_FOUND';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_platform_admin()
     AND NOT public.has_store_role(v_store_id, array['owner', 'admin']) THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS';
  END IF;

  IF jsonb_typeof(COALESCE(p_business_intervals, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(p_ordering_intervals, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_SCHEDULE_PAYLOAD';
  END IF;

  UPDATE public.store_locations
  SET timezone = p_timezone,
      order_schedule_mode = p_order_schedule_mode,
      orders_paused = p_orders_paused,
      orders_paused_until = CASE WHEN p_orders_paused THEN p_orders_paused_until ELSE NULL END,
      orders_pause_reason = CASE WHEN p_orders_paused THEN NULLIF(btrim(p_orders_pause_reason), '') ELSE NULL END
  WHERE id = p_location_id;

  DELETE FROM public.location_schedule_intervals
  WHERE location_id = p_location_id AND schedule_kind = 'business';

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_business_intervals, '[]'::jsonb))
  LOOP
    INSERT INTO public.location_schedule_intervals (
      store_id, location_id, schedule_kind, day_of_week,
      starts_at, ends_at, ends_next_day, is_all_day, sort_order
    ) VALUES (
      v_store_id, p_location_id, 'business', (v_item->>'day_of_week')::integer,
      NULLIF(v_item->>'starts_at', '')::time,
      NULLIF(v_item->>'ends_at', '')::time,
      COALESCE((v_item->>'ends_next_day')::boolean, false),
      COALESCE((v_item->>'is_all_day')::boolean, false),
      COALESCE((v_item->>'sort_order')::integer, 0)
    );
  END LOOP;

  IF p_order_schedule_mode = 'custom' THEN
    DELETE FROM public.location_schedule_intervals
    WHERE location_id = p_location_id AND schedule_kind = 'ordering';

    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_ordering_intervals, '[]'::jsonb))
    LOOP
      INSERT INTO public.location_schedule_intervals (
        store_id, location_id, schedule_kind, day_of_week,
        starts_at, ends_at, ends_next_day, is_all_day, sort_order
      ) VALUES (
        v_store_id, p_location_id, 'ordering', (v_item->>'day_of_week')::integer,
        NULLIF(v_item->>'starts_at', '')::time,
        NULLIF(v_item->>'ends_at', '')::time,
        COALESCE((v_item->>'ends_next_day')::boolean, false),
        COALESCE((v_item->>'is_all_day')::boolean, false),
        COALESCE((v_item->>'sort_order')::integer, 0)
      );
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_location_schedule_configuration(
  uuid, text, text, boolean, timestamptz, text, jsonb, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_location_schedule_configuration(
  uuid, text, text, boolean, timestamptz, text, jsonb, jsonb
) TO authenticated, service_role;

-- Evaluate one physical/custom schedule in the location's own timezone.
CREATE OR REPLACE FUNCTION public.get_location_schedule_status(
  p_location_id uuid,
  p_schedule_kind text,
  p_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location public.store_locations%ROWTYPE;
  v_local_ts timestamp;
  v_date date;
  v_time time;
  v_day integer;
  v_previous_day integer;
  v_current_exception public.location_schedule_exceptions%ROWTYPE;
  v_previous_exception public.location_schedule_exceptions%ROWTYPE;
  v_current_exception_exists boolean := false;
  v_previous_exception_exists boolean := false;
  v_open boolean := false;
BEGIN
  IF p_schedule_kind NOT IN ('business', 'ordering') THEN
    RAISE EXCEPTION 'INVALID_SCHEDULE_KIND';
  END IF;

  SELECT l.* INTO v_location
  FROM public.store_locations l
  JOIN public.stores s ON s.id = l.store_id
  WHERE l.id = p_location_id AND l.is_active = true AND s.status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_open', false, 'status_code', 'inactive');
  END IF;

  v_local_ts := p_at AT TIME ZONE v_location.timezone;
  v_date := v_local_ts::date;
  v_time := v_local_ts::time;
  v_day := extract(dow FROM v_local_ts)::integer;
  v_previous_day := (v_day + 6) % 7;

  SELECT * INTO v_current_exception
  FROM public.location_schedule_exceptions
  WHERE location_id = p_location_id
    AND schedule_kind = p_schedule_kind
    AND exception_date = v_date;
  v_current_exception_exists := FOUND;

  SELECT * INTO v_previous_exception
  FROM public.location_schedule_exceptions
  WHERE location_id = p_location_id
    AND schedule_kind = p_schedule_kind
    AND exception_date = v_date - 1;
  v_previous_exception_exists := FOUND;

  -- A previous-day overnight interval can remain open after midnight.
  IF v_previous_exception_exists THEN
    IF NOT v_previous_exception.is_closed THEN
      SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_previous_exception.intervals) item
        WHERE COALESCE((item->>'ends_next_day')::boolean, false)
          AND COALESCE((item->>'is_all_day')::boolean, false) = false
          AND NULLIF(item->>'ends_at', '') IS NOT NULL
          AND v_time < (item->>'ends_at')::time
      ) INTO v_open;
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.location_schedule_intervals i
      WHERE i.location_id = p_location_id
        AND i.schedule_kind = p_schedule_kind
        AND i.day_of_week = v_previous_day
        AND i.ends_next_day = true
        AND v_time < i.ends_at
    ) INTO v_open;
  END IF;

  IF NOT v_open THEN
    IF v_current_exception_exists THEN
      IF NOT v_current_exception.is_closed THEN
        SELECT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_current_exception.intervals) item
          WHERE COALESCE((item->>'is_all_day')::boolean, false)
             OR (
               NULLIF(item->>'starts_at', '') IS NOT NULL
               AND NULLIF(item->>'ends_at', '') IS NOT NULL
               AND (
                 (COALESCE((item->>'ends_next_day')::boolean, false) = false
                   AND v_time >= (item->>'starts_at')::time
                   AND v_time < (item->>'ends_at')::time)
                 OR
                 (COALESCE((item->>'ends_next_day')::boolean, false) = true
                   AND v_time >= (item->>'starts_at')::time)
               )
             )
        ) INTO v_open;
      END IF;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.location_schedule_intervals i
        WHERE i.location_id = p_location_id
          AND i.schedule_kind = p_schedule_kind
          AND i.day_of_week = v_day
          AND (i.is_all_day OR (
            (NOT i.ends_next_day AND v_time >= i.starts_at AND v_time < i.ends_at)
            OR (i.ends_next_day AND v_time >= i.starts_at)
          ))
      ) INTO v_open;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_open', v_open,
    'status_code', CASE WHEN v_open THEN 'open' ELSE 'closed' END,
    'timezone', v_location.timezone,
    'local_date', v_date,
    'local_time', to_char(v_time, 'HH24:MI:SS')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_location_order_status(
  p_location_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location public.store_locations%ROWTYPE;
  v_status jsonb;
BEGIN
  SELECT l.* INTO v_location
  FROM public.store_locations l
  JOIN public.stores s ON s.id = l.store_id
  WHERE l.id = p_location_id AND l.is_active = true AND s.status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_accepting_orders', false, 'status_code', 'inactive');
  END IF;

  IF v_location.orders_paused
     AND (v_location.orders_paused_until IS NULL OR p_at < v_location.orders_paused_until) THEN
    RETURN jsonb_build_object(
      'is_accepting_orders', false,
      'status_code', 'paused',
      'timezone', v_location.timezone
    );
  END IF;

  IF v_location.order_schedule_mode = 'always_open' THEN
    RETURN jsonb_build_object(
      'is_accepting_orders', true,
      'status_code', 'open',
      'timezone', v_location.timezone
    );
  END IF;

  v_status := public.get_location_schedule_status(
    p_location_id,
    CASE WHEN v_location.order_schedule_mode = 'same_as_business'
      THEN 'business' ELSE 'ordering' END,
    p_at
  );

  RETURN jsonb_build_object(
    'is_accepting_orders', COALESCE((v_status->>'is_open')::boolean, false),
    'status_code', COALESCE(v_status->>'status_code', 'closed'),
    'timezone', v_location.timezone,
    'local_date', v_status->>'local_date',
    'local_time', v_status->>'local_time'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_location_schedule_status(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_location_order_status(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_location_schedule_status(uuid, text, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_location_order_status(uuid, timestamptz) TO anon, authenticated, service_role;

-- Final server-side guard for every direct/COD web order. Online orders
-- inserted by the trusted payment webhook are exempt because payment was
-- already approved; starting a new online checkout is guarded in its Edge
-- Function before redirecting to Wompi.
CREATE OR REPLACE FUNCTION public.enforce_web_order_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location_id uuid;
  v_status jsonb;
  v_jwt_role text;
BEGIN
  IF NEW.source <> 'web' THEN
    RETURN NEW;
  END IF;

  v_jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), '');
  IF NEW.payment_method = 'online' AND v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.store_location_id IS NOT NULL THEN
    SELECT id INTO v_location_id
    FROM public.store_locations
    WHERE id = NEW.store_location_id
      AND store_id = NEW.store_id
      AND is_active = true;
  ELSE
    SELECT id INTO v_location_id
    FROM public.store_locations
    WHERE store_id = NEW.store_id AND is_primary = true AND is_active = true
    LIMIT 1;
  END IF;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'ORDERING_CLOSED';
  END IF;

  v_status := public.get_location_order_status(v_location_id, now());
  IF COALESCE((v_status->>'is_accepting_orders')::boolean, false) = false THEN
    IF v_status->>'status_code' = 'paused' THEN
      RAISE EXCEPTION 'ORDERING_PAUSED';
    END IF;
    RAISE EXCEPTION 'ORDERING_CLOSED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_enforce_web_schedule ON public.orders;
CREATE TRIGGER orders_enforce_web_schedule
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_web_order_schedule();

-- Add non-sensitive schedule metadata to the existing public location view.
CREATE OR REPLACE VIEW public.public_store_locations
  WITH (security_invoker = false)
AS
SELECT
  sl.id AS location_id,
  sl.store_id,
  s.slug AS store_slug,
  sl.name,
  sl.city,
  sl.department,
  sl.country,
  sl.address_line,
  sl.neighborhood,
  sl.phone,
  sl.whatsapp_number,
  sl.allows_pickup,
  sl.allows_local_delivery,
  sl.delivery_notes,
  sl.pickup_notes,
  sl.is_primary,
  sl.sort_order,
  sl.timezone,
  sl.order_schedule_mode
FROM public.store_locations sl
JOIN public.stores s ON s.id = sl.store_id
WHERE sl.is_active = true
  AND s.status = 'active';

GRANT SELECT ON public.public_store_locations TO anon, authenticated;

COMMENT ON TABLE public.location_schedule_intervals IS
  'Reusable weekly intervals per location. business = public physical hours; ordering = ecommerce acceptance hours.';
COMMENT ON TABLE public.location_schedule_exceptions IS
  'Date-specific closures or replacement intervals per location and schedule kind.';
COMMENT ON COLUMN public.store_locations.order_schedule_mode IS
  'always_open, same_as_business, or custom ordering hours.';

-- A newly created secondary location starts with the primary location's
-- weekly hours. Administrators can immediately customize it without having
-- to rebuild a seven-day schedule from zero. Date exceptions are not copied.
CREATE OR REPLACE FUNCTION public.copy_primary_schedule_to_new_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary_id uuid;
BEGIN
  IF NEW.is_primary THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_primary_id
  FROM public.store_locations
  WHERE store_id = NEW.store_id AND is_primary = true AND id <> NEW.id
  LIMIT 1;

  IF v_primary_id IS NOT NULL THEN
    INSERT INTO public.location_schedule_intervals (
      store_id, location_id, schedule_kind, day_of_week,
      starts_at, ends_at, ends_next_day, is_all_day, sort_order
    )
    SELECT NEW.store_id, NEW.id, schedule_kind, day_of_week,
           starts_at, ends_at, ends_next_day, is_all_day, sort_order
    FROM public.location_schedule_intervals
    WHERE location_id = v_primary_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_locations_copy_primary_schedule ON public.store_locations;
CREATE TRIGGER store_locations_copy_primary_schedule
  AFTER INSERT ON public.store_locations
  FOR EACH ROW EXECUTE FUNCTION public.copy_primary_schedule_to_new_location();
