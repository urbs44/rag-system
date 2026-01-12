# RAG System

A multi-provider Retrieval-Augmented Generation (RAG) system built with Next.js. Upload documents to create a knowledge base, then chat with an AI that can reference your documents to provide accurate, contextual answers.

## Features

### 🤖 Multi-Provider Support
- **Google Gemini** - Native file upload with Gemini File API
- **OpenAI** - Assistants API with File Search and Vector Stores

### 📚 Knowledge Base
- Upload PDF, TXT, and MD files
- Documents are automatically indexed for retrieval
- Provider-specific storage (files don't transfer between providers)
- Visual indicator showing which provider stores your files

### 💬 Chat Interface
- Streaming responses with real-time typing effect
- Source citations from your documents
- Chat history persists in browser localStorage
- Usage tracking (tokens & estimated costs)

### ⚙️ Settings
- API key management per provider (stored locally)
- Model selection with pricing information
- Usage statistics with cost estimates
- Easy provider switching

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **AI Providers**: Google Gemini, OpenAI
- **Storage**: localStorage (client-side)

## Getting Started

### Prerequisites

- Node.js 18+
- API key from [Google AI Studio](https://aistudio.google.com/apikey) and/or [OpenAI Platform](https://platform.openai.com/api-keys)

### Installation

```bash
# Clone the repository
git clone https://github.com/urbs44/rag-system.git
cd rag-system

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

1. Go to **Settings** in the sidebar
2. Select your preferred AI provider (Gemini or OpenAI)
3. Enter your API key and click **Save**
4. Choose a model

## Usage

### Upload Documents

1. Go to **Knowledge Base**
2. Drag and drop files or click to upload
3. Supported formats: PDF, TXT, MD

### Chat with Your Documents

1. Go to **Chat**
2. Ask questions about your uploaded documents
3. The AI will cite sources using `[Source: filename]` format

## Provider Comparison

| Feature | Gemini | OpenAI |
|---------|--------|--------|
| File Upload | ✅ Native File API | ✅ Vector Store |
| File Expiration | 48 hours | Pay per GB/day |
| RAG Quality | Excellent | Excellent |
| Cost | Lower | Higher |
| Best For | Document-heavy workflows | GPT model preference |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/         # Chat endpoint (streaming)
│   │   ├── files/        # File listing
│   │   ├── upload/       # File upload
│   │   └── validate-key/ # API key validation
│   ├── knowledge/        # Knowledge Base page
│   └── settings/         # Settings page
├── components/
│   ├── chat/             # Chat interface
│   ├── knowledge/        # Upload zone & file list
│   └── layout/           # Sidebar
└── lib/
    ├── settings.ts       # Settings & storage utilities
    └── openai-assistants.ts # OpenAI Assistants helper
```

## Security Notes

- API keys are stored in browser localStorage (not sent to any server except the AI providers)
- `.env.local` is gitignored to prevent accidental key exposure
- For production, consider server-side key management

## License

MIT
