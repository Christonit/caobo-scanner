-- Add optional "Otros Impuestos" column mapping to client_tax_column_mappings.
alter table public.client_tax_column_mappings
  add column if not exists otros_impuestos_column smallint
    check (otros_impuestos_column between 1 and 5);
