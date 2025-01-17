
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

export const embedText = async (text: string): Promise<number[]> => {
  if (!text || typeof text !== 'string') {
    throw new EmbeddingError('Invalid input: text must be a non-empty string');
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.trim(),
    });

    if (!response.data?.[0]?.embedding) {
      throw new EmbeddingError('Failed to generate embedding');
    }

    return response.data[0].embedding;
  } catch (error) {
    if (error instanceof EmbeddingError) throw error;
    throw new EmbeddingError(`Embedding generation failed: ${(error as Error).message}`);
  }
};
