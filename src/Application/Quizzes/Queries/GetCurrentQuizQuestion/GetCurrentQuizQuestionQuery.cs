using Application.Common;
using Domain.Entities;
using MediatR;

namespace Application.Quizzes.Queries.GetCurrentQuizQuestion;

public class GetCurrentQuizQuestionQuery : IRequest<QuizQuestion?>
{
	public required Guid QuizQuestionId { get; init; }

	// ReSharper disable once UnusedType.Global
	public class Handler : IRequestHandler<GetCurrentQuizQuestionQuery, QuizQuestion?>
	{
		private readonly ITraleDbContext _context;

		public Handler(ITraleDbContext context)
		{
			_context = context;
		}

		public async Task<QuizQuestion?> Handle(GetCurrentQuizQuestionQuery request, CancellationToken ct)
		{
			var quizQuestion = await _context.QuizQuestions.FindAsync(request.QuizQuestionId, ct);
			return quizQuestion;
		}
	}
}