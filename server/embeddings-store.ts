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

export interface PostSearchResult {
  content: string;
  channelId?: number;
  messageId: string;
  score: number;
  createdAt: string;
}

export const queryUserPosts = async (
  userId: string,
  query: string,
  limit = 5
): Promise<PostSearchResult[]> => {
  try {
    const queryEmbedding = await embedText(query);
    const index = pinecone.index('smallindex');

    const results = await index.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true,
      filter: { userId: { $eq: userId } }
    });

    if (!results.matches?.length) {
      return [];
    }

    return results.matches.map(match => ({
      content: match.metadata.content as string,
      channelId: match.metadata.channelId as number,
      messageId: match.metadata.messageId as string,
      score: match.score,
      createdAt: match.metadata.createdAt as string
    }));
  } catch (error) {
    console.error('Failed to query user posts:', error);
    throw new Error(`Failed to query user posts: ${(error as Error).message}`);
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