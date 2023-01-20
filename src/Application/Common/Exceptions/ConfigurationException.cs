namespace Application.Common.Exceptions;

public class ConfigurationException : Exception
{
    public ConfigurationException(string sectionName)
        : base($"Can't find proper configuration for section: \"{sectionName}\"")
    {
    }
}