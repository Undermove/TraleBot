using Infrastructure.Telegram.CommonComponents;
using Infrastructure.Telegram.Models;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands;

public class HowToCommand(ITelegramBotClient client) : IBotCommand
{
    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(
            commandPayload.Equals(CommandNames.HowTo, StringComparison.InvariantCultureIgnoreCase));
    }

    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        await client.SendTextMessageAsync(
            request.UserTelegramId,
            @"Запоминай новые слова с TraleBot! 🤓

Для этого просто присылай мне в сообщениях слова на русском или незнакомые слова из выбранного тобой языка. Я буду переводить их и сохранять в твоем словаре.

И это все❓

Нет! Со словами из словаря можно проходить небольшие квизы. Так запоминать их намного проще (проверено!). А еще квизы — это чтобы соревноваться в знании иностранных слов с друзьями. Ими можно делиться с кем угодно 🙌

Чтобы начать — просто напиши любое слово в поле для ввода сообщения и отправь его мне. Дальше я разберусь 👌
",
            replyMarkup: MenuKeyboard.GetMenuKeyboard(request.User!.Settings.CurrentLanguage),
            cancellationToken: token);
    }
}