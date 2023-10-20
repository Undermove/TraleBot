using Domain.Entities;
using Domain.Quiz;

namespace Application.Quizzes.Services;

public class QuizVocabularyEntriesAdvisor : IQuizVocabularyEntriesAdvisor
{
    const int NotMasteredWordsCount = 3;
    const int MasteredInForwardDirectionCount = 2;
    const int MasteredInBothDirectionsCount = 2;
    
    public ICollection<VocabularyEntry> AdviceVocabularyEntriesForQuiz(ICollection<VocabularyEntry> vocabularyEntries)
    {
        var notMastered = vocabularyEntries.Where(entry => entry.GetMasteringLevel() == MasteringLevel.NotMastered)
            .OrderBy(entry => entry.UpdatedAtUtc)
            .Take(NotMasteredWordsCount)
            .ToArray();
        var masteredInForwardDirection = vocabularyEntries
            .Where(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInForwardDirection)
            .OrderBy(entry => entry.UpdatedAtUtc)
            .Take(MasteredInForwardDirectionCount)
            .ToArray();
        var masteredInBothDirections = vocabularyEntries
            .Where(entry => entry.GetMasteringLevel() == MasteringLevel.MasteredInBothDirections)
            .OrderBy(entry => entry.UpdatedAtUtc)
            .Take(MasteredInBothDirectionsCount)
            .ToArray();
        var entriesForQuiz = notMastered.Concat(masteredInForwardDirection).Concat(masteredInBothDirections).ToList();
        return entriesForQuiz;
    }
}