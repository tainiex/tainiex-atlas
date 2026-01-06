-- 1. Add parent_id to chat_messages
-- We use VARCHAR default 'ROOT' based on plan
ALTER TABLE chat_messages ADD COLUMN parent_id VARCHAR DEFAULT 'ROOT' NOT NULL;
CREATE INDEX idx_chat_messages_parent_id ON chat_messages(parent_id);

-- 2. Create History Table
CREATE TABLE chat_message_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_message_histories_message_id ON chat_message_histories(message_id);

-- 3. Data Migration (Link existing messages)
-- Chain messages per session ordered by created_at
DO $$
DECLARE
    r RECORD;
    prev_id VARCHAR := 'ROOT';
    curr_session UUID := NULL;
BEGIN
    FOR r IN SELECT * FROM chat_messages ORDER BY session_id, created_at ASC
    LOOP
        IF curr_session IS NULL OR curr_session != r.session_id THEN
            -- New Session, Start of Chain
            prev_id := 'ROOT';
            curr_session := r.session_id;
            
            -- Update current row as ROOT
            UPDATE chat_messages SET parent_id = 'ROOT' WHERE id = r.id;
        ELSE
            -- Continuation of Session
            UPDATE chat_messages SET parent_id = prev_id WHERE id = r.id;
        END IF;
        
        -- Set current ID as previous for next iteration (Cast UUID to VARCHAR)
        prev_id := r.id::VARCHAR;
    END LOOP;
END $$;
