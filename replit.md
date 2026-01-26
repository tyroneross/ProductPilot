# Product Development Assistant

## Overview

A full-stack React application that helps users build comprehensive product documentation through AI-powered conversation. Users describe what they want to build, and the AI guides them through creating a complete PRD, architecture design, coding prompts, and development guide. Built with React/TypeScript frontend, Express.js backend, and PostgreSQL database using Drizzle ORM.

**Design System:** Implements Calm Precision 6.2 design principles for cognitive predictability and information-first structure.

**Core Features:**
- Conversational product definition through AI interview
- Comprehensive documentation generation (PRD, architecture, prompts, guide)
- Document view for iterating on existing products
- Optional stage-by-stage workflow for structured refinement

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development/build tooling
- **UI System**: Custom design system based on shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens following "Calm Precision" design guidelines
- **State Management**: TanStack Query for server state and React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints for projects, stages, and messages
- **Error Handling**: Centralized error middleware with structured error responses
- **Logging**: Custom request/response logging for API endpoints

### Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema Structure**:
  - Projects table: Stores project metadata, workflow mode (stage-based/interview), and AI model preferences
  - Stages table: 5-stage workflow with progress tracking and custom prompts
  - Messages table: Chat history for each stage with role-based messages
- **Relationships**: Cascading deletes from projects → stages → messages
- **Migration Strategy**: Drizzle Kit for schema migrations
- **Storage Modes**: PostgreSQL (production) with in-memory fallback (development)

### AI Integration
- **Provider**: Anthropic Claude as primary (Sonnet for most stages, Haiku for UI wireframes)
- **Secondary**: OpenAI GPT-4o support
- **Service Layer**: Abstracted AI service supporting multiple models
- **Chat Interface**: Conversational AI with system prompts and context management
- **Structured Outputs**: JSON response formatting for data extraction
- **Backend Validation**:
  - PRD stage: Prevents premature document generation (requires 5+ user messages)
  - UI Design stage: Ensures HTML wireframes are generated (orange theme)

### Design System

**Calm Precision 6.2 Implementation:**

- **Philosophy**: Cognitive predictability through information-first structure
- **Core Principles**:
  - Grouped containers: Single border around related items, dividers between them (Gestalt)
  - Button sizing by intent: Critical actions = large, quick actions = compact (Fitts' Law)
  - Three-line hierarchy: Title (16px) → Description (14px) → Metadata (12px)
  - Progressive disclosure: Show less, reveal more on demand (Hick's Law)
  - Text over decoration: Color and weight create hierarchy (Signal-to-Noise)
  - Functional integrity: Only interactive elements with real backend connections
  
- **Typography Scale**:
  - `.text-title`: 16px, medium weight (three-line hierarchy)
  - `.text-description`: 14px, regular (three-line hierarchy)
  - `.text-metadata`: 12px, regular (three-line hierarchy)
  - Legacy: h1 (56px), h2 (40px), h3 (32px), h4 (24px), body (18px), small (14px)
  
- **Color System**: CSS custom properties with semantic naming
  - Contrast levels: high (10% gray), medium (40% gray), low (60% gray)
  - Surface variants: primary (white), secondary (97% lightness), tertiary (95% lightness)
  - Accent: HSL(207, 90%, 54%) - blue for interactive elements
  
- **Grid System**: 8pt grid for spacing and alignment
- **Touch Targets**: Minimum 44×44px on mobile, 24×24px on desktop
- **Accessibility**: WCAG 2.2 AA compliance (4.5:1 text contrast minimum)

### User Workflow

**Simplified Quick Start Flow (Default):**

1. **Landing Page** (/)
   - Welcome screen with "Get Started" CTA
   - Shows what you'll get (Requirements, Product Spec, Architecture, Dev Guide)
   - Option to continue draft or view existing projects

2. **Quick Start** (/details)
   - **Minimum viable context**: 3 required fields only
     - Problem statement: "Users need to ___ because ___"
     - Top 3 user goals: What should users accomplish?
     - V1 definition: What makes v1 "done"?
   - **"Build Docs Now"** button: Generate docs immediately with minimal info
   - **"Add More Details First"** button: Go to survey for richer context
   - Expandable optional fields (objects, actions, tools, inspiration)

3. **Survey Mode** (/session/survey) - Optional Expansion
   - AI-powered discovery chat to gather more requirements
   - Structured survey with sliders and selects
   - For users who want more detailed/accurate documentation
   - Save button always visible

4. **Existing Projects** (/projects)
   - View all saved projects
   - Access documents, continue building, or work stage-by-stage
   - Mobile-friendly with responsive buttons

**Deprecated Routes (redirect to new flow):**
- /intake → /details
- /interview/:id → /session/survey

**6 Stages:**
1. Requirements Definition
2. Product Requirements (PRD)
3. UI Design & Wireframes
4. System Architecture
5. Coding Prompts
6. Development Guide

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver for database connectivity
- **drizzle-orm**: TypeScript ORM for database operations and schema management
- **openai**: Official OpenAI API client for AI service integration
- **@tanstack/react-query**: Server state management and caching

### UI Framework
- **@radix-ui/***: Comprehensive set of accessible UI primitives for all interactive components
- **tailwindcss**: Utility-first CSS framework for styling
- **class-variance-authority**: Type-safe variant API for component styling
- **lucide-react**: Icon library for consistent iconography

### Development Tools
- **vite**: Fast build tool and development server
- **typescript**: Type checking and enhanced developer experience
- **@replit/vite-plugin-runtime-error-modal**: Development error handling (Replit-specific)
- **drizzle-kit**: Database migration and schema management tooling

### Form Handling
- **react-hook-form**: Performant forms with minimal re-renders
- **@hookform/resolvers**: Integration with validation libraries
- **zod**: TypeScript-first schema validation
- **drizzle-zod**: Automatic Zod schema generation from Drizzle schemas