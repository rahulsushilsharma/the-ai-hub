# The AI Hub

A sophisticated web application that serves as a centralized platform for various AI-powered tools and demonstrations, running entirely in the browser using modern web technologies.

## ✨ Features

### 🤖 AI Chat
- Local LLM chat interface with WebGPU acceleration
- Support for multiple models (LFM2.5-350M, Qwen3.5-0.8B, Qwen3-0.6B, SmolLM2-135M, gemma-3-270m)
- Session management with conversation history
- Model settings and configuration
- Runs entirely in the browser using ONNX models

### 🗣️ Text-to-Speech Demo
- Browser-based TTS using ONNX Runtime and WebGPU
- Real-time speech synthesis
- Audio playback capabilities
- Demonstrates client-side AI processing

### 🤗 Hugging Face Chat
- Interface for interacting with Hugging Face models
- Leverages the transformers.js library
- Access to a wider range of pre-trained models

### 🖼️ AI Background Remover
- In-browser image background removal
- Uses AI models for image processing
- Real-time processing with progress indicators
- Download functionality for processed images

## 🛠️ Tech Stack

### Core Framework
- **React 19.1.1** with TypeScript
- **Vite 7.1.7** as the build tool
- **React Router 7.9.3** for navigation
- **React Compiler** enabled for performance optimization

### UI & Styling
- **Tailwind CSS 4.1.13** for styling
- **shadcn/ui** component library (New York style)
- **Radix UI** components for accessible UI primitives
- **Lucide React** for icons

### AI/ML Libraries
- **@huggingface/transformers** for running ML models in the browser
- **ONNX Runtime Web** for model inference
- **tts-pipelines** for text-to-speech functionality
- **Three.js** for 3D graphics

### State Management & Utilities
- **Zustand** for state management
- **Anime.js** for animations
- **React Markdown** for rendering markdown content
- **Firebase** for analytics and potential backend services

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- A modern web browser with WebGPU support (for optimal performance)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/the-ai-hub.git
cd the-ai-hub
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The application uses static site generation (SSG) for optimal SEO and performance.

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── [feature components]
├── pages/              # Route-level components
├── workers/            # Web Workers for AI tasks
├── services/           # State management (Zustand stores)
├── types/              # TypeScript type definitions
├── consts/             # Constants and configurations
└── hooks/              # Custom React hooks
```

### Worker Architecture
- **chatWorker.ts**: Handles LLM inference and chat processing
- **tts.ts**: Manages text-to-speech operations
- **bgRemover.ts**: Processes image background removal
- **worker.ts**: General worker utilities

## 🌐 Browser Support

This application is designed to work on modern browsers with the following features:

- **WebGPU**: For optimal AI model performance (Chrome, Edge, Safari Technology Preview)
- **Web Workers**: For background processing
- **ES2020+**: Modern JavaScript features

### Fallback Support
The application gracefully degrades on browsers without WebGPU support, though AI processing will be slower.

## 🔧 Configuration

### Model Settings
Models are automatically downloaded and cached locally. You can configure:

- Model selection in the chat interface
- Processing parameters for background removal
- Voice settings for text-to-speech

### Environment Variables
Create a `.env.local` file for development:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
```

## 📱 Usage

### Navigation
- Use the sidebar to navigate between different AI tools
- Each feature has its own dedicated page
- Responsive design works on both desktop and mobile

### AI Chat
1. Select a model from the dropdown
2. Type your message and press Enter
3. View AI responses in real-time
4. Manage chat sessions using the sidebar

### Background Remover
1. Upload an image or use the sample
2. Click "Remove Background"
3. Wait for processing to complete
4. Download the result

### Text-to-Speech
1. Enter text in the input field
2. Select voice settings
3. Click "Generate Speech"
4. Play the generated audio

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines
- Follow the existing code style and conventions
- Use TypeScript for all new code
- Add proper error handling for AI operations
- Test on multiple browsers and devices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Hugging Face** for providing pre-trained models and transformers.js
- **ONNX Runtime** for efficient model inference in the browser
- **shadcn/ui** for the beautiful and accessible UI components
- **Vite** for the fast and modern build tool

## 📞 Contact

Created by Rahul Sharma. If you have any questions or feedback, feel free to reach out.

---

**Note**: This application demonstrates the capabilities of browser-based AI processing. All AI computations happen locally in your browser, ensuring privacy and reducing server costs.