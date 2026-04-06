-- Expand asset_class to include 'crypto' and 'real_estate'
-- Previously these were both classified as 'alternative'

-- Drop the existing check constraint and recreate with new values
alter table assets drop constraint if exists assets_asset_class_check;
alter table assets add constraint assets_asset_class_check
  check (asset_class in (
    'domestic_equity', 'foreign_equity', 'bond', 'commodity',
    'cash_equiv', 'alternative', 'crypto', 'real_estate'
  ));

-- Migrate existing data: reclassify crypto and real_estate assets
update assets set asset_class = 'crypto'
  where category = 'crypto' and asset_class = 'alternative';

update assets set asset_class = 'real_estate'
  where category = 'real_estate' and asset_class = 'alternative';
