---
description: Repository Information Overview
alwaysApply: true
---

# TraleBot Repository Information

## Summary
TraleBot is a Telegram bot application built with .NET 8 and ASP.NET Core that helps users translate words and learn English through interactive quizzes. The project uses clean architecture principles with layered organization (Domain, Application, Infrastructure, Persistence). Users can submit English or Russian words to receive translations, and words are automatically added to their personal vocabulary. The bot sends weekly quizzes to reinforce learning. A landing page component provides information about the bot.

## Repository Structure
The repository follows a clean architecture pattern with the following main components:

- **src/Trale**: Main ASP.NET Core web service entry point and API layer
- **src/Domain**: Core business logic and domain entities with no external dependencies
- **src/Application**: Application services layer using MediatR for CQRS pattern
- **src/Infrastructure**: External service integrations (Telegram Bot, translation APIs, monitoring)
- **src/Persistence**: Database access layer using Entity Framework Core
- **tests**: Comprehensive test suite with unit and integration tests
- **Landing**: Static landing page for the bot
- **deploy**: Docker Compose configurations for local, production, and monitoring deployments

## Language & Runtime
**Language**: C# (LangVersion 12)
**Runtime**: .NET 8.0
**SDK**: Microsoft.NET.Sdk.Web (ASP.NET Core)
**Target Framework**: net8.0

## Key Dependencies
**Core Framework**:
- Microsoft.AspNetCore.Mvc.NewtonsoftJson 8.0.7
- Microsoft.EntityFrameworkCore 8.0.7
- MediatR 12.3.0

**Database & ORM**:
- Npgsql.EntityFrameworkCore.PostgreSQL 8.0.4
- Microsoft.EntityFrameworkCore.Proxies 8.0.7
- Microsoft.EntityFrameworkCore.InMemory 8.0.7 (testing)

**Telegram Integration**:
- Telegram.Bot 19.0.0

**AI & Translation**:
- Google.Cloud.Translation.V2 3.4.0
- OpenAI 2.0.0

**Monitoring & Logging**:
- Serilog.AspNetCore 8.0.1
- Serilog.Sinks.Grafana.Loki 8.3.0
- OpenTelemetry.Instrumentation.AspNetCore 1.9.0
- Prometheus.Client.AspNetCore 5.0.0
- NEST 7.17.5

**Testing**:
- NUnit 4.0.1+
- Moq 4.18.4
- Shouldly 4.2.1
- FluentAssertions 6.12.0
- Testcontainers.PostgreSql 3.9.0

## Build & Installation
```bash
# Restore dependencies
dotnet restore

# Build solution
dotnet build -c Release

# Build Docker image
docker build -t undermove/tralebot:latest .

# Local development setup
docker-compose -f docker-compose-local.yml up -d
# Then run Trale project in Visual Studio/Rider

# Run with Docker
docker run -p 1402:1402 undermove/tralebot:latest
```

## Docker Configuration
**Dockerfile**: Dockerfile (multi-stage build)
**Build Stage**: Uses mcr.microsoft.com/dotnet/sdk:8.0
**Runtime Stage**: Uses mcr.microsoft.com/dotnet/aspnet:8.0
**Exposed Port**: 1402
**Entrypoint**: dotnet Trale.dll

**Docker Compose Files**:
- docker-compose-local.yml: PostgreSQL for local development
- deploy/docker-compose.yml: Production deployment
- deploy/docker-compose-db.yml: Database services
- deploy/docker-compose-prometheus.yml: Monitoring stack

## Main Files & Resources
**Entry Points**:
- src/Trale/Trale.csproj: Main ASP.NET Core application

**Configuration Files**:
- src/Trale/appsettings.json: Application settings
- src/Trale/appsettings.local.json: Local development overrides (example provided)
- TraleBot.sln: Solution file

**Database**:
- src/Persistence/Migrations/: Entity Framework migrations
- PostgreSQL (Npgsql connection via EF Core)

**Infrastructure**:
- deploy/postgres.yml: PostgreSQL configuration
- deploy/loki.yaml: Log aggregation setup
- .github/workflows/: CI/CD deployment pipelines

## Testing
**Framework**: NUnit 4.0.1+ with Test Adapters
**Test Projects**: 
- tests/Domain.UnitTests/
- tests/Application.UnitTests/
- tests/Infrastructure.UnitTests/
- tests/IntegrationTests/

**Testing Tools**:
- NUnit3TestAdapter 4.5.0
- Moq 4.18.4 (mocking)
- Shouldly 4.2.1 (assertions)
- FluentAssertions 6.12.0 (integration tests)
- Testcontainers 3.9.0 (PostgreSQL containers for integration tests)

**Test File Naming**: [Module].UnitTests.csproj or IntegrationTests.csproj

**Run Tests**:
```bash
# Run all tests
dotnet test

# Run specific test project
dotnet test tests/Domain.UnitTests/Domain.UnitTests.csproj

# Run integration tests
dotnet test tests/IntegrationTests/IntegrationTests.csproj

# Run with coverage
dotnet test /p:CollectCoverage=true
```

## Local Development
**Requirements**:
- .NET 8.0 SDK
- Visual Studio 2022 / JetBrains Rider
- Docker & Docker Compose
- PostgreSQL (via Docker)
- Ngrok (for local webhook testing)

**Setup Steps**:
1. Clone repository
2. Run: `docker-compose -f docker-compose-local.yml up -d`
3. Create appsettings.local.json from appsettings.example.json
4. Run Trale project in IDE
5. Use Ngrok to expose localhost for Telegram webhooks

**Telegram Bot Setup**:
1. Contact @BotFather on Telegram
2. Send /newbot command
3. Enter bot name and username
4. Save token to appsettings.local.json
