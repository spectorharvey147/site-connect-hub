import { casualLabourService } from "@/services/casualLabourService";
import { fuelService } from "@/services/fuelService";
import { machineryService } from "@/services/machineryService";
import { materialsService } from "@/services/materialsService";
import type { AppUser } from "@/types/auth";
import type { VendorBillInput } from "@/types/vendors";

export interface VendorBillSourceRow {
  id: string;
  date: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  sourceStatus: string;
}

export interface VendorBillSourcePreview {
  billType: VendorBillInput["billType"];
  rows: VendorBillSourceRow[];
  grossAmount: number;
}

function inPeriod(date: string, input: VendorBillInput) {
  return date >= input.billingPeriodFrom && date <= input.billingPeriodTo;
}

export const vendorBillSourceService = {
  async preview(
    input: VendorBillInput,
    actor: AppUser,
  ): Promise<VendorBillSourcePreview> {
    let rows: VendorBillSourceRow[] = [];

    if (input.billType === "labor") {
      const records = await casualLabourService.listAttendance(actor, {
        projectId: input.projectId,
        vendorId: input.vendorId,
      });
      rows = records
        .filter((record) => inPeriod(record.date, input))
        .flatMap((record) =>
          record.rows.map((row) => {
            const attendanceFactor =
              row.status === "present" ? 1 : row.status === "half_day" ? 0.5 : 0;
            const amount =
              row.dailyRate * attendanceFactor +
              row.overtimeHours * row.overtimeRate;
            return {
              id: `${record.id}:${row.id}`,
              date: record.date,
              description: `${row.workerName} · ${row.category} · ${row.overtimeHours} OT hrs`,
              quantity: attendanceFactor,
              unit: "day",
              rate: row.dailyRate,
              amount,
              sourceStatus: record.status,
            };
          }),
        );
    } else if (input.billType === "machinery") {
      const logs = await machineryService.listLogs(actor, {
        projectId: input.projectId,
        vendorId: input.vendorId,
      });
      rows = logs.filter((log) => inPeriod(log.date, input)).map((log) => ({
        id: log.id,
        date: log.date,
        description: `${log.machineNumber} · ${log.machineType}${log.breakdown.isBreakdown ? " · breakdown" : ""}`,
        quantity: log.totalMeterHours,
        unit: log.billingType === "per_trip" ? "trip" : "hour",
        rate: log.billingRate ?? 0,
        amount: log.calculatedCost ?? log.totalMeterHours * (log.billingRate ?? 0),
        sourceStatus: log.status,
      }));
    } else if (input.billType === "fuel") {
      const receipts = await fuelService.listReceipts(actor, {
        projectId: input.projectId,
        vendorId: input.vendorId,
      });
      rows = receipts.filter((receipt) => inPeriod(receipt.date, input)).map((receipt) => ({
        id: receipt.id,
        date: receipt.date,
        description: `${receipt.fuelType} · ${receipt.source} · ${receipt.referenceNumber}`,
        quantity: receipt.quantity,
        unit: receipt.unit,
        rate: receipt.ratePerUnit,
        amount: receipt.totalAmount,
        sourceStatus: receipt.status,
      }));
    } else if (input.billType === "material") {
      const receipts = await materialsService.listReceipts(actor, {
        projectId: input.projectId,
      });
      rows = receipts
        .filter(
          (receipt) =>
            receipt.vendorId === input.vendorId &&
            inPeriod(receipt.receiptDate, input),
        )
        .flatMap((receipt) =>
          receipt.items.map((item) => ({
            id: `${receipt.id}:${item.id}`,
            date: receipt.receiptDate,
            description: `${item.materialName} · invoice ${receipt.invoiceNumber}`,
            quantity: item.quantityReceived,
            unit: item.uom,
            rate: 0,
            amount: 0,
            sourceStatus: receipt.status,
          })),
        );
    }

    return {
      billType: input.billType,
      rows,
      grossAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    };
  },
};
