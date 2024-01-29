using Application.Common.Interfaces.TranslationService;
using Application.Translation.Languages;
using Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Application.UnitTests.Translation;

public class EnglishTranslationModuleShould
{
    private EnglishTranslationModule _sut = null!;
    private Mock<IParsingEnglishTranslator> _parsingEnglishTranslator = null!;
    private Mock<IAiTranslationService> _aiTranslationService = null!;
    private Mock<ILoggerFactory> _loggerFactory = null!;

    [SetUp]
    public void SetUp()
    {
        var mockRepository = new MockRepository(MockBehavior.Strict);
        _parsingEnglishTranslator = mockRepository.Create<IParsingEnglishTranslator>();
        _aiTranslationService = mockRepository.Create<IAiTranslationService>();
        _loggerFactory = mockRepository.Create<ILoggerFactory>(MockBehavior.Loose);
        _loggerFactory.Setup(x => x.CreateLogger(nameof(EnglishTranslationModule))).Returns(() => NullLogger.Instance);
        _sut = new EnglishTranslationModule(_parsingEnglishTranslator.Object, _aiTranslationService.Object, _loggerFactory.Object);
    }

    [Test]
    public async Task ReturnTranslationFromParsingTranslator_WhenExists()
    {
        _parsingEnglishTranslator.Setup(x => x.TranslateAsync("слива", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success("plum", "", ""));
        _aiTranslationService.Setup(x => x.TranslateAsync("слива", Language.English, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Failure());
        
        var result = await _sut.Translate("слива", CancellationToken.None);

        result.ShouldBeOfType<TranslationResult.Success>();
        var casted = result as TranslationResult.Success;
        casted?.Definition.ShouldBe("plum");
    }
    
    [Test]
    public async Task ReturnTranslationFromAiTranslator_WhenExistsAndEnglishParserFailure()
    {
        _parsingEnglishTranslator.Setup(x => x.TranslateAsync("слива", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Failure());
        _aiTranslationService.Setup(x => x.TranslateAsync("слива", Language.English, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success("plum", "", ""));
        
        var result = await _sut.Translate("слива", CancellationToken.None);

        result.ShouldBeOfType<TranslationResult.Success>();
        var casted = result as TranslationResult.Success;
        casted?.Definition.ShouldBe("plum");
    }
    
    [Test]
    public async Task ReturnTranslationFailure_WhenTranslationNotExistsInAllTranslators()
    {
        _parsingEnglishTranslator.Setup(x => x.TranslateAsync("слива", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Failure());
        _aiTranslationService.Setup(x => x.TranslateAsync("слива", Language.English, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Failure());
        
        var result = await _sut.Translate("слива", CancellationToken.None);

        result.ShouldBeOfType<TranslationResult.Failure>();
    }
    
    [Test]
    public async Task ReturnTranslation_WhenFirstTranslatorThrowError_AndSecondTranslatorWorksCorrectly()
    {
        _parsingEnglishTranslator.Setup(x => x.TranslateAsync("слива", It.IsAny<CancellationToken>()))
            .Throws<Exception>();
        _aiTranslationService.Setup(x => x.TranslateAsync("слива", Language.English, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TranslationResult.Success("plum", "", ""));
        
        var result = await _sut.Translate("слива", CancellationToken.None);

        result.ShouldBeOfType<TranslationResult.Success>();
        var casted = result as TranslationResult.Success;
        casted?.Definition.ShouldBe("plum");
    }
    
    [Test]
    public async Task ReturnTranslationFailure_WhenBothTranslatorsThrowsException()
    {
        _parsingEnglishTranslator.Setup(x => x.TranslateAsync("слива", It.IsAny<CancellationToken>()))
            .Throws<Exception>();
        _aiTranslationService.Setup(x => x.TranslateAsync("слива", Language.English, It.IsAny<CancellationToken>()))
            .Throws<Exception>();
        
        var result = await _sut.Translate("слива", CancellationToken.None);

        result.ShouldBeOfType<TranslationResult.Failure>();
    }
}