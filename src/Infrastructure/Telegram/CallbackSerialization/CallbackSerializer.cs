using System.Runtime.CompilerServices;
using System.Text;

namespace Infrastructure.Telegram.CallbackSerialization;

public static class CallbackSerializer
{
    public static string Serialize<T>(T callbackData) where T: notnull
    {
        StringBuilder stringBuilder = new StringBuilder();
        var propertyValues = callbackData.GetType().GetProperties().Select(info => info.GetValue(callbackData));
        
        stringBuilder.AppendJoin('|', propertyValues);
        return stringBuilder.ToString();
    }
    
    public static T Deserialize<T>(string callbackData)
    {
        var properties = typeof(T).GetProperties();
        var values = callbackData.Split('|');
        
        var result = RuntimeHelpers.GetUninitializedObject(typeof(T));

        try
        {
            for (int i = 0; i < properties.Length; i++)
            {
                switch (properties[i].PropertyType)
                {
                    case var type when type == typeof(int):
                        properties[i].SetValue(result, int.Parse(values[i]));
                        continue;
                    case var type when type == typeof(long):
                        properties[i].SetValue(result, long.Parse(values[i]));
                        continue;
                    case var type when type == typeof(bool):
                        properties[i].SetValue(result, bool.Parse(values[i]));
                        continue;
                    case var type when type == typeof(Guid):
                        properties[i].SetValue(result, Guid.Parse(values[i]));
                        continue;
                    case var type when type.BaseType == typeof(Enum):
                        properties[i].SetValue(result, Enum.Parse(type, values[i]));
                        continue;
                    default:
                        properties[i].SetValue(result, values[i]);
                        continue;
                }
            }
        }
        catch (FormatException e)
        {
            throw new ArgumentException("Cannot deserialize callback data", e);
        }
        catch (IndexOutOfRangeException e)
        {
            throw new FormatException("Can't find valid count of properties. Optional fields is not supported. It also may occurs because of unsupported separator type", e);
        }

        return (T)result;
    }
}