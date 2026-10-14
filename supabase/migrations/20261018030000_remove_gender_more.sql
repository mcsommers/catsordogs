-- Gender choices are Woman, Man, and Non-binary only (design 03 / 08d).

update public.profiles
set gender = 'Non-binary'
where gender = 'More';

delete from public.profile_options
where category = 'gender' and value = 'More';
