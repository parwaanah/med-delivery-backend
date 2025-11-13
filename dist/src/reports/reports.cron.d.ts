import { ReportsService } from './reports.service';
export declare class ReportsCron {
    private readonly reports;
    private readonly logger;
    constructor(reports: ReportsService);
    handleDailyReport(): Promise<void>;
}
