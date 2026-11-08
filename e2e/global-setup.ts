import { resetE2eDatabase } from './reset-database';

export default async function globalSetup() {
  resetE2eDatabase();
}
