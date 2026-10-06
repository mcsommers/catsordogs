begin;
select plan(1);

select ok(true, 'database test tooling runs');

select * from finish();
rollback;
