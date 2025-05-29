# PromptToIssue - AI Ticket Automation Chatbot

An intelligent chatbot that helps developers automate issue/ticket creation by converting natural language descriptions into well-structured tickets for GitLab, GitHub, and other platforms.

## 🚀 Features

### Core Functionality
- **Intelligent Chat Interface**: Natural language processing for requirement descriptions
- **Smart Ticket Splitting**: Automatically breaks down complex requirements into multiple tickets
- **Standardized Formatting**: Generates consistent tickets with titles, descriptions, acceptance criteria, tasks, and labels
- **Multi-AI Support**: Integrates with OpenAI GPT-4, Anthropic Claude, and Google Gemini
- **Platform Integration**: Creates tickets directly on GitLab and GitHub
- **User Confirmation Flow**: Review and edit tickets before creation

### Technical Features
- **Beautiful Modern UI**: Clean, responsive design with light/dark theme support
- **Real-time Chat**: Seamless conversation experience with AI models
- **Authentication System**: Secure user management with JWT tokens
- **Database Storage**: Conversation history and ticket tracking
- **API Abstraction**: Unified interface for multiple AI providers with fallback support
- **Platform OAuth**: Secure integration with GitLab and GitHub APIs

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API communication
- **Framer Motion** for animations

### Backend
- **Hono** (fast web framework)
- **Node.js** with TypeScript
- **SQLite** with Drizzle ORM
- **JWT** authentication
- **Multi-AI integration** (OpenAI, Anthropic, Google)
- **Platform APIs** (GitLab, GitHub via Octokit)

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Quick Setup
```bash
# Clone and setup everything
git clone <repository-url>
cd PromptToIssue

# Install all dependencies and setup database
npm run setup
```

### Manual Setup
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies  
cd ../frontend && npm install

# Generate and run database migrations
cd ../backend
npm run db:generate
npm run db:migrate
```

## ⚙️ Configuration

### Environment Variables

All URLs and API endpoints are configurable via environment variables to support different deployment environments (development, staging, production).

### Backend Configuration
Copy `backend/env.example` to `backend/.env` and configure:

```env
# Database
DATABASE_URL=./app.db

# JWT Secret (change this!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# AI API Keys (at least one required)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key  
GOOGLE_API_KEY=your-google-api-key

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration - Frontend URL
FRONTEND_URL=http://localhost:5173
```

### Frontend Configuration
Copy `frontend/env.example` to `frontend/.env`:

```env
# Backend API URL
VITE_API_URL=http://localhost:3000
```

### Deployment Configuration

For different environments, update the URLs accordingly:

**Production Example:**
```env
# Backend .env
FRONTEND_URL=https://your-app.com
PORT=3000

# Frontend .env  
VITE_API_URL=https://api.your-app.com
```

**Staging Example:**
```env
# Backend .env
FRONTEND_URL=https://staging.your-app.com
PORT=3000

# Frontend .env
VITE_API_URL=https://staging-api.your-app.com
```

### AI API Keys Setup

#### OpenAI
1. Go to [OpenAI API](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add to `OPENAI_API_KEY` in backend/.env

#### Anthropic Claude
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Add to `ANTHROPIC_API_KEY` in backend/.env

#### Google Gemini
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add to `GOOGLE_API_KEY` in backend/.env

## 🚀 Development

### Run Both Frontend and Backend
```bash
# Start both servers with hot reload
npm run dev
```

### Run Individually
```bash
# Backend only (http://localhost:3000)
npm run dev:backend

# Frontend only (http://localhost:5173)  
npm run dev:frontend
```

### Database Management
```bash
# Generate new migration after schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Open database studio
npm run db:studio
```

## 📝 Usage

### 1. User Registration/Login
- Create an account or sign in
- Secure JWT-based authentication

### 2. AI Chat Interface
- Start a conversation describing your requirements
- AI analyzes and suggests ticket breakdowns
- Support for multiple AI models with automatic fallback

### 3. Ticket Review & Creation
- Review AI-generated tickets
- Edit titles, descriptions, acceptance criteria, and tasks
- Approve for creation on connected platforms

### 4. Platform Integration
- Connect GitLab and GitHub accounts
- Configure default platforms and projects
- Automatic ticket creation with proper formatting

## 🏗 Architecture

### Frontend Structure
```
frontend/src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── chat/           # Chat interface
│   ├── layout/         # Layout components
│   └── ui/             # Reusable UI components
├── contexts/           # React contexts
│   ├── AuthContext.tsx # Authentication state
│   ├── ChatContext.tsx # Chat state management
│   └── ThemeContext.tsx # Theme management
└── App.tsx            # Main application
```

### Backend Structure
```
backend/src/
├── db/                 # Database configuration
│   ├── schema.ts      # Database schema
│   └── index.ts       # Database connection
├── services/          # Business logic
│   ├── ai/           # AI provider integrations
│   └── platforms/    # Platform API clients
└── index.ts          # Server entry point
```

## 🤖 AI Integration

The system supports multiple AI providers with intelligent fallback:

- **Primary Provider**: Uses your preferred AI model
- **Fallback System**: Automatically switches if primary fails
- **Consistent Prompting**: Specialized prompts for ticket generation
- **Context Management**: Maintains conversation context

## 🔧 Platform APIs

### GitLab Integration
- OAuth authentication
- Project listing
- Issue creation and updates
- Label and milestone support

### GitHub Integration  
- OAuth authentication
- Repository listing
- Issue creation and updates
- Label and assignee support

## 📊 Database Schema

Key entities:
- **Users**: Authentication and preferences
- **Conversations**: Chat sessions with AI
- **Messages**: Individual chat messages
- **Tickets**: Generated and created tickets
- **Platforms**: Connected GitLab/GitHub accounts
- **Settings**: User preferences and configurations

## 🚀 Production Deployment

### Build for Production
```bash
# Build both frontend and backend
npm run build

# Start production servers
npm start
```

### Environment Variables
- Change `JWT_SECRET` to a secure random string
- Set `NODE_ENV=production`
- Configure proper database URL for production
- Set up proper CORS origins

### Database
- For production, consider using PostgreSQL instead of SQLite
- Update Drizzle configuration accordingly
- Run migrations in production environment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Common Issues

**Database Issues**
```bash
# Reset database
rm backend/app.db
npm run db:migrate
```

**Port Conflicts**
- Backend runs on port 3000
- Frontend runs on port 5173
- Change ports in respective .env files if needed

**API Key Issues**
- Ensure at least one AI API key is configured
- Check API key validity and quotas
- Review console logs for specific errors

**Build Issues**
```bash
# Clear node_modules and reinstall
rm -rf node_modules backend/node_modules frontend/node_modules
npm run install:all
```

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review console logs for errors
3. Create an issue in the repository
4. Include relevant error messages and environment details

---

**Happy ticket automation! 🎫✨** 