-- Sample data for LOCAL development only. This runs on `npm run db:reset`
-- and is never applied to staging or production.
-- Question dates are relative to today (UTC) so the local app always has a
-- current question.

insert into public.questions (question_date, text)
select (now() at time zone 'utc')::date + offs, q
from (values
  (-7, 'What''s a small thing that made you smile this week?'),
  (-6, 'What are your thoughts on graffiti?'),
  (-5, 'Describe your perfect lazy Sunday.'),
  (-4, 'What''s a skill you wish you had?'),
  (-3, 'What''s the best meal you''ve ever had?'),
  (-2, 'Who taught you the most about love?'),
  (-1, 'What''s something you changed your mind about recently?'),
  (0,  'Cats or dogs? Make your case.'),
  (1,  'What would you do with a free day in a new city?'),
  (2,  'What''s a tradition you''d never give up?'),
  (3,  'What''s the kindest thing a stranger has done for you?'),
  (4,  'What song is on repeat for you right now?'),
  (5,  'What''s your most useless talent?'),
  (6,  'What does a good friendship look like to you?')
) as t(offs, q);
