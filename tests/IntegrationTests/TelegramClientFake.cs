using Telegram.Bot;
using Telegram.Bot.Args;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Requests.Abstractions;

namespace IntegrationTests;

public class TelegramClientFake : ITelegramBotClient
{
	public Task<TResponse> MakeRequestAsync<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = new CancellationToken())
	{
		return Task.FromResult(default(TResponse)!);
	}

	public Task<bool> TestApiAsync(CancellationToken cancellationToken = new CancellationToken())
	{
		throw new NotImplementedException();
	}

	public Task DownloadFileAsync(string filePath, Stream destination,
		CancellationToken cancellationToken = new CancellationToken())
	{
		throw new NotImplementedException();
	}

	public bool LocalBotServer { get; }
	public long? BotId { get; }
	public TimeSpan Timeout { get; set; }
	public IExceptionParser ExceptionsParser { get; set; }
	public event AsyncEventHandler<ApiRequestEventArgs>? OnMakingApiRequest;
	public event AsyncEventHandler<ApiResponseEventArgs>? OnApiResponseReceived;
}