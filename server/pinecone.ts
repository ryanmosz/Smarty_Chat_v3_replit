
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
  environment: process.env.PINECONE_ENVIRONMENT || 'gcp-starter'
});

// Create index if it doesn't exist
const createIndexIfNotExists = async () => {
  try {
    const indexList = await pinecone.listIndexes();
    if (!indexList.includes('smallindex')) {
      await pinecone.createIndex({
        name: 'smallindex',
        dimension: 1536,
        metric: 'cosine'
      });
      console.log('Created new Pinecone index: smallindex');
    }
  } catch (error) {
    console.error('Error managing Pinecone index:', error);
  }
};

createIndexIfNotExists();

export default pinecone;
