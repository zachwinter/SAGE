import type { AnalysisData } from "./types.js";
export interface IngestStats {
    entities: number;
    relationships: number;
    duration: number;
}
export declare class RustKuzuIngestor {
    private dbPath;
    private serverProcess;
    private serverReady;
    constructor(dbPath: string);
    initialize(): Promise<void>;
    /**
     * Start the Kùzu ingestion server process for improved performance
     */
    startServer(): Promise<void>;
    /**
     * Stop the Kùzu ingestion server process
     */
    stopServer(): Promise<void>;
    /**
     * Send data to the server for immediate ingestion
     */
    ingestToServer(analysisData: AnalysisData, batchSize?: number): Promise<IngestStats>;
    private performHandshake;
    ingest(analysisData: AnalysisData): Promise<IngestStats>;
    ingestStream(analysisData: AnalysisData, batchSize?: number, progressCallback?: (message: string) => void): Promise<IngestStats>;
    ingestBulk(analysisData: AnalysisData): Promise<IngestStats>;
    query(cypher: string): Promise<any[]>;
    close(): Promise<void>;
    private runRustCommand;
    private parseStructuredResult;
    private parseQueryOutput;
    private streamDataToProcess;
    /**
     * Stream analysis data as CSV for bulk COPY FROM ingestion
     */
    private streamCSVToProcess;
    private escapeCsv;
}
//# sourceMappingURL=rust-ingestor.d.ts.map