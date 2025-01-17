
import { PromptTemplate } from 'langchain/prompts';
import { OpenAI } from 'langchain/llms/openai';
import { LLMChain } from 'langchain/chains';
import type { PostSearchResult } from './embeddings-store';

const SYSTEM_TEMPLATE = `You are an AI assistant helping to provide context-aware responses.
Use the following pieces of historical context to inform your response, but don't directly reference them unless relevant:
{context}

Current conversation:
Human: {query}
Assistant: `;

const contextPrompt = new PromptTemplate({
  template: SYSTEM_TEMPLATE,
  inputVariables: ['context', 'query'],
});

interface GenerateResponseOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export async function generateContextualResponse(
  searchResults: PostSearchResult[],
  query: string,
  options: GenerateResponseOptions = {}
) {
  try {
    const llm = new OpenAI({
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 500,
      modelName: options.model ?? 'gpt-4',
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const chain = new LLMChain({
      llm,
      prompt: contextPrompt,
    });

    const context = searchResults
      .map(result => `${result.content} (Relevance: ${result.score})`)
      .join('\n\n');

    const response = await chain.call({
      context,
      query,
    });

    return {
      response: response.text as string,
      usedContext: searchResults.length > 0,
    };
  } catch (error) {
    console.error('Error generating contextual response:', error);
    throw new Error(`Failed to generate response: ${(error as Error).message}`);
  }
}
