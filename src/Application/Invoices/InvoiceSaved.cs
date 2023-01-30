using Application.Users.Commands;
using MediatR;

namespace Application.Invoices;

public class InvoiceSaved : INotification
{
    public Guid? UserId { get; set; }
    public DateTime? InvoiceCreatedAt { get; set; } = null!;

    public class Handler : INotificationHandler<InvoiceSaved>
    {
        private readonly IMediator _mediator;

        public Handler(IMediator mediator)
        {
            _mediator = mediator;
        }

        public Task Handle(InvoiceSaved userCreated, CancellationToken cancellationToken)
        {
            return _mediator.Send(new ActivatePremiumCommand
            {
                UserId = userCreated.UserId,
                InvoiceCreatedAdUtc = userCreated.InvoiceCreatedAt,
                IsTrial = false
            }, cancellationToken);
        }
    }
}