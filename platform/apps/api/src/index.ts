import 'dotenv/config';
import { createApp } from './app';
import { startReminderCron } from './cron/reminder.cron';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[API] Server running on port ${env.PORT} (${env.NODE_ENV})`);
  startReminderCron();
});
