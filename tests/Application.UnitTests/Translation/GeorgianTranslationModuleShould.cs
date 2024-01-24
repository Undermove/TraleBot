using Application.Common.Interfaces.TranslationService;
using Application.Translation.Languages;
using Moq;

namespace Application.UnitTests.Translation;

public class GeorgianTranslationModuleShould
{
    private GeorgianTranslationModule _sut = null!;

    [SetUp]
    public void SetUp()
    {
        MockRepository mockRepository = new MockRepository(MockBehavior.Strict);
        Mock<IParsingUniversalTranslator> parsingUniversalTranslator = mockRepository.Create<IParsingUniversalTranslator>();
        Mock<IGoogleApiTranslator> googleTranslationService = mockRepository.Create<IGoogleApiTranslator>();
        _sut = new GeorgianTranslationModule(parsingUniversalTranslator.Object, googleTranslationService.Object);
    }

    [Test]
    public void ReturnTranslationFromParsingTranslator_WhenExists()
    {
        
    }
    
    [Test]
    public void ReturnTranslationFromGoogleApiTranslator_WhenExists()
    {
        
    }
    
    [Test]
    public void ReturnTranslationFailure_WhenTranslationNotExistsInAllTranslators()
    {
        
    }
    
    [Test]
    public void ReturnTranslation_FirstTranslatorThrowError_AndSecondTranslatorWorksCorrectlyException()
    {
        
    }
    
    [Test]
    public void ReturnTranslationFailure_WhenBothTranslatorsThrowsException()
    {
        
    }
}