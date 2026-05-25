import { KayanAdminController, KayanController } from './kayan.controller';
import { FaultStatus } from './kayan.dto';

describe('KayanController', () => {
  const kayanService = {
    listMyFaults: jest.fn(),
    listMyServices: jest.fn(),
    adminListServices: jest.fn(),
    adminUpdateFaultStatus: jest.fn(),
  };

  const controller = new KayanController(kayanService as any);
  const adminController = new KayanAdminController(kayanService as any);

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

  it('forwards services/me query params to service', async () => {
    kayanService.listMyServices.mockResolvedValueOnce({ items: [] });
    const user = { sub: 3, phone: '+201000000003', isAdmin: false };
    const query = { serviceType: 'maintenance', fromDate: '2026-01-01', toDate: '2026-12-31', sortDirection: 'asc', sortBy: 'createdAt' };

    await controller.listMyServices(user as any, query as any);

    expect(kayanService.listMyServices).toHaveBeenCalledWith(user, query);
  });

  it('forwards admin/services query params to service', async () => {
    kayanService.adminListServices.mockResolvedValueOnce({ items: [] });
    const query = { serviceType: 'designing', fromDate: '2026-01-01', toDate: '2026-12-31', sortDirection: 'desc', sortBy: 'createdAt' };

    await adminController.listServices(query as any);

    expect(kayanService.adminListServices).toHaveBeenCalledWith(query);
  });
});
