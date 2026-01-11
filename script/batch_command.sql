-- ============================================
-- Batch Commands for Database Maintenance
-- ============================================
-- This file contains useful SQL commands for common database operations
-- Run specific sections as needed for maintenance tasks

-- ============================================
-- MEMORY DISTILLATION CLEANUP
-- ============================================
-- Use this section to reset memory distillation for testing or cleanup

-- 1. Delete all existing semantic memories
DELETE FROM semantic_memories;

-- 2. Reset distillation metadata for all sessions
UPDATE chat_sessions 
SET metadata = '{}'::jsonb 
WHERE metadata IS NOT NULL;

-- 3. Verify cleanup (should return 0 for both)
SELECT 'Memories remaining: ' || COUNT(*) FROM semantic_memories;
SELECT 'Sessions with metadata: ' || COUNT(*) FROM chat_sessions WHERE metadata IS NOT NULL AND metadata != '{}'::jsonb;

-- Optional: Reset specific session for targeted testing
-- UPDATE chat_sessions 
-- SET metadata = '{}'::jsonb 
-- WHERE id = 'YOUR_SESSION_ID_HERE';

-- ============================================
-- OTHER MAINTENANCE COMMANDS
-- ============================================
-- Add additional batch commands below as needed
