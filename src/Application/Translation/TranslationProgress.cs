namespace Application.Translation;

/// <summary>
/// Where a translation request is, for whoever shows the person that work is going on. The order is the
/// order of the ladder in <c>GeorgianTranslationPipeline</c>; a request skips the steps it does not need.
/// </summary>
public enum TranslationStage
{
    /// <summary>Nothing has been reported yet.</summary>
    Started = 0,

    /// <summary>The verb base and the cache are being looked at — no model, no network.</summary>
    Base,

    /// <summary>The classifier is asked what kind of text this is.</summary>
    Recognizing,

    /// <summary>A verb the base does not have is looked up in the open sources (lexicon, Wiktionary).</summary>
    VerbSource,

    /// <summary>No table anywhere: the strong model is writing the verb's forms.</summary>
    VerbForms,

    /// <summary>The second model is checking what was written.</summary>
    VerbReview,

    /// <summary>The translator that was here before (dictionary site, then Google) is asked.</summary>
    Dictionaries,

    /// <summary>The answer is there and is being stored.</summary>
    Saving
}

/// <summary>Where the pipeline tells how far a request has got. Nobody listening is the normal case.</summary>
public interface ITranslationProgress
{
    void Report(TranslationStage stage);
}

/// <summary>
/// Keeps the furthest stage reported. It never goes back: a repair round of the generator after a
/// review, or the old translator after a rejected verb, do not make the person see "an earlier step".
/// Written by the request that translates, read by the requests that ask how it is going.
/// </summary>
public sealed class TranslationProgress : ITranslationProgress
{
    private int _stage;

    public TranslationStage Stage => (TranslationStage)Volatile.Read(ref _stage);

    public void Report(TranslationStage stage)
    {
        int seen;
        while ((seen = Volatile.Read(ref _stage)) < (int)stage
               && Interlocked.CompareExchange(ref _stage, (int)stage, seen) != seen)
        {
        }
    }

    /// <summary>The stage as the mini-app gets it.</summary>
    public static string Key(TranslationStage stage) => stage switch
    {
        TranslationStage.Base => "base",
        TranslationStage.Recognizing => "recognizing",
        TranslationStage.VerbSource => "verb-source",
        TranslationStage.VerbForms => "verb-forms",
        TranslationStage.VerbReview => "verb-review",
        TranslationStage.Dictionaries => "dictionaries",
        TranslationStage.Saving => "saving",
        _ => "started"
    };
}
