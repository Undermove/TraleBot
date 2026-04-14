using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Common;
using MediatR;

namespace Application.MiniApp.Commands;

public class SetUserLevel : IRequest<SetUserLevelResult>
{
    public required Guid UserId { get; init; }
    public required string Level { get; init; }

    public class Handler(ITraleDbContext dbContext)
        : IRequestHandler<SetUserLevel, SetUserLevelResult>
    {
        public async Task<SetUserLevelResult> Handle(SetUserLevel request, CancellationToken ct)
        {
            if (request.Level != LearningConstants.Levels.Beginner &&
                request.Level != LearningConstants.Levels.Intermediate)
            {
                return new SetUserLevelResult.InvalidLevel();
            }

            var progress = await MiniAppHelpers.LoadOrCreateProgressAsync(dbContext, request.UserId, ct);
            progress.Level = request.Level;
            progress.UpdatedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            return new SetUserLevelResult.Success(request.Level);
        }
    }
}

public abstract record SetUserLevelResult
{
    public record Success(string Level) : SetUserLevelResult;
    public record InvalidLevel : SetUserLevelResult;
}
