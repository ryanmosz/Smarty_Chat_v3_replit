import { PromptTemplate } from 'langchain/prompts';
import { OpenAI } from 'langchain/llms/openai';

const promptTemplate = new PromptTemplate({
    template: `
        The user has shared the following context:
        {context}

        Based on the above, respond to the following query:
        {query}
    `,
    inputVariables: ['context', 'query'],
});

const generateResponse = async (context: string[], query: string) => {
    const formattedPrompt = await promptTemplate.format({
        context: context.join('\n'),
        query,
    });

    const llm = new OpenAI({
        model: 'gpt-4',
        openAIApiKey: openaiApiKey,
    });

    return llm.call(formattedPrompt);
};
