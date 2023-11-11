using Domain.Entities;
using Infrastructure.Translation;
using Moq;
using Shouldly;

namespace Infrastructure.UnitTests;

public class TemporaryTestsForGlosbeParser
{
    private GlosbeParsingTranslationService _glosbeTranslationService = null!;

    [SetUp]
    public void Setup()
    {
        var clientFactory = new Mock<IHttpClientFactory>();
        clientFactory.Setup(factory => factory.CreateClient(It.IsAny<string>()))
            .Returns(() => new HttpClient());
        _glosbeTranslationService = new GlosbeParsingTranslationService(clientFactory.Object);
    }

    [Test]
    public async Task CheckSlivaTranslation()
    {
        var result = await _glosbeTranslationService.TranslateAsync("слива", Language.Georgian, CancellationToken.None);

        result.IsSuccessful.ShouldBeTrue();
        result.Definition.ShouldBe("ქლიავი");
        result.AdditionalInfo.ShouldBe("ქლიავი, საჭურისი, კურკისგან დაცლილი ხილი, გამომშრალი ხილი");
        result.Example.ShouldBe("");
    }
    
    [Test]
    public async Task CheckBackwardSlivaTranslation()
    {
        var result = await _glosbeTranslationService.TranslateAsync("ქლიავი", Language.Georgian, CancellationToken.None);

        result.IsSuccessful.ShouldBeTrue();
        result.Definition.ShouldBe("слива");
        result.AdditionalInfo.ShouldBe("слива");
        result.Example.ShouldBe("");
    }
    
    [Test]
    public async Task CheckBumagaTranslation()
    {
        var result = await _glosbeTranslationService.TranslateAsync("бумага", Language.Georgian, CancellationToken.None);

        result.IsSuccessful.ShouldBeTrue();
        result.Definition.ShouldBe("ქაღალდი");
        result.AdditionalInfo.ShouldBe("ქაღალდი");
        result.Example.ShouldBe("შემდეგ ერთი დიდი წიგნი და მრავალი სხვა ქაღალდი მოგვცეს და დაგვავალეს, ყოველივე ეს სონიას გაწერამდე წაგვეკითხა და შეგვესწავლა.");
    }
    
    [Test]
    public async Task CheckBumagaBackwardTranslation()
    {
        var result = await _glosbeTranslationService.TranslateAsync("ქაღალდი", Language.Georgian, CancellationToken.None);

        result.IsSuccessful.ShouldBeTrue();
        result.Definition.ShouldBe("бумага");
        result.AdditionalInfo.ShouldBe("бумага");
        result.Example.ShouldBe("შემდეგ ერთი დიდი წიგნი და მრავალი სხვა ქაღალდი მოგვცეს და დაგვავალეს, ყოველივე ეს სონიას გაწერამდე წაგვეკითხა და შეგვესწავლა.");
    }
        
    [Test]
    public async Task CheckWordWithTypoBackwardTranslation()
    {
        var result = await _glosbeTranslationService.TranslateAsync("ჩვრნი", Language.Georgian, CancellationToken.None);

        result.IsSuccessful.ShouldBeFalse();
    }
}