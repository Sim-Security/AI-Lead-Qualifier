# AI Voice Agent Lead Qualifier

[![CI](https://github.com/Sim-Security/AI-Lead-Qualifier/actions/workflows/ci.yml/badge.svg)](https://github.com/Sim-Security/AI-Lead-Qualifier/actions/workflows/ci.yml)

An AI-powered voice agent that automatically calls and qualifies leads when they submit a website form. Built with TypeScript, Bun, Hono, and Vapi.ai.

## Features

- **Instant Lead Engagement**: Automatically calls leads within seconds of form submission
- **AI-Powered Qualification**: Natural conversation using BANT framework
- **Data Extraction**: AI extracts motivation, timeline, budget, authority from transcripts
- **Lead Scoring**: Automatic intent classification (hot/warm/cold)
- **Real-time Dashboard**: View and manage qualified leads
- **Transcript Review**: Full conversation history for each lead

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Runtime | Bun |
| Backend | Hono |
| Database | PostgreSQL + Drizzle ORM |
| Voice AI | Vapi.ai |
| AI Extraction | Claude (Anthropic) |
| Frontend | React + Vite + Tailwind |
| Validation | Zod |

## Prerequisites (Bring Your Own Keys)

This is an open-source project. **You must provide your own API keys** to use the voice calling features.

### Required Accounts

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Vapi.ai** | Voice agent platform (makes/receives calls) | [vapi.ai](https://vapi.ai) |
| **Anthropic** | AI transcript extraction (Claude) | [console.anthropic.com](https://console.anthropic.com) |

### Getting Your Keys

1. **Vapi.ai**
   - Create account at [dashboard.vapi.ai](https://dashboard.vapi.ai)
   - Go to Settings → API Keys → Copy your API key
   - Create a phone number to get your `VAPI_PHONE_NUMBER_ID`
   - Set up a webhook secret for security

2. **Anthropic**
   - Create account at [console.anthropic.com](https://console.anthropic.com)
   - Go to API Keys → Create new key

## Quick Start

### Option 1: Docker Compose (Recommended)

The easiest way to run the full stack locally:

```bash
# 1. Clone the repo
git clone https://github.com/Sim-Security/AI-Lead-Qualifier.git
cd ai-lead-qualifier

# 2. Copy environment template and add YOUR keys
cp .env.example .env

# 3. Edit .env with your API keys (use your favorite editor)
nano .env
# Required keys:
#   VAPI_API_KEY=your_key_here
#   VAPI_WEBHOOK_SECRET=your_secret_here
#   VAPI_PHONE_NUMBER_ID=your_phone_id_here
#   ANTHROPIC_API_KEY=your_key_here

# 4. Start everything (migrations run automatically)
docker compose up -d

# 5. Open http://localhost in your browser
```

> **Note:** The AI calling feature requires a valid phone number in E.164 format. The form includes a country code selector (defaults to +1 for US/Canada).

### Option 2: Hugging Face Spaces

Deploy to Hugging Face Spaces for free hosting:

1. Fork this repo
2. Create a new Space on [Hugging Face](https://huggingface.co/spaces)
3. Select "Docker" as the SDK
4. Connect your GitHub repo
5. Add these secrets in Space Settings:
   - `DATABASE_URL` - PostgreSQL connection string (use [Neon](https://neon.tech) or [Supabase](https://supabase.com) free tier)
   - `VAPI_API_KEY` - Your Vapi.ai API key
   - `VAPI_WEBHOOK_SECRET` - Webhook verification secret
   - `VAPI_PHONE_NUMBER_ID` - Your Vapi phone number ID
   - `ANTHROPIC_API_KEY` - Your Anthropic API key

The root `Dockerfile` is configured for HF Spaces (port 7860).

### Option 3: Local Development

```bash
# 1. Clone and install
git clone https://github.com/Sim-Security/AI-Lead-Qualifier.git
cd ai-lead-qualifier
bun install

# 2. Start PostgreSQL
docker compose up -d postgres

# 3. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 4. Start development servers (migrations run automatically)
bun run dev

# Backend: http://localhost:3000
# Frontend: http://localhost:5173
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `VAPI_API_KEY` | Yes | Vapi.ai API key |
| `VAPI_WEBHOOK_SECRET` | Yes | Webhook verification secret |
| `VAPI_PHONE_NUMBER_ID` | No | Vapi phone number for outbound calls |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for transcript extraction |
| `PORT` | No | Backend port (default: 3000) |
| `NODE_ENV` | No | Environment (development/production) |

## Project Structure

```
ai-lead-qualifier/
├── backend/           # Hono API server
│   ├── src/
│   │   ├── config/    # Environment, database config
│   │   ├── db/        # Drizzle schema and migrations
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   └── middleware/# CORS, logging, errors
│   └── Dockerfile
├── frontend/          # React SPA
│   ├── src/
│   │   ├── components/# UI components
│   │   ├── hooks/     # Custom hooks
│   │   └── services/  # API client
│   └── Dockerfile
├── shared/            # Shared TypeScript types
├── docker compose.yml # Full stack deployment
└── Dockerfile         # HF Spaces single container
```

## API Endpoints

### Webhooks
- `POST /api/webhooks/form` - Receive form submissions
- `POST /api/webhooks/vapi` - Receive Vapi call events

### Leads
- `GET /api/leads` - List leads (with filtering/pagination)
- `GET /api/leads/:id` - Get single lead
- `PATCH /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Soft delete lead
- `GET /api/leads/:id/transcript` - Get call transcript

### Health
- `GET /health` - Health check

## How It Works

1. **Form Submission**: User fills out the lead form on the frontend
2. **Webhook Trigger**: Form data POSTed to `/api/webhooks/form`
3. **Lead Created**: Lead saved to database with status `pending`
4. **Call Initiated**: Vapi API called to start outbound call
5. **AI Conversation**: Voice agent qualifies lead using BANT framework
6. **Call Completed**: Vapi sends webhook with transcript
7. **Data Extraction**: Claude AI extracts qualification data from transcript
8. **Lead Enriched**: Lead updated with qualification fields and score
9. **Dashboard Update**: Sales team sees enriched lead in real-time

## Deployment Options

| Platform | Type | Database | Cost |
|----------|------|----------|------|
| Docker Compose | Self-hosted | Included | Free |
| Hugging Face Spaces | Managed | External (Neon/Supabase) | Free |
| Railway | Managed | Included | Free tier |
| Render | Managed | Included | Free tier |
| Fly.io | Managed | External | Free tier |

## Development

### Running Tests

```bash
bun run test
```

### Database Commands

```bash
bun run db:generate  # Generate migration from schema changes
bun run db:migrate   # Run pending migrations
bun run db:studio    # Open Drizzle Studio
```

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR

## License

MIT

---

Built with [AdamOS](https://github.com/danielraffel/AdamOS)
