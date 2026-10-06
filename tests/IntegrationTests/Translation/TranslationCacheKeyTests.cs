using Application.Translation.Cache;
using FluentAssertions;

namespace IntegrationTests.Translation;

public class TranslationCacheKeyTests
{
    [TestCase("привет", "привет")]
    [TestCase("Привет", "привет")]
    [TestCase("  привет  ", "привет")]
    [TestCase("привет!", "привет")]
    [TestCase("«Привет»", "привет")]
    [TestCase("\"привет\"?..", "привет")]
    [TestCase("доброе   утро", "доброе утро")]
    [TestCase("доброе\tутро\n", "доброе утро")]
    [TestCase("Ещё", "еще")]
    [TestCase("еще", "еще")]
    public void Spellings_of_one_lookup_share_one_key(string text, string expected)
    {
        TranslationCacheKey.Normalize(text).Should().Be(expected);
    }

    [Test]
    public void Punctuation_inside_the_text_is_part_of_it()
    {
        TranslationCacheKey.Normalize("Кто-то").Should().Be("кто-то");
        TranslationCacheKey.Normalize("да, конечно!").Should().Be("да, конечно");
    }

    [Test]
    public void Precomposed_and_combining_spellings_of_a_letter_are_one_key()
    {
        var precomposed = "й"; // й
        var combining = "й"; // и + breve

        TranslationCacheKey.Normalize("мо" + combining).Should().Be(TranslationCacheKey.Normalize("мо" + precomposed));
    }

    [Test]
    public void Georgian_has_no_case_and_is_kept_as_typed()
    {
        var word = FakeWiktionaryHandler.TitleOf(FakeWiktionaryHandler.Fixture("wiktionary-paint.json"));

        TranslationCacheKey.Normalize($" {word}. ").Should().Be(word);
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    [TestCase("?!")]
    public void Nothing_to_look_up_gives_no_key(string? text)
    {
        TranslationCacheKey.Normalize(text).Should().BeNull();
    }

    [Test]
    public void Text_longer_than_the_key_column_is_not_cached()
    {
        TranslationCacheKey.Normalize(new string('а', TranslationCacheKey.MaxLength)).Should().NotBeNull();
        TranslationCacheKey.Normalize(new string('а', TranslationCacheKey.MaxLength + 1)).Should().BeNull();
    }
}
