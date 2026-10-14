-- Default daily-question email/push to 12:03 in each person's own time zone.

alter table public.app_settings alter column daily_question_notify_time set default '12:03';

update public.app_settings set daily_question_notify_time = '12:03';
