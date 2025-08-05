# Product Development Assistant

## Overview

A full-stack React application that provides an AI-powered product development workflow system. The app guides users through a structured 5-stage development process with integrated chat interfaces for each stage. Built with React/TypeScript frontend, Express.js backend, and PostgreSQL database using Drizzle ORM.

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
  - Projects table: Stores project metadata and AI model preferences
  - Stages table: 5-stage workflow with progress tracking and custom prompts
  - Messages table: Chat history for each stage with role-based messages
- **Relationships**: Cascading deletes from projects → stages → messages
- **Migration Strategy**: Drizzle Kit for schema migrations

### AI Integration
- **Provider**: OpenAI GPT-4o as the primary AI model
- **Service Layer**: Abstracted AI service supporting multiple models (Claude Sonnet, GPT variants)
- **Chat Interface**: Conversational AI with system prompts and context management
- **Structured Outputs**: JSON response formatting for data extraction

### Design System
- **Philosophy**: "Calm Precision" design approach emphasizing minimalism and cognitive ease
- **Typography**: Inter font family with defined scale (14px to 56px)
- **Color System**: CSS custom properties with semantic naming (contrast-high/medium/low, surface variants)
- **Components**: Consistent 8pt grid system with defined spacing and interaction patterns
- **Responsive Design**: Mobile-first approach with 4-column mobile, 12-column desktop grid

### Development Workflow
- **Stage-Based Process**: 5 sequential stages with unlocking mechanism based on progress
- **Progress Tracking**: 0-100% completion scoring with visual indicators
- **Context Flow**: Visual representation of stage progression and current status
- **Chat Integration**: Stage-specific AI assistants with customizable system prompts

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