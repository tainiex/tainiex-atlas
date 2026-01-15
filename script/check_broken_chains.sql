/*
 * Check for broken message chains in chat_messages table.
 * A broken chain is defined as a message where traversing up via parent_id
 * does not eventually reach a message with parent_id = 'ROOT'.
 *
 * This covers:
 * 1. Orphan messages (parent_id points to non-existent message)
 * 2. Cycles (A -> B -> A)
 * 3. Chains ending in a message with invalid parent_id
 */

WITH RECURSIVE MessageChain AS (
    -- Base case: Messages that are roots
    -- 基准情况：parent_id 为 'ROOT' 的消息
    SELECT
        id,
        session_id,
        parent_id,
        1 as depth
    FROM
        chat_messages
    WHERE
        parent_id = 'ROOT'

    UNION ALL

    -- Recursive case: Messages whose parent is in the known valid chain
    -- 递归情况：parent_id 指向已知有效连得消息
    SELECT
        c.id,
        c.session_id,
        c.parent_id,
        mc.depth + 1
    FROM
        chat_messages c
    INNER JOIN
        MessageChain mc ON c.parent_id = mc.id::text
)
-- Select messages that are NOT in the valid chain
-- 选择不在有效链中的消息（即无法追溯到 ROOT 的消息）
SELECT
    m.id,
    m.session_id,
    m.parent_id,
    m.role,
    m.created_at
FROM
    chat_messages m
WHERE
    m.id NOT IN (SELECT id FROM MessageChain)
ORDER BY
    m.created_at DESC;
