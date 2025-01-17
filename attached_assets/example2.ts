const storeEmbedding = async (userId: string, postId: string, content: string) => {
    const embedding = await embedText(content);
    await index.upsert([
        {
            id: `${userId}-${postId}`,
            values: embedding,
            metadata: { userId, content },
        },
    ]);
};
