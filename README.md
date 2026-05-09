# OneBlock for Google Workspace

A calm AI-powered timeboxing assistant that integrates with Google Workspace. Turn mental chaos into a focused, organized day.

## Hackathon Demo

### What OneBlock Does

OneBlock is a timeboxing planner designed for overwhelmed people. It takes your messy brain dump of tasks and transforms them into a structured daily timeline with focus blocks, respecting your existing Google Calendar commitments.

**Key Features:**
- Brain Dump Inbox: Type all your tasks in natural language, no formatting needed
- Calendar-Aware Planning: Automatically schedules around your protected Google Calendar events
- Energy-Based Scheduling: Tasks are prioritized by energy level and urgency
- Focus Mode: Immersive timer with encouraging messages for deep work
- Google Workspace Sync: Export your plan to Calendar, Docs, and Sheets

### Current Mock Google Workspace Integrations

This demo uses mock data to simulate Google Workspace connectivity:

- **Google Calendar**: Shows today's events (Team sync, Lunch, Family pickup) as protected blocks
- **Google Docs**: Simulates creating a daily plan document
- **Google Sheets**: Simulates logging completed tasks to a spreadsheet
- **Google Drive**: Status indicator for backup storage

All sync actions show success states with realistic delays.

### Future Real Google API Integrations

When connected to real Google APIs:

1. **OAuth 2.0 Authentication** - Secure sign-in with Google
2. **Calendar API** - Read actual calendar events, create focus blocks
3. **Docs API** - Generate formatted daily plan documents
4. **Sheets API** - Append task completion data for tracking
5. **Drive API** - Store plan history and backups

### Demo Flow

1. **Inbox View**: See connected Google Workspace services and today's calendar
2. **Brain Dump**: Enter your messy list of tasks
3. **Plan My Day**: AI organizes tasks around your protected calendar events
4. **Timeline View**: See your unified day with Google events and focus blocks
5. **Sync to Google**: Export focus blocks to Calendar, Docs, or Sheets
6. **Focus Mode**: Enter deep work with a calming timer interface
7. **Gentle Replan**: Adjust the plan anytime without guilt

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_nyBRF7HLGE68zF9RtMY64ySuJvud)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

<a href="https://v0.app/chat/api/kiro/clone/lofibrainwav/one-box-mk" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>
