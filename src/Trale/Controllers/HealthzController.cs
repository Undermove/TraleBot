using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace Trale.Controllers;

[Route("healthz")]
public class HealthzController : Controller
{
    private readonly string _myValue;

    public HealthzController(IConfiguration config)
    {
        _myValue = config.GetConnectionString("Test");
    }
    
    [HttpGet]
    public IActionResult Get()
    {
        return Ok();
    }
    
    [HttpGet]
    [Route("check")]
    public IActionResult GetCheck()
    {
        return Ok(_myValue);
    }
}