-- Sample data for LOCAL development only. This runs on `npm run db:reset`
-- and is never applied to staging or production.
-- Question dates are relative to today (UTC). Only past questions are here;
-- today and the next 19 days come from sample_questions.sql.

insert into public.questions (question_date, text)
select (now() at time zone 'utc')::date + offs, q
from (values
  (-7, 'What''s a small thing that made you smile this week?'),
  (-6, 'What are your thoughts on graffiti?'),
  (-5, 'Describe your perfect lazy Sunday.'),
  (-4, 'What''s a skill you wish you had?'),
  (-3, 'What''s the best meal you''ve ever had?'),
  (-2, 'Who taught you the most about love?'),
  (-1, 'What''s something you changed your mind about recently?')
) as t(offs, q);
