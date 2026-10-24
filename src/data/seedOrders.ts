import { IncomingOrder } from '../types';

export const SEED_ORDERS: IncomingOrder[] = [
  {
    id: 'PO-2026-089',
    sku: 'SKU-103', // Covers TC3 - Existing pending order covers demand
    supplierId: 'SUP-001',
    orderedQuantity: 30,
    remainingOpenQuantity: 30,
    expectedArrivalDate: '2026-10-25',
    status: 'In Transit',
    sourceRecordId: 'EXT-ERP-8821',
    orderDate: '2026-10-21',
  },
  {
    id: 'PO-2026-092',
    sku: 'SKU-105',
    supplierId: 'SUP-005',
    orderedQuantity: 40,
    remainingOpenQuantity: 40,
    expectedArrivalDate: '2026-10-27',
    status: 'In Transit',
    sourceRecordId: 'EXT-ERP-8824',
    orderDate: '2026-10-22',
  },
  {
    id: 'PO-2026-095',
    sku: 'SKU-108',
    supplierId: 'SUP-006',
    orderedQuantity: 60,
    remainingOpenQuantity: 60,
    expectedArrivalDate: '2026-10-29',
    status: 'Ordered',
    sourceRecordId: 'EXT-ERP-8830',
    orderDate: '2026-10-23',
  },
  {
    id: 'PO-2026-078',
    sku: 'SKU-101',
    supplierId: 'SUP-002',
    orderedQuantity: 25,
    remainingOpenQuantity: 0, // Received, so NOT counted in open pipeline
    expectedArrivalDate: '2026-10-18',
    status: 'Received',
    sourceRecordId: 'EXT-ERP-8799',
    orderDate: '2026-10-12',
  },
  {
    id: 'PO-2026-082',
    sku: 'SKU-106',
    supplierId: 'SUP-003',
    orderedQuantity: 50,
    remainingOpenQuantity: 0, // Cancelled
    expectedArrivalDate: '2026-10-19',
    status: 'Cancelled',
    sourceRecordId: 'EXT-ERP-8805',
    orderDate: '2026-10-14',
  },
];
