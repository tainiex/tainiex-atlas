-- ═══════════════════════════════════════════════════════════════
-- DATABASE BATCH COMMANDS (后台批量任务)
-- ═══════════════════════════════════════════════════════════════
-- 包含后端维护所需的常用 SQL 任务
-- 每个功能块都是独立的，可以直接复制块内的所有 SQL 语句执行
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- [功能 1] 清理全部用户记忆 (Clear All Users' Memories)
-- ═══════════════════════════════════════════════════════════════
-- 说明: 清空所有用户的语义记忆并重置会话的蒸馏元数据。
-- 适用: 需要完全重置环境进行测试时。
-- 警告: 此操作不可逆，将删除所有记忆数据！

DELETE FROM semantic_memories;

UPDATE chat_sessions 
SET metadata = '{}'::jsonb 
WHERE metadata IS NOT NULL;

-- 验证结果 (应为 0)
SELECT 
    'Total Memories' as metric, 
    COUNT(*)::text as value 
FROM semantic_memories
UNION ALL
SELECT 
    'Sessions with Metadata' as metric, 
    COUNT(*)::text as value 
FROM chat_sessions 
WHERE metadata IS NOT NULL AND metadata != '{}'::jsonb;


-- ═══════════════════════════════════════════════════════════════
-- [功能 2] 清理指定用户记忆 (Clear Specific User's Memories)
-- ═══════════════════════════════════════════════════════════════
-- 说明: 仅删除特定用户的记忆数据并重置其会话状态。
-- 适用: 针对单个用户的测试或重置。
-- 注意: 请先将下方的 'USER_ID_HERE' 替换为实际的用户 UUID。

-- 1. 删除记忆
DELETE FROM semantic_memories 
WHERE metadata->>'userId' = 'USER_ID_HERE';

-- 2. 重置会话元数据
UPDATE chat_sessions 
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{msg_count_since_distill}',
    '0'::jsonb
)
WHERE user_id = 'USER_ID_HERE';

-- 3. 验证结果 (该用户的记忆数应为 0)
SELECT 
    metadata->>'userId' as user_id,
    COUNT(*) as memory_count
FROM semantic_memories 
WHERE metadata->>'userId' = 'USER_ID_HERE'
GROUP BY metadata->>'userId';


-- ═══════════════════════════════════════════════════════════════
-- [功能 3] 重置历史蒸馏状态 (Reset Backfill Status)
-- ═══════════════════════════════════════════════════════════════
-- 说明: 清除所有会话的 'backfill_complete' 标记。
-- 适用: 需要重新触发对历史会话的记忆回填/蒸馏时。

UPDATE chat_sessions 
SET metadata = metadata - 'backfill_complete' - 'last_backfilled_message_id'
WHERE metadata IS NOT NULL;

-- 验证结果 (Pending 应该增加)
SELECT 
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE metadata->>'backfill_complete' = 'true') as completed,
    COUNT(*) FILTER (WHERE metadata->>'backfill_complete' IS NULL) as pending
FROM chat_sessions;


-- ═══════════════════════════════════════════════════════════════
-- [功能 4] 查询记忆统计 (Query Memory Statistics)
-- ═══════════════════════════════════════════════════════════════
-- 说明: 查看每个用户的记忆生成情况。

SELECT 
    metadata->>'userId' as user_id,
    COUNT(*) as memory_count,
    COUNT(*) FILTER (WHERE (metadata->>'importance')::int >= 3) as high_importance_count,
    MAX(created_at) as last_memory_created
FROM semantic_memories 
GROUP BY metadata->>'userId'
ORDER BY memory_count DESC;
