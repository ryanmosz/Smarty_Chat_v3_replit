
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  host: process.env.PINECONE_HOST
});

export default pinecone;
