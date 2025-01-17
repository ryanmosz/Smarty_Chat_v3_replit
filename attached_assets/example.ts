import { Configuration, OpenAIApi } from 'openai';

const openai = new OpenAIApi(new Configuration({
    apiKey: openaiApiKey,
}));

const embedText = async (text: string): Promise<number[]> => {
    const response = await openai.createEmbedding({
        model: 'text-embedding-ada-002',
        input: text,
    });
    return response.data.data[0].embedding;
};

