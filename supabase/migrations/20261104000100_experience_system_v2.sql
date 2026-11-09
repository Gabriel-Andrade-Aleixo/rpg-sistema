with legacy as (
  select
    c.id,
    c.sync_revision + 1 as next_revision,
    c.data,
    greatest(1, least(10, coalesce((c.data->>'level')::integer, 1))) as level,
    greatest(0, coalesce((c.data->>'combatXp')::integer, 0)) as combat_xp,
    coalesce((
      select sum(
        case jsonb_typeof(item.value)
          when 'number' then (item.value #>> '{}')::integer
          when 'object' then coalesce((item.value->>'xp')::integer, 0)
          else 0
        end
      )
      from jsonb_each(coalesce(c.data->'areaExperience', '{}'::jsonb)) item
    ), 0)::integer as area_xp
  from public.characters c
  where c.deleted_at is null
    and coalesce((c.data->>'xpSystemVersion')::integer, 0) < 2
), prepared as (
  select
    legacy.*,
    case level
      when 1 then 10 when 2 then 15 when 3 then 20 when 4 then 25
      when 5 then 30 when 6 then 35 when 7 then 45 when 8 then 50
      when 9 then 55 else 0
    end as class_bonus,
    combat_xp + area_xp + greatest(0, coalesce((data->>'developmentXp')::integer, 0)) as combined_development_xp
  from legacy
), updated as (
  update public.characters c
  set
    data = p.data || jsonb_build_object(
      'classXp', greatest(0, coalesce((p.data->>'classXp')::integer, 0)) + p.class_bonus,
      'classXpTotal', greatest(0, coalesce((p.data->>'classXpTotal')::integer, 0)) + p.class_bonus,
      'classXpHistory',
        case when p.class_bonus > 0 then
          jsonb_build_array(jsonb_build_object(
            'id', 'class_xp_redistribution_v2',
            'amount', p.class_bonus,
            'note', 'Redistribuição do sistema de XP V0.3',
            'createdAt', now(),
            'breakdown', jsonb_build_object('redistribution', p.class_bonus)
          )) || coalesce(p.data->'classXpHistory', '[]'::jsonb)
        else coalesce(p.data->'classXpHistory', '[]'::jsonb) end,
      'developmentXp', p.combined_development_xp % 20,
      'developmentPoints', greatest(0, coalesce((p.data->>'developmentPoints')::integer, 0)) + (p.combined_development_xp / 20),
      'developmentAttributeBonuses', coalesce(p.data->'developmentAttributeBonuses', '{}'::jsonb),
      'developmentSkillBonuses', coalesce(p.data->'developmentSkillBonuses', '{}'::jsonb),
      'areaExperience', '{}'::jsonb,
      'combatXp', 0,
      'experienceHistory',
        case when p.combat_xp + p.area_xp > 0 then
          jsonb_build_array(jsonb_build_object(
            'id', 'xp_migration_v2',
            'type', 'migration',
            'amount', p.combat_xp + p.area_xp,
            'description', format('Saldos antigos consolidados: %s PD e %s XP', p.combined_development_xp / 20, p.combined_development_xp % 20),
            'createdAt', now()
          )) || coalesce(p.data->'experienceHistory', '[]'::jsonb)
        else coalesce(p.data->'experienceHistory', '[]'::jsonb) end,
      'legacyExperienceMigration', jsonb_build_object(
        'areaXp', p.area_xp,
        'combatXp', p.combat_xp,
        'developmentPointsGranted', p.combined_development_xp / 20,
        'remainingDevelopmentXp', p.combined_development_xp % 20,
        'migratedAt', now()
      ),
      'xpSystemVersion', 2,
      'syncRevision', p.next_revision,
      'updatedAt', now()
    ),
    sync_revision = p.next_revision,
    updated_at = now()
  from prepared p
  where c.id = p.id
  returning c.id, c.sync_revision, c.data
)
insert into public.character_revisions (character_id, sync_revision, changed_fields, data)
select
  id,
  sync_revision,
  array['classXp', 'classXpTotal', 'developmentXp', 'developmentPoints', 'areaExperience', 'combatXp', 'xpSystemVersion'],
  data
from updated;

insert into public.rpg_migrations (name)
values ('20261104000100_experience_system_v2.sql')
on conflict (name) do nothing;
