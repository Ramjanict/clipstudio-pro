# ClipStudio Pro — Backend API & Distributed Render Engine

[![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-00E599?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Media%20CDN-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com/)
[![Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7?logo=render&logoColor=white)](https://render.com/)

The high-performance REST and WebSocket API powering **ClipStudio Pro**. Built with **NestJS 11**, **Prisma ORM**, **Neon PostgreSQL**, **Fluent-FFmpeg**, and **Cloudinary**, this backend orchestrates user management, project state persistence, media processing, sprite sheet extraction, server-side video rendering, and distributed browser worker rendering clusters.

---

## 🌐 Live Production Deployment

| Resource | Live Production URL |
| :--- | :--- |
| **Backend API Base** | [https://clipstudio-backend.onrender.com](https://clipstudio-backend.onrender.com) |
| **Interactive Swagger API Docs** | [https://clipstudio-backend.onrender.com/api/docs](https://clipstudio-backend.onrender.com/api/docs) |
| **Alternative Swagger Route** | [https://clipstudio-backend.onrender.com/docs](https://clipstudio-backend.onrender.com/docs) |
| **Production Frontend App** | [https://clipstudio-pro.vercel.app](https://clipstudio-pro.vercel.app) |

---

## 🔐 Demo & Testing Credentials

The backend automatically seeds both an administrator and standard user account on initialization:

| Account Type | Email | Password | Role | Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@videostudio.com` | `Admin123!` | `SUPER_ADMIN` | Full access, user management, role elevation, cluster metrics, project administration |
| **Demo User** | `user@videostudio.com` | `User123!` | `USER` | Standard video creator: create projects, upload media, timeline editing, cloud exports |

> **Note:** Public self-registration is fully supported. Any user can create a new account via `POST /api/auth/register` or directly from the frontend user interface.

---

## 🚀 Key Features

- **🔐 Authentication & RBAC**: JWT-based authentication with `bcrypt` password encryption and role-based guards (`USER`, `ADMIN`, `SUPER_ADMIN`).
- **📁 Multi-Track Project Persistence**: Create, retrieve, update, and manage timeline projects with multi-track layout, resolution, frame rate, and version history.
- **☁️ Cloudinary Media Pipeline**: Direct media uploads, cloud storage, automatic video thumbnail generation, and timeline scrubbing sprite-sheets.
- **🎬 Server-Side FFmpeg Render Engine**: Industrial-grade video rendering via `fluent-ffmpeg` and `@ffmpeg-installer/ffmpeg`. Supports multi-track layer composition, scaling, transitions, audio mixing, and export to standard MP4 formats.
- **⚡ Distributed Render Cluster (WebSockets)**: Socket.IO gateway (`/rendering`) that chunks video frames and distributes rendering jobs across connected browser worker nodes for accelerated cluster-based exports.
- **📊 Admin Monitoring & Metrics**: Endpoints to inspect system resources, database health, registered users, and active render tasks.

---

## 🛠️ Tech Stack

- **Framework**: [NestJS 11](https://nestjs.com/) (Express platform)
- **Database ORM**: [Prisma 6.19.3](https://www.prisma.io/)
- **Database Engine**: [Neon Serverless PostgreSQL](https://neon.tech/)
- **Media Transcoding**: [FFmpeg](https://ffmpeg.org/) & `fluent-ffmpeg`
- **Cloud Asset Storage**: [Cloudinary](https://cloudinary.com/)
- **Real-Time WebSockets**: `@nestjs/websockets` + Socket.IO
- **API Documentation**: OpenAPI / Swagger (`@nestjs/swagger`)
- **Deployment Platform**: Docker on [Render](https://render.com/)

---

## ⚙️ Environment Variables

Configure the following variables in `backend/.env` or in your Render environment dashboard:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | HTTP Server port | `3000` |
| `NODE_ENV` | Environment mode | `production` or `development` |
| `DATABASE_URL` | Neon/Postgres connection string with SSL | `postgresql://user:pass@ep-...neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `super_secret_jwt_key_change_me` |
| `JWT_EXPIRES_IN` | Token expiration time | `7d` |
| `SUPER_ADMIN_EMAIL` | Default email for seeded Super Admin | `admin@videostudio.com` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name | `dmeg0t89b` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `547359116116553` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `xH1S1jcP117x0...` |
| `CLOUDINARY_URL` | Cloudinary complete connection URL | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |

---

## 📚 API Endpoints Summary

Explore the complete, interactive request/response models via Swagger at [https://clipstudio-backend.onrender.com/api/docs](https://clipstudio-backend.onrender.com/api/docs).

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new creator account
- `POST /api/auth/login` — Login and receive a JWT Bearer token
- `GET /api/auth/profile` — Retrieve current authenticated user profile

### Projects (`/api/projects`)
- `GET /api/projects` — List all projects belonging to the authenticated user
- `POST /api/projects` — Create a new timeline project
- `GET /api/projects/:id` — Get project details and active timeline tracks
- `PUT /api/projects/:id` — Save timeline project changes
- `DELETE /api/projects/:id` — Delete a project
- `POST /api/projects/:id/versions` — Create a timeline version snapshot

### Asset Management (`/api/assets`)
- `GET /api/assets` — List uploaded assets
- `POST /api/assets/upload` — Upload video, image, or audio asset to Cloudinary
- `DELETE /api/assets/:id` — Remove an asset

### Video Export & Rendering (`/api/export`)
- `POST /api/export` — Queue a server-side FFmpeg video export job
- `GET /api/export/status/:jobId` — Query real-time rendering progress
- `GET /api/export/download/:jobId` — Download finished rendered MP4 video

### Admin Management (`/api/admin`) *(Requires `SUPER_ADMIN` or `ADMIN` role)*
- `GET /api/admin/users` — List registered users
- `PUT /api/admin/users/:id/role` — Update user access level
- `DELETE /api/admin/users/:id` — Delete a user account
- `GET /api/admin/stats` — Overall system, user, and render metrics

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js**: v20+ or v22+
- **PostgreSQL**: Neon cloud database or local instance
- **FFmpeg**: System FFmpeg installed and in PATH (or bundled via `@ffmpeg-installer/ffmpeg`)

### 2. Installation
```bash
# Navigate to the backend directory
cd backend

# Install project dependencies
npm install
```

### 3. Generate Database Client & Sync Schema
```bash
# Generate Prisma Client
npx prisma generate

# Push database schema to PostgreSQL
npx prisma db push
```

### 4. Run Development Server
```bash
# Start backend in watch/development mode
npm run start:dev
```
The server will start at `http://localhost:3000` with Swagger available at `http://localhost:3000/api/docs`.

### 5. Build for Production
```bash
npm run build
npm run start:prod
```

---

## 🐳 Docker Deployment

The backend contains a production-ready multi-stage `Dockerfile`:
```bash
# Build Docker image
docker build -t clipstudio-backend .

# Run container
docker run -p 3000:3000 --env-file .env clipstudio-backend
```

---

## 📄 License
This project is licensed under the MIT License.
