// Runs the real SQL files against a throwaway PostgreSQL database and checks
// the folder rules and the one-time tag → folder conversion.
//
// Needs a PostgreSQL server (any recent version) and the `psql` command. Set
// STASH_PG_URL to a superuser connection, e.g.
//   STASH_PG_URL=postgresql://postgres:postgres@localhost:5432/postgres npm test
// Without it, this test is skipped (the other tests still run).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = process.env.STASH_PG_URL;
const skip = !BASE || spawnSync('psql', ['--version']).status !== 0
  ? 'set STASH_PG_URL (and install psql) to run the database tests' : false;
const root = new URL('..', import.meta.url).pathname;
const file = (p) => readFileSync(root + p, 'utf8');
const dbName = `stash_test_${process.pid}_${Date.now()}`;
const dbUrl = () => { const u = new URL(BASE); u.pathname = '/' + dbName; return u.toString(); };

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

function psql(url, sqlText) {
  const r = spawnSync('psql', [url, '-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1'], { input: sqlText, encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr };
}
/** Run SQL (as superuser, or as a logged-in user when `as` is set). Throws on error. */
function sql(text, as) {
  const prefix = as ? `set role authenticated; select set_config('request.jwt.claim.sub', '${as}', false) \\g /dev/null\n` : '';
  const r = psql(dbUrl(), prefix + text);
  if (!r.ok) throw new Error(r.err);
  return r.out;
}
const json = (text, as) => JSON.parse(sql(`select coalesce(json_agg(x), '[]') from (${text}) x;`, as));
const expectError = (text, as, pattern) => assert.throws(() => sql(text, as), pattern);

// Just enough of Supabase (auth + storage schemas, roles) for the files to run.
const SUPABASE_STUB = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $f$ select string_to_array(name, '/') $f$;
grant usage on schema public, auth, storage to authenticated, anon;
grant select on auth.users to postgres;
alter default privileges in schema public grant all on tables to authenticated;
insert into auth.users values ('${A}', 'a@example.com'), ('${B}', 'b@example.com');
`;

// Characters and links as they look before the update.
const SEED = `
insert into public.tag_groups (id, user_id, name) values ('10000000-0000-0000-0000-000000000001', '${A}', 'Genre');
insert into public.tags (user_id, name, group_id)
  select '${A}', n, case when n in ('Fantasy', 'Noir', 'Lonely') then '10000000-0000-0000-0000-000000000001'::uuid end
  from unnest(array['Tutorial','Sci-fi','Fantasy','Animation','cozy','Noir','Villain','Lonely','Alpha','Beta']) n;
insert into public.tags (user_id, name) values ('${B}', 'Tutorial');
insert into public.characters (id, user_id, name) values
  ('20000000-0000-0000-0000-000000000001', '${A}', 'Moss Witch'),
  ('20000000-0000-0000-0000-000000000002', '${A}', 'Detective Oona');
insert into public.character_tags (user_id, character_id, tag_id)
  select '${A}', c, t.id from (values
    ('20000000-0000-0000-0000-000000000001'::uuid, 'Fantasy'), ('20000000-0000-0000-0000-000000000001', 'Villain'),
    ('20000000-0000-0000-0000-000000000002', 'Noir')) v(c, n)
  join public.tags t on t.user_id = '${A}' and t.name = v.n;
insert into public.vault_links (id, user_id, url, title) values
  ('30000000-0000-0000-0000-000000000001', '${A}', 'https://example.com/1', 'L1 tutorial'),
  ('30000000-0000-0000-0000-000000000002', '${A}', 'https://example.com/2', 'L2 tutorial + sci-fi'),
  ('30000000-0000-0000-0000-000000000003', '${A}', 'https://example.com/3', 'L3 fantasy'),
  ('30000000-0000-0000-0000-000000000004', '${A}', 'https://example.com/4', 'L4 fantasy + animation'),
  ('30000000-0000-0000-0000-000000000005', '${A}', 'https://example.com/5', 'L5 cozy'),
  ('30000000-0000-0000-0000-000000000006', '${A}', 'https://example.com/6', 'L6 noir'),
  ('30000000-0000-0000-0000-000000000007', '${A}', 'https://example.com/7', 'L7 no tags'),
  ('30000000-0000-0000-0000-000000000008', '${A}', 'https://example.com/8', 'L8 beta + alpha (tie)'),
  ('30000000-0000-0000-0000-000000000009', '${B}', 'https://example.com/9', 'B tutorial');
insert into public.vault_link_tags (user_id, link_id, tag_id)
  select l.user_id, l.id, t.id from (values
    ('30000000-0000-0000-0000-000000000001'::uuid, 'Tutorial'),
    ('30000000-0000-0000-0000-000000000002', 'Tutorial'), ('30000000-0000-0000-0000-000000000002', 'Sci-fi'),
    ('30000000-0000-0000-0000-000000000003', 'Fantasy'),
    ('30000000-0000-0000-0000-000000000004', 'Fantasy'), ('30000000-0000-0000-0000-000000000004', 'Animation'),
    ('30000000-0000-0000-0000-000000000005', 'cozy'),
    ('30000000-0000-0000-0000-000000000006', 'Noir'),
    ('30000000-0000-0000-0000-000000000008', 'Beta'), ('30000000-0000-0000-0000-000000000008', 'Alpha'),
    ('30000000-0000-0000-0000-000000000009', 'Tutorial')) v(link, n)
  join public.vault_links l on l.id = v.link
  join public.tags t on t.user_id = l.user_id and t.name = v.n;
`;

const MIGRATION = file('supabase/migrations/20261116_01_vault_folders_tags.sql');

const REFERENCE_MIGRATION = file('supabase/migrations/20261116_02_image_reference_url.sql');

/** Everything the update could touch, in a stable order. */
const snapshot = () => sql(`select json_build_object(
  'folders', (select json_agg(f order by f.id) from public.vault_folders f),
  'links', (select json_agg(json_build_object('id', l.id, 'folder', l.folder_id) order by l.id) from public.vault_links l),
  'tags', (select json_agg(t order by t.id) from public.tags t),
  'vtags', (select json_agg(t order by t.id) from public.vault_tags t),
  'vlt', (select json_agg(x order by x.link_id, x.tag_id) from public.vault_link_tags x),
  'ct', (select json_agg(x order by x.character_id, x.tag_id) from public.character_tags x),
  'groups', (select json_agg(g order by g.id) from public.tag_groups g));`);

const folderOf = (linkTitle) => sql(`select coalesce(f.name, '(Unsorted)') from public.vault_links l
  left join public.vault_folders f on f.id = l.folder_id where l.title = '${linkTitle}';`);
const linkTags = (linkTitle) => json(`select t.name from public.vault_link_tags lt join public.vault_tags t on t.id = lt.tag_id
  join public.vault_links l on l.id = lt.link_id where l.title = '${linkTitle}' order by t.name`).map((r) => r.name);

before(() => {
  if (skip) return;
  const r = psql(BASE, `create database ${dbName};`);
  if (!r.ok) throw new Error(r.err);
  sql(SUPABASE_STUB);
  sql(file('supabase/setup.sql'));
  sql(file('supabase/migrations/20261104_01_tags_source_duplicates.sql'));
  sql(file('supabase/migrations/20261104_02_link_vault.sql'));
  sql(SEED);
  sql(MIGRATION);
  sql(REFERENCE_MIGRATION);
});
after(() => { if (!skip) psql(BASE, `drop database if exists ${dbName} with (force);`); });

test('conversion: links land in the folder of their most-used tag', { skip }, () => {
  assert.equal(folderOf('L1 tutorial'), 'Tutorial');
  assert.equal(folderOf('L2 tutorial + sci-fi'), 'Tutorial');          // Tutorial: 2 links, Sci-fi: 1
  assert.equal(folderOf('L3 fantasy'), 'Fantasy');
  assert.equal(folderOf('L4 fantasy + animation'), 'Fantasy');
  assert.equal(folderOf('L5 cozy'), 'cozy');
  assert.equal(folderOf('L6 noir'), 'Noir');
  assert.equal(folderOf('L7 no tags'), '(Unsorted)');
  assert.equal(folderOf('L8 beta + alpha (tie)'), 'Alpha');            // tie → alphabetical
  // only tags that received links became folders; all top level, alphabetical order
  assert.deepEqual(json(`select name, parent_id, position from public.vault_folders where user_id = '${A}' order by position`),
    ['Alpha', 'cozy', 'Fantasy', 'Noir', 'Tutorial'].map((name, position) => ({ name, parent_id: null, position })));
});

test('conversion: other tags are kept as Vault tags', { skip }, () => {
  assert.deepEqual(linkTags('L2 tutorial + sci-fi'), ['Sci-fi']);
  assert.deepEqual(linkTags('L4 fantasy + animation'), ['Animation']);
  assert.deepEqual(linkTags('L8 beta + alpha (tie)'), ['Beta']);
  assert.deepEqual(linkTags('L1 tutorial'), []);
  assert.deepEqual(json(`select name from public.vault_tags where user_id = '${A}' order by lower(name)`).map((r) => r.name),
    ['Animation', 'Beta', 'Sci-fi']);
});

test('conversion: character tags still in use survive, link-only tags go, groups untouched', { skip }, () => {
  assert.deepEqual(json(`select name from public.tags where user_id = '${A}' order by name`).map((r) => r.name),
    ['Fantasy', 'Lonely', 'Noir', 'Villain']);
  assert.equal(sql(`select count(*) from public.character_tags`), '3');
  assert.equal(sql(`select count(*) from public.tag_groups`), '1');
  assert.equal(sql(`select count(*) from public.vault_links`), '9');   // no link lost
});

test('conversion: each user is converted separately', { skip }, () => {
  assert.equal(folderOf('B tutorial'), 'Tutorial');
  assert.equal(sql(`select count(*) from public.vault_folders where user_id = '${B}'`), '1');
  assert.equal(sql(`select count(*) from public.tags where user_id = '${B}'`), '0');
  assert.equal(sql(`select count(*) from public.vault_folders`, B), '1');   // RLS: B only sees B's
});

test('running the file a second time changes nothing', { skip }, () => {
  const first = snapshot();
  sql(MIGRATION);
  assert.equal(snapshot(), first);
});

test('folders: 3 levels allowed, a 4th refused', { skip }, () => {
  const id = (name) => sql(`select id from public.vault_folders where name = '${name}'`, A);
  sql(`insert into public.vault_folders (name) values ('Art');`, A);
  sql(`insert into public.vault_folders (name, parent_id) values ('Tutorials', '${id('Art')}');`, A);
  sql(`insert into public.vault_folders (name, parent_id) values ('Anatomy', '${id('Tutorials')}');`, A);
  expectError(`insert into public.vault_folders (name, parent_id) values ('Hands', '${id('Anatomy')}');`, A, /3 levels deep/);
  // moving a 2-level folder under a 2nd-level folder would make 4 levels
  sql(`insert into public.vault_folders (name) values ('Refs'); insert into public.vault_folders (name, parent_id)
       select 'Faces', id from public.vault_folders where name = 'Refs';`, A);
  expectError(`update public.vault_folders set parent_id = '${id('Tutorials')}' where name = 'Refs';`, A, /3 levels deep/);
  // ...but under a top-level folder is fine
  sql(`update public.vault_folders set parent_id = '${id('Art')}' where name = 'Refs';`, A);
  // into itself / its own subfolder
  expectError(`update public.vault_folders set parent_id = id where name = 'Art';`, A, /into itself/);
  expectError(`update public.vault_folders set parent_id = '${id('Anatomy')}' where name = 'Art';`, A, /into itself/);
  // same name in the same place (any case)
  expectError(`insert into public.vault_folders (name) values ('  art ');`, A, /duplicate key/);
  // someone else's folder is invisible and can't be used
  expectError(`insert into public.vault_folders (name, parent_id) values ('Sneaky', '${id('Art')}');`, B, /row-level security|not found/i);
  expectError(`update public.vault_links set folder_id = '${id('Art')}' where user_id = '${B}';`, B, /row-level security/);
});

test('deleting a folder moves its links and subfolders up, never deletes links', { skip }, () => {
  const id = (name) => sql(`select id from public.vault_folders where name = '${name}'`, A);
  sql(`insert into public.vault_folders (name, position) values ('Tutorials', 99);`, A); // clash at top level
  sql(`update public.vault_links set folder_id = '${id('Art')}' where title = 'L7 no tags';
       update public.vault_links set folder_id = (select f.id from public.vault_folders f join public.vault_folders p on p.id = f.parent_id
         where f.name = 'Tutorials' and p.name = 'Art') where title = 'L1 tutorial';`, A);
  const links = sql(`select count(*) from public.vault_links`);
  sql(`delete from public.vault_folders where name = 'Art';`, A);
  assert.equal(sql(`select count(*) from public.vault_links`), links);
  assert.equal(folderOf('L7 no tags'), '(Unsorted)');                 // Art's own link → top level
  assert.equal(folderOf('L1 tutorial'), 'Tutorials (2)');             // still in its (renamed) folder
  assert.deepEqual(json(`select f.name, p.name as parent from public.vault_folders f left join public.vault_folders p on p.id = f.parent_id
    where f.user_id = '${A}' and f.name in ('Tutorials', 'Tutorials (2)', 'Anatomy', 'Refs') order by f.name`, A), [
    { name: 'Anatomy', parent: 'Tutorials (2)' },
    { name: 'Refs', parent: null },
    { name: 'Tutorials', parent: null },
    { name: 'Tutorials (2)', parent: null },
  ]);
});

test('Vault tags and Character tags stay separate', { skip }, () => {
  sql(`select public.set_link_tags('30000000-0000-0000-0000-000000000001', array['Anatomy refs', 'fantasy']) \\g /dev/null`, A);
  assert.deepEqual(linkTags('L1 tutorial'), ['Anatomy refs', 'fantasy']);
  // a Vault tag "fantasy" exists now, but the Character tag "Fantasy" is a different row
  assert.equal(sql(`select count(*) from public.tags where lower(name) = 'fantasy'`), '1');
  assert.equal(sql(`select count(*) from public.tags where name = 'Anatomy refs'`), '0');
  // merging character tags leaves links alone
  sql(`select public.merge_tags(array(select id from public.tags where name = 'Villain'), (select id from public.tags where name = 'Fantasy'));`, A);
  assert.deepEqual(linkTags('L1 tutorial'), ['Anatomy refs', 'fantasy']);
  // merging Vault tags moves links
  sql(`select public.merge_vault_tags(array(select id from public.vault_tags where name = 'Sci-fi'), (select id from public.vault_tags where name = 'fantasy'));`, A);
  assert.deepEqual(linkTags('L2 tutorial + sci-fi'), ['fantasy']);
  assert.equal(sql(`select count(*) from public.tags where name = 'Noir'`), '1');
  // a link can't use someone else's Vault tag
  expectError(`insert into public.vault_link_tags (link_id, tag_id) values ('30000000-0000-0000-0000-000000000009',
    '${sql(`select id from public.vault_tags where name = 'Beta'`)}');`, B, /row-level security/);
});

test('image reference link: optional, http(s) only, max 2000 characters, own images only', { skip }, () => {
  const CHAR = '20000000-0000-0000-0000-000000000001';
  const IMG = '40000000-0000-0000-0000-000000000001';
  sql(`insert into public.images (id, character_id, path) values ('${IMG}', '${CHAR}', '${A}/x/1.jpg');`, A);
  const ref = () => sql(`select coalesce(reference_url, '(none)') from public.images where id = '${IMG}'`);
  assert.equal(ref(), '(none)');                                       // optional: empty by default
  sql(`update public.images set reference_url = 'https://example.com/art/1' where id = '${IMG}';`, A);
  assert.equal(ref(), 'https://example.com/art/1');
  sql(`update public.images set reference_url = 'HTTP://example.com/' || repeat('a', 1981) where id = '${IMG}';`, A); // exactly 2000
  for (const bad of ['javascript:alert(1)', 'ftp://example.com/a', 'example.com', '', ' https://example.com']) {
    expectError(`update public.images set reference_url = '${bad}' where id = '${IMG}';`, A, /images_reference_url_check/);
  }
  expectError(`update public.images set reference_url = 'https://example.com/' || repeat('a', 1982) where id = '${IMG}';`, A, /images_reference_url_check/);
  // someone else can't see or change it
  sql(`update public.images set reference_url = 'https://evil.example.com' where id = '${IMG}';`, B);
  assert.equal(sql(`select count(*) from public.images where id = '${IMG}'`, B), '0');
  assert.match(ref(), /^HTTP:\/\/example\.com/);
  sql(`update public.images set reference_url = null where id = '${IMG}';`, A);    // can be removed again
  assert.equal(ref(), '(none)');
  // running the file again keeps the data and the rule
  sql(`update public.images set reference_url = 'https://example.com/keep' where id = '${IMG}';`, A);
  sql(REFERENCE_MIGRATION);
  assert.equal(ref(), 'https://example.com/keep');
  expectError(`update public.images set reference_url = 'nope' where id = '${IMG}';`, A, /images_reference_url_check/);
});

test('deleting a whole account still works', { skip }, () => {
  sql(`delete from auth.users where id = '${A}';`);
  assert.equal(sql(`select count(*) from public.vault_folders where user_id = '${A}'`), '0');
  assert.equal(sql(`select count(*) from public.vault_links where user_id = '${B}'`), '1');
});
