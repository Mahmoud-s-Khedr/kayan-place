import { KayanAdminController, KayanController } from './kayan.controller';
import { FaultStatus } from './kayan.dto';

describe('KayanController', () => {
  const kayanService = {
    listMyFaults: jest.fn(),
    listMyServices: jest.fn(),
    adminListServices: jest.fn(),
    adminUpdateFaultStatus: jest.fn(),
    listFollowupSteps: jest.fn(),
    createFollowupConversation: jest.fn(),
    listFollowupMessages: jest.fn(),
    sendFollowupMessage: jest.fn(),
    adminCreateFollowupStep: jest.fn(),
    adminUpdateFollowupStep: jest.fn(),
    adminDeleteFollowupStep: jest.fn(),
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

  it('forwards followup list-steps request to service', async () => {
    kayanService.listFollowupSteps.mockResolvedValueOnce({ items: [] });
    const user = { sub: 3, phone: '+201000000003', isAdmin: false };

    await controller.listFollowupSteps(user as any, 'order' as any, 15);

    expect(kayanService.listFollowupSteps).toHaveBeenCalledWith(user, 'order', 15);
  });

  it('forwards followup chat create/list/send to service', async () => {
    const user = { sub: 3, phone: '+201000000003', isAdmin: false };
    kayanService.createFollowupConversation.mockResolvedValueOnce({ conversation: { id: 11 } });
    kayanService.listFollowupMessages.mockResolvedValueOnce({ items: [] });
    kayanService.sendFollowupMessage.mockResolvedValueOnce({ message: { id: 5 } });

    await controller.createConversation(user as any, 'order' as any, 15, {} as any);
    await controller.listMessages(user as any, 'order' as any, 15, 11);
    await controller.sendMessage(user as any, 'order' as any, 15, 11, { messageText: 'hi' } as any);

    expect(kayanService.createFollowupConversation).toHaveBeenCalledWith(user, { itemType: 'order', itemId: 15 });
    expect(kayanService.listFollowupMessages).toHaveBeenCalledWith(user, 11, 'order', 15);
    expect(kayanService.sendFollowupMessage).toHaveBeenCalledWith(user, 11, { messageText: 'hi' }, 'order', 15);
  });

  it('keeps deprecated followup chat aliases forwarding to legacy service signatures', async () => {
    const user = { sub: 3, phone: '+201000000003', isAdmin: false };
    kayanService.createFollowupConversation.mockResolvedValueOnce({ conversation: { id: 11 } });
    kayanService.listFollowupMessages.mockResolvedValueOnce({ items: [] });
    kayanService.sendFollowupMessage.mockResolvedValueOnce({ message: { id: 5 } });

    await controller.createConversationDeprecated(user as any, { itemType: 'order', itemId: 15 } as any);
    await controller.listMessagesDeprecated(user as any, 11);
    await controller.sendMessageDeprecated(user as any, 11, { messageText: 'hi' } as any);

    expect(kayanService.createFollowupConversation).toHaveBeenCalledWith(user, { itemType: 'order', itemId: 15 });
    expect(kayanService.listFollowupMessages).toHaveBeenCalledWith(user, 11);
    expect(kayanService.sendFollowupMessage).toHaveBeenCalledWith(user, 11, { messageText: 'hi' });
  });

  it('forwards admin followup step CRUD to service', async () => {
    const admin = { sub: 1, phone: '+201000000001', isAdmin: true };
    kayanService.adminCreateFollowupStep.mockResolvedValueOnce({ step: { id: 71 } });
    kayanService.adminUpdateFollowupStep.mockResolvedValueOnce({ step: { id: 71 } });
    kayanService.adminDeleteFollowupStep.mockResolvedValueOnce({ message: 'Step deleted' });

    await adminController.createStep(admin as any, 'order' as any, 15, { title: 'Packed' } as any);
    await adminController.updateStep('order' as any, 15, 71, { title: 'On the way' } as any);
    await adminController.deleteStep('order' as any, 15, 71);

    expect(kayanService.adminCreateFollowupStep).toHaveBeenCalledWith(admin, { itemType: 'order', itemId: 15, title: 'Packed' });
    expect(kayanService.adminUpdateFollowupStep).toHaveBeenCalledWith(71, { title: 'On the way' });
    expect(kayanService.adminDeleteFollowupStep).toHaveBeenCalledWith(71);
  });

  it('keeps deprecated admin followup step aliases forwarding to legacy service signatures', async () => {
    const admin = { sub: 1, phone: '+201000000001', isAdmin: true };
    kayanService.adminCreateFollowupStep.mockResolvedValueOnce({ step: { id: 71 } });
    kayanService.adminUpdateFollowupStep.mockResolvedValueOnce({ step: { id: 71 } });
    kayanService.adminDeleteFollowupStep.mockResolvedValueOnce({ message: 'Step deleted' });

    await adminController.createStepDeprecated(admin as any, { itemType: 'order', itemId: 15, title: 'Packed' } as any);
    await adminController.updateStepDeprecated(71, { title: 'On the way' } as any);
    await adminController.deleteStepDeprecated(71);

    expect(kayanService.adminCreateFollowupStep).toHaveBeenCalledWith(admin, { itemType: 'order', itemId: 15, title: 'Packed' });
    expect(kayanService.adminUpdateFollowupStep).toHaveBeenCalledWith(71, { title: 'On the way' });
    expect(kayanService.adminDeleteFollowupStep).toHaveBeenCalledWith(71);
  });
});
