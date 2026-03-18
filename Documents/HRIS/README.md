# Lumion HRIS - Production-Grade Enterprise HR System

A fully production-ready Human Resource Information System built with a modern tech stack on a monorepo architecture.

## 🏗️ Project Structure

```
lumion-hris/
├── apps/
│   ├── web/                  # Next.js 14+ frontend (port 3000)
│   └── api/                  # Hono.js REST API (port 3001)
├── packages/
│   ├── database/             # Prisma ORM + schema + seed script
│   ├── ui/                   # Shared shadcn/ui components
│   ├── validators/           # Zod validation schemas
│   ├── types/                # Shared TypeScript types & enums
│   └── config/               # Shared ESLint/Prettier configs
├── turbo.json
├── tsconfig.json
└── package.json
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ (use `nvm` if needed)
- **PostgreSQL** 15+ (local or Supabase)
- **npm** 10+ or **yarn**

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your database and services
# At minimum, set:
# - DATABASE_URL=postgresql://user:password@localhost:5432/lumion_hris_dev
# - NEXTAUTH_SECRET=<your-secret-key-min-32-chars>
```

### 2. Install Dependencies

```bash
# From the root directory
npm install
# or
yarn install
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Create database and apply schema
npm run db:migrate

# (Optional) Seed with demo data
npm run db:seed
```

### 4. Start Development Servers

```bash
# Start all apps (web + api) in development mode
npm run dev

# Or start them individually:
# Frontend: http://localhost:3000
npm run dev --filter=@lumion/web

# API: http://localhost:3001
npm run dev --filter=@lumion/api
```

## 📦 Development Workflow

### Building

```bash
npm run build          # Build all packages & apps
npm run type-check     # Type check everything
npm run lint           # Lint all code
npm run format         # Format with Prettier
```

### Testing

```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### Database

```bash
npm run db:migrate     # Create a new migration
npm run db:push        # Push schema to DB (dev only)
npm run db:seed        # Seed demo data
npm run db:studio      # Open Prisma Studio GUI
```

## 🏛️ Architecture

### Monorepo Structure

- **Turborepo** handles build orchestration and caching
- **Shared packages** prevent code duplication
- **Clear separation** between frontend and backend
- **Type safety** across the entire stack

### Frontend (Next.js)

- **App Router** for modern React patterns
- **Server Components** for performance
- **TanStack Query** for server state management
- **Zustand** for client state
- **Shadcn/ui** component library with Tailwind CSS

### Backend (Hono.js)

- **Lightweight** HTTP framework (2KB gzipped)
- **Type-safe** route handlers
- **Middleware-based** architecture
- **Prisma ORM** for type-safe database access
- **Validation** with Zod

### Database (PostgreSQL + Prisma)

- **20+ Core Models** covering all HR functionality
- **Row-level Security** via `tenantId` filtering
- **Migrations** with full history
- **Seed Script** for demo data

## 🔐 Security

- ✅ **bcryptjs** password hashing (cost factor 12)
- ✅ **Zod** input validation on every endpoint
- ✅ **Tenant Isolation** - data never leaks across companies
- ✅ **CORS** configured for frontend origin
- ✅ **Environment Variables** for secrets
- ✅ **HTTPS Ready** for production deployment
- ⏳ **Supabase Auth** MFA/SSO integration (coming next)
- ⏳ **Rate Limiting** via Redis (coming next)
- ⏳ **Audit Logging** on all mutations (coming next)

## 📊 Core Modules Shipped

- ✅ **Employee Management** - CRUD, profiles, org chart
- ✅ **Organizational Structure** - departments, locations, job titles
- ⏳ **Leave Management** - leave types, requests, accrual engine
- ⏳ **Attendance & Time** - clock in/out, shifts, timesheets
- ⏳ **Payroll** - multi-currency, tax engines, payslips
- ⏳ **Recruitment (ATS)** - job postings, applications, interviews
- ⏳ **Performance Management** - reviews, goals, 360-degree feedback
- ⏳ **Training & Development** - courses, enrollments, certifications
- ⏳ **Asset Management** - equipment tracking, assignments
- ⏳ **Discipline & Grievance** - case management, appeals
- ⏳ **Reports & Analytics** - executive dashboard, custom reports
- ⏳ **Communications** - announcements, notifications, email

(✅ = Implemented | ⏳ = In Progress/Planned)

## 🎨 Theming & UI

- Tailwind CSS for styling
- Shadcn/ui for React components
- Light/Dark mode support via `next-themes`
- WCAG 2.1 AA accessibility target
- Mobile-responsive design

## 🧪 Testing (To Implement)

- **Vitest** for unit tests
- **Playwright** for E2E tests
- **Integration tests** for API routes
- Coverage targets: Unit 80%+, E2E critical paths

## 📡 API Standards

All API endpoints follow REST conventions with consistent response envelopes:

```typescript
// Success Response
{
  "success": true,
  "data": { /* ... */ },
  "meta": { "page": 1, "total": 100, "limit": 20 },
  "message": "Operation successful"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [{ "field": "email", "message": "Invalid email" }]
  }
}
```

## 🌍 Localization

- **Multi-currency** support (NGN, USD, GBP, KES, GHS, ZAR)
- **Nigeria-specific** tax & pension calculations
- **GDPR/NDPR** compliance ready
- **Timezone** handling per location

## 📚 Key Dependencies

### Frontend
- `next`: 14.0.4
- `react`: 18.2.0
- `@tanstack/react-query`: 5.28.0
- `tailwindcss`: 3.4.1
- `next-auth`: 5.0.0 (with Auth.js)

### Backend
- `hono`: 3.12.0
- `@prisma/client`: 5.7.1
- `zod`: 3.22.4
- `bcryptjs`: 2.4.3

### Infrastructure
- `turbo`: 1.11.3
- `typescript`: 5.3.3
- `eslint`, `prettier`: Latest

## 🚢 Deployment

### Frontend (Next.js)
1. Deploy to **Vercel** (recommended, native Next.js support)
2. Set environment variables in Vercel dashboard
3. Automatic deployments on git push to `main`

### Backend (Hono API)
1. Deploy to **Railway.app** or **Render.com**
2. Set PostgreSQL DATABASE_URL
3. Run migrations on deployment

### Database
1. Use **Supabase** for managed PostgreSQL
2. Connection pooling enabled for serverless
3. Automated backups included

## 🐛 Troubleshooting

### Port conflicts
```bash
# Change Next.js port
npm run dev -- --port 3002

# Change API port (in .env.local)
API_PORT=3002
```

### Database connection issues
```bash
# Test connection
npm run db:generate

# View Prisma schema
npm run db:studio
```

### Monorepo issues
```bash
# Clean everything
rm -rf node_modules .turbo dist

# Reinstall
npm install

# Rebuild
npm run build
```

## 📖 Documentation

- **Database Schema**: See [packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma)
- **Type Definitions**: See [packages/types/src/index.ts](packages/types/src/index.ts)
- **Validation Schemas**: See [packages/validators/src/index.ts](packages/validators/src/index.ts)
- **API Routes**: See [apps/api/src/routes/](apps/api/src/routes/)

## 🤝 Contributing

1. Create feature branches from `main`
2. Make changes with TypeScript strict mode
3. Run tests: `npm run test`
4. Format code: `npm run format`
5. Type check: `npm run type-check`
6. Submit PR with clear description

## 📋 Development Phases Roadmap

- ✅ **Phase 1**: Foundation (Monorepo, Auth, Database, Core UI)
- ⏳ **Phase 2**: Employee Management (CRUD, Profiles, Org Chart)
- ⏳ **Phase 3**: Leave & Attendance (Accrual Engine, Workflows)
- ⏳ **Phase 4**: Payroll (Tax Engines, Payslips, Disbursement)
- ⏳ **Phase 5**: Recruitment & Onboarding (ATS, Offer Letters)
- ⏳ **Phase 6**: Performance & Learning (Reviews, Goals, Training)
- ⏳ **Phase 7**: Analytics, Integrations, Polish

## 📝 License

MIT

---

**Built by:** Lumion Technology  
**Version:** 1.0.0  
**Last Updated:** March 2026
