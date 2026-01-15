-- ================================================================================
-- TAINIEX ATLAS - GRAPH SCHEMA CREATION SCRIPT
-- ================================================================================
-- This script creates and migrates graph tables (graph_nodes, graph_edges).
-- It is idempotent and compatible with create_schema.sql patterns.
--
-- LOGIC: Create New Table -> Copy Data -> Rename Old to Backup -> Rename New to Current
-- ================================================================================

-- Enable pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure migration helper exists (copied from create_schema.sql for standalone safety)
CREATE OR REPLACE FUNCTION safe_migrate_data(target_table text, source_table text) RETURNS void AS $$
DECLARE
    col_name text;
    column_list text := '';
BEGIN
    -- Build a list of common columns
    FOR col_name IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = target_table AND table_schema = current_schema()
        INTERSECT 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = source_table AND table_schema = current_schema()
    LOOP
        IF column_list <> '' THEN
            column_list := column_list || ', ';
        END IF;
        column_list := column_list || quote_ident(col_name);
    END LOOP;

    IF column_list <> '' THEN
        EXECUTE format('INSERT INTO %I (%s) SELECT %s FROM %I', target_table, column_list, column_list, source_table);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 1. GRAPH_NODES Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS graph_nodes_new CASCADE;
CREATE TABLE graph_nodes_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Enum: CONCEPT, TECHNOLOGY, PROJECT, PERSON, PREFERENCE
    summary TEXT,
    embedding vector(768), -- For semantic deduplication (Gemini embedding size)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    -- Check if the legacy table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'graph_nodes' AND table_schema = current_schema()) THEN
        -- Migrate data
        PERFORM safe_migrate_data('graph_nodes_new', 'graph_nodes');
        
        -- Rename old table to backup
        -- Note: Existing foreign keys from graph_edges will prevent dropping/renaming unless CASCADE is handled or we expect graph_edges to be recreated too.
        -- However, renaming a referenced table usually works in PG, but renaming the table doesn't change the constraints pointing to it?
        -- Actually, ALTER TABLE RENAME renames the table entity. FKs pointing to it by OID will follow the rename.
        -- So 'graph_edges' will point to 'graph_nodes_backup_...'.
        EXECUTE 'ALTER TABLE graph_nodes RENAME TO graph_nodes_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    -- Rename new table to production name
    ALTER TABLE graph_nodes_new RENAME TO graph_nodes;
END $$;

-- Indices for Nodes
DROP INDEX IF EXISTS idx_graph_nodes_name;
CREATE INDEX idx_graph_nodes_name ON graph_nodes(name);

DROP INDEX IF EXISTS idx_graph_nodes_type;
CREATE INDEX idx_graph_nodes_type ON graph_nodes(type);

-- HNSW Index for vector similarity search
DROP INDEX IF EXISTS idx_graph_nodes_embedding;
CREATE INDEX idx_graph_nodes_embedding ON graph_nodes USING hnsw (embedding vector_cosine_ops);


-- 2. GRAPH_EDGES Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS graph_edges_new;
CREATE TABLE graph_edges_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- References the NEW graph_nodes table (which is named 'graph_nodes' after step 1)
    source_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,
    weight FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_node_id, target_node_id, relation_type)
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'graph_edges' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('graph_edges_new', 'graph_edges');
        EXECUTE 'ALTER TABLE graph_edges RENAME TO graph_edges_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE graph_edges_new RENAME TO graph_edges;
END $$;

-- Indices for Edges
DROP INDEX IF EXISTS idx_graph_edges_source;
CREATE INDEX idx_graph_edges_source ON graph_edges(source_node_id);

DROP INDEX IF EXISTS idx_graph_edges_target;
CREATE INDEX idx_graph_edges_target ON graph_edges(target_node_id);

DROP INDEX IF EXISTS idx_graph_edges_relation;
CREATE INDEX idx_graph_edges_relation ON graph_edges(relation_type);


-- 3. TRIGGERS
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_graph_nodes_updated_at ON graph_nodes;
CREATE TRIGGER update_graph_nodes_updated_at
    BEFORE UPDATE ON graph_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
