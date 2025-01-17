
import { PromptTemplate } from 'langchain/prompts';
import { OpenAI } from 'langchain/llms/openai';
import { PostSearchResult } from './embeddings-store';

const promptTemplate = new PromptTemplate({
  template: `
    Context from user's previous messages:
    {context}

    Current user query:
    {query}

    Please provide a helpful response based on the context and query above. If the context doesn't contain relevant information, you can still provide a general response.

    Response:
  `,
  inputVariables: ['context', 'query'],
});

interface GenerateOptions {
  model?: string;
  temperature?: number;
}

export const generateContextualResponse = async (
  relevantPosts: PostSearchResult[],
  query: string,
  options: GenerateOptions = {}
) => {
  const context = relevantPosts
    .map(post => `[${new Date(post.createdAt).toLocaleString()}] ${post.content}`)
    .join('\n');

  const formattedPrompt = await promptTemplate.format({
    context: context || 'No relevant previous messages found.',
    query,
  });

  const llm = new OpenAI({
    modelName: options.model || 'gpt-3.5-turbo',
    temperature: options.temperature || 0.7,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const response = await llm.call(formattedPrompt);

  return {
    response,
    context: relevantPosts,
  };
};
