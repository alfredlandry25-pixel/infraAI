-- Fake test data for proving retrieve_context()'s query logic works.
-- These are NOT real embeddings (real ones are 1536 dimensions from
-- OpenAI). This uses a small 3-dimension vector purely so we can
-- manually reason about which one is "closest" to a test query,
-- to confirm the cosine similarity search is working correctly.
--
-- IMPORTANT: this is throwaway test data. Once Miranda's real
-- DocumentEmbedding table + ingestion script are ready, this
-- table gets dropped and replaced with the real one.

-- Temporarily using 3 dimensions instead of 1536 for manual testing.
DROP TABLE IF EXISTS document_embeddings_test;

CREATE TABLE document_embeddings_test (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(3)
);

INSERT INTO document_embeddings_test (content, embedding) VALUES
('AWS EC2 instances are virtual servers for running applications.', '[1, 0, 0]'),
('Amazon S3 is object storage for files and static assets.', '[0, 1, 0]'),
('PostgreSQL is a relational database good for structured data.', '[0, 0, 1]');