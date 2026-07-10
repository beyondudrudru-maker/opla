--
-- Full Supabase schema for Melody's persistent state (Project 2 / coreClient).
-- All engine modules read/write through database/supabaseClient.js, never
-- raw SQL elsewhere in the app.
--
-- STATUS: already applied to the production "beyo" Supabase project.
-- This file is kept in the repo for documentation/reproducibility (e.g.
-- setting up a fresh environment) — safe to re-run since every statement
-- uses `if not exists`; re-running against the live DB is a no-op.
--

-- Layer A: slow-moving relationship state, one row per Discord user
create table if not exists user_profiles (
  user_id           text primary key,
  display_name      text,
  tier              text default 'unknown',   -- creator | vip | regular | admin | moderator | troublemaker
  trust             smallint default 30,
  respect           smallint default 30,
  affection         smallint default 20,
  familiarity       smallint default 0,
  protectiveness    smallint default 20,
  interaction_count integer default 0,
  first_seen        timestamptz default now(),
  last_seen         timestamptz default now()
);

-- Layer B: fast-moving mood state, overwritten each turn
create table if not exists emotional_state (
  user_id         text primary key references user_profiles(user_id) on delete cascade,
  warmth          smallint default 40,
  playfulness     smallint default 30,
  energy          smallint default 50,
  patience        smallint default 70,
  stress          smallint default 10,
  humor           smallint default 30,
  social_comfort  smallint default 50,
  annoyance       smallint default 0,
  curiosity       smallint default 40,
  jealousy        smallint default 0,
  discipline      smallint default 95,
  professionalism smallint default 60,
  updated_at      timestamptz default now()
);

-- Rolling raw transcript, pruned aggressively (see reflection job)
create table if not exists conversation_turns (
  id          bigserial primary key,
  channel_id  text not null,
  user_id     text,
  role        text not null,             -- 'user' | 'melody'
  content     text not null,
  session_id  uuid,
  created_at  timestamptz default now()
);
create index if not exists idx_turns_channel_time on conversation_turns (channel_id, created_at desc);

-- Curated long-term memory, written by the nightly extraction job —
-- never raw chat, always distilled facts/events.
--
-- content_hash: sha256(user_id + '::' + lowercased/trimmed content),
-- computed by memory/memoryEngine.js before every write. The unique
-- constraint on (user_id, content_hash) makes repeated reflection runs
-- over the same turns idempotent — re-extracting the same disclosure
-- on a later run is a no-op insert instead of a duplicate row.
--
-- NOTE: this table has no automated delete/prune path anywhere in the
-- app (see reflection/reflectionJob.js) — rows here are permanent unless
-- removed manually. This is intentional per project requirement.
create table if not exists long_term_memories (
  id              bigserial primary key,
  user_id         text references user_profiles(user_id) on delete cascade,
  content         text not null,
  content_hash    text not null,
  topic_tags      text[] default '{}',
  emotional_score real default 0,       -- 0-1 significance, set at write time
  last_referenced timestamptz default now(),
  created_at      timestamptz default now(),
  unique (user_id, content_hash)
);
create index if not exists idx_ltm_user_score on long_term_memories (user_id, emotional_score desc);

-- Moderation / troublemaker signal history
create table if not exists moderation_flags (
  id         bigserial primary key,
  user_id    text references user_profiles(user_id) on delete cascade,
  reason     text,
  severity   smallint,
  created_at timestamptz default now()
);
create index if not exists idx_modflags_user on moderation_flags (user_id, created_at desc);
