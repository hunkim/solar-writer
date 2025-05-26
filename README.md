# Solar Writer App

An AI-powered content creation application that helps you generate professional content from various sources including documents and web pages.

## Features

- **Document Processing**: Upload PDF, DOC, DOCX, or TXT files and extract content using Upstage Document Parse API
- **Web Content Extraction**: Extract clean content from web pages using Firecrawl API
- **AI Content Generation**: Multi-phase content generation with SolarLLM:
  - **Section Refinement**: Analyzes and optimizes your outline structure
  - **Content Writing**: Generates high-quality content for each section
  - **Coherence Improvement**: Refines the complete document for consistency and flow
- **Interactive Refinement**: Real-time chat interface for content adjustments:
  - Change tone, style, and length
  - Add or remove details
  - Restructure sections
  - Multiple refinement iterations

## Setup

### Prerequisites

- Node.js 18 or higher
- npm or pnpm package manager

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Upstage API Key for Document Parse and SolarLLM
UPSTAGE_API_KEY=your_upstage_api_key_here

# Firecrawl API Key for URL content extraction
FIRECRAWL_API_KEY=your_firecrawl_api_key_here

# Tavily API Key for real-time search enhancement (optional)
TAVILY_API_KEY=your_tavily_api_key_here

# Upstage Model Name (optional, defaults to solar-pro2-preview)
UPSTAGE_MODEL_NAME=solar-pro2-preview
```

#### Getting API Keys

1. **Upstage API Key**: 
   - Visit [Upstage Console](https://console.upstage.ai/)
   - Sign up or log in
   - Navigate to API Keys section
   - Create a new API key for Document Parse and SolarLLM

2. **Firecrawl API Key**:
   - Visit [Firecrawl](https://firecrawl.dev/)
   - Sign up or log in
   - Get your API key from the dashboard

3. **Tavily API Key** (Optional but recommended):
   - Visit [Tavily](https://tavily.com/)
   - Sign up or log in
   - Get your API key from the dashboard
   - Note: Without this key, content generation will work but won't include real-time search enhancement

4. **Upstage Model Configuration** (Optional):
   - Set `UPSTAGE_MODEL_NAME` to specify which Upstage model to use
   - Defaults to `solar-pro2-preview` if not specified
   - Available models: `solar-pro2-preview`, `solar-pro`, etc.

### Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Usage

1. **Create a Project**: Start by entering a title for your content project
2. **Add Sources** (optional):
   - **Text**: Paste reference text directly
   - **URL**: Enter a web page URL and click "Extract Content" to scrape it
   - **Upload**: Upload documents (PDF, DOC, DOCX, TXT) for automatic content extraction
3. **Select Content Type**: Choose the type of content you want to generate
4. **Provide Outline**: Enter a structured outline for your content
5. **AI Generation Process**:
   - **Phase 1**: Section analysis and refinement using your sources
   - **Phase 2**: Enhanced content generation with real-time search
     - Automatic keyword extraction for each section
     - Real-time web search using Tavily API
     - Integration of current information with your provided sources
   - **Phase 3**: Coherence and consistency refinement
6. **Interactive Refinement**: Use the chat interface to:
   - Request tone or style changes
   - Adjust content length
   - Add specific details or examples
   - Make structural improvements
   - Continue refining until satisfied

## API Integrations

### Upstage SolarLLM

Used for intelligent content generation and refinement:
- **Content Planning**: Analyzes outlines and optimizes section structure
- **Content Writing**: Generates professional, contextual content
- **Coherence Refinement**: Ensures consistency and flow across sections
- **Interactive Chat**: Real-time content modifications based on user feedback

### Upstage Document Parse

Used for extracting text content from uploaded documents. Supports:
- PDF files
- Microsoft Word documents (.doc, .docx)
- Plain text files (.txt)

### Firecrawl

Used for extracting clean, structured content from web pages. Features:
- Automatic content extraction
- Removes navigation, ads, and other non-content elements
- Returns markdown-formatted text
- Extracts metadata like title, description, and author

### Tavily Search API

Enhances content generation with real-time search capabilities:
- Intelligent keyword extraction from section context
- Advanced web search with raw content inclusion
- Current and factual information retrieval
- Seamless integration with existing content sources
- Automatically filters out low-quality sources (social media, forums)

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI**: React with Tailwind CSS and Radix UI components
- **Document Processing**: Upstage Document Parse API
- **Web Scraping**: Firecrawl API
- **TypeScript**: Full type safety throughout the application

## Development

The project uses:
- TypeScript for type safety
- Tailwind CSS for styling
- Radix UI for accessible components
- Next.js API routes for backend functionality

## License

This project is licensed under the MIT License. 