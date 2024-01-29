using Application.Common.Interfaces.TranslationService;
using Application.Translation.Languages;
using Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Translation;

public class GeorgianTranslationModuleShould
{
    private GeorgianTranslationModule _sut = null!;
    private Mock<IParsingUniversalTranslator> _parsingUniversalTranslator = null!;
    private Mock<IGoogleApiTranslator> _googleTranslationService = null!;
    private Mock<ILoggerFactory> _loggerFactory = null!;

    [SetUp]
    public void SetUp()
    {
        var mockRepository = new MockRepository(MockBehavior.Strict);
        _parsingUniversalTranslator = mockRepository.Create<IParsingUniversalTranslator>();
        _googleTranslationService = mockRepository.Create<IGoogleApiTranslator>();
        _loggerFactory = mockRepository.Create<ILoggerFactory>(MockBehavior.Loose);
        _loggerFactory.Setup(x => x.CreateLogger(nameof(GeorgianTranslationModule))).Returns(() => NullLogger.Instance);
        _sut = new GeorgianTranslationModule(_parsingUniversalTranslator.Object, _googleTranslationService.Object, _loggerFactory.Object);
    }

    [Test]
    public async Task ReturnTranslationFromParsingTranslator_WhenExists()
    {
        _parsingUniversalTranslator.Setup(x => x.TranslateAsync("слива", Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success("ქლიავი", "", ""));
        _googleTranslationService.Setup(x => x.TranslateAsync("слива", Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Failure());
        
        var result = await _sut.Translate("слива", CancellationToken.None);

        result.ShouldBeOfType<TranslationResult.Success>();
        var casted = result as TranslationResult.Success;
        casted?.Definition.ShouldBe("ქლიავი");
    }
    
    [Test]
    public async Task ReturnTranslationFromGoogleApiTranslator_WhenExistsAndUniversalParserFailure()
    {
        _parsingUniversalTranslator.Setup(x => x.TranslateAsync("слива", Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Failure());
        _googleTranslationService.Setup(x => x.TranslateAsync("слива", Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success("ქლიავი", "", ""));
        
        var result = await _sut.Translate("слива", CancellationToken.None);

        result.ShouldBeOfType<TranslationResult.Success>();
        var casted = result as TranslationResult.Success;
        casted?.Definition.ShouldBe("ქლიავი");
    }
    
    [Test]
    public async Task ReturnTranslationFailure_WhenTranslationNotExistsInAllTranslators()
    {
        _parsingUniversalTranslator.Setup(x => x.TranslateAsync("слива", Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Failure());
        _googleTranslationService.Setup(x => x.TranslateAsync("слива", Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Failure());
        
        var result = await _sut.Translate("слива", CancellationToken.None);

        result.ShouldBeOfType<TranslationResult.Failure>();
    }
    
    [Test]
    public async Task ReturnTranslation_WhenFirstTranslatorThrowError_AndSecondTranslatorWorksCorrectly()
    {
        _parsingUniversalTranslator.Setup(x => x.TranslateAsync("слива", Language.Georgian, It.IsAny<CancellationToken>()))
            .Throws<Exception>();
        _googleTranslationService.Setup(x => x.TranslateAsync("слива", Language.Georgian, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success("ქლიავი", "", ""));
        
        var result = await _sut.Translate("слива", CancellationToken.None);

        result.ShouldBeOfType<TranslationResult.Success>();
        var casted = result as TranslationResult.Success;
        casted?.Definition.ShouldBe("ქლიავი");
    }
    
    [Test]
    public async Task ReturnTranslationFailure_WhenBothTranslatorsThrowsException()
    {
        _parsingUniversalTranslator.Setup(x => x.TranslateAsync("слива", Language.Georgian, It.IsAny<CancellationToken>()))
            .Throws<Exception>();
        _googleTranslationService.Setup(x => x.TranslateAsync("слива", Language.Georgian, It.IsAny<CancellationToken>()))
            .Throws<Exception>();
        
        var result = await _sut.Translate("слива", CancellationToken.None);

        result.ShouldBeOfType<TranslationResult.Failure>();
    }
}