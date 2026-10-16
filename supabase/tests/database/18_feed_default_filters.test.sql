-- Defaults for feed filters when Build Profile is finished.
begin;
select plan(15);

select is(private.default_feed_show_me('Man', 'Straight'), 'Women', 'Straight man: Show me Women');
select is(private.default_feed_show_me('Man', 'Gay'), 'Men', 'Gay man: Show me Men');
select is(private.default_feed_show_me('Woman', 'Lesbian'), 'Women', 'Lesbian woman: Show me Women');
select is(private.default_feed_show_me('Woman', 'Straight'), 'Men', 'Straight woman: Show me Men');
select is(private.default_feed_show_me('Woman', 'Gay'), 'Women', 'Gay woman: Show me Women');
select is(private.default_feed_show_me('Man', 'Lesbian'), 'All Genders', 'Lesbian man: Show me All Genders');

select is(private.default_feed_show_me('Man', 'Bisexual'), 'All Genders', 'Bisexual man: Show me All Genders');
select is(private.default_feed_show_me('Woman', 'Bisexual'), 'All Genders', 'Bisexual woman: Show me All Genders');
select is(private.default_feed_show_me('Woman', 'Pansexual'), 'All Genders', 'Pansexual woman: Show me All Genders');
select is(private.default_feed_show_me('Man', 'Questioning'), 'All Genders', 'Questioning man: Show me All Genders');

select is(private.default_feed_show_me('Non-binary', 'Straight'), 'All Genders', 'Straight non-binary: Show me All Genders');
select is(private.default_feed_show_me('Two-Spirit', null), 'All Genders', 'non Man/Woman with no orientation: Show me All Genders');
select is(private.default_feed_show_me('Woman', null), null, 'Woman with no orientation: no Show me default');
select is(private.default_feed_show_me('Woman', ''), null, 'blank orientation: no Show me default');
select is(private.default_feed_show_me('Woman', 'Wizard'), null, 'unknown orientation: no Show me default');

select * from finish();
rollback;
