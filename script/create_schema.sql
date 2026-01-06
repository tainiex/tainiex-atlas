-- Load migration utility helper
-- Note: Assuming this script is run from the project root or script directory via psql
-- logic: Create New Table -> Copy Data -> Rename Old to Backup -> Rename New to Current

-- Ensure the helper function exists
\ir migration_utils.sql

-- WRAP IN TRANSACTION to ensure atomicity.
-- This ensures there is NO moment where the table "does not exist" for other users.
-- PostgreSQL Transactional DDL ensures the swap is atomic.
BEGIN;

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
    is_deleted BOOLEAN DEFAULT FALSE
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
COMMIT;
