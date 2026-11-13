# ClipStudio Pro — Cloud & In-Browser Video Editor

[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Redux Toolkit](https://img.shields.io/badge/Redux%20Toolkit-2.x-764ABC?logo=redux&logoColor=white)](https://redux-toolkit.js.org/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)

**ClipStudio Pro** is a modern, professional, cloud-connected Non-Linear Video Editor (NLE) operating directly in modern web browsers. Featuring multi-track timeline editing, client-side hardware-accelerated rendering using WebCodecs and WebAssembly FFmpeg, cloud rendering via NestJS, and peer-to-peer distributed rendering worker clusters.

---

## 🌐 Live Production Deployment

| Service | Live URL |
| :--- | :--- |
| **Production Web Application** | [https://clipstudio-pro.vercel.app](https://clipstudio-pro.vercel.app) |
| **Connected Live Backend API** | [https://clipstudio-backend.onrender.com](https://clipstudio-backend.onrender.com) |
| **Interactive API Documentation** | [https://clipstudio-backend.onrender.com/api/docs](https://clipstudio-backend.onrender.com/api/docs) |

---

## 🔐 Demo & Testing Credentials

Use any of the following pre-configured credentials to sign in and test the editor:

| Role | Email | Password | Access Level & Features |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@videostudio.com` | `Admin123!` | Full admin privileges: access Admin Dashboard, user management, role elevation, cluster nodes inspection |
| **Standard User** | `user@videostudio.com` | `User123!` | Standard creator account: create/edit projects, timeline composition, cloud exports |

> 💡 **Self-Registration**: You can also register a brand new user account directly by clicking **Sign Up** on the application top bar.

---

## ✨ Features & Capabilities

### 1. 🎞️ Multi-Track Non-Linear Video Timeline
- Multi-layer compositing across dedicated **Video**, **Audio**, **Text**, and **Sticker** tracks.
- Intuitive drag-and-drop element positioning, track reordering, and magnetic snapping.
- Precision trimming, splitting at playhead (`Ctrl+B` / Split button), ripple delete, and speed adjustment (0.25x – 4.0x).
- Real-time scrubbing with audio waveform visualizations and sprite hover previews.

### 2. ⚡ In-Browser Hardware Video Rendering (WebCodecs & FFmpeg WASM)
- Fast client-side MP4 video rendering utilizing browser **WebCodecs API** with hardware GPU encoding.
- WebAssembly FFmpeg (`@ffmpeg/ffmpeg`) fallback for browsers without WebCodecs support.
- Zero server queue wait time for client exports: videos render right in your browser tab.

### 3. ☁️ Distributed Cluster & Cloud Rendering
- **Server-Side FFmpeg Cluster**: Offload heavy multi-layer compositions to the remote NestJS FFmpeg rendering cluster on Render.
- **Worker Node Mode**: Toggle your browser into a distributed compute worker that picks up frame-rendering tasks from other connected users via WebSockets.

### 4. 🎨 Advanced Styling, Keyframing & Animation
- Position, scale, rotation, and opacity transformations.
- Color grading controls: brightness, contrast, saturation, and hue rotation filters.
- Preset transitions (Cross dissolve, Fade to black, Slide left/right/up/down, Zoom).
- Rich text captions with custom fonts, colors, stroke borders, and text backgrounds.

### 5. 🗄️ Cloud Media Asset Library
- Direct cloud upload with automatic integration to **Cloudinary**.
- Instant media previews and sprite thumbnails for high-speed timeline scrubbing.
- Stock assets and custom uploads accessible across your projects.

### 6. 🛡️ User & Project Management
- Auto-saving project states and snapshot version histories.
- Role-based Admin Dashboard for overseeing user accounts, project quotas, and cluster health.

---

## 🛠️ Tech Stack & Architecture

- **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **State Management**: [Redux Toolkit](https://redux-toolkit.js.org/) + React-Redux
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **In-Browser Video Encoding**:
  - [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) (Hardware accelerated)
  - [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) (WASM fallback)
  - `mp4-muxer` for container generation
- **Real-Time Communication**: [Socket.IO Client](https://socket.io/)
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Hosting**: [Vercel](https://vercel.com/)

---

## ⚙️ Environment Configuration

Create a `.env` file in the `frontend/` directory:

```env
# URL of the ClipStudio Pro NestJS Backend
VITE_BACKEND_URL=https://clipstudio-backend.onrender.com

# For local development with local backend:
# VITE_BACKEND_URL=http://localhost:3000
```

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **npm** or **pnpm**

### 2. Installation
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 4. Build for Production
```bash
npm run build
```
The compiled production bundle will be generated in `frontend/dist/`.

---

## 🚀 Vercel Deployment Guide

To deploy this frontend to **Vercel**:

1. Import the repository `Ramjanict/clipstudio-pro` into Vercel.
2. In **Project Settings** > **Build & Development Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` *(Important: set this to `frontend`)*
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. In **Environment Variables**:
   - Add `VITE_BACKEND_URL` = `https://clipstudio-backend.onrender.com`
4. Deploy! Your app will be live at `https://clipstudio-pro.vercel.app`.

---

## 📄 License
This project is licensed under the MIT License.
