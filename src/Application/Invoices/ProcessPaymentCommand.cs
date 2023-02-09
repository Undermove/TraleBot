using Application.Common;
using Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Application.Invoices;

public class ProcessPaymentCommand : IRequest<PaymentAcceptedResult>
{
    public Guid? UserId { get; set; }
    public string? PreCheckoutQueryId { get; set; }
    public SubscriptionTerm SubscriptionTerm { get; set; }

    public class Handler : IRequestHandler<ProcessPaymentCommand, PaymentAcceptedResult>
    {
        private readonly ITraleDbContext _traleDbContext;
        private readonly ILogger _logger;
        private readonly IMediator _mediator;

        public Handler(ITraleDbContext traleDbContext, ILoggerFactory factory, IMediator mediator)
        {
            _traleDbContext = traleDbContext;
            _mediator = mediator;
            _logger = factory.CreateLogger<Handler>();
        }

        public async Task<PaymentAcceptedResult> Handle(ProcessPaymentCommand request, CancellationToken ct)
        {
            Invoice invoice;
            try
            {
                _logger.LogInformation("Invoice received from UserId {UserId} with {PreCheckoutQueryId}",
                    request.UserId, request.PreCheckoutQueryId);
                invoice = new Invoice
                {
                    Id = Guid.NewGuid(),
                    UserId = request.UserId!.Value,
                    PreCheckoutQueryId = request.PreCheckoutQueryId!,
                    CreatedAtUtc = DateTime.UtcNow
                };

                _traleDbContext.Invoices.Add(invoice);

                await _traleDbContext.SaveChangesAsync(ct);
                _logger.LogInformation("Invoice saved from UserId {UserId} " +
                                       "with {PreCheckoutQueryId} with InvoiceId {InvoiceId}",
                    request.UserId, request.PreCheckoutQueryId, invoice.Id);
            }
            catch (Exception e)
            {
                _logger.LogCritical(e, "Invoice can't be processed from UserId {UserId} with {PreCheckoutQueryId}",
                    request.UserId, request.PreCheckoutQueryId);
                throw;
            }

            await _mediator.Publish(new InvoiceSaved
            {
                UserId = request.UserId, 
                InvoiceCreatedAt = invoice.CreatedAtUtc,
                SubscriptionTerm = request.SubscriptionTerm
            }, ct);

            return new PaymentAcceptedResult(true);
        }
    }
}

public record PaymentAcceptedResult(bool IsPaymentSuccess);