FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
COPY . ./app
COPY /src/Trale/appsettings.json .
WORKDIR /app/
RUN dotnet build -c Release -o output

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
COPY --from=build /app/output .
EXPOSE 1402
ENTRYPOINT ["dotnet", "Trale.dll"]