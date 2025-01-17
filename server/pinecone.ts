
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  host: process.env.PINECONE_HOST
});

export default pinecone;
