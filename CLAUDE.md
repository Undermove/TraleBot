# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TraleBot is a Telegram bot for English language learning that helps users translate words and learn them through weekend quizzes. The bot automatically adds translated words to users' vocabulary and creates personalized quizzes.

## Architecture

This is a .NET 8 C# project following Clean Architecture principles with these layers:
- **Domain** (`src/Domain/`): Core entities and business logic
- **Application** (`src/Application/`): Use cases, commands, queries (CQRS pattern)
- **Infrastructure** (`src/Infrastructure/`): External services (Telegram Bot API, translation services, monitoring)
- **Persistence** (`src/Persistence/`): Entity Framework Core, database configurations, migrations
- **Trale** (`src/Trale/`): Web API entry point and controllers

## Development Commands

### Building and Running
```bash
# Build the solution
dotnet build TraleBot.sln

# Run the main application
dotnet run --project src/Trale/Trale.csproj

# Build Docker image
docker build -t undermove/tralebot:latest .

# Run with Docker
docker run -p 1402:1402 undermove/tralebot:latest
```

### Testing
```bash
# Run all tests
dotnet test

# Run specific test project
dotnet test tests/Application.UnitTests/
dotnet test tests/Domain.UnitTests/
dotnet test tests/Infrastructure.UnitTests/
dotnet test tests/IntegrationTests/
```

### Local Development Setup
1. Run dependencies: `docker-compose up -f docker-compose.yml -d`
2. Setup ngrok for webhook: `./ngrok http 1403`
3. Create `src/Trale/appsettings.local.json` based on `appsettings.example.json`
4. Run in Visual Studio or Rider

## Key Components

### Bot Commands (`src/Infrastructure/Telegram/BotCommands/`)
- Translation commands for word processing
- Quiz system for learning reinforcement
- Payment and subscription management
- User settings and vocabulary management

### Translation Services (`src/Infrastructure/Translation/`)
- Multiple translation providers: Google API, OpenAI Azure, web scraping services
- Language detection and transcription modules
- Supports English-Russian and English-Georgian translation pairs

### Quiz System (`src/Application/Quizzes/`)
- Different quiz types (multiple choice, type answers)
- Shareable quizzes between users
- Achievement system for user engagement

### Database
- Entity Framework Core with PostgreSQL
- Migrations in `src/Persistence/Migrations/`
- Entities: User, VocabularyEntry, Quiz, QuizQuestion, Achievement, Invoice

## Configuration

Main configuration files:
- `src/Trale/appsettings.json` - Base configuration
- `src/Trale/appsettings.local.json` - Local overrides (create from example)
- `src/Trale/appsettings.example.json` - Configuration template

## Testing Strategy

- **Unit Tests**: Application layer business logic, domain entities, infrastructure parsers
- **Integration Tests**: End-to-end bot command testing with real database
- **Test DSL**: Builder pattern for creating test data (`tests/*/DSL/`)
- **Fakes**: Mock implementations for external services