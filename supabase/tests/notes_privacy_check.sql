-- =====================================================================
--  Notes privacy check (optional, read-only in effect)
--
--  Proves that another user can NOT read, change or delete your notes.
--  It creates two pretend users and a pretend note inside a test, checks
--  the rules, then throws all of it away again — nothing is saved.
--
--  HOW TO RUN: Supabase → SQL Editor → New query → paste this whole
--  file → Run (after 20261105_01_notes.sql).
--   ✓ Passed: the result shows "Notes privacy check passed ✓".
--   ✗ Failed: you get a red error starting with "PRIVACY CHECK FAILED".
-- =====================================================================

do $$
declare
  owner_id    uuid := gen_random_uuid();
  stranger_id uuid := gen_random_uuid();
  note_id     uuid;
  n           int;
begin
  begin
    insert into auth.users (id, email) values
      (owner_id,    'privacy-check-owner-'    || owner_id    || '@example.invalid'),
      (stranger_id, 'privacy-check-stranger-' || stranger_id || '@example.invalid');

    -- act as a logged-in user, exactly like the app does
    perform set_config('role', 'authenticated', true);

    -- 1. the owner writes a note and can read it
    perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', owner_id::text, true);
    insert into public.notes (body) values ('secret test note') returning id into note_id;
    select count(*) into n from public.notes where id = note_id;
    if n <> 1 then raise exception 'PRIVACY CHECK FAILED: the owner cannot read their own note'; end if;

    -- 2. someone else logs in
    perform set_config('request.jwt.claims', json_build_object('sub', stranger_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', stranger_id::text, true);

    select count(*) into n from public.notes;
    if n <> 0 then raise exception 'PRIVACY CHECK FAILED: another user can see % note(s)', n; end if;

    update public.notes set body = 'hacked' where id = note_id;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'PRIVACY CHECK FAILED: another user could change a note'; end if;

    delete from public.notes where id = note_id;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'PRIVACY CHECK FAILED: another user could delete a note'; end if;

    begin
      insert into public.notes (user_id, body) values (owner_id, 'planted note');
      raise exception 'PRIVACY CHECK FAILED: another user could add a note in your name';
    exception when insufficient_privilege then null; -- refused, as it should be
    end;

    -- 3. logged-out visitors get nothing either
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('request.jwt.claim.sub', '', true);
    begin
      select count(*) into n from public.notes;
      if n <> 0 then raise exception 'PRIVACY CHECK FAILED: logged-out visitors can see notes'; end if;
    exception when insufficient_privilege then null; -- refused, as it should be
    end;

    -- 4. everything passed: undo all of the above (pretend users + note)
    raise exception using errcode = 'P0099', message = 'undo test data';
  exception when sqlstate 'P0099' then
    null;
  end;
end $$;

select 'Notes privacy check passed ✓ (test data removed)' as result;
