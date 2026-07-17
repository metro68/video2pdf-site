export type ConnectorStatus = "ok" | "awaiting_credentials" | "error";

export interface ConnectorResult<T> {
  data: T | null;
  asOf: string | null;
  status: ConnectorStatus;
  error?: string;
}
