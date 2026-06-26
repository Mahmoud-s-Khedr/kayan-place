import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from '../common/types/auth-user.type';
import {
  AdminCreateProductDto,
  AdminUpdateFaultStatusDto,
  AdminUpdateOrderStatusDto,
  AdminUpdateProductDto,
  AdminUpdateServiceStatusDto,
  CheckoutCartDto,
  CreateCartItemDto,
  CreateFaultDto,
  CreateFollowupConversationDto,
  CreateFollowupStepDto,
  CreateGalleryItemDto,
  CreateItemRatingDto,
  CreateOrderDto,
  CreateServiceOrderDto,
  FaultStatus,
  FaultSortBy,
  GetItemReviewsQueryDto,
  ItemType,
  ListAdminFaultsQueryDto,
  ListFollowupStepsQueryDto,
  ListGalleryQueryDto,
  ListMyFaultsQueryDto,
  ListOrdersQueryDto,
  ListProductsQueryDto,
  ListServicesQueryDto,
  OrderSortBy,
  OrderStatus,
  ProductAvailabilityFilter,
  ProductSortBy,
  SendFollowupMessageDto,
  ServiceSortBy,
  ServiceStatus,
  SortDirection,
  UpdateFaultDto,
  UpdateCartItemDto,
  UpdateFollowupStepDto,
  UpdateGalleryItemDto,
  UpdateOrderAddressDto,
  UpdateServiceOrderDto,
} from './kayan.dto';

type SqlExecutor = {
  query: (text: string, values?: unknown[]) => Promise<{ rowCount?: number | null; rows: any[] }>;
};

type ProductAssetRow = {
  product_id: number | string;
  file_id: number | string;
  asset_type: 'image' | 'file';
  sort_order: number;
  object_key: string | null;
  original_filename: string | null;
  mime_type: string | null;
  status: string | null;
};

type GalleryAssetRow = {
  gallery_item_id: number | string;
  file_id: number | string;
  sort_order: number;
  object_key: string | null;
  original_filename: string | null;
  mime_type: string | null;
  status: string | null;
};

type FaultAssetRow = {
  fault_id: number | string;
  file_id: number | string;
  sort_order: number;
  object_key: string | null;
  original_filename: string | null;
  mime_type: string | null;
  status: string | null;
};

@Injectable()
export class KayanService {
  constructor(private readonly db: DatabaseService) {}

  async listProducts(query: ListProductsQueryDto = {}): Promise<Record<string, unknown>> {
    const conditions = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (query.availability === ProductAvailabilityFilter.ACTIVE || !query.availability) {
      conditions.push('is_active = true');
    } else if (query.availability === ProductAvailabilityFilter.INACTIVE) {
      conditions.push('is_active = false');
    }

    if (query.query) {
      params.push(`%${this.escapeLike(query.query)}%`);
      conditions.push(`(title ILIKE $${params.length} ESCAPE '\\' OR description ILIKE $${params.length} ESCAPE '\\')`);
    }
    if (query.minPrice !== undefined) {
      params.push(query.minPrice);
      conditions.push(`price >= $${params.length}`);
    }
    if (query.maxPrice !== undefined) {
      params.push(query.maxPrice);
      conditions.push(`price <= $${params.length}`);
    }
    if (query.fromDate) {
      params.push(query.fromDate);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (query.toDate) {
      params.push(query.toDate);
      conditions.push(`created_at <= $${params.length}`);
    }

    const sortBy = query.sortBy ?? ProductSortBy.CREATED_AT;
    const sortDirection = (query.sortDirection ?? SortDirection.DESC).toUpperCase();
    const orderColumn = sortBy === ProductSortBy.PRICE ? 'price' : 'created_at';

    // Rate filter is applied via HAVING on the aggregated rating
    const havingClauses: string[] = [];
    if (query.minRate !== undefined) {
      params.push(query.minRate);
      havingClauses.push(`COALESCE(ROUND(AVG(pr.rating_value)::numeric, 2), 0) >= $${params.length}`);
    }
    if (query.maxRate !== undefined) {
      params.push(query.maxRate);
      havingClauses.push(`COALESCE(ROUND(AVG(pr.rating_value)::numeric, 2), 0) <= $${params.length}`);
    }
    const havingClause = havingClauses.length ? `HAVING ${havingClauses.join(' AND ')}` : '';

    const q = await this.db.query(
      `SELECT cp.id, cp.title, cp.description, cp.amount, cp.price, cp.details, cp.is_active,
              cp.created_at::text AS created_at, cp.updated_at::text AS updated_at,
              COALESCE(ROUND(AVG(pr.rating_value)::numeric, 2), 0)::text AS rate
       FROM catalog_products cp
       LEFT JOIN product_ratings pr ON pr.product_id = cp.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY cp.id
       ${havingClause}
       ORDER BY ${orderColumn} ${sortDirection}, cp.id DESC`,
      params,
    );

    return { items: await this.attachProductAssets(this.db, q.rows as Array<Record<string, unknown>>) };
  }

  async getProduct(productId: number): Promise<Record<string, unknown>> {
    return this.getProductWithAssets(this.db, productId);
  }

  async adminCreateProduct(admin: AuthUser, dto: AdminCreateProductDto): Promise<Record<string, unknown>> {
    return this.db.withTransaction(async (client) => {
      const created = await client.query<{ id: number }>(
        `INSERT INTO catalog_products(title, description, amount, price, details, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id`,
        [dto.title, dto.description, dto.amount, dto.price, dto.details ?? null, admin.sub],
      );
      const productId = Number(created.rows[0].id);
      await this.syncProductAssets(client, productId, dto.imageFileIds ?? [], 'image');
      await this.syncProductAssets(client, productId, dto.fileIds ?? [], 'file');
      return this.getProductWithAssets(client, productId);
    });
  }

  async adminUpdateProduct(admin: AuthUser, productId: number, dto: AdminUpdateProductDto): Promise<Record<string, unknown>> {
    return this.db.withTransaction(async (client) => {
      const u = await client.query(
        `UPDATE catalog_products
         SET title = COALESCE($1,title),
             description = COALESCE($2,description),
             amount = COALESCE($3,amount),
             price = COALESCE($4,price),
             details = COALESCE($5,details),
             is_active = COALESCE($6,is_active),
             updated_by = $7,
             updated_at = NOW()
         WHERE id = $8 AND deleted_at IS NULL RETURNING id`,
        [dto.title ?? null, dto.description ?? null, dto.amount ?? null, dto.price ?? null, dto.details ?? null, dto.isActive ?? null, admin.sub, productId],
      );
      if (!u.rowCount) throw new NotFoundException('Product not found');
      if (dto.imageFileIds) await this.syncProductAssets(client, productId, dto.imageFileIds, 'image');
      if (dto.fileIds) await this.syncProductAssets(client, productId, dto.fileIds, 'file');
      return this.getProductWithAssets(client, productId);
    });
  }

  async adminDeleteProduct(admin: AuthUser, productId: number): Promise<Record<string, unknown>> {
    const q = await this.db.query(
      `UPDATE catalog_products SET deleted_at = NOW(), updated_by = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING id`,
      [admin.sub, productId],
    );
    if (!q.rowCount) throw new NotFoundException('Product not found');
    return { message: 'Product deleted' };
  }

  async createOrder(user: AuthUser, dto: CreateOrderDto): Promise<Record<string, unknown>> {
    if (!dto.items.length) throw new BadRequestException('Order items are required');
    return this.db.withTransaction(async (client) => this.createOrderRecord(client, user, dto.deliveryAddress, dto.items));
  }

  async listCart(user: AuthUser): Promise<Record<string, unknown>> {
    const q = await this.db.query(
      `SELECT ci.id, ci.product_id, ci.quantity, ci.created_at::text AS created_at, ci.updated_at::text AS updated_at,
              cp.title, cp.description, cp.amount, cp.price, cp.is_active
       FROM cart_items ci
       JOIN catalog_products cp ON cp.id = ci.product_id
       WHERE ci.user_id = $1 AND cp.deleted_at IS NULL
       ORDER BY ci.created_at DESC, ci.id DESC`,
      [user.sub],
    );
    const products = await this.attachProductAssets(
      this.db,
      q.rows.map((row) => ({
        id: row.product_id,
        title: row.title,
        description: row.description,
        amount: row.amount,
        price: row.price,
        is_active: row.is_active,
      })),
    );
    const productById = new Map(products.map((product) => [Number(product.id), product]));

    return {
      items: q.rows.map((row) => ({
        id: row.id,
        product_id: row.product_id,
        quantity: row.quantity,
        created_at: row.created_at,
        updated_at: row.updated_at,
        product: {
          ...(productById.get(Number(row.product_id)) ?? {}),
        },
      })),
    };
  }

  async addCartItem(user: AuthUser, dto: CreateCartItemDto): Promise<Record<string, unknown>> {
    await this.assertCartProductState(dto.productId, dto.quantity);
    await this.db.query(
      `INSERT INTO cart_items(user_id, product_id, quantity)
       VALUES($1,$2,$3)
       ON CONFLICT(user_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()`,
      [user.sub, dto.productId, dto.quantity],
    );
    return this.listCart(user);
  }

  async updateCartItem(user: AuthUser, cartItemId: number, dto: UpdateCartItemDto): Promise<Record<string, unknown>> {
    const existing = await this.db.query<{ product_id: number }>(
      `SELECT product_id FROM cart_items WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [cartItemId, user.sub],
    );
    if (!existing.rowCount) throw new NotFoundException('Cart item not found');
    await this.assertCartProductState(Number(existing.rows[0].product_id), dto.quantity);
    await this.db.query(`UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2`, [dto.quantity, cartItemId]);
    return this.listCart(user);
  }

  async deleteCartItem(user: AuthUser, cartItemId: number): Promise<Record<string, unknown>> {
    const q = await this.db.query(`DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING id`, [cartItemId, user.sub]);
    if (!q.rowCount) throw new NotFoundException('Cart item not found');
    return { message: 'Cart item deleted' };
  }

  async checkoutCart(user: AuthUser, dto: CheckoutCartDto): Promise<Record<string, unknown>> {
    return this.db.withTransaction(async (client) => {
      const cart = await client.query<{ product_id: number; quantity: number }>(
        `SELECT id, product_id, quantity FROM cart_items WHERE user_id = $1 ORDER BY created_at ASC, id ASC FOR UPDATE`,
        [user.sub],
      );
      if (!cart.rowCount) throw new BadRequestException('Cart is empty');

      const order = await this.createOrderRecord(
        client,
        user,
        dto.deliveryAddress,
        cart.rows.map((item) => ({ productId: Number(item.product_id), quantity: Number(item.quantity) })),
      );

      await client.query(`DELETE FROM cart_items WHERE user_id = $1`, [user.sub]);
      return order;
    });
  }

  async listMyOrders(user: AuthUser, query: ListOrdersQueryDto = {}): Promise<Record<string, unknown>> {
    const conditions = ['po.user_id = $1'];
    const params: unknown[] = [user.sub];

    if (query.status) {
      params.push(query.status);
      conditions.push(`po.status = $${params.length}`);
    }
    if (query.fromDate) {
      params.push(query.fromDate);
      conditions.push(`po.created_at >= $${params.length}`);
    }
    if (query.toDate) {
      params.push(query.toDate);
      conditions.push(`po.created_at <= $${params.length}`);
    }

    const sortBy = query.sortBy ?? OrderSortBy.CREATED_AT;
    const sortDirection = (query.sortDirection ?? SortDirection.DESC).toUpperCase();
    const orderColumn = sortBy === OrderSortBy.CREATED_AT ? 'po.created_at' : 'po.created_at';

    const q = await this.db.query(
      `SELECT po.id, po.user_id, po.delivery_address, po.status, po.created_at::text AS created_at, po.updated_at::text AS updated_at
       FROM product_orders po
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderColumn} ${sortDirection}, po.id DESC`,
      params,
    );
    return { items: await this.attachOrderItems(this.db, q.rows as Array<Record<string, unknown>>, false) };
  }

  async getOrderForUser(userId: number, orderId: number, allowAdmin = false): Promise<Record<string, unknown>> {
    const q = await this.db.query(
      `SELECT po.id, po.user_id, po.delivery_address, po.status, po.created_at::text AS created_at, po.updated_at::text AS updated_at,
              u.name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM product_orders po
       LEFT JOIN users u ON u.id = po.user_id
       WHERE po.id = $1
       LIMIT 1`,
      [orderId],
    );
    if (!q.rowCount) throw new NotFoundException('Order not found');
    const order = q.rows[0] as { user_id: number } & Record<string, unknown>;
    if (!allowAdmin && Number(order.user_id) !== userId) throw new ForbiddenException('Not allowed');

    const [expanded] = await this.attachOrderItems(this.db, [q.rows[0] as Record<string, unknown>], true);
    return { order: expanded };
  }

  async updateOrderAddress(user: AuthUser, orderId: number, dto: UpdateOrderAddressDto): Promise<Record<string, unknown>> {
    const q = await this.db.query<{ status: OrderStatus }>(
      `SELECT status FROM product_orders WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [orderId, user.sub],
    );
    if (!q.rowCount) throw new NotFoundException('Order not found');
    if (q.rows[0].status !== OrderStatus.RECEIVED) throw new BadRequestException('Address can only be updated before processing starts');
    await this.db.query(`UPDATE product_orders SET delivery_address = $1, updated_at = NOW() WHERE id = $2`, [dto.deliveryAddress, orderId]);
    return this.getOrderForUser(user.sub, orderId, true);
  }

  async cancelOrder(user: AuthUser, orderId: number): Promise<Record<string, unknown>> {
    const q = await this.db.query<{ status: OrderStatus }>(
      `SELECT status FROM product_orders WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [orderId, user.sub],
    );
    if (!q.rowCount) throw new NotFoundException('Order not found');
    if (q.rows[0].status !== OrderStatus.RECEIVED) throw new BadRequestException('Order cancellation allowed only before processing starts');
    await this.db.query(`UPDATE product_orders SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`, [orderId]);
    await this.db.query(`INSERT INTO order_status_history(order_id, status, changed_by) VALUES($1,'cancelled',$2)`, [orderId, user.sub]);
    return this.getOrderForUser(user.sub, orderId, true);
  }

  async adminListOrders(query: ListOrdersQueryDto = {}): Promise<Record<string, unknown>> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.status) {
      params.push(query.status);
      conditions.push(`po.status = $${params.length}`);
    }
    if (query.fromDate) {
      params.push(query.fromDate);
      conditions.push(`po.created_at >= $${params.length}`);
    }
    if (query.toDate) {
      params.push(query.toDate);
      conditions.push(`po.created_at <= $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortDirection = (query.sortDirection ?? SortDirection.DESC).toUpperCase();

    const limit = Math.min(query.limit ?? 20, 100);
    const page = Math.max((query.page ?? 1) - 1, 0);
    const offset = page * limit;

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const totalQ = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM product_orders po ${whereClause}`,
      params.slice(0, params.length - 2),
    );
    const total = parseInt(totalQ.rows[0]?.count ?? '0', 10);

    const q = await this.db.query(
      `SELECT po.id, po.user_id, po.delivery_address, po.status, po.created_at::text AS created_at, po.updated_at::text AS updated_at,
              u.name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM product_orders po
       LEFT JOIN users u ON u.id = po.user_id
       ${whereClause}
       ORDER BY po.created_at ${sortDirection}, po.id DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );
    return { items: await this.attachOrderItems(this.db, q.rows as Array<Record<string, unknown>>, true), total };
  }

  async adminUpdateOrderStatus(admin: AuthUser, orderId: number, dto: AdminUpdateOrderStatusDto): Promise<Record<string, unknown>> {
    const q = await this.db.query(`UPDATE product_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`, [dto.status, orderId]);
    if (!q.rowCount) throw new NotFoundException('Order not found');
    await this.db.query(`INSERT INTO order_status_history(order_id, status, changed_by) VALUES($1,$2,$3)`, [orderId, dto.status, admin.sub]);
    return this.getOrderForUser(0, orderId, true);
  }

  async createFault(user: AuthUser, dto: CreateFaultDto): Promise<Record<string, unknown>> {
    return this.db.withTransaction(async (client) => {
      const created = await client.query<{ id: number }>(
        `INSERT INTO fault_reports(user_id, title, description, severity, address)
         VALUES($1,$2,$3,$4,$5) RETURNING id`,
        [user.sub, dto.title, dto.description, dto.severity, dto.address],
      );
      const faultId = created.rows[0].id;
      await this.syncFaultAssets(client, faultId, dto.imageFileIds ?? []);
      await client.query(`INSERT INTO fault_status_history(fault_id, status, changed_by) VALUES($1,$2,$3)`, [faultId, FaultStatus.RECEIVED, user.sub]);
      return this.getFaultForUserWithExecutor(client, user.sub, faultId, true);
    });
  }

  async updateFault(user: AuthUser, faultId: number, dto: UpdateFaultDto): Promise<Record<string, unknown>> {
    return this.db.withTransaction(async (client) => {
      const current = await client.query<{ status: FaultStatus }>(
        `SELECT status FROM fault_reports WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [faultId, user.sub],
      );
      if (!current.rowCount) throw new NotFoundException('Fault not found');
      if (current.rows[0].status !== FaultStatus.RECEIVED) throw new BadRequestException('Fault can only be updated before processing starts');

      await client.query(
        `UPDATE fault_reports SET title = COALESCE($1,title), description = COALESCE($2,description),
         severity = COALESCE($3,severity), address = COALESCE($4,address), updated_at = NOW() WHERE id = $5`,
        [dto.title ?? null, dto.description ?? null, dto.severity ?? null, dto.address ?? null, faultId],
      );
      if (dto.imageFileIds) await this.syncFaultAssets(client, faultId, dto.imageFileIds);
      return this.getFaultForUserWithExecutor(client, user.sub, faultId, true);
    });
  }

  async listMyFaults(user: AuthUser, query: ListMyFaultsQueryDto = {}): Promise<Record<string, unknown>> {
    const conditions = ['fr.user_id = $1'];
    const params: unknown[] = [user.sub];

    if (query.status) {
      params.push(query.status);
      conditions.push(`fr.status = $${params.length}`);
    }
    if (query.severity) {
      params.push(query.severity);
      conditions.push(`fr.severity = $${params.length}`);
    }
    if (query.fromDate) {
      params.push(query.fromDate);
      conditions.push(`fr.created_at >= $${params.length}`);
    }
    if (query.toDate) {
      params.push(query.toDate);
      conditions.push(`fr.created_at <= $${params.length}`);
    }

    const sortDirection = (query.sortDirection ?? SortDirection.DESC).toUpperCase();
    const orderClause = this.buildFaultOrderClause(query.sortBy ?? FaultSortBy.CREATED_AT, sortDirection);

    const q = await this.db.query(
      `SELECT fr.id, fr.user_id, fr.title, fr.description, fr.severity, fr.address, fr.status, fr.cancelled_at::text AS cancelled_at,
              fr.created_at::text AS created_at, fr.updated_at::text AS updated_at,
              EXISTS(
                SELECT 1 FROM item_ratings ir
                WHERE ir.item_type = 'fault' AND ir.item_id = fr.id AND ir.user_id = $1
              )::boolean AS has_rated
       FROM fault_reports fr
       WHERE ${conditions.join(' AND ')}
       ${orderClause}`,
      params,
    );
    return { items: await this.attachFaultAssets(this.db, q.rows as Array<Record<string, unknown>>) };
  }

  async cancelFault(user: AuthUser, faultId: number): Promise<Record<string, unknown>> {
    const q = await this.db.query<{ status: FaultStatus }>(`SELECT status FROM fault_reports WHERE id = $1 AND user_id = $2 LIMIT 1`, [faultId, user.sub]);
    if (!q.rowCount) throw new NotFoundException('Fault not found');
    if (q.rows[0].status !== FaultStatus.RECEIVED) throw new BadRequestException('Fault cancellation allowed only before processing starts');
    await this.db.query(`UPDATE fault_reports SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`, [faultId]);
    await this.db.query(`INSERT INTO fault_status_history(fault_id, status, changed_by) VALUES($1,'cancelled',$2)`, [faultId, user.sub]);
    return this.getFaultForUser(user.sub, faultId, true);
  }

  async getFaultForUser(userId: number, faultId: number, allowAdmin = false): Promise<Record<string, unknown>> {
    return this.getFaultForUserWithExecutor(this.db, userId, faultId, allowAdmin);
  }

  private async getFaultForUserWithExecutor(
    executor: SqlExecutor,
    userId: number,
    faultId: number,
    allowAdmin = false,
  ): Promise<Record<string, unknown>> {
    const q = await executor.query(
      `SELECT id, user_id, title, description, severity, address, status, cancelled_at::text AS cancelled_at,
              created_at::text AS created_at, updated_at::text AS updated_at,
              EXISTS(
                SELECT 1 FROM item_ratings ir
                WHERE ir.item_type = 'fault' AND ir.item_id = $1 AND ir.user_id = $2
              )::boolean AS has_rated
       FROM fault_reports WHERE id = $1 LIMIT 1`,
      [faultId, userId],
    );
    if (!q.rowCount) throw new NotFoundException('Fault not found');
    const fault = q.rows[0] as { user_id: number } & Record<string, unknown>;
    if (!allowAdmin && Number(fault.user_id) !== userId) throw new ForbiddenException('Not allowed');
    const [withAssets] = await this.attachFaultAssets(executor, [fault]);
    return { fault: withAssets };
  }

  async adminListFaults(query: ListAdminFaultsQueryDto = {}): Promise<Record<string, unknown>> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.status) {
      params.push(query.status);
      conditions.push(`fr.status = $${params.length}`);
    }
    if (query.severity) {
      params.push(query.severity);
      conditions.push(`fr.severity = $${params.length}`);
    }
    if (query.fromDate) {
      params.push(query.fromDate);
      conditions.push(`fr.created_at >= $${params.length}`);
    }
    if (query.toDate) {
      params.push(query.toDate);
      conditions.push(`fr.created_at <= $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortDirection = (query.sortDirection ?? SortDirection.DESC).toUpperCase();
    const orderClause = this.buildFaultOrderClause(query.sortBy ?? FaultSortBy.CREATED_AT, sortDirection);

    const limit = Math.min(query.limit ?? 20, 100);
    const page = Math.max((query.page ?? 1) - 1, 0);
    const offset = page * limit;

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const totalQ = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM fault_reports fr ${whereClause}`,
      params.slice(0, params.length - 2),
    );
    const total = parseInt(totalQ.rows[0]?.count ?? '0', 10);

    const q = await this.db.query(
      `SELECT fr.id, fr.user_id, fr.title, fr.description, fr.severity, fr.address, fr.status, fr.cancelled_at::text AS cancelled_at,
              fr.created_at::text AS created_at, fr.updated_at::text AS updated_at,
              u.name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM fault_reports fr
       LEFT JOIN users u ON u.id = fr.user_id
       ${whereClause}
       ${orderClause}
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );
    const items = await this.attachFaultAssets(this.db, q.rows as Array<Record<string, unknown>>);
    return {
      items: items.map((item) => ({
        ...item,
        user: {
          id: Number(item.user_id),
          name: item.user_name ?? null,
          email: item.user_email ?? null,
          phone: item.user_phone ?? null,
        },
      })),
      total,
    };
  }

  async adminUpdateFaultStatus(admin: AuthUser, faultId: number, dto: AdminUpdateFaultStatusDto): Promise<Record<string, unknown>> {
    const current = await this.db.query<{ status: FaultStatus }>(`SELECT status FROM fault_reports WHERE id = $1 LIMIT 1`, [faultId]);
    if (!current.rowCount) throw new NotFoundException('Fault not found');
    this.assertValidFaultTransition(current.rows[0].status, dto.status);
    await this.db.query(`UPDATE fault_reports SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`, [dto.status, faultId]);
    await this.db.query(`INSERT INTO fault_status_history(fault_id, status, changed_by) VALUES($1,$2,$3)`, [faultId, dto.status, admin.sub]);
    return this.getFaultForUser(0, faultId, true);
  }

  async createService(user: AuthUser, dto: CreateServiceOrderDto): Promise<Record<string, unknown>> {
    const q = await this.db.query(
      `INSERT INTO service_orders(user_id, service_type, description, address)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [user.sub, dto.serviceType, dto.description, dto.address],
    );
    const service = q.rows[0] as { id: number };
    await this.db.query(`INSERT INTO service_status_history(service_id, status, changed_by) VALUES($1,'not_started',$2)`, [service.id, user.sub]);
    return { service };
  }

  async updateService(user: AuthUser, serviceId: number, dto: UpdateServiceOrderDto): Promise<Record<string, unknown>> {
    const q = await this.db.query<{ status: ServiceStatus }>(
      `SELECT status FROM service_orders WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [serviceId, user.sub],
    );
    if (!q.rowCount) throw new NotFoundException('Service order not found');
    if (q.rows[0].status !== ServiceStatus.NOT_STARTED) throw new BadRequestException('Service order can only be updated before processing starts');
    await this.db.query(
      `UPDATE service_orders SET description = COALESCE($1, description), address = COALESCE($2, address), updated_at = NOW() WHERE id = $3`,
      [dto.description ?? null, dto.address ?? null, serviceId],
    );
    return this.getServiceForUser(user.sub, serviceId, true);
  }

  async listMyServices(user: AuthUser, query: ListServicesQueryDto = {}): Promise<Record<string, unknown>> {
    const conditions = ['so.user_id = $1'];
    const params: unknown[] = [user.sub];

    if (query.serviceType) {
      params.push(query.serviceType);
      conditions.push(`so.service_type = $${params.length}`);
    }
    if (query.fromDate) {
      params.push(query.fromDate);
      conditions.push(`so.created_at >= $${params.length}`);
    }
    if (query.toDate) {
      params.push(query.toDate);
      conditions.push(`so.created_at <= $${params.length}`);
    }

    const sortBy = query.sortBy ?? ServiceSortBy.CREATED_AT;
    const sortDirection = (query.sortDirection ?? SortDirection.DESC).toUpperCase();
    const orderColumn = sortBy === ServiceSortBy.CREATED_AT ? 'so.created_at' : 'so.created_at';

    const limit = Math.min(query.limit ?? 20, 100);
    const page = Math.max((query.page ?? 1) - 1, 0);
    const offset = page * limit;

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const totalQ = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM service_orders so WHERE ${conditions.join(' AND ')}`,
      params.slice(0, params.length - 2),
    );
    const total = parseInt(totalQ.rows[0]?.count ?? '0', 10);

    const q = await this.db.query(
      `SELECT so.*
       FROM service_orders so
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderColumn} ${sortDirection}, so.id DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );
    return { items: q.rows, total };
  }

  async cancelService(user: AuthUser, serviceId: number): Promise<Record<string, unknown>> {
    const q = await this.db.query<{ status: ServiceStatus }>(`SELECT status FROM service_orders WHERE id = $1 AND user_id = $2 LIMIT 1`, [serviceId, user.sub]);
    if (!q.rowCount) throw new NotFoundException('Service order not found');
    if (q.rows[0].status !== ServiceStatus.NOT_STARTED) throw new BadRequestException('Service cancellation allowed only before processing starts');
    await this.db.query(`UPDATE service_orders SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`, [serviceId]);
    await this.db.query(`INSERT INTO service_status_history(service_id, status, changed_by) VALUES($1,'cancelled',$2)`, [serviceId, user.sub]);
    return this.getServiceForUser(user.sub, serviceId, true);
  }

  async getServiceForUser(userId: number, serviceId: number, allowAdmin = false): Promise<Record<string, unknown>> {
    const q = await this.db.query(`SELECT * FROM service_orders WHERE id = $1 LIMIT 1`, [serviceId]);
    if (!q.rowCount) throw new NotFoundException('Service order not found');
    const service = q.rows[0] as { user_id: number } & Record<string, unknown>;
    if (!allowAdmin && Number(service.user_id) !== userId) throw new ForbiddenException('Not allowed');
    return { service };
  }

  async publicListServices(query: ListServicesQueryDto = {}): Promise<Record<string, unknown>> {
    const conditions = ['1=1'];
    const params: unknown[] = [];

    if (query.serviceType) {
      params.push(query.serviceType);
      conditions.push(`so.service_type = $${params.length}`);
    }
    if (query.fromDate) {
      params.push(query.fromDate);
      conditions.push(`so.created_at >= $${params.length}`);
    }
    if (query.toDate) {
      params.push(query.toDate);
      conditions.push(`so.created_at <= $${params.length}`);
    }

    const sortBy = query.sortBy ?? ServiceSortBy.CREATED_AT;
    const sortDirection = (query.sortDirection ?? SortDirection.DESC).toUpperCase();
    const orderColumn = sortBy === ServiceSortBy.CREATED_AT ? 'so.created_at' : 'so.created_at';

    const limit = Math.min(query.limit ?? 20, 100);
    const page = Math.max((query.page ?? 1) - 1, 0);
    const offset = page * limit;

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const totalQ = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM service_orders so WHERE ${conditions.join(' AND ')}`,
      params.slice(0, params.length - 2),
    );
    const total = parseInt(totalQ.rows[0]?.count ?? '0', 10);

    const q = await this.db.query(
      `SELECT so.*
       FROM service_orders so
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderColumn} ${sortDirection}, so.id DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    return {
      items: q.rows,
      total,
    };
  }

  async adminListServices(query: ListServicesQueryDto = {}): Promise<Record<string, unknown>> {
    const conditions = ['1=1'];
    const params: unknown[] = [];

    if (query.serviceType) {
      params.push(query.serviceType);
      conditions.push(`so.service_type = $${params.length}`);
    }
    if (query.fromDate) {
      params.push(query.fromDate);
      conditions.push(`so.created_at >= $${params.length}`);
    }
    if (query.toDate) {
      params.push(query.toDate);
      conditions.push(`so.created_at <= $${params.length}`);
    }

    const sortBy = query.sortBy ?? ServiceSortBy.CREATED_AT;
    const sortDirection = (query.sortDirection ?? SortDirection.DESC).toUpperCase();
    const orderColumn = sortBy === ServiceSortBy.CREATED_AT ? 'so.created_at' : 'so.created_at';

    const limit = Math.min(query.limit ?? 20, 100);
    const page = Math.max((query.page ?? 1) - 1, 0);
    const offset = page * limit;

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const totalQ = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM service_orders so WHERE ${conditions.join(' AND ')}`,
      params.slice(0, params.length - 2),
    );
    const total = parseInt(totalQ.rows[0]?.count ?? '0', 10);

    const q = await this.db.query(
      `SELECT so.*,
              u.name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM service_orders so
       LEFT JOIN users u ON u.id = so.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderColumn} ${sortDirection}, so.id DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );
    return {
      items: q.rows.map((item) => ({
        ...item,
        user: {
          id: Number(item.user_id),
          name: item.user_name ?? null,
          email: item.user_email ?? null,
          phone: item.user_phone ?? null,
        },
      })),
      total,
    };
  }

  async adminUpdateServiceStatus(admin: AuthUser, serviceId: number, dto: AdminUpdateServiceStatusDto): Promise<Record<string, unknown>> {
    const q = await this.db.query(`UPDATE service_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`, [dto.status, serviceId]);
    if (!q.rowCount) throw new NotFoundException('Service order not found');
    await this.db.query(`INSERT INTO service_status_history(service_id, status, changed_by) VALUES($1,$2,$3)`, [serviceId, dto.status, admin.sub]);
    return this.getServiceForUser(0, serviceId, true);
  }

  async listFollowupSteps(user: AuthUser, itemType: ItemType, itemId: number, query: ListFollowupStepsQueryDto = {}): Promise<Record<string, unknown>> {
    await this.assertUserOwnsItem(user, itemType, itemId);
    const limit = Math.min(query.limit ?? 50, 100);
    const page = Math.max((query.page ?? 1) - 1, 0);
    const offset = page * limit;
    const totalQ = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM followup_steps WHERE item_type = $1 AND item_id = $2`,
      [itemType, itemId],
    );
    const total = parseInt(totalQ.rows[0]?.count ?? '0', 10);
    const q = await this.db.query(
      `SELECT id, item_type, item_id, title, step_image_file_id, sort_order, created_at::text AS created_at
       FROM followup_steps WHERE item_type = $1 AND item_id = $2 ORDER BY sort_order ASC, id ASC
       LIMIT $3 OFFSET $4`,
      [itemType, itemId, limit, offset],
    );
    return { items: q.rows, total };
  }

  async adminCreateFollowupStep(admin: AuthUser, dto: CreateFollowupStepDto): Promise<Record<string, unknown>> {
    await this.assertItemExists(dto.itemType, dto.itemId);
    const q = await this.db.query(
      `INSERT INTO followup_steps(item_type, item_id, title, step_image_file_id, sort_order, created_by)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [dto.itemType, dto.itemId, dto.title, dto.stepImageFileId ?? null, dto.sortOrder ?? 0, admin.sub],
    );
    return { step: q.rows[0] };
  }

  async adminUpdateFollowupStep(stepId: number, dto: UpdateFollowupStepDto): Promise<Record<string, unknown>> {
    const q = await this.db.query(
      `UPDATE followup_steps SET title = COALESCE($1,title), step_image_file_id = COALESCE($2,step_image_file_id),
       sort_order = COALESCE($3,sort_order), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [dto.title ?? null, dto.stepImageFileId ?? null, dto.sortOrder ?? null, stepId],
    );
    if (!q.rowCount) throw new NotFoundException('Step not found');
    return { step: q.rows[0] };
  }

  async adminDeleteFollowupStep(stepId: number): Promise<Record<string, unknown>> {
    const q = await this.db.query(`DELETE FROM followup_steps WHERE id = $1 RETURNING id`, [stepId]);
    if (!q.rowCount) throw new NotFoundException('Step not found');
    return { message: 'Step deleted' };
  }

  async listGallery(query: ListGalleryQueryDto = {}): Promise<Record<string, unknown>> {
    return this.listGalleryItems(true, query);
  }

  async adminListGallery(query: ListGalleryQueryDto = {}): Promise<Record<string, unknown>> {
    return this.listGalleryItems(false, query);
  }

  async adminCreateGalleryItem(admin: AuthUser, dto: CreateGalleryItemDto): Promise<Record<string, unknown>> {
    return this.db.withTransaction(async (client) => {
      const created = await client.query<{ id: number }>(
        `INSERT INTO gallery_items(title, description, created_by, updated_by) VALUES($1,$2,$3,$3) RETURNING id`,
        [dto.title, dto.description, admin.sub],
      );
      const id = created.rows[0]?.id;
      if (id === undefined || id === null) {
        throw new NotFoundException('Failed to create gallery item');
      }
      await this.syncGalleryAssets(client, id, dto.imageFileIds ?? []);
      return this.getGalleryItemWithExecutor(client, id);
    });
  }

  async adminUpdateGalleryItem(admin: AuthUser, galleryId: number, dto: UpdateGalleryItemDto): Promise<Record<string, unknown>> {
    return this.db.withTransaction(async (client) => {
      const q = await client.query(
        `UPDATE gallery_items SET title = COALESCE($1,title), description = COALESCE($2,description),
         is_active = COALESCE($3,is_active), updated_by = $4, updated_at = NOW()
         WHERE id = $5 AND deleted_at IS NULL RETURNING id`,
        [dto.title ?? null, dto.description ?? null, dto.isActive ?? null, admin.sub, galleryId],
      );
      if (!q.rowCount) throw new NotFoundException('Gallery item not found');
      if (dto.imageFileIds) await this.syncGalleryAssets(client, galleryId, dto.imageFileIds);
      return this.getGalleryItemWithExecutor(client, galleryId);
    });
  }

  async adminDeleteGalleryItem(admin: AuthUser, galleryId: number): Promise<Record<string, unknown>> {
    const q = await this.db.query(
      `UPDATE gallery_items SET deleted_at = NOW(), updated_by = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING id`,
      [admin.sub, galleryId],
    );
    if (!q.rowCount) throw new NotFoundException('Gallery item not found');
    return { message: 'Gallery item deleted' };
  }

  async getGalleryItem(galleryId: number): Promise<Record<string, unknown>> {
    return this.getGalleryItemWithExecutor(this.db, galleryId);
  }

  private async getGalleryItemWithExecutor(executor: SqlExecutor, galleryId: number): Promise<Record<string, unknown>> {
    const q = await executor.query(
      `SELECT id, title, description, is_active, created_at::text AS created_at
       FROM gallery_items WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [galleryId],
    );
    if (!q.rowCount) throw new NotFoundException('Gallery item not found');
    const [item] = await this.attachGalleryAssets(executor, q.rows as Array<Record<string, unknown>>);
    return { item };
  }

  async createItemRating(user: AuthUser, dto: CreateItemRatingDto): Promise<Record<string, unknown>> {
    try {
      if (dto.itemType === ItemType.ORDER) {
        await this.assertRateableProduct(user.sub, dto.orderId!, dto.productId!);
        const q = await this.db.query(
          `INSERT INTO product_ratings(user_id, order_id, product_id, rating_value, comment)
           VALUES($1,$2,$3,$4,$5)
           RETURNING id, user_id, order_id, product_id, rating_value, comment, created_at::text AS created_at`,
          [user.sub, dto.orderId, dto.productId, dto.ratingValue, dto.comment ?? null],
        );
        return { rating: q.rows[0] };
      }

      await this.assertRateableItem(user.sub, dto.itemType, dto.itemId!);
      const q = await this.db.query(
        `INSERT INTO item_ratings(user_id, item_type, item_id, rating_value, comment)
         VALUES($1,$2,$3,$4,$5) RETURNING id, user_id, item_type, item_id, rating_value, comment, created_at::text AS created_at`,
        [user.sub, dto.itemType, dto.itemId, dto.ratingValue, dto.comment ?? null],
      );
      return { rating: q.rows[0] };
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new BadRequestException('Rating already exists');
      }
      throw error;
    }
  }

  async getItemReviews(itemId: number, query: GetItemReviewsQueryDto): Promise<Record<string, unknown>> {
    const limit = Math.min(query.limit ?? 20, 100);
    const page = Math.max((query.page ?? 1) - 1, 0);
    const offset = page * limit;

    const totalQ = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM item_ratings WHERE item_type = $1 AND item_id = $2`,
      [query.itemType, itemId],
    );
    const total = parseInt(totalQ.rows[0]?.count ?? '0', 10);

    const q = await this.db.query(
      `SELECT id, user_id, item_type, item_id, rating_value, comment, created_at::text AS created_at
       FROM item_ratings
       WHERE item_type = $1 AND item_id = $2
       ORDER BY created_at DESC, id DESC
       LIMIT $3 OFFSET $4`,
      [query.itemType, itemId, limit, offset],
    );

    return { items: q.rows, total };
  }

  async createFollowupConversation(user: AuthUser, dto: CreateFollowupConversationDto): Promise<Record<string, unknown>> {
    await this.assertUserOwnsItem(user, dto.itemType, dto.itemId);
    const adminId = dto.adminId ?? await this.findAnyAdminId();
    if (!adminId) throw new BadRequestException('No admin account available');
    if (!await this.isActiveAdmin(adminId)) throw new BadRequestException('Admin not found');
    const q = await this.db.query(
      `INSERT INTO followup_conversations(item_type, item_id, user_id, admin_id)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(item_type, item_id, user_id)
       DO UPDATE SET admin_id = EXCLUDED.admin_id
       RETURNING *`,
      [dto.itemType, dto.itemId, user.sub, adminId],
    );
    return { conversation: q.rows[0] };
  }

  async listFollowupMessages(
    user: AuthUser,
    conversationId: number,
    itemType?: ItemType,
    itemId?: number,
  ): Promise<Record<string, unknown>> {
    await this.assertFollowupConversationAccess(user, conversationId);
    if (itemType !== undefined && itemId !== undefined) {
      await this.assertFollowupConversationItemScope(conversationId, itemType, itemId);
    }
    const q = await this.db.query(
      `SELECT id, conversation_id, sender_id, message_text, sent_at::text AS sent_at
       FROM followup_messages WHERE conversation_id = $1 ORDER BY sent_at ASC`,
      [conversationId],
    );
    return { items: q.rows };
  }

  async sendFollowupMessage(
    user: AuthUser,
    conversationId: number,
    dto: SendFollowupMessageDto,
    itemType?: ItemType,
    itemId?: number,
  ): Promise<Record<string, unknown>> {
    await this.assertFollowupConversationAccess(user, conversationId);
    if (itemType !== undefined && itemId !== undefined) {
      await this.assertFollowupConversationItemScope(conversationId, itemType, itemId);
    }
    const q = await this.db.query(
      `INSERT INTO followup_messages(conversation_id, sender_id, message_text)
       VALUES($1,$2,$3) RETURNING id, conversation_id, sender_id, message_text, sent_at::text AS sent_at`,
      [conversationId, user.sub, dto.messageText],
    );
    return { message: q.rows[0] };
  }

  private async findAnyAdminId(): Promise<number | null> {
    const q = await this.db.query<{ id: number }>(`SELECT id FROM users WHERE is_admin = true AND deleted_at IS NULL ORDER BY id ASC LIMIT 1`);
    return q.rowCount ? Number(q.rows[0].id) : null;
  }

  private async assertUserOwnsItem(user: AuthUser, itemType: ItemType, itemId: number): Promise<void> {
    const ownership = await this.resolveOwnership(itemType, itemId);
    if (ownership === null) throw new NotFoundException('Item not found');
    if (user.isAdmin) return;
    if (ownership !== user.sub) throw new ForbiddenException('Not allowed');
  }

  private async assertItemExists(itemType: ItemType, itemId: number): Promise<void> {
    const ownership = await this.resolveOwnership(itemType, itemId);
    if (ownership === null) throw new NotFoundException('Item not found');
  }

  private async isActiveAdmin(userId: number): Promise<boolean> {
    const q = await this.db.query<{ id: number }>(
      `SELECT id FROM users WHERE id = $1 AND is_admin = true AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    return Number(q.rowCount ?? 0) > 0;
  }

  private async resolveOwnership(itemType: ItemType, itemId: number): Promise<number | null> {
    if (itemType === ItemType.ORDER) {
      const q = await this.db.query<{ user_id: number }>(`SELECT user_id FROM product_orders WHERE id = $1`, [itemId]);
      return q.rowCount ? Number(q.rows[0].user_id) : null;
    }
    if (itemType === ItemType.FAULT) {
      const q = await this.db.query<{ user_id: number }>(`SELECT user_id FROM fault_reports WHERE id = $1`, [itemId]);
      return q.rowCount ? Number(q.rows[0].user_id) : null;
    }
    const q = await this.db.query<{ user_id: number }>(`SELECT user_id FROM service_orders WHERE id = $1`, [itemId]);
    return q.rowCount ? Number(q.rows[0].user_id) : null;
  }

  private async assertRateableItem(userId: number, itemType: ItemType, itemId: number): Promise<void> {
    const owner = await this.resolveOwnership(itemType, itemId);
    if (owner === null) throw new NotFoundException('Item not found');
    if (owner !== userId) throw new ForbiddenException('Not allowed');

    if (itemType === ItemType.ORDER) {
      const q = await this.db.query<{ status: OrderStatus }>(`SELECT status FROM product_orders WHERE id = $1`, [itemId]);
      if (q.rows[0].status !== OrderStatus.DELIVERED) throw new BadRequestException('Rating allowed only after delivery');
      return;
    }
    if (itemType === ItemType.FAULT) {
      const q = await this.db.query<{ status: FaultStatus }>(`SELECT status FROM fault_reports WHERE id = $1`, [itemId]);
      if (q.rows[0].status !== FaultStatus.FINISHED) throw new BadRequestException('Rating allowed only after completion');
      return;
    }
    const q = await this.db.query<{ status: ServiceStatus }>(`SELECT status FROM service_orders WHERE id = $1`, [itemId]);
    if (q.rows[0].status !== ServiceStatus.FINISHED) throw new BadRequestException('Rating allowed only after completion');
  }

  private async assertRateableProduct(userId: number, orderId: number, productId: number): Promise<void> {
    const q = await this.db.query<{ user_id: number; status: OrderStatus }>(
      `SELECT user_id, status FROM product_orders WHERE id = $1 LIMIT 1`,
      [orderId],
    );
    if (!q.rowCount) throw new NotFoundException('Order not found');
    if (Number(q.rows[0].user_id) !== userId) throw new ForbiddenException('Not allowed');
    if (q.rows[0].status !== OrderStatus.DELIVERED) throw new BadRequestException('Rating allowed only after delivery');

    const item = await this.db.query<{ id: number }>(
      `SELECT id FROM order_items WHERE order_id = $1 AND product_id = $2 LIMIT 1`,
      [orderId, productId],
    );
    if (!item.rowCount) throw new BadRequestException('Product was not ordered in this order');
  }

  private async assertFollowupConversationAccess(user: AuthUser, conversationId: number): Promise<void> {
    const q = await this.db.query<{ user_id: number; admin_id: number }>(
      `SELECT user_id, admin_id FROM followup_conversations WHERE id = $1 LIMIT 1`,
      [conversationId],
    );
    if (!q.rowCount) throw new NotFoundException('Conversation not found');
    const row = q.rows[0];
    if (Number(row.user_id) !== user.sub && Number(row.admin_id) !== user.sub) throw new ForbiddenException('Not allowed');
  }

  private async assertFollowupConversationItemScope(conversationId: number, itemType: ItemType, itemId: number): Promise<void> {
    const q = await this.db.query<{ id: number }>(
      `SELECT id FROM followup_conversations WHERE id = $1 AND item_type = $2 AND item_id = $3 LIMIT 1`,
      [conversationId, itemType, itemId],
    );
    if (!q.rowCount) throw new NotFoundException('Conversation not found');
  }

  private async getProductWithAssets(executor: SqlExecutor, productId: number): Promise<Record<string, unknown>> {
    const q = await executor.query(
      `SELECT cp.id, cp.title, cp.description, cp.amount, cp.price, cp.details, cp.is_active,
              cp.created_at::text AS created_at, cp.updated_at::text AS updated_at,
              COALESCE(ROUND(AVG(pr.rating_value)::numeric, 2), 0)::text AS rate
       FROM catalog_products cp
       LEFT JOIN product_ratings pr ON pr.product_id = cp.id
       WHERE cp.id = $1 AND cp.deleted_at IS NULL
       GROUP BY cp.id
       LIMIT 1`,
      [productId],
    );
    if (!q.rowCount) throw new NotFoundException('Product not found');
    const [product] = await this.attachProductAssets(executor, q.rows as Array<Record<string, unknown>>);
    return { product };
  }

  private async attachProductAssets(executor: SqlExecutor, products: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
    if (!products.length) return products;

    const productIds = products.map((product) => Number(product.id));
    const assets = await executor.query(
      `SELECT pa.product_id, pa.file_id, pa.asset_type, pa.sort_order, f.object_key, f.original_filename, f.mime_type, f.status
       FROM product_assets pa
       LEFT JOIN files f ON f.id = pa.file_id
       WHERE pa.product_id = ANY($1::bigint[])
       ORDER BY pa.product_id ASC, pa.asset_type ASC, pa.sort_order ASC, pa.id ASC`,
      [productIds],
    );

    const byProductId = new Map<number, { images: Record<string, unknown>[]; files: Record<string, unknown>[] }>();
    for (const asset of assets.rows as ProductAssetRow[]) {
      const productId = Number(asset.product_id);
      const bucket = byProductId.get(productId) ?? { images: [], files: [] };
      const payload = {
        file_id: Number(asset.file_id),
        sort_order: asset.sort_order,
        object_key: asset.object_key,
        original_filename: asset.original_filename,
        mime_type: asset.mime_type,
        status: asset.status,
      };
      if (asset.asset_type === 'image') {
        bucket.images.push(payload);
      } else {
        bucket.files.push(payload);
      }
      byProductId.set(productId, bucket);
    }

    return products.map((product) => {
      const related = byProductId.get(Number(product.id)) ?? { images: [], files: [] };
      return { ...product, images: related.images, files: related.files };
    });
  }

  private async listGalleryItems(activeOnly: boolean, query: ListGalleryQueryDto = {}): Promise<Record<string, unknown>> {
    const conditions = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (activeOnly) conditions.push('is_active = true');

    if (query.query) {
      params.push(`%${this.escapeLike(query.query)}%`);
      conditions.push(`(title ILIKE $${params.length} ESCAPE '\\' OR description ILIKE $${params.length} ESCAPE '\\')`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const limit = Math.min(query.limit ?? 20, 100);
    const page = Math.max((query.page ?? 1) - 1, 0);
    const offset = page * limit;

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const totalQ = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM gallery_items ${whereClause}`,
      params.slice(0, params.length - 2),
    );
    const total = parseInt(totalQ.rows[0]?.count ?? '0', 10);

    const q = await this.db.query(
      `SELECT id, title, description, is_active, created_at::text AS created_at
       FROM gallery_items
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    return { items: await this.attachGalleryAssets(this.db, q.rows as Array<Record<string, unknown>>), total };
  }

  private async attachGalleryAssets(executor: SqlExecutor, galleryItems: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
    if (!galleryItems.length) return galleryItems;

    const galleryItemIds = galleryItems.map((item) => Number(item.id));
    const assets = await executor.query(
      `SELECT ga.gallery_item_id, ga.file_id, ga.sort_order, f.object_key, f.original_filename, f.mime_type, f.status
       FROM gallery_assets ga
       LEFT JOIN files f ON f.id = ga.file_id
       WHERE ga.gallery_item_id = ANY($1::bigint[])
       ORDER BY ga.gallery_item_id ASC, ga.sort_order ASC, ga.id ASC`,
      [galleryItemIds],
    );

    const byGalleryItemId = new Map<number, Record<string, unknown>[]>();
    for (const asset of assets.rows as GalleryAssetRow[]) {
      const galleryItemId = Number(asset.gallery_item_id);
      const bucket = byGalleryItemId.get(galleryItemId) ?? [];
      bucket.push({
        file_id: Number(asset.file_id),
        sort_order: asset.sort_order,
        object_key: asset.object_key,
        original_filename: asset.original_filename,
        mime_type: asset.mime_type,
        status: asset.status,
      });
      byGalleryItemId.set(galleryItemId, bucket);
    }

    return galleryItems.map((item) => ({
      ...item,
      images: byGalleryItemId.get(Number(item.id)) ?? [],
    }));
  }

  private async createOrderRecord(
    client: SqlExecutor,
    user: AuthUser,
    deliveryAddress: string,
    items: Array<{ productId: number; quantity: number }>,
  ): Promise<Record<string, unknown>> {
    const order = await client.query(
      `INSERT INTO product_orders(user_id, delivery_address) VALUES($1,$2) RETURNING id`,
      [user.sub, deliveryAddress],
    );
    const orderId = Number((order.rows[0] as { id: number }).id);

    for (const item of items) {
      const product = await client.query(
        `SELECT id, amount, price::text, is_active FROM catalog_products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [item.productId],
      );
      const productRow = product.rows[0] as { id: number; amount: number; price: string; is_active: boolean } | undefined;
      if (!product.rowCount || !productRow?.is_active) throw new BadRequestException(`Invalid product ${item.productId}`);
      if (Number(productRow.amount) < item.quantity) {
        throw new BadRequestException(`Insufficient product amount for ${item.productId}`);
      }

      await client.query(
        `INSERT INTO order_items(order_id, product_id, quantity, unit_price) VALUES($1,$2,$3,$4)`,
        [orderId, item.productId, item.quantity, productRow.price],
      );
      await client.query(`UPDATE catalog_products SET amount = amount - $1, updated_at = NOW() WHERE id = $2`, [item.quantity, item.productId]);
    }

    await client.query(`INSERT INTO order_status_history(order_id, status, changed_by) VALUES($1,$2,$3)`, [orderId, OrderStatus.RECEIVED, user.sub]);
    const [fullOrder] = await this.attachOrderItems(
      client,
      [{
        id: orderId,
        user_id: user.sub,
        delivery_address: deliveryAddress,
        status: OrderStatus.RECEIVED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
      false,
    );
    return { order: fullOrder };
  }

  private async attachOrderItems(
    executor: SqlExecutor,
    orders: Array<Record<string, unknown>>,
    includeUser: boolean,
  ): Promise<Array<Record<string, unknown>>> {
    if (!orders.length) return orders;

    const orderIds = orders.map((order) => Number(order.id));
    const items = await executor.query(
      `SELECT oi.order_id, oi.id, oi.product_id, oi.quantity, oi.unit_price::text AS unit_price, cp.title, cp.is_active
       FROM order_items oi
       LEFT JOIN catalog_products cp ON cp.id = oi.product_id
       WHERE oi.order_id = ANY($1::bigint[])
       ORDER BY oi.order_id ASC, oi.id ASC`,
      [orderIds],
    );

    const itemsByOrderId = new Map<number, Record<string, unknown>[]>();
    for (const item of items.rows as Array<{
      order_id: number;
      id: number;
      product_id: number;
      quantity: number;
      unit_price: string;
      title: string;
      is_active: boolean;
    }>) {
      const orderId = Number(item.order_id);
      const bucket = itemsByOrderId.get(orderId) ?? [];
      bucket.push({
        id: Number(item.id),
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        unit_price: item.unit_price,
        product: {
          id: Number(item.product_id),
          title: item.title,
          is_active: item.is_active,
        },
      });
      itemsByOrderId.set(orderId, bucket);
    }

    return orders.map((order) => {
      const orderId = Number(order.id);
      const orderItems = itemsByOrderId.get(orderId) ?? [];
      const enriched: Record<string, unknown> = {
        ...order,
        item_count: orderItems.length,
        items: orderItems,
      };
      if (includeUser) {
        enriched.user = {
          id: Number(order.user_id),
          name: order.user_name,
          email: order.user_email,
          phone: order.user_phone,
        };
      }
      delete enriched.user_name;
      delete enriched.user_email;
      delete enriched.user_phone;
      return enriched;
    });
  }

  private async assertCartProductState(productId: number, quantity: number): Promise<void> {
    const q = await this.db.query<{ amount: number; is_active: boolean }>(
      `SELECT amount, is_active FROM catalog_products WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [productId],
    );
    if (!q.rowCount || !q.rows[0].is_active) throw new BadRequestException(`Invalid product ${productId}`);
    if (Number(q.rows[0].amount) < quantity) throw new BadRequestException(`Insufficient product amount for ${productId}`);
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }

  private async syncProductAssets(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }, productId: number, fileIds: number[], assetType: 'image' | 'file'): Promise<void> {
    await client.query(`DELETE FROM product_assets WHERE product_id = $1 AND asset_type = $2`, [productId, assetType]);
    for (let i = 0; i < fileIds.length; i += 1) {
      await client.query(
        `INSERT INTO product_assets(product_id, file_id, asset_type, sort_order) VALUES($1,$2,$3,$4)`,
        [productId, fileIds[i], assetType, i],
      );
    }
  }

  private async syncFaultAssets(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }, faultId: number, fileIds: number[]): Promise<void> {
    await this.assertValidFaultImageFiles(client, fileIds);
    await client.query(`DELETE FROM fault_assets WHERE fault_id = $1`, [faultId]);
    for (let i = 0; i < fileIds.length; i += 1) {
      await client.query(`INSERT INTO fault_assets(fault_id, file_id, sort_order) VALUES($1,$2,$3)`, [faultId, fileIds[i], i]);
    }
  }

  private buildFaultOrderClause(sortBy: FaultSortBy, sortDirection: string): string {
    if (sortBy === FaultSortBy.SEVERITY) {
      return `ORDER BY CASE fr.severity
              WHEN 'normal' THEN 1
              WHEN 'high' THEN 2
              WHEN 'urgent' THEN 3
              WHEN 'emergent' THEN 4
              ELSE 999
            END ${sortDirection}, fr.created_at DESC, fr.id DESC`;
    }
    return `ORDER BY fr.created_at ${sortDirection}, fr.id DESC`;
  }

  private assertValidFaultTransition(current: FaultStatus, next: FaultStatus): void {
    if (current === next) return;
    const transitions: Record<FaultStatus, FaultStatus[]> = {
      [FaultStatus.RECEIVED]: [FaultStatus.ASSIGNED, FaultStatus.CANCELLED],
      [FaultStatus.ASSIGNED]: [FaultStatus.ON_THE_WAY, FaultStatus.CANCELLED],
      [FaultStatus.ON_THE_WAY]: [FaultStatus.IN_PROGRESS, FaultStatus.CANCELLED],
      [FaultStatus.IN_PROGRESS]: [FaultStatus.FINISHED, FaultStatus.CANCELLED],
      [FaultStatus.FINISHED]: [],
      [FaultStatus.CANCELLED]: [],
    };
    if (!transitions[current].includes(next)) {
      throw new BadRequestException(`Invalid fault status transition from ${current} to ${next}`);
    }
  }

  private async attachFaultAssets(executor: SqlExecutor, faults: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
    if (!faults.length) return faults;
    const faultIds = faults.map((fault) => Number(fault.id));
    const assets = await executor.query(
      `SELECT fa.fault_id, fa.file_id, fa.sort_order, f.object_key, f.original_filename, f.mime_type, f.status
       FROM fault_assets fa
       LEFT JOIN files f ON f.id = fa.file_id
       WHERE fa.fault_id = ANY($1::bigint[])
       ORDER BY fa.fault_id ASC, fa.sort_order ASC, fa.id ASC`,
      [faultIds],
    );
    const byFaultId = new Map<number, Array<Record<string, unknown>>>();
    for (const row of assets.rows as FaultAssetRow[]) {
      const faultId = Number(row.fault_id);
      const bucket = byFaultId.get(faultId) ?? [];
      bucket.push({
        file_id: Number(row.file_id),
        sort_order: row.sort_order,
        object_key: row.object_key,
        original_filename: row.original_filename,
        mime_type: row.mime_type,
        status: row.status,
      });
      byFaultId.set(faultId, bucket);
    }
    return faults.map((fault) => ({ ...fault, images: byFaultId.get(Number(fault.id)) ?? [] }));
  }

  private async assertValidFaultImageFiles(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }, fileIds: number[]): Promise<void> {
    if (!fileIds.length) return;
    const uniqueIds = [...new Set(fileIds)];
    const placeholders = uniqueIds.map((_, index) => `$${index + 1}`).join(', ');
    const q = await client.query(
      `SELECT id, purpose, status, mime_type FROM files WHERE id IN (${placeholders})`,
      uniqueIds,
    ) as { rows: Array<{ id: number; purpose: string; status: string; mime_type: string | null }> };
    const filesById = new Map(q.rows.map((row) => [Number(row.id), row]));
    for (const fileId of uniqueIds) {
      const file = filesById.get(Number(fileId));
      if (!file) throw new BadRequestException(`File ${fileId} not found`);
      if (file.status !== 'uploaded') throw new BadRequestException(`File ${fileId} must be uploaded before fault association`);
      if (file.purpose !== 'product_image') throw new BadRequestException(`File ${fileId} must have purpose product_image`);
      if (!file.mime_type || !file.mime_type.startsWith('image/')) throw new BadRequestException(`File ${fileId} must be an image`);
    }
  }

  private async syncGalleryAssets(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }, galleryItemId: number, fileIds: number[]): Promise<void> {
    await client.query(`DELETE FROM gallery_assets WHERE gallery_item_id = $1`, [galleryItemId]);
    for (let i = 0; i < fileIds.length; i += 1) {
      await client.query(
        `INSERT INTO gallery_assets(gallery_item_id, file_id, sort_order) VALUES($1,$2,$3)`,
        [galleryItemId, fileIds[i], i],
      );
    }
  }
}
