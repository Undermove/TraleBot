using MediatR;

namespace Application.Invoices;

public class ProcessPaymentCommand : IRequest<PaymentAcceptedResult>
{
    public Guid? UserId { get; set; }
    public string? PreCheckoutQueryId { get; set; }

    public class Handler : IRequestHandler<ProcessPaymentCommand, PaymentAcceptedResult>
    {
        public Task<PaymentAcceptedResult> Handle(ProcessPaymentCommand request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new PaymentAcceptedResult());
        }
    }
}

public record PaymentAcceptedResult();