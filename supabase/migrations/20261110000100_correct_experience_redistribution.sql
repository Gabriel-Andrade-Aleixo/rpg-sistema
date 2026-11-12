with marked as (
  select
    c.id,
    c.data,
    c.sync_revision + 1 as next_revision,
    (
      select (entry->>'amount')::integer
      from jsonb_array_elements(coalesce(c.data->'classXpHistory', '[]'::jsonb)) entry
      where entry->>'id' = 'class_xp_redistribution_v2'
      limit 1
    ) as original_bonus,
    (
      select entry->>'note'
      from jsonb_array_elements(coalesce(c.data->'classXpHistory', '[]'::jsonb)) entry
      where entry->>'id' = 'class_xp_redistribution_v2'
      limit 1
    ) as redistribution_note
  from public.characters c
  where c.deleted_at is null
    and coalesce((c.data->>'xpSystemVersion')::integer, 0) = 2
), prepared as (
  select
    marked.*,
    case when redistribution_note = 'Diferença dos níveis já pagos na nova progressão de XP'
      then original_bonus
      else case original_bonus
        when 10 then 0 when 15 then 10 when 20 then 15
        when 25 then 15 when 30 then 10 when 35 then 20
        when 45 then 25 when 50 then 20 when 55 then 10
        else original_bonus
      end
    end as corrected_bonus
  from marked
), updated as (
  update public.characters c
  set data = p.data || jsonb_build_object(
      'classXp', greatest(0, coalesce((p.data->>'classXp')::integer, 0) + coalesce(p.corrected_bonus - p.original_bonus, 0)),
      'classXpTotal', greatest(0, coalesce((p.data->>'classXpTotal')::integer, 0) + coalesce(p.corrected_bonus - p.original_bonus, 0)),
      'classXpHistory', coalesce((
        select jsonb_agg(
          case when entry->>'id' = 'class_xp_redistribution_v2'
            and p.corrected_bonus is distinct from p.original_bonus
          then entry || jsonb_build_object(
            'amount', p.corrected_bonus,
            'note', 'Diferença dos níveis já pagos na nova progressão de XP',
            'breakdown', coalesce(entry->'breakdown', '{}'::jsonb) || jsonb_build_object('redistribution', p.corrected_bonus)
          ) else entry end
          order by position
        )
        from jsonb_array_elements(coalesce(p.data->'classXpHistory', '[]'::jsonb)) with ordinality as history(entry, position)
      ), '[]'::jsonb),
      'xpSystemVersion', 3,
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
select id, sync_revision, array['classXp', 'classXpTotal', 'classXpHistory', 'xpSystemVersion'], data
from updated;

insert into public.rpg_migrations (name)
values ('20261110000100_correct_experience_redistribution.sql')
on conflict (name) do nothing;
