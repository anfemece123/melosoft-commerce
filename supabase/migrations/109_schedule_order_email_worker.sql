-- Schedule the Brevo order-email outbox worker without committing credentials.
--
-- The WhatsApp worker already stores the project's legacy service-role JWT in
-- Vault. Copying that value server-side gives the email worker its own Vault
-- entry while keeping the credential out of migrations, CLI output and git.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $migration$
declare
  v_dispatch_secret text;
  v_job_id bigint;
begin
  select decrypted_secret
  into v_dispatch_secret
  from vault.decrypted_secrets
  where name = 'email_queue_dispatch_key'
  order by created_at desc
  limit 1;

  if v_dispatch_secret is null then
    select decrypted_secret
    into v_dispatch_secret
    from vault.decrypted_secrets
    where name = 'whatsapp_queue_dispatch_key'
    order by created_at desc
    limit 1;

    if v_dispatch_secret is null then
      raise exception using
        message = 'EMAIL_WORKER_SERVICE_ROLE_SECRET_MISSING',
        hint = 'Create whatsapp_queue_dispatch_key or email_queue_dispatch_key in Vault before applying this migration.';
    end if;

    perform vault.create_secret(
      v_dispatch_secret,
      'email_queue_dispatch_key',
      'Legacy service-role JWT used only by the scheduled order email worker.'
    );
  end if;

  -- Make this migration safe to re-run after a repaired migration history.
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'process-order-email-queue'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'process-order-email-queue',
    '* * * * *',
    $cron$
    select net.http_post(
      url := 'https://omgkiynnpaygxulugxmc.supabase.co/functions/v1/send-order-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'email_queue_dispatch_key'
          order by created_at desc
          limit 1
        )
      ),
      body := '{"limit": 20}'::jsonb
    );
    $cron$
  );
end;
$migration$;

comment on extension pg_cron is
  'Runs durable notification workers, including the Brevo order-email queue.';
