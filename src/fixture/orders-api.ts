import type { Order, OrdersResponse, ReproductionRequest, TargetVariant } from "../types.ts";

const ORDERS: Order[] = [
  { id: "ord-001", status: "pending", total: 24.5 },
  { id: "ord-002", status: "shipped", total: 58 },
  { id: "ord-003", status: "processing", total: 13.25 },
  { id: "ord-004", status: "shipped", total: 91.1 },
  { id: "ord-005", status: "cancelled", total: 44 },
  { id: "ord-006", status: "shipped", total: 37.75 },
  { id: "ord-007", status: "pending", total: 19.99 },
  { id: "ord-008", status: "shipped", total: 12.5 }
];

export function dispatchOrders(target: TargetVariant, request: ReproductionRequest): OrdersResponse {
  const { status, limit, offset } = request.query;
  const matching = status ? ORDERS.filter((order) => order.status === status) : [...ORDERS];

  // The two variants intentionally share the same contract and total count.
  // Only the order of filtering and pagination differs.
  const items = target === "buggy"
    ? ORDERS.slice(offset, offset + limit).filter((order) => !status || order.status === status)
    : matching.slice(offset, offset + limit);

  return { items, total: matching.length, limit, offset };
}

export function fixtureOrders(): readonly Order[] {
  return ORDERS;
}
