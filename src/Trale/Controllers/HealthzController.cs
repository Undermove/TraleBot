using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace Trale.Controllers;

[Route("healthz")]
public class HealthzController : Controller
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok();
    }
}