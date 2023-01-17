# TraleBot
🇬🇧 Bot that helps translate and learn new english words by quiz on every weekend.
Feel free to acquaint yourself with alpha version [here](https://t.me/trale_bot)

1) Enter any word in english or russian and receive translation. 
2) Word and it's definition will be automatically added into vocabulary.

  /start - read info about bot ℹ️</br>
  /quiz - start new quiz for last week words❓</br>
  /stopquiz - stop current quiz. This might be useful when you whoud to add new word right in the middle of quiz 😉</br>

# Build the Docker image
docker build -t undermove/tralebot:latest .

# Run the Docker container
docker run -p 1402:1402 undermove/tralebot:latest
