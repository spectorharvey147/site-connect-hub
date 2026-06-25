alter table public.user_profiles
  add column if not exists profile_photo_path text,
  add column if not exists signature_url text,
  add column if not exists signature_path text;

comment on column public.user_profiles.profile_photo_path is
  'Private profile-photos bucket object path for the current profile image.';
comment on column public.user_profiles.signature_path is
  'Private profile-photos bucket object path for the user signature image.';
