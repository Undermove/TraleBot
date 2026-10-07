using System.Diagnostics.CodeAnalysis;
using Telegram.Bot;
using Telegram.Bot.Args;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Requests.Abstractions;
#pragma warning disable 67
namespace IntegrationTests.Fakes;

[SuppressMessage("ReSharper", "UnassignedGetOnlyAutoProperty")]
public class TelegramClientFake : ITelegramBotClient
{
	// ReSharper disable once CollectionNeverQueried.Local
	private readonly List<IRequest> _requests = new();

	/// <summary>Everything the bot sent, oldest first.</summary>
	// Concurrent senders (broadcast batches) record here at once: a bare List loses adds.
	public IReadOnlyList<IRequest> Requests { get { lock (_requests) return _requests.ToArray(); } }

	public Task<TResponse> MakeRequestAsync<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = new())
	{
		lock (_requests) _requests.Add(request);
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