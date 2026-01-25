-- ================================================================================
-- TAINIEX ATLAS - DATABASE SCHEMA CREATION SCRIPT
-- ================================================================================
-- This script creates and migrates all tables for the Tainiex Atlas application.
-- It is idempotent and can be safely re-run on existing databases.
--
-- USAGE:
-- 1. Execute this entire script in your PostgreSQL database client
-- 2. If errors occur, run: ROLLBACK; before re-running this script
--
-- ATOMICITY GUARANTEE / 原子性保证:
-- - Each table migration is wrapped in a DO $$ block, which executes as a single transaction
-- - The two RENAME operations (old->backup, new->current) are ATOMIC
-- - Users will NEVER see a moment where the table does not exist
-- - PostgreSQL's transactional DDL ensures zero-downtime schema changes
-- - 每个表迁移都包装在 DO $$ 块中，作为单个事务执行
-- - 两个 RENAME 操作（旧表->备份表，新表->当前表）是原子的
-- - 用户永远不会看到表不存在的时刻
-- - PostgreSQL 的事务性 DDL 确保零停机时间的架构更改
--
-- IMPORTANT NOTES:
-- - This script does NOT use a global transaction wrapper (no BEGIN/COMMIT)
-- - Each DO $$ block is independently atomic
-- - Failed operations can be debugged more easily without a global transaction
-- - Migration strategy: Create New Table -> Copy Data -> Rename Old to Backup -> Rename New to Current
-- ================================================================================

-- Load migration utility helper
-- Note: Assuming this script is run from the project root or script directory via psql
-- logic: Create New Table -> Copy Data -> Rename Old to Backup -> Rename New to Current

-- Ensure the helper function exists
-- ================================================================================
-- HELPER FUNCTIONS FOR SAFE MIGRATION
-- ================================================================================

-- Function to safely migrate data between tables matching column names
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

-- ================================================================================
-- ENABLE POSTGRESQL EXTENSIONS
-- ================================================================================
-- Enable required PostgreSQL extensions for full-text search and vector operations
-- tsvector: Built-in full-text search (PostgreSQL native, no installation needed)
-- pgvector: Vector similarity search for AI embeddings
-- ================================================================================

-- Enable pgvector extension (for vector similarity search and AI embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify pgvector installation (optional check, can be commented out in production)
-- Uncomment the following line to see installed extensions:
-- SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector');

-- Note: tsvector is built into PostgreSQL and does not require CREATE EXTENSION

-- 1. USERS Table
--------------------------------------------------------------------------------
-- Create the NEW table definition
DROP TABLE IF EXISTS users_new;
CREATE TABLE users_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    hashed_refresh_token VARCHAR(255),
    avatar VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

DO $$
BEGIN
    -- Check if the legacy table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users' AND table_schema = current_schema()) THEN
        -- Migrate data
        PERFORM safe_migrate_data('users_new', 'users');
        -- Rename old table to backup
        EXECUTE 'ALTER TABLE users RENAME TO users_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    -- Rename new table to production name
    ALTER TABLE users_new RENAME TO users;
END $$;


-- 2. INVITATION_CODE Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS invitation_code_new;
CREATE TABLE invitation_code_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_by_user_id UUID DEFAULT NULL
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invitation_code' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('invitation_code_new', 'invitation_code');
        EXECUTE 'ALTER TABLE invitation_code RENAME TO invitation_code_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE invitation_code_new RENAME TO invitation_code;
END $$;


-- 3. CHAT_SESSIONS Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS chat_sessions_new;
CREATE TABLE chat_sessions_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(100) DEFAULT 'New Chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_sessions' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('chat_sessions_new', 'chat_sessions');
        EXECUTE 'ALTER TABLE chat_sessions RENAME TO chat_sessions_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE chat_sessions_new RENAME TO chat_sessions;
END $$;


-- 4. CHAT_MESSAGES Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS chat_messages_new;
CREATE TABLE chat_messages_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    parent_id VARCHAR(50) DEFAULT 'ROOT' NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_messages' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('chat_messages_new', 'chat_messages');
        EXECUTE 'ALTER TABLE chat_messages RENAME TO chat_messages_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE chat_messages_new RENAME TO chat_messages;
END $$;

DROP INDEX IF EXISTS idx_chat_messages_parent_id;
CREATE INDEX idx_chat_messages_parent_id ON chat_messages(parent_id);


-- 4.5. CHAT_MESSAGE_HISTORIES Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS chat_message_histories_new;
CREATE TABLE chat_message_histories_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_message_histories' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('chat_message_histories_new', 'chat_message_histories');
        EXECUTE 'ALTER TABLE chat_message_histories RENAME TO chat_message_histories_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE chat_message_histories_new RENAME TO chat_message_histories;
END $$;

DROP INDEX IF EXISTS idx_chat_message_histories_message_id;
CREATE INDEX idx_chat_message_histories_message_id ON chat_message_histories(message_id);


-- 5. RATE_LIMITS Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS rate_limits_new;
CREATE TABLE rate_limits_new (
    "key" VARCHAR NOT NULL PRIMARY KEY,
    points INT DEFAULT 0,
    "expiresAt" TIMESTAMP NOT NULL
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rate_limits' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('rate_limits_new', 'rate_limits');
        EXECUTE 'ALTER TABLE rate_limits RENAME TO rate_limits_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE rate_limits_new RENAME TO rate_limits;
END $$;


-- ================================================================================
-- NOTES SYSTEM TABLES
-- Notes系统表结构
-- ================================================================================

-- 6. NOTES Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS notes_new;
CREATE TABLE notes_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL DEFAULT 'Untitled',
    cover_image VARCHAR(500),
    icon VARCHAR(100),
    parent_id UUID,
    template VARCHAR(50),
    is_public BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_edited_by UUID NOT NULL,
    search_vector tsvector
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notes' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('notes_new', 'notes');
        EXECUTE 'ALTER TABLE notes RENAME TO notes_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE notes_new RENAME TO notes;
END $$;

DROP INDEX IF EXISTS idx_notes_user_id;
CREATE INDEX idx_notes_user_id ON notes(user_id) WHERE is_deleted = FALSE;
DROP INDEX IF EXISTS idx_notes_parent_id;
CREATE INDEX idx_notes_parent_id ON notes(parent_id);
DROP INDEX IF EXISTS idx_notes_parent_active;
CREATE INDEX idx_notes_parent_active ON notes(parent_id) WHERE is_deleted = FALSE;
DROP INDEX IF EXISTS notes_search_idx;
CREATE INDEX notes_search_idx ON notes USING GIN(search_vector);


-- 8. BLOCKS Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS blocks_new;

-- Create ENUM type if not exists (explicitly matches shared-atlas BlockType)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blocks_type_enum') THEN
        CREATE TYPE blocks_type_enum AS ENUM (
            'TEXT', 'HEADING1', 'HEADING2', 'HEADING3', 
            'BULLET_LIST', 'NUMBERED_LIST', 
            'TODO_LIST', 'TODO_ITEM', 
            'TABLE', 'CODE', 
            'IMAGE', 'VIDEO', 'FILE', 
            'DIVIDER', 'QUOTE', 'CALLOUT', 'TOGGLE'
        );
    END IF;
END$$;

CREATE TABLE blocks_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL,
    type blocks_type_enum NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    parent_block_id UUID,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    last_edited_by UUID NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    search_vector tsvector
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'blocks' AND table_schema = current_schema()) THEN
        -- Explicit migration for blocks to handle ENUM casting
        -- Assumes legacy 'type' column is text/varchar and needs to be cast to blocks_type_enum
        INSERT INTO blocks_new (
            id, note_id, type, content, metadata, parent_block_id, position, 
            created_at, updated_at, created_by, last_edited_by, is_deleted, search_vector
        )
        SELECT 
            id, 
            note_id, 
            -- Inline safe cast: Check if upper(type) is valid, else fallback to TEXT
            CASE 
                WHEN upper(type::text) IN (
                    'TEXT', 'HEADING1', 'HEADING2', 'HEADING3', 
                    'BULLET_LIST', 'NUMBERED_LIST', 
                    'TODO_LIST', 'TODO_ITEM', 
                    'TABLE', 'CODE', 
                    'IMAGE', 'VIDEO', 'FILE', 
                    'DIVIDER', 'QUOTE', 'CALLOUT', 'TOGGLE'
                ) THEN upper(type::text)::blocks_type_enum
                ELSE 'TEXT'::blocks_type_enum
            END,
            content, 
            metadata, 
            parent_block_id, 
            position, 
            created_at, 
            updated_at, 
            created_by, 
            last_edited_by, 
            is_deleted, 
            search_vector
        FROM blocks;
        
        EXECUTE 'ALTER TABLE blocks RENAME TO blocks_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE blocks_new RENAME TO blocks;
END $$;

DROP INDEX IF EXISTS idx_blocks_note_id;
CREATE INDEX idx_blocks_note_id ON blocks(note_id);

DROP INDEX IF EXISTS idx_blocks_position;
CREATE INDEX idx_blocks_position ON blocks(note_id, position);

DROP INDEX IF EXISTS idx_blocks_parent;
CREATE INDEX idx_blocks_parent ON blocks(parent_block_id);

DROP INDEX IF EXISTS idx_blocks_active;
CREATE INDEX idx_blocks_active ON blocks(note_id) WHERE is_deleted = FALSE;

DROP INDEX IF EXISTS blocks_search_idx;
CREATE INDEX blocks_search_idx ON blocks USING GIN(search_vector);


-- 8. BLOCK_VERSIONS Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS block_versions_new;
CREATE TABLE block_versions_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    content TEXT,
    metadata JSONB,
    change_type VARCHAR(20) NOT NULL,
    diff JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    UNIQUE(block_id, version_number)
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'block_versions' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('block_versions_new', 'block_versions');
        EXECUTE 'ALTER TABLE block_versions RENAME TO block_versions_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE block_versions_new RENAME TO block_versions;
END $$;

DROP INDEX IF EXISTS idx_block_versions_block_id;
CREATE INDEX idx_block_versions_block_id ON block_versions(block_id, version_number DESC);


-- 9. NOTE_SNAPSHOTS Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS note_snapshots_new;
CREATE TABLE note_snapshots_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'note_snapshots' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('note_snapshots_new', 'note_snapshots');
        EXECUTE 'ALTER TABLE note_snapshots RENAME TO note_snapshots_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE note_snapshots_new RENAME TO note_snapshots;
END $$;

DROP INDEX IF EXISTS idx_note_snapshots_note_id;
CREATE INDEX idx_note_snapshots_note_id ON note_snapshots(note_id, created_at DESC);


-- 10. COLLABORATION_SESSIONS Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS collaboration_sessions_new;
CREATE TABLE collaboration_sessions_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL,
    user_id UUID NOT NULL,
    cursor_position JSONB,
    selection JSONB,
    color VARCHAR(20) NOT NULL,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    socket_id VARCHAR(100) NOT NULL
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'collaboration_sessions' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('collaboration_sessions_new', 'collaboration_sessions');
        EXECUTE 'ALTER TABLE collaboration_sessions RENAME TO collaboration_sessions_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE collaboration_sessions_new RENAME TO collaboration_sessions;
END $$;

DROP INDEX IF EXISTS idx_collab_sessions_note_id;
CREATE INDEX idx_collab_sessions_note_id ON collaboration_sessions(note_id);
DROP INDEX IF EXISTS idx_collab_sessions_activity;
CREATE INDEX idx_collab_sessions_activity ON collaboration_sessions(last_active_at);


-- 11. DOCUMENT_STATES Table (Y.js协同编辑状态)
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS document_states_new;
CREATE TABLE document_states_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL UNIQUE,
    state_vector BYTEA,
    document_state BYTEA,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_states' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('document_states_new', 'document_states');
        EXECUTE 'ALTER TABLE document_states RENAME TO document_states_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE document_states_new RENAME TO document_states;
END $$;


-- 12. NOTE_TEMPLATES Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS note_templates_new;
CREATE TABLE note_templates_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    thumbnail VARCHAR(500),
    category VARCHAR(50) NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    created_by UUID,
    template_data JSONB NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'note_templates' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('note_templates_new', 'note_templates');
        EXECUTE 'ALTER TABLE note_templates RENAME TO note_templates_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE note_templates_new RENAME TO note_templates;
END $$;

DROP INDEX IF EXISTS idx_templates_category;
CREATE INDEX idx_templates_category ON note_templates(category) WHERE is_public = TRUE;


-- ================================================================================
-- FULL-TEXT SEARCH TRIGGERS
-- 全文搜索触发器
-- ================================================================================

-- Trigger function for notes full-text search

CREATE OR REPLACE FUNCTION update_notes_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notes_search_vector_update ON notes;
CREATE TRIGGER notes_search_vector_update
BEFORE INSERT OR UPDATE ON notes
FOR EACH ROW EXECUTE FUNCTION update_notes_search_vector();

-- Trigger function for blocks full-text search

CREATE OR REPLACE FUNCTION update_blocks_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS blocks_search_vector_update ON blocks;
CREATE TRIGGER blocks_search_vector_update
BEFORE INSERT OR UPDATE ON blocks
FOR EACH ROW EXECUTE FUNCTION update_blocks_search_vector();


-- ================================================================================
-- SEED DATA - SYSTEM TEMPLATES
-- 初始数据 - 系统模板
-- ================================================================================

-- Seed system templates (only if table is empty)
DO $$
BEGIN
    IF (SELECT count(*) FROM note_templates) = 0 THEN
        INSERT INTO note_templates (name, description, category, is_public, created_by, template_data) VALUES
        ('Blank Page', 'Start with a blank page', 'basic', true, NULL, '{"blocks": []}'),
        ('Meeting Notes', 'Template for meeting notes', 'meeting', true, NULL, 
         '{"blocks": [
           {"type": "HEADING1", "content": "Meeting Notes"},
           {"type": "TEXT", "content": "Date: "},
           {"type": "HEADING2", "content": "Attendees"},
           {"type": "BULLET_LIST", "content": ""},
           {"type": "HEADING2", "content": "Agenda"},
           {"type": "NUMBERED_LIST", "content": ""},
           {"type": "HEADING2", "content": "Action Items"},
           {"type": "TODO_LIST", "content": ""}
         ]}'),
        ('Project Plan', 'Template for project planning', 'project', true, NULL,
         '{"blocks": [
           {"type": "HEADING1", "content": "Project Plan"},
           {"type": "HEADING2", "content": "Overview"},
           {"type": "TEXT", "content": ""},
           {"type": "HEADING2", "content": "Timeline"},
           {"type": "TABLE", "metadata": {"columns": ["Phase", "Start Date", "End Date", "Status"], "rows": []}},
           {"type": "HEADING2", "content": "Tasks"},
           {"type": "TODO_LIST", "content": ""}
         ]}'),
        ('Technical Doc', 'Template for technical documentation', 'doc', true, NULL,
         '{"blocks": [
           {"type": "HEADING1", "content": "Technical Documentation"},
           {"type": "HEADING2", "content": "Overview"},
           {"type": "TEXT", "content": ""},
           {"type": "HEADING2", "content": "Architecture"},
           {"type": "CODE", "content": "", "metadata": {"language": "typescript"}},
           {"type": "HEADING2", "content": "API Reference"},
           {"type": "TABLE", "metadata": {"columns": ["Endpoint", "Method", "Description"], "rows": []}}
         ]}'),
        ('Daily Journal', 'Template for daily journaling', 'personal', true, NULL,
         '{"blocks": [
           {"type": "HEADING1", "content": "Daily Journal"},
           {"type": "TEXT", "content": "Date: "},
           {"type": "HEADING2", "content": "Today''s Highlights"},
           {"type": "BULLET_LIST", "content": ""},
           {"type": "HEADING2", "content": "Thoughts"},
           {"type": "TEXT", "content": ""},
           {"type": "HEADING2", "content": "Tomorrow''s Goals"},
           {"type": "TODO_LIST", "content": ""}
         ]}');
    END IF;
END $$;


-- ================================================================================
-- INVITATION CODE SEEDING (EXISTING)
-- 邀请码填充 (现有逻辑)
-- ================================================================================

-- Seed Data (Only if empty, to avoid duplicates on re-run)
-- Note: Seeding strategy might need adjustment depending on requirements. 
-- Here we only seed if invitation_code is significantly empty (e.g. init).
DO $$
BEGIN
    IF (SELECT count(*) FROM invitation_code) < 10 THEN
        INSERT INTO invitation_code (code, expires_at)
        SELECT 
            upper(substring(md5(random()::text) from 1 for 8)),
            NOW() + INTERVAL '14 days'
        FROM generate_series(1, 100);
    END IF;
END $$;


-- ================================================================================
-- MEMORY DISTILLATION TABLES
-- 记忆蒸馏表结构
-- ================================================================================

-- 13. SEMANTIC_MEMORIES Table
--------------------------------------------------------------------------------
DROP TABLE IF EXISTS semantic_memories_new;

-- Create ENUM types if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_type_enum') THEN
        CREATE TYPE memory_type_enum AS ENUM ('PERSONAL', 'DOMAIN', 'TASK');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_source_enum') THEN
        CREATE TYPE memory_source_enum AS ENUM ('CHAT', 'NOTE');
    END IF;
END$$;

CREATE TABLE semantic_memories_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Provenance (来源)
    user_id UUID NOT NULL,
    source_type memory_source_enum NOT NULL, 
    source_id UUID NOT NULL,
    
    -- Content & Vectors
    content TEXT NOT NULL,
    embedding vector(768), -- Vertex AI Gecko/Embedding-004
    
    -- Classification
    type memory_type_enum NOT NULL DEFAULT 'PERSONAL',
    entities JSONB DEFAULT '{}',
    tags TEXT[],
    
    -- Meta
    importance INTEGER DEFAULT 1,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'semantic_memories' AND table_schema = current_schema()) THEN
        PERFORM safe_migrate_data('semantic_memories_new', 'semantic_memories');
        EXECUTE 'ALTER TABLE semantic_memories RENAME TO semantic_memories_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
    END IF;
    ALTER TABLE semantic_memories_new RENAME TO semantic_memories;
END $$;

DROP INDEX IF EXISTS idx_memories_user_source;
CREATE INDEX idx_memories_user_source ON semantic_memories(user_id, source_type);

-- Use HNSW for high performance vector search
DROP INDEX IF EXISTS idx_memories_embedding;
CREATE INDEX idx_memories_embedding ON semantic_memories USING hnsw (embedding vector_cosine_ops);
