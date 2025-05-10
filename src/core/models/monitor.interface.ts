import {IProcessedTransaction, ISourceData} from "@core/types";

export interface Monitor {
    start(): Promise<void>;
    stop(): Promise<void>;
    intervalHours: number;
    monitorFn: (inputData: ISourceData) => Promise<IProcessedTransaction[]>;
    wallets: string[];
    network: string;
}