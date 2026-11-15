# GitHub and Vercel submission checklist

Submission preparation is in progress; live verification and publication are pending. No repository, remote, Supabase project or Vercel deployment has been created or changed.

## Before submission

- [ ] Select the Supabase project and run the reviewed migration once.
- [ ] Add its project URL and public anon/publishable key to the local environment.
- [ ] Run the lint, typecheck, automated tests and production build.
- [ ] Verify a real post persists after refresh and appears in a second browser through Realtime.
- [ ] Verify 50-row cursor pagination, equal timestamps, reconnect recovery, whitespace/length limits, and denied anonymous update/delete/extra-column inserts.
- [ ] Check keyboard focus, mobile layout and reduced-motion behavior.
- [ ] Review the GitHub destination and Vercel project with the owner before publishing.

## GitHub

Create or select the owner-approved **public** GitHub repository, then commit the source, SQL migration and placeholder `.env.example`. Keep `.env.local`, any real credentials, `node_modules` and `.next` out of Git. No Git repository or remote is configured in this workspace yet.

## Vercel

Import the approved public GitHub repository. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the intended Vercel environments using the public project URL and anon/publishable key. Do not add a service-role/secret key or database password. Deploy only after the owner approves the destination and publication. The submission must use the public **production** URL, not a Vercel preview URL.

## Employer submission

Status: Pending. No repository, production URL, screenshots, recording or form submission exists yet.

Submit at <https://apply.capm.us> and select **2) Wall**. Required deliverables:

- [ ] Public GitHub repository URL.
- [ ] Public Vercel production URL (not a preview URL).
- [ ] Screenshot of the homepage showing the composer.
- [ ] Screenshot showing the feed with multiple successfully posted messages.
- [ ] Screenshot of the mobile layout, since this app implements responsive mobile layout.

Optional supporting material:

- [ ] A 30–60 second screen recording showing a post being shared and Realtime updates in two browser windows.
- [ ] Reviewer note explaining that no login is required and posts use one shared display name, Anthony Mendoza.

After an approved deployment, test the public production URL with real Supabase data and capture the required screenshots. A local build or mocked test is not production evidence. Complete the form only after the owner approves publishing and the artifacts are ready.
