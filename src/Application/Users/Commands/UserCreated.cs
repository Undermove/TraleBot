using MediatR;

namespace Application.Users.Commands;

public class UserCreated : INotification
{
    public string UserId { get; set; } = null!;
    
    public class UserCreatedHandler : INotificationHandler<UserCreated>
    {
        private readonly IMediator _mediator;

        public UserCreatedHandler(IMediator mediator)
        {
            _mediator = mediator;
        }

        public Task Handle(UserCreated userCreated, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }
}