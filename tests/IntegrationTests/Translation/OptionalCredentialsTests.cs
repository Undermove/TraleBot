using Application.Common.Interfaces.TranslationService;
using Application.Translation.Languages;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Translation.GoogleTranslation;
using Infrastructure.Translation.OpenAiTranslation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace IntegrationTests.Translation;

/// <summary>
/// Google and OpenAI credentials are optional. Every translation request constructs both clients'
/// owners; a missing or broken credential must switch off that one translator, not throw on construction.
/// </summary>
public class OptionalCredentialsTests
{
    private static T Bind<T>(string section, string key, string? value) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { [$"{section}:{key}"] = value })
            .Build().GetSection(section).Get<T>()!;

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    [TestCase("not base64 at all")]
    [TestCase("bm90IGpzb24=")] // base64 of text that is not a credentials JSON
    public async Task Google_translator_without_usable_credentials_answers_failure_instead_of_throwing(string? credentials)
    {
        var config = credentials == null
            ? Options.Create<GoogleApiConfig>(null!)
            : Options.Create(Bind<GoogleApiConfig>(GoogleApiConfig.Name, "ApiKeyBase64", credentials));

        var translator = new GoogleApiTranslator(config);
        var result = await translator.TranslateAsync("стол", Language.Georgian, CancellationToken.None);

        result.Should().BeOfType<TranslationResult.Failure>();
    }

    [TestCase(null)]
    [TestCase("")]
    public async Task OpenAi_translator_without_a_key_answers_failure_instead_of_throwing(string? key)
    {
        var config = key == null
            ? Options.Create<OpenAiConfig>(null!)
            : Options.Create(Bind<OpenAiConfig>(OpenAiConfig.Name, "ApiKey", key));

        var service = new OpenAiAzureTranslationService(config);
        var result = await service.TranslateAsync("table", Language.English, CancellationToken.None);

        result.Should().BeOfType<TranslationResult.Failure>();
    }

    [Test]
    public void Learner_sees_a_cyrillic_transcription()
    {
        // The word is the title of the recorded Wiktionary page — Georgian comes from data.
        var word = FakeWiktionaryHandler.TitleOf(FakeWiktionaryHandler.Fixture("wiktionary-paint.json"));

        var transcription = GeorgianTranscriptionExtension.GetTranscription(word);

        transcription.Should().MatchRegex("^[а-яё’]+$");
        GeorgianTranscriptionExtension.GetTranscription("стол, 12").Should().Be("стол, 12", because: "anything that is not Georgian stays as it is");
    }
}
