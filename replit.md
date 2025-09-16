# Overview

Dillin.ai is a scientific intelligence application that provides interactive visualization and analysis of research papers and their citation networks. The application allows users to search for papers using DOI or PubMed ID, explore citation relationships, and visualize networks through multiple interactive modes including network graphs, timelines, and 3D orbit views. It features collaborative functionality with user authentication, project management, real-time collaboration through WebSockets, and comprehensive export capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client is built as a React Single Page Application (SPA) using Vite as the build tool. The architecture follows a modern component-based approach with:

- **UI Framework**: React with TypeScript for type safety
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design
- **State Management**: Zustand stores for global state management (papers, collaboration, audio)
- **Data Fetching**: TanStack Query for server state management and caching
- **Routing**: File-based routing with support for 404 handling
- **3D Visualization**: React Three Fiber and Drei for 3D graphics rendering

### Key Client Components

- **Visualization Engine**: Multiple visualization modes (Cytoscape networks, D3 graphs, timeline views, orbit views, universe views)
- **Search Interface**: Paper search by DOI/PubMed ID with real-time filtering
- **Collaboration Tools**: Real-time collaboration features with WebSocket integration
- **Export System**: Comprehensive export functionality for data and visualizations

## Backend Architecture

The server follows an Express.js REST API architecture with real-time WebSocket support:

- **Framework**: Express.js with TypeScript
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Real-time Communication**: WebSocket server for collaboration features
- **External Integration**: PubMed API service for paper data retrieval
- **File Structure**: Modular route organization with separate concern separation

### API Design

- **REST Endpoints**: Organized by feature (auth, projects, annotations, sharing, teams)
- **Middleware**: Request logging, authentication guards, and error handling
- **WebSocket Events**: Real-time collaboration events for cursor tracking, presence, and document updates

## Data Storage Solutions

The application uses PostgreSQL as the primary database with Drizzle ORM:

- **Database**: PostgreSQL for relational data storage
- **ORM**: Drizzle with type-safe schema definitions
- **Migrations**: Drizzle Kit for database schema management
- **Connection**: Neon serverless database connector

### Database Schema

- **Users**: Authentication and profile management
- **Projects**: Research project containers with visualization settings
- **Collaboration**: Project collaborators, teams, and shared links
- **Annotations**: User annotations on papers and networks
- **Activity Logs**: Audit trail for collaboration activities
- **Sessions**: Real-time collaboration session management

## Authentication and Authorization

- **Strategy**: JWT tokens with refresh token rotation
- **Password Security**: bcrypt hashing with salt rounds
- **Session Management**: HTTP-only cookies for token storage
- **Authorization**: Role-based access control (owner, editor, viewer, commenter)
- **Optional Authentication**: Public access to basic features with enhanced functionality for authenticated users

## Real-time Collaboration

- **WebSocket Integration**: Custom WebSocket server for real-time features
- **Presence Awareness**: Live user presence and cursor tracking
- **Document Synchronization**: Real-time annotation and project updates
- **Session Management**: Collaboration session lifecycle management

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle ORM**: Type-safe database operations

## External APIs
- **PubMed API**: Research paper data and citation information
- **DOI Resolution**: Converting DOI to PubMed ID for paper lookup

## UI and Visualization Libraries
- **Radix UI**: Headless UI components for accessibility
- **Cytoscape.js**: Network graph visualization
- **D3.js**: Data-driven document manipulation
- **React Three Fiber**: 3D graphics and WebGL rendering
- **html2canvas & jsPDF**: Export functionality for images and PDFs

## Development Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Type safety across the application
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: Fast JavaScript bundler for production

## Authentication & Security
- **jsonwebtoken**: JWT token generation and verification
- **bcryptjs**: Password hashing and verification

## File Processing
- **file-saver**: Client-side file download functionality
- **GLSL shader support**: For advanced 3D visualizations