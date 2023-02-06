# TraleBot
🇬🇧 Bot that helps translate and learn new english words by quiz on every weekend.
Feel free to acquaint yourself with alpha version [here](https://t.me/trale_bot)

1) Enter any word in english or russian and receive translation. 
2) Word and it's definition will be automatically added into vocabulary.

  /menu - open menu </br>
  /quiz - start new quiz </br>
  /stopquiz - stop current quiz </br>
  /vocabulary - open vocabulary </br>
  /help - report here if something wrong </br>
  /start - read bot description </br>

### Build the Docker image
docker build -t undermove/tralebot:latest .

### Run the Docker container
docker run -p 1402:1402 undermove/tralebot:latest

### How to create personal TraleBot
1) Go to https://t.me/BotFather
2) Send /newbot
3) Enter name
4) Enter username
5) Get token
6) Start local debugging

### Local Debugging
1) run docker-compose: up -f docker-compose.yml -d 
2) run Ngrok: ./ngrok http 1403
3) Create appsettings.local.json file with parameters filled by appsettings.example.json
4) Run service in Visual Studio or Rider.