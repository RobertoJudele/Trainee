import { BillingTransaction } from "../../../models/billingTransaction";
import { TransactionRecord } from "../types";
import { TransactionRepository } from "../ports";

export class SequelizeTransactionRepo implements TransactionRepository {
  async findOrCreate(record: TransactionRecord): Promise<TransactionRecord> {
    const [row] = await BillingTransaction.findOrCreate({
      where: {
        provider: record.provider,
        transactionId: record.transactionId,
      },
      defaults: {
        trainerId: record.trainerId,
        amount: record.amount,
        currency: record.currency,
        status: record.status,
        provider: record.provider,
        transactionId: record.transactionId,
        productId: record.productId,
        paidAt: record.paidAt,
      },
    });
    return this.toRecord(row);
  }

  async findAllByTrainerId(trainerId: number): Promise<TransactionRecord[]> {
    const rows = await BillingTransaction.findAll({
      where: { trainerId },
      order: [["paidAt", "DESC"]],
    });
    return rows.map(r => this.toRecord(r));
  }

  private toRecord(row: BillingTransaction): TransactionRecord {
    return {
      trainerId: row.trainerId,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      provider: row.provider,
      transactionId: row.transactionId,
      productId: row.productId,
      paidAt: row.paidAt,
    };
  }
}
