export class OpenRouter {
  chat = {
    send: jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Mock OpenRouter Response',
          },
        },
      ],
    }),
  };

  constructor(public options: any) {}
}
