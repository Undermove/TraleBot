using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Application.Invoices;

public class ProcessPaymentCommand : IRequest<PaymentAcceptedResult>
{
    public Guid? UserId { get; set; }
    public string? PreCheckoutQueryId { get; set; }

    public class Handler : IRequestHandler<ProcessPaymentCommand, PaymentAcceptedResult>
    {
        private readonly ITraleDbContext _traleDbContext;
        private readonly ILogger _logger;

        public Handler(ITraleDbContext traleDbContext, ILoggerFactory factory)
        {
            _traleDbContext = traleDbContext;
            _logger = factory.CreateLogger<Handler>();
        }

        public async Task<PaymentAcceptedResult> Handle(ProcessPaymentCommand request, CancellationToken ct)
        {
            try
            {
                _logger.LogInformation("Invoice received from UserId {UserId} with {PreCheckoutQueryId}", request.UserId, request.PreCheckoutQueryId);
                var invoice = new Invoice
                {
                    Id = Guid.NewGuid(),
                    UserId = request.UserId!.Value,
                    PreCheckoutQueryId = request.PreCheckoutQueryId!,
                };
                
                _traleDbContext.Invoices.Add(invoice);

                await _traleDbContext.SaveChangesAsync(ct);
                _logger.LogInformation("Invoice saved from UserId {UserId} " +
                                       "with {PreCheckoutQueryId} with InvoiceId {InvoiceId}", 
                    request.UserId, request.PreCheckoutQueryId, invoice.Id);
            }
            catch (Exception e)
            {
                _logger.LogCritical(e,"Invoice can't be processed from UserId {UserId} with {PreCheckoutQueryId}", request.UserId, request.PreCheckoutQueryId);
                throw;
            }
            
            return new PaymentAcceptedResult(true);
        }
    }
}

public record PaymentAcceptedResult(bool IsPaymentSuccess);