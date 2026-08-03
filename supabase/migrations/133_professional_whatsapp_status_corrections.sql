-- Operational boards must allow staff to correct a card without sending a
-- customer an obsolete or contradictory WhatsApp message. Exact-event
-- uniqueness prevented most duplicates, but it did not cover three cases:
--   1. a queued message could still be sent after the card moved backwards;
--   2. pickup/local/national dispatch are different event names for the same
--      customer milestone and could therefore be duplicated after a route edit;
--   3. a skipped state followed by a regression could enqueue a lower milestone
--      after a higher one had already been communicated.
--
-- `superseded` is a successful safety outcome, not a provider failure. Rows are
-- retained for auditability and can be reactivated if the order legitimately
-- reaches that exact milestone again before any equivalent message was sent.

alter table public.whatsapp_notifications
  drop constraint if exists whatsapp_notifications_status_valid;

alter table public.whatsapp_notifications
  add constraint whatsapp_notifications_status_valid check (status in (
    'queued', 'sending', 'sent', 'delivered', 'read', 'failed',
    'invalid_recipient', 'blocked', 'superseded'
  ));

create or replace function public.enqueue_whatsapp_order_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings record;
  v_connection record;
  v_event_type text;
  v_expected_current_event text;
  v_event_enabled boolean := false;
  v_template_name text;
  v_template_language text;
  v_template_status text;
  v_store_country text;
  v_recipient_phone text;
  v_old_rank integer;
  v_new_rank integer;
begin
  begin
    if old.status is not distinct from new.status then
      if old.fulfillment_method is not distinct from new.fulfillment_method then
        return new;
      end if;
    end if;

    -- Determine the one fulfillment message that would still be truthful for
    -- the order's current state. Any untouched queued milestone other than
    -- this one is cancelled before the cron worker can claim it.
    if new.status = 'shipped' then
      if new.fulfillment_method = 'pickup' then
        v_expected_current_event := 'order_ready_for_pickup';
      elsif new.fulfillment_method = 'national_shipping' then
        v_expected_current_event := 'order_shipped';
      else
        v_expected_current_event := 'order_out_for_delivery';
      end if;
    elsif new.status = 'delivered' then
      v_expected_current_event := 'order_delivered';
    elsif new.status = 'cancelled' then
      v_expected_current_event := 'order_cancelled';
    end if;

    update public.whatsapp_notifications
       set status = 'superseded',
           is_permanent_failure = false,
           failed_at = null,
           locked_at = null,
           locked_by = null,
           last_error_category = 'superseded',
           last_error_code = 'ORDER_STATUS_CHANGED',
           last_error_message = 'Omitido automáticamente porque el pedido cambió de estado antes del envío.',
           updated_at = now()
     where order_id = new.id
       and channel = 'whatsapp'
       and status = 'queued'
       and locked_at is null
       and event_type in (
         'order_ready_for_pickup', 'order_out_for_delivery', 'order_shipped',
         'order_delivered', 'order_cancelled'
       )
       and event_type <> coalesce(v_expected_current_event, '');

    if not new.whatsapp_consent then
      return new;
    end if;

    v_old_rank := case old.status
      when 'pending' then 0
      when 'confirmed' then 1
      when 'processing' then 2
      when 'shipped' then 3
      when 'delivered' then 4
      else null
    end;
    v_new_rank := case new.status
      when 'pending' then 0
      when 'confirmed' then 1
      when 'processing' then 2
      when 'shipped' then 3
      when 'delivered' then 4
      else null
    end;

    -- A backwards board movement is an internal correction. It never creates
    -- a new customer notification. Cancellation is a separate terminal event.
    if new.status <> 'cancelled'
       and v_old_rank is not null
       and v_new_rank is not null
       and v_new_rank < v_old_rank then
      return new;
    end if;

    select enabled, order_ready_for_pickup_enabled, order_shipped_enabled,
           order_delivered_enabled, order_cancelled_enabled, locale
      into v_settings
      from public.store_whatsapp_settings
     where store_id = new.store_id;

    if not found or not v_settings.enabled then
      return new;
    end if;

    if new.status = 'shipped' then
      if new.fulfillment_method = 'pickup' then
        v_event_type := 'order_ready_for_pickup';
        v_event_enabled := v_settings.order_ready_for_pickup_enabled;
      elsif new.fulfillment_method = 'national_shipping' then
        v_event_type := 'order_shipped';
        v_event_enabled := v_settings.order_shipped_enabled;
      else
        v_event_type := 'order_out_for_delivery';
        v_event_enabled := v_settings.order_shipped_enabled;
      end if;
    elsif new.status = 'delivered' then
      v_event_type := 'order_delivered';
      v_event_enabled := v_settings.order_delivered_enabled;
    elsif new.status = 'cancelled' then
      v_event_type := 'order_cancelled';
      v_event_enabled := v_settings.order_cancelled_enabled;
    else
      return new;
    end if;

    if not v_event_enabled then
      return new;
    end if;

    -- Pickup-ready, local delivery and national shipment are variants of one
    -- customer milestone. Once any variant was attempted, do not send another
    -- variant merely because fulfillment details or the board were corrected.
    if v_event_type in ('order_ready_for_pickup', 'order_out_for_delivery', 'order_shipped') then
      if exists (
        select 1
          from public.whatsapp_notifications notification
         where notification.store_id = new.store_id
           and notification.order_id = new.id
           and notification.channel = 'whatsapp'
           and notification.event_type in (
             'order_ready_for_pickup', 'order_out_for_delivery', 'order_shipped'
           )
           and notification.status <> 'superseded'
      ) then
        return new;
      end if;

      if exists (
        select 1
          from public.whatsapp_notifications notification
         where notification.store_id = new.store_id
           and notification.order_id = new.id
           and notification.channel = 'whatsapp'
           and notification.event_type in ('order_delivered', 'order_cancelled')
           and notification.status <> 'superseded'
      ) then
        return new;
      end if;
    elsif v_event_type = 'order_delivered' then
      if exists (
        select 1
          from public.whatsapp_notifications notification
         where notification.store_id = new.store_id
           and notification.order_id = new.id
           and notification.channel = 'whatsapp'
           and notification.event_type = 'order_cancelled'
           and notification.status <> 'superseded'
      ) then
        return new;
      end if;
    elsif v_event_type = 'order_cancelled' then
      if exists (
        select 1
          from public.whatsapp_notifications notification
         where notification.store_id = new.store_id
           and notification.order_id = new.id
           and notification.channel = 'whatsapp'
           and notification.event_type = 'order_delivered'
           and notification.status <> 'superseded'
      ) then
        return new;
      end if;
    end if;

    select status_template_name, status_template_language, status_template_status,
           shipment_template_name, shipment_template_language, shipment_template_status,
           connection_status, registration_status
      into v_connection
      from public.store_whatsapp_connections
     where store_id = new.store_id;

    if not found
       or v_connection.connection_status <> 'connected'
       or v_connection.registration_status <> 'registered' then
      return new;
    end if;

    if v_event_type = 'order_shipped' then
      v_template_name := v_connection.shipment_template_name;
      v_template_language := v_connection.shipment_template_language;
      v_template_status := v_connection.shipment_template_status;
    else
      v_template_name := v_connection.status_template_name;
      v_template_language := v_connection.status_template_language;
      v_template_status := v_connection.status_template_status;
    end if;

    if v_template_status <> 'approved' then
      return new;
    end if;

    select country into v_store_country from public.stores where id = new.store_id;
    v_recipient_phone := public.normalize_whatsapp_phone(
      new.customer_phone,
      coalesce(v_store_country, 'CO')
    );

    if v_recipient_phone is null then
      insert into public.whatsapp_notifications (
        store_id, order_id, event_type, recipient_phone, template_name, template_language,
        status, attempts, max_attempts, is_permanent_failure,
        last_error_category, last_error_code, last_error_message, failed_at
      ) values (
        new.store_id, new.id, v_event_type, coalesce(new.customer_phone, ''),
        v_template_name, v_template_language,
        'invalid_recipient', 0, 0, true,
        'invalid_phone', 'INVALID_PHONE', 'El número de teléfono del pedido no es válido para WhatsApp.', now()
      ) on conflict do nothing;
      return new;
    end if;

    -- If this exact event was cancelled before Meta was called and the order
    -- legitimately reaches it again, reuse the audited row as a fresh queue
    -- entry. Sent/failed/blocked rows are never silently retried here.
    update public.whatsapp_notifications
       set recipient_phone = v_recipient_phone,
           template_name = v_template_name,
           template_language = coalesce(v_template_language, v_settings.locale, 'es_CO'),
           template_params = null,
           status = 'queued',
           provider_message_id = null,
           attempts = 0,
           next_attempt_at = now(),
           locked_at = null,
           locked_by = null,
           is_permanent_failure = false,
           last_error_category = null,
           last_error_code = null,
           last_error_message = null,
           queued_at = now(),
           sent_at = null,
           delivered_at = null,
           read_at = null,
           failed_at = null,
           updated_at = now()
     where store_id = new.store_id
       and order_id = new.id
       and event_type = v_event_type
       and channel = 'whatsapp'
       and status = 'superseded';

    if found then
      return new;
    end if;

    insert into public.whatsapp_notifications (
      store_id, order_id, event_type, recipient_phone, template_name, template_language, status
    ) values (
      new.store_id, new.id, v_event_type, v_recipient_phone,
      v_template_name,
      coalesce(v_template_language, v_settings.locale, 'es_CO'),
      'queued'
    ) on conflict do nothing;

    return new;
  exception when others then
    raise warning 'whatsapp_status_notification_enqueue_failed order_id=% store_id=% sqlstate=%',
      new.id, new.store_id, sqlstate;
    return new;
  end;
end;
$$;

-- A dispatch method correction (for example local delivery -> pickup) changes
-- which customer message is truthful even when the board status stays on
-- `shipped`, so it must execute the same relevance policy.
drop trigger if exists trg_enqueue_whatsapp_order_status_notification on public.orders;
create trigger trg_enqueue_whatsapp_order_status_notification
  after update of status, fulfillment_method on public.orders
  for each row execute function public.enqueue_whatsapp_order_status_notification();

comment on function public.enqueue_whatsapp_order_status_notification() is
  'Queues only forward, non-contradictory customer milestones; backwards board corrections supersede untouched pending WhatsApp rows without resending historical states.';
