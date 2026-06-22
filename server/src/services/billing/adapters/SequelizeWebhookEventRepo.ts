import { BillingWebhookEvent } from "../../../models/billingWebhookEvent";
import { WebhookEventRecord } from "../types";
import { WebhookEventRepository } from "../ports";

export class SequelizeWebhookEventRepo implements WebhookEventRepository {
  async findBySourceAndEventId(
    source: string,
    eventId: string,
  ): Promise<WebhookEventRecord | null> {
    const row = await BillingWebhookEvent.findOne({
      where: { source, eventId },
    });
    return row ? this.toRecord(row) : null;
  }

  async create(
    record: Omit<WebhookEventRecord, "processedAt">,
  ): Promise<WebhookEventRecord> {
    const row = await BillingWebhookEvent.create({
      source: record.source,
      eventId: record.eventId,
      eventType: record.eventType,
      appUserId: record.appUserId,
      eventTimestampMs: record.eventTimestampMs,
      payload: record.payload,
    });
    return this.toRecord(row);
  }

  async markProcessed(source: string, eventId: string): Promise<void> {
    await BillingWebhookEvent.update(
      { processedAt: new Date() },
      { where: { source, eventId } },
    );
  }

  private toRecord(row: BillingWebhookEvent): WebhookEventRecord {
    return {
      source: row.source,
      eventId: row.eventId,
      eventType: row.eventType,
      appUserId: row.appUserId || undefined,
      eventTimestampMs: row.eventTimestampMs ? Number(row.eventTimestampMs) : undefined,
      payload: row.payload,
      processedAt: row.processedAt || undefined,
    };
  }
}
