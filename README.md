# 台灣女性主義與公益實務課程

Interactive weekly class website for a 24-week self-study course on Taiwan feminism and social good practices.

## Features

- **Course Roadmap**: 24-week curriculum overview with modules and topics
- **Week Pages**: Full lesson content with text highlighting and margin notes
- **Text Highlighting**: Select text to highlight in multiple colors with persistent notes
- **Reading Checklist**: Track completed readings with checkboxes and per-reading notes
- **Discussion & Homework**: Answer boxes with autosave and file upload support
- **Notebook**: View all highlights, notes, and answers across weeks; export as Markdown
- **Authentication**: Simple passcode protection for the entire site

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Storage**: Upstash Redis (highlights, notes, answers), Vercel Blob (file uploads)
- **Styling**: Tailwind CSS with Noto Serif TC for CJK typography
- **Deployment**: Vercel

## Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Required for authentication (if not set, the site stays locked: fail closed)
CLASS_PASSCODE=your-secure-passcode-here

# Required for Upstash Redis (data persistence)
# (the Vercel Marketplace Upstash integration's KV_REST_API_URL / KV_REST_API_TOKEN also work)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Required for Vercel Blob (file uploads)
BLOB_READ_WRITE_TOKEN=your-blob-token
```

### Setting Up Storage

#### Upstash Redis

1. Create a free account at [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Copy the REST URL and REST TOKEN from the database dashboard
4. Add them to `.env.local`

#### Vercel Blob

1. Deploy to Vercel or connect your project
2. Go to Storage → Blob in your Vercel dashboard
3. Create a Blob store
4. The `BLOB_READ_WRITE_TOKEN` will be automatically added to your environment

**Local Development Fallback**: If storage credentials are missing, the app will:
- Display a warning in the console
- Allow reading but disable data persistence
- Show clear error messages for write operations

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Content Structure

### Curriculum Overview

`content/curriculum.json` defines the 24-week structure:

```json
{
  "title": "台灣女性主義與公益實務",
  "modules": [
    {
      "moduleNumber": 1,
      "title": "台灣女性主義與民主化歷史",
      "weeks": "Weeks 1-4",
      "weekTopics": [
        {
          "week": 1,
          "title": "台灣現代婦女運動如何在威權時期形成？(1970–1987)",
          "status": "available"
        }
      ]
    }
  ]
}
```

### Week Content

Each week is stored as `content/weeks/week-NN.json`:

```json
{
  "weekNumber": 1,
  "title": "台灣現代婦女運動如何在威權時期形成？",
  "period": "1970–1987",
  "introduction": "課程介紹文字...",
  "learningGoals": ["目標1", "目標2"],
  "chapters": [
    {
      "number": 1,
      "title": "章節標題",
      "content": "章節內容..."
    }
  ],
  "readings": [
    {
      "id": "reading-1",
      "title": "閱讀標題",
      "url": "https://...",
      "source": "來源",
      "description": "簡介",
      "estimatedTime": "約 10–15 分鐘"
    }
  ],
  "discussionQuestions": [
    {
      "id": "discussion-1",
      "question": "討論問題？"
    }
  ],
  "homework": [
    {
      "id": "homework-1",
      "task": "作業要求"
    }
  ],
  "nextWeekPreview": "下週預告內容"
}
```

## Adding a New Week

1. **Create content file**: `content/weeks/week-NN.json` (use the schema above)
2. **Update curriculum**: Set the week's `status` to `"available"` in `content/curriculum.json`
3. **Commit and push**: The new week will appear on the home page automatically

All week content files must follow the JSON schema. Fields like `discussionQuestions`, `homework`, and `nextWeekPreview` are optional.

## Data Schema

### Highlights

```typescript
{
  id: string;
  weekNumber: number;
  text: string;
  color: 'yellow' | 'blue' | 'green' | 'pink';
  note?: string;
  chapterNumber?: number;
  createdAt: number;
}
```

### Reading Notes

```typescript
{
  id: string;
  weekNumber: number;
  readingId: string;
  note: string;
  createdAt: number;
}
```

### Answers

```typescript
{
  id: string;
  weekNumber: number;
  itemId: string;
  itemType: 'discussion' | 'homework';
  text: string;
  uploads?: string[];
  createdAt: number;
  updatedAt: number;
}
```

## Design Principles

- **Clean, editorial reading experience**: White background, generous spacing
- **CJK typography**: Noto Serif TC for body text, optimized line height (1.8)
- **Calm accent color**: Understated blue primary, no 3D or oversized effects
- **Mobile-first**: Responsive layout that works on phones and desktop
- **Flat, premium aesthetic**: No cutesy icons or gradients

## Deployment

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

The site will automatically rebuild when you push changes to the repository.

## Authentication

- If `CLASS_PASSCODE` is set, all pages require authentication
- Login at `/login` with the passcode
- Cookie persists for 30 days
- If `CLASS_PASSCODE` is not set, the site is fully public

## File Uploads

- Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG
- Files are stored in Vercel Blob at `uploads/week-N/itemId/timestamp-filename`
- File URLs are saved with answers and displayed as downloadable links

## Export

The Notebook page includes a "Export Markdown" button that generates a `.md` file with:
- All highlights and notes
- Reading notes
- Discussion and homework answers
- File attachment links

Perfect for archiving or sharing your learning journey.

---

Built with Next.js, Tailwind CSS, Upstash Redis, and Vercel Blob.

## Structured lesson blocks

A chapter can define `blocks: ContentBlock[]` and place each one in its `content` with a paragraph containing only `[[block:N]]` (N = index in `blocks`). Text inside tables, cards, callouts and timelines is highlightable and can take margin notes like ordinary paragraphs (each cell is its own `data-unit`). Types are in `components/Blocks.tsx`:

| type | fields | renders as |
|---|---|---|
| `table` | `columns: string[]`, `rows: string[][]`, `rowHeader?` (first cell = row label), `caption?` | notebook table; scrolls sideways ≤960px, becomes stacked cards (with column labels) ≤600px |
| `cards` | `items: {title, subtitle?, text, example?, icon?}[]`, `columns?`, `numbered?` | card grid (icons: `book`, `chat`, `users`, `megaphone`); one column on mobile |
| `callout` | `text`, `title?`, `kicker?`, `variant?: person｜source｜key`, `credit?`, `creditUrl?`, `image?` | boxed aside with coloured left rule |
| `timeline` | `items: {when, title, text?}[]` | horizontal (≤3 items) or vertical timeline; vertical on mobile |
| `chart` | `chart: stacked｜bar`, `title`, `data: {label, value}[]`, `total?`, `unit?`, `note?` | inline SVG chart (no library). Not highlightable |

A week can also set `readingsBlocks: ContentBlock[]` (currently charts), shown at the top of 本週閱讀.

Example:

```json
"content": "例如:\n\n[[block:0]]\n\n三者可能…",
"blocks": [{ "type": "table", "columns": ["說法", "訴求呈現方式"], "rows": [["…", "…"]] }]
```

Highlights are stored as chapter + unit + offsets. When content is restructured, the page re-anchors any highlight whose saved unit no longer holds the same text by looking up its text. Keep the original wording when moving text into a block.

## Appendix: Huiru's follow-up questions (延伸問題)

`content/appendix.json` → `entries[]`. Each entry is shown as a collapsible "延伸問題 · 我的提問" toggle inside the lesson. It is closed by default and also listed on 我的筆記 with a deep link (`/week/N#app-<id>` opens it).

| field | meaning |
|---|---|
| `id` | stable id (used in the URL hash `#app-<id>`) |
| `week`, `chapter` | where it lives |
| `after` | anchor: `"block:N"` (after that chapter block), the opening text of a paragraph (after that paragraph), or `"end"` (end of chapter) |
| `question` | her question, verbatim; used as the toggle title |
| `content`, `blocks` | the answer, same markup as chapter content (`###`, `- `, `**bold**`, `[[block:N]]`) |
| `sources` | `{name, url}[]` verified source links (replace ChatGPT's citation chips) |
| `source`, `askedOn` | the ChatGPT share link and date |

Text in an opened toggle can be highlighted and annotated. Notes appear inline under the paragraph.
