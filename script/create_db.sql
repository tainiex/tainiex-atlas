-- ================================================================================
-- TAINIEX ATLAS - DATABASE CREATION SCRIPT
-- ================================================================================
-- This script creates the database and enables necessary extensions.
--
-- USAGE:
-- psql -U postgres -f script/create_db.sql
-- ================================================================================

-- 1. Create Database
-- Note: 'CREATE DATABASE' cannot run inside a transaction block.
-- If the database exists, you might see an error which can be ignored or handled manually.
SELECT 'CREATE DATABASE tainiex_atlas'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tainiex_atlas')\gexec

-- 2. Connect to the database
\c tainiex_atlas

-- 3. Enable Extensions

-- Enable pgvector for AI embeddings (Required for semantic_memories)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for fuzzy string matching and advanced text similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Note: Standard Full-Text Search (tsvector) is built-in and does not require an extension.

-- 4. Verify Extensions
SELECT extname, extversion FROM pg_extension;
