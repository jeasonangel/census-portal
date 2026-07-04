import dotenv from 'dotenv';
import { buildApp } from './app';

dotenv.config();

const PORT = process.env.PORT || 3001;

const app = buildApp();

app.listen(PORT, () => {
  console.log(`🚀 Census Portal API running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
});