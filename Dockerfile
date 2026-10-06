# Stage 1: build the Vite/React mini-app and emit it into src/Trale/wwwroot/
# We recreate the same relative path layout as the repo so that the vite
# build's `outDir: '../wwwroot'` resolves to /build/src/Trale/wwwroot.
FROM node:20-alpine AS webapp-build
WORKDIR /build/src/Trale/miniapp-src
COPY src/Trale/miniapp-src/package.json src/Trale/miniapp-src/package-lock.json* ./
RUN npm ci
COPY src/Trale/miniapp-src/ ./
RUN npm run build

# Stage 1b: static SEO pages (verbs, phrasebook, words, grammar) → same wwwroot, alongside the SPA.
# Pure HTML generated at build time from site/content and from the repo data below; owns sitemap.xml.
# See site/README.md. The data files are read, never executed (paths: DATA_FILES in site/build.mjs).
WORKDIR /build/site
COPY site/package.json site/package-lock.json ./
RUN npm ci
COPY site/ ./
COPY src/Trale/Verbs/verbs.json /build/src/Trale/Verbs/verbs.json
COPY src/Trale/MiniApp/MiniAppContentProvider.cs /build/src/Trale/MiniApp/MiniAppContentProvider.cs
COPY src/Trale/Lessons/ /build/src/Trale/Lessons/
RUN npm run build

# Stage 2: build the .NET solution, pulling in the freshly built static assets
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app
COPY . ./
COPY /src/Trale/appsettings.json .
# Replace wwwroot with the built SPA bundle from the webapp stage
RUN rm -rf src/Trale/wwwroot
COPY --from=webapp-build /build/src/Trale/wwwroot ./src/Trale/wwwroot
# Copy pre-generated TTS audio files into the static assets tree (Refs #542)
COPY src/Trale/audio ./src/Trale/wwwroot/audio
RUN dotnet publish src/Trale/Trale.csproj -c Release -o output

# Stage 3: runtime — ASP.NET Core serves the API + the SPA bundle from wwwroot
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/output .
EXPOSE 1402
ENTRYPOINT ["dotnet", "Trale.dll"]
