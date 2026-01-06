-- Helper function to safely migrate data between tables
-- It automatically detects common columns and copies data
CREATE OR REPLACE FUNCTION safe_migrate_data(target_table TEXT, source_table TEXT) 
RETURNS VOID AS $$
DECLARE
    common_columns TEXT;
    query TEXT;
BEGIN
    -- Find common columns between source and target tables
    SELECT string_agg(quote_ident(column_name::text), ', ')
    INTO common_columns
    FROM (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = source_table AND table_schema = current_schema()
        INTERSECT
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = target_table AND table_schema = current_schema()
    ) t;

    IF common_columns IS NOT NULL THEN
        query := format('INSERT INTO %I (%s) SELECT %s FROM %I', target_table, common_columns, common_columns, source_table);
        RAISE NOTICE 'Migrating data from % to % using columns: %', source_table, target_table, common_columns;
        EXECUTE query;
    ELSE
        RAISE NOTICE 'No common columns found between % and %. Skipping data migration.', source_table, target_table;
    END IF;
END;
$$ LANGUAGE plpgsql;
