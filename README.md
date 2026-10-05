# NOVA TIPS 🎯

NOVA TIPS is a virtual prediction platform created for the NOVA IMS community.

Users receive virtual currency (**TIPS**) and can place bets on campus events, academic life, student traditions, sports, parties, elections, and other community moments. No real money is involved — everything is designed for fun, engagement, and friendly competition.

### Features

*  Create and participate in custom prediction markets
*  Virtual currency system (TIPS)
*  Leaderboard ranking system
*  Personal betting history
*  Admin panel for creating and resolving bets
*  Secure login with NOVA IMS institutional email
*  Cloud database powered by Supabase
*  Deployed online and accessible from any device

### How it Works

1. Sign in with your NOVA IMS email.
2. Receive virtual TIPS.
3. Place bets on active events.
4. Earn rewards for correct predictions.
5. Climb the leaderboard and become a campus prediction legend.

### Disclaimer

NOVA TIPS is strictly for entertainment purposes.

No real money, gambling, or financial rewards are involved. All bets use virtual currency and are intended to increase engagement within the NOVA IMS community.

**NOVA TIPS — Dicas que marcam.**

## Local Development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the existing site's Supabase URL and public anon key.
3. Start the app with `npm run dev`.

Use `npm run lint` and `npm run build` to check the project.

## Freshers Weekend Edition

The weekend edition uses the same frontend but must be deployed as a separate Vercel project with a separate Supabase project. Its environment template is `.env.freshers-weekend.example`.

Follow [the Freshers Weekend setup guide](supabase/FRESHERS_WEEKEND_SETUP.md) to create the isolated database, add the private attendee allowlist, and configure the deployment. Do not run `supabase/schema.sql` as an installation script; it is an inventory only.

Never put a Supabase `service_role` key, password, private VAPID key, or attendee list in frontend code or a committed environment file.
