FROM mcr.microsoft.com/dotnet/sdk:7.0

WORKDIR /app
COPY . .

RUN dotnet restore
RUN dotnet publish -c Release -o out

EXPOSE 1402
ENTRYPOINT ["dotnet", "out/Trale.dll"]