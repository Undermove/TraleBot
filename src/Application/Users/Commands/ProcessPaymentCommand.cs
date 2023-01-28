using Application.Users.Commands.CreateUser;
using MediatR;

namespace Application.Users.Commands;

public class ProcessPaymentCommand : IRequest<PaymentAcceptedResult>
{
    public Guid? UserId { get; set; }

    public class Handler : IRequestHandler<ProcessPaymentCommand, PaymentAcceptedResult>
    {
        public Task<PaymentAcceptedResult> Handle(ProcessPaymentCommand request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new PaymentAcceptedResult());
        }
    }
}

public record PaymentAcceptedResult();