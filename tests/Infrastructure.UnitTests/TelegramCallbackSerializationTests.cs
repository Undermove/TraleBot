using Infrastructure.Telegram.CallbackSerialization;
using Shouldly;

namespace Infrastructure.UnitTests;

public class TelegramCallbackSerializationTests
{
    [Test]
    public void ShouldSerializeRecord()
    {
        var userId = Guid.NewGuid();
        int messageId = int.MaxValue;
        long chatId = long.MaxValue;
        bool needToDelete = true;
        TestEnum testEnum = TestEnum.Second;
        
        var result = new SomeTelegramCallback
        {
            UserId = userId,
            MessageId = messageId,
            ChatId = chatId,
            NeedToDelete = needToDelete,
            TestEnum = testEnum
        }.Serialize();
        
        result.ShouldBe($"command|{userId}|{messageId}|{chatId}|{needToDelete}|{testEnum}");
    }
    
    [Test]
    public void ShouldDeserializeRecord()
    {
        var userId = Guid.NewGuid();
        int messageId = int.MaxValue;
        long chatId = long.MaxValue;
        bool needToDelete = true;
        TestEnum testEnum = TestEnum.Second;
        
        SomeTelegramCallback result = $"command|{userId}|{messageId}|{chatId}|{needToDelete}|{testEnum}"
            .Deserialize<SomeTelegramCallback>();

        result.CommandName.ShouldBe("command");
        result.UserId.ShouldBe(userId);
        result.MessageId.ShouldBe(messageId);
        result.ChatId.ShouldBe(chatId);
        result.NeedToDelete.ShouldBe(needToDelete);
        result.TestEnum.ShouldBe(testEnum);
    }
    
    [Test]
    public void ShouldThrowExceptionWhenTypeCannotBeDeserialized()
    {
        var userId = Guid.NewGuid();
        
        Should.Throw<ArgumentException>(() => $"command|{userId}|asdfdsfsdf".Deserialize<SomeTelegramCallback>())
            .Message.ShouldBe("Cannot deserialize callback data");
    }
    
    [Test]
    public void ShouldThrowExceptionWhenSeparatorIncorrect()
    {
        var userId = Guid.NewGuid();
        
        Should.Throw<FormatException>(() => $"command;{userId};asdfdsfsdf".Deserialize<SomeTelegramCallback>())
            .Message.ShouldBe("Can't find valid count of properties. Optional fields is not supported. It also may occurs because of unsupported separator type");
    }
}

public class SomeTelegramCallback
{
    public string CommandName => "command";
    public Guid UserId { get; init; }
    public int MessageId { get; init; }
    public long ChatId { get; init; }
    public bool NeedToDelete { get; init; }
    public TestEnum TestEnum { get; init; }
}

public enum TestEnum
{
    First,
    Second
}