const fetchRelevantPosts = async (userId: string, query: string, topK: number = 5) => {
    const queryEmbedding = await embedText(query);
    const response = await index.query({
        topK,
        vector: queryEmbedding,
        includeMetadata: true,
        filter: { userId },
    });
    return response.matches.map(match => match.metadata.content);
};
