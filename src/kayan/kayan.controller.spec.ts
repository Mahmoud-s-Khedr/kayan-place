import { KayanController } from './kayan.controller';
import { FaultStatus } from './kayan.dto';

describe('KayanController', () => {
  const kayanService = {
    listMyFaults: jest.fn(),
    adminUpdateFaultStatus: jest.fn(),
  };

  const controller = new KayanController(kayanService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards faults/me query params to service', async () => {
    kayanService.listMyFaults.mockResolvedValueOnce({ items: [] });
    const user = { sub: 3, phone: '+201000000003', isAdmin: false };
    const query = { status: FaultStatus.RECEIVED, sortBy: 'severity', sortDirection: 'asc' };

    await controller.listMyFaults(user as any, query as any);

    expect(kayanService.listMyFaults).toHaveBeenCalledWith(user, query);
  });
});
