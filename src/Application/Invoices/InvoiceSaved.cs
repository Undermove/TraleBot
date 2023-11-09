using Application.Users.Commands;
using MediatR;

namespace Application.Invoices;

public class InvoiceSaved : INotification
{
    public Guid? UserId { get; set; }
    public DateTime? InvoiceCreatedAt { get; set; } = null!;
    public SubscriptionTerm SubscriptionTerm { get; set; }

    public class Handler : INotificationHandler<InvoiceSaved>
    {
        private readonly IMediator _mediator;

        public Handler(IMediator mediator)
        {
            _mediator = mediator;
        }

        public Task Handle(InvoiceSaved invoceSaved, CancellationToken cancellationToken)
        {
            return _mediator.Send(new ActivatePremium
            {
                UserId = invoceSaved.UserId,
                InvoiceCreatedAdUtc = invoceSaved.InvoiceCreatedAt,
                IsTrial = false,
                SubscriptionTerm = invoceSaved.SubscriptionTerm
            }, cancellationToken);
        }
    }
}