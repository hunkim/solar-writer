# Solar Writer Implementation Guide

This document provides a comprehensive overview of the Solar Writer project architecture, implementation details, and contribution guidelines for open source developers.

## 🏗️ Project Architecture

### Overview
Solar Writer is a modern Next.js 15 application that leverages multiple AI APIs to create an intelligent content generation platform. The app follows a modular, component-based architecture with clear separation of concerns.

```
01-solar-writer-app/
├── app/                    # Next.js App Router
│   ├── [locale]/          # Internationalized routes (en, ko, ja)
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   └── *.tsx             # Feature components
├── lib/                  # Utility functions
├── hooks/                # Custom React hooks
├── messages/             # i18n translation files
├── public/               # Static assets
└── styles/               # Additional styles
```

### Core Philosophy
- **AI-First**: Every feature is designed around AI capabilities
- **User-Centric**: Simple, intuitive interface for complex AI operations
- **Multilingual**: Built-in support for English, Korean, and Japanese
- **Modular**: Components are reusable and loosely coupled
- **Type-Safe**: Full TypeScript implementation

## 🛠️ Technology Stack

### Frontend
- **Next.js 15**: App Router with React Server Components
- **React 19**: Latest stable version with concurrent features
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Utility-first styling with custom design system
- **Radix UI**: Accessible, unstyled UI primitives
- **Shadcn/ui**: Pre-built component library based on Radix UI

### Backend & APIs
- **Next.js API Routes**: Server-side endpoints
- **Upstage SolarLLM**: Primary AI content generation
- **Upstage Document Parse**: Document text extraction
- **Firecrawl**: Web content scraping and extraction
- **Tavily**: Real-time web search and research

### Development Tools
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting (via ESLint integration)
- **PostCSS**: CSS processing with Tailwind CSS
- **Vercel**: Deployment and hosting platform

### Internationalization
- **next-intl**: Internationalization framework
- **Supported Languages**: English (en), Korean (ko), Japanese (ja)
- **Locale Routing**: `/[locale]/` pattern for all routes

## 📁 Detailed File Structure

### `/app` Directory
```
app/
├── layout.tsx             # Root layout with metadata
├── globals.css            # Global CSS with Tailwind directives
├── [locale]/             # Localized routes
│   ├── layout.tsx        # Locale-specific layout
│   ├── page.tsx          # Home page
│   ├── analysis/         # Content analysis pages
│   └── upload/           # File upload pages
└── api/                  # Server-side API endpoints
    ├── chat/             # Chat refinement API
    ├── write/            # Content generation API
    ├── scrape/           # Web scraping API
    └── upload/           # Document upload API
```

### `/components` Directory
```
components/
├── ui/                   # Shadcn/ui base components
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   └── ...
├── input-form.tsx        # Main content input form
├── writing-progress.tsx  # AI writing progress display
├── chat-interface.tsx    # Content refinement chat
├── theme-provider.tsx    # Dark/light theme provider
└── language-selector.tsx # Language switching component
```

### Key Components

#### `input-form.tsx`
- **Purpose**: Main form for project creation and source input
- **Features**: Text input, URL scraping, file upload, content type selection
- **State Management**: Complex form state with validation
- **API Integration**: Upload, scrape endpoints

#### `writing-progress.tsx`
- **Purpose**: Real-time display of AI content generation process
- **Features**: Multi-phase progress tracking, section-by-section generation
- **Streaming**: Server-sent events for real-time updates
- **UI**: Animated progress indicators and content preview

#### `chat-interface.tsx`
- **Purpose**: Interactive content refinement after generation
- **Features**: Real-time chat, content modifications, version history
- **State**: Conversation history, loading states
- **Integration**: Chat API endpoint with streaming responses

## 🔌 API Architecture

### Endpoint Structure
All API routes follow RESTful conventions and return consistent JSON responses:

```typescript
// Success Response
{
  success: true,
  data: T
}

// Error Response
{
  success: false,
  error: string,
  details?: any
}
```

### Core Endpoints

#### `POST /api/upload`
- **Purpose**: Process uploaded documents using Upstage Document Parse
- **Input**: FormData with file
- **Output**: Extracted text content and metadata
- **Supported Formats**: PDF, DOC, DOCX, TXT
- **Max File Size**: Handled by Upstage API limits

#### `POST /api/scrape`
- **Purpose**: Extract content from web URLs using Firecrawl
- **Input**: `{ url: string }`
- **Output**: Clean markdown content and metadata
- **Features**: Auto-removes navigation, ads, and non-content elements

#### `POST /api/write`
- **Purpose**: Generate content using SolarLLM with multi-phase approach
- **Input**: Project data, sources, outline, content type
- **Output**: Streaming JSON with phase updates and generated content
- **Phases**: Section refinement → Content generation → Coherence improvement

#### `POST /api/chat`
- **Purpose**: Refine and modify generated content interactively
- **Input**: Conversation history and new message
- **Output**: Streaming AI response with content modifications
- **Context**: Maintains full content and conversation context

### API Integration Patterns

#### Error Handling
```typescript
try {
  const response = await fetch('/api/endpoint', options);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error);
  }
  
  return data.data;
} catch (error) {
  // Handle network or parsing errors
  console.error('API Error:', error);
  throw error;
}
```

#### Streaming Responses
```typescript
const response = await fetch('/api/write', {
  method: 'POST',
  body: JSON.stringify(data),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const json = JSON.parse(line.slice(6));
      // Handle streaming update
    }
  }
}
```

## 🎨 UI/UX Design System

### Color Scheme
- **Primary**: Blue tones for main actions and branding
- **Secondary**: Gray scale for neutral elements
- **Accent**: Orange/yellow for highlights and warnings
- **Success**: Green for completion states
- **Error**: Red for error states

### Typography
- **Font Family**: System font stack with fallbacks
- **Scale**: Tailwind's default type scale (text-sm to text-4xl)
- **Weight**: Regular (400), Medium (500), Semibold (600), Bold (700)

### Components Patterns
- **Form Controls**: Consistent styling across all input elements
- **Buttons**: Primary, secondary, outline, and ghost variants
- **Cards**: Subtle borders and shadows for content grouping
- **Loading States**: Skeleton loaders and progress indicators

### Responsive Design
- **Mobile First**: All components designed for mobile, then enhanced
- **Breakpoints**: Standard Tailwind breakpoints (sm, md, lg, xl, 2xl)
- **Touch Targets**: Minimum 44px for interactive elements

## 🌐 Internationalization (i18n)

### Implementation
- **Framework**: next-intl for robust i18n support
- **Routing**: `/[locale]/` dynamic segments for all pages
- **Fallback**: English (en) as the default locale
- **Translation Files**: JSON files in `/messages` directory

### Adding New Languages
1. Add locale to `locales` array in `i18n.ts`
2. Create new translation file in `/messages/[locale].json`
3. Update middleware matcher pattern
4. Test all routes and components

### Translation Key Structure
```json
{
  "common": {
    "buttons": {
      "submit": "Submit",
      "cancel": "Cancel"
    }
  },
  "pages": {
    "home": {
      "title": "Welcome to Solar Writer"
    }
  },
  "components": {
    "inputForm": {
      "labels": {
        "title": "Project Title"
      }
    }
  }
}
```

## 🔄 State Management

### Client State
- **React State**: Local component state with useState/useReducer
- **Form State**: react-hook-form for complex forms with validation
- **Theme State**: next-themes for dark/light mode persistence
- **No Global State**: Intentionally avoiding Redux/Zustand for simplicity

### Server State
- **No Caching**: Direct API calls without client-side caching
- **Real-time Updates**: Server-sent events for live progress updates
- **Error Boundaries**: React error boundaries for graceful error handling

### Data Flow
```
User Input → Form Validation → API Call → Streaming Response → UI Update
                ↓
            Local State Update
                ↓
            Component Re-render
```

## 🧪 Development Workflow

### Getting Started
1. **Clone Repository**: `git clone [repository-url]`
2. **Install Dependencies**: `npm install` or `pnpm install`
3. **Environment Setup**: Copy `.env.local.example` to `.env.local`
4. **Add API Keys**: Configure required API keys in `.env.local`
5. **Start Development**: `npm run dev`

### Environment Variables
```env
# Required
UPSTAGE_API_KEY=your_upstage_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key

# Optional
TAVILY_API_KEY=your_tavily_api_key
UPSTAGE_MODEL_NAME=solar-pro2-preview
```

### Development Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript check
```

### Code Style
- **ESLint**: Enforced code style and best practices
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Prettier**: Automatic code formatting (configured via ESLint)
- **File Naming**: kebab-case for files, PascalCase for components

## 📝 Contributing Guidelines

### Code Contribution Process
1. **Fork Repository**: Create your own fork on GitHub
2. **Create Feature Branch**: `git checkout -b feature/your-feature-name`
3. **Make Changes**: Implement your feature or fix
4. **Write Tests**: Add tests for new functionality (when test suite exists)
5. **Lint Code**: Run `npm run lint` to ensure code quality
6. **Type Check**: Run TypeScript check to ensure type safety
7. **Commit Changes**: Use conventional commit messages
8. **Push Branch**: Push to your fork
9. **Create Pull Request**: Submit PR with detailed description

### Commit Message Convention
```
type(scope): description

feat(api): add new content generation endpoint
fix(ui): resolve mobile layout issues
docs(readme): update installation instructions
refactor(components): simplify form validation logic
```

### Pull Request Requirements
- **Description**: Clear explanation of changes and motivation
- **Screenshots**: For UI changes, include before/after screenshots
- **Testing**: Verify changes work in all supported browsers
- **Documentation**: Update relevant documentation
- **No Breaking Changes**: Avoid breaking existing functionality

### Code Review Checklist
- [ ] Code follows project style guidelines
- [ ] TypeScript types are properly defined
- [ ] Components are accessible (ARIA labels, keyboard navigation)
- [ ] Mobile responsiveness is maintained
- [ ] No console errors or warnings
- [ ] Performance impact is minimal
- [ ] Security considerations are addressed

## 🏷️ Component Development Guidelines

### Component Structure
```typescript
import React from 'react';
import { cn } from '@/lib/utils';

interface ComponentProps {
  // Required props
  title: string;
  // Optional props with defaults
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  // Event handlers
  onClick?: () => void;
  // Children or content
  children?: React.ReactNode;
}

export function Component({
  title,
  variant = 'primary',
  disabled = false,
  onClick,
  children,
}: ComponentProps) {
  return (
    <div
      className={cn(
        'base-classes',
        variant === 'primary' && 'primary-classes',
        variant === 'secondary' && 'secondary-classes',
        disabled && 'disabled-classes'
      )}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </div>
  );
}
```

### Best Practices
- **TypeScript First**: Always define proper interfaces for props
- **Accessibility**: Include ARIA attributes and keyboard navigation
- **Performance**: Use React.memo for expensive components
- **Styling**: Use Tailwind CSS with cn() utility for conditional classes
- **Composition**: Prefer composition over inheritance
- **Single Responsibility**: Each component should have one clear purpose

### Component Testing (Future)
```typescript
import { render, screen } from '@testing-library/react';
import { Component } from './Component';

describe('Component', () => {
  it('renders with correct title', () => {
    render(<Component title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Component title="Test" onClick={handleClick} />);
    
    screen.getByRole('button').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## 🚀 Deployment

### Vercel Deployment (Recommended)
1. **Connect Repository**: Link GitHub repository to Vercel
2. **Environment Variables**: Add all required environment variables
3. **Build Settings**: Use default Next.js build configuration
4. **Domain Configuration**: Set up custom domain if needed

### Manual Deployment
```bash
npm run build        # Build the application
npm run start       # Start production server
```

### Environment Configuration
- **Production**: Set NODE_ENV=production
- **API Keys**: Configure all required API keys
- **Error Monitoring**: Consider adding Sentry or similar service

## 🐛 Debugging & Troubleshooting

### Common Issues

#### API Key Configuration
```typescript
// Check if API keys are properly configured
if (!process.env.UPSTAGE_API_KEY) {
  console.error('UPSTAGE_API_KEY is not configured');
  return NextResponse.json({ error: 'API key missing' }, { status: 500 });
}
```

#### CORS Issues
- Ensure API routes are properly configured for cross-origin requests
- Check that client-side requests use relative URLs

#### Build Errors
- Run `npm run type-check` to identify TypeScript issues
- Check for missing dependencies or version conflicts
- Verify environment variables are available during build

### Development Tools
- **React DevTools**: Install browser extension for component debugging
- **Network Tab**: Monitor API requests and responses
- **Console Logging**: Use structured logging for debugging
- **Error Boundaries**: Implement to catch and handle React errors

## 📊 Performance Considerations

### Client-Side Optimization
- **Code Splitting**: Next.js automatic route-based splitting
- **Image Optimization**: Use Next.js Image component
- **Bundle Analysis**: Run `npm run build` and analyze bundle size
- **Lazy Loading**: Implement for non-critical components

### Server-Side Optimization
- **API Response Caching**: Cache static responses where appropriate
- **Streaming**: Use streaming for long-running operations
- **Database Queries**: Optimize API calls to external services
- **Memory Management**: Monitor memory usage in serverless functions

### Monitoring
- **Core Web Vitals**: Monitor performance metrics
- **Error Tracking**: Implement error monitoring
- **API Latency**: Track external API response times
- **User Analytics**: Monitor user behavior and pain points

## 🔒 Security Best Practices

### API Security
- **Input Validation**: Validate all user inputs
- **Rate Limiting**: Implement rate limiting for API endpoints
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **Error Handling**: Don't expose sensitive information in error messages

### Environment Security
- **API Key Management**: Store API keys securely in environment variables
- **Client-Side Exposure**: Never expose API keys in client-side code
- **HTTPS Only**: Ensure all communications use HTTPS
- **Content Security Policy**: Implement CSP headers for XSS protection

## 🎯 Future Roadmap

### Planned Features
- **User Authentication**: Add user accounts and project persistence
- **Collaboration**: Multi-user editing and sharing capabilities
- **Templates**: Pre-built content templates for common use cases
- **Export Options**: PDF, Word, and other format exports
- **Version Control**: Content version history and branching
- **Plugin System**: Extensible architecture for third-party integrations

### Technical Improvements
- **Test Suite**: Comprehensive unit and integration testing
- **Performance Monitoring**: Real-time performance analytics
- **Error Handling**: Enhanced error reporting and recovery
- **Accessibility**: WCAG 2.1 AA compliance
- **Offline Support**: Progressive Web App capabilities

### Community Features
- **Plugin Marketplace**: Community-contributed plugins
- **Template Gallery**: User-submitted content templates
- **API Documentation**: Interactive API documentation
- **Developer Tools**: CLI tools and development utilities

---

## 🤝 Getting Help

### Resources
- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Documentation**: Comprehensive guides and API reference
- **Community**: Join our developer community

### Contact
- **Maintainers**: Tag project maintainers in issues
- **Security Issues**: Report privately via security email
- **Feature Requests**: Use GitHub discussions for proposals

---

*This implementation guide is a living document. Please help keep it up-to-date by contributing improvements and corrections.* 