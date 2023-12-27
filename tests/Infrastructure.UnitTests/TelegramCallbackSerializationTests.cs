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
        
        var result = CallbackSerializer.Serialize(new SomeTelegramCallback(
            "command",
            userId,
            messageId,
            chatId,
            needToDelete, 
            testEnum));
        
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
        
        SomeTelegramCallback result = CallbackSerializer
            .Deserialize<SomeTelegramCallback>($"command|{userId}|{messageId}|{chatId}|{needToDelete}|{testEnum}");

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
        
        Should.Throw<ArgumentException>(() => CallbackSerializer.Deserialize<SomeTelegramCallback>($"command|{userId}|asdfdsfsdf"))
            .Message.ShouldBe("Cannot deserialize callback data");
    }
    
    [Test]
    public void ShouldThrowExceptionWhenSeparatorIncorrect()
    {
        var userId = Guid.NewGuid();
        
        Should.Throw<FormatException>(() => CallbackSerializer.Deserialize<SomeTelegramCallback>($"command;{userId};asdfdsfsdf"))
            .Message.ShouldBe("Can't find valid count of properties. Optional fields is not supported. It also may occurs because of unsupported separator type");
    }
}

public record SomeTelegramCallback(
    string CommandName, 
    Guid UserId,
    int MessageId,
    long ChatId,
    bool NeedToDelete,
    TestEnum TestEnum);
    
public enum TestEnum
{
    First,
    Second
}