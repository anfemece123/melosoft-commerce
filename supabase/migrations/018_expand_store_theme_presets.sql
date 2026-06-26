-- Expand the allowed theme presets for store theme settings.

alter table public.store_theme_settings
  drop constraint if exists store_theme_preset_valid;

alter table public.store_theme_settings
  add constraint store_theme_preset_valid
    check (
      theme_preset in (
        'blue',
        'violet',
        'emerald',
        'rose',
        'amber',
        'slate',
        'red',
        'orange',
        'yellow',
        'lime',
        'teal',
        'cyan',
        'sky',
        'indigo',
        'fuchsia',
        'pink'
      )
    );

comment on column public.store_theme_settings.theme_preset is
  'Named color preset (blue|violet|emerald|rose|amber|slate|red|orange|yellow|lime|teal|cyan|sky|indigo|fuchsia|pink). Drives primary/secondary/accent colors.';
