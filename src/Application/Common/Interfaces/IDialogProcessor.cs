namespace Application.Common.Interfaces;

public interface IDialogProcessor
{
    Task ProcessCommand<T>(T request, CancellationToken cancellationToken);
}