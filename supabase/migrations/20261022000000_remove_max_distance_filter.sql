-- Feed Settings (06i): the "Maximum distance" filter is removed. Distance now only affects the
-- order of the feed, through the Distance ranking signal.
-- Saved values are stripped first because validate_filters rejects keys that are no longer active.
update public.filter_preferences set filters = filters - 'max_distance' where filters ? 'max_distance';
update public.filter_definitions set active = false where key = 'max_distance';
