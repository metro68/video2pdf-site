# video2pdf.ai

Next.js (App Router) site for Video2PDF: public marketing pages plus a role-aware internal analytics dashboard.

## Pages

- `/` landing
- `/privacy` privacy policy
- `/terms` terms of service
- `/login` dashboard sign-in
- `/dashboard` role-aware analytics (admin, marketing)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

Generate a bcrypt hash for a password:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" "yourpassword"
```

## Environment variables

Auth: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `MARKETING_EMAIL`, `MARKETING_PASSWORD_HASH`.

Connectors (each optional; a provider with all its vars set fetches live data, one with any missing shows an "awaiting credentials" card):

- App Store Connect: `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_PRIVATE_KEY` (full .p8 contents), `APPSTORE_VENDOR_NUMBER`
- Google Play: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (full service-account JSON), `GOOGLE_PLAY_PACKAGE_NAME`
- PostHog: `POSTHOG_API_KEY` (personal API key), `POSTHOG_HOST`, `POSTHOG_PROJECT_ID`
- AppsFlyer: `APPSFLYER_API_TOKEN`, `APPSFLYER_IOS_APP_ID`, `APPSFLYER_ANDROID_APP_ID` (summed across platforms)
- Meta: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`
- TikTok: `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID`

Each connector fetches a 7-day window, caches the result for one hour, and normalizes it to the shared metric shape. If a provider's API call fails, its card shows an error with the provider's message rather than fake data.

## Roles

Only MRR and ARR are admin-only. Everything else is visible to both admin and marketing. Redaction happens server-side in the metrics API routes.

## Testing

```bash
npm test
```

## Deploy

Vercel, same project and domain (`video2pdf.ai`). Set all environment variables in the Vercel project settings. The first deploy converts the output from a static site to a Next.js build, so verify the domain serves correctly before and after.
