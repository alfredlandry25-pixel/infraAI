import os
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:salim077@localhost:5433/infraai")


def retrieve_context(query_embedding, top_k=3, table="document_embeddings_test"):
    """
    Given a query embedding (a list of floats), returns the top_k most similar documents from the given table
    ordered by cosine distance (closest/most similar first).

    NOTE: table defaults to the FAKE test table for now. Once Miranda's real DocumentEmbedding model + ingestion is ready, this should default 
    to "document_embeddings" instead (the real 1536-dimension table).
    """
    con = psycopg2.connect(DATABASE_URL)
    cur = con.cursor()

    query = f"""
        SELECT id, content, embedding <=> %s AS distance
        FROM {table}
        ORDER BY distance ASC
        LIMIT %s;
     """ 
    cur.execute(query, (str(query_embedding), top_k))
    result = cur.fetchall()

    cur.close()
    con.close()  

    return [
        {"id": row[0], "content": row[1], "distance": row[2]} for row in result
    ]


if __name__ == "__main__":

    test_query = [1,0,0]

    results =retrieve_context(test_query, top_k=3)

    print("query:", test_query)
    print("Results (closest first):")
    for r in results:
        print(f"   distance={r['distance']:.4f} content={r['content']}")

    assert results[0]["content"].startswith("AWS EC2"), \
        "Expected EC2 document to be closest match!"
    print("\nTest passed: closest match is correct.")