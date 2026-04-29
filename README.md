
# 🎙️ AI English Speaking Coach

> A full-stack AI-powered English speaking coach with real-time grammar correction, voice input/output, Urdu→English translation, daily speech practice with scoring, and persistent session history — built with Next.js, Convex, and Claude AI.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Convex](https://img.shields.io/badge/Convex-Real--time%20DB-orange?style=flat-square)
![Claude AI](https://img.shields.io/badge/Anthropic-Claude%20AI-blueviolet?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## 📸 Screenshots

<img width="951" height="827" alt="streak" src="https://github.com/user-attachments/assets/f5d4d640-5fe1-4d4d-bd91-376c5c1bc50a" />
<img width="952" height="826" alt="2speech" src="https://github.com/user-attachments/assets/6fcad301-b941-4e8a-a7b1-3c7afbd796e5" />

---
## 🎬 Demo Video

https://github.com/user-attachments/assets/e8723cd6-37fd-42ba-8be2-d94f660bb2b1
## 🔗 Links

- 🌐 **Live Demo:** [your-app.vercel.app](https://your-app.vercel.app)
- 💻 **GitHub:** [github.com/Samra-younas/ai-english-coach](https://github.com/Samra-younas/ai-english-coach)

---

## ✨ Features

### 💬 Coach Chat
- Type or **speak English** using voice input
- Claude AI corrects **spoken grammar mistakes** instantly
- **Alex** (AI coach) speaks back with corrections and follow-up questions
- All conversations saved with **persistent session history**
- Create, **rename**, and **delete** sessions like ChatGPT

### 🌐 Urdu → English Translation
- Type **Roman Urdu** (e.g. `"khubsoorat"`, `"mujhe pani chahiye"`)
- Or **speak in Urdu** and get English meaning with example sentence
- Full translation history saved and viewable anytime

### 🎤 Daily Speech Practice
- New **topic every day** from 30 real-world prompts
- Speak freely — live transcript shown in real time
- Claude AI gives **score out of 30** (Fluency + Grammar + Vocabulary)
- Shows exact **lines to improve** with corrected versions
- **Streak tracking** — days in a row practiced
- Full **speech history** with scores and corrections

### 📁 Session Management
- Sessions **auto-named** from your first message
- Rename sessions inline (like ChatGPT)
- Delete sessions with confirmation
- Stats panel: total sessions, total speeches, best score

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript |
| Realtime Database | Convex |
| AI / LLM | Anthropic Claude (claude-sonnet-4-5) |
| Voice Input | Web Speech API (SpeechRecognition) |
| Voice Output | Web Speech Synthesis API |
| Styling | CSS-in-JS |
| Deployment | Vercel |

---

## 📁 Project Structure

```
ai-english-coach/
├── app/
│   ├── api/
│   │   ├── coach/route.ts          ← Claude coaching + grammar correction
│   │   ├── translate/route.ts      ← Urdu → English translation
│   │   └── speech-coach/route.ts  ← Daily speech scoring + feedback
│   ├── ConvexClientProvider.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    ← Full app UI
├── convex/
│   ├── messages.ts
│   ├── schema.ts
│   ├── sessions.ts
│   ├── speechSessions.ts
│   └── translations.ts
├── .env.local
└── package.json
```

---

## ⚙️ Setup & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Samra-younas/ai-english-coach
cd ai-english-coach
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Convex

```bash
npx convex dev
```

### 4. Configure Environment Variables

Create `.env.local` in root folder:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

### 5. Run the App

**Terminal 1:**
```bash
npx convex dev
```

**Terminal 2:**
```bash
npm run dev
```

Open **http://localhost:3000**

---

## 🔑 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude AI | ✅ Yes |
| `NEXT_PUBLIC_CONVEX_URL` | Your Convex project URL | ✅ Yes |

---

## 🐛 Troubleshooting

**Voice not working?**
- Use **Google Chrome**
- Allow microphone permissions

**Convex error?**
- Keep `npx convex dev` running in Terminal 1

**Windows memory error?**
```json
"dev": "cross-env NODE_OPTIONS=--max-old-space-size=4096 next dev"
```

---

## 🚀 Deploy on Vercel

```bash
vercel
```

Add environment variables in Vercel dashboard.

---

## 📄 License

MIT License

---

## 🙌 Built With

- [Anthropic Claude](https://www.anthropic.com/)
- [Convex](https://convex.dev/)
- [Next.js](https://nextjs.org/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
