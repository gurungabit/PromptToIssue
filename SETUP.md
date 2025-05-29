# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### 1. Prerequisites
Make sure you have Node.js 18+ installed:
```bash
node --version  # Should be 18.0.0 or higher
```

### 2. Installation
```bash
# Install all dependencies and setup database
npm run setup
```

### 3. Configure AI API Keys
Edit `backend/.env` and add at least one AI API key:
```env
# Choose one or more:
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AI...
```

### 4. Start Development
```bash
# Runs both frontend (5173) and backend (3000)
npm run dev
```

### 5. Open the App
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Create an account and start chatting!

## 🔑 Getting AI API Keys

### OpenAI (Recommended)
1. Visit https://platform.openai.com/api-keys
2. Sign up/login
3. Create new API key
4. Copy to `backend/.env`

### Anthropic Claude
1. Visit https://console.anthropic.com/
2. Sign up/login
3. Generate API key
4. Copy to `backend/.env`

### Google Gemini
1. Visit https://makersuite.google.com/app/apikey
2. Sign up/login
3. Create API key
4. Copy to `backend/.env`

## 🎯 What to Try

1. **Create Account**: Register a new user
2. **Start Chat**: Describe a feature or bug
3. **Review Tickets**: See AI-generated tickets
4. **Connect Platforms**: Add GitLab/GitHub integration

## ⚡ Available Commands

```bash
# Development
npm run dev              # Run both servers
npm run dev:frontend     # Frontend only
npm run dev:backend      # Backend only

# Database
npm run db:generate      # Generate migrations
npm run db:migrate       # Apply migrations
npm run db:studio        # Open database viewer

# Production
npm run build           # Build both apps
npm start              # Run production servers
```

## 🆘 Need Help?

- Check the main [README.md](./README.md) for detailed docs
- Review console logs for errors
- Ensure AI API keys are valid
- Verify ports 3000 and 5173 are available

---

**You're ready to automate ticket creation! 🎫✨** 