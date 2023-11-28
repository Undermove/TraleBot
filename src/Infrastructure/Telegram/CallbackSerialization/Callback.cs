using System.Text;

namespace Infrastructure.Telegram.CallbackSerialization;

public static class Callback
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
        
        var result = Activator.CreateInstance<T>();
        
        for (int i = 0; i < properties.Length; i++)
        {
            properties[i].SetValue(result, values[i]);
        }

        return result;
    }
}