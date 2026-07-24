import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: 'https://0ed96fe4106fceecfbcb0e8828f8f8a6@o4511659784667136.ingest.us.sentry.io/4511659792072705',
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    enabled: process.env.NODE_ENV === 'production',
});