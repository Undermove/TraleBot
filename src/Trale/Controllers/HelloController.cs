using Microsoft.AspNetCore.Mvc;

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