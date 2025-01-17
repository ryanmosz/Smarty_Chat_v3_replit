
import { embedText } from './embeddings';
import pinecone from './pinecone';

export interface EmbeddingMetadata {
  userId: string;
  content: string;
  createdAt?: string;
}

export const storeEmbedding = async (userId: string, postId: string, content: string) => {
  try {
    const embedding = await embedText(content);
    const index = pinecone.index('smallindex');
    
    await index.upsert([{
      id: `${userId}-${postId}`,
      values: embedding,
      metadata: {
        userId,
        content,
        createdAt: new Date().toISOString()
      }
    }]);

    return { success: true };
  } catch (error) {
    console.error('Failed to store embedding:', error);
    throw new Error(`Failed to store embedding: ${(error as Error).message}`);
  }
};

export const queryEmbeddings = async (queryEmbedding: number[], limit = 5) => {
  try {
    const index = pinecone.index('smallindex');
    const results = await index.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true
    });
    
    return results.matches;
  } catch (error) {
    console.error('Failed to query embeddings:', error);
    throw new Error(`Failed to query embeddings: ${(error as Error).message}`);
  }
};
