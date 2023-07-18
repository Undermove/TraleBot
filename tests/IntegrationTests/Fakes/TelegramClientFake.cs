using System.Diagnostics.CodeAnalysis;
using Telegram.Bot;
using Telegram.Bot.Args;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Requests.Abstractions;

namespace IntegrationTests.Fakes;

[SuppressMessage("ReSharper", "UnassignedGetOnlyAutoProperty")]
public class TelegramClientFake : ITelegramBotClient
{
	private readonly List<IRequest> _requests = new();

	public Task<TResponse> MakeRequestAsync<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = new())
	{
		_requests.Add(request);
		return Task.FromResult(default(TResponse)!);
	}

	public Task<bool> TestApiAsync(CancellationToken cancellationToken = new())
	{
		throw new NotImplementedException();
	}

	public Task DownloadFileAsync(string filePath, Stream destination,
		CancellationToken cancellationToken = new())
	{
		throw new NotImplementedException();
	}

	public bool LocalBotServer { get; }
	
	public long? BotId { get; }
	public TimeSpan Timeout { get; set; }
	public IExceptionParser ExceptionsParser { get; set; } = null!;
	public event AsyncEventHandler<ApiRequestEventArgs>? OnMakingApiRequest;
	public event AsyncEventHandler<ApiResponseEventArgs>? OnApiResponseReceived;
}