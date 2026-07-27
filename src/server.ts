import app from './app';
import { checkDbConnection } from './db/connection';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  console.log('Initializing Link Shortener API & Service...');

  // Test database connection to db.orfa.dev
  await checkDbConnection();

  app.listen(PORT, () => {
    console.log(`🚀 Link Shortener Service is running on port ${PORT}`);
    console.log(`Target Database Host: ${process.env.DB_HOST || 'db.orfa.dev'}`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting server:', err);
});
