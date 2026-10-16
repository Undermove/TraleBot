using System.Linq;
using Application.Verbs;
using Shouldly;

namespace Application.UnitTests.Translation;

public class ObjectPersonTests
{
    private static string[][] Row(params string[] cells) => cells.Select(c => new[] { c }).ToArray();

    // The catalog's «видеть» and the agent's «искать» (16.10.2026): the same cases as whoWhom/logic.test.ts.
    private static readonly string[][] See = Row("ვხედავ", "ხედავ", "ხედავს", "ვხედავთ", "ხედავთ", "ხედავენ");
    private static readonly string[][] SawAorist = Row("დავინახე", "დაინახე", "დაინახა", "დავინახეთ", "დაინახეთ", "დაინახეს");
    private static readonly string[][] Search = Row("ვეძებ", "ეძებ", "ეძებს", "ვეძებთ", "ეძებთ", "ეძებენ");

    [TestCase(1, "me", "მხედავ")]
    [TestCase(0, "you", "გხედავ")]
    [TestCase(2, "us", "გვხედავს")]
    [TestCase(2, "youpl", "გხედავთ")]
    [TestCase(5, "youpl", "გხედავენ")]
    public void Mark_of_whom_takes_the_place_of_the_v_of_I(int who, string whom, string form) =>
        ObjectPerson.Form(See, who, whom).ShouldBe(form);

    [Test]
    public void Mark_goes_after_the_preverb()
    {
        ObjectPerson.Form(SawAorist, 2, "me").ShouldBe("დამინახა");
        ObjectPerson.Form(Search, 0, "you").ShouldBe("გეძებ");
    }

    [Test]
    public void Row_the_rule_does_not_fit_gives_nothing() =>
        ObjectPerson.Form(Row("მიყვარს", "გიყვარს", "უყვარს", "გვიყვარს", "გიყვართ", "უყვართ"), 1, "me").ShouldBeNull();

    [Test]
    public void Case_is_one_of_three() =>
        new[] { ObjectPerson.Case(" ACC "), ObjectPerson.Case("with"), ObjectPerson.Case("gen") }.ShouldBe(new[] { "acc", "with", null });
}
