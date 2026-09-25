-- Migration: Create cv_analyses table for storing resume analysis results
-- Run this in your Supabase SQL editor or via supabase db push

create table if not exists public.cv_analyses (
  id uuid primary key default gen_random_uuid(),
  job_offer_id uuid not null,
  cv_id text not null,
  
  -- Contact information extracted from CV
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  contact_linkedin text,
  contact_location text,
  
  -- Scores (0-100)
  score_overall integer not null check (score_overall >= 0 and score_overall <= 100),
  score_skills_match integer not null check (score_skills_match >= 0 and score_skills_match <= 100),
  score_experience_match integer not null check (score_experience_match >= 0 and score_experience_match <= 100),
  score_education_match integer not null check (score_education_match >= 0 and score_education_match <= 100),
  score_keywords_match integer not null check (score_keywords_match >= 0 and score_keywords_match <= 100),
  
  -- Analysis details
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  summary text not null,
  cultural_fit_score integer check (cultural_fit_score >= 0 and cultural_fit_score <= 100),
  cultural_fit_assessment text,
  soft_skills text[] not null default '{}',
  interview_questions text[] not null default '{}',
  recommended boolean not null default false,
  
  -- Metadata
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for querying analyses by job offer
create index if not exists idx_cv_analyses_job_offer_id on public.cv_analyses(job_offer_id);

-- Index for querying by CV ID
create index if not exists idx_cv_analyses_cv_id on public.cv_analyses(cv_id);

-- Index for filtering recommended candidates
create index if not exists idx_cv_analyses_recommended on public.cv_analyses(recommended) where recommended = true;

-- Index for sorting by overall score
create index if not exists idx_cv_analyses_score_overall on public.cv_analyses(score_overall desc);

-- Enable Row Level Security
alter table public.cv_analyses enable row level security;

-- Policy: Allow service role to do everything (for edge functions)
create policy "Service role full access" on public.cv_analyses
  for all using (auth.role() = 'service_role');

-- Policy: Allow authenticated users to read analyses for their job offers
-- (Assuming you'll have a job_offers table with user_id)
-- create policy "Users can read analyses for their job offers" on public.cv_analyses
--   for select using (
--     exists (
--       select 1 from public.job_offers
--       where job_offers.id = cv_analyses.job_offer_id
--       and job_offers.user_id = auth.uid()
--     )
--   );

-- Trigger to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end $$;

create trigger update_cv_analyses_updated_at
  before update on public.cv_analyses
  for each row execute function public.update_updated_at_column();